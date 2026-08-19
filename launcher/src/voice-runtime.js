'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const VOICE_PROCESS = 'mumble.exe';
const DEFAULT_VOICE = Object.freeze({
  port: 64738,
  channel: '',
  context: 'secret-skyrim-mp',
  minimumDistanceMeters: 2,
  maximumDistanceMeters: 15,
  minimumVolume: 0,
  bloom: 0.5
});

function getDistributionRoot({ isPackaged, execPath, appPath, portableExecutableDir }) {
  // electron-builder portable extracts the running process to TEMP.
  // PORTABLE_EXECUTABLE_DIR points to the directory containing the EXE the player actually launched.
  if (isPackaged && portableExecutableDir) return path.resolve(portableExecutableDir);
  return isPackaged ? path.dirname(execPath) : appPath;
}

function getVoicePaths(distributionRoot) {
  const root = path.join(distributionRoot, 'Voice');
  const runtime = path.join(root, 'runtime');
  const profile = path.join(root, 'profile');
  const plugin = path.join(runtime, 'plugins', 'SkyrimVoice.dll');
  return {
    root,
    runtime,
    profile,
    mumbleExe: path.join(runtime, 'mumble.exe'),
    plugin,
    config: path.join(profile, 'mumble_settings.json'),
    database: path.join(profile, 'mumble.sqlite')
  };
}

function validateVoiceRuntime(paths) {
  const checks = [
    { key: 'mumble', label: 'Voice Runtime', fullPath: paths.mumbleExe },
    { key: 'voicePlugin', label: 'SkyrimVoice plugin', fullPath: paths.plugin }
  ].map((x) => ({ ...x, exists: fs.existsSync(x.fullPath) && fs.statSync(x.fullPath).isFile() }));
  return { valid: checks.every((x) => x.exists), checks, paths };
}

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return fallback; }
}

function readGameVoiceSettings(gameDir) {
  const file = path.join(gameDir, 'Data', 'Platform', 'Plugins', 'secret-skyrim-voice-settings.txt');
  const cfg = readJson(file, {});
  return { ...DEFAULT_VOICE, ...(cfg && typeof cfg === 'object' ? cfg : {}) };
}

function readSkyMpSettings(gameDir) {
  const file = path.join(gameDir, 'Data', 'Platform', 'Plugins', 'skymp5-client-settings.txt');
  return readJson(file, {});
}

function resolveVoiceConnection(gameDir) {
  const skymp = readSkyMpSettings(gameDir);
  const voice = readGameVoiceSettings(gameDir);
  const profileId = Number(skymp?.gameData?.profileId);
  if (!Number.isSafeInteger(profileId) || profileId < 0) {
    throw new Error('В skymp5-client-settings.txt не найден корректный gameData.profileId.');
  }
  const gameHost = String(skymp['server-ip'] || '').trim();
  const host = String(voice.mumbleHost || gameHost).trim();
  if (!host) throw new Error('Не задан адрес voice/game сервера.');
  const port = Number(voice.mumblePort || voice.port || 64738);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Некорректный Mumble port.');
  const channel = String(voice.mumbleChannel ?? voice.channel ?? '').trim();
  return { profileId, username: `sk_${profileId}`, host, port, channel, voice };
}

function qtPath(file) {
  return path.resolve(file).replace(/\\/g, '/');
}

function sha1(text) {
  return crypto.createHash('sha1').update(Buffer.from(text, 'utf8')).digest('hex');
}

