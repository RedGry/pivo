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

## Full HD feedback candidate (2026-11-02)

- `pwsh -NoProfile -File scripts/validate.ps1` passed outside the sandbox using the local Rust toolchain and npm cache: 37 frontend tests, 27 Rust tests, frontend build, formatting, Clippy and release build. An initial sandboxed npm install stalled and was interrupted before any checks completed.
- Separate pivo-debug launched the release executable and reported a visible 480 x 144 physical-pixel client on the selected monitor, without foreground ownership. A synthetic compatibility click revealed the island; capture showed the mascot, clock and Pomodoro. This does not prove real hover, click-through or timing.
- Both host displays reported 2560 x 1440 at 100% scaling. The private `--verify-tauri-input` driver rejected the current canvas with `Unexpected Tauri canvas bounds`; its fixture expects the older 360 x 190 geometry. Native input and Settings interaction were not established.
- `scripts/testing/start-sandbox.ps1` generated a read-only payload and requested launch, reporting `Launched: True`. A subsequent process query found no WindowsSandbox process. Guest boot, WebView2, 1920 x 1080, 125% DPI and guest tests remain unverified. Multi-monitor transitions, fullscreen, actual resume and motion timing were not rechecked in this batch.
- Follow-up diagnosis: reading `Containers-DisposableClientVM` with `Get-WindowsOptionalFeature -Online` failed with an elevation-required error, even outside the execution sandbox. Administrator access is required to establish the host feature state; no Windows features or reboot settings were changed.

## Monitor-aware scaling candidate (2026-11-02)

- Final `scripts/validate.ps1` passed frontend tests and build, Rust formatting, Clippy and 30 Rust tests. Its release build could not replace the running previous executable (Windows error 5). After a normal MCP close, the affected locked release build was rerun and passed; evidence is `.local/validation-monitor-scale.log` and `.local/validation-monitor-release-retry.log`.
- On the 2560 x 1440 selected monitor at 100% DPI, the fresh release process reported a visible 560 x 168 client without foreground ownership. Public MCP captures showed the compact eyes and clock, and a synthetic click revealed the mascot, clock and Pomodoro. These captures do not establish native hover, pointer forwarding or motion timing.
- Full HD, 125% DPI, real multi-monitor transitions, fullscreen, sleep/resume, Settings interaction, and Windows Sandbox guest boot remain unverified. The private native fixture still targets 360 x 190 and cannot validate this candidate.

## Windows guest and native-input follow-up (2026-11-02)

- The user confirmed Windows Sandbox is Enabled. The installed `wsb` CLI identified the owned guest `a47245d3-3e33-4b67-9beb-8ac7739526f4`; guest execution and a dedicated evidence share work. This supersedes the earlier unconfirmed-boot result.
- The initial guest measured 2032 x 1111 at 96 DPI. Its driver did not advertise 1920 x 1080. Resizing only the owned Sandbox client to an outer 1936 x 1121 (including its border and toolbar) produced independently measured 1920 x 1080 at 96 DPI. Host monitor resolution and DPI were unchanged. Evidence: `.local/sandbox/58c1d679b5c94e3c9408cde4c6bffcaa/results/viewport-fullhd.json`.
- The offline Microsoft WebView2 installer signature verified. Guest registration already contained the documented WebView2 product identifier with a positive version, under the display name `Microsoft EdgeWebView`. The launcher now detects by identifier/version and skips unnecessary installation. Regression tests cover the actual label and missing/invalid registrations.
- The reviewed isolated native helper passed against the actual host QHD PivO process in Strip mode: deliberate hover, separate-process decorative click-through, interior clicks staying open, exit grace cancellation, old-body non-reveal, fresh reveal and foreground retention. The fixture counted two actual clicks; readiness took 542 and 543 ms, including dwell, animation and acknowledgment. This is not direct compositor timing or Eyes-mode acceptance. Evidence: `.local/native-monitor-aware-result.log`.
- The first guest MCP smoke matched the Full HD profile but could not initialize its helper. Exit code 0xC0000135 and PE imports identify a test-tool runtime dependency (`VCRUNTIME140.dll`); the PivO executable does not import that DLL. Early-helper-exit diagnostics now retain stderr and exit code. The later static-CRT helper resolved the dependency; no application changes were required for this tool issue.

