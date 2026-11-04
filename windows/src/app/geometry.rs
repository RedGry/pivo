use super::Presentation;

pub const WIDTH: i32 = 480;
pub const CANVAS_SCALE: f64 = 1.64;
pub const LYRICS_WIDTH: i32 = 752;
pub const HEIGHT: i32 = 156;
pub const COMPACT_WIDTH: i32 = 148;
pub const COMPACT_HEIGHT: i32 = 34;
pub const COMPACT_LEFT: i32 = (WIDTH - COMPACT_WIDTH) / 2;

#[derive(Clone, Copy)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}
impl Rect {
    pub fn contains(self, x: f64, y: f64) -> bool {
        (f64::from(self.left)..f64::from(self.left + self.width)).contains(&x)
            && (f64::from(self.top)..f64::from(self.top + self.height)).contains(&y)
    }
}
pub const CLOSE: Rect = Rect {
    left: WIDTH - 48,
    top: 8,
    width: 24,
    height: 24,
};
pub const SETTINGS: Rect = Rect {
    left: WIDTH - 80,
    top: 8,
    width: 24,
    height: 24,
};
pub const UPDATE: Rect = Rect {
    left: 184,
    top: 108,
    width: 119,
    height: 28,
};
pub const LATER: Rect = Rect {
    left: 313,
    top: 108,
    width: 119,
    height: 28,
};
const fn widget_page(index: i32) -> Rect {
    Rect {
        left: index * 20,
        top: 132,
        width: 20,
        height: 20,
    }
}

pub const PLUGIN_ACTIONS: [Rect; 16] = [
    Rect {
        left: 32,
        top: 104,
        width: 28,
        height: 24,
    },
    Rect {
        left: 420,
        top: 104,
        width: 28,
        height: 24,
    },
    Rect {
        left: 253,
        top: 104,
        width: 54,
        height: 24,
    },
    Rect {
        left: 312,
        top: 104,
        width: 102,
        height: 24,
    },
    widget_page(0),
    widget_page(1),
    widget_page(2),
    widget_page(3),
    widget_page(4),
    widget_page(5),
    widget_page(6),
    Rect {
        left: 202,
        top: 88,
        width: 194,
        height: 14,
    },
    Rect {
        left: 32,
        top: 104,
        width: 28,
        height: 24,
    },
    Rect {
        left: 420,
        top: 104,
        width: 28,
        height: 24,
    },
    Rect {
        left: 239,
        top: 40,
        width: 175,
        height: 24,
    },
    Rect {
        left: 239,
        top: 68,
        width: 175,
        height: 24,
    },
];

pub fn plugin_actions(music: bool, pages: u32) -> [Rect; PLUGIN_ACTIONS.len()] {
    let mut actions = PLUGIN_ACTIONS;
    if music {
        for (rect, left) in actions.iter_mut().zip([239, 295, 267, 207]) {
            *rect = Rect {
                left,
                top: 104,
                width: 28,
                height: 24,
            };
        }
    }
    let page_left = WIDTH / 2 - pages as i32 * 10;
    for rect in &mut actions[4..11] {
        rect.left += page_left;
    }
    actions
}

#[cfg(test)]
#[test]
fn music_transport_is_centered_and_lyrics_has_its_own_target() {
    let actions = plugin_actions(true, 7);
    let [previous, next, play, lyrics, ..] = actions;
    assert_eq!(play.left + play.width / 2, 127 + 308 / 2);
    assert_eq!(previous.left + previous.width, play.left);
    assert_eq!(play.left + play.width, next.left);
    assert!(lyrics.left + lyrics.width < previous.left);
    let standard = plugin_actions(false, 7);
    assert_eq!(
        standard[0].left + standard[1].left + standard[1].width,
        WIDTH
    );
    assert_eq!(standard[0].top, standard[1].top);
    assert_eq!(actions[13].left, WIDTH - 60);
}

#[cfg(test)]
#[test]
fn widget_pages_stay_centered_for_each_visible_count() {
    for music in [false, true] {
        for count in 2..=7 {
            let actions = plugin_actions(music, count);
            let first = actions[4];
            let last = actions[3 + count as usize];
            assert_eq!(first.left + last.left + last.width, WIDTH);
            assert!(last.top + last.height <= HEIGHT);
        }
    }
}

