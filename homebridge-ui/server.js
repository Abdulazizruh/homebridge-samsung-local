import fs from 'node:fs';
import path from 'node:path';
import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';
import { describeDevice, diagnosticsDump, stableDeviceId } from '../src/capabilities/index.js';
import { HelperClient } from '../src/runtime/helperClient.js';
import { ensureRuntime, findPython, HELPER_SCRIPT, runtimeStatus } from '../src/runtime/pythonRuntime.js';
import { ensureDir, listSnapshots, pluginPaths, wipePluginData } from '../src/storage.js';

const OLD_PLUGIN = 'homebridge-smartthings-oauth';

class UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();
    this.paths = pluginPaths(this.homebridgeStoragePath);
    this.lastProbes = new Map();
    this.onRequest('/status', () => this.status());
    this.onRequest('/prepare', () => this.prepare());
    this.onRequest('/probe', (payload) => this.probe(payload));
    this.onRequest('/diagnostics', (payload) => this.diagnostics(payload));
    this.onRequest('/legacy-devices', () => this.legacyDevices());
    this.onRequest('/wipe', (payload) => this.wipe(payload));
    this.onRequest('/saved-devices', () => this.savedDevices());
    this.ready();
  }

  fail(err) {
    throw new RequestError(err.message, {
      code: err.code ?? 'error',
      detail: err.detail ?? null,
      // Technical details for troubleshooting. Ports and DTLS outcomes only.
      technical: {
        triedPorts: err.triedPorts ?? null,
        discovery: err.details ?? null,
        diagnosis: err.diagnosis ?? null,
        raw: String(err.message ?? '').slice(0, 300),
      },
    });
  }

  async status() {
    let python = null;
    let pythonError = null;
    try {
      python = await findPython();
    } catch (err) {
      pythonError = { code: err.code, message: err.message };
    }
    return {
      runtimeReady: runtimeStatus(this.paths).ready,
      python,
      pythonError,
      arch: process.arch,
      devices: listSnapshots(this.paths).map((snap) => this.present(snap)),
    };
  }

  present(snap, source = 'snapshot') {
    const described = snap.resources ? describeDevice(snap.identity, snap.resources) : null;
    return {
      host: snap.host,
      name: snap.name ?? null,
      deviceId: snap.deviceId ?? (snap.identity ? stableDeviceId(snap.identity) : null),
      online: Boolean(snap.online),
      error: snap.error ?? null,
      updatedAt: snap.updatedAt ?? null,
      source,
      described,
    };
  }

  async prepare() {
    try {
      const result = await ensureRuntime(this.paths, {});
      return { ok: true, installed: result.installed };
    } catch (err) {
      return this.fail(err);
    }
  }

  /** Reads identity and resources for one address. Success means the
   * appliance answered an authenticated read, never just a ping. */
  async probe({ host } = {}) {
    if (typeof host !== 'string' || !/^[0-9a-zA-Z.:-]{3,253}$/.test(host.trim())) {
      throw new RequestError('Enter a valid IP address.', { code: 'bad_host' });
    }
    host = host.trim();
    // The running plugin already holds a session to this appliance: reuse its
    // latest reading instead of opening a second connection to the device.
    const live = listSnapshots(this.paths).find((s) => s.host === host && s.online && Date.now() - s.updatedAt < 90_000);
    if (live) {
      return this.present(live, 'running-plugin');
    }
    let helper;
    try {
      const { python } = await ensureRuntime(this.paths, {});
      ensureDir(this.paths.credentials);
      helper = new HelperClient({
        command: python,
        args: ['-u', HELPER_SCRIPT],
        env: { SAMSUNG_LOCAL_CRED_DIR: this.paths.credentials },
        restartDelaysMs: [],
      });
      helper.stopped = true; // one-shot: never auto-restart
      await helper.start();
      const result = await helper.request('probe', { host }, 180_000);
      // Kept in memory only, so a diagnostics file can be saved for an
      // appliance that is not (or cannot yet be) configured.
      this.lastProbes.set(host, { identity: result.identity, resources: result.resources });
      return this.present({
        host, identity: result.identity, resources: result.resources, online: true, updatedAt: Date.now(),
      }, 'probe');
    } catch (err) {
      return this.fail(err);
    } finally {
      await helper?.stop();
    }
  }

  diagnostics({ deviceId, host } = {}) {
    const snap = (deviceId && listSnapshots(this.paths).find((s) => s.deviceId === deviceId))
      || (host && this.lastProbes.get(host))
      || (host && listSnapshots(this.paths).find((s) => s.host === host));
    if (!snap?.resources) {
      throw new RequestError('No stored reading for this appliance yet.', { code: 'no_snapshot' });
    }
    return diagnosticsDump(snap.identity, snap.resources);
  }

  /**
   * This plugin's saved appliance list, straight from the Homebridge config
   * file. Read-only, and only this plugin's own platform block is returned.
   */
  savedDevices() {
    try {
      const all = JSON.parse(fs.readFileSync(this.homebridgeConfigPath, 'utf8'));
      const block = (all.platforms || []).find((p) => p?.platform === 'SamsungLocal');
      if (!block) { return {}; }
      return {
        devices: Array.isArray(block.devices) ? block.devices : [],
        pollInterval: block.pollInterval,
        pushUpdates: block.pushUpdates,
      };
    } catch {
      return {};
    }
  }

  /**
   * Names of appliances the existing SmartThings plugin knows, for naming
   * only. Strictly read-only: opens Homebridge's accessory cache for reading
   * and never writes to it or to the other plugin's files.
   */
  legacyDevices() {
    const dir = path.join(this.homebridgeStoragePath, 'accessories');
    const names = new Set();
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((n) => n.startsWith('cachedAccessories'));
    } catch {
      return { names: [] };
    }
    for (const file of files) {
      try {
        const list = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        for (const acc of Array.isArray(list) ? list : []) {
          if (acc?.plugin === OLD_PLUGIN && typeof acc.displayName === 'string') {
            names.add(acc.displayName);
          }
        }
      } catch { /* unreadable cache file: skip */ }
    }
    return { names: [...names].sort() };
  }

  wipe({ confirm, keepRuntime } = {}) {
    if (confirm !== 'DELETE') {
      throw new RequestError('Confirmation text does not match.', { code: 'not_confirmed' });
    }
    return { removed: wipePluginData(this.homebridgeStoragePath, { keepRuntime: Boolean(keepRuntime) }) };
  }
}

(() => new UiServer())();
