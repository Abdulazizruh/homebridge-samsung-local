import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
export const fixturePath = (name) => path.join(here, 'fixtures', `${name}.json`);
export const fixture = (name) => JSON.parse(fs.readFileSync(fixturePath(name), 'utf8'));

const apiModule = await import(pathToFileURL(path.join(root, 'node_modules/homebridge/dist/api.js')).href);
const userModule = await import(pathToFileURL(path.join(root, 'node_modules/homebridge/dist/user.js')).href);

export function tmpDir(prefix = 'sl-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A real Homebridge API object (real HAP services), with registrations recorded. */
export function makeApi(storagePath = tmpDir()) {
  const api = new apiModule.HomebridgeAPI();
  // Homebridge's User path is process-global; give each test its own.
  Object.defineProperty(api, 'user', { value: { storagePath: () => storagePath, User: userModule.User } });
  api.registered = [];
  api.unregistered = [];
  api.registerPlatformAccessories = (plugin, platform, list) => api.registered.push(...list.map((a) => ({ plugin, platform, accessory: a })));
  api.unregisterPlatformAccessories = (plugin, platform, list) => api.unregistered.push(...list);
  api.updatePlatformAccessories = () => {};
  return api;
}

export const quietLog = Object.assign(() => {}, {
  lines: [],
  debug() {}, info(m) { quietLog.lines.push(['info', m]); }, warn(m) { quietLog.lines.push(['warn', m]); },
  error(m) { quietLog.lines.push(['error', m]); }, success() {},
});

/** In-memory link: applies writes through `apply` and records them. */
export class FakeLink extends EventEmitter {
  constructor(resources, apply) {
    super();
    this.resources = structuredClone(resources);
    this.online = true;
    this.apply = apply;
    this.sent = [];
    this.accept = true;
    this.autoReport = true;
  }

  async send(writes) {
    if (!this.online) {
      throw Object.assign(new Error('offline'), { code: 'offline' });
    }
    for (const w of writes) {
      this.sent.push(w);
      if (!this.accept) {
        throw Object.assign(new Error('refused'), { code: 'refused' });
      }
      this.apply?.(this.resources, w);
    }
    if (this.autoReport) {
      this.emit('update', this.resources);
    }
  }

  report() {
    this.emit('update', this.resources);
  }

  setOnline(online) {
    this.online = online;
    this.emit('availability', online, online ? null : { code: 'timeout', message: 'timeout' });
  }
}

export async function waitFor(check, timeoutMs = 4000, stepMs = 20) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) {
      return value;
    }
    if (Date.now() > end) {
      throw new Error('waitFor: condition not met in time');
    }
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
