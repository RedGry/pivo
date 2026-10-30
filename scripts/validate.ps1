param([switch]$Plan)

$ErrorActionPreference = 'Stop'
$steps = @(
    @{ Tool = 'npm'; Arguments = @('--prefix', 'windows/frontend', 'ci') }
    @{ Tool = 'npm'; Arguments = @('--prefix', 'windows/frontend', 'test') }
    @{ Tool = 'npm'; Arguments = @('--prefix', 'windows/frontend', 'run', 'build') }
    @{ Tool = 'cargo'; Arguments = @('fmt', '--all', '--', '--check') }
    @{ Tool = 'cargo'; Arguments = @('clippy', '--workspace', '--all-targets', '--locked', '--', '-D', 'warnings') }
    @{ Tool = 'cargo'; Arguments = @('test', '--workspace', '--locked') }
    @{ Tool = 'cargo'; Arguments = @('build', '-p', 'pivo-windows', '--release', '--locked') }
)

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    foreach ($step in $steps) {
        Write-Host "$($step.Tool) $($step.Arguments -join ' ')"
        if ($Plan) { continue }
        $stepArguments = $step.Arguments
        & $step.Tool @stepArguments
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
} finally {
    Pop-Location
}
