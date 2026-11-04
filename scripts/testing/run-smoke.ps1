param([string]$Results = 'C:\PivO-Results')

$ErrorActionPreference = 'Stop'
$testProfile = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'profile.json') -Raw | ConvertFrom-Json
$environment = & (Join-Path $PSScriptRoot 'capture-environment.ps1') -Output (Join-Path $Results 'environment.json')
$report = [ordered]@{
    Status = 'running'; StartedAtUtc = [DateTime]::UtcNow.ToString('o')
    Profile = @{ Width = 1920; Height = 1080; Scale = $testProfile.Scale; Status = 'unavailable' }
    Scope = 'Synthetic click and candidate captures do not prove reveal. Native input and expanded capture require the separate opt-in fixture report.'
    Steps = @(); Error = $null; CleanExit = $false
    HelperSha256 = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'pivo-debug-mcp.exe') -Algorithm SHA256).Hash
    RuntimeFolder = $env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER
}
if ($environment.FullHdPrimary -and $environment.SystemScalePercent -eq $testProfile.Scale -and $environment.Screens.Count -eq 1) {
    $report.Profile.Status = 'matched'
}
function Save-Report {
    $report.UpdatedAtUtc = [DateTime]::UtcNow.ToString('o')
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $Results 'smoke.json') -Encoding utf8
}
$helper = New-Object Diagnostics.Process
$helper.StartInfo.FileName = Join-Path $PSScriptRoot 'pivo-debug-mcp.exe'
$helper.StartInfo.Arguments = '--app "' + (Join-Path $PSScriptRoot 'pivo.exe') + '"'
$helper.StartInfo.WorkingDirectory = $env:TEMP
$helper.StartInfo.UseShellExecute = $false
$helper.StartInfo.CreateNoWindow = $true
$helper.StartInfo.RedirectStandardInput = $true
$helper.StartInfo.RedirectStandardOutput = $true
$helper.StartInfo.RedirectStandardError = $true
$helper.StartInfo.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
$helper.StartInfo.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
$script:requestId = 0
$script:transportHealthy = $true
$script:requestTimeoutMilliseconds = 12000
$started = $false
$launched = $false
function Save-ProtocolError([string]$Line) {
    $preview = $Line -replace '("data"\s*:\s*")[^"]*', '$1[redacted]'
    $preview.Substring(0, [Math]::Min(512, $preview.Length)) | Set-Content -LiteralPath (Join-Path $Results 'protocol-error.txt') -Encoding utf8
}
function Request([string]$Method, $Parameters) {
    $script:requestId++
    $request = @{ jsonrpc = '2.0'; id = $script:requestId; method = $Method; params = $Parameters }
    $script:protocolInput.WriteLine(($request | ConvertTo-Json -Compress -Depth 10))
    $read = $helper.StandardOutput.ReadLineAsync()
    if (-not $read.Wait($script:requestTimeoutMilliseconds)) {
        $script:transportHealthy = $false
        throw "MCP $Method exceeded its $($script:requestTimeoutMilliseconds)-millisecond response deadline."
    }
    $line = $read.Result
    if (-not $line) {
        $script:transportHealthy = $false
        throw "MCP closed stdout during $Method."
    }
    try { $response = $line | ConvertFrom-Json } catch {
        $script:transportHealthy = $false
        Save-ProtocolError $line
        throw "Malformed MCP response for $Method."
    }
    if ($response.id -ne $script:requestId -or $response.error) {
        $script:transportHealthy = $false
        Save-ProtocolError $line
        throw "Invalid MCP response for $Method."
    }
    if ($response.result.isError) { throw ($response.result.content | Where-Object type -eq 'text' | ForEach-Object text | Out-String) }
    return $response.result
}
function Tool([string]$Name, $Arguments = @{}) {
    $result = Request 'tools/call' @{ name = $Name; arguments = $Arguments }
    $report.Steps += @{ Tool = $Name; AtUtc = [DateTime]::UtcNow.ToString('o') }
    Save-Report
    return $result
}
function Status {
    $result = Tool 'pivo_status'
    return ($result.content | Where-Object type -eq 'text' | Select-Object -First 1).text | ConvertFrom-Json
}
function Wait-VisiblePanel([int]$TimeoutMilliseconds = 30000, [int]$PollMilliseconds = 250) {
    # WebView setup can continue after the hidden Tauri window has been created.
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    do {
        $remaining = [int][Math]::Ceiling(($deadline - [DateTime]::UtcNow).TotalMilliseconds)
        if ($remaining -le 0) { throw "PivO panel did not become visible within $TimeoutMilliseconds milliseconds." }
        $previousTimeout = $script:requestTimeoutMilliseconds
        try {
            $script:requestTimeoutMilliseconds = [Math]::Min(12000, $remaining)
            $startupStatus = Status
        } finally { $script:requestTimeoutMilliseconds = $previousTimeout }
        $report.StartupStatuses += @{ AtUtc = [DateTime]::UtcNow.ToString('o'); Status = $startupStatus }
        Save-Report
        if ($startupStatus.running -and $startupStatus.visible) { return $startupStatus }
        $remaining = [int][Math]::Ceiling(($deadline - [DateTime]::UtcNow).TotalMilliseconds)
        if ($remaining -gt 0) { Start-Sleep -Milliseconds ([Math]::Min($PollMilliseconds, $remaining)) }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "PivO panel did not become visible within $TimeoutMilliseconds milliseconds."
}
function Capture([string]$Name) {
    $result = Tool 'pivo_screenshot'
    $picture = $result.content | Where-Object { $_.type -eq 'image' -and $_.mimeType -eq 'image/png' } | Select-Object -First 1
    if (-not $picture) { throw 'MCP screenshot returned no PNG.' }
    [IO.File]::WriteAllBytes((Join-Path $Results ($Name + '.png')), [Convert]::FromBase64String($picture.data))
}
function Verify-NativeInput {
    $report.NativeInput = @{ Status = 'running'; TimeoutSeconds = 30 }
    Save-Report
    $fixture = [Diagnostics.Process]::new()
    $fixture.StartInfo.FileName = Join-Path $PSScriptRoot 'pivo-debug-mcp.exe'
    $fixture.StartInfo.Arguments = '--verify-tauri-input --app "' + (Join-Path $PSScriptRoot 'pivo.exe') + '"'
    $fixture.StartInfo.WorkingDirectory = $env:TEMP
    $fixture.StartInfo.UseShellExecute = $false
    $fixture.StartInfo.CreateNoWindow = $true
    $fixture.StartInfo.RedirectStandardOutput = $true
    $fixture.StartInfo.RedirectStandardError = $true
    $fixture.StartInfo.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $fixture.StartInfo.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $fixtureStarted = $false
    try {
        if (-not $fixture.Start()) { throw 'Could not start the explicitly requested native input fixture.' }
        $fixtureStarted = $true
        $nativeOutput = $fixture.StandardOutput.ReadToEndAsync()
        $nativeError = $fixture.StandardError.ReadToEndAsync()
        if (-not $fixture.WaitForExit(30000)) {
            $fixture.Kill()
            $null = $fixture.WaitForExit(2000)
            throw 'Native input fixture exceeded its 30-second deadline.'
        }
        if (-not $nativeOutput.Wait(2000)) { throw 'Native input fixture stdout collection timed out.' }
        $report.NativeInput.ExitCode = $fixture.ExitCode
        if ($fixture.ExitCode -ne 0) { throw "Native input fixture exited with code $($fixture.ExitCode)." }
        $nativeReport = $nativeOutput.Result | ConvertFrom-Json
        if ($nativeReport.passed -isnot [bool] -or -not $nativeReport.passed) { throw 'Native input fixture did not report passed: true.' }
        $expanded = $nativeReport.expanded_capture
        if ($expanded.ready -isnot [bool] -or -not $expanded.ready) { throw 'Native input fixture did not prove readiness for the expanded capture.' }
        $images = @($expanded.content | Where-Object { $_.type -eq 'image' -and $_.mimeType -eq 'image/png' })
        if ($images.Count -ne 1) { throw 'Native input fixture did not return exactly one expanded PNG capture.' }
        $png = [Convert]::FromBase64String($images[0].data)
        $signature = [byte[]]@(137, 80, 78, 71, 13, 10, 26, 10)
        if ($png.Length -lt $signature.Length) { throw 'Expanded capture is not a PNG.' }
        for ($index = 0; $index -lt $signature.Length; $index++) {
            if ($png[$index] -ne $signature[$index]) { throw 'Expanded capture is not a PNG.' }
        }
        [IO.File]::WriteAllBytes((Join-Path $Results 'expanded-candidate.png'), $png)
        $report.ExpandedCapture = @{ Ready = $true; Source = 'native input fixture expanded readiness before and after capture'; File = 'expanded-candidate.png' }
        $report.NativeInput.Status = 'passed'
    } catch {
        $report.NativeInput.Status = 'failed'
        $report.NativeInput.Error = $_.Exception.Message
        throw
    } finally {
        if ($fixtureStarted) {
            if ($nativeOutput.Wait(2000)) { $nativeOutput.Result | Set-Content -LiteralPath (Join-Path $Results 'native-input.json') -Encoding utf8 }
            if ($nativeError.Wait(2000)) { $nativeError.Result | Set-Content -LiteralPath (Join-Path $Results 'native-input-stderr.txt') -Encoding utf8 }
        }
        $fixture.Dispose()
        Save-Report
    }
}
try {
    Save-Report
    $previousInputEncoding = [Console]::InputEncoding
    try {
        # WinPS5 creates and flushes its inherited-encoding stdin writer during Start.
        # Prevent that initial BOM before attaching our dedicated UTF-8 writer.
        [Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
        if (-not $helper.Start()) { throw 'Could not start pivo-debug MCP.' }
        $started = $true
        $script:protocolInput = [IO.StreamWriter]::new($helper.StandardInput.BaseStream, [Text.UTF8Encoding]::new($false))
        $script:protocolInput.AutoFlush = $true
    } finally { [Console]::InputEncoding = $previousInputEncoding }
    $stderr = $helper.StandardError.ReadToEndAsync()
    $null = Request 'initialize' @{ protocolVersion = '2025-11-25'; capabilities = @{}; clientInfo = @{ name = 'pivo-sandbox-smoke'; version = '1' } }
    $script:protocolInput.WriteLine('{"jsonrpc":"2.0","method":"notifications/initialized"}')
    $initial = Status
    if ($initial.running) { throw 'Expected a clean guest with no existing PivO process.' }
    # Mark ownership before launch so cleanup also runs when launch reports an error.
    $launched = $true
    $null = Tool 'pivo_launch'
    $report.StartupStatuses = @()
    $report.InitialStatus = Wait-VisiblePanel
    Capture 'compact-candidate'
    $client = $report.InitialStatus.client
    $null = Tool 'pivo_click' @{ x = [int]($client.width / 2); y = [Math]::Min(8, $client.height - 1) }
    Start-Sleep -Milliseconds 1000
    $report.AfterClickStatus = Status
    Capture 'after-synthetic-candidate'
    if ($testProfile.NativeInput) { Verify-NativeInput }
    $report.Status = 'completed'
} catch {
    $report.Status = 'failed'
    $report.Error = $_.Exception.Message
} finally {
    if ($started) {
        if (-not $helper.HasExited -and $launched -and $script:transportHealthy) {
            try {
                $null = Tool 'pivo_close'
                $deadline = [DateTime]::UtcNow.AddSeconds(10)
                do {
                    Start-Sleep -Milliseconds 150
                    $status = Status
                } while ($status.running -and [DateTime]::UtcNow -lt $deadline)
                $report.CleanExit = -not $status.running
                $report.FinalStatus = $status
                if ($report.CleanExit -and $report.InitialStatus.pid) {
                    try {
                        $application = [Diagnostics.Process]::GetProcessById([int]$report.InitialStatus.pid)
                        $exitBudget = [Math]::Max(0, [int][Math]::Ceiling(($deadline - [DateTime]::UtcNow).TotalMilliseconds))
                        $report.CleanExit = $application.WaitForExit($exitBudget)
                        $application.Dispose()
                    } catch [ArgumentException] { $report.CleanExit = $true }
                }
            } catch { $report.CleanupError = $_.Exception.Message }
        }
        try {
            if (-not $helper.HasExited) {
                $script:protocolInput.Close()
                if (-not $helper.WaitForExit(2000)) {
                    $helper.Kill()
                    $null = $helper.WaitForExit(2000)
                }
            }
            if ($helper.HasExited) { $report.HelperExitCode = $helper.ExitCode }
            if ($stderr.Wait(2000)) {
                $stderr.Result | Set-Content -LiteralPath (Join-Path $Results 'helper-stderr.txt') -Encoding utf8
            } else { $report.StderrError = 'Helper stderr exceeded the two-second collection deadline.' }
        } catch { $report.HelperCleanupError = $_.Exception.Message }
    }
    if (-not $report.CleanExit) { $report.Status = 'failed' }
    Save-Report
    $helper.Dispose()
}
if ($report.Status -eq 'failed') { throw 'Guest MCP smoke failed; inspect smoke.json.' }