function pluginHashCandidates(pluginPath) {
  const q = qtPath(pluginPath);
  const variants = new Set([q, q.replace(/\//g, '\\')]);
  if (/^[A-Za-z]:/.test(q)) {
    variants.add(q[0].toUpperCase() + q.slice(1));
    variants.add(q[0].toLowerCase() + q.slice(1));
  }
  return [...variants].map((v) => [sha1(v), v]);
}

function ensureMumbleConfig(paths, connection) {
  fs.mkdirSync(paths.profile, { recursive: true });
  fs.mkdirSync(path.dirname(paths.plugin), { recursive: true });

  const pluginSetting = {
    path: qtPath(paths.plugin),
    enabled: true,
    positional_data_enabled: true,
    keyboard_monitoring_allowed: false
  };
  const plugins = {};
  for (const [hash] of pluginHashCandidates(paths.plugin)) plugins[hash] = pluginSetting;

  const settings = {
    settings_version: 1,
    audio: {
      transmit_mode: 'PTT',
      transmit_cue_when_ptt: false,
      play_mute_cue: false
    },
    positional_audio: {
      enable_positional_audio: true,
      minimum_distance: Number(connection.voice.minimumDistanceMeters) || 2,
      maximum_distance: Number(connection.voice.maximumDistanceMeters) || 15,
      minimum_volume: Number(connection.voice.minimumVolume) || 0,
      bloom: Number(connection.voice.bloom) || 0.5,
      transmit_position: true
    },
    network: {
      reconnect_automatically: true,
      auto_connect_to_last_server: false
    },
    ui: {
      hide_in_tray: true,
      quit_behavior: 'AlwaysQuit',
      send_usage_statistics: false,
      disable_public_server_list: true
    },
    misc: {
      database_location: qtPath(paths.database),
      audio_wizard_has_been_shown: true,
      viewed_server_ping_consent_message: true
    },
    plugins,
    mumble_has_quit_normally: true
  };
  fs.writeFileSync(paths.config, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

function parseTasklistCsv(stdout) {
  const text = String(stdout || '').trim();
  if (!text || /INFO:\s+No tasks/i.test(text)) return [];
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^"([^"]+)","([0-9]+)",/);
    if (m) rows.push({ imageName: m[1], pid: Number(m[2]) });
  }
  return rows;
}

function tasklist(args) {
  return new Promise((resolve, reject) => {
    execFile('tasklist.exe', args, { windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
      const rows = parseTasklistCsv(stdout);
      if (err && rows.length) return reject(err);
      resolve(rows);
    });
  });
}

async function listMumbleProcesses() {
  return tasklist(['/FI', `IMAGENAME eq ${VOICE_PROCESS}`, '/FO', 'CSV', '/NH']);
}

async function isMumblePidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const rows = await tasklist(['/FI', `PID eq ${pid}`, '/FI', `IMAGENAME eq ${VOICE_PROCESS}`, '/FO', 'CSV', '/NH']);
  return rows.some((r) => r.pid === pid && r.imageName.toLowerCase() === VOICE_PROCESS);
}

function buildMumbleUrl(connection) {
  const user = encodeURIComponent(connection.username);
  const host = connection.host.includes(':') && !connection.host.startsWith('[')
    ? `[${connection.host}]` : connection.host;
  const channel = connection.channel
    ? `/${connection.channel.split('/').map(encodeURIComponent).join('/')}` : '/';
  return `mumble://${user}@${host}:${connection.port}${channel}?version=1.5.0`;
}

function launchMumble(paths, connection) {
  const validation = validateVoiceRuntime(paths);
  if (!validation.valid) {
    const missing = validation.checks.filter((x) => !x.exists).map((x) => x.label).join(', ');
    throw new Error(`Voice Runtime не подготовлен: ${missing}`);
  }
  ensureMumbleConfig(paths, connection);
  const args = ['--multiple', '--config', paths.config, '--noidentity', buildMumbleUrl(connection)];
  const child = spawn(paths.mumbleExe, args, {
    cwd: paths.runtime,
    detached: false,
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, MUMBLE_VERSION_ROOT: paths.runtime }
  });
  return child;
}

function minimizeProcessWindow(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  const script = [
    '$sig=\'[DllImport("user32.dll")] public static extern bool EnumWindows(System.Func<IntPtr,IntPtr,bool> cb, IntPtr lp); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);\';',
    'Add-Type -MemberDefinition $sig -Name W -Namespace SSS;',
    `$target=[uint32]${pid};`,
    '[SSS.W]::EnumWindows({param($h,$l) $p=0; [SSS.W]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null; if($p -eq $target){[SSS.W]::ShowWindow($h,6)|Out-Null}; return $true},[IntPtr]::Zero)|Out-Null'
  ].join(' ');
  execFile('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], { windowsHide: true }, () => {});
}

function stopMumble(pid) {
  return new Promise((resolve) => {
    if (!Number.isInteger(pid) || pid <= 0) return resolve(false);
    execFile('taskkill.exe', ['/PID', String(pid), '/T'], { windowsHide: true }, (err) => {
      if (!err) return resolve(true);
      execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve(true));
    });
  });
}

module.exports = {
  DEFAULT_VOICE,
  getDistributionRoot,
  getVoicePaths,
  validateVoiceRuntime,
  readGameVoiceSettings,
  readSkyMpSettings,
  resolveVoiceConnection,
  ensureMumbleConfig,
  pluginHashCandidates,
  buildMumbleUrl,
  listMumbleProcesses,
  isMumblePidRunning,
  launchMumble,
  minimizeProcessWindow,
  stopMumble
};
