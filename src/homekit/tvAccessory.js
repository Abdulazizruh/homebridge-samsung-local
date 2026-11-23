import { TizenRemote, portOpen, tvInfo, wake } from '../tv/tizenClient.js';
import { AppleRemote } from '../appleRemote/bridge.js';

const POLL_MS = 4000;
const SCREEN_PORT = 9197;
// The remote channel stays open this long after the last key, so the next
// press goes out at once instead of waiting for a new secure connection.
const REMOTE_IDLE_MS = 5 * 60_000;
const POINTER_STEP_MS = 40; // pointer steps are sent at most this often
const POINTER_SHOWN_MS = 4000; // a tap is a click only while the pointer was moved this recently
const POWER_HOLD_MS = 35_000; // a TV needs this long to wake up or shut down
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

/**
 * A Samsung TV in HomeKit, in one of two shapes chosen in the settings:
 *  - 'tile'     a real TV tile with the Control Centre remote (Apple requires
 *               it to be added to the Home app on its own)
 *  - 'switches' plain switches inside the bridge: power, mute, volume up/down
 */
export class TvAccessory {
  constructor({ api, log, accessory, entry, mode, token, saveToken, ports = {}, pollMs = POLL_MS, reportsPower = false, onReportsPower = null,
    screenPortSeen = false, onScreenPortSeen = null }) {
    this.api = api;
    this.hap = api.hap;
    this.log = log;
    this.accessory = accessory;
    this.entry = entry;
    this.mode = mode;
    this.displayName = accessory.displayName;
    this.context = accessory.context;
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
      onFieldLength: (length) => { this.fieldLength = length; },
    });
    this.keyboardOpen = false;
    this.phone = null; // the iPhone-remote stand-in, when the option is on
    if (mode === 'tile') {
      this.#buildTile();
    } else {
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
    this.fieldLength = null;
    const shown = open && this.phone ? this.phone.setKeyboard(true) : 0;
    if (!open) {
      this.phone?.setKeyboard(false);
    }
    // Three separate facts, so a trial shows where the path stops: the TV's event, the iPhone keyboard, the text.
    this.log.info(`[${this.displayName}] the TV ${open ? 'opened' : 'closed'} its on-screen keyboard.`
      + (open && this.phone ? ` iPhone keyboard asked to open on ${shown} remote${shown === 1 ? '' : 's'}.` : '')
      + (!open && this.phone ? ` Typed text was sent to the TV ${sent} time${sent === 1 ? '' : 's'}.${lengths}` : ''));
  }

  /**
   * Trial: show this TV to the iPhone's own remote as an Apple TV, so the
   * iPhone keyboard can type into the TV's text fields.
   */
  async enableAppleRemote({ file, name = `${this.displayName} +`, advertise = true, touch = 'arrows', pin }) {
    this.appleRemote = new AppleRemote({ file, tvId: this.entry.id, name, log: this.log, advertise, pin });
    const phone = await this.appleRemote.start();
    this.phone = phone;
    phone.touch = touch === 'pointer' ? 'pointer' : 'arrows';
    phone.on('move', (dx, dy) => this.#move(dx, dy));
    phone.on('click', () => this.#click());
    phone.awake = this.on;
    phone.on('key', (code) => this.#press(code, 'iPhone remote key').catch(() => {}));
    phone.on('power', (want) => this.#setPower(want === 'toggle' ? !this.on : want).catch(() => {}));
    phone.on('text', (text) => this.#type(text));
    phone.on('sessions', (count) => {
      // The TV tells only a listener that its keyboard opened, so the channel is kept while a remote is open.
      this.remote.hold(count > 0);
      if (count > 0 && this.on) {
        this.remote.open().catch(() => {});
      }
    });
    return phone;
  }

  /** Finger movements arrive many times a second; they are added up and sent as one step at a time. */
  #move(dx, dy) {
    this.step = { dx: (this.step?.dx ?? 0) + dx, dy: (this.step?.dy ?? 0) + dy };
    this.pointerAt = Date.now();
    if (this.stepTimer || !this.on) {
      return;
    }
    this.stepTimer = setTimeout(() => {
      this.stepTimer = null;
      const { dx: x, dy: y } = this.step;
      this.step = null;
      if (Math.round(x) || Math.round(y)) {
        this.remote.move(x, y).catch(() => {});
      }
    }, POINTER_STEP_MS);
    this.stepTimer.unref?.();
  }

  /** A tap clicks where the pointer is. With no pointer on screen (it was not moved lately), it is the OK key. */
  #click() {
    if (Date.now() - (this.pointerAt ?? 0) < POINTER_SHOWN_MS) {
      this.remote.click().catch(() => {});
    } else {
      this.#press('KEY_ENTER', 'iPhone remote key').catch(() => {});
    }
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

  async poll() {
    const info = await tvInfo(this.entry.host, { httpPort: this.ports.httpPort });
    if (info?.mac && !this.context.mac) {
      this.context.mac = info.mac;
    }
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

  async #setPower(want) {
    // The power key is a toggle, so the TV is asked first: acting on an old
    // picture of it would switch it the wrong way.
    this.holdUntil = 0;
    await this.poll();
    if (want === this.on) {
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
    if (!this.on && !this.reachable) {
      return;
    }
    try {
      await this.#key(code);
    } catch (err) {
      this.log.warn(`[${this.displayName}] ${label} failed: ${err.message}`);
      const { HapStatusError, HAPStatus } = this.hap;
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
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
      return input ? this.#press(input.key, `input ${input.name}`) : undefined;
    });
    const keys = remoteKeys(Characteristic);
    tv.getCharacteristic(Characteristic.RemoteKey).onSet((k) => (keys.has(k) ? this.#press(keys.get(k), 'remote key') : undefined));
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
      v === Characteristic.VolumeSelector.INCREMENT ? 'KEY_VOLUP' : 'KEY_VOLDOWN', 'volume'));
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
    const service = this.accessory.getServiceById(Service.Switch, key) ?? this.accessory.addService(Service.Switch, name, key);
    this.#applyName(key, service, name);
    this.services.set(key, service);
    return service.getCharacteristic(this.hap.Characteristic.On);
  }

  #buildSwitches() {
    this.#info();
    this.#switch('power', '').onGet(() => this.on).onSet((v) => this.#setPower(Boolean(v)));
    this.#switch('mute', 'Mute').onGet(() => this.muted).onSet(async (v) => {
      if (Boolean(v) !== this.muted && this.on) {
        await this.#press('KEY_MUTE', 'mute');
        this.muted = Boolean(v);
      } else if (!this.on) {
        setTimeout(() => this.#push(), 300).unref?.();
      }
    });
    // Momentary: each press is one volume step.
    for (const [key, suffix, code] of [['volumeUp', 'Volume Up', 'KEY_VOLUP'], ['volumeDown', 'Volume Down', 'KEY_VOLDOWN']]) {
      this.#switch(key, suffix).onGet(() => false).onSet(async (v) => {
        if (v) {
          setTimeout(() => this.services.get(key).updateCharacteristic(this.hap.Characteristic.On, false), 400).unref?.();
          await this.#press(code, 'volume');
        }
      });
    }
  }

  #info() {
    const { Service, Characteristic } = this.hap;
    this.accessory.getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.Manufacturer, 'Samsung')
      .setCharacteristic(Characteristic.Model, String(this.context.model ?? 'TV').slice(0, 64));
  }

  #push() {
    const { Characteristic } = this.hap;
    if (this.mode === 'tile') {
      this.services.get('tv').updateCharacteristic(Characteristic.Active, this.on ? 1 : 0);
      this.services.get('speaker').updateCharacteristic(Characteristic.Mute, this.muted);
    } else {
      this.services.get('power').updateCharacteristic(Characteristic.On, this.on);
      this.services.get('mute').updateCharacteristic(Characteristic.On, this.muted);
    }
  }
}