## Final Full HD guest acceptance

- The repeatable wrapper completed with independently measured 1920 x 1080, one display and 96 DPI. The exact application hash remained E52B99791D4B30BC8902DD5B0AF14F2ADCCFF640EEC0DDFD7EA0E839E4532A23. Native hover, separate-process decorative click-through, interior-click retention, exit grace, old-body non-reveal, fresh reveal and foreground retention passed in Eyes mode; clean application exit passed.
- Windows Sandbox's default reduced-motion policy was read as client-area animations disabled. The native-ready Expanded PNG was visually inspected: 480 x 144, original mascot, aligned date/time header, Pomodoro value and action labels without overflow. Evidence: `.local/sandbox/df8d20e1da6c4b8782ff02a48de8c6e1/results/`.
- The same Full HD batch passed with client-area animations enabled only inside the disposable guest. Reveal readiness measured 614 and 645 ms, including dwell, animation and frame acknowledgment; these are not compositor frame timings. The expanded PNG was visually inspected. The guest's original animation value 0 was restored and independently read back. Evidence: `.local/sandbox/a634112630264c36b105d2b5297ac478/results/`.
- Only the native-ready image is named `expanded-candidate.png`. The public compatibility click did not establish reveal in this guest; its image is separately named `after-synthetic-candidate.png`. Earlier synthetic-only capture claims are superseded by these verified native captures.
- Guest runtime discovery was independently diagnosed with Microsoft's loader API: default lookup returned 0x80070002 while the explicit installed folder returned version 156.0.4314.58. The guest-only environment override allowed the unchanged application to initialize. No host runtime, registry or display settings changed.
- Native Settings gear activation opened the actual host Settings window. Its cleanup restored the cursor but Windows did not restore the previous foreground, so that complete fixture attempt is not counted as a pass. A separate exact-window WGC capture was visually inspected: the sidebar contains Pomodoro and no plugin import manager. Capture extent 862 x 642 includes the non-client frame; client size is 860 x 640. Evidence: `.local/settings-monitor-aware.png` and `.local/settings-monitor-aware-result-2.log`. Live duration-form edits were not exercised.
- The final isolated helper passed formatting, Clippy, 14 tests and static release build. Its actual Settings capture was checked; application source was unchanged after the previously successful application gate. Tracked guest transport/staging/runtime regression checks cover UTF-8/BOM, early exits, startup readiness, unique guest mappings, target ID binding and native evidence gating.
- Coverage limits remain explicit: 125% native DPI, real selected-monitor transitions/reconnect, fullscreen and actual sleep/resume were not exercised in this batch. The two host monitors remained 2560 x 1440 at 100%. The Sandbox viewport remains at the verified Full HD size; its PivO test process exited normally, and the host application remains running for inspection.
- The user confirmed that Windows Display settings in this Sandbox session do not expose scale selection. No 125% result is claimed; the wrapper still accepts a separately configured 125% profile and verifies the actual measured DPI.

## Built-in widget acceptance

