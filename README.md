# PivO

A small companion at the top of your screen.

PivO is a desktop companion built with Tauri 2, Rust and TypeScript, with its own mascot and visual identity. Windows comes first; other platforms can follow.

[Download PivO v0.2.0 for Windows](https://github.com/RedGry/pivo/releases/download/v0.2.0/PivO_0.2.0_x64-setup.exe) · [Release notes](https://github.com/RedGry/pivo/releases/tag/v0.2.0)

<p align="center">
  <img src="assets/mascot.png" alt="The original PivO mascot" width="240" />
</p>

## Screenshots

Actual Windows application captures, shown in Russian. PivO also includes English.

**Expanded island** with the original mascot, clock and Pomodoro widget:

<img src="docs/images/island-expanded.png" alt="Expanded PivO island with mascot, clock and Pomodoro controls" width="560" />

**Compact Strip** keeps the desktop available:

<img src="docs/images/island-strip.png" alt="Compact PivO Strip showing the clock and timer progress" width="560" />

**Settings** opens in a separate window:

<img src="docs/images/settings-appearance.png" alt="PivO appearance settings with theme and language selection" width="760" />

Capture details and asset terms are recorded in [image provenance](docs/images/README.md).

## First milestone

An expandable top panel, our mascot and a clock. Music, a calendar, system stats and AI agent status can follow one step at a time.

**Status:** the Full HD usability candidate reduces Expanded to 480 x 144 logical pixels, shortens reveal dwell and provides seven built-in widgets. See [validation](docs/VALIDATION.md) for actual checks and runtime limits. The screenshots above show the earlier build.

## Build

Install Rust stable, Visual Studio Build Tools with C++ tools and the Windows SDK, Node.js 24 and the Microsoft Edge WebView2 Runtime.

```powershell
npm --prefix windows/frontend ci
npm --prefix windows/frontend run build
cargo build -p pivo-windows --release --locked
```

The executable is written to `target/release/pivo.exe`. For development with frontend reload, run `npm --prefix windows/frontend run desktop:dev`.

PivO has three presentations: **Strip**, a 24-pixel compact row for future status content; **Eyes**, the compact mascot; and **Expanded**, the full character and clock. Auto mode shows Eyes when the compact area is unobstructed and Strip when another ordinary window overlaps it. Settings can force either compact presentation.

Hover or click the deliberate edge target in Strip, or the eye cluster in Eyes, to expand. Move the pointer outside the expanded island to fold it after a short grace period. Outside clicks also fold it; interior clicks leave it open. Decorative areas pass clicks through without taking keyboard focus. The revealed header aligns the clock, settings and exit controls. Ctrl+Alt+P hides or restores the companion.

Settings includes Appearance, Island, Updates, About and a dedicated sidebar page for each widget. Choose Dark, Light or System theme, language, compact behavior and display. Dark preserves the original default appearance. Display selection follows the primary monitor by default; a missing saved display falls back to primary and resumes its saved placement when reconnected. Each language is a separate [locale file](locales/README.md), discovered on rebuild; English and Russian are included.

The approved static mascot at `assets/mascot.png` is bundled into the frontend. A portable build does not need a separate image file. See [asset provenance](assets/README.md) for its source and usage terms.

## Built-in widgets

Switch between Music and lyrics, Tasks, Calendar, Pomodoro, Water, File shelf and HUD on the island. Enable and configure each widget in its Settings page. Pomodoro keeps its existing saved timer and duration settings. See [widget behavior and Windows support](docs/PLUGINS.md).

Compact Eyes blink, occasionally look curious and follow the cursor. Strip briefly shows the original mascot every 120–180 seconds. Hidden and reduced-motion states stop those gestures. Reveal uses a deliberate hover target. Leaving Expanded starts a reversible fold; returning to the current target reverses it.

The tray offers Autostart, Settings, About PivO, Check for updates and Exit. Autostart applies to the current Windows user.

## Updates and installers

The Windows installer and signed updates use the official Tauri 2 updater. Update checks are available in Settings and the tray. The panel shows a friendly summary; technical error details stay in Settings. Automatic checks are opt-in, and installation always requires an explicit action. See [updates and release setup](docs/UPDATES.md) for signing keys, GitHub configuration, installer builds and the installed-version upgrade acceptance gate.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](docs/PLAN.md) and [architecture](docs/ARCHITECTURE.md). Keep the design simple, dependencies small and platform boundaries clear.

## License

Code is [MIT licensed](LICENSE). The mascot, artwork, sounds and branding have [separate terms](LICENSE-ASSETS.md).

Dependency and Rust library notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The header ring shows timer progress while Pomodoro is selected. Clock/date formatting follows the selected locale.

For isolated interactive Windows testing, see [the test environment](docs/TEST-ENVIRONMENT.md). Containers cover build and model tests; native UI acceptance requires an interactive Windows desktop.

Automatic island sizing uses the selected monitor's logical height, including Windows DPI: at 100% scale, Expanded is 480 x 144 on 1920 x 1080 and 560 x 168 on 2560 x 1440. Intermediate heights interpolate within these bounds. Rendering and native input use the same scale.
