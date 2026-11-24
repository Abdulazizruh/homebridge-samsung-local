import { failureText } from '../deviceLink.js';
import { applianceWrites, buildApplianceModel, partWanted } from '../capabilities/appliance.js';
import { eveCharacteristics } from './eve.js';

const HOLD_MS = 8000; // how long a command just accepted is shown before the appliance's own report takes over
const LABELS = {
  power: '', speed: '', clean: 'Clean', airQuality: 'Air Quality', humidity: 'Humidity', battery: 'Battery',
  running: 'Running', kidsLock: 'Kids Lock', alert: 'Alert', 'boost.fridge': 'Power Cool', 'boost.freezer': 'Power Freeze',
};

/**
 * Any appliance read by the shared reader (air purifier, dehumidifier, refrigerator,
 * robot vacuum, oven, …) as one HomeKit accessory: one service per part the appliance
 * reports and the owner left switched on.
 *
 * Readings are sensors. Controls are trials until confirmed on a real appliance of
 * that type: a command counts as done only once the appliance accepted it, and the
 * tile returns to what the appliance itself reports a few seconds later.
 */
export class ApplianceAccessory {
  constructor({ api, log, accessory, link, displayName, features = {}, kind = 'unknown' }) {
    this.api = api;
    this.hap = api.hap;
    this.log = log;
    this.accessory = accessory;
    this.link = link;
    this.displayName = displayName;
    this.context = accessory.context;
    this.features = features ?? {};
    this.kind = kind;
    this.eve = eveCharacteristics(this.hap);
    this.services = new Map(); // part id -> service
    this.pending = new Map(); // part id -> { value, until }
    this.model = buildApplianceModel(this.context.resources ?? {}, kind);
    this.shape = null;
    this.#build();
    link.on('update', (resources) => this.#onUpdate(resources));
    link.on('availability', (online, error) => this.#onAvailability(online, error));
    if (link.resources) {
      this.#onUpdate(link.resources);
    } else {
      this.#push();
    }
  }

  #part(id) {
    return this.model.parts.find((p) => p.id === id) ?? null;
  }

  /** Whether the speed part is shown; power then rides on its tile. */
  #speedShown() {
    const part = this.#part('speed');
    return Boolean(part) && partWanted(part, this.features);
  }

