use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

static CREATING: AtomicBool = AtomicBool::new(false);
static ABOUT_REQUESTED: AtomicBool = AtomicBool::new(false);
struct Creation;
impl Drop for Creation {
    fn drop(&mut self) {
        CREATING.store(false, Ordering::Release);
    }
}

fn native_theme(theme: crate::app::preferences::Theme) -> Option<tauri::Theme> {
    match theme {
        crate::app::preferences::Theme::System => None,
        crate::app::preferences::Theme::Light => Some(tauri::Theme::Light),
        crate::app::preferences::Theme::Dark => Some(tauri::Theme::Dark),
    }
}

pub fn apply_preferences(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_title(&super::preferences::text(app, "settings.title"));
        let _ = window.set_theme(native_theme(super::preferences::get(app).theme));
    }
}

// Only a deliberate gear or tray action requests settings focus.
pub fn open(app: &tauri::AppHandle) -> Result<(), String> {
    open_section(app, false)
}

pub fn open_about(app: &tauri::AppHandle) -> Result<(), String> {
    ABOUT_REQUESTED.store(true, Ordering::Release);
    open_section(app, true)
}

// The frontend consumes this after subscribing, so requests during WebView startup survive.
pub fn requested_section() -> Option<String> {
    ABOUT_REQUESTED
        .swap(false, Ordering::AcqRel)
        .then(|| "about".into())
}

fn open_section(app: &tauri::AppHandle, about: bool) -> Result<(), String> {
    if CREATING.load(Ordering::Acquire) {
        return Ok(());
    }
    if let Some(window) = app.get_webview_window("settings") {
        if about {
            let _ = window.emit("pivo:settings-section", "about");
        }
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        return window.set_focus().map_err(|error| error.to_string());
    }
    if CREATING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Ok(());
    }
    let creation = Creation;
    let app = app.clone();
    // WebView2 creation must leave the native event stack on Windows.
    tauri::async_runtime::spawn_blocking(move || {
        let _creation = creation;
        let result = WebviewWindowBuilder::new(
            &app,
            "settings",
            WebviewUrl::App(
                if about {
                    "settings.html#about"
                } else {
                    "settings.html"
                }
                .into(),
            ),
        )
        .title(super::preferences::text(&app, "settings.title"))
        .window_classname("PivO.Settings")
        .inner_size(860.0, 640.0)
        .min_inner_size(720.0, 520.0)
        .resizable(true)
        .decorations(false)
        .shadow(true)
        .theme(native_theme(super::preferences::get(&app).theme))
        .center()
        .build();
        match result {
            Ok(window) => {
                window.on_window_event(|event| {
                    if matches!(
                        event,
                        tauri::WindowEvent::Moved(_)
                            | tauri::WindowEvent::Resized(_)
                            | tauri::WindowEvent::Destroyed
                            | tauri::WindowEvent::CloseRequested { .. }
                            | tauri::WindowEvent::Focused(_)
                            | tauri::WindowEvent::ScaleFactorChanged { .. }
                    ) {
                        super::visibility::notify();
                    }
                });
                apply_preferences(&app);
                super::visibility::notify();
                let _ = window.set_focus();
            }
            Err(error) => eprintln!("Could not create the settings window: {error}"),
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn about_request_survives_startup_and_is_consumed_once() {
        ABOUT_REQUESTED.store(true, Ordering::Release);
        assert_eq!(requested_section().as_deref(), Some("about"));
        assert_eq!(requested_section(), None);
    }
}
