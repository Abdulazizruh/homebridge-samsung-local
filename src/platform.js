import { pruneSetup, trackSetup } from './homekit/tvSetup.js';
import { DropLog } from './dropLog.js';
import { AcAccessory, accessoryName } from './homekit/acAccessory.js';
import { WasherAccessory } from './homekit/washerAccessory.js';
import { ApplianceAccessory } from './homekit/applianceAccessory.js';
import { TvAccessory, switchesOf } from './homekit/tvAccessory.js';
import { pruneAppleRemote } from './appleRemote/bridge.js';
import { keepPort } from './homekit/tvPort.js';
import { describeDevice, familyOf, stableDeviceId } from './capabilities/index.js';
import { DeviceLink } from './deviceLink.js';
import { rememberNames } from './names.js';
import { shortId } from './redact.js';
import { HelperClient } from './runtime/helperClient.js';
import { helperSpawn } from './runtime/engine.js';
import { PLATFORM_NAME, PLUGIN_NAME, UUID_NAMESPACE } from './settings.js';
import fs from 'node:fs';
import { HEARTBEAT_MS, ensureDir, pluginPaths, readJson, snapshotFile, writeJson } from './storage.js';

const RETRY_STEPS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
const START_GAP_MS = 1000;
const START_SETTLE_MS = 5000;
const HELPER_RETRY_MS = [30_000, 60_000, 120_000, 300_000, 600_000];
const SNAPSHOT_CHANGED_MS = 3_000; // changed readings reach the disk this soon
const SNAPSHOT_SAME_MS = 60_000; // unchanged readings only refresh the file's time

/**
 * Homebridge dynamic platform. Glue only: it reads the config, keeps the
 * helper running, and pairs each configured appliance with an accessory.
 */
export class SamsungLocalPlatform {
  /**
   * @param {import('homebridge').Logging} log
   * @param {import('homebridge').PlatformConfig} config
   * @param {import('homebridge').API} api
   * @param {{createHelper?: Function}} [overrides] test seam
   */
  constructor(log, config, api, overrides = {}) {
    this.log = log;
    this.config = config ?? {};
    this.api = api;
    this.overrides = overrides;
    this.cached = new Map(); // uuid -> PlatformAccessory restored by Homebridge
    this.devices = new Map(); // deviceId -> {link, handler, accessory, entry}
    this.retryTimers = new Set();
    this.paths = pluginPaths(api.user.storagePath());
    this.drops = new DropLog({
      load: () => readJson(this.paths.stability),
      save: (state) => { try { writeJson(this.paths.stability, state); } catch { /* figures are best effort */ } },
    });
    this.stabilityNames = new Set();
    const stability = setInterval(() => {
      if (this.drops.due()) {
        this.drops.keepOnly([...this.stabilityNames]);
        for (const line of this.drops.report()) {
          this.log.info(line);
        }
      }
    }, 10 * 60 * 1000);
    stability.unref?.();
    this.retryTimers.add(stability);
    this.helper = null;
    this.stopping = false;

    api.on('didFinishLaunching', () => {
      this.start().catch((err) => this.log.error(`Startup failed: ${err.message}`));
    });
    api.on('shutdown', () => {
      this.stop();
    });
  }

  /** Homebridge hands back accessories from its cache before launch. */
  configureAccessory(accessory) {
    this.cached.set(accessory.UUID, accessory);
  }

  /**
   * Configured appliances, each with the address it was last found at.
   * The settings hold the address the user typed; if the appliance has moved
   * since (same device id), the remembered address is used instead. Typing a
   * new address in the settings always wins over a remembered one.
   */
  entries() {
    const list = Array.isArray(this.config.devices) ? this.config.devices : [];
    this.addresses ??= readJson(this.paths.addresses, {}) ?? {};
    return list.filter((d) => d && typeof d.host === 'string' && d.host.trim() && d.enabled !== false)
      .map((d) => {
        const configHost = d.host.trim();
        const known = d.id ? this.addresses[d.id] : null;
        const follow = known && known.configHost === configHost;
        const host = follow && known.host ? known.host : configHost;
        return {
          ...d, host, configHost, mac: d.mac ?? known?.mac ?? null,
          port: d.port ?? (known && known.host === host ? known.port ?? null : null),
        };
      });
  }

