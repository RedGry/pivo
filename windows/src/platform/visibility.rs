use std::{
    io,
    mem::size_of,
    ptr::null_mut,
    sync::atomic::{AtomicIsize, AtomicUsize, Ordering},
};
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, RECT},
    Graphics::{
        Dwm::*,
        Gdi::{MONITOR_DEFAULTTONEAREST, MonitorFromWindow},
    },
    UI::{Accessibility::*, WindowsAndMessaging::*},
};

pub const CHANGED: u32 = WM_APP + 1;
static TARGET: AtomicIsize = AtomicIsize::new(0);
static PENDING: AtomicUsize = AtomicUsize::new(0);
const POSTED: usize = 1;
const SETTLE: usize = 2;

// A burst of OS/Settings notifications posts one adapter message, then one settling timer.
pub fn notify() {
    let target = TARGET.load(Ordering::Relaxed) as HWND;
    if !target.is_null()
        && PENDING.fetch_or(POSTED | SETTLE, Ordering::AcqRel) & POSTED == 0
        && unsafe { PostMessageW(target, CHANGED, 0, 0) } == 0
    {
        PENDING.fetch_and(!POSTED, Ordering::AcqRel);
    }
}
pub fn take_change() -> bool {
    PENDING.swap(0, Ordering::AcqRel) & SETTLE != 0
}

const EVENTS: [u32; 11] = [
    EVENT_SYSTEM_FOREGROUND,
    EVENT_OBJECT_LOCATIONCHANGE,
    EVENT_OBJECT_STATECHANGE,
    EVENT_OBJECT_SHOW,
    EVENT_OBJECT_HIDE,
    EVENT_OBJECT_DESTROY,
    EVENT_SYSTEM_MINIMIZESTART,
    EVENT_SYSTEM_MINIMIZEEND,
    EVENT_OBJECT_CLOAKED,
    EVENT_OBJECT_UNCLOAKED,
    EVENT_OBJECT_REORDER,
];
pub struct VisibilityHooks([HWINEVENTHOOK; EVENTS.len()]);
impl VisibilityHooks {
    pub fn new(hwnd: HWND) -> io::Result<Self> {
        TARGET.store(hwnd as isize, Ordering::Relaxed);
        PENDING.store(0, Ordering::Relaxed);
        let mut hooks = Self([null_mut(); EVENTS.len()]);
        for (slot, event) in hooks.0.iter_mut().zip(EVENTS) {
            *slot = unsafe {
                SetWinEventHook(
                    event,
                    event,
                    null_mut(),
                    Some(changed),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
                )
            };
            if slot.is_null() {
                return Err(io::Error::last_os_error());
            }
        }
        Ok(hooks)
    }
}
impl Drop for VisibilityHooks {
    fn drop(&mut self) {
        TARGET.store(0, Ordering::Relaxed);
        PENDING.store(0, Ordering::Relaxed);
        for hook in self.0 {
            if !hook.is_null() {
                unsafe {
                    UnhookWinEvent(hook);
                }
            }
        }
    }
}
unsafe extern "system" fn changed(
    _: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    object: i32,
    child: i32,
    _: u32,
    _: u32,
) {
    unsafe {
        if event == EVENT_SYSTEM_FOREGROUND
            || (object == OBJID_WINDOW
                && child == 0
                && (event == EVENT_OBJECT_DESTROY || GetAncestor(hwnd, GA_ROOT) == hwnd))
        {
            notify();
        }
    }
}

