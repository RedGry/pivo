pub mod displays;
pub mod geometry;
pub mod localization;
mod pointer;
pub mod preferences;

pub use pointer::{DoubleClick, PendingPointer, PointerDwell};
use preferences::CompactMode;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Presentation {
    #[default]
    Strip,
    Eyes,
    Expanded,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewState {
    pub expanded: bool,
    pub presentation: Presentation,
    pub reduced_motion: bool,
    pub visible: bool,
    pub transition_id: u32,
}

#[derive(Default)]
pub struct Companion {
    pub ready: bool,
    pub user_hidden: bool,
    pub fullscreen: bool,
    pub suspended: bool,
    pub expanded: bool,
    pub reduced_motion: bool,
    pub compact_mode: CompactMode,
    pub occluded: bool,
    transition_id: u32,
    previous_presentation: Presentation,
    previous_visible: bool,
    presentation_acknowledged: Option<(u32, Presentation)>,
    update_acknowledged: Option<(u32, u32)>,
}

impl Companion {
    pub fn set_suspended(&mut self, suspended: bool) -> bool {
        let resumed = self.suspended && !suspended;
        self.suspended = suspended;
        resumed
    }

    pub fn snapshot(&mut self) -> ViewState {
        let visible = self.ready && !self.user_hidden && !self.fullscreen && !self.suspended;
        if !visible {
            self.expanded = false;
        }
        let presentation = if self.expanded {
            Presentation::Expanded
        } else {
            self.compact_mode.presentation(self.occluded)
        };
        if presentation != self.previous_presentation || visible != self.previous_visible {
            self.transition_id = self.transition_id.wrapping_add(1);
            self.previous_presentation = presentation;
            self.previous_visible = visible;
            self.presentation_acknowledged = None;
            self.update_acknowledged = None;
        }
        if !visible {
            self.presentation_acknowledged = None;
        }
        ViewState {
            expanded: self.expanded,
            presentation,
            reduced_motion: self.reduced_motion,
            visible,
            transition_id: self.transition_id,
        }
    }

    pub fn begin_document(&mut self) {
        // Every document invalidates queued IPC acknowledgments, even while compact.
        self.transition_id = self.transition_id.wrapping_add(1);
        self.previous_presentation = self.compact_mode.presentation(self.occluded);
        self.update_acknowledged = None;
        self.ready = true;
        self.expanded = false;
        self.presentation_acknowledged = None;
    }

    pub fn acknowledge_presentation(
        &mut self,
        transition_id: u32,
        presentation: Presentation,
    ) -> bool {
        let state = self.snapshot();
        if state.visible
            && state.presentation == presentation
            && state.transition_id == transition_id
        {
            self.presentation_acknowledged = Some((transition_id, presentation));
            true
        } else {
            false
        }
    }

    pub fn presentation_ready(&mut self, presentation: Presentation) -> bool {
        let state = self.snapshot();
        state.visible
            && state.presentation == presentation
            && self.presentation_acknowledged == Some((state.transition_id, presentation))
    }

    pub fn acknowledge_update(
        &mut self,
        revision: u32,
        current_revision: u32,
        transition_id: u32,
    ) -> bool {
        let state = self.snapshot();
        if self.close_ready()
            && revision == current_revision
            && transition_id == state.transition_id
        {
            self.update_acknowledged = Some((revision, transition_id));
            true
        } else {
            false
        }
    }

    pub fn update_ready(&mut self, revision: u32) -> bool {
        let state = self.snapshot();
        self.close_ready() && self.update_acknowledged == Some((revision, state.transition_id))
    }

    pub fn close_ready(&mut self) -> bool {
        self.presentation_ready(Presentation::Expanded)
    }
}

pub fn dismiss_on_pointer_down(expanded: bool, inside: bool) -> bool {
    expanded && !inside
}

pub fn scale(value: i32, dpi: u32) -> i32 {
    ((i64::from(value) * i64::from(dpi) + 48) / 96) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resume_is_reported_only_after_a_suspend_edge() {
        let mut companion = Companion::default();
        assert!(!companion.set_suspended(false));
        assert!(!companion.set_suspended(true));
        assert!(!companion.set_suspended(true));
        assert!(companion.set_suspended(false));
        assert!(!companion.set_suspended(false));
        assert!(!companion.set_suspended(true));
        assert!(companion.set_suspended(false));
    }

    #[test]
    fn expanded_panel_dismisses_only_on_an_outside_press() {
        assert!(!dismiss_on_pointer_down(true, true));
        assert!(dismiss_on_pointer_down(true, false));
        assert!(!dismiss_on_pointer_down(false, false));
        assert!(!dismiss_on_pointer_down(false, true));
    }

    #[test]
    fn strip_eyes_and_expanded_have_distinct_generation_and_paint_identity() {
        let mut companion = Companion {
            ready: true,
            ..Default::default()
        };
        let eyes = companion.snapshot();
        assert_eq!(eyes.presentation, Presentation::Eyes);
        assert!(companion.acknowledge_presentation(eyes.transition_id, Presentation::Eyes));
        companion.occluded = true;
        let strip = companion.snapshot();
        assert_eq!(strip.presentation, Presentation::Strip);
        assert_ne!(strip.transition_id, eyes.transition_id);
        assert!(!companion.acknowledge_presentation(eyes.transition_id, Presentation::Eyes));
        assert!(!companion.acknowledge_presentation(strip.transition_id, Presentation::Eyes));
        assert!(companion.acknowledge_presentation(strip.transition_id, Presentation::Strip));
        companion.expanded = true;
        let expanded = companion.snapshot();
        assert_eq!(expanded.presentation, Presentation::Expanded);
        companion.occluded = false;
        assert_eq!(companion.snapshot(), expanded);
        companion.expanded = false;
        let closed = companion.snapshot();
        assert_eq!(closed.presentation, Presentation::Eyes);
        assert!(!companion.presentation_ready(Presentation::Eyes));
        assert!(!companion.acknowledge_presentation(strip.transition_id, Presentation::Strip));
    }

    #[test]
    fn closed_presentation_acknowledgment_cannot_cross_a_hide_show_cycle() {
        let mut companion = Companion {
            ready: true,
            ..Default::default()
        };
        let old = companion.snapshot().transition_id;
        assert!(companion.acknowledge_presentation(old, Presentation::Eyes));
        companion.user_hidden = true;
        let hidden = companion.snapshot();
        assert!(!hidden.visible);
        assert_ne!(hidden.transition_id, old);
        companion.user_hidden = false;
        let shown = companion.snapshot();
        assert!(shown.visible && !shown.expanded);
        assert_ne!(shown.transition_id, hidden.transition_id);
        assert!(!companion.presentation_ready(Presentation::Eyes));
        assert!(!companion.acknowledge_presentation(old, Presentation::Eyes));
        assert!(companion.acknowledge_presentation(shown.transition_id, Presentation::Eyes));
        assert!(companion.presentation_ready(Presentation::Eyes));
        assert_eq!(companion.snapshot().transition_id, shown.transition_id);
    }

    #[test]
    fn terminal_presentation_acknowledgments_match_both_target_and_generation() {
        let mut companion = Companion {
            ready: true,
            ..Default::default()
        };
        let compact = companion.snapshot().transition_id;
        assert!(!companion.presentation_ready(Presentation::Eyes));
        assert!(!companion.acknowledge_presentation(compact, Presentation::Expanded));
        assert!(companion.acknowledge_presentation(compact, Presentation::Eyes));
        assert!(companion.presentation_ready(Presentation::Eyes));
        companion.expanded = true;
        let open = companion.snapshot().transition_id;
        assert!(!companion.presentation_ready(Presentation::Eyes));
        assert!(!companion.acknowledge_presentation(compact, Presentation::Eyes));
        assert!(companion.acknowledge_presentation(open, Presentation::Expanded));
        companion.user_hidden = true;
        assert!(!companion.presentation_ready(Presentation::Expanded));
        assert!(!companion.acknowledge_presentation(open, Presentation::Expanded));
        companion.user_hidden = false;
        let closed = companion.snapshot().transition_id;
        assert!(!companion.presentation_ready(Presentation::Eyes));
        assert!(companion.acknowledge_presentation(closed, Presentation::Eyes));
        companion.begin_document();
        assert!(!companion.acknowledge_presentation(closed, Presentation::Eyes));
    }

    #[test]
    fn update_acknowledgment_requires_current_painted_offer_and_reveal() {
        let mut companion = Companion {
            ready: true,
            expanded: true,
            ..Default::default()
        };
        let transition = companion.snapshot().transition_id;
        assert!(!companion.acknowledge_update(1, 1, transition));
        companion.acknowledge_presentation(transition, Presentation::Expanded);
        assert!(!companion.update_ready(1));
        assert!(companion.acknowledge_update(1, 1, transition));
        assert!(companion.update_ready(1));
        assert!(!companion.update_ready(2));
        assert!(!companion.acknowledge_update(1, 2, transition));
        assert!(companion.acknowledge_update(2, 2, transition));
        companion.expanded = false;
        companion.snapshot();
        companion.expanded = true;
        let next = companion.snapshot().transition_id;
        companion.acknowledge_presentation(next, Presentation::Expanded);
        assert!(!companion.update_ready(2));
        assert!(!companion.acknowledge_update(2, 2, transition));
        assert!(companion.acknowledge_update(2, 2, next));
        companion.begin_document();
        companion.expanded = true;
        let reloaded = companion.snapshot().transition_id;
        companion.acknowledge_presentation(reloaded, Presentation::Expanded);
        assert!(!companion.update_ready(2));
        assert!(!companion.acknowledge_update(2, 2, next));
    }

    #[test]
    fn reveal_acknowledgment_tracks_targets_and_survives_unchanged_state() {
        let mut companion = Companion {
            ready: true,
            ..Default::default()
        };
        let compact = companion.snapshot();
        assert!(!companion.acknowledge_presentation(compact.transition_id, Presentation::Expanded));
        companion.expanded = true;
        let opening = companion.snapshot();
        assert_ne!(opening.transition_id, compact.transition_id);
        assert!(!companion.close_ready());
        assert!(!companion.acknowledge_presentation(compact.transition_id, Presentation::Expanded));
        assert!(companion.acknowledge_presentation(opening.transition_id, Presentation::Expanded));
        assert!(companion.close_ready());
        companion.reduced_motion = true;
        assert_eq!(companion.snapshot().transition_id, opening.transition_id);
        assert!(companion.close_ready());
    }

    #[test]
    fn collapse_hide_and_reversal_reject_stale_reveal_acknowledgments() {
        let mut companion = Companion {
            ready: true,
            expanded: true,
            ..Default::default()
        };
        let first = companion.snapshot().transition_id;
        assert!(companion.acknowledge_presentation(first, Presentation::Expanded));
        companion.expanded = false;
        let closing = companion.snapshot().transition_id;
        assert_ne!(closing, first);
        assert!(!companion.close_ready());
        assert!(!companion.acknowledge_presentation(first, Presentation::Expanded));
        companion.expanded = true;
        let reversed = companion.snapshot().transition_id;
        assert_ne!(reversed, closing);
        assert!(!companion.acknowledge_presentation(first, Presentation::Expanded));
        assert!(companion.acknowledge_presentation(reversed, Presentation::Expanded));
        companion.user_hidden = true;
        let hidden = companion.snapshot();
        assert!(!hidden.expanded);
        assert_ne!(hidden.transition_id, reversed);
        assert!(!companion.close_ready());
        assert!(!companion.acknowledge_presentation(reversed, Presentation::Expanded));
        companion.user_hidden = false;
        assert!(!companion.snapshot().expanded);
        assert!(!companion.close_ready());
    }

    #[test]
    fn every_new_document_invalidates_old_acknowledgments() {
        let mut companion = Companion {
            ready: true,
            expanded: true,
            ..Default::default()
        };
        let old = companion.snapshot().transition_id;
        assert!(companion.acknowledge_presentation(old, Presentation::Expanded));
        companion.begin_document();
        let reset = companion.snapshot();
        assert!(!reset.expanded);
        assert_ne!(reset.transition_id, old);
        assert!(!companion.close_ready());
        assert!(!companion.acknowledge_presentation(old, Presentation::Expanded));
        companion.begin_document();
        let compact_reload = companion.snapshot().transition_id;
        assert_ne!(compact_reload, reset.transition_id);
        companion.expanded = true;
        let current = companion.snapshot().transition_id;
        assert!(!companion.acknowledge_presentation(old, Presentation::Expanded));
        assert!(!companion.acknowledge_presentation(reset.transition_id, Presentation::Expanded));
        assert!(!companion.acknowledge_presentation(compact_reload, Presentation::Expanded));
        assert!(companion.acknowledge_presentation(current, Presentation::Expanded));
        assert!(companion.close_ready());
    }

    #[test]
    fn readiness_and_native_visibility_reasons_preserve_user_hidden_state() {
        let mut companion = Companion::default();
        assert!(!companion.snapshot().visible);
        companion.ready = true;
        companion.expanded = true;
        assert!(companion.snapshot().expanded);
        companion.user_hidden = true;
        companion.suspended = true;
        assert!(!companion.snapshot().visible);
        companion.suspended = false;
        assert!(!companion.snapshot().visible);
        assert!(!companion.snapshot().expanded);
        companion.user_hidden = false;
        assert!(companion.snapshot().visible);
    }
}

pub mod update;
