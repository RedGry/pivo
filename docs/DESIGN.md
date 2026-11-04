# Design notes

Source: the user-provided mascot discussion, reviewed on 2026-10-29. The approved static character has been prepared in that conversation and imported as assets/mascot.png. See assets/README.md for provenance and file metadata.

The discussion describes a minimal rounded character with eyes and small arms, a top panel, lilac accents and optional accessories such as a sprout, headphones, a scarf and hats. The application is named PivO.

Later ideas include music, a calendar with a prominent current date and weekday grid, compact system-stat cards, connected AI agents and customizable widget order. These are ideas, not implemented capabilities.

## Confirmed presentations

The source discussion was read from its opening brief through the final design and later corrections on 2026-10-30. Later user corrections take precedence over earlier proposals.

- **Strip:** the 148 × 34 logical-pixel capsule retracts 10 pixels above the physical screen edge. The remaining 24-pixel row shows small eyes, the clock, and any applicable progress.
- **Eyes:** the complete 148 × 34 logical-pixel capsule and the original eyes remain visible.
- **Expanded:** one continuous 480 × 144 logical-pixel island joins the screen edge with broad concave shoulders and rounded lower corners. The enabled Lyrics view reserves a right column at 752 logical pixels, including during track changes and lookup errors. Lyric lines wrap in full, and the column scrolls when wrapped rows exceed its height. Check both the visible footprint and long lines at 1920 × 1080 and 2560 × 1440. Timed lyrics use the projected playback clock and schedule the next cue at its timestamp. Preserve cue identity so the upcoming line moves into the active row and brightens at that cue. Leave timed gaps unhighlighted. The artwork accent is a shallow full-width wash at the bottom. The original mascot is centered vertically in its leading slot with three size presets. Page arrows sit in the lower control row.

Both compact presentations retain shallow concave shoulders. Their curves begin at the visible screen edge throughout the tuck transition.

### Expanded layout and input

