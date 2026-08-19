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

$vswhere = "$env:ProgramFiles(x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) { throw 'Visual Studio Build Tools with C++ are required on the build machine.' }
$vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw 'MSVC x64 build tools were not found.' }
$devcmd = Join-Path $vs 'Common7\Tools\VsDevCmd.bat'
$dll = Join-Path $outDir 'SkyrimVoice.dll'
$cmd = '"{0}" -arch=x64 -host_arch=x64 >nul && cl.exe /nologo /std:c++17 /EHsc /O2 /LD /I"{1}" "{2}" /link /OUT:"{3}" Ws2_32.lib' -f $devcmd, $include, $SourceFile, $dll
cmd.exe /d /s /c $cmd
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dll)) { throw 'SkyrimVoice.dll build failed.' }
Write-Host "SkyrimVoice plugin: $dll" -ForegroundColor Green
