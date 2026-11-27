import { failureText } from '../deviceLink.js';
import { acCommand, buildAcModel, expectedAfter, intendedState } from '../capabilities/ac.js';
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
  airPurify: false,
  humidity: true,
  filter: true,
  filterAlert: false,
  outdoorTemperature: false,
  energyEve: true,
});

const LABELS = {
  fan: 'Fan', dry: 'Dry', fanOnly: 'Fan Only', fanAuto: 'Fan Auto', fanTurbo: 'Turbo',
  fanLow: 'Fan Low', fanMedium: 'Fan Medium', fanHigh: 'Fan High',
  windFree: 'WindFree', fast: 'Fast', quiet: 'Quiet', sleep: 'Sleep', smart: 'Smart', comfort: 'Comfort',
  twoStep: '2-Step', motionDirect: 'Wind Follows', motionIndirect: 'Wind Avoids',
  light: 'Light Display', beep: 'Beep', autoClean: 'Auto Clean', airPurify: 'Air Purify', humidity: 'Humidity', filter: 'Filter', filterAlert: 'Filter Alert',
  outdoor: 'Outdoor Temperature',
};

// What earlier versions called each part, before the appliance name was put
// in front. Used once, to tell a name the plugin gave from one the user typed.
const LEGACY_LABELS = { ...LABELS, light: 'Display Light' };

