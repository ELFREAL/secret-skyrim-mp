import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const jsonFiles = [
  'server/runtime/gamemode-config.json',
  'server/runtime/server-settings.json',
  'launcher/package.json',
  'client/skyrim-platform/skymp5-client-settings.txt',
  'client/skyrim-platform/secret-skyrim-voice-settings.txt'
];
for (const rel of jsonFiles) {
  JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const forbiddenPaths = [
  'server/runtime/world',
  'server/runtime/admin-audit.log',
  'launcher/node_modules',
  'launcher/dist',
  'launcher/Voice/runtime',
  'server/vendor/mumble-server',
  'gameData'
];
for (const rel of forbiddenPaths) {
  if (fs.existsSync(path.join(root, rel))) throw new Error(`Generated/private path is present in source tree: ${rel}`);
}

const requiredServerVoiceFiles = [
  'scripts/install-mumble-server-runtime.ps1',
  'server/voice/mumble-server.ini',
  'server/start-secret-skyrim-server.ps1',
  'server/START_SECRET_SKYRIM_SERVER.cmd',
  'THIRD_PARTY/MUMBLE_LICENSE.txt'
];
for (const rel of requiredServerVoiceFiles) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Required bundled voice-server source file is missing: ${rel}`);
}

const clientSettings = JSON.parse(fs.readFileSync(path.join(root, 'client/skyrim-platform/skymp5-client-settings.txt'), 'utf8'));
const host = String(clientSettings['server-ip'] || '').trim();
const safeHosts = new Set(['', '127.0.0.1', 'localhost']);
if (!safeHosts.has(host)) throw new Error(`Tracked client server-ip must be a safe development value, got: ${host}`);
if (clientSettings['server-master-key']) throw new Error('Tracked server-master-key must be null/empty.');

console.log('Repository validation OK');
