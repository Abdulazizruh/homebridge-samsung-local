import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { describeDevice } from '../src/capabilities/index.js';
import { SamsungLocalPlatform } from '../src/platform.js';
import { HelperClient } from '../src/runtime/helperClient.js';
import { PLATFORM_NAME, PLUGIN_NAME, STORAGE_DIR_NAME, UUID_NAMESPACE } from '../src/settings.js';
import { listSnapshots, pluginPaths, wipePluginData } from '../src/storage.js';
import { failureText } from '../src/deviceLink.js';
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

async function boot({ storage = tmpDir(), devices, config, cached = [], overrides = {} }) {
  const api = makeApi(storage);
  const platform = new SamsungLocalPlatform(quietLog, { platform: PLATFORM_NAME, ...config }, api,
    { createHelper: helperFactory(devices), startGapMs: 0, startSettleMs: 0, ...overrides });
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
  // The slow acknowledgement is measured and offered to the settings page.
  assert.ok(link.commandMs >= 2000, `measured ${link.commandMs} ms`);
});

test('a 4.00 answer to a correct command is asked once more and then succeeds', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const { handler, link } = platform.devices.get(DI);
  const C = platform.api.hap.Characteristic;
  const retried = [];
  link.on('retried', (path, accepted) => retried.push([path, accepted]));
  await platform.helper.request('sim', { key: DI, action: 'refuse', value: 'once' });
  // Whichever way the unit is, ask for the opposite so a power command is really sent.
  const wasOn = handler.model.state.power;
  const fan = handler.services.get('fan').getCharacteristic(C.Active);
  const target = handler.services.get('thermostat').getCharacteristic(C.TargetHeatingCoolingState);
  await (wasOn ? target.handleSetRequest(C.TargetHeatingCoolingState.OFF) : fan.handleSetRequest(1));
  await waitFor(() => retried.length === 1, 4000);
  assert.deepEqual(retried, [['power/vs/0', true]]);
  await waitFor(() => handler.model.state.power === !wasOn, 4000);
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
  // The port is remembered with the address, so the next start skips the search.
  assert.deepEqual({ ...saved[DI], port: undefined }, { configHost: '10.0.0.5', host: '10.0.0.9', mac: 'aa:bb:cc:00:4f:2a', port: undefined });
  assert.ok('port' in saved[DI]);
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

test('washer: read-only tile with time remaining, and a sensor when the cycle ends', async (t) => {
  const W = fixture('washer_topload').identity.di;
  const { api, platform } = await boot({ devices: [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }], config: { devices: [{ host: '10.0.0.9', name: 'Washer', cycleStyle: 'valve' }] } });
  t.after(() => platform.stop());
  await online(platform, W);
  assert.equal(api.registered.length, 1);
  const { handler } = platform.devices.get(W);
  const C = platform.api.hap.Characteristic;
  const valve = handler.services.get('cycle');
  const done = handler.services.get('finished');
  assert.equal(valve.getCharacteristic(C.ConfiguredName).value, 'Washer');
  assert.equal(done.getCharacteristic(C.ConfiguredName).value, 'Washer Finished');
  // Idle: off, no countdown (57 minutes is only the length of the selected course), no negative power.
  assert.equal(valve.getCharacteristic(C.Active).value, 0);
  assert.equal(valve.getCharacteristic(C.RemainingDuration).value, 0);
  assert.equal(valve.getCharacteristic(handler.eve.Consumption).value, 0);
  assert.equal(valve.getCharacteristic(handler.eve.TotalConsumption).value, 1190.4);
  assert.equal(done.getCharacteristic(C.OccupancyDetected).value, 0);

  const state = (body) => platform.helper.request('sim', { key: W, action: 'remote', path: ['operational', 'state', 'vs', '0'], body });
  await state({ [`${V}state`]: 'Run', [`${V}progress`]: 'Wash', [`${V}remainingTime`]: '00:41:00' });
  await waitFor(() => valve.getCharacteristic(C.InUse).value === 1);
  assert.equal(valve.getCharacteristic(C.Active).value, 1);
  assert.equal(valve.getCharacteristic(C.RemainingDuration).value, 41 * 60);
  assert.equal(valve.getCharacteristic(C.SetDuration).value, 41 * 60);

  // Tapping the tile changes nothing at the appliance and the tile shows the truth again.
  await valve.getCharacteristic(C.Active).handleSetRequest(0);
  await waitFor(() => valve.getCharacteristic(C.Active).value === 1);

  await state({ [`${V}state`]: 'Ready', [`${V}progress`]: 'None', [`${V}remainingTime`]: '00:57:00' });
  await waitFor(() => done.getCharacteristic(C.OccupancyDetected).value === 1);
  assert.equal(valve.getCharacteristic(C.Active).value, 0);
  assert.equal(valve.getCharacteristic(C.RemainingDuration).value, 0);
});

