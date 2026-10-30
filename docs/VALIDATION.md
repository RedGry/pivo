# Prototype validation

## Draining timer ring: 2026-10-30

- Timer rings now display remaining time: full at start/reset, empty at completion and fixed while paused. The plugin API still reports elapsed progress; only presentation maps it to one minus that value. Information plugins still hide the ring. No timer state, settings, input or scheduling policy changed.
- The final validation script passed: 36 frontend tests, TypeScript/Vite, Rust formatting, Clippy, 26 Rust tests and release build. Log: `.local/validation-draining-ring.log`. The new presentation test covers endpoints, intermediate remaining fractions, null and bounded invalid values. Independent source review found no issue.
- Executable SHA-256: `7A4284F187CCAA82917B16E9907B363B81672242AE24EF53B921A8C090B91EDA`.
- Separate-MCP launch/status and exact-window capture confirmed PID 55356 running at the selected monitor top with a 560 x 160 client, without foreground ownership. Strip shows the larger remaining-time arc for the previously paused timer. No configuration or timer values were changed. Start/completion transitions were checked by the model/presentation tests rather than live timer manipulation; unrelated native/DPI/resume cases were not repeated.


## Plugin library, icons and live progress: 2026-10-30

- Final executable SHA-256: `5F5EBAB4719F78AF64D2FCFB850A9EA7512FBF421E3E434AD121E97E2E6A4E42`; size: 9,096,704 bytes. Final `pwsh -NoProfile -File scripts/validate.ps1` passed: clean npm install, 35 frontend tests, TypeScript/Vite, Rust formatting, Clippy with warnings denied, 26 Rust tests and the locked release build. Log: `.local/validation-plugin-library.log`.
- Independent source review found no actionable P1/P2 issue in declared settings, metadata/icon validation, active-plugin progress, input visibility, collapsed tile state, ordering or progressive dropdown styling. Both developer examples passed the production manifest parser.
- Final private native batch passed on PID 44464 after a public compatibility click. Capture was free before fixture activation and before the real gear click. Native gear down captured only the gear, native up released capture, and Settings opened. Cursor, foreground and exact Settings placement were restored; no configuration values were written. Raw log: `.local/native-plugin-library-2.log`. The first attempt safely stopped before clicks while a mouse button was held; the user then supplied a quiet interval for the successful retry.
- Exact-window visual acceptance confirms the tomato icon on the island and manager tile, localized description/author, connection switch, Settings disclosure initially collapsed, and no order controls in the manager. Ordering belongs separately to Island settings. The actual paused break showed 04:18 and a corresponding partial ring, rather than a static full indicator.
- Accepted captures: `.local/native-gear-after-main.png` (560 x 160); `.local/native-settings-default-appearance.png` (862 x 642, including the thin resize frame); `.local/native-settings-wide-appearance.png`, `.local/native-settings-wide-plugins.png` and `.local/native-settings-language-picker.png` (actual WGC frames 1586 x 793 after a requested 1600 x 800 window); `.local/native-settings-overlap-strip.png` (560 x 160). The wide Appearance content stays bounded, the opened English/Russian picker is themed and aligned, and Strip shows the padded clock/progress group.
- The separate helper now uses the actual WGC item dimensions only for the exact configured Settings window; the main-window dimension guard remains strict. The helper and its private fixtures remain outside the application repository.
- Not exercised in the live UI: editing/saving configuration values, imported PNG rendering, active countdown frame timing, reordering multiple connected pages, forced-colors/older WebView fallback, affected DPI/monitor migration/fullscreen/sleep-resume and Autostart. Pure model tests cover persistence, validation, reset/unchanged-save behavior, progress and ordering. No successful native click or visual capture is inferred for these unexecuted cases.
- The final prototype remains running. Earlier sections below describe previous candidates and do not supersede this result.


## Native control fix and date header: 2026-10-30

