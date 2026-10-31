const SAMPLE_DELAY_SECONDS: f64 = 0.010;

/// Pairs observed left presses without consuming input. Coordinates and extents share physical pixels.
#[derive(Clone, Copy, Default)]
pub struct DoubleClick {
    first: Option<(f64, i32, i32)>,
}

impl DoubleClick {
    pub fn press(&mut self, now: f64, x: i32, y: i32, interval: f64, extent: (i32, i32)) -> bool {
        if let Some((at, first_x, first_y)) = self.first
            && now >= at
            && now - at <= interval
            && (i64::from(x) - i64::from(first_x)).abs() * 2 <= i64::from(extent.0)
            && (i64::from(y) - i64::from(first_y)).abs() * 2 <= i64::from(extent.1)
        {
            self.first = None;
            return true;
        }
        self.first = Some((now, x, y));
        false
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn double_click_pairs_use_elapsed_time_and_physical_system_rectangle() {
        let mut clicks = DoubleClick::default();
        assert!(!clicks.press(1.0, 100, 100, 0.5, (8, 8)));
        assert!(clicks.press(1.5, 104, 96, 0.5, (8, 8)));
        assert!(
            !clicks.press(1.6, 104, 96, 0.5, (8, 8)),
            "a third press begins a new pair"
        );
        assert!(clicks.press(1.7, 104, 96, 0.5, (8, 8)));
    }

    #[test]
    fn distant_or_late_presses_start_new_pairs_and_reset_discards_history() {
        let mut clicks = DoubleClick::default();
        assert!(!clicks.press(1.0, 100, 100, 0.5, (8, 8)));
        assert!(!clicks.press(1.2, 105, 100, 0.5, (8, 8)));
        assert!(!clicks.press(1.8, 105, 100, 0.5, (8, 8)));
        clicks = DoubleClick::default();
        assert!(!clicks.press(1.9, 105, 100, 0.5, (8, 8)));
        assert!(clicks.press(2.0, 105, 100, 0.5, (8, 8)));
        assert!(!clicks.press(3.0, i32::MIN, 0, 0.5, (8, 8)));
        assert!(!clicks.press(3.1, i32::MAX, 0, 0.5, (8, 8)));
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
    fn exit_grace_is_cancelled_by_returning_inside() {
        let mut exit = PointerDwell::default();
        assert!(exit.arm(0.0, 0.200));
        assert!(!exit.arm(0.1, 0.200));
        exit = PointerDwell::default();
        assert_eq!(exit.remaining_ms(0.201), None);
        assert!(exit.arm(0.3, 0.200));
        assert_eq!(exit.remaining_ms(0.501), Some(0));
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
