'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getDistributionRoot,
  getVoicePaths,
  validateVoiceRuntime,
  ensureMumbleConfig,
  buildMumbleUrl,
  pluginHashCandidates
} = require('../src/voice-runtime');

const portableDir = path.join(os.tmpdir(), 'portable-launcher-root');
assert.equal(getDistributionRoot({ isPackaged: true, execPath: '/tmp/extracted/app', appPath: 'x', portableExecutableDir: portableDir }), path.resolve(portableDir));

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sss-voice-'));
const paths = getVoicePaths(temp);
fs.mkdirSync(path.dirname(paths.plugin), { recursive: true });
fs.writeFileSync(paths.mumbleExe, 'test');
fs.writeFileSync(paths.plugin, 'test');
assert.equal(validateVoiceRuntime(paths).valid, true);
const conn = {
  username: 'sk_17', host: '127.0.0.1', port: 64738, channel: 'Skyrim',
  voice: { minimumDistanceMeters: 2, maximumDistanceMeters: 15, minimumVolume: 0, bloom: 0.5 }
};
ensureMumbleConfig(paths, conn);
assert.equal(fs.existsSync(paths.database), true);
const cfg = JSON.parse(fs.readFileSync(paths.config, 'utf8'));
assert.equal(cfg.settings_version, 1);
assert.equal(cfg.audio.transmit_mode, 'PTT');
assert.equal(cfg.positional_audio.enable_positional_audio, true);
assert.equal(cfg.positional_audio.maximum_distance, 15);
assert.ok(Object.keys(cfg.plugins).length >= 1);
assert.ok(pluginHashCandidates(paths.plugin).length >= 1);
assert.ok(buildMumbleUrl(conn).startsWith('mumble://sk_17@127.0.0.1:64738/Skyrim'));
fs.rmSync(temp, { recursive: true, force: true });
console.log('voice-runtime tests: OK');
