$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$fixture = Join-Path $repository ('.local/sandbox-tests/' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$executable = Join-Path $fixture 'fixture.exe'
$installer = Join-Path $fixture 'runtime.exe'
# These bytes must never execute. PrepareOnly tests staging without a VM or real runtime.
[IO.File]::WriteAllBytes($executable, [byte[]]@(1, 2, 3, 4))
[IO.File]::WriteAllBytes($installer, [byte[]]@(5, 6))
function Assert($condition, [string]$message) { if (-not $condition) { throw $message } }
function RunDirectories {
    @(Get-ChildItem -LiteralPath (Join-Path $repository '.local/sandbox') -Directory -ErrorAction SilentlyContinue).Count
}
$before = RunDirectories
$plan = & (Join-Path $PSScriptRoot 'start-sandbox.ps1') -Executable $executable -Plan
Assert ($before -eq (RunDirectories)) 'Plan must not create a staging directory.'
Assert ($plan.Networking -eq 'Disable') 'Plan must default to offline.'

$offline = & (Join-Path $PSScriptRoot 'start-sandbox.ps1') -Executable $executable -PrepareOnly
$browserFolder = 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application\156.0.4314.58'
$online = & (Join-Path $PSScriptRoot 'start-sandbox.ps1') -Executable $executable -WebView2Installer $installer -DebugHelper $executable -GuestBrowserFolder $browserFolder -NativeInput -Scale 125 -FullHd -Networking -PrepareOnly
Assert ($offline.Configuration -ne $online.Configuration) 'Runs must not share mutable payloads.'
Assert ($offline.GuestPayload -ne $online.GuestPayload) 'Repeated runs must not reuse immutable guest payload mappings.'
Assert ($offline.GuestResults -ne $online.GuestResults) 'Repeated runs must not reuse guest results mappings.'
foreach ($run in @($offline, $online)) {
    [xml]$config = Get-Content -LiteralPath $run.Configuration -Raw
    $mapping = @($config.Configuration.MappedFolders.MappedFolder)
    Assert ($mapping.Count -eq 2) 'Only payload and per-run results folders may be shared.'
    Assert ($mapping[0].ReadOnly -eq 'true') 'The guest share must be read-only.'
    Assert ($mapping[0].HostFolder -eq $run.Payload) 'Only the run payload may be shared.'
    $nonce = Split-Path -Leaf (Split-Path -Parent $run.Configuration)
    Assert ($mapping[0].SandboxFolder -eq ('C:\PivO-Acceptance-' + $nonce)) 'Guest payload must use the unique run nonce to avoid immutable mapping collisions.'
    Assert ($mapping[1].ReadOnly -eq 'false') 'Results must be writable.'
    Assert ($mapping[1].HostFolder -eq $run.Results) 'Writable share must be the isolated per-run results folder.'
    Assert ($mapping[1].SandboxFolder -eq ('C:\PivO-Results-' + $nonce)) 'Guest results must use the unique run nonce.'
    $guestProfile = Get-Content -LiteralPath (Join-Path $run.Payload 'profile.json') -Raw | ConvertFrom-Json
    Assert ($guestProfile.ResultsPath -eq $mapping[1].SandboxFolder) 'Generated results path must reach the guest bootstrap through its profile.'
    Assert (@(Get-ChildItem -LiteralPath $run.Results).Count -eq 0) 'Results folder must start empty.'
    Assert ($config.Configuration.ClipboardRedirection -eq 'Disable') 'Clipboard must be isolated.'
    Assert ($config.Configuration.vGPU -eq 'Enable') 'Desktop tests need vGPU enabled.'
    Assert (-not $run.Launched) 'PrepareOnly must not launch a guest.'
    Assert ($run.Sha256 -eq (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash) 'Staging must preserve executable bytes.'
}
[xml]$offlineXml = Get-Content -LiteralPath $offline.Configuration -Raw
[xml]$onlineXml = Get-Content -LiteralPath $online.Configuration -Raw
Assert ($offlineXml.Configuration.Networking -eq 'Disable') 'Networking must be disabled by default.'
Assert ($onlineXml.Configuration.Networking -eq 'Enable') 'Networking requires explicit opt-in.'
Assert (@(Get-ChildItem -LiteralPath $offline.Payload).Count -eq 7) 'Payload must contain only application, five scripts and profile.'
Assert (@(Get-ChildItem -LiteralPath $online.Payload).Count -eq 9) 'Optional installer and helper must be staged explicitly.'
Assert ((Get-Content -LiteralPath (Join-Path $online.Payload 'profile.json') -Raw | ConvertFrom-Json).Scale -eq 125) 'Requested scale must reach the guest.'
Assert ((Get-Content -LiteralPath (Join-Path $online.Payload 'profile.json') -Raw | ConvertFrom-Json).FullHd) 'Full HD request must be explicit.'
Assert ((Get-Content -LiteralPath (Join-Path $online.Payload 'profile.json') -Raw | ConvertFrom-Json).GuestBrowserFolder -eq $browserFolder) 'Explicit guest browser folder must reach the profile.'
Assert (-not (Get-Content -LiteralPath (Join-Path $offline.Payload 'profile.json') -Raw | ConvertFrom-Json).GuestBrowserFolder) 'Default runtime selection must remain unchanged.'
Assert ((Get-Content -LiteralPath (Join-Path $online.Payload 'profile.json') -Raw | ConvertFrom-Json).NativeInput) 'Native input fixture must require explicit profile opt-in.'
Assert (-not (Get-Content -LiteralPath (Join-Path $offline.Payload 'profile.json') -Raw | ConvertFrom-Json).NativeInput) 'Default smoke must not run native input fixtures.'
Assert ((Get-FileHash -LiteralPath (Join-Path $online.Payload 'webview2-installer.exe')).Hash -eq (Get-FileHash -LiteralPath $installer).Hash) 'Installer bytes must be preserved.'
Write-Host 'Sandbox launcher checks passed. No guest or fixture executable was launched.'
