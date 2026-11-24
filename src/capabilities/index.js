import { buildAcModel, looksLikeAc, HREF } from './ac.js';
import { redact } from '../redact.js';
import { buildWasherModel, LAUNDRY_CONSUMED, LAUNDRY_KINDS, washerFeatureRows } from './washer.js';

/** Support levels shown to the user. Nothing is called "confirmed" until it
 * has been exercised on real hardware by the project. */
export const SUPPORT = {
  experimental: 'experimental', // mapped from LocalThings data, awaiting hardware confirmation
  diagnosticsOnly: 'diagnostics-only', // reachable, resources listed, no HomeKit services yet
  unsupported: 'unsupported',
};

const TYPE_LABELS = [
  [/airconditioner/i, 'airConditioner'],
  [/dishwasher/i, 'dishwasher'], // before "washer": the longer name contains the shorter one
  [/washer/i, 'washer'],
  [/dryer/i, 'dryer'],
  [/\btv\b|oic\.d\.tv/i, 'tv'],
  [/refrigerator/i, 'refrigerator'],
  [/oven/i, 'oven'],
  [/airpurifier/i, 'airPurifier'],
  [/robotcleaner/i, 'robotVacuum'],
];

export function deviceKind(identity, resources) {
  const types = identity?.types ?? [];
  for (const [pattern, kind] of TYPE_LABELS) {
    if (types.some((t) => pattern.test(t))) {
      return kind;
    }
  }
  if (looksLikeAc(resources, types)) {
    return 'airConditioner';
  }
  if (resources?.['/washer/vs/0'] || resources?.['/course/vs/0']) {
    return 'washer';
  }
  return 'unknown';
}

/** The stable id a device is keyed on: the OCF device id, never IP or name. */
export function stableDeviceId(identity) {
  return identity?.di || identity?.pi || null;
}

const AC_CONSUMED = new Set(Object.values(HREF));
// Present on every unit and carrying nothing a user controls.
const IGNORED = new Set([
  '/configuration/vs/0', '/diagnosis/vs/0', '/file/information/vs/0', '/timezone/vs/0',
  '/realtimenotiforclient/vs/0', '/personality/presence/vs/0', '/energy/consumption/0',
]);

/**
 * Describe a probed device: what it is, what the plugin will do with it and
 * what it reports that the plugin does not use yet.
 */
export function describeDevice(identity, resources) {
  const kind = deviceKind(identity, resources);
  const hrefs = Object.keys(resources ?? {}).sort();
  const base = {
    kind,
    deviceId: stableDeviceId(identity),
    model: null,
    support: SUPPORT.diagnosticsOnly,
    reason: null,
    features: [],
    unknownResources: [],
  };

  if (kind === 'airConditioner') {
    const model = buildAcModel(resources);
    base.model = model.model || identity?.platformModel || null;
    base.firmware = model.firmware;
    base.support = SUPPORT.experimental;
    base.features = acFeatureRows(model);
    base.unknownResources = hrefs.filter((h) => !AC_CONSUMED.has(h) && !IGNORED.has(h));
    base.unusedOptionTokens = Object.keys(model.tokens)
      .filter((t) => !['Light', 'Volume', 'OutdoorTemp', 'Comode', 'Sleep'].includes(t)).sort();
    return base;
  }

  const info = resources?.['/information/vs/0'] ?? {};
  base.model = info['x.com.samsung.da.description'] || identity?.platformModel || null;
  base.unknownResources = hrefs;
  if (LAUNDRY_KINDS.has(kind) && buildWasherModel(resources).supports.cycle) {
    base.support = SUPPORT.experimental;
    base.features = washerFeatureRows(buildWasherModel(resources));
    base.unknownResources = hrefs.filter((h) => !LAUNDRY_CONSUMED.has(h) && !IGNORED.has(h));
    return base;
  }
  if (kind === 'tv') {
    base.support = SUPPORT.unsupported;
    base.reason = 'tv';
  } else {
    base.reason = kind === 'unknown' ? 'unknown-type' : 'not-mapped-yet';
  }
  return base;
}

/** Redacted dump for the diagnostics download. */
export function diagnosticsDump(identity, resources) {
  const described = describeDevice(identity, resources);
  return redact({
    kind: described.kind,
    model: described.model,
    types: identity?.types ?? [],
    unknownResources: described.unknownResources,
    unusedOptionTokens: described.unusedOptionTokens ?? [],
    resources,
  });
}

/**
 * One row per function or measurement:
 * { id, device, plugin, where, write, value, note }
 *   device : true | false | 'unconfirmed'   (does the appliance report it)
 *   where  : 'home' | 'eve' | 'plugin-ui' | 'none'
 *   write  : whether the plugin sends commands for it
 */
export function acFeatureRows(model) {
  const { supports: s, state: st } = model;
  const rows = [];
  const add = (id, device, where, write, value, note = null) => rows.push({
    id, device, plugin: device !== false, where: device === false ? 'none' : where, write: Boolean(device) && write, value, note,
  });

  add('power', s.power ? true : false, 'home', true, st.power);
  for (const m of ['cool', 'heat', 'auto', 'dry', 'fan']) {
    add(`mode.${m}`, Boolean(s.modes?.[m]), 'home', true, st.mode === m, ['dry', 'fan'].includes(m) ? 'switch' : null);
  }
  add('currentTemperature', st.currentTemperature !== null, 'home', false, st.currentTemperature);
  add('targetTemperature', Boolean(s.targetTemperature), 'home', true, st.targetTemperature);
  add('humidity', s.humidity ?? false, 'home', false, st.humidity ?? null,
    s.humidity === 'unconfirmed' ? 'reports-zero' : null);
  for (const f of ['auto', 'low', 'medium', 'high', 'turbo']) {
    add(`fan.${f}`, s.fan ? f in s.fan.speeds : false, 'home', true, st.fan === f);
  }
  add('swing', Boolean(s.swing), 'home', true, st.swing ?? null, s.swing ? s.swing.options.join('/') : null);
  for (const p of ['windFree', 'fast', 'quiet', 'sleep', 'smart', 'comfort', 'twoStep', 'motionDirect', 'motionIndirect']) {
    const has = Boolean(s.presets?.names.includes(p)) || (p === 'windFree' && Boolean(s.windFreeResource));
    add(`preset.${p}`, has, 'home', true, st.preset === p || (p === 'windFree' && st.windFreeResource === true));
  }
  add('light', Boolean(s.light), 'home', true, st.light ?? null, s.light ? 'on-off-only' : null);
  add('beep', Boolean(s.beep), 'home', true, st.beep ?? null);
  add('autoClean', Boolean(s.autoClean), 'home', true, st.autoClean ?? null);
  add('filter', Boolean(s.filter), 'home', false, st.filterUsagePercent ?? null, st.filterStatus ?? null);
  add('alarms', Boolean(s.alarms), 'plugin-ui', false, (st.alarms ?? []).join(', ') || 'none');
  add('powerWatts', Boolean(s.powerWatts), 'eve', false, st.powerWatts ?? null, 'W');
  add('energyKWh', Boolean(s.energyKWh), 'eve', false, st.energyKWh ?? null, 'kWh');
  add('voltage', false, 'none', false, null, 'not-reported');
  add('current', false, 'none', false, null, 'not-reported');
  add('outdoorTemperature', Boolean(s.outdoorTemperature), 'home', false, st.outdoorTemperature ?? null, 'derived-token');
  add('occupancy', false, 'none', false, null, 'no-known-resource');
  return rows;
}
