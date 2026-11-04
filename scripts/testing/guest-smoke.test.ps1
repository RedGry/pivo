#requires -Version 5.1
#requires -PSEdition Desktop
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$fixtureDirectory = Join-Path $repository ('.local/testing-regressions/' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
function Assert($condition, [string]$message) { if (-not $condition) { throw $message } }
function Import-TestedFunction([string]$File, [string]$Name) {
    $tokens = $null; $parseErrors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile($File, [ref]$tokens, [ref]$parseErrors)
    Assert (-not $parseErrors.Count) "Cannot parse $File."
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $Name }, $true)
    Assert ($null -ne $definition) "Missing function $Name."
    # Bind only the dependency path to the inert fixture; execute the real function body.
    return $definition.Extent.Text.Replace('$PSScriptRoot', '$fixtureDirectory')
}
$smokeScript = Join-Path $PSScriptRoot 'run-smoke.ps1'
Copy-Item -LiteralPath $smokeScript -Destination (Join-Path $fixtureDirectory 'run-smoke.ps1')
@{ Scale = 100 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixtureDirectory 'profile.json')
'param([string]$Output); [pscustomobject]@{ FullHdPrimary = $true; SystemScalePercent = 100; Screens = @(@{}) }' | Set-Content -LiteralPath (Join-Path $fixtureDirectory 'capture-environment.ps1')
# The helper never opens an app or window. Its raw stdin reader deliberately rejects a UTF-8 BOM.
Add-Type -OutputAssembly (Join-Path $fixtureDirectory 'pivo-debug-mcp.exe') -OutputType ConsoleApplication -TypeDefinition @'
using System;
using System.IO;
using System.Text;
public class PivoInertHelper {
    static string ReadLine(Stream input) {
        var data = new MemoryStream(); int b;
        while ((b = input.ReadByte()) >= 0 && b != 10) data.WriteByte((byte)b);
        return Encoding.UTF8.GetString(data.ToArray());
    }
    public static int Main() {
        var mode = Environment.GetEnvironmentVariable("PIVO_SMOKE_FIXTURE_MODE");
        if (mode == "early") { Console.Error.WriteLine("fixture stderr before initialize"); return 23; }
        if (mode == "native-missing") { Console.WriteLine("{\"passed\":true}"); return 0; }
        if (mode == "native-fail") { Console.WriteLine("{\"passed\":false}"); return 0; }
        if (mode == "native-pass" || mode == "native-not-ready" || mode == "native-bad-png") {
            var ready = mode == "native-not-ready" ? "false" : "true";
            var png = mode == "native-bad-png" ? "AA==" : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8LsAAAAASUVORK5CYII=";
            Console.WriteLine("{\"passed\":true,\"expanded_capture\":{\"ready\":" + ready + ",\"content\":[{\"type\":\"image\",\"mimeType\":\"image/png\",\"data\":\"" + png + "\"}]}}"); return 0;
        }
        var input = Console.OpenStandardInput(); var first = ReadLine(input);
        if (first.Length > 0 && first[0] == '\uFEFF') {
            Console.WriteLine("{\"jsonrpc\":\"2.0\",\"id\":null,\"error\":{\"code\":-32700,\"message\":\"BOM parse error\"}}"); return 0;
        }
        if (mode == "malformed") { Console.WriteLine("not-json"); return 0; }
        Console.WriteLine("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}");
        ReadLine(input); ReadLine(input);
        Console.WriteLine("{\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"isError\":true,\"content\":[{\"type\":\"text\",\"text\":\"fixture reached status without BOM\"}]}}");
        return 0;
    }
}
'@
$previousEncoding = [Console]::InputEncoding
$previousMode = $env:PIVO_SMOKE_FIXTURE_MODE
try {
    [Console]::InputEncoding = [Text.UTF8Encoding]::new($true)
    foreach ($mode in @('early', 'protocol', 'malformed')) {
        $env:PIVO_SMOKE_FIXTURE_MODE = $mode
        $Results = Join-Path $fixtureDirectory $mode
        New-Item -ItemType Directory -Path $Results | Out-Null
        try { & (Join-Path $fixtureDirectory 'run-smoke.ps1') -Results $Results } catch { }
        $actual = Get-Content -LiteralPath (Join-Path $Results 'smoke.json') -Raw | ConvertFrom-Json
        if ($mode -eq 'early') {
            Assert ($actual.HelperExitCode -eq 23) 'Early helper exit code must be saved.'
            Assert ((Get-Content -LiteralPath (Join-Path $Results 'helper-stderr.txt') -Raw) -match 'fixture stderr before initialize') 'Early helper stderr must be saved.'
        } elseif ($mode -eq 'protocol') {
            Assert ($actual.Error -match 'fixture reached status without BOM') 'Windows PowerShell stdin must not prepend a BOM.'
        } else {
            Assert ((Get-Content -LiteralPath (Join-Path $Results 'protocol-error.txt') -Raw) -match 'not-json') 'Malformed MCP response must preserve bounded diagnostics.'
        }
    }
    Invoke-Expression (Import-TestedFunction $smokeScript 'Wait-VisiblePanel')
    $script:requestTimeoutMilliseconds = 12000
    $script:statuses = [Collections.Generic.Queue[object]]::new()
    $script:statuses.Enqueue([pscustomobject]@{ running = $true; visible = $false })
    $script:statuses.Enqueue([pscustomobject]@{ running = $true; visible = $true })
    function Status { if ($script:statuses.Count) { return $script:statuses.Dequeue() }; return [pscustomobject]@{ running = $true; visible = $false } }
    function Save-Report {}
    $report = @{ StartupStatuses = @() }
    $actual = Wait-VisiblePanel -TimeoutMilliseconds 500 -PollMilliseconds 1
    Assert ($actual.visible -and $report.StartupStatuses.Count -eq 2) 'Startup must wait for actual visibility.'
    Assert ($script:requestTimeoutMilliseconds -eq 12000) 'Startup must restore the request timeout.'
    $timedOut = $false
    try { $null = Wait-VisiblePanel -TimeoutMilliseconds 20 -PollMilliseconds 1 } catch { $timedOut = $_.Exception.Message -match 'did not become visible' }
    Assert $timedOut 'A permanently hidden panel must fail the readiness deadline.'

    Invoke-Expression (Import-TestedFunction (Join-Path $PSScriptRoot 'run-sandbox.ps1') 'Assert-SoleSandbox')
    $expectedId = [Guid]::NewGuid()
    foreach ($ids in @(@(), @([Guid]::NewGuid()), @($expectedId, [Guid]::NewGuid()))) {
        $inventory = [pscustomobject]@{ WindowsSandboxEnvironments = @($ids | ForEach-Object { [pscustomobject]@{ Id = $_.ToString() } }) }
        $rejected = $false
        try { Assert-SoleSandbox $inventory $expectedId } catch { $rejected = $true }
        Assert $rejected 'Missing, different or multiple guests must not authorize viewport resizing.'
    }
    Assert-SoleSandbox ([pscustomobject]@{ WindowsSandboxEnvironments = @([pscustomobject]@{ Id = $expectedId.ToString() }) }) $expectedId

    Invoke-Expression (Import-TestedFunction $smokeScript 'Verify-NativeInput')
    foreach ($mode in @('native-pass', 'native-fail', 'native-missing', 'native-not-ready', 'native-bad-png')) {
        $env:PIVO_SMOKE_FIXTURE_MODE = $mode
        $Results = Join-Path $fixtureDirectory $mode
        New-Item -ItemType Directory -Path $Results | Out-Null
        $report = @{}
        $rejected = $false
        try { Verify-NativeInput } catch { $rejected = $true }
        Assert ($rejected -eq ($mode -ne 'native-pass')) 'Native input success requires both passing assertions and a ready expanded PNG.'
        Assert (Test-Path -LiteralPath (Join-Path $Results 'native-input.json')) 'Native fixture output must be preserved.'
        Assert ((Test-Path -LiteralPath (Join-Path $Results 'expanded-candidate.png')) -eq ($mode -eq 'native-pass')) 'Expanded PNG may only be saved from a proven ready native capture.'
    }
} finally {
    [Console]::InputEncoding = $previousEncoding
    $env:PIVO_SMOKE_FIXTURE_MODE = $previousMode
}
Write-Host 'Guest smoke regressions passed. Only inert subprocesses ran; no VM, PivO or window actions.'
