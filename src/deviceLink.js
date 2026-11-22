import { EventEmitter } from 'node:events';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  constructor({ helper, key, host, port = null, mac = null, expectedDi = null, pollInterval = 15, push = true, log }) {
    super();
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
        try {
          result = await this.#request('write', { key: this.key, path: write.path, body: write.body }, 15_000);
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
