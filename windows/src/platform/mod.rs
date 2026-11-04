pub mod displays;
mod expanded_input;
pub mod hud;
mod lyric_capture;
mod lyric_recognition;
pub mod media;
mod mouse;
pub mod preferences;
pub mod settings;
pub mod shelf;
mod shelf_drop;
mod status_events;
pub mod update;
mod visibility;

use crate::app::{Companion, PendingPointer, PointerDwell, Presentation, ViewState, geometry};
use std::{
    cell::{Cell, RefCell},
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
const VISIBILITY_SETTLE: usize = 4;
const MANUAL_HIDE: usize = 5;
const ISLAND_SCALE: usize = 6;
const MANUAL_HIDE_MS: u32 = 380;
const UPDATE_ACTION: u32 = WM_APP + 20;
const SHELF_DRAG_FINISHED: u32 = WM_APP + 32;
const CONTROL_ACTION: u32 = WM_APP + 21;
const CONTROL_FEEDBACK: u32 = WM_APP + 22;
const WIDGET_CONTROLS: [usize; geometry::PLUGIN_ACTIONS.len()] =
    [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23];

fn widget_control_index(control: usize) -> Option<usize> {
    WIDGET_CONTROLS.iter().position(|&id| id == control)
}

#[cfg(test)]
#[test]
fn task_rows_use_the_two_high_widget_mask_bits() {
    assert_eq!(widget_control_index(22), Some(14));
    assert_eq!(widget_control_index(23), Some(15));
    assert_eq!(widget_control_index(20), None);
    assert_eq!(widget_control_index(21), None);
    assert_eq!(widget_control_index(17), Some(11));
}

struct Native {
    app: tauri::AppHandle,
    window: HWND,
    close: HWND,
    expanded_input: HWND,
    expanded_input_clipped: Cell<bool>,
    mascot_pointer_near: Cell<bool>,
    update_button: HWND,
    later_button: HWND,
    edge: HWND,
    gear: HWND,
    plugin_buttons: [HWND; geometry::PLUGIN_ACTIONS.len()],
    plugin_mask: Cell<u16>,
    plugin_revision: Cell<u32>,
    plugin_token: Cell<u32>,
    page_hover: Cell<bool>,
    control_feedback: Cell<[Option<isize>; 2]>,
    widget_music: Cell<bool>,
    minimal_strip: Cell<bool>,
    shelf_target: HWND,
    shelf_drag_started_outside: Cell<bool>,
    shelf_selected: Cell<bool>,
    shelf_enabled: Cell<bool>,
    shelf_content_visible: Cell<bool>,
    shelf_drop: RefCell<Option<shelf_drop::Registration>>,
    last_gaze: Cell<Option<GazeSample>>,
    pending: Cell<PendingPointer>,
    hover: Cell<PointerDwell>,
    folding_transition: Cell<Option<u32>>,
    wheel: Cell<crate::app::Wheel>,
    visibility_settle_until: Cell<f64>,
    anchoring: Cell<bool>,
    scale_motion: Cell<Option<(f64, f64, f64)>>,
    scale_reveal: Cell<Option<ScaleReveal>>,
    last: Cell<Option<ViewState>>,
    manual_hide_until: Cell<f64>,
    closed: Cell<bool>,
    origin: Instant,
    _mouse: mouse::MouseInput,
    _status_events: status_events::StatusEvents,
    _visibility: visibility::VisibilityHooks,
}

#[derive(Clone, Copy)]
struct ScaleReveal {
    token: u32,
    min_scale: f64,
    max_scale: f64,
}

#[derive(Clone, Copy)]
struct GazeSample {
    direction: (i16, i16),
    point: (f64, f64),
    sent_at: f64,
}

impl GazeSample {
    fn should_send_after(self, previous: Self) -> bool {
        self.direction != previous.direction
            || (self.point != previous.point && self.sent_at - previous.sent_at >= 0.2)
    }
}

#[cfg(test)]
#[test]
fn saturated_gaze_still_reports_pointer_activity() {
    let previous = GazeSample {
        direction: (24, 24),
        point: (900.0, 900.0),
        sent_at: 0.0,
    };
    let stationary = GazeSample {
        sent_at: 1.0,
        ..previous
    };
    let moving = GazeSample {
        point: (910.0, 900.0),
        sent_at: 0.25,
        ..previous
    };
    assert!(!stationary.should_send_after(previous));
    assert!(moving.should_send_after(previous));
    assert!(
        !GazeSample {
            sent_at: 0.1,
            ..moving
        }
        .should_send_after(previous)
    );
}

fn system_reduced_motion() -> bool {
    let mut animate = 1i32;
    unsafe {
        SystemParametersInfoW(
            SPI_GETCLIENTAREAANIMATION,
            0,
            (&mut animate as *mut i32).cast(),
            0,
        );
    }
    animate == 0
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
    fn controls(&self) -> impl Iterator<Item = HWND> {
        [
            self.close,
            self.update_button,
            self.later_button,
            self.edge,
            self.gear,
            self.expanded_input,
            self.shelf_target,
        ]
        .into_iter()
        .chain(self.plugin_buttons)
    }

    fn set_page_hover(&self, hover: bool) {
        if self.page_hover.replace(hover) != hover {
            let _ = self.app.emit("pivo:page-bar-hover", hover);
        }
    }

    fn update_control_feedback(&self, expanded: bool) {
        let mut feedback = [None, None];
        if expanded {
            unsafe {
                let mut cursor = POINT::default();
                let hover = if GetCursorPos(&mut cursor) != 0 {
                    WindowFromPoint(cursor)
                } else {
                    null_mut()
                };
                for (slot, handle) in feedback.iter_mut().zip([hover, GetCapture()]) {
                    if self.controls().any(|button| button == handle)
                        && IsWindowVisible(handle) != 0
                    {
                        *slot = Some(GetWindowLongPtrW(handle, GWLP_USERDATA));
                    }
                }
            }
        }
        if self.control_feedback.replace(feedback) != feedback {
            let _ = self.app.emit("pivo:control-feedback", feedback);
        }
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
        self.pending.set(PendingPointer::default());
        self.wheel.set(crate::app::Wheel::default());
        unsafe {
            KillTimer(self.window, SAMPLE);
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
        if !state.visible
            || previous.is_some_and(|old| {
                old.transition_id != state.transition_id && !state.keeps_compact_dwell(old)
            })
        {
            self.scale_reveal.set(None);
        }
        if !state.visible
            || previous.is_some_and(|old| {
                old.transition_id != state.transition_id && !state.keeps_compact_dwell(old)
            })
        {
            self.cancel_pointer();
        }
        if previous.is_none_or(|old| old.transition_id != state.transition_id) {
            self.folding_transition.set(
                (state.visible && !state.expanded && previous.is_some_and(|old| old.expanded))
                    .then_some(state.transition_id),
            );
            self.last_gaze.set(None);
            self.plugin_token
                .set(self.plugin_token.get().wrapping_add(1));
        }
        let changed = force || previous != Some(state);
        if !state.manually_hidden || state.reduced_motion {
            if self.manual_hide_until.replace(0.0) != 0.0 {
                unsafe { KillTimer(self.window, MANUAL_HIDE) };
            }
        } else if previous.is_some_and(|old| old.visible)
            && unsafe { SetTimer(self.window, MANUAL_HIDE, MANUAL_HIDE_MS, None) } != 0
        {
            self.manual_hide_until
                .set(self.now() + f64::from(MANUAL_HIDE_MS) / 1000.0);
        }
        let painted = state.visible || self.manual_hide_until.get() != 0.0;
        let already_visible = state.visible && previous.is_some_and(|old| old.visible);
        if changed && already_visible {
            let _ = self.app.emit("pivo:state", state);
        }
        unsafe {
            if (IsWindowVisible(self.window) != 0) != painted {
                ShowWindow(
                    self.window,
                    if painted { SW_SHOWNOACTIVATE } else { SW_HIDE },
                );
            }
            let interactive = !self.anchoring.get();
            let close_ready = interactive && self.presentation_ready(Presentation::Expanded);
            if !close_ready {
                self.update_control_feedback(false);
            }
            let edge_ready = interactive && self.reveal_token(state).is_some();
            if !edge_ready && IsWindowVisible(self.edge) != 0 {
                ShowWindow(self.edge, SW_HIDE);
            }
            self.position_reveal(state.presentation);
            let offer = update::status(&self.app);
            let update_ready =
                interactive && offer.actionable() && self.update_ready(offer.revision);
            let update_covers_widgets = !offer.deferred
                && offer.message != "updates.idle"
                && offer.detail.is_empty()
                && (offer.busy || offer.version.is_some());
            let plugin_ready = close_ready && !update_covers_widgets;
            self.shelf_content_visible.set(
                state.visible
                    && state.expanded
                    && !update_covers_widgets
                    && self.plugin_mask.get() != 0,
            );
            if !plugin_ready || self.plugin_mask.get() & 0x7f0 == 0 {
                self.set_page_hover(false);
            }
            for (index, button) in self.plugin_buttons.into_iter().enumerate() {
                let ready = plugin_ready && self.plugin_mask.get() & (1 << index) != 0;
                if (IsWindowVisible(button) != 0) != ready {
                    ShowWindow(button, if ready { SW_SHOWNOACTIVATE } else { SW_HIDE });
                }
            }
            for button in [self.update_button, self.later_button] {
                if (IsWindowVisible(button) != 0) != update_ready {
                    ShowWindow(
                        button,
                        if update_ready {
                            SW_SHOWNOACTIVATE
                        } else {
                            SW_HIDE
                        },
                    );
                }
            }
            let shield_ready = close_ready && self.expanded_input_clipped.get();
            if (IsWindowVisible(self.expanded_input) != 0) != shield_ready {
                SetWindowPos(
                    self.expanded_input,
                    null_mut(),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOZORDER
                        | SWP_NOACTIVATE
                        | SWP_NOMOVE
                        | SWP_NOSIZE
                        | if shield_ready {
                            SWP_SHOWWINDOW
                        } else {
                            SWP_HIDEWINDOW
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
        self.refresh_shelf_drop();
        if changed && !already_visible {
            let _ = self.app.emit("pivo:state", state);
        }
        state
    }
    fn refresh(&self) {
        if self.closed.get() {
            return;
        }
        let reduced_motion = system_reduced_motion();
        let preference = preferences::get(&self.app);
        let monitor = displays::chosen(&preference.display);
        let fullscreen = monitor
            .as_ref()
            .is_some_and(|monitor| unsafe { visibility::fullscreen_on_monitor(monitor) });
        let occluded = preference.compact_mode == crate::app::preferences::CompactMode::Auto
            && monitor.as_ref().is_none_or(|monitor| unsafe {
                visibility::compact_occluded(self.window, monitor, self.snapshot().ui_scale)
            });
        self.update(|state| {
            state.reduced_motion = reduced_motion;
            state.fullscreen = fullscreen;
            state.compact_mode = preference.compact_mode;
            state.occluded = occluded;
        });
    }
    fn anchor(&self) {
        if self.closed.get() || self.anchoring.replace(true) {
            return;
        }
        let preferences = preferences::get(&self.app);
        if let Some(monitor) = displays::chosen(&preferences.display) {
            let target_scale = match preferences.island_scale {
                0 => {
                    geometry::monitor_scale(monitor.bounds.bottom - monitor.bounds.top, monitor.dpi)
                }
                scale => f64::from(scale) / 100.0,
            };
            let state = self.snapshot();
            let ui_scale = match self.scale_motion.get() {
                Some((from, target, started))
                    if target == target_scale && state.visible && !system_reduced_motion() =>
                {
                    geometry::island_scale_at(from, target, self.now() - started)
                }
                _ => target_scale,
            };
            if ui_scale == target_scale && self.scale_motion.take().is_some() {
                unsafe { KillTimer(self.window, ISLAND_SCALE) };
            }
            // Keep the WebView surface stationary while user scale changes are painted.
            let layout = self.update(|state| state.ui_scale = ui_scale);
            let canvas_scale = layout.canvas_scale;
            let width_units = layout.expanded_width;
            unsafe {
                let place = |dpi| {
                    let area = monitor.bounds;
                    let (width, height) = (
                        geometry::physical(width_units, dpi, canvas_scale),
                        geometry::physical(geometry::HEIGHT, dpi, canvas_scale),
                    );
                    let base_width = geometry::physical(geometry::WIDTH, dpi, canvas_scale);
                    let (x, y) = (
                        area.left + (area.right - area.left - base_width) / 2,
                        area.top,
                    );
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
                            if control != self.shelf_target {
                                ShowWindow(control, SW_HIDE);
                            }
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
                self.expanded_input_clipped.set(false);
                if GetWindowRect(self.window, &mut area) != 0 {
                    area.left += geometry::canvas_offset(dpi, canvas_scale, ui_scale);
                    let content_width = geometry::physical(width_units, dpi, ui_scale);
                    let content_height = geometry::physical(geometry::HEIGHT, dpi, ui_scale);
                    // Position the shield first so the actionable proxies remain above it.
                    let positioned = SetWindowPos(
                        self.expanded_input,
                        HWND_TOPMOST,
                        area.left,
                        area.top,
                        content_width,
                        content_height,
                        SWP_NOACTIVATE,
                    ) != 0;
                    self.expanded_input_clipped.set(
                        positioned
                            && expanded_input::clip(
                                self.expanded_input,
                                width_units,
                                dpi,
                                ui_scale,
                            ),
                    );
                    for (button, rect) in [
                        (self.close, geometry::CLOSE),
                        (self.gear, geometry::SETTINGS),
                        (self.update_button, geometry::UPDATE),
                        (self.later_button, geometry::LATER),
                    ] {
                        SetWindowPos(
                            button,
                            HWND_TOPMOST,
                            area.left + geometry::physical(rect.left, dpi, ui_scale),
                            area.top + geometry::physical(rect.top, dpi, ui_scale),
                            geometry::physical(rect.width, dpi, ui_scale),
                            geometry::physical(rect.height, dpi, ui_scale),
                            SWP_NOACTIVATE,
                        );
                    }
                    for (button, rect) in
                        self.plugin_buttons
                            .into_iter()
                            .zip(geometry::plugin_actions(
                                self.widget_music.get(),
                                ((self.plugin_mask.get() >> 4) & 0x7f).count_ones(),
                            ))
                    {
                        SetWindowPos(
                            button,
                            HWND_TOPMOST,
                            area.left + geometry::physical(rect.left, dpi, ui_scale),
                            area.top + geometry::physical(rect.top, dpi, ui_scale),
                            geometry::physical(rect.width, dpi, ui_scale),
                            geometry::physical(rect.height, dpi, ui_scale),
                            SWP_NOACTIVATE,
                        );
                    }
                    if IsWindowVisible(self.shelf_target) != 0 {
                        self.position_shelf_drop(area, dpi, ui_scale);
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
            let rect = self.physical_reveal_rect(presentation, dpi);
            let requested = (
                panel.left + rect.left,
                panel.top + rect.top,
                rect.width,
                rect.height,
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
            let dpi = GetDpiForWindow(self.window);
            let state = self.snapshot();
            let factor = 96.0 / f64::from(dpi) / state.ui_scale;
            Some((
                f64::from(
                    cursor.x
                        - bounds.left
                        - geometry::canvas_offset(dpi, state.canvas_scale, state.ui_scale),
                ) * factor,
                f64::from(cursor.y - bounds.top) * factor,
            ))
        }
    }
    fn inside(&self, presentation: Presentation) -> bool {
        let width = self.snapshot().expanded_width;
        let mut bounds = geometry::bounds(presentation);
        if presentation == Presentation::Expanded {
            bounds.width = width;
        }
        self.point().is_some_and(|(x, y)| bounds.contains(x, y))
    }
    fn reveal_rect(&self, presentation: Presentation) -> geometry::Rect {
        if presentation == Presentation::Strip && self.minimal_strip.get() {
            geometry::Rect {
                left: geometry::WIDTH / 2 - 28,
                top: 0,
                width: 56,
                height: 8,
            }
        } else {
            geometry::reveal(presentation)
        }
    }
    fn physical_reveal_rect(&self, presentation: Presentation, dpi: u32) -> geometry::Rect {
        let state = self.snapshot();
        let rect = self.reveal_rect(presentation);
        let at = |scale| geometry::centered_target(rect, dpi, state.canvas_scale, scale);
        if let Some(scale) = self.scale_reveal.get() {
            return geometry::shared_target(at(scale.min_scale), at(scale.max_scale));
        }
        self.scale_motion.get().map_or_else(
            || at(state.ui_scale),
            |(from, target, _)| geometry::shared_target(at(from), at(target)),
        )
    }
    fn reveal_token(&self, state: ViewState) -> Option<u32> {
        if !state.visible || state.expanded {
            return None;
        }
        self.scale_reveal
            .get()
            .map(|scale| scale.token)
            .or_else(|| {
                self.presentation_ready(state.presentation)
                    .then_some(state.transition_id)
            })
    }
    fn over_reveal(&self) -> bool {
        let presentation = self.snapshot().presentation;
        let mut cursor = POINT::default();
        let mut panel = RECT::default();
        unsafe {
            presentation != Presentation::Expanded
                && GetCursorPos(&mut cursor) != 0
                && GetWindowRect(self.window, &mut panel) != 0
                && self
                    .physical_reveal_rect(presentation, GetDpiForWindow(self.window))
                    .contains(
                        f64::from(cursor.x - panel.left),
                        f64::from(cursor.y - panel.top),
                    )
        }
    }
    fn expand(&self, expanded: bool) {
        self.cancel_hover();
        self.update(|state| state.expanded = expanded);
        self.publish(false);
    }
    fn over_control(&self) -> bool {
        let mut cursor = POINT::default();
        unsafe {
            GetCursorPos(&mut cursor) != 0
                && self.controls().any(|button| {
                    IsWindowVisible(button) != 0
                        && GetWindow(button, GW_OWNER) == self.window
                        && (WindowFromPoint(cursor) == button || GetCapture() == button)
                })
        }
    }
    fn observe_wheel(&self, delta: i16) {
        let state = self.snapshot();
        let pages = (self.plugin_mask.get() >> 4) & 0x7f;
        let point = self.point();
        let lyrics = state.expanded_width == geometry::LYRICS_WIDTH
            && point.is_some_and(|(x, y)| {
                (455.0..f64::from(state.expanded_width - 32)).contains(&x)
                    && (35.0..130.0).contains(&y)
            });
        if (!lyrics && pages.count_ones() < 2)
            || !self.presentation_ready(Presentation::Expanded)
            || !point.is_some_and(|(x, y)| {
                (32.0..f64::from(state.expanded_width - 32)).contains(&x)
                    && (35.0..130.0).contains(&y)
            })
        {
            self.wheel.set(crate::app::Wheel::default());
            return;
        }
        let mut wheel = self.wheel.get();
        let steps = wheel.add(delta);
        self.wheel.set(wheel);
        if steps != 0 {
            let _ = self.app.emit(
                "pivo:plugin-action",
                serde_json::json!({
                    "action": if lyrics { "lyrics-wheel" } else { "page-wheel" },
                    "revision": self.plugin_revision.get(),
                    "steps": -steps,
                }),
            );
        }
    }
    unsafe fn position_shelf_drop(&self, panel: RECT, dpi: u32, scale: f64) {
        let rect = shelf_drop::BOUNDS;
        unsafe {
            SetWindowPos(
                self.shelf_target,
                HWND_TOPMOST,
                panel.left + geometry::physical(rect.left, dpi, scale),
                panel.top + geometry::physical(rect.top, dpi, scale),
                geometry::physical(rect.width, dpi, scale),
                geometry::physical(rect.height, dpi, scale),
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
    fn refresh_shelf_drop(&self) {
        let left_held = self.shelf_drag_started_outside.get() && button_held(VK_LBUTTON);
        let content_visible = self.shelf_content_visible.get() && self.shelf_enabled.get();
        let ready = content_visible
            && !self.anchoring.get()
            && self.presentation_ready(Presentation::Expanded);
        let show = self.shelf_drop.borrow().as_ref().is_some_and(|target| {
            if !content_visible {
                target.cancel();
            }
            let active = target.active();
            // An accepted drag owns its target through the Lyrics-to-Shelf repaint.
            crate::app::shelf_drop_visible(ready || (content_visible && active), left_held, active)
        });
        unsafe {
            if show == (IsWindowVisible(self.shelf_target) != 0) {
                return;
            }
            if !show {
                ShowWindow(self.shelf_target, SW_HIDE);
                return;
            }
            let mut panel = RECT::default();
            if GetWindowRect(self.window, &mut panel) != 0 {
                let dpi = GetDpiForWindow(self.window);
                let state = self.snapshot();
                panel.left += geometry::canvas_offset(dpi, state.canvas_scale, state.ui_scale);
                self.position_shelf_drop(panel, dpi, state.ui_scale);
            }
        }
    }
    fn emit_mascot_pointer(&self, clicked: bool) {
        let state = self.snapshot();
        if state.visible
            && state.expanded
            && !state.reduced_motion
            && self.presentation_ready(Presentation::Expanded)
            && let Some((x, y)) = self.point()
        {
            // The frontend performs the precise SVG hit test at the selected mascot size.
            let near = (20.0..135.0).contains(&x) && (35.0..115.0).contains(&y);
            let was_near = self.mascot_pointer_near.replace(near);
            if near || was_near {
                let _ = self.app.emit("pivo:mascot-pointer", (x, y, clicked));
            }
        }
    }

    fn observe(&self, pressed: bool) {
        self.emit_mascot_pointer(false);
        self.refresh_shelf_drop();
        let state = self.snapshot();
        if !state.visible {
            return;
        }
        let pages = (self.plugin_mask.get() >> 4) & 0x7f;
        self.update_control_feedback(state.expanded);
        self.set_page_hover(
            pages != 0
                && state.expanded
                && self.presentation_ready(Presentation::Expanded)
                && self.point().is_some_and(|(x, y)| {
                    geometry::plugin_actions(self.widget_music.get(), pages.count_ones())[4..11]
                        .iter()
                        .enumerate()
                        .any(|(index, rect)| pages & (1 << index) != 0 && rect.contains(x, y))
                }),
        );
        if state.presentation == Presentation::Eyes
            && self.presentation_ready(Presentation::Eyes)
            && !state.reduced_motion
            && let Some((x, y)) = self.point()
        {
            let gaze = (
                (((x - f64::from(geometry::WIDTH) / 2.0) / 400.0).clamp(-1.0, 1.0) * 24.0).round()
                    as i16,
                (((y - f64::from(geometry::COMPACT_HEIGHT) / 2.0) / 300.0).clamp(-1.0, 1.0) * 24.0)
                    .round() as i16,
            );
            let sample = GazeSample {
                direction: gaze,
                point: (x, y),
                sent_at: self.now(),
            };
            if self
                .last_gaze
                .get()
                .is_none_or(|previous| sample.should_send_after(previous))
            {
                self.last_gaze.set(Some(sample));
                let _ = self.app.emit(
                    "pivo:gaze",
                    [f64::from(gaze.0) / 24.0, f64::from(gaze.1) / 24.0],
                );
            }
        } else {
            self.last_gaze.set(None);
        }
        if pressed {
            self.cancel_hover();
            if self.over_control()
                || (self.shelf_content_visible.get()
                    && self.shelf_drop.borrow().is_some()
                    && button_held(VK_LBUTTON))
            {
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
            if !self.inside(Presentation::Expanded) && !self.over_control() && !mouse_buttons_held()
            {
                self.expand(false);
            }
            return;
        }
        if !state.expanded
            && self.over_reveal()
            && reveal_buttons_allowed(
                self.shelf_selected.get() && self.shelf_drop.borrow().is_some(),
            )
        {
            if self.folding_transition.get() == Some(state.transition_id)
                && !self.presentation_ready(state.presentation)
            {
                self.expand(true);
            } else {
                self.arm_dwell(&self.hover, HOVER, crate::app::HOVER_DELAY_SECONDS);
            }
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
        for action in [0, 1, 2, 3, 5, 20, 21].into_iter().chain(WIDGET_CONTROLS) {
            let result = if action == 0 {
                create_close(window)
            } else {
                create_control(window, action as isize)
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
            shelf_target,
            expanded_input,
            plugin_buttons @ ..,
        ]: [HWND; 7 + geometry::PLUGIN_ACTIONS.len()] = controls.try_into().unwrap();
        let native = Rc::new(Native {
            app: app.clone(),
            window,
            close,
            expanded_input,
            expanded_input_clipped: Cell::new(false),
            mascot_pointer_near: Cell::new(false),
            update_button,
            later_button,
            edge,
            gear,
            plugin_buttons,
            plugin_mask: Cell::new(0),
            plugin_revision: Cell::new(0),
            plugin_token: Cell::new(0),
            page_hover: Cell::new(false),
            control_feedback: Cell::new([None, None]),
            widget_music: Cell::new(false),
            minimal_strip: Cell::new(false),
            shelf_target,
            shelf_drag_started_outside: Cell::new(false),
            shelf_selected: Cell::new(false),
            shelf_enabled: Cell::new(false),
            shelf_content_visible: Cell::new(false),
            shelf_drop: RefCell::new(None),
            last_gaze: Cell::new(None),
            pending: Cell::new(PendingPointer::default()),
            hover: Cell::new(PointerDwell::default()),
            folding_transition: Cell::new(None),
            wheel: Cell::new(crate::app::Wheel::default()),
            visibility_settle_until: Cell::new(0.0),
            anchoring: Cell::new(false),
            scale_motion: Cell::new(None),
            scale_reveal: Cell::new(None),
            last: Cell::new(None),
            manual_hide_until: Cell::new(0.0),
            closed: Cell::new(false),
            origin: Instant::now(),
            _mouse: mouse,
            _status_events: status_events::StatusEvents::start(app.clone(), window),
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
        match shelf_drop::Registration::new(native.shelf_target, app.clone()) {
            Ok(target) => *native.shelf_drop.borrow_mut() = Some(target),
            Err(error) => eprintln!("Unable to register Shelf file target: {error}"),
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
    native.scale_reveal.set(None);
    native.minimal_strip.set(false);
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
    if native.scale_motion.get().is_none() && native.presentation_ready(presentation) {
        native.scale_reveal.set(None);
    }
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
            for timer in [SAMPLE, HOVER, VISIBILITY_SETTLE, MANUAL_HIDE, ISLAND_SCALE] {
                KillTimer(window, timer);
            }
            UnregisterHotKey(window, HOTKEY);
            let drop_target = native.shelf_drop.borrow_mut().take();
            drop(drop_target);
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
                    && let Some(packet) = mouse::packet(lp)
                {
                    if packet.left_down {
                        native.emit_mascot_pointer(true);
                        native.shelf_drag_started_outside.set(
                            !native.snapshot().expanded
                                || !native
                                    .point()
                                    .is_some_and(|(x, y)| shelf_drop::BOUNDS.contains(x, y)),
                        );
                    }
                    if packet.wheel != 0 {
                        native.observe_wheel(packet.wheel);
                    }
                    if packet.pressed {
                        native.cancel_hover();
                        if native.over_control() {
                            return DefSubclassProc(window, message, wp, lp);
                        }
                    }
                    let mut pending = native.pending.get();
                    if pending.queue(packet.pressed, native.now())
                        && SetTimer(window, SAMPLE, 10, None) == 0
                    {
                        pending = PendingPointer::default();
                    }
                    native.pending.set(pending);
                }
                DefSubclassProc(window, message, wp, lp)
            }
            SHELF_DRAG_FINISHED => {
                native.refresh_shelf_drop();
                0
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
                if native.snapshot().visible
                    && native.over_reveal()
                    && reveal_buttons_allowed(
                        native.shelf_selected.get() && native.shelf_drop.borrow().is_some(),
                    )
                {
                    native.expand(true);
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
            WM_POWERBROADCAST
                if matches!(wp as u32, PBT_APMPOWERSTATUSCHANGE | PBT_POWERSETTINGCHANGE) =>
            {
                let _ = native.app.emit("pivo:power", hud::power());
                if wp as u32 == PBT_POWERSETTINGCHANGE {
                    let _ = native.app.emit("pivo:hud-changed", ());
                }
                1
            }
            WM_POWERBROADCAST => {
                let _ = native.app.emit("pivo:hud-changed", ());
                native.update(|state| {
                    if wp as u32 == PBT_APMSUSPEND {
                        state.suspended = true;
                    }
                    if matches!(wp as u32, PBT_APMRESUMEAUTOMATIC | PBT_APMRESUMESUSPEND) {
                        state.suspended = false;
                    }
                });
                native.anchor();
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
            WM_INPUTLANGCHANGE | WM_DEVICECHANGE => {
                let _ = native.app.emit("pivo:hud-changed", ());
                DefSubclassProc(window, message, wp, lp)
            }
            WM_SETTINGCHANGE if wp == SPI_SETCLIENTAREAANIMATION as usize => {
                native.update(|state| state.reduced_motion = system_reduced_motion());
                if native.scale_motion.get().is_some() {
                    native.anchor();
                }
                native.publish(false);
                DefSubclassProc(window, message, wp, lp)
            }
            WM_SETTINGCHANGE | WM_DISPLAYCHANGE | WM_DPICHANGED => {
                let _ = native.app.emit("pivo:hud-changed", ());
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
            WM_TIMER if wp == ISLAND_SCALE => {
                native.anchor();
                native.publish(false);
                0
            }
            WM_TIMER if wp == MANUAL_HIDE => {
                KillTimer(window, MANUAL_HIDE);
                let remaining = native.manual_hide_until.get() - native.now();
                if remaining <= 0.0
                    || SetTimer(
                        window,
                        MANUAL_HIDE,
                        (remaining * 1000.0).ceil() as u32,
                        None,
                    ) == 0
                {
                    native.manual_hide_until.set(0.0);
                    native.publish(false);
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
            CONTROL_FEEDBACK => {
                native.update_control_feedback(native.snapshot().expanded);
                0
            }
            CONTROL_ACTION => {
                let state = native.snapshot();
                let control = wp & 0xff;
                if let Some(index) = widget_control_index(control) {
                    let offer = update::status(&native.app);
                    if lp as u32 == native.plugin_token.get()
                        && native.presentation_ready(Presentation::Expanded)
                        && native.plugin_mask.get() & (1 << index) != 0
                        && (offer.deferred
                            || offer.message == "updates.idle"
                            || !offer.detail.is_empty()
                            || (!offer.busy && offer.version.is_none()))
                    {
                        let action = match control {
                            17 => "seek".to_owned(),
                            18 => "page-previous".to_owned(),
                            19 => "page-next".to_owned(),
                            22 => "task-0".to_owned(),
                            23 => "task-1".to_owned(),
                            _ => ["previous", "next", "primary", "secondary"]
                                .get(control - 6)
                                .map_or_else(
                                    || format!("page-{}", control - 10),
                                    |name| (*name).to_owned(),
                                ),
                        };
                        let _ = native.app.emit(
                            "pivo:plugin-action",
                            serde_json::json!({
                                "action": action,
                                "revision": native.plugin_revision.get(),
                                "fraction": (control == 17).then(|| (wp >> 8) as f64 / 65535.0),
                            }),
                        );
                    }
                    return 0;
                }
                if control == 3 {
                    if native.reveal_token(state) == Some(lp as u32) {
                        native.expand(true);
                    }
                } else if lp as u32 == state.transition_id {
                    match control {
                        0 if native.presentation_ready(Presentation::Expanded) => {
                            native.app.exit(0)
                        }
                        5 if native.presentation_ready(Presentation::Expanded) => {
                            let _ = settings::open(&native.app);
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

fn reveal_buttons_allowed(shelf: bool) -> bool {
    (shelf || !button_held(VK_LBUTTON))
        && ![VK_RBUTTON, VK_MBUTTON, VK_XBUTTON1, VK_XBUTTON2]
            .into_iter()
            .any(button_held)
}

fn button_held(key: u16) -> bool {
    (unsafe { GetAsyncKeyState(i32::from(key)) }) as u16 & 0x8000 != 0
}

fn mouse_buttons_held() -> bool {
    [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON, VK_XBUTTON1, VK_XBUTTON2]
        .into_iter()
        .any(button_held)
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
                    if GetWindowLongPtrW(window, GWLP_USERDATA) == 21
                        && lyric_point(window, cursor).is_none_or(|point| {
                            SetPropW(window, w!("PivO.LyricPress"), point as HANDLE) == 0
                        })
                    {
                        RemovePropW(window, w!("PivO.Press"));
                        return 0;
                    }
                    SetCapture(window);
                    if GetCapture() != window {
                        RemovePropW(window, w!("PivO.Press"));
                        RemovePropW(window, w!("PivO.LyricPress"));
                    }
                    PostMessageW(GetWindow(window, GW_OWNER), CONTROL_FEEDBACK, 0, 0);
                }
                0
            }
            WM_LBUTTONUP => {
                let action = GetWindowLongPtrW(window, GWLP_USERDATA) as usize;
                let pressed = RemovePropW(window, w!("PivO.Press")) as usize;
                let lyric_press = RemovePropW(window, w!("PivO.LyricPress")) as usize;
                if GetCapture() == window {
                    ReleaseCapture();
                }
                let mut cursor = POINT::default();
                if let Some(token) = control_token(window)
                    && pressed == token as usize + 1
                    && GetCursorPos(&mut cursor) != 0
                    && WindowFromPoint(cursor) == window
                {
                    let mut payload = action;
                    if action == 21 {
                        if let Some(release) = lyric_point(window, cursor) {
                            emit_lyric_click(window, token, lyric_press, release);
                        }
                        return 0;
                    }
                    if action == 17 {
                        let mut area = RECT::default();
                        if GetWindowRect(window, &mut area) == 0 || area.right - area.left < 2 {
                            return 0;
                        }
                        let fraction =
                            f64::from(cursor.x - area.left) / f64::from(area.right - area.left - 1);
                        payload |= ((fraction.clamp(0.0, 1.0) * 65535.0).round() as usize) << 8;
                    }
                    PostMessageW(
                        GetWindow(window, GW_OWNER),
                        if action == 1 || action == 2 {
                            UPDATE_ACTION
                        } else {
                            CONTROL_ACTION
                        },
                        payload,
                        token as LPARAM,
                    );
                }
                0
            }
            WM_CAPTURECHANGED | WM_CANCELMODE => {
                RemovePropW(window, w!("PivO.Press"));
                RemovePropW(window, w!("PivO.LyricPress"));
                if GetCapture() == window {
                    ReleaseCapture();
                }
                PostMessageW(GetWindow(window, GW_OWNER), CONTROL_FEEDBACK, 0, 0);
                0
            }
            WM_SHOWWINDOW if wp == 0 => {
                RemovePropW(window, w!("PivO.Press"));
                RemovePropW(window, w!("PivO.LyricPress"));
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

pub fn compact_target(app: &tauri::AppHandle, minimal: bool) {
    if let Ok(native) = native(app)
        && native.minimal_strip.replace(minimal) != minimal
    {
        unsafe { native.position_reveal(native.snapshot().presentation) };
    }
}

pub fn refresh_environment(app: &tauri::AppHandle) -> Result<(), String> {
    let native = native(app)?;
    native.anchor();
    native.refresh();
    native.publish(false);
    Ok(())
}

pub fn animate_island_scale(app: &tauri::AppHandle) -> Result<(), String> {
    let native = native(app)?;
    let prefs = preferences::get(app);
    let state = native.snapshot();
    if let Some(monitor) = displays::chosen(&prefs.display) {
        let target = match prefs.island_scale {
            0 => geometry::monitor_scale(monitor.bounds.bottom - monitor.bounds.top, monitor.dpi),
            scale => f64::from(scale) / 100.0,
        };
        if state.visible
            && !system_reduced_motion()
            && state.ui_scale != target
            && unsafe { SetTimer(native.window, ISLAND_SCALE, 15, None) } != 0
        {
            if let Some(token) = native.reveal_token(state) {
                let safe = native.scale_reveal.get().unwrap_or(ScaleReveal {
                    token,
                    min_scale: state.ui_scale,
                    max_scale: state.ui_scale,
                });
                native.scale_reveal.set(Some(ScaleReveal {
                    min_scale: safe.min_scale.min(target),
                    max_scale: safe.max_scale.max(target),
                    ..safe
                }));
            }
            native
                .scale_motion
                .set(Some((state.ui_scale, target, native.now())));
        }
    }
    refresh_environment(app)
}

pub fn refresh_controls(app: &tauri::AppHandle) -> Result<(), String> {
    native(app)?.publish(false);
    Ok(())
}

pub fn plugin_controls(
    app: &tauri::AppHandle,
    mask: u16,
    revision: u32,
    music: bool,
    lyrics: bool,
    shelf: bool,
    shelf_enabled: bool,
) -> Result<(), String> {
    let native = native(app)?;
    native.shelf_selected.set(shelf);
    native.shelf_enabled.set(shelf_enabled);
    let pages_changed = (native.plugin_mask.replace(mask) ^ mask) & (0x7f << 4) != 0;
    native.plugin_revision.set(revision);
    let music_changed = native.widget_music.replace(music) != music;
    if music_changed {
        unsafe {
            SetWindowTextW(
                native.plugin_buttons[0],
                if music {
                    w!("PivO previous track")
                } else {
                    w!("PivO previous plugin")
                },
            );
            SetWindowTextW(
                native.plugin_buttons[1],
                if music {
                    w!("PivO next track")
                } else {
                    w!("PivO next plugin")
                },
            );
            SetWindowTextW(
                native.plugin_buttons[3],
                if music {
                    w!("PivO lyrics")
                } else {
                    w!("PivO plugin secondary")
                },
            );
        }
    }
    native
        .plugin_token
        .set(native.plugin_token.get().wrapping_add(1));
    let width_changed = (native.snapshot().expanded_width == geometry::LYRICS_WIDTH) != lyrics;
    if width_changed || music_changed || pages_changed {
        if width_changed {
            native.update(|state| state.lyrics = lyrics);
        }
        native.anchor();
    }
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
                10 => w!("PivO widget page 1"),
                11 => w!("PivO widget page 2"),
                12 => w!("PivO widget page 3"),
                13 => w!("PivO widget page 4"),
                14 => w!("PivO widget page 5"),
                15 => w!("PivO widget page 6"),
                16 => w!("PivO widget page 7"),
                17 => w!("PivO seek"),
                18 => w!("PivO previous widget"),
                19 => w!("PivO next widget"),
                20 => w!("PivO Shelf drop target"),
                21 => w!("PivO expanded input"),
                22 => w!("PivO task row 1"),
                23 => w!("PivO task row 2"),
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

unsafe fn lyric_point(window: HWND, cursor: POINT) -> Option<usize> {
    let mut area = RECT::default();
    if unsafe { GetWindowRect(window, &mut area) } == 0 {
        return None;
    }
    let x = cursor.x - area.left;
    let y = cursor.y - area.top;
    ((0..4096).contains(&x) && (0..4096).contains(&y))
        .then(|| 1 + ((y as usize) << 12) + x as usize)
}

fn lyric_viewport_point(packed: usize, origin: (i32, i32), dpi: u32) -> [f64; 2] {
    let value = packed - 1;
    let scale = 96.0 / f64::from(if dpi == 0 { 96 } else { dpi });
    [
        ((value & 0xfff) as f64 + f64::from(origin.0)) * scale,
        ((value >> 12) as f64 + f64::from(origin.1)) * scale,
    ]
}

#[cfg(test)]
#[test]
fn lyric_clicks_include_the_input_window_offset_at_each_dpi() {
    // Shield origins are physical offsets inside the larger WebView canvas.
    for (dpi, origin, point, expected) in [
        (96, (153, 0), (500, 80), [653.0, 80.0]),
        (120, (102, 0), (650, 100), [601.6, 80.0]),
        (144, (50, 0), (750, 120), [800.0 / 1.5, 80.0]),
        (0, (153, 4), (500, 80), [653.0, 84.0]),
    ] {
        let packed = 1 + (point.1 << 12) + point.0;
        let actual = lyric_viewport_point(packed, origin, dpi);
        assert!(
            (actual[0] - expected[0]).abs() < 0.001,
            "dpi={dpi}: {actual:?}"
        );
        assert!(
            (actual[1] - expected[1]).abs() < 0.001,
            "dpi={dpi}: {actual:?}"
        );
    }
}

unsafe fn emit_lyric_click(window: HWND, token: u32, press: usize, release: usize) {
    let Some(native) = (unsafe { control_owner(window) }) else {
        return;
    };
    if press == 0 || token != native.plugin_token.get() {
        return;
    }
    // DOM bounds are viewport-relative, while the input shield is offset inside it.
    let mut origin = POINT::default();
    if unsafe { ClientToScreen(window, &mut origin) } == 0
        || unsafe { ScreenToClient(native.window, &mut origin) } == 0
    {
        return;
    }
    let dpi = unsafe { GetDpiForWindow(native.window) };
    let point = |packed: usize| lyric_viewport_point(packed, (origin.x, origin.y), dpi);
    let _ = native.app.emit(
        "pivo:plugin-action",
        serde_json::json!({
            "action": "lyric-seek",
            "revision": native.plugin_revision.get(),
            "press": point(press),
            "release": point(release),
        }),
    );
}

unsafe fn control_owner(window: HWND) -> Option<Rc<Native>> {
    unsafe {
        let owner = GetWindow(window, GW_OWNER);
        let mut pointer = 0;
        if GetWindowSubclass(owner, Some(window_proc), SUBCLASS, &mut pointer) == 0 || pointer == 0
        {
            return None;
        }
        let pointer = pointer as *const Native;
        Rc::increment_strong_count(pointer);
        let native = Rc::from_raw(pointer);
        (!native.closed.get()).then_some(native)
    }
}

unsafe fn control_token(window: HWND) -> Option<u32> {
    unsafe {
        if IsWindowVisible(window) == 0 {
            return None;
        }
        let native = control_owner(window)?;
        let action = GetWindowLongPtrW(window, GWLP_USERDATA);
        if action == 20 {
            return None;
        }
        if action == 21 {
            return (native.snapshot().expanded_width == geometry::LYRICS_WIDTH
                && native.plugin_mask.get() & (1 << 11) != 0
                && native.point().is_some_and(|(x, y)| {
                    (455.0..f64::from(geometry::LYRICS_WIDTH - 32)).contains(&x)
                        && (35.0..140.0).contains(&y)
                })
                && native.presentation_ready(Presentation::Expanded))
            .then_some(native.plugin_token.get());
        }
        if action == 1 || action == 2 {
            let offer = update::status(&native.app);
            (offer.actionable() && native.update_ready(offer.revision)).then_some(offer.revision)
        } else if let Some(index) = widget_control_index(action as usize) {
            (native.plugin_mask.get() & (1 << index) != 0
                && native.presentation_ready(Presentation::Expanded))
            .then_some(native.plugin_token.get())
        } else {
            let state = native.snapshot();
            if action == 3 {
                native.reveal_token(state)
            } else {
                native
                    .presentation_ready(Presentation::Expanded)
                    .then_some(state.transition_id)
            }
        }
    }
}
