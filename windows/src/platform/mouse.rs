use std::{io, mem::size_of, ptr::null_mut};
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM},
    UI::{Input::*, WindowsAndMessaging::*},
};

pub struct MouseInput;

impl MouseInput {
    pub fn new(hwnd: HWND) -> io::Result<Self> {
        let device = RAWINPUTDEVICE {
            usUsagePage: 1,
            usUsage: 2,
            dwFlags: RIDEV_INPUTSINK,
            hwndTarget: hwnd,
        };
        // Observe mouse movement/buttons without capture, hooks or suppressing normal input.
        if unsafe { RegisterRawInputDevices(&device, 1, size_of::<RAWINPUTDEVICE>() as u32) } == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(Self)
        }
    }
}

impl Drop for MouseInput {
    fn drop(&mut self) {
        let device = RAWINPUTDEVICE {
            usUsagePage: 1,
            usUsage: 2,
            dwFlags: RIDEV_REMOVE,
            hwndTarget: null_mut(),
        };
        unsafe {
            RegisterRawInputDevices(&device, 1, size_of::<RAWINPUTDEVICE>() as u32);
        }
    }
}

pub struct MousePacket {
    pub pressed: bool,
    pub left_down: bool,
}

pub unsafe fn packet(message: LPARAM) -> Option<MousePacket> {
    unsafe {
        let mut input: RAWINPUT = std::mem::zeroed();
        let mut length = size_of::<RAWINPUT>() as u32;
        let read = GetRawInputData(
            message as HRAWINPUT,
            RID_INPUT,
            (&mut input as *mut RAWINPUT).cast(),
            &mut length,
            size_of::<RAWINPUTHEADER>() as u32,
        );
        if read == u32::MAX
            || read < (size_of::<RAWINPUTHEADER>() + size_of::<RAWMOUSE>()) as u32
            || input.header.dwType != RIM_TYPEMOUSE
        {
            return None;
        }
        let flags = u32::from(input.data.mouse.Anonymous.Anonymous.usButtonFlags);
        Some(MousePacket {
            pressed: flags
                & (RI_MOUSE_BUTTON_1_DOWN
                    | RI_MOUSE_BUTTON_2_DOWN
                    | RI_MOUSE_BUTTON_3_DOWN
                    | RI_MOUSE_BUTTON_4_DOWN
                    | RI_MOUSE_BUTTON_5_DOWN)
                != 0,
            left_down: flags & RI_MOUSE_BUTTON_1_DOWN != 0,
        })
    }
}
