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

## Obsession acceptance

- Choose reading, writing and coding in Appearance and inspect each shared scene. Restart to verify persistence; invalid stored values must fall back to reading and invalid setters must fail. Exercise localized encouragement and all three juggling hearts. Busy laptop requires an active selected focus countdown, closes on approach/pause, and must not appear for break/paused/information pages.
- Place an independent process below the expanded mascot. A real left double click must draw hearts while both clicks reach that process, without mouse capture or foreground theft. Single/slow/outside clicks, OFF and reduced motion must not draw hearts. Verify stale generations cannot pair across reveal boundaries.
- Focus start must show the notebook then one kiss; pausing during the notebook must prevent a delayed kiss. Capture the sandwich offered with break-time cups and verify all new props disappear on cancellation.
- Start/resume a break for the two-cup scene; mode selection, pause, focus start and failed persistence must not trigger it. Leave and return to the expanded mascot for the bounded binocular search, and fold before its grace interval to reject stale searches.
- Observe rehearsal, oversized bouquet and heart repair under ordinary idle timing. Approach during rehearsal to stop the greeting; require bouquet eyes to remain visible, a clear clock/plugin area, and complete prop cleanup on OFF, hiding, reduced motion and disposal.
- Activate the real Windows desktop and click its empty background with Obsession OFF and ON. Eyes must stay visible; WorkerW/Progman must never count as fullscreen. Then foreground an independent borderless fullscreen fixture and require suppression.
- Capture the timer contour in Expanded and Strip with Obsession ON/OFF at full, half-paused and empty progress. Require a heart only while enabled, the same remaining fraction and no motion loop caused by the contour change.
- Verify navigation SVG bounds are centered in both 24-pixel native targets. Check lilac heart eyes at rest, compact, both themes and reduced motion; OFF restores the original eyes.
- Start/resume focus for the notebook scene; pause for folded hands/tapping. Observe a running timer naturally reach zero for small/larger gifts, then repeat while noticed and while compact. Restoring an already finished timer must not replay the gift.
- Capture false sleep followed by cursor-triggered single-eye peek, thread-heart drawing, the compatibility result with its extra percent removed, repeated-reveal counter correction and matching-time rings. Clock fixtures must leave the Windows clock unchanged.
- Enable Obsession in Appearance, reveal deliberately and capture the twig break, pause and blink. Restart and verify the saved switch. Capture both themes and locale captions.
- Observe the finite smile, direct stare/blink and distressed-to-affectionate expressions. While compact, verify Eyes identity and quiet Strip behavior.
- Dwell over the mascot, then move directly to the rendered clock while the hug is active. Verify one hug/jealous reaction per visit, cancellation on leave, readable clock digits and free cursor movement.
- Switch an unfinished running or paused timer to the other mode: require the disappointed caption. Pause, complete naturally and switch idle modes: require no cancellation reaction.
- Exit Expanded and reverse the fold. Require a brief edge clutch without delayed folding, enlarged reveal targets or reopening through the old body.
- Disable during every reaction. Require immediate mode cancellation and only the bounded no-no/relief farewell; enable again quickly and require no stale farewell. Toggle while compact and verify the next deliberate reveal, including expiry after 60 seconds.
- Suspend/resume and deliver duplicate resume notifications: require one waiting reaction. Check hidden/fullscreen and reduced-motion cancellation and stopped idle frame updates.
- Repeat affected geometry at 100%, 150% and 200% DPI and on another selected monitor. With an independent process beneath the decorative regions, verify click-through and foreground preservation. Close cleanly and restore all fixture-owned preferences and desktop state.
