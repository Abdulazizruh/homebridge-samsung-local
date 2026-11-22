import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { SamsungLocalPlatform } from '../src/platform.js';
import { HelperClient } from '../src/runtime/helperClient.js';
import { PLATFORM_NAME, PLUGIN_NAME, STORAGE_DIR_NAME, UUID_NAMESPACE } from '../src/settings.js';
import { listSnapshots, pluginPaths, wipePluginData } from '../src/storage.js';
import { fixture, fixturePath, here, makeApi, pidAlive, quietLog, tmpDir, waitFor } from './support.js';

const V = 'x.com.samsung.da.';
const DI = fixture('ac_windfree').identity.di;

function helperFactory(devices, extraEnv = {}) {
  return () => new HelperClient({
    command: process.execPath,
    args: [path.join(here, 'fakeHelper.js')],
    env: { FAKE_DEVICES: JSON.stringify(devices), FAKE_POLL_MS: '60', ...extraEnv },
    restartDelaysMs: [100],
    log: quietLog,
  });
}

async function boot({ storage = tmpDir(), devices, config, cached = [] }) {
  const api = makeApi(storage);
  const platform = new SamsungLocalPlatform(quietLog, { platform: PLATFORM_NAME, ...config }, api,
    { createHelper: helperFactory(devices) });
  cached.forEach((a) => platform.configureAccessory(a));
  await platform.start();
  return { api, platform, storage };
}

const ac = (host, extra = {}) => ({ host, fixture: fixturePath('ac_windfree'), ...extra });
const online = (platform, id = DI) => waitFor(() => platform.devices.get(id)?.link.online && platform.devices.get(id).link.resources);

test('discovery to accessory: one accessory, named as typed, own namespace', async (t) => {
  const { api, platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', name: 'Majlis AC' }] } });
  t.after(() => platform.stop());
  await waitFor(() => api.registered.length === 1);
  const { accessory, plugin, platform: platformName } = api.registered[0];
  assert.equal(accessory.displayName, 'Majlis AC');
  assert.deepEqual([plugin, platformName], [PLUGIN_NAME, PLATFORM_NAME]);
  assert.equal(accessory.UUID, api.hap.uuid.generate(UUID_NAMESPACE + DI));
  assert.equal(accessory.context.deviceId, DI);
  await online(platform);
});

test('independence: names, ids and storage never overlap the existing plugin', () => {
  assert.notEqual(PLUGIN_NAME, 'homebridge-smartthings-oauth');
  assert.ok(!['HomeBridgeSmartThings', 'SmartThings', 'smartthings'].includes(PLATFORM_NAME));
  const api = makeApi();
  // The old plugin seeds UUIDs with the bare SmartThings device id.
  assert.notEqual(api.hap.uuid.generate(UUID_NAMESPACE + DI), api.hap.uuid.generate(DI));
  const paths = pluginPaths('/homebridge');
  for (const p of Object.values(paths)) {
    assert.ok(p.startsWith(`/homebridge/${STORAGE_DIR_NAME}`), p);
  }
});

test('commands reach the appliance and its new state comes back', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI }] } });
  t.after(() => platform.stop());
  // id is configured but nothing is cached yet: the accessory appears on first contact.
  await online(platform);
  const { handler, link } = platform.devices.get(DI);
  const C = platform.api.hap.Characteristic;
  await handler.services.get('fanTurbo').getCharacteristic(C.On).handleSetRequest(true);
  await waitFor(() => link.resources['/wind/strength/vs/0'][`${V}modes`] === '4');
  assert.equal(handler.model.state.fan, 'turbo');
});

test('external change and refusal through the real helper protocol', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const { handler } = platform.devices.get(DI);
  const C = platform.api.hap.Characteristic;
  await platform.helper.request('sim', { key: DI, action: 'remote', path: ['mode', 'convenient', 'vs', '0'], body: { [`${V}modes`]: 'Quiet' } });
  await waitFor(() => handler.services.get('quiet').getCharacteristic(C.On).value === true);
  await platform.helper.request('sim', { key: DI, action: 'refuse', value: true });
  await assert.rejects(() => handler.services.get('windFree').getCharacteristic(C.On).handleSetRequest(true));
  assert.equal(handler.services.get('quiet').getCharacteristic(C.On).value, true);
});

