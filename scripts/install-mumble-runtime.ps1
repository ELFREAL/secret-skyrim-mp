param(
  [string]$Version = '1.5.915'
)
$ErrorActionPreference = 'Stop'

# Official stable download directory. The build machine installs Mumble only
# temporarily so we can copy its runtime into the client artifact.
$url = "https://dl.mumble.info/stable/mumble_client-$Version.x64.exe"
$installer = Join-Path $env:RUNNER_TEMP "mumble_client-$Version.x64.exe"

Write-Host "Downloading pinned Mumble $Version from $url" -ForegroundColor Gray
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $installer
if (-not (Test-Path $installer)) { throw 'Mumble installer download failed.' }

Write-Host 'Installing Mumble silently on the CI build machine...' -ForegroundColor Gray
$p = Start-Process -FilePath $installer -ArgumentList @('/quiet', '/norestart') -PassThru -Wait
if ($p.ExitCode -ne 0) { throw "Mumble installer failed: $($p.ExitCode)" }

$locations = @(
  "$env:ProgramFiles\Mumble\client\mumble.exe",
  "$env:ProgramFiles\Mumble\mumble.exe",
  "${env:ProgramFiles(x86)}\Mumble\client\mumble.exe",
  "${env:ProgramFiles(x86)}\Mumble\mumble.exe"
)
$mumble = $locations | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $mumble) { throw 'Mumble installed but mumble.exe was not found.' }
Write-Host "Mumble build runtime ready: $mumble" -ForegroundColor Green
