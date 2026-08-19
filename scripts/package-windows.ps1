param([string]$Version = 'dev')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path $repo 'artifacts'
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $out | Out-Null

# CLIENT OVERLAY
$client = Join-Path $out "secret-skyrim-mp-client-$Version"
New-Item -ItemType Directory -Force -Path "$client\Data\Platform\Plugins", "$client\Voice" | Out-Null
Copy-Item "$repo\client\skyrim-platform\*" "$client\Data\Platform\Plugins\" -Force
Copy-Item "$repo\launcher\dist\Secret Skyrim MP Launcher.exe" "$client\Secret Skyrim MP Launcher.exe" -Force
Copy-Item "$repo\launcher\Voice\*" "$client\Voice\" -Recurse -Force
@'
Secret Skyrim MP client overlay.

1. Own/install Skyrim SE/AE and a compatible SkyMP client.
2. Copy this overlay into the prepared client/game folder as documented.
3. Start "Secret Skyrim MP Launcher.exe".
4. On first start choose the Skyrim folder.

The archive intentionally does not redistribute Skyrim game files.
'@ | Set-Content -Encoding UTF8 "$client\README_RU.txt"
Compress-Archive -Path "$client\*" -DestinationPath "$out\secret-skyrim-mp-client-$Version.zip" -Force

# SERVER
$server = Join-Path $out "secret-skyrim-mp-server-$Version"
New-Item -ItemType Directory -Force -Path "$server\runtime\ui", "$server\gameData", "$server\docs" | Out-Null
Copy-Item "$repo\server\vendor\skymp\skymp5-server.js" "$server\runtime\skymp5-server.js" -Force
Copy-Item "$repo\server\vendor\skymp\scam_native.node" "$server\runtime\scam_native.node" -Force
Copy-Item "$repo\server\runtime\gamemode.js" "$server\runtime\gamemode.js" -Force
Copy-Item "$repo\server\runtime\gamemode-config.json" "$server\runtime\gamemode-config.json" -Force
Copy-Item "$repo\server\runtime\server-settings.json" "$server\runtime\server-settings.json" -Force
Copy-Item "$repo\server\runtime\ui\core-ui.html" "$server\runtime\ui\core-ui.html" -Force
Copy-Item "$repo\docs\*.md" "$server\docs\" -Force
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
Copy-Item $nodePath "$server\runtime\node.exe" -Force
@'
@echo off
setlocal
cd /d "%~dp0runtime"
if not exist "..\gameData\Skyrim.esm" (
  echo [ERROR] Put legal Skyrim masters into gameData before starting.
  pause
  exit /b 1
)
node.exe skymp5-server.js
'@ | Set-Content -Encoding ASCII "$server\START_SERVER.cmd"
Compress-Archive -Path "$server\*" -DestinationPath "$out\secret-skyrim-mp-server-$Version.zip" -Force

# source snapshot, excludes Git metadata/generated deps automatically because this runs from clean checkout
$sourceStage = Join-Path $out "secret-skyrim-mp-source-$Version"
New-Item -ItemType Directory -Force -Path $sourceStage | Out-Null
Get-ChildItem $repo -Force | Where-Object { $_.Name -notin @('.git','artifacts') } | ForEach-Object {
  Copy-Item $_.FullName $sourceStage -Recurse -Force
}
Remove-Item "$sourceStage\launcher\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$sourceStage\launcher\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$sourceStage\launcher\Voice\runtime" -Recurse -Force -ErrorAction SilentlyContinue
Compress-Archive -Path "$sourceStage\*" -DestinationPath "$out\secret-skyrim-mp-source-$Version.zip" -Force

Get-FileHash "$out\*.zip" -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  $([IO.Path]::GetFileName($_.Path))" } | Set-Content -Encoding ASCII "$out\SHA256SUMS.txt"
