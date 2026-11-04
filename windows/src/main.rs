#![cfg_attr(windows, windows_subsystem = "windows")]

mod app;
#[cfg(windows)]
mod platform;

#[cfg(windows)]
use std::sync::Mutex;

#[cfg(windows)]
#[tauri::command]
async fn pivo_ready(app: tauri::AppHandle) -> Result<app::ViewState, String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    let main_app = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(platform::ready(&main_app));
    })
    .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .map_err(|error| error.to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_plugin_controls(
    app: tauri::AppHandle,
    mask: u16,
    revision: u32,
    music: bool,
    lyrics: bool,
    shelf: bool,
    shelf_enabled: bool,
) -> Result<(), String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    let main_app = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(platform::plugin_controls(
            &main_app,
            mask,
            revision,
            music,
            lyrics,
            shelf,
            shelf_enabled,
        ));
    })
    .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .map_err(|error| error.to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_presented(
    app: tauri::AppHandle,
    transition_id: u32,
    presentation: app::Presentation,
) -> Result<bool, String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    let main_app = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(platform::presented(&main_app, transition_id, presentation));
    })
    .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .map_err(|error| error.to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_update_revealed(
    app: tauri::AppHandle,
    revision: u32,
    transition_id: u32,
) -> Result<bool, String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    let main_app = app.clone();
    app.run_on_main_thread(move || {
        let _ = sender.send(platform::update_revealed(
            &main_app,
            revision,
            transition_id,
        ));
    })
    .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .map_err(|error| error.to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(windows)]
#[tauri::command]
fn pivo_exit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(windows)]
#[tauri::command]
fn pivo_settings_section() -> Option<String> {
    platform::settings::requested_section()
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_open_widget(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    widget: String,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Widget shortcuts belong to the island".into());
    }
    platform::settings::open_widget(&app, &widget)
}

#[cfg(windows)]
#[tauri::command]
fn pivo_update_status(app: tauri::AppHandle) -> app::update::UpdateStatus {
    platform::update::status(&app)
}

#[cfg(windows)]
#[tauri::command]
fn pivo_get_preferences(app: tauri::AppHandle) -> platform::preferences::Preferences {
    platform::preferences::get(&app)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_locale(
    app: tauri::AppHandle,
    locale: String,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_locale(&app, locale)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_theme(
    app: tauri::AppHandle,
    theme: String,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_theme(&app, theme)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_compact_mode(
    app: tauri::AppHandle,
    compact_mode: String,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_compact_mode(&app, compact_mode)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_island_scale(
    app: tauri::AppHandle,
    island_scale: String,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_island_scale(&app, island_scale)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_minimal_strip(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_minimal_strip(&app, enabled)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_compact_target(app: tauri::AppHandle, minimal: bool) -> Result<(), String> {
    app.clone()
        .run_on_main_thread(move || platform::compact_target(&app, minimal))
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_mascot(
    app: tauri::AppHandle,
    size: app::preferences::MascotSize,
    motion: bool,
    hat: bool,
    scarf: bool,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_mascot(&app, size, motion, hat, scarf)
}

#[cfg(windows)]
#[tauri::command]
fn pivo_set_prop_skin(
    app: tauri::AppHandle,
    prop: app::preferences::MascotProp,
    skin: app::preferences::PropSkin,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_prop_skin(&app, prop, skin)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_holidays(
    app: tauri::AppHandle,
    outfit: app::preferences::HolidayMode,
    appearance: app::preferences::HolidayMode,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_holidays(&app, outfit, appearance)
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_holiday_variant(
    app: tauri::AppHandle,
    occasion: String,
    variant: app::preferences::PropSkin,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_holiday_variant(&app, occasion, variant)
}

#[cfg(windows)]
#[tauri::command]
fn pivo_get_displays() -> Result<Vec<app::displays::Display>, String> {
    platform::displays::list()
}

#[cfg(windows)]
#[tauri::command]
async fn pivo_set_display(
    app: tauri::AppHandle,
    display: String,
) -> Result<platform::preferences::Preferences, String> {
    platform::preferences::set_display(&app, display)
}

#[cfg(windows)]
#[tauri::command]
fn pivo_set_automatic_updates(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    platform::update::set_automatic(&app, enabled)
}

#[cfg(windows)]
#[tauri::command]
fn pivo_check_updates(app: tauri::AppHandle) {
    platform::update::check(&app);
}

#[cfg(windows)]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Mutex::new(app::Companion::default()))
        .invoke_handler(tauri::generate_handler![
            pivo_ready,
            pivo_presented,
            pivo_plugin_controls,
            pivo_exit,
            pivo_settings_section,
            platform::settings::pivo_open_about_link,
            pivo_open_widget,
            platform::media::pivo_media_snapshot,
            platform::media::pivo_media_action,
            platform::media::pivo_media_seek,
            platform::media::pivo_align_lyrics,
            platform::media::pivo_cancel_lyric_alignment,
            platform::hud::pivo_hud_snapshot,
            platform::hud::pivo_keyboard_status,
            platform::shelf::pivo_shelf_get,
            platform::shelf::pivo_shelf_add,
            platform::shelf::pivo_shelf_remove,
            platform::shelf::pivo_shelf_clear_on_startup,
            platform::shelf::pivo_shelf_open,
            pivo_update_status,
            pivo_update_revealed,
            pivo_get_preferences,
            pivo_set_locale,
            pivo_set_theme,
            pivo_set_compact_mode,
            pivo_set_island_scale,
            pivo_set_minimal_strip,
            pivo_compact_target,
            pivo_set_mascot,
            pivo_set_prop_skin,
            pivo_set_holidays,
            pivo_set_holiday_variant,
            pivo_get_displays,
            pivo_set_display,
            pivo_set_automatic_updates,
            pivo_check_updates
        ])
        .setup(|app| {
            platform::preferences::setup(app.handle())?;
            platform::update::setup(app.handle())?;
            platform::shelf::setup(app.handle());
            platform::install(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("PivO could not start");
}

#[cfg(not(windows))]
fn main() {
    eprintln!("This prototype requires Windows.");
}