- User reproduction: reveal Expanded and click the visible gear. Settings does not open; opening Settings from the tray works. Island action clicks are also reported broken.
- The public pivo-debug `pivo_click` tool sends compatibility messages to the main panel; it cannot reproduce a real owned-button press/release or validate the gear. The separate helper also has a private native-input driver, but its Settings path uses an obsolete hard-coded x=304 gear coordinate. A task-local helper copy outside this repository is being adapted to discover the configured application's exact owned reveal/gear handles and verify native input with pointer/foreground restoration.
- Native reproduction on the unfixed executable: a guarded click 231 ms after reveal began found the gear proxy hidden, reached the independent fixture once and did not open Settings. A settled native gear click opened Settings. The user independently confirmed that waiting one second made it work. The timing result is preserved as a derived record in `.local/native-gear-timing-confirmed-before.json`; a setup retry overwrote its original raw log. The settled raw log remains `.local/native-gear-before.log`.
- Two frontend visibility regressions first failed against the previous reveal-based rule, then passed after matching action visibility to actual native readiness. Native acknowledgment commands now await main-thread execution and return actual readiness; the frontend rejects stale presentation generations and update revisions. Native target gating remains intact.
- The first final native gear acceptance failed after a public synthetic click: the decorative owner still held mouse capture, the gear press token stayed zero and Settings did not open. Raw evidence: `.local/native-gear-after.log`. The main compatibility path now consumes mouse-down instead of forwarding it to framework capture, and mouse-up defensively releases only capture held by that decorative owner. Native button capture remains unchanged.
- Expanded is now 560 x 160 logical pixels; compact remains 180 x 40. Native/CSS button geometry and the gaze center follow the wider canvas. Independent source review found no actionable P1/P2 issue. Final verification is recorded below.
- Automated: the full validation script passed with 18 frontend and 26 Rust tests, formatting, Clippy and release build (`.local/validation-native-controls-wide.log`). After the confirmed compatibility-capture failure, affected Rust checks and release rebuild passed (`.local/validation-decorative-capture.log`). The final header passed 20 frontend tests, TypeScript/Vite and the release rebuild (`.local/validation-header.log`). No unchanged frontend dependency install or Rust suites were repeated for the header-only edit.
- Final executable SHA-256: `A59A2DCEF9B189D7DA3AE884C536656B480DF6D79908E59EF727D8C21A1185A0`; size: 9,088,512 bytes.
- Final real native batch passed on PID 43920 after a public MCP synthetic click. Before any fixture activation, the main owner held no capture; the same assertion passed immediately before the gear press. Native down set press 7 and capture to the gear only; native up cleared capture and opened Settings. Cursor and original foreground were restored. Raw evidence: `.local/native-gear-final-header.log`.
- The separate helper's own bounded watchdog fixture temporarily supplied the foreground baseline to avoid another app confining the cursor. Earlier affected attempts safely aborted before down when the cursor moved or reveal did not settle; those attempts were not counted as successful clicks. The helper remains outside the application repository.
- Exact main-window capture `.local/native-gear-after-main.png` confirms the 560 x 160 layout, centered green ring, localized weekday/date, bold clock, no header wordmark and complete Pomodoro action labels. Locale formatting was checked for English and Russian; language changes use the existing live preference callback.
- The optional compact capture showed Eyes, so the new Strip clock has source/clock-scheduling test coverage but no accepted live Strip capture. Real plugin/update actions, affected DPI/monitor migration/fullscreen/sleep-resume, Autostart and full Settings persistence remain outside this batch. The final app remains running for user inspection.


## Compact interaction and plugin candidate: 2026-10-30

