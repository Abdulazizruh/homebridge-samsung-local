/**
 * Lets the iPhone's own remote (Control Centre → Apple TV Remote) drive one
 * Samsung TV, keyboard included: the TV is announced on the home network as
 * an Apple TV, and what the remote sends is passed to the TV.
 *
 * Everything this feature keeps is in one file inside the plugin folder
 * (`apple-remote.json`). Switching the option off for a TV removes its part,
 * and the file goes when the last one is removed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import ciao from '@homebridge/ciao';
import { CompanionServer } from './server.js';

function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function save(file, data) {
  if (!Object.keys(data).length) {
    fs.rmSync(file, { force: true });
    return;
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Forget every TV that no longer has the option switched on. */
export function pruneAppleRemote(file, keepIds) {
  const data = load(file);
  const kept = Object.fromEntries(Object.entries(data).filter(([id]) => keepIds.includes(id)));
  if (Object.keys(kept).length !== Object.keys(data).length) { save(file, kept); }
}

/** The identity and pairing code of one TV's stand-in, made once and then kept. */
export function identityOf(file, tvId) {
  const data = load(file);
  if (!data[tvId]?.seed) {
    const mac = crypto.randomBytes(6);
    mac[0] = (mac[0] | 0x02) & 0xfe; // a locally administered address, never a real maker's
    data[tvId] = {
      id: crypto.randomUUID().toUpperCase(),
      seed: crypto.randomBytes(32).toString('hex'),
      irk: crypto.randomBytes(16).toString('hex'),
      mac: mac.toString('hex'),
      account: crypto.randomUUID().toUpperCase(),
      pin: String(crypto.randomInt(0, 10000)).padStart(4, '0'),
      port: 0,
      clients: {},
    };
    save(file, data);
  }
  return data[tvId];
}

function txt(identity, model) {
  const part = (field) => crypto.createHash('sha256').update(`samsung-local\0${field}\0${identity.id}`).digest().subarray(0, 6);
  const bt = part('rpBA');
  bt[0] = (bt[0] | 0x02) & 0xfe;
  return {
    rpMac: '1', rpHA: part('rpHA').toString('hex'), rpHN: part('rpHN').toString('hex'), rpVr: '715.2', rpMd: model,
    rpFl: '0x36782', rpAD: part('rpAD').toString('hex'), rpHI: part('rpHI').toString('hex'),
    rpBA: [...bt].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':'), rpMRtID: identity.id,
  };
}

let responder = null;

export class AppleRemote {
  constructor({ file, tvId, name, log, advertise = true, model = 'AppleTV14,1' }) {
    Object.assign(this, { file, tvId, name, log, advertise, model });
    this.server = null;
    this.service = null;
  }

  /** Start listening and announce the stand-in. Returns the server, to listen for what the remote sends. */
  async start() {
    const identity = identityOf(this.file, this.tvId);
    this.server = new CompanionServer({ name: this.name, identity, pin: identity.pin, clients: identity.clients, model: this.model, log: this.log });
    this.server.on('paired', (id, key) => {
      const data = load(this.file);
      if (data[this.tvId]) {
        data[this.tvId].clients = { ...data[this.tvId].clients, [id]: key };
        save(this.file, data);
      }
    });
    let port;
    try {
      port = await this.server.listen(identity.port || 0);
    } catch {
      port = await this.server.listen(0); // the remembered port was taken
    }
    if (port !== identity.port) {
      const data = load(this.file);
      if (data[this.tvId]) { data[this.tvId].port = port; save(this.file, data); }
    }
    if (this.advertise) {
      responder ??= ciao.getResponder();
      this.service = responder.createService({ name: this.name, type: 'companion-link', port, txt: txt(identity, this.model) });
      await this.service.advertise();
    }
    this.log.info(`[${this.name}] shown to the iPhone remote (Control Centre → Apple TV Remote). Pairing code: in the plugin settings, under this TV.`);
    return this.server;
  }

  async stop() {
    try { await this.service?.destroy(); } catch { /* already gone */ }
    this.service = null;
    await this.server?.close();
    this.server = null;
  }
}
