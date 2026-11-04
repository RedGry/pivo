use std::{cell::Cell, ffi::OsString, os::windows::ffi::OsStringExt, ptr::null_mut, rc::Rc};
use tauri::Emitter;
use windows::{
    Win32::{
        Foundation::{HWND, POINTL, S_OK},
        System::{
            Com::{DVASPECT_CONTENT, FORMATETC, IDataObject, TYMED_HGLOBAL},
            Ole::{
                CF_HDROP, DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE, IDropTarget,
                IDropTarget_Impl, OleInitialize, OleUninitialize, RegisterDragDrop,
                ReleaseStgMedium, RevokeDragDrop,
            },
            SystemServices::MODIFIERKEYS_FLAGS,
        },
        UI::Shell::{DragQueryFileW, HDROP},
    },
    core::{Ref, implement},
};

pub const BOUNDS: crate::app::geometry::Rect = crate::app::geometry::Rect {
    left: 127,
    top: 36,
    width: 308,
    height: 92,
};

pub struct Registration {
    window: HWND,
    active: Rc<Cell<bool>>,
}

impl Registration {
    pub fn new(
        window: windows_sys::Win32::Foundation::HWND,
        app: tauri::AppHandle,
    ) -> windows::core::Result<Self> {
        let window = HWND(window);
        let active = Rc::new(Cell::new(false));
        unsafe {
            OleInitialize(None)?;
            let target: IDropTarget = ShelfDrop {
                window,
                app,
                accepts: active.clone(),
            }
            .into();
            if let Err(error) = RegisterDragDrop(window, &target) {
                OleUninitialize();
                return Err(error);
            }
        }
        Ok(Self { window, active })
    }

    pub fn active(&self) -> bool {
        self.active.get()
    }

    pub fn cancel(&self) {
        self.active.set(false);
    }
}

impl Drop for Registration {
    fn drop(&mut self) {
        unsafe {
            let _ = RevokeDragDrop(self.window);
            OleUninitialize();
        }
    }
}

fn file_format() -> FORMATETC {
    FORMATETC {
        cfFormat: CF_HDROP.0,
        ptd: null_mut(),
        dwAspect: DVASPECT_CONTENT.0,
        lindex: -1,
        tymed: TYMED_HGLOBAL.0 as u32,
    }
}

#[implement(IDropTarget)]
struct ShelfDrop {
    window: HWND,
    app: tauri::AppHandle,
    accepts: Rc<Cell<bool>>,
}

impl ShelfDrop {
    fn finished(&self) {
        use windows_sys::Win32::UI::WindowsAndMessaging::{GW_OWNER, GetWindow, PostMessageW};
        unsafe {
            PostMessageW(
                GetWindow(self.window.0, GW_OWNER),
                super::SHELF_DRAG_FINISHED,
                0,
                0,
            );
        }
    }

    fn visible(&self) -> bool {
        unsafe { windows_sys::Win32::UI::WindowsAndMessaging::IsWindowVisible(self.window.0) != 0 }
    }
}

fn copy_effect(effect: *mut DROPEFFECT, accepts: bool) -> bool {
    let Some(effect) = (unsafe { effect.as_mut() }) else {
        return false;
    };
    let copy = accepts && (*effect & DROPEFFECT_COPY) == DROPEFFECT_COPY;
    *effect = if copy {
        DROPEFFECT_COPY
    } else {
        DROPEFFECT_NONE
    };
    copy
}

fn files(data: &IDataObject) -> Vec<String> {
    unsafe {
        let Ok(mut medium) = data.GetData(&file_format()) else {
            return Vec::new();
        };
        let handle = HDROP(medium.u.hGlobal.0);
        let count = DragQueryFileW(handle, u32::MAX, None).min(super::shelf::LIMIT as u32);
        let mut paths = Vec::new();
        for index in 0..count {
            let len = DragQueryFileW(handle, index, None) as usize;
            if len == 0 {
                continue;
            }
            let mut buffer = vec![0; len + 1];
            let written = DragQueryFileW(handle, index, Some(&mut buffer)) as usize;
            if written != 0
                && let Ok(path) = OsString::from_wide(&buffer[..written]).into_string()
            {
                paths.push(path);
            }
        }
        ReleaseStgMedium(&mut medium);
        paths
    }
}

#[allow(non_snake_case)]
impl IDropTarget_Impl for ShelfDrop_Impl {
    fn DragEnter(
        &self,
        data: Ref<'_, IDataObject>,
        _: MODIFIERKEYS_FLAGS,
        _: &POINTL,
        effect: *mut DROPEFFECT,
    ) -> windows::core::Result<()> {
        let file = self.visible()
            && data
                .as_ref()
                .is_some_and(|data| unsafe { data.QueryGetData(&file_format()) == S_OK });
        let accepts = copy_effect(effect, file);
        self.accepts.set(accepts);
        if accepts {
            let _ = self.app.emit("pivo:shelf-drag-enter", ());
        }
        Ok(())
    }

    fn DragOver(
        &self,
        _: MODIFIERKEYS_FLAGS,
        _: &POINTL,
        effect: *mut DROPEFFECT,
    ) -> windows::core::Result<()> {
        copy_effect(effect, self.accepts.get() && self.visible());
        Ok(())
    }

    fn DragLeave(&self) -> windows::core::Result<()> {
        self.accepts.set(false);
        self.finished();
        Ok(())
    }

    fn Drop(
        &self,
        data: Ref<'_, IDataObject>,
        _: MODIFIERKEYS_FLAGS,
        _: &POINTL,
        effect: *mut DROPEFFECT,
    ) -> windows::core::Result<()> {
        let accepted = self.accepts.replace(false) && self.visible();
        self.finished();
        let paths = if accepted {
            data.as_ref().map_or_else(Vec::new, files)
        } else {
            Vec::new()
        };
        if copy_effect(effect, !paths.is_empty()) {
            let app = self.app.clone();
            drop(tauri::async_runtime::spawn_blocking(move || {
                if let Err(error) = super::shelf::add_dropped(&app, paths) {
                    eprintln!("Unable to store dropped files: {error}");
                }
            }));
        }
        Ok(())
    }
}
#[cfg(test)]
#[test]
fn only_copyable_files_offer_a_drop_effect() {
    use windows::Win32::System::Ole::DROPEFFECT_MOVE;

    let mut effect = DROPEFFECT_COPY | DROPEFFECT_MOVE;
    assert!(!copy_effect(&mut effect, false));
    assert_eq!(effect, DROPEFFECT_NONE);
    effect = DROPEFFECT_MOVE;
    assert!(!copy_effect(&mut effect, true));
    assert_eq!(effect, DROPEFFECT_NONE);
    effect = DROPEFFECT_COPY | DROPEFFECT_MOVE;
    assert!(copy_effect(&mut effect, true));
    assert_eq!(effect, DROPEFFECT_COPY);
}