const SETTLE_MS = 10000; // how long a just-written value is shielded from stale reads: an appliance that applies a command but reports it late must not make the tile flip back and forth
const CONFIRM_MS = 12000; // after this an unconfirmed write is reported and dropped
// HomeKit must be answered quickly. If the appliance has not acknowledged a
// write by then, HomeKit gets its answer and the write carries on behind it.
const QUICK_REPLY_MS = 1200;
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
    this.inflight = new Map(); // kind -> value being sent right now
    this.asked = new Map(); // kind -> the newest value sent for it; an older one never counts as "already asked"
    this.askedAt = new Map(); // kind -> { kind, value, order } of that newest value
    this.services = new Map();
    this.eve = eveCharacteristics(this.hap);
    this.context = accessory.context;
    // The 1.9.4 trial "send together" is gone: drop what it stored.
    delete this.context.togetherRefused;

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
    if (error?.code === 'helper_down') { // every appliance at once: the platform says it in one line
      this.log.debug?.(`[${this.displayName}] not reachable${failureText(error)}.`);
    } else if (error?.code === 'timeout' && error?.stage === 'session') {
      // Silence from the start is the everyday case of an appliance switched off at the wall:
      // said calmly, once. A refusal or a session that drops is still a warning.
      this.log.info(`[${this.displayName}] does not answer${failureText(error)}. It may be switched off at the wall; it connects by itself when it is back.`);
    } else {
      this.log.warn(`[${this.displayName}] not reachable${failureText(error)}. Will keep retrying.`);
    }
    const { Characteristic, HapStatusError, HAPStatus } = this.hap;
    const thermostat = this.services.get('thermostat');
    // Shows "No Response" in the Home app instead of a stale state.
    thermostat?.updateCharacteristic(Characteristic.TargetHeatingCoolingState,
      new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
  }

  /**
   * The appliance as it is about to be: its reading with every command still on its way or not
   * yet reported back. New commands are decided on this, never on a reading that predates them.
   */
  #intended() {
    const st = this.#requireOnline();
    this.#heldKinds(); // drops what the appliance has confirmed meanwhile
    const open = [...this.askedAt.entries()]
      .filter(([key]) => this.inflight.has(key) || this.pending.has(key))
      .map(([, a]) => a)
      .sort((a, b) => a.order - b.order);
    return open.length ? intendedState({ ...this.model, state: st }, open) : st;
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
    const key = kind === 'preset' ? `preset:${value.name}` : kind;
    const writes = acCommand({ ...this.model, state: this.#intended() }, kind, value);
    if (writes === null) {
      this.log.warn(`[${this.displayName}] "${label}" is not supported by this appliance.`);
      throw new HapStatusError(HAPStatus.INVALID_VALUE_IN_REQUEST);
    }
    if (writes.length === 0) {
      return;
    }
    // One command, one beep. Apple Home often sends the same thing through
    // several tiles at once (thermostat "Cool" and fan "on" both mean power
    // on), and repeats values the appliance already has. Each write makes
    // the appliance beep and costs time, so only a real change is sent.
    const same = JSON.stringify(value);
    const waiting = this.pending.get(key);
    const asked = this.inflight.get('power') ?? this.pending.get('power')?.value;
    const powerOff = asked ? asked === 'false' : !this.model.state.power;
    // A repeat is only a repeat of the newest value asked for. WindFree on, off and on again in
    // quick succession: the last "on" matches the first one still awaiting confirmation, but the
    // "off" came after it, so it must be sent, or the unit ends up off while the tile shows on.
    const repeat = this.asked.get(key) === same
      && (this.inflight.get(key) === same || (waiting?.value === same && Date.now() < waiting.settleUntil));
    if (repeat) {
      this.log.debug(`[${this.displayName}] ${label}: already on its way; not sent twice.`);
      return;
    }
    if (kind === 'light' && powerOff) {
      // The display is dark while the unit is off; its setting is left alone
      // so it lights again with the next switch-on.
      setTimeout(() => this.#push(), 600);
      return;
    }
    if (!waiting && !this.inflight.has(key) && expectedAfter(kind, value)(this.model.state)) {
      this.log.debug(`[${this.displayName}] ${label}: the appliance is already there; nothing sent.`);
      setTimeout(() => this.#push(), 600);
      return;
    }
    this.inflight.set(key, same);
    this.asked.set(key, same);
    this.askedOrder = (this.askedOrder ?? 0) + 1;
    this.askedAt.set(key, { kind, value, order: this.askedOrder });
    const newest = () => this.asked.get(key) === same;
    const hold = () => {
      if (!newest()) { return; } // a later value of this kind is already on its way and held
      const now = Date.now();
      this.pending.set(key, {
        check: expectedAfter(kind, value), settleUntil: now + SETTLE_MS, confirmUntil: now + CONFIRM_MS, label, value: same,
      });
      if (kind === 'power') {
        this.#showRequestedPower(Boolean(value));
      }
    };
    let late = false;
    let timer;
    // Seen on a real unit: in Auto mode WindFree is refused (4.00), and asking once more changes
    // nothing. In Auto a refused option is not sent a second time, and the log says why.
    const autoOption = kind === 'preset' && this.model.state.mode === 'auto';
    const toSend = autoOption ? writes.map((w) => ({ ...w, once: true })) : writes;
    const sent = this.link.send(toSend).finally(() => {
      if (this.inflight.get(key) === same) { this.inflight.delete(key); }
    }).then(() => {
      hold();
      // One short line per command that reached the appliance: each one is a beep, and when a
      // switch-on is heard as several beeps this shows which commands they were.
      this.log.info(`[${this.displayName}] sent: ${label}.`);
    }, (err) => {
      const hint = autoOption && err.code === 'refused' ? ' The unit is in Auto mode, where it may not take this option: choose Cool (or another mode) first.' : '';
      this.log.warn(`[${this.displayName}] ${label} failed: ${err.message}${hint}`);
      if (late) {
        // HomeKit was already told "done": put the real state back on screen,
        // unless a later value of this kind is already on its way.
        if (newest()) {
          this.pending.delete(key);
          this.#showRealState();
        }
        return;
      }
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    });
    const quick = new Promise((resolve) => { timer = setTimeout(() => resolve('late'), QUICK_REPLY_MS); });
    let outcome;
    try {
      outcome = await Promise.race([sent, quick]);
    } finally {
      clearTimeout(timer);
    }
    if (outcome === 'late') {
      late = true;
      hold(); // keep the requested value on screen while the appliance catches up
    }
  }

  /**
   * A power command is shown on every tile of the accessory at once. Without
   * this the fan, switches and light stay "on" until the appliance reports,
   * and the Home app reads "Powered On" for some seconds after switching off.
   */
  #showRequestedPower(on) {
    const { Characteristic } = this.hap;
    this.services.get('fan')?.updateCharacteristic(Characteristic.Active, on ? 1 : 0);
    if (on) {
      return;
    }
    this.services.get('thermostat')?.updateCharacteristic(
      Characteristic.CurrentHeatingCoolingState, Characteristic.CurrentHeatingCoolingState.OFF);
    for (const service of this.services.values()) {
      if (service.sl?.isOn) {
        service.updateCharacteristic(Characteristic.On, false);
      }
    }
    this.services.get('light')?.updateCharacteristic(Characteristic.On, false);
  }

  #showRealState() {
    if (this.link.resources) {
      this.#onUpdate(this.link.resources);
    }
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
        const shown = st[key.split(':')[0]];
        const reports = shown === undefined || typeof shown === 'object' ? '' : ` (it reports ${shown})`;
        this.log.warn(`[${this.displayName}] the appliance accepted "${p.label}" but did not apply it${reports}. Showing its real state.`);
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
    this.#applyName(key, service, name);
    this.services.set(key, service);
    return service;
  }

  /**
   * Names a tile. The plugin's name is followed (appliance renamed in the
   * settings, new naming scheme) only while the tile still carries the name
   * this plugin last gave it. A name typed in the Home app is kept through
   * updates and restarts; only resetting the accessory brings ours back.
   */
  #applyName(key, service, name) {
    const { Characteristic } = this.hap;
    const applied = (this.context.appliedNames ??= {});
    if (!service.testCharacteristic(Characteristic.ConfiguredName)) {
      service.addOptionalCharacteristic(Characteristic.ConfiguredName);
      service.setCharacteristic(Characteristic.ConfiguredName, name);
      applied[key] = name;
      return;
    }
    // Tiles made by earlier versions carry no record: fall back to what
    // those versions wrote.
    const last = applied[key] ?? (key === 'thermostat' ? this.context.appliedName : LEGACY_LABELS[key]);
    const current = service.getCharacteristic(Characteristic.ConfiguredName).value;
    if (last === undefined || current === last) {
      if (current !== name) {
        service.setCharacteristic(Characteristic.ConfiguredName, name);
      }
      applied[key] = name;
    } else {
      applied[key] = last;
    }
  }

  /** Every part carries the appliance name, so each one is unique for Siri. */
  #label(key) {
    return `${this.displayName} ${LABELS[key] ?? key}`;
  }

  /**
   * A tile's answer when Apple Home asks for it. A value just asked for stays on the tile until the
   * appliance reports it (or the settle time ends), whether the plugin pushes a reading or the Home
   * app asks again in between: the same rule as #push, so the tile does not go back and forth.
   */
  #shown(characteristic, kinds, read) {
    return () => {
      const st = this.#requireOnline();
      const held = this.#heldKinds();
      return kinds.some((k) => held.has(k)) ? characteristic.value : read(st);
    };
  }

  #switch(key, wanted, isOn, setOn) {
    const { Service, Characteristic } = this.hap;
    const service = this.#service(key, Service.Switch, this.#label(key), wanted);
    if (!service) {
      return;
    }
    const on = service.getCharacteristic(Characteristic.On);
    on.onGet(this.#shown(on, switchKinds(key), (st) => Boolean(isOn(st))))
      .onSet(async (value) => {
        await setOn(Boolean(value), this.#intended());
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
    this.#switch('airPurify', Boolean(s.airPurify) && f.airPurify, (st) => st.airPurify, (on) => this.#command('airPurify', on, `air purify ${on ? 'on' : 'off'}`));

    const light = this.#service('light', Service.Lightbulb, this.#label('light'), Boolean(s.light) && f.light);
    const lightOn = light?.getCharacteristic(Characteristic.On);
    lightOn?.onGet(this.#shown(lightOn, ['light', 'power'], lightShown))
      .onSet((value) => this.#command('light', Boolean(value), 'display light'));

    const humidity = this.#service('humidity', Service.HumiditySensor, this.#label('humidity'), s.humidity === true && f.humidity);
    humidity?.getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(() => this.#requireOnline().humidity ?? 0);

    const filter = this.#service('filter', Service.FilterMaintenance, this.#label('filter'), Boolean(s.filter) && f.filter);
    filter?.getCharacteristic(Characteristic.FilterChangeIndication).onGet(() => this.#filterIndication(this.#requireOnline()));
    filter?.getCharacteristic(Characteristic.FilterLifeLevel).onGet(() => this.#filterLife(this.#requireOnline()));

    // A sensor Apple Home shows, notifies about and can start an automation with: on while the filter needs cleaning.
    const filterAlert = this.#service('filterAlert', Service.OccupancySensor, this.#label('filterAlert'), Boolean(s.filter) && f.filterAlert);
    filterAlert?.getCharacteristic(Characteristic.OccupancyDetected).onGet(() => this.#filterIndication(this.#requireOnline()));

    const outdoor = this.#service('outdoor', Service.TemperatureSensor, this.#label('outdoor'),
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
      .onGet(this.#shown(service.getCharacteristic(T), ['power', 'mode'], (st) => this.#targetState(st)))
      .onSet(async (value) => {
        if (value === T.OFF) {
          await this.#command('power', false, 'power off');
          return;
        }
        await this.#setMode(value === T.HEAT ? 'heat' : value === T.COOL ? 'cool' : 'auto');
      });
    service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.#shown(service.getCharacteristic(Characteristic.CurrentHeatingCoolingState), ['power', 'mode'], (st) => this.#currentState(st)));
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
      .onGet(this.#shown(target, ['targetTemperature'], (st) => this.#clampTarget(st.targetTemperature)))
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
    const service = this.#service('fan', Service.Fanv2, this.#label('fan'), wanted);
    if (!service) {
      return;
    }
    const s = this.model.supports;
    const manual = this.#manualSpeeds();
    const step = manual.length ? 100 / manual.length : 100;

    // The fan tile mirrors power but never switches the air conditioner off:
    // HomeKit sends "inactive" when the slider is dragged to zero.
    service.getCharacteristic(Characteristic.Active)
      .onGet(this.#shown(service.getCharacteristic(Characteristic.Active), ['power'], (st) => (st.power ? 1 : 0)))
      .onSet(async (value) => {
        const st = this.#intended();
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
        .onGet(this.#shown(service.getCharacteristic(Characteristic.RotationSpeed), ['fan'], (st) => this.#rotation(st)))
        .onSet(async (value) => {
          if (Number(value) <= 0) {
            // Zero on the slider means Auto, as in homebridge-smartthings-oauth.
            // It never powers the unit off.
            if (s.fan.speeds.auto !== undefined && this.#intended().fan !== 'auto') {
              await this.#command('fan', 'auto', 'fan auto');
            } else {
              setTimeout(() => this.#push(), 600);
            }
            return;
          }
          const index = Math.min(manual.length - 1, Math.max(0, Math.round(Number(value) / step) - 1));
          await this.#command('fan', manual[index], `fan ${manual[index]}`);
        });
    }
    if (s.fan.speeds.auto !== undefined) {
      service.getCharacteristic(Characteristic.TargetFanState)
        .onGet(this.#shown(service.getCharacteristic(Characteristic.TargetFanState), ['fan'], (st) => (st.fan === 'auto' ? 1 : 0)))
        .onSet(async (value) => {
          const st = this.#intended();
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
        .onGet(this.#shown(service.getCharacteristic(Characteristic.SwingMode), ['swing'], (st) => (st.swing && st.swing !== 'off' ? 1 : 0)))
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
    // Auto shows as 0 %: the slider has no position of its own for it.
    const index = manual.indexOf(st.fan);
    return index < 0 ? 0 : Math.round(((index + 1) * 100) / manual.length);
  }

  async #setMode(mode) {
    const st = this.#intended();
    if (!st.power) {
      await this.#command('power', true, 'power on');
    }
    // The appliance comes back in the mode it was left in: when that is the
    // mode asked for, switching on is the only command (and the only beep).
    if (st.mode !== mode) {
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
        if (fan.testCharacteristic(Characteristic.RotationSpeed)) {
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

    for (const [key, service] of this.services) {
      if (service.sl?.isOn && free(...switchKinds(key))) {
        service.updateCharacteristic(Characteristic.On, Boolean(service.sl.isOn(st)));
      }
    }
    if (free('light', 'power')) {
      get('light')?.updateCharacteristic(Characteristic.On, lightShown(st));
    }
    if (st.humidity !== null && st.humidity !== undefined) {
      get('humidity')?.updateCharacteristic(Characteristic.CurrentRelativeHumidity, st.humidity);
    }
    get('filter')?.updateCharacteristic(Characteristic.FilterChangeIndication, this.#filterIndication(st));
    get('filter')?.updateCharacteristic(Characteristic.FilterLifeLevel, this.#filterLife(st));
    get('filterAlert')?.updateCharacteristic(Characteristic.OccupancyDetected, this.#filterIndication(st));
    if (this.model?.supports?.filter) {
      // Said once each way, so the log shows when the filter asked for cleaning and when that ended.
      const due = this.#filterIndication(st) === 1;
      if (this.context.filterDue !== undefined && this.context.filterDue !== due) {
        this.log.info(`[${this.displayName}] ${due ? 'the filter needs cleaning.' : 'the filter is clean again.'}`);
      }
      this.context.filterDue = due;
    }
    if (st.outdoorTemperature !== undefined) {
      get('outdoor')?.updateCharacteristic(Characteristic.CurrentTemperature, st.outdoorTemperature);
    }
  }
}

/**
 * The display is dark while the air conditioner is off, whatever its light
 * setting says. Showing it "on" then would make the tile read "Powered On".
 */
/**
 * The commands a switch tile waits on. Power is one of them: switching the unit off shows every
 * switch off at once, and that must not be undone by a reading taken before the unit reported it.
 */
function switchKinds(key) {
  return key === 'dry' || key === 'fanOnly' ? ['power', 'mode']
    : key.startsWith('fan') ? ['fan', 'power'] : PRESET_FEATURES.includes(key) ? ['preset', 'windFreeResource', 'power'] : [key, 'power'];
}

function lightShown(state) {
  return Boolean(state.power) && Boolean(state.light);
}

/** The accessory is named exactly as the user typed it. */
export function accessoryName(name) {
  return String(name || '').trim() || 'Samsung AC';
}