test('a late acknowledgement does not hold Apple Home: quick reply, value kept, write still lands', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const { handler, link } = platform.devices.get(DI);
  const C = platform.api.hap.Characteristic;
  await platform.helper.request('sim', { key: DI, action: 'delay', value: 2200 });
  const started = Date.now();
  await handler.services.get('fanTurbo').getCharacteristic(C.On).handleSetRequest(true);
  assert.ok(Date.now() - started < 1900, 'HomeKit is answered before the appliance acknowledges');
  assert.equal(handler.services.get('fanTurbo').getCharacteristic(C.On).value, true);
  await waitFor(() => link.resources['/wind/strength/vs/0'][`${V}modes`] === '4', 6000);
});

test('a late refusal puts the tile back to the real state', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const { handler } = platform.devices.get(DI);
  const C = platform.api.hap.Characteristic;
  const windFree = handler.services.get('windFree').getCharacteristic(C.On);
  const before = windFree.value;
  await platform.helper.request('sim', { key: DI, action: 'delay', value: 1800 });
  await platform.helper.request('sim', { key: DI, action: 'refuse', value: true });
  await windFree.handleSetRequest(!before);
  await new Promise((r) => { setTimeout(r, 1200); });
  await waitFor(() => windFree.value === before, 4000);
});

test('connection loss and recovery: accessory stays, state resumes', async (t) => {
  const { api, platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const { link } = platform.devices.get(DI);
  await platform.helper.request('sim', { key: DI, action: 'offline' });
  await waitFor(() => link.online === false);
  assert.equal(api.unregistered.length, 0);
  assert.equal(listSnapshots(platform.paths)[0].online, false);
  await platform.helper.request('sim', { key: DI, action: 'online' });
  await waitFor(() => link.online === true);
});

test('helper crash: restarted automatically and devices are reopened', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const { link } = platform.devices.get(DI);
  const firstPid = platform.helper.child.pid;
  process.kill(firstPid, 'SIGKILL');
  await waitFor(() => link.online === false);
  await waitFor(() => link.online === true && platform.helper.child && platform.helper.child.pid !== firstPid);
});

test('restart while the appliance is offline: restored from cache, not removed', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Bedroom' }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  await first.platform.stop();

  const second = await boot({ storage, devices: [ac('10.0.0.5', { reachable: false })],
    config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Bedroom' }] }, cached: [cachedAccessory] });
  t.after(() => second.platform.stop());
  const device = second.platform.devices.get(DI);
  assert.ok(device, 'accessory restored without contacting the appliance');
  assert.equal(second.api.registered.length, 0, 'no duplicate registration');
  assert.equal(second.api.unregistered.length, 0, 'not removed while unreachable');
  assert.ok(device.handler.services.has('windFree'), 'services rebuilt from the cached reading');
  const C = second.api.hap.Characteristic;
  await assert.rejects(() => device.handler.services.get('thermostat').getCharacteristic(C.CurrentTemperature).handleGetRequest());
  // When it comes back it simply resumes.
  await second.platform.helper.request('sim', { host: '10.0.0.5', action: 'online' });
  await waitFor(() => device.link.online === true);
});

test('IP change: same appliance on a new address keeps one accessory', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  await first.platform.stop();

  const second = await boot({ storage, devices: [ac('10.0.0.99')], config: { devices: [{ host: '10.0.0.99', id: DI }] }, cached: [cachedAccessory] });
  t.after(() => second.platform.stop());
  await online(second.platform);
  assert.equal(second.api.registered.length, 0);
  assert.equal(second.platform.devices.size, 1);
  assert.equal(second.platform.devices.get(DI).accessory.UUID, cachedAccessory.UUID);
});

test('wrong appliance at a known address is refused, not adopted', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  await first.platform.stop();
  const other = { host: '10.0.0.5', fixture: fixturePath('ac_standard') }; // a different di now holds the address
  const second = await boot({ storage, devices: [other], config: { devices: [{ host: '10.0.0.5', id: DI }] }, cached: [cachedAccessory] });
  t.after(() => second.platform.stop());
  const { link } = second.platform.devices.get(DI);
  await waitFor(() => link.lastError?.code === 'identity_mismatch');
  assert.equal(link.online, false);
  assert.equal(second.platform.devices.size, 1);
});

