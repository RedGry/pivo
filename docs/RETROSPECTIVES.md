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
## 2026-10-30: first release packaging command

- Correction: the requested first release did not publish after the workflow was started.
- Cause: application validation passed, but the Windows PowerShell `.cmd` shim rejected forwarded `--locked` in the subsequent Tauri build command. Earlier local proof exercised bundling rather than the exact failing CI invocation; starting the workflow did not prove publication.
- Improvement: `.github/workflows/release.yml` now invokes Tauri through Node and bundles the executable already built with locked dependencies by `scripts/validate.ps1`. `docs/UPDATES.md` documents that same verified path. `AGENTS.md` requires monitoring through packaging/publication and prevents CI-skip markers on protected-main promotions.
- Verification: reproduced the original argument-parsing failure; the corrected exact command produced a signed installer in an isolated target. GitHub published `v0.1.0` with all three assets. The public manifest returned version `0.1.0`; downloaded installer SHA-256 was `3C108AEB06DF73363488E171C6EA7E76E2DE7E7C06A33BC7550EE4100D3393E6`. Its signature verified against the configured public key and a one-byte mutation was rejected. No installer or application was launched for this verification.

## 2026-11-02: Full HD usability acceptance

- Correction: a tester on a 24-inch Full HD monitor reported excessive island size, delayed reveal, weak gaze and unbalanced compact clock placement.
- Cause: the implemented 560 x 160 geometry and 350 ms dwell were explicit previous choices. Prior acceptance did not establish comfortable physical size on this tester's monitor. Weak gaze had a two-logical-pixel maximum.
- Improvement: the current roadmap adds an explicit 1920 x 1080 acceptance target at 100% and 125% scaling, including reveal latency and compact layout. Virtualized rendering is recorded separately from perceived size and smoothness on a physical monitor.
- Verification: reviewed the prior design values and frontend gaze bound; application and guest acceptance results are recorded separately in VALIDATION.md.

## 2026-11-02: preserve density across monitor profiles

- Correction: the global Full HD reduction made the island too small on the user's 2K monitor, where the previous size was comfortable.
- Cause: fixed geometry replaced the earlier fixed geometry for every monitor; no monitor-dependent density policy existed. Full HD feedback was generalized beyond the reported environment.
- Improvement: add explicit selected-monitor scale shared by rendering and native input. Add paired Full HD/QHD acceptance and migration checks to tests/README.md, rather than validating only the newly reported display profile.
- Verification: regression coverage compares both monitor heights and effective DPI; final gate and actual QHD capture are recorded in VALIDATION.md. Full HD guest coverage remains a separate environment requirement.

## 2026-11-03: stable widget alignment and eye motion

- Correction: inconsistent spacing and default controls weakened the expanded layout, visible edge pixels needed inspection, and the eyes moved too far downward while reveal felt abrupt.
- Cause: the panel used fixed control coordinates alongside separately positioned content. Visual acceptance did not include an explicit edge-alpha check or asymmetric gaze limits.
- Improvement: reserve shared rows, style controls in the settings surface, and require layout or DPI changes to invalidate old input until paint. Document the cross-resolution edge and motion checks in DESIGN.md and TEST-ENVIRONMENT.md.
- Verification: the release gate exercises width and input acknowledgment, timed lyrics, and ambient motion. Native acceptance measured QHD and Full HD separately and sampled transparency along the QHD panel sides.

## 2026-11-03: Music control feedback and full widget review

- Correction: Lyrics lacked a dedicated visible entry point, transport alignment was off center, and the timeline waited for provider feedback. Visual review needed to cover every widget.
- Cause: the secondary Music action depended on attached LRC, the transport reused coordinates from other widgets, and the UI displayed only the last provider snapshot.
- Improvement: tie control placement to the active layout, keep a dedicated Lyrics target, and separate the optimistic playhead from provider confirmation. Require page-by-page capture and inspect the tinted perimeter against a contrasting background.
- Verification: final native captures cover all seven pages. The guest seek capture proves immediate display feedback, while a direct provider probe establishes the limit of the synthetic playback test.

## 2026-11-03: widget feedback and native input paths

