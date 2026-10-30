pub mod displays;
mod mouse;
pub mod preferences;
pub mod settings;
pub mod update;
mod visibility;

use crate::app::{
    Companion, PendingPointer, PointerDwell, Presentation, ViewState, geometry, scale,
};
use std::{
    cell::Cell,
    io,
    ptr::{null, null_mut},
    rc::Rc,
    sync::Mutex,
    time::Instant,
};
use tauri::{Emitter, Manager};
use windows_sys::{
    Win32::{
        Foundation::*,
        Graphics::Gdi::*,
        System::LibraryLoader::GetModuleHandleW,
        UI::{
            HiDpi::*,
            Input::KeyboardAndMouse::*,
            Shell::{DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::*,
        },
    },
    w,
};

const SUBCLASS: usize = 0x5049564f;
const HOTKEY: i32 = 1;
const SAMPLE: usize = 1;
const HOVER: usize = 2;
const EXIT: usize = 3;
const VISIBILITY_SETTLE: usize = 4;
const UPDATE_ACTION: u32 = WM_APP + 20;
const CONTROL_ACTION: u32 = WM_APP + 21;

struct Native {
    app: tauri::AppHandle,
    window: HWND,
    close: HWND,
    update_button: HWND,
    later_button: HWND,
    edge: HWND,
    gear: HWND,
    plugin_buttons: [HWND; 4],
    plugin_enabled: Cell<bool>,
    last_gaze: Cell<Option<(i16, i16)>>,
    pending: Cell<PendingPointer>,
    hover: Cell<PointerDwell>,
    exit: Cell<PointerDwell>,
    visibility_settle_until: Cell<f64>,
    anchoring: Cell<bool>,
    last: Cell<Option<ViewState>>,
    closed: Cell<bool>,
    origin: Instant,
    _mouse: mouse::MouseInput,
    _visibility: visibility::VisibilityHooks,
}

impl Native {
    fn now(&self) -> f64 {
        self.origin.elapsed().as_secs_f64()
    }
    fn update(&self, change: impl FnOnce(&mut Companion)) -> ViewState {
        let managed = self.app.state::<Mutex<Companion>>();
        let mut state = managed
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        change(&mut state);
        state.snapshot()
    }
    fn update_ready(&self, revision: u32) -> bool {
        self.app
            .state::<Mutex<Companion>>()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .update_ready(revision)
    }
    fn controls(&self) -> [HWND; 9] {
        [
            self.close,
            self.update_button,
            self.later_button,
            self.edge,
            self.gear,
            self.plugin_buttons[0],
            self.plugin_buttons[1],
            self.plugin_buttons[2],
            self.plugin_buttons[3],
        ]
    }
    fn presentation_ready(&self, presentation: Presentation) -> bool {
        self.app
            .state::<Mutex<Companion>>()
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .presentation_ready(presentation)
    }
    fn snapshot(&self) -> ViewState {
        self.update(|_| {})
    }
    fn cancel_hover(&self) {
        self.hover.set(PointerDwell::default());
        unsafe {
            KillTimer(self.window, HOVER);
        }
    }
    fn cancel_pointer(&self) {
        self.cancel_hover();
        self.cancel_exit();
        self.pending.set(PendingPointer::default());
        unsafe {
            KillTimer(self.window, SAMPLE);
        }
    }
    fn cancel_exit(&self) {
        self.exit.set(PointerDwell::default());
        unsafe {
            KillTimer(self.window, EXIT);
        }
    }
    fn arm_dwell(&self, dwell: &Cell<PointerDwell>, timer: usize, delay: f64) {
        let mut pending = dwell.get();
        if pending.arm(self.now(), delay)
            && unsafe { SetTimer(self.window, timer, (delay * 1000.0) as u32, None) } == 0
        {
            pending = PointerDwell::default();
        }
        dwell.set(pending);
    }
    fn publish(&self, force: bool) -> ViewState {
        let state = self.snapshot();
        if self.closed.get() {
            return state;
        }
        let previous = self.last.replace(Some(state));
        if !state.visible || previous.is_some_and(|old| old.transition_id != state.transition_id) {
            self.cancel_pointer();
        }
        unsafe {
            if (IsWindowVisible(self.window) != 0) != state.visible {
                ShowWindow(
                    self.window,
                    if state.visible {
                        SW_SHOWNOACTIVATE
                    } else {
                        SW_HIDE
                    },
                );
            }
            let interactive = !self.anchoring.get();
            let close_ready = interactive && self.presentation_ready(Presentation::Expanded);
            let edge_ready =
                interactive && !state.expanded && self.presentation_ready(state.presentation);
            if !edge_ready && IsWindowVisible(self.edge) != 0 {
                ShowWindow(self.edge, SW_HIDE);
            }
            self.position_reveal(state.presentation);
            let offer = update::status(&self.app);
            let update_ready =
                interactive && offer.actionable() && self.update_ready(offer.revision);
            let plugin_ready = close_ready
                && self.plugin_enabled.get()
                && !(!offer.deferred
                    && offer.message != "updates.idle"
                    && offer.detail.is_empty()
                    && (offer.busy || offer.version.is_some()));
            for button in self.plugin_buttons {
                ShowWindow(
                    button,
                    if plugin_ready {
                        SW_SHOWNOACTIVATE
                    } else {
                        SW_HIDE
                    },
                );
            }
            for button in [self.update_button, self.later_button] {
                ShowWindow(
                    button,
                    if update_ready {
                        SW_SHOWNOACTIVATE
                    } else {
                        SW_HIDE
                    },
                );
            }
            for (button, ready) in [
                (self.close, close_ready),
                (self.gear, close_ready),
                (self.edge, edge_ready),
            ] {
                if (IsWindowVisible(button) != 0) != ready {
                    ShowWindow(button, if ready { SW_SHOWNOACTIVATE } else { SW_HIDE });
                }
            }
        }
        if force || previous != Some(state) {
            let _ = self.app.emit("pivo:state", state);
        }
        state
    }
    fn refresh(&self) {
        if self.closed.get() {
            return;
        }
        let mut animate = 1i32;
        unsafe {
            SystemParametersInfoW(
                SPI_GETCLIENTAREAANIMATION,
                0,
                (&mut animate as *mut i32).cast(),
                0,
            );
        }
        let preference = preferences::get(&self.app);
        let monitor = displays::chosen(&preference.display);
        let fullscreen = monitor
            .as_ref()
            .is_some_and(|monitor| unsafe { visibility::fullscreen_on_monitor(monitor) });
        let occluded = preference.compact_mode == crate::app::preferences::CompactMode::Auto
            && monitor.as_ref().is_none_or(|monitor| unsafe {
                visibility::compact_occluded(self.window, monitor)
            });
        self.update(|state| {
            state.reduced_motion = animate == 0;
            state.fullscreen = fullscreen;
            state.compact_mode = preference.compact_mode;
            state.occluded = occluded;
        });
    }
    fn anchor(&self) {
        if self.closed.get() || self.anchoring.replace(true) {
            return;
        }
        let requested = preferences::get(&self.app).display;
        if let Some(monitor) = displays::chosen(&requested) {
            unsafe {
                let place = |dpi| {
                    let area = monitor.bounds;
                    let (width, height) =
                        (scale(geometry::WIDTH, dpi), scale(geometry::HEIGHT, dpi));
                    let (x, y) = (area.left + (area.right - area.left - width) / 2, area.top);
                    let mut old = RECT::default();
                    if GetWindowRect(self.window, &mut old) == 0
                        || (
                            old.left,
                            old.top,
                            old.right - old.left,
                            old.bottom - old.top,
                        ) != (x, y, width, height)
                    {
                        for control in self.controls() {
                            ShowWindow(control, SW_HIDE);
                        }
                        SetWindowPos(
                            self.window,
                            HWND_TOPMOST,
                            x,
                            y,
                            width,
                            height,
                            SWP_NOACTIVATE,
                        );
                    }
                };
                place(monitor.dpi);
                // Migration can synchronously change DPI while nested anchor calls are suppressed.
                let actual_dpi = GetDpiForWindow(self.window);
                let dpi = if actual_dpi == 0 {
                    monitor.dpi
                } else {
                    actual_dpi
                };
                place(dpi);
                let mut area = RECT::default();
                if GetWindowRect(self.window, &mut area) != 0 {
                    for (button, rect) in [
                        (self.close, geometry::CLOSE),
                        (self.gear, geometry::SETTINGS),
                        (self.update_button, geometry::UPDATE),
                        (self.later_button, geometry::LATER),
                    ] {
                        SetWindowPos(
                            button,
                            HWND_TOPMOST,
                            area.left + scale(rect.left, dpi),
                            area.top + scale(rect.top, dpi),
                            scale(rect.width, dpi),
                            scale(rect.height, dpi),
                            SWP_NOACTIVATE,
                        );
                    }
                    for (button, rect) in self
                        .plugin_buttons
                        .into_iter()
                        .zip(geometry::PLUGIN_ACTIONS)
                    {
                        SetWindowPos(
                            button,
                            HWND_TOPMOST,
                            area.left + scale(rect.left, dpi),
                            area.top + scale(rect.top, dpi),
                            scale(rect.width, dpi),
                            scale(rect.height, dpi),
                            SWP_NOACTIVATE,
                        );
                    }
                }
                self.position_reveal(self.snapshot().presentation);
            }
        }
        self.anchoring.set(false);
    }
    unsafe fn position_reveal(&self, presentation: Presentation) {
        unsafe {
            if presentation == Presentation::Expanded {
                return;
            }
            let mut panel = RECT::default();
            if GetWindowRect(self.window, &mut panel) == 0 {
                return;
            }
            let dpi = GetDpiForWindow(self.window);
            let rect = geometry::reveal(presentation);
            let requested = (
                panel.left + scale(rect.left, dpi),
                panel.top + scale(rect.top, dpi),
                scale(rect.width, dpi),
                scale(rect.height, dpi),
            );
            let mut old = RECT::default();
            if GetWindowRect(self.edge, &mut old) == 0
                || (
                    old.left,
                    old.top,
                    old.right - old.left,
                    old.bottom - old.top,
                ) != requested
            {
                SetWindowPos(
                    self.edge,
                    HWND_TOPMOST,
                    requested.0,
                    requested.1,
                    requested.2,
                    requested.3,
                    SWP_NOACTIVATE,
                );
            }
        }
    }
    fn point(&self) -> Option<(f64, f64)> {
        let mut cursor = POINT::default();
        let mut bounds = RECT::default();
        unsafe {
            if GetCursorPos(&mut cursor) == 0 || GetWindowRect(self.window, &mut bounds) == 0 {
                return None;
            }
            let factor = 96.0 / f64::from(GetDpiForWindow(self.window));
            Some((
                f64::from(cursor.x - bounds.left) * factor,
                f64::from(cursor.y - bounds.top) * factor,
            ))
        }
    }
    fn inside(&self, presentation: Presentation) -> bool {
        self.point()
            .is_some_and(|(x, y)| geometry::bounds(presentation).contains(x, y))
    }
    fn over_reveal(&self) -> bool {
        let presentation = self.snapshot().presentation;
        presentation != Presentation::Expanded
            && self
                .point()
                .is_some_and(|(x, y)| geometry::reveal(presentation).contains(x, y))
    }
    fn expand(&self, expanded: bool) {
        self.cancel_hover();
        self.cancel_exit();
        self.update(|state| state.expanded = expanded);
        self.publish(false);
    }
    fn over_control(&self) -> bool {
        let mut cursor = POINT::default();
        unsafe {
            GetCursorPos(&mut cursor) != 0
                && self.controls().into_iter().any(|button| {
                    IsWindowVisible(button) != 0
                        && GetWindow(button, GW_OWNER) == self.window
                        && (WindowFromPoint(cursor) == button || GetCapture() == button)
                })
        }
    }
    fn observe(&self, pressed: bool) {
        let state = self.snapshot();
        if !state.visible {
            return;
        }
        if state.presentation == Presentation::Eyes
            && self.presentation_ready(Presentation::Eyes)
            && !state.reduced_motion
            && let Some((x, y)) = self.point()
        {
            let gaze = (
                (((x - f64::from(geometry::WIDTH) / 2.0) / 400.0).clamp(-1.0, 1.0) * 24.0).round()
                    as i16,
                (((y - 20.0) / 300.0).clamp(-1.0, 1.0) * 24.0).round() as i16,
            );
            if self.last_gaze.replace(Some(gaze)) != Some(gaze) {
                let _ = self.app.emit(
                    "pivo:gaze",
                    [f64::from(gaze.0) / 24.0, f64::from(gaze.1) / 24.0],
                );
            }
        }
        if pressed {
            self.cancel_hover();
            if self.over_control() {
                return;
            }
            if crate::app::dismiss_on_pointer_down(
                state.expanded,
                self.inside(Presentation::Expanded),
            ) {
                self.expand(false);
            }
            return;
        }
        if state.expanded {
            self.cancel_hover();
            // Use target bounds throughout reveal, so a growing edge cannot dismiss itself.
            if self.inside(Presentation::Expanded) || self.over_control() || mouse_buttons_held() {
                self.cancel_exit();
            } else {
                self.arm_dwell(&self.exit, EXIT, 0.200);
            }
            return;
        }
        self.cancel_exit();
        if !state.expanded && self.over_reveal() && !mouse_buttons_held() {
            self.arm_dwell(&self.hover, HOVER, 0.350);
        } else {
            self.cancel_hover();
        }
    }
}

pub fn install(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let webview = app
        .get_webview_window("main")
        .ok_or("Configured main window is missing")?;
    webview.set_ignore_cursor_events(true)?;
    webview.set_focusable(false)?;
    webview.set_always_on_top(true)?;
    webview.set_shadow(false)?;
    let window = webview.hwnd()?.0 as HWND;
    unsafe {
        let styles = GetWindowLongPtrW(window, GWL_EXSTYLE) as u32
            | WS_EX_NOACTIVATE
            | WS_EX_TRANSPARENT
            | WS_EX_LAYERED
            | WS_EX_TOOLWINDOW;
        SetWindowLongPtrW(window, GWL_EXSTYLE, styles as isize);
        if SetLayeredWindowAttributes(window, 0, 255, LWA_ALPHA) == 0 {
            return Err(io::Error::last_os_error().into());
        }
        let mouse = mouse::MouseInput::new(window)?;
        let hooks = visibility::VisibilityHooks::new(window)?;
        let mut controls = Vec::new();
        for action in [0, 1, 2, 3, 5, 6, 7, 8, 9] {
            let result = if action == 0 {
                create_close(window)
            } else {
                create_control(window, action)
            };
            match result {
                Ok(control) => controls.push(control),
                Err(error) => {
                    for control in controls {
                        DestroyWindow(control);
                    }
                    return Err(error.into());
                }
            }
        }
        let [
            close,
            update_button,
            later_button,
            edge,
            gear,
            previous,
            next,
            primary,
            secondary,
        ]: [HWND; 9] = controls.try_into().unwrap();
        let native = Rc::new(Native {
            app: app.clone(),
            window,
            close,
            update_button,
            later_button,
            edge,
            gear,
            plugin_buttons: [previous, next, primary, secondary],
            plugin_enabled: Cell::new(false),
            last_gaze: Cell::new(None),
            pending: Cell::new(PendingPointer::default()),
            hover: Cell::new(PointerDwell::default()),
            exit: Cell::new(PointerDwell::default()),
            visibility_settle_until: Cell::new(0.0),
            anchoring: Cell::new(false),
            last: Cell::new(None),
            closed: Cell::new(false),
            origin: Instant::now(),
            _mouse: mouse,
            _visibility: hooks,
        });
        let pointer = Rc::into_raw(native.clone());
        if SetWindowSubclass(window, Some(window_proc), SUBCLASS, pointer as usize) == 0 {
            drop(Rc::from_raw(pointer));
            for control in native.controls() {
                DestroyWindow(control);
            }
            return Err(io::Error::last_os_error().into());
        }
        if RegisterHotKey(
            window,
            HOTKEY,
            MOD_CONTROL | MOD_ALT | MOD_NOREPEAT,
            u32::from(b'P'),
        ) == 0
        {
            RemoveWindowSubclass(window, Some(window_proc), SUBCLASS);
            drop(Rc::from_raw(pointer));
            for control in native.controls() {
                DestroyWindow(control);
            }
            return Err("Ctrl+Alt+P is already registered".into());
        }
        EnumChildWindows(window, Some(decorative_child), 0);
        native.anchor();
        native.refresh();
        native.publish(false);
    }
    Ok(())
}

fn native(app: &tauri::AppHandle) -> Result<Rc<Native>, String> {
    let webview = app
        .get_webview_window("main")
        .ok_or("Main window is unavailable")?;
    let window = webview.hwnd().map_err(|error| error.to_string())?.0 as HWND;
    let mut pointer = 0usize;
    unsafe {
        if GetWindowSubclass(window, Some(window_proc), SUBCLASS, &mut pointer) == 0 || pointer == 0
        {
            return Err("Native adapter is unavailable".into());
        }
        let pointer = pointer as *const Native;
        Rc::increment_strong_count(pointer);
        let native = Rc::from_raw(pointer);
        if native.closed.get() {
            return Err("Native window is closing".into());
        }
        Ok(native)
    }
}

pub fn ready(app: &tauri::AppHandle) -> Result<ViewState, String> {
    let native = native(app)?;
    unsafe {
        EnumChildWindows(native.window, Some(decorative_child), 0);
    }
    native.update(Companion::begin_document);
    native.cancel_pointer();
    native.refresh();
    native.anchor();
    Ok(native.publish(true))
}

pub fn update_revealed(
    app: &tauri::AppHandle,
    revision: u32,
    transition_id: u32,
) -> Result<bool, String> {
    let native = native(app)?;
    let offer = update::status(app);
    if offer.actionable() {
        native.update(|state| {
            state.acknowledge_update(revision, offer.revision, transition_id);
        });
    }
    native.publish(false);
    native.observe(false);
    Ok(native.update_ready(revision))
}

pub fn presented(
    app: &tauri::AppHandle,
    transition_id: u32,
    presentation: Presentation,
) -> Result<bool, String> {
    let native = native(app)?;
    native.update(|state| {
        state.acknowledge_presentation(transition_id, presentation);
    });
    native.publish(false);
    native.observe(false);
    Ok(native.presentation_ready(presentation))
}

unsafe extern "system" fn decorative_child(window: HWND, _: LPARAM) -> i32 {
    unsafe {
        let style =
            GetWindowLongPtrW(window, GWL_EXSTYLE) as u32 | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE;
        SetWindowLongPtrW(window, GWL_EXSTYLE, style as isize);
        // The WebView is decorative; no embedded child may capture mouse or keyboard focus.
        EnableWindow(window, 0);
    }
    1
}

unsafe extern "system" fn window_proc(
    window: HWND,
    message: u32,
    wp: WPARAM,
    lp: LPARAM,
    _: usize,
    data: usize,
) -> LRESULT {
    unsafe {
        let pointer = data as *const Native;
        Rc::increment_strong_count(pointer);
        let native = Rc::from_raw(pointer);
        if message == WM_NCDESTROY {
            RemoveWindowSubclass(window, Some(window_proc), SUBCLASS);
            native.closed.set(true);
            // Release the subclass's original Rc; callback guards keep reentrant callers alive.
            drop(Rc::from_raw(pointer));
            for timer in [SAMPLE, HOVER, EXIT, VISIBILITY_SETTLE] {
                KillTimer(window, timer);
            }
            UnregisterHotKey(window, HOTKEY);
            for control in native.controls() {
                DestroyWindow(control);
            }
            return DefSubclassProc(window, message, wp, lp);
        }
        if native.closed.get() {
            return DefSubclassProc(window, message, wp, lp);
        }
        match message {
            WM_MOUSEACTIVATE => MA_NOACTIVATE as LRESULT,
            WM_NCHITTEST => HTTRANSPARENT as LRESULT,
            WM_INPUT => {
                if native.snapshot().visible
                    && let Some(pressed) = mouse::buttons_down(lp)
                {
                    if pressed {
                        native.cancel_hover();
                        if native.over_control() {
                            return DefSubclassProc(window, message, wp, lp);
                        }
                    }
                    let mut pending = native.pending.get();
                    if pending.queue(pressed, native.now())
                        && SetTimer(window, SAMPLE, 10, None) == 0
                    {
                        pending = PendingPointer::default();
                    }
                    native.pending.set(pending);
                }
                DefSubclassProc(window, message, wp, lp)
            }
            WM_TIMER if wp == SAMPLE => {
                KillTimer(window, SAMPLE);
                let mut pending = native.pending.get();
                let packet = pending.take(native.now());
                native.pending.set(pending);
                if let Some(pressed) = packet {
                    native.observe(pressed);
                } else if pending.pending() && SetTimer(window, SAMPLE, 10, None) == 0 {
                    native.pending.set(PendingPointer::default());
                }
                0
            }
            WM_TIMER if wp == HOVER => {
                KillTimer(window, HOVER);
                let Some(remaining) = native.hover.get().remaining_ms(native.now()) else {
                    return 0;
                };
                if remaining > 0 {
                    if SetTimer(window, HOVER, remaining, None) == 0 {
                        native.cancel_hover();
                    }
                    return 0;
                }
                native.cancel_hover();
                if native.snapshot().visible && native.over_reveal() && !mouse_buttons_held() {
                    native.expand(true);
                }
                0
            }
            WM_TIMER if wp == EXIT => {
                KillTimer(window, EXIT);
                let Some(remaining) = native.exit.get().remaining_ms(native.now()) else {
                    return 0;
                };
                if remaining > 0 {
                    if SetTimer(window, EXIT, remaining, None) == 0 {
                        native.cancel_exit();
                    }
                    return 0;
                }
                native.cancel_exit();
                let state = native.snapshot();
                if state.visible
                    && state.expanded
                    && !native.inside(Presentation::Expanded)
                    && !native.over_control()
                    && !mouse_buttons_held()
                {
                    native.expand(false);
                }
                0
            }
            // Private MCP compatibility messages exercise state handling, not native routing.
            WM_LBUTTONDOWN => 0,
            WM_LBUTTONUP => {
                // Never leave a framework mouse capture on the decorative owner.
                if GetCapture() == window {
                    ReleaseCapture();
                }
                native.expand(!native.snapshot().expanded);
                0
            }
            WM_HOTKEY if wp == HOTKEY as usize => {
                native.update(|state| state.user_hidden = !state.user_hidden);
                native.publish(false);
                0
            }
            WM_POWERBROADCAST => {
                native.update(|state| {
                    if wp as u32 == PBT_APMSUSPEND {
                        state.suspended = true;
                    }
                    if matches!(wp as u32, PBT_APMRESUMEAUTOMATIC | PBT_APMRESUMESUSPEND) {
                        state.suspended = false;
                    }
                });
                native.refresh();
                native.publish(true);
                DefSubclassProc(window, message, wp, lp);
                1
            }
            WM_TIMECHANGE => {
                native.publish(true);
                DefSubclassProc(window, message, wp, lp)
            }
            WM_PARENTNOTIFY => {
                EnumChildWindows(window, Some(decorative_child), 0);
                DefSubclassProc(window, message, wp, lp)
            }
            WM_SETTINGCHANGE | WM_DISPLAYCHANGE | WM_DPICHANGED => {
                let result = DefSubclassProc(window, message, wp, lp);
                native.anchor();
                native.refresh();
                native.publish(true);
                if message == WM_DISPLAYCHANGE {
                    displays::publish(&native.app);
                }
                result
            }
            WM_MOVE => {
                let result = DefSubclassProc(window, message, wp, lp);
                if !native.anchoring.get() {
                    native.anchor();
                    native.refresh();
                    native.publish(false);
                }
                result
            }
            visibility::CHANGED => {
                let settle = visibility::take_change() || wp != 0;
                native.refresh();
                native.publish(false);
                if settle {
                    // Window notifications can arrive before GetForegroundWindow settles.
                    native.visibility_settle_until.set(native.now() + 0.050);
                    if SetTimer(window, VISIBILITY_SETTLE, 50, None) == 0 {
                        native.visibility_settle_until.set(0.0);
                    }
                }
                0
            }
            WM_TIMER if wp == VISIBILITY_SETTLE => {
                KillTimer(window, VISIBILITY_SETTLE);
                let deadline = native.visibility_settle_until.get();
                if deadline != 0.0 {
                    let remaining = deadline - native.now();
                    if remaining > 0.0 {
                        // A queued timer from an older foreground event must not consume this one.
                        let delay = (remaining * 1000.0).ceil().max(1.0) as u32;
                        if SetTimer(window, VISIBILITY_SETTLE, delay, None) == 0 {
                            native.visibility_settle_until.set(0.0);
                        }
                    } else {
                        native.visibility_settle_until.set(0.0);
                        native.refresh();
                        native.publish(false);
                    }
                }
                0
            }
            CONTROL_ACTION => {
                let state = native.snapshot();
                if lp as u32 == state.transition_id {
                    match wp {
                        0 if native.presentation_ready(Presentation::Expanded) => {
                            native.app.exit(0)
                        }
                        3 if !state.expanded && native.presentation_ready(state.presentation) => {
                            native.expand(true);
                        }
                        5 if native.presentation_ready(Presentation::Expanded) => {
                            let _ = settings::open(&native.app);
                        }
                        6..=9 if native.presentation_ready(Presentation::Expanded) => {
                            let offer = update::status(&native.app);
                            if native.plugin_enabled.get()
                                && (offer.deferred
                                    || offer.message == "updates.idle"
                                    || !offer.detail.is_empty()
                                    || (!offer.busy && offer.version.is_none()))
                            {
                                let action = ["previous", "next", "primary", "secondary"][wp - 6];
                                let _ = native.app.emit("pivo:plugin-action", action);
                            }
                        }
                        _ => {}
                    }
                }
                0
            }
            UPDATE_ACTION => {
                let offer = update::status(&native.app);
                if offer.actionable()
                    && offer.revision == lp as u32
                    && native.update_ready(offer.revision)
                {
                    if wp == 1 {
                        update::install_update(&native.app, Some(offer.revision));
                    } else if wp == 2 {
                        update::later(&native.app, Some(offer.revision));
                    }
                }
                0
            }
            WM_CLOSE => {
                native.app.exit(0);
                0
            }
            _ => DefSubclassProc(window, message, wp, lp),
        }
    }
}

fn mouse_buttons_held() -> bool {
    [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON, VK_XBUTTON1, VK_XBUTTON2]
        .into_iter()
        .any(|key| unsafe { GetAsyncKeyState(i32::from(key)) } as u16 & 0x8000 != 0)
}

unsafe fn create_close(owner: HWND) -> Result<HWND, io::Error> {
    unsafe {
        let instance = GetModuleHandleW(null());
        let class = WNDCLASSW {
            lpfnWndProc: Some(close_proc),
            hInstance: instance,
            lpszClassName: w!("PivO.Handle"),
            hCursor: LoadCursorW(null_mut(), IDC_HAND),
            ..Default::default()
        };
        if RegisterClassW(&class) == 0 {
            return Err(io::Error::last_os_error());
        }
        let close = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED,
            class.lpszClassName,
            w!("PivO close"),
            WS_POPUP,
            0,
            0,
            24,
            24,
            owner,
            null_mut(),
            instance,
            null(),
        );
        if close.is_null() {
            return Err(io::Error::last_os_error());
        }
        if SetLayeredWindowAttributes(close, 0, 1, LWA_ALPHA) == 0 {
            let error = io::Error::last_os_error();
            DestroyWindow(close);
            return Err(error);
        }
        Ok(close)
    }
}
unsafe extern "system" fn close_proc(
    window: HWND,
    message: u32,
    wp: WPARAM,
    lp: LPARAM,
) -> LRESULT {
    unsafe {
        match message {
            WM_MOUSEACTIVATE => MA_NOACTIVATE as LRESULT,
            WM_LBUTTONDOWN => {
                let mut cursor = POINT::default();
                if GetCursorPos(&mut cursor) != 0
                    && WindowFromPoint(cursor) == window
                    && let Some(token) = control_token(window)
                    && SetPropW(window, w!("PivO.Press"), (token as usize + 1) as HANDLE) != 0
                {
                    SetCapture(window);
                    if GetCapture() != window {
                        RemovePropW(window, w!("PivO.Press"));
                    }
                }
                0
            }
            WM_LBUTTONUP => {
                let action = GetWindowLongPtrW(window, GWLP_USERDATA) as usize;
                let pressed = RemovePropW(window, w!("PivO.Press")) as usize;
                if GetCapture() == window {
                    ReleaseCapture();
                }
                let mut cursor = POINT::default();
                if let Some(token) = control_token(window)
                    && pressed == token as usize + 1
                    && GetCursorPos(&mut cursor) != 0
                    && WindowFromPoint(cursor) == window
                {
                    PostMessageW(
                        GetWindow(window, GW_OWNER),
                        if action == 1 || action == 2 {
                            UPDATE_ACTION
                        } else {
                            CONTROL_ACTION
                        },
                        action,
                        token as LPARAM,
                    );
                }
                0
            }
            WM_CAPTURECHANGED | WM_CANCELMODE => {
                RemovePropW(window, w!("PivO.Press"));
                if GetCapture() == window {
                    ReleaseCapture();
                }
                0
            }
            WM_SHOWWINDOW if wp == 0 => {
                RemovePropW(window, w!("PivO.Press"));
                if GetCapture() == window {
                    ReleaseCapture();
                }
                DefWindowProcW(window, message, wp, lp)
            }
            WM_ERASEBKGND => 1,
            WM_PAINT => {
                let mut paint = PAINTSTRUCT::default();
                let dc = BeginPaint(window, &mut paint);
                let mut area = RECT::default();
                GetClientRect(window, &mut area);
                FillRect(dc, &area, GetStockObject(BLACK_BRUSH) as HBRUSH);
                EndPaint(window, &paint);
                0
            }
            _ => DefWindowProcW(window, message, wp, lp),
        }
    }
}

