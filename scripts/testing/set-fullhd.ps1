param([string]$Output = 'C:\PivO-Results\display-request.json')

$ErrorActionPreference = 'Stop'
# This API must never change the host desktop, even when invoked by mistake.
if ($env:USERNAME -ne 'WDAGUtilityAccount' -or ($PSScriptRoot -notin @('C:\PivO-Test', 'C:\PivO-Acceptance') -and $PSScriptRoot -notmatch '^C:\\PivO-Acceptance-[0-9a-f]{32}$')) {
    throw 'Display mode changes are allowed only in the staged Windows Sandbox guest.'
}
Add-Type @'
using System;
using System.Runtime.InteropServices;
namespace PivoTest {
    public static class Mode {
        [DllImport("user32.dll", CharSet=CharSet.Unicode)]
        public static extern bool EnumDisplaySettingsW(string device, int number, [In, Out] byte[] mode);
        [DllImport("user32.dll", CharSet=CharSet.Unicode)]
        public static extern int ChangeDisplaySettingsExW(string device, byte[] mode, IntPtr window, uint flags, IntPtr parameter);
    }
}
'@
$result = [ordered]@{ RequestedWidth = 1920; RequestedHeight = 1080; Status = 'unavailable'; Advertised = $false; TestCode = $null; ApplyCode = $null }
# DEVMODEW is 220 bytes. dmSize is at 68, dmFields at 72, dmPelsWidth/Height at 172/176.
# Only use an advertised mode; never invent a display-driver capability.
for ($number = 0; $number -lt 1024; $number++) {
    $mode = New-Object byte[] 220
    [BitConverter]::GetBytes([uint16]220).CopyTo($mode, 68)
    if (-not [PivoTest.Mode]::EnumDisplaySettingsW($null, $number, $mode)) { break }
    if ([BitConverter]::ToUInt32($mode, 172) -ne 1920 -or [BitConverter]::ToUInt32($mode, 176) -ne 1080) { continue }
    $result.Advertised = $true
    [BitConverter]::GetBytes([uint32]0x180000).CopyTo($mode, 72)
    $result.TestCode = [PivoTest.Mode]::ChangeDisplaySettingsExW($null, $mode, [IntPtr]::Zero, 2, [IntPtr]::Zero)
    if ($result.TestCode -eq 0) {
        $result.ApplyCode = [PivoTest.Mode]::ChangeDisplaySettingsExW($null, $mode, [IntPtr]::Zero, 0, [IntPtr]::Zero)
        if ($result.ApplyCode -eq 0) { $result.Status = 'applied-awaiting-measurement' }
    }
    break
}
$result | ConvertTo-Json | Set-Content -LiteralPath $Output -Encoding utf8
[pscustomobject]$result