test('two addresses for one appliance do not create a duplicate', async (t) => {
  const devices = [ac('10.0.0.5'), ac('10.0.0.6')];
  const { api, platform } = await boot({ devices, config: { devices: [{ host: '10.0.0.5' }, { host: '10.0.0.6' }] } });
  t.after(() => platform.stop());
  await online(platform);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(api.registered.length, 1);
});

test('removing an appliance from the settings removes only that accessory', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  await first.platform.stop();
  const second = await boot({ storage, devices: [], config: { devices: [] }, cached: [cachedAccessory] });
  t.after(() => second.platform.stop());
  assert.deepEqual(second.api.unregistered.map((a) => a.UUID), [cachedAccessory.UUID]);
});

test('shutdown: the helper process is gone, nothing keeps running', async () => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  await online(platform);
  const pid = platform.helper.child.pid;
  assert.ok(pidAlive(pid));
  await platform.stop();
  await waitFor(() => !pidAlive(pid), 3000);
  assert.equal(platform.helper, null);
});

test('non air-conditioner: listed for diagnostics, no accessory invented', async (t) => {
  const tvFixture = path.join(tmpDir(), 'tv.json');
  fs.writeFileSync(tvFixture, JSON.stringify({ identity: { di: 'tv-1', types: ['oic.d.tv'] }, resources: { '/sec/tv/deviceinfo': {} } }));
  const { api, platform } = await boot({ devices: [{ host: '10.0.0.7', fixture: tvFixture }], config: { devices: [{ host: '10.0.0.7' }] } });
  t.after(() => platform.stop());
  await waitFor(() => listSnapshots(platform.paths).length === 1);
  assert.equal(api.registered.length, 0);
});

test('wipe and reinstall: only this plugin\'s folder is touched', async () => {
  const storage = tmpDir();
  // Files that belong to Homebridge and to the existing plugin.
  fs.mkdirSync(path.join(storage, 'accessories'), { recursive: true });
  fs.mkdirSync(path.join(storage, 'persist'), { recursive: true });
  const foreign = {
    'config.json': '{"platforms":[{"platform":"HomeBridgeSmartThings"}]}',
    'accessories/cachedAccessories': '[{"plugin":"homebridge-smartthings-oauth","displayName":"Majlis AC"}]',
    'persist/AccessoryInfo.0E1234.json': '{}',
    'smartthings-oauth-tokens.json': '{"token":"keep-me"}',
  };
  for (const [name, text] of Object.entries(foreign)) {
    fs.writeFileSync(path.join(storage, name), text);
  }
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  await online(first.platform);
  await first.platform.stop();
  assert.ok(fs.existsSync(path.join(storage, STORAGE_DIR_NAME, 'state')));

  assert.deepEqual(wipePluginData(storage), [STORAGE_DIR_NAME]);
  assert.ok(!fs.existsSync(path.join(storage, STORAGE_DIR_NAME)));
  for (const [name, text] of Object.entries(foreign)) {
    assert.equal(fs.readFileSync(path.join(storage, name), 'utf8'), text, name);
  }
  assert.deepEqual(wipePluginData(storage), [], 'wiping twice is harmless');

  // "Reinstall": a fresh start on the wiped storage works again.
  const again = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  await online(again.platform);
  await again.platform.stop();
});

test('renaming in the settings renames the existing accessory, without a duplicate', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Layla AC Local' }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  await first.platform.stop();
  const second = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Layla AC' }] }, cached: [cachedAccessory] });
  t.after(() => second.platform.stop());
  await online(second.platform);
  assert.equal(second.api.registered.length, 0);
  assert.equal(cachedAccessory.displayName, 'Layla AC');
  const C = second.api.hap.Characteristic;
  assert.equal(second.platform.devices.get(DI).handler.services.get('thermostat').getCharacteristic(C.ConfiguredName).value, 'Layla AC');
});

test('a name given in the Home app survives restarts and settings changes', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Layla AC Local' }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  const C = first.api.hap.Characteristic;
  // What the Home app does when the user renames the tile.
  first.platform.devices.get(DI).handler.services.get('thermostat').getCharacteristic(C.ConfiguredName).updateValue('غرفة ليلى');
  await first.platform.stop();
  for (const name of ['Layla AC Local', 'Layla AC', 'Something else']) {
    const next = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name }] }, cached: [cachedAccessory] });
    await online(next.platform);
    assert.equal(next.platform.devices.get(DI).handler.services.get('thermostat').getCharacteristic(C.ConfiguredName).value, 'غرفة ليلى', name);
    await next.platform.stop();
  }
});

