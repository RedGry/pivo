param([string]$Output = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'pivo-environment.json'))

$ErrorActionPreference = 'Stop'
if (-not ('PivoTest.Display' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
namespace PivoTest {
    public static class Display {
        [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
    }
}
'@
}
# Read physical bounds rather than DPI-virtualized logical screen coordinates.
if ([PivoTest.Display]::SetThreadDpiAwarenessContext([IntPtr](-4)) -eq [IntPtr]::Zero) {
    throw 'Could not enable physical-pixel display measurement.'
}
Add-Type -AssemblyName System.Windows.Forms
$dpi = [PivoTest.Display]::GetDpiForSystem()
$screens = @([Windows.Forms.Screen]::AllScreens | ForEach-Object {
    [pscustomobject]@{
        Device = $_.DeviceName
        Primary = $_.Primary
        X = $_.Bounds.X
        Y = $_.Bounds.Y
        Width = $_.Bounds.Width
        Height = $_.Bounds.Height
    }
})
$binary = Join-Path $PSScriptRoot 'pivo.exe'
$report = [pscustomobject]@{
    CapturedAtUtc = [DateTime]::UtcNow.ToString('o')
    WindowsVersion = [Environment]::OSVersion.Version.ToString()
    SystemDpi = $dpi
    SystemScalePercent = [math]::Round($dpi / 96 * 100)
    Screens = $screens
    FullHdPrimary = @($screens | Where-Object { $_.Primary -and $_.Width -eq 1920 -and $_.Height -eq 1080 }).Count -eq 1
    BinarySha256 = if (Test-Path -LiteralPath $binary) { (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash } else { $null }
    Note = 'Environment evidence only, not UI acceptance. Per-monitor scale must also be verified in guest Display settings.'
}
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Output -Encoding utf8
$report
Write-Host "Environment report: $Output"
