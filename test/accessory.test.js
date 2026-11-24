import assert from 'node:assert/strict';
import test from 'node:test';
import { AcAccessory, accessoryName } from '../src/homekit/acAccessory.js';
import { UUID_NAMESPACE } from '../src/settings.js';
import { FakeLink, fixture, makeApi, quietLog } from './support.js';

const V = 'x.com.samsung.da.';
const wf = fixture('ac_windfree');

/** Minimal appliance behaviour for the in-memory link. */
function apply(resources, write) {
  const href = `/${write.path.join('/')}`;
  if (href === '/mode/vs/0' && write.body[`${V}options`]) {
    for (const token of write.body[`${V}options`]) {
      const list = resources[href][`${V}options`];
      const i = list.findIndex((x) => x.startsWith(`${token.split('_')[0]}_`));
      if (i >= 0) { list[i] = token; } else { list.push(token); }
    }
    return;
  }
  Object.assign(resources[href], write.body);
}

function setup({ features, resources = wf.resources, on = true } = {}) {
  const api = makeApi();
  const res = structuredClone(resources);
  res['/power/vs/0'][`${V}power`] = on ? 'On' : 'Off';
  res['/mode/vs/0'][`${V}modes`] = ['Cool'];
  const link = new FakeLink(res, apply);
  const accessory = new api.platformAccessory('Test Local', api.hap.uuid.generate(`${UUID_NAMESPACE}test`));
  accessory.context.deviceId = wf.identity.di;
  const handler = new AcAccessory({ api, log: quietLog, accessory, link, displayName: 'Test Local', features });
  const C = api.hap.Characteristic;
  const svc = (key) => handler.services.get(key);
  const set = (key, char, value) => svc(key).getCharacteristic(char).handleSetRequest(value);
  const get = (key, char) => svc(key).getCharacteristic(char).handleGetRequest();
  return { api, link, accessory, handler, C, svc, set, get, res: link.resources };
}

test('layout: one accessory groups thermostat, fan, mode switches, light and sensors', () => {
  const { handler, accessory, api } = setup();
  const keys = [...handler.services.keys()].sort();
  assert.deepEqual(keys, ['dry', 'fan', 'fanAuto', 'fanOnly', 'fanTurbo', 'fast', 'filter', 'humidity', 'light', 'quiet', 'thermostat', 'windFree']);
  assert.ok(accessory.getService(api.hap.Service.Thermostat).isPrimaryService);
  // Optional services are opt-in.
  const more = setup({ features: { sleep: true, fanSpeedSwitches: true, beep: true } });
  for (const key of ['sleep', 'fanLow', 'fanMedium', 'fanHigh', 'beep']) {
    assert.ok(more.handler.services.has(key), key);
  }
});

test('layout: services the appliance does not support are not created', () => {
  const res = structuredClone(wf.resources);
  delete res['/mode/convenient/vs/0'];
  delete res['/humidity/vs/0'];
  res['/mode/vs/0'][`${V}supportedModes`] = ['Cool', 'Wind'];
  const { handler, svc, C } = setup({ resources: res });
  for (const key of ['windFree', 'fast', 'quiet', 'humidity', 'dry']) {
    assert.ok(!handler.services.has(key), key);
  }
  const T = C.TargetHeatingCoolingState;
  assert.deepEqual(svc('thermostat').getCharacteristic(T).props.validValues, [T.OFF, T.COOL]);
});

test('thermostat: Celsius, appliance range, real state', async () => {
  const { svc, get, C } = setup();
  const target = svc('thermostat').getCharacteristic(C.TargetTemperature);
  assert.deepEqual([target.props.minValue, target.props.maxValue, target.props.minStep], [16, 30, 1]);
  assert.equal(await get('thermostat', C.CurrentTemperature), 27);
  assert.equal(await get('thermostat', C.TargetTemperature), 26);
  assert.equal(await get('thermostat', C.TemperatureDisplayUnits), C.TemperatureDisplayUnits.CELSIUS);
  assert.equal(await get('thermostat', C.TargetHeatingCoolingState), C.TargetHeatingCoolingState.COOL);
});

