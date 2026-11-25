import { TizenRemote, portOpen, tvInfo, wake } from '../tv/tizenClient.js';
import { AppleRemote } from '../appleRemote/bridge.js';

const POLL_MS = 4000;
// A TV shown as off is asked once before a press is dropped; while it keeps not answering, it is
// not asked again for every press of a run (a finger on the touch area makes many).
const OFF_RECHECK_MS = 3000;
const NOT_SENT_LOG_MS = 60_000; // at most one "not sent" line a minute
const SCREEN_PORT = 9197;
// The remote channel stays open this long after the last key, so the next
// press goes out at once instead of waiting for a new secure connection.
const REMOTE_IDLE_MS = 5 * 60_000;
const FIELD_TEXT_MS = 250; // how long the TV gets to say what an opened field already holds
const POWER_HOLD_MS = 35_000; // a TV needs this long to wake up or shut down
const SAME_POWER_MS = 1000; // the same power wish asked within this of the last one done is the second tile of a pair
const INPUTS = [
  { id: 1, name: 'TV', key: 'KEY_TV' },
  { id: 2, name: 'HDMI', key: 'KEY_HDMI' },
  { id: 3, name: 'Sources', key: 'KEY_SOURCE' },
  { id: 4, name: 'Home', key: 'KEY_HOME' },
];

function remoteKeys(Characteristic) {
  const R = Characteristic.RemoteKey;
  return new Map([
    [R.REWIND, 'KEY_REWIND'], [R.FAST_FORWARD, 'KEY_FF'], [R.NEXT_TRACK, 'KEY_CHUP'], [R.PREVIOUS_TRACK, 'KEY_CHDOWN'],
    [R.ARROW_UP, 'KEY_UP'], [R.ARROW_DOWN, 'KEY_DOWN'], [R.ARROW_LEFT, 'KEY_LEFT'], [R.ARROW_RIGHT, 'KEY_RIGHT'],
    [R.SELECT, 'KEY_ENTER'], [R.BACK, 'KEY_RETURN'], [R.EXIT, 'KEY_EXIT'], [R.PLAY_PAUSE, 'KEY_PLAY'], [R.INFORMATION, 'KEY_HOME'],
  ]);
}

/** The switches a TV can show in Apple Home, for automations. `key` is kept in the settings; `code` is what a momentary one sends. */
export const TV_SWITCHES = [
  { key: 'power', suffix: '' },
  { key: 'mute', suffix: 'Mute' },
  { key: 'volumeUp', suffix: 'Volume Up', code: 'KEY_VOLUP', label: 'volume' },
  { key: 'volumeDown', suffix: 'Volume Down', code: 'KEY_VOLDOWN', label: 'volume' },
  { key: 'channelUp', suffix: 'Channel Up', code: 'KEY_CHUP', label: 'channel' },
  { key: 'channelDown', suffix: 'Channel Down', code: 'KEY_CHDOWN', label: 'channel' },
  { key: 'playPause', suffix: 'Play Pause', code: 'KEY_PLAY_BACK', label: 'play/pause' },
  { key: 'home', suffix: 'Home', code: 'KEY_HOME', label: 'home' },
];
const OLD_SWITCHES = ['power', 'mute', 'volumeUp', 'volumeDown']; // what "switches" meant before they could be chosen

/** The switches one TV entry asks for. An entry from before the choice existed keeps what it had. */
export function switchesOf(entry) {
  if (Array.isArray(entry?.tvSwitches)) {
    return TV_SWITCHES.map((d) => d.key).filter((key) => entry.tvSwitches.includes(key));
  }
  return entry?.tvMode === 'switches' ? [...OLD_SWITCHES] : [];
}

/**
 * A Samsung TV in HomeKit, in one of two shapes chosen in the settings:
 *  - 'tile'     a real TV tile with the Control Centre remote (Apple requires
 *               it to be added to the Home app on its own)
 *  - 'switches' plain switches inside the bridge: power, mute, volume up/down
 */
