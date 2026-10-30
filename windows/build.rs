use std::{env, fs, path::PathBuf};

fn main() {
    let locales = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("../locales");
    println!("cargo:rerun-if-changed={}", locales.display());
    let mut files: Vec<_> = fs::read_dir(&locales)
        .expect("Shared locale directory is missing")
        .map(|entry| entry.expect("Cannot read shared locale entry").path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .collect();
    files.sort();
    let mut source = String::from("pub const SOURCES: &[(&str, &str)] = &[\n");
    for file in files {
        let id = file
            .file_stem()
            .and_then(|name| name.to_str())
            .expect("Locale filename must be UTF-8");
        assert!(
            !id.is_empty()
                && id.len() <= 32
                && id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-'),
            "Invalid locale identifier"
        );
        let path = file
            .canonicalize()
            .expect("Cannot resolve shared locale file");
        source.push_str(&format!(
            "({id:?}, include_str!({:?})),\n",
            path.to_str().expect("Locale path must be UTF-8")
        ));
    }
    source.push_str("];\n");
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("locales.rs"),
        source,
    )
    .expect("Cannot generate shared locale list");
    tauri_build::build();
}