test('washer finished notice: a model that says "Finish" is believed; a cancelled cycle and a restart give no notice', async (t) => {
  const W = fixture('washer_topload').identity.di;
  const storage = tmpDir();
  const devices = [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }];
  const config = { devices: [{ host: '10.0.0.9', id: W, name: 'Washer' }] };
  const first = await boot({ storage, devices, config });
  await online(first.platform, W);
  const { handler, accessory } = first.platform.devices.get(W);
  const C = first.platform.api.hap.Characteristic;
  const done = handler.services.get('finished').getCharacteristic(C.OccupancyDetected);
  const state = (platform, body) => platform.helper.request('sim', { key: W, action: 'remote', path: ['operational', 'state', 'vs', '0'], body });
  const run = { [`${V}state`]: 'Run', [`${V}progress`]: 'Wash', [`${V}remainingTime`]: '00:41:00' };
  const ready = { [`${V}state`]: 'Ready', [`${V}progress`]: 'None', [`${V}remainingTime`]: '00:57:00' };
  const finish = { [`${V}state`]: 'Finish', [`${V}progress`]: 'Finish', [`${V}remainingTime`]: '00:00:00' };

  // A complete cycle: the appliance says Finish.
  await state(first.platform, run);
  await waitFor(() => accessory.context.washerSeen?.inCycle === true);
  await state(first.platform, finish);
  await waitFor(() => done.value === 1);
  assert.equal(accessory.context.sendsFinish, true);

  // A cancelled cycle on the same washer: Run, then straight back to Ready.
  await state(first.platform, run);
  await waitFor(() => done.value === 0);
  await state(first.platform, ready);
  await waitFor(() => accessory.context.washerSeen?.inCycle === false);
  assert.equal(done.value, 0);

  // Left showing Finish, then the bridge restarts: the notice is not given again.
  await state(first.platform, run);
  await waitFor(() => accessory.context.washerSeen?.inCycle === true);
  await state(first.platform, finish);
  await waitFor(() => done.value === 1);
  await first.platform.stop();
  // After the restart the washer still shows Finish.
  const still = structuredClone(fixture('washer_topload'));
  Object.assign(still.resources['/operational/state/vs/0'], finish);
  const stillFile = path.join(tmpDir(), 'washer_finish.json');
  fs.writeFileSync(stillFile, JSON.stringify(still));
  const second = await boot({ storage, devices: [{ host: '10.0.0.9', fixture: stillFile }], cached: [accessory], config });
  t.after(() => second.platform.stop());
  await online(second.platform, W);
  const again = second.platform.devices.get(W).handler.services.get('finished').getCharacteristic(C.OccupancyDetected);
  await new Promise((r) => { setTimeout(r, 400); });
  assert.equal(second.platform.devices.get(W).handler.model.state.finished, true);
  assert.equal(again.value, 0);
});

test('a failed helper start is retried on its own; appliances connect once it works', async (t) => {
  const api = makeApi(tmpDir());
  let starts = 0;
  const good = helperFactory([ac('10.0.0.5')]);
  const platform = new SamsungLocalPlatform(quietLog, { platform: PLATFORM_NAME, devices: [{ host: '10.0.0.5' }] }, api, {
    startGapMs: 0,
    startSettleMs: 0,
    helperRetryMs: [80],
    createHelper: (paths) => {
      starts += 1;
      if (starts === 1) { throw Object.assign(new Error('Could not download the Python packages.'), { code: 'pip' }); }
      return good(paths);
    },
  });
  t.after(() => platform.stop());
  await platform.start();
  assert.equal(platform.devices.size, 0);
  await online(platform);
  assert.equal(starts, 2);
});

test('readings file: unchanged readings are not written again and again', async (t) => {
  const { platform } = await boot({ devices: [ac('10.0.0.5')], config: { devices: [{ host: '10.0.0.5' }] } });
  t.after(() => platform.stop());
  await online(platform);
  const file = path.join(platform.paths.state, fs.readdirSync(platform.paths.state)[0]);
  await waitFor(() => fs.existsSync(file));
  const first = fs.statSync(file).mtimeMs;
  // The simulated appliance reports every 60 ms; ten identical reports later the file is untouched.
  await new Promise((r) => { setTimeout(r, 700); });
  assert.equal(fs.statSync(file).mtimeMs, first);
});

