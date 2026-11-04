pub use crate::app::preferences::Preferences;
use crate::app::{
    localization::Catalog,
    preferences::{
        CompactMode, HolidayMode, HolidayPreferences, MascotProp, MascotSize, PropSkin, Theme,
    },
};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

struct State {
    catalog: Catalog,
    preferences: Preferences,
}

pub fn setup(app: &tauri::AppHandle) -> Result<(), String> {
    let catalog = Catalog::embedded()?;
    let directory = app.path().app_config_dir().ok();
    let saved = |name: &str| {
        directory
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path.join(name)).ok())
            .unwrap_or_default()
    };
    let locale = catalog.resolve(saved("locale").trim()).to_owned();
    let mascot = saved("mascot");
    let mut outfit = mascot.trim().split(':');
    let size = outfit.next().unwrap_or_default();
    let motion = outfit.next().unwrap_or_default();
    let preferences = Preferences {
        revision: 0,
        locale,
        display: {
            let display = saved("display");
            if display.trim().is_empty() {
                "primary".into()
            } else {
                display.trim().into()
            }
        },
        theme: Theme::saved(&saved("theme")),
        compact_mode: CompactMode::saved(&saved("compact-mode")),
        island_scale: parse_island_scale(&saved("island-scale")).unwrap_or_default(),
        minimal_strip: saved("minimal-strip").trim() == "true",
        mascot_size: MascotSize::saved(size),
        mascot_motion: motion != "static",
        mascot_hat: outfit.next() == Some("true"),
        mascot_scarf: outfit.next() == Some("true"),
        prop_skins: serde_json::from_str(&saved("mascot-props.json")).unwrap_or_default(),
        holidays: serde_json::from_str(&saved("holidays.json")).unwrap_or_default(),
    };
    app.manage(Mutex::new(State {
        catalog,
        preferences,
    }));
    Ok(())
}

pub fn get(app: &tauri::AppHandle) -> Preferences {
    app.state::<Mutex<State>>()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .preferences
        .clone()
}

pub fn text(app: &tauri::AppHandle, key: &str) -> String {
    let managed = app.state::<Mutex<State>>();
    let state = managed.lock().unwrap_or_else(|error| error.into_inner());
    state
        .catalog
        .message(&state.preferences.locale, key)
        .to_owned()
}

fn save(
    app: &tauri::AppHandle,
    name: &str,
    value: impl FnOnce(&Preferences) -> Result<String, String>,
    change: impl FnOnce(&mut Preferences),
) -> Result<Preferences, String> {
    let preferences = {
        let managed = app.state::<Mutex<State>>();
        let mut state = managed.lock().unwrap_or_else(|error| error.into_inner());
        let value = value(&state.preferences)?;
        let result = app
            .path()
            .app_config_dir()
            .map_err(|error| error.to_string())
            .and_then(|path| {
                std::fs::create_dir_all(&path)
                    .and_then(|_| std::fs::write(path.join(name), value))
                    .map_err(|error| error.to_string())
            });
        result.map_err(|error| {
            format!(
                "{}: {error}",
                state
                    .catalog
                    .message(&state.preferences.locale, "errors.preferencesFailed")
            )
        })?;
        change(&mut state.preferences);
        state.preferences.revision = state.preferences.revision.saturating_add(1);
        state.preferences.clone()
    };
    let _ = app.emit("pivo:preferences", &preferences);
    let main_app = app.clone();
    let scale_changed = name == "island-scale";
    app.run_on_main_thread(move || {
        super::update::localize(&main_app);
        super::settings::apply_preferences(&main_app);
        let _ = if scale_changed {
            super::animate_island_scale(&main_app)
        } else {
            super::refresh_environment(&main_app)
        };
    })
    .map_err(|error| error.to_string())?;
    Ok(preferences)
}

pub fn set_locale(app: &tauri::AppHandle, locale: String) -> Result<Preferences, String> {
    let supported = app
        .state::<Mutex<State>>()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .catalog
        .contains(&locale);
    if !supported {
        return Err(text(app, "errors.localeUnsupported"));
    }
    save(
        app,
        "locale",
        |_| Ok(locale.clone()),
        |preferences| preferences.locale = locale.clone(),
    )
}