- Correction: the mascot was too close to adjacent controls, the water and task pages needed clearer hierarchy, and visual feedback omitted playback and charging states. Music lacked a wheel route and the Shelf lacked a file drop target.
- Cause: the island shared widget positioning without checking the painted mascot gap. Media bars were scoped to the Music body, progress overloaded a common ring, and native input only routed clicks.
- Improvement: document the mascot spacing, independent status indicators, water and task visual hierarchy, opt-in lyrics lookup, and native wheel/drop checks. Add tests for wheel detents and artwork color selection.
- Verification: the gate, wheel, compact playback, and widget captures are recorded in VALIDATION.md. The OLE fixture timeout remains explicit.

## 2026-11-03: Mascot scale and Music navigation

- Correction: the mascot was too small, Music lacked the same page arrows as other widgets, and artwork tint stopped above the bottom edge.
- Cause: clearance was gained by reducing the character, the media transport occupied the existing action slots, and the gradient used a bottom-edge mask.
- Improvement: keep configurable mascot size with an independent gesture preference. Keep separate page arrows inside the standard panel footprint and fade the artwork tint only near the curved sides.
- Verification: verify native arrows both from Music and from wide Lyrics, inspect all guest pages, and sample the bottom-center tint and outer corner alpha. Results are recorded in VALIDATION.md.

## 2026-11-03: Mascot palette by theme

- Correction: keep the expanded mascot dark in Dark and light in Light.
- Cause: the first SVG used the inverse mapping to contrast with the panel surface.
- Improvement: record the palette for Dark, Light, and resolved System themes in DESIGN.md.
- Verification: checked the CSS theme selectors against the documented mapping and built the frontend.

## 2026-11-03: Expanded mascot gesture ownership and task rows

- Correction: the paw rose again at the end of the reveal wave, and the completed task row was visually heavy.
- Cause: the independent CSS wave could resume after a widget gesture released the same transform. The task row used a saturated fill for the entire completed item.
- Improvement: document one cancellable gesture path for the greeting and widget poses in DESIGN.md, and keep completion color local to the row checkmark.
- Verification: the reveal regression failed on the old CSS wave and passed after routing it through the shared gesture path. The gesture test also checks that every widget prop returns to zero opacity.

## 2026-11-03: Widget prop lifetimes

- Correction: some props should stay equipped after their entrance gesture, including Music headphones.
- Cause: the first prop animation used the same fade-out endpoint for every item.
- Improvement: document persistent and temporary props in DESIGN.md and declare persistent items on the SVG elements that own them.
- Verification: the gesture test reads the prop declarations and checks the final opacity of all seven items.

## 2026-11-03: Mascot prop fit and settings previews

- Correction: the first props looked detached from the mascot and could not be previewed from their settings.
- Cause: the initial props used flat icon shapes, and the headphones followed a separate transform from the head. Settings exposed palette names without the rendered artwork.
- Improvement: reuse one SVG in the island and the Mascot settings gallery. Give wearables and held props the same anchors as the body or paw that moves them.
- Verification: the gesture test checks that the headphones inherit head motion without applying a second transform. Each settings card mounts the same SVG and exposes its item using the stored palette.

## 2026-11-03: Mascot shape options and foreground readability

- Correction: each item needs its own silhouettes, the slider must stay readable in the paw, and wearable options belong in Clothing.
- Cause: the first skin selector offered the same three palettes for every item. The right paw was painted after the held props and obscured the slider.
- Improvement: define three independent shapes per item and reuse those shapes in the settings previews. Paint the controls in front of the presenting paw and put clothing in its own group.
- Verification: parsed the shared SVG and checked that all nine configurable items have three shapes. The widget regression checks the slider's layer order.

## 2026-11-03: Illustrated holiday interface themes

- Correction: the holiday interface should add themed icons and objects, including a winter garland.
- Cause: the first interface theme changed shared color tokens alone.
- Improvement: define an illustrated icon and header ornament for each theme, independent of the mascot outfit. Record the visual requirement in DESIGN.md.
- Verification: the frontend test checks six distinct icon and ornament pairs, removal when disabled, and independence from clothing.

## 2026-11-03: Immediate indicators and illustrated notices