pub fn refresh_environment(app: &tauri::AppHandle) -> Result<(), String> {
    let native = native(app)?;
    native.anchor();
    native.refresh();
    native.publish(false);
    Ok(())
}

pub fn refresh_controls(app: &tauri::AppHandle) -> Result<(), String> {
    native(app)?.publish(false);
    Ok(())
}

pub fn plugin_controls(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let native = native(app)?;
    native.plugin_enabled.set(enabled);
    native.publish(false);
    Ok(())
}
unsafe fn create_control(owner: HWND, action: isize) -> Result<HWND, io::Error> {
    unsafe {
        let control = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED,
            w!("PivO.Handle"),
            match action {
                1 => w!("Update PivO"),
                2 => w!("Update later"),
                3 => w!("PivO reveal"),
                6 => w!("PivO previous plugin"),
                7 => w!("PivO next plugin"),
                8 => w!("PivO plugin primary"),
                9 => w!("PivO plugin secondary"),
                _ => w!("PivO settings"),
            },
            WS_POPUP,
            0,
            0,
            1,
            1,
            owner,
            null_mut(),
            GetModuleHandleW(null()),
            null(),
        );
        if control.is_null() {
            return Err(io::Error::last_os_error());
        }
        SetWindowLongPtrW(control, GWLP_USERDATA, action);
        if SetLayeredWindowAttributes(control, 0, 1, LWA_ALPHA) == 0 {
            let error = io::Error::last_os_error();
            DestroyWindow(control);
            return Err(error);
        }
        Ok(control)
    }
}

unsafe fn control_token(window: HWND) -> Option<u32> {
    unsafe {
        if IsWindowVisible(window) == 0 {
            return None;
        }
        let owner = GetWindow(window, GW_OWNER);
        let mut pointer = 0;
        if GetWindowSubclass(owner, Some(window_proc), SUBCLASS, &mut pointer) == 0 || pointer == 0
        {
            return None;
        }
        let pointer = pointer as *const Native;
        Rc::increment_strong_count(pointer);
        let native = Rc::from_raw(pointer);
        if native.closed.get() {
            return None;
        }
        let action = GetWindowLongPtrW(window, GWLP_USERDATA);
        if action == 1 || action == 2 {
            let offer = update::status(&native.app);
            (offer.actionable() && native.update_ready(offer.revision)).then_some(offer.revision)
        } else {
            let state = native.snapshot();
            let presentation = if action == 3 {
                state.presentation
            } else {
                Presentation::Expanded
            };
            (action != 3 || !state.expanded).then_some(())?;
            native
                .presentation_ready(presentation)
                .then_some(state.transition_id)
        }
    }
}
