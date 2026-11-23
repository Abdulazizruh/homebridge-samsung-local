import { pruneSetup, trackSetup } from './homekit/tvSetup.js';
import { DropLog } from './dropLog.js';
import { AcAccessory, accessoryName } from './homekit/acAccessory.js';
import { WasherAccessory } from './homekit/washerAccessory.js';
import { LAUNDRY_KINDS } from './capabilities/washer.js';
import { TvAccessory } from './homekit/tvAccessory.js';
import { pruneAppleRemote } from './appleRemote/bridge.js';
import { keepPort } from './homekit/tvPort.js';
import { describeDevice, stableDeviceId } from './capabilities/index.js';
import { DeviceLink } from './deviceLink.js';
import { shortId } from './redact.js';
import { HelperClient } from './runtime/helperClient.js';
import { helperSpawn } from './runtime/engine.js';
import { PLATFORM_NAME, PLUGIN_NAME, UUID_NAMESPACE } from './settings.js';
import { ensureDir, pluginPaths, readJson, snapshotFile, writeJson } from './storage.js';

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

  async start() {
    ensureDir(this.paths.root);
    let entries = this.entries();

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
    this.#pruneAccessories(all.filter((e) => !(e.type === 'tv' && e.tvMode !== 'switches')));

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
      if (described.kind !== 'airConditioner' && !(LAUNDRY_KINDS.has(described.kind) && described.support === 'experimental')) {
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
    const uuid = this.api.hap.uuid.generate(UUID_NAMESPACE + entry.id + (mode === 'tile' ? ':tv' : ''));
    let accessory = mode === 'switches' ? this.cached.get(uuid) : null;
    const fresh = !accessory;
    if (fresh) {
      accessory = new this.api.platformAccessory(name, uuid,
        mode === 'tile' ? this.api.hap.Categories.TELEVISION : this.api.hap.Categories.SWITCH);
    } else if (accessory.displayName !== name) {
      accessory.updateDisplayName?.(name);
      accessory.displayName = name;
    }
    accessory.context.deviceId = entry.id;
    accessory.context.kind = 'tv';
    accessory.context.model = entry.model ?? accessory.context.model ?? null;
    const tokens = readJson(this.paths.tvTokens) ?? {};
    const handler = new TvAccessory({
      api: this.api, log: this.log, accessory, entry, mode, token: tokens[entry.id] ?? null,
      saveToken: (token) => {
        try {
          writeJson(this.paths.tvTokens, { ...(readJson(this.paths.tvTokens) ?? {}), [entry.id]: token });
        } catch (err) {
          this.log.debug(`could not save the TV token: ${err.message}`);
        }
      },
      reportsPower: Boolean((readJson(this.paths.tvFacts) ?? {})[entry.id]?.reportsPower),
      screenPortSeen: Boolean((readJson(this.paths.tvFacts) ?? {})[entry.id]?.screenPortSeen),
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
      handler.enableAppleRemote({ file: this.paths.appleRemote, name: mode === 'tile' ? `${name} +` : name, pin: entry.appleRemotePin, ...(this.overrides.appleRemote ?? {}) })
        .catch((err) => this.log.warn(`[${name}] the iPhone remote option could not start: ${err.message}`));
    }
    if (mode === 'tile') {
      // Apple requires a TV tile to be its own accessory, added to the Home app separately.
      keepPort({ accessory, deviceId: entry.id, file: this.paths.tvFacts, log: this.log }); // the same port after every restart
      this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
      this.log.info(`"${name}" is published as a TV. Add it in the Home app: + → Add Accessory → More options. Its code is on the plugin settings page, beside the TV.`);
      trackSetup({ accessory, deviceId: entry.id, name, file: this.paths.tvSetup, timers: this.retryTimers, log: this.log });
    } else if (fresh) {
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.log.info(`Added "${name}" (TV switches).`);
    } else {
      this.api.updatePlatformAccessories([accessory]);
    }
    this.tvs ??= [];
    this.tvs.push(handler);
  }

  /** Create (or reuse) the accessory and link for one appliance. */
  #attach(entry, deviceId, probe) {
    const uuid = this.api.hap.uuid.generate(UUID_NAMESPACE + deviceId);
    let accessory = this.cached.get(uuid);
    const described = probe ? describeDevice(probe.identity, probe.resources) : null;
    const model = described ? described.model : accessory?.context.model;
    const kind = described?.kind ?? accessory?.context.kind ?? 'airConditioner';
    const laundry = LAUNDRY_KINDS.has(kind);
    const name = accessoryName(entry.name || accessory?.context.baseName || model);
    let fresh = false;
    if (!accessory) {
      if (!probe) {
        // Configured id with nothing cached: wait for the first real contact.
        return null;
      }
      accessory = new this.api.platformAccessory(name, uuid,
        laundry ? this.api.hap.Categories.OTHER : this.api.hap.Categories.AIR_CONDITIONER);
      fresh = true;
    }
    if (!fresh && accessory.displayName !== name) {
      accessory.updateDisplayName?.(name);
      accessory.displayName = name;
    }
    accessory.context.deviceId = deviceId;
    accessory.context.kind = kind;
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
      pollInterval: Math.max(2, Number(this.config.pollInterval) || 15),
      push: this.config.pushUpdates !== false,
      // Looking for an appliance that changed address sends one small question to
      // every address of the home network; the owner can switch that off.
      follow: this.config.followAddress !== false,
      log: this.log,
    });
    const handler = laundry
      ? new WasherAccessory({ api: this.api, log: this.log, accessory, link, displayName: name, features: entry.features, cycleStyle: entry.cycleStyle })
      : new AcAccessory({ api: this.api, log: this.log, accessory, link, displayName: name, features: entry.features });
    link.on('retried', (path, accepted) => {
      this.log.info(`[${name}] the appliance answered 4.00 to "${path}"; asked again: ${accepted ? 'accepted' : 'refused again'}.`);
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
        this.log.info(link.pushes > 0
          ? `[${name}] push updates are arriving from the appliance.`
          : `[${name}] no push updates received so far; changes made at the appliance show up at the polling interval (${link.pollInterval}s).`);
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
          this.log.info(tm.sessionMs === undefined
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
      this.log.info(`Restored "${name}" (${shortId(deviceId)}) from cache.`);
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
      if (!wanted.has(uuid)) {
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
  }
}
