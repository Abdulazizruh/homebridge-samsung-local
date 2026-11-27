import { EventEmitter } from 'node:events';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RETRY_REFUSED_MS = 600;

/** Has the appliance's state taken what this write asked for? Unknown shapes count as "no". */
export function writeApplied(resources, write) {
  const rep = resources?.[`/${write.path.join('/')}`];
  const body = write.body;
  if (!rep || typeof rep !== 'object' || !body || typeof body !== 'object') {
    return false;
  }
  const keys = Object.keys(body);
  return keys.length > 0 && keys.every((k) => {
    const want = body[k];
    const have = rep[k];
    if (have === undefined || have === null) {
      return false;
    }
    if (Array.isArray(want)) {
      return Array.isArray(have) && want.every((x) => have.some((y) => String(y) === String(x)));
    }
    if (typeof want === 'object' && want !== null) {
      return JSON.stringify(want) === JSON.stringify(have);
    }
    return String(have) === String(want);
  });
}

/** Raised when a command could not be delivered or was refused. */
export class CommandError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * One appliance as the rest of the plugin sees it: latest resources, whether
 * it is reachable, and an ordered command queue. Knows nothing about HomeKit
 * or about what the resources mean.
 *
 * Events: 'update' (resources), 'availability' (online, error?)
 */
export class DeviceLink extends EventEmitter {
  /** Both engines read the appliance 4 s after a write; that reading is the one waited for. */
  static refusedTiming = { freshAfterMs: 3800, giveUpMs: 7000 };

  constructor({ helper, key, host, port = null, mac = null, expectedDi = null, pollInterval = 5, push = true, follow = true, log }) {
    super();
    this.follow = follow;
    this.helper = null;
    this.key = key;
    this.host = host;
    this.port = port;
    this.mac = mac;
    this.expectedDi = expectedDi;
    this.pollInterval = pollInterval;
    this.push = push;
    this.log = log;
    this.resources = null;
    this.identity = null;
    this.online = false;
    this.lastError = null;
    this.lastSeen = null;
    this.closed = false;
    this.queue = Promise.resolve();
    this.queued = 0;

    this.onState = (msg) => {
      if (msg.key !== this.key || this.closed) {
        return;
      }
      this.resources = msg.resources;
      this.pushes = msg.pushes ?? this.pushes ?? 0;
      if (Number.isFinite(msg.readMs)) {
        // How long reading the appliance's state takes, over the last ten reads: the settings show it.
        this.readTimes = [...(this.readTimes ?? []), msg.readMs].slice(-10);
        this.readMs = Math.round(this.readTimes.reduce((a, b) => a + b, 0) / this.readTimes.length);
      }
      this.lastSeen = Date.now();
      this.#setOnline(true);
      this.emit('update', this.resources);
    };
    // The helper found the appliance at another address (same device id).
    this.onMoved = (msg) => {
      if (msg.key !== this.key || this.closed) {
        return;
      }
      this.#address(msg.host, msg.mac, msg.from ?? null);
    };
    this.onStatus = (msg) => {
      if (msg.key !== this.key || this.closed) {
        return;
      }
      if (msg.online) {
        this.port = msg.port ?? this.port;
        this.timing = msg.timing ?? null;
        this.identity = msg.identity ?? this.identity;
        this.#address(msg.host, msg.mac);
        this.#setOnline(true);
      } else {
        this.#setOnline(false, msg.error ?? null);
      }
    };
    this.onDown = () => this.#setOnline(false, { code: 'helper_down', message: 'helper stopped' });
    this.onRestarted = () => {
      this.open().catch(() => {});
    };
    if (helper) {
      this.attachHelper(helper);
    }
  }

  /** The helper may start after the accessory was restored from cache. */
  attachHelper(helper) {
    this.#detach();
    this.helper = helper;
    helper.on('state', this.onState);
    helper.on('status', this.onStatus);
    helper.on('moved', this.onMoved);
    helper.on('down', this.onDown);
    helper.on('restarted', this.onRestarted);
  }

