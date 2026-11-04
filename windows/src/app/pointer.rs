const SAMPLE_DELAY_SECONDS: f64 = 0.010;
pub const HOVER_DELAY_SECONDS: f64 = 0.020;

#[derive(Clone, Copy, Default)]
pub struct PendingPointer {
    due: Option<f64>,
    pressed: bool,
}

impl PendingPointer {
    /// Returns true only when the first packet needs to arm a sampling timer.
    pub fn queue(&mut self, pressed: bool, now: f64) -> bool {
        self.pressed |= pressed;
        if self.due.is_some() {
            return false;
        }
        self.due = Some(now + SAMPLE_DELAY_SECONDS);
        true
    }

    pub fn take(&mut self, now: f64) -> Option<bool> {
        if now < self.due? {
            return None;
        }
        self.due = None;
        Some(std::mem::take(&mut self.pressed))
    }

    pub fn pending(self) -> bool {
        self.due.is_some()
    }
}

/// A single dwell deadline. Movement never extends it; leaving cancels it.
#[derive(Clone, Copy, Default)]
pub struct PointerDwell {
    due: Option<f64>,
}

impl PointerDwell {
    pub fn arm(&mut self, now: f64, delay: f64) -> bool {
        if self.due.is_some() {
            return false;
        }
        self.due = Some(now + delay);
        true
    }

    pub fn remaining_ms(self, now: f64) -> Option<u32> {
        self.due
            .map(|due| ((due - now) * 1000.0).ceil().max(0.0) as u32)
    }
}

/// Collect high-resolution wheel packets into whole Windows wheel detents.
#[derive(Default, Clone, Copy)]
pub struct Wheel(i32);

impl Wheel {
    pub fn add(&mut self, delta: i16) -> i32 {
        let total = self.0 + i32::from(delta);
        self.0 = total % 120;
        total / 120
    }
}

pub fn shelf_drop_visible(shelf_ready: bool, left_held: bool, file_drag_active: bool) -> bool {
    shelf_ready && (left_held || file_drag_active)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_target_survives_button_release_until_ole_finishes() {
        assert!(shelf_drop_visible(true, true, false));
        assert!(shelf_drop_visible(true, false, true));
        assert!(!shelf_drop_visible(true, false, false));
        assert!(!shelf_drop_visible(false, true, true));
    }

    #[test]
    fn partial_wheel_packets_accumulate_and_reversals_cancel() {
        let mut wheel = Wheel::default();
        assert_eq!(wheel.add(40), 0);
        assert_eq!(wheel.add(40), 0);
        assert_eq!(wheel.add(-20), 0);
        assert_eq!(wheel.add(60), 1);
        assert_eq!(wheel.add(-250), -2);
        assert_eq!(wheel.add(10), 0);
    }

    #[test]
    fn deliberate_reveal_starts_after_20_milliseconds() {
        let mut hover = PointerDwell::default();
        assert!(hover.arm(0.0, HOVER_DELAY_SECONDS));
        assert!(hover.remaining_ms(0.019).unwrap() > 0);
        assert_eq!(hover.remaining_ms(0.020), Some(0));
    }

    #[test]
    fn dwell_keeps_first_deadline_and_reentry_starts_a_full_delay() {
        let mut dwell = PointerDwell::default();
        assert!(dwell.arm(1.0, 0.350));
        assert!(!dwell.arm(1.2, 0.350));
        assert_eq!(dwell.remaining_ms(1.350), Some(0));
        dwell = PointerDwell::default();
        assert_eq!(dwell.remaining_ms(1.350), None);
        assert!(dwell.arm(1.4, 0.350));
        // A queued timer from the cancelled hover cannot open the new hover early.
        assert!(dwell.remaining_ms(1.5).unwrap() >= 250);
        assert_eq!(dwell.remaining_ms(1.751), Some(0));
    }

    #[test]
    fn packet_bursts_keep_the_first_deadline_and_preserve_button_down() {
        let mut pointer = PendingPointer::default();
        assert!(pointer.queue(false, 0.0));
        for packet in 1..10 {
            assert!(!pointer.queue(packet == 3, f64::from(packet) / 1000.0));
        }
        assert_eq!(pointer.take(0.009), None);
        assert!(pointer.pending());
        assert_eq!(pointer.take(0.010), Some(true));
        assert!(!pointer.pending());
    }

    #[test]
    fn consumption_resets_the_button_and_allows_a_new_batch() {
        let mut pointer = PendingPointer::default();
        assert_eq!(pointer.take(0.0), None);
        assert!(!pointer.pending());
        assert!(pointer.queue(true, 0.0));
        assert!(!pointer.queue(false, 0.001));
        assert_eq!(pointer.take(0.010), Some(true));
        assert_eq!(pointer.take(0.011), None);
        assert!(pointer.queue(false, 0.012));
        assert_eq!(pointer.take(0.023), Some(false));
        assert!(!pointer.pending());
    }

    #[test]
    fn hidden_reset_discards_old_input_and_an_early_timer_preserves_the_new_batch() {
        let mut pointer = PendingPointer::default();
        assert!(pointer.queue(true, 0.0));
        pointer = PendingPointer::default();
        assert!(!pointer.pending());
        assert!(pointer.queue(false, 0.006));
        // A timer left over from the discarded batch must not consume new input.
        assert_eq!(pointer.take(0.010), None);
        assert!(pointer.pending());
        assert!(!pointer.queue(false, 0.014));
        assert_eq!(pointer.take(0.017), Some(false));
        assert!(!pointer.pending());
    }
}