pub fn bounds(presentation: Presentation) -> Rect {
    match presentation {
        Presentation::Expanded => Rect {
            left: 0,
            top: 0,
            width: WIDTH,
            height: HEIGHT,
        },
        Presentation::Eyes => Rect {
            left: COMPACT_LEFT,
            top: 0,
            width: COMPACT_WIDTH,
            height: COMPACT_HEIGHT,
        },
        Presentation::Strip => reveal(Presentation::Strip),
    }
}
pub fn reveal(presentation: Presentation) -> Rect {
    match presentation {
        Presentation::Eyes => Rect {
            left: WIDTH / 2 - 20,
            top: COMPACT_HEIGHT / 2 - 14,
            width: 40,
            height: 28,
        },
        _ => Rect {
            left: COMPACT_LEFT,
            top: 0,
            width: COMPACT_WIDTH,
            height: 24,
        },
    }
}

/// Scale the island to available logical desktop space, independently of monitor density.
pub fn monitor_scale(physical_height: i32, dpi: u32) -> f64 {
    let logical_height = f64::from(physical_height.max(0)) * 96.0 / f64::from(dpi.max(96));
    1.0 + ((logical_height - 1080.0) / 2160.0).clamp(0.0, 1.0 / 6.0)
}

/// Convert base design coordinates once, keeping DPI and island scale consistent.
pub fn physical(value: i32, dpi: u32, ui_scale: f64) -> i32 {
    (f64::from(value) * f64::from(dpi) / 96.0 * ui_scale).round() as i32
}

pub fn island_scale_at(from: f64, to: f64, elapsed: f64) -> f64 {
    let progress = (elapsed / 0.30).clamp(0.0, 1.0);
    if progress >= 1.0 {
        return to;
    }
    let eased = progress * progress * (3.0 - 2.0 * progress);
    from + (to - from) * eased
}

pub fn canvas_offset(dpi: u32, canvas_scale: f64, ui_scale: f64) -> i32 {
    (physical(WIDTH, dpi, canvas_scale) - physical(WIDTH, dpi, ui_scale)) / 2
}

pub fn centered_target(rect: Rect, dpi: u32, canvas_scale: f64, scale: f64) -> Rect {
    Rect {
        left: canvas_offset(dpi, canvas_scale, scale) + physical(rect.left, dpi, scale),
        top: physical(rect.top, dpi, scale),
        width: physical(rect.width, dpi, scale),
        height: physical(rect.height, dpi, scale),
    }
}

