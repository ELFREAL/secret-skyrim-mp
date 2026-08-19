'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateGameDir, parseTasklistCsv } = require('../src/game-runtime');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sss-launcher-'));
fs.mkdirSync(path.join(temp, 'Data', 'Platform', 'Plugins'), { recursive: true });
fs.writeFileSync(path.join(temp, 'SkyrimSE.exe'), 'test');
fs.writeFileSync(path.join(temp, 'skse64_loader.exe'), 'test');
fs.writeFileSync(path.join(temp, 'Data', 'Platform', 'Plugins', 'skymp5-client.js'), 'test');
fs.writeFileSync(path.join(temp, 'Data', 'Platform', 'Plugins', 'secret-skyrim-voice.js'), 'test');

const ok = validateGameDir(temp);
assert.equal(ok.valid, true);
assert.equal(ok.checks.length, 4);

fs.unlinkSync(path.join(temp, 'skse64_loader.exe'));
const bad = validateGameDir(temp);
assert.equal(bad.valid, false);
assert.equal(bad.checks.find((x) => x.key === 'skse').exists, false);

const parsed = parseTasklistCsv('"SkyrimSE.exe","1234","Console","1","1,234 K"\r\n');
assert.deepEqual(parsed, [{ imageName: 'SkyrimSE.exe', pid: 1234 }]);
assert.deepEqual(parseTasklistCsv('INFO: No tasks are running which match the specified criteria.'), []);

fs.rmSync(temp, { recursive: true, force: true });
console.log('runtime tests: OK');
