param(
  [string]$Configuration = 'Release',
  [string]$SourceFile = ''
)
$ErrorActionPreference = 'Stop'
$launcherRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $launcherRoot
$include = Join-Path $launcherRoot 'Voice\plugin-src\include'
$outDir = Join-Path $launcherRoot 'Voice\runtime\plugins'
New-Item -ItemType Directory -Force -Path $include, $outDir | Out-Null

if (-not $SourceFile) {
  $monorepoSource = Join-Path $repoRoot 'voice\mumble-plugin\SkyrimVoice.cpp'
  $legacySource = Join-Path $launcherRoot 'Voice\plugin-src\SkyrimVoice.cpp'
  if (Test-Path $monorepoSource) { $SourceFile = $monorepoSource } else { $SourceFile = $legacySource }
}
if (-not (Test-Path $SourceFile)) { throw "SkyrimVoice.cpp not found: $SourceFile" }

$header = Join-Path $include 'MumblePlugin.h'
if (-not (Test-Path $header)) {
  Write-Host 'Downloading pinned Mumble v1.5.915 plugin API header...' -ForegroundColor Gray
  Invoke-WebRequest -UseBasicParsing `
    'https://raw.githubusercontent.com/mumble-voip/mumble/v1.5.915/plugins/MumblePlugin.h' `
    -OutFile $header
}

# windows-latest has Visual Studio installed, but its developer tools are not
# automatically added to PATH for a normal PowerShell step. Locate vswhere
# explicitly. Environment variable names containing parentheses require ${...}
# syntax in PowerShell.
$vswhereCandidates = @()
$programFilesX86 = ${env:ProgramFiles(x86)}
if ($programFilesX86) {
  $vswhereCandidates += (Join-Path $programFilesX86 'Microsoft Visual Studio\Installer\vswhere.exe')
}
if ($env:ProgramFiles) {
  $vswhereCandidates += (Join-Path $env:ProgramFiles 'Microsoft Visual Studio\Installer\vswhere.exe')
}
$vswhereFromPath = Get-Command vswhere.exe -ErrorAction SilentlyContinue
if ($vswhereFromPath) {
  $vswhereCandidates += $vswhereFromPath.Source
}

$vswhere = $vswhereCandidates |
  Where-Object { $_ -and (Test-Path $_) } |
  Select-Object -First 1

if (-not $vswhere) {
  Write-Host "ProgramFiles=$env:ProgramFiles" -ForegroundColor DarkGray
  Write-Host "ProgramFiles(x86)=$programFilesX86" -ForegroundColor DarkGray
  throw 'vswhere.exe was not found on the build machine.'
}

Write-Host "Using vswhere: $vswhere" -ForegroundColor Gray
$vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw 'MSVC x64 build tools were not found.' }

$devcmd = Join-Path $vs 'Common7\Tools\VsDevCmd.bat'
if (-not (Test-Path $devcmd)) { throw "VsDevCmd.bat not found: $devcmd" }

$dll = Join-Path $outDir 'SkyrimVoice.dll'
$cmd = '"{0}" -arch=x64 -host_arch=x64 >nul && cl.exe /nologo /std:c++17 /EHsc /O2 /LD /I"{1}" "{2}" /link /OUT:"{3}" Ws2_32.lib' -f $devcmd, $include, $SourceFile, $dll
cmd.exe /d /s /c $cmd
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dll)) { throw 'SkyrimVoice.dll build failed.' }
Write-Host "SkyrimVoice plugin: $dll" -ForegroundColor Green
