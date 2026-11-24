import net from 'node:net';
/**
 * Samsung TVs (Tizen, 2016 and later) over their own local remote-control
 * channel: an HTTP info page on 8001 and a WebSocket on 8002. The owner
 * approves the connection once on the TV screen; the TV then hands out a
 * token that is kept in this plugin's folder.
 *
 * Nothing here uses the Samsung cloud.
 */
import dgram from 'node:dgram';
import WebSocket from 'ws';

const APP_NAME = 'Homebridge Samsung Local';
const INFO_TIMEOUT_MS = 2500;

/** Whether something accepts a TCP connection there. */
export function portOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => { socket.destroy(); resolve(open); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** Device info from the TV, or null when no TV answers there. */
export async function tvInfo(host, { httpPort = 8001, timeoutMs = INFO_TIMEOUT_MS } = {}) {
  try {
    const res = await fetch(`http://${host}:${httpPort}/api/v2/`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    const d = body?.device;
    if (!d || typeof d !== 'object') {
      return null;
    }
    const mac = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(d.wifiMac ?? '') ? d.wifiMac.toLowerCase().replace(/-/g, ':') : null;
    return {
      id: String(d.id ?? d.duid ?? d.udn ?? '').replace(/^uuid:/, '') || null,
      name: d.name ?? body.name ?? null,
      model: d.modelName ?? d.model ?? null,
      mac,
      tokenAuth: String(d.TokenAuthSupport ?? '').toLowerCase() === 'true',
      // Recent models answer while in standby and say so; older ones simply stop answering.
      power: d.PowerState ? (String(d.PowerState).toLowerCase() === 'on') : true,
      // As the TV wrote it, for the log: null when the model does not report it.
      powerState: d.PowerState ? String(d.PowerState) : null,
    };
  } catch {
    return null;
  }
}

/** Wake-on-LAN: the only way to switch on a TV that is fully off. */
export function wake(mac, { address = '255.255.255.255', port = 9, repeat = 3 } = {}) {
  const bytes = Buffer.from(String(mac).replace(/[^0-9a-f]/gi, ''), 'hex');
  if (bytes.length !== 6) {
    return Promise.reject(Object.assign(new Error('No MAC address is known for this TV.'), { code: 'no_mac' }));
  }
  const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(bytes)]);
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.once('error', (err) => { socket.close(); reject(err); });
    socket.bind(() => {
      socket.setBroadcast(true);
      let left = repeat;
      const send = () => socket.send(packet, port, address, (err) => {
        left -= 1;
        if (err || left <= 0) {
          socket.close();
          return err ? reject(err) : resolve();
        }
        return setTimeout(send, 100);
      });
      send();
    });
  });
}

/**
 * One remote-control channel to a TV. Opened on demand and closed after a
 * short idle time, so the TV is not kept awake by an open connection.
 */
export class TizenRemote {
  constructor({ host, token = null, wsPort = 8002, secure = true, idleMs = 20_000, connectMs = 8000, onToken = null, onKeyboard = null, onFieldText = null }) {
    Object.assign(this, { host, token, wsPort, secure, idleMs, connectMs, onToken, onKeyboard, onFieldText });
    this.socket = null;
    this.opening = null;
    this.idleTimer = null;
  }

