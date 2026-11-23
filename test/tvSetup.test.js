import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import QRCode from 'qrcode-svg';
import { pruneSetup, setupOf, trackSetup } from '../src/homekit/tvSetup.js';
import { tmpDir } from './support.js';

test('TV tile code: kept for the settings page once Homebridge has published the TV, and follows pairing', async () => {
  const file = path.join(tmpDir(), 'tv-setup.json');
  const hap = Object.assign(new EventEmitter(), { setupURI: () => 'X-HM://00KZ2ABCDWXYZ' });
  const accessory = { _associatedHAPAccessory: hap };
  assert.equal(setupOf(accessory), null); // not published yet
  const timers = new Set();
  trackSetup({ accessory, deviceId: 'tv-1', name: 'Bed TV', file, timers, log: { debug() {} }, everyMs: 20 });
  assert.equal(fs.existsSync(file), false);
  let paired = false;
  hap._accessoryInfo = { pincode: '123-45-678', paired: () => paired };
  await new Promise((r) => { setTimeout(r, 80); });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'tv-1': { name: 'Bed TV', pin: '123-45-678', uri: 'X-HM://00KZ2ABCDWXYZ', paired: false } });
  paired = true; hap.emit('paired');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))['tv-1'].paired, true);
  // The address becomes a picture the Home app can scan.
  assert.match(new QRCode({ content: 'X-HM://00KZ2ABCDWXYZ', container: 'svg-viewbox', join: true }).svg(), /^<\?xml|^<svg/);
  pruneSetup(file, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {});
  for (const timer of timers) { clearTimeout(timer); }
});

test('TV tile port: the tile keeps one Apple Home port across restarts, moves when it is taken, and a port chosen by Homebridge wins', async () => {
  const { freePort, keepPort } = await import('../src/homekit/tvPort.js');
  const net = await import('node:net');
  const file = path.join(tmpDir(), 'tv-facts.json');
  fs.writeFileSync(file, JSON.stringify({ 'tv-1': { reportsPower: true } }));
  const start = async (given) => {
    const used = [];
    const accessory = { displayName: 'Bed TV', _associatedHAPAccessory: { publish: async (info) => { used.push(info.port); } } };
    assert.equal(keepPort({ accessory, deviceId: 'tv-1', file }), true);
    await accessory._associatedHAPAccessory.publish({ username: 'AA', ...(given ? { port: given } : {}) }, false);
    return used[0];
  };
  const first = await start();
  assert.ok(first > 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { 'tv-1': { reportsPower: true, homePort: first } }, 'other facts stay');
  assert.equal(await start(), first, 'the same port after a restart');
  assert.equal(await start(51999), 51999, 'a port range set in Homebridge wins');

  const squatter = net.createServer();
  await new Promise((r) => squatter.listen(first, r));
  const moved = await start();
  squatter.close();
  assert.notEqual(moved, first);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))['tv-1'].homePort, moved);
  assert.ok(await freePort(0) > 0);

  // Three TVs start in the same moment: each one's port is kept, none overwrites another's.
  const shared = path.join(tmpDir(), 'tv-facts.json');
  await Promise.all(['a', 'b', 'c'].map((id) => {
    const accessory = { displayName: id, _associatedHAPAccessory: { publish: async () => {} } };
    keepPort({ accessory, deviceId: id, file: shared });
    return accessory._associatedHAPAccessory.publish({}, false);
  }));
  const kept = JSON.parse(fs.readFileSync(shared, 'utf8'));
  assert.deepEqual(Object.keys(kept).sort(), ['a', 'b', 'c']);
  assert.equal(new Set(Object.values(kept).map((v) => v.homePort)).size, 3);
});
