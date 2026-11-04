# Built-in widgets

Each widget has a Settings sidebar page and can be shown on the island. Previous and next cycle through enabled widgets. The page dots reveal icons on hover and select an enabled widget directly. An island action can open the corresponding Settings page. The window takes focus after a deliberate request.

- **Music and lyrics** uses the current Windows media session. While Music is open, PivO looks up the title, artist, album and duration in LRCLIB by default. Disable online lookup in Music Settings to keep lyrics local. Timed results follow the player timeline; plain text scrolls independently. Imported LRC or text pasted for the current track takes priority.
- **Tasks** saves tasks, deadlines, completion and snooze duration. Opt-in due reminders appear while the island is visible.
- **Calendar** shows a month or week, supports the selected first weekday and marks local task dates.
- **Pomodoro** keeps its existing timer, focus and break durations, reset and remaining-progress ring. Deadlines use wall time, so collapsing the island or restarting PivO preserves a running timer.
- **Water** saves the daily target, serving size and today's intake. Undo and reset affect today's log. Opt-in reminders use the chosen active hours.
- **File shelf** stores shortcuts selected with the Windows file picker. Open and reveal use Windows shell actions. Removing a shortcut or clearing the shelf preserves the file.
- **HUD and popups** reads system volume, input language, Caps Lock, power, Wi-Fi and classic Bluetooth headset status. Brightness requires a monitor that exposes DDC/CI. Keyboard notices sample the current desktop while the island is visible. Notifications can be configured per reading.

The compact preview cards use current widget data, including task and file rows, calendar week, timer and water progress, and HUD readings. Settings uses a compact sidebar and grouped controls. The island uses native button proxies and keeps input transparent in decorative areas. Widget actions are tied to the presented action revision. The companion suspends reminder delivery while hidden and checks due tasks when visible again. Media sampling is scoped to an open page. HUD sampling runs while its page is open or notices are enabled on the visible companion.

The old plugin storage key remains for compatibility with saved Pomodoro settings. The widget registry is part of the application source.

## Approximate lyric synchronization

Enable Approximate synchronization in Music and lyrics, then open the lyrics view while a track with plain lyrics is playing. PivO captures a short excerpt from the identified player process, recognizes the vocals locally and keeps the matched cues in memory for replaying that excerpt. Unmatched positions show plain lyrics. Existing timed lyrics take priority.

The Windows prototype requires process loopback support and a local whisper.cpp CLI with a multilingual model. Set `PIVO_WHISPER_CLI` and `PIVO_WHISPER_MODEL` to absolute paths before launching PivO, or set them before compiling a local validation build. Keep these development dependencies under `.local/`. Audio is passed to the recognizer through standard input.
