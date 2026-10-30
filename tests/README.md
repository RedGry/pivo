# Tests

Keep unit tests beside the behavior they verify. Add Windows integration tests under windows/tests/ when there is meaningful behavior to test. This directory holds shared acceptance scenarios.

Rust tests verify three-mode policy, visibility/readiness, exact presentation generations, delayed pointer-event batching, locale/preference fallback and selected-monitor fallback/reconnect policy. TypeScript tests verify elapsed-time sampling, position/velocity/acceleration continuity through rapid reversals, immediate reduced-motion settling, locale discovery, message placeholders and English fallback. Run the frontend tests with `npm --prefix windows/frontend test` before the Cargo checks in CONTRIBUTING.md. Unit tests do not establish WebView rendering or native mouse routing; the separate MCP checks the running application. See docs/VALIDATION.md for observed results and remaining checks.

The current build passes automated gates and has been launched for user manual inspection. Automated native-input and Settings acceptance is deferred. The following remain acceptance scenarios, not claims of completed runtime coverage.

Prototype acceptance checks:

- Expand and collapse the top panel.
- Display the original mascot and a clock.
- Verify the 24-pixel Strip row without eyes, 180 x 40 Eyes and 560 x 160 Expanded. Auto chooses Eyes only when the compact footprint is unobstructed; ordinary overlapping windows, including Settings, select Strip. Explicit Eyes/Strip choices override Auto. Preserve character identity and smooth reversible motion with concave shoulders.
- Verify real Strip edge and Eyes-cluster click/hover reveal, outside-click collapse, dismissal recovery and click-through elsewhere. Interior clicks, including the face, must leave the island open. Pointer exit must fold it after the grace period, and re-entry must cancel that pending fold. Moving through the old body area must not reopen it.
- Open and reuse a separate Settings window; test custom title-bar drag/minimize/maximize/close without exiting PivO. Check Appearance, Island, Updates and About groups, live language/theme changes, friendly update summaries and preference persistence.
- Allow clicks on browser tabs and other applications underneath decorative areas without taking keyboard focus. Check hover dwell, explicit hide/exit and fullscreen behavior. In Light theme, verify a light compact and expanded surface, contrasting eyes and consistent antialiased edges.
- Measure actual active-frame timing and inspect motion for stutter, flicker and jumps; verify reduced-motion behavior and stopped idle animation updates.
- Refresh correctly after sleep and time changes.
- Handle 100%, 150% and 200% DPI and selected-monitor migration. Test follow-primary, an explicit display, disconnect fallback and reconnect recovery. Fullscreen and occlusion must use the chosen monitor, including negative coordinates.
- Exit cleanly.
- Record idle CPU, working set and release executable size.

## Compact interaction and plugin acceptance

- Cross the current reveal target in less than 350 ms: remain folded. Leave and re-enter: restart the dwell rather than reuse an old timer.
- Hold inside the current target: reveal. Exit Expanded: fold after 200 ms. Re-enter before the deadline: cancel the pending fold. Crossing the old body while folded must not reveal.
- Check compact blinking and finite expressions. Strip reminders must remain decorative and must not enlarge the reveal target. Hide, fullscreen and reduced motion must cancel expression scheduling.
- Start, pause, resume and reset Pomodoro from the island. Fold and reopen, then restart the app: remaining time must follow elapsed wall time rather than rendering frames.
- Disable all plugins, enable Pomodoro, reorder cards and reopen Settings. Check persistence and immediate synchronization across the two windows.
- Import the documented external JSON example. Reject malformed/unsupported manifests visibly. Render plugin-provided text literally, without script execution or privileged access.
- Open About directly from the tray with Settings both closed and already open. Check the exact tray order, then verify the Autostart entry reflects the current user's Windows setting. Restore any startup preference changed during acceptance.
## Native action readiness regression

The public MCP compatibility click toggles the main panel and does not test its owned native button windows. Before declaring island clicks verified, inspect the separate helper's private native-input modes; use owned-handle discovery rather than old fixed screen coordinates.

- During reveal and reversal, action glyphs must stay hidden until the matching terminal presentation has been processed by native input. A visual fade alone must not expose a dead button.
- Click the gear as soon as it becomes visible. Require Settings to open after that first real press/release, with the companion retaining its nonactivating behavior. Compare with the tray Settings path when diagnosing failures.
- Keep an independent bounded fixture beneath any preterminal click probe. Require clicks before native readiness to reach that fixture; never inject a test click into an unrelated underlying application.
- Check plugin controls and update actions against the same visibility rule. Update actions also require the matching update revision. Rapid reversal, hide/show and stale asynchronous acknowledgments must not expose controls for an old presentation.
- Preserve the first failing native evidence under a distinct file; later setup retries must use different filenames.- After a public MCP compatibility click, require the decorative main window to own no mouse capture. Then perform a real gear click and require Settings to open. The synthetic down/up path must not leave framework capture behind; native gear/plugin capture must remain local to its own button HWND.
## Settings and compact layout acceptance

Capture the actual Strip presentation after changing its status row; an Eyes capture does not validate Strip. Ring and time must form one balanced group, clear of the clipped shoulders. A neutral status ring must not imply an arbitrary percentage.

After Settings layout changes, capture both the default window and a wide window. Theme previews must retain sensible proportions, and labels/controls must remain inside the bounded content column. Restore the original Settings geometry after the fixture. For declared plugin settings, capture the generated form and check validated persistence/reset behavior; report live form editing separately from model tests when it is not exercised.
For themed selects, capture the opened Language picker as well as the closed button. Check chevron inset, selected/hover state, focus border and popup alignment without changing the selected locale. Restore focus and close the popup afterward. For plugin tiles, verify initially closed disclosures, metadata/icons and the absence of order arrows; check ordering separately under Island. Ring captures must match real plugin state, including paused progress and no progress for information pages.