test('washer options: a part switched off in the settings is removed, energy moves to the part that stays', async (t) => {
  const W = fixture('washer_topload').identity.di;
  const storage = tmpDir();
  const devices = [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }];
  const first = await boot({ storage, devices, config: { devices: [{ host: '10.0.0.9', id: W, name: 'Washer' }] } });
  await online(first.platform, W);
  const accessory = first.api.registered[0].accessory;
  await first.platform.stop();
  const second = await boot({ storage, devices, cached: [accessory], config: { devices: [{ host: '10.0.0.9', id: W, name: 'Washer', features: { cycleTile: false } }] } });
  t.after(() => second.platform.stop());
  await online(second.platform, W);
  const { handler } = second.platform.devices.get(W);
  const S = second.api.hap.Service;
  assert.equal(accessory.getServiceById(S.Valve, 'cycle'), undefined);
  const done = handler.services.get('finished');
  assert.ok(done);
  await waitFor(() => done.getCharacteristic(handler.eve.TotalConsumption).value === 1190.4);
});

test('removing the Python runtime touches only that folder', async () => {
  const { removePythonRuntime } = await import('../src/storage.js');
  const paths = pluginPaths(tmpDir());
  fs.mkdirSync(path.join(paths.venv, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(paths.venv, 'lib', 'big.so'), Buffer.alloc(4096));
  fs.writeFileSync(paths.runtimeMarker, '{}');
  fs.mkdirSync(paths.credentials, { recursive: true });
  fs.writeFileSync(path.join(paths.credentials, 'client.key'), 'key');
  fs.writeFileSync(paths.addresses, '{}');
  const { freed } = removePythonRuntime(paths);
  assert.equal(freed, 4096);
  assert.equal(fs.existsSync(paths.venv), false);
  assert.equal(fs.existsSync(paths.runtimeMarker), false);
  assert.equal(fs.readFileSync(path.join(paths.credentials, 'client.key'), 'utf8'), 'key');
  assert.ok(fs.existsSync(paths.addresses));
});

test('washer extras: progress, child lock and alert appear only when asked for, and follow the appliance', async (t) => {
  const W = fixture('washer_topload').identity.di;
  const { platform } = await boot({ devices: [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }],
    config: { devices: [{ host: '10.0.0.9', name: 'Washer', features: { progressTile: true, kidsLockSensor: true, alertSensor: true } }] } });
  t.after(() => platform.stop());
  await online(platform, W);
  const { handler } = platform.devices.get(W);
  const C = platform.api.hap.Characteristic;
  const progress = handler.services.get('progress').getCharacteristic(C.CurrentRelativeHumidity);
  const lock = handler.services.get('kidsLock').getCharacteristic(C.LockCurrentState);
  const alert = handler.services.get('alert').getCharacteristic(C.OccupancyDetected);
  assert.equal(handler.services.get('progress').getCharacteristic(C.ConfiguredName).value, 'Washer Progress');
  // Idle: the stale 1 % is not shown, the lock is open, nothing is wrong.
  assert.deepEqual([progress.value, lock.value, alert.value], [0, C.LockCurrentState.UNSECURED, 0]);
  const sim = (p, body) => platform.helper.request('sim', { key: W, action: 'remote', path: p, body });
  await sim(['operational', 'state', 'vs', '0'], { [`${V}state`]: 'Run', [`${V}progressPercentage`]: '68' });
  await sim(['kidslock', '0'], { value: true });
  await sim(['alarms', 'vs', '0'], { [`${V}items`]: [{ [`${V}code`]: 'DoorOpen_ON' }, { [`${V}code`]: 'Drain_OFF' }] });
  await waitFor(() => progress.value === 68 && lock.value === C.LockCurrentState.SECURED && alert.value === 1);
});

test('washer: extras stay away by default, and the not-used list names only what is not read', async () => {
  const fx = fixture('washer_topload');
  const described = describeDevice(fx.identity, fx.resources);
  assert.ok(!described.unknownResources.includes('/operational/state/vs/0'));
  assert.ok(!described.unknownResources.includes('/energy/consumption/vs/0'));
  assert.ok(described.unknownResources.includes('/washer/vs/0'));
  assert.equal(described.features.find((r) => r.id === 'washCount').value, 211);
});

