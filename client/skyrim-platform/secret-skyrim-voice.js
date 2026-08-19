'use strict';

// Secret Skyrim MP — Voice client bridge
// SkyrimPlatform -> localhost SkyrimVoice Mumble plugin.
// No audio is handled here: this module only publishes avatar state, PTT and server route.

const sp = require('skyrimPlatform');
const PLUGIN = 'secret-skyrim-voice';
const DEFAULTS = {
  enabled: true,
  bridgeHost: '127.0.0.1',
  bridgePort: 38471,
  pttScanCode: 49, // DirectInput N
  pttLabel: 'N',
  positionUpdateMs: 100,
  routeRefreshMs: 2000,
  unitsPerMeter: 70,
  context: 'secret-skyrim-mp'
};

const cfg = Object.assign({}, DEFAULTS, sp.settings[PLUGIN] || {});
const bridge = new sp.HttpClient(`http://${cfg.bridgeHost}:${Number(cfg.bridgePort) || 38471}`);
let lastStateAt = 0;
let lastRouteAt = 0;
let lastRouteNonce = null;
let pttPressed = false;
let stateRequestPending = false;
let routeRequestPending = false;
let bridgeWarned = false;

function log(...args) {
  try { sp.writeLogs('SecretSkyrimVoice', ...args); } catch (_) {}
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function profileId() {
  const p = Number(sp.settings['skymp5-client']?.gameData?.profileId);
  return Number.isSafeInteger(p) && p >= 0 ? p : null;
}

function connected() {
  try { return Boolean(sp.mpClientPlugin && sp.mpClientPlugin.isConnected()); }
  catch (_) { return false; }
}

function encodeLines(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, '')}`)
    .join('\n');
}

function post(path, body) {
  return bridge.post(path, { body, contentType: 'text/plain; charset=utf-8' });
}

function playerState() {
  const player = sp.Game.getPlayer();
  const pid = profileId();
  if (!player || pid === null) return null;

  const scale = Math.max(1, num(cfg.unitsPerMeter, 70));
  const x = num(player.getPositionX()) / scale;
  const y = num(player.getPositionY()) / scale;
  const z = num(player.getPositionZ()) / scale;
  const heading = num(player.getAngleZ()) * Math.PI / 180;

  // Mumble: X=right, Y=up, Z=forward. Skyrim Z is vertical.
  const mx = x;
  const my = z;
  const mz = y;
  const fx = Math.sin(heading);
  const fy = 0;
  const fz = Math.cos(heading);

  return {
    profileId: pid,
    x: mx.toFixed(5),
    y: my.toFixed(5),
    z: mz.toFixed(5),
    frontX: fx.toFixed(6),
    frontY: fy.toFixed(6),
    frontZ: fz.toFixed(6),
    topX: 0,
    topY: 1,
    topZ: 0,
    context: String(cfg.context || 'secret-skyrim-mp'),
    connected: connected() ? 1 : 0,
    ts: Date.now()
  };
}

function sendState(now) {
  if (stateRequestPending) return;
  const state = playerState();
  if (!state) return;
  stateRequestPending = true;
  post('/state', encodeLines(state))
    .then(() => { bridgeWarned = false; })
    .catch((e) => {
      if (!bridgeWarned) {
        bridgeWarned = true;
        log(`Voice bridge unavailable: ${e && e.error ? e.error : String(e)}`);
      }
    })
    .finally(() => { stateRequestPending = false; });
  lastStateAt = now;
}

function currentRoute() {
  const packet = sp.storage.secretSkyrimVoiceRoute;
  if (!packet || typeof packet !== 'object' || !Array.isArray(packet.audible)) return null;
  return packet;
}

function sendRoute(now, force = false) {
  if (!connected() || routeRequestPending) return;
  const route = currentRoute();
  if (!route) return;
  const nonce = Number(route.nonce) || 0;
  if (!force && nonce === lastRouteNonce && now - lastRouteAt < num(cfg.routeRefreshMs, 2000)) return;

  const audible = route.audible
    .map(Number)
    .filter((x) => Number.isSafeInteger(x) && x >= 0)
    .join(',');
  routeRequestPending = true;
  post('/route', encodeLines({
    profileId: profileId(),
    nonce,
    audible,
    ts: Date.now()
  }))
    .catch(() => {})
    .finally(() => { routeRequestPending = false; });
  lastRouteNonce = nonce;
  lastRouteAt = now;
}

function sendPtt(pressed) {
  pttPressed = Boolean(pressed);
  post('/ptt', encodeLines({ pressed: pttPressed ? 1 : 0, ts: Date.now() })).catch(() => {});
}

sp.on('buttonEvent', (event) => {
  if (!cfg.enabled || !event || Number(event.code) !== Number(cfg.pttScanCode)) return;
  if (event.isDown && !pttPressed) sendPtt(true);
  if (event.isUp && pttPressed) sendPtt(false);
});

sp.on('update', () => {
  if (!cfg.enabled) return;
  const now = Date.now();
  if (now - lastStateAt >= num(cfg.positionUpdateMs, 100)) sendState(now);
  sendRoute(now, false);
  if (!connected() && pttPressed) sendPtt(false);
});

sp.on('skyrimLoaded', () => {
  log(`Voice bridge enabled. PTT=${cfg.pttLabel || 'N'}, localhost=${cfg.bridgeHost}:${cfg.bridgePort}`);
});
