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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub revision: u64,
    pub locale: String,
    pub display: String,
    pub theme: Theme,
    pub compact_mode: CompactMode,
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