- Scope: 440 x 160 Expanded, cancellable 350 ms hover reveal and 200 ms exit grace, finite compact expressions/gaze and rare Strip reminders, simplified tray with per-user Autostart, and declarative timer/information plugins with builtin Pomodoro and Settings management.
- Blink regression investigation: the prior compact screenshot showed the original eye cluster. Source inspection found no compact blink animation or scheduler; the remaining bob effect only ran at nonzero reveal. The available MCP cannot move the real cursor, inspect DOM animation state or run a timed blink fixture, so no failing automated native blink test is claimed. Minimal manual reproduction before the change: keep Eyes visible without interaction for at least 15 seconds and observe that no blink occurs. New scheduler tests cover finite scheduling and hidden/reduced cancellation.
- Independent source review completed without actionable P1/P2 findings. Native geometry, update priority, timer lifecycle, About navigation and startup command quoting were inspected.
- Final executable SHA-256: `E33E7B5D166F459F5D5E797E72E08CC1194D197384532716B03116A9B54E82F2`; size: 9,073,152 bytes.
- The final `pwsh -NoProfile -File scripts/validate.ps1` pass succeeded: clean npm installation, 15 frontend tests, TypeScript and Vite build, Rust formatting, Clippy with warnings denied, 25 Rust tests and the locked release build. Evidence: `.local/validation-compact-plugins.log`. Incremental cache hard-link warnings were nonfatal; Cargo copied the files instead.
- Separate-MCP launch/status/captures confirmed a visible 440 x 160 client anchored at the monitor top, compact eyes and an expanded Pomodoro card showing 25:00 with localized controls. PivO did not own the foreground. The synthetic expansion was followed by a visual fold while the real cursor remained elsewhere. This does not measure real hover/exit timing. A capture exposed a clipped Russian Short Break label; it was shortened to fit, followed by two passing locale tests, TypeScript/Vite and the locked release rebuild (`.local/validation-compact-plugins-label.log`). Final MCP capture confirms the complete Russian label fits. Both external example manifests passed the production parser.
- Normal MCP close completed and the following status reported `running:false`. The final development executable is launched again for user inspection after the label rebuild.
- Available MCP capabilities are status, launch, normal close, exact-window capture and synthetic compatibility clicks. Real cross-process click-through, native plugin actions, measured 350/200 ms dwell, blink/gaze/rare-reminder timing, Settings/Autostart actions, cross-WebView persistence, affected DPI, monitor migration, fullscreen and sleep/resume remain unexecuted in this session. Synthetic clicks and source tests do not establish these acceptance cases.


## Current wider-island candidate: 2026-10-30

- Executable SHA-256: `F6C184BE3A0B4BFF8E3286E6BAC6662F695BBA5485E3C9C33FAE2352C863B4F4`; size: 9,024,000 bytes.
- The final validation script passed: clean frontend installation, seven frontend tests, TypeScript checking and production build, Rust formatting, Clippy with warnings denied, 19 workspace tests and the locked release build. Its initial attempt stopped before installation because arguments were passed as one array; variable splatting corrected the script. Full local evidence: `.local/validation-wide-island.log`.
- Independent source review found no remaining actionable issue, including the final 24-pixel row and separate eye-opacity fade. The inside/outside pointer regression failed against the old policy, then passed after the native adapter used the corrected decision. Face-collapse controls and pointer-exit collapse timers were removed.

- The user screenshot and a read-only exact-window MCP capture show the previous compact island. Source inspection found a forced dark compact pseudo-element over the light island surface, producing mismatched edge colors in Light theme. The source also collapses on every observed button-down, including inside the expanded canvas.
- Before implementation, the updated geometry regression failed on the old compact width: `120 !== 180`. New targets are 180 x 40 compact and 440 x 210 expanded, with a 24-pixel compact row after the user clarified that it should accommodate future status content.
- Minimal runtime reproduction: select Light in Appearance, compare compact and expanded surface/edge colors, then click a decorative interior point and an exterior point. Automated input remains deferred, so the theme raster artifact and native routing do not yet have a failing automated UI test. No such test pass is inferred from source inspection.
- Launch through the separate MCP succeeded. Read-only status and exact-window capture confirmed a 440 x 210 client at the screen top, the thicker compact row without leaked eyes, and no foreground ownership. The active captured theme was Dark; Light raster quality, expanded visual endpoints, real inside/outside clicks and affected DPI/monitor checks remain unverified for this executable. No automated cursor or focus changes were made. Earlier installers and portable archives were preserved and do not contain this build.

## Previous three-presentation/settings candidate: 2026-10-30

- Executable SHA-256: `57B357B849287D3DD335BC50029B5536197F579E308ADFD34D790DCCF528E56B`; size: 9,024,512 bytes.
- Clean frontend installation, seven frontend tests, TypeScript checking and production build passed. Rust formatting, Clippy with warnings denied, 18 workspace tests and the locked release build passed. The final independent source review found no remaining actionable issues.
- Tests cover distinct strip/eyes/expanded presentation generations, occlusion-dependent compact preferences, primary-display fallback and saved-display recovery on reconnect, bounded reversible motion and locale fallback. Source review covered cross-DPI anchoring and suppression of native hit targets during migration.
- Settings now has separate Appearance, Island, Updates and About pages, a custom titlebar, light/dark/system themes and persistent display selection. Panel header controls share a vertical center; detailed updater errors are available separately in Settings.
- The new executable was launched through the separate PivO MCP for the user's manual testing. Subsequent status confirmed a visible 360 x 190 client, positioned at the screen top, without taking foreground ownership. No automated pointer, focus or Windows-setting changes were made.
- Actual three-presentation routing, Settings controls, theme changes, monitor selection/hot-plug and mixed-DPI migration still require runtime acceptance. Automated live input checks remain user-deferred. Earlier screenshots and DPI/sleep passes do not validate this executable. Existing portable archives and installers contain earlier candidates; they were preserved, not relabeled as this build.