- Correction: the system indicators lagged behind their inputs and notices rendered as undifferentiated text.
- Cause: HUD and media snapshots waited for periodic polling, and notices carried only a text string.
- Improvement: process supported Windows notifications before the fallback snapshot and carry the notice category and numeric level into the renderer.
- Verification: the focused notice test checks immediate rendering, meter replacement, simultaneous entries, and reduced motion. Native acceptance requires changing Windows volume or playback while Expanded is open and comparing the native change to the next indicator update. The current pivo-debug compatibility click cannot generate those events.

## 2026-11-03: Distinct seasonal layouts and usable calendar controls

- Correction: the title bar ornaments were small and similarly positioned, navigation icons ignored the theme, and Calendar and Tasks lacked clear visual structure.
- Cause: seasonal artwork shared a fixed header slot, and calendar dates and task rows relied on plain text grouping.
- Improvement: give seasonal themes independent placement, including a width-spanning winter garland and a corner web. Add themed navigation badges, visible calendar cell markers, direct date navigation, and dedicated task editor and row surfaces. Document per-occasion outfit variants.
- Verification: the holiday tests cover per-date variant selection and independent interface rendering. The release build and any native acceptance limits are reported with the change.

## 2026-11-03: Holiday glyphs, workspace placement and task order

- Correction: themed navigation should change the glyph itself, and decorations should occupy the marked settings margins. The task composer belongs below the list and the waving hand needs a softer shape.
- Cause: the earlier navigation treatment reused one badge beside unchanged icons and confined artwork to the title bar. Tasks kept creation controls above the editable list.
- Improvement: replace the SVG geometry for each navigation item and restore it when the theme turns off. Mount background art in the four workspace corners, header and content margin, and document the bottom composer and persisted drag order.
- Verification: tests cover all 72 theme and navigation pairs, restoration of the base glyph, unique holiday date icons, country filtering, recurring events and task reorder.

## 2026-11-03: Responsive seasonal scenery

- Correction: garland segments had visible gaps, corner art clipped or collided with the page, and seasonal decoration lacked recognizable scenery.
- Cause: each garland segment was a separate SVG, and mirrored corner overlays shared the content area and clipped against the workspace boundary.
- Improvement: use a single width-aware garland path and reserve the title rail, side gutters, or narrow banner for complete seasonal compositions. Keep these regions separate from settings controls.
- Verification: garland tests cover five widths through 3840 pixels. Rasterized and inspected all twelve scenes together and checked their painted bounds for margins.

## 2026-11-03: Alignment, occasion outfits and track changes

- Correction: form fields and actions needed a shared baseline, navigation tiles lost their individual colors with holiday themes, outfit choices repeated across occasions, the same page lost its wave, and lyrics failed after a track change.
- Cause: a generic form selector overrode the calendar grid and a theme override replaced all tile colors. The seasonal wardrobe reused the same silhouettes. Reveal reset the widget identity, and online lookup dropped plain text and waited for the previous track.
- Improvement: measure representative control layouts at four widths, keep icon geometry independent of tile color, author outfit combinations per occasion, retain the previous page identity, and abort stale lyrics lookups. Document default lookup and local alternatives in PLUGINS.md.
- Verification: static fixtures cover nine control layouts, rasterized bounds cover 78 outfits, and tests cover re-opening the same widget, plain-only results, album differences, and a late response after switching tracks. Live runtime evidence is reported separately.

- Follow-up: calendar icons previously inherited the monochrome date color. Give each holiday explicit icon colors and keep embroidered outfit pins on a separate neutral rendering path. Raster checks confirmed color in all 26 built-in date icons.

## 2026-11-03: Lyric timing and steady track transitions

- Correction: lyric transitions lagged or snapped, the island resized between tracks, and the new holiday costumes looked too similar.
- Cause: lyric updates depended on snapshot cadence and the column width depended on whether the current track had a result. Several recognizable costumes had been replaced with generic silhouettes.
- Improvement: schedule cue changes from a projected playback clock, keep the Lyrics width tied to visibility preference, and preserve recognizable headwear when fitting occasion outfits.
- Verification: tests cover cue deadlines and projection. The separate live acceptance checks track changes and the current column width.

## 2026-11-03: Lyric row motion and wearable anchors