test('washer tile styles: a tile that stays writable (also when 1.0.18 left "readonly" in the settings), or a running sensor', async (t) => {
  const W = fixture('washer_topload').identity.di;
  const devices = [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }];
  const a = await boot({ devices, config: { devices: [{ host: '10.0.0.9', name: 'Washer', cycleStyle: 'readonly' }] } });
  await online(a.platform, W);
  const { Characteristic: C, Perms } = a.api.hap;
  const valve = a.platform.devices.get(W).handler.services.get('cycle');
  // Without write permission the Home app shows "No Response" after a tap.
  assert.ok(valve.getCharacteristic(C.Active).props.perms.includes(Perms.PAIRED_WRITE));
  await a.platform.stop();

  const b = await boot({ devices, config: { devices: [{ host: '10.0.0.9', name: 'Washer', cycleStyle: 'sensor' }] } });
  t.after(() => b.platform.stop());
  await online(b.platform, W);
  const running = b.platform.devices.get(W).handler.services.get('cycle');
  assert.equal(running.UUID, b.api.hap.Service.OccupancySensor.UUID);
  assert.equal(running.getCharacteristic(C.ConfiguredName).value, 'Washer');
  await b.platform.helper.request('sim', { key: W, action: 'remote', path: ['operational', 'state', 'vs', '0'], body: { [`${V}state`]: 'Run' } });
  await waitFor(() => running.getCharacteristic(C.OccupancyDetected).value === 1);
});

test('start-up: appliances are asked one after another, a moment apart', async (t) => {
  const devices = [ac('10.0.0.5'), ac('10.0.0.6'), ac('10.0.0.7')];
  const asked = [];
  const factory = helperFactory(devices);
  const { platform } = await boot({
    devices,
    config: { devices: [{ host: '10.0.0.5' }, { host: '10.0.0.6' }, { host: '10.0.0.7' }] },
    overrides: {
      startGapMs: 120,
      createHelper: (paths) => {
        const helper = factory(paths);
        const request = helper.request.bind(helper);
        helper.request = (cmd, args, ...rest) => { if (cmd === 'probe') { asked.push([args.host, Date.now()]); } return request(cmd, args, ...rest); };
        return helper;
      },
    },
  });
  t.after(() => platform.stop());
  await waitFor(() => asked.length === 3);
  assert.deepEqual(asked.map(([host]) => host), ['10.0.0.5', '10.0.0.6', '10.0.0.7']);
  assert.ok(asked[1][1] - asked[0][1] >= 90 && asked[2][1] - asked[1][1] >= 90, 'each start waits for its turn');
});

test('a failed connection says where it stopped and after how long', () => {
  assert.equal(failureText({ message: 'session operation timed out', stage: 'session', afterMs: 12040 }),
    ' (session operation timed out; stopped at: opening the secure session, after 12.0s)');
  assert.equal(failureText({ message: 'helper stopped' }), ' (helper stopped)');
  assert.equal(failureText({ message: 'session operation failed', stage: 'session', afterMs: 4100, why: 'sslv3 alert handshake failure' }),
    ' (session operation failed; stopped at: opening the secure session, after 4.1s; the appliance said: sslv3 alert handshake failure)');
  assert.equal(failureText(null), '');
});

test('start-up: nothing is asked before the settle time has passed', async (t) => {
  const devices = [ac('10.0.0.5')];
  let first = 0;
  const factory = helperFactory(devices);
  const began = Date.now();
  const { platform } = await boot({
    devices,
    config: { devices: [{ host: '10.0.0.5' }] },
    overrides: {
      startSettleMs: 200,
      createHelper: (paths) => {
        const helper = factory(paths);
        const request = helper.request.bind(helper);
        helper.request = (cmd, ...rest) => { if (cmd === 'probe' && !first) { first = Date.now(); } return request(cmd, ...rest); };
        return helper;
      },
    },
  });
  t.after(() => platform.stop());
  await waitFor(() => first > 0);
  assert.ok(first - began >= 190, 'the first appliance waits for the settle time');
});

test('an air purifier found on the network gets its own accessory, where earlier versions only listed it', async (t) => {
  const P = fixture('purifier_tower').identity.di;
  const { api, platform } = await boot({ devices: [{ host: '10.0.0.30', fixture: fixturePath('purifier_tower') }], config: { devices: [{ host: '10.0.0.30', name: 'Purifier' }] } });
  t.after(() => platform.stop());
  await online(platform, P);
  assert.equal(api.registered.length, 1);
  const { handler } = platform.devices.get(P);
  const { Service, Characteristic: C, Categories } = platform.api.hap;
  assert.equal(api.registered[0].accessory.category, Categories.AIR_PURIFIER);
  assert.equal(api.registered[0].accessory.context.family, 'appliance');
  assert.equal(handler.services.get('speed').UUID, Service.AirPurifier.UUID);
  assert.equal(handler.services.get('airQuality').getCharacteristic(C.PM2_5Density).value, 5);
});

