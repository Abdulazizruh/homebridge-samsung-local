import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplianceAccessory } from '../src/homekit/applianceAccessory.js';
import { applianceWrites, buildApplianceModel } from '../src/capabilities/appliance.js';
import { describeDevice, familyOf } from '../src/capabilities/index.js';
import { UUID_NAMESPACE } from '../src/settings.js';
import { FakeLink, fixture, makeApi, quietLog } from './support.js';

const V = 'x.com.samsung.da.';
const apply = (resources, write) => {
  const rep = resources[`/${write.path.join('/')}`];
  const items = write.body[`${V}items`];
  if (items) { // a list is changed entry by entry, as the appliance does
    for (const item of items) { Object.assign(rep[`${V}items`].find((x) => x[`${V}id`] === item[`${V}id`]), item); }
    return;
  }
  Object.assign(rep, write.body);
};

function setup(name, kind, { features } = {}) {
  const api = makeApi();
  const f = fixture(name);
  const link = new FakeLink(f.resources, apply);
  const accessory = new api.platformAccessory('Unit', api.hap.uuid.generate(`${UUID_NAMESPACE}${name}`));
  accessory.context.deviceId = f.identity.di;
  accessory.context.resources = structuredClone(f.resources);
  const handler = new ApplianceAccessory({ api, log: quietLog, accessory, link, displayName: 'Unit', features, kind });
  const C = api.hap.Characteristic;
  const S = api.hap.Service;
  const value = (id, char) => handler.services.get(id).getCharacteristic(char).value;
  const set = (id, char, v) => handler.services.get(id).getCharacteristic(char).handleSetRequest(v);
  return { api, link, accessory, handler, C, S, value, set };
}

test('every other kind is read by one reader; the tested kinds keep their own accessory', () => {
  const kinds = { purifier_tower: 'airPurifier', refrigerator_french: 'refrigerator', vacuum_jetbot: 'robotVacuum', oven_wall: 'oven', dehumidifier: 'dehumidifier' };
  for (const [name, kind] of Object.entries(kinds)) {
    const f = fixture(name);
    const d = describeDevice(f.identity, f.resources);
    assert.equal(d.kind, kind);
    assert.equal(d.support, 'experimental', name);
    assert.equal(familyOf(d.kind, d), 'appliance');
    assert.ok(d.features.every((r) => r.trial === r.write), 'every control is marked as a trial');
  }
  for (const [name, family] of [['ac_standard', 'ac'], ['ac_windfree', 'ac'], ['washer_topload', 'laundry']]) {
    const f = fixture(name);
    const d = describeDevice(f.identity, f.resources);
    assert.equal(familyOf(d.kind, d), family, `${name} stays where it was`);
  }
  // Accessories cached by earlier versions carry no family: the kind decides.
  assert.equal(familyOf('airConditioner'), 'ac');
  assert.equal(familyOf('washer'), 'laundry');
  // An appliance that reports nothing the reader knows stays in diagnostics.
  assert.equal(describeDevice({ types: ['oic.d.oven'] }, { '/x/vs/0': {} }).support, 'diagnostics-only');
});

test('air purifier: readings as sensors, power and speed on one tile, commands confirmed by the appliance', async () => {
  const { link, handler, C, S, value, set } = setup('purifier_tower', 'airPurifier');
  const main = handler.services.get('speed');
  assert.equal(main, handler.services.get('power'), 'power rides on the speed tile');
  assert.equal(main.UUID, S.AirPurifier.UUID);
  assert.equal(value('power', C.Active), 1);
  assert.equal(value('speed', C.TargetAirPurifierState), 1, 'Smart is the automatic mode');
  assert.equal(value('airQuality', C.AirQuality), 1);
  assert.equal(value('airQuality', C.PM2_5Density), 5);
  assert.equal(value('filter.hepa', C.FilterLifeLevel), 100);
  assert.equal(handler.services.has('kidsLock'), false, 'extras stay away until asked for');

  await set('speed', C.RotationSpeed, 100);
  assert.deepEqual(link.sent.at(-1), { path: ['mode', 'vs', '0'], body: { [`${V}modes`]: ['Max'] } });
  assert.equal(value('speed', C.TargetAirPurifierState), 0);
  await set('speed', C.RotationSpeed, 25);
  assert.deepEqual(link.sent.at(-1).body, { [`${V}modes`]: ['Sleep'] });
  await set('speed', C.TargetAirPurifierState, 1);
  assert.deepEqual(link.sent.at(-1).body, { [`${V}modes`]: ['Smart'] });
  await set('power', C.Active, 0);
  assert.deepEqual(link.sent.at(-1), { path: ['power', 'vs', '0'], body: { [`${V}power`]: 'Off' } });
  assert.equal(value('power', C.Active), 0);

  // A refused command is a failure, and the tile shows the appliance's own state again.
  link.accept = false;
  await assert.rejects(set('power', C.Active, 1));
  assert.equal(handler.model.parts.find((p) => p.id === 'power').value, false);
});

test('a control switched off in the settings is removed; the readings stay', () => {
  const { handler, S } = setup('purifier_tower', 'airPurifier', { features: { speed: false, power: false, kidsLock: true } });
  assert.equal(handler.services.has('speed'), false);
  assert.equal(handler.services.has('power'), false);
  assert.equal(handler.accessory.getService(S.AirPurifier), undefined);
  assert.ok(handler.services.has('airQuality'));
  assert.ok(handler.services.has('kidsLock'));
});