test('thermostat: choosing a mode while off powers on first, then sets the mode', async () => {
  const { link, set, C } = setup({ on: false });
  await set('thermostat', C.TargetHeatingCoolingState, C.TargetHeatingCoolingState.HEAT);
  assert.deepEqual(link.sent.map((w) => w.path.join('/')), ['power/vs/0', 'mode/vs/0']);
  assert.deepEqual(link.sent[1].body, { [`${V}modes`]: ['Heat'] });
});

test('one command, one beep: switching on in the mode it was left in sends power only, even when several tiles ask', async () => {
  const { link, set, C } = setup({ on: false, features: { light: true } });
  // Apple Home sends "Cool" to the thermostat, "on" to the fan and the target temperature together.
  await Promise.all([
    set('thermostat', C.TargetHeatingCoolingState, C.TargetHeatingCoolingState.COOL),
    set('fan', C.Active, 1),
    set('thermostat', C.TargetTemperature, 26),
  ]);
  assert.deepEqual(link.sent.map((w) => w.path.join('/')), ['power/vs/0']);
});

test('one command, one beep: switching off sends power only; the display setting is left alone', async () => {
  const { link, set, C } = setup({ features: { light: true } });
  await Promise.all([
    set('thermostat', C.TargetHeatingCoolingState, C.TargetHeatingCoolingState.OFF),
    set('light', C.On, false),
    set('fan', C.Active, 0),
  ]);
  assert.deepEqual(link.sent.map((w) => w.path.join('/')), ['power/vs/0']);
  // A value the appliance already has is not sent again.
  link.sent.length = 0;
  await set('thermostat', C.TargetHeatingCoolingState, C.TargetHeatingCoolingState.OFF);
  assert.equal(link.sent.length, 0);
});

test('Auto and Turbo are explicit choices, not slider positions', async () => {
  const { link, set, get, svc, C } = setup();
  await set('fanTurbo', C.On, true);
  assert.deepEqual(link.sent.at(-1), { path: ['wind', 'strength', 'vs', '0'], body: { [`${V}modes`]: '4' } });
  assert.equal(await get('fanTurbo', C.On), true);
  assert.equal(await get('fanAuto', C.On), false);
  assert.equal(await get('fan', C.RotationSpeed), 100);
  await set('fanAuto', C.On, true);
  assert.equal(link.sent.at(-1).body[`${V}modes`], '0');
  assert.equal(await get('fan', C.TargetFanState), C.TargetFanState.AUTO);
  assert.equal(await get('fanTurbo', C.On), false);
  // The slider has four real steps and no "auto" or "turbo by accident" position.
  assert.equal(svc('fan').getCharacteristic(C.RotationSpeed).props.minStep, 25);
  await set('fan', C.RotationSpeed, 50);
  assert.equal(link.sent.at(-1).body[`${V}modes`], '2');
});

test('fan slider: zero means Auto and never powers off', async () => {
  const { link, set, get, C, res } = setup();
  await set('fan', C.RotationSpeed, 75);
  assert.equal(res['/wind/strength/vs/0'][`${V}modes`], '3');
  await set('fan', C.RotationSpeed, 0);
  assert.equal(res['/wind/strength/vs/0'][`${V}modes`], '0');
  await set('fan', C.Active, 0); // HomeKit sends this right after a zero speed
  assert.equal(await get('fan', C.RotationSpeed), 0);
  assert.equal(await get('fanAuto', C.On), true);
  assert.equal(res['/power/vs/0'][`${V}power`], 'On');
  assert.ok(link.sent.every((w) => w.path[0] !== 'power'));
});

test('special modes: turning one off never powers off and never cancels another', async () => {
  const { link, set, get, C, res } = setup();
  await set('windFree', C.On, true);
  assert.equal(res['/mode/convenient/vs/0'][`${V}modes`], 'Nano');
  const before = link.sent.length;
  await set('quiet', C.On, false); // Quiet is not active
  await set('fast', C.On, false);
  assert.equal(link.sent.length, before, 'no write for an inactive mode');
  assert.equal(await get('windFree', C.On), true);
  await set('quiet', C.On, true); // the appliance has one slot: Quiet replaces WindFree
  assert.equal(await get('quiet', C.On), true);
  assert.equal(await get('windFree', C.On), false);
  await set('quiet', C.On, false);
  assert.equal(res['/mode/convenient/vs/0'][`${V}modes`], 'Off');
  assert.equal(res['/power/vs/0'][`${V}power`], 'On');
  assert.ok(link.sent.every((w) => w.path[0] !== 'power'));
});

