# Windows updates

PivO uses the official Tauri 2 updater and one stable Windows x64 release channel. GitHub Releases hosts the NSIS installer, its updater signature and `latest.json`; there is no separate update server. The configured endpoint is `https://github.com/RedGry/pivo/releases/latest/download/latest.json`.

Releases stay in `RedGry/pivo`. The repository is public. Public visibility is required for anonymous access to the update feed and release assets. Do not embed a GitHub access token in the application or updater configuration.

The first installation uses the NSIS setup executable and installs for the current Windows user. Existing portable copies need that first installation manually. Do not treat copying a new portable executable as an installer update.

## Signing key

The private updater key is stored locally at `.local/signing/pivo.key`, outside source control and release artifacts. Its public key is embedded in `windows/tauri.conf.json`. Back up the private key securely before publishing the first release: losing it prevents updates to existing installations with that public key. Do not regenerate the key for each release or commit its contents.

Configure the repository Actions secret `TAURI_SIGNING_PRIVATE_KEY` with the contents of the private key. If the key is password protected, configure `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` too. For example, from a trusted PowerShell session authenticated to GitHub:

```powershell
Get-Content -Raw .local/signing/pivo.key | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo RedGry/pivo
```

The command passes the key through stdin without printing it. Never print the key to logs. Repository write access is required.

Initial setup on 2026-10-30 saved `TAURI_SIGNING_PRIVATE_KEY` in `RedGry/pivo`. The local key has no password. The release workflow is committed and runs on stable version tags.

The updater signature confirms that an update was signed by PivO's key. It is separate from Windows Authenticode signing; it does not remove SmartScreen warnings or provide a Windows publisher certificate. Tauri verifies the installer signature before starting installation. See the [Tauri updater documentation](https://v2.tauri.app/plugin/updater/).

## Prepare and publish a version

1. Set the same version in workspace `Cargo.toml`, `windows/tauri.conf.json` and `windows/frontend/package.json`. Refresh `Cargo.lock` and `windows/frontend/package-lock.json` if their package versions change.
2. Add a nonempty `## X.Y.Z` section to `CHANGELOG.md`, optionally followed by ` - YYYY-MM-DD`. Those notes are shown in the app and in the GitHub release. Keep future work under `Unreleased`.
3. Run the checks in `AGENTS.md` and `node --test scripts/release/prepare.test.mjs`.
4. Commit the release changes, create the stable tag `vX.Y.Z` and push it. The workflow rejects prerelease tags and version mismatches.
5. The Windows release workflow tests the code, builds an x64 NSIS installer with locked dependencies, signs it and creates a **draft** GitHub release. The installer includes the code license, asset license and dependency notices from the configured bundle resources.
6. The workflow publishes the complete draft as the latest release only after all checks, signed packaging and asset uploads succeed. A failed build does not publish a release.
7. Verify the published installer in a disposable Windows account or VM. Publishing makes its manifest available at the app's update endpoint; it does not establish the installed-version upgrade acceptance below.

The manifest points to the immutable versioned installer URL. Keep published installer and signature files unchanged. Rebuilding a version and replacing its files can invalidate the signature or mix files downloaded by clients; publish a new version instead. This workflow intentionally does not replace an existing release when rerun: inspect the failed run and existing draft before retrying.

Before the first published release, the endpoint may return HTTP 404; that is an unavailable update feed, not evidence that PivO is up to date. The feed must remain publicly downloadable without a GitHub login.

## Local packaging

Run `pwsh -NoProfile -File scripts/validate.ps1` first. Then package its validated release executable with the existing private key without displaying it:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path .local/signing/pivo.key).Path
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
Push-Location windows
try {
    node frontend/node_modules/@tauri-apps/cli/tauri.js bundle --ci --bundles nsis
} finally {
    Pop-Location
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY, Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
}
```

Supply the actual key password instead of an empty value when necessary. Installers and signatures are written to `target/release/bundle/nsis/` (or the explicit target directory selected by `CARGO_BUILD_TARGET` in CI).

## Release acceptance

Unit tests and a successful package build do not prove a working update. Before calling the published update path verified, install one signed version and update it to a second higher signed version. Check download progress, signature rejection for a modified installer, offline failure and retry, application exit, installation and automatic restart, preserved user settings, and clean uninstall. Exercise the update controls at different DPIs, with fullscreen applications and after sleep/resume; confirm decorative panel areas still pass clicks through and do not steal focus from another process.

Record the exact versions and evidence in `docs/VALIDATION.md`. Until that installed-version transition is exercised, end-to-end updates remain unverified.
