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
    tvTokens: path.join(root, 'tv-tokens.json'),
    // What was learned about each TV (for example that it names its power state).
    tvFacts: path.join(root, 'tv-facts.json'),
    // Setup code of each TV tile, shown on the settings page.
    tvSetup: path.join(root, 'tv-setup.json'),
    // The iPhone-remote stand-in of each TV that has the option on: identity, code and paired phones.
    appleRemote: path.join(root, 'apple-remote.json'),
    // Connection losses counted for the daily line in the log.
    stability: path.join(root, 'stability.json'),
    // The last name given to each appliance in the settings, kept after it is removed.
    names: path.join(root, 'names.json'),
    // The appliance list imported once from SmartThings (names, rooms, models, IDs; never the token).
    smartthings: path.join(root, 'smartthings.json'),
    // Written every half minute while this plugin's bridge runs, removed when it stops.
    running: path.join(root, 'running.json'),
  };
}

/** Size of the plugin's own Python runtime folder, in bytes (0 when absent). */
export function folderSize(dir) {
  let total = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += folderSize(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

/**
 * Remove only the Python runtime this plugin downloaded into its own folder.
 * Python itself, the certificate, the settings and every other file stay.
 */
export function removePythonRuntime(paths) {
  const freed = folderSize(paths.venv);
  fs.rmSync(paths.venv, { recursive: true, force: true });
  fs.rmSync(paths.runtimeMarker, { force: true });
  return { freed };
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

/** Whether this plugin's bridge is running now: its heartbeat is fresh. */
export const HEARTBEAT_MS = 30_000;
export function bridgeRunning(paths, now = Date.now()) {
  const beat = readJson(paths.running);
  return Boolean(beat && Number.isFinite(beat.at) && now - beat.at < HEARTBEAT_MS * 2.5);
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
  const targets = keepRuntime ? [paths.credentials, paths.state, paths.names, paths.smartthings] : [paths.root];
  for (const target of targets) {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(path.relative(homebridgeStoragePath, target));
    }
  }
  return removed;
}
