function Test-GuestBrowserFolder([string]$Path) {
    return $Path -cmatch '^[A-Za-z]:\\Program Files(?: \(x86\))?\\Microsoft\\EdgeWebView\\Application\\[0-9]+(?:\.[0-9]+){3}$'
}

function Test-WebView2Registration($Registration) {
    if ($null -eq $Registration) { return $false }
    [Version]$installedVersion = $null
    return [Version]::TryParse([string]$Registration.pv, [ref]$installedVersion) -and $installedVersion -gt [Version]'0.0.0.0'
}

function Get-WebView2Runtime {
    # Microsoft documents this product key and its pv value; display names can differ.
    $product = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    foreach ($root in @(
        'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients',
        'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients'
    )) {
        $path = Join-Path $root $product
        if (Test-Path -LiteralPath $path) {
            $registration = Get-ItemProperty -LiteralPath $path
            if (Test-WebView2Registration $registration) { return $registration }
        }
    }
    return $null
}
