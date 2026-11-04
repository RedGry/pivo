# Changelog

## Unreleased

## 0.2.0 - 2026-11-04

### What's new

#### Music and lyrics

- Control the current Windows media session from the island: play or pause, skip tracks and seek when the player supports those actions.
- Show track title, artist, album artwork and an artwork-tinted Music background, with playback bars in the header and compact Strip.
- Open a wider lyrics column with timeline-following synchronized lyrics, highlighted cues and click-to-seek on timed lines. Plain lyrics remain scrollable.
- Look up lyrics in LRCLIB by default while Music is open, using track metadata. Disable online lookup in Music Settings to keep lyrics local.
- Import LRC files or paste lyrics for the current track; local lyrics take priority over online results.
- Add experimental approximate synchronization for plain lyrics using local process audio capture. It requires a separately installed whisper.cpp CLI and multilingual model; neither is bundled.

#### Seven built-in widgets

- Add dedicated pages for Music and lyrics, Tasks, Calendar, Pomodoro, Water, File shelf and HUD. Enable and configure each widget in Settings.
- Create, reorder and complete Tasks, set deadlines and snooze durations, and enable due reminders while the companion is visible.
- Browse Calendar by month or week, choose the first weekday, jump to a date and save personal events alongside task dates.
- Track daily Water intake with a target and serving size, undo or reset today's entries, and optionally schedule reminders within active hours.
- Keep file shortcuts in the File shelf using the Windows picker, with Open, Reveal, Remove and clear-on-startup controls. Removing a shortcut preserves its source file.
- Show HUD readings and configurable notices for volume, keyboard language, Caps Lock, battery, Wi-Fi and supported Bluetooth headsets. Brightness readings require a DDC/CI-capable monitor.
- Preserve the existing Pomodoro timer and saved focus/break durations. Refine its countdown dial and show active timer progress across widget pages.
- Switch enabled widgets with arrows, page dots or the mouse wheel. Hovering page dots reveals their widget icons, and transitions slide in the direction of navigation.

#### Mascot, clothing and holidays

- Introduce an animated vector presentation of the original PivO mascot, with separate eyes, paws and clothing, plus light and dark body colors.
- Add widget-specific props and gestures, reveal waves, pointer reactions and a Music dance during playback. Reduced motion takes priority over mascot animation.
- Add a dedicated Mascot settings page with live previews, size and motion controls, optional hat and scarf, and separate prop and clothing variants.
- Choose calendar-driven or fixed winter, love, spring, summer, autumn and Halloween appearance themes. Outfit and interface decoration can be configured independently or switched off.
- Add occasion outfits, illustrated holiday icons, themed Settings scenery and navigation glyphs, and a width-aware winter garland.
- Show recurring Russian and international holidays and movable observances. Filter country calendars, add custom country calendars and save recurring dates.

#### Presentation, Settings and native input

- Refine the island's compact and expanded proportions, monitor-aware scaling, mascot placement, artwork tint and transparent rounded outline.
- Improve elapsed-time reveal and fold motion, preserve continuity during early reversals, and animate lyric width together with content. Idle or hidden expressions stop scheduling frames.
- Add compact sleep/wake expressions, finite blinks and winks, plus playback and charging indicators where applicable.
- Reorganize Settings into widget pages and grouped controls, improve narrow and maximized layouts, add a visual display selector and refresh the Windows application icon.
- Keep controls aligned with the visible island and correct timed-lyric click targets at different display scales. The expanded island receives clicks without taking keyboard focus, while input outside its outline remains available to other applications.

### Install

