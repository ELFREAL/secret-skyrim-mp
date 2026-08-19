param(
  [string]$Version = '1.5.915'
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$url = "https://dl.mumble.info/stable/mumble_server-$Version.x64.exe"
$installer = Join-Path $env:RUNNER_TEMP "mumble_server-$Version.x64.exe"

Write-Host "Downloading pinned Mumble Server $Version from $url" -ForegroundColor Gray
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $installer
if (-not (Test-Path $installer)) { throw 'Mumble Server installer download failed.' }

Write-Host 'Installing Mumble Server silently on the CI build machine...' -ForegroundColor Gray
$p = Start-Process -FilePath $installer -ArgumentList @('/quiet', '/norestart') -PassThru -Wait
if ($p.ExitCode -notin @(0, 1641, 3010)) {
  throw "Mumble Server installer failed: $($p.ExitCode)"
}

$locations = @(
  "$env:ProgramFiles\Mumble\server\mumble-server.exe",
  "$env:ProgramFiles\Mumble\mumble-server.exe",
  "${env:ProgramFiles(x86)}\Mumble\server\mumble-server.exe",
  "${env:ProgramFiles(x86)}\Mumble\mumble-server.exe"
)

$serverExe = $locations | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $serverExe) {
  $roots = @()
  if ($env:ProgramFiles) {
    $roots += (Join-Path $env:ProgramFiles 'Mumble')
  }
  if (${env:ProgramFiles(x86)}) {
    $roots += (Join-Path ${env:ProgramFiles(x86)} 'Mumble')
  }
  $roots = $roots | Where-Object { $_ -and (Test-Path $_) }

  foreach ($root in $roots) {
    $found = Get-ChildItem -Path $root -Filter 'mumble-server.exe' -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) {
      $serverExe = $found.FullName
      break
    }
  }
}

if (-not $serverExe) { throw 'Mumble Server installed but mumble-server.exe was not found.' }

$sourceDir = Split-Path -Parent $serverExe
$dest = Join-Path $repo 'server\vendor\mumble-server'
Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item (Join-Path $sourceDir '*') $dest -Recurse -Force

$bundledExe = Join-Path $dest 'mumble-server.exe'
if (-not (Test-Path $bundledExe)) {
  throw "Bundled Mumble Server executable not found after copy: $bundledExe"
}

Write-Host "Mumble Server runtime ready: $bundledExe" -ForegroundColor Green