  #detach() {
    if (!this.helper) {
      return;
    }
    this.helper.off('state', this.onState);
    this.helper.off('status', this.onStatus);
    this.helper.off('moved', this.onMoved);
    this.helper.off('down', this.onDown);
    this.helper.off('restarted', this.onRestarted);
  }

  #request(op, params, timeout) {
    if (!this.helper) {
      return Promise.reject(Object.assign(new Error('The helper process is not running.'), { code: 'helper_down' }));
    }
    return this.helper.request(op, params, timeout);
  }

  #setOnline(online, error = null) {
    const changed = online !== this.online || (error?.code ?? null) !== (this.lastError?.code ?? null);
    this.online = online;
    this.lastError = online ? null : error;
    if (changed) {
      this.emit('availability', online, error);
    }
  }

  /** Remember where the appliance is now; tell listeners when that changed. */
  #address(host, mac, from = null) {
    const changed = (host && host !== this.host) || (mac && mac !== this.mac);
    const previous = this.host;
    if (host && host !== this.host) {
      this.host = host;
      this.port = null;
    }
    this.mac = mac || this.mac;
    if (changed) {
      this.emit('address', { host: this.host, mac: this.mac, from: from ?? (previous !== this.host ? previous : null) });
    }
  }

  open() {
    return this.#request('open', {
      key: this.key,
      host: this.host,
      port: this.port,
      mac: this.mac,
      expectedDi: this.expectedDi,
      pollInterval: this.pollInterval,
      push: this.push,
      follow: this.follow,
    });
  }

  refresh(delaySeconds = 0) {
    return this.#request('refresh', { key: this.key, delay: delaySeconds }).catch(() => {});
  }

  /**
   * Send writes in order, one device-wide at a time. Resolves only after the
   * appliance acknowledged every write; rejects with CommandError otherwise.
   * Queue depth is capped so a stuck appliance is never flooded.
   */
  /** How long the appliance takes to acknowledge a command: the last twenty, averaged. */
  #timed(ms) {
    this.commandTimes = [...(this.commandTimes ?? []), ms].slice(-20);
    this.commandMs = Math.round(this.commandTimes.reduce((a, b) => a + b, 0) / this.commandTimes.length);
    this.emit('timing', this.commandMs);
  }

  /**
   * After a 4.00 answer: true once a reading shows the command was carried out.
   * False when the reading made after the write does not show it, or none came in time.
   */
  #carriedOut(write) {
    const { freshAfterMs, giveUpMs } = DeviceLink.refusedTiming;
    if (writeApplied(this.resources, write)) {
      return Promise.resolve(true);
    }
    const since = Date.now();
    return new Promise((resolve) => {
      const done = (value) => {
        clearTimeout(timer);
        this.off('update', onUpdate);
        resolve(value);
      };
      const onUpdate = (resources) => {
        if (writeApplied(resources, write)) {
          done(true);
        } else if (Date.now() - since >= freshAfterMs) {
          done(false); // read after the write, and the change is not there
        }
      };
      const timer = setTimeout(() => done(false), giveUpMs);
      this.on('update', onUpdate);
    });
  }

  send(writes) {
    if (!writes?.length) {
      return Promise.resolve();
    }
    if (!this.online) {
      return Promise.reject(new CommandError('offline', 'The appliance is not reachable.'));
    }
    if (this.queued >= 12) {
      return Promise.reject(new CommandError('busy', 'Too many commands are waiting for this appliance.'));
    }
    this.queued += 1;
    const job = this.queue.then(async () => {
      for (const write of writes) {
        let result;
        const started = Date.now();
        try {
          result = await this.#request('write', { key: this.key, path: write.path, body: write.body }, 15_000);
          if (!result.accepted && result.code === '4.00' && !write.once) {
            // Seen on a real air conditioner with both engines: a correct
            // command is now and then answered 4.00, and the unit may have
            // carried it out all the same (it beeps). Sending it again at once
            // made it beep twice, so the engine's own reading after a write is
            // awaited first; the command is sent once more only when that
            // reading does not show it. No extra question goes to the appliance.
            if (await this.#carriedOut(write)) {
              result = { ...result, accepted: true };
              this.emit('confirmed', write.path.join('/'));
            } else {
              await sleep(RETRY_REFUSED_MS);
              result = await this.#request('write', { key: this.key, path: write.path, body: write.body }, 15_000);
              this.emit('retried', write.path.join('/'), result.accepted);
            }
          }
          this.#timed(Date.now() - started);
        } catch (err) {
          throw new CommandError(err.code ?? 'error', err.message);
        }
        if (!result.accepted) {
          throw new CommandError('refused',
            `The appliance refused the command (${result.code}${result.detail ? `: ${result.detail}` : ''}).`);
        }
        if (write.settleMs) {
          await sleep(write.settleMs);
        }
      }
    });
    this.queue = job.catch(() => {}).finally(() => {
      this.queued -= 1;
    });
    return job;
  }

  async close() {
    this.closed = true;
    const helper = this.helper;
    this.#detach();
    if (helper?.running) {
      await helper.request('close', { key: this.key }, 12_000).catch(() => {});
    }
  }
}

const STAGES = {
  session: 'opening the secure session',
  identity: 'asking who it is',
  reading: 'the first reading',
  use: 'normal use',
};

/** Where a connection attempt stopped and after how long, for the "not reachable" line. */
export function failureText(error) {
  if (!error?.message) {
    return '';
  }
  const where = STAGES[error.stage];
  const after = Number.isFinite(error.afterMs) ? `, after ${(error.afterMs / 1000).toFixed(1)}s` : '';
  // The appliance's own refusal, when the engine heard one: protocol words only, never an address.
  const why = typeof error.why === 'string' && error.why ? `; the appliance said: ${error.why.replace(/[^\w ,-]/g, ' ').slice(0, 120)}` : '';
  return ` (${error.message}${where ? `; stopped at: ${where}${after}` : ''}${why})`;
}
