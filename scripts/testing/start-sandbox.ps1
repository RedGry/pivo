param(
    [string]$Executable = (Join-Path $PSScriptRoot '../../target/release/pivo.exe'),
    [string]$WebView2Installer,
    [string]$DebugHelper,
    [string]$GuestBrowserFolder,
    [switch]$NativeInput,
    [ValidateSet(100, 125)][int]$Scale = 100,
    [switch]$FullHd,
    [switch]$Networking,
    [switch]$PrepareOnly,
    [switch]$Plan
)

$ErrorActionPreference = 'Stop'
if ($NativeInput -and -not $DebugHelper) { throw 'NativeInput requires an explicitly supplied DebugHelper.' }
. (Join-Path $PSScriptRoot 'webview-runtime.ps1')
if ($GuestBrowserFolder -and -not (Test-GuestBrowserFolder $GuestBrowserFolder)) {
    throw 'GuestBrowserFolder must be an explicit local Program Files/Microsoft/EdgeWebView/Application/<four-part-version> directory in the guest.'
}
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sandboxExecutable = Join-Path $env:WINDIR 'System32/WindowsSandbox.exe'
$binary = Get-Item -LiteralPath $Executable
if ($binary.PSIsContainer -or $binary.Extension -ne '.exe') { throw 'Executable must be a built PivO .exe file.' }
if ($WebView2Installer) {
    $installer = Get-Item -LiteralPath $WebView2Installer
    if ($installer.PSIsContainer -or $installer.Extension -ne '.exe') { throw 'WebView2Installer must be an .exe file.' }
}
if (-not $Plan -and -not $PrepareOnly -and -not (Test-Path -LiteralPath $sandboxExecutable)) {
    throw 'Windows Sandbox is unavailable. See docs/TEST-ENVIRONMENT.md; no Windows features were changed.'
}
$networkValue = if ($Networking) { 'Enable' } else { 'Disable' }
if ($DebugHelper) {
    $helper = Get-Item -LiteralPath $DebugHelper
    if ($helper.PSIsContainer -or $helper.Extension -ne '.exe') { throw 'DebugHelper must be the separate pivo-debug MCP executable.' }
}
if ($Plan) {
    [pscustomobject]@{
        Executable = $binary.FullName
        Sha256 = (Get-FileHash -LiteralPath $binary.FullName -Algorithm SHA256).Hash
        SandboxAvailable = Test-Path -LiteralPath $sandboxExecutable
        Networking = $networkValue
        WebView2Installer = $WebView2Installer
        DebugHelper = $DebugHelper
        GuestBrowserFolder = $GuestBrowserFolder
        NativeInput = [bool]$NativeInput
        Scale = $Scale
        FullHd = [bool]$FullHd
        SharedFiles = 'Exact payload (read-only); separate empty per-run results folder (writable)'
        Display = 'Verify guest 1920x1080 and 100%/125%; WSB does not fix resolution or DPI.'
    }
    return
}

# Each run stages a fresh, bounded set of files. Never mount the checkout or user profile.
$nonce = [Guid]::NewGuid().ToString('N')
$run = Join-Path $repository ('.local/sandbox/' + $nonce)
$guestPayload = 'C:\PivO-Acceptance-' + $nonce
$guestResults = 'C:\PivO-Results-' + $nonce
$payload = Join-Path $run 'payload'
$results = Join-Path $run 'results'
New-Item -ItemType Directory -Path $payload -Force | Out-Null
New-Item -ItemType Directory -Path $results -Force | Out-Null
Copy-Item -LiteralPath $binary.FullName -Destination (Join-Path $payload 'pivo.exe')
foreach ($script in @('bootstrap.ps1', 'capture-environment.ps1', 'run-smoke.ps1', 'set-fullhd.ps1', 'webview-runtime.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination $payload
}
if ($WebView2Installer) {
    Copy-Item -LiteralPath $installer.FullName -Destination (Join-Path $payload 'webview2-installer.exe')
}
$hostFolder = [Security.SecurityElement]::Escape($payload)
@{ Scale = $Scale; FullHd = [bool]$FullHd; ResultsPath = $guestResults; GuestBrowserFolder = $GuestBrowserFolder; NativeInput = [bool]$NativeInput } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'profile.json') -Encoding utf8
if ($DebugHelper) { Copy-Item -LiteralPath $helper.FullName -Destination (Join-Path $payload 'pivo-debug-mcp.exe') }
$hostResults = [Security.SecurityElement]::Escape($results)
$configuration = @"
<Configuration>
  <vGPU>Enable</vGPU>
  <Networking>$networkValue</Networking>
  <MemoryInMB>4096</MemoryInMB>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <PrinterRedirection>Disable</PrinterRedirection>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$hostFolder</HostFolder>
      <SandboxFolder>$guestPayload</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>$hostResults</HostFolder>
      <SandboxFolder>$guestResults</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -NoProfile -NoExit -ExecutionPolicy Bypass -File &quot;$guestPayload\bootstrap.ps1&quot;</Command>
  </LogonCommand>
</Configuration>
"@
$configurationPath = Join-Path $run 'pivo.wsb'
Set-Content -LiteralPath $configurationPath -Value $configuration -Encoding utf8
[pscustomobject]@{
    Configuration = $configurationPath
    Payload = $payload
    Results = $results
    GuestPayload = $guestPayload
    GuestResults = $guestResults
    Sha256 = (Get-FileHash -LiteralPath (Join-Path $payload 'pivo.exe') -Algorithm SHA256).Hash
    Networking = $networkValue
    Launched = -not $PrepareOnly
}
if (-not $PrepareOnly) {
    # Sandbox is the interactive test desktop; its window must be visible.
    Start-Process -FilePath $sandboxExecutable -ArgumentList ('"' + $configurationPath + '"') -ErrorAction Stop
}
