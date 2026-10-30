# Working on PivO

- Use English for project files, documentation, comments and identifiers. Localized user-facing messages and language names belong in separate locales/<tag>.json files; their translated values are the intentional exception. Chat replies may follow the user's language.
- First goal: a working Windows prototype with an expandable top panel, the original mascot and a clock. Follow docs/PLAN.md.
- Aim for the cleanest practical architecture: explicit responsibilities, small modules, clear platform boundaries and testable behavior.
- Prefer less code. Reuse existing code and OS facilities before adding dependencies, abstractions or layers. Remove duplication; preserve clarity and correctness.
- Keep reusable state and behavior independent of OS handles and rendering. Isolate Windows APIs under windows/. Extract shared crates when real reuse justifies them.
- Organize source code into directories by architectural responsibility. Keep the source root for the entry point and composition; do not accumulate unrelated modules in a flat folder.
- Use Tauri 2 with Rust and TypeScript for the Windows application. Keep the frontend small; do not add a UI framework without a concrete need.
- In the Windows package, src/app/ owns OS-independent behavior, src/platform/ owns native Windows events and window integration, and frontend/src/ owns presentation, animation and image resources. app/ must not depend on platform/ or frontend internals. Pass explicit values across the IPC boundary.
- Add another architectural directory only when a real responsibility needs it. Prefer a substantive mod.rs over empty forwarding files, and keep related tests beside their owning code.
- Do not scaffold speculative platforms, plugin systems or generic frameworks. Use the smallest design that satisfies the milestone and remains easy to maintain.
- The user selected Tauri 2. Measure its Windows prototype, including WebView2 resource use and native input behavior; previous renderer measurements do not establish Tauri behavior.
- Prefer OS events and redraw on demand. Pause idle animations and avoid unnecessary polling.
- Follow docs/DESIGN.md for Strip, Eyes and Expanded. Auto mode shows Eyes when the compact footprint is unobstructed and Strip when ordinary windows overlap it; compact overrides are available. Reveal only through the current deliberate edge/eye target. Preserve eye identity; movement through the old expanded body must not reopen the island. Anchor to the selected physical monitor without reserving work area.
- Keep localization shared between Rust and TypeScript through locales/*.json. Adding a language requires a file and rebuild, not a second native dictionary or hard-coded locale list. English is the fallback. Keep Settings a separate normal, focusable window opened only by deliberate user action.
- Treat access to underlying applications as a product requirement. Decorative overlays must pass pointer input through, reveal controls must have a small deliberate activation area, and the companion must not steal keyboard focus. Verify input behavior against another process; same-thread hit-test forwarding is insufficient.
- Measure motion timing in the running app. Use elapsed time rather than frame counts, avoid flicker and animation jumps, respect reduced-motion preferences, and stop frame updates when there is no motion to render.
- Keep third-party binaries, analysis tools and recovered code in .local/, outside source and release artifacts. Reimplement behavior independently and respect asset ownership.
- Add meaningful behavior tests. For UI, check DPI, multiple monitors, fullscreen, sleep/resume and clean exit.
- Use the separate pivo-debug MCP for runtime inspection and UI checks. Do not use Computer Use for PivO. Keep the MCP implementation and its dependencies outside this repository.
- Run the final application validation with `pwsh -NoProfile -File scripts/validate.ps1`. See the development workflow below for timing and exceptions.
- Report unavailable tools and unexecuted checks. Do not describe scaffolding as a working feature.
- Code is MIT licensed. Asset terms are in LICENSE-ASSETS.md; record ownership and provenance in assets/README.md.

## Agent workflow

### Git and releases

- `main` is protected. Never push commits directly to it, force-push it, delete it or bypass protection. Merge through a pull request with the required `windows` CI check and resolved review conversations.
- `release/0.1.0` is the active integration branch for development and bug fixes in the 0.1 line. Start work from its latest remote state, not from `main` or a release tag. Use `codex/<topic>` branches and pull requests into `release/0.1.0` for isolated work; a coordinator may commit agreed work directly to the integration branch.
- Check the current branch and working tree before editing. Preserve other agents' changes and coordinate shared checkout/build ownership before switching branches or running builds.
- Promote a reviewed, validated integration branch to `main` through a pull request. Do not disable required checks or branch protection to complete a merge.
- Do not use CI-skip markers on commits being promoted to `main`; the pull request must receive its required check result.
- Stable releases use immutable `vMAJOR.MINOR.PATCH` tags on the approved release commit. Never move a published release tag or replace its assets. After `v0.1.0`, fixes require a new patch version such as `v0.1.1`; the integration branch may keep its name.
- Before tagging, synchronize workspace Cargo, Tauri and frontend versions and lockfiles, update CHANGELOG.md, verify secret exclusions, and follow docs/UPDATES.md. Monitor the release workflow through successful packaging and publication; a queued or merely started workflow is not a completed release.

- Use the repository skill `.agents/skills/caveman/SKILL.md` for concise chat replies by default. Honor requests for normal or detailed responses. Project files remain normal English.
- Features and improvements: implement the agreed scope first, including meaningful behavior tests. Batch final validation after implementation and review corrections settle. Do not run full suites, release builds or manual UI checks after each edit. Use a focused check during implementation only to resolve a concrete uncertainty or failure.
- Bug fixes: first add a regression test and run it against the unfixed behavior; confirm that it fails for the reported reason. Then fix the bug and rerun that test. If automation cannot reproduce the native behavior, document the blocker and the smallest repeatable MCP reproduction before fixing; do not claim a failing automated test exists.
- Run one final automated validation pass for the finished application change, then one relevant runtime acceptance batch through pivo-debug. Prefer reusable MCP fixtures over repeated manual interaction. Cover affected DPI, monitor, fullscreen, resume and input behavior; report unavailable cases. Never restart already successful checks without a relevant edit, failure or unresolved concern. After a failure, rerun the affected check; repeat broader checks only if the fix can affect them.
- Documentation, skills and hook-only changes need their own focused validation, not frontend installs, Cargo builds or application UI checks. Keep the full application gate for application changes and release candidates.
- For corrective user feedback during development, record a short English summary in `.local/retro/pending/<session-id>.json` with shape `{"corrections":["..."]}`. Use the environment variable `CODEX_THREAD_ID` as `<session-id>`; never consume another session's record. If unavailable, handle current-chat feedback without a shared pending file. At completion, use `.agents/skills/pivo-retro/SKILL.md`, apply the smallest supported process improvement, and remove the pending file. Do not record secrets or entire chat transcripts. The Stop hook reminds the coordinator only when a pending file exists; it never runs builds or UI checks. Honor cancellation or deferral without forcing a retrospective.

- Use only GPT-6.1 Terra and GPT-6.1 Sol for subagents; never silently substitute another model.
- Project roles live in .codex/agents/: pivo-search (Terra, low), pivo-builder (Sol, high), pivo-tester (Terra, medium), pivo-reviewer (Sol, xhigh).
- The coordinator assigns clear scopes and file ownership. Search and independent investigation may overlap with implementation; agents must not edit the same files concurrently.
- The builder hands off before the tester runs shared Cargo targets. The reviewer checks the final change independently; the coordinator resolves findings and assembles the final result.
- Request up to four subagents in parallel where useful. Respect the active session's actual capacity and queue a role when no slot is available.
- Read-only role instructions are workflow constraints, not separate filesystem sandboxes. All agents retain the parent session's permissions.
