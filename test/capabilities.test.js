import assert from 'node:assert/strict';
import test from 'node:test';
import { acCommand, buildAcModel, expectedAfter, looksLikeAc, toCelsius } from '../src/capabilities/ac.js';
import { acFeatureRows, describeDevice, deviceKind, diagnosticsDump, stableDeviceId } from '../src/capabilities/index.js';
import { fixture } from './support.js';

const V = 'x.com.samsung.da.';
const wf = fixture('ac_windfree');
const std = fixture('ac_standard');

test('identity: the stable id is the OCF device id, never the address', () => {
  assert.equal(stableDeviceId(wf.identity), wf.identity.di);
  assert.equal(stableDeviceId({ di: null, pi: 'p-1' }), 'p-1');
  assert.equal(stableDeviceId({}), null);
});

test('discovery: recognises an air conditioner by type and by resources', () => {
  assert.equal(deviceKind(wf.identity, wf.resources), 'airConditioner');
  assert.ok(looksLikeAc(wf.resources, []));
  assert.equal(deviceKind({ types: ['oic.d.tv'] }, {}), 'tv');
  assert.equal(deviceKind({ types: ['oic.d.dishwasher'] }, {}), 'dishwasher');
  assert.equal(deviceKind({ types: ['oic.d.washer'] }, {}), 'washer');
  assert.equal(deviceKind({ types: [] }, { '/x/0': {} }), 'unknown');
});

test('discovery: capabilities come from the appliance, not from the model name', () => {
  const a = buildAcModel(wf.resources);
  const b = buildAcModel(std.resources);
  assert.equal(a.model, 'ARTIK051_PRAC_20K');
  assert.equal(b.model, 'ARTIK051_PRAC_20K');
  // Same model string, different comfort modes: only the unit that lists Nano gets WindFree.
  assert.ok(a.supports.presets.names.includes('windFree'));
  assert.ok(!b.supports.presets.names.includes('windFree'));
  assert.deepEqual(b.supports.presets.names, ['sleep', 'quiet', 'smart', 'fast']);
  assert.deepEqual(Object.keys(a.supports.modes).sort(), ['auto', 'cool', 'dry', 'fan', 'heat']);
  assert.deepEqual(a.supports.fan.speeds, { auto: '0', low: '1', medium: '2', high: '3', turbo: '4' });
  assert.deepEqual(a.supports.swing.options, ['off', 'both', 'vertical', 'horizontal']);
});

test('state: temperatures are Celsius with the appliance range and step', () => {
  const m = buildAcModel(wf.resources);
  assert.equal(m.state.temperatureUnit, 'C');
  assert.equal(m.state.currentTemperature, 27);
  assert.equal(m.state.targetTemperature, 26);
  assert.deepEqual(m.supports.temperatureRange, { min: 16, max: 30, step: 1 });
  assert.equal(m.supports.targetTemperature, 'ocf');
});

test('state: Fahrenheit appliances are converted to Celsius and back', () => {
  const res = structuredClone(wf.resources);
  res['/temperature/current/0'] = { units: 'F', temperature: 77, range: [61, 86] };
  res['/temperature/desired/0'] = { units: 'F', temperature: 72, range: [61, 86] };
  const m = buildAcModel(res);
  assert.equal(m.state.currentTemperature, 25);
  assert.equal(m.state.targetTemperature, 22.2);
  assert.equal(toCelsius(86, 'F'), 30);
  const [write] = acCommand(m, 'targetTemperature', 25);
  assert.deepEqual(write, { path: ['temperature', 'desired', '0'], body: { temperature: 77 } });
});

test('units: power is watts and energy is kWh, kept apart', () => {
  const m = buildAcModel(wf.resources);
  assert.equal(m.state.powerWatts, 0);
  assert.equal(m.state.energyKWh, 320.47); // 320466 Wh
  const res = structuredClone(wf.resources);
  res['/energy/consumption/vs/0'][`${V}instantaneousPower`] = '1.2';
  res['/energy/consumption/vs/0'][`${V}instantaneousPowerUnit`] = 'kW';
  assert.equal(buildAcModel(res).state.powerWatts, 1200);
  res['/energy/consumption/vs/0'][`${V}instantaneousPower`] = '-500'; // "no reading" marker
  assert.equal(buildAcModel(res).supports.powerWatts, undefined);
});

test('units: legacy boards without a declared unit count in 1/100 Wh', () => {
  const res = structuredClone(wf.resources);
  delete res['/wind/strength/vs/0'];
  res['/airflow/vs/0'] = { [`${V}speedLevel`]: '2', [`${V}direction`]: 'Fix' };
  res['/energy/consumption/vs/0'] = { [`${V}cumulativePower`]: '117430000' };
  assert.equal(buildAcModel(res).state.energyKWh, 1174.3);
  res['/energy/consumption/vs/0'][`${V}cumulativeUnit`] = 'Wh';
  assert.equal(buildAcModel(res).state.energyKWh, 117430);
});