pub fn set_theme(app: &tauri::AppHandle, value: String) -> Result<Preferences, String> {
    let theme = Theme::parse(&value).ok_or_else(|| text(app, "errors.themeUnsupported"))?;
    save(
        app,
        "theme",
        |_| Ok(theme.as_str().into()),
        |preferences| preferences.theme = theme,
    )
}

pub fn set_compact_mode(app: &tauri::AppHandle, value: String) -> Result<Preferences, String> {
    let mode =
        CompactMode::parse(&value).ok_or_else(|| text(app, "errors.compactModeUnsupported"))?;
    save(
        app,
        "compact-mode",
        |_| Ok(mode.as_str().into()),
        |preferences| preferences.compact_mode = mode,
    )
}

fn parse_island_scale(value: &str) -> Option<u16> {
    value
        .trim()
        .parse()
        .ok()
        .filter(|scale| [0, 100, 115, 130, 150].contains(scale))
}

pub fn set_island_scale(app: &tauri::AppHandle, value: String) -> Result<Preferences, String> {
    let scale =
        parse_island_scale(&value).ok_or_else(|| text(app, "errors.islandScaleUnsupported"))?;
    save(
        app,
        "island-scale",
        |_| Ok(scale.to_string()),
        |preferences| {
            preferences.island_scale = scale;
        },
    )
}

pub fn set_minimal_strip(app: &tauri::AppHandle, enabled: bool) -> Result<Preferences, String> {
    save(
        app,
        "minimal-strip",
        |_| Ok(enabled.to_string()),
        |preferences| {
            preferences.minimal_strip = enabled;
        },
    )
}

pub fn set_display(app: &tauri::AppHandle, display: String) -> Result<Preferences, String> {
    if display != "primary"
        && !super::displays::list()?
            .iter()
            .any(|current| current.id == display)
    {
        return Err(text(app, "errors.displayUnsupported"));
    }
    save(
        app,
        "display",
        |_| Ok(display.clone()),
        |preferences| preferences.display = display.clone(),
    )
}

pub fn set_mascot(
    app: &tauri::AppHandle,
    size: MascotSize,
    motion: bool,
    hat: bool,
    scarf: bool,
) -> Result<Preferences, String> {
    let value = format!(
        "{}:{}:{hat}:{scarf}",
        size.as_str(),
        if motion { "animated" } else { "static" }
    );
    save(
        app,
        "mascot",
        |_| Ok(value),
        |preferences| {
            preferences.mascot_size = size;
            preferences.mascot_motion = motion;
            preferences.mascot_hat = hat;
            preferences.mascot_scarf = scarf;
        },
    )
}

pub fn set_prop_skin(
    app: &tauri::AppHandle,
    prop: MascotProp,
    skin: PropSkin,
) -> Result<Preferences, String> {
    save(
        app,
        "mascot-props.json",
        |preferences| {
            let mut skins = preferences.prop_skins.clone();
            skins.insert(prop, skin);
            serde_json::to_string(&skins).map_err(|error| error.to_string())
        },
        |preferences| {
            preferences.prop_skins.insert(prop, skin);
        },
    )
}

fn save_holidays(
    app: &tauri::AppHandle,
    change: impl Fn(&mut HolidayPreferences),
) -> Result<Preferences, String> {
    save(
        app,
        "holidays.json",
        |preferences| {
            let mut holidays = preferences.holidays.clone();
            change(&mut holidays);
            serde_json::to_string(&holidays).map_err(|error| error.to_string())
        },
        |preferences| change(&mut preferences.holidays),
    )
}

pub fn set_holidays(
    app: &tauri::AppHandle,
    outfit: HolidayMode,
    appearance: HolidayMode,
) -> Result<Preferences, String> {
    save_holidays(app, |holidays| {
        holidays.outfit = outfit;
        holidays.appearance = appearance;
    })
}

pub fn set_holiday_variant(
    app: &tauri::AppHandle,
    occasion: String,
    variant: PropSkin,
) -> Result<Preferences, String> {
    if occasion.is_empty()
        || occasion.len() > 40
        || !occasion.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return Err(text(app, "errors.preferencesFailed"));
    }
    save_holidays(app, |holidays| {
        holidays.variants.insert(occasion.clone(), variant);
    })
}
