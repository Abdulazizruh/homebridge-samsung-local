import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_PYTHON } from '../settings.js';
import { ensureDir, readJson, writeJson } from '../storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const HELPER_SCRIPT = path.resolve(here, '../../python/bridge.py');
export const REQUIREMENTS = path.resolve(here, '../../python/requirements.txt');
// Same pins with the SHA-256 of every wheel PyPI serves for them. pip refuses
// any downloaded file whose hash is not listed.
export const REQUIREMENTS_LOCK = path.resolve(here, '../../python/requirements.lock');

/** An error the UI and log can explain: `code` selects the guidance text. */
export class RuntimeError extends Error {
  constructor(code, message, detail = '') {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

function run(cmd, args, { timeout = 60_000, env } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, env, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

export function venvPython(venvDir) {
  return process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
}

function versionOk(text) {
  const m = /^(\d+)\.(\d+)/.exec(text.trim());
  if (!m) {
    return false;
  }
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > MIN_PYTHON[0] || (major === MIN_PYTHON[0] && minor >= MIN_PYTHON[1]);
}

/** Find a system Python that is new enough. Never installs one. */
export async function findPython(preferred) {
  const candidates = [preferred, 'python3', 'python3.13', 'python3.12', 'python3.11', 'python'].filter(Boolean);
  let tooOld = null;
  for (const candidate of candidates) {
    const res = await run(candidate, ['-c', 'import sys;print("%d.%d.%d"%sys.version_info[:3])'], { timeout: 15_000 });
    if (!res.ok) {
      continue;
    }
    const version = res.stdout.trim();
    if (versionOk(version)) {
      return { path: candidate, version };
    }
    tooOld = tooOld ?? version;
  }
  if (tooOld) {
    throw new RuntimeError('python_too_old',
      `Python ${tooOld} was found, but ${MIN_PYTHON.join('.')} or newer is required.`);
  }
  throw new RuntimeError('python_missing', 'No Python 3 interpreter was found on this system.');
}

function requirementsHash() {
  return crypto.createHash('sha256').update(fs.readFileSync(REQUIREMENTS)).digest('hex').slice(0, 16);
}

export function runtimeStatus(paths) {
  const marker = readJson(paths.runtimeMarker);
  const ready = Boolean(marker) && marker.requirements === requirementsHash() && fs.existsSync(venvPython(paths.venv));
  return { ready, marker };
}

async function withLock(paths, fn) {
  const lock = path.join(paths.root, '.setup.lock');
  ensureDir(paths.root);
  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      let age = 0;
      try {
        age = Date.now() - fs.statSync(lock).mtimeMs;
      } catch { /* released meanwhile */ }
      if (age > 15 * 60_000) {
        fs.rmSync(lock, { recursive: true, force: true });
      } else if (Date.now() > deadline) {
        throw new RuntimeError('setup_busy', 'Another setup of the Python runtime is still running.');
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

/**
 * Make sure the plugin's private virtual environment exists and holds the
 * pinned packages. Runs as the Homebridge user, writes only inside the
 * plugin's storage folder, and never touches system packages.
 * The only network access is pip downloading the pinned wheels from PyPI,
 * and only when the environment is missing or the pins changed.
 */
export async function ensureRuntime(paths, { pythonPath, log = () => {} } = {}) {
  if (runtimeStatus(paths).ready) {
    return { python: venvPython(paths.venv), installed: false };
  }
  return withLock(paths, async () => {
    if (runtimeStatus(paths).ready) {
      return { python: venvPython(paths.venv), installed: false };
    }
    const system = await findPython(pythonPath);
    log(`Preparing the Python runtime with ${system.path} ${system.version} (first start only)…`);
    fs.rmSync(paths.venv, { recursive: true, force: true });
    const venv = await run(system.path, ['-m', 'venv', paths.venv], { timeout: 180_000 });
    if (!venv.ok) {
      throw new RuntimeError('venv_failed',
        'Could not create a Python virtual environment (the python3-venv package may be missing).',
        (venv.stderr || venv.stdout).slice(-600));
    }
    const py = venvPython(paths.venv);
    const pip = await run(py, [
      '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
      '--only-binary', ':all:', '--require-hashes', '-r', REQUIREMENTS_LOCK,
    ], { timeout: 15 * 60_000 });
    if (!pip.ok) {
      fs.rmSync(paths.venv, { recursive: true, force: true });
      const offline = /Temporary failure|Name or service|ConnectionError|Max retries|timed out/i.test(pip.stderr);
      const tampered = /DO NOT MATCH THE HASHES/i.test(pip.stderr);
      throw new RuntimeError(tampered ? 'pip_hash' : offline ? 'pip_offline' : 'pip_failed',
        tampered
          ? 'A downloaded Python package did not match its expected checksum, so nothing was installed.'
          : offline
            ? 'Could not reach PyPI to download the Python packages. Internet access is needed for this one step.'
            : 'Installing the Python packages failed. Prebuilt packages may not exist for this CPU or Python version.',
        pip.stderr.slice(-800));
    }
    writeJson(paths.runtimeMarker, {
      requirements: requirementsHash(), python: system.version, preparedAt: new Date().toISOString(),
    });
    log('Python runtime is ready.');
    return { python: py, installed: true };
  });
}
