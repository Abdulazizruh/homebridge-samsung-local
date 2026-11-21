/**
 * Air-conditioner capability map: OCF resources -> a normalized model, and
 * normalized commands -> OCF writes. Pure functions, no I/O, no HomeKit.
 *
 * The resource paths, field names, value codes and the device quirks noted
 * below are ported from the air-conditioner registry of mbillow/localthings
 * (MIT, (c) 2026 Marc Billow). See THIRD_PARTY_NOTICES.md.
 */

export const HREF = {
  mode: '/mode/vs/0',
  power: '/power/0',
  powerVs: '/power/vs/0',
  tempCurrent: '/temperature/current/0',
  tempDesired: '/temperature/desired/0',
  tempControl: '/temperature/control/vs/0',
  tempsVs: '/temperatures/vs/0',
  windStrength: '/wind/strength/vs/0',
  windDirection: '/wind/direction/vs/0',
  windOscillation: '/wind/oscillation/vs/0',
  convenient: '/mode/convenient/vs/0',
  airflow: '/airflow/vs/0',
  humidity: '/humidity/vs/0',
  humidityOcf: '/humidity/0',
  energy: '/energy/consumption/vs/0',
  filter: '/filter/airdustfilter/vs/0',
  autoClean: '/option/autoclean/vs/0',
  light: '/light/vs/0',
  windFree: '/modeoption/windfree/vs/0',
  alarms: '/alarms/vs/0',
  info: '/information/vs/0',
};

const V = 'x.com.samsung.da.';

/** Samsung fan codes and the names SmartThings uses for the same speeds. */
export const FAN_CODE_TO_NAME = { 0: 'auto', 1: 'low', 2: 'medium', 3: 'high', 4: 'turbo' };
const FAN_LABEL_TO_NAME = { auto: 'auto', low: 'low', mid: 'medium', medium: 'medium', high: 'high', turbo: 'turbo' };

/** /mode/vs/0 codes -> normalized mode (same names SmartThings uses, plus fan). */
const MODE_TO_NAME = {
  Cool: 'cool', CoolClean: 'cool', Heat: 'heat', HeatClean: 'heat', Dry: 'dry', DryClean: 'dry',
  Wind: 'fan', Fan: 'fan', Auto: 'auto', AIComfort: 'auto',
};

/** Comfort ("optional") modes. SmartThings calls Nano "windFree" and Speed "speed". */
export const PRESETS = {
  windFree: 'Nano', fast: 'Speed', quiet: 'Quiet', sleep: 'Sleep', smart: 'Smart',
  comfort: 'Comfort', twoStep: '2Step', motionDirect: 'MotionDirect', motionIndirect: 'MotionIndirect',
};
const CODE_TO_PRESET = Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [v, k]));

const SWING = { Fix: 'off', All: 'both', Up_And_Low: 'vertical', Left_And_Right: 'horizontal' };
const SWING_TO_CODE = Object.fromEntries(Object.entries(SWING).map(([k, v]) => [v, k]));

