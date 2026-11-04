use serde::{Deserialize, Serialize};
use std::{
    ffi::OsString,
    fs,
    os::windows::ffi::{OsStrExt, OsStringExt},
    path::{Path, PathBuf},
    ptr::null_mut,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
};
use tauri::{Emitter, Manager};
use windows_sys::Win32::{
    Foundation::HWND,
    System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize},
    UI::{
        Controls::Dialogs::{
            CommDlgExtendedError, GetOpenFileNameW, OFN_EXPLORER, OFN_FILEMUSTEXIST,
            OFN_NOCHANGEDIR, OFN_PATHMUSTEXIST, OPENFILENAMEW,
        },
        Shell::{ILCreateFromPathW, ILFree, SHOpenFolderAndSelectItems, ShellExecuteW},
        WindowsAndMessaging::SW_SHOWNORMAL,
    },
};

pub(super) const LIMIT: usize = 128;

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shelf {
    clear_on_startup: bool,
    paths: Vec<String>,
}

struct State {
    storage: Option<PathBuf>,
    shelf: Mutex<Shelf>,
    picking: AtomicBool,
}

pub fn setup(app: &tauri::AppHandle) {
    let storage = app
        .path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("shelf.json"));
    let mut shelf: Shelf = storage
        .as_ref()
        .and_then(|path| fs::read(path).ok())
        .and_then(|data| serde_json::from_slice(&data).ok())
        .unwrap_or_default();
    shelf.paths.truncate(LIMIT);
    if shelf.clear_on_startup {
        shelf.paths.clear();
    }
    app.manage(State {
        storage,
        shelf: Mutex::new(shelf),
        picking: AtomicBool::new(false),
    });
}

fn settings(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "settings" {
        Ok(())
    } else {
        Err("Shelf actions require Settings".into())
    }
}

fn shelf_surface(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        settings(window)
    }
}

fn change(
    app: &tauri::AppHandle,
    edit: impl FnOnce(&mut Shelf) -> Result<(), String>,
) -> Result<Shelf, String> {
    let state = app.state::<State>();
    let mut current = state.shelf.lock().map_err(|error| error.to_string())?;
    let mut next = current.clone();
    edit(&mut next)?;
    let storage = state
        .storage
        .as_ref()
        .ok_or("Missing shelf storage directory")?;
    let directory = storage.parent().ok_or("Missing shelf storage parent")?;
    let temp = storage.with_extension("tmp");
    let data = serde_json::to_vec(&next).map_err(|error| error.to_string())?;
    fs::create_dir_all(directory)
        .and_then(|()| fs::write(&temp, data))
        .and_then(|()| fs::rename(&temp, storage))
        .map_err(|error| error.to_string())?;
    *current = next.clone();
    let _ = app.emit("pivo:shelf", &next);
    Ok(next)
}

#[tauri::command]
pub fn pivo_shelf_get(app: tauri::AppHandle) -> Result<Shelf, String> {
    app.state::<State>()
        .shelf
        .lock()
        .map(|shelf| shelf.clone())
        .map_err(|error| error.to_string())
}

fn choose(owner: HWND) -> Result<Option<String>, String> {
    let mut buffer = vec![0u16; 32768];
    let mut picker = OPENFILENAMEW {
        lStructSize: size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: owner,
        lpstrFile: buffer.as_mut_ptr(),
        nMaxFile: buffer.len() as u32,
        Flags: OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
        ..Default::default()
    };
    if unsafe { GetOpenFileNameW(&mut picker) } == 0 {
        let code = unsafe { CommDlgExtendedError() };
        return if code == 0 {
            Ok(None)
        } else {
            Err(format!("File picker failed ({code:#x})"))
        };
    }
    let len = buffer
        .iter()
        .position(|&unit| unit == 0)
        .ok_or("Invalid file picker result")?;
    let path = OsString::from_wide(&buffer[..len]);
    if !Path::new(&path).is_file() {
        return Err("The chosen file is unavailable".into());
    }
    path.into_string()
        .map(Some)
        .map_err(|_| "Unsupported file name".into())
}

