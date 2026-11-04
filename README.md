<p align="center">
  <img src="assets/mascot.png" alt="The original PivO mascot, with tiny paws and no accessories" width="320" />
</p>

<h1 align="center">PivO</h1>

<p align="center">
  <strong>A little friend at the top of your screen.</strong><br />
  Music, focus breaks and everyday reminders — with a curious pair of eyes.
</p>

<p align="center">
  <a href="https://github.com/RedGry/pivo/releases/download/v0.2.0/PivO_0.2.0_x64-setup.exe"><strong>Download for Windows</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/RedGry/pivo/releases/tag/v0.2.0">What's new in 0.2.0</a>
  &nbsp;·&nbsp;
  <a href="#bring-pivo-home">Getting started</a>
</p>

<p align="center"><sub>Windows x64 · English &amp; Russian · Free, MIT-licensed code</sub></p>

---

PivO peeks out from the top of your desktop. Come closer and the little island opens: your music, a focus timer, today's plans and a familiar face. Move away and it folds back into a pair of eyes.

<p align="center">
  <img src="docs/images/island-expanded.png" alt="PivO 0.2.0 in Dark theme with the mascot, clock and Pomodoro widget" width="787" /><br />
  <sub>A focus session, a little company, and room for your desktop.</sub>
</p>

## Meet PivO

A blink, a glance, a tiny wave. PivO follows the pointer, gets sleepy when things are quiet and wakes when you return. Play some music and the mascot can dance along.

PivO starts with a simple, familiar look. Hats, scarves and widget props are optional; you can keep the simple look, choose a different size or turn gestures off. Choose a style for each garment or widget prop, from a hat or scarf to the little objects that accompany each widget. Reduced-motion preferences are respected too.

## Little helpers for your day

Seven built-in widgets share the island. Pick your favorites in Settings, then move between them with arrows, page dots or the mouse wheel. Hovering a dot reveals its widget icon.

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🎵 Music &amp; lyrics</h3>
      <p>Keep the current track, artist and album art close by. Play, pause, skip or seek through the Windows media session. The island picks up the artwork's color, and little playback bars follow the playing state.</p>
      <p>Open the wider lyrics view for highlighted timed lines and click-to-seek. Import an LRC file or paste lyrics; local text takes priority. LRCLIB lookup is enabled by default while Music is open and can be switched off.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🍅 A moment to focus</h3>
      <p>Start a Pomodoro, watch the countdown ring and take a short break. Choose your focus and break lengths, pause or reset, and keep an active timer across app restarts.</p>
      <p>Timer progress stays available as you browse the other widgets.</p>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>☑️ One thing at a time</h3>
      <p>Write down tasks, put them in order and check them off from the island. Add deadlines, choose a snooze duration and enable due reminders when you need a nudge.</p>
    </td>
    <td valign="top">
      <h3>📅 Plans &amp; little occasions</h3>
      <p>Browse a month or week, jump to a date and choose the first weekday. Personal events and task dates sit alongside illustrated holidays.</p>
      <p>Filter country calendars, add your own countries and save recurring dates.</p>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>💧 A sip, then carry on</h3>
      <p>Set a daily water target and your usual serving size. Log a drink, undo an entry or reset today's intake. Optional reminders follow your chosen active hours.</p>
    </td>
    <td valign="top">
      <h3>📎 Keep it within reach</h3>
      <p>Put file shortcuts on the shelf, then open or reveal their originals from Windows. Remove a shortcut without deleting its file, or clear the shelf when PivO starts.</p>
    </td>
  </tr>
  <tr>
    <td colspan="2" valign="top">
      <h3>🔊 Small updates from your desktop</h3>
      <p>HUD readings and configurable popups cover volume, keyboard language, Caps Lock, power, Wi-Fi and supported Bluetooth headsets. Brightness readings need a DDC/CI-capable monitor. Choose which notices you want to see.</p>
    </td>
  </tr>
</table>

[Explore widget behavior and player support →](docs/PLUGINS.md)

## Make it yours

**A change of season.** Choose winter, love, spring, summer, autumn or Halloween decorations, or let the calendar choose. Occasion outfits, holiday icons and a winter garland bring a little celebration to the island. Mascot outfits and interface decorations have separate controls.

**Your colors, your language.** Dark, Light and System themes, English and Russian, and a separate Settings window with live previews. The README's application screenshots all use Dark theme.

**The right spot.** Choose a physical monitor on the display map. PivO remembers it, falls back to the primary monitor if it disappears and returns when it reconnects. The island adapts to the selected monitor's size and display scale, with manual sizing available too. Auto mode also offers a minimal Strip when no lyrics are on screen.

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <strong>A little wardrobe, if you want one</strong><br /><br />
      <img src="docs/images/settings-mascot.png" alt="Dark-theme Mascot settings with the bare mascot and optional hat and scarf previews" width="420" />
    </td>
    <td width="50%" align="center" valign="top">
      <strong>Your days, at a glance</strong><br /><br />
      <img src="docs/images/settings-calendar.png" alt="Dark-theme Calendar settings with November, holiday icons and country calendars" width="420" />
    </td>
  </tr>