test('every part is named after its appliance; tiles from earlier versions follow unless renamed in the Home app', async (t) => {
  const storage = tmpDir();
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Layla AC' }] } });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  const C = first.api.hap.Characteristic;
  const name = (platform, key) => platform.devices.get(DI).handler.services.get(key).getCharacteristic(C.ConfiguredName).value;
  assert.equal(name(first.platform, 'thermostat'), 'Layla AC');
  assert.equal(name(first.platform, 'fan'), 'Layla AC Fan');
  assert.equal(name(first.platform, 'fast'), 'Layla AC Fast');
  assert.equal(name(first.platform, 'humidity'), 'Layla AC Humidity');
  assert.equal(name(first.platform, 'light'), 'Layla AC Light Display');
  // Rewind to what an earlier version left behind: bare names, no record.
  const services = first.platform.devices.get(DI).handler.services;
  services.get('fan').getCharacteristic(C.ConfiguredName).updateValue('Fan');
  services.get('light').getCharacteristic(C.ConfiguredName).updateValue('Display Light');
  services.get('fast').getCharacteristic(C.ConfiguredName).updateValue('تبريد سريع'); // typed in the Home app
  delete cachedAccessory.context.appliedNames;
  await first.platform.stop();

  const second = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Layla AC' }] }, cached: [cachedAccessory] });
  await online(second.platform);
  assert.equal(name(second.platform, 'fan'), 'Layla AC Fan');
  assert.equal(name(second.platform, 'light'), 'Layla AC Light Display');
  assert.equal(name(second.platform, 'fast'), 'تبريد سريع');
  await second.platform.stop();

  // Renaming the appliance in the settings carries the untouched parts along.
  const third = await boot({ storage, devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5', id: DI, name: 'Guest AC' }] }, cached: [cachedAccessory] });
  t.after(() => third.platform.stop());
  await online(third.platform);
  assert.equal(name(third.platform, 'thermostat'), 'Guest AC');
  assert.equal(name(third.platform, 'fan'), 'Guest AC Fan');
  assert.equal(name(third.platform, 'fast'), 'تبريد سريع');
});

test('an appliance that moves to a new address is followed, and found there again after a restart', async (t) => {
  const storage = tmpDir();
  const config = { devices: [{ host: '10.0.0.5', id: DI, name: 'Layla AC' }] };
  const first = await boot({ storage, devices: [ac('10.0.0.5')], config });
  await online(first.platform);
  const cachedAccessory = first.api.registered[0].accessory;
  await first.platform.helper.request('sim', { key: DI, action: 'move', to: '10.0.0.9', follow: true, mac: 'aa:bb:cc:00:4f:2a' });
  await waitFor(() => first.platform.devices.get(DI).link.host === '10.0.0.9' && first.platform.devices.get(DI).link.online);
  const saved = JSON.parse(fs.readFileSync(path.join(storage, STORAGE_DIR_NAME, 'addresses.json'), 'utf8'));
  assert.deepEqual(saved[DI], { configHost: '10.0.0.5', host: '10.0.0.9', mac: 'aa:bb:cc:00:4f:2a' });
  assert.equal(first.api.registered.length, 1, 'same accessory, no duplicate');
  await first.platform.stop();

  // Restart with the settings unchanged: it connects straight to the new address.
  const second = await boot({ storage, devices: [ac('10.0.0.9')], config, cached: [cachedAccessory] });
  await online(second.platform);
  assert.equal(second.platform.devices.get(DI).link.host, '10.0.0.9');
  await second.platform.stop();

  // An address typed in the settings afterwards wins over the remembered one.
  const third = await boot({ storage, devices: [ac('10.0.0.20')], config: { devices: [{ host: '10.0.0.20', id: DI, name: 'Layla AC' }] }, cached: [cachedAccessory] });
  t.after(() => third.platform.stop());
  await online(third.platform);
  assert.equal(third.platform.devices.get(DI).link.host, '10.0.0.20');
});