test('refrigerator: a sensor per zone and per door, in Celsius, and the two boost switches', async () => {
  const { link, handler, C, value, set } = setup('refrigerator_french', 'refrigerator');
  assert.equal(Math.round(value('setpoint.0', C.CurrentTemperature) * 10) / 10, -17.8, 'the freezer reports 0 °F');
  assert.equal(Math.round(value('setpoint.1', C.CurrentTemperature) * 10) / 10, 3.9);
  assert.equal(value('door.0', C.ContactSensorState), 0);
  link.resources['/doors/vs/0'][`${V}items`][1][`${V}openState`] = 'Open';
  link.report();
  assert.equal(value('door.1', C.ContactSensorState), 1);
  await set('boost.freezer', C.On, true);
  assert.deepEqual(link.sent.at(-1), { path: ['refrigeration', 'vs', '0'], body: { [`${V}rapidFreezing`]: 'On' } });
  assert.equal(handler.services.has('power'), false, 'a refrigerator has no power switch');
  // Setting a zone: one tile carries the reading and the setting; the appliance is told in its own unit.
  assert.equal(handler.services.has('temperature.1'), false, 'no second sensor for a zone that has a setting tile');
  await set('setpoint.1', C.TargetTemperature, 3);
  assert.deepEqual(link.sent.at(-1), { path: ['temperatures', 'vs', '0'], body: { [`${V}items`]: [{ [`${V}id`]: '1', [`${V}desired`]: '37' }] } });
  await set('setpoint.0', C.TargetTemperature, -20);
  assert.equal(link.sent.at(-1).body[`${V}items`][0][`${V}desired`], '-4');
});

test('robot vacuum: one switch starts a run and sends it home; the battery is shown', async () => {
  const { link, C, value, set } = setup('vacuum_jetbot', 'robotVacuum');
  assert.equal(value('clean', C.On), false);
  assert.equal(value('battery', C.BatteryLevel), 100);
  await set('clean', C.On, true);
  assert.deepEqual(link.sent.at(-1).body, { [`${V}modes`]: ['Cleaning_Auto'] });
  assert.equal(value('clean', C.On), true, 'shown as asked while the robot gets going');
  await set('clean', C.On, false);
  assert.deepEqual(link.sent.at(-1).body, { [`${V}modes`]: ['Control_Homing'] });
});

test('oven: shown, never commanded', () => {
  const f = fixture('oven_wall');
  const model = buildApplianceModel(f.resources, 'oven');
  assert.equal(model.parts.some((p) => p.control), false, 'not even its temperature can be set from here');
  assert.deepEqual(model.parts.map((p) => p.type).sort(), ['alert', 'door', 'kidsLock', 'running', 'temperature']);
  assert.throws(() => applianceWrites(model.parts.find((p) => p.type === 'running'), true));
});

test('dehumidifier: a fan tile with its speeds, and the room humidity', async () => {
  const { link, handler, C, S, value, set } = setup('dehumidifier', 'dehumidifier');
  assert.equal(handler.services.get('speed').UUID, S.Fanv2.UUID);
  assert.equal(value('humidity', C.CurrentRelativeHumidity), 47);
  assert.equal(value('speed', C.TargetFanState), 1);
  await set('speed', C.RotationSpeed, 100);
  assert.deepEqual(link.sent.at(-1).body, { [`${V}modes`]: ['Max'] });
  assert.equal(value('targetHumidity', C.RelativeHumidityDehumidifierThreshold), 50);
  await set('targetHumidity', C.RelativeHumidityDehumidifierThreshold, 40);
  assert.deepEqual(link.sent.at(-1), { path: ['humidity', 'vs', '0'], body: { [`${V}desiredHumidity`]: '40' } });
});

test('names follow the air conditioners: the name in the settings reaches every tile, a tile renamed in Home is left alone', () => {
  const api = makeApi();
  const f = fixture('refrigerator_french');
  const accessory = new api.platformAccessory('Fridge', api.hap.uuid.generate(`${UUID_NAMESPACE}names`));
  accessory.context.resources = structuredClone(f.resources);
  const C = api.hap.Characteristic;
  const make = (displayName) => new ApplianceAccessory({ api, log: quietLog, accessory, link: new FakeLink(f.resources, apply), displayName, kind: 'refrigerator' });
  const name = (h, id) => h.services.get(id).getCharacteristic(C.ConfiguredName).value;
  const first = make('Fridge');
  assert.equal(name(first, 'setpoint.0'), 'Fridge Freezer');
  assert.equal(name(first, 'door.1'), 'Fridge Door 2');
  assert.equal(name(first, 'boost.fridge'), 'Fridge Power Cool');
  // The owner renames one tile in the Home app, then changes the appliance's name in the settings.
  first.services.get('door.1').updateCharacteristic(C.ConfiguredName, 'Left door');
  const second = make('Kitchen');
  assert.equal(name(second, 'setpoint.0'), 'Kitchen Freezer');
  assert.equal(name(second, 'boost.fridge'), 'Kitchen Power Cool');
  assert.equal(name(second, 'door.1'), 'Left door');
});
