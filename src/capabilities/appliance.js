/**
 * Every Samsung appliance that is neither an air conditioner, a TV nor a laundry
 * appliance with a cycle: air purifiers, dehumidifiers, refrigerators, robot
 * vacuums, ovens and the like.
 *
 * One reader for all of them. It looks at what the appliance reports and turns
 * each reading it knows into a "part". A part is either a reading (shown as a
 * sensor) or a control (a switch or a speed). Controls are marked as trials
 * until an owner of that type confirms them on a real appliance.
 *
 * Resource names and value shapes follow the recorded appliances and the
 * capability registry of mbillow/localthings (MIT). Which HomeKit service
 * suits which function follows aziz66/homebridge-smartthings (Apache-2.0).
 * Nothing here touches air conditioners, washers or TVs.
 */
import { alarmCodes, kidsLock, parseDuration } from './washer.js';

const V = 'x.com.samsung.da.';
const lower = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const number = (v) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
};
const onOff = (v) => (['on', 'true'].includes(lower(String(v))) ? true : ['off', 'false'].includes(lower(String(v))) ? false : null);

/** Kinds that cook. They are shown, never commanded: starting heat from afar is not ours to do. */
export const COOKING_KINDS = new Set(['oven', 'range', 'microwave', 'cooktop']);
/** Kinds whose /mode/vs/0 lists fan speeds the owner chooses between. */
const SPEED_KINDS = new Set(['airPurifier', 'dehumidifier']);

/** Resources read here; anything else is listed as not used yet. */
const CONSUMED = [
  /^\/power\/vs\/0$/, /^\/mode\/vs\/0$/, /^\/sensors\/vs\/0$/, /^\/temperatures\/vs\/0$/, /^\/doors\/vs\/0$/,
  /^\/humidity\/vs\/0$/, /^\/energy\/battery\/vs\/0$/, /^\/energy\/consumption\/vs\/0$/, /^\/kidslock\/(vs\/)?0$/,
  /^\/alarms\/vs\/0$/, /^\/refrigeration\/vs\/0$/, /^\/operational\/state\/vs\/0$/, /^\/information\/vs\/0$/,
  /\/filter\/[a-z]+\/vs\/0$/,
];
export const isApplianceResource = (href) => CONSUMED.some((p) => p.test(href));

// Slowest first. A name outside this list keeps the order the appliance gave it.
const SPEED_RANK = ['sleep', 'quiet', 'silence', 'windfree', 'low', 'mid', 'medium', 'high', 'max', 'turbo', 'power'];
const AUTO_SPEEDS = new Set(['smart', 'auto', 'ai']);
/** Modes that are a programme, not a speed (a dehumidifier's "ClothesDrying"). */
const rank = (name) => SPEED_RANK.indexOf(lower(name));

function speeds(resources, kind) {
  const rep = resources['/mode/vs/0'];
  const listed = rep?.[`${V}supportedModes`];
  if (!SPEED_KINDS.has(kind) || !Array.isArray(listed)) {
    return null;
  }
  const names = listed.filter((m) => typeof m === 'string' && m);
  const auto = names.find((m) => AUTO_SPEEDS.has(lower(m))) ?? null;
  const manual = names.filter((m) => rank(m) >= 0).sort((a, b) => rank(a) - rank(b));
  if (!auto && manual.length === 0) {
    return null;
  }
  const now = Array.isArray(rep[`${V}modes`]) ? rep[`${V}modes`].find((m) => typeof m === 'string') ?? null : null;
  return { auto, manual, current: now };
}

const AIR_TYPES = { Dust: 'pm10', FineDust: 'pm25', SuperFineDust: 'pm1', CleanLevel: 'level' };

function airQuality(resources) {
  const items = resources['/sensors/vs/0']?.[`${V}items`];
  if (!Array.isArray(items)) {
    return null;
  }
  const out = {};
  for (const item of items) {
    const key = AIR_TYPES[item?.[`${V}type`]];
    const raw = item?.[`${V}value`];
    const value = number(Array.isArray(raw) ? raw[0] : raw);
    if (key && value !== null) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : null;
}

function filters(resources) {
  const out = [];
  for (const href of Object.keys(resources).sort()) {
    const m = /\/filter\/([a-z]+)\/vs\/0$/.exec(href);
    const rep = resources[href];
    if (!m || !rep || typeof rep !== 'object') {
      continue;
    }
    const used = number(rep[`${V}filterUsage`]); // a percentage on every family on record
    const status = lower(rep[`${V}filterStatus`]);
    if (status === 'notused' || (used === null && !status)) {
      continue;
    }
    out.push({
      name: m[1].replace(/filter$/, '') || 'main',
      life: used === null ? null : Math.min(100, Math.max(0, 100 - used)),
      change: ['wash', 'replace', 'clean', 'change'].includes(status),
    });
  }
  return out;
}

const celsius = (value, unit) => (/^f/i.test(String(unit ?? '')) ? Math.round(((value - 32) * 5 / 9) * 10) / 10 : value);

function temperatures(resources, kind) {
  const items = resources['/temperatures/vs/0']?.[`${V}items`];
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item, i) => {
    const current = number(item?.[`${V}current`]);
    const name = String(item?.[`${V}description`] ?? '').trim();
    const unit = item?.[`${V}unit`];
    const [desired, min, max] = ['desired', 'minimum', 'maximum'].map((k) => number(item?.[`${V}${k}`]));
    return current === null ? null : {
      index: i,
      name: name && lower(name) !== 'temperature' ? name : (kind === 'oven' ? 'Oven' : `Zone ${i + 1}`),
      celsius: celsius(current, unit),
      // A zone that also says what it is set to, and within which bounds, can be set.
      set: desired === null || min === null || max === null || min >= max ? null : {
        id: String(item[`${V}id`] ?? i), fahrenheit: /^f/i.test(String(unit ?? '')),
        celsius: celsius(desired, unit), min: celsius(min, unit), max: celsius(max, unit),
      },
    };
  }).filter(Boolean);
}

