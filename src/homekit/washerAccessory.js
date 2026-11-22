import { buildWasherModel } from '../capabilities/washer.js';
import { eveCharacteristics } from './eve.js';

const FINISHED_HOLD_MS = 10 * 60 * 1000; // how long "Finished" stays detected
const LABELS = { cycle: '', finished: 'Finished' };
export const WASHER_FEATURES = { cycleTile: true, finishedSensor: true, energyEve: true };

/**
 * A washer, dryer or dishwasher as a read-only HomeKit accessory:
 *  - a Valve tile that shows the cycle running and the time remaining
 *  - an occupancy sensor that turns on when a cycle ends (for notifications)
 *  - Eve power and energy readings
 * Nothing is written to the appliance.
 */
export class WasherAccessory {
  constructor({ api, log, accessory, link, displayName, features = {}, finishedHoldMs = FINISHED_HOLD_MS }) {
    this.features = { ...WASHER_FEATURES, ...features };
    this.api = api;
    this.hap = api.hap;
    this.log = log;
    this.accessory = accessory;
    this.link = link;
    this.displayName = displayName;
    this.context = accessory.context;
    this.finishedHoldMs = finishedHoldMs;
    this.eve = eveCharacteristics(this.hap);
    this.services = new Map();
    this.model = null;
    this.finished = false;
    this.finishTimer = null;
    this.wasInCycle = null;

    this.#buildServices();
    if (this.context.resources) {
      this.model = buildWasherModel(this.context.resources);
    }
    link.on('update', (resources) => this.#onUpdate(resources));
    link.on('availability', (online, error) => this.#onAvailability(online, error));
    if (link.resources) {
      this.#onUpdate(link.resources);
    } else {
      this.#push();
    }
  }

  get online() {
    return this.link.online && this.model !== null;
  }

  #label(key) {
    return LABELS[key] ? `${this.displayName} ${LABELS[key]}` : this.displayName;
  }

  /** Name a tile, unless the owner renamed it in the Home app. */
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

  #service(key, type, subtype) {
    const name = this.#label(key);
    const service = this.accessory.getServiceById(type, subtype) ?? this.accessory.addService(type, name, subtype);
    this.#applyName(key, service, name);
    this.services.set(key, service);
    return service;
  }

  #buildServices() {
    const { Service, Characteristic } = this.hap;
    const info = this.accessory.getService(Service.AccessoryInformation);
    info?.setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, String(this.context.model ?? 'Laundry appliance').slice(0, 64));

    // Each part can be switched off in the settings; a part that is off is removed.
    const drop = (type, subtype) => {
      const old = this.accessory.getServiceById(type, subtype);
      if (old) {
        this.accessory.removeService(old);
      }
    };
    if (this.features.cycleTile) {
      const valve = this.#service('cycle', Service.Valve, 'cycle');
      valve.setCharacteristic(Characteristic.ValveType, Characteristic.ValveType.GENERIC_VALVE);
      valve.getCharacteristic(Characteristic.RemainingDuration).setProps({ maxValue: 86400 });
      valve.getCharacteristic(Characteristic.Active).onSet(() => {
        // Read-only: the appliance does not accept a remote start. Show the truth again.
        setTimeout(() => this.#push(), 300).unref?.();
      });
    } else {
      drop(Service.Valve, 'cycle');
    }
    if (this.features.finishedSensor) {
      this.#service('finished', Service.OccupancySensor, 'finished');
    } else {
      drop(Service.OccupancySensor, 'finished');
    }
    // Power and energy ride on whichever tile is shown.
    this.energyHost = this.services.get('cycle') ?? this.services.get('finished') ?? null;
    for (const C of [this.eve.Consumption, this.eve.TotalConsumption]) {
      for (const service of this.services.values()) {
        const wanted = this.features.energyEve && service === this.energyHost;
        if (wanted && !service.testCharacteristic(C)) {
          service.addOptionalCharacteristic(C);
        } else if (!wanted && service.testCharacteristic(C)) {
          service.removeCharacteristic(service.getCharacteristic(C));
        }
      }
    }
  }

  #onUpdate(resources) {
    this.model = buildWasherModel(resources);
    this.context.resources = resources;
    const st = this.model.state;
    if (this.wasInCycle === true && !st.inCycle) {
      this.#markFinished();
    } else if (this.wasInCycle === null && st.finished) {
      // First contact while the appliance still shows "finished".
      this.#markFinished();
    } else if (st.inCycle && this.finished) {
      this.#clearFinished();
    }
    this.wasInCycle = st.inCycle;
    this.#push();
  }

  #markFinished() {
    this.finished = true;
    this.log.info(`[${this.displayName}] cycle finished.`);
    clearTimeout(this.finishTimer);
    this.finishTimer = setTimeout(() => { this.#clearFinished(); this.#push(); }, this.finishedHoldMs);
    this.finishTimer.unref?.();
  }

  #clearFinished() {
    this.finished = false;
    clearTimeout(this.finishTimer);
    this.finishTimer = null;
  }

  #onAvailability(online, error) {
    if (online) {
      this.log.info(`[${this.displayName}] connected.`);
      this.#push();
      return;
    }
    this.log.warn(`[${this.displayName}] not reachable${error?.message ? ` (${error.message})` : ''}. Will keep retrying.`);
    const { Characteristic, HapStatusError, HAPStatus } = this.hap;
    this.services.get('cycle')?.updateCharacteristic(Characteristic.Active,
      new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    if (!this.services.has('cycle')) {
      this.services.get('finished')?.updateCharacteristic(Characteristic.OccupancyDetected,
        new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    }
  }

  #push() {
    const { Characteristic } = this.hap;
    const st = this.model?.state ?? { inCycle: false, running: false, remainingSeconds: 0, powerWatts: null, energyKWh: null };
    const valve = this.services.get('cycle');
    if (valve) {
      valve.updateCharacteristic(Characteristic.Active, st.inCycle ? 1 : 0);
      valve.updateCharacteristic(Characteristic.InUse, st.running ? 1 : 0);
      valve.updateCharacteristic(Characteristic.RemainingDuration, Math.min(86400, Math.max(0, st.remainingSeconds)));
    }
    if (this.features.energyEve && this.energyHost) {
      if (st.powerWatts !== null) {
        this.energyHost.updateCharacteristic(this.eve.Consumption, st.powerWatts);
      }
      if (st.energyKWh !== null) {
        this.energyHost.updateCharacteristic(this.eve.TotalConsumption, st.energyKWh);
      }
    }
    this.services.get('finished')?.updateCharacteristic(Characteristic.OccupancyDetected, this.finished ? 1 : 0);
  }
}