test('polling interval: at least 4 seconds, 5 when unset; a lower saved value is used as 4', async () => {
  const { pollSeconds, MIN_POLL_S, DEFAULT_POLL_S } = await import('../src/platform.js');
  assert.equal(MIN_POLL_S, 4);
  assert.equal(DEFAULT_POLL_S, 5);
  assert.equal(pollSeconds(undefined), 5);
  assert.equal(pollSeconds(2), 4);
  assert.equal(pollSeconds(4), 4);
  assert.equal(pollSeconds(10), 10);
  assert.equal(pollSeconds(999), 300);
  assert.equal(pollSeconds('x'), 5);
});

test('washer stages: a sensor for each stage the washer lists, drum clean as its own, on by default and removable', async (t) => {
  const W = fixture('washer_topload').identity.di;
  const { platform } = await boot({ devices: [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }], config: { devices: [{ host: '10.0.0.9', name: 'Washer' }] } });
  t.after(() => platform.stop());
  await online(platform, W);
  const { handler } = platform.devices.get(W);
  const C = platform.api.hap.Characteristic;
  const on = (key) => handler.services.get(key)?.getCharacteristic(C.OccupancyDetected).value;
  assert.deepEqual(['wash', 'rinse', 'spin', 'drumClean'].map((k) => handler.services.get(k)?.getCharacteristic(C.ConfiguredName).value),
    ['Washer Washing', 'Washer Rinsing', 'Washer Spinning', 'Washer Drum Clean']);
  assert.deepEqual(['wash', 'rinse', 'spin', 'drumClean'].map(on), [0, 0, 0, 0], 'idle: nothing detected');

  const state = (body) => platform.helper.request('sim', { key: W, action: 'remote', path: ['operational', 'state', 'vs', '0'], body });
  await state({ [`${V}state`]: 'Run', [`${V}progress`]: 'Wash', [`${V}remainingTime`]: '00:41:00' });
  await waitFor(() => on('wash') === 1);
  await state({ [`${V}state`]: 'Run', [`${V}progress`]: 'Rinse', [`${V}remainingTime`]: '00:20:00' });
  await waitFor(() => on('rinse') === 1);
  assert.equal(on('wash'), 0, 'one stage at a time');
  // A top-loader names its whole drum clean as a stage of its own, outside its supported list.
  await state({ [`${V}state`]: 'Run', [`${V}progress`]: 'Drumcleaning', [`${V}remainingTime`]: '01:42:00' });
  await waitFor(() => on('drumClean') === 1);
  assert.deepEqual(['wash', 'rinse', 'spin'].map(on), [0, 0, 0]);
  await state({ [`${V}state`]: 'Ready', [`${V}progress`]: 'None', [`${V}remainingTime`]: '00:57:00' });
  await waitFor(() => on('drumClean') === 0);

  const off = await boot({ devices: [{ host: '10.0.0.9', fixture: fixturePath('washer_topload') }], config: { devices: [{ host: '10.0.0.9', name: 'Washer', features: { stageSensors: false, drumCleanSensor: false } }] } });
  t.after(() => off.platform.stop());
  await online(off.platform, W);
  const other = off.platform.devices.get(W).handler;
  assert.deepEqual(['wash', 'rinse', 'spin', 'drumClean'].filter((k) => other.services.has(k)), [], 'switched off: removed');
});

test('washer course: the code, its table and drum clean; the last drum clean from the appliance log', async () => {
  const { washerCourse, lastDrumClean } = await import('../src/capabilities/washer.js');
  const res = (options, table) => ({ '/course/vs/0': { [`${V}options`]: options }, ...(table ? { '/st/washercourse/vs/0': { [`${V}st.courseTable`]: table } } : {}) });
  assert.deepEqual(washerCourse(res(['Course_82'], 'Table_02')), { code: '82', table: 'Table_02', drumClean: true });
  assert.deepEqual(washerCourse(res(['Course_01'], 'Table_02')), { code: '01', table: 'Table_02', drumClean: false });
  assert.equal(washerCourse(res(['Course_82'])).drumClean, false, 'no table: the code alone names nothing');
  assert.equal(washerCourse(res([])), null);
  assert.equal(lastDrumClean(res(['DrumCleanLog_2025-10-27T21:43:10|2026-10-06T01:13:37|2026-08-27T04:16:06'])), '2026-10-06');
  assert.equal(lastDrumClean(res(['WashingTimes_5'])), null);
});
