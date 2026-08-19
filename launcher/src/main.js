'use strict';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  validateGameDir,
  listSkyrimProcesses,
  isPidRunning,
  waitForNewSkyrimPid,
  launchSkse
} = require('./game-runtime');
const {
  getDistributionRoot,
  getVoicePaths,
  validateVoiceRuntime,
  resolveVoiceConnection,
  isMumblePidRunning,
  launchMumble,
  minimizeProcessWindow,
  stopMumble
} = require('./voice-runtime');

const APP_ID = 'com.secretskyrim.mp.launcher';
const CONFIG_FILE = 'launcher-config.json';
const VOICE_BRIDGE_HOST = '127.0.0.1';
const VOICE_BRIDGE_PORT = 38471;

let mainWindow = null;
let trackedSkyrimPid = null;
let trackedMumblePid = null;
let monitorTimer = null;
let launchInProgress = false;
let allowWindowClose = false;

app.setAppUserModelId(APP_ID);

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return { gameDir: typeof parsed.gameDir === 'string' ? parsed.gameDir : '' };
  } catch (_) {
    return { gameDir: '' };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8');
}

function distributionRoot() {
  return getDistributionRoot({
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    appPath: app.getAppPath(),
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR
  });
}

function voicePaths() {
  return getVoicePaths(distributionRoot());
}

function sendState(type, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('launcher:event', { type, ...payload });
}

