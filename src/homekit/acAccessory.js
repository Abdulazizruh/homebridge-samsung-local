import { acCommand, buildAcModel, expectedAfter } from '../capabilities/ac.js';
import { NAME_SUFFIX } from '../settings.js';
import { eveCharacteristics } from './eve.js';

/** Which optional services appear by default. Each can be changed per device. */
export const DEFAULT_FEATURES = Object.freeze({
  fan: true,
  fanAutoSwitch: true,
  fanTurboSwitch: true,
  fanSpeedSwitches: false, // extra Low / Medium / High switches
  drySwitch: true,
  fanOnlySwitch: true,
  windFree: true,
  fast: true,
  quiet: true,
  sleep: false,
  smart: false,
  comfort: false,
  twoStep: false,
  motionDirect: false,
  motionIndirect: false,
  light: true,
  beep: false,
  autoClean: false,
  humidity: true,
  filter: true,
  outdoorTemperature: false,
  energyEve: true,
});

const LABELS = {
  fan: 'Fan', dry: 'Dry', fanOnly: 'Fan Only', fanAuto: 'Fan Auto', fanTurbo: 'Turbo',
  fanLow: 'Fan Low', fanMedium: 'Fan Medium', fanHigh: 'Fan High',
  windFree: 'WindFree', fast: 'Fast', quiet: 'Quiet', sleep: 'Sleep', smart: 'Smart', comfort: 'Comfort',
  twoStep: '2-Step', motionDirect: 'Wind Follows', motionIndirect: 'Wind Avoids',
  light: 'Display Light', beep: 'Beep', autoClean: 'Auto Clean', humidity: 'Humidity', filter: 'Filter',
  outdoor: 'Outdoor Temperature',
};

const SETTLE_MS = 4500; // how long a just-written value is shielded from stale reads
const CONFIRM_MS = 12000; // after this an unconfirmed write is reported and dropped
const PRESET_FEATURES = ['windFree', 'fast', 'quiet', 'sleep', 'smart', 'comfort', 'twoStep', 'motionDirect', 'motionIndirect'];

/**
 * Presents one air conditioner as a single HomeKit accessory holding several
 * services. Reads only the normalized model from capabilities/ac.js and sends
 * only normalized commands: it never sees resource paths.
 */
