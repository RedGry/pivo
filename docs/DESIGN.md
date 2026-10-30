# Design notes

Source: the user-provided mascot discussion, reviewed on 2026-10-29. The approved static character has been prepared in that conversation and imported as assets/mascot.png. See assets/README.md for provenance and file metadata.

The discussion describes a minimal rounded character with eyes and small arms, a top panel, lilac accents and optional accessories such as a sprout, headphones, a scarf and hats. The application is named PivO.

Later ideas include music, a calendar with a prominent current date and weekday grid, compact system-stat cards, connected AI agents and customizable widget order. These are ideas, not implemented capabilities.

## Confirmed presentations

The source discussion was read from its opening brief through the final design and later corrections on 2026-10-30. Later user corrections take precedence over earlier proposals.

- **Strip:** the approximately 180 x 40 logical capsule retracts 16 pixels above the physical screen edge, leaving a 24-pixel compact row without eyes. This row can accommodate future text or status content; none is implemented yet.
- **Eyes:** the complete compact 180 x 40 capsule and the original eyes remain visible.
- **Expanded:** one continuous island, approximately 560 x 160 logical pixels, joins the screen edge with broad concave shoulders and rounded lower corners. The approved character sits on the left; content and the aligned clock/settings/exit header sit on the right.
- **Auto** selects Eyes when the compact footprint is unobstructed and Strip when any visible ordinary top-level window overlaps it. Minimized, cloaked, desktop and transparent decorative windows do not count. Normal Settings windows and overlapping taskbars do count. Users may force Eyes or Strip.
- Reveal through the centered 180 x 24 logical row target in Strip or the deliberate 40 x 28 eye-cluster target in Eyes. Hover briefly or click; movement through the old body area must not reopen the island. Move outside the expanded bounds to fold it after a short grace period; outside clicks also fold it. Interior clicks, including the face, leave it open.
- Preserve eye identity through expansion and through the separate tucked/visible compact transition. The body remains in place when right-side content changes.
- Anchor to the chosen physical monitor edge without reserving work area. The default follows the OS primary monitor. Persist an explicit display choice, fall back to primary while it is missing, and recover that choice when it reconnects.
- Classic and an optional sprout remain appearance ideas, separate from the three presentations. Accessories do not change the base silhouette.

## Motion and input requirements

Desired eye states include cursor following, blinking, sleep, one-eye wake-up and curiosity. Desired gestures include a small hand emerging from the closed capsule, petting reactions and subtle full-body movement. Music reactions and event notifications require their own integrations later. The existing storyboards describe key poses, not finished animation files.

Motion must remain smooth through hover reversal, reveal and collapse. Sample poses from monotonic elapsed time, pace active updates to the display, avoid redraw flicker and preserve continuity when the target changes. Honor the system's reduced-motion preference. A nominal frame interval alone does not prove smoothness; inspect frame timing and the actual transition on the target display.

The companion must preserve access to browser tabs, title bars and other applications. Auto-hide does not reserve or reduce the Windows work area. Decorative areas pass clicks through; only the current edge/eye trigger and visible action controls capture input. The companion must not take keyboard focus. A short hover dwell prevents accidental opening while crossing the screen edge.

Use separate native input and decorative surfaces if needed. Do not treat same-thread hit-test forwarding as proof that clicks reach another application. Verify underlying-window targeting, focus retention, hover reversal, dismissal, fullscreen behavior and multiple-monitor edges before claiming this requirement is solved.

## Current implementation boundary

Reveal/collapse uses four exact elapsed-time exponential stages. Interrupted motion retains position, velocity and acceleration without a hard-clamp stall. Text and controls fade over a broader part of the transition. Reduced motion settles immediately, hidden blink timers are absent and the hidden clock does not keep a minute timer active.

Mouse observation arms a 350 ms dwell in the current compact trigger. Native controls are nonactivating, match press/release within the same presentation generation and become active only after the relevant terminal presentation is painted. An outside click or pointer exit after a short grace period dismisses the expanded island. The gear opens a separate normal Settings window; deliberately opening that window may focus it. Closing Settings leaves the companion running. Ctrl+Alt+P hides or restores the companion.

Settings is a separate focusable window with a custom title bar and grouped Appearance, Island, Updates and About sections. Appearance contains language and Dark/Light/System themes; Dark is the compatibility default. Island contains compact behavior and persistent monitor selection. Closing Settings does not quit the companion. Update summaries remain friendly in the panel; raw errors are available in Settings.

Shared locale JSON files provide panel, settings and tray strings. Changes apply live and preferences persist independently of the existing automatic-update file. Adding a language requires only its file and a rebuild; see ../locales/README.md.

The current revision is launched for user manual inspection only. Automated native-input, Settings, focus and affected DPI/monitor acceptance remains deferred; source checks and prior prototype passes do not establish these runtime results. Compact gaze following, finite blinking and occasional curiosity are implemented. Strip shows a finite original-mascot peek every 120–180 seconds. Hidden and reduced-motion states cancel expression timers and active gestures. Sleep/wake poses, hand gestures, petting and music reactions remain future work. The imported PNG remains static artwork; runtime transforms provide the implemented movement.

## Plugin pages and tray

Expanded hosts a compact plugin page beside the original mascot. The first bundled page is Pomodoro; enabled pages share fixed native Previous, Primary, Secondary and Next controls. Update offers take priority over plugin content. Settings manages plugin imports, enabled state, order and reset. See PLUGINS.md for the supported declarative format and explicit integration limits.

The tray contains Autostart, Settings, a separator, About PivO, Check for updates and Exit. Autostart uses the current user's Windows Run entry. About opens the separate Settings window directly on its About page.
## Date and time header

Expanded centers a small plugin-progress ring, the localized weekday/date and a bold 24-hour clock in one top row. The PivO wordmark is omitted from this row. Settings and Exit remain aligned to their native targets on the right. Strip shows the same plugin-progress ring and a prominent clock within its visible 24-pixel row; Eyes keeps its original eye identity. The ring follows the active enabled plugin: timer plugins supply elapsed progress for their configured focus/break mode. Information pages supply none, so the ring is hidden. Plugins report elapsed progress from zero to one; the ring displays the remaining fraction, draining from full at idle/reset to empty at completion. Paused progress stays fixed. Hidden and Eyes presentations do not schedule minute clock updates.
Date field order, localized names and punctuation follow the selected PivO locale through Intl.DateTimeFormat. Language changes refresh the header immediately; the 24-hour clock remains consistent across locales.

Compact status uses one centered ring-and-clock group with equal horizontal padding. The ring track is a complete circle; its filled arc represents only the real plugin value. Settings content is capped at 860 logical pixels, with theme choices capped at 720, so maximizing the window does not stretch previews or separate labels from controls. Narrow Settings windows stack their controls.

Plugins that declare supported settings receive a form inside a disclosure that is closed by default in Settings > Plugins. Configuration stays with that plugin. Pomodoro exposes focus and break durations in minutes; changing a duration stops and resets that timer, while saving unchanged values preserves its running countdown. External manifests can declare bounded numeric timer fields or text fields for information cards; see PLUGINS.md.
The plugin manager shows connection tiles with an icon, name, description and author. Its Settings/Reset disclosure is closed initially, and ordering controls belong separately to Island settings. Developers can supply one emoji or a bounded static inline PNG icon through their manifest; both the tile and island page use it. Legacy plugins receive a generic fallback.