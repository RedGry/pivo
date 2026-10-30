use std::{io, path::Path, ptr};
use windows_sys::{Win32::System::Registry::*, w};

const RUN_KEY: windows_sys::core::PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");

fn command(executable: &Path) -> Result<String, String> {
    let path = executable
        .to_str()
        .ok_or("The executable path is not valid Unicode")?;
    if path.contains(['"', '\0']) {
        return Err("The executable path contains an invalid character".into());
    }
    Ok(format!("\"{path}\""))
}

pub fn enabled() -> Result<bool, String> {
    let expected = command(&std::env::current_exe().map_err(|error| error.to_string())?)?;
    let mut value = vec![0u16; 32768];
    let mut bytes = (value.len() * 2) as u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            RUN_KEY,
            w!("PivO"),
            RRF_RT_REG_SZ,
            ptr::null_mut(),
            value.as_mut_ptr().cast(),
            &mut bytes,
        )
    };
    if result == 2 {
        return Ok(false);
    }
    if result != 0 {
        return Err(io::Error::from_raw_os_error(result as i32).to_string());
    }
    let end = value
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(value.len());
    Ok(String::from_utf16_lossy(&value[..end]).eq_ignore_ascii_case(&expected))
}

pub fn set(enabled: bool) -> Result<(), String> {
    let command = command(&std::env::current_exe().map_err(|error| error.to_string())?)?;
    let mut key = ptr::null_mut();
    let result = unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            RUN_KEY,
            0,
            ptr::null(),
            0,
            KEY_SET_VALUE,
            ptr::null(),
            &mut key,
            ptr::null_mut(),
        )
    };
    if result != 0 {
        return Err(io::Error::from_raw_os_error(result as i32).to_string());
    }
    let result = unsafe {
        let result = if enabled {
            let value: Vec<u16> = command.encode_utf16().chain(Some(0)).collect();
            RegSetValueExW(
                key,
                w!("PivO"),
                0,
                REG_SZ,
                value.as_ptr().cast(),
                (value.len() * 2) as u32,
            )
        } else {
            RegDeleteValueW(key, w!("PivO"))
        };
        RegCloseKey(key);
        result
    };
    if result == 0 || (!enabled && result == 2) {
        Ok(())
    } else {
        Err(io::Error::from_raw_os_error(result as i32).to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_command_quotes_spaces_without_arguments() {
        assert_eq!(
            command(Path::new(r"C:\Program Files\PivO\pivo.exe")).unwrap(),
            r#""C:\Program Files\PivO\pivo.exe""#
        );
        assert!(command(Path::new("bad\"path.exe")).is_err());
    }
}