## Previous island/settings candidate: 2026-10-30

- Executable SHA-256: `2403B9A114B939C784B3E863AC141D62E4375DB23B8DF059F4E7ABF6C54DED6A`.
- A clean frontend install, all five frontend tests, type checking and the production multi-page build passed. Rust formatting, Clippy with warnings denied, all 14 workspace tests and the locked release build passed. Independent source review findings were resolved.
- Exact-window captures show the retracted two-pixel hint and the revealed concave-shouldered island with the original mascot, clock and gear. The host remains 360 x 190 logical pixels; no desktop work-area reservation was added.
- The new Settings creation path, native control input, Settings reuse/close, language selection/persistence and live tray localization are not yet accepted through a running UI test. Fullscreen suppression was observed, but the fullscreen application locked the cursor to its primary-screen center; the guarded input fixture aborted. An attempted gear test did not produce a Settings window, so opening Settings remains explicitly unverified rather than inferred from compilation.
- The user subsequently deferred live checks. No further cursor, focus or settings tests were performed; the development app was closed. No Windows scale or animation preference was changed during this revision's checks.
- The separate MCP helper passed its own formatting, Clippy, 12 tests and release build. It has guarded Settings-window capture/UIA fixtures, but their actual control-pattern support remains unverified.

### Candidate installer staging

- An isolated `CARGO_TARGET_DIR` and `tauri bundle --ci --bundles nsis --no-binary-patching` produced `.local/installer-stage-2403/build/release/bundle/nsis/PivO_0.1.0_x64-setup.exe` and its updater signature. Installer size: 2,868,080 bytes; SHA-256: `FAFCCD9D5C99644EDBFA4BE3382A623A06DA56B8F025057F23130D64A58E3479`.
- Extracting the installer without executing it produced an 8,934,400-byte `pivo.exe` with the exact candidate hash `2403B9A114B939C784B3E863AC141D62E4375DB23B8DF059F4E7ABF6C54DED6A`. The original candidate executable was not modified.
- Verification with the configured public key passed; one-byte tampering was rejected by the updater's resolved `minisign-verify` library. Evidence is in `.local/installer-stage-2403/proof.json`.
- This is a staged candidate, not a runtime-accepted release. No application/installer launch or live input action was performed for packaging, and no release was published. The previously verified C713 installer remains at `target/release/bundle/nsis/`.

The sections below record the earlier C713 prototype and its packaging. Their native-input, 150%/200% DPI and sleep/resume passes do not establish the new auto-hide/control behavior. Candidate artifacts must remain identified as candidates until the deferred checks pass.

## Signed updater: 2026-10-30

- Frontend clean install, three motion tests and production build passed. Rust formatting, Clippy, all 10 unit tests and the release build passed.
- After the fullscreen fix, `tauri bundle --ci --bundles nsis --no-binary-patching` regenerated the signed x64 installer and `.sig` without rebuilding or modifying the verified executable. The installer is 2,845,231 bytes, SHA-256 `25FD1E09E8C5D28D01A659772FEF099266D954AFCEBF1DAD0EAA686B66361B72`.
- The NSIS payload was extracted without running the installer. Its `pivo.exe` is 8,850,432 bytes and exactly matches the runtime-tested executable SHA-256 `C713C2D24A22C2A49C15BFB11E5064DA199E6BB570E58A0F2AF2A2732B5D6C9B`. The archive also contains code and asset licenses and the dependency license directory. Runtime acceptance for this executable is recorded in the section below.
- A local check using the updater's resolved `minisign-verify` library verified the regenerated installer with the configured public key and rejected bytes changed by one byte. This tests the artifact signature, not the app's installation path. Release metadata preparation succeeded against the regenerated installer and signature.
- No application launch, installer execution, source/configuration change or release publication occurred during this packaging handoff. An installed-version update, the app's signature-error UI, download progress and restart remain unverified. The update endpoint requires a publicly accessible release. DPI, multiple-monitor, fullscreen, sleep/resume and cross-process pointer checks specifically for the new update controls have not been exercised.

