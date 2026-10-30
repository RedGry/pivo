use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct Display {
    pub id: String,
    pub number: u32,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

pub fn selected_index(requested: &str, displays: &[Display]) -> Option<usize> {
    if requested != "primary"
        && let Some(index) = displays.iter().position(|display| display.id == requested)
    {
        return Some(index);
    }
    displays
        .iter()
        .position(|display| display.primary)
        .or_else(|| (!displays.is_empty()).then_some(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn chosen_display_follows_primary_and_recovers_saved_selection_on_reconnect() {
        let mut displays = vec![
            Display {
                id: "screen1".into(),
                number: 1,
                width: 2560,
                height: 1440,
                primary: true,
            },
            Display {
                id: "screen2".into(),
                number: 2,
                width: 1920,
                height: 1080,
                primary: false,
            },
        ];
        assert_eq!(selected_index("screen2", &displays), Some(1));
        assert_eq!(selected_index("primary", &displays), Some(0));
        displays[0].primary = false;
        displays[1].primary = true;
        assert_eq!(selected_index("primary", &displays), Some(1));
        assert_eq!(selected_index("screen1", &displays), Some(0));
        let detached = displays.remove(0);
        assert_eq!(selected_index("screen1", &displays), Some(0));
        displays.push(detached);
        assert_eq!(selected_index("screen1", &displays), Some(1));
        assert_eq!(selected_index("primary", &[]), None);
    }
}
