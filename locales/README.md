# Localization

Each locale is one UTF-8 JSON file named after its language tag, for example `en.json`, `ru.json` or `pt-BR.json`. `name` is the language's own display name; `messages` maps stable English keys to translated text.

To add a language, copy `en.json`, translate its values and rebuild the app. Both the frontend and Rust build discover JSON files in this directory automatically. No language registry or duplicated native translation table needs editing. Keep keys unchanged; preserve placeholders such as `{version}`. Missing messages fall back to English, and an unavailable saved locale falls back to `en`.

Application code, identifiers, comments and documentation remain English. Translated message values and language display names are the intentional exception.

Run `npm --prefix windows/frontend test` to check catalogs, placeholders and fallback behavior. These interface translations are part of the MIT-licensed code, rather than reserved mascot artwork.
