$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "SECRET SKYRIM MP LAUNCHER + VOICE" -ForegroundColor Cyan
Write-Host "Windows portable build" -ForegroundColor DarkGray
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed or is not in PATH. Install Node.js LTS first." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not available in PATH." }

$gameDir = Read-Host "Path to Skyrim folder (contains SkyrimSE.exe)"
$gameDir = $gameDir.Trim('"')
$skyrimExe = Join-Path $gameDir 'SkyrimSE.exe'
if (-not (Test-Path -LiteralPath $skyrimExe -PathType Leaf)) { throw "SkyrimSE.exe was not found in: $gameDir" }

Write-Host "[1/7] Extracting Skyrim icon..." -ForegroundColor Gray
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\tools\extract-skyrim-icon.ps1" -SkyrimExe $skyrimExe -OutputPng "$PSScriptRoot\build\icon.png"

Write-Host "[2/7] Preparing bundled Mumble runtime..." -ForegroundColor Gray
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\tools\prepare-voice-runtime.ps1"

Write-Host "[3/7] Building SkyrimVoice Mumble plugin..." -ForegroundColor Gray
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\tools\build-voice-plugin.ps1"

Write-Host "[4/7] Installing Electron dependencies..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "[5/7] Running tests..." -ForegroundColor Gray
npm test
if ($LASTEXITCODE -ne 0) { throw "tests failed" }

Write-Host "[6/7] Building portable launcher..." -ForegroundColor Gray
npm run dist
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

Write-Host "[7/7] Copying Voice Runtime next to launcher..." -ForegroundColor Gray
$distVoice = Join-Path $PSScriptRoot 'dist\Voice'
if (Test-Path $distVoice) { Remove-Item $distVoice -Recurse -Force }
Copy-Item "$PSScriptRoot\Voice" $distVoice -Recurse -Force
# Source/header/build files are not needed by players.
Remove-Item (Join-Path $distVoice 'plugin-src') -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "DONE" -ForegroundColor Green
Write-Host "Distribute BOTH:" -ForegroundColor Yellow
Write-Host "  $PSScriptRoot\dist\Secret Skyrim MP Launcher.exe"
Write-Host "  $PSScriptRoot\dist\Voice\"
Write-Host ""
