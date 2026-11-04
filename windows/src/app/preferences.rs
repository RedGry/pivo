use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    #[default]
    Dark,
}
impl Theme {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "system" => Some(Self::System),
            "light" => Some(Self::Light),
            "dark" => Some(Self::Dark),
            _ => None,
        }
    }
    pub fn saved(value: &str) -> Self {
        Self::parse(value.trim()).unwrap_or_default()
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CompactMode {
    #[default]
    Auto,
    Eyes,
    Strip,
}
impl CompactMode {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "auto" => Some(Self::Auto),
            "eyes" => Some(Self::Eyes),
            "strip" => Some(Self::Strip),
            _ => None,
        }
    }
    pub fn saved(value: &str) -> Self {
        Self::parse(value.trim()).unwrap_or_default()
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Eyes => "eyes",
            Self::Strip => "strip",
        }
    }
    pub fn presentation(self, occluded: bool) -> super::Presentation {
        match self {
            Self::Eyes => super::Presentation::Eyes,
            Self::Strip => super::Presentation::Strip,
            Self::Auto if occluded => super::Presentation::Strip,
            Self::Auto => super::Presentation::Eyes,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MascotSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl MascotSize {
    pub fn saved(value: &str) -> Self {
        match value {
            "small" => Self::Small,
            "large" => Self::Large,
            _ => Self::Medium,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Small => "small",
            Self::Medium => "medium",
            Self::Large => "large",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MascotProp {
    Music,
    Pomodoro,
    Water,
    Tasks,
    Calendar,
    Shelf,
    Hud,
    Hat,
    Scarf,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PropSkin {
    Classic,
    #[serde(alias = "mint")]
    Alternate,
    #[serde(alias = "sunset")]
    Signature,
}

pub type PropSkins = std::collections::BTreeMap<MascotProp, PropSkin>;

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HolidayMode {
    #[default]
    Off,
    Auto,
    Winter,
    Love,
    Spring,
    Summer,
    Autumn,
    Spooky,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct HolidayPreferences {
    pub outfit: HolidayMode,
    pub appearance: HolidayMode,
    #[serde(default)]
    pub variants: std::collections::BTreeMap<String, PropSkin>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub revision: u64,
    pub locale: String,
    pub display: String,
    pub theme: Theme,
    pub compact_mode: CompactMode,
    pub island_scale: u16,
    pub minimal_strip: bool,
    pub mascot_size: MascotSize,
    pub mascot_motion: bool,
    pub mascot_hat: bool,
    pub mascot_scarf: bool,
    pub prop_skins: PropSkins,
    pub holidays: HolidayPreferences,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_stored_choices_fall_back_but_setters_can_reject_them() {
        assert_eq!(Theme::saved("invalid"), Theme::Dark);
        assert_eq!(CompactMode::saved("invalid"), CompactMode::Auto);
        assert_eq!(Theme::saved(" dark\n"), Theme::Dark);
        assert_eq!(CompactMode::saved("eyes"), CompactMode::Eyes);
        assert!(Theme::parse("invalid").is_none());
        assert!(CompactMode::parse("invalid").is_none());
    }
    #[test]
    fn prop_skins_round_trip_independently() {
        let skins = PropSkins::from([
            (MascotProp::Music, PropSkin::Alternate),
            (MascotProp::Water, PropSkin::Signature),
        ]);
        let saved = serde_json::to_string(&skins).unwrap();
        let loaded: PropSkins = serde_json::from_str(&saved).unwrap();
        assert_eq!(loaded, skins);
        assert!(!loaded.contains_key(&MascotProp::Calendar));
        let legacy: PropSkins =
            serde_json::from_str(r#"{"music":"mint","water":"sunset"}"#).unwrap();
        assert_eq!(legacy, loaded);
    }

    #[test]
    fn mascot_size_round_trips_and_defaults_for_existing_installations() {
        assert_eq!(MascotSize::saved(""), MascotSize::Medium);
        assert_eq!(MascotSize::saved("unknown"), MascotSize::Medium);
        for size in [MascotSize::Small, MascotSize::Medium, MascotSize::Large] {
            assert_eq!(MascotSize::saved(size.as_str()), size);
        }
    }

    #[test]
    fn auto_uses_occlusion_while_explicit_compact_choices_override_it() {
        use super::super::Presentation::*;
        assert_eq!(CompactMode::Auto.presentation(false), Eyes);
        assert_eq!(CompactMode::Auto.presentation(true), Strip);
        for occluded in [false, true] {
            assert_eq!(CompactMode::Eyes.presentation(occluded), Eyes);
            assert_eq!(CompactMode::Strip.presentation(occluded), Strip);
        }
    }
}