test('state: display light token is inverted, humidity 0 is "not measuring"', () => {
  const m = buildAcModel(wf.resources); // Light_Off in the fixture
  assert.equal(m.supports.light, 'option');
  assert.equal(m.state.light, true);
  assert.equal(m.state.humidity, 42); // fivepercentHumidity wins
  const s = buildAcModel(std.resources); // humidity "0", no 5% field
  assert.equal(s.state.humidity, null);
  assert.equal(s.supports.humidity, 'unconfirmed');
});

test('state: alarms skip placeholders; a filter alarm is reported', () => {
  assert.deepEqual(buildAcModel(wf.resources).state.alarms, []);
  assert.deepEqual(buildAcModel(std.resources).state.alarms, ['FilterAlarm']);
  assert.equal(buildAcModel(std.resources).state.filterStatus, 'wash');
});

test('no phantom features: nothing is claimed that the appliance does not report', () => {
  const res = { '/mode/vs/0': { [`${V}supportedModes`]: ['Cool'], [`${V}modes`]: ['Cool'] }, '/power/vs/0': { [`${V}power`]: 'On' },
    '/temperatures/vs/0': { [`${V}items`]: [{ [`${V}desired`]: '24', [`${V}current`]: '25', [`${V}unit`]: 'Celsius' }] } };
  const m = buildAcModel(res);
  for (const key of ['fan', 'swing', 'presets', 'light', 'beep', 'filter', 'humidity', 'powerWatts', 'energyKWh', 'autoClean']) {
    assert.equal(m.supports[key], undefined, key);
  }
  assert.equal(acCommand(m, 'fan', 'turbo'), null);
  assert.equal(acCommand(m, 'mode', 'heat'), null);
  assert.equal(acCommand(m, 'preset', { name: 'windFree', on: true }), null);
  assert.equal(acCommand(m, 'light', true), null);
  const rows = acFeatureRows(m);
  assert.equal(rows.find((r) => r.id === 'voltage').device, false);
  assert.equal(rows.find((r) => r.id === 'occupancy').device, false);
});

test('commands: power, mode, temperature, fan Auto and Turbo', () => {
  const m = buildAcModel(wf.resources);
  assert.deepEqual(acCommand(m, 'power', true), [{ path: ['power', 'vs', '0'], body: { [`${V}power`]: 'On' } }]);
  assert.deepEqual(acCommand(m, 'mode', 'fan'), [{ path: ['mode', 'vs', '0'], body: { [`${V}modes`]: ['Wind'] } }]);
  assert.deepEqual(acCommand(m, 'fan', 'auto'), [{ path: ['wind', 'strength', 'vs', '0'], body: { [`${V}modes`]: '0' } }]);
  assert.deepEqual(acCommand(m, 'fan', 'turbo'), [{ path: ['wind', 'strength', 'vs', '0'], body: { [`${V}modes`]: '4' } }]);
  assert.deepEqual(acCommand(m, 'targetTemperature', 22.4), [{ path: ['temperature', 'desired', '0'], body: { temperature: 22 } }]);
  assert.deepEqual(acCommand(m, 'targetTemperature', 99)[0].body, { temperature: 30 }); // clamped to the appliance range
  assert.equal(acCommand(m, 'targetTemperature', Number.NaN), null);
  assert.deepEqual(acCommand(m, 'swing', 'off'), [{ path: ['wind', 'direction', 'vs', '0'], body: { [`${V}modes`]: 'Fix' } }]);
  assert.deepEqual(acCommand(m, 'light', true), [{ path: ['mode', 'vs', '0'], body: { [`${V}options`]: ['Light_Off'] } }]);
});

test('commands: vendor temperature channel when the OCF pair is absent', () => {
  const res = structuredClone(wf.resources);
  delete res['/temperature/current/0'];
  delete res['/temperature/desired/0'];
  const m = buildAcModel(res);
  assert.equal(m.supports.targetTemperature, 'vendor');
  assert.deepEqual(acCommand(m, 'targetTemperature', 23), [{
    path: ['temperatures', 'vs', '0'], body: { [`${V}items`]: [{ [`${V}id`]: '0', [`${V}desired`]: '23' }] },
  }]);
});