export class AcAccessory {
  constructor({ api, log, accessory, link, displayName, features = {} }) {
    this.api = api;
    this.hap = api.hap;
    this.log = log;
    this.accessory = accessory;
    this.link = link;
    this.displayName = displayName;
    this.features = { ...DEFAULT_FEATURES, ...features };
    this.model = null;
    this.pending = new Map(); // kind -> {check, settleUntil, confirmUntil, label}
    this.services = new Map();
    this.eve = eveCharacteristics(this.hap);
    this.context = accessory.context;

    // A snapshot from the last successful session lets the accessory keep its
    // services across a restart while the appliance is unreachable.
    if (this.context.resources) {
      this.model = buildAcModel(this.context.resources);
      this.#buildServices();
    }
    link.on('update', (resources) => this.#onUpdate(resources));
    link.on('availability', (online, error) => this.#onAvailability(online, error));
    if (link.resources) {
      this.#onUpdate(link.resources);
    }
  }

  // ----------------------------------------------------------------- state

  get online() {
    return this.link.online && this.model !== null;
  }

  #onUpdate(resources) {
    const previous = this.model;
    this.model = buildAcModel(resources);
    this.context.resources = resources;
    const st = this.model.state;
    if (['cool', 'heat', 'auto'].includes(st.mode)) {
      this.context.lastPrimaryMode = st.mode;
    }
    if (st.fan && st.fan !== 'auto' && st.fan !== 'turbo') {
      this.context.lastManualFan = st.fan;
    }
    if (!previous || JSON.stringify(previous.supports) !== JSON.stringify(this.model.supports)) {
      this.#buildServices();
    }
    this.#push();
  }

  #onAvailability(online, error) {
    if (online) {
      this.log.info(`[${this.displayName}] connected.`);
      this.#push();
      return;
    }
    this.log.warn(`[${this.displayName}] not reachable${error?.message ? ` (${error.message})` : ''}. Will keep retrying.`);
    const { Characteristic, HapStatusError, HAPStatus } = this.hap;
    const thermostat = this.services.get('thermostat');
    // Shows "No Response" in the Home app instead of a stale state.
    thermostat?.updateCharacteristic(Characteristic.TargetHeatingCoolingState,
      new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
  }

  #requireOnline() {
    if (!this.online) {
      const { HapStatusError, HAPStatus } = this.hap;
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return this.model.state;
  }

  /** Send one normalized command and wait for the appliance to acknowledge it. */
  async #command(kind, value, label = kind) {
    const { HapStatusError, HAPStatus } = this.hap;
    this.#requireOnline();
    const writes = acCommand(this.model, kind, value);
    if (writes === null) {
      this.log.warn(`[${this.displayName}] "${label}" is not supported by this appliance.`);
      throw new HapStatusError(HAPStatus.INVALID_VALUE_IN_REQUEST);
    }
    if (writes.length === 0) {
      return;
    }
    try {
      await this.link.send(writes);
    } catch (err) {
      this.log.warn(`[${this.displayName}] ${label} failed: ${err.message}`);
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    const now = Date.now();
    this.pending.set(kind === 'preset' ? `preset:${value.name}` : kind, {
      check: expectedAfter(kind, value), settleUntil: now + SETTLE_MS, confirmUntil: now + CONFIRM_MS, label,
    });
    this.log.debug(`[${this.displayName}] ${label} accepted by the appliance; waiting for it to report the change.`);
  }

  /** Kinds whose characteristics must not be overwritten by a stale read yet. */
  #heldKinds() {
    const held = new Set();
    const now = Date.now();
    const st = this.model.state;
    for (const [key, p] of this.pending) {
      if (p.check(st)) {
        this.pending.delete(key);
      } else if (now < p.settleUntil) {
        held.add(key.split(':')[0]);
      } else if (now >= p.confirmUntil) {
        this.pending.delete(key);
        this.log.warn(`[${this.displayName}] the appliance accepted "${p.label}" but did not apply it. Showing its real state.`);
      }
    }
    return held;
  }

  // -------------------------------------------------------------- services