export class TvAccessory {
  /**
   * `accessory` is the TV tile (or null), `switchAccessory` the accessory that carries the
   * chosen switches (or null). A TV can have either, both, or neither: with the iPhone
   * remote alone it has nothing in Apple Home.
   */
  constructor({ api, log, accessory = null, switchAccessory = null, switches = [], name = null, entry, token, saveToken, ports = {}, pollMs = POLL_MS,
    reportsPower = false, onReportsPower = null, screenPortSeen = false, onScreenPortSeen = null }) {
    this.api = api;
    this.hap = api.hap;
    this.log = log;
    this.accessory = accessory;
    this.switchAccessory = switchAccessory;
    this.switches = switches;
    this.entry = entry;
    this.mode = accessory ? 'tile' : 'switches';
    this.displayName = name ?? (accessory ?? switchAccessory)?.displayName ?? 'Samsung TV';
    this.context = (switchAccessory ?? accessory)?.context ?? { model: entry?.model ?? null };
    this.ports = ports;
    this.on = false;
    this.muted = false;
    this.reachable = null;
    this.holdUntil = 0;
    // Learned from the TV and kept across restarts: it names its power state.
    this.reportsPower = Boolean(reportsPower);
    this.screenPortSeen = Boolean(screenPortSeen);
    this.onScreenPortSeen = onScreenPortSeen;
    this.onReportsPower = onReportsPower;
    this.services = new Map();
    this.remote = new TizenRemote({
      host: entry.host, token, wsPort: ports.wsPort, secure: ports.secure ?? true, onToken: saveToken, idleMs: REMOTE_IDLE_MS,
      onKeyboard: (open) => this.#keyboard(open),
      onFieldText: (text) => this.#fieldText(text),
    });
    this.keyboardOpen = false;
    this.phone = null; // the iPhone-remote stand-in, when the option is on
    if (accessory) {
      this.#buildTile();
    }
    if (switchAccessory) {
      this.#buildSwitches();
    }
    this.timer = setInterval(() => this.poll(), pollMs);
    this.timer.unref?.();
    this.poll();
  }

  stop() {
    clearInterval(this.timer);
    this.remote.close();
    this.appleRemote?.stop().catch(() => {});
  }