- The complete application gate passed with 43 frontend tests, 33 Rust tests, TypeScript, formatting, Clippy and the locked release build. The tested application SHA-256 is `67E7A7C91A43EF1BEF0A9375F382B27A66520829D8CBEE8EBF4444DA9C55576A`.
- Seven native Next clicks on the actual 2560 x 1440 host cycled through all seven pages and returned to the initial Pomodoro page with its saved countdown. The fixture restored the cursor and retained the foreground window. Eight inspected captures are in `.local/widget-navigation/`. Music read the current Windows media session. HUD reported real host volume, brightness and input language.
- A deliberate native gear click opened Settings. The exact-window capture in `.local/widget-navigation/settings.png` shows the seven widget tabs. The fixture restored the cursor and foreground. Individual Settings forms and file picker actions were not exercised in this batch.
- The Windows Sandbox batch matched 1920 x 1080 at 100%. Native reveal, separate-process click-through, foreground retention, dismissal and normal exit passed. Expanded capture and reports are in `.local/sandbox/24d368e2a99d4faf935694da7252e4ab/results/`.
- LRC parsing, calendar and reminder calculations, shelf capacity and HUD conversions have automated coverage. Live playback actions, delivery at real reminder deadlines, hardware transitions, 125% DPI, fullscreen and sleep/resume were not exercised for this candidate.

## Nusa-inspired widget presentation

- The application gate passed with 43 frontend tests, 33 Rust tests, TypeScript, formatting, Clippy and the locked release build. Executable SHA-256 is `0782C67F3311B012B52036977A8EFC9A678EA9CA01BD6F8F1E39429130046778`.
- On the 2560 x 1440 host at 100%, the private fixture captured page dots, their hover icons, native selection and the return to Pomodoro through the fourth slot. The host had six enabled widgets. The Next sequence reached each enabled card and retained foreground ownership. A native gear click opened Settings and the exact-window capture shows the compact colored sidebar. Evidence is in `.local/nusa-layout/`.
- The 1920 x 1080 Sandbox run at 100% showed all seven page indicators. Native hover, separate-process click-through, foreground retention, dismissal and normal exit passed. The Expanded capture was inspected. Evidence is in `.local/sandbox/97c5051df5e942bf8ed5e9bc16fa43aa/results/`.
- The layout draws from the user-provided Settings references and the public Nusa preview. Widget cards render PivO data and use PivO artwork and glyphs. The Settings capture covers the sidebar and Appearance groups. Individual settings forms and 125% guest DPI were not exercised in this batch.

### 2026-11-03 layout, Lyrics, and eye motion

Release SHA-256 `1F00F6D0B581D18C6468246F11FD285CEF761E13F0C9C3869C2C57785DAAF362`.
`pwsh -NoProfile -File scripts/validate.ps1` passed 46 frontend and 37 Rust tests, type checking, Clippy, and release build. The width transition test rejects old paint acknowledgments. The gaze regression covers pointer activity after gaze saturation.

- QHD host at 96 DPI, 560 × 168 client. All six enabled pages selected through native targets. The Pomodoro PNG had zero nontransparent pixels in the two side columns below the top shoulder, and an opaque bottom center. Separate-process click-through, foreground retention, deliberate hover, exit grace, and stale-body rejection passed. Native readiness after hover was 570–572 ms including dwell and paint acknowledgment.
- Windows Sandbox, 1920 × 1080 at 100%, 480 × 144 client. Eyes-mode native input, foreground retention, click-through, and normal exit passed. Native readiness was 183–186 ms in the guest. These durations are readiness measurements and do not establish compositor frame pacing.
- Evidence is local under `.local/eyes-lyrics` and `.local/sandbox/24873992f1fb4f9e9ed35a698cb29c46/results`. Fractional guest DPI, monitor migration, fullscreen, and suspend/resume were outside this run.
- The guest fixture registered a silent 120-second GSMTC session, selected a staged LRC through the verified PivO Settings-owned WebView2 dialog, and received the application's import confirmation. All seven pages were selected. Music with Lyrics measured 656 × 144 and Pomodoro measured 480 × 144, both at x=720, y=0 in the same process. The active line, neighboring lines, and player actions fit their own rows.
- The synchronized text advanced from the middle cue at approximately 0:08 to the next cue at 0:58, past the fixture's 0:50 boundary. Screenshots are `goal-page-1.png` and `lyrics-later.png`. Backward cue selection was verified by the frontend unit test.
- A separate Full HD Eyes capture used the same staged release with Windows client-area animation temporarily enabled in the guest. The private pivo-debug fixture collected 26 timestamped frames and triggered wake with guarded native pointer motion. The rendered eye height measured 12–13 pixels open, 7 during blink, 2 during sleep, then 6 in the asymmetric first wake frame and 12–13 after reopening. The initial guest animation preference was restored and verified. Frame captures are in `.local/eyes-lyrics/eyes-frames/`. Capture latency was roughly 290–450 ms, so this batch demonstrates visible pose transitions without measuring display frame pacing. The motion scheduler and continuity tests cover the behavior between those samples.
- Compact shoulders and Strip expressions passed the release gate with 47 frontend and 37 Rust tests (SHA-256 `2F837A6C0A6EE57BF17D77A7654C84856C505CF4723C7A6A774317ABF85CB12E`). Inspected Eyes on Full HD and Strip on QHD over a contrasting background. A captured blink showed both mini eyes compressing while the clock stayed fixed. The scheduler test covers the single-eye wink. Full HD Sandbox native input and clean exit passed (`.local/sandbox/d29efa4cca8f447ca83dc402b40f8d50/results`).

