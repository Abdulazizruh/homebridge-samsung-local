import fs from 'node:fs';
import path from 'node:path';
import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';
import { describeDevice, diagnosticsDump, stableDeviceId } from '../src/capabilities/index.js';
import { HelperClient } from '../src/runtime/helperClient.js';
import { chosenEngine, DEFAULT_ENGINE, helperSpawn, VERSION as PLUGIN_VERSION } from '../src/runtime/engine.js';
import { ensureRuntime, findPython, runtimeStatus } from '../src/runtime/pythonRuntime.js';
import { ensureDir, folderSize, listSnapshots, pluginPaths, readJson, removePythonRuntime, wipePluginData, writeJson } from '../src/storage.js';
import { TizenRemote, tvInfo } from '../src/tv/tizenClient.js';
import QRCode from 'qrcode-svg';
import { scanNetwork, tidyName } from '../src/scan.js';

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
    this.onRequest('/tv-pair', (payload) => this.tvPair(payload));
    this.onRequest('/tv-text', (payload) => this.tvText(payload));
    this.onRequest('/remove-runtime', () => this.removeRuntime());
    this.onRequest('/scan', () => this.scan());
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
    const engine = chosenEngine(await this.pluginConfig());
    return {
      engine,
      version: PLUGIN_VERSION,
      defaultEngine: DEFAULT_ENGINE,
      // Megabytes the unused Python runtime still takes (also in every backup).
      pythonRuntimeMb: Math.round(folderSize(this.paths.venv) / 1e6),
      // The JavaScript engine has nothing to prepare.
      runtimeReady: engine === 'javascript' || runtimeStatus(this.paths).ready,
      python,
      pythonError,
      arch: process.arch,
      devices: listSnapshots(this.paths).map((snap) => this.present(snap)),
      tvSetup: this.tvSetup(),
      // Pairing code of each TV shown to the iPhone remote, and how many phones are paired.
      appleRemote: Object.fromEntries(Object.entries(readJson(this.paths.appleRemote) ?? {})
        .map(([id, v]) => [id, { pin: String(v?.pin ?? ''), phones: Object.keys(v?.clients ?? {}).length }])),
    };
  }

  /**
   * Look around the home network once, because the owner pressed the button.
   * TVs come back identified (their info page says what they are). Other
   * appliances come back as addresses only: reading what each one is opens a
   * session, which the page then does one appliance at a time through /probe.
   */
  async scan() {
    try {
      const config = await this.pluginConfig();
      const hints = [...listSnapshots(this.paths).map((s) => s.host), ...(config.devices ?? []).map((d) => d.host)]
        .filter((h) => typeof h === 'string');
      const found = await scanNetwork({ hints });
      return {
        networks: found.networks,
        asked: found.asked,
        alive: found.alive,
        appliances: found.appliances,
        tvs: found.tvs.map((tv) => this.presentTv(tv.host, { ...tv, name: tidyName(tv.name) })),
      };
    } catch (err) {
      return this.fail(err);
    }
  }

  /** Setup code of each TV tile, with the same code as a picture to scan. */
  tvSetup() {
    const out = {};
    for (const [deviceId, setup] of Object.entries(readJson(this.paths.tvSetup) ?? {})) {
      let svg = null;
      if (setup.uri) {
        try {
          svg = new QRCode({ content: setup.uri, width: 180, height: 180, padding: 3, ecl: 'M', join: true, container: 'svg-viewbox' }).svg();
        } catch { /* the digits are enough */ }
      }
      out[deviceId] = { pin: setup.pin, paired: Boolean(setup.paired), svg };
    }
    return out;
  }

  present(snap, source = 'snapshot') {
    const described = snap.resources ? describeDevice(snap.identity, snap.resources) : null;
    return {
      host: snap.host,
      configHost: snap.configHost ?? null,
      mac: snap.mac ?? null,
      name: snap.name ?? null,
      deviceId: snap.deviceId ?? (snap.identity ? stableDeviceId(snap.identity) : null),
      online: Boolean(snap.online),
      error: snap.error ?? null,
      commandMs: snap.commandMs ?? null,
      engine: snap.engine ?? null,
      updatedAt: snap.updatedAt ?? null,
      source,
      described,
    };
  }

  async prepare() {
    try {
      const result = await ensureRuntime(this.paths, { pythonPath: (await this.pluginConfig()).pythonPath });
      return { ok: true, installed: result.installed };
    } catch (err) {
      return this.fail(err);
    }
  }

  /** Reads identity and resources for one address. Success means the
   * appliance answered an authenticated read, never just a ping. */
  async probe({ host } = {}) {
    if (typeof host !== 'string' || !/^[0-9a-zA-Z.: -]{3,253}$/.test(host.trim())) {
      throw new RequestError('Enter a valid IP address or MAC address.', { code: 'bad_host' });
    }
    host = host.trim();
    // A MAC address instead of an IP address: look up where it is now.
    const macDigits = host.replace(/[^0-9a-fA-F]/g, '');
    const typedMac = macDigits.length === 12 && /^[0-9a-fA-F:.\- ]+$/.test(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)
      ? macDigits.toLowerCase().match(/../g).join(':') : null;
    if (typedMac) {
      const known = listSnapshots(this.paths).find((s) => s.mac === typedMac && s.host);
      host = known ? known.host : await this.locate(typedMac);
      if (known) {
        // The remembered address may be out of date: when the appliance does
        // not answer there, it is looked up again by its MAC address.
        try {
          return await this.probeHost(host, typedMac);
        } catch (err) {
          const fresh = await this.locate(typedMac).catch(() => null);
          if (!fresh || fresh === host) {
            throw err;
          }
          host = fresh;
        }
      }
    }
    return this.probeHost(host, typedMac);
  }

  async probeHost(host, typedMac = null) {
    // The running plugin already holds a session to this appliance: reuse its
    // latest reading instead of opening a second connection to the device.
    const live = listSnapshots(this.paths).find((s) => s.host === host && s.online && Date.now() - s.updatedAt < 90_000);
    if (live) {
      return this.present(live, 'running-plugin');
    }
    // A TV answers on its own local channel and needs no Python runtime.
    const tv = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? await tvInfo(host, { timeoutMs: 1500 }) : null;
    if (tv) {
      // A MAC address typed by the owner is the interface the TV is really
      // connected with (it may be the cable, not Wi-Fi): waking uses that one.
      return this.presentTv(host, { ...tv, name: tidyName(tv.name), ...(typedMac ? { mac: typedMac } : {}) });
    }
    let helper;
    try {
      const spawn = await helperSpawn(this.paths, await this.pluginConfig());
      helper = new HelperClient({ command: spawn.command, args: spawn.args, env: spawn.env, restartDelaysMs: [] });
      helper.stopped = true; // one-shot: never auto-restart
      await helper.start();
      const result = await helper.request('probe', { host }, 180_000);
      // Kept in memory only, so a diagnostics file can be saved for an
      // appliance that is not (or cannot yet be) configured.
      this.lastProbes.set(host, { identity: result.identity, resources: result.resources });
      return this.present({
        host, mac: result.mac ?? typedMac ?? null, identity: result.identity, resources: result.resources, online: true, updatedAt: Date.now(),
      }, 'probe');
    } catch (err) {
      return this.fail(err);
    } finally {
      await helper?.stop();
    }
  }

  presentTv(host, tv) {
    const deviceId = tv.id ? `tv-${tv.id}` : tv.mac ? `tv-${tv.mac.replace(/:/g, '')}` : null;
    const tokens = readJson(this.paths.tvTokens) ?? {};
    return {
      host, deviceId, mac: tv.mac, source: 'probe',
      described: { kind: 'tv', deviceId, model: tv.model, support: 'experimental', reason: null, features: [], unknownResources: [] },
      // Models without token support connect after one approval and hand out no token.
      tv: { name: tv.name, power: tv.power, tokenAuth: tv.tokenAuth, paired: Boolean(deviceId && tokens[deviceId]) },
    };
  }

  /** Ask the TV for permission; the owner answers "Allow" on its screen. */
  /**
   * Trial: send a text to the field a TV's on-screen keyboard is open on, over
   * the pairing the TV already granted. Nothing is stored and the text is not logged.
   */
  async tvText({ host, id, text, done } = {}) {
    if (typeof host !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim())) {
      throw new RequestError('Enter a valid IP address.', { code: 'bad_host' });
    }
    if (typeof text !== 'string' || !text.length || text.length > 200) {
      throw new RequestError('Enter a text of up to 200 characters.', { code: 'bad_text' });
    }
    const token = (readJson(this.paths.tvTokens) ?? {})[id] ?? null;
    let keyboard = null;
    const remote = new TizenRemote({ host: host.trim(), token, onKeyboard: (open) => { keyboard = open; } });
    try {
      await remote.open();
      // A moment for the TV to say whether its keyboard is open, then the text.
      await new Promise((resolve) => setTimeout(resolve, 700));
      const before = keyboard;
      await remote.text(text, { done: Boolean(done) });
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { sent: true, keyboardBefore: before, keyboardAfter: keyboard };
    } catch (err) {
      throw new RequestError(err.message, { code: err.code ?? 'tv_error' });
    } finally {
      remote.close();
    }
  }

  async tvPair({ host } = {}) {
    if (typeof host !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim())) {
      throw new RequestError('Enter a valid IP address.', { code: 'bad_host' });
    }
    host = host.trim();
    const tv = await tvInfo(host);
    if (!tv) {
      throw new RequestError('The TV does not answer. Switch it on and try again.', { code: 'tv_off' });
    }
    const { deviceId } = this.presentTv(host, tv);
    if (!deviceId) {
      throw new RequestError('The TV did not report an identity.', { code: 'no_identity' });
    }
    const tokens = readJson(this.paths.tvTokens) ?? {};
    let token = tokens[deviceId] ?? null;
    const remote = new TizenRemote({ host, token, onToken: (t) => { token = t; } });
    try {
      await remote.open(60_000);
    } catch (err) {
      throw new RequestError(err.message, { code: err.code ?? 'tv_error' });
    } finally {
      remote.close();
    }
    if (token) {
      ensureDir(this.paths.root);
      writeJson(this.paths.tvTokens, { ...(readJson(this.paths.tvTokens) ?? {}), [deviceId]: token });
    }
    return { paired: true, deviceId };
  }

  /** Resolve a MAC address to its current IP address on the local network. */
  async locate(mac) {
    let helper;
    try {
      const spawn = await helperSpawn(this.paths, await this.pluginConfig());
      helper = new HelperClient({ command: spawn.command, args: spawn.args, env: spawn.env, restartDelaysMs: [] });
      helper.stopped = true;
      await helper.start();
      const hints = listSnapshots(this.paths).map((s) => s.host).filter(Boolean).slice(0, 3);
      const found = await helper.request('locate', { mac, hints }, 60_000);
      return found.host;
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
  /** Free the space of a Python runtime that is no longer in use. */
  async removeRuntime() {
    if (chosenEngine(await this.pluginConfig()) !== 'javascript') {
      throw new RequestError('The Python runtime is in use. Switch to the JavaScript engine first.', { code: 'runtime_in_use' });
    }
    const { freed } = removePythonRuntime(this.paths);
    return { freedMb: Math.round(freed / 1e6) };
  }

  /** This plugin's own block of the Homebridge configuration. */
  async pluginConfig() {
    try {
      const all = JSON.parse(fs.readFileSync(this.homebridgeConfigPath, 'utf8'));
      const block = (all.platforms || []).find((p) => p?.platform === 'SamsungLocal') ?? {};
      return { engine: block.engine, pythonPath: block.pythonPath };
    } catch {
      return {};
    }
  }

  savedDevices() {
    try {
      const all = JSON.parse(fs.readFileSync(this.homebridgeConfigPath, 'utf8'));
      const block = (all.platforms || []).find((p) => p?.platform === 'SamsungLocal');
      if (!block) { return {}; }
      return {
        devices: Array.isArray(block.devices) ? block.devices : [],
        pollInterval: block.pollInterval,
        pushUpdates: block.pushUpdates,
        engine: block.engine,
        followAddress: block.followAddress,
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