  #rememberAddress(deviceId, entry, { host, mac, port = null }) {
    this.addresses ??= {};
    const previous = this.addresses[deviceId];
    const next = {
      configHost: entry.configHost ?? entry.host, host: host ?? entry.host, mac: mac ?? previous?.mac ?? null,
      // Remembered so the next start goes straight to it instead of searching.
      port: port ?? (previous && previous.host === (host ?? entry.host) ? previous.port ?? null : null),
    };
    if (previous && previous.configHost === next.configHost && previous.host === next.host && previous.mac === next.mac
      && (previous.port ?? null) === next.port) {
      return;
    }
    this.addresses[deviceId] = next;
    try {
      writeJson(this.paths.addresses, this.addresses);
    } catch (err) {
      this.log.debug(`could not save addresses: ${err.message}`);
    }
  }

  /** Said once at start: a polling interval saved below the minimum is raised, not refused. */
  #notePollFloor() {
    const asked = Number(this.config.pollInterval);
    if (Number.isFinite(asked) && asked > 0 && asked < MIN_POLL_S) {
      this.log.info(`Polling interval ${asked}s is below the minimum; ${MIN_POLL_S}s is used. It is stored as ${MIN_POLL_S} the next time the plugin settings are saved.`);
    }
  }

  async start() {
    this.#notePollFloor();
    ensureDir(this.paths.root);
    // A heartbeat, so the settings page can tell this bridge is running before it deletes the plugin's data.
    const beat = () => { if (!this.stopping) { try { writeJson(this.paths.running, { at: Date.now(), pid: process.pid }); } catch { /* best effort */ } } };
    beat();
    const heart = setInterval(beat, HEARTBEAT_MS);
    heart.unref?.();
    this.retryTimers.add(heart);
    let entries = this.entries();
    try {
      rememberNames(this.paths.names, entries); // so an appliance removed later comes back with its name
    } catch { /* remembered at the next start or save */ }

    // Known appliances come back immediately from the cache, before any
    // network or Python work, so a slow or offline start never removes them.
    const all = entries;
    const tvs = all.filter((e) => e.type === 'tv');
    entries = all.filter((e) => e.type !== 'tv');
    for (const entry of entries) {
      if (entry.id) {
        this.#attach(entry, entry.id, null);
      }
    }
    for (const entry of tvs) {
      this.#attachTv(entry);
    }
    try {
      // Switched off means gone: nothing of the iPhone-remote option is left behind.
      pruneAppleRemote(this.paths.appleRemote, tvs.filter((e) => e.id && e.appleRemote === true).map((e) => e.id));
    } catch { /* best effort */ }
    try {
      pruneSetup(this.paths.tvSetup, tvs.filter((e) => e.id && e.tvMode !== 'switches').map((e) => e.id));
    } catch { /* best effort */ }
    this.#pruneAccessories(all.filter((e) => !(e.type === 'tv' && switchesOf(e).length === 0))); // a TV without switches keeps nothing in the bridge

    if (!entries.length && tvs.length) {
      return; // TVs need no Python runtime
    }

    if (!entries.length) {
      this.log.info('No appliances configured yet. Open the plugin settings and add an IP address.');
      return;
    }

    await this.#connect(entries, 0);
  }

  /** Start the helper and connect; a failed start is retried, since its usual
   * cause (no internet for the first download, a slow disk) passes on its own. */
  async #connect(entries, attempt) {
    if (this.stopping) {
      return;
    }
    try {
      this.helper = await this.#startHelper();
    } catch (err) {
      if (this.stopping) {
        return;
      }
      const steps = this.overrides.helperRetryMs ?? HELPER_RETRY_MS;
      const delay = steps[Math.min(attempt, steps.length - 1)];
      this.log.error(`${err.message}${err.detail ? `\n${err.detail}` : ''}`);
      this.log.error(`The plugin cannot talk to appliances until this is fixed. Trying again in ${Math.round(delay / 1000)}s. See "Requirements" in the README.`);
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        this.#connect(entries, attempt + 1);
      }, delay);
      timer.unref?.();
      this.retryTimers.add(timer);
      return;
    }
    if (this.stopping) {
      await this.helper.stop();
      return;
    }
    for (const device of this.devices.values()) {
      device.link.attachHelper(this.helper);
    }
    // One after another, a second apart: six appliances asked for a secure
    // session in the same instant often refuse the first attempt.
    // And not straight away: an appliance whose previous session was closed a
    // second ago (a restart) may still be letting go of it.
    const gap = this.overrides.startGapMs ?? START_GAP_MS;
    const settle = this.overrides.startSettleMs ?? START_SETTLE_MS;
    entries.forEach((entry, i) => {
      const wait = settle + i * gap;
      if (!wait) {
        this.#bringUp(entry, 0);
        return;
      }
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        this.#bringUp(entry, 0);
      }, wait);
      timer.unref?.();
      this.retryTimers.add(timer);
    });
  }

  async #startHelper() {
    if (this.overrides.createHelper) {
      const helper = this.overrides.createHelper(this.paths);
      await helper.start();
      return helper;
    }
    const spawn = await helperSpawn(this.paths, this.config, (m) => this.log.info(m));
    this.engineInUse = spawn.engine;
    this.log.info(`Engine: ${spawn.engine === 'javascript' ? 'JavaScript (no Python)' : 'Python'}.`);
    const helper = new HelperClient({ command: spawn.command, args: spawn.args, env: spawn.env, log: this.log });
    await helper.start();
    return helper;
  }

  /** Connect one configured entry, retrying with backoff while it is unknown. */
  async #bringUp(entry, attempt) {
    if (this.stopping) {
      return;
    }
    const known = entry.id ? this.devices.get(entry.id) : null;
    if (known) {
      // Identity is already known: the helper keeps reconnecting on its own.
      known.link.open().catch((err) => this.log.debug(`open failed: ${err.message}`));
      return;
    }
    try {
      const probe = await this.helper.request('probe', { host: entry.host, port: entry.port }, 180_000);
      const deviceId = stableDeviceId(probe.identity);
      if (!deviceId) {
        throw Object.assign(new Error('The appliance did not report a stable device id.'), { code: 'no_identity' });
      }
      if (entry.id && entry.id !== deviceId) {
        throw Object.assign(new Error('A different appliance answered at this address. Update the IP address in the plugin settings.'),
          { code: 'identity_mismatch' });
      }
      const described = describeDevice(probe.identity, probe.resources);
      if (described.kind !== 'airConditioner' && described.support !== 'experimental') {
        this.log.warn(`${entry.host}: found a ${described.kind} (${described.model ?? 'unknown model'}). `
          + 'This version has no HomeKit accessory for it; the device is listed in the plugin settings for diagnostics.');
        writeJson(snapshotFile(this.paths, deviceId), this.#snapshot(entry, deviceId, probe, false));
        return;
      }
      if (this.devices.has(deviceId)) {
        this.log.warn(`${entry.host}: this is the same appliance as ${this.devices.get(deviceId).entry.host}. Skipping the duplicate entry.`);
        return;
      }
      const device = this.#attach({ ...entry, port: probe.port }, deviceId, probe);
      await device.link.open();
    } catch (err) {
      if (this.stopping) {
        return;
      }
      const delay = RETRY_STEPS_MS[Math.min(attempt, RETRY_STEPS_MS.length - 1)];
      this.log.warn(`${entry.host}: ${err.message} Retrying in ${Math.round(delay / 1000)}s.`);
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        this.#bringUp(entry, attempt + 1);
      }, delay);
      this.retryTimers.add(timer);
    }
  }

  /**
   * Keep the readings file for the settings page without wearing the disk:
   * HomeKit is updated at once, the file a moment later. Changed readings are
   * saved within seconds, unchanged ones only refresh the file once a minute.
   */
  #saveSnapshot(deviceId, build, resources) {
    this.snapshots ??= new Map();
    const slot = this.snapshots.get(deviceId) ?? {};
    const text = JSON.stringify(resources);
    const changed = text !== slot.saved;
    slot.build = build;
    slot.text = text;
    const due = Date.now() + (changed ? SNAPSHOT_CHANGED_MS : SNAPSHOT_SAME_MS);
    if (slot.timer && slot.due <= due) {
      this.snapshots.set(deviceId, slot);
      return;
    }
    clearTimeout(slot.timer);
    slot.due = slot.first === undefined ? Date.now() : due;
    slot.first = false;
    slot.timer = setTimeout(() => this.#flushSnapshot(deviceId), Math.max(0, slot.due - Date.now()));
    slot.timer.unref?.();
    this.snapshots.set(deviceId, slot);
  }

  #flushSnapshot(deviceId) {
    const slot = this.snapshots?.get(deviceId);
    if (!slot?.timer) {
      return;
    }
    clearTimeout(slot.timer);
    slot.timer = null;
    try {
      writeJson(snapshotFile(this.paths, deviceId), slot.build());
      slot.saved = slot.text;
    } catch (err) {
      this.log.debug(`could not save readings: ${err.message}`);
    }
  }

  #dropPendingSnapshot(deviceId) {
    const slot = this.snapshots?.get(deviceId);
    if (slot?.timer) {
      clearTimeout(slot.timer);
      slot.timer = null;
    }
  }

  #snapshot(entry, deviceId, source, online) {
    return {
      deviceId,
      host: entry.host,
      configHost: entry.configHost ?? entry.host,
      mac: entry.mac ?? null,
      name: entry.name ?? null,
      identity: source?.identity ?? null,
      resources: source?.resources ?? null,
      online,
      // Measured the same way for both engines, so they can be compared.
      commandMs: this.devices.get(deviceId)?.link.commandMs ?? null,
      readMs: this.devices.get(deviceId)?.link.readMs ?? null,
      pushes: this.devices.get(deviceId)?.link.pushes ?? null,
      engine: this.engineInUse ?? null,
      updatedAt: Date.now(),
    };
  }

  /** A TV talks its own protocol: no Python helper, no OCF session. */
  #attachTv(entry) {
    if (!entry.id) {
      this.log.warn(`${entry.host}: this TV has not been paired yet. Open the plugin settings, press Test & discover and follow the steps.`);
      return;
    }
    const mode = entry.tvMode === 'switches' ? 'switches' : 'tile';
    const name = String(entry.name || '').trim() || 'Samsung TV';
    const switches = switchesOf(entry);
    const mark = (acc) => {
      acc.context.deviceId = entry.id;
      acc.context.kind = 'tv';
      acc.context.model = entry.model ?? acc.context.model ?? null;
      return acc;
    };
    // The TV tile: its own accessory, made anew at every start (Apple requires it to be added on its own).
    const accessory = mode === 'tile'
      ? mark(new this.api.platformAccessory(name, this.api.hap.uuid.generate(UUID_NAMESPACE + entry.id + ':tv'), this.api.hap.Categories.TELEVISION))
      : null;
    // The switches chosen for automations: one accessory inside the bridge, kept by Homebridge between starts.
    let switchAccessory = null;
    let fresh = false;
    if (switches.length) {
      const uuid = this.api.hap.uuid.generate(UUID_NAMESPACE + entry.id);
      switchAccessory = this.cached.get(uuid);
      fresh = !switchAccessory;
      if (fresh) {
        switchAccessory = new this.api.platformAccessory(name, uuid, this.api.hap.Categories.SWITCH);
      } else if (switchAccessory.displayName !== name) {
        switchAccessory.updateDisplayName?.(name);
        switchAccessory.displayName = name;
      }
      mark(switchAccessory);
    }
    const tokens = readJson(this.paths.tvTokens) ?? {};
    const handler = new TvAccessory({
      api: this.api, log: this.log, accessory, switchAccessory, switches, name, entry, token: tokens[entry.id] ?? null,
      saveToken: (token) => {
        try {
          writeJson(this.paths.tvTokens, { ...(readJson(this.paths.tvTokens) ?? {}), [entry.id]: token });
        } catch (err) {
          this.log.debug(`could not save the TV token: ${err.message}`);
        }
      },
      reportsPower: Boolean((readJson(this.paths.tvFacts) ?? {})[entry.id]?.reportsPower),
      screenPortSeen: Boolean((readJson(this.paths.tvFacts) ?? {})[entry.id]?.screenPortSeen),
      pointer: (readJson(this.paths.tvFacts) ?? {})[entry.id]?.pointer ?? null,
      onAllowed: (allowed) => {
        try {
          const facts = readJson(this.paths.tvFacts) ?? {};
          writeJson(this.paths.tvFacts, { ...facts, [entry.id]: { ...facts[entry.id], allowed } });
        } catch { /* learned again at the next press */ }
      },
      onPointer: (pointer) => {
        try {
          const facts = readJson(this.paths.tvFacts) ?? {};
          writeJson(this.paths.tvFacts, { ...facts, [entry.id]: { ...facts[entry.id], pointer } });
        } catch { /* learned again at the next reading */ }
      },
      onScreenPortSeen: () => {
        try {
          const facts = readJson(this.paths.tvFacts) ?? {};
          writeJson(this.paths.tvFacts, { ...facts, [entry.id]: { ...facts[entry.id], screenPortSeen: true } });
        } catch { /* learned again after the next start */ }
      },
      onReportsPower: () => {
        try {
          const facts = readJson(this.paths.tvFacts) ?? {};
          writeJson(this.paths.tvFacts, { ...facts, [entry.id]: { ...facts[entry.id], reportsPower: true } });
        } catch { /* learned again after the next start */ }
      },
      ...(this.overrides.tv ?? {}),
    });
    if (entry.appleRemote === true) {
      handler.enableAppleRemote({ file: this.paths.appleRemote, name: mode === 'tile' ? `${name} +` : name, pin: entry.appleRemotePin,
        // A TV that says it takes no pointer keeps the arrows, whatever was chosen before.
        touch: (readJson(this.paths.tvFacts) ?? {})[entry.id]?.pointer === false ? 'arrows' : entry.appleRemoteTouch, ...(this.overrides.appleRemote ?? {}) })
        .catch((err) => this.log.warn(`[${name}] the iPhone remote option could not start: ${err.message}`));
    }
    if (accessory) {
      keepPort({ accessory, deviceId: entry.id, file: this.paths.tvFacts, log: this.log }); // the same port after every restart
      this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
      this.log.debug?.(`"${name}" is published as a TV. Add it in the Home app: + → Add Accessory → More options. Its code is on the plugin settings page, beside the TV.`);
      trackSetup({ accessory, deviceId: entry.id, name, file: this.paths.tvSetup, timers: this.retryTimers, log: this.log });
    }
    if (switchAccessory && fresh) {
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [switchAccessory]);
      this.log.info(`Added "${name}" (TV switches: ${switches.join(', ')}).`);
    } else if (switchAccessory) {
      this.api.updatePlatformAccessories([switchAccessory]);
    }
    this.tvs ??= [];
    this.tvs.push(handler);
  }

  /**
   * Accessories that belong to an appliance: one per group of switches (a washer's spin levels, say),
   * so Apple Home shows each group as one tile. They come and go with the option that asks for them.
   */
  #groups(deviceId) {
    const uuidOf = (id) => this.api.hap.uuid.generate(`${UUID_NAMESPACE}${deviceId}:${id}`);
    const fresh = new Set();
    return {
      get: (id, name) => {
        const uuid = uuidOf(id);
        let accessory = this.cached.get(uuid);
        if (!accessory) {
          accessory = new this.api.platformAccessory(accessoryName(name), uuid, this.api.hap.Categories.SWITCH);
          this.cached.set(uuid, accessory);
          fresh.add(uuid);
        }
        accessory.context.groupOf = deviceId;
        return accessory;
      },
      publish: (id) => {
        const uuid = uuidOf(id);
        const accessory = this.cached.get(uuid);
        if (accessory && fresh.delete(uuid)) {
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else if (accessory) {
          this.api.updatePlatformAccessories([accessory]);
        }
      },
      drop: (id) => {
        const uuid = uuidOf(id);
        const accessory = this.cached.get(uuid);
        if (accessory) {
          this.cached.delete(uuid);
          if (!fresh.delete(uuid)) {
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      },
    };
  }

  /** Create (or reuse) the accessory and link for one appliance. */
  #attach(entry, deviceId, probe) {
    const uuid = this.api.hap.uuid.generate(UUID_NAMESPACE + deviceId);
    let accessory = this.cached.get(uuid);
    const described = probe ? describeDevice(probe.identity, probe.resources) : null;
    const model = described ? described.model : accessory?.context.model;
    const kind = described?.kind ?? accessory?.context.kind ?? 'airConditioner';
    // The accessory that carries it. Kept with the accessory, so a restart while the
    // appliance is away builds the same one.
    const family = described ? familyOf(kind, described) : (accessory?.context.family ?? familyOf(kind));
    const laundry = family === 'laundry';
    const { Categories } = this.api.hap;
    const category = { ac: Categories.AIR_CONDITIONER, laundry: Categories.OTHER }[family]
      ?? { airPurifier: Categories.AIR_PURIFIER, dehumidifier: Categories.AIR_DEHUMIDIFIER }[kind] ?? Categories.OTHER;
    const name = accessoryName(entry.name || accessory?.context.baseName || model);
    let fresh = false;
    if (!accessory) {
      if (!probe) {
        // Configured id with nothing cached: wait for the first real contact.
        return null;
      }
      accessory = new this.api.platformAccessory(name, uuid, category);
      fresh = true;
    }
    if (!fresh && accessory.displayName !== name) {
      accessory.updateDisplayName?.(name);
      accessory.displayName = name;
    }
    accessory.context.deviceId = deviceId;
    accessory.context.kind = kind;
    accessory.context.family = family;
    accessory.context.baseName = entry.name || accessory.context.baseName || model || null;
    accessory.context.model = model ?? accessory.context.model ?? null;
    if (probe) {
      accessory.context.resources = probe.resources;
    }

    const link = new DeviceLink({
      helper: this.helper,
      key: deviceId,
      host: entry.host,
      port: entry.port ?? null,
      mac: entry.mac ?? null,
      expectedDi: deviceId,
      pollInterval: pollSeconds(this.config.pollInterval),
      push: this.config.pushUpdates !== false,
      // Looking for an appliance that changed address sends one small question to
      // every address of the home network; the owner can switch that off.
      follow: this.config.followAddress !== false,
      log: this.log,
    });
    const handler = family === 'appliance'
      ? new ApplianceAccessory({ api: this.api, log: this.log, accessory, link, displayName: name, features: entry.features, kind })
      : laundry
      ? new WasherAccessory({ api: this.api, log: this.log, accessory, link, displayName: name, features: entry.features, cycleStyle: entry.cycleStyle, groups: this.#groups(deviceId) })
      : new AcAccessory({ api: this.api, log: this.log, accessory, link, displayName: name, features: entry.features });
    link.on('retried', (path, accepted) => {
      this.log.info(`[${name}] the appliance answered 4.00 to "${path}"; asked again: ${accepted ? 'accepted' : 'refused again'}.`);
    });
    link.on('confirmed', (path) => {
      this.log.info(`[${name}] the appliance answered 4.00 to "${path}", but its state shows the command was carried out; not sent again.`);
    });
    link.on('update', (resources) => {
      this.#saveSnapshot(deviceId, () => this.#snapshot(entry, deviceId, { identity: link.identity, resources }, true), resources);
    });
    link.on('address', ({ host, mac, from }) => {
      if (from && from !== host) {
        this.log.info(`[${name}] found at a new address: ${from} → ${host}. Following it; the settings can stay as they are.`);
      }
      entry.host = host;
      entry.mac = mac ?? entry.mac;
      this.#rememberAddress(deviceId, entry, { host, mac });
    });
    // Say once whether the appliance delivers push updates, so a slow
    // reaction to the remote can be explained from the log.
    const pushCheck = setTimeout(() => {
      if (link.online && this.config.pushUpdates !== false) {
        if (link.pushes > 0) { // the usual case: only the exception is worth a line
          this.log.debug?.(`[${name}] push updates are arriving from the appliance.`);
        } else {
          this.log.info(`[${name}] no push updates received so far; changes made at the appliance show up at the polling interval (${link.pollInterval}s).`);
        }
      }
    }, 120_000);
    pushCheck.unref?.();
    this.retryTimers.add(pushCheck);
    this.stabilityNames.add(name);
    this.drops.expect(name);
    link.on('availability', (online) => {
      if (!this.stopping) {
        this.drops.note(name, online);
      }
      if (online) {
        this.#rememberAddress(deviceId, entry, { host: link.host, mac: link.mac, port: link.port });
        const tm = link.timing;
        if (tm) {
          const s = (ms) => (ms / 1000).toFixed(1);
          this.log.debug?.(tm.sessionMs === undefined
            ? `[${name}] connection took ${s(tm.totalMs)}s.`
            : `[${name}] connection took ${s(tm.totalMs)}s (secure session ${s(tm.sessionMs)}s, port ${tm.port}; identity ${s(tm.identityMs)}s; first reading ${s(tm.readingMs)}s).`);
          link.timing = null;
        }
      }
      if (!online) {
        this.#dropPendingSnapshot(deviceId);
        writeJson(snapshotFile(this.paths, deviceId),
          { ...this.#snapshot(entry, deviceId, { identity: link.identity, resources: link.resources ?? accessory.context.resources }, false), error: link.lastError?.code ?? null });
      }
    });

    if (fresh) {
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.log.info(`Added "${name}" (${shortId(deviceId)}).`);
    } else {
      this.api.updatePlatformAccessories([accessory]);
      this.log.debug?.(`Restored "${name}" (${shortId(deviceId)}) from cache.`);
    }
    const device = { link, handler, accessory, entry };
    this.devices.set(deviceId, device);
    return device;
  }

  /**
   * Remove accessories only when the user removed or disabled the appliance
   * in the settings. An unreachable appliance is never removed.
   */
  #pruneAccessories(entries) {
    const allIdsKnown = entries.every((e) => e.id);
    if (!allIdsKnown && this.config.removeUnconfigured !== true) {
      // An entry without an id may be one of the cached accessories.
      return;
    }
    const wanted = new Set(entries.filter((e) => e.id).map((e) => this.api.hap.uuid.generate(UUID_NAMESPACE + e.id)));
    for (const [uuid, accessory] of this.cached) {
      // A group of switches stays as long as the appliance it belongs to stays.
      const owner = accessory.context?.groupOf;
      if (!wanted.has(owner ? this.api.hap.uuid.generate(UUID_NAMESPACE + owner) : uuid)) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.cached.delete(uuid);
        this.log.info(`Removed "${accessory.displayName}" because it is no longer in the plugin settings.`);
      }
    }
  }

  /** Stop everything this plugin started. Nothing is left running. */
  async stop() {
    if (this.stopping) {
      return;
    }
    this.stopping = true;
    for (const timer of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    for (const tv of this.tvs ?? []) {
      tv.stop();
    }
    for (const deviceId of this.snapshots?.keys() ?? []) {
      this.#flushSnapshot(deviceId);
    }
    const helper = this.helper;
    this.helper = null;
    if (helper) {
      await helper.stop();
    }
    fs.rmSync(this.paths.running, { force: true });
  }
}

/**
 * How often an appliance is read when no push update arrives. One reading takes one to two
 * seconds, so below 4 the next one starts almost as the last ends and a command waits behind it.
 */
export const MIN_POLL_S = 4;
export const DEFAULT_POLL_S = 5;
export function pollSeconds(value) {
  const n = Number(value);
  return Math.min(300, Math.max(MIN_POLL_S, Number.isFinite(n) && n > 0 ? n : DEFAULT_POLL_S));
}