function num(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function first(v) {
  return Array.isArray(v) ? (v.length ? v[0] : null) : (v ?? null);
}

function list(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

function rep(resources, href) {
  const r = resources?.[href];
  return r && typeof r === 'object' && !Array.isArray(r) ? r : null;
}

function tempsVsItem(resources) {
  const items = rep(resources, HREF.tempsVs)?.[`${V}items`];
  return Array.isArray(items) && items[0] && typeof items[0] === 'object' ? items[0] : {};
}

export function optionTokens(resources) {
  const out = {};
  for (const token of list(rep(resources, HREF.mode)?.[`${V}options`])) {
    const i = token.indexOf('_');
    if (i > 0) {
      out[token.slice(0, i)] = token.slice(i + 1);
    }
  }
  return out;
}

function unitOf(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  return s.startsWith('F') ? 'F' : 'C';
}

export function toCelsius(value, unit) {
  if (value === null) {
    return null;
  }
  return unit === 'F' ? Math.round(((value - 32) * 5 / 9) * 10) / 10 : value;
}

export function fromCelsius(value, unit) {
  return unit === 'F' ? (value * 9) / 5 + 32 : value;
}

function isLegacyBoard(resources) {
  return Boolean(rep(resources, HREF.airflow)) && !rep(resources, HREF.windStrength);
}

/** Whether these resources look like an air conditioner at all. */
export function looksLikeAc(resources, types = []) {
  if (types.some((t) => /oic\.d\.airconditioner/i.test(t))) {
    return true;
  }
  const mode = rep(resources, HREF.mode);
  const supported = list(mode?.[`${V}supportedModes`]);
  return supported.some((m) => m === 'Cool' || m === 'Heat' || m === 'Dry')
    && Boolean(rep(resources, HREF.tempsVs) || rep(resources, HREF.tempDesired));
}

/**
 * Build the normalized model. Every field is `null` (or absent from
 * `supports`) when the appliance does not report it: nothing is assumed from
 * the model name or from what another unit supports.
 */
export function buildAcModel(resources) {
  const supports = {};
  const state = {};
  const tokens = optionTokens(resources);
  const legacy = isLegacyBoard(resources);

  // Power: vendor resource first, the OCF mirror is stale on some boards.
  const powerVs = rep(resources, HREF.powerVs)?.[`${V}power`];
  if (powerVs !== undefined && powerVs !== null) {
    state.power = String(powerVs).toLowerCase() === 'on';
    supports.power = 'vendor';
  } else if (rep(resources, HREF.power) && 'value' in rep(resources, HREF.power)) {
    state.power = Boolean(rep(resources, HREF.power).value);
    supports.power = 'ocf';
  } else {
    state.power = null;
  }

  // Mode
  const modeRep = rep(resources, HREF.mode);
  const modeCode = first(modeRep?.[`${V}modes`]);
  const supportedModeCodes = list(modeRep?.[`${V}supportedModes`]);
  state.modeCode = modeCode;
  state.mode = MODE_TO_NAME[modeCode] ?? null;
  supports.modes = {};
  for (const code of supportedModeCodes) {
    const name = MODE_TO_NAME[code];
    // First spelling wins, except a plain code beats its "Clean"/AI variant.
    if (name && (!supports.modes[name] || ['Cool', 'Heat', 'Dry', 'Auto'].includes(code))) {
      supports.modes[name] = code;
    }
  }

  // Temperatures. Boards with the OCF pair honour it and ignore the vendor
  // resource; boards without it are the reverse (LocalThings, climate.py).
  const ocfCurrent = rep(resources, HREF.tempCurrent);
  const ocfDesired = rep(resources, HREF.tempDesired);
  const vs = tempsVsItem(resources);
  const ocfAuthoritative = Boolean(ocfCurrent && Object.keys(ocfCurrent).length);
  const unit = unitOf(ocfDesired?.units ?? ocfCurrent?.units ?? vs[`${V}unit`]);
  state.temperatureUnit = unit;
  const current = num(ocfCurrent?.temperature) ?? num(vs[`${V}current`]);
  const desiredOcf = num(ocfDesired?.temperature);
  const desiredVs = num(vs[`${V}desired`]);
  const desired = ocfAuthoritative ? (desiredOcf ?? desiredVs) : (desiredVs ?? desiredOcf);
  state.currentTemperature = toCelsius(current, unit);
  state.targetTemperature = toCelsius(desired, unit);
  if (desired !== null) {
    supports.targetTemperature = ocfAuthoritative && ocfDesired ? 'ocf' : 'vendor';
    const range = Array.isArray(ocfDesired?.range) && ocfDesired.range.length === 2 ? ocfDesired.range.map(num) : null;
    const lo = range?.[0] ?? num(vs[`${V}minimum`]);
    const hi = range?.[1] ?? num(vs[`${V}maximum`]);
    const step = num(rep(resources, HREF.tempControl)?.increment)
      ?? num(rep(resources, HREF.tempControl)?.[`${V}increment`])
      ?? num(vs[`${V}increment`]) ?? 1;
    supports.temperatureRange = {
      min: lo !== null ? toCelsius(lo, unit) : 16,
      max: hi !== null ? toCelsius(hi, unit) : 30,
      step: step > 0 ? step : 1,
    };
  }

  // Humidity. A plain `humidity` of 0 means "not measuring" on ARTIK051.
  const hum = rep(resources, HREF.humidity);
  if (hum && `${V}fivepercentHumidity` in hum) {
    state.humidity = num(hum[`${V}fivepercentHumidity`]);
    supports.humidity = true;
  } else if (hum && `${V}humidity` in hum) {
    const h = num(hum[`${V}humidity`]);
    state.humidity = h || null;
    supports.humidity = h ? true : 'unconfirmed';
  }

  // Fan speed
  const wind = rep(resources, HREF.windStrength);
  if (wind) {
    const codes = list(wind[`${V}supportedModes`]);
    const labels = list(wind[`${V}modesName`]);
    supports.fan = { channel: 'wind', speeds: {} };
    codes.forEach((code, i) => {
      const name = FAN_LABEL_TO_NAME[String(labels[i] ?? '').toLowerCase()] ?? FAN_CODE_TO_NAME[code];
      if (name && !(name in supports.fan.speeds)) {
        supports.fan.speeds[name] = code;
      }
    });
    const code = first(wind[`${V}modes`]);
    state.fanCode = code;
    state.fan = Object.entries(supports.fan.speeds).find(([, c]) => c === code)?.[0] ?? null;
  } else if (legacy) {
    // The legacy resource lists no supported speeds; the full scale is offered.
    supports.fan = { channel: 'airflow', speeds: { auto: '0', low: '1', medium: '2', high: '3', turbo: '4' } };
    const code = String(rep(resources, HREF.airflow)[`${V}speedLevel`] ?? '');
    state.fanCode = code;
    state.fan = FAN_CODE_TO_NAME[code] ?? null;
  }

  // Swing
  const direction = rep(resources, HREF.windDirection);
  const oscillation = rep(resources, HREF.windOscillation);
  if (direction && list(direction[`${V}supportedModes`]).length) {
    const options = list(direction[`${V}supportedModes`]).map((c) => SWING[c]).filter(Boolean);
    supports.swing = { channel: 'direction', options };
    state.swing = SWING[direction[`${V}modes`]] ?? null;
  } else if (oscillation) {
    supports.swing = { channel: 'oscillation', options: ['off', 'vertical', 'horizontal', 'both'] };
    const v = oscillation.vertical === 'Swing';
    const h = oscillation.horizontal === 'Swing';
    state.swing = v && h ? 'both' : v ? 'vertical' : h ? 'horizontal' : 'off';
  } else if (legacy) {
    supports.swing = { channel: 'airflow', options: ['off', 'vertical', 'horizontal', 'both'] };
    state.swing = SWING[rep(resources, HREF.airflow)[`${V}direction`]] ?? null;
  }

  // Comfort modes (WindFree / Fast / Quiet / Sleep ...). One slot: selecting
  // one replaces the other, on the appliance itself.
  const convenient = rep(resources, HREF.convenient);
  const convenientCodes = list(convenient?.[`${V}supportedModes`]);
  if (convenientCodes.length) {
    supports.presets = { channel: 'convenient', codes: convenientCodes.filter((c) => c !== 'Off') };
    state.presetCode = convenient[`${V}modes`] ?? null;
  } else if (legacy && 'Comode' in tokens) {
    supports.presets = { channel: 'comode', codes: ['Nano', 'Quiet', 'Comfort', '2Step', 'Speed'] };
    if ('Sleep' in tokens) {
      supports.presets.codes.push('Sleep');
    }
    state.presetCode = tokens.Comode === 'NanoSleep' ? 'Nano' : tokens.Comode;
  }
  if (supports.presets) {
    supports.presets.names = supports.presets.codes.map((c) => CODE_TO_PRESET[c]).filter(Boolean);
    state.preset = state.presetCode === 'NanoSleep' ? 'windFree' : (CODE_TO_PRESET[state.presetCode] ?? null);
  }
  const windFreeRes = rep(resources, HREF.windFree);
  if (windFreeRes && `${V}windfree` in windFreeRes) {
    supports.windFreeResource = true;
    state.windFreeResource = windFreeRes[`${V}windfree`] === 'On';
  }

  // Display light. In the options token the flag is inverted: Light_Off
  // while lit, Light_On while dark (measured by LocalThings on a live unit).
  const lightRes = rep(resources, HREF.light);
  if (lightRes && 'mode' in lightRes) {
    supports.light = 'resource';
    state.light = lightRes.mode === 'On';
  } else if ('Light' in tokens) {
    supports.light = 'option';
    state.light = tokens.Light === 'Off';
  }

  if ('Volume' in tokens) {
    supports.beep = true;
    state.beep = tokens.Volume !== 'Mute';
  }

  const autoClean = rep(resources, HREF.autoClean);
  if (autoClean && `${V}settingStatus` in autoClean) {
    supports.autoClean = true;
    state.autoClean = autoClean[`${V}settingStatus`] === 'On';
    state.autoCleanRunning = autoClean[`${V}status`] === 'Start';
  }

  // Filter
  const filter = rep(resources, HREF.filter);
  if (filter && `${V}filterUsage` in filter) {
    supports.filter = true;
    state.filterUsagePercent = num(filter[`${V}filterUsage`]);
    state.filterStatus = typeof filter[`${V}filterStatus`] === 'string' ? filter[`${V}filterStatus`].toLowerCase() : null;
  }

  // Alarms: rows ending in _OFF are placeholders, not active alarms.
  const alarmItems = rep(resources, HREF.alarms)?.[`${V}items`];
  if (Array.isArray(alarmItems)) {
    supports.alarms = true;
    state.alarms = alarmItems
      .filter((i) => i && typeof i === 'object' && i[`${V}code`])
      .filter((i) => !['deleted', 'none'].includes(String(i[`${V}state`] ?? '').toLowerCase()))
      .map((i) => String(i[`${V}code`]))
      .filter((c) => !c.toLowerCase().endsWith('_off'));
  }

  // Energy. Power is W (instantaneous), energy is kWh (cumulative): never mixed.
  const energy = rep(resources, HREF.energy);
  if (energy) {
    const p = num(energy[`${V}instantaneousPower`]);
    if (p !== null && p !== -500) {
      supports.powerWatts = true;
      const kw = String(energy[`${V}instantaneousPowerUnit`] ?? '').toUpperCase() === 'KW';
      state.powerWatts = Math.max(0, kw ? p * 1000 : p);
    }
    const raw = num(energy[`${V}cumulativePower`]);
    if (raw !== null) {
      supports.energyKWh = true;
      const declaresWh = String(energy[`${V}cumulativeUnit`] ?? '').trim().toLowerCase() === 'wh';
      // Legacy boards that do not declare a unit count in 1/100 Wh.
      const divisor = legacy && !declaresWh ? 100000 : 1000;
      state.energyKWh = raw > 0 ? Math.round((raw / divisor) * 100) / 100 : null;
    }
  }

  // Outdoor temperature token, offset by 55, validated on Celsius boards only.
  if ('OutdoorTemp' in tokens && unit === 'C' && num(tokens.OutdoorTemp) !== null) {
    supports.outdoorTemperature = true;
    state.outdoorTemperature = num(tokens.OutdoorTemp) - 55;
  }

  const info = rep(resources, HREF.info) ?? {};
  const model = String(info[`${V}description`] ?? String(info[`${V}modelNum`] ?? '').split('|')[0] ?? '');
  const firmware = (Array.isArray(info[`${V}items`]) ? info[`${V}items`] : [])
    .find((i) => i?.[`${V}type`] === 'Firmware')?.[`${V}number`];

  return { kind: 'airConditioner', model, firmware: firmware ? String(firmware).split(',')[0] : null, legacy, supports, state, tokens };
}

function quantize(value, step) {
  const s = step > 0 ? step : 1;
  const q = Math.round(Math.round(value / s) * s * 100) / 100;
  return q;
}

/**
 * Translate one normalized command into the write(s) the appliance expects.
 * Each write carries only its own field; the appliance merges the rest.
 * @returns {{path: string[], body: object, settleMs?: number}[] | null} null when unsupported
 */
export function acCommand(model, kind, value) {
  const { supports, state } = model;
  const modeWrite = (code) => ({ path: ['mode', 'vs', '0'], body: { [`${V}modes`]: [code] } });
  const optionWrite = (...tokens) => ({ path: ['mode', 'vs', '0'], body: { [`${V}options`]: tokens } });

  switch (kind) {
    case 'power':
      // Always the vendor resource: the OCF one is absent on most boards.
      return [{ path: ['power', 'vs', '0'], body: { [`${V}power`]: value ? 'On' : 'Off' } }];

    case 'mode': {
      const code = supports.modes?.[value];
      return code ? [modeWrite(code)] : null;
    }

    case 'targetTemperature': {
      if (!supports.targetTemperature || typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
      }
      const { min, max, step } = supports.temperatureRange;
      const clamped = Math.min(max, Math.max(min, value));
      const q = quantize(fromCelsius(clamped, state.temperatureUnit), step);
      if (supports.targetTemperature === 'ocf') {
        return [{ path: ['temperature', 'desired', '0'], body: { temperature: q } }];
      }
      return [{
        path: ['temperatures', 'vs', '0'],
        body: { [`${V}items`]: [{ [`${V}id`]: '0', [`${V}desired`]: String(q) }] },
      }];
    }

    case 'fan': {
      const code = supports.fan?.speeds?.[value];
      if (code === undefined) {
        return null;
      }
      return supports.fan.channel === 'airflow'
        ? [{ path: ['airflow', 'vs', '0'], body: { [`${V}speedLevel`]: String(code) } }]
        : [{ path: ['wind', 'strength', 'vs', '0'], body: { [`${V}modes`]: code } }];
    }

    case 'swing': {
      if (!supports.swing?.options.includes(value)) {
        return null;
      }
      if (supports.swing.channel === 'oscillation') {
        return [{
          path: ['wind', 'oscillation', 'vs', '0'],
          body: {
            vertical: value === 'vertical' || value === 'both' ? 'Swing' : 'Fix',
            horizontal: value === 'horizontal' || value === 'both' ? 'Swing' : 'Fix',
          },
        }];
      }
      const code = SWING_TO_CODE[value];
      return supports.swing.channel === 'airflow'
        ? [{ path: ['airflow', 'vs', '0'], body: { [`${V}direction`]: code } }]
        : [{ path: ['wind', 'direction', 'vs', '0'], body: { [`${V}modes`]: code } }];
    }

    case 'preset': {
      // value: { name, on }. Turning a preset off only clears the slot when
      // that preset is the active one, so it can never cancel another mode,
      // and it never touches power.
      const code = PRESETS[value?.name];
      if (!code || !supports.presets?.codes.includes(code)) {
        return null;
      }
      if (!value.on) {
        if (state.presetCode !== code && !(code === 'Nano' && state.presetCode === 'NanoSleep')) {
          return [];
        }
        return supports.presets.channel === 'convenient'
          ? [{ path: ['mode', 'convenient', 'vs', '0'], body: { [`${V}modes`]: 'Off' } }]
          : [optionWrite('Comode_Off')];
      }
      if (supports.presets.channel === 'convenient') {
        return [{ path: ['mode', 'convenient', 'vs', '0'], body: { [`${V}modes`]: code } }];
      }
      // Legacy board. WindFree does not exist in Auto: the token is accepted
      // and then dropped unless Cool is written first, as its own request,
      // a few seconds earlier (measured by LocalThings).
      const writes = [];
      if (code === 'Nano' && state.modeCode === 'Auto' && supports.modes?.cool) {
        writes.push({ ...modeWrite(supports.modes.cool), settleMs: 3000 });
      }
      const sleep = model.tokens.Sleep;
      const sleepRunning = sleep !== undefined && sleep !== '0';
      if (code === 'Sleep' || (code === 'Nano' && sleepRunning)) {
        const comode = code === 'Nano' ? 'NanoSleep' : 'Sleep';
        writes.push(optionWrite(`Comode_${comode}`, `Sleep_${sleepRunning ? sleep : 16}`));
      } else {
        writes.push(optionWrite(`Comode_${code}`));
      }
      return writes;
    }

    case 'windFreeResource':
      return supports.windFreeResource
        ? [{ path: ['modeoption', 'windfree', 'vs', '0'], body: { [`${V}windfree`]: value ? 'On' : 'Off' } }]
        : null;

    case 'light':
      if (supports.light === 'resource') {
        return [{ path: ['light', 'vs', '0'], body: { mode: value ? 'On' : 'Off' } }];
      }
      // Inverted token, see buildAcModel.
      return supports.light === 'option' ? [optionWrite(`Light_${value ? 'Off' : 'On'}`)] : null;

    case 'beep': {
      if (!supports.beep) {
        return null;
      }
      const previous = model.tokens.Volume;
      return [optionWrite(`Volume_${value ? (previous && previous !== 'Mute' ? previous : '100') : 'Mute'}`)];
    }

    case 'autoClean':
      return supports.autoClean
        ? [{ path: ['option', 'autoclean', 'vs', '0'], body: { [`${V}settingStatus`]: value ? 'On' : 'Off' } }]
        : null;

    default:
      return null;
  }
}

/** The fields each command is expected to change, used to confirm a write. */
export function expectedAfter(kind, value) {
  switch (kind) {
    case 'power': return (s) => s.power === Boolean(value);
    case 'mode': return (s) => s.mode === value;
    case 'fan': return (s) => s.fan === value;
    case 'swing': return (s) => s.swing === value;
    case 'light': return (s) => s.light === Boolean(value);
    case 'beep': return (s) => s.beep === Boolean(value);
    case 'autoClean': return (s) => s.autoClean === Boolean(value);
    case 'preset': return (s) => (value.on ? s.preset === value.name : s.preset !== value.name);
    case 'targetTemperature': return (s) => s.targetTemperature !== null && Math.abs(s.targetTemperature - value) <= 0.6;
    default: return () => true;
  }
}
