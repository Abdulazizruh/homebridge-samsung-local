import { failureText } from '../deviceLink.js';
import { alarmText, buildWasherModel, courseName, remoteControlEnabled, WASHER_CONTROLS, WASHER_STAGES, washerControls, washerToggles } from '../capabilities/washer.js';
import { eveCharacteristics } from './eve.js';
import { markPrimary } from './primary.js';

const FINISHED_HOLD_MS = 10 * 60 * 1000; // how long "Finished" stays detected
const LABELS = {
  cycle: '', finished: 'Finished', unload: 'Unload', smartControl: 'Smart Control', progress: 'Progress', kidsLock: 'Kids Lock', alert: 'Alert',
  wash: 'Washing', rinse: 'Rinsing', spin: 'Spinning', drumClean: 'Drum Clean',
  ctlPower: 'Power', ctlRun: 'Start Pause', ctlStop: 'Stop', ctlBuzzer: 'Sound', ctlSpin: 'Spin', ctlRinse: 'Rinse',
  ctlWaterTemp: 'Water Temp', ctlWaterLevel: 'Water Level', ctlWashTime: 'Wash Time', ctlCourse: 'Course Next',
  ctlSuperSpeed: 'Super Speed', ctlBubbleSoak: 'Bubble Soak', ctlBubbleStorm: 'Eco Bubble',
};
/** A choice gets one switch per value, named with this word and the washer's own name for the value. */
const CHOICE_WORDS = { ctlSpin: 'Spin', ctlRinse: 'Rinse', ctlWaterTemp: 'Water', ctlWaterLevel: 'Water Level', ctlWashTime: 'Wash Time', ctlCourse: 'Course' };
/** "ExtraHigh" reads as "Extra High" on a tile; what is sent stays the washer's own word. */
/** The panel's extra buttons sit together on an accessory of their own: one group in Apple Home. */
const OPTION_IDS = ['ctlSuperSpeed', 'ctlBubbleStorm', 'ctlBubbleSoak'];
/** A name Apple Home accepts: letters, numbers, spaces and plain punctuation ("Rinse + Spin" is refused). */
const homeName = (text) => String(text).replace(/\s*[+&]\s*/g, ' and ').replace(/[^\p{L}\p{N} '.,-]/gu, '').replace(/\s+/g, ' ').trim();
const spaced = (value) => String(value).replace(/([a-z])([A-Z])/g, '$1 $2');
const STAGE_WORDS = { wash: 'washing', rinse: 'rinsing', spin: 'spinning', drumcleaning: 'drum cleaning', weightsensing: 'weighing the load' };
export const CYCLE_STYLES = ['valve', 'sensor'];
export const WASHER_FEATURES = {
  cycleTile: true, finishedSensor: true, energyEve: true,
  // Trials, on until the owner switches them off: a sensor for each stage the washer names, and drum clean.
  stageSensors: true, drumCleanSensor: true,
  // Extras, off until the owner asks for them.
  progressTile: false, kidsLockSensor: false, alertSensor: false, unloadSensor: false, smartControlSensor: false,
  // Control trial, off until the owner ticks each one: what a washer accepts differs by model.
  ...Object.fromEntries(WASHER_CONTROLS.map((id) => [id, false])),
};

/**
 * A washer, dryer or dishwasher as a read-only HomeKit accessory:
 *  - a Valve tile that shows the cycle running and the time remaining
 *  - an occupancy sensor that turns on when a cycle ends (for notifications)
 *  - Eve power and energy readings
 * Nothing is written to the appliance, unless the owner switches on a control trial:
 * then that control's command is sent when its switch is used, and its answer is logged.
 */
export class WasherAccessory {
  /** How long a control trial waits for the washer's next report: both engines read it 4 s after a command. */
  static controlWaitMs = 9000;
  /** A reading that arrives this long after a command was taken after it. */
  static freshAfterMs = 3800;
  /** How soon a "next" or "stop" press shows off again. */
  static pressBackMs = 800;
  /** Writes for the same control closer together than this count as one use. */
  static tapGapMs = 1000;

  /** "Unload" reminder: how often it comes while the washing stays inside, and how long each one shows. */
  static unloadEveryMs = 30 * 60 * 1000;
  static unloadHoldMs = 5 * 60 * 1000;

  constructor({ api, log, accessory, link, displayName, features = {}, cycleStyle = 'valve', finishedHoldMs = FINISHED_HOLD_MS, groups = null }) {
    // 'valve':  a valve tile with the countdown; a tap is undone at once
    // 'sensor': a running sensor; never accepts a tap, has no countdown
    // (A valve without write permission was tried: the Home app still sends the
    // tap, gets a refusal and shows "No Response" for some seconds.)
    this.cycleStyle = CYCLE_STYLES.includes(cycleStyle) ? cycleStyle : 'valve';
    this.features = { ...WASHER_FEATURES, ...features };
    this.api = api;
    link.setMaxListeners?.(50); // several control trials may wait for the same report
    this.hap = api.hap;
    this.log = log;
    this.accessory = accessory;
    // Gives each choice (spin, rinse, ...) an accessory of its own, so Apple Home shows it as one group.
    this.groups = groups;
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
    const [id, value] = String(key).split(':');
    if (value !== undefined && CHOICE_WORDS[id]) {
      // A course carries its panel name where the model's names are known, else its number.
      const word = id === 'ctlCourse' ? (courseName(this.link.resources ?? this.context.resources ?? {}, value) ?? value) : spaced(value);
      return homeName(`${CHOICE_WORDS[id]} ${word}`);
    }
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
      applied[key] = name;
    }
    // The plain name is always ours: one Apple Home refuses (a "+" in it) must not stay because the tile was renamed.
    if (service.getCharacteristic(Characteristic.Name).value !== name) {
      service.updateCharacteristic(Characteristic.Name, name);
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
    if (this.features.unloadSensor) {
      this.#service('unload', Service.OccupancySensor, 'unload');
    } else {
      drop(Service.OccupancySensor, 'unload');
      this.services.delete('unload');
    }
    // Smart Control is set at the panel only, so it is a sensor: detected while the washer takes a
    // start from outside. Also shown to those who ticked its switch in 1.9.0-beta.7.
    if ((this.features.smartControlSensor || this.features.ctlSmartControl)
      && remoteControlEnabled(this.link.resources ?? this.context.resources ?? {}) !== null) {
      this.#service('smartControl', Service.OccupancySensor, 'smartControl');
    } else {
      drop(Service.OccupancySensor, 'smartControl');
      this.services.delete('smartControl');
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
    const controls = washerControls(this.link.resources ?? this.context.resources ?? {});
    if ((this.features.kidsLockSensor || (this.features.ctlKidsLock && controls.ctlKidsLock)) && supports.kidsLock !== false) {
      const lock = this.#service('kidsLock', Service.LockMechanism, 'kidsLock');
      lock.getCharacteristic(Characteristic.LockTargetState).onSet((value) => {
        if (this.features.ctlKidsLock && controls.ctlKidsLock) {
          this.#tap('ctlKidsLock', value === Characteristic.LockTargetState.SECURED, 'switch');
        } else {
          // Read-only: the lock is set on the appliance. Show the truth again.
          setTimeout(() => this.#push(), 300).unref?.();
        }
      });
    } else {
      drop(Service.LockMechanism, 'kidsLock');
      this.services.delete('kidsLock');
    }
    // Control trial: one switch per control the owner ticked and the washer has the resource for.
    for (const id of WASHER_CONTROLS) {
      if (id === 'ctlKidsLock') {
        continue; // rides on the lock above
      }
      const choice = this.features[id] && controls[id]?.kind === 'choice' ? controls[id].values : [];
      // Each choice sits on an accessory of its own where the platform offers one: a group in Apple Home.
      const home = choice.length ? (this.groups?.get(id, `${this.displayName} ${id === 'ctlCourse' ? CHOICE_WORDS[id] : LABELS[id]}`) ?? this.accessory) : this.accessory;
      // Switches of a choice that is off, moved, or of a value the washer no longer lists, are removed.
      for (const acc of new Set([this.accessory, home])) {
        for (const old of acc.services.filter((s) => String(s.subtype ?? '').startsWith(`${id}:`))) {
          if (acc !== home || !choice.includes(old.subtype.slice(id.length + 1))) {
            this.services.delete(old.subtype);
            acc.removeService(old);
          }
        }
      }
      if (choice.length) {
        drop(Service.Switch, id);
        drop(Service.Fan, id); // the slider of 1.9.0-beta.3
        this.services.delete(id);
        if (home !== this.accessory) {
          home.getService(Service.AccessoryInformation)?.setCharacteristic(Characteristic.Manufacturer, 'Samsung')
            .setCharacteristic(Characteristic.Model, String(this.context.model ?? 'Laundry appliance').slice(0, 64));
        }
        for (const value of choice) {
          const key = `${id}:${value}`;
          const sw = home.getServiceById(Service.Switch, key) ?? home.addService(Service.Switch, this.#label(key), key);
          this.#applyName(key, sw, this.#label(key));
          this.services.set(key, sw);
          sw.getCharacteristic(Characteristic.On).onSet((on) => { this.#choose(id, value, Boolean(on)); });
        }
        // The slider of 1.9.0-beta.7 is gone: Apple Home counted it as one more thing that is "on" and
        // showed no value on the group's tile.
        for (const acc of new Set([this.accessory, home])) {
          const old = acc.getServiceById(Service.Fan, `${id}/slider`);
          if (old) {
            acc.removeService(old);
          }
        }
        this.services.delete(`${id}/slider`);
        this.groups?.publish(id);
        continue;
      }
      {
        const old = this.accessory.getServiceById(Service.Fan, `${id}/slider`);
        if (old) {
          this.accessory.removeService(old);
        }
        this.services.delete(`${id}/slider`);
      }
      this.groups?.drop(id);
      if (OPTION_IDS.includes(id)) {
        continue; // built together below
      }
      if (this.features[id] && controls[id]) {
        drop(Service.Fan, id);
        const sw = this.#service(id, Service.Switch, id);
        sw.getCharacteristic(Characteristic.On).onSet((value) => { this.#tap(id, Boolean(value), controls[id].kind); });
      } else {
        drop(Service.Switch, id);
        drop(Service.Fan, id);
        this.services.delete(id);
      }
    }
    // The panel's extra buttons: together on an accessory of their own where the platform offers one.
    const options = OPTION_IDS.filter((id) => this.features[id] && controls[id]);
    const optionsHome = options.length ? (this.groups?.get('options', `${this.displayName} Options`) ?? this.accessory) : null;
    for (const id of OPTION_IDS) {
      for (const acc of new Set([this.accessory, optionsHome])) {
        const old = acc?.getServiceById(Service.Switch, id);
        if (old && (acc !== optionsHome || !options.includes(id))) {
          acc.removeService(old); // unticked, or left on the washer's own accessory by 1.9.0-beta.7
        }
      }
      this.services.delete(id);
      if (options.includes(id)) {
        const name = optionsHome === this.accessory ? this.#label(id) : LABELS[id];
        const sw = optionsHome.getServiceById(Service.Switch, id) ?? optionsHome.addService(Service.Switch, name, id);
        this.#applyName(id, sw, name);
        this.services.set(id, sw);
        sw.getCharacteristic(Characteristic.On).onSet((value) => { this.#tap(id, Boolean(value), 'switch'); });
      }
    }
    if (options.length) {
      if (optionsHome !== this.accessory) {
        optionsHome.getService(Service.AccessoryInformation)?.setCharacteristic(Characteristic.Manufacturer, 'Samsung')
          .setCharacteristic(Characteristic.Model, String(this.context.model ?? 'Laundry appliance').slice(0, 64));
      }
      this.groups?.publish('options');
    } else {
      this.groups?.drop('options');
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
    // An extra switched at the washer (super speed, bubble): its own name, so a panel button can be matched to it.
    const had = this.context.resources ? washerToggles(this.context.resources) : null;
    for (const [name, on] of Object.entries(had ? washerToggles(resources) : {})) {
      if (name in had && had[name] !== on) {
        this.log.info(`[${this.displayName}] option changed: ${name} ${on ? 'On' : 'Off'}.`);
      }
    }
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
    // Switched off during the cycle: on while it ran, off now. A change, not a reading alone, since
    // some washers report "off" all along (a captured idle washer stayed "off" while running).
    const switchedOff = Boolean(seen?.inCycle && seen.poweredOn && st.poweredOff);
    if (st.finished && !switchedOff) {
      this.context.sendsFinish = true;
    }
    if (st.inCycle) {
      if (this.finished) {
        this.#clearFinished();
      }
    } else if (switchedOff) {
      // Switched off in the middle of a cycle: stopped, not finished, whatever else it reports.
      this.log.info(`[${this.displayName}] cycle stopped: the washer was switched off; no "finished" notice.`);
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
    if (st.inCycle && !seen?.inCycle) {
      // The meters at the start of the cycle, to say at its end what it used.
      this.context.washerCycleStart = { kWh: st.energyKWh ?? null, litres: st.waterLitres ?? null };
    }
    this.#unloadWatch(st, switchedOff);
    this.context.washerSeen = { inCycle: st.inCycle, finished: st.finished, poweredOn: st.inCycle ? (seen?.poweredOn || !st.poweredOff) : false };
    this.#push();
  }

  /**
   * A switch was used. Seen on a real washer: one use of a tile in Apple Home arrived as a dozen
   * writes within a second, and each went to the washer. So a press counts once a second, its "off"
   * is never a command, and a switch asked for the value it is already being set to is left alone.
   */
  #tap(id, value, kind) {
    const last = (this.taps ??= {})[id];
    const now = Date.now();
    if (kind === 'press') {
      if (!value || (last && now - last.at < WasherAccessory.tapGapMs)) {
        return;
      }
    } else if (last && last.value === value && (last.busy || now - last.at < WasherAccessory.tapGapMs)) {
      return;
    }
    const mine = (this.taps[id] = { at: now, value, busy: true });
    if (kind !== 'press') {
      // The tile stays where it was put until the washer reports: an older reading that arrives
      // in between must not flip it back for a moment.
      (this.switchHold ??= {})[id] = { value, until: now + WasherAccessory.controlWaitMs + 6000 };
    }
    this.#control(id, value).finally(() => {
      mine.busy = false;
      const held = this.switchHold?.[id];
      if (held?.value === value && this.taps[id] === mine) {
        const now = washerControls(this.link.resources ?? {})[id];
        if (kind === 'press' || !now?.current || Boolean(now.current()) === Boolean(value)) {
          delete this.switchHold[id];
        } else {
          // Seen on a real washer: an extra it had switched on showed in its report 15 s later. The
          // switch stays where it was put for the rest of its time, then shows what the washer says.
          setTimeout(() => this.#push(), Math.max(0, held.until - Date.now()) + 50).unref?.();
        }
        this.#push();
      }
    });
  }

  /** What a choice stands at: what was just chosen, else what the washer reports. */
  #chosen(id) {
    const held = this.levelHold?.[id];
    return String(held && held.until > Date.now() ? held.value : washerControls(this.link.resources ?? {})[id]?.shown() ?? '');
  }

  /**
   * One switch of a choice was used. Switching one on chooses it and the others go off at once;
   * switching the chosen one off is not a command, so it comes back on. A flurry of the same
   * write (seen on a real washer) finds the value already chosen and sends nothing more.
   */
  #choose(id, target, on) {
    const control = washerControls(this.link.resources ?? {})[id];
    if (!control || !on || this.#chosen(id) === String(target)) {
      setTimeout(() => this.#push(), 300).unref?.();
      return;
    }
    (this.levelHold ??= {})[id] = { value: target, until: Date.now() + WasherAccessory.controlWaitMs + 6000 };
    setImmediate(() => this.#push());
    this.#control(id, target).finally(() => {
      const held = this.levelHold?.[id];
      if (held?.value === target) {
        if (String(washerControls(this.link.resources ?? {})[id]?.shown()) === String(target)) {
          delete this.levelHold[id];
        } else {
          // Seen on a real washer: a course it had taken showed in its report some seconds after the
          // reading that follows a command. The switch stays where it was put for the rest of its time.
          setTimeout(() => this.#push(), Math.max(0, held.until - Date.now()) + 50).unref?.();
        }
      }
      this.#push();
    });
  }

  /**
   * Control trial: send what the control lists, one candidate at a time, and say in the log what
   * was sent, what the washer answered and what it reports afterwards. HomeKit is answered at once.
   */
  #control(id, value) {
    const label = (id === 'ctlCourse' && washerControls(this.link.resources ?? {})[id]?.kind === 'choice' ? 'Course' : LABELS[id]) ?? 'Kids Lock';
    const say = (text) => this.log.info(`[${this.displayName}] control trial "${label}": ${text}`);
    const words = (w) => `${Object.entries(w.body).map(([k, v]) => `${k.replace('x.com.samsung.da.', '')}=${v}`).join(', ')} to "${w.path.join('/')}"`;
    const kind = washerControls(this.link.resources ?? {})[id]?.kind;
    if (kind === 'press') {
      // A press springs back at once; the command goes on behind it.
      const back = setTimeout(() => {
        this.services.get(id)?.updateCharacteristic(this.api.hap.Characteristic.On, false);
      }, WasherAccessory.pressBackMs);
      back.unref?.();
    }
    // What to send is settled now, at the press: a second quick press then steps on from the value
    // the first one asked for, not from a report the washer has not made yet.
    const asked = (this.asked ??= {});
    const control = washerControls(this.link.resources ?? {})[id];
    let writes = control ? control.writes(value, asked[id]?.value) : [];
    const mine = (asked[id]?.n ?? 0) + 1;
    if (kind === 'press' && writes.length > 0) {
      asked[id] = { n: mine, value: Object.values(writes[0].body)[0] };
    }
    // One command at a time for the whole washer (seen on a real one: commands sent on top of each
    // other closed its session), and the newest wish for a control wins over one still waiting.
    const turn = ((this.turns ??= {})[id] = (this.turns[id] ?? 0) + 1);
    const run = async () => {
      if (kind !== 'press' && this.turns[id] !== turn) {
        return; // a newer choice for this control came in while this one waited
      }
      if (!control || !this.link.online) {
        say('not sent: the washer is not reachable.');
        if (asked[id]?.n === mine) {
          delete asked[id];
        }
        return;
      }
      // The form this washer carried out last time goes first: a form it refuses costs seconds each
      // time. Looked up now, not at the press, so a press that waited its turn uses what was just learnt.
      const proven = kind === 'press' ? null : this.context.controlForms?.[id];
      if (proven && writes.some((w) => w.path.join('/') === proven)) {
        writes = [...writes.filter((w) => w.path.join('/') === proven), ...writes.filter((w) => w.path.join('/') !== proven)];
      }
      const before = (washerControls(this.link.resources ?? {})[id] ?? control).shown();
      let accepted = false;
      // Did the washer do it? A switch, a lock and a choice say so themselves; a press cannot.
      const carriedOut = () => {
        const now = washerControls(this.link.resources ?? {})[id];
        if (!now || kind === 'press') {
          return true;
        }
        return kind === 'choice' ? String(now.shown()) === String(value) : Boolean(now.current()) === Boolean(value);
      };
      const shows = () => (kind === 'press'
        ? String(washerControls(this.link.resources ?? {})[id]?.shown() ?? '') !== String(before) : carriedOut());
      // The washer's own report is the proof, whatever it answered. Seen on a real washer: a routine
      // reading taken before the command arrived in between and was read as "nothing changed". So
      // the wait ends when the report shows the change, or with a reading taken after the command
      // (both engines read 4 s after a write), or when the time is up.
      const report = () => new Promise((resolve) => {
        const sentAt = Date.now();
        const link = this.link;
        const timer = setTimeout(done, WasherAccessory.controlWaitMs);
        timer.unref?.();
        function done() { clearTimeout(timer); link.off('update', seen); resolve(); }
        function seen() {
          if (shows() || Date.now() - sentAt >= WasherAccessory.freshAfterMs) {
            done();
          }
        }
        link.on('update', seen);
      });
      for (const [n, write] of writes.entries()) {
        try {
          await this.link.send([write]);
          accepted = true;
        } catch (err) {
          say(`sent ${words(write)}: not accepted (${err.message}).`);
          continue;
        }
        await report();
        if (carriedOut()) {
          say(`sent ${words(write)}: accepted.`);
          if (kind !== 'press') {
            (this.context.controlForms ??= {})[id] = write.path.join('/');
          }
          break;
        }
        if (n === writes.length - 1) {
          say(`sent ${words(write)}: accepted, but the washer's report did not change.`);
          break;
        }
        // Seen on a real washer: a child lock command answered "accepted" and nothing changed.
        say(`sent ${words(write)}: accepted, but the washer's report did not change. Trying the next form.`);
      }
      if (asked[id]?.n === mine) {
        delete asked[id]; // no newer press: the washer's own report is the base again
      }
      const after = washerControls(this.link.resources ?? {})[id]?.shown() ?? '';
      say(`the washer reported ${control.reads}=${before} before and ${control.reads}=${after} now.`);
      (this.context.controlTrials ??= {})[id] = { at: Date.now(), accepted, before, after };
    };
    const job = (this.controlQueue ?? Promise.resolve()).then(run).catch((err) => { say(`failed: ${err.message}`); })
      .finally(() => { this.#push(); });
    this.controlQueue = job;
    this.controlJob = job;
    return job;
  }

  /** The course when a cycle starts, and each new stage: words and a course number only. */
  #sayStage(was, st) {
    if (!was) {
      return;
    }
    if (st.inCycle && !was.inCycle) {
      const named = (c) => { const name = courseName(this.context.resources ?? {}, c.code); return name ? `${c.code} (${name})` : c.code; };
      const course = st.course ? (st.course.drumClean ? 'drum clean' : `course ${named(st.course)}`) : 'a course';
      this.log.info(`[${this.displayName}] cycle started: ${course}.`);
    }
    // A course chosen while the washer waits: its number, so the names on the panel can be matched to numbers.
    if (!(st.inCycle && !was.inCycle) && st.course && was.course && st.course.code !== was.course.code) {
      const name = courseName(this.context.resources ?? {}, st.course.code) ?? (st.course.drumClean ? 'drum clean' : null);
      this.log.info(`[${this.displayName}] course selected: ${st.course.code}${name ? ` (${name})` : ''}.`);
    }
    if (st.inCycle && st.stage && st.stage !== was.stage) {
      this.log.info(`[${this.displayName}] stage: ${STAGE_WORDS[st.stage] ?? st.stage}.`);
    }
  }

  /**
   * "Unload" reminder: while the washer stays at the end of a cycle (not switched off, no new
   * cycle), the sensor turns on for a while every half hour, counted from the end of the cycle.
   * The clock is kept with the accessory, so a restart of the bridge does not move it.
   */
  #unloadWatch(st, switchedOff) {
    // Switched off after the end: on when the cycle ended, off now. A change, not a reading alone,
    // since some washers report "off" all along.
    const offSince = Boolean(this.context.washerEndedOn && st.poweredOff);
    const waiting = Boolean(this.features.unloadSensor && st.finished && !offSince && !switchedOff);
    if (!waiting) {
      clearTimeout(this.unloadTimer); clearTimeout(this.unloadHold);
      this.unloadTimer = null; this.unloading = false;
      if (!st.finished) {
        delete this.context.washerEndedAt;
        delete this.context.washerEndedOn;
      }
      return;
    }
    if (this.context.washerEndedAt === undefined) {
      this.context.washerEndedAt = Date.now();
      this.context.washerEndedOn = !st.poweredOff;
    }
    if (this.unloadTimer) {
      return;
    }
    const every = WasherAccessory.unloadEveryMs;
    const arm = () => {
      const since = Math.max(0, Date.now() - this.context.washerEndedAt);
      this.unloadTimer = setTimeout(() => {
        this.unloadTimer = null;
        this.unloading = true;
        this.log.info(`[${this.displayName}] the washing is still inside ${Math.round((Date.now() - this.context.washerEndedAt) / 60000)} min after the cycle ended.`);
        this.#push();
        clearTimeout(this.unloadHold);
        this.unloadHold = setTimeout(() => { this.unloading = false; this.#push(); }, Math.min(WasherAccessory.unloadHoldMs, every / 2));
        this.unloadHold.unref?.();
        arm();
      }, every - (since % every));
      this.unloadTimer.unref?.();
    };
    arm();
  }

  #markFinished() {
    this.finished = true;
    // What the cycle used: the washer's own meters now, less what they said when it started.
    const start = this.context.washerCycleStart ?? null;
    const st = this.model?.state ?? {};
    const kWh = start?.kWh != null && st.energyKWh != null ? Math.round((st.energyKWh - start.kWh) * 100) / 100 : null;
    const litres = start?.litres != null && st.waterLitres != null ? st.waterLitres - start.litres : null;
    const used = [kWh !== null && kWh >= 0 ? `${kWh} kWh` : null, litres !== null && litres >= 0 ? `${litres} L of water` : null].filter(Boolean);
    delete this.context.washerCycleStart;
    this.context.washerLastCycle = { at: Date.now(), kWh, litres };
    this.log.info(`[${this.displayName}] cycle finished${used.length ? `; it used ${used.join(' and ')}` : ''}.`);
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
    // While the washer is not reachable its tile stays "No Response" (pushed again when it is back).
    if (!this.link.online) {
      return;
    }
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
    this.services.get('unload')?.updateCharacteristic(Characteristic.OccupancyDetected, this.unloading ? 1 : 0);
    this.services.get('smartControl')?.updateCharacteristic(Characteristic.OccupancyDetected, remoteControlEnabled(this.link.resources ?? {}) ? 1 : 0);
    this.services.get('progress')?.updateCharacteristic(Characteristic.CurrentRelativeHumidity, st.percent ?? 0);
    for (const stage of WASHER_STAGES) {
      this.services.get(stage)?.updateCharacteristic(Characteristic.OccupancyDetected, st.inCycle && st.stage === stage ? 1 : 0);
    }
    this.services.get('drumClean')?.updateCharacteristic(Characteristic.OccupancyDetected, st.drumClean ? 1 : 0);
    const controls = washerControls(this.link.resources ?? {});
    for (const id of WASHER_CONTROLS) {
      const sw = id === 'ctlKidsLock' ? null : this.services.get(id);
      if (controls[id]?.kind === 'choice') {
        const chosen = this.#chosen(id);
        for (const value of controls[id].values) {
          this.services.get(`${id}:${value}`)?.updateCharacteristic(Characteristic.On, value === chosen);
        }
        continue;
      }
      if (sw) {
        // A switch shows what the washer reports; a "next" or "stop" press springs back.
        const held = this.switchHold?.[id];
        const on = held && held.until > Date.now() ? held.value : Boolean(controls[id]?.current?.());
        sw.updateCharacteristic(Characteristic.On, controls[id]?.kind === 'switch' ? on : false);
      }
    }
    const lock = this.services.get('kidsLock');
    if (lock) {
      const value = st.kidsLock ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
      const held = this.switchHold?.ctlKidsLock;
      lock.updateCharacteristic(Characteristic.LockCurrentState, value);
      // While a lock command is under way the tile keeps saying "locking" or "unlocking".
      lock.updateCharacteristic(Characteristic.LockTargetState, held && held.until > Date.now()
        ? (held.value ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED) : value);
    }
    const alarms = st.alarms ?? [];
    if (alarms.length && !this.alarmed) {
      this.log.warn(`[${this.displayName}] the appliance reports: ${alarms.map(alarmText).join(', ')}`);
    }
    this.alarmed = alarms.length > 0;
    this.services.get('alert')?.updateCharacteristic(Characteristic.OccupancyDetected, this.alarmed ? 1 : 0);
  }
}