1. Download [PivO_0.2.0_x64-setup.exe](https://github.com/RedGry/pivo/releases/download/v0.2.0/PivO_0.2.0_x64-setup.exe) and run it for your Windows user. Microsoft Edge WebView2 Runtime is required.
2. Existing installed copies can use **Settings > Updates > Check now**, followed by the island's update action. Automatic checks remain optional.
3. Portable copies need a first installation with the setup executable to use installed updates.

Updater signatures use the existing PivO key and are separate from Windows Authenticode signing. See the [release notes](https://github.com/RedGry/pivo/releases/tag/v0.2.0) and [validation record](docs/VALIDATION.md) for acceptance results and limitations.

## 0.1.0 - 2026-10-30

- Render declared plugin settings inside Settings, including Pomodoro duration controls, with validated persistence and documented timer reset behavior.
- Balance compact ring/clock spacing, use a complete decorative ring and constrain wide Settings content and theme previews.

- Center the localized date and bold clock beside a decorative green ring, remove the header wordmark and add a compact Strip clock.
- Reveal action labels only after actual native readiness; prevent synthetic clicks from leaving capture on the decorative owner.

- Restore finite compact blinking, add subtle cursor gaze and curiosity, and show rare original-mascot Strip reminders with hidden/reduced-motion cancellation.
- Add declarative timer/information plugins, a bundled Pomodoro, Settings import/enable/order/remove/reset controls and developer examples.
- Simplify the tray and add per-user Windows autostart and direct About navigation.
- Preserve cancellable 350 ms hover reveal and add a cancellable 200 ms pointer-exit fold delay.

- Widen the compact island to 180 x 40 and the expanded canvas to 560 x 160, with broader screen-edge shoulders and matching native geometry.
- Replace the nearly invisible strip with a 24-pixel compact row without eyes, leaving room for future status content.
- Use a single themed island surface and contrasting eyes in Light mode to avoid mismatched antialiased edges.
- Keep the expanded island open on interior clicks; fold it on an outside click or after the pointer-exit grace period.
- Add Strip, Eyes and Expanded presentations. Auto mode selects the compact presentation from actual window overlap; Eyes and Strip overrides are available.
- Keep deliberate edge/eye, face and action controls paint-gated, nonactivating and guarded by matched press/release. Decorative areas remain click-through; no desktop work area is reserved.
- Add grouped Appearance, Island, Updates and About settings with Dark, Light and System themes, saved language and selected display.
- Follow the primary monitor by default; preserve a disconnected display choice while falling back to primary, then recover it on reconnect.
- Align the revealed header and show friendly update summaries, with technical details in Settings. Preserve signed updates and opt-in automatic checks.
- Discover shared English/Russian localization from separate locale files, with English fallback and live changes.
- Retain concave shoulders and reversible elapsed-time motion across all three presentations.
- Keep runtime acceptance pending deferred automated native-input and Settings checks. The current application was launched for the user's manual test; see docs/VALIDATION.md.



- Add a per-user Windows installer and signed updates through GitHub Releases, with manual checks, opt-in automatic checks, progress and explicit installation controls.
- Prepare complete draft releases with matching versions, release notes and a static update manifest.
- Select Tauri 2 for the Windows application, with Rust for native behavior and TypeScript for presentation.
- Bundle the approved mascot into the frontend and add elapsed-time, reversible transition tests.
- Add a Rust workspace and native Windows panel with click-to-expand interaction, a clock and an exit menu.
- Add documentation, contribution guidelines, GitHub templates and Windows CI.
- License code under MIT and define separate asset terms.
- Set the first goal: an expandable panel, the original mascot and a clock.
- Add focused tests for panel sizing and clock scheduling.
- Separate application logic, Windows lifecycle and rendering into architectural source directories.
- Match the approved static presentations: a 120 x 35 eyes-only capsule and a 360 x 190 panel with the full character on the left.
- Add elapsed-time reveal/collapse transitions, compact blinking, subtle full-body movement and reduced-motion handling.
- Separate the click-through decorative window from its nonactivating exit control; observe mouse input for hover dwell and dismissal, and add Ctrl+Alt+P visibility control.
- Import the approved PivO mascot as a static transparent PNG for the first Windows prototype, with recorded provenance and reserved asset terms.
- Include dependency license notices and the Rust library copyright report in portable builds.
- Defer and coalesce pointer sampling to avoid reading a stale cursor position during input delivery; retain button-down events and cancel hover immediately on clicks.
- Validate repeated native hover, cross-process click-through, foreground preservation, click dismissal and click-free leave collapse with the separate debug MCP fixture.