- Use consistent 4 px spacing increments for groups and align content to the same leading edge. Reserve the header, content, actions, and page navigation rows so long or missing values cannot move controls.
- Keep the surface continuous. Use whitespace and type hierarchy to separate regions. Use app-styled controls with visible focus, pressed, and disabled states. Check the edges on contrasting backgrounds and at fractional display scales.
- Give each widget a visual center: the playback timeline and dedicated Lyrics control, the timer dial and countdown, the week grid, the water total and meter, the task list, the file shelf, or the HUD readings. Keep page navigation available on every widget including Music. Track transport remains separate. Align every visible button with its native target.
- Derive the music tint from the current artwork. Fade it before the antialiased perimeter. The playback bars indicate the session's playing state, with static bars under reduced motion.
- Present the requested timeline position and corresponding lyric cue immediately on seek. Keep the preview through early stale player reports and reconcile it with the provider's position.
- Leave a visible gap between the mascot, side arrow, and content. Water plots recorded daily servings and the current target. Tasks keep the completion count and task rows separate, with a neutral row surface and a compact checkmark for completed items. Add new tasks at the end and preserve drag or keyboard order in both Settings and the island preview.
- Route wheel detents over the expanded widget body to page navigation, including Music. A file drag over expanded widget content selects Shelf when enabled. Keep its dedicated drop surface active until the drag leaves or Windows completes the drop. The Shelf card opens or removes its visible most-recent shortcut. Removing a shortcut preserves the original file.
- Tasks shows two larger native-clickable rows. Each row toggles its own stable task ID. Add and Edit open the focusable Tasks settings editor.
- Treat native action rectangles and their rendered controls as one contract. A layout or DPI change invalidates stale input until the new presentation is painted. Keep the compact target centered even when the expanded window reserves space for lyrics.
- Use [Nusa's public preview](https://github.com/rama2555/nusa/blob/main/index.html) as a visual reference. Its standard expanded mockup is 420 × 140 with 32 px lower corners, and its lyrics mockup grows to 520 × 140 with a separate text column. The publisher describes the installed product as a native Rust renderer. The website's CSS describes the preview. PivO implements the layout with its own components and assets.
- Static inspection of the official Nusa 1.1.0 distribution found a native executable using Direct2D, DirectWrite, Direct3D 11, and DirectComposition. Its PE resources are icons and version metadata. The distribution contains no separate style files. The executable and recovered resources stay outside PivO source and releases.
- **Auto** selects Eyes when the compact footprint is unobstructed and Strip when any visible ordinary top-level window overlaps it. Minimized, cloaked, desktop and transparent decorative windows do not count. Normal Settings windows and overlapping taskbars do count. Users may force Eyes or Strip.
- Reveal through the centered 148 × 24 logical-pixel row target in Strip or the deliberate 40 × 28 eye-cluster target in Eyes. Hover briefly or click. Movement through the old body area must not reopen the island. Move outside the expanded bounds to fold it after a short grace period. Outside clicks also fold it. Interior clicks, including the face, leave it open.
- Preserve eye identity through expansion and through the separate tucked/visible compact transition. The body remains in place when right-side content changes.
- Anchor to the chosen physical monitor edge without reserving work area. The default follows the OS primary monitor. Persist an explicit display choice, fall back to primary while it is missing, and recover that choice when it reconnects.
- Classic and an optional sprout remain appearance ideas, separate from the three presentations. Accessories do not change the base silhouette.

## Motion and input requirements

Eyes track together with a 140 ms ease-out and return to center in 200 ms after pointer input stops. Downward travel is limited to 2.7 logical pixels. Blink and curiosity are finite expressions. After 24 seconds of inactivity the eyes drowse and stop scheduling frames once asleep. Pointer activity wakes them even when the gaze direction is already at its limit. Strip uses finite blinks, a wink on the clock side, and an occasional wave. The mini eyes stay in their fixed layout slots. Expanded music motion runs only during an active playing session.

The expanded mascot has a charcoal body with white eyes in Dark and an ivory body with charcoal eyes in Light. System follows the resolved Windows theme. Wave on the first reveal or when reopening the same page. Move the head with the paw gesture so attached headphones follow the same motion. Play the active widget gesture when the page changes, then give one wave after the page has settled. Use the same cancellable gesture path for both so a replaced gesture cannot resume. Each built-in widget gesture introduces a themed prop. Headphones and the calendar card stay equipped while their page is open, including with reduced motion. The other props disappear as the pose returns to rest. The dedicated Mascot settings tab saves a separate shape for every prop, hat, and scarf and previews the actual SVG with the current clothing and theme. Clothing has its own group and visibility controls. Held items sit in front of the paw to keep their details legible. Props use rounded forms and shaded surfaces. Anchor held props to the paw and wearable props to the body. Hover makes the mascot lean in, leaving triggers a blink, and a left press makes it hop. During Music playback it dances while Expanded is ready. On folding, the compact eyes use a corresponding gesture. The Appearance setting controls mascot gestures separately from size, while Windows reduced motion takes priority.

Holiday names and icons are independent of appearance and appear in the island week and the Calendar settings view. Calendar settings show bordered day cells, allow a direct date jump, and list locally saved personal events alongside holidays. Filter holiday catalogs by country, add custom country calendars and recurring dates, and render a distinct glyph for each built-in holiday. The built-in catalog includes recurring Russian and international dates plus movable observances. The Mascot tab configures outfit and interface separately: off, calendar-driven, or a fixed seasonal theme. Calendar-driven choices follow the local day and restore the base appearance outside matching dates. Each interface theme includes its own illustrated date icon and a decorative header ornament in Expanded and Settings. Winter uses a single width-aware garland cable in its own settings rail and across the expanded island. Each settings theme has distinct scenery and a background. Place complete artwork in the side gutters of wide windows and a dedicated banner in narrower windows. Keep the heading, controls, and scrollable content in their own layout area. Each holiday theme replaces the Settings navigation glyphs with its own semantic set while retaining each section tile color. Decorations do not participate in pointer input. The Mascot tab stores fitted outfits per occasion, including recognizable winter and Halloween silhouettes, with an independent preview and finite clothing motion.

Motion must remain smooth through hover reversal, reveal and collapse. Sample poses from monotonic elapsed time, pace active updates to the display, avoid redraw flicker and preserve continuity when the target changes. Honor the system's reduced-motion preference. A nominal frame interval alone does not prove smoothness; inspect frame timing and the actual transition on the target display.

The companion must preserve access to browser tabs, title bars and other applications. Auto-hide does not reserve or reduce the Windows work area. The painted Expanded silhouette receives clicks without taking keyboard focus. Outside that contour and outside the deliberate compact reveal target, clicks reach the underlying application. A short hover dwell prevents accidental opening while crossing the screen edge.

Use separate native input and decorative surfaces if needed. Do not treat same-thread hit-test forwarding as proof that clicks reach another application. Verify underlying-window targeting, focus retention, hover reversal, dismissal, fullscreen behavior and multiple-monitor edges before claiming this requirement is solved.

## Current implementation boundary

Reveal/collapse uses four exact elapsed-time exponential stages. Interrupted motion retains position, velocity and acceleration without a hard-clamp stall. Text and controls fade over a broader part of the transition. Reduced motion settles immediately, hidden blink timers are absent and the hidden clock does not keep a minute timer active.

Mouse observation arms a 350 ms dwell in the current compact trigger. Native controls are nonactivating, match press/release within the same presentation generation and become active only after the relevant terminal presentation is painted. An outside click or pointer exit after a short grace period dismisses the expanded island. The gear opens a separate normal Settings window; deliberately opening that window may focus it. Closing Settings leaves the companion running. Ctrl+Alt+P hides or restores the companion.

Settings is a separate focusable window with a custom title bar and grouped Appearance, Island, Updates and About sections. Appearance contains language and Dark/Light/System themes; Dark is the compatibility default. Island contains compact behavior and persistent monitor selection. Closing Settings does not quit the companion. Update summaries remain friendly in the panel; raw errors are available in Settings.

Shared locale JSON files provide panel, settings and tray strings. Changes apply live and preferences persist independently of the existing automatic-update file. Adding a language requires only its file and a rebuild; see ../locales/README.md.

Runtime acceptance is tracked by executable and scenario in [MOTION-AUDIT.md](MOTION-AUDIT.md). The current revision has separate-process native input and focus evidence on the selected 96-DPI monitor; other DPI/monitor configurations, real sleep/resume and current fullscreen/hotkey acceptance remain unverified. Compact gaze following, finite blinking and occasional curiosity are implemented. Strip shows a finite original-mascot peek every 120–180 seconds. Hidden and reduced-motion states cancel expression timers and active gestures. The expanded SVG uses the original PNG as its silhouette reference and separates eyes, paws, and clothing for animation.

## Plugin pages and tray

Expanded hosts a compact plugin page beside the original mascot. The first bundled page is Pomodoro; enabled pages share fixed native Previous, Primary, Secondary and Next controls. Update offers take priority over plugin content. Settings manages plugin imports, enabled state, order and reset. See PLUGINS.md for the supported declarative format and explicit integration limits.

The tray contains Autostart, Settings, a separator, About PivO, Check for updates and Exit. Autostart uses the current user's Windows Run entry. About opens the separate Settings window directly on its About page.
## Date and time header

Expanded and Strip show an activity ring only for active charging or a running Pomodoro. Charging is green. Pomodoro takes priority and shows the remaining fraction in red across widget pages. The main timer dial drains as time elapses and preserves its remaining fraction while paused. The playback bars appear in the Expanded header and Strip during a playing Windows media session. They are static under reduced motion. Hidden and Eyes presentations do not schedule minute clock updates.
Date field order, localized names and punctuation follow the selected PivO locale through Intl.DateTimeFormat. Language changes refresh the header immediately; the 24-hour clock remains consistent across locales.

The HUD and playback indicator consume Windows endpoint, power, connectivity, and media session events when available. Volume, battery, and current-session playback events update their visible readings before the fallback snapshot completes. Devices without a notification path use the existing snapshot cadence. Widget notices show a category icon and an optional level meter, with a short entrance that respects reduced motion.

Compact status uses one centered ring-and-clock group with equal horizontal padding. The ring track is a complete circle; its filled arc represents only the real plugin value. Settings content is capped at 860 logical pixels, with theme choices capped at 720, so maximizing the window does not stretch previews or separate labels from controls. Narrow Settings windows stack their controls.

Plugins that declare supported settings receive a form inside a disclosure that is closed by default in Settings > Plugins. Configuration stays with that plugin. Pomodoro exposes focus and break durations in minutes; changing a duration stops and resets that timer, while saving unchanged values preserves its running countdown. External manifests can declare bounded numeric timer fields or text fields for information cards; see PLUGINS.md.
The plugin manager shows connection tiles with an icon, name, description and author. Its Settings/Reset disclosure is closed initially, and ordering controls belong separately to Island settings. Developers can supply one emoji or a bounded static inline PNG icon through their manifest; both the tile and island page use it. Legacy plugins receive a generic fallback.
## Full HD revision (2026-11-02)

This revision supersedes the dimensions, dwell and plugin management described above. Eyes is 148 x 34 logical pixels. Strip lifts that capsule by 10 pixels, retaining a 24-pixel visible row with miniature decorative eyes left of the clock. Expanded is 480 x 144. Native action rectangles follow the reduced geometry. Reveal uses a cancellable 20 ms dwell. Folding begins when the batched pointer sample confirms the cursor is outside the expanded target and no mouse button is held. A new deliberate reveal can reverse the in-flight animation. These delays are configured values; compositor timing and comparison with Nusa require runtime measurements. Cursor following permits up to six logical pixels of displacement and reduced motion still disables it.

Settings exposes first-party widget tabs in its left sidebar. Pomodoro remains functional; external manifest import and external pages are removed from the supported flow. Retain the existing built-in countdown and configuration during migration. Future media controls need an actual integration before appearing as actionable UI.

Full HD guest testing records actual resolution and scaling. Virtual rendering does not establish physical size or smoothness on a 24-inch panel. See TEST-ENVIRONMENT.md for isolated execution and VALIDATION.md for actual evidence.

## Monitor-aware revision

A single reduced size is unsuitable for both the reported Full HD desktop and the previously comfortable QHD desktop. Use the selected monitor's effective logical height to derive a bounded scale: 1 at 1080 logical pixels, increasing continuously to 7/6 at 1440, with no further growth. At 100% Windows scaling this yields 480 x 144 on Full HD and 560 x 168 on QHD. The QHD compact capsule becomes approximately 173 x 40. This uniform scaling preserves the new layout's proportions.

Native canvas, proxies, reveal targets, obstruction checks and inverse pointer coordinates share that scale. Send uiScale explicitly with presentation state. A scale change invalidates readiness until the matching frame is acknowledged. Windows DPI remains an independent conversion from logical to physical pixels.

Panel motion must respond quickly and stay smooth during pointer reversals. Keep the reveal continuous, show shared controls as the silhouette opens, and use directional slides between widgets. Measure first visible movement and full travel separately in the running Windows app. Respect reduced motion and keep native input disabled until its targets are ready.

Keep widget indicators centered beneath the main content when the Lyrics column opens or closes. Show dots at rest and widget icons on hover. Animate panel width and lyric opacity together in both directions. Keep the wider native window until closing finishes so the widget slide can play without clipping.

During a Lyrics width transition, keep the expanded left edge fixed in the native client area. Keep each outgoing widget's layout styles attached to that widget until its slide ends. Check intermediate frames as well as settled positions when validating a reported jump.
