import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

// Stock SkyMP client bundle is deliberately pinned and not modified by our gameplay code.
// All Secret Skyrim MP gameplay additions are delivered from the server via event sources/properties.
const stockClientPath = path.join(root, 'client/skyrim-platform/skymp5-client.js');
if (!fs.existsSync(stockClientPath)) throw new Error('Pinned stock skymp5-client.js is missing.');
const stockClient = fs.readFileSync(stockClientPath);
if (stockClient.length < 1_000_000) {
  throw new Error(`Pinned stock skymp5-client.js is unexpectedly small (${stockClient.length} bytes).`);
}
const expectedStockClientSha256 = '57e9b912d7095966eb808a9ad139bb526afd42428f898fa3c05c8ba437067080';
const actualStockClientSha256 = crypto.createHash('sha256').update(stockClient).digest('hex');
if (actualStockClientSha256 !== expectedStockClientSha256) {
  throw new Error(`Pinned stock skymp5-client.js SHA-256 mismatch: ${actualStockClientSha256}`);
}

const clientSettings = JSON.parse(fs.readFileSync(path.join(root, 'client/skyrim-platform/skymp5-client-settings.txt'), 'utf8'));
const host = String(clientSettings['server-ip'] || '').trim();
const safeHosts = new Set(['', '127.0.0.1', 'localhost']);
if (!safeHosts.has(host)) throw new Error(`Tracked client server-ip must be a safe development value, got: ${host}`);
if (clientSettings['server-master-key']) throw new Error('Tracked server-master-key must be null/empty.');

console.log('Repository validation OK');
