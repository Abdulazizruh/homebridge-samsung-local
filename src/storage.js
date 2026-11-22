import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_DIR_NAME } from './settings.js';

/** All paths this plugin owns. Everything lives under one folder so wiping or
 * removing the plugin can never touch another plugin's files. */
export function pluginPaths(homebridgeStoragePath) {
  const root = path.join(homebridgeStoragePath, STORAGE_DIR_NAME);
  return {
    root,
    venv: path.join(root, 'venv'),
    credentials: path.join(root, 'credentials'),
    state: path.join(root, 'state'),
    runtimeMarker: path.join(root, 'runtime.json'),
    // Where each appliance was last found (it may differ from the settings).
    addresses: path.join(root, 'addresses.json'),
  };
}

export function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Atomic write: a crash mid-write never leaves a half file behind. */
export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function snapshotFile(paths, deviceId) {
  return path.join(paths.state, `${deviceId.replace(/[^a-zA-Z0-9-]/g, '_')}.json`);
}

export function listSnapshots(paths) {
  let names = [];
  try {
    names = fs.readdirSync(paths.state).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  return names.map((n) => readJson(path.join(paths.state, n))).filter(Boolean);
}

/**
 * Delete this plugin's own data. Refuses anything that is not the plugin's
 * dedicated folder directly under the Homebridge storage path.
 * @returns {string[]} what was removed
 */
export function wipePluginData(homebridgeStoragePath, { keepRuntime = false } = {}) {
  const paths = pluginPaths(homebridgeStoragePath);
  const expected = path.join(path.resolve(homebridgeStoragePath), STORAGE_DIR_NAME);
  if (path.resolve(paths.root) !== expected || path.basename(expected) !== STORAGE_DIR_NAME) {
    throw new Error('Refusing to wipe: unexpected storage path.');
  }
  const removed = [];
  const targets = keepRuntime ? [paths.credentials, paths.state] : [paths.root];
  for (const target of targets) {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(path.relative(homebridgeStoragePath, target));
    }
  }
  return removed;
}
