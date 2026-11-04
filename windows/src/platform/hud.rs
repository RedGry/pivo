use serde::Serialize;
use std::{mem::size_of, ptr::null_mut};
use windows::{
    Networking::Connectivity::{NetworkConnectivityLevel, NetworkInformation},
    Win32::{
        Devices::Display::*,
        Graphics::Gdi::HMONITOR,
        Media::Audio::{
            Endpoints::IAudioEndpointVolume, IMMDeviceEnumerator, MMDeviceEnumerator, eMultimedia,
            eRender,
        },
        System::Com::{
            CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoUninitialize,
        },
    },
};
use windows_sys::Win32::{
    Devices::Bluetooth::*,
    Foundation::{ERROR_NO_MORE_ITEMS, GetLastError},
    Globalization::LCIDToLocaleName,
    System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS},
    UI::{
        Input::KeyboardAndMouse::{GetKeyState, GetKeyboardLayout, VK_CAPITAL},
        WindowsAndMessaging::{
            GetForegroundWindow, GetWindowThreadProcessId, MSG, PM_NOREMOVE, PeekMessageW,
        },
    },
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HudSnapshot {
    volume: Option<u8>,
    muted: Option<bool>,
    brightness: Option<u8>,
    caps_lock: Option<bool>,
    language: Option<String>,
    battery: Option<u8>,
    plugged_in: Option<bool>,
    charging: bool,
    wifi: Option<bool>,
    headset: Option<bool>,
}

struct Apartment;
impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

fn audio() -> windows::core::Result<(u8, bool)> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)?;
        let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
        let level = (endpoint.GetMasterVolumeLevelScalar()? * 100.0).round() as u8;
        Ok((level, endpoint.GetMute()?.as_bool()))
    }
}

fn percent(min: u32, value: u32, max: u32) -> Option<u8> {
    if max <= min || !(min..=max).contains(&value) {
        return None;
    }
    let range = u64::from(max - min);
    Some(((u64::from(value - min) * 100 + range / 2) / range) as u8)
}

fn brightness(monitor: HMONITOR) -> Option<u8> {
    unsafe {
        let mut count = 0;
        GetNumberOfPhysicalMonitorsFromHMONITOR(monitor, &mut count).ok()?;
        if !(1..=16).contains(&count) {
            return None;
        }
        let mut handles = vec![PHYSICAL_MONITOR::default(); count as usize];
        GetPhysicalMonitorsFromHMONITOR(monitor, &mut handles).ok()?;
        let (mut min, mut value, mut max) = (0, 0, 0);
        let success =
            GetMonitorBrightness(handles[0].hPhysicalMonitor, &mut min, &mut value, &mut max) != 0;
        let _ = DestroyPhysicalMonitors(&handles);
        if success {
            percent(min, value, max)
        } else {
            None
        }
    }
}

fn keyboard() -> (Option<bool>, Option<String>) {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.is_null() {
            return (None, None);
        }
        let thread = GetWindowThreadProcessId(foreground, null_mut());
        if thread == 0 {
            return (None, None);
        }
        // Refresh the calling thread's keyboard state without removing queued input.
        PeekMessageW(&mut MSG::default(), null_mut(), 0, 0, PM_NOREMOVE);
        let caps_lock = Some(GetKeyState(i32::from(VK_CAPITAL)) & 1 != 0);
        let layout = GetKeyboardLayout(thread) as usize;
        let mut name = [0u16; 85];
        let length = LCIDToLocaleName((layout & 0xffff) as u32, name.as_mut_ptr(), 85, 0);
        (
            caps_lock,
            (layout != 0 && length > 1)
                .then(|| String::from_utf16_lossy(&name[..length as usize - 1])),
        )
    }
}

#[tauri::command]
pub fn pivo_keyboard_status() -> (Option<bool>, Option<String>) {
    keyboard()
}