test('unintended shutdown: the fan tile and mode switches cannot power off the unit', async () => {
  const { link, set, C, res } = setup();
  await set('fan', C.Active, 0);
  await set('fan', C.RotationSpeed, 0);
  assert.equal(link.sent.length, 0);
  await set('dry', C.On, true);
  await set('dry', C.On, false); // leaves Dry for the previous main mode
  assert.deepEqual(res['/mode/vs/0'][`${V}modes`], ['Cool']);
  assert.equal(res['/power/vs/0'][`${V}power`], 'On');
  assert.ok(link.sent.every((w) => w.path[0] !== 'power'));
});

test('power off: every tile of the accessory shows off at once, before the appliance reports', async () => {
  const { set, svc, C, res } = setup({ features: { light: true } });
  res['/mode/convenient/vs/0'][`${V}modes`] = 'Speed';
  assert.equal(svc('fan').getCharacteristic(C.Active).value, 1);
  await set('thermostat', C.TargetHeatingCoolingState, C.TargetHeatingCoolingState.OFF);
  assert.equal(svc('fan').getCharacteristic(C.Active).value, 0);
  assert.equal(svc('thermostat').getCharacteristic(C.CurrentHeatingCoolingState).value, C.CurrentHeatingCoolingState.OFF);
  for (const key of ['fast', 'windFree', 'quiet', 'dry', 'fanOnly', 'fanAuto', 'fanTurbo', 'light']) {
    assert.equal(svc(key).getCharacteristic(C.On).value, false, key);
  }
});

test('external change: remote or Samsung app changes show up in HomeKit', () => {
  const { link, svc, C, res } = setup();
  res['/power/vs/0'][`${V}power`] = 'Off';
  res['/mode/convenient/vs/0'][`${V}modes`] = 'Speed';
  res['/wind/strength/vs/0'][`${V}modes`] = '4';
  res['/temperature/desired/0'].temperature = 21;
  link.report();
  assert.equal(svc('thermostat').getCharacteristic(C.TargetHeatingCoolingState).value, C.TargetHeatingCoolingState.OFF);
  assert.equal(svc('thermostat').getCharacteristic(C.TargetTemperature).value, 21);
  assert.equal(svc('fast').getCharacteristic(C.On).value, true);
  assert.equal(svc('fanTurbo').getCharacteristic(C.On).value, true);
  assert.equal(svc('fan').getCharacteristic(C.Active).value, 0);
});

test('confirmation: a refused command fails in HomeKit instead of pretending success', async () => {
  const { link, set, get, C } = setup();
  link.accept = false;
  await assert.rejects(() => set('windFree', C.On, true), (err) => (err?.hapStatus ?? err) === -70402);
  assert.equal(await get('windFree', C.On), false);
});

test('confirmation: a stale read right after a write does not bounce the tile', async () => {
  const { link, set, svc, C } = setup();
  link.apply = null; // the appliance acknowledged but has not applied yet
  link.autoReport = false;
  await set('light', C.On, false);
  svc('light').updateCharacteristic(C.On, false); // what HomeKit shows after its own set
  link.report(); // stale: still lit
  assert.equal(svc('light').getCharacteristic(C.On).value, false, 'held during the settle window');
});

test('confirmation: Apple Home asking again before the appliance reports gets the value just set, on every tile', async () => {
  const { link, set, get, C, res } = setup();
  link.apply = null; // the appliance acknowledged but has not applied yet
  link.autoReport = false;
  await set('light', C.On, false);
  assert.equal(await get('light', C.On), false, 'the display stays off; it was read back as on before');
  await set('fast', C.On, true);
  assert.equal(await get('fast', C.On), true);
  await set('thermostat', C.TargetTemperature, 19);
  assert.equal(await get('thermostat', C.TargetTemperature), 19);
  // Once the appliance reports, its own state is what the tile shows.
  res['/temperature/desired/0'].temperature = 19;
  res['/mode/convenient/vs/0'][`${V}modes`] = 'Speed';
  res['/light/vs/0'] = { ...res['/light/vs/0'], [`${V}lightIndicator`]: 'Off' };
  link.report();
  assert.equal(await get('thermostat', C.TargetTemperature), 19);
  assert.equal(await get('fast', C.On), true);
});