## Previous Tauri 2 prototype: 2026-10-30

The Windows application uses Tauri 2.12.5, Rust 1.99.1, TypeScript 7.0.2 and Vite 8.3.5. The local Windows system has WebView2 Runtime 156.0.4314.50. Node.js 24 is a build prerequisite.

- Frontend type checking, three motion tests and the production Vite build passed.
- Rust formatting, Clippy with warnings denied, all ten workspace tests and the locked release build passed after independent source review.
- That prototype executable is 8,850,432 bytes; SHA-256: `C713C2D24A22C2A49C15BFB11E5064DA199E6BB570E58A0F2AF2A2732B5D6C9B`. The runtime observations in this section apply to that executable.
- The approved mascot is bundled unchanged from assets/mascot.png. Generated Windows icon provenance is in assets/README.md.

The native canvas stays 360 x 190 logical pixels. Its compact visual surface is 120 x 35 within that canvas. Native window geometry alone cannot prove visual expansion. The separate MCP must inspect actual WebView content and verify cross-process input against an independent fixture.

### Runtime observations

- Windows Graphics Capture of the exact PivO window confirmed compact, revealed and collapsed content, the approved full mascot, local clock/date and transparent surrounding pixels. No white canvas was observed.
- Real native clicks on the compact eyes and decorative body reached a separate fixture process. Hover reveal, click dismissal, fresh reveal and click-free leave collapse passed without taking foreground ownership.
- An actual foreground fullscreen fixture hid the panel; leaving fullscreen restored it. Real Ctrl+Alt+P hide/restore and a guarded native close-control click passed, with cursor and foreground restoration verified.
- A traced failure before the fix showed a foreground event arriving before `GetForegroundWindow` reflected the new window. Immediate refresh is now followed by one event-triggered 50 ms reconciliation. A deadline guard prevents an older queued timer message from consuming a newer reconciliation. No periodic visibility polling or temporary telemetry remains.
- A warm capture sequence recorded 42 frames through reveal and an interrupted collapse/reversal. Median capture interval was 16.6697 ms; maximum was 25.0015 ms. Intermediate alpha bounds changed continuously from the compact surface to 360 x 190. These are capture intervals, not compositor frame-rate measurements.
- A short idle sample after warm-up kept the same seven-process tree for 16.5385 seconds. Total CPU use was 0.8503% of one core; the Rust host's CPU delta was zero. Summed working set was 350,261,248 bytes and summed private bytes 150,601,728 bytes. Working-set sums count shared pages more than once; WebView2 dominates this footprint.
- A real sleep cycle recorded a 58,909 ms low-power gap. The same PivO process survived, regained a visible captured interface after the desktop settled and exited normally. Power and lock policies were unchanged; MCP exit was normal.
- With Windows client-area animation disabled, actual compact/revealed/collapsed captures passed the same transparency and original-mascot pixel checks. The exact original preference was restored and read back after the independent watchdog exited; app and MCP cleanup passed. Still captures establish endpoints, not instantaneous transition timing.
- Real primary-monitor scaling at 150% and 200% passed. Each run moved the same app primary → secondary → primary, with native window DPI respectively 144/96/144 and 192/96/192. Compact/revealed captures passed the strict canvas, transparent-area and original-mascot checks at every point; close-control readiness, foreground preservation, cursor restoration and clean exit were verified. The original 100% UI selection and both monitors' DPI, bounds, work areas and refresh rates were restored and independently read back. A preliminary fixture failure was traced to concurrent heartbeat-file replacement; the separate test tool was corrected and the successful run used the unchanged C713 executable.

## Extended checks

- Explicit time-change notification acceptance remains separate from observing the current local clock and sleep/resume refresh.
- Measure displayed motion cadence and longer stability under desktop load.

## Historical evidence

The previous renderer's build, input, resource and real Windows scaling observations are retained in [history/native-prototype.md](history/native-prototype.md). They motivated the preserved behavior but do not validate the WebView implementation.

## Distribution

The portable application must contain the built executable, code/asset terms, THIRD_PARTY_NOTICES.md and the complete licenses directory. The frontend and approved mascot are embedded. The WebView2 Runtime remains a documented Windows prerequisite. Compare archived executable and notice hashes before handoff.