### 2026-11-03 music controls and widget compositions

- The application gate passed 48 frontend and 38 Rust tests, TypeScript, Clippy, formatting and release build. The subsequent presentation-only refinements passed TypeScript and the locked release build. Final executable SHA-256 `9F68E2410FBC044E0AC969BA9DACA2794922259845FD454982CFBEFE8173C3E0`.
- All seven pages were selected and visually inspected in Full HD Sandbox at 100%, and all six enabled host pages were inspected on QHD. The native guest input batch and normal exit passed. Screenshots are under `.local/sandbox/8b8dc085610d46e9985a82881044ce3f/results` and `.local/music-controls`.
- The dedicated Lyrics control toggled the native canvas between 480 and 656 logical pixels. The first post-click seek capture displayed 1:00 and the corresponding lyric cue. The synthetic provider's raw position stayed near 12.1 seconds. A direct WinRT probe returned accepted but also left its timeline unchanged, so successful provider playback movement remains unverified. Tests cover stale seek reports and preview reconciliation.
- The QHD artwork tint faded into the black outline. Pixel inspection of the revised capture found no bright partially transparent pixels in the lower perimeter, where the earlier capture showed a bright fringe.

### Widget feedback, wheel navigation, and Shelf drop

- The full gate passed 53 frontend and 39 Rust tests, type checking, Clippy, and locked release build. The final mascot spacing adjustment passed type checking and a second locked release build (SHA-256 `FB86152BF511D0202A11E2D9A3975B2C61857F68AF06F70891B6C31498CDCC7B`).
- On the gate candidate, all seven Full HD Sandbox pages and six enabled QHD pages were captured. Native wheel over Music advanced and returned without changing foreground ownership. Full HD separate-process click-through and clean exit passed. A synthetic playing media session showed the new audio bars in both Strip and the Expanded header. A real charging battery was unavailable.
- LRCLIB returned synchronized text for its public documentation example. Provider tests cover encoding, bounded responses, and transient failure. Lookup is opt-in and the user's track was not queried. Live Yandex Music lyrics availability remains unverified.
- Shell fixture verified a real CF_HDROP object and delivered movement and button release to the Shelf target, but both Shell and direct OLE drag loops exceeded the guest deadline. The end-to-end drop and persistence check remains unverified.
- Evidence is under `.local/sandbox/97e50de44c8a42a4971fbe41796d736e/results` and `.local/widget-input-status`.

### Mascot presets, Music arrows, and wider Lyrics

- Final validation passed 55 frontend and 40 Rust tests, TypeScript, Clippy, formatting, and locked release. Executable SHA-256 `AECE3D8DD172DBAEF6B10D5EBD79CC8A73D63817312277F83EB9F3BAD29B424C`.
- Full HD Sandbox passed separate-process click-through and normal exit. The synthetic track with a locally imported LRC showed the wider Lyrics column. Both Music widget arrows navigated and returned without invoking track transport. The right arrow remains inside the standard footprint so shrinking the island cannot strand the cursor outside it. All seven widget slots were selected. Evidence is in `.local/sandbox/febe10eaab234b60805a74d01eff004f/results`.
- Inspected six enabled QHD pages on the candidate before the arrow-anchor correction. The mascot remained clear of the page arrow. The sampled bottom-center pixel was opaque artwork tint, and the outer bottom corner was transparent. Evidence is in `.local/mascot-music-pages`.
- Lyrics lookup uses album metadata and a bounded, normalized search fallback with opt-in. Tests cover ambiguous and inaccurate matches. The user's Yandex Music track was not queried. The guest used a local test LRC. Mascot setting defaults and motion are covered by tests. Interactive changes to every mascot setting and the full set of live gestures were not exercised in this batch.

### Centered mascot, background layering, and expanded input

- Final gate passed 55 frontend and 42 Rust tests, type checking, formatting, Clippy, and the locked release build. SHA-256 `9AF8F426C086B17F4FC748487F920E8D4E1B81F8467DD91CEC9D2948A4B80BB5`.
- Final Full HD Sandbox passed the separate-process input test. Two interior clicks were received by the Expanded input surface and did not reach the other process. One outside click reached that process. Foreground ownership was retained, and all seven widget pages were selected. Evidence is in `.local/sandbox/5d90d04339634fd7bc6186c30739d91d/results`.
- Final QHD captures show the mascot centered in its leading slot above the page arrow. Music tint reaches the lower edge behind the mascot and controls. The System preview capture from the preceding candidate shows its clipped light/dark background without the previous light seam.
- Shelf has a dedicated card-size target and retains it after raw button release until OLE Drop or Leave. The guest fixture confirmed target visibility with a held button, then timed out in the OLE drag loop without confirming a stored file. A real Explorer drop remains unverified.

### Shelf actions, task rows, and playback feedback

- The final gate passed 56 frontend and 44 Rust tests, type checking, Clippy, formatting, and locked release build. SHA-256 `E87B0A08EEEECF1B5993718242146778F6DF783091AF7D386E0AFE2F3655ECCB`.
- Full HD Sandbox passed native input and clean exit. A disposable task was created through Settings, its native island row was clicked, and Settings verified the change from Off to On. The Shelf Remove action removed only the disposable shortcut and preserved the source bytes.
- The guest delivered the Shelf Open action but did not expose the exact disposable filename in Notepad. Launching the associated editor remains unverified. Dragging from a different widget through an actual Explorer drop and playback command latency in an external player were not exercised. The new playback test covers the immediate optimistic indicator and stale reports.
- Results are in `.local/sandbox/6d7f606448804038a840b95244e1a7bd/results`.

### 2026-11-03: Alignment and live lyrics

- The static alignment fixture measured nine control layouts at 760, 920, 1440 and 2560 CSS pixels. The expanded Settings calendar was captured with the separate pivo-debug helper to confirm the event form baseline and retained navigation tile colors.
- Rasterized 78 occasion outfits and verified the art stays inside the portrait view box. Verified distinct outfit options and colored calendar glyphs in frontend tests.
- The user authorized the LRCLIB queries. It returned plain text for Drag Me and synchronized text for Snow in the Ocean. The rebuilt PivO displayed the synchronized lyrics from the running Yandex Music desktop session. Regression fixtures cover plain text, mismatched album metadata and overlapping requests after a track change.
# Nusa motion comparison

Window-only capture probes measured pointer-driven transitions on Windows. The repeat Nusa trace reached 5% and 90% of the opening width in 56 ms and 212 ms, and 8% of the closing travel in 55 ms. The PivO trace with the guarded native visibility updates measured 93 ms, 205 ms, and 163 ms at the same thresholds. These measurements include frame readout latency and each value describes one run.

