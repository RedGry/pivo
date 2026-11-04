use std::{
    mem::{ManuallyDrop, size_of},
    sync::mpsc,
    time::{Duration, Instant},
};
use windows::Win32::{
    Media::Audio::*,
    System::{
        Com::{StructuredStorage::*, *},
        Variant::VT_BLOB,
    },
};
use windows_core::{HRESULT, Interface, Ref, implement};

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct Completion(mpsc::Sender<Result<IAudioClient, i32>>);

impl IActivateAudioInterfaceCompletionHandler_Impl for Completion_Impl {
    fn ActivateCompleted(
        &self,
        operation: Ref<'_, IActivateAudioInterfaceAsyncOperation>,
    ) -> windows_core::Result<()> {
        let result = (|| {
            let mut status = HRESULT(0);
            let mut interface = None;
            unsafe {
                operation
                    .ok()?
                    .GetActivateResult(&mut status, &mut interface)?
            };
            status.ok()?;
            interface
                .ok_or(windows_core::Error::from_hresult(HRESULT(
                    0x80004003u32 as i32,
                )))?
                .cast()
        })();
        let _ = self
            .0
            .send(result.map_err(|error: windows_core::Error| error.code().0));
        Ok(())
    }
}

const SAMPLE_RATE: u32 = 16_000;

struct Apartment;

impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

pub(super) fn capture_player(
    pid: u32,
    duration: Duration,
    still_current: impl Fn() -> bool,
) -> windows_core::Result<Vec<u8>> {
    let duration = duration.min(Duration::from_secs(30));
    let byte_limit = (duration.as_millis() as usize * SAMPLE_RATE as usize / 1000) * 2;
    if pid == 0 || byte_limit == 0 || !still_current() {
        return Ok(Vec::new());
    }

    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()? };
    let _apartment = Apartment;
    let mut activation = AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: pid,
                ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
            },
        },
    };
    // The blob borrows stack storage, so PropVariantClear must not free it.
    let parameters = ManuallyDrop::new(PROPVARIANT {
        Anonymous: PROPVARIANT_0 {
            Anonymous: ManuallyDrop::new(PROPVARIANT_0_0 {
                vt: VT_BLOB,
                Anonymous: PROPVARIANT_0_0_0 {
                    blob: BLOB {
                        cbSize: size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                        pBlobData: (&mut activation as *mut AUDIOCLIENT_ACTIVATION_PARAMS).cast(),
                    },
                },
                ..Default::default()
            }),
        },
    });
    let (send, receive) = mpsc::channel();
    let completion: IActivateAudioInterfaceCompletionHandler = Completion(send).into();
    let _operation = unsafe {
        ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some(&*parameters),
            &completion,
        )?
    };
    let client = receive
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| windows_core::Error::from_hresult(HRESULT(0x800705b4u32 as i32)))?
        .map_err(|code| windows_core::Error::from_hresult(HRESULT(code)))?;
    let format = WAVEFORMATEX {
        wFormatTag: 1,
        nChannels: 1,
        nSamplesPerSec: SAMPLE_RATE,
        nAvgBytesPerSec: SAMPLE_RATE * 2,
        nBlockAlign: 2,
        wBitsPerSample: 16,
        cbSize: 0,
    };
    unsafe {
        client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
            0,
            0,
            &format,
            None,
        )?;
        let capture: IAudioCaptureClient = client.GetService()?;
        client.Start()?;
        let end = Instant::now() + duration;
        let mut pcm = Vec::with_capacity(byte_limit);
        while Instant::now() < end && pcm.len() < byte_limit {
            if !still_current() {
                client.Stop()?;
                return Ok(Vec::new());
            }
            while pcm.len() < byte_limit && capture.GetNextPacketSize()? != 0 {
                let mut bytes = std::ptr::null_mut();
                let mut frames = 0;
                let mut flags = 0;
                capture.GetBuffer(&mut bytes, &mut frames, &mut flags, None, None)?;
                let count = (frames as usize * 2).min(byte_limit - pcm.len());
                if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 || bytes.is_null() {
                    pcm.resize(pcm.len() + count, 0);
                } else {
                    pcm.extend_from_slice(std::slice::from_raw_parts(bytes, count));
                }
                capture.ReleaseBuffer(frames)?;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        client.Stop()?;
        Ok(pcm)
    }
}

/// Resolve the media source only when it identifies one running process.
pub(super) fn player_process(source: &str) -> windows_core::Result<Option<u32>> {
    use windows::Win32::{
        Foundation::CloseHandle,
        System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW,
            TH32CS_SNAPPROCESS,
        },
    };

    if source.trim().is_empty() {
        return Ok(None);
    }
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)? };
    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut next = unsafe { Process32FirstW(snapshot, &mut entry) };
    let mut matched = Vec::new();
    while next.is_ok() {
        let pid = entry.th32ProcessID;
        if process_matches(pid, source) {
            matched.push((pid, entry.th32ParentProcessID));
        }
        next = unsafe { Process32NextW(snapshot, &mut entry) };
    }
    let _ = unsafe { CloseHandle(snapshot) };
    let mut roots = matched
        .iter()
        .filter(|(_, parent)| !matched.iter().any(|(pid, _)| pid == parent));
    let root = roots.next().map(|(pid, _)| *pid);
    Ok(root.filter(|_| roots.next().is_none()))
}
fn process_matches(pid: u32, source: &str) -> bool {
    use windows::Win32::{
        Foundation::CloseHandle,
        Storage::Packaging::Appx::GetApplicationUserModelId,
        System::Threading::{
            OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
            QueryFullProcessImageNameW,
        },
    };
    use windows_core::PWSTR;

    let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
    else {
        return false;
    };
    let mut buffer = [0; 1024];
    let mut len = buffer.len() as u32;
    let status =
        unsafe { GetApplicationUserModelId(process, &mut len, Some(PWSTR(buffer.as_mut_ptr()))) };
    let app_id =
        (status.0 == 0 && len > 0).then(|| String::from_utf16_lossy(&buffer[..len as usize - 1]));
    len = buffer.len() as u32;
    let image = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut len,
        )
    }
    .ok()
    .map(|()| String::from_utf16_lossy(&buffer[..len as usize]));
    let _ = unsafe { CloseHandle(process) };
    app_id.is_some_and(|id| id.eq_ignore_ascii_case(source))
        || image.is_some_and(|path| {
            path.eq_ignore_ascii_case(source)
                || path.rsplit('\\').next().is_some_and(|name| {
                    name.eq_ignore_ascii_case(source)
                        || source == "ru.yandex.desktop.music" && name == "Яндекс Музыка.exe"
                })
        })
}