  #service(key, type, name, wanted) {
    const subtype = `sl-${key}`;
    let service = this.accessory.getServiceById(type, subtype);
    if (!wanted) {
      if (service) {
        this.accessory.removeService(service);
      }
      this.services.delete(key);
      return null;
    }
    if (!service) {
      service = this.accessory.addService(type, name, subtype);
    }
    const { Characteristic } = this.hap;
    service.setCharacteristic(Characteristic.Name, name);
    if (!service.testCharacteristic(Characteristic.ConfiguredName)) {
      service.addOptionalCharacteristic(Characteristic.ConfiguredName);
      service.setCharacteristic(Characteristic.ConfiguredName, name);
    }
    this.services.set(key, service);
    return service;
  }

  #switch(key, wanted, isOn, setOn) {
    const { Service, Characteristic } = this.hap;
    const service = this.#service(key, Service.Switch, LABELS[key] ?? key, wanted);
    if (!service) {
      return;
    }
    service.getCharacteristic(Characteristic.On)
      .onGet(() => Boolean(isOn(this.#requireOnline())))
      .onSet(async (value) => {
        await setOn(Boolean(value), this.#requireOnline());
      });
    service.sl = { isOn };
  }

  #buildServices() {
    const { Service, Characteristic } = this.hap;
    const s = this.model.supports;
    const f = this.features;

    this.accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, this.model.model || 'Air Conditioner')
      .setCharacteristic(Characteristic.SerialNumber, `local-${String(this.context.deviceId ?? '').slice(-12) || 'unknown'}`)
      .setCharacteristic(Characteristic.FirmwareRevision, /^\d+(\.\d+){0,2}$/.test(this.model.firmware ?? '') ? this.model.firmware : '0.0.0');

    this.#buildThermostat();
    this.#buildFan(Boolean(s.fan) && f.fan);

    // Dry and Fan Only have no HomeKit thermostat state, so they are switches.
    const modeSwitch = (key, mode, enabled) => this.#switch(key, Boolean(s.modes?.[mode]) && enabled,
      (st) => st.power === true && st.mode === mode,
      async (on, st) => {
        if (on) {
          await this.#setMode(mode);
        } else if (st.power && st.mode === mode) {
          // Leaving the mode returns to the last main mode; power stays on.
          const back = [this.context.lastPrimaryMode, 'cool', 'auto', 'heat'].find((m) => m && s.modes?.[m]);
          if (back) {
            await this.#setMode(back);
          }
        }
      });
    modeSwitch('dry', 'dry', f.drySwitch);
    modeSwitch('fanOnly', 'fan', f.fanOnlySwitch);

    // Fan speeds as explicit switches, so Auto and Turbo are real choices and
    // not positions on a slider.
    const speeds = s.fan?.speeds ?? {};
    const speedSwitch = (key, speed, enabled) => this.#switch(key, speed in speeds && enabled,
      (st) => st.fan === speed,
      async (on, st) => {
        if (on) {
          await this.#command('fan', speed, `fan ${speed}`);
        } else if (st.fan === speed) {
          // A fan speed cannot be "nothing": fall back to the previous one.
          const fallbacks = speed === 'auto'
            ? [this.context.lastManualFan, 'medium', 'low', 'high']
            : ['auto', this.context.lastManualFan, 'medium', 'low'];
          const back = fallbacks.find((x) => x && x !== speed && x in speeds);
          if (back) {
            await this.#command('fan', back, `fan ${back}`);
          }
        }
      });
    speedSwitch('fanAuto', 'auto', f.fanAutoSwitch);
    speedSwitch('fanTurbo', 'turbo', f.fanTurboSwitch);
    speedSwitch('fanLow', 'low', f.fanSpeedSwitches);
    speedSwitch('fanMedium', 'medium', f.fanSpeedSwitches);
    speedSwitch('fanHigh', 'high', f.fanSpeedSwitches);

    // Comfort modes. Off on an inactive switch is a no-op (see acCommand).
    for (const name of PRESET_FEATURES) {
      const viaPreset = Boolean(s.presets?.names.includes(name));
      const viaResource = name === 'windFree' && !viaPreset && Boolean(s.windFreeResource);
      this.#switch(name, (viaPreset || viaResource) && f[name],
        (st) => (viaResource ? st.windFreeResource === true : st.preset === name),
        async (on) => {
          if (viaResource) {
            await this.#command('windFreeResource', on, LABELS[name]);
          } else {
            await this.#command('preset', { name, on }, `${LABELS[name]} ${on ? 'on' : 'off'}`);
          }
        });
    }

    this.#switch('beep', Boolean(s.beep) && f.beep, (st) => st.beep, (on) => this.#command('beep', on));
    this.#switch('autoClean', Boolean(s.autoClean) && f.autoClean, (st) => st.autoClean, (on) => this.#command('autoClean', on, 'auto clean'));

    const light = this.#service('light', Service.Lightbulb, LABELS.light, Boolean(s.light) && f.light);
    light?.getCharacteristic(Characteristic.On)
      .onGet(() => Boolean(this.#requireOnline().light))
      .onSet((value) => this.#command('light', Boolean(value), 'display light'));

    const humidity = this.#service('humidity', Service.HumiditySensor, LABELS.humidity, s.humidity === true && f.humidity);
    humidity?.getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(() => this.#requireOnline().humidity ?? 0);

    const filter = this.#service('filter', Service.FilterMaintenance, LABELS.filter, Boolean(s.filter) && f.filter);
    filter?.getCharacteristic(Characteristic.FilterChangeIndication).onGet(() => this.#filterIndication(this.#requireOnline()));
    filter?.getCharacteristic(Characteristic.FilterLifeLevel).onGet(() => this.#filterLife(this.#requireOnline()));

    const outdoor = this.#service('outdoor', Service.TemperatureSensor, LABELS.outdoor,
      Boolean(s.outdoorTemperature) && f.outdoorTemperature);
    outdoor?.getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ minValue: -55, maxValue: 100 })
      .onGet(() => this.#requireOnline().outdoorTemperature ?? 0);
  }

  #buildThermostat() {
    const { Service, Characteristic } = this.hap;
    const s = this.model.supports;
    const T = Characteristic.TargetHeatingCoolingState;
    const service = this.#service('thermostat', Service.Thermostat, this.displayName, true);
    service.setPrimaryService(true);

    const valid = [T.OFF];
    if (s.modes?.heat) {
      valid.push(T.HEAT);
    }
    if (s.modes?.cool) {
      valid.push(T.COOL);
    }
    if (s.modes?.auto) {
      valid.push(T.AUTO);
    }
    service.getCharacteristic(T)
      .setProps({ validValues: valid })
      .onGet(() => this.#targetState(this.#requireOnline()))
      .onSet(async (value) => {
        if (value === T.OFF) {
          await this.#command('power', false, 'power off');
          return;
        }
        await this.#setMode(value === T.HEAT ? 'heat' : value === T.COOL ? 'cool' : 'auto');
      });
    service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(() => this.#currentState(this.#requireOnline()));
    service.getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ minValue: -40, maxValue: 100, minStep: 0.1 })
      .onGet(() => this.#requireOnline().currentTemperature ?? 0);

    const range = s.temperatureRange ?? { min: 16, max: 30, step: 1 };
    const target = service.getCharacteristic(Characteristic.TargetTemperature);
    // Move the stored value into range first so setProps cannot reject it.
    if (typeof target.value !== 'number' || target.value < range.min || target.value > range.max) {
      target.updateValue(Math.min(range.max, Math.max(range.min, this.model.state.targetTemperature ?? 24)));
    }
    target.setProps({ minValue: range.min, maxValue: range.max, minStep: range.step })
      .onGet(() => this.#clampTarget(this.#requireOnline().targetTemperature))
      .onSet((value) => this.#command('targetTemperature', Number(value), `target ${value}°C`));

    // Celsius only: the appliance's own unit is converted in the model.
    service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .setProps({ validValues: [Characteristic.TemperatureDisplayUnits.CELSIUS] })
      .onGet(() => Characteristic.TemperatureDisplayUnits.CELSIUS)
      .onSet(() => {});

    // Energy readings for apps that understand Eve's characteristics. Apple's
    // Home app has no power or energy type, so they are not forced into one.
    const eveWanted = this.features.energyEve;
    for (const [key, Char, supported] of [
      ['powerWatts', this.eve.Consumption, s.powerWatts], ['energyKWh', this.eve.TotalConsumption, s.energyKWh],
    ]) {
      const has = service.testCharacteristic(Char);
      if (supported && eveWanted) {
        if (!has) {
          service.addOptionalCharacteristic(Char);
        }
        service.getCharacteristic(Char).onGet(() => this.#requireOnline()[key] ?? 0);
      } else if (has) {
        service.removeCharacteristic(service.getCharacteristic(Char));
      }
    }
  }

  #buildFan(wanted) {
    const { Service, Characteristic } = this.hap;
    const service = this.#service('fan', Service.Fanv2, LABELS.fan, wanted);
    if (!service) {
      return;
    }
    const s = this.model.supports;
    const manual = this.#manualSpeeds();
    const step = manual.length ? 100 / manual.length : 100;

    // The fan tile mirrors power but never switches the air conditioner off:
    // HomeKit sends "inactive" when the slider is dragged to zero.
    service.getCharacteristic(Characteristic.Active)
      .onGet(() => (this.#requireOnline().power ? 1 : 0))
      .onSet(async (value) => {
        const st = this.#requireOnline();
        if (value === 1 && !st.power) {
          await this.#command('power', true, 'power on');
        } else if (value === 0 && st.power) {
          this.log.debug(`[${this.displayName}] ignoring "fan off": the fan tile does not power off the air conditioner.`);
          setTimeout(() => this.#push(), 600);
        }
      });

    if (manual.length) {
      service.getCharacteristic(Characteristic.RotationSpeed)
        .setProps({ minValue: 0, maxValue: 100, minStep: step })
        .onGet(() => this.#rotation(this.#requireOnline()))
        .onSet(async (value) => {
          if (Number(value) <= 0) {
            setTimeout(() => this.#push(), 600);
            return;
          }
          const index = Math.min(manual.length - 1, Math.max(0, Math.round(Number(value) / step) - 1));
          await this.#command('fan', manual[index], `fan ${manual[index]}`);
        });
    }
    if (s.fan.speeds.auto !== undefined) {
      service.getCharacteristic(Characteristic.TargetFanState)
        .onGet(() => (this.#requireOnline().fan === 'auto' ? 1 : 0))
        .onSet(async (value) => {
          const st = this.#requireOnline();
          if (value === 1) {
            await this.#command('fan', 'auto', 'fan auto');
          } else if (st.fan === 'auto') {
            const back = [this.context.lastManualFan, 'medium', 'low', 'high'].find((x) => x && manual.includes(x));
            if (back) {
              await this.#command('fan', back, `fan ${back}`);
            }
          }
        });
    }
    if (s.swing) {
      service.getCharacteristic(Characteristic.SwingMode)
        .onGet(() => (this.#requireOnline().swing && this.#requireOnline().swing !== 'off' ? 1 : 0))
        .onSet(async (value) => {
          const on = ['both', 'vertical', 'horizontal'].find((o) => s.swing.options.includes(o));
          await this.#command('swing', value === 1 ? on : 'off', `swing ${value === 1 ? on : 'off'}`);
        });
    } else if (service.testCharacteristic(Characteristic.SwingMode)) {
      service.removeCharacteristic(service.getCharacteristic(Characteristic.SwingMode));
    }
  }

  // --------------------------------------------------------------- helpers

  #manualSpeeds() {
    const speeds = this.model.supports.fan?.speeds ?? {};
    return ['low', 'medium', 'high', 'turbo'].filter((x) => x in speeds);
  }

  #rotation(st) {
    const manual = this.#manualSpeeds();
    const index = manual.indexOf(st.fan === 'auto' ? (this.context.lastManualFan ?? manual[0]) : st.fan);
    return index < 0 ? 0 : Math.round(((index + 1) * 100) / manual.length);
  }

  async #setMode(mode) {
    const st = this.#requireOnline();
    if (!st.power) {
      await this.#command('power', true, 'power on');
    }
    if (st.mode !== mode || !st.power) {
      await this.#command('mode', mode, `mode ${mode}`);
    }
  }

  #targetState(st) {
    const T = this.hap.Characteristic.TargetHeatingCoolingState;
    const has = (m) => Boolean(this.model.supports.modes?.[m]);
    if (!st.power) {
      return T.OFF;
    }
    if (st.mode === 'heat' && has('heat')) {
      return T.HEAT;
    }
    if (st.mode === 'cool' && has('cool')) {
      return T.COOL;
    }
    // Auto, and the modes HomeKit has no thermostat state for (Dry, Fan Only:
    // their own switches show which one is active).
    return has('auto') ? T.AUTO : has('cool') ? T.COOL : T.HEAT;
  }

  #currentState(st) {
    const C = this.hap.Characteristic.CurrentHeatingCoolingState;
    if (!st.power || st.mode === 'fan') {
      return C.OFF;
    }
    if (st.mode === 'heat') {
      return C.HEAT;
    }
    if (st.mode === 'cool' || st.mode === 'dry') {
      return C.COOL;
    }
    if (st.currentTemperature === null || st.targetTemperature === null) {
      return C.OFF;
    }
    return st.currentTemperature > st.targetTemperature ? C.COOL
      : st.currentTemperature < st.targetTemperature ? C.HEAT : C.OFF;
  }

  #clampTarget(value) {
    const range = this.model.supports.temperatureRange ?? { min: 16, max: 30 };
    return Math.min(range.max, Math.max(range.min, value ?? range.min));
  }

  #filterIndication(st) {
    const due = ['wash', 'replace'].includes(st.filterStatus) || (st.alarms ?? []).some((a) => /^FilterAlarm/i.test(a));
    return due ? 1 : 0;
  }

  #filterLife(st) {
    return Math.min(100, Math.max(0, 100 - (st.filterUsagePercent ?? 0)));
  }

  /** Push the appliance's real state to HomeKit, shielding fresh writes. */
  #push() {
    if (!this.online) {
      return;
    }
    const { Characteristic } = this.hap;
    const st = this.model.state;
    const held = this.#heldKinds();
    const free = (...kinds) => !kinds.some((k) => held.has(k));
    const get = (key) => this.services.get(key);

    const thermostat = get('thermostat');
    if (thermostat) {
      if (free('power', 'mode')) {
        thermostat.updateCharacteristic(Characteristic.TargetHeatingCoolingState, this.#targetState(st));
        thermostat.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, this.#currentState(st));
      }
      if (st.currentTemperature !== null) {
        thermostat.updateCharacteristic(Characteristic.CurrentTemperature, st.currentTemperature);
      }
      if (free('targetTemperature') && st.targetTemperature !== null) {
        thermostat.updateCharacteristic(Characteristic.TargetTemperature, this.#clampTarget(st.targetTemperature));
      }
      if (thermostat.testCharacteristic(this.eve.Consumption) && st.powerWatts !== undefined) {
        thermostat.updateCharacteristic(this.eve.Consumption, st.powerWatts ?? 0);
      }
      if (thermostat.testCharacteristic(this.eve.TotalConsumption) && st.energyKWh) {
        thermostat.updateCharacteristic(this.eve.TotalConsumption, st.energyKWh);
      }
    }

    const fan = get('fan');
    if (fan) {
      if (free('power')) {
        fan.updateCharacteristic(Characteristic.Active, st.power ? 1 : 0);
      }
      if (free('fan')) {
        if (fan.testCharacteristic(Characteristic.RotationSpeed) && st.fan !== 'auto') {
          fan.updateCharacteristic(Characteristic.RotationSpeed, this.#rotation(st));
        }
        if (fan.testCharacteristic(Characteristic.TargetFanState)) {
          fan.updateCharacteristic(Characteristic.TargetFanState, st.fan === 'auto' ? 1 : 0);
        }
      }
      if (free('swing') && fan.testCharacteristic(Characteristic.SwingMode)) {
        fan.updateCharacteristic(Characteristic.SwingMode, st.swing && st.swing !== 'off' ? 1 : 0);
      }
    }

    const kindOf = (key) => (key === 'dry' || key === 'fanOnly' ? ['power', 'mode']
      : key.startsWith('fan') ? ['fan'] : PRESET_FEATURES.includes(key) ? ['preset', 'windFreeResource'] : [key]);
    for (const [key, service] of this.services) {
      if (service.sl?.isOn && free(...kindOf(key))) {
        service.updateCharacteristic(Characteristic.On, Boolean(service.sl.isOn(st)));
      }
    }
    if (free('light')) {
      get('light')?.updateCharacteristic(Characteristic.On, Boolean(st.light));
    }
    if (st.humidity !== null && st.humidity !== undefined) {
      get('humidity')?.updateCharacteristic(Characteristic.CurrentRelativeHumidity, st.humidity);
    }
    get('filter')?.updateCharacteristic(Characteristic.FilterChangeIndication, this.#filterIndication(st));
    get('filter')?.updateCharacteristic(Characteristic.FilterLifeLevel, this.#filterLife(st));
    if (st.outdoorTemperature !== undefined) {
      get('outdoor')?.updateCharacteristic(Characteristic.CurrentTemperature, st.outdoorTemperature);
    }
  }
}

export function accessoryName(name) {
  const base = String(name || 'Samsung AC').trim();
  return new RegExp(`\\b${NAME_SUFFIX}$`, 'i').test(base) ? base : `${base} ${NAME_SUFFIX}`;
}
