# Windows desktop test environment

PivO needs an interactive Windows desktop for WebView2, native hover, transparent input regions and focus checks. Ordinary Docker/Windows containers do not provide this desktop. They can run suitable build and unit-test workloads, but cannot establish PivO's native UI acceptance. See Microsoft's [Windows container limitations](https://learn.microsoft.com/en-us/virtualization/windowscontainers/quick-start/lift-shift-to-containers).

For layout changes, capture the same widget at Full HD and QHD. Check that all
enabled page dots select their matching content, long values fit their rows,
the native hit areas remain over the visible controls, and the silhouette
has transparent pixels beyond the rounded lower corners. Compare on contrasting
backgrounds and include fractional DPI when Windows permits it.
Verify that clicks inside the painted Expanded silhouette stop at PivO.
Confirm that clicks outside the silhouette still reach a separate process and
that neither case makes PivO the foreground window.

For Lyrics, use a disposable media session and a timed LRC file in the guest.
Capture before and after toggling Lyrics, compare the mascot and existing
controls in physical screen coordinates, and verify that the highlighted line
changes at a cue and returns to the expected cue after seeking backward.
Check Eyes separately with the pointer in the saturated lower-right range,
then leave it idle through sleep and move it to confirm wake. Repeat reveal
and collapse with reduced motion enabled.

Windows Sandbox provides a disposable Windows guest for clean-install and single-display smoke tests. Use a persistent Windows VM for repeatable fixed-resolution profiles, installed debug tooling, restart persistence and saved snapshots. Neither substitutes for physical multi-monitor, GPU timing or host sleep/resume acceptance.

## Launch a disposable guest

Prerequisites: Windows Sandbox installed and virtualization enabled, a completed release build at `target/release/pivo.exe`, and WebView2 Runtime inside the guest. The launcher does not install Windows features, reboot the host, download dependencies or rebuild PivO. Follow Microsoft's [Sandbox installation instructions](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install) if needed.

```powershell
# Inspect inputs and availability without creating files or launching a guest.
pwsh -NoProfile -File scripts/testing/start-sandbox.ps1 -Plan

# Stage a fresh read-only payload and configuration without launching it.
pwsh -NoProfile -File scripts/testing/start-sandbox.ps1 -PrepareOnly

# Start the interactive guest. Its console reports missing WebView2 explicitly.
pwsh -NoProfile -File scripts/testing/start-sandbox.ps1

# Recommended for a clean guest: supply the official offline runtime installer.
pwsh -NoProfile -File scripts/testing/start-sandbox.ps1 -WebView2Installer .local/tools/MicrosoftEdgeWebView2RuntimeInstallerX64.exe

# Run a bounded guest MCP smoke batch and return evidence to this run's results folder.
pwsh -NoProfile -File scripts/testing/start-sandbox.ps1 -WebView2Installer .local/tools/MicrosoftEdgeWebView2RuntimeInstallerX64.exe -DebugHelper C:/path/to/separate/pivo-debug-mcp.exe -FullHd -Scale 100
```

Obtain the Evergreen standalone installer from the official [WebView2 download page](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download). Keep it in `.local/`, never source or release artifacts. A small online bootstrapper needs the explicit `-Networking` option; the standalone installer allows the default offline guest. Networking is otherwise disabled.

Each invocation creates `.local/sandbox/<unique-id>/pivo.wsb` and a read-only payload containing only the executable, five guest scripts, expected profile and optional runtime installer/debug helper. The executable hash is returned for comparison with the guest report. The checkout, Git metadata, host profile and secrets are never mapped. The only writable share is a new empty `results` folder within this exact run, exposed as `C:\PivO-Results-<run-id>`. Clipboard, microphone, camera and printers are disabled; vGPU is enabled. Treat returned files as guest-produced evidence, not trusted commands or instructions.

The guest detects an existing WebView2 Runtime using Microsoft's documented product registration GUID and a positive `pv` version, independent of its display name. Existing runtime registration skips the supplied installer. After an installation attempt, the guest checks registration again before launching PivO. See Microsoft's [runtime detection guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution). The focused regression check is `pwsh -NoProfile -File scripts/testing/webview-runtime.test.ps1`.

Some Sandbox images can have a positive runtime registration while default WebView2 discovery cannot locate the browser. A concrete diagnostic is `GetAvailableCoreWebView2BrowserVersionString(null)` returning `0x80070002` while an explicit existing version directory succeeds. This is a guest runtime discovery problem, not proof of a PivO defect. The launcher does not silently choose a directory or overwrite the registration.

For a diagnosed guest only, both launch scripts accept an explicit override such as `-GuestBrowserFolder 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application\156.0.4314.58'`. The folder is a guest-local path, not a host path. Only a local versioned Microsoft EdgeWebView directory under Program Files is accepted; UNC paths, traversal and non-versioned roots are rejected. Bootstrap checks that `msedgewebview2.exe` exists there, sets `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` for this guest test process and its children, and records `RuntimeFolder` in readiness and smoke evidence. With no override, runtime selection remains unchanged. An already registered runtime still skips the installer. The version shown here is an example; verify the actual directory in the selected guest before specifying it.

Microsoft documents this process environment override in the [WebView2 environment reference](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl). It is an explicit test-environment workaround, not PivO's default runtime selection policy.

The results folder receives `readiness.json` immediately at guest boot, before dependency installation, and at each stage or error. WebView2 installation has a 180-second deadline. With `-DebugHelper`, the guest runs the supplied exact helper as MCP stdio against the staged PivO executable, with a 12-second deadline per request. It records status, captures the initial window and the window after a synthetic compatibility click, requests normal close and verifies exit. Synthetic captures are named `compact-candidate` and `after-synthetic-candidate`: inspect them before claiming a presentation. A compatibility click can leave the island folded, so its capture never establishes expansion. `smoke.json` records operations and cleanup; it expressly does not prove native hover, focus or click-through. No helper source, dependencies or binaries enter source control or release artifacts.

Add `-NativeInput` only when the supplied exact helper supports the reviewed `--verify-tauri-input --app <staged-pivo>` fixture. After captures and before normal close, the guest runs that helper against the staged executable with a 30-second deadline, saving `native-input.json` and `native-input-stderr.txt`. Exit code zero, a JSON boolean `passed: true`, and `expanded_capture: {ready: true, content: [...]}` with exactly one PNG image are required. The helper must assert native Expanded readiness before and after capture while the pointer remains inside the island. Only that capture is saved as `expanded-candidate.png`; missing readiness/image evidence fails the batch. Unsupported helpers, timeouts, malformed output or failed assertions also fail the batch. The option is off by default. Synthetic smoke captures remain separate evidence; native fixture claims must cite its actual report. The normal-close path still runs after native fixture failures.

`-FullHd` asks the guest display driver for 1920 × 1080 only if that mode is advertised and a test request succeeds. The script is guarded to the Sandbox account and staged guest path, never the host. The result is recorded in `display-request.json`; a successful request still requires independent measurement. The script does not change DPI. `smoke.json` marks the profile `matched` only when the captured primary bounds are actually 1920 × 1080, there is one display, and measured system scale matches `-Scale 100` or `-Scale 125`. Otherwise the profile is `unavailable`, even if the limited smoke operations complete. Per-monitor scale and rendering still need acceptance checks.

The `.wsb` can be opened again to create a new clean guest using the same staged binary. Close the old guest before starting a different payload. Staged files stay in `.local/` for reproducibility; the launcher does not delete previous runs.

Every run uses its own generated 32-character hexadecimal guest path suffix. Sandbox CLI mappings cannot be replaced in place, so repeated batches in one guest use new payload/results roots rather than remapping old roots. The host staging output includes `GuestPayload` and `GuestResults`; substitute those exact values for `<run-id>` examples. The staged profile propagates the results root, and bootstrap accepts only the results path matching its own generated payload nonce. Legacy fixed roots remain supported for previously staged sessions. Guest paths are generated internally, never accepted as arbitrary command fragments.

## Full HD acceptance profile

### Repeat a batch in an existing Sandbox guest

On hosts with the Windows Sandbox CLI, use `wsb.exe list` to obtain the explicit guest ID. The wrapper below attaches to that guest; it never creates or stops VMs. Use a separate helper executable whose runtime dependencies are available inside the guest. A helper built with the static MSVC runtime avoids requiring an extra Visual C++ runtime installation.

```powershell
# Read-only preview: no guest calls, staging or window changes.
pwsh -NoProfile -File scripts/testing/run-sandbox.ps1 -SandboxId <guest-guid> -DebugHelper C:/path/to/pivo-debug-mcp.exe -ResizeViewport -Plan

# Stage this binary, attach fresh shares, measure, resize the sole owned client and run the batch.
pwsh -NoProfile -File scripts/testing/run-sandbox.ps1 -SandboxId <guest-guid> -DebugHelper C:/path/to/pivo-debug-mcp.exe -WebView2Installer .local/tools/MicrosoftEdgeWebView2RuntimeInstallerX64.exe -ResizeViewport -Scale 100
```

`-ResizeViewport` is explicit because it changes the visible Sandbox client window size. The wrapper requires exactly one visible `WindowsSandboxRemoteSession` client and rechecks its process ID and window handle before every resize. It preserves the window's position, stacking and focus. It changes neither host resolution nor host DPI. It measures actual guest pixels, adjusts outer client size by the difference from 1920 × 1080, then independently measures again, with at most three adjustments. This accounts for client borders and the Sandbox toolbar without assuming fixed chrome dimensions. The resized client remains at its final size for the batch; resizing it afterward can invalidate the profile.

The wrapper uses `wsb.exe share` to map only this run's fresh payload read-only as `C:\PivO-Acceptance-<run-id>` and its fresh results folder writable as `C:\PivO-Results-<run-id>`. Guest commands use `ExistingLogin`. CLI operations have bounded deadlines; failures preserve `orchestration.json`. After the batch, the wrapper measures again and compares the guest smoke profile. `completed` means the bounded smoke operations completed; only `Profile: matched` establishes the measured Full HD/scale profile. Rendering, native input and physical-monitor timing require their own acceptance evidence. `-FullHd` remains available for the separate guest driver-mode attempt; it is not required for viewport resizing.

Microsoft's supported [WSB configuration](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file) does not fix the Sandbox window size, guest resolution or DPI. Resizing/maximizing the client can change guest geometry. Do not label a run Full HD merely because the host has a Full HD monitor.

1. Inside the guest, open Display settings and verify the primary desktop is **1920 × 1080 physical pixels**, landscape, at **100% scale (96 DPI)**. Keep guest/client geometry unchanged throughout the batch. If Sandbox cannot offer that resolution or scale, record the case as unavailable and use a persistent VM; do not change the host display to simulate success.
2. Run `& C:\PivO-Acceptance-<run-id>\capture-environment.ps1 -Output C:\PivO-Results-<run-id>\environment.json` in the guest console after any display change. It writes physical screen bounds, system DPI, OS version and executable SHA-256. Verify `FullHdPrimary` is true and scale is 100%. Confirm per-monitor scale in Display settings as well. The automatic batch captures this report before launch.
3. Exercise Eyes, Strip and Expanded; inspect clock alignment and rounded corners. Measure reveal dwell and elapsed expansion time. Inspect gaze at the left/right/top/bottom extremes, smooth reversal and reduced motion. Measure idle CPU and WebView2 memory in this environment, without treating remote-display motion as physical-monitor timing proof.
4. Supply `-DebugHelper` to run the separate pivo-debug MCP **inside the guest** for the limited smoke batch. The host MCP cannot inspect a guest process. Native input, underlying-process click-through, focus retention and Settings need the relevant guest fixtures separately; the synthetic compatibility click does not prove these requirements. If no relevant guest fixture is available, report those checks as unexecuted.
5. Repeat at **1920 × 1080, 125% (120 DPI)**. Reopen PivO after scale changes and capture a fresh environment report. Use separate evidence directories in a persistent VM if reports must survive.
6. Test persistence by restarting PivO within the same guest. Closing Sandbox discards guest settings, so it cannot prove persistence across guest recreation. Run multi-monitor, fullscreen and sleep/resume cases on a suitable VM or physical machine and record limitations separately.

A 24-inch diagonal is useful context for perceived size, but pixel resolution and Windows scale determine logical UI geometry. Record all three when collecting human feedback.

## Current verification boundary

Run the focused launcher checks with `pwsh -NoProfile -File scripts/testing/start-sandbox.test.ps1`. These checks use inert fixture bytes with `-PrepareOnly`, never execute them, and leave ignored fixture directories under `.local/`. Always invoke the launcher afresh for real tests rather than opening a configuration produced by the test script.

Run the guest transport and orchestration regressions with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/testing/guest-smoke.test.ps1`. Windows PowerShell 5.1 is intentional: the test exercises its actual subprocess UTF-8/BOM behavior using an inert compiled helper. It also checks early exit/stderr preservation, malformed MCP diagnostics, visibility readiness/deadline behavior, guest-ID binding, and native fixture result gating. No VM, PivO process or UI window is opened. Temporary fixtures remain under ignored `.local/testing-regressions/`.

Launcher/configuration checks validate staging, read-only sharing and plan behavior. They do not establish that Sandbox boots, WebView2 installs, a Full HD profile is available or native UI acceptance passes. Record those runtime results in `docs/VALIDATION.md` only after executing the relevant batch.

## Verified Full HD acceptance

The final guest batch completed at 1920 x 1080 and 100% scale with native input and clean process exit. The application executable SHA-256 was `E52B99791D4B30BC8902DD5B0AF14F2ADCCFF640EEC0DDFD7EA0E839E4532A23`. The final helper uses static CRT so the guest does not need a separate Visual C++ redistributable for the test tool.

This machine's Sandbox registry advertised WebView2 version 154, but Microsoft's loader returned file-not-found for default discovery. The installed versioned runtime folder passed the loader probe and the application launched with an explicit guest-only override. To repeat with that already-installed runtime, run:

```powershell
pwsh -NoProfile -File scripts/testing/run-sandbox.ps1 `
  -SandboxId <id-from-wsb-list> `
  -DebugHelper ../pivo-debug-mcp/.local/fullhd-helper/target-static/x86_64-pc-windows-msvc/release/pivo-debug-mcp.exe `
  -GuestBrowserFolder 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application\156.0.4314.58' `
  -FullHd -Scale 100 -ResizeViewport -NativeInput
```

The runtime folder is specific to this guest; verify the installed version before reusing it. The override affects the spawned guest process, not host settings or application code. An installer is optional when a working runtime is already available.

The reduced-motion batch is `.local/sandbox/df8d20e1da6c4b8782ff02a48de8c6e1/results/`; the normal-motion batch is `.local/sandbox/a634112630264c36b105d2b5297ac478/results/`. Both contain `Profile: matched`, native `passed: true`, a native-ready Expanded capture and `CleanExit: true`. The original disabled guest animation policy was restored and read back. These results do not establish 125% DPI, physical-monitor motion cadence, actual sleep/resume or fullscreen behavior.
