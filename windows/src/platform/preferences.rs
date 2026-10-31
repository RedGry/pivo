pub use crate::app::preferences::Preferences;
use crate::app::{
    localization::Catalog,
    preferences::{CompactMode, ObsessionActivity, Theme},
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
        obsession: crate::app::preferences::saved_obsession(&saved("obsession")),
        obsession_activity: ObsessionActivity::saved(&saved("obsession-activity")),
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
    value: &str,
    change: impl FnOnce(&mut Preferences),
) -> Result<Preferences, String> {
    let preferences = {
        let managed = app.state::<Mutex<State>>();
        let mut state = managed.lock().unwrap_or_else(|error| error.into_inner());
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
    app.run_on_main_thread(move || {
        super::update::localize(&main_app);
        super::settings::apply_preferences(&main_app);
        let _ = super::refresh_environment(&main_app);
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
    save(app, "locale", &locale, |preferences| {
        preferences.locale = locale.clone()
    })
}

pub fn set_theme(app: &tauri::AppHandle, value: String) -> Result<Preferences, String> {
    let theme = Theme::parse(&value).ok_or_else(|| text(app, "errors.themeUnsupported"))?;
    save(app, "theme", theme.as_str(), |preferences| {
        preferences.theme = theme
    })
}

pub fn set_compact_mode(app: &tauri::AppHandle, value: String) -> Result<Preferences, String> {
    let mode =
        CompactMode::parse(&value).ok_or_else(|| text(app, "errors.compactModeUnsupported"))?;
    save(app, "compact-mode", mode.as_str(), |preferences| {
        preferences.compact_mode = mode
    })
}

pub fn set_obsession(app: &tauri::AppHandle, enabled: bool) -> Result<Preferences, String> {
    save(
        app,
        "obsession",
        if enabled { "true" } else { "false" },
        |preferences| preferences.obsession = enabled,
    )
}

pub fn set_obsession_activity(
    app: &tauri::AppHandle,
    value: String,
) -> Result<Preferences, String> {
    let activity = ObsessionActivity::parse(&value)
        .ok_or_else(|| text(app, "errors.obsessionActivityUnsupported"))?;
    save(
        app,
        "obsession-activity",
        activity.as_str(),
        |preferences| {
            preferences.obsession_activity = activity;
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
    save(app, "display", &display, |preferences| {
        preferences.display = display.clone()
    })
}
