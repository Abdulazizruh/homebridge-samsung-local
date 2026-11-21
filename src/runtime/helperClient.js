import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import readline from 'node:readline';

/**
 * Owns the helper process: starts it, talks JSON lines to it, restarts it
 * with backoff if it dies, and makes sure it is gone when asked to stop.
 *
 * Events: 'state' {key, resources}, 'status' {key, online, ...},
 *         'restarted' (devices must be opened again), 'down' (helper exited)
 */
export class HelperClient extends EventEmitter {
  /**
   * @param {{command: string, args: string[], env?: object, log?: object, restartDelaysMs?: number[]}} options
   */
  constructor({ command, args, env = {}, log, restartDelaysMs = [2000, 5000, 15000, 30000, 60000] }) {
    super();
    this.command = command;
    this.args = args;
    this.env = env;
    this.log = log ?? { debug() {}, info() {}, warn() {}, error() {} };
    this.restartDelaysMs = restartDelaysMs;
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.stopped = false;
    this.restarts = 0;
    this.restartTimer = null;
    this.ready = null;
  }

  start() {
    this.stopped = false;
    return this.#spawn();
  }

  #spawn() {
    const child = spawn(this.command, this.args, {
      env: { ...process.env, ...this.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    let resolveReady;
    let rejectReady;
    this.ready = new Promise((res, rej) => {
      resolveReady = res;
      rejectReady = rej;
    });
    this.ready.catch(() => {});

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.ev === 'ready') {
        this.restarts = 0;
        resolveReady(msg);
      } else if (msg.ev) {
        this.emit(msg.ev, msg);
      } else if (this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        clearTimeout(timer);
        if (msg.ok) {
          resolve(msg.result);
        } else {
          reject(Object.assign(new Error(msg.error?.message ?? 'helper error'), msg.error ?? {}));
        }
      }
    });
    // stderr may hold Python tracebacks; never log it above debug level.
    readline.createInterface({ input: child.stderr }).on('line', (line) => this.log.debug(`[helper] ${line}`));
    child.stdin.on('error', () => {});

    const onGone = (reason) => {
      if (this.child !== child) {
        return;
      }
      this.child = null;
      rejectReady(new Error(`helper exited: ${reason}`));
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(Object.assign(new Error('The helper process stopped.'), { code: 'helper_down' }));
      }
      this.pending.clear();
      this.emit('down', reason);
      if (!this.stopped) {
        const delay = this.restartDelaysMs[Math.min(this.restarts, this.restartDelaysMs.length - 1)];
        this.restarts += 1;
        this.log.warn(`Helper process stopped (${reason}); restarting in ${Math.round(delay / 1000)}s.`);
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (!this.stopped) {
            this.#spawn().then(() => this.emit('restarted'), () => {});
          }
        }, delay);
      }
    };
    child.on('error', (err) => onGone(err.code ?? err.message));
    child.on('exit', (code, signal) => onGone(signal ?? `code ${code}`));
    return this.ready;
  }

  get running() {
    return this.child !== null;
  }

  request(op, params = {}, timeoutMs = 30_000) {
    if (!this.child) {
      return Promise.reject(Object.assign(new Error('The helper process is not running.'), { code: 'helper_down' }));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`Helper did not answer "${op}" in time.`), { code: 'timeout' }));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ id, op, ...params })}\n`);
    });
  }

  /** Stop for good: ask nicely, then make sure. Resolves once the process is gone. */
  async stop() {
    this.stopped = true;
    clearTimeout(this.restartTimer);
    const child = this.child;
    if (!child) {
      return;
    }
    const gone = new Promise((resolve) => child.once('exit', resolve));
    try {
      child.stdin.write('{"op":"shutdown"}\n');
      child.stdin.end();
    } catch { /* already closed */ }
    const wait = (ms) => Promise.race([gone.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))]);
    if (!(await wait(4000))) {
      child.kill('SIGTERM');
      if (!(await wait(2000))) {
        child.kill('SIGKILL');
        await wait(1000);
      }
    }
  }
}