fn add(shelf: &mut Shelf, path: String) -> Result<(), String> {
    if shelf.paths.contains(&path) {
        return Ok(());
    }
    if shelf.paths.len() >= LIMIT {
        return Err("Shelf is full".into());
    }
    shelf.paths.insert(0, path);
    Ok(())
}

pub(super) fn add_dropped(app: &tauri::AppHandle, mut paths: Vec<String>) -> Result<(), String> {
    paths.retain(|path| Path::new(path).is_file());
    if paths.is_empty() {
        return Ok(());
    }
    change(app, |shelf| {
        for path in paths.into_iter().rev() {
            add(shelf, path)?;
        }
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
pub async fn pivo_shelf_add(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Shelf, String> {
    settings(&window)?;
    let owner = window.hwnd().map_err(|error| error.to_string())?.0 as isize;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<State>();
        if state.picking.swap(true, Ordering::AcqRel) {
            return Err("File picker is already open".into());
        }
        let selected = choose(owner as HWND);
        state.picking.store(false, Ordering::Release);
        match selected? {
            Some(path) => change(&app, |shelf| add(shelf, path)),
            None => pivo_shelf_get(app.clone()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn pivo_shelf_remove(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    path: String,
) -> Result<Shelf, String> {
    shelf_surface(&window)?;
    change(&app, |shelf| {
        shelf.paths.retain(|saved| saved != &path);
        Ok(())
    })
}

#[tauri::command]
pub fn pivo_shelf_clear_on_startup(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    enabled: bool,
) -> Result<Shelf, String> {
    settings(&window)?;
    change(&app, |shelf| {
        shelf.clear_on_startup = enabled;
        Ok(())
    })
}

fn shell_open(path: &Path, reveal: bool) -> Result<(), String> {
    if !path.is_absolute() || !path.is_file() {
        return Err("The saved file is unavailable".into());
    }
    let wide: Vec<_> = path.as_os_str().encode_wide().chain([0]).collect();
    if wide[..wide.len() - 1].contains(&0) {
        return Err("Invalid file path".into());
    }
    // Shell handlers and Explorer selection require an initialized COM apartment.
    let init = unsafe { CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32) };
    if init < 0 {
        return Err(format!("Shell initialization failed ({init:#x})"));
    }
    let result = if reveal {
        let item = unsafe { ILCreateFromPathW(wide.as_ptr()) };
        if item.is_null() {
            Err("Explorer could not resolve the saved file".into())
        } else {
            // With no child list, Explorer selects the item in its parent folder.
            let result = unsafe { SHOpenFolderAndSelectItems(item, 0, std::ptr::null(), 0) };
            unsafe { ILFree(item) };
            if result < 0 {
                Err(format!("Explorer selection failed ({result:#x})"))
            } else {
                Ok(())
            }
        }
    } else {
        let result = unsafe {
            ShellExecuteW(
                null_mut(),
                std::ptr::null(),
                wide.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;
        if result > 32 {
            Ok(())
        } else {
            Err(format!("Opening the saved file failed ({result})"))
        }
    };
    unsafe { CoUninitialize() };
    result
}

#[tauri::command]
pub async fn pivo_shelf_open(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    path: String,
    reveal: bool,
) -> Result<(), String> {
    shelf_surface(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        if !pivo_shelf_get(app)?.paths.contains(&path) {
            return Err("File is not on the shelf".into());
        }
        shell_open(Path::new(&path), reveal)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adding_duplicate_does_not_reorder_or_exceed_capacity() {
        let mut shelf = Shelf {
            paths: (0..LIMIT).map(|n| format!("file-{n}")).collect(),
            ..Default::default()
        };
        let before = shelf.paths.clone();
        assert!(add(&mut shelf, "file-42".into()).is_ok());
        assert!(add(&mut shelf, "new-file".into()).is_err());
        assert_eq!(shelf.paths, before);
    }
}