- Correction: the lyric transition should resemble the reference player, the lower accent should cover the island width, and headphones should move with the wave.
- Cause: the previous renderer faded replaced text in one slot, the backdrop used a horizontal mask, and the wave only moved the paw and eyes.
- Improvement: animate neighboring rows by stable cue identity, highlight the active cue only, use a shallow full-width gradient, and animate the shared head transform during the wave.
- Verification: focused tests cover repeated cues, timed gaps, upward movement into the active row, and the wave targeting the head and paw.

## 2026-11-03: Long lyric lines

- Correction: long lyrics ended in an ellipsis.
- Cause: a narrow fixed column truncated adjacent lines and clamped the active line.
- Improvement: widen the column, wrap rows, and document the full-line and overflow checks in DESIGN.md.
- Verification: frontend and Rust tests passed, including the expanded width assertion.

## 2026-11-03: Mascot motion and expression

- Correction: repeated shaking made the mascot feel mechanical, and its eyes lacked a smile.
- Cause: the loop combined rapid squash, translation, and rotation, and the greeting used repeated head turns and a blink.
- Improvement: use a small continuous sway, keep the head steady during the paw gesture, and crossfade to smile arcs during the greeting.
- Verification: the greeting test failed without the smile track and passed after the change. It covers the shared cancellation path for the wave and expression.

## 2026-11-03: Lyrics footprint across displays

- Correction: the wider lyrics panel occupied too much space, and expanded eyes often stayed still.
- Cause: the first width increase did not account for the larger QHD footprint, and expanded eyes only reacted to explicit gestures.
- Improvement: document footprint and line wrapping checks for both resolutions in DESIGN.md. Keep the narrower column and give expanded eyes brief idle blinks.
- Verification: tests passed and the QHD capture showed a 877-pixel window with wrapped lyrics. Full HD scaling was covered by automated tests.

## 2026-11-03: Panel responsiveness

- Correction: the panel still felt insufficiently smooth under quick pointer movement.
- Cause: single open and close traces did not exercise a return to the reveal target mid-fold.
- Improvement: add early reversals and separate first-motion and travel thresholds to the motion acceptance procedure in VALIDATION.md.
- Verification: the window-only comparison recorded both full transitions and rapid reversals.

## 2026-11-03: Shared controls during reveal

- Correction: controls appeared late, widgets switched abruptly, and compact lyrics ended in an ellipsis.
- Cause: the paint acknowledgment gated both input and visibility. Page changes replaced the current content immediately, and the compact lyric renderer used text truncation.
- Improvement: document that shared controls render during reveal while Windows still gates input, and require directional slides for widget changes in DESIGN.md. Keep separate timing thresholds for responsiveness and travel.
- Verification: frontend and native tests passed. The Windows hover probe recorded both opening and closing travel on the new build.

## 2026-11-03: Widget indicator states and Lyrics reveal

- Correction: widget indicators should stay centered as they change from dots to icons, and opening Lyrics should animate.
- Cause: the bar used widget-specific offsets and the rendered panel width switched directly to the native endpoint.
- Improvement: specify both indicator states and the width transition in DESIGN.md. Test the center of the Windows targets at every enabled widget count.
- Verification: release build, frontend tests and Rust tests passed. A PivO screenshot confirmed the resting indicators at the center. The available probe did not exercise hover or the Lyrics toggle.

## 2026-11-03: Closing Lyrics during widget navigation

- Correction: widget indicators moved with the Lyrics width, and closing the column interrupted the widget slide.
- Cause: the pager used the changing total width, and the native window resized before the outgoing content finished painting.
- Improvement: anchor the pager and its input targets to the main content and defer the native shrink until the width animation completes. Record both directions in DESIGN.md.
- Verification: Windows validation passed. The runtime probe clicked all six enabled widget tabs and returned to Music. The live session did not expose the Lyrics column during the capture batch.

## 2026-11-03: Position jump during a Lyrics transition

- Correction: the width animation was smooth but widget transitions still showed a visible jump.
- Cause: the viewport width and the frontend state could update on different frames. The outgoing card also inherited the new widget's layout rules.
- Improvement: pin the island position to the client origin and scope the card layout to the widget itself. Document the intermediate-frame acceptance check in DESIGN.md.
- Verification: Windows validation passed. The runtime probe navigated six widget tabs with a fixed window origin and restored Music. Lyrics was closed in the captures.