In an earlier PivO run with the three-stage curve, the median interval between captured frames with width changes of at least five pixels was 16.7 ms and the 95th percentile was 20.8 ms. The repeat Nusa trace gave the same rounded values. Closing response remains the largest measured gap. The probes run outside the application repository and retain numerical traces without recording video.

Three subsequent runs per app timestamped pointer commands and captured frames on the same performance counter. PivO reached 5% opening in 83–100 ms, 90% opening in 187–197 ms, and 8% closing in 98–113 ms. Nusa reached the same thresholds in 38–42 ms, 192–193 ms, and 34–39 ms. The PivO build used a 20 ms entry dwell, a 15 ms exit dwell, and published transitions for visible panels before updating native controls. These ranges exclude frame readout latency. They include the time between submitting the pointer command and Windows delivering the resulting input.

Reducing the PivO exit dwell to 10 ms brought its measured 8% closing threshold to 76–93 ms across three runs. A repeat with matching SendInput movement put Nusa at 34–36 ms in the two runs that crossed the threshold. One Nusa run did not cross it. The 10 ms PivO build passed the Windows validation script.

On that build, a native click on a timed lyric advanced the paused media session from 0:07 to 0:18 and highlighted the selected line without focusing PivO. The Settings and About windows rendered with the new application icon. Selecting display 1 on the map moved the panel to the other physical monitor. Selecting the original display 2 restored its position.

The later no-exit-dwell build reached 8% closing in 61–79 ms. Rapid pointer return to the compact target reversed the fold in 53–81 ms, compared with 98 ms in the earlier reversal trace. The later build passed validation with 96 frontend tests and 44 Rust tests. These figures describe that measured build and its monitor configuration.

For motion acceptance, measure both a full open/close cycle and repeated early reversals on the same monitor. Record first visible motion separately from near-full travel and report capture cadence with the input-to-motion thresholds.

### Panel layout and directional widget transitions

- The Windows release build passed all 96 frontend tests, 44 Rust tests, type checking, formatting and Clippy.
- One QHD window-only hover trace measured 110 ms to 5% opening and 198 ms to 90% opening. Two closing samples reached 8% in 57–67 ms. The expanded canvas was 560 by 182 physical pixels. The first-motion gap to the previously measured Nusa remains open. Evidence is in `.local/pivo-layout-hover.json`.
- The Settings-opening probe exited with an access violation. The About and Settings changes, widget slides and compact lyric overflow were not visually accepted on this build. Fullscreen, resume and live mixed-DPI input were not exercised.

### 2026-11-04: 0.2.0 release candidate

- Accumulated development work was assembled on `release/0.2.0`, now the repository default branch. Workspace, frontend, Tauri and lockfile versions agree on 0.2.0.
- `scripts/validate.ps1` passed 135 frontend tests, 51 Rust tests, TypeScript, formatting, Clippy and the locked release build. Release metadata and retrospective hook tests passed (8 tests); Sandbox launcher and Desktop PowerShell guest-smoke regressions passed. Final local executable SHA-256: `9D19932865924CD590A818537ED875B769BDA9E8DF6629799E570056449840BA`.
- Independent review corrected native lyric click coordinates by translating the input shield origin into the WebView client before DPI conversion. The regression failed before the correction and passed at 96, 120 and 144 DPI plus the default-DPI fallback.
- Final pivo-debug acceptance opened Settings, captured hover motion and a visible panel without foreground ownership, and verified normal application exit. Both physical monitors reported 96 DPI. Evidence is under `.local/release-0.2.0/runtime/`.
- Current native input, fullscreen and lifecycle fixtures encode obsolete window geometry and failed before their behavioral assertions. They do not establish current separate-process input or lifecycle acceptance. Actual sleep/resume and mixed-DPI behavior were not exercised. The observed capture access violation was attributed by the Windows event log to the separate debug helper and `GraphicsCapture.dll_unloaded`, not the PivO process.
- A disposable online Sandbox installed the published signed 0.1.0 installer (SHA-256 `3C108AEB06DF73363488E171C6EA7E76E2DE7E7C06A33BC7550EE4100D3393E6`). Settings confirmed English and Light with UTF-8 preferences without BOM. The existing guest WebView2 discovery workaround was required. Disabling only the guest Ethernet produced a visible update-check error; restoring it and retrying succeeded. This tests feed-check failure/retry, not interrupted downloads. Evidence is under `.local/release-0.2.0/results/`.

