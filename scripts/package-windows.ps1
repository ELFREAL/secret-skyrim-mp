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

1. Own/install Skyrim SE/AE and a compatible SkyMP/SkyrimPlatform client.
2. Copy this overlay into the prepared Skyrim game folder.
3. Start "Secret Skyrim MP Launcher.exe".
4. The launcher starts its bundled Mumble client and then SKSE automatically.

The archive intentionally does not redistribute Skyrim game files.
'@ | Set-Content -Encoding UTF8 "$client\README_RU.txt"
Compress-Archive -Path "$client\*" -DestinationPath "$out\secret-skyrim-mp-client-$Version.zip" -Force

# SERVER - SkyMP + bundled Mumble Server
$server = Join-Path $out "secret-skyrim-mp-server-$Version"
New-Item -ItemType Directory -Force -Path "$server\runtime\ui", "$server\gameData", "$server\docs", "$server\VoiceServer" | Out-Null

Copy-Item "$repo\server\vendor\skymp\skymp5-server.js" "$server\runtime\skymp5-server.js" -Force
Copy-Item "$repo\server\vendor\skymp\scam_native.node" "$server\runtime\scam_native.node" -Force
Copy-Item "$repo\server\runtime\gamemode.js" "$server\runtime\gamemode.js" -Force
Copy-Item "$repo\server\runtime\gamemode-config.json" "$server\runtime\gamemode-config.json" -Force
Copy-Item "$repo\server\runtime\server-settings.json" "$server\runtime\server-settings.json" -Force
Copy-Item "$repo\server\runtime\ui\core-ui.html" "$server\runtime\ui\core-ui.html" -Force
Copy-Item "$repo\docs\*.md" "$server\docs\" -Force

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
Copy-Item $nodePath "$server\runtime\node.exe" -Force

$mumbleServerSource = Join-Path $repo 'server\vendor\mumble-server'
$mumbleServerExe = Join-Path $mumbleServerSource 'mumble-server.exe'
if (-not (Test-Path $mumbleServerExe)) {
  throw "Bundled Mumble Server runtime was not prepared: $mumbleServerExe"
}
Copy-Item "$mumbleServerSource\*" "$server\VoiceServer\" -Recurse -Force
Copy-Item "$repo\server\voice\mumble-server.ini" "$server\VoiceServer\mumble-server.ini" -Force
Copy-Item "$repo\THIRD_PARTY\MUMBLE_LICENSE.txt" "$server\VoiceServer\MUMBLE_LICENSE.txt" -Force

Copy-Item "$repo\server\start-secret-skyrim-server.ps1" "$server\start-secret-skyrim-server.ps1" -Force
Copy-Item "$repo\server\START_SECRET_SKYRIM_SERVER.cmd" "$server\START_SECRET_SKYRIM_SERVER.cmd" -Force

@'
Secret Skyrim MP server package.

ONE START FILE:
  START_SECRET_SKYRIM_SERVER.cmd

It starts:
  1. bundled Mumble Server on TCP/UDP 64738;
  2. SkyMP RP server on port 7777.

When the SkyMP server stops, the Mumble Server process started by the
supervisor is stopped as well.

Before first start copy your legal Skyrim masters into gameData:
  Skyrim.esm
  Update.esm
  Dawnguard.esm
  HearthFires.esm
  Dragonborn.esm

For LAN/Internet testing open/forward both TCP and UDP 64738 for voice
and the required SkyMP port(s).
'@ | Set-Content -Encoding UTF8 "$server\README_RU.txt"

Compress-Archive -Path "$server\*" -DestinationPath "$out\secret-skyrim-mp-server-$Version.zip" -Force

# SOURCE SNAPSHOT
$sourceStage = Join-Path $out "secret-skyrim-mp-source-$Version"
New-Item -ItemType Directory -Force -Path $sourceStage | Out-Null
Get-ChildItem $repo -Force | Where-Object { $_.Name -notin @('.git','artifacts') } | ForEach-Object {
  Copy-Item $_.FullName $sourceStage -Recurse -Force
}
Remove-Item "$sourceStage\launcher\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$sourceStage\launcher\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$sourceStage\launcher\Voice\runtime" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$sourceStage\server\vendor\mumble-server" -Recurse -Force -ErrorAction SilentlyContinue
Compress-Archive -Path "$sourceStage\*" -DestinationPath "$out\secret-skyrim-mp-source-$Version.zip" -Force

Get-FileHash "$out\*.zip" -Algorithm SHA256 | ForEach-Object {
  "$($_.Hash.ToLower())  $([IO.Path]::GetFileName($_.Path))"
} | Set-Content -Encoding ASCII "$out\SHA256SUMS.txt"
