import { failureText } from '../deviceLink.js';
import { alarmText, buildWasherModel, WASHER_STAGES } from '../capabilities/washer.js';
import { eveCharacteristics } from './eve.js';
import { markPrimary } from './primary.js';

const FINISHED_HOLD_MS = 10 * 60 * 1000; // how long "Finished" stays detected
const LABELS = {
  cycle: '', finished: 'Finished', progress: 'Progress', kidsLock: 'Kids Lock', alert: 'Alert',
  wash: 'Washing', rinse: 'Rinsing', spin: 'Spinning', drumClean: 'Drum Clean',
};
const STAGE_WORDS = { wash: 'washing', rinse: 'rinsing', spin: 'spinning', drumcleaning: 'drum cleaning', weightsensing: 'weighing the load' };
export const CYCLE_STYLES = ['valve', 'sensor'];
export const WASHER_FEATURES = {
  cycleTile: true, finishedSensor: true, energyEve: true,
  // Trials, on until the owner switches them off: a sensor for each stage the washer names, and drum clean.
  stageSensors: true, drumCleanSensor: true,
  // Extras, off until the owner asks for them.
  progressTile: false, kidsLockSensor: false, alertSensor: false,
};

/**
 * A washer, dryer or dishwasher as a read-only HomeKit accessory:
 *  - a Valve tile that shows the cycle running and the time remaining
 *  - an occupancy sensor that turns on when a cycle ends (for notifications)
 *  - Eve power and energy readings
 * Nothing is written to the appliance.
 */