- Installed-version transition from 0.1.0 to 0.2.0, modified-installer rejection, interrupted-download recovery, automatic restart and clean uninstall remain unverified until the new release is published and exercised.

### 2026-11-04: Published 0.2.0 and installed update acceptance

- PR #2 passed both required `windows` checks and merged into protected `main` at `b6db73aacc176a1f489a72334cfa47319901d697`. The immutable `v0.2.0` tag points to that commit. `release/0.2.0` is the default development branch.
- Windows release run `41881814301` completed successfully and published 0.2.0 at `2026-11-04T18:06:32Z`. Anonymous requests to the production latest endpoint returned version 0.2.0 and the immutable versioned installer URL. The installer, signature and manifest were uploaded completely.
- Published installer SHA-256: `007632048AF7C79F4779211D991107555E0DF1D116FAF2C909B6ECCB1141EAD5` (2,796,480 bytes). Its manifest signature matches the signature asset. The same `minisign_verify` library and verification mode used by Tauri accepted the published bytes with the embedded public key and rejected a one-byte modification. This is an artifact-verifier check; a completed negative signature attempt through the application UI was not established.
- A disposable guest updated the installed, signed 0.1.0 release to the published 0.2.0 through the native update action. The first attempt failed before signature verification with `error sending request for url` for the installer URL. A read-only request from the same guest then returned HTTP 200 and the expected digest. One native retry installed 0.2.0 and automatically started a new process. No manual installer execution substituted for that update.
- The guest's default WebView2 loader returned `0x80070002`. The official Microsoft offline runtime installer had a valid Microsoft signature but exited with `0x80040902`, and default discovery remained unavailable. The first automatically restarted process therefore had no WebView child and stayed hidden; a manual launch with the known guest runtime folder displayed the updated interface.
- To exercise automatic UI restart, the fixture temporarily configured the existing runtime folder in the guest user's environment, verified inheritance by a fresh process, and repeated only the installed transition. Version 0.1.0 PID 1664 became version 0.2.0 PID 11708; pivo-debug confirmed the new process was visible without manual relaunch. This proves automatic restart under the documented guest workaround, not default WebView2 discovery in that Sandbox image.
- The installed executable SHA-256 was `6181A1AF2368CA47BCEE62AD5A5804DA406322DD147F5C4C76A6860EB271B5BC`, identical to `pivo.exe` extracted from the published installer. PE file and product versions were 0.2.0. English and Light were visually confirmed after the update; their preference hashes matched the pre-update values exactly.
- Offline feed-check failure and retry passed on installed 0.1.0. A separate synthetic higher-version feed displayed download progress at 3% and 34% in 0.2.0, but its listener ended before the corrupted download completed. A later bounded attempt failed at the feed check. Neither run establishes application-UI signature rejection; temporary guest hosts mappings and certificates were removed.
- Clean uninstall of the updated 0.2.0 passed: after the NSIS child finished, the executable and per-user uninstall registration were absent and no PivO process remained. The temporary guest user environment value was restored to its original unset state.
- Evidence is under `.local/release-0.2.0/fresh/results/`: `repeat-timeline.jsonl`, `panel-status.json`, `liveness.json`, `user-runtime-check.json`, `runtime-repair.json`, `download-diagnostic.json`, `uninstall-final.json` and `user-runtime-restored.json`. Current fullscreen, mixed-DPI, actual sleep/resume and native Explorer-drop limits remain as recorded above. Publication and these checks do not establish every Windows desktop configuration.
