$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'webview-runtime.ps1')
function Assert($condition, [string]$message) { if (-not $condition) { throw $message } }
# Actual Sandbox product registration uses this name rather than the installer marketing label.
Assert (Test-WebView2Registration ([pscustomobject]@{ name = 'Microsoft EdgeWebView'; pv = '154.0.3982.0' })) 'Registered runtime with the actual Sandbox name must be accepted.'
Assert (-not (Test-WebView2Registration $null)) 'Missing registration must be rejected.'
Assert (-not (Test-WebView2Registration ([pscustomobject]@{ pv = '0.0.0.0' }))) 'Zero version must be rejected.'
Assert (-not (Test-WebView2Registration ([pscustomobject]@{}))) 'Missing version must be rejected.'
Assert (-not (Test-WebView2Registration ([pscustomobject]@{ pv = 'invalid' }))) 'Invalid version must be rejected.'
Assert (Test-GuestBrowserFolder 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application\156.0.4314.58') 'Explicit versioned local WebView2 folder must be accepted.'
Assert (-not (Test-GuestBrowserFolder '\\server\share\156.0.4314.58')) 'UNC runtime overrides must be rejected.'
Assert (-not (Test-GuestBrowserFolder 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application')) 'Non-versioned runtime overrides must be rejected.'
Assert (-not (Test-GuestBrowserFolder 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application\156.0.4314.58\..')) 'Traversal must be rejected.'
Write-Host 'WebView2 registration checks passed.'