test('special modes: one slot, and switching one off never touches power or another mode', () => {
  const res = structuredClone(wf.resources);
  res['/mode/convenient/vs/0'][`${V}modes`] = 'Nano';
  const m = buildAcModel(res);
  assert.equal(m.state.preset, 'windFree');
  // Quiet is not active: turning it off sends nothing at all.
  assert.deepEqual(acCommand(m, 'preset', { name: 'quiet', on: false }), []);
  assert.deepEqual(acCommand(m, 'preset', { name: 'fast', on: false }), []);
  // WindFree is active: turning it off clears only the comfort slot.
  const off = acCommand(m, 'preset', { name: 'windFree', on: false });
  assert.deepEqual(off, [{ path: ['mode', 'convenient', 'vs', '0'], body: { [`${V}modes`]: 'Off' } }]);
  // Turning Quiet on replaces WindFree with a single write to the same slot.
  const on = acCommand(m, 'preset', { name: 'quiet', on: true });
  assert.deepEqual(on, [{ path: ['mode', 'convenient', 'vs', '0'], body: { [`${V}modes`]: 'Quiet' } }]);
  for (const w of [...off, ...on]) {
    assert.notEqual(w.path[0], 'power');
  }
  assert.ok(expectedAfter('preset', { name: 'quiet', on: true })({ preset: 'quiet' }));
  assert.ok(expectedAfter('preset', { name: 'quiet', on: false })({ preset: 'windFree' }));
});

test('special modes: legacy board needs Cool before WindFree when in Auto', () => {
  const res = structuredClone(wf.resources);
  delete res['/wind/strength/vs/0'];
  delete res['/mode/convenient/vs/0'];
  res['/airflow/vs/0'] = { [`${V}speedLevel`]: '0', [`${V}direction`]: 'Fix' };
  res['/mode/vs/0'][`${V}modes`] = ['Auto'];
  res['/mode/vs/0'][`${V}options`] = ['Comode_Off', 'Sleep_0', 'Light_On'];
  const m = buildAcModel(res);
  assert.equal(m.supports.presets.channel, 'comode');
  const writes = acCommand(m, 'preset', { name: 'windFree', on: true });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].body, { [`${V}modes`]: ['Cool'] });
  assert.equal(writes[0].settleMs, 3000);
  assert.deepEqual(writes[1].body, { [`${V}options`]: ['Comode_Nano'] });
  assert.deepEqual(acCommand(m, 'fan', 'turbo'), [{ path: ['airflow', 'vs', '0'], body: { [`${V}speedLevel`]: '4' } }]);
});

test('describe: feature table distinguishes readable from controllable, and where each shows', () => {
  const d = describeDevice(wf.identity, wf.resources);
  assert.equal(d.support, 'experimental');
  const row = (id) => d.features.find((r) => r.id === id);
  assert.deepEqual([row('powerWatts').where, row('powerWatts').write], ['eve', false]);
  assert.deepEqual([row('energyKWh').where, row('energyKWh').write], ['eve', false]);
  assert.deepEqual([row('fan.turbo').where, row('fan.turbo').write], ['home', true]);
  assert.equal(row('currentTemperature').write, false);
  assert.equal(row('alarms').where, 'plugin-ui');
  assert.ok(d.unknownResources.includes('/sensors/vs/0'));
  assert.ok(d.unusedOptionTokens.includes('MotionState'));
  const tv = describeDevice({ types: ['oic.d.tv'], di: 'x' }, {});
  assert.deepEqual([tv.support, tv.reason], ['unsupported', 'tv']);
});

test('diagnostics: secrets and identifiers are redacted, structure is kept', () => {
  const res = structuredClone(wf.resources);
  res['/information/vs/0'][`${V}serialNum`] = '0ABC1234567';
  res['/wirelessinfo/vs/0'] = { macaddressWiFi: 'AA:BB:CC:DD:EE:FF', ssid: 'MyHome', ip: '192.168.1.77' };
  const text = JSON.stringify(diagnosticsDump(wf.identity, res));
  for (const secret of ['0ABC1234567', 'AA:BB:CC:DD:EE:FF', 'MyHome', '192.168.1.77']) {
    assert.ok(!text.includes(secret), secret);
  }
  assert.ok(text.includes('/wirelessinfo/vs/0'));
  assert.ok(text.includes('ARTIK051_PRAC_20K'));
});

test('diagnostics: machine state is kept (it is not a MAC address)', async () => {
  const { redact, REDACTED } = await import('../src/redact.js');
  const out = redact({ currentMachineState: 'run', machineStates: ['pause', 'run', 'stop'], macaddressWiFi: 'aabbccddeeff' });
  assert.equal(out.currentMachineState, 'run');
  assert.deepEqual(out.machineStates, ['pause', 'run', 'stop']);
  assert.equal(out.macaddressWiFi, REDACTED);
});

