# Changelog

## Unreleased

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

