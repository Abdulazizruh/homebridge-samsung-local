/**
 * Which helper talks to the appliances: the Python one (stable) or the
 * JavaScript one (beta, no Python needed). Both speak the same protocol, so
 * nothing else in the plugin knows the difference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir } from '../storage.js';
import { ensureRuntime, HELPER_SCRIPT } from './pythonRuntime.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const JS_HELPER_SCRIPT = path.join(root, 'engine', 'bridge.mjs');
const VERSION = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

/** A beta release tries the JavaScript engine unless told otherwise. */
export const DEFAULT_ENGINE = /-(alpha|beta)/.test(VERSION) ? 'javascript' : 'python';

export function chosenEngine(config) {
  return ['python', 'javascript'].includes(config?.engine) ? config.engine : DEFAULT_ENGINE;
}

/** Command, arguments and environment for the helper process. */
export async function helperSpawn(paths, config = {}, log = () => {}) {
  ensureDir(paths.credentials);
  const env = { SAMSUNG_LOCAL_CRED_DIR: paths.credentials };
  if (chosenEngine(config) === 'javascript') {
    return { engine: 'javascript', command: process.execPath, args: [JS_HELPER_SCRIPT], env };
  }
  const { python } = await ensureRuntime(paths, { pythonPath: config.pythonPath, log });
  // -I: isolated mode, so no PYTHON* variable or user site folder can change what is loaded.
  return { engine: 'python', command: python, args: ['-I', '-u', HELPER_SCRIPT], env };
}