function checkVoiceBridge(timeoutMs = 700) {
  return new Promise((resolve) => {
    const req = http.get({
      host: VOICE_BRIDGE_HOST,
      port: VOICE_BRIDGE_PORT,
      path: '/health',
      timeout: timeoutMs
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

async function waitForVoiceBridge(timeoutMs = 12000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkVoiceBridge()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function getStatus() {
  const config = loadConfig();
  const validation = validateGameDir(config.gameDir);
  const voiceValidation = validateVoiceRuntime(voicePaths());
  let running = false;
  let voiceRunning = false;

  if (trackedSkyrimPid) {
    try { running = await isPidRunning(trackedSkyrimPid); } catch (_) { running = false; }
    if (!running) trackedSkyrimPid = null;
  }
  if (trackedMumblePid) {
    try { voiceRunning = await isMumblePidRunning(trackedMumblePid); } catch (_) { voiceRunning = false; }
    if (!voiceRunning) trackedMumblePid = null;
  }

  return {
    config,
    validation,
    voiceValidation,
    running,
    voiceRunning,
    voiceBridgeReady: await checkVoiceBridge(250),
    trackedSkyrimPid,
    trackedMumblePid,
    launchInProgress
  };
}

async function shutdownOwnedVoice(reason = 'session-end') {
  const pid = trackedMumblePid;
  trackedMumblePid = null;
  if (pid) {
    sendState('voice-stopping', { pid, reason });
    await stopMumble(pid);
    sendState('voice-stopped', { pid, reason });
  }
}

function startMonitor(pid) {
  trackedSkyrimPid = pid;
  if (monitorTimer) clearInterval(monitorTimer);

  monitorTimer = setInterval(async () => {
    if (!trackedSkyrimPid) return;
    try {
      const running = await isPidRunning(trackedSkyrimPid);
      if (!running) {
        const oldPid = trackedSkyrimPid;
        trackedSkyrimPid = null;
        clearInterval(monitorTimer);
        monitorTimer = null;
        await shutdownOwnedVoice('skyrim-exited');
        sendState('game-exited', { pid: oldPid });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    } catch (error) {
      sendState('log', { level: 'warn', message: `Не удалось проверить процесс Skyrim: ${error.message}` });
    }
  }, 1000);
}

async function chooseGameFolder() {
  const current = loadConfig();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Укажите папку Skyrim Special Edition',
    defaultPath: current.gameDir || undefined,
    buttonLabel: 'Выбрать папку',
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths[0]) return { canceled: true };

  const gameDir = result.filePaths[0];
  const validation = validateGameDir(gameDir);
  if (!validation.valid) {
    const missing = validation.checks.filter((x) => !x.exists).map((x) => x.label);
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Неверная папка Skyrim',
      message: 'Эта папка не подходит для Secret Skyrim MP.',
      detail: `Не найдены: ${missing.join(', ')}`,
      buttons: ['Понятно']
    });
    return { canceled: false, saved: false, validation };
  }

  saveConfig({ gameDir: validation.gameDir });
  sendState('folder-changed', { validation });
  return { canceled: false, saved: true, validation };
}

async function launchGame() {
  if (launchInProgress) return { ok: false, message: 'Запуск уже выполняется.' };
  if (trackedSkyrimPid && await isPidRunning(trackedSkyrimPid)) {
    return { ok: false, message: 'Skyrim уже запущен через лаунчер.' };
  }

  const config = loadConfig();
  const validation = validateGameDir(config.gameDir);
  if (!validation.valid) return { ok: false, message: 'Сначала укажите корректную папку Skyrim.' };

  const vp = voicePaths();
  const voiceValidation = validateVoiceRuntime(vp);
  if (!voiceValidation.valid) {
    const missing = voiceValidation.checks.filter((x) => !x.exists).map((x) => x.label).join(', ');
    return { ok: false, message: `Не подготовлен Voice Runtime: ${missing}. Запусти build.ps1 после подготовки Mumble.` };
  }

  launchInProgress = true;
  sendState('launching');

  try {
    const existing = await listSkyrimProcesses();
    if (existing.length > 0) {
      return { ok: false, message: 'SkyrimSE.exe уже запущен. Закройте игру перед запуском через launcher.' };
    }
    if (await checkVoiceBridge()) {
      return { ok: false, message: 'Порт SkyrimVoice уже занят другим Voice Runtime. Закройте старую игровую voice-сессию.' };
    }

    const connection = resolveVoiceConnection(validation.gameDir);
    const mumbleChild = launchMumble(vp, connection);
    trackedMumblePid = mumbleChild.pid;
    sendState('voice-started', { pid: trackedMumblePid });
    setTimeout(() => minimizeProcessWindow(trackedMumblePid), 1200);

    const bridgeReady = await waitForVoiceBridge();
    if (!bridgeReady) {
      await shutdownOwnedVoice('bridge-timeout');
      return {
        ok: false,
        message: 'Voice Runtime запустился, но SkyrimVoice plugin не поднял localhost bridge. Проверь Voice/logs и сборку SkyrimVoice.dll.'
      };
    }
    sendState('voice-ready', { pid: trackedMumblePid });

    const before = existing.map((x) => x.pid);
    launchSkse(validation.gameDir);
    const skyrimPid = await waitForNewSkyrimPid(before, 30000, 350);

    if (!skyrimPid) {
      await shutdownOwnedVoice('skyrim-start-timeout');
      return { ok: false, message: 'SKSE был запущен, но SkyrimSE.exe не появился в течение 30 секунд.' };
    }

    startMonitor(skyrimPid);
    sendState('game-started', { pid: skyrimPid, voicePid: trackedMumblePid });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return { ok: true, pid: skyrimPid, voicePid: trackedMumblePid };
  } catch (error) {
    await shutdownOwnedVoice('launch-error');
    return { ok: false, message: error.message || String(error) };
  } finally {
    launchInProgress = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 650,
    minWidth: 900,
    minHeight: 580,
    show: false,
    frame: false,
    backgroundColor: '#0b0c0d',
    title: 'Secret Skyrim MP Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!allowWindowClose && (trackedSkyrimPid || launchInProgress)) {
      event.preventDefault();
      mainWindow.minimize();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.handle('launcher:get-status', getStatus);
    ipcMain.handle('launcher:choose-folder', chooseGameFolder);
    ipcMain.handle('launcher:launch', launchGame);
    ipcMain.handle('window:minimize', () => mainWindow?.minimize());
    ipcMain.handle('window:close', () => {
      if (trackedSkyrimPid || launchInProgress) mainWindow?.minimize();
      else mainWindow?.close();
    });
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !trackedSkyrimPid) app.quit();
});

app.on('before-quit', (event) => {
  if (trackedSkyrimPid && !allowWindowClose) {
    event.preventDefault();
    mainWindow?.minimize();
    return;
  }
  allowWindowClose = true;
  if (monitorTimer) clearInterval(monitorTimer);
});