pub fn power() -> (Option<u8>, Option<bool>, bool) {
    let mut status = SYSTEM_POWER_STATUS::default();
    if unsafe { GetSystemPowerStatus(&mut status) } == 0 || status.BatteryFlag & 128 != 0 {
        return (None, None, false);
    }
    (
        (status.BatteryLifePercent <= 100).then_some(status.BatteryLifePercent),
        match status.ACLineStatus {
            0 => Some(false),
            1 => Some(true),
            _ => None,
        },
        status.BatteryFlag & 8 != 0,
    )
}

fn wifi() -> Option<bool> {
    let profiles = NetworkInformation::GetConnectionProfiles().ok()?;
    for index in 0..profiles.Size().ok()? {
        let profile = profiles.GetAt(index).ok()?;
        if profile.IsWlanConnectionProfile().ok()?
            && profile.GetNetworkConnectivityLevel().ok()? != NetworkConnectivityLevel::None
        {
            return Some(true);
        }
    }
    Some(false)
}

fn is_headset(class: u32) -> bool {
    // Audio/video major class and wearable headset, hands-free or headphones minor class.
    class & 0x1f00 == 0x0400 && matches!(class & 0xfc, 0x04 | 0x08 | 0x18)
}

fn headset() -> Option<bool> {
    let search = BLUETOOTH_DEVICE_SEARCH_PARAMS {
        dwSize: size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32,
        fReturnConnected: 1,
        ..Default::default()
    };
    let mut device = BLUETOOTH_DEVICE_INFO {
        dwSize: size_of::<BLUETOOTH_DEVICE_INFO>() as u32,
        ..Default::default()
    };
    unsafe {
        let handle = BluetoothFindFirstDevice(&search, &mut device);
        if handle.is_null() {
            return (GetLastError() == ERROR_NO_MORE_ITEMS).then_some(false);
        }
        let found = loop {
            if device.fConnected != 0 && is_headset(device.ulClassofDevice) {
                break Some(true);
            }
            if BluetoothFindNextDevice(handle, &mut device) == 0 {
                break (GetLastError() == ERROR_NO_MORE_ITEMS).then_some(false);
            }
        };
        BluetoothFindDeviceClose(handle);
        found
    }
}

#[tauri::command]
pub async fn pivo_hud_snapshot(
    app: tauri::AppHandle,
    read_brightness: bool,
) -> Result<HudSnapshot, String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = sender.send(keyboard());
    })
    .map_err(|error| error.to_string())?;
    let display = super::preferences::get(&app).display;
    tauri::async_runtime::spawn_blocking(move || {
        let (caps_lock, language) = receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .map_err(|error| error.to_string())?;
        let apartment = if unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok() {
            Some(Apartment)
        } else {
            None
        };
        let audio = apartment.as_ref().and_then(|_| audio().ok());
        let wifi = apartment.as_ref().and_then(|_| wifi());
        let (battery, plugged_in, charging) = power();
        let brightness = read_brightness
            .then(|| super::displays::chosen(&display))
            .flatten()
            .and_then(|monitor| brightness(HMONITOR(monitor.handle)));
        Ok(HudSnapshot {
            volume: audio.map(|(level, _)| level),
            muted: audio.map(|(_, muted)| muted),
            brightness,
            caps_lock,
            language,
            battery,
            plugged_in,
            charging,
            wifi,
            headset: headset(),
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brightness_normalizes_the_monitor_range() {
        assert_eq!(percent(20, 60, 100), Some(50));
        assert_eq!(percent(20, 15, 100), None);
        assert_eq!(percent(20, 20, 20), None);
        assert_eq!(percent(0, u32::MAX, u32::MAX), Some(100));
    }

    #[test]
    fn only_classic_headset_classes_are_accepted() {
        assert!(is_headset(0x240404));
        assert!(is_headset(0x0418));
        assert!(!is_headset(0x0414));
        assert!(!is_headset(0x0518));
    }
}
