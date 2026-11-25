import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rememberedName, rememberNames } from '../src/names.js';
import { pluginPaths, readJson, wipePluginData } from '../src/storage.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sl-names-'));

test('names: the last name given is kept after the appliance is removed, and found by ID or MAC', () => {
  const dir = tmp();
  const file = pluginPaths(dir).names;
  rememberNames(file, [{ id: 'ac-1', mac: 'AA:BB:CC:00:11:22', name: 'Living Room AC' }, { id: 'tv-9', type: 'tv', name: 'Bedroom TV' }]);
  rememberNames(file, [{ id: 'tv-9', type: 'tv', name: 'Bedroom TV' }]); // ac-1 removed from the settings
  const saved = readJson(file);
  assert.equal(rememberedName(saved, { id: 'ac-1' }), 'Living Room AC', 'still known after removal');
  assert.equal(rememberedName(saved, { mac: 'aa-bb-cc-00-11-22' }), 'Living Room AC', 'matched by MAC too');
  rememberNames(file, [{ id: 'ac-1', name: 'Majlis AC' }]); // added again and renamed
  assert.equal(rememberedName(readJson(file), { id: 'ac-1' }), 'Majlis AC', 'the latest name wins');
  assert.equal(readJson(file)['ac-1'].mac, 'aa:bb:cc:00:11:22', 'what was known is kept');
  assert.equal(rememberedName(readJson(file), { id: 'unknown' }), null);
});

test('names: entries without a name or ID are skipped, and deleting the plugin data removes them', () => {
  const dir = tmp();
  const file = pluginPaths(dir).names;
  rememberNames(file, [{ id: 'x', name: '  ' }, { name: 'No ID' }]);
  assert.equal(readJson(file), null, 'nothing to keep, no file');
  rememberNames(file, [{ id: 'x', name: 'Washer' }]);
  wipePluginData(dir, { keepRuntime: true });
  assert.equal(fs.existsSync(file), false, 'removed with the plugin data, even when the runtime is kept');
});

test('names: a suggested name left as it was is not remembered; the name typed later is', () => {
  const dir = tmp();
  const file = pluginPaths(dir).names;
  rememberNames(file, [{ id: 'ac-5', name: 'Air conditioner 1', nameSuggested: true }]);
  assert.equal(rememberedName(readJson(file) ?? {}, { id: 'ac-5' }), null, 'only a suggestion');
  rememberNames(file, [{ id: 'ac-5', name: 'Guest Room AC' }]);
  assert.equal(rememberedName(readJson(file), { id: 'ac-5' }), 'Guest Room AC');
  rememberNames(file, [{ id: 'ac-5', name: 'Air conditioner 1', nameSuggested: true }]);
  assert.equal(rememberedName(readJson(file), { id: 'ac-5' }), 'Guest Room AC', 'a later suggestion does not replace a name given');
});
