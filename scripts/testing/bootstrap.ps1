$ErrorActionPreference = 'Stop'
$results = 'C:\PivO-Results'
$testProfile = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'profile.json') -Raw | ConvertFrom-Json
if ($PSScriptRoot -match '^C:\\PivO-Acceptance-([0-9a-f]{32})$') {
    $results = 'C:\PivO-Results-' + $Matches[1]
    if ($testProfile.ResultsPath -cne $results) { throw 'Guest profile results path does not match the generated payload nonce.' }
} elseif ($testProfile.ResultsPath -and $testProfile.ResultsPath -cne $results) {
    throw 'Legacy guest profile can only use the legacy results root.'
}
$report = [ordered]@{ StartedAtUtc = [DateTime]::UtcNow.ToString('o'); Status = 'running'; Stage = 'boot'; Error = $null }
function Save-Readiness([string]$Stage) {
    $report.Stage = $Stage
    $report.UpdatedAtUtc = [DateTime]::UtcNow.ToString('o')
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $results 'readiness.json') -Encoding utf8
}
try {
    Save-Readiness 'boot'
    if ($testProfile.FullHd) {
        Save-Readiness 'requesting-fullhd'
        & (Join-Path $PSScriptRoot 'set-fullhd.ps1') -Output (Join-Path $results 'display-request.json') | Out-Host
    }
    & (Join-Path $PSScriptRoot 'capture-environment.ps1') -Output (Join-Path $results 'environment.json') | Out-Host
    . (Join-Path $PSScriptRoot 'webview-runtime.ps1')
    if ($testProfile.GuestBrowserFolder) {
        if (-not (Test-GuestBrowserFolder $testProfile.GuestBrowserFolder)) { throw 'Guest browser folder is outside the permitted versioned local WebView2 directory.' }
        if (-not (Test-Path -LiteralPath (Join-Path $testProfile.GuestBrowserFolder 'msedgewebview2.exe') -PathType Leaf)) {
            throw 'The explicitly selected guest browser folder does not contain msedgewebview2.exe.'
        }
        $env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = $testProfile.GuestBrowserFolder
        $report.RuntimeFolder = $testProfile.GuestBrowserFolder
    }
    Save-Readiness 'checking-webview2'
    $runtime = Get-WebView2Runtime
    $installer = Join-Path $PSScriptRoot 'webview2-installer.exe'
    if (-not $runtime -and (Test-Path -LiteralPath $installer)) {
        Save-Readiness 'installing-webview2'
        $installation = Start-Process -FilePath $installer -ArgumentList '/silent', '/install' -PassThru -WindowStyle Hidden
        if (-not $installation.WaitForExit(180000)) {
            $installation.Kill()
            throw 'WebView2 installer exceeded the 180-second deadline.'
        }
        $runtime = Get-WebView2Runtime
        if (-not $runtime -and $installation.ExitCode -notin @(0, 3010)) { throw "WebView2 installer exited with code $($installation.ExitCode)." }
    }
    Save-Readiness 'checking-webview2'
    $runtime = Get-WebView2Runtime
    if (-not $runtime) {
        throw 'WebView2 Runtime is missing. Relaunch with -WebView2Installer pointing to the official Evergreen standalone installer. A bootstrapper also needs -Networking.'
    }
    $report.WebView2Version = $runtime.pv
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'pivo-debug-mcp.exe')) {
        Save-Readiness 'mcp-smoke'
        & (Join-Path $PSScriptRoot 'run-smoke.ps1') -Results $results
    } else {
        if ($testProfile.NativeInput) { throw 'NativeInput was requested, but no debug helper was staged.' }
        Save-Readiness 'manual-session'
        Start-Process -FilePath (Join-Path $PSScriptRoot 'pivo.exe') -WorkingDirectory $env:TEMP
        $report.Note = 'No DebugHelper supplied; application launched for manual inspection, no automated acceptance.'
    }
    $report.Status = 'completed'
    Save-Readiness 'finished'
} catch {
    $report.Status = 'failed'
    $report.Error = $_.Exception.Message
    Save-Readiness $report.Stage
    Write-Error $report.Error -ErrorAction Continue
}
