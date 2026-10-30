# Historical native renderer evidence

This report describes the superseded Win32/GDI renderer. Its executable hashes, sizes, resource measurements and UI passes do not apply to the Tauri 2 application. Current checks are recorded in ../VALIDATION.md.

A later real sleep test on the old 77C74C68 build established approximately 60.8 seconds in a low-power state and a timer wake, with the same PivO process surviving. Its immediate post-resume window was hidden and the harness closed it without waiting for later recovery. That test is not a successful UI sleep/resume acceptance result. The original animation preference and both monitors' 100% scaling were verified restored before migration.
# Prototype validation

## Current build: 2026-10-30

- Rust stable 1.99.1, x86_64-pc-windows-msvc, installed MSVC toolset and Windows SDK.
- Formatting, Clippy with warnings denied, all nine workspace tests and the locked release build passed.
- Executable: 164,864 bytes. SHA-256: 77C74C685ED1C05E82ACAED3CE4460DA5E08CA1F4BF1F89EFF13AD0120B4F8BC.
- Tests cover DPI-dependent endpoint sizing, transition reversal/settling, blink and reduced motion, clock scheduling, native PNG decoding/file release, invalid image rejection, and delayed pointer-event batching/reset behavior.
- Native UI uses Win32/GDI and Windows GDI+ without a WebView. The approved transparent mascot is documented in assets/README.md.

## Native input acceptance

A bounded private driver from the separate pivo-debug MCP repository passed against the preceding pointer-sampling build, SHA-256 998A929887FDF65001F74BF01D11E0018960979AC19CA90B26BB37A8967EA59F. The run took approximately 3.08 seconds and used real SendInput movement/clicks, not synthetic PivO reveal messages. The later monitor-refresh change passed the separate quiet regression below; the physical-input sequence has not been repeated on the new hash.

- Visible 120 x 35 compact capsule and 360 x 190 revealed panel at 96 DPI.
- Native eye hover opened the panel twice, including a fresh reveal after dismissal.
- Eye and decorative-body clicks reached a separate fixture process: two verified clicks.
- Foreground remained the independent fixture throughout all proof steps.
- The panel remained above the fixture in native z-order; each tested point hit the exact known fixture, with visible/identity/style guards.
- The underlying click dismissed the panel. A separate fresh reveal followed by click-free mouse departure collapsed it without adding a fixture click.
- Layered, transparent and nonactivating native styles were present.
- The driver closed its fixture; MCP normal close then confirmed PivO was no longer running. A process audit found no remaining PivO or private fixture/driver processes.

This is one successful bounded acceptance run, not a long-term reliability or displayed-frame-rate claim. The summary is retained locally in .local/native-input-pass.json; detailed driver implementation and its own tests remain outside this repository.

## Pointer sampling correction

Debug-only observation showed successfully decoded mouse input with an outside cursor snapshot while the test pointer had subsequently reached the eyes. Immediate cursor sampling was therefore insufficient for that sequence. Pointer packets now arm a single delayed sample at least 10 ms after the first packet; a burst does not postpone it, and any button-down survives a following release. Button-down cancels hover immediately. Hidden or destroyed windows discard pending input. No permanent polling timer was added. Temporary diagnostic properties were removed.

Independent source review found no remaining concrete issue in this change. Earlier failed fixture placement/ordering and hover attempts are preserved in local artifacts; they are not counted as successful native acceptance.

## Rendering and resource observations

Compact/revealed PNG captures and intermediate reveal captures were inspected during the preceding renderer iteration. Eye anchors stayed aligned. Content now fades only when its column fits. These inspections do not establish compositor frame timing.

Earlier static-layout measurements after a 30-second warm-up showed approximately 0.10% of one CPU core over 31.20 seconds, handles stable at 135, working-set growth of 20,480 bytes and private-memory growth of 36,864 bytes. These are historical observations, not measurements of the current animated build or long-term guarantees.

For the preceding pointer-sampling build, a compact-state sample after 15 seconds of warm-up ran for 32.579 seconds. CPU increased by 0.28125 seconds, approximately 0.863% of one core. Working set changed from 11,161,600 to 11,169,792 bytes; private bytes from 3,010,560 to 2,912,256; handles stayed at 130. Raw data remains in the separate helper's .local/resource-998a9298.json.

For the current release hash, the same quiet procedure ran for 32.563 seconds after 15 seconds of warm-up. CPU increased by 0.34375 seconds (approximately 1.056% of one core). Working set changed from 11,137,024 to 11,112,448 bytes; private bytes from 3,022,848 to 2,924,544; handles stayed at 131. At all three samples the panel was visible, 120 x 35 and nonforeground. This is a short desktop-session sample, not an input-free idle or long-term stability guarantee. No cursor, fixture or focus actions occurred; the test-owned instance closed normally. Raw data remains in the helper's .local/resource-current.json.

