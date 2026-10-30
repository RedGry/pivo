use serde::Deserialize;
use std::collections::BTreeMap;

include!(concat!(env!("OUT_DIR"), "/locales.rs"));

#[derive(Deserialize)]
struct Locale {
    name: String,
    messages: BTreeMap<String, String>,
}

pub struct Catalog(BTreeMap<String, Locale>);

impl Catalog {
    pub fn embedded() -> Result<Self, String> {
        Self::parse(SOURCES)
    }
    fn parse(sources: &[(&str, &str)]) -> Result<Self, String> {
        let mut locales = BTreeMap::new();
        for (id, source) in sources {
            if id.is_empty()
                || id.len() > 32
                || !id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
            {
                return Err(format!("Invalid locale identifier {id}"));
            }
            let locale: Locale = serde_json::from_str(source)
                .map_err(|error| format!("Invalid locale {id}: {error}"))?;
            if locale.name.trim().is_empty() || locales.insert((*id).to_owned(), locale).is_some() {
                return Err(format!("Invalid or duplicate locale {id}"));
            }
        }
        if !locales.contains_key("en") {
            return Err("English fallback locale is missing".into());
        }
        Ok(Self(locales))
    }
    pub fn contains(&self, locale: &str) -> bool {
        self.0.contains_key(locale)
    }
    pub fn resolve<'a>(&'a self, locale: &'a str) -> &'a str {
        if self.contains(locale) { locale } else { "en" }
    }
    pub fn message<'a>(&'a self, locale: &str, key: &'a str) -> &'a str {
        self.0
            .get(locale)
            .and_then(|locale| locale.messages.get(key))
            .or_else(|| self.0["en"].messages.get(key))
            .map(String::as_str)
            .unwrap_or(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const EN: &str = r#"{"name":"English","messages":{"title":"Settings","fallback":"Fallback"}}"#;
    const RU: &str = r#"{"name":"Second language","messages":{"title":"Localized settings"}}"#;
    #[test]
    fn locale_and_message_fallback_do_not_accept_unknown_preferences() {
        let catalog = Catalog::parse(&[("en", EN), ("ru", RU)]).unwrap();
        assert_eq!(catalog.message("ru", "title"), "Localized settings");
        assert_eq!(catalog.message("ru", "fallback"), "Fallback");
        assert_eq!(catalog.message("unknown", "title"), "Settings");
        assert_eq!(catalog.message("ru", "missing"), "missing");
        assert_eq!(catalog.resolve("unknown"), "en");
        assert!(!catalog.contains("../ru"));
        assert!(catalog.contains("ru"));
    }
    #[test]
    fn malformed_missing_english_and_duplicate_catalogs_are_rejected() {
        assert!(Catalog::parse(&[("ru", RU)]).is_err());
        assert!(Catalog::parse(&[("en", "{}")]).is_err());
        assert!(Catalog::parse(&[("en", EN), ("en", EN)]).is_err());
        assert!(Catalog::parse(&[("en", EN), ("../ru", RU)]).is_err());
    }
}