</table>

<details>
<summary><strong>Take a closer look: themes, Eyes and Strip</strong></summary>

### Appearance

<img src="docs/images/settings-appearance.png" alt="PivO 0.2.0 Appearance settings with Dark theme and English selected" width="760" />

### Eyes

The compact companion, with blinks, curious glances and a sleepy idle state.

<img src="docs/images/island-eyes.png" alt="PivO 0.2.0 compact Eyes in Dark theme" width="560" />

### Strip

A small clock and tiny eyes along the screen edge. Auto mode chooses Strip when an ordinary window overlaps the compact footprint; Eyes and Strip can also be selected manually.

<img src="docs/images/island-strip.png" alt="PivO 0.2.0 Dark-theme Strip with a clock and tiny eyes" width="560" />

</details>

All application images are real captures of the published 0.2.0 build. The hero uses our original approved mascot artwork. [Image provenance and asset terms](docs/images/README.md).

## A guest on your desktop

- Hover or click the deliberate edge or eye target to open the island. Outside clicks fold it; interior clicks keep it open.
- The companion stays at the monitor edge without reserving desktop space. Decorative areas pass clicks through, and ordinary island interactions leave keyboard focus with your work.
- Reveal and fold animations can reverse smoothly when you change your mind. Hidden and reduced-motion states stop unnecessary gestures.
- Use **Ctrl+Alt+P** to hide or restore PivO. Enable per-user autostart from the tray if you want a familiar face when Windows starts.

## Bring PivO home

1. [Download PivO 0.2.0 for Windows x64](https://github.com/RedGry/pivo/releases/download/v0.2.0/PivO_0.2.0_x64-setup.exe).
2. Run the installer for your Windows user, then launch PivO.
3. Open Settings, pick your widgets and make yourself at home.

Microsoft Edge WebView2 Runtime is required; the installer handles the normal runtime prerequisite. PivO is currently a Windows x64 prototype. See the [roadmap](docs/PLAN.md) for future work.

### Already have PivO?

Open **Settings → Updates → Check now**, then use the island's update action when a version is offered. The tray can also check for updates. Automatic checks are optional, and installation always needs your action.

Portable copies need a first installation with the setup executable before using installed updates. Updater signatures protect updates and are separate from Windows Authenticode signing, so the installer may still show a SmartScreen prompt.

[Release notes](https://github.com/RedGry/pivo/releases/tag/v0.2.0) · [Full changelog](CHANGELOG.md) · [Update setup](docs/UPDATES.md)

<details>
<summary><strong>Players, lyrics and preview limitations</strong></summary>

Media controls depend on the active player's Windows integration. Synchronized lyrics follow the player timeline; plain text scrolls independently. Online lookup sends the current track's metadata to LRCLIB while Music is open and can be disabled in Music Settings.

Experimental approximate synchronization for plain lyrics uses local process audio capture and requires a separately installed whisper.cpp CLI and multilingual model. Those tools are not bundled. See the [widget guide](docs/PLUGINS.md) for setup.

The signed installed 0.1.0 → 0.2.0 update, preserved language/theme settings and automatic visible restart were exercised in a disposable Sandbox with an explicit WebView2 runtime path. Native Explorer drop, current mixed-DPI/fullscreen behavior and actual sleep/resume still have validation gaps. The [validation record](docs/VALIDATION.md) describes exact checks and limits.

</details>

## For the curious

PivO is built with Tauri 2, Rust and TypeScript, without a frontend UI framework. Read the [architecture](docs/ARCHITECTURE.md), [contributing guide](CONTRIBUTING.md) or [isolated Windows test setup](docs/TEST-ENVIRONMENT.md).

<details>
<summary><strong>Build PivO from source</strong></summary>

Install Rust stable, Visual Studio Build Tools with C++ tools and the Windows SDK, Node.js 24 and Microsoft Edge WebView2 Runtime.

```powershell
npm --prefix windows/frontend ci
npm --prefix windows/frontend run build
cargo build -p pivo-windows --release --locked
```

The executable is written to `target/release/pivo.exe`. Use `npm --prefix windows/frontend run desktop:dev` for frontend reload during development.

Run the application validation with `pwsh -NoProfile -File scripts/validate.ps1`.

</details>

## A note on our little friend

The code is [MIT licensed](LICENSE). PivO's mascot, artwork, sounds and branding have [separate asset terms](LICENSE-ASSETS.md), with ownership recorded in [asset provenance](assets/README.md).

Dependency and Rust library notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
