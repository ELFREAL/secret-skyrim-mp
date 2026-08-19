$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$voiceDir = Join-Path $root 'VoiceServer'
$voiceExe = Join-Path $voiceDir 'mumble-server.exe'
$voiceIni = Join-Path $voiceDir 'mumble-server.ini'
$runtime = Join-Path $root 'runtime'
$node = Join-Path $runtime 'node.exe'
$skymp = Join-Path $runtime 'skymp5-server.js'
$master = Join-Path $root 'gameData\Skyrim.esm'

$required = @($voiceExe, $voiceIni, $node, $skymp, $master)
$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing) {
  Write-Host '[ERROR] Server package is incomplete:' -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  missing: $_" -ForegroundColor Red }
  if (-not (Test-Path $master)) {
    Write-Host 'Put your legal Skyrim masters into the gameData folder.' -ForegroundColor Yellow
  }
  exit 1
}

Write-Host 'Secret Skyrim MP server' -ForegroundColor Cyan
Write-Host '  SkyMP:        TCP/UDP 7777' -ForegroundColor Gray
Write-Host '  Mumble Voice: TCP/UDP 64738' -ForegroundColor Gray
Write-Host ''

$voice = $null
$exitCode = 1
try {
  Write-Host '[1/2] Starting bundled Mumble Server...' -ForegroundColor Cyan
  $voiceArgs = @('--ini', ('"{0}"' -f $voiceIni), '--foreground')
  $voice = Start-Process -FilePath $voiceExe `
    -ArgumentList $voiceArgs `
    -WorkingDirectory $voiceDir `
    -WindowStyle Hidden `
    -PassThru

  Start-Sleep -Seconds 2
  if ($voice.HasExited) {
    throw "Mumble Server exited during startup (exit code $($voice.ExitCode)). Check VoiceServer\mumble-server.log."
  }

  Write-Host "[OK] Mumble Server PID $($voice.Id)" -ForegroundColor Green
  Write-Host '[2/2] Starting SkyMP RP server...' -ForegroundColor Cyan

  Push-Location $runtime
  try {
    & $node $skymp
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  $exitCode = 1
} finally {
  if ($voice -and -not $voice.HasExited) {
    Write-Host 'Stopping launcher-owned Mumble Server...' -ForegroundColor Gray
    Stop-Process -Id $voice.Id -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $voice.Id -Timeout 5 -ErrorAction SilentlyContinue
  }
}

exit $exitCode
