use serde::Serialize;

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub revision: u32,
    pub automatic: bool,
    pub installed: bool,
    pub busy: bool,
    pub version: Option<String>,
    pub notes: String,
    pub message: String,
    pub detail: String,
    pub progress: Option<u8>,
    pub deferred: bool,
}

impl UpdateStatus {
    pub fn changed(&mut self) {
        self.revision = self.revision.wrapping_add(1);
    }
    pub fn actionable(&self) -> bool {
        self.installed && self.version.is_some() && !self.busy && !self.deferred
    }
    pub fn begin(&mut self) -> bool {
        if self.busy {
            return false;
        }
        self.changed();
        self.busy = true;
        self.progress = None;
        self.detail.clear();
        true
    }
    pub fn later(&mut self) {
        if !self.busy {
            self.changed();
            self.deferred = true;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn portable_busy_and_deferred_updates_cannot_be_installed() {
        let mut status = UpdateStatus {
            version: Some("0.2.0".into()),
            ..Default::default()
        };
        assert!(!status.actionable());
        status.installed = true;
        assert!(status.actionable());
        assert!(status.begin());
        assert!(!status.begin());
        assert!(!status.actionable());
        status.later();
        assert!(!status.deferred);
        status.busy = false;
        status.later();
        assert!(!status.actionable());
        status.deferred = false;
        assert!(status.actionable());
    }
}

pub fn matches_install_location(executable_directory: &str, registered_location: &str) -> bool {
    let normalize = |path: &str| {
        path.trim_matches('"')
            .replace('/', "\\")
            .trim_end_matches('\\')
            .to_lowercase()
    };
    !registered_location.is_empty()
        && normalize(executable_directory) == normalize(registered_location)
}

#[cfg(test)]
mod install_tests {
    use super::*;
    #[test]
    fn registered_install_accepts_custom_location_but_rejects_portable_copy() {
        assert!(matches_install_location(
            r"C:\Users\User\AppData\Local\PivO",
            r#""C:\Users\User\AppData\Local\PivO""#
        ));
        assert!(matches_install_location(
            r"D:\Tools\PivO",
            r#""d:\tools\pivo\""#
        ));
        assert!(!matches_install_location(
            r"D:\Portable\PivO",
            r#""D:\Tools\PivO""#
        ));
        assert!(!matches_install_location(r"D:\Tools\PivO", ""));
    }
}
