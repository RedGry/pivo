# Architecture

Use the smallest clear design that can be reused, tested and maintained. Prefer fewer lines when readability and correctness remain intact. Responsibilities and dependency direction matter more than a prescribed number of layers.

## Windows application

The Windows application uses Tauri 2. Rust owns native behavior and TypeScript owns presentation. No additional frontend framework is used.

```text
windows/
  Cargo.toml              Rust application and dependencies
  build.rs                Tauri integration and locale-file discovery
  tauri.conf.json         Window, content and build configuration
  capabilities/           Event permissions and Settings-only title-bar actions
  icons/                  Windows icon derived from the approved mascot
  src/
    main.rs               Tauri composition and application commands
    app/                  Three-mode policy, preferences, display selection and locale catalog
    platform/             Windows event adapter and window integration
      mouse.rs            Non-capturing Raw Input observation
      visibility.rs       Window-event coalescing, occlusion and fullscreen policy
      displays.rs         Monitor inventory, primary fallback and physical placement
      preferences.rs      Persisted preferences and localized native text
      settings.rs         Separate focusable Settings window lifecycle
  frontend/
    src/
      main.ts             State subscription, presentation and clock scheduling
      style.css           Transparent layout and compositor effects
      motion/             Elapsed-time transition and behavior tests
      presentation/       Island silhouette and shared update presentation
      i18n/               Catalog lookup, fallback and locale subscriptions
      settings/           Preferences page and its normal-window styling
```

Shared locale sources live in locales/*.json at the repository root. Both the frontend glob and Rust build discover them; each language owns one file.

Application state does not depend on OS handles or frontend internals. The native adapter translates Windows events into state changes. The frontend receives explicit values rather than accessing private window state. Extract shared crates only when real reuse justifies them; do not scaffold future platforms.

## State and rendering

The frontend subscribes to `pivo:state` before calling `pivo_ready`. Snapshots contain `presentation` (`strip`, `eyes` or `expanded`), `expanded`, `reducedMotion`, `visible` and `transitionId`. A late initial response cannot overwrite a newer event. The native window stays hidden until the frontend has loaded the approved image and requested readiness. Terminal-presentation acknowledgments include the generation and exact presentation, preventing stale controls across Strip/Eyes changes, reversal, hide/show or reload.

The transparent WebView canvas stays 560 x 160 logical pixels. Its compact 180 x 40 island either shows Eyes or lifts 16 pixels to form a 24-pixel Strip row, fading out the eyes independently. Auto mode derives that choice from window overlap; explicit compact preferences override it. One path morphs broad concave shoulders and lower corners as the panel unfolds, without per-frame IPC or repeated native resizing. A single themed surface avoids conflicting edge colors; eye contrast follows the theme. The original PNG is bundled by Vite. Eye and character anchors share a transform through the transition.

Four analytically sampled exponential stages keep motion bounded and preserve position, velocity and acceleration through rapid reversals. Frame callbacks stop when every stage settles below subpixel tolerance. Sparse finite Web Animations gestures replace continuous character bobbing. A one-shot scheduler blinks compact eyes, occasionally expresses curiosity and reveals the original mascot briefly in Strip. Hidden and reduced-motion states cancel timers and active gestures. Native coalesced input emits bounded, deduplicated gaze values only for settled Eyes. The clock schedules its next minute boundary only while revealed and refreshes on native state/time notifications.

## Native integration

Tauri owns the main HWND and event loop. A Windows subclass integrates Raw Input, hover timers, the visibility shortcut and power/settings/display/time notifications without replacing Tauri's private window data. Foreground events suppress the companion when another application covers the chosen monitor in fullscreen. Auto compact policy checks ordinary top-level windows against that monitor's physical compact footprint, using DWM bounds and cloak state. Broad show/hide/destroy, geometry, state and minimize notifications are coalesced; a bounded settling refresh handles notification ordering. The application's own Settings window supplies equivalent notifications. No idle occlusion polling is used.

Monitor inventory uses native device identifiers. The saved selection feeds anchoring, fullscreen and compact occlusion consistently; missing selections fall back to primary without replacing the saved choice. Placement rereads DPI after migration before positioning controls. Display changes reanchor and emit `pivo:displays`.

The companion WebView is decorative, nonactivating and passes pointer input through. Small native proxies own the current Strip edge or Eyes cluster and action input. They match press/release against the current presentation or update revision and activate only after the corresponding terminal frame is painted. Closed hover reveal is restricted to the current compact trigger; the old expanded body area cannot reopen it. The Settings window is a normal, separate, focusable WebView opened only by an explicit gear/tray action; its first creation runs off the Windows event-handler stack and uses a singleton guard. Its custom title-bar actions have permissions scoped only to Settings.

Locale, theme, compact mode and display persist in separate small configuration files, preserving the existing locale and automatic-update formats. Changes emit full `pivo:preferences` snapshots with an in-process monotonic revision; the frontend serializes saves and rejects older snapshots. Native tray labels and the Settings title refresh from the same catalog. Update state carries a stable message key plus raw error detail, rather than using translated text as state identity. Saving a preference cannot clear an active update operation's busy/progress guard.

Mouse packets arm a single delayed sample at least 10 ms after the first packet. A burst does not extend that deadline, and button-down survives a following release. This defers event handling rather than polling continuously.

The current build is running for user manual inspection only. Automated native-input and Settings acceptance remains deferred. Fresh cross-process input and capture checks are required for the changed WebView implementation. Previous renderer measurements and input passes do not establish Tauri behavior. See [validation](VALIDATION.md).

## Dependencies and distribution

WebView2 is a Windows prerequisite. The application embeds the built frontend and mascot; Node.js, Vite, TypeScript and the Tauri CLI are build tools, not shipped runtimes. Dependency terms and source links are recorded in THIRD_PARTY_NOTICES.md and licenses/.

## Declarative plugins

The frontend plugins directory owns validated manifests, timer behavior, shared WebView-profile persistence and presentation. Builtin Pomodoro uses the same contract as imported timers. External JSON can define timers or informational text; it cannot execute code or request operating-system privileges. Settings imports local manifests with explicit limits and owns enable/order/remove/reset actions. Timer state stores an absolute deadline; hidden cards do not tick. Native button proxies emit a fixed set of plugin action names and remain gated by current presentation, plugin availability and update priority. See PLUGINS.md.
Action labels are hidden during reveal and reversal. `pivo_presented` and `pivo_update_revealed` await main-thread processing and return the actual native readiness result; queueing work alone is not an acknowledgment. The frontend reveals controls only for the current presentation generation, and update actions also match the current revision. Async completion updates the DOM directly because the settled frame loop has already stopped.
Plugin metadata and static icon validation remain independent from DOM rendering. The shared icon view creates inert text/images; imported SVGs, network URLs and APNGs are not accepted. CSP permits inline image data only through img-src. Configuration, timer progress and enabled-page ordering are pure tested behavior. Main rendering receives active progress through a callback and separately enables Strip progress ticks without enabling Expanded actions. The plugin manager's native details disclosures preserve local drafts/open state across shared-store rerenders; page order is mounted separately in Island settings.