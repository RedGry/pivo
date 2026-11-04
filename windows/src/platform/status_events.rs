use std::sync::mpsc::{Sender, channel};
use tauri::Emitter;
use windows::{
    Foundation::TypedEventHandler,
    Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    },
    Networking::Connectivity::{NetworkInformation, NetworkStatusChangedEventHandler},
    Win32::{
        Foundation::PROPERTYKEY,
        Media::Audio::{
            AUDIO_VOLUME_NOTIFICATION_DATA, DEVICE_STATE, EDataFlow, ERole,
            Endpoints::{
                IAudioEndpointVolume, IAudioEndpointVolumeCallback,
                IAudioEndpointVolumeCallback_Impl,
            },
            IMMDeviceEnumerator, IMMNotificationClient, IMMNotificationClient_Impl,
            MMDeviceEnumerator, eMultimedia, eRender,
        },
        System::{
            Com::{CLSCTX_ALL, CoCreateInstance},
            WinRT::{RO_INIT_MULTITHREADED, RoInitialize, RoUninitialize},
        },
    },
};
use windows_core::{PCWSTR, Result, implement};
use windows_sys::Win32::{
    Foundation::HWND,
    System::Power::{
        HPOWERNOTIFY, RegisterPowerSettingNotification, UnregisterPowerSettingNotification,
    },
    UI::WindowsAndMessaging::DEVICE_NOTIFY_WINDOW_HANDLE,
};

enum Change {
    AudioDevice,
    Volume(u8, bool),
    MediaSession,
    Stop,
}

pub struct StatusEvents {
    sender: Sender<Change>,
    power: Vec<HPOWERNOTIFY>,
}

impl StatusEvents {
    pub fn start(app: tauri::AppHandle, window: HWND) -> Self {
        use windows::Win32::System::SystemServices::{
            GUID_ACDC_POWER_SOURCE, GUID_BATTERY_PERCENTAGE_REMAINING,
            GUID_VIDEO_CURRENT_MONITOR_BRIGHTNESS,
        };
        let power = [
            GUID_ACDC_POWER_SOURCE,
            GUID_BATTERY_PERCENTAGE_REMAINING,
            GUID_VIDEO_CURRENT_MONITOR_BRIGHTNESS,
        ]
        .into_iter()
        .filter_map(|setting| {
            let guid = windows_sys::core::GUID {
                data1: setting.data1,
                data2: setting.data2,
                data3: setting.data3,
                data4: setting.data4,
            };
            let notification = unsafe {
                RegisterPowerSettingNotification(window, &guid, DEVICE_NOTIFY_WINDOW_HANDLE)
            };
            (notification != 0).then_some(notification)
        })
        .collect();
        let (send, receive) = channel();
        let callbacks = send.clone();
        std::thread::spawn(move || {
            if unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.is_err() {
                return;
            }
            {
                let devices: Option<IMMDeviceEnumerator> =
                    unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok() };
                let device_callback: IMMNotificationClient = AudioDevices(callbacks.clone()).into();
                let device_events = devices.as_ref().filter(|devices| unsafe {
                    devices
                        .RegisterEndpointNotificationCallback(&device_callback)
                        .is_ok()
                });
                let volume_callback: IAudioEndpointVolumeCallback =
                    Volume(callbacks.clone()).into();
                let mut endpoint = observe_endpoint(devices.as_ref(), &volume_callback);

                let manager = Manager::RequestAsync()
                    .and_then(|request| request.join())
                    .ok();
                let session_token = manager.as_ref().and_then(|manager| {
                    manager
                        .CurrentSessionChanged(&TypedEventHandler::new(move |_, _| {
                            let _ = callbacks.send(Change::MediaSession);
                            Ok(())
                        }))
                        .ok()
                });
                let mut media = manager
                    .as_ref()
                    .and_then(|manager| MediaEvents::new(manager, &app));
                let network_app = app.clone();
                let network = NetworkInformation::NetworkStatusChanged(
                    &NetworkStatusChangedEventHandler::new(move |_| {
                        let _ = network_app.emit("pivo:hud-changed", ());
                        Ok(())
                    }),
                )
                .ok();

                while let Ok(change) = receive.recv() {
                    match change {
                        Change::Volume(level, muted) => {
                            let _ = app.emit("pivo:volume", (level, muted));
                        }
                        Change::AudioDevice => {
                            stop_endpoint(endpoint.take(), &volume_callback);
                            endpoint = observe_endpoint(devices.as_ref(), &volume_callback);
                            let _ = app.emit("pivo:hud-changed", ());
                        }
                        Change::MediaSession => {
                            drop(media.take());
                            media = manager
                                .as_ref()
                                .and_then(|manager| MediaEvents::new(manager, &app));
                            let _ = app.emit("pivo:media-changed", ());
                        }
                        Change::Stop => break,
                    }
                }
                if let Some(token) = network {
                    let _ = NetworkInformation::RemoveNetworkStatusChanged(token);
                }
                if let (Some(manager), Some(token)) = (&manager, session_token) {
                    let _ = manager.RemoveCurrentSessionChanged(token);
                }
                drop(media);
                stop_endpoint(endpoint, &volume_callback);
                if let Some(devices) = device_events {
                    let _ =
                        unsafe { devices.UnregisterEndpointNotificationCallback(&device_callback) };
                }
            }
            unsafe { RoUninitialize() };
        });
        Self {
            sender: send,
            power,
        }
    }
}

