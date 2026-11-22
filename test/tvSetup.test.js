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
