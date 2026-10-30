#[path = "autostart.rs"]
mod autostart;

use super::preferences::text;
use crate::app::update::UpdateStatus;
use std::{
    path::PathBuf,
    sync::{Mutex, MutexGuard},
    time::Duration,
};
use tauri::{
    Emitter, Manager,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_updater::{Update, UpdaterExt};

struct Updates {
    status: UpdateStatus,
    pending: Option<Update>,
    menu: Option<TrayItems>,
}
#[derive(Clone)]
struct TrayItems {
    labels: Vec<(MenuItem<tauri::Wry>, &'static str)>,
    autostart: CheckMenuItem<tauri::Wry>,
}

pub fn localize(app: &tauri::AppHandle) {
    let items = state(app).menu.clone();
    if let Some(items) = items {
        for (item, key) in items.labels {
            let _ = item.set_text(text(app, key));
        }
        let _ = items.autostart.set_text(text(app, "tray.autostart"));
    }
    tooltip(app);
}

fn tooltip(app: &tauri::AppHandle) {
    let status = status(app);
    if let Some(tray) = app.tray_by_id("pivo") {
        let message = text(app, &status.message)
            .replace("{version}", status.version.as_deref().unwrap_or_default());
        let _ = tray.set_tooltip(Some(format!("{} — {message}", text(app, "app.name"))));
    }
}

fn state(app: &tauri::AppHandle) -> MutexGuard<'_, Updates> {
    app.state::<Mutex<Updates>>()
        .inner()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}
pub fn status(app: &tauri::AppHandle) -> UpdateStatus {
    state(app).status.clone()
}
fn preference_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("automatic-updates"))
        .map_err(|e| e.to_string())
}
fn installed() -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Some(dir) = exe.parent() else {
        return false;
    };
    let mut location = vec![0u16; 32768];
    let mut size = (location.len() * 2) as u32;
    let result = unsafe {
        use windows_sys::{Win32::System::Registry::*, w};
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PivO"),
            w!("InstallLocation"),
            RRF_RT_REG_SZ,
            std::ptr::null_mut(),
            location.as_mut_ptr().cast(),
            &mut size,
        )
    };
    if result != 0 {
        return false;
    }
    let end = location
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(location.len());
    crate::app::update::matches_install_location(
        &dir.to_string_lossy(),
        &String::from_utf16_lossy(&location[..end]),
    ) && dir.join("uninstall.exe").is_file()
}
fn publish(app: &tauri::AppHandle) {
    let status = status(app);
    let _ = app.emit("pivo:update", &status);
    tooltip(app);
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let _ = super::refresh_controls(&handle);
    });
}
fn fail(app: &tauri::AppHandle, key: &str, detail: String) {
    let mut s = state(app);
    s.status.changed();
    s.status.busy = false;
    s.status.progress = None;
    s.status.message = key.into();
    s.status.detail = detail;
    drop(s);
    publish(app);
}
pub fn check(app: &tauri::AppHandle) {
    {
        let mut s = state(app);
        if !s.status.begin() {
            return;
        }
        s.status.message = "updates.checking".into();
    }
    publish(app);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = async {
            app.updater_builder()
                .timeout(Duration::from_secs(30))
                .build()?
                .check()
                .await
        }
        .await;
        match result {
            Ok(update) => {
                let mut s = state(&app);
                s.status.changed();
                let same = update.as_ref().map(|u| &u.version) == s.status.version.as_ref();
                s.status.version = update.as_ref().map(|u| u.version.clone());
                s.status.notes = update
                    .as_ref()
                    .and_then(|u| u.body.clone())
                    .unwrap_or_default();
                if !same {
                    s.status.deferred = false;
                }
                s.status.message = if s.status.version.is_some() {
                    if s.status.installed {
                        "updates.available"
                    } else {
                        "updates.portableAvailable"
                    }
                } else {
                    "updates.upToDate"
                }
                .into();
                s.status.detail.clear();
                s.status.busy = false;
                s.pending = update;
                drop(s);
                publish(&app);
            }
            Err(e) => fail(&app, "updates.checkFailed", e.to_string()),
        }
    });
}
pub fn later(app: &tauri::AppHandle, revision: Option<u32>) {
    {
        let mut s = state(app);
        if revision.is_some_and(|revision| revision != s.status.revision) {
            return;
        }
        s.status.later();
    }
    publish(app);
}
pub fn install_update(app: &tauri::AppHandle, revision: Option<u32>) {
    let update = {
        let mut s = state(app);
        // Installation must never bypass installed-release detection.
        if revision.is_some_and(|revision| revision != s.status.revision)
            || !s.status.installed
            || s.status.busy
        {
            return;
        }
        let Some(update) = s.pending.clone() else {
            return;
        };
        s.status.deferred = false;
        s.status.begin();
        s.status.message = "updates.downloading".into();
        update
    };
    publish(app);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut received = 0u64;
        let result = update
            .download(
                |chunk, total| {
                    received = received.saturating_add(chunk as u64);
                    let progress = total
                        .filter(|v| *v > 0)
                        .map(|v| ((received.saturating_mul(100) / v).min(100)) as u8);
                    let mut s = state(&app);
                    if progress != s.status.progress {
                        s.status.changed();
                        s.status.progress = progress;
                        drop(s);
                        publish(&app);
                    }
                },
                || {},
            )
            .await;
        match result {
            Ok(bytes) => {
                {
                    let mut s = state(&app);
                    s.status.changed();
                    s.status.message = "updates.installing".into();
                }
                publish(&app);
                let installer_app = app.clone();
                // Installation exits Windows only after signature verification and successful launch.
                let result =
                    tauri::async_runtime::spawn_blocking(move || update.install(bytes)).await;
                match result {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => fail(&installer_app, "updates.installFailed", e.to_string()),
                    Err(e) => fail(&installer_app, "updates.installFailed", e.to_string()),
                }
            }
            Err(e) => fail(&app, "updates.downloadFailed", e.to_string()),
        }
    });
}
pub fn set_automatic(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let result = preference_path(app).and_then(|path| {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        std::fs::write(path, if enabled { "enabled" } else { "disabled" })
            .map_err(|error| error.to_string())
    });
    if let Err(error) = result {
        return Err(format!(
            "{}: {error}",
            text(app, "updates.preferenceFailed")
        ));
    }
    {
        let mut state = state(app);
        state.status.changed();
        state.status.automatic = enabled;
    }
    publish(app);
    if enabled {
        check(app);
    }
    Ok(())
}