  #url() {
    const name = Buffer.from(APP_NAME).toString('base64');
    const token = this.token ? `&token=${encodeURIComponent(this.token)}` : '';
    return `${this.secure ? 'wss' : 'ws'}://${this.host}:${this.wsPort}/api/v2/channels/samsung.remote.control?name=${name}${token}`;
  }

  /**
   * Open the channel. Without a token the TV shows "Allow" on its screen and
   * `waitMs` is how long the owner has to answer it.
   */
  open(waitMs = this.connectMs) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    this.opening ??= new Promise((resolve, reject) => {
      // The TV presents its own self-signed certificate on the local network.
      const socket = new WebSocket(this.#url(), { rejectUnauthorized: false, handshakeTimeout: this.connectMs });
      const fail = (code, message) => {
        clearTimeout(timer);
        socket.removeAllListeners();
        socket.on('error', () => {});
        socket.terminate();
        reject(Object.assign(new Error(message), { code }));
      };
      const timer = setTimeout(() => fail('tv_timeout', 'The TV did not confirm the connection in time.'), waitMs);
      socket.on('error', (err) => fail('tv_unreachable', `The TV did not accept the connection (${err.code ?? err.message}).`));
      socket.on('close', () => fail('tv_closed', 'The TV closed the connection.'));
      socket.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(String(raw)); } catch { return; }
        // The TV says when its on-screen keyboard opens and closes. Only the
        // fact is passed on, never what is typed.
        if (msg.event === 'ms.remote.imeStart' || msg.event === 'ms.remote.imeEnd') {
          this.textAnnounced = false; // every keyboard session starts with the announcement again
          this.onKeyboard?.(msg.event === 'ms.remote.imeStart');
          return;
        }
        // The TV says what its field holds when the keyboard opens (as base64 text): a field
        // reopened with text in it. It is passed on to be the starting text, never to the log.
        if (msg.event === 'ms.remote.imeUpdate') {
          if (typeof msg.data === 'string' && msg.data.length <= 8192 && /^[A-Za-z0-9+/]*={0,2}$/.test(msg.data)) {
            this.onFieldText?.(Buffer.from(msg.data, 'base64').toString('utf8'));
          }
          return;
        }
        if (msg.event === 'ms.channel.connect') {
          clearTimeout(timer);
          const token = msg.data?.token;
          if (token && String(token) !== this.token) {
            this.token = String(token);
            this.onToken?.(this.token);
          }
          socket.removeAllListeners('close');
          socket.removeAllListeners('error');
          socket.on('error', () => {});
          socket.on('close', () => { if (this.socket === socket) { this.socket = null; this.onKeyboard?.(false); } });
          this.socket = socket;
          this.textAnnounced = false;
          resolve();
        } else if (msg.event === 'ms.channel.unauthorized') {
          fail('tv_denied', 'The TV refused the connection. Allow it on the TV screen, or remove the old entry under Settings → General → External Device Manager → Device Connection Manager.');
        } else if (msg.event === 'ms.channel.timeOut') {
          fail('tv_timeout', 'Nobody answered the request on the TV screen.');
        }
      });
    }).finally(() => { this.opening = null; });
    return this.opening;
  }

  async key(code) {
    await this.open();
    this.#touch();
    await this.#send({ Cmd: 'Click', DataOfCmd: code, Option: 'false', TypeOfRemote: 'SendRemoteKey' });
  }

  /**
   * Move the TV's pointer by a distance, as a mouse would. The command shape is the one
   * samsungtvws uses (its move_cursor). Where the TV shows no pointer, nothing happens.
   */
  async pointer(dx, dy) {
    await this.open();
    this.#touch();
    await this.#send({ Cmd: 'Move', Position: { x: Math.round(dx), y: Math.round(dy), Time: '0' }, TypeOfRemote: 'ProcessMouseDevice' });
  }

  /** While `held`, the channel stays open: the TV can only say "keyboard opened" to a listener. */
  #touch() {
    clearTimeout(this.idleTimer);
    if (this.held) {
      return;
    }
    this.idleTimer = setTimeout(() => this.close(), this.idleMs);
    this.idleTimer.unref?.();
  }

  hold(on) {
    this.held = Boolean(on);
    if (this.socket) {
      this.#touch();
    }
  }

  #send(params, method = 'ms.remote.control') {
    return new Promise((resolve, reject) => this.socket.send(JSON.stringify({ method, params }), (err) => (err ? reject(err) : resolve())));
  }

  /**
   * Put text into the field the TV's on-screen keyboard is open on. The whole
   * text is sent each time and replaces what the field holds; `done` then
   * closes the keyboard. Before the first text of a keyboard session the TV is
   * told that text is coming, as samsungtvws and atvr4samsung (both MIT) do:
   * without it some TVs add each text to the field instead of replacing it.
   */
  async text(value, { done = false } = {}) {
    await this.open();
    this.#touch();
    if (!this.textAnnounced) {
      await this.#send({ event: 'custom.remote.textReceived', to: 'broadcast' }, 'ms.channel.emit');
      this.textAnnounced = true;
    }
    await this.#send({ Cmd: Buffer.from(String(value), 'utf8').toString('base64'), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' });
    if (done) {
      await this.#send({ TypeOfRemote: 'SendInputEnd' });
    }
  }

  close() {
    clearTimeout(this.idleTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}
