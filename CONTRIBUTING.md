# Contributing

Read README.md, AGENTS.md and docs/PLAN.md. Discuss substantial features and acceptance criteria in an issue first. Keep each pull request focused.

Use English in project files, comments and identifiers. Translated UI values and language names belong in locales/<tag>.json; see locales/README.md. Prefer small readable changes, reusable behavior and explicit platform boundaries. Avoid speculative abstractions and unnecessary dependencies.

## Branch workflow

`main` is protected: changes enter through a pull request with the required `windows` CI check and resolved conversations. Direct pushes, force pushes and branch deletion are blocked, including for administrators. No additional approval count is imposed.

Use `release/0.1.0` as the active integration branch for development and bug fixes in the 0.1 line. Start isolated work on `codex/<topic>` from the latest integration branch and target pull requests back to it. Coordinators may commit agreed work directly to that integration branch. Check for shared-checkout activity before switching branches or building.

Promote the reviewed integration branch into `main` through a pull request after the relevant checks pass. Tag the approved release commit using `vMAJOR.MINOR.PATCH`; follow [release preparation](docs/UPDATES.md). Published tags and assets are immutable. The next fix after `v0.1.0` is a new patch release, such as `v0.1.1`, even if work remains on `release/0.1.0`.

Documentation and process changes require focused validation; they do not justify rerunning application builds or live UI checks locally. A queued GitHub workflow is pending work, not proof of a released version.

## Validation

For features, finish implementation and review corrections before the final validation batch. For bugs, first demonstrate a failing regression test, then fix and rerun it. Follow AGENTS.md for focused checks and runtime acceptance. Process-only changes need focused validation of their artifacts.

Run the complete application batch once with `pwsh -NoProfile -File scripts/validate.ps1`; use `-Plan` to list commands without executing them. The batch stops on the first failure. Its commands are:

```powershell
npm --prefix windows/frontend ci
npm --prefix windows/frontend test
npm --prefix windows/frontend run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo build -p pivo-windows --release --locked
```

Describe the problem, resulting behavior and validation. Include screenshots and DPI/monitor checks for UI changes, and measurements for performance claims.

## Local agent workflow

Repository skills are in `.agents/skills/`. Caveman keeps chat concise; project files use normal English. Corrective feedback is handled by `pivo-retro` at completion and recorded in docs/RETROSPECTIVES.md.

The optional `.codex/hooks.json` Stop hook runs Node.js only when Codex invokes it. It checks for `.local/retro/pending/<session-id>.json`; it does not read transcripts, run builds or control the application. The coordinator records corrective feedback there and clears it after the retrospective. Without pending feedback it requests no continuation, and `stop_hook_active` prevents a loop. This is a safety reminder; semantic feedback detection belongs to the agent instructions.

Open `/hooks` in Codex CLI from this trusted project and review/trust the hook definition before use. Reload the project session after setup. The command currently contains this checkout's absolute Windows path; update it and review trust again if the checkout moves. See the [official hook documentation](https://learn.chatgpt.com/docs/hooks). A standalone script test does not establish that the desktop session loaded or trusted the hook.

Contribute code under MIT. For assets, record the owner, source and usage permission in assets/README.md. The code license does not automatically cover artwork.