function doors(resources) {
  const items = resources['/doors/vs/0']?.[`${V}items`];
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item, i) => {
    const state = lower(item?.[`${V}openState`]);
    return state ? { index: i, name: items.length > 1 ? `Door ${i + 1}` : 'Door', open: state === 'open' } : null;
  }).filter(Boolean);
}

/** A robot vacuum's /mode/vs/0 is a list of tokens: Control_* is what it is doing now. */
function vacuum(resources, kind) {
  const tokens = resources['/mode/vs/0']?.[`${V}modes`];
  if (kind !== 'robotVacuum' || !Array.isArray(tokens)) {
    return null;
  }
  const control = tokens.find((t) => typeof t === 'string' && t.startsWith('Control_'))?.slice(8) ?? null;
  const program = tokens.find((t) => typeof t === 'string' && t.startsWith('Cleaning_'))?.slice(9) ?? null;
  if (control === null && program === null) {
    return null;
  }
  const cleaning = control !== null
    ? ['Cleaning', 'Point', 'PatternMap'].includes(control)
    : program !== null && program !== 'Stop';
  return { cleaning, doing: control ?? program };
}

const BUSY = new Set(['run', 'running', 'active', 'cooking', 'preheat', 'preheating']);

/**
 * @returns {{ kind, model, parts: Array, state: object }}
 *   part: { id, type, control, value, ... }
 *   type: 'power' | 'speed' | 'airQuality' | 'filter' | 'temperature' | 'humidity' | 'door' |
 *         'battery' | 'clean' | 'boost' | 'setpoint' | 'targetHumidity' | 'running' | 'kidsLock' | 'alert' | 'energy'
 */
export function buildApplianceModel(resources = {}, kind = 'unknown') {
  const parts = [];
  const cooking = COOKING_KINDS.has(kind);
  const info = resources['/information/vs/0'] ?? {};

  const power = onOff(resources['/power/vs/0']?.[`${V}power`]);
  const robot = vacuum(resources, kind);
  if (power !== null && !robot && !cooking) { // an oven's power is not ours to switch; its "running" part says what it does
    parts.push({ id: 'power', type: 'power', control: true, value: power });
  }
  const fan = speeds(resources, kind);
  if (fan) {
    parts.push({ id: 'speed', type: 'speed', control: true, value: fan.current, auto: fan.auto, manual: fan.manual });
  }
  if (robot) {
    parts.push({ id: 'clean', type: 'clean', control: true, value: robot.cleaning, doing: robot.doing });
  }
  const air = airQuality(resources);
  if (air) {
    parts.push({ id: 'airQuality', type: 'airQuality', control: false, value: air });
  }
  for (const f of filters(resources)) {
    parts.push({ id: `filter.${f.name}`, type: 'filter', control: false, value: f.life, change: f.change, name: f.name });
  }
  for (const t of temperatures(resources, kind)) {
    parts.push({ id: `temperature.${t.index}`, type: 'temperature', control: false, value: t.celsius, name: t.name });
    if (t.set && kind === 'refrigerator') {
      parts.push({
        id: `setpoint.${t.index}`, type: 'setpoint', control: true, value: t.set.celsius, name: t.name, current: t.celsius,
        zone: t.set.id, fahrenheit: t.set.fahrenheit, min: t.set.min, max: t.set.max,
      });
    }
  }
  const humidity = number(resources['/humidity/vs/0']?.[`${V}humidity`]);
  if (humidity !== null && humidity > 0) {
    parts.push({ id: 'humidity', type: 'humidity', control: false, value: humidity });
  }
  const wantedHumidity = number(resources['/humidity/vs/0']?.[`${V}desiredHumidity`]);
  if (wantedHumidity !== null && kind === 'dehumidifier') {
    parts.push({
      id: 'targetHumidity', type: 'targetHumidity', control: true, value: wantedHumidity,
      step: number(resources['/humidity/vs/0'].increment) || 1, current: humidity ?? 0,
    });
  }
  for (const d of doors(resources)) {
    parts.push({ id: `door.${d.index}`, type: 'door', control: false, value: d.open, name: d.name });
  }
  const cold = resources['/refrigeration/vs/0'];
  for (const [field, id] of [['rapidFridge', 'boost.fridge'], ['rapidFreezing', 'boost.freezer']]) {
    const value = onOff(cold?.[`${V}${field}`]);
    if (value !== null) {
      parts.push({ id, type: 'boost', control: true, value, field });
    }
  }
  const batteryRep = resources['/energy/battery/vs/0'];
  const battery = number(batteryRep?.[`${V}battery`] ?? batteryRep?.[`${V}batteryCharge`]);
  if (battery !== null) {
    parts.push({ id: 'battery', type: 'battery', control: false, value: Math.min(100, Math.max(0, battery)) });
  }
  const op = resources['/operational/state/vs/0'];
  if (cooking && op && lower(op[`${V}state`])) {
    parts.push({
      id: 'running', type: 'running', control: false, value: BUSY.has(lower(op[`${V}state`])),
      remainingSeconds: parseDuration(op[`${V}remainingTime`]) ?? 0,
    });
  }
  const locked = kidsLock(resources);
  if (locked !== null) {
    parts.push({ id: 'kidsLock', type: 'kidsLock', control: false, value: locked });
  }
  if ('/alarms/vs/0' in resources) {
    parts.push({ id: 'alert', type: 'alert', control: false, value: alarmCodes(resources) });
  }
  const energy = resources['/energy/consumption/vs/0'] ?? {};
  const watts = number(energy[`${V}instantaneousPower`]);
  const total = number(energy[`${V}cumulativePower`]);
  if (watts !== null || total !== null) {
    const unit = lower(energy[`${V}cumulativeUnit`]) || 'wh';
    parts.push({
      id: 'energy', type: 'energy', control: false,
      value: { watts: watts === null ? null : Math.max(0, watts), kWh: total === null ? null : Math.round((unit === 'kwh' ? total : total / 1000) * 100) / 100 },
    });
  }
  return { kind, model: info[`${V}description`] || null, parts };
}

