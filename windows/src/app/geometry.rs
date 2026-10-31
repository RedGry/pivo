use super::Presentation;

pub const WIDTH: i32 = 560;
pub const HEIGHT: i32 = 160;
pub const COMPACT_WIDTH: i32 = 180;
pub const COMPACT_HEIGHT: i32 = 40;
pub const COMPACT_LEFT: i32 = (WIDTH - COMPACT_WIDTH) / 2;

#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CompanionTarget {
    Mascot,
    Clock,
    None,
}

// Decorative observation regions, never native input or reveal targets.
pub fn companion_target(x: f64, y: f64) -> CompanionTarget {
    let mascot = Rect {
        left: 60,
        top: 45,
        width: 115,
        height: 80,
    };
    // Cover the clock's header area across localized clock widths.
    let clock = Rect {
        left: 250,
        top: 8,
        width: 190,
        height: 24,
    };
    if mascot.contains(x, y) {
        CompanionTarget::Mascot
    } else if clock.contains(x, y) {
        CompanionTarget::Clock
    } else {
        CompanionTarget::None
    }
}

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
    left: 224,
    top: 124,
    width: 137,
    height: 28,
};
pub const LATER: Rect = Rect {
    left: 371,
    top: 124,
    width: 137,
    height: 28,
};
pub const PLUGIN_ACTIONS: [Rect; 4] = [
    Rect {
        left: 207,
        top: 118,
        width: 24,
        height: 24,
    },
    Rect {
        left: 491,
        top: 118,
        width: 24,
        height: 24,
    },
    Rect {
        left: 240,
        top: 118,
        width: 100,
        height: 24,
    },
    Rect {
        left: 350,
        top: 118,
        width: 132,
        height: 24,
    },
];

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn companion_observation_regions_have_explicit_edges_and_exclude_action_controls() {
        use CompanionTarget::*;
        assert_eq!(companion_target(60.0, 45.0), Mascot);
        assert_eq!(companion_target(174.99, 124.99), Mascot);
        assert_eq!(companion_target(250.0, 8.0), Clock);
        assert_eq!(companion_target(439.99, 31.99), Clock);
        for (x, y) in [
            (59.99, 80.0),
            (175.0, 80.0),
            (100.0, 125.0),
            (249.99, 15.0),
            (440.0, 15.0),
            (300.0, 32.0),
            (280.0, 0.0),
            (280.0, 40.0),
            (-1.0, 80.0),
            (f64::NAN, 80.0),
            (f64::INFINITY, 20.0),
        ] {
            assert_eq!(companion_target(x, y), None, "({x}, {y})");
        }
        for rect in [CLOSE, SETTINGS, UPDATE, LATER]
            .into_iter()
            .chain(PLUGIN_ACTIONS)
        {
            assert_eq!(
                companion_target(f64::from(rect.left), f64::from(rect.top)),
                None
            );
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
        assert_eq!(WIDTH, 560);
        assert_eq!(HEIGHT, 160);
        let eyes = bounds(Presentation::Eyes);
        assert_eq!(eyes.left * 2 + eyes.width, WIDTH);
        assert_eq!(eyes.width, 180);
        assert_eq!(eyes.height, 40);
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
}
