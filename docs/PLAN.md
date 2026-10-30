# Roadmap

## Goal 1: first working prototype

Deliver an expandable panel at the top of the Windows desktop, displaying the original PivO mascot and a clock. Keep it small, reusable and maintainable.

- [x] Create the Rust workspace and Windows scaffold.
- [x] Add documentation, licenses, repository configuration and GitHub CI/templates.
- [x] Agree on the first prototype scope.
- [x] Prepare Rust/MSVC and pass formatting, Clippy, unit tests and release build.
- [x] Import the approved static mascot with provenance and asset terms. Additional animation assets have not yet been prepared.
- [x] Measure the initial native panel spike and record its results.
- [x] Complete the user-selected Windows migration to Tauri 2 with Rust and TypeScript; rerun acceptance against its WebView.
- [x] Build the initial panel spike with expand/collapse, local time and clean exit.
- [x] Implement the panel, expand/collapse interaction, mascot, clock and clean exit.
- [x] Implement deliberate hover reveal and an identity-preserving compact-to-character transition; native acceptance for the current presentations is tracked below.
- [x] Keep decorative areas click-through and preserve foreground-app focus; verify native pointer routing and dismissal against a separate process before adding widgets.
- [x] Implement and measure smooth, interruptible character motion with reduced-motion support and idle frame updates stopped. Current capture timing and its limits are recorded in docs/VALIDATION.md.
- [x] Validate build, behavior, DPI, multiple monitors, fullscreen and sleep/resume. Current results and remaining extended checks are in docs/VALIDATION.md.
- [x] Record initial CPU, working set and executable size; produce a portable Windows test build. Longer desktop stability testing remains open.

The goal is complete only when the UI runs and the acceptance checks in tests/README.md have been exercised. A console scaffold does not satisfy it.

## Current follow-up: three presentations and preferences

- [x] Implement Strip, Eyes and Expanded, with automatic obstruction detection and compact overrides; do not reserve desktop work area.
- [x] Add deliberate edge/eye and face controls, an aligned header, concave shoulders and reversible motion.
- [x] Implement grouped Appearance, Island, Updates and About settings with Dark/Light/System themes and shared per-file localization.
- [x] Persist selected-monitor placement, follow primary by default, and preserve missing selections for reconnect recovery.
- [x] Keep update summaries friendly and technical details in Settings while preserving the existing signed-update flow.
- [x] Pass final automated gates, including seven frontend tests. The new build is launched for the user's manual test.
- [ ] Complete deferred automated native-input, Settings singleton/title-bar/close and live preference persistence acceptance.
- [ ] Recheck three-mode occlusion, selected-monitor fallback/reconnect and affected DPI/fullscreen/resume behavior. Earlier prototype results do not validate these changed interactions.

## Current follow-up: compact interaction and plugins

The approved delivery order is interaction and size, character expressions, tray menu, then a plugin host with one complete Pomodoro plugin. Music, water tracking, file shelf, tasks and device-event integrations follow as separate plugin deliveries. Reference screenshots guide content density rather than replacing PivO's mascot or visual identity.

- [x] Reduce Expanded to 560 x 160 logical pixels with matching native controls.
- [x] Keep a cancellable 350 ms reveal dwell and fold after a cancellable 200 ms pointer-exit grace period.
- [x] Restore compact eye animation and add rare finite Strip reminders, respecting visibility and reduced motion.
- [x] Simplify the tray to Autostart, Settings, a separator, About, Check for updates and Exit.
- [x] Deliver a working Pomodoro plugin, persistent enable/order controls and an external declarative plugin example.
- [x] Complete final automated validation, independent review and the available separate-MCP acceptance batch; record unavailable native cases explicitly.

## Later milestones

Agree on music controls, calendar, system stats, AI agent status and personalization separately. Linux, macOS and Android follow after validating the Windows design.