pub unsafe fn compact_occluded(panel: HWND, monitor: &super::displays::Monitor) -> bool {
    struct Search {
        panel: HWND,
        footprint: RECT,
        found: bool,
    }
    unsafe extern "system" fn visit(window: HWND, data: LPARAM) -> i32 {
        unsafe {
            let search = &mut *(data as *mut Search);
            if window == search.panel
                || window == GetDesktopWindow()
                || window == GetShellWindow()
                || IsWindowVisible(window) == 0
                || IsIconic(window) != 0
            {
                return 1;
            }
            let mut name = [0u16; 128];
            let length = GetClassNameW(window, name.as_mut_ptr(), name.len() as i32);
            let class = String::from_utf16_lossy(&name[..length as usize]);
            if class == "WorkerW"
                || class == "Progman"
                || (class == "PivO.Handle" && GetWindow(window, GW_OWNER) == search.panel)
            {
                return 1;
            }
            let style = GetWindowLongPtrW(window, GWL_EXSTYLE) as u32;
            let taskbar = class == "Shell_TrayWnd" || class == "Shell_SecondaryTrayWnd";
            if !taskbar
                && (style & WS_EX_TRANSPARENT != 0
                    || (style & WS_EX_NOACTIVATE != 0 && style & WS_EX_TOOLWINDOW != 0))
            {
                return 1;
            }
            if style & WS_EX_LAYERED != 0 {
                let (mut color, mut alpha, mut flags) = (0, 255, 0);
                if GetLayeredWindowAttributes(window, &mut color, &mut alpha, &mut flags) != 0
                    && flags & LWA_ALPHA != 0
                    && alpha <= 1
                {
                    return 1;
                }
            }
            let mut cloaked = 0u32;
            if DwmGetWindowAttribute(
                window,
                DWMWA_CLOAKED as u32,
                (&mut cloaked as *mut u32).cast(),
                size_of::<u32>() as u32,
            ) >= 0
                && cloaked != 0
            {
                return 1;
            }
            let mut bounds = RECT::default();
            if DwmGetWindowAttribute(
                window,
                DWMWA_EXTENDED_FRAME_BOUNDS as u32,
                (&mut bounds as *mut RECT).cast(),
                size_of::<RECT>() as u32,
            ) < 0
                && GetWindowRect(window, &mut bounds) == 0
            {
                return 1;
            }
            if bounds.right <= bounds.left || bounds.bottom <= bounds.top {
                return 1;
            }
            let area = search.footprint;
            if bounds.left < area.right
                && bounds.right > area.left
                && bounds.top < area.bottom
                && bounds.bottom > area.top
            {
                search.found = true;
                return 0;
            }
            1
        }
    }
    unsafe {
        let dpi = monitor.dpi;
        let width = crate::app::scale(crate::app::geometry::COMPACT_WIDTH, dpi);
        let left = monitor.bounds.left + (monitor.bounds.right - monitor.bounds.left - width) / 2;
        let mut search = Search {
            panel,
            footprint: RECT {
                left,
                top: monitor.bounds.top,
                right: left + width,
                bottom: monitor.bounds.top
                    + crate::app::scale(crate::app::geometry::COMPACT_HEIGHT, dpi),
            },
            found: false,
        };
        let success = EnumWindows(Some(visit), &mut search as *mut _ as LPARAM);
        search.found || success == 0
    }
}

pub unsafe fn fullscreen_on_monitor(monitor: &super::displays::Monitor) -> bool {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.is_null()
            || foreground == GetDesktopWindow()
            || foreground == GetShellWindow()
        {
            return false;
        }
        // A decorated maximized window can cover the monitor when the taskbar auto-hides.
        let style = GetWindowLongW(foreground, GWL_STYLE) as u32;
        if IsZoomed(foreground) != 0 && style & WS_CAPTION == WS_CAPTION {
            return false;
        }
        if MonitorFromWindow(foreground, MONITOR_DEFAULTTONEAREST) != monitor.handle {
            return false;
        }
        let mut bounds = RECT::default();
        if GetWindowRect(foreground, &mut bounds) == 0 {
            return false;
        }
        bounds.left <= monitor.bounds.left
            && bounds.top <= monitor.bounds.top
            && bounds.right >= monitor.bounds.right
            && bounds.bottom >= monitor.bounds.bottom
    }
}