test('availability: offline shows No Response; services survive', async () => {
  const { link, get, handler, C } = setup();
  const count = handler.services.size;
  link.setOnline(false);
  await assert.rejects(() => get('thermostat', C.CurrentTemperature), (err) => (err?.hapStatus ?? err) === -70402);
  await assert.rejects(() => get('windFree', C.On), (err) => (err?.hapStatus ?? err) === -70402);
  assert.equal(handler.services.size, count);
  link.setOnline(true);
  assert.equal(await get('thermostat', C.CurrentTemperature), 27);
});

test('energy: W and kWh use Eve characteristics on the thermostat, no fake sensor types', () => {
  const { svc, handler, accessory, api } = setup();
  const t = svc('thermostat');
  assert.equal(t.getCharacteristic(handler.eve.TotalConsumption).value, 320.47);
  assert.equal(t.getCharacteristic(handler.eve.TotalConsumption).props.unit, 'kWh');
  assert.equal(t.getCharacteristic(handler.eve.Consumption).props.unit, 'W');
  for (const type of [api.hap.Service.LightSensor, api.hap.Service.Outlet, api.hap.Service.AirQualitySensor]) {
    assert.equal(accessory.getService(type), undefined);
  }
});

test('naming: the accessory is named exactly as typed', () => {
  assert.equal(accessoryName('Living Room AC'), 'Living Room AC');
  assert.equal(accessoryName('  Bedroom Local '), 'Bedroom Local');
  assert.equal(accessoryName(''), 'Samsung AC');
});

test('display light: shown off while the air conditioner is off, even if its light setting is on', async () => {
  const off = setup({ on: false });
  assert.equal(await off.get('light', off.C.On), false);
  const on = setup({ on: true });
  assert.equal(await on.get('light', on.C.On), true);
});

test('on, off and on again quickly: every change is sent, and the unit ends as the tile shows', async () => {
  const { link, set, get, C } = setup();
  link.autoReport = false;
  link.apply = null; // acknowledged at once, reported only later: the reading still shows WindFree off
  await set('windFree', C.On, true);
  await set('windFree', C.On, false); // before any reading shows it on: still sent
  await set('windFree', C.On, true); // not mistaken for the first "on"
  assert.equal(link.sent.length, 3, 'on, off and on all reach the appliance');
  assert.match(JSON.stringify(link.sent[1]), /Off/);
  assert.equal(await get('windFree', C.On), true);
});

test('switching a mode off that the appliance already reports off sends nothing', async () => {
  const { link, set, C } = setup();
  await set('windFree', C.On, false);
  assert.equal(link.sent.length, 0);
});

test('every switch: on and straight off again before the appliance reports, both are sent', async () => {
  for (const key of ['windFree', 'fast', 'quiet', 'dry', 'fanOnly', 'fanTurbo', 'fanAuto', 'light']) {
    const { link, set, get, C, svc } = setup({ features: { light: true } });
    if (!svc(key)) { continue; }
    const before = await get(key, C.On);
    link.autoReport = false;
    link.apply = null; // acknowledged, not reported yet
    await set(key, C.On, !before);
    await set(key, C.On, before);
    assert.equal(link.sent.length, 2, `${key}: the change and its reverse both reach the appliance`);
    assert.equal(await get(key, C.On), before, `${key}: the tile shows the last wish`);
  }
});

test('modes: Dry and straight back, before the appliance reports, ends in the mode it came from', async () => {
  const { link, set, C, res } = setup();
  res['/mode/vs/0'][`${V}modes`] = ['Cool'];
  link.autoReport = false;
  link.apply = null;
  await set('dry', C.On, true);
  await set('dry', C.On, false);
  const modes = link.sent.filter((w) => w.path.join('/') === 'mode/vs/0' && w.body[`${V}modes`]).map((w) => w.body[`${V}modes`][0]);
  assert.deepEqual(modes, ['Dry', 'Cool']);
});