Read-only display inventory found two active 2560 x 1440 monitors at 100% scaling: the primary at (0, 0)-(2560, 1440), 240 Hz; the secondary at (-2560, 0)-(0, 1440), 144 Hz. Both work areas end at y=1392. This inventories available test hardware; it does not prove migration behavior or mixed-DPI operation.

## Monitor and lifecycle regression

A quiet native test on the current release hash passed placement on both actual monitors: compact rectangles (1220, 0)-(1340, 35) and (-1340, 0)-(-1220, 35), both at 96 DPI and inside their work areas. The original geometry was restored, foreground stayed unchanged and normal exit was verified. No cursor, keyboard, fixture, focus-forcing or system-setting actions occurred. Evidence remains in the separate helper's .local/lifecycle-candidate-77C74C68.json.

The test also passed simulated hotkey-handler hide/restore, preservation of user-hidden state across simulated power notifications, response to a time-change notification, and simulated suspend/resume visibility. These messages do not establish actual shortcut delivery, a real clock jump or sleep/resume.

The monitor check exposed GDI VREFRESH returning the primary 240 Hz even while PivO was on the 144 Hz secondary. Product pacing now reads the current monitor's device mode through MONITORINFOEXW and EnumDisplaySettingsW. A monitor change refreshes that selection and fullscreen suppression. This fixes selection of the configured rate; actual displayed cadence is still unmeasured.

## Windows animation preference

A serialized test changed the real SPI_SETCLIENTAREAANIMATION preference with SPIF_UPDATEINIFILE | SPIF_SENDCHANGE, then restored the saved enabled value with readback. An independent restore watcher acknowledged readiness before the change and exited after restoration. The same PivO process (PID 24240, current release hash) stayed running across both preferences.

With animations disabled, captures at approximately 10, 72, 135, 244 and 306 ms were all 360 x 190 and byte-identical. With animations enabled again, captured sizes progressed through 149 x 53, 228 x 105 and 328 x 169 before reaching 360 x 190 at approximately 243 ms. This verifies live preference refresh and sampled application rendering, not compositor cadence or the absence of every idle wakeup. The reveal used the MCP's synthetic compatibility click; native input is covered separately above.

Earlier runs using SPIF_SENDCHANGE alone did not demonstrate live re-enabling and are not counted as passes. A separate helper correction queues WM_NULL after its synchronous compatibility click so an idle GetMessage returns and the application's animation loop can run. This changed the external test helper only; the PivO executable hash is unchanged. Evidence is retained in the helper's .local/reduced-motion-result.json and reduced-off/reduced-on PNG series.

## Real display scaling and mixed-DPI migration

The Windows Display Settings scale selector was changed to 150% and 200% on the primary monitor while the secondary stayed at 100%. Native monitor inventory confirmed 144/96 DPI and 192/96 DPI respectively. For each setting, the same test-owned PivO process moved primary -> secondary -> primary, with per-window DPI, work-area containment, compact/revealed geometry and nonforeground state checked at each stop.

| Primary scale | Primary compact / revealed | Secondary compact / revealed |
| --- | --- | --- |
| 150% | 180 x 53 / 540 x 285 | 120 x 35 / 360 x 190 |
| 200% | 240 x 70 / 720 x 380 | 120 x 35 / 360 x 190 |

The 200% revealed capture was visually inspected: mascot and text fit the panel without a white background. Each test-owned app closed normally. The saved 100% selection and both monitors' original DPI, bounds, work areas and refresh rates were restored and verified; the independent restore watcher exited. Evidence and PNGs remain in the separate helper's .local/dpi-session-72922146ed674dffaa93f3eec647446a/.

These scale tests used synthetic compatibility reveals and native window placement, not physical dragging or a repeat of the cross-process click fixture at every DPI. Earlier failed automation attempts are retained locally and are not counted as product passes. The first failed attempt did not change scaling; its original state was independently verified. The second changed scaling to 150% but stopped before product inspection; restoration to 100% passed.

## Remaining acceptance work

- Actual displayed animation cadence, stutter/flicker and reversal under desktop load.
- Instrumented confirmation of stopped idle frame updates; native reduced-motion behavior passed as recorded above.
- Fullscreen transitions; real display scaling and mixed-DPI migration passed as recorded above.
- Real sleep/resume and system time-change refresh; timer math and earlier natural minute advancement do not prove these cases.
- Ctrl+Alt+P hide/restore and pointer exit-control acceptance on the current build.
- Revealed-state resource measurements and longer stability testing; a current compact-state sample is recorded above.

The first prototype's broader desktop acceptance remains open until these checks are completed.

## Distribution

The portable archive includes code/asset terms, full Microsoft MIT terms for windows-sys 0.61.2 and windows-link 0.2.1, and the installed Rust toolchain's unmodified library copyright report. Source-component notices do not assert that every listed component contributes machine code to the optimized executable. Extracted executable, mascot and notice files are compared with the build/source files before handoff.