test('washer model: tolerant state words, idle placeholders ignored', async () => {
  const { buildWasherModel, parseDuration } = await import('../src/capabilities/washer.js');
  const base = fixture('washer_topload').resources;
  const idle = buildWasherModel(base).state;
  assert.deepEqual([idle.inCycle, idle.remainingSeconds, idle.powerWatts, idle.energyKWh], [false, 0, 0, 1190.4]);
  assert.equal(idle.waterLitres, 289513); // the washer's water meter, read as millilitres
  const with_ = (vs, std = {}) => buildWasherModel({ ...base,
    '/operational/state/vs/0': { ...base['/operational/state/vs/0'], ...vs },
    '/operational/state/0': { ...base['/operational/state/0'], ...std } }).state;
  assert.equal(with_({ 'x.com.samsung.da.state': 'Run' }).running, true);
  assert.equal(with_({ 'x.com.samsung.da.state': 'Pause' }).paused, true);
  assert.equal(with_({}, { currentMachineState: 'Running' }).running, true);
  assert.equal(with_({ 'x.com.samsung.da.state': 'Finish' }).finished, true);
  // A real top loader at the end of a cycle: still "Run", stage "Finish", 100%. SmartThings says "Cycle complete" then.
  const end = with_({ 'x.com.samsung.da.state': 'Run', 'x.com.samsung.da.progress': 'Finish', 'x.com.samsung.da.progressPercentage': '100' });
  assert.deepEqual([end.running, end.inCycle, end.finished], [false, false, true]);
  const spin = with_({ 'x.com.samsung.da.state': 'Run', 'x.com.samsung.da.progress': 'Spin' });
  assert.deepEqual([spin.running, spin.finished], [true, false]);
  // Controls: each list of the washer's own values is a choice, one switch per value.
  const { washerControls, kidsLock } = await import('../src/capabilities/washer.js');
  const controls = washerControls(base);
  assert.deepEqual([controls.ctlSpin.kind, controls.ctlWaterLevel.kind, controls.ctlWaterTemp.kind], ['choice', 'choice', 'choice']);
  assert.deepEqual(controls.ctlWaterTemp.values, ['Cold', 'Warm', 'Hot']); // "None" is not a choice
  assert.equal(controls.ctlWaterTemp.writes('Hot')[0].body['x.com.samsung.da.waterValve'], 'Hot');
  // The panel's extras: on or off among the course options, each a switch; smart control is the remote-control flag.
  const { washerToggles } = await import('../src/capabilities/washer.js');
  assert.deepEqual([washerToggles(base).SuperSpeed, washerToggles(base).BubbleSoak, washerToggles(base).BubbleStorm], [false, false, false]);
  assert.deepEqual(controls.ctlSuperSpeed.writes(true), [{ path: ['course', 'vs', '0'], body: { 'x.com.samsung.da.options': ['SuperSpeed_On'] } }]);
  assert.equal(controls.ctlSuperSpeed.current(), false);
  assert.equal(controls.ctlSmartControl.current(), false);
  assert.deepEqual(controls.ctlSmartControl.writes(true).map((w) => w.path.join('/')), ['remotectrl/vs/0', 'remotectrl/0']);
  // Courses: the washer's own list, in its own order; a course is set in two forms, tried in order.
  const { washerCourses, courseName } = await import('../src/capabilities/washer.js');
  assert.deepEqual(washerCourses(base), ['01', '2B', '04', 'B1', '90', '06', '91', '08', '82', '87', '4D']);
  assert.deepEqual([courseName(base, '08'), courseName(base, '2b'), courseName(base, '87'), courseName(base, 'FF')], ['Rinse + Spin', 'AI Wash', 'Downloaded', null]);
  assert.equal(controls.ctlCourse.kind, 'choice');
  assert.deepEqual(controls.ctlCourse.writes('08'), [
    { path: ['st', 'washercourse', 'vs', '0'], body: { 'x.com.samsung.da.st.washerMode': 'Table_02_Course_08' } },
    { path: ['course', 'vs', '0'], body: { 'x.com.samsung.da.options': ['Course_08'] } }]);
  // A washer without a readable list keeps the "next" press.
  const noList = structuredClone(base);
  delete noList['/course/vs/0']['x.com.samsung.da.supportedOptions'];
  assert.equal(washerControls(noList).ctlCourse.kind, 'press');
  assert.equal(washerControls(noList).ctlCourse.writes(true)[0].body['x.com.samsung.da.st.washerMode'], 'Table_02_Course_02');
  // Child lock: the plain value decides; the vendor word only where there is no plain value.
  assert.equal(kidsLock({ '/kidslock/0': { value: false }, '/kidslock/vs/0': { 'x.com.samsung.da.kidsLock': 'On' } }), false);
  assert.equal(kidsLock({ '/kidslock/0': { value: true }, '/kidslock/vs/0': { 'x.com.samsung.da.kidsLock': 'Ready' } }), true);
  assert.equal(kidsLock({ '/kidslock/vs/0': { 'x.com.samsung.da.kidsLock': 'On' } }), true);
  assert.equal(parseDuration('01:07:00'), 4020);
  assert.equal(parseDuration('soon'), null);
});