export class WasherAccessory {
  constructor({ api, log, accessory, link, displayName, features = {}, cycleStyle = 'valve', finishedHoldMs = FINISHED_HOLD_MS }) {
    // 'valve':  a valve tile with the countdown; a tap is undone at once
    // 'sensor': a running sensor; never accepts a tap, has no countdown
    // (A valve without write permission was tried: the Home app still sends the
    // tap, gets a refusal and shows "No Response" for some seconds.)
    this.cycleStyle = CYCLE_STYLES.includes(cycleStyle) ? cycleStyle : 'valve';
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

    if (this.context.resources) {
      this.model = buildWasherModel(this.context.resources);
    }
    this.#buildServices();
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
    const { Perms } = this.hap;
    if (this.features.cycleTile && this.cycleStyle === 'sensor') {
      drop(Service.Valve, 'cycle');
      this.#service('cycle', Service.OccupancySensor, 'running');
    } else if (this.features.cycleTile) {
      drop(Service.OccupancySensor, 'running');
      const valve = this.#service('cycle', Service.Valve, 'cycle');
      // Restores write permission on tiles created by 1.0.18, which had none.
      const perms = [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY];
      const undo = () => { setImmediate(() => this.#push()); };
      valve.setCharacteristic(Characteristic.ValveType, Characteristic.ValveType.GENERIC_VALVE);
      valve.getCharacteristic(Characteristic.RemainingDuration).setProps({ maxValue: 86400 });
      // The Home app only shows a countdown on a valve that also has a set duration.
      valve.getCharacteristic(Characteristic.SetDuration).setProps({ maxValue: 86400, perms }).onSet(undo);
      // The appliance does not accept a remote start: a tap that still arrives is undone at once.
      valve.getCharacteristic(Characteristic.Active).setProps({ perms }).onSet(undo);
    } else {
      drop(Service.Valve, 'cycle');
      drop(Service.OccupancySensor, 'running');
    }
    if (this.features.finishedSensor) {
      this.#service('finished', Service.OccupancySensor, 'finished');
    } else {
      drop(Service.OccupancySensor, 'finished');
    }
    const supports = this.model?.supports ?? {};
    // A percentage is the only number the Home app prints on a tile, so the
    // cycle's progress is shown as one (the tile carries a humidity icon).
    if (this.features.progressTile && supports.progress !== false) {
      this.#service('progress', Service.HumiditySensor, 'progress');
    } else {
      drop(Service.HumiditySensor, 'progress');
      this.services.delete('progress');
    }
    if (this.features.kidsLockSensor && supports.kidsLock !== false) {
      const lock = this.#service('kidsLock', Service.LockMechanism, 'kidsLock');
      // Read-only: the lock is set on the appliance. Show the truth again.
      lock.getCharacteristic(Characteristic.LockTargetState).onSet(() => { setTimeout(() => this.#push(), 300).unref?.(); });
    } else {
      drop(Service.LockMechanism, 'kidsLock');
      this.services.delete('kidsLock');
    }
    // One sensor per stage the washer itself lists, detected only during that stage: for automations
    // such as "tell me when the spin starts". The Home app shows no free text, so a sensor it is.
    for (const stage of WASHER_STAGES) {
      if (this.features.stageSensors && (supports.stages ?? []).includes(stage)) {
        this.#service(stage, Service.OccupancySensor, `stage-${stage}`);
      } else {
        drop(Service.OccupancySensor, `stage-${stage}`);
        this.services.delete(stage);
      }
    }
    if (this.features.drumCleanSensor && supports.drumClean) {
      this.#service('drumClean', Service.OccupancySensor, 'drumClean');
    } else {
      drop(Service.OccupancySensor, 'drumClean');
      this.services.delete('drumClean');
    }
    if (this.features.alertSensor && supports.alarms !== false) {
      this.#service('alert', Service.OccupancySensor, 'alert');
    } else {
      drop(Service.OccupancySensor, 'alert');
      this.services.delete('alert');
    }
    // Power and energy ride on whichever tile is shown.
    this.energyHost = this.services.get('cycle') ?? this.services.get('finished') ?? null;
    // The cycle tile is the face of the group; without it, the finished sensor.
    markPrimary(this.accessory, this.energyHost);
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
    const before = this.model;
    this.model = buildWasherModel(resources);
    this.context.resources = resources;
    const st = this.model.state;
    // Parts that depend on what the appliance reports appear once it first reports them.
    if (JSON.stringify(before?.supports ?? null) !== JSON.stringify(this.model.supports)) {
      this.#buildServices();
    }
    this.#sayStage(before?.state ?? null, st);
    // What was last seen is kept with the accessory, so a restart of the
    // bridge neither repeats a notice already given nor misses a cycle that
    // ended while it was down.
    const seen = this.context.washerSeen ?? null;
    if (st.finished) {
      this.context.sendsFinish = true;
    }
    if (st.inCycle) {
      if (this.finished) {
        this.#clearFinished();
      }
    } else if (st.finished && seen && !seen.finished) {
      // The appliance itself says the cycle is complete.
      this.#markFinished();
    } else if (!st.finished && seen?.inCycle) {
      if (this.context.sendsFinish) {
        // This model announces "finished" itself; leaving a cycle without
        // it means the cycle was cancelled or switched off.
        this.log.info(`[${this.displayName}] cycle stopped before its end; no "finished" notice.`);
      } else {
        this.#markFinished();
      }
    }
    this.context.washerSeen = { inCycle: st.inCycle, finished: st.finished };
    this.#push();
  }

  /** The course when a cycle starts, and each new stage: words and a course number only. */
  #sayStage(was, st) {
    if (!was) {
      return;
    }
    if (st.inCycle && !was.inCycle) {
      const course = st.course ? (st.course.drumClean ? 'drum clean' : `course ${st.course.code}`) : 'a course';
      this.log.info(`[${this.displayName}] cycle started: ${course}.`);
    }
    if (st.inCycle && st.stage && st.stage !== was.stage) {
      this.log.info(`[${this.displayName}] stage: ${STAGE_WORDS[st.stage] ?? st.stage}.`);
    }
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
    if (this.cycleStyle !== 'sensor') {
      this.services.get('cycle')?.updateCharacteristic(Characteristic.Active,
        new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    }
    if (!this.services.has('cycle') || this.cycleStyle === 'sensor') {
      this.services.get('finished')?.updateCharacteristic(Characteristic.OccupancyDetected,
        new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    }
  }

  #push() {
    const { Characteristic } = this.hap;
    const st = this.model?.state ?? { inCycle: false, running: false, remainingSeconds: 0, powerWatts: null, energyKWh: null, percent: 0, kidsLock: false, alarms: [] };
    const valve = this.cycleStyle === 'sensor' ? null : this.services.get('cycle');
    if (this.cycleStyle === 'sensor') {
      this.services.get('cycle')?.updateCharacteristic(Characteristic.OccupancyDetected, st.inCycle ? 1 : 0);
    }
    if (valve) {
      valve.updateCharacteristic(Characteristic.Active, st.inCycle ? 1 : 0);
      valve.updateCharacteristic(Characteristic.InUse, st.running ? 1 : 0);
      const remaining = Math.min(86400, Math.max(0, st.remainingSeconds));
      // The cycle's length: the longest time remaining seen since it started.
      this.cycleLength = st.inCycle ? Math.max(this.cycleLength ?? 0, remaining) : 0;
      valve.updateCharacteristic(Characteristic.SetDuration, this.cycleLength);
      valve.updateCharacteristic(Characteristic.RemainingDuration, remaining);
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
    this.services.get('progress')?.updateCharacteristic(Characteristic.CurrentRelativeHumidity, st.percent ?? 0);
    for (const stage of WASHER_STAGES) {
      this.services.get(stage)?.updateCharacteristic(Characteristic.OccupancyDetected, st.inCycle && st.stage === stage ? 1 : 0);
    }
    this.services.get('drumClean')?.updateCharacteristic(Characteristic.OccupancyDetected, st.drumClean ? 1 : 0);
    const lock = this.services.get('kidsLock');
    if (lock) {
      const value = st.kidsLock ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
      lock.updateCharacteristic(Characteristic.LockCurrentState, value);
      lock.updateCharacteristic(Characteristic.LockTargetState, value);
    }
    const alarms = st.alarms ?? [];
    if (alarms.length && !this.alarmed) {
      this.log.warn(`[${this.displayName}] the appliance reports: ${alarms.map(alarmText).join(', ')}`);
    }
    this.alarmed = alarms.length > 0;
    this.services.get('alert')?.updateCharacteristic(Characteristic.OccupancyDetected, this.alarmed ? 1 : 0);
  }
}
