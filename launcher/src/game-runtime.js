'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const REQUIRED_FILES = Object.freeze([
  { key: 'skyrim', label: 'SkyrimSE.exe', rel: 'SkyrimSE.exe' },
  { key: 'skse', label: 'skse64_loader.exe', rel: 'skse64_loader.exe' },
  {
    key: 'skymp',
    label: 'SkyMP client plugin',
    rel: path.join('Data', 'Platform', 'Plugins', 'skymp5-client.js')
  },
  {
    key: 'voiceClient',
    label: 'Secret Skyrim Voice client',
    rel: path.join('Data', 'Platform', 'Plugins', 'secret-skyrim-voice.js')
  }
]);

function validateGameDir(gameDir) {
  const root = typeof gameDir === 'string' ? path.resolve(gameDir) : '';
  const checks = REQUIRED_FILES.map((item) => {
    const fullPath = root ? path.join(root, item.rel) : '';
    return {
      ...item,
      fullPath,
      exists: Boolean(root && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile())
    };
  });

  return {
    gameDir: root,
    valid: checks.every((x) => x.exists),
    checks
  };
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
      if (err) {
        // tasklist returns non-zero in some filtered/no-result situations on older systems.
        const parsed = parseTasklistCsv(stdout);
        if (parsed.length === 0) return resolve([]);
        return reject(err);
      }
      resolve(parseTasklistCsv(stdout));
    });
  });
}

async function listSkyrimProcesses() {
  return tasklist(['/FI', 'IMAGENAME eq SkyrimSE.exe', '/FO', 'CSV', '/NH']);
}

async function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const rows = await tasklist(['/FI', `PID eq ${pid}`, '/FI', 'IMAGENAME eq SkyrimSE.exe', '/FO', 'CSV', '/NH']);
  return rows.some((row) => row.pid === pid && row.imageName.toLowerCase() === 'skyrimse.exe');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNewSkyrimPid(beforePids, timeoutMs = 30000, intervalMs = 350) {
  const known = new Set(beforePids || []);
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const rows = await listSkyrimProcesses();
    const fresh = rows.find((row) => !known.has(row.pid));
    if (fresh) return fresh.pid;
    await sleep(intervalMs);
  }

  return null;
}

function launchSkse(gameDir) {
  const validation = validateGameDir(gameDir);
  if (!validation.valid) {
    const missing = validation.checks.filter((x) => !x.exists).map((x) => x.label).join(', ');
    throw new Error(`В выбранной папке отсутствуют обязательные файлы: ${missing}`);
  }

  const loader = path.join(validation.gameDir, 'skse64_loader.exe');
  const child = spawn(loader, [], {
    cwd: validation.gameDir,
    detached: false,
    windowsHide: false,
    stdio: 'ignore'
  });
  child.unref();
  return child.pid;
}

module.exports = {
  REQUIRED_FILES,
  validateGameDir,
  parseTasklistCsv,
  listSkyrimProcesses,
  isPidRunning,
  waitForNewSkyrimPid,
  launchSkse
};