pub fn shared_target(first: Rect, second: Rect) -> Rect {
    let left = first.left.max(second.left);
    let top = first.top.max(second.top);
    Rect {
        left,
        top,
        width: ((first.left + first.width).min(second.left + second.width) - left).max(0),
        height: ((first.top + first.height).min(second.top + second.height) - top).max(0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_canvas_encloses_the_six_percent_motion_envelope_after_dpi_rounding() {
        for dpi in [96, 110, 120, 137, 144, 168, 192] {
            let css_offset = f64::from(WIDTH) * f64::from(dpi) / 96.0 * (CANVAS_SCALE - 1.5) / 2.0;
            let native_offset = canvas_offset(dpi, CANVAS_SCALE, 1.5);
            assert!((f64::from(native_offset) - css_offset).abs() <= 1.0);
            for dimension in [WIDTH, LYRICS_WIDTH, HEIGHT] {
                let reserved = physical(dimension, dpi, CANVAS_SCALE);
                let envelope =
                    (f64::from(dimension) * f64::from(dpi) / 96.0 * 1.5 * 1.06).ceil() as i32;
                assert!(
                    reserved >= envelope,
                    "dimension {dimension}, DPI {dpi}: canvas {reserved}, envelope {envelope}"
                );
            }
        }
    }

    #[test]
    fn island_scale_can_reverse_from_the_current_frame() {
        let middle = island_scale_at(1.0, 1.5, 0.15);
        assert_eq!(middle, 1.25);
        assert_eq!(island_scale_at(middle, 1.0, 0.0), middle);
        assert_eq!(island_scale_at(middle, 1.0, 0.15), 1.125);
        assert_eq!(island_scale_at(middle, 1.0, 0.30), 1.0);
    }

    #[test]
    fn a_reserved_canvas_keeps_the_scaled_panel_centered() {
        for scale in [1.0, 1.15, 1.3, 1.5] {
            let doubled_center =
                2 * canvas_offset(144, CANVAS_SCALE, scale) + physical(WIDTH, 144, scale);
            assert!(doubled_center.abs_diff(physical(WIDTH, 144, CANVAS_SCALE)) <= 1);
        }
    }

    #[test]
    fn scale_handoff_target_is_inside_both_endpoint_targets() {
        for presentation in [Presentation::Eyes, Presentation::Strip] {
            let rect = reveal(presentation);
            let smaller = centered_target(rect, 96, CANVAS_SCALE, 1.0);
            let larger = centered_target(rect, 96, CANVAS_SCALE, 1.5);
            let common = shared_target(smaller, larger);
            let canvas_center = f64::from(physical(WIDTH, 96, CANVAS_SCALE)) / 2.0;
            assert!(common.contains(canvas_center, f64::from(common.top)));
            assert!(!common.contains(f64::from(common.left + common.width), f64::from(common.top)));
            assert!(smaller.contains(f64::from(common.left), f64::from(common.top)));
            assert!(larger.contains(f64::from(common.left), f64::from(common.top)));
        }
    }

    #[test]
    fn folded_reveal_never_reuses_the_expanded_body() {
        let body_point = (100.0, 100.0);
        assert!(bounds(Presentation::Expanded).contains(body_point.0, body_point.1));
        for presentation in [Presentation::Strip, Presentation::Eyes] {
            assert!(!reveal(presentation).contains(body_point.0, body_point.1));
        }
        assert!(reveal(Presentation::Eyes).contains(f64::from(WIDTH / 2), 20.0));
        assert!(reveal(Presentation::Strip).contains(f64::from(WIDTH / 2), 0.0));
    }

    #[test]
    fn folded_targets_remain_centered_when_the_expanded_canvas_widens() {
        assert_eq!(WIDTH, 480);
        assert_eq!(HEIGHT, 156);
        let eyes = bounds(Presentation::Eyes);
        assert_eq!(eyes.left * 2 + eyes.width, WIDTH);
        assert_eq!(eyes.width, 148);
        assert_eq!(eyes.height, 34);
        for presentation in [Presentation::Strip, Presentation::Eyes] {
            let target = reveal(presentation);
            assert_eq!(target.left * 2 + target.width, WIDTH);
        }
        assert_eq!(CLOSE.left + CLOSE.width, WIDTH - 24);
        assert_eq!(SETTINGS.left + SETTINGS.width + 8, CLOSE.left);
    }

    #[test]
    fn all_expanded_controls_fit_the_shorter_island() {
        let panel = bounds(Presentation::Expanded);
        for rect in [CLOSE, SETTINGS, UPDATE, LATER]
            .into_iter()
            .chain(PLUGIN_ACTIONS)
        {
            assert!(panel.contains(f64::from(rect.left), f64::from(rect.top)));
            assert!(panel.contains(
                f64::from(rect.left + rect.width - 1),
                f64::from(rect.top + rect.height - 1),
            ));
        }
        assert!(!panel.contains(220.0, 160.0));
    }

    #[test]
    fn all_geometry_uses_one_scale_before_device_rounding() {
        let qhd = monitor_scale(1440, 96);
        assert_eq!(physical(WIDTH, 96, qhd), 560);
        assert_eq!(physical(HEIGHT, 96, qhd), 182);
        assert_eq!(physical(COMPACT_WIDTH, 96, qhd), 173);
        assert_eq!(physical(COMPACT_HEIGHT, 96, qhd), 40);
        let dense = monitor_scale(1440, 120);
        assert_eq!(physical(WIDTH, 120, dense), 620);
        for rect in PLUGIN_ACTIONS {
            assert!(physical(rect.left + rect.width, 120, dense) < physical(WIDTH, 120, dense));
        }
    }

    #[test]
    fn full_hd_stays_compact_and_qhd_recovers_the_larger_island() {
        assert_eq!(monitor_scale(1080, 96), 1.0);
        assert_eq!(monitor_scale(1440, 96), 7.0 / 6.0);
        assert_eq!(monitor_scale(1440, 120), 1.0 + 72.0 / 2160.0);
        assert_eq!(monitor_scale(1080, 120), 1.0);
        assert_eq!(monitor_scale(2160, 144), 7.0 / 6.0);
        assert_eq!(monitor_scale(720, 96), 1.0);
        assert_eq!(monitor_scale(4000, 96), 7.0 / 6.0);
        assert_eq!(monitor_scale(1440, 0), 7.0 / 6.0);
    }
}
