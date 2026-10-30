# Island plugins

PivO supports version 1 declarative plugins. The bundled Pomodoro and imported timer plugins use the same timer renderer and actions. Information plugins display a short text card. Settings > Plugins presents tiles with name, description, author and connection toggle, imports a local JSON file and removes imported pages. Settings > Island controls the order of enabled pages separately. Preferences and timer deadlines persist in the local WebView profile and synchronize between Settings and the island. Disabling a timer hides its page; elapsed time continues until it is paused. No background frame loop or hidden timer tick is required.

## Build a plugin

Copy either example in `examples/plugins/`, give it a unique ID and import the JSON file in Settings. No rebuild is required. A timer supports Start/Pause and switching between its focus and break durations. Settings provides a Reset button which stops the timer and restores the current mode's full duration. Previous/Next switches enabled pages. An information card uses Next and Reset (return to the first page).

```json
{
  "schemaVersion": 1,
  "id": "your-name.stretch",
  "name": { "en": "Stretch" },
  "kind": "timer",
  "seconds": 3600,
  "breakSeconds": 60
}
```

Required common fields: `schemaVersion` exactly `1`, `id` matching `[a-z][a-z0-9.-]{2,63}`, localized `name`, and `kind` equal to `timer` or `information`. The `pivo.` ID prefix belongs to bundled plugins. IDs must be unique; remove an imported plugin before installing its replacement.

Optional `description` uses the same localized text rules as `name`. Optional `author` is a nonempty string up to 80 characters; surrounding whitespace is trimmed. Legacy manifests without metadata display neutral localized fallbacks. The built-in description comes from PivO's locale catalog. All metadata renders as plain text.

Optional `icon` sets the plugin's icon in its manager tile and island header. Use `{ "type": "emoji", "value": "🧘" }` for one emoji grapheme (at most 32 UTF-16 code units), or `{ "type": "png", "data": "data:image/png;base64,..." }` for a canonical inline PNG data URI. PNGs must be static, at most 32 KiB decoded and between 1 and 256 pixels in each dimension. SVGs, external URLs and animated PNGs are rejected. Legacy plugins without icons receive a timer or information fallback. The bundled Pomodoro supplies its own tomato icon through the same manifest property.

Timer plugins require integer `seconds` and `breakSeconds` between 1 and 86400. Information plugins require localized `text`. Localized values map language tags to nonempty strings (500 characters maximum each, at most 40 languages). English (`en`) is required as fallback. Language matching tries the selected tag, its base language, then English.

Import limits are 64 KiB per manifest and 30 installed pages. Imported content renders as text, never HTML. Unknown properties are discarded. This version grants no filesystem, network, process, JavaScript or native command permissions. It cannot implement music integrations, device events or arbitrary custom layouts; those need separately designed host capabilities. No plugin marketplace, executable plugin API or version upgrade mechanism is included.

The island remains nonactivating. Native button surfaces dispatch only the four fixed action names; decorative card areas pass input to underlying applications. Timer progression uses absolute timestamps so restart and sleep resume reconcile elapsed time. Adjusting the system clock also adjusts active timer deadlines.

The active enabled plugin supplies compact progress through `pluginProgress(entry, now)`. All timer plugins report the elapsed fraction of their current focus/break mode using configured durations: idle and reset are 0, paused values remain fixed, and completed timers are 1. The host clamps the result to 0–1. Information pages and an empty plugin selection supply no progress. The compact ring renders the remaining fraction, 1 minus this elapsed progress: full at idle/reset, empty at completion and fixed while paused. It follows the shared contract rather than a particular plugin ID. Timer ticks run only while the expanded card or compact progress is visible; Eyes, hidden windows and hidden documents do not keep a progress timer running.

## Plugin settings

An optional `settings` array declares up to 12 fields. PivO builds their controls inside a collapsed Settings disclosure in each plugin tile, including disabled plugins. Disclosures remain open or closed across live rerenders while the window is open. Timer Reset is inside this disclosure as well. Labels use the same localized map and English fallback as plugin names. The bundled Pomodoro uses the same field renderer with labels from the shared PivO locale catalog. Its focus and break durations are editable in minutes. Ordering controls appear only under Island; they swap adjacent enabled pages while preserving disabled plugin slots and timer state.

Each field needs a unique `key` matching `[a-z][a-z0-9_]{0,31}`. `constructor`, `prototype`, and `__proto__` are reserved. Supported field types are deliberately bounded:

- `number` on timer plugins: `bind` must be `seconds` or `breakSeconds`; `unit` is `seconds` or `minutes`; `min`, `max`, and `default` are integers. The minimum is at least 1; the maximum converted to seconds is at most 86400. The default must be inside the range. Each timer duration may have only one field binding.
- `text` on information plugins: `bind` must be `text`; `default` is a string; `maxLength` is an integer from 1 to 500. Use `{key}` in localized card text to interpolate the field value. All placeholders must refer to declared fields. The substituted text renders literally, including HTML characters.

Timer example:

```json
"settings": [
  {
    "key": "focus",
    "type": "number",
    "bind": "seconds",
    "unit": "minutes",
    "label": { "en": "Focus duration (minutes)" },
    "default": 25,
    "min": 1,
    "max": 180
  }
]
```

Field defaults supply the effective duration when no user value is saved, overriding the matching manifest duration. Without fields, the original `seconds` and `breakSeconds` continue to work. See both examples for complete configurable manifests.

Save settings applies validated values to that plugin only. A changed timer duration stops its active countdown and resets the current focus/break mode to its full configured duration, even if the other mode's duration changed. Saving unchanged durations preserves the running deadline. Configuration saves preserve page selection, plugin order, enabled state and other plugins' timers. The Reset action uses configured durations. Information settings update card text immediately. Draft edits remain local to the Settings form until Save settings is clicked.

Saved values persist in the existing plugin store and synchronize with the island through storage events. Invalid stored values fall back to field defaults and unknown stored keys are discarded. Old manifests without settings remain supported; old Pomodoro entries gain the built-in duration fields while retaining their existing running timer. `labelKey` belongs only to PivO's bundled descriptors and is rejected in imported settings. Unsupported field types and bindings are rejected rather than rendered as inactive controls. There is no arbitrary code execution or host access through configuration.
