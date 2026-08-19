/**
 * SkyMP Core Gamemode v5.3
 * Target build: ELFREAL/skymp 2abd0a0391278335face3c13ff0e2cabf76344b0
 *
 * Stock skymp5-client.js compatible.
 * UI/input is injected through the official mp.makeEventSource() mechanism.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const VERSION = "5.3.0-lipsync-update-context";
const CONFIG_PATH = path.join(process.cwd(), "gamemode-config.json");
const UI_PATH = path.join(process.cwd(), "ui", "core-ui.html");

const DEFAULT_CONFIG = {
  "serverName": "SkyMP Test RP",
  "maxUserId": 100,
  "connectionPollMs": 1000,
  "playtimeFlushMs": 30000,
  "welcomeDelayMs": 1200,
  "chatOpenKeyScanCode": 20,
  "chatOpenKeyLabel": "T",
  "chatHistorySize": 22,
  "chatRadius": 1500,
  "whisperRadius": 450,
  "shoutRadius": 3500,
  "maxMessageLength": 180,
  "spamWindowMs": 10000,
  "spamMaxMessages": 6,
  "adminProfileIds": [
    1
  ],
  "allowSelfNameChange": true,
  "announceJoins": true,
  "announceLeaves": true,
  "announceDeaths": true,
  "debugActivations": false,
  "staffProfiles": {
    "1": "owner"
  },
  "adminAuditFile": "admin-audit.log",
  "adminPanelRefreshMs": 3000,
  "voiceEnabled": true,
  "voicePollMs": 250,
  "voiceEnterRadius": 1190,
  "voiceLeaveRadius": 1330,
  "voiceTransportClearMs": 700,
  "voiceTalkerPollMs": 90,
  "voiceHudEnabled": true,
  "voiceLipSyncEnabled": true,
  "voiceLipMaxStrength": 72
};

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.warn(`[CoreGM] ${CONFIG_PATH} not found; using defaults`);
      return { ...DEFAULT_CONFIG };
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error("[CoreGM] Failed to load config:", err.message);
    return { ...DEFAULT_CONFIG };
  }
}

const config = loadConfig();

function posInt(v, fallback) {
  return Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
}
config.maxUserId = posInt(config.maxUserId, 100);
config.connectionPollMs = posInt(config.connectionPollMs, 1000);
config.playtimeFlushMs = posInt(config.playtimeFlushMs, 30000);
config.chatHistorySize = posInt(config.chatHistorySize, 22);
config.maxMessageLength = posInt(config.maxMessageLength, 180);
config.spamWindowMs = posInt(config.spamWindowMs, 10000);
config.spamMaxMessages = posInt(config.spamMaxMessages, 6);
config.adminPanelRefreshMs = posInt(config.adminPanelRefreshMs, 3000);
config.voicePollMs = posInt(config.voicePollMs, 250);
config.voiceTransportClearMs = posInt(config.voiceTransportClearMs, 700);
config.voiceTalkerPollMs = posInt(config.voiceTalkerPollMs, 90);
config.voiceHudEnabled = config.voiceHudEnabled !== false;
config.voiceLipSyncEnabled = config.voiceLipSyncEnabled !== false;
config.voiceLipMaxStrength = Math.max(0, Math.min(100, Number(config.voiceLipMaxStrength) || 72));
config.voiceEnterRadius = Number(config.voiceEnterRadius) || 1190;
config.voiceLeaveRadius = Math.max(Number(config.voiceLeaveRadius) || 1330, config.voiceEnterRadius);
config.voiceEnabled = config.voiceEnabled !== false;
config.chatRadius = Number(config.chatRadius) || 1500;
config.whisperRadius = Number(config.whisperRadius) || 450;
config.shoutRadius = Number(config.shoutRadius) || 3500;
config.chatOpenKeyScanCode = Number(config.chatOpenKeyScanCode) || 20;
config.chatOpenKeyLabel = cleanTextConfig(config.chatOpenKeyLabel || "T", 12) || "T";
config.adminProfileIds = Array.isArray(config.adminProfileIds)
  ? config.adminProfileIds.map(Number).filter(Number.isFinite)
  : [];

config.staffProfiles = (config.staffProfiles && typeof config.staffProfiles === "object")
  ? config.staffProfiles
  : {};
config.adminAuditFile = cleanConfigFilename(config.adminAuditFile || "admin-audit.log");

function cleanConfigFilename(value) {
  const name = String(value || "admin-audit.log").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  return name || "admin-audit.log";
}

function cleanTextConfig(value, max = 32) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function loadUiDocument() {
  try {
    const html = fs.readFileSync(UI_PATH, "utf8").replace(/^\uFEFF/, "");
    if (!html.trim()) throw new Error("UI file is empty");
    return html;
  } catch (err) {
    console.error(`[CoreGM] Failed to load UI ${UI_PATH}:`, err.message);
    return `<!doctype html><meta charset="utf-8"><body style="background:#111;color:#eee;font-family:sans-serif"><pre>Core RP UI failed to load: ${String(err.message).replace(/[<>&]/g, "?")}</pre></body>`;
  }
}

const UI_HTML = loadUiDocument();
const UI_URL = "data:text/html;charset=utf-8," + encodeURIComponent(UI_HTML);

// Role/permission model intentionally mirrors Heavy RP's staff model.
// Only a subset is used while DB-dependent systems are absent.
const ROLE_PERMISSIONS = {
  moderator: new Set(["kick", "teleport", "view_audit", "manage_whitelist"]),
  admin: new Set([
    "kick", "teleport", "view_audit", "manage_whitelist", "ban",
    "add_item", "set_gold", "retire_character", "manage_recipes",
    "reveal_identity", "run_world_probe"
  ]),
  owner: new Set([
    "kick", "teleport", "view_audit", "manage_whitelist", "ban",
    "add_item", "set_gold", "manage_staff", "retire_character",
    "manage_recipes", "reveal_identity", "run_world_probe"
  ])
};

if (typeof globalThis.__SKYMP_CORE_GM_CLEANUP__ === "function") {
  try { globalThis.__SKYMP_CORE_GM_CLEANUP__(); }
  catch (err) { console.error("[CoreGM] Previous cleanup failed:", err.message); }
}

if (typeof mp === "undefined") {
  console.error("[CoreGM] FATAL: global mp API unavailable");
} else {
  const sessions = new Map();       // userId -> session
  const sessionsByActor = new Map(); // actorId -> session
  const sessionsByProfile = new Map();// profileId -> session (current one-character model)
  const uiHistory = new Map();      // actorId -> [{id,kind,text,ts}]
  const spamBuckets = new Map();    // actorId -> timestamps
  const backLocations = new Map();  // actorId -> previous locationalData (staff TP)
  const adminUiOpen = new Set();    // actorId with /admin currently open
  const voiceRoutes = new Map();   // actorId -> Set(profileId) currently audible
  const timers = new Set();
  let uiTransportNonce = 1;
  let voiceTransportNonce = 1;
  const ADMIN_AUDIT_PATH = path.join(process.cwd(), config.adminAuditFile);
  let nextMessageId = 1;
  let notificationNonce = 1;

  function trackTimeout(fn, ms) {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    if (typeof t.unref === "function") t.unref();
    return t;
  }
  function trackInterval(fn, ms) {
    const t = setInterval(fn, ms);
    timers.add(t);
    if (typeof t.unref === "function") t.unref();
    return t;
  }
  function safe(label, fn, fallback) {
    try { return fn(); }
    catch (err) {
      console.error(`[CoreGM] ${label}:`, err.message);
      return fallback;
    }
  }
  function actorHex(id) {
    return typeof id === "number" ? `0x${id.toString(16)}` : "?";
  }
  function cleanText(v, max = config.maxMessageLength) {
    return String(v ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  // Persistent server-side player data.
  for (const p of [
    "gmFirstSeen","gmLastSeen","gmJoinCount","gmDeathCount",
    "gmPlaytimeSeconds","gmRpName"
  ]) {
    mp.makeProperty(p, {
      isVisibleByOwner: false,
      isVisibleByNeighbors: false,
      updateOwner: "",
      updateNeighbor: ""
    });
  }

  // Owner-only notification channel.
  mp.makeProperty("gmNotification", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: `
      if (ctx.value && ctx.value.text && ctx.sp && ctx.sp.Debug) {
        ctx.sp.Debug.notification(String(ctx.value.text));
      }
    `,
    updateNeighbor: ""
  });

  // Transient owner-only UI transport.
  // IMPORTANT: authoritative chat/admin UI state lives in RAM (uiHistory, sessions,
  // adminUiOpen). This property is only a short-lived delivery envelope and is
  // cleared after the client has received it, so UI history/state is not kept in
  // character persistence as gmUiState.
  mp.makeProperty("gmUiTransport", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: `
      if (ctx.value && ctx.sp && ctx.sp.browser) {
        var packet = ctx.value;
        if (packet.kind === "state" && packet.state) {
          var stateJson = JSON.stringify(packet.state);
          ctx.sp.browser.executeJavaScript(
            'window.coreRpSetState && window.coreRpSetState(' + stateJson + ')'
          );
        } else if (packet.kind === "admin" && packet.state) {
          ctx.state.coreAdminOpen = true;
          var adminJson = JSON.stringify({ nonce: packet.nonce, state: packet.state });
          ctx.sp.browser.setVisible(true);
          ctx.sp.browser.setFocused(true);
          ctx.sp.browser.executeJavaScript(
            'window.coreAdminReceive && window.coreAdminReceive(' + adminJson + ')'
          );
        }
      }
    `,
    updateNeighbor: ""
  });

  // Transient voice routing envelope. The stock SkyMP client stores the last
  // server-authorized route in SkyrimPlatform storage. A server-delivered
  // event source forwards it to the localhost Mumble bridge. No extra
  // Data/Platform/Plugins voice JS is required.
  mp.makeProperty("gmVoiceTransport", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: `
      if (ctx.value && ctx.sp && ctx.sp.storage) {
        ctx.sp.storage.secretSkyrimVoiceRoute = ctx.value;
      }
    `,
    updateNeighbor: ""
  });

  // Client -> server UI bridge and T chat opener.
  const eventSource = `
    try {
      var openKey = ${Number(config.chatOpenKeyScanCode)};
      var url = ${JSON.stringify(UI_URL)};
      var openChat = function() {
        try {
          if (ctx.state.coreAdminOpen) return;
          ctx.state.coreChatOpen = true;
          ctx.sp.browser.setVisible(true);
          ctx.sp.browser.setFocused(true);
          ctx.sp.browser.executeJavaScript('window.coreRpOpen && window.coreRpOpen()');
        } catch (e) {}
      };
      var closeChat = function() {
        try {
          ctx.state.coreChatOpen = false;
          ctx.sp.browser.executeJavaScript('window.coreRpClose && window.coreRpClose()');
          ctx.sp.browser.setFocused(false);
        } catch (e) {}
      };
      var closeAdmin = function() {
        try {
          ctx.state.coreAdminOpen = false;
          ctx.sp.browser.setFocused(false);
        } catch (e) {}
      };

      ctx.sp.on('browserMessage', function(e) {
        try {
          if (!e || !e.arguments || !e.arguments.length) return;
          var key = e.arguments[0];

          if (key === 'core-rp-ready') {
            ctx.sendEvent({ type: 'ready' });
            return;
          }
          if (key === 'core-rp-close') {
            closeChat();
            return;
          }
          if (key === 'core-rp-chat') {
            ctx.sendEvent({ type: 'chat', text: String(e.arguments[1] || '') });
            closeChat();
            return;
          }
          if (key === 'core-admin-close') {
            ctx.sendEvent({ type: 'adminClose' });
            closeAdmin();
            return;
          }
          if (key === 'core-admin-action') {
            ctx.sendEvent({
              type: 'adminAction',
              payload: String(e.arguments[1] || '').slice(0, 4096)
            });
            return;
          }
        } catch (err) {}
      });

      ctx.sp.on('buttonEvent', function(e) {
        try {
          if (
            e && e.device === 0 && e.code === openKey && e.isDown && !e.isRepeating &&
            !ctx.state.coreAdminOpen && !ctx.state.coreChatOpen
          ) {
            openChat();
          }
        } catch (err) {}
      });

      ctx.sp.once('update', function() {
        try {
          ctx.sp.browser.loadUrl(url);
          ctx.sp.browser.setVisible(true);
          ctx.sp.browser.setFocused(false);
        } catch (e) {}
      });
    } catch (e) {}
  `;

  mp.makeEventSource("_coreRpUi", eventSource);

  // Voice bridge, HUD and lipsync are delivered by the gamemode itself through
  // SkyMP's stock GamemodeEventSourceService. The stock skymp5-client.js stays
  // untouched: all game-side voice logic starts only after a SkyMP connection.
  const voiceEventSource = `
    try {
      var generation = String(Date.now()) + ':' + String(Math.random());
      ctx.sp.storage.secretSkyrimVoiceGeneration = generation;

      var bridgeHost = '127.0.0.1';
      var bridgePort = 38471;
      var pttScanCode = 49;
      var unitsPerMeter = 70;
      var positionUpdateMs = 100;
      var routeRefreshMs = 2000;
      var talkerPollMs = ${Number(config.voiceTalkerPollMs)};
      var hudEnabled = ${config.voiceHudEnabled ? "true" : "false"};
      var lipSyncEnabled = ${config.voiceLipSyncEnabled ? "true" : "false"};
      var lipMaxStrength = ${Number(config.voiceLipMaxStrength)};
      var bridge = new ctx.sp.HttpClient('http://' + bridgeHost + ':' + bridgePort);
      var gameSettings = ctx.sp.settings && ctx.sp.settings['skymp5-client'];
      var profileId = Number(gameSettings && gameSettings.gameData && gameSettings.gameData.profileId);
      var lastStateAt = 0;
      var lastRouteAt = 0;
      var lastTalkerAt = 0;
      var lastRouteNonce = null;
      var lastRouteText = null;
      var statePending = false;
      var routePending = false;
      var talkerPending = false;
      var pttPressed = false;
      var bridgeOnline = false;
      var bridgeWarningShown = false;
      var peerActors = Object.create(null);
      var lipStates = Object.create(null);
      var lipWarnings = Object.create(null);
      var lastHudJson = '';
      var lastHudAt = 0;
      var lipSequence = [0, 6, 11, 0, 5, 2]; // Aah, Eh, Oh, Aah, Eee, BMP
      var lipUsed = [0, 2, 5, 6, 11];
      var lipBackendLogged = false;
      var lipBackendErrorLogged = false;

      // HttpClient callbacks run outside SkyrimPlatform's Papyrus OnUpdate
      // native-call context. Never call callNative from those callbacks.
      // They only publish the newest /talkers snapshot; facial work is drained
      // from ctx.sp.on('update'), where vm/stackId are valid.
      var pendingTalkersData = null;
      var pendingTalkersReady = false;

      var alive = function() {
        try {
          return ctx.sp.storage.secretSkyrimVoiceGeneration === generation;
        } catch (e) {
          return false;
        }
      };

      var voiceLog = function(text) {
        try {
          ctx.sp.writeLogs('SecretSkyrimVoice', String(text));
        } catch (e) {
          try { ctx.sp.printConsole(String(text)); } catch (ignore) {}
        }
      };

      if (!Number.isSafeInteger(profileId) || profileId < 0) {
        voiceLog('[VOICE] disabled: invalid skymp5-client gameData.profileId');
        return;
      }

      var encodeLines = function(obj) {
        return Object.keys(obj).map(function(key) {
          return key + '=' + String(obj[key]).replace(/[\\r\\n]/g, '');
        }).join('\\n');
      };

      var pushHud = function(state, force) {
        if (!hudEnabled) return;
        try {
          var now = Date.now();
          var json = JSON.stringify(state || {});
          if (!force && json === lastHudJson && now - lastHudAt < 750) return;
          lastHudJson = json;
          lastHudAt = now;
          ctx.sp.browser.executeJavaScript(
            'window.coreVoiceSetState && window.coreVoiceSetState(' + json + ')'
          );
        } catch (e) {}
      };

      var onBridgeResult = function(res) {
        try {
          var ok = res && Number(res.status) >= 200 && Number(res.status) < 300;
          if (ok) {
            if (!bridgeOnline) voiceLog('[VOICE] bridge=OK 127.0.0.1:38471');
            bridgeOnline = true;
            bridgeWarningShown = false;
          } else {
            bridgeOnline = false;
            pushHud({ online: false, ptt: pttPressed, talking: false, level: 0 }, true);
            if (!bridgeWarningShown) {
              bridgeWarningShown = true;
              voiceLog('[VOICE] bridge HTTP error: ' + (res ? String(res.status) : 'no response'));
            }
          }
        } catch (e) {}
      };

      var post = function(path, body, done) {
        if (!alive()) return false;
        try {
          bridge.post(path, {
            body: body,
            contentType: 'text/plain; charset=utf-8'
          }, function(res) {
            onBridgeResult(res);
            try { if (done) done(res); } catch (e) {}
          });
          return true;
        } catch (e) {
          bridgeOnline = false;
          pushHud({ online: false, ptt: pttPressed, talking: false, level: 0 }, true);
          if (!bridgeWarningShown) {
            bridgeWarningShown = true;
            voiceLog('[VOICE] bridge exception: ' + String(e && e.message ? e.message : e));
          }
          return false;
        }
      };

      var getJson = function(path, done) {
        if (!alive()) return false;
        try {
          bridge.get(path, {}, function(res) {
            onBridgeResult(res);
            if (!res || Number(res.status) < 200 || Number(res.status) >= 300) {
              try { done(null); } catch (ignore) {}
              return;
            }
            try { done(JSON.parse(String(res.body || '{}'))); }
            catch (e) { try { done(null); } catch (ignore) {} }
          });
          return true;
        } catch (e) {
          bridgeOnline = false;
          try { done(null); } catch (ignore) {}
          return false;
        }
      };

      var getActorById = function(actorId) {
        try {
          actorId = Number(actorId);
          if (!Number.isSafeInteger(actorId) || actorId <= 0) return null;
          // Routes carry server-format form IDs. SkyMP exposes the official
          // conversion helper on gamemode ctx; never assume client/server IDs
          // are numerically identical.
          var clientFormId = actorId;
          if (typeof ctx.getFormIdInClientFormat === 'function') {
            clientFormId = Number(ctx.getFormIdInClientFormat(actorId));
          }
          if (!Number.isSafeInteger(clientFormId) || clientFormId <= 0) return null;
          var form = ctx.sp.Game.getFormEx(clientFormId);
          var actor = ctx.sp.Actor.from(form);
          if (!actor) return null;
          try { if (!actor.is3DLoaded()) return null; } catch (e) {}
          return actor;
        } catch (e) { return null; }
      };

      var setMfgPhoneme = function(actor, phoneme, value) {
        if (!actor || !ctx.sp || typeof ctx.sp.callNative !== 'function') return false;
        try {
          var result = ctx.sp.callNative(
            'MfgConsoleFunc',
            'SetPhonemeModifier',
            null,
            actor,
            0,
            Number(phoneme),
            Math.round(Math.max(0, Math.min(100, Number(value) || 0)))
          );
          if (!lipBackendLogged) {
            lipBackendLogged = true;
            voiceLog('[VOICE] lipsync backend=MfgFixNG');
          }
          return result !== false;
        } catch (e) {
          if (!lipBackendErrorLogged) {
            lipBackendErrorLogged = true;
            voiceLog('[VOICE] lipsync MfgFix unavailable: ' + String(e && e.message ? e.message : e));
          }
          return false;
        }
      };

      var zeroLip = function(actor) {
        if (!actor) return;
        for (var i = 0; i < lipUsed.length; ++i) {
          try { setMfgPhoneme(actor, lipUsed[i], 0); } catch (e) {}
        }
      };

      var resetLipKey = function(key) {
        var state = lipStates[key];
        if (!state) return;
        try { zeroLip(state.actor); } catch (e) {}
        delete lipStates[key];
      };

      var resetAllLips = function() {
        try {
          Object.keys(lipStates).forEach(function(key) { resetLipKey(key); });
        } catch (e) {}
      };

      var animateLip = function(key, actor, level, now) {
        if (!lipSyncEnabled || !actor) return false;
        level = Math.max(0, Math.min(1, Number(level) || 0));
        if (level <= 0) return false;
        var phase = Math.floor(now / 105) % lipSequence.length;
        var phoneme = lipSequence[phase];
        var strength = Math.round(Math.min(lipMaxStrength, 18 + level * Math.max(0, lipMaxStrength - 18)));
        var state = lipStates[key];
        try {
          if (!state || state.actor !== actor) {
            if (state) zeroLip(state.actor);
            zeroLip(actor);
            state = { actor: actor, phoneme: -1, strength: -1 };
            lipStates[key] = state;
          }

          if (state.phoneme !== phoneme && state.phoneme >= 0) {
            setMfgPhoneme(actor, state.phoneme, 0);
          }

          // Avoid flooding the Papyrus/UI task queue when neither mouth shape
          // nor intensity meaningfully changed.
          if (state.phoneme !== phoneme || Math.abs(state.strength - strength) >= 3) {
            if (!setMfgPhoneme(actor, phoneme, strength)) {
              resetLipKey(key);
              return false;
            }
            state.phoneme = phoneme;
            state.strength = strength;
          }
          return true;
        } catch (e) {
          resetLipKey(key);
          return false;
        }
      };

      var setPeerActors = function(route) {
        var next = Object.create(null);
        try {
          if (route && Array.isArray(route.peers)) {
            route.peers.forEach(function(peer) {
              if (!peer) return;
              var pid = Number(peer.profileId);
              var actorId = Number(peer.actorId);
              if (Number.isSafeInteger(pid) && pid >= 0 && Number.isSafeInteger(actorId) && actorId > 0) {
                next[String(pid)] = actorId;
              }
            });
          }
        } catch (e) {}
        peerActors = next;
      };

      var queueTalkers = function(data) {
        pendingTalkersData = data;
        pendingTalkersReady = true;
      };

      var drainTalkers = function() {
        if (!pendingTalkersReady) return;
        pendingTalkersReady = false;
        var data = pendingTalkersData;
        pendingTalkersData = null;
        applyTalkers(data);
      };

      var applyTalkers = function(data) {
        var now = Date.now();
        if (!data || data.status !== 'ok') {
          pushHud({ online: false, ptt: pttPressed, talking: false, level: 0 }, true);
          resetAllLips();
          return;
        }

        var localPtt = !!data.ptt;
        var localTalking = !!data.localTalking;
        var localLevel = Math.max(0, Math.min(1, Number(data.localLevel) || 0));
        pushHud({ online: true, ptt: localPtt, talking: localTalking, level: localLevel }, false);

        var keep = Object.create(null);
        if (lipSyncEnabled && localTalking) {
          try {
            var localActor = ctx.sp.Game.getPlayer();
            if (localActor && animateLip('local', localActor, localLevel, now)) keep.local = true;
          } catch (e) {}
        }

        if (lipSyncEnabled && Array.isArray(data.talkers)) {
          data.talkers.forEach(function(talker) {
            if (!talker) return;
            var pid = Number(talker.profileId);
            var level = Math.max(0, Math.min(1, Number(talker.level) || 0));
            var actorId = peerActors[String(pid)];
            if (!Number.isSafeInteger(pid) || pid < 0 || !actorId || level <= 0) return;
            var actor = getActorById(actorId);
            var key = 'p:' + String(pid);
            if (actor && animateLip(key, actor, level, now)) {
              keep[key] = true;
            } else if (!actor && !lipWarnings[key]) {
              lipWarnings[key] = true;
              voiceLog('[VOICE] lipsync actor unavailable: profileId=' + pid + ' actorId=' + actorId);
            }
          });
        }

        Object.keys(lipStates).forEach(function(key) {
          if (!keep[key]) resetLipKey(key);
        });
      };

      var sendState = function(now) {
        if (statePending || now - lastStateAt < positionUpdateMs) return;
        var player = null;
        try { player = ctx.sp.Game.getPlayer(); } catch (e) { return; }
        if (!player) return;

        var x, y, z, heading;
        try {
          x = Number(player.getPositionX()) / unitsPerMeter;
          y = Number(player.getPositionY()) / unitsPerMeter;
          z = Number(player.getPositionZ()) / unitsPerMeter;
          heading = Number(player.getAngleZ()) * Math.PI / 180;
        } catch (e) { return; }
        if (![x, y, z, heading].every(Number.isFinite)) return;

        statePending = true;
        lastStateAt = now;
        var ok = post('/state', encodeLines({
          profileId: profileId,
          x: x.toFixed(5),
          y: z.toFixed(5),
          z: y.toFixed(5),
          frontX: Math.sin(heading).toFixed(6),
          frontY: 0,
          frontZ: Math.cos(heading).toFixed(6),
          topX: 0,
          topY: 1,
          topZ: 0,
          context: 'secret-skyrim-mp',
          ts: Date.now()
        }), function() { statePending = false; });
        if (!ok) statePending = false;
      };

      var sendRoute = function(now) {
        var route = null;
        try { route = ctx.sp.storage.secretSkyrimVoiceRoute; } catch (e) { return; }
        if (!route || !Array.isArray(route.audible)) return;
        if (Number(route.profileId) !== profileId) return;

        setPeerActors(route);
        var nonce = Number(route.nonce) || 0;
        var audible = route.audible
          .map(Number)
          .filter(function(id) { return Number.isSafeInteger(id) && id >= 0; })
          .sort(function(a, b) { return a - b; })
          .join(',');

        if (routePending) return;
        if (nonce === lastRouteNonce && now - lastRouteAt < routeRefreshMs) return;
        lastRouteNonce = nonce;
        lastRouteAt = now;
        if (audible !== lastRouteText) {
          lastRouteText = audible;
          voiceLog('[VOICE] route audible=[' + audible + ']');
        }

        routePending = true;
        var ok = post('/route', encodeLines({
          profileId: profileId,
          nonce: nonce,
          audible: audible,
          ts: Date.now()
        }), function() { routePending = false; });
        if (!ok) routePending = false;
      };

      var pollTalkers = function(now) {
        if (talkerPending || now - lastTalkerAt < talkerPollMs) return;
        talkerPending = true;
        lastTalkerAt = now;
        var ok = getJson('/talkers', function(data) {
          talkerPending = false;
          if (!alive()) return;
          queueTalkers(data);
        });
        if (!ok) {
          talkerPending = false;
          queueTalkers(null);
        }
      };

      var sendPtt = function(pressed) {
        pressed = !!pressed;
        if (pttPressed === pressed) return;
        pttPressed = pressed;
        voiceLog('[VOICE] PTT ' + (pressed ? 'DOWN' : 'UP'));
        pushHud({ online: bridgeOnline, ptt: pressed, talking: false, level: 0 }, true);
        if (!pressed) resetLipKey('local');
        post('/ptt', encodeLines({ pressed: pressed ? 1 : 0, ts: Date.now() }));
      };

      ctx.sp.on('buttonEvent', function(e) {
        if (!alive()) return;
        try {
          if (!e || Number(e.code) !== pttScanCode) return;
          if (e.device !== undefined && Number(e.device) !== 0) return;
          if (e.isDown && !e.isRepeating) sendPtt(true);
          if (e.isUp) sendPtt(false);
        } catch (err) {}
      });

      ctx.sp.on('update', function() {
        if (!alive()) return;
        try {
          var now = Date.now();
          sendState(now);
          sendRoute(now);
          pollTalkers(now);
          drainTalkers();
          if (pttPressed && ctx.sp.mpClientPlugin && !ctx.sp.mpClientPlugin.isConnected()) {
            sendPtt(false);
          }
        } catch (err) {}
      });

      pushHud({ online: false, ptt: false, talking: false, level: 0 }, true);
      voiceLog('[VOICE] gamemode event source installed; PTT=N; profileId=' + profileId + '; HUD=' + hudEnabled + '; lipsync=' + lipSyncEnabled);
    } catch (e) {
      try {
        ctx.sp.writeLogs('SecretSkyrimVoice', '[VOICE] event source init failed: ' + String(e && e.message ? e.message : e));
      } catch (ignore) {}
    }
  `;

  mp.makeEventSource("_coreVoice", voiceEventSource);
  function getProp(actorId, p, fallback) {
    const v = safe(`get ${p} ${actorHex(actorId)}`, () => mp.get(actorId, p), fallback);
    return v === undefined ? fallback : v;
  }
  function getNumber(actorId, p, fallback = 0) {
    const n = Number(getProp(actorId, p, fallback));
    return Number.isFinite(n) ? n : fallback;
  }
  function setProp(actorId, p, v) {
    if (!actorId) return false;
    try { mp.set(actorId, p, v); return true; }
    catch (err) {
      console.error(`[CoreGM] set ${p} ${actorHex(actorId)}:`, err.message);
      return false;
    }
  }
  function increment(actorId, p, amount = 1) {
    const n = getNumber(actorId, p, 0) + amount;
    setProp(actorId, p, n);
    return n;
  }

  function getVanillaActorName(actorId) {
    const n = typeof mp.getActorName === "function"
      ? safe("getActorName", () => mp.getActorName(actorId), "")
      : "";
    return cleanText(n || `Player_${actorId.toString(16)}`, 60);
  }
  function getRpName(actorId) {
    const custom = cleanText(getProp(actorId, "gmRpName", ""), 60);
    return custom || getVanillaActorName(actorId);
  }

  function getProfileId(actorId) {
    const raw = getProp(actorId, "profileId", null);
    const profileId = Number(raw);
    return Number.isSafeInteger(profileId) && profileId >= 0 ? profileId : null;
  }

  function bindSessionIdentity(session, actorId) {
    const profileId = getProfileId(actorId);
    if (profileId === null) {
      console.error(`[CoreGM] Cannot bind identity: actor=${actorHex(actorId)} has no valid profileId`);
      return false;
    }

    const previous = sessionsByProfile.get(profileId);
    if (previous && previous !== session && previous.ready) {
      console.warn(
        `[CoreGM] Duplicate online profileId=${profileId}: user=${previous.userId} and user=${session.userId}`
      );
    }

    session.actorId = actorId;
    session.profileId = profileId;
    sessionsByActor.set(actorId, session);
    sessionsByProfile.set(profileId, session);
    return true;
  }

  function unbindSessionIdentity(session) {
    if (!session) return;
    if (session.actorId && sessionsByActor.get(session.actorId) === session) {
      sessionsByActor.delete(session.actorId);
    }
    if (session.profileId !== null && sessionsByProfile.get(session.profileId) === session) {
      sessionsByProfile.delete(session.profileId);
    }
  }

  function activeSessions() {
    return [...sessions.values()].filter(s => s.ready && s.actorId);
  }
  function byActor(actorId) {
    return sessionsByActor.get(Number(actorId)) || null;
  }
  function byProfileId(profileId) {
    return sessionsByProfile.get(Number(profileId)) || null;
  }
  function byUserId(userId) {
    const s = sessions.get(Number(userId));
    return s && s.ready ? s : null;
  }
  function getStaffRole(session) {
    if (!session) return null;
    const pid = Number(session.profileId);
    const configured = config.staffProfiles[String(pid)];
    if (configured && ROLE_PERMISSIONS[configured]) return configured;

    // v2 backwards compatibility: old adminProfileIds become owner.
    if (config.adminProfileIds.includes(pid)) return "owner";
    return null;
  }

  function hasPermission(session, permission) {
    const role = getStaffRole(session);
    if (!role) return false;
    const perms = ROLE_PERMISSIONS[role];
    return !!perms && perms.has(permission);
  }

  function isAdmin(session) {
    return getStaffRole(session) !== null;
  }

  function isSeniorStaff(session) {
    const role = getStaffRole(session);
    return role === "admin" || role === "owner";
  }

  function auditStaff(session, action, targetSession = null, details = {}) {
    const entry = {
      ts: new Date().toISOString(),
      action,
      staff: {
        userId: session?.userId ?? null,
        profileId: session?.profileId ?? null,
        actorId: session?.actorId ? actorHex(session.actorId) : null,
        role: getStaffRole(session)
      },
      target: targetSession ? {
        userId: targetSession.userId,
        profileId: targetSession.profileId,
        actorId: actorHex(targetSession.actorId),
        name: getRpName(targetSession.actorId)
      } : null,
      details
    };

    console.log(`[CoreGM][AUDIT] ${JSON.stringify(entry)}`);
    try {
      fs.appendFileSync(ADMIN_AUDIT_PATH, JSON.stringify(entry) + "\\n", "utf8");
    } catch (err) {
      console.error("[CoreGM] Failed to write admin audit:", err.message);
    }
  }

  function deny(session, permission) {
    appendMessage(
      session.actorId,
      "system",
      `Недостаточно прав${permission ? ` (${permission})` : ""}.`
    );
  }

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function getLocationalData(actorId) {
    return safe(
      `get locationalData ${actorHex(actorId)}`,
      () => mp.get(actorId, "locationalData"),
      null
    );
  }

  function setLocationalData(actorId, location, remember = true) {
    if (!actorId || !location || typeof location !== "object") return false;
    const current = getLocationalData(actorId);
    if (remember && current) backLocations.set(actorId, cloneJson(current));
    return !!safe(
      `set locationalData ${actorHex(actorId)}`,
      () => { mp.set(actorId, "locationalData", cloneJson(location)); return true; },
      false
    );
  }

  function actorRef(actorId) {
    return { type: "form", desc: mp.getDescFromId(actorId) };
  }

  function resolveTarget(token) {
    const raw = String(token || "").trim();
    if (!raw) return null;

    // UI/user ID is the convenient default.
    if (/^\d+$/.test(raw)) {
      const byUser = byUserId(Number(raw));
      if (byUser) return byUser;
    }

    // Actor IDs can be copied from /id or audit logs.
    let actorId = NaN;
    if (/^0x[0-9a-f]+$/i.test(raw)) actorId = parseInt(raw.slice(2), 16);
    else if (/^[0-9a-f]*[a-f][0-9a-f]*$/i.test(raw)) actorId = parseInt(raw, 16);

    return Number.isFinite(actorId) ? byActor(actorId) : null;
  }

  function targetUsage(session, token, usage) {
    const target = resolveTarget(token);
    if (!target) {
      appendMessage(session.actorId, "system", `Игрок не найден. ${usage}`);
      return null;
    }
    return target;
  }

  function papyrusActorMethod(targetActorId, method, args = []) {
    if (typeof mp.callPapyrusFunction !== "function" || typeof mp.getDescFromId !== "function") {
      return false;
    }
    return safe(
      `Papyrus Actor.${method} ${actorHex(targetActorId)}`,
      () => {
        mp.callPapyrusFunction("method", "Actor", method, actorRef(targetActorId), args);
        return true;
      },
      false
    );
  }

  function voiceCellCompatible(a, b) {
    if (!a || !b) return false;
    if (a.cell === null || a.cell === undefined || b.cell === null || b.cell === undefined) return true;
    return String(a.cell) === String(b.cell);
  }

  function setEquals(a, b) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  function sendVoiceRoute(session, routeSet) {
    if (!session || !session.ready || !session.actorId) return false;
    const audible = [...routeSet].sort((a, b) => a - b);
    const peers = audible.map((profileId) => {
      const peer = sessionsByProfile.get(profileId);
      return peer && peer.actorId ? { profileId, actorId: peer.actorId } : null;
    }).filter(Boolean);
    const payload = {
      nonce: voiceTransportNonce++,
      profileId: session.profileId,
      audible,
      peers
    };
    if (!setProp(session.actorId, "gmVoiceTransport", payload)) return false;
    trackTimeout(() => {
      const current = getProp(session.actorId, "gmVoiceTransport", null);
      if (current && current.nonce === payload.nonce) setProp(session.actorId, "gmVoiceTransport", null);
    }, config.voiceTransportClearMs);
    return true;
  }

  function refreshVoiceRoutes(force = false) {
    if (!config.voiceEnabled) return;
    const active = activeSessions();
    const locations = new Map();
    for (const s of active) locations.set(s.actorId, getLocation(s.actorId));

    for (const listener of active) {
      const listenerLoc = locations.get(listener.actorId);
      const oldRoute = voiceRoutes.get(listener.actorId) || new Set();
      const nextRoute = new Set();
      if (listenerLoc && Number.isSafeInteger(listener.profileId)) {
        for (const speaker of active) {
          if (speaker === listener || !Number.isSafeInteger(speaker.profileId)) continue;
          const speakerLoc = locations.get(speaker.actorId);
          if (!speakerLoc || !voiceCellCompatible(listenerLoc, speakerLoc)) continue;
          const radius = oldRoute.has(speaker.profileId)
            ? config.voiceLeaveRadius
            : config.voiceEnterRadius;
          if (distance(listenerLoc.pos, speakerLoc.pos) <= radius) nextRoute.add(speaker.profileId);
        }
      }
      if (force || !setEquals(oldRoute, nextRoute)) {
        voiceRoutes.set(listener.actorId, nextRoute);
        sendVoiceRoute(listener, nextRoute);
      }
    }

    const activeActors = new Set(active.map(s => s.actorId));
    for (const actorId of [...voiceRoutes.keys()]) {
      if (!activeActors.has(actorId)) voiceRoutes.delete(actorId);
    }
  }

  function buildAdminState(session) {
    const selfLoc = getLocation(session.actorId);
    return {
      version: VERSION,
      serverName: config.serverName,
      role: getStaffRole(session),
      permissions: [...(ROLE_PERMISSIONS[getStaffRole(session)] || [])],
      canAnnounce: isSeniorStaff(session),
      self: {
        userId: session.userId,
        profileId: session.profileId,
        actorId: actorHex(session.actorId),
        name: getRpName(session.actorId),
        location: selfLoc
      },
      players: activeSessions().map(s => ({
        userId: s.userId,
        profileId: s.profileId,
        actorId: actorHex(s.actorId),
        name: getRpName(s.actorId),
        staffRole: getStaffRole(s),
        location: getLocation(s.actorId),
        joins: getNumber(s.actorId, "gmJoinCount", 0),
        deaths: getNumber(s.actorId, "gmDeathCount", 0),
        playtimeSeconds: getNumber(s.actorId, "gmPlaytimeSeconds", 0)
      }))
    };
  }

  function sendUiTransport(actorId, kind, state) {
    const payload = {
      nonce: uiTransportNonce++,
      kind,
      state
    };
    if (!setProp(actorId, "gmUiTransport", payload)) return false;

    trackTimeout(() => {
      const current = getProp(actorId, "gmUiTransport", null);
      if (current && current.nonce === payload.nonce) {
        setProp(actorId, "gmUiTransport", null);
      }
    }, 700);
    return true;
  }

  function pushAdminPanel(session) {
    if (!session || !session.ready || !isAdmin(session)) return false;
    return sendUiTransport(session.actorId, "admin", buildAdminState(session));
  }

  function openAdminPanel(session) {
    if (!isAdmin(session)) {
      deny(session);
      return;
    }
    adminUiOpen.add(session.actorId);
    pushAdminPanel(session);
    auditStaff(session, "admin_panel_open", null, {});
  }

  function closeAdminPanel(session) {
    if (!session) return;
    adminUiOpen.delete(session.actorId);
  }

  function refreshOpenAdminPanels() {
    for (const actorId of [...adminUiOpen]) {
      const session = byActor(actorId);
      if (!session || !isAdmin(session)) {
        adminUiOpen.delete(actorId);
        continue;
      }
      pushAdminPanel(session);
    }
  }

  function parseAdminPayload(raw) {
    if (raw && typeof raw === "object") return raw;
    if (typeof raw !== "string" || raw.length > 4096) return null;
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : null;
    } catch (_) {
      return null;
    }
  }

  function handleAdminUiAction(session, rawPayload) {
    if (!isAdmin(session)) {
      deny(session);
      return;
    }

    const p = parseAdminPayload(rawPayload);
    if (!p || typeof p.action !== "string") return;

    const action = p.action;
    const target = String(p.targetId ?? "").trim();
    let command = null;

    switch (action) {
      case "refresh":
        pushAdminPanel(session);
        return;
      case "inspect":
        command = `/inspect ${target}`;
        break;
      case "tp":
        command = `/tp ${target}`;
        break;
      case "bring":
        command = `/bring ${target}`;
        break;
      case "heal":
        command = `/heal ${target}`;
        break;
      case "resurrect":
        command = `/resurrect ${target}`;
        break;
      case "racemenu":
        command = `/racemenu ${target}`;
        break;
      case "kick": {
        const reason = cleanText(p.reason, 120);
        command = `/kick ${target}${reason ? " " + reason : ""}`;
        break;
      }
      case "back":
        command = "/back";
        break;
      case "healSelf":
        command = "/heal";
        break;
      case "resurrectSelf":
        command = "/resurrect";
        break;
      case "tpcoords": {
        const xyz = [Number(p.x), Number(p.y), Number(p.z)];
        if (xyz.some(v => !Number.isFinite(v))) {
          appendMessage(session.actorId, "system", "Admin UI: неверные координаты.");
          pushAdminPanel(session);
          return;
        }
        command = `/tpcoords ${xyz[0]} ${xyz[1]} ${xyz[2]}`;
        break;
      }
      case "announce": {
        const text = cleanText(p.text, 220);
        if (!text) return;
        command = `/announce ${text}`;
        break;
      }
      default:
        console.warn(`[CoreGM] Unknown admin UI action: ${action}`);
        return;
    }

    handleCommand(session, command);

    // Rebuild the panel from authoritative server state after the action.
    trackTimeout(() => {
      if (adminUiOpen.has(session.actorId)) pushAdminPanel(session);
    }, action === "kick" ? 900 : 150);
  }

  function notify(actorId, text) {
    const message = cleanText(text, 240);
    if (!message) return;
    const payload = { id: notificationNonce++, text: message };
    if (!setProp(actorId, "gmNotification", payload)) return;
    trackTimeout(() => setProp(actorId, "gmNotification", null), 700);
  }

  function pushUiState(actorId) {
    const s = byActor(actorId);
    return sendUiTransport(actorId, "state", {
      version: VERSION,
      serverName: config.serverName,
      playerId: s ? s.userId : null,
      profileId: s ? s.profileId : null,
      staffRole: s ? getStaffRole(s) : null,
      online: activeSessions().length,
      messages: (uiHistory.get(actorId) || []).slice(-config.chatHistorySize)
    });
  }

  function appendMessage(actorId, kind, text) {
    if (!actorId) return;
    let arr = uiHistory.get(actorId);
    if (!arr) { arr = []; uiHistory.set(actorId, arr); }
    arr.push({
      id: nextMessageId++,
      kind: String(kind || "system"),
      text: cleanText(text, 320),
      ts: Date.now()
    });
    if (arr.length > config.chatHistorySize) {
      arr.splice(0, arr.length - config.chatHistorySize);
    }
    pushUiState(actorId);
  }

  function sendGlobal(kind, text, exceptActorId = null) {
    for (const s of activeSessions()) {
      if (s.actorId === exceptActorId) continue;
      appendMessage(s.actorId, kind, text);
    }
  }

  function getLocation(actorId) {
    if (!actorId) return null;
    const pos = typeof mp.getActorPos === "function"
      ? safe("getActorPos", () => mp.getActorPos(actorId), null)
      : safe("get pos", () => mp.get(actorId, "pos"), null);
    const cell = typeof mp.getActorCellOrWorld === "function"
      ? safe("getActorCellOrWorld", () => mp.getActorCellOrWorld(actorId), null)
      : null;
    if (!Array.isArray(pos) || pos.length < 3) return null;
    return { pos: [Number(pos[0]), Number(pos[1]), Number(pos[2])], cell };
  }
  function distance(a, b) {
    const dx=a[0]-b[0], dy=a[1]-b[1], dz=a[2]-b[2];
    return Math.sqrt(dx*dx+dy*dy+dz*dz);
  }
  function recipientsInRadius(sourceActorId, radius) {
    const src = getLocation(sourceActorId);
    const result = [];
    if (!src) return [sourceActorId];
    for (const s of activeSessions()) {
      const loc = getLocation(s.actorId);
      if (!loc) continue;
      if (src.cell && loc.cell && src.cell !== loc.cell) continue;
      if (distance(src.pos, loc.pos) <= radius) result.push(s.actorId);
    }
    if (!result.includes(sourceActorId)) result.push(sourceActorId);
    return result;
  }
  function sendProximity(sourceActorId, radius, kind, render) {
    for (const actorId of recipientsInRadius(sourceActorId, radius)) {
      const text = typeof render === "function" ? render(actorId) : render;
      appendMessage(actorId, kind, text);
    }
  }

  function spamAllowed(actorId) {
    const now = Date.now();
    const arr = (spamBuckets.get(actorId) || []).filter(t => now - t < config.spamWindowMs);
    if (arr.length >= config.spamMaxMessages) {
      spamBuckets.set(actorId, arr);
      return false;
    }
    arr.push(now);
    spamBuckets.set(actorId, arr);
    return true;
  }

  function helpText(session) {
    const base = [
      "/me действие",
      "/do описание",
      "/try действие",
      "/w текст — шёпот",
      "/s текст — крик",
      "/b текст — локальный OOC",
      "/ooc текст — глобальный OOC",
      "/roll [макс] — бросок",
      "/name Имя Фамилия",
      "/players, /id, /stats, /coords, /help"
    ];
    if (isAdmin(session)) {
      base.push(
        "STAFF: /admin (панель), /staff, /inspect ID, /tp ID, /bring ID, /back, /tpcoords X Y Z, " +
        "/heal [ID], /resurrect [ID], /racemenu [ID], /kick ID [причина]"
      );
      if (isSeniorStaff(session)) base.push("ADMIN+: /announce текст");
    }
    return base.join(" | ");
  }

  function cmdName(session, args) {
    if (!config.allowSelfNameChange && !isAdmin(session)) {
      appendMessage(session.actorId, "system", "Смена RP-имени отключена.");
      return;
    }
    const name = cleanText(args.join(" "), 48);
    if (name.length < 3) {
      appendMessage(session.actorId, "system", "Использование: /name Имя Фамилия");
      return;
    }
    if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) {
      appendMessage(session.actorId, "system", "Имя содержит недопустимые символы.");
      return;
    }
    setProp(session.actorId, "gmRpName", name);
    session.actorName = name;
    appendMessage(session.actorId, "system", `RP-имя установлено: ${name}`);
    refreshOpenAdminPanels();
  }

  function handleCommand(session, raw) {
    const parts = raw.slice(1).trim().split(/\s+/);
    const command = (parts.shift() || "").toLowerCase();
    const args = parts;
    const actorId = session.actorId;
    const name = getRpName(actorId);

    switch (command) {
      case "help":
      case "?":
        appendMessage(actorId, "system", helpText(session));
        return;

      case "players": {
        const list = activeSessions()
          .map(s => `${s.userId}:${getRpName(s.actorId)}`)
          .join(", ");
        appendMessage(actorId, "system",
          `Онлайн ${activeSessions().length}: ${list || "никого"}`);
        return;
      }

      case "id":
        appendMessage(actorId, "system",
          `ID=${session.userId}, profileId=${session.profileId ?? "?"}, actor=${actorHex(actorId)}`);
        return;

      case "stats": {
        const joins = getNumber(actorId,"gmJoinCount",0);
        const deaths = getNumber(actorId,"gmDeathCount",0);
        const secs = getNumber(actorId,"gmPlaytimeSeconds",0);
        appendMessage(actorId, "system",
          `Статистика: входов ${joins}, смертей ${deaths}, онлайн ${Math.floor(secs/60)} мин.`);
        return;
      }

      case "coords": {
        const loc = getLocation(actorId);
        if (!loc) appendMessage(actorId, "system", "Координаты сейчас недоступны.");
        else appendMessage(actorId, "system",
          `pos=[${loc.pos.map(x=>Math.round(x)).join(", ")}], cell=${loc.cell || "?"}`);
        return;
      }

      case "name":
        cmdName(session, args);
        return;

      case "me": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        sendProximity(actorId, config.chatRadius, "me", `* ${name} ${text}`);
        return;
      }

      case "do": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        sendProximity(actorId, config.chatRadius, "do", `* ${text} ((${name}))`);
        return;
      }

      case "try": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        const ok = Math.random() < 0.5;
        sendProximity(actorId, config.chatRadius, ok ? "try-ok" : "try-fail",
          `* ${name} ${text} — ${ok ? "УДАЧНО" : "НЕУДАЧНО"}`);
        return;
      }

      case "w":
      case "whisper": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        sendProximity(actorId, config.whisperRadius, "chat", `${name} шепчет: ${text}`);
        return;
      }

      case "s":
      case "shout": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        sendProximity(actorId, config.shoutRadius, "chat", `${name} кричит: ${text}`);
        return;
      }

      case "b": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        sendProximity(actorId, config.chatRadius, "ooc", `(( ${name}: ${text} ))`);
        return;
      }

      case "ooc": {
        const text = cleanText(args.join(" "));
        if (!text) return;
        sendGlobal("ooc", `(( GLOBAL | ${name}: ${text} ))`);
        return;
      }

      case "roll": {
        let max = Math.floor(Number(args[0] || 100));
        if (!Number.isFinite(max)) max = 100;
        max = Math.max(2, Math.min(max, 100000));
        const value = 1 + Math.floor(Math.random() * max);
        sendProximity(actorId, config.chatRadius, "do",
          `* ${name} бросает 1-${max}: ${value}`);
        return;
      }

      case "admin":
      case "adm": {
        if (!isAdmin(session)) {
          deny(session);
          return;
        }
        openAdminPanel(session);
        return;
      }

      case "staff":
      case "adminhelp": {
        const role = getStaffRole(session);
        if (!role) {
          appendMessage(actorId, "system", "Вы не staff.");
          return;
        }
        const perms = [...ROLE_PERMISSIONS[role]].join(", ");
        appendMessage(actorId, "admin",
          `[STAFF] role=${role} | permissions: ${perms}`);
        appendMessage(actorId, "admin",
          "Команды: /inspect ID | /tp ID | /bring ID | /back | /tpcoords X Y Z | " +
          "/heal [ID] | /resurrect [ID] | /racemenu [ID] | /kick ID причина" +
          (isSeniorStaff(session) ? " | /announce текст" : ""));
        return;
      }

      case "stafflist": {
        if (!isAdmin(session)) {
          deny(session);
          return;
        }
        const list = activeSessions()
          .filter(s => isAdmin(s))
          .map(s => `${s.userId}:${getRpName(s.actorId)}[${getStaffRole(s)}]`)
          .join(", ");
        appendMessage(actorId, "admin", `Staff online: ${list || "никого"}`);
        return;
      }

      case "inspect": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const target = targetUsage(session, args[0], "/inspect <ID|actorId>");
        if (!target) return;
        const loc = getLocation(target.actorId);
        const ip = typeof mp.getUserIp === "function"
          ? safe(`getUserIp(${target.userId})`, () => mp.getUserIp(target.userId), "?")
          : "?";
        const joins = getNumber(target.actorId, "gmJoinCount", 0);
        const deaths = getNumber(target.actorId, "gmDeathCount", 0);
        const secs = getNumber(target.actorId, "gmPlaytimeSeconds", 0);
        appendMessage(actorId, "admin",
          `[INSPECT] ID=${target.userId} profile=${target.profileId ?? "?"} ` +
          `actor=${actorHex(target.actorId)} name="${getRpName(target.actorId)}" ip=${ip} | ` +
          `pos=${loc ? "[" + loc.pos.map(x => Math.round(x)).join(",") + "]" : "?"} ` +
          `cell=${loc?.cell || "?"} | joins=${joins} deaths=${deaths} play=${Math.floor(secs/60)}m`);
        auditStaff(session, "inspect", target, {});
        return;
      }

      case "tp":
      case "goto": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const target = targetUsage(session, args[0], "/tp <ID|actorId>");
        if (!target) return;
        if (target.actorId === actorId) {
          appendMessage(actorId, "system", "Ты уже здесь.");
          return;
        }
        const loc = getLocationalData(target.actorId);
        if (!loc || !setLocationalData(actorId, loc, true)) {
          appendMessage(actorId, "system", "Телепорт не выполнен: locationalData недоступна.");
          return;
        }
        appendMessage(actorId, "admin",
          `TP -> ${target.userId}:${getRpName(target.actorId)}. /back для возврата.`);
        auditStaff(session, "teleport_to_player", target, {});
        return;
      }

      case "bring":
      case "tphere":
      case "gethere": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const target = targetUsage(session, args[0], "/bring <ID|actorId>");
        if (!target) return;
        if (target.actorId === actorId) {
          appendMessage(actorId, "system", "Нельзя принести самого себя.");
          return;
        }
        const loc = getLocationalData(actorId);
        if (!loc || !setLocationalData(target.actorId, loc, true)) {
          appendMessage(actorId, "system", "Bring не выполнен: locationalData недоступна.");
          return;
        }
        appendMessage(actorId, "admin",
          `BRING <- ${target.userId}:${getRpName(target.actorId)}`);
        appendMessage(target.actorId, "admin", "Staff телепортировал вас к себе.");
        auditStaff(session, "bring_player", target, {});
        return;
      }

      case "back": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const old = backLocations.get(actorId);
        if (!old) {
          appendMessage(actorId, "system", "Нет сохранённой предыдущей позиции.");
          return;
        }
        const current = getLocationalData(actorId);
        if (!setLocationalData(actorId, old, false)) {
          appendMessage(actorId, "system", "Не удалось вернуться.");
          return;
        }
        if (current) backLocations.set(actorId, cloneJson(current));
        appendMessage(actorId, "admin", "Возврат выполнен. /back можно использовать ещё раз.");
        auditStaff(session, "teleport_back", null, {});
        return;
      }

      case "tpcoords":
      case "setpos": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const xyz = args.slice(0, 3).map(Number);
        if (xyz.length < 3 || xyz.some(v => !Number.isFinite(v))) {
          appendMessage(actorId, "system", "Использование: /tpcoords <X> <Y> <Z>");
          return;
        }
        const current = getLocationalData(actorId);
        if (!current) {
          appendMessage(actorId, "system", "Текущая locationalData недоступна.");
          return;
        }
        const next = cloneJson(current);
        next.pos = xyz;
        if (!setLocationalData(actorId, next, true)) {
          appendMessage(actorId, "system", "Телепорт по координатам не выполнен.");
          return;
        }
        appendMessage(actorId, "admin",
          `TP coords -> [${xyz.map(v => Math.round(v)).join(", ")}]. /back для возврата.`);
        auditStaff(session, "teleport_coords", null, { pos: xyz });
        return;
      }

      case "heal": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const target = args[0]
          ? targetUsage(session, args[0], "/heal [ID|actorId]")
          : session;
        if (!target) return;

        const ok1 = papyrusActorMethod(target.actorId, "RestoreActorValue", ["Health", 100000]);
        const ok2 = papyrusActorMethod(target.actorId, "RestoreActorValue", ["Magicka", 100000]);
        const ok3 = papyrusActorMethod(target.actorId, "RestoreActorValue", ["Stamina", 100000]);
        if (!(ok1 || ok2 || ok3)) {
          appendMessage(actorId, "system", "Heal недоступен: Papyrus bridge не ответил.");
          return;
        }
        appendMessage(actorId, "admin",
          `HEAL: ${target.userId}:${getRpName(target.actorId)}`);
        if (target.actorId !== actorId) appendMessage(target.actorId, "admin", "Staff восстановил ваши показатели.");
        auditStaff(session, "heal", target, {});
        return;
      }

      case "resurrect":
      case "revive": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const target = args[0]
          ? targetUsage(session, args[0], "/resurrect [ID|actorId]")
          : session;
        if (!target) return;

        const ok = papyrusActorMethod(target.actorId, "Resurrect", []);
        if (!ok) {
          appendMessage(actorId, "system", "Resurrect недоступен: Papyrus bridge не ответил.");
          return;
        }
        appendMessage(actorId, "admin",
          `RESURRECT: ${target.userId}:${getRpName(target.actorId)}`);
        auditStaff(session, "resurrect", target, {});
        return;
      }

      case "racemenu": {
        if (!hasPermission(session, "teleport")) {
          deny(session, "teleport");
          return;
        }
        const target = args[0]
          ? targetUsage(session, args[0], "/racemenu [ID|actorId]")
          : session;
        if (!target) return;

        if (typeof mp.setRaceMenuOpen !== "function") {
          appendMessage(actorId, "system", "Эта сборка сервера не экспортирует setRaceMenuOpen.");
          return;
        }
        const ok = safe(
          `setRaceMenuOpen ${target.userId}`,
          () => { mp.setRaceMenuOpen(target.actorId, true); return true; },
          false
        );
        if (!ok) {
          appendMessage(actorId, "system", "Не удалось открыть RaceMenu.");
          return;
        }
        appendMessage(actorId, "admin",
          `RACEMENU: ${target.userId}:${getRpName(target.actorId)}`);
        auditStaff(session, "racemenu", target, {});
        return;
      }

      case "announce": {
        if (!isSeniorStaff(session)) {
          deny(session, "admin+");
          return;
        }
        const text = cleanText(args.join(" "), 220);
        if (text) {
          sendGlobal("admin", `[ADMIN] ${text}`);
          auditStaff(session, "announce", null, { text });
        }
        return;
      }

      case "kick": {
        if (!hasPermission(session, "kick")) {
          deny(session, "kick");
          return;
        }
        const target = targetUsage(session, args[0], "/kick <ID|actorId> [причина]");
        if (!target) return;
        if (target.actorId === actorId) {
          appendMessage(actorId, "system", "Самого себя кикать не надо.");
          return;
        }
        const reason = cleanText(args.slice(1).join(" "), 120) || "без причины";
        appendMessage(target.actorId, "admin", `Вы отключены staff: ${reason}`);
        appendMessage(actorId, "system",
          `Kick: ${target.userId}:${getRpName(target.actorId)} — ${reason}`);
        auditStaff(session, "kick", target, { reason });
        trackTimeout(() => {
          if (safe(`isConnected(${target.userId})`,
            () => mp.isConnected(target.userId), false)) {
            safe(`kick(${target.userId})`, () => mp.kick(target.userId), null);
          }
        }, 650);
        return;
      }

      default:
        appendMessage(actorId, "system", `Неизвестная команда /${command}. Используй /help`);
    }
  }

  function handleChat(session, rawText) {
    const raw = cleanText(rawText);
    if (!raw) return;

    if (!spamAllowed(session.actorId)) {
      appendMessage(session.actorId, "system", "Слишком быстро. Подожди несколько секунд.");
      return;
    }

    if (raw.startsWith("/")) {
      handleCommand(session, raw);
      return;
    }

    const name = getRpName(session.actorId);
    sendProximity(session.actorId, config.chatRadius, "chat", `${name}: ${raw}`);
  }

  mp._coreRpUi = (pcFormId, event) => {
    try {
      const session = byActor(pcFormId);
      if (!session || !event || typeof event !== "object") return;
      if (event.type === "ready") {
        pushUiState(pcFormId);
        return;
      }
      if (event.type === "chat") {
        handleChat(session, event.text);
        return;
      }
      if (event.type === "adminClose") {
        closeAdminPanel(session);
        return;
      }
      if (event.type === "adminAction") {
        handleAdminUiAction(session, event.payload);
        return;
      }
    } catch (err) {
      console.error("[CoreGM] _coreRpUi:", err.message);
    }
  };

  function initPersistent(actorId) {
    const now = Date.now();
    if (!getNumber(actorId, "gmFirstSeen", 0)) setProp(actorId, "gmFirstSeen", now);
    setProp(actorId, "gmLastSeen", now);
    const joins = increment(actorId, "gmJoinCount", 1);
    if (getProp(actorId,"gmDeathCount",undefined) === undefined) setProp(actorId,"gmDeathCount",0);
    if (getProp(actorId,"gmPlaytimeSeconds",undefined) === undefined) setProp(actorId,"gmPlaytimeSeconds",0);
    return joins;
  }

  function actorReady(session, actorId) {
    if (session.ready) return;
    if (!bindSessionIdentity(session, actorId)) return;
    session.ready = true;
    session.actorName = getRpName(actorId);
    session.lastPlaytimeFlushAt = Date.now();

    uiHistory.set(actorId, []);
    const joins = initPersistent(actorId);

    console.log(
      `[CoreGM] PLAYER READY user=${session.userId} profile=${session.profileId} ` +
      `actor=${actorHex(actorId)} name="${session.actorName}" staff=${getStaffRole(session) || "none"} joins=${joins}`
    );

    appendMessage(actorId, "system",
      `[${config.serverName}] ${config.chatOpenKeyLabel} — открыть чат. /help — команды.`);

    trackTimeout(() => notify(actorId,
      `[${config.serverName}] Добро пожаловать, ${getRpName(actorId)}!`),
      Number(config.welcomeDelayMs) || 1200);

    if (config.announceJoins) {
      sendGlobal("system", `[+] ${getRpName(actorId)} подключился`, actorId);
    }
    for (const s of activeSessions()) pushUiState(s.actorId);
    refreshOpenAdminPanels();
    refreshVoiceRoutes(true);
  }

  function flushPlaytime(session, now = Date.now()) {
    if (!session.ready || !session.actorId) return;
    const prev = session.lastPlaytimeFlushAt || now;
    const sec = Math.floor((now - prev) / 1000);
    if (sec <= 0) return;
    setProp(session.actorId, "gmPlaytimeSeconds",
      getNumber(session.actorId, "gmPlaytimeSeconds", 0) + sec);
    setProp(session.actorId, "gmLastSeen", now);
    session.lastPlaytimeFlushAt = prev + sec * 1000;
  }

  function disconnect(userId, session) {
    if (session.ready) {
      flushPlaytime(session);
      const name = getRpName(session.actorId);
      console.log(
        `[CoreGM] PLAYER LEFT user=${userId} profile=${session.profileId} ` +
        `actor=${actorHex(session.actorId)} name="${name}"`
      );
      sessions.delete(userId);
      unbindSessionIdentity(session);
      spamBuckets.delete(session.actorId);
      uiHistory.delete(session.actorId);
      backLocations.delete(session.actorId);
      if (config.announceLeaves) sendGlobal("system", `[-] ${name} отключился`);
      adminUiOpen.delete(session.actorId);
      voiceRoutes.delete(session.actorId);
      for (const s of activeSessions()) pushUiState(s.actorId);
      refreshOpenAdminPanels();
      refreshVoiceRoutes(true);
    } else {
      sessions.delete(userId);
      unbindSessionIdentity(session);
      console.log(`[CoreGM] USER LEFT before actor ready user=${userId}`);
    }
  }

  function pollConnections() {
    for (let userId = 1; userId <= config.maxUserId; userId++) {
      const connected = safe(`isConnected(${userId})`,
        () => mp.isConnected(userId), false);
      let s = sessions.get(userId);

      if (connected) {
        if (!s) {
          s = {
            userId, connectedAt: Date.now(), actorId: null, profileId: null,
            ready: false, lastPlaytimeFlushAt: null
          };
          sessions.set(userId, s);
          const ip = typeof mp.getUserIp === "function"
            ? safe(`getUserIp(${userId})`, () => mp.getUserIp(userId), "?")
            : "?";
          console.log(`[CoreGM] CONNECTION user=${userId} ip=${ip}`);
        }
        if (!s.ready) {
          const actorId = safe(`getUserActor(${userId})`,
            () => mp.getUserActor(userId), undefined);
          if (actorId) actorReady(s, actorId);
        }
      } else if (s) {
        disconnect(userId, s);
      }
    }
  }

  function flushAll() {
    const now = Date.now();
    for (const s of activeSessions()) flushPlaytime(s, now);
  }

  // SkyMP calls this in online/master-auth mode. Offline mode bypasses it, so
  // gameplay identity is always read from the actor's built-in profileId binding.
  mp.onLoginAttempt = profileId => {
    console.log(`[CoreGM] LOGIN ATTEMPT profileId=${profileId}`);
    return true;
  };

  mp.onDeath = (actorId, killerId) => {
    const s = byActor(actorId);
    if (!s) return;
    const deaths = increment(actorId, "gmDeathCount", 1);
    appendMessage(actorId, "death", `Вы погибли. Смертей: ${deaths}`);
    let killerText = "";
    const killer = killerId ? byActor(killerId) : null;
    if (killer) killerText = ` от рук ${getRpName(killerId)}`;
    if (config.announceDeaths) {
      sendGlobal("death", `[x] ${getRpName(actorId)} погиб${killerText}`, actorId);
    }
    console.log(
      `[CoreGM] DEATH actor=${actorHex(actorId)} killer=${actorHex(killerId)} deaths=${deaths}`
    );
  };

  mp.onRespawn = actorId => {
    const s = byActor(actorId);
    if (!s) return;
    appendMessage(actorId, "system", "Вы снова в мире.");
    console.log(`[CoreGM] RESPAWN actor=${actorHex(actorId)}`);
  };

  mp.onActivate = (targetId, casterId) => {
    if (!config.debugActivations) return;
    const s = byActor(casterId);
    if (s) console.log(
      `[CoreGM] ACTIVATE by=${getRpName(casterId)}/${actorHex(casterId)} target=${actorHex(targetId)}`
    );
  };

  pollConnections();
  trackInterval(pollConnections, config.connectionPollMs);
  trackInterval(flushAll, config.playtimeFlushMs);
  trackInterval(refreshOpenAdminPanels, config.adminPanelRefreshMs);
  if (config.voiceEnabled) trackInterval(refreshVoiceRoutes, config.voicePollMs);

  globalThis.__SKYMP_CORE_GM_CLEANUP__ = () => {
    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    timers.clear();
    spamBuckets.clear();
    adminUiOpen.clear();
    voiceRoutes.clear();
    sessionsByActor.clear();
    sessionsByProfile.clear();
    console.log("[CoreGM] old timers stopped for hot reload");
  };

  console.log("============================================================");
  console.log(`[CoreGM] SkyMP Core Gamemode v${VERSION} loaded`);
  console.log(`[CoreGM] Server: ${config.serverName}`);
  console.log(`[CoreGM] Chat: ${config.chatOpenKeyLabel}, radius=${config.chatRadius}`);
  console.log(`[CoreGM] Staff profiles: ${JSON.stringify(config.staffProfiles)}`);
  console.log(`[CoreGM] Admin UI: /admin · SkyUI style · refresh ${config.adminPanelRefreshMs}ms`);
  console.log(`[CoreGM] UI: ${UI_PATH}`);
  console.log(`[CoreGM] Voice: ${config.voiceEnabled ? `ON · ${config.voiceEnterRadius}/${config.voiceLeaveRadius} units · ${config.voicePollMs}ms` : "OFF"}`);
  console.log(`[CoreGM] Admin audit: ${ADMIN_AUDIT_PATH}`);
  console.log("============================================================");
}
