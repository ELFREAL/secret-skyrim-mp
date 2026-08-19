param(
  [string]$Configuration = 'Release'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'Voice\plugin-src'
$include = Join-Path $src 'include'
$outDir = Join-Path $root 'Voice\runtime\plugins'
New-Item -ItemType Directory -Force -Path $include, $outDir | Out-Null

$header = Join-Path $include 'MumblePlugin.h'
if (-not (Test-Path $header)) {
  Write-Host 'Downloading official Mumble 1.5.x plugin API header...' -ForegroundColor Gray
  Invoke-WebRequest -UseBasicParsing `
    'https://raw.githubusercontent.com/mumble-voip/mumble/1.5.x/plugins/MumblePlugin.h' `
    -OutFile $header
}

$vswhere = "$env:ProgramFiles(x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  throw 'Visual Studio 2022 Build Tools with Desktop development with C++ is required.'
}
$vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw 'MSVC x64 build tools were not found.' }
$devcmd = Join-Path $vs 'Common7\Tools\VsDevCmd.bat'
$cpp = Join-Path $src 'SkyrimVoice.cpp'
$dll = Join-Path $outDir 'SkyrimVoice.dll'
$cmd = '"{0}" -arch=x64 -host_arch=x64 >nul && cl.exe /nologo /std:c++17 /EHsc /O2 /LD /I"{1}" "{2}" /link /OUT:"{3}" Ws2_32.lib' -f $devcmd, $include, $cpp, $dll
cmd.exe /d /s /c $cmd
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dll)) { throw 'SkyrimVoice.dll build failed.' }
Write-Host "SkyrimVoice plugin: $dll" -ForegroundColor Green
