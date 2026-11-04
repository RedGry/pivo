#requires -Version 7.0
param(
    [Parameter(Mandatory)][Guid]$SandboxId,
    [Parameter(Mandatory)][string]$DebugHelper,
    [string]$Executable = (Join-Path $PSScriptRoot '../../target/release/pivo.exe'),
    [string]$WebView2Installer,
    [string]$GuestBrowserFolder,
    [switch]$NativeInput,
    [ValidateSet(100, 125)][int]$Scale = 100,
    [switch]$FullHd,
    [switch]$ResizeViewport,
    [switch]$Plan
)

$ErrorActionPreference = 'Stop'
if ($SandboxId -eq [Guid]::Empty) { throw 'Supply the explicit ID of an existing Sandbox guest.' }
$staging = @{ Executable = $Executable; DebugHelper = $DebugHelper; Scale = $Scale; FullHd = $FullHd }
if ($WebView2Installer) { $staging.WebView2Installer = $WebView2Installer }
if ($GuestBrowserFolder) { $staging.GuestBrowserFolder = $GuestBrowserFolder }
if ($NativeInput) { $staging.NativeInput = $true }
if ($Plan) {
    $inputs = & (Join-Path $PSScriptRoot 'start-sandbox.ps1') @staging -Plan
    [pscustomobject]@{
        SandboxId = $SandboxId.ToString(); Executable = $inputs.Executable; Sha256 = $inputs.Sha256
        DebugHelper = $inputs.DebugHelper; ExpectedScale = $Scale; ResizeViewport = [bool]$ResizeViewport
        GuestBrowserFolder = $inputs.GuestBrowserFolder
        NativeInput = $inputs.NativeInput
        Actions = 'Stage fresh payload; attach read-only payload and writable results; measure guest; optionally resize sole Sandbox client; remeasure; run guest bootstrap.'
        Boundary = 'No VM creation/stop, host display mode or DPI changes. Plan makes no VM calls or filesystem writes.'
    }
    return
}
$wsb = (Get-Command wsb.exe -ErrorAction Stop).Source
$run = & (Join-Path $PSScriptRoot 'start-sandbox.ps1') @staging -PrepareOnly
$nonce = Split-Path -Leaf (Split-Path -Parent $run.Configuration)
if ($nonce -cnotmatch '^[0-9a-f]{32}$') { throw 'Staging returned an invalid run nonce.' }
$guestPayload = 'C:\PivO-Acceptance-' + $nonce
$guestResults = 'C:\PivO-Results-' + $nonce
$guestProfile = Get-Content -LiteralPath (Join-Path $run.Payload 'profile.json') -Raw | ConvertFrom-Json
if ($guestProfile.ResultsPath -cne $guestResults) { throw 'Staged profile does not match this run results root.' }
$report = [ordered]@{
    SandboxId = $SandboxId.ToString(); Status = 'running'; Results = $run.Results
    StartedAtUtc = [DateTime]::UtcNow.ToString('o'); ResizeViewport = [bool]$ResizeViewport
    ViewportAttempts = @(); Error = $null
}
function Save-Report {
    $report.UpdatedAtUtc = [DateTime]::UtcNow.ToString('o')
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $run.Results 'orchestration.json') -Encoding utf8
}
function Assert-SoleSandbox($Inventory, [Guid]$ExpectedId) {
    $guests = @($Inventory.WindowsSandboxEnvironments)
    [Guid]$listedId = [Guid]::Empty
    if ($guests.Count -ne 1 -or -not [Guid]::TryParse([string]$guests[0].Id, [ref]$listedId) -or $listedId -ne $ExpectedId) {
        throw 'Viewport resize requires exactly one Sandbox guest whose ID matches SandboxId; no windows were resized.'
    }
}
function Invoke-Wsb([string[]]$Arguments, [int]$TimeoutSeconds = 45, [switch]$ReturnOutput) {
    $process = [Diagnostics.Process]::new()
    $process.StartInfo.FileName = $wsb
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $process.StartInfo.ArgumentList.Add($argument) }
    try {
        if (-not $process.Start()) { throw 'Could not start Windows Sandbox CLI.' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
        while (-not $process.WaitForExit(1000)) {
            if ([DateTime]::UtcNow -ge $deadline) {
                $process.Kill()
                throw "Sandbox CLI $($Arguments[0]) exceeded its $TimeoutSeconds-second deadline. Guest state must be checked before retrying."
            }
        }
        if ($process.ExitCode -ne 0) {
            $detail = if ($stderr.Wait(2000)) { [string]$stderr.Result } else { 'stderr unavailable' }
            throw "Sandbox CLI $($Arguments[0]) exited with code $($process.ExitCode): $($detail.Substring(0, [Math]::Min(800, $detail.Length)))"
        }
        # Drain bounded command results without printing verbose CLI metadata or encoded screenshots.
        if (-not $stdout.Wait(2000)) { throw 'Sandbox CLI stdout exceeded the two-second collection deadline.' }
        $null = $stderr.Wait(2000)
        if ($ReturnOutput) { return [string]$stdout.Result }
    } finally { $process.Dispose() }
}
function Guest-Command([string]$Command, [int]$TimeoutSeconds = 45) {
    Invoke-Wsb -Arguments @('exec', '--id', $SandboxId.ToString(), '-r', 'ExistingLogin', '-c', $Command) -TimeoutSeconds $TimeoutSeconds
}
function Measure-Guest([string]$Name) {
    Guest-Command ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}\capture-environment.ps1" -Output "{1}\{2}.json"' -f $guestPayload, $guestResults, $Name)
    $path = Join-Path $run.Results ($Name + '.json')
    if (-not (Test-Path -LiteralPath $path)) { throw 'Guest capture returned no environment report.' }
    return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json)
}
try {
    Save-Report
    Invoke-Wsb -Arguments @('share', '--id', $SandboxId.ToString(), '-f', $run.Payload, '-s', $guestPayload)
    Invoke-Wsb -Arguments @('share', '--id', $SandboxId.ToString(), '-f', $run.Results, '-s', $guestResults, '--allow-write')
    $environment = Measure-Guest 'viewport-before'
    if ($ResizeViewport) {
        $inventory = Invoke-Wsb -Arguments @('list', '--raw') -ReturnOutput | ConvertFrom-Json
        Assert-SoleSandbox $inventory $SandboxId
        $clients = @(Get-Process -Name WindowsSandboxRemoteSession -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
        if ($clients.Count -ne 1) { throw 'Viewport resize requires exactly one visible WindowsSandboxRemoteSession client; no windows were resized.' }
        $clientId = $clients[0].Id
        $clientHandle = $clients[0].MainWindowHandle
        Add-Type @'
using System;
using System.Runtime.InteropServices;
namespace PivoSandbox {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    public static class Client {
        [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
        [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window, out Rect rect);
        [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    }
}
'@
        $oldAwareness = [PivoSandbox.Client]::SetThreadDpiAwarenessContext([IntPtr](-4))
        if ($oldAwareness -eq [IntPtr]::Zero) { throw 'Could not enable physical-pixel client measurements.' }
        try {
            for ($attempt = 1; $attempt -le 3; $attempt++) {
                $screens = @($environment.Screens)
                if ($screens.Count -ne 1) { throw 'Viewport resize requires one measured guest display.' }
                if ($screens[0].Width -eq 1920 -and $screens[0].Height -eq 1080) { break }
                # Revalidate the exact process and HWND before every mutation; never resize a replacement client.
                $visibleClients = @(Get-Process -Name WindowsSandboxRemoteSession -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
                if ($visibleClients.Count -ne 1) { throw 'Sandbox client count changed; refusing to resize.' }
                $current = Get-Process -Id $clientId -ErrorAction Stop
                [uint32]$windowProcess = 0
                $null = [PivoSandbox.Client]::GetWindowThreadProcessId($clientHandle, [ref]$windowProcess)
                if ($current.ProcessName -ne 'WindowsSandboxRemoteSession' -or $current.MainWindowHandle -ne $clientHandle -or $windowProcess -ne $clientId -or -not [PivoSandbox.Client]::IsWindowVisible($clientHandle)) {
                    throw 'Sandbox client identity changed; refusing to resize.'
                }
                $outer = [PivoSandbox.Rect]::new()
                $inner = [PivoSandbox.Rect]::new()
                if (-not [PivoSandbox.Client]::GetWindowRect($clientHandle, [ref]$outer) -or -not [PivoSandbox.Client]::GetClientRect($clientHandle, [ref]$inner)) { throw 'Cannot measure the owned Sandbox client.' }
                $width = $outer.Right - $outer.Left + 1920 - $screens[0].Width
                $height = $outer.Bottom - $outer.Top + 1080 - $screens[0].Height
                if ($width -lt 400 -or $width -gt 8192 -or $height -lt 400 -or $height -gt 8192) { throw 'Calculated Sandbox client size is outside the bounded resize range.' }
                # SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE preserves position, stacking and focus.
                $inventory = Invoke-Wsb -Arguments @('list', '--raw') -ReturnOutput | ConvertFrom-Json
                Assert-SoleSandbox $inventory $SandboxId
                if (-not [PivoSandbox.Client]::SetWindowPos($clientHandle, [IntPtr]::Zero, 0, 0, $width, $height, 22)) { throw 'Sandbox client resize was rejected.' }
                $report.ViewportAttempts += @{ Attempt = $attempt; ProcessId = $clientId; Handle = $clientHandle.ToInt64(); OuterWidth = $width; OuterHeight = $height; PriorClientWidth = $inner.Right; PriorClientHeight = $inner.Bottom }
                Save-Report
                Start-Sleep -Milliseconds 2000
                $environment = Measure-Guest ('viewport-after-' + $attempt)
            }
        } finally { $null = [PivoSandbox.Client]::SetThreadDpiAwarenessContext($oldAwareness) }
    }
    $report.Environment = $environment
    $report.Profile = if ($environment.FullHdPrimary -and @($environment.Screens).Count -eq 1 -and $environment.SystemScalePercent -eq $Scale) { 'matched' } else { 'unavailable' }
    Save-Report
    Guest-Command ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}\bootstrap.ps1"' -f $guestPayload) -TimeoutSeconds 420
    $readinessPath = Join-Path $run.Results 'readiness.json'
    if (-not (Test-Path -LiteralPath $readinessPath)) { throw 'Guest bootstrap returned no readiness report.' }
    $readiness = Get-Content -LiteralPath $readinessPath -Raw | ConvertFrom-Json
    if ($readiness.Status -ne 'completed') { throw "Guest bootstrap failed at $($readiness.Stage): $($readiness.Error)" }
    $environment = Measure-Guest 'viewport-final'
    $report.Environment = $environment
    $report.Profile = if ($environment.FullHdPrimary -and @($environment.Screens).Count -eq 1 -and $environment.SystemScalePercent -eq $Scale) { 'matched' } else { 'unavailable' }
    $smokePath = Join-Path $run.Results 'smoke.json'
    if (-not (Test-Path -LiteralPath $smokePath)) { throw 'Guest returned no MCP smoke report.' }
    $smoke = Get-Content -LiteralPath $smokePath -Raw | ConvertFrom-Json
    $report.GuestSmokeProfile = $smoke.Profile.Status
    if ($smoke.Profile.Status -ne 'matched') { $report.Profile = 'unavailable' }
    $report.Status = 'completed'
} catch {
    $report.Status = 'failed'
    $report.Error = $_.Exception.Message
} finally { Save-Report }
[pscustomobject]@{ Status = $report.Status; Profile = $report.Profile; Results = $run.Results; Error = $report.Error }
if ($report.Status -ne 'completed') { throw 'Sandbox orchestration failed; inspect orchestration.json and guest evidence.' }