  #wanted() {
    return this.model.parts.filter((p) => partWanted(p, this.features));
  }

  /** The service type and subtype that carry a part; null for a part that rides on another. */
  #home(part) {
    const { Service } = this.hap;
    const fanKind = this.kind === 'airPurifier' ? Service.AirPurifier : Service.Fanv2;
    switch (part.type) {
      case 'power': return this.#speedShown() ? [fanKind, 'main'] : [Service.Switch, 'power'];
      case 'speed': return [fanKind, 'main'];
      case 'clean': return [Service.Switch, 'clean'];
      case 'boost': return [Service.Switch, part.id];
      case 'airQuality': return [Service.AirQualitySensor, 'air'];
      case 'filter': return [Service.FilterMaintenance, part.id];
      case 'temperature': return [Service.TemperatureSensor, part.id];
      case 'humidity': return [Service.HumiditySensor, 'humidity'];
      case 'door': return [Service.ContactSensor, part.id];
      case 'battery': return [Service.Battery, 'battery'];
      case 'running': return [Service.OccupancySensor, 'running'];
      case 'kidsLock': return [Service.LockMechanism, 'kidsLock'];
      case 'alert': return [Service.OccupancySensor, 'alert'];
      default: return null; // energy
    }
  }

  #label(part) {
    const word = part.type === 'filter' ? `${part.name === 'main' ? '' : `${part.name} `}Filter`.replace(/^./, (c) => c.toUpperCase())
      : part.name ?? LABELS[part.id] ?? LABELS[part.type] ?? '';
    return word ? `${this.displayName} ${word}` : this.displayName;
  }

  /**
   * Name a tile after the appliance's name in the plugin settings, as the air conditioners
   * and washers do: a new name there reaches every tile, except one the owner renamed in
   * the Home app, which is left alone.
   */
  #applyName(key, service, name) {
    const { Characteristic } = this.hap;
    const applied = (this.context.appliedNames ??= {});
    if (!service.testCharacteristic(Characteristic.ConfiguredName)) {
      service.addOptionalCharacteristic(Characteristic.ConfiguredName);
    }
    const current = service.getCharacteristic(Characteristic.ConfiguredName).value;
    if (!current || current === applied[key]) {
      service.updateCharacteristic(Characteristic.ConfiguredName, name);
      service.updateCharacteristic(Characteristic.Name, name);
      applied[key] = name;
    }
  }

  #build() {
    const { Service, Characteristic } = this.hap;
    const info = this.accessory.getService(Service.AccessoryInformation);
    info?.setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, String(this.context.model ?? this.model.model ?? 'Appliance').slice(0, 64));

    const wanted = this.#wanted();
    this.shape = wanted.map((p) => p.id).join('|');
    const keep = new Set();
    this.services.clear();
    for (const part of wanted) {
      const home = this.#home(part);
      if (!home) { continue; }
      const [type, subtype] = home;
      const name = this.#label(part);
      const service = this.accessory.getServiceById(type, subtype) ?? this.accessory.addService(type, name, subtype);
      // Power and speed share one tile: the tile is named once, by whichever comes first.
      if (!keep.has(service)) {
        this.#applyName(`${type.UUID}:${subtype}`, service, name);
      }
      keep.add(service);
      this.services.set(part.id, service);
      this.#wire(part, service);
    }
    for (const service of [...this.accessory.services]) {
      if (service !== info && !keep.has(service)) {
        this.accessory.removeService(service); // a part switched off in the settings, or no longer reported
      }
    }
    // Power and energy ride on the first tile, for Eve.
    this.energyHost = partWanted({ id: 'energy', type: 'energy' }, this.features) && this.#part('energy')
      ? [...keep][0] ?? null : null;
    for (const C of [this.eve.Consumption, this.eve.TotalConsumption]) {
      for (const service of keep) {
        if (service === this.energyHost && !service.testCharacteristic(C)) {
          service.addOptionalCharacteristic(C);
        } else if (service !== this.energyHost && service.testCharacteristic(C)) {
          service.removeCharacteristic(service.getCharacteristic(C));
        }
      }
    }
  }

  #wire(part, service) {
    const { Characteristic } = this.hap;
    const undo = () => { setTimeout(() => this.#push(), 300).unref?.(); };
    switch (part.type) {
      case 'power':
        if (this.#speedShown()) {
          service.getCharacteristic(Characteristic.Active).onSet((v) => this.#command('power', v === 1));
        } else {
          service.getCharacteristic(Characteristic.On).onSet((v) => (part.control ? this.#command('power', Boolean(v)) : undo()));
        }
        break;
      case 'speed': {
        const steps = Math.max(1, part.manual.length);
        service.getCharacteristic(Characteristic.RotationSpeed).setProps({ minValue: 0, maxValue: 100, minStep: Math.round(1000 / steps) / 10 })
          .onSet((v) => this.#setSpeed(Number(v)));
        const target = this.kind === 'airPurifier' ? Characteristic.TargetAirPurifierState : Characteristic.TargetFanState;
        service.getCharacteristic(target).onSet((v) => this.#setAuto(v === 1));
        if (!this.services.has('power')) {
          // Power is switched off in the settings: the tile's own on/off is shown, not obeyed.
          service.getCharacteristic(Characteristic.Active).onSet(undo);
        }
        break;
      }
      case 'clean':
      case 'boost':
        service.getCharacteristic(Characteristic.On).onSet((v) => this.#command(part.id, Boolean(v)));
        break;
      case 'temperature':
        service.getCharacteristic(Characteristic.CurrentTemperature).setProps({ minValue: -60, maxValue: 400, minStep: 0.1 });
        break;
      case 'kidsLock':
        // Read-only: the lock is set on the appliance. Show the truth again.
        service.getCharacteristic(Characteristic.LockTargetState).onSet(undo);
        break;
      default:
    }
  }

  #setSpeed(percent) {
    const part = this.#part('speed');
    if (!part || percent <= 0 || part.manual.length === 0) {
      return undefined; // "0" arrives together with an off command, which the power part carries
    }
    const index = Math.min(part.manual.length - 1, Math.max(0, Math.ceil((percent / 100) * part.manual.length) - 1));
    return this.#command('speed', part.manual[index]);
  }

  #setAuto(auto) {
    const part = this.#part('speed');
    if (!part) { return undefined; }
    if (auto) {
      return part.auto ? this.#command('speed', part.auto) : undefined;
    }
    const manual = part.manual.includes(part.value) ? part.value : (this.lastManual ?? part.manual[0]);
    return manual ? this.#command('speed', manual) : undefined;
  }

  /** Send one command. Done only once the appliance accepted it. */
  async #command(id, value) {
    const part = this.#part(id);
    const { HapStatusError, HAPStatus } = this.hap;
    if (!part || !part.control) {
      setTimeout(() => this.#push(), 300).unref?.();
      return;
    }
    try {
      await this.link.send(applianceWrites(part, value));
    } catch (err) {
      this.log.warn(`[${this.displayName}] ${id} → ${value} failed: ${err.message}`);
      setTimeout(() => this.#push(), 300).unref?.();
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    this.log.debug(`[${this.displayName}] ${id} → ${value} accepted by the appliance.`);
    this.pending.set(id, { value, until: Date.now() + HOLD_MS });
    const timer = setTimeout(() => this.#push(), HOLD_MS + 200);
    timer.unref?.();
    this.#push();
  }

  /** What to show for a part: a command just accepted, until the appliance reports or the hold ends. */
  #shown(part) {
    const held = this.pending.get(part.id);
    if (!held) { return part.value; }
    if (held.value === part.value || Date.now() > held.until) {
      this.pending.delete(part.id);
      return part.value;
    }
    return held.value;
  }

  #onUpdate(resources) {
    this.model = buildApplianceModel(resources, this.kind);
    this.context.resources = resources;
    if (this.#wanted().map((p) => p.id).join('|') !== this.shape) {
      this.#build(); // the appliance began or stopped reporting something
      this.api.updatePlatformAccessories?.([this.accessory]);
    }
    this.#push();
  }

  #onAvailability(online, error) {
    if (online) {
      this.log.info(`[${this.displayName}] connected.`);
      this.#push();
      return;
    }
    if (error?.code === 'helper_down') {
      this.log.debug?.(`[${this.displayName}] not reachable${failureText(error)}.`);
    } else if (error?.code === 'timeout' && error?.stage === 'session') {
      this.log.info(`[${this.displayName}] does not answer${failureText(error)}. It may be switched off at the wall; it connects by itself when it is back.`);
    } else {
      this.log.warn(`[${this.displayName}] not reachable${failureText(error)}. Will keep retrying.`);
    }
    // "No Response" on the first tile, as the other appliance kinds do.
    const { Characteristic, HapStatusError, HAPStatus } = this.hap;
    const first = this.#wanted().find((p) => this.services.has(p.id));
    const lead = { power: this.#speedShown() ? Characteristic.Active : Characteristic.On, speed: Characteristic.Active, clean: Characteristic.On,
      boost: Characteristic.On, airQuality: Characteristic.AirQuality, temperature: Characteristic.CurrentTemperature,
      door: Characteristic.ContactSensorState, humidity: Characteristic.CurrentRelativeHumidity }[first?.type];
    if (first && lead) {
      this.services.get(first.id).updateCharacteristic(lead, new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    }
  }

  #push() {
    const { Characteristic: C } = this.hap;
    const power = this.#part('power');
    const on = power ? Boolean(this.#shown(power)) : true;
    for (const part of this.model.parts) {
      const service = this.services.get(part.id);
      if (!service) {
        if (part.type === 'energy' && this.energyHost) {
          if (part.value.watts !== null) { this.energyHost.updateCharacteristic(this.eve.Consumption, part.value.watts); }
          if (part.value.kWh !== null) { this.energyHost.updateCharacteristic(this.eve.TotalConsumption, part.value.kWh); }
        }
        continue;
      }
      const value = this.#shown(part);
      switch (part.type) {
        case 'power':
          if (this.#speedShown()) {
            service.updateCharacteristic(C.Active, value ? 1 : 0);
          } else {
            service.updateCharacteristic(C.On, Boolean(value));
          }
          break;
        case 'speed': {
          const purifier = this.kind === 'airPurifier';
          const auto = part.auto !== null && value === part.auto;
          const index = part.manual.indexOf(value);
          if (index >= 0) { this.lastManual = value; }
          service.updateCharacteristic(C.Active, on ? 1 : 0);
          service.updateCharacteristic(purifier ? C.CurrentAirPurifierState : C.CurrentFanState, on ? 2 : 0);
          service.updateCharacteristic(purifier ? C.TargetAirPurifierState : C.TargetFanState, auto ? 1 : 0);
          if (index >= 0) {
            service.updateCharacteristic(C.RotationSpeed, Math.round(((index + 1) / part.manual.length) * 1000) / 10);
          }
          break;
        }
        case 'clean':
        case 'boost':
          service.updateCharacteristic(C.On, Boolean(value));
          break;
        case 'airQuality': {
          const level = value.level ?? (value.pm25 === undefined ? null
            : value.pm25 <= 15 ? 1 : value.pm25 <= 35 ? 2 : value.pm25 <= 75 ? 3 : 4);
          // The appliance grades 1 (clean) to 4; HomeKit 1 (excellent) to 5 (poor).
          service.updateCharacteristic(C.AirQuality, level === null ? 0 : [1, 1, 3, 4, 5][Math.min(4, Math.max(1, level))]);
          if (value.pm25 !== undefined) { service.updateCharacteristic(C.PM2_5Density, Math.min(1000, Math.max(0, value.pm25))); }
          if (value.pm10 !== undefined) { service.updateCharacteristic(C.PM10Density, Math.min(1000, Math.max(0, value.pm10))); }
          break;
        }
        case 'filter':
          service.updateCharacteristic(C.FilterChangeIndication, part.change ? 1 : 0);
          if (value !== null) { service.updateCharacteristic(C.FilterLifeLevel, value); }
          break;
        case 'temperature':
          service.updateCharacteristic(C.CurrentTemperature, Math.min(400, Math.max(-60, value)));
          break;
        case 'humidity':
          service.updateCharacteristic(C.CurrentRelativeHumidity, Math.min(100, Math.max(0, value)));
          break;
        case 'door':
          service.updateCharacteristic(C.ContactSensorState, value ? 1 : 0);
          break;
        case 'battery':
          service.updateCharacteristic(C.BatteryLevel, value);
          service.updateCharacteristic(C.StatusLowBattery, value <= 15 ? 1 : 0);
          break;
        case 'running':
          service.updateCharacteristic(C.OccupancyDetected, value ? 1 : 0);
          break;
        case 'kidsLock': {
          const state = value ? C.LockCurrentState.SECURED : C.LockCurrentState.UNSECURED;
          service.updateCharacteristic(C.LockCurrentState, state);
          service.updateCharacteristic(C.LockTargetState, state);
          break;
        }
        case 'alert':
          if (value.length && !this.alarmed) {
            this.log.warn(`[${this.displayName}] the appliance reports: ${value.join(', ')}`);
          }
          this.alarmed = value.length > 0;
          service.updateCharacteristic(C.OccupancyDetected, this.alarmed ? 1 : 0);
          break;
        default:
      }
    }
  }
}
