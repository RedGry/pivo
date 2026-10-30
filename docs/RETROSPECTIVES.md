# Development retrospectives

## 2026-10-30: compact theme and expanded dismissal

- Correction: Light mode kept a dark compact island with pale edge artifacts, and interior clicks unexpectedly collapsed the expanded island. The silhouette also needed wider proportions and broader screen-edge shoulders.
- Cause: the compact presentation had its own forced dark overlay, while native pointer observation treated all button-down events as dismissal. The visual theme and input policy had not been checked across all three presentations.
- Improvement: retain one theme-owned silhouette surface, and test expanded interior versus exterior dismissal explicitly. Update the existing acceptance scenarios in tests/README.md to check compact/expanded Light surfaces and inside/outside clicks, including pointer exit; record the revised proportions in docs/DESIGN.md.
- Follow-up correction: the collapsed presentation must be a usable row for future status content, not a barely visible hint. Record its 24-pixel height explicitly and test independent eye suppression rather than assuming that moving the eyes offscreen is sufficient.
- Verification: the revised geometry test failed against the previous 120-pixel width before implementation. Runtime theme and native-input acceptance remains deferred; source and automated checks cannot establish raster quality or cross-process routing.

## 2026-10-30: repeated validation during implementation

- Correction: repeated full checks and manual UI passes made feature development too slow. Bug fixes need a regression test before the fix.
- Cause: project instructions listed mandatory checks without defining when to run them or distinguishing feature development from bug fixes.
- Improvement: AGENTS.md now separates feature, bug and process-only work. `scripts/validate.ps1` batches the final application gate and stops at the first failed command. The retrospective skill records corrective feedback and improves existing process artifacts; the Stop hook reminds only when feedback is pending.
- Verification: focused hook tests and validation-script plan inspection; application checks are intentionally unnecessary for this process-only change. Hook activation still requires Codex trust review.

## 2026-10-30: visible actions before native input readiness

- Correction: island buttons appeared broken, including the Settings gear; the tray path still worked. Waiting for reveal to finish made the gear work.
- Cause: action glyphs faded in during reveal, while their native proxies stayed hidden until the terminal presentation was acknowledged. A second confirmed bug in the compatibility path forwarded synthetic mouse-down to the framework but consumed mouse-up without releasing the decorative owner's capture. The development app was left running after those synthetic tests. The initial validation did not exercise the owned-button path, and the separate helper's private native-input mode had not been discovered.
- Evidence: a real guarded preterminal click at 231 ms reached an independent fixture while the gear proxy was hidden and Settings stayed closed. A settled gear click opened Settings. The first timing log was overwritten by a setup retry; its observed result survives in a clearly labeled derived record rather than being presented as the original raw log.
- Improvement: gate action visibility on the actual processed native acknowledgment, including presentation generation and update revision. Consume compatibility mouse-down on the decorative owner and release only its own capture on mouse-up. Add failing-first visibility tests and explicit native-action acceptance instructions in tests/README.md. Verify the synthetic-pair-then-real-gear sequence, discover private helper modes and preserve distinct failure/retry evidence files.
- Verification: two visibility regressions failed against the extracted previous reveal rule and passed after readiness gating. Final application and real-gear results are recorded in docs/VALIDATION.md; process documentation does not require another application gate.
The final native sequence passed after the capture fix: synthetic pair, capture-free assertion before fixture activation, real gear press/release, Settings opened, cursor and foreground restored. Evidence is .local/native-gear-final-header.log. Header-only follow-up checks passed 20 frontend tests; Rust behavior remains covered by 26 passing tests.

## 2026-10-30: compact status balance and wide Settings

- Corrections: the compact ring hugged the edge while the clock was independently centered; the decorative incomplete ring appeared to imply progress. In a wide Settings window, theme previews stretched into long bars and the language selector separated too far from its label.
- Cause: compact elements used separate horizontal anchors, the ring reused a decorative percentage arc without a progress value, and Settings had no readable content-width limit. The prior optional compact capture showed Eyes, so the new Strip layout had not been accepted visually. The wide Settings state was not captured before handoff.
- Improvement: group compact status with symmetric padding, use a complete neutral ring and bound Settings content/previews/controls. Document those constraints in docs/DESIGN.md. Extend the existing acceptance scenarios to require an actual Strip capture and both default and wide Settings captures for changes to these layouts; a capture of another presentation does not establish the changed layout.
- Verification: CSS parsing and independent review passed. Application results and the accepted capture sizes are recorded in docs/VALIDATION.md. No implementation-mirroring CSS tests were added.
## 2026-10-30: opened dropdowns and final visual acceptance

- Correction: the closed select looked inconsistent, its chevron padding shifted, and the native opened menu did not match the themed Settings page.
- Cause: only the select button had been styled; native picker appearance and the combination of native focus styling with the generic offset outline had not been inspected while open.
- Improvement: retain semantic select controls, use progressive native picker styling with a bounded themed popup and one focus border, and keep a native fallback for older runtimes/forced colors. Add an opened Language-picker capture to the existing Settings acceptance batch, without selecting a different value.
- Verification: the final exact validation script passed 35 frontend and 26 Rust tests. The real native gear, wide Settings, collapsed metadata tiles, opened themed picker and balanced Strip group passed in the separate helper batch. User input and Settings placement were restored; no settings values changed. Final evidence is recorded in docs/VALIDATION.md and .local/native-plugin-library-2.log.

The later progress requirement binds the ring to real active-plugin timer data. Its track remains complete; a partial filled arc now has an actual value. It is hidden for plugins without progress, rather than displaying an invented percentage. This supersedes the temporary decorative full-ring design.