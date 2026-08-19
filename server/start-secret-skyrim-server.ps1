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

function Test-LocalTcpPort {
  param([int]$Port)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(400)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

Write-Host 'Secret Skyrim MP server' -ForegroundColor Cyan
Write-Host '  SkyMP:        TCP/UDP 7777' -ForegroundColor Gray
Write-Host '  Mumble Voice: TCP/UDP 64738' -ForegroundColor Gray
Write-Host ''

$voice = $null
$game = $null
$exitCode = 1

try {
  Write-Host '[1/2] Starting bundled Mumble Server...' -ForegroundColor Cyan

  # Mumble 1.5.x server uses legacy single-dash CLI switches:
  #   -ini <file> -fg
  $voiceArgs = @('-ini', ('"{0}"' -f $voiceIni), '-fg')
  $voice = Start-Process -FilePath $voiceExe `
    -ArgumentList $voiceArgs `
    -WorkingDirectory $voiceDir `
    -WindowStyle Hidden `
    -PassThru

  $voiceReady = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if ($voice.HasExited) {
      throw "Mumble Server exited during startup (exit code $($voice.ExitCode)). Check VoiceServer\mumble-server.log."
    }
    if (Test-LocalTcpPort -Port 64738) {
      $voiceReady = $true
      break
    }
  }

  if (-not $voiceReady) {
    throw 'Mumble Server process is alive but TCP 64738 did not become ready. Check VoiceServer\mumble-server.log.'
  }

  Write-Host "[OK] Mumble Server PID $($voice.Id), TCP 64738 READY" -ForegroundColor Green
  Write-Host '[2/2] Starting SkyMP RP server...' -ForegroundColor Cyan

  $game = Start-Process -FilePath $node `
    -ArgumentList @('skymp5-server.js') `
    -WorkingDirectory $runtime `
    -NoNewWindow `
    -PassThru

  while (-not $game.HasExited) {
    Start-Sleep -Seconds 1
    if ($voice.HasExited) {
      Write-Host "[ERROR] Mumble Server stopped while RP server was running (exit code $($voice.ExitCode))." -ForegroundColor Red
      Stop-Process -Id $game.Id -Force -ErrorAction SilentlyContinue
      throw 'Voice server failure: RP server stopped to avoid running without voice.'
    }
  }

  $exitCode = $game.ExitCode
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  $exitCode = 1
} finally {
  if ($game -and -not $game.HasExited) {
    Stop-Process -Id $game.Id -Force -ErrorAction SilentlyContinue
  }
  if ($voice -and -not $voice.HasExited) {
    Write-Host 'Stopping bundled Mumble Server...' -ForegroundColor Gray
    Stop-Process -Id $voice.Id -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $voice.Id -Timeout 5 -ErrorAction SilentlyContinue
  }
}

exit $exitCode