  /** What the TV says its field holds. Only what it says as the keyboard opens counts: that is the text already there. */
  #fieldText(text) {
    this.fieldLength = Array.from(text).length;
    this.reported = { text, at: Date.now() };
    if (this.opening) { // the keyboard was waiting for exactly this
      clearTimeout(this.opening.timer);
      this.opening.go();
    } else if (this.keyboardOpen && this.phone && !(this.typedCount > 0)) {
      // It came after the wait: still the text already there, as long as nothing was typed.
      const taken = this.phone.setFieldText(text);
      this.log.debug?.(`[${this.displayName}] the TV said ${Date.now() - (this.openedAt ?? Date.now())} ms after opening its keyboard that the field holds ${this.fieldLength} character${this.fieldLength === 1 ? '' : 's'}${taken ? '; the iPhone keyboard now starts from them.' : '.'}`);
    }
  }

  #keyboard(open) {
    if (open === this.keyboardOpen) {
      return;
    }
    this.keyboardOpen = open;
    this.typing = null; // typing meant for the field that just closed never reaches the next one
    const sent = this.typedCount ?? 0;
    const lengths = sent && Number.isInteger(this.fieldLength) ? ` The last text sent had ${this.typedLength} character${this.typedLength === 1 ? '' : 's'}; the TV last reported ${this.fieldLength}.` : '';
    this.typedCount = 0;
    this.typedLength = 0;
    if (this.opening) { clearTimeout(this.opening.timer); this.opening = null; }
    if (!open) {
      this.fieldLength = null;
      this.reported = null;
      this.phone?.setKeyboard(false);
      this.log.info(`[${this.displayName}] the TV closed its on-screen keyboard.`
        + (this.phone ? ` Typed text was sent to the TV ${sent} time${sent === 1 ? '' : 's'}.${lengths}` : ''));
      return;
    }
    // A field opened again still holds its text, and the TV says so right as the keyboard opens.
    // The iPhone keyboard is opened with that text, so a backspace there removes a real letter.
    this.openedAt = Date.now();
    const go = () => {
      this.opening = null;
      if (!this.keyboardOpen) { return; }
      const fresh = this.reported && Date.now() - this.reported.at <= FIELD_TEXT_MS ? this.reported.text : '';
      const shown = this.phone ? this.phone.setKeyboard(true, fresh) : 0;
      const held = Array.from(fresh).length;
      // Separate facts, so a trial shows where the path stops: the TV's event, the iPhone keyboard, the text.
      this.log.info(`[${this.displayName}] the TV opened its on-screen keyboard`
        + (held ? `, on a field that already holds ${held} character${held === 1 ? '' : 's'}.` : '.')
        + (this.phone ? ` iPhone keyboard asked to open on ${shown} remote${shown === 1 ? '' : 's'}.` : ''));
    };
    const timer = setTimeout(go, FIELD_TEXT_MS);
    timer.unref?.();
    this.opening = { timer, go };
    if (this.reported && Date.now() - this.reported.at <= FIELD_TEXT_MS) { clearTimeout(timer); go(); } // the TV said it first
  }

  /**
   * Trial: show this TV to the iPhone's own remote as an Apple TV, so the
   * iPhone keyboard can type into the TV's text fields.
   */
  async enableAppleRemote({ file, name = `${this.displayName} +`, advertise = true, pin, touch }) {
    this.appleRemote = new AppleRemote({ file, tvId: this.entry.id, name, log: this.log, advertise, pin, touch });
    const phone = await this.appleRemote.start();
    this.phone = phone;
    phone.awake = this.on;
    // Each press and move is reported back to the remote it came from, which says on closing
    // how many reached the TV, how many were not sent because the TV was off, and how many failed.
    phone.on('key', (code, from) => this.#press(code, 'iPhone remote key')
      .then((r) => from?.note('button', r), () => from?.note('button', 'failed')));
    phone.on('power', (want, from) => this.#setPower(want === 'toggle' ? !this.on : want)
      .then(() => from?.note('button', 'sent'), () => from?.note('button', 'failed')));
    phone.on('text', (text) => this.#type(text));
    phone.on('pointer', (dx, dy, from) => this.#gesture(() => this.remote.pointer(dx, dy), 'move', from));
    phone.on('click', (from) => this.#gesture(() => this.remote.click(), 'button', from, 'iPhone remote click'));
    phone.on('sessions', (count) => {
      // The TV tells only a listener that its keyboard opened, so the channel is kept while a remote is open.
      this.remote.hold(count > 0);
      if (count > 0 && this.on) {
        this.remote.open().catch(() => {});
      }
    });
    return phone;
  }

  /** The newest text wins: what is on the iPhone is what the field should hold. */
  async #type(text) {
    this.typing = text;
    if (this.typingNow) {
      return;
    }
    this.typingNow = true;
    try {
      while (this.typing !== null && this.typing !== undefined) {
        const next = this.typing;
        this.typing = null;
        if (!this.keyboardOpen) {
          break; // the field closed while this was waiting
        }
        await this.remote.text(next);
        this.typedCount = (this.typedCount ?? 0) + 1;
        this.typedLength = Array.from(next).length;
      }
    } catch (err) {
      this.log.warn(`[${this.displayName}] typing from the iPhone did not reach the TV: ${err.message}`);
    } finally {
      this.typingNow = false;
    }
  }

  async poll({ sure = false } = {}) {
    const info = await tvInfo(this.entry.host, { httpPort: this.ports.httpPort });
    if (info?.mac && !this.context.mac) {
      this.context.mac = info.mac;
    }
    // One missed answer from a TV that was on a moment ago changes nothing: it is asked again at the
    // next round. A TV that says it went to standby is believed at once.
    // Before a power command the answer must be fresh: the power key is a toggle, and a TV kept
    // "on" from an older answer would be switched on by the key meant to switch it off.
    if (!info && this.on && !this.missedOnce && !sure) {
      this.missedOnce = true;
      this.log.debug(`[${this.displayName}] one question went unanswered; asked again before the TV is shown as off.`);
      return;
    }
    this.missedOnce = false;
    const reachable = Boolean(info);
    if (reachable !== this.reachable && this.reachable !== null) {
      this.log.debug(`[${this.displayName}] ${reachable ? 'answers' : 'stopped answering'} on the network.`);
    }
    this.reachable = reachable;
    // What the TV itself says is written to the log whenever it changes, so
    // a tile that disagrees with the screen can be explained.
    if (info?.powerState && !this.reportsPower) {
      this.reportsPower = true;
      this.onReportsPower?.();
    }
    // A TV that names its power state when on or in standby, and then stops
    // naming it while still answering, has gone into a deeper sleep: it is
    // off. Only a model that never names it is taken as on while it answers.
    // A model that never names its power state still answers for a while
    // after its screen goes dark, and wakes by itself at night. Such TVs run a
    // second service (media playback, port 9197) only while the screen is
    // on. Once that service has been seen on this TV, its absence means off;
    // a TV that never showed it is judged as before.
    let dark = false;
    if (reachable && !info.powerState && !this.reportsPower) {
      const open = await portOpen(this.entry.host, this.ports.screenPort ?? SCREEN_PORT, 1500);
      if (open) {
        this.screenClosed = 0;
        if (!this.screenPortSeen) {
          this.screenPortSeen = true;
          this.onScreenPortSeen?.();
          this.log.info(`[${this.displayName}] this TV does not name its power state; its screen service will tell on from off.`);
        }
      } else {
        this.screenClosed = (this.screenClosed ?? 0) + 1;
      }
      dark = this.screenPortSeen && this.screenClosed >= 2; // twice in a row, so one missed answer changes nothing
    }
    const on = Boolean(info?.power) && (Boolean(info?.powerState) || !this.reportsPower) && !dark;
    const said = !reachable ? 'does not answer' : info.powerState ? `says "${info.powerState}"`
      : dark ? 'answers, but its screen service is closed' : 'answers without a power state';
    if (said !== this.said) {
      this.log.info(`[${this.displayName}] the TV ${said}; shown as ${on ? 'on' : 'off'}.`);
      this.said = said;
    }
    if (Date.now() < this.holdUntil) {
      // Just switched from Apple Home: the TV needs a while to follow. A
      // report that agrees ends the wait; one that disagrees is not believed yet.
      if (on !== this.on) {
        return;
      }
      this.holdUntil = 0;
    }
    if (this.phone) {
      this.phone.awake = on;
      if (on && this.phone.sessions > 0) {
        this.remote.open().catch(() => {}); // keep listening for the keyboard while a remote is open
      }
    }
    if (on !== this.on) {
      this.on = on;
      if (!on) {
        this.muted = false;
        // An open channel must not keep a TV that was switched off awake.
        this.remote.close();
      }
      this.#push();
    }
  }

  /**
   * Power commands run one after another. Apple Home often sends the same one through two tiles at
   * once (the TV tile and its power switch); run side by side, both found the TV off and both
   * pressed the power key, which is a toggle: on, then straight off again.
   */
  #setPower(want) {
    const asked = Date.now();
    const run = () => this.#applyPower(want, asked);
    this.powerChain = (this.powerChain ?? Promise.resolve()).then(run, run);
    return this.powerChain;
  }

  async #applyPower(want, asked) {
    // The second tile of a pair: the same wish, asked while the last one ran or just after it was
    // done. Asking the TV here would not help: one switching on still answers "standby" for
    // seconds. Only a wish that was carried out counts: after a failure the next one is sent, and
    // a later wish (the TV switched by its own remote meanwhile) asks the TV again.
    const last = this.lastPower;
    if (last?.want === want && asked - last.done < SAME_POWER_MS) {
      return;
    }
    this.lastPower = null;
    // The power key is a toggle, so the TV is asked first: acting on an old
    // picture of it would switch it the wrong way.
    this.holdUntil = 0;
    await this.poll({ sure: true });
    if (want === this.on) {
      this.lastPower = { want, done: Date.now() };
      return;
    }
    const mac = this.entry.mac ?? this.context.mac;
    try {
      if (want && !this.reachable) {
        await wake(mac);
      } else {
        // Reachable: on, or in a standby that still listens.
        await this.#key('KEY_POWER');
      }
    } catch (err) {
      this.log.warn(`[${this.displayName}] power ${want ? 'on' : 'off'} failed: ${err.message}`);
      const { HapStatusError, HAPStatus } = this.hap;
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    this.on = want;
    this.holdUntil = Date.now() + POWER_HOLD_MS;
    this.lastPower = { want, done: Date.now() };
    this.#push();
  }

  async #key(code) {
    try {
      await this.remote.key(code);
    } catch (err) {
      if (err.code === 'tv_denied') {
        this.log.warn(`[${this.displayName}] the TV no longer accepts this plugin. Open the plugin settings and pair the TV again.`);
      }
      throw err;
    }
  }

  async #press(code, label) {
    if (!(await this.#canTake())) {
      this.#notSent(label);
      return 'off';
    }
    try {
      await this.#key(code);
    } catch (err) {
      this.log.warn(`[${this.displayName}] ${label} failed: ${err.message}`);
      const { HapStatusError, HAPStatus } = this.hap;
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return 'sent';
  }

  /** A pointer move or click from the iPhone remote, with the same check as a key. */
  async #gesture(send, kind, from, label) {
    if (!(await this.#canTake())) {
      if (label) { this.#notSent(label); }
      from?.note(kind, 'off');
      return;
    }
    await send().then(() => from?.note(kind, 'sent'), () => from?.note(kind, 'failed'));
  }

  /**
   * Whether the TV can take a press now. One shown as off may just have been switched on, or have
   * missed one question: it is asked at once rather than the press dropped until the next round.
   */
  async #canTake() {
    if (this.on || this.reachable) {
      return true;
    }
    if (!this.checking && Date.now() - (this.offCheckedAt ?? 0) < OFF_RECHECK_MS) {
      return false;
    }
    this.checking ??= this.poll({ sure: true }).catch(() => {}).finally(() => {
      this.checking = null;
      this.offCheckedAt = Date.now();
    });
    await this.checking;
    return Boolean(this.on || this.reachable);
  }

  #notSent(label) {
    if (Date.now() - (this.notSentAt ?? 0) < NOT_SENT_LOG_MS) {
      return;
    }
    this.notSentAt = Date.now();
    this.log.info(`[${this.displayName}] ${label} not sent: the TV is shown as off and did not answer when asked.`);
  }

  // ------------------------------------------------------------- TV tile

  #buildTile() {
    const { Service, Characteristic } = this.hap;
    this.#info();
    const tv = this.accessory.getService(Service.Television) ?? this.accessory.addService(Service.Television, this.displayName, 'tv');
    tv.setCharacteristic(Characteristic.ConfiguredName, this.displayName)
      .setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
      .setCharacteristic(Characteristic.ActiveIdentifier, 1);
    tv.getCharacteristic(Characteristic.Active).onGet(() => (this.on ? 1 : 0)).onSet((v) => this.#setPower(v === 1));
    tv.getCharacteristic(Characteristic.ActiveIdentifier).onSet((id) => {
      const input = INPUTS.find((i) => i.id === id);
      return input ? this.#press(input.key, `input ${input.name}`).then(() => undefined) : undefined;
    });
    const keys = remoteKeys(Characteristic);
    tv.getCharacteristic(Characteristic.RemoteKey).onSet((k) => (keys.has(k) ? this.#press(keys.get(k), 'remote key').then(() => undefined) : undefined));
    this.services.set('tv', tv);

    const speaker = this.accessory.getService(Service.TelevisionSpeaker)
      ?? this.accessory.addService(Service.TelevisionSpeaker, `${this.displayName} Speaker`, 'speaker');
    speaker.setCharacteristic(Characteristic.Active, 1)
      .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
    speaker.getCharacteristic(Characteristic.Mute).onGet(() => this.muted).onSet(async (v) => {
      if (Boolean(v) !== this.muted) {
        await this.#press('KEY_MUTE', 'mute');
        this.muted = Boolean(v);
      }
    });
    speaker.getCharacteristic(Characteristic.VolumeSelector).onSet((v) => this.#press(
      v === Characteristic.VolumeSelector.INCREMENT ? 'KEY_VOLUP' : 'KEY_VOLDOWN', 'volume').then(() => undefined));
    tv.addLinkedService(speaker);
    this.services.set('speaker', speaker);

    for (const input of INPUTS) {
      const src = this.accessory.getServiceById(Service.InputSource, `input-${input.id}`)
        ?? this.accessory.addService(Service.InputSource, input.name, `input-${input.id}`);
      src.setCharacteristic(Characteristic.Identifier, input.id)
        .setCharacteristic(Characteristic.ConfiguredName, input.name)
        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(Characteristic.InputSourceType, input.id === 2 ? Characteristic.InputSourceType.HDMI : Characteristic.InputSourceType.OTHER)
        .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);
      tv.addLinkedService(src);
    }
  }

  // ------------------------------------------------------------ switches

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

  #switch(key, suffix) {
    const { Service } = this.hap;
    const name = suffix ? `${this.displayName} ${suffix}` : this.displayName;
    const service = this.switchAccessory.getServiceById(Service.Switch, key) ?? this.switchAccessory.addService(Service.Switch, name, key);
    this.#applyName(key, service, name);
    this.services.set(key, service);
    return service.getCharacteristic(this.hap.Characteristic.On);
  }

  #buildSwitches() {
    this.#info(this.switchAccessory);
    const { Service, Characteristic } = this.hap;
    // A switch that was chosen before and is no longer leaves Apple Home.
    for (const service of [...this.switchAccessory.services]) {
      if (service.UUID === Service.Switch.UUID && !this.switches.includes(service.subtype)) {
        this.switchAccessory.removeService(service);
      }
    }
    for (const { key, suffix, code, label } of TV_SWITCHES.filter((d) => this.switches.includes(d.key))) {
      if (key === 'power') {
        this.#switch(key, suffix).onGet(() => this.on).onSet((v) => this.#setPower(Boolean(v)));
      } else if (key === 'mute') {
        this.#switch(key, suffix).onGet(() => this.muted).onSet(async (v) => {
          if (Boolean(v) !== this.muted && this.on) {
            await this.#press('KEY_MUTE', 'mute');
            this.muted = Boolean(v);
            this.#push();
          } else if (!this.on) {
            setTimeout(() => this.#push(), 300).unref?.();
          }
        });
      } else {
        // Momentary: each press is one step, then the switch is off again, so an automation can press it again.
        this.#switch(key, suffix).onGet(() => false).onSet(async (v) => {
          if (v) {
            setTimeout(() => this.services.get(key).updateCharacteristic(Characteristic.On, false), 400).unref?.();
            await this.#press(code, label);
          }
        });
      }
    }
  }

  #info(accessory = this.accessory) {
    const { Service, Characteristic } = this.hap;
    accessory?.getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, String(this.context.model ?? 'TV').slice(0, 64));
  }

  #push() {
    const { Characteristic } = this.hap;
    // Whatever this TV shows in Apple Home says the same thing.
    this.services.get('tv')?.updateCharacteristic(Characteristic.Active, this.on ? 1 : 0);
    this.services.get('speaker')?.updateCharacteristic(Characteristic.Mute, this.muted);
    this.services.get('power')?.updateCharacteristic(Characteristic.On, this.on);
    this.services.get('mute')?.updateCharacteristic(Characteristic.On, this.muted);
  }
}
