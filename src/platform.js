import { AcAccessory, accessoryName } from './homekit/acAccessory.js';
import { describeDevice, stableDeviceId } from './capabilities/index.js';
import { DeviceLink } from './deviceLink.js';
import { shortId } from './redact.js';
import { HelperClient } from './runtime/helperClient.js';
import { ensureRuntime, HELPER_SCRIPT } from './runtime/pythonRuntime.js';
import { PLATFORM_NAME, PLUGIN_NAME, UUID_NAMESPACE } from './settings.js';
import { ensureDir, pluginPaths, readJson, snapshotFile, writeJson } from './storage.js';

const RETRY_STEPS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

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
        return { ...d, host: follow && known.host ? known.host : configHost, configHost, mac: d.mac ?? known?.mac ?? null };
      });
  }

  #rememberAddress(deviceId, entry, { host, mac }) {
    this.addresses ??= {};
    const previous = this.addresses[deviceId];
    const next = { configHost: entry.configHost ?? entry.host, host: host ?? entry.host, mac: mac ?? previous?.mac ?? null };
    if (previous && previous.configHost === next.configHost && previous.host === next.host && previous.mac === next.mac) {
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
    const entries = this.entries();

    // Known appliances come back immediately from the cache, before any
    // network or Python work, so a slow or offline start never removes them.
    for (const entry of entries) {
      if (entry.id) {
        this.#attach(entry, entry.id, null);
      }
    }
    this.#pruneAccessories(entries);

    if (!entries.length) {
      this.log.info('No appliances configured yet. Open the plugin settings and add an IP address.');
      return;
    }

    try {
      this.helper = await this.#startHelper();
    } catch (err) {
      this.log.error(`${err.message}${err.detail ? `\n${err.detail}` : ''}`);
      this.log.error('The plugin cannot talk to appliances until this is fixed. See "Requirements" in the README.');
      return;
    }
    for (const device of this.devices.values()) {
      device.link.attachHelper(this.helper);
    }
    for (const entry of entries) {
      this.#bringUp(entry, 0);
    }
  }

  async #startHelper() {
    if (this.overrides.createHelper) {
      const helper = this.overrides.createHelper(this.paths);
      await helper.start();
      return helper;
    }
    const { python } = await ensureRuntime(this.paths, {
      pythonPath: this.config.pythonPath,
      log: (m) => this.log.info(m),
    });
    ensureDir(this.paths.credentials);
    const helper = new HelperClient({
      command: python,
      args: ['-u', HELPER_SCRIPT],
      env: { SAMSUNG_LOCAL_CRED_DIR: this.paths.credentials },
      log: this.log,
    });
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
      if (described.kind !== 'airConditioner') {
        this.log.warn(`${entry.host}: found a ${described.kind} (${described.model ?? 'unknown model'}). `
          + 'This version only creates HomeKit accessories for air conditioners; the device is listed in the plugin settings for diagnostics.');
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
      updatedAt: Date.now(),
    };
  }

  /** Create (or reuse) the accessory and link for one appliance. */
  #attach(entry, deviceId, probe) {
    const uuid = this.api.hap.uuid.generate(UUID_NAMESPACE + deviceId);
    let accessory = this.cached.get(uuid);
    const model = probe ? describeDevice(probe.identity, probe.resources).model : accessory?.context.model;
    const name = accessoryName(entry.name || accessory?.context.baseName || model);
    let fresh = false;
    if (!accessory) {
      if (!probe) {
        // Configured id with nothing cached: wait for the first real contact.
        return null;
      }
      accessory = new this.api.platformAccessory(name, uuid, this.api.hap.Categories.AIR_CONDITIONER);
      fresh = true;
    }
    if (!fresh && accessory.displayName !== name) {
      accessory.updateDisplayName?.(name);
      accessory.displayName = name;
    }
    accessory.context.deviceId = deviceId;
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
      log: this.log,
    });
    const handler = new AcAccessory({
      api: this.api, log: this.log, accessory, link, displayName: name, features: entry.features,
    });
    link.on('update', (resources) => {
      writeJson(snapshotFile(this.paths, deviceId), this.#snapshot(entry, deviceId, { identity: link.identity, resources }, true));
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
    link.on('availability', (online) => {
      if (!online) {
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
    const helper = this.helper;
    this.helper = null;
    if (helper) {
      await helper.stop();
    }
  }
}