impl Drop for StatusEvents {
    fn drop(&mut self) {
        for handle in self.power.drain(..) {
            unsafe { UnregisterPowerSettingNotification(handle) };
        }
        let _ = self.sender.send(Change::Stop);
    }
}

#[implement(IAudioEndpointVolumeCallback)]
struct Volume(Sender<Change>);

impl IAudioEndpointVolumeCallback_Impl for Volume_Impl {
    fn OnNotify(&self, data: *mut AUDIO_VOLUME_NOTIFICATION_DATA) -> Result<()> {
        if let Some(data) = unsafe { data.as_ref() } {
            let level = (data.fMasterVolume.clamp(0.0, 1.0) * 100.0).round() as u8;
            let _ = self.0.send(Change::Volume(level, data.bMuted.as_bool()));
        }
        Ok(())
    }
}

#[implement(IMMNotificationClient)]
struct AudioDevices(Sender<Change>);

impl IMMNotificationClient_Impl for AudioDevices_Impl {
    fn OnDeviceStateChanged(&self, _: &PCWSTR, _: DEVICE_STATE) -> Result<()> {
        Ok(())
    }
    fn OnDeviceAdded(&self, _: &PCWSTR) -> Result<()> {
        Ok(())
    }
    fn OnDeviceRemoved(&self, _: &PCWSTR) -> Result<()> {
        Ok(())
    }
    fn OnPropertyValueChanged(&self, _: &PCWSTR, _: &PROPERTYKEY) -> Result<()> {
        Ok(())
    }
    fn OnDefaultDeviceChanged(&self, flow: EDataFlow, role: ERole, _: &PCWSTR) -> Result<()> {
        if flow == eRender && role == eMultimedia {
            let _ = self.0.send(Change::AudioDevice);
        }
        Ok(())
    }
}

fn observe_endpoint(
    devices: Option<&IMMDeviceEnumerator>,
    callback: &IAudioEndpointVolumeCallback,
) -> Option<IAudioEndpointVolume> {
    unsafe {
        let device = devices?
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .ok()?;
        let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
        endpoint.RegisterControlChangeNotify(callback).ok()?;
        Some(endpoint)
    }
}

fn stop_endpoint(endpoint: Option<IAudioEndpointVolume>, callback: &IAudioEndpointVolumeCallback) {
    if let Some(endpoint) = endpoint {
        let _ = unsafe { endpoint.UnregisterControlChangeNotify(callback) };
    }
}

struct MediaEvents {
    session: Session,
    playback: Option<i64>,
    properties: Option<i64>,
    timeline: Option<i64>,
}

impl MediaEvents {
    fn new(manager: &Manager, app: &tauri::AppHandle) -> Option<Self> {
        let session = manager.GetCurrentSession().ok()?;
        let playback_app = app.clone();
        let playback = session
            .PlaybackInfoChanged(&TypedEventHandler::<Session, _>::new(move |sender, _| {
                if let Some(session) = sender.as_ref()
                    && let Ok(source) = session.SourceAppUserModelId()
                    && let Ok(info) = session.GetPlaybackInfo()
                    && let Ok(status) = info.PlaybackStatus()
                {
                    let _ = playback_app.emit(
                        "pivo:media-playback",
                        (source.to_string(), status == PlaybackStatus::Playing),
                    );
                } else {
                    let _ = playback_app.emit("pivo:media-changed", ());
                }
                Ok(())
            }))
            .ok();
        let properties_app = app.clone();
        let properties = session
            .MediaPropertiesChanged(&TypedEventHandler::new(move |_, _| {
                let _ = properties_app.emit("pivo:media-properties", ());
                Ok(())
            }))
            .ok();
        let timeline_app = app.clone();
        let timeline = session
            .TimelinePropertiesChanged(&TypedEventHandler::new(move |_, _| {
                let _ = timeline_app.emit("pivo:media-changed", ());
                Ok(())
            }))
            .ok();
        Some(Self {
            session,
            playback,
            properties,
            timeline,
        })
    }
}

impl Drop for MediaEvents {
    fn drop(&mut self) {
        if let Some(token) = self.playback {
            let _ = self.session.RemovePlaybackInfoChanged(token);
        }
        if let Some(token) = self.timeline {
            let _ = self.session.RemoveTimelinePropertiesChanged(token);
        }
        if let Some(token) = self.properties {
            let _ = self.session.RemoveMediaPropertiesChanged(token);
        }
    }
}
