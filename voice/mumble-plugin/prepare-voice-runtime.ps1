param([string]$MumbleDir = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dst = Join-Path $root 'Voice\runtime'
$licenses = Join-Path $root 'Voice\licenses'

$candidates = @()
if ($MumbleDir) { $candidates += $MumbleDir }
$candidates += @(
  "$env:ProgramFiles\Mumble\client",
  "$env:ProgramFiles\Mumble",
  "$env:LOCALAPPDATA\Programs\Mumble\client",
  "$env:LOCALAPPDATA\Programs\Mumble"
)
$source = $null
foreach ($c in $candidates) {
  if ($c -and (Test-Path (Join-Path $c 'mumble.exe'))) { $source = $c; break }
}
if (-not $source) {
  throw @'
Mumble client was not found on the BUILD machine.
Install official Mumble 1.5.x once on the developer PC, or run:
  .\tools\prepare-voice-runtime.ps1 -MumbleDir "D:\path\to\Mumble\client"
Players will NOT need to install Mumble: this script copies its runtime into the distribution.
'@
}
Write-Host "Copying Mumble runtime from: $source" -ForegroundColor Gray
New-Item -ItemType Directory -Force -Path $dst, $licenses | Out-Null
Get-ChildItem -LiteralPath $dst -Force | Where-Object { $_.Name -ne 'plugins' } | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $source '*') -Destination $dst -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $dst 'plugins') | Out-Null
if (-not (Test-Path (Join-Path $dst 'mumble.exe'))) { throw 'mumble.exe was not copied.' }
# Keep the upstream license explicitly in our redistribution next to the copied runtime.
Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/mumble-voip/mumble/1.5.x/LICENSE' -OutFile (Join-Path $licenses 'MUMBLE_LICENSE.txt')
Write-Host 'Mumble runtime prepared.' -ForegroundColor Green