pub fn setup(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let automatic = preference_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .is_some_and(|s| s == "enabled");
    app.manage(Mutex::new(Updates {
        status: UpdateStatus {
            automatic,
            installed: installed(),
            message: "updates.idle".into(),
            ..Default::default()
        },
        pending: None,
        menu: None,
    }));
    let settings_item = MenuItem::with_id(
        app,
        "settings",
        text(app, "tray.settings"),
        true,
        None::<&str>,
    )?;
    let check_item = MenuItem::with_id(
        app,
        "check",
        text(app, "tray.checkUpdates"),
        true,
        None::<&str>,
    )?;
    let about_item = MenuItem::with_id(app, "about", text(app, "tray.about"), true, None::<&str>)?;
    let auto_item = CheckMenuItem::with_id(
        app,
        "autostart",
        text(app, "tray.autostart"),
        true,
        autostart::enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", text(app, "tray.quit"), true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &auto_item,
            &settings_item,
            &separator,
            &about_item,
            &check_item,
            &quit_item,
        ],
    )?;
    state(app).menu = Some(TrayItems {
        labels: vec![
            (settings_item, "tray.settings"),
            (check_item, "tray.checkUpdates"),
            (about_item, "tray.about"),
            (quit_item, "tray.quit"),
        ],
        autostart: auto_item,
    });
    let mut tray = TrayIconBuilder::with_id("pivo")
        .tooltip(text(app, "app.name"))
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "settings" => {
                let _ = super::settings::open(app);
            }
            "check" => check(app),
            "about" => {
                let _ = super::settings::open_about(app);
            }
            "quit" => app.exit(0),
            "autostart" => toggle_autostart(app),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    localize(app);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if automatic {
            check(&app);
        }
        loop {
            tokio::time::sleep(Duration::from_secs(6 * 3600)).await;
            if status(&app).automatic {
                check(&app);
            }
        }
    });
    Ok(())
}

fn toggle_autostart(app: &tauri::AppHandle) {
    let result = autostart::enabled().and_then(|enabled| autostart::set(!enabled));
    if let Some(items) = state(app).menu.clone() {
        let _ = items
            .autostart
            .set_checked(autostart::enabled().unwrap_or(false));
    }
    if let Err(error) = result {
        eprintln!("Unable to change Windows startup: {error}");
        let message: Vec<u16> = text(app, "errors.autostartFailed")
            .encode_utf16()
            .chain(Some(0))
            .collect();
        unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::MessageBoxW(
                std::ptr::null_mut(),
                message.as_ptr(),
                windows_sys::w!("PivO"),
                windows_sys::Win32::UI::WindowsAndMessaging::MB_OK
                    | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONERROR,
            );
        }
    }
}
