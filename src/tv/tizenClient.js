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
  constructor({ host, token = null, wsPort = 8002, secure = true, idleMs = 20_000, connectMs = 8000, onToken = null }) {
    Object.assign(this, { host, token, wsPort, secure, idleMs, connectMs, onToken });
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
          socket.on('close', () => { if (this.socket === socket) { this.socket = null; } });
          this.socket = socket;
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
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.close(), this.idleMs);
    this.idleTimer.unref?.();
    const payload = { method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: code, Option: 'false', TypeOfRemote: 'SendRemoteKey' } };
    await new Promise((resolve, reject) => this.socket.send(JSON.stringify(payload), (err) => (err ? reject(err) : resolve())));
  }

  close() {
    clearTimeout(this.idleTimer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}
