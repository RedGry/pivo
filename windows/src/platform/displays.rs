pub use crate::app::displays::Display;
use std::{mem::size_of, ptr::null_mut};
use tauri::Emitter;
use windows_sys::Win32::{
    Foundation::{LPARAM, RECT},
    Graphics::Gdi::*,
    UI::{HiDpi::*, WindowsAndMessaging::MONITORINFOF_PRIMARY},
};

pub struct Monitor {
    pub handle: HMONITOR,
    pub bounds: RECT,
    pub dpi: u32,
    info: Display,
}

fn enumerate() -> Result<Vec<Monitor>, String> {
    unsafe extern "system" fn visit(handle: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> i32 {
        unsafe {
            let monitors = &mut *(data as *mut Vec<Monitor>);
            let mut info = MONITORINFOEXW::default();
            info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
            if GetMonitorInfoW(handle, &mut info.monitorInfo) == 0 {
                return 1;
            }
            let end = info
                .szDevice
                .iter()
                .position(|unit| *unit == 0)
                .unwrap_or(info.szDevice.len());
            let id = String::from_utf16_lossy(&info.szDevice[..end]);
            let number = id
                .rsplit("DISPLAY")
                .next()
                .and_then(|number| number.parse().ok())
                .unwrap_or(monitors.len() as u32 + 1);
            let bounds = info.monitorInfo.rcMonitor;
            let (mut x, mut y) = (0, 0);
            let dpi = if GetDpiForMonitor(handle, MDT_EFFECTIVE_DPI, &mut x, &mut y) >= 0 && x > 0 {
                x
            } else {
                GetDpiForSystem()
            };
            monitors.push(Monitor {
                handle,
                bounds,
                dpi,
                info: Display {
                    id,
                    number,
                    width: (bounds.right - bounds.left).max(0) as u32,
                    height: (bounds.bottom - bounds.top).max(0) as u32,
                    primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
                },
            });
            1
        }
    }
    let mut monitors: Vec<Monitor> = Vec::new();
    if unsafe {
        EnumDisplayMonitors(
            null_mut(),
            std::ptr::null(),
            Some(visit),
            &mut monitors as *mut _ as LPARAM,
        )
    } == 0
    {
        return Err("Cannot enumerate displays".into());
    }
    monitors.sort_by_key(|monitor| monitor.info.number);
    Ok(monitors)
}

pub fn list() -> Result<Vec<Display>, String> {
    Ok(enumerate()?
        .into_iter()
        .map(|monitor| monitor.info)
        .collect())
}

pub fn chosen(requested: &str) -> Option<Monitor> {
    let mut monitors = enumerate().ok()?;
    let displays: Vec<_> = monitors
        .iter()
        .map(|monitor| monitor.info.clone())
        .collect();
    crate::app::displays::selected_index(requested, &displays)
        .map(|index| monitors.swap_remove(index))
}

pub fn publish(app: &tauri::AppHandle) {
    if let Ok(displays) = list() {
        let _ = app.emit("pivo:displays", displays);
    }
}