/** Parts that start switched off: extras the owner asks for. Everything else starts on. */
const OFF_BY_DEFAULT = new Set(['kidsLock', 'alert']);
export const partDefault = (part) => !OFF_BY_DEFAULT.has(part.type);
/** Whether the owner wants this part in Apple Home. */
export const partWanted = (part, features = {}) => (typeof features?.[part.id] === 'boolean' ? features[part.id] : partDefault(part));

/** The writes that carry out a command on a control part. */
export function applianceWrites(part, value) {
  switch (part.type) {
    case 'power':
      return [{ path: ['power', 'vs', '0'], body: { [`${V}power`]: value ? 'On' : 'Off' } }];
    case 'speed':
      return [{ path: ['mode', 'vs', '0'], body: { [`${V}modes`]: [String(value)] } }];
    case 'clean':
      // Off sends the robot home, which is what "stop" means to its owner.
      return [{ path: ['mode', 'vs', '0'], body: { [`${V}modes`]: [value ? 'Cleaning_Auto' : 'Control_Homing'] } }];
    case 'boost':
      return [{ path: ['refrigeration', 'vs', '0'], body: { [`${V}${part.field}`]: value ? 'On' : 'Off' } }];
    case 'setpoint': {
      // The appliance is spoken to in its own unit, within its own bounds.
      const inside = Math.min(part.max, Math.max(part.min, Number(value)));
      const own = part.fahrenheit ? inside * 9 / 5 + 32 : inside;
      return [{ path: ['temperatures', 'vs', '0'], body: { [`${V}items`]: [{ [`${V}id`]: part.zone, [`${V}desired`]: String(Math.round(own)) }] } }];
    }
    case 'targetHumidity': {
      const stepped = Math.round(Number(value) / part.step) * part.step;
      return [{ path: ['humidity', 'vs', '0'], body: { [`${V}desiredHumidity`]: String(Math.min(100, Math.max(0, stepped))) } }];
    }
    default:
      throw new Error(`No command for ${part.id}.`);
  }
}

const show = (part) => {
  switch (part.type) {
    case 'airQuality': return Object.entries(part.value).map(([k, v]) => `${k} ${v}`).join(', ');
    case 'alert': return part.value.join(', ') || 'none';
    case 'energy': return part.value.watts;
    default: return part.value;
  }
};
const NOTE = { filter: '%', temperature: '°C', setpoint: '°C', humidity: '%', targetHumidity: '%', battery: '%', energy: 'W' };

/** Rows for the settings page, in the shape the other appliance kinds use. `trial` marks a control not yet confirmed on a real appliance. */
export function applianceFeatureRows(model) {
  return model.parts.map((part) => ({
    id: part.id, type: part.type, name: part.name ?? null, device: true, plugin: true,
    where: part.type === 'energy' ? 'eve' : 'home', write: part.control, trial: part.control,
    value: show(part), note: NOTE[part.type] ?? null, default: partDefault(part),
  }));
}
