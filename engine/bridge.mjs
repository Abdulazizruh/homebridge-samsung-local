#!/usr/bin/env node
/**
 * JavaScript engine (beta): the same JSON-lines helper as python/bridge.py,
 * without Python. One line in, one line out:
 *
 *   request : {"id": 1, "op": "probe", "host": "192.0.2.10"}
 *   reply   : {"id": 1, "ok": true, "result": {...}} | {"id": 1, "ok": false, "error": {...}}
 *   event   : {"ev": "state" | "status" | "moved", "key": "<device key>", ...}
 *
 * The DTLS/CoAP transport in ./vendor comes from homebridge-samsung-ocf (MIT).
 * The certificate files are the ones the Python helper uses, so an appliance
 * sees the same client whichever engine is running.
 */
import dgram from 'node:dgram';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DtlsClientTransport } = require('./vendor/dtls/transport.js');
const { CoapSession } = require('./vendor/coap/session.js');
const { decodeCbor, encodeCbor } = require('./vendor/ocf/cbor.js');
const { discoverSecurePorts } = require('./vendor/ocf/portdiscovery.js');
const { mintClientCertificate, DEFAULT_CLIENT_UUID } = require('./vendor/auth/cert.js');

export const HELPER_VERSION = 'js-0.1.1';
const SUBSCRIBE_CONFIRM_MS = 3000;
const SEND_RATE_PER_S = 25;
const DISCOVERY_ROUNDS = [2500, 4000];
const FALLBACK_PORTS = [49152, 49153, 49154, 49155, 49156, 49157, 49158, 49159, 49160];
const MULTICAST_SECURE_PORT = 5684;
const LEGACY_HTTP_PORT = 8888;
const LOCAL_PORT_BASE = 61300;
const READ_TIMEOUT_MS = 10_000;
const WRITE_TIMEOUT_MS = 8000;
const CONNECT_TIMEOUT_MS = 12_000;
const BACKOFF_STEPS_S = [5, 10, 20, 40, 60];
const QUIET_RECONNECT_DELAY_MS = 2000;
const QUIET_RECONNECT_WAIT_MS = 12_000;
const READ_RETRIES = 2;
const READ_RETRY_PAUSE_MS = 1500;
const OFFLINE_GRACE_MS = 30_000;
const RELOCATE_AFTER_ROUNDS = 2;
const RELOCATE_MIN_INTERVAL_MS = 300_000;
const RELOCATE_MAX_CANDIDATES = 12;
const OCF_PORT = 5683;
const ARP_FILE = '/proc/net/arp';
const OBSERVE_HREFS = [
  '/power/vs/0', '/power/0', '/mode/vs/0', '/mode/convenient/vs/0', '/temperatures/vs/0',
  '/temperature/desired/0', '/wind/strength/vs/0', '/wind/direction/vs/0', '/operational/state/vs/0',
];
const OIC_RES_GET = Buffer.concat([Buffer.from([0x50, 0x01, 0x53, 0x4c, 0xb3]), Buffer.from('oic'), Buffer.from([0x03]), Buffer.from('res')]);
// Test seams: the simulated appliance listens on an unprivileged port.
const DISCOVERY_PORT = Number(process.env.SAMSUNG_LOCAL_DISCOVERY_PORT) || undefined;
const FIXED_LOCAL_PORT = process.env.SAMSUNG_LOCAL_NO_FIXED_PORT ? null : LOCAL_PORT_BASE;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const emit = (obj) => process.stdout.write(`${JSON.stringify(obj, (k, v) => (Buffer.isBuffer(v) || v instanceof Uint8Array ? { $bytes: Buffer.from(v).toString('hex') } : typeof v === 'bigint' ? Number(v) : v))}\n`);

class HelperError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

function classify(err) {
  if (err instanceof HelperError) {
    return { code: err.code, message: err.message, ...err.extra };
  }
  const text = String(err?.message ?? err).slice(0, 300);
  let code = 'connection';
  if (/timed? ?out/i.test(text)) {
    code = 'timeout';
  } else if (/4\.01|unauthori/i.test(text)) {
    code = 'auth_rejected';
  }
  return { code, message: text };
}

// ---------------------------------------------------------------- credentials

async function ensureCredentials(dir) {
  const certPath = path.join(dir, 'client.pem');
  const keyPath = path.join(dir, 'client.key');
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return { cert: fs.readFileSync(certPath, 'utf8'), key: fs.readFileSync(keyPath, 'utf8') };
  }
  // Generated on this machine and never sent anywhere.
  const uuid = (process.env.SAMSUNG_LOCAL_CLIENT_UUID || DEFAULT_CLIENT_UUID).trim().toLowerCase();
  const made = await mintClientCertificate(uuid);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(certPath, made.certPem, { mode: 0o600 });
  fs.writeFileSync(keyPath, made.keyPem, { mode: 0o600 });
  return { cert: made.certPem, key: made.keyPem };
}

// --------------------------------------------------------------------- network

function localSourcePort(host) {
  if (FIXED_LOCAL_PORT === null) {
    return 0;
  }
  const last = Number(String(host).split('.').pop());
  return FIXED_LOCAL_PORT + (Number.isInteger(last) ? last & 0xff : 0);
}

function legacyHttpOpen(host) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: LEGACY_HTTP_PORT, timeout: 2000 });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export function normalizeMac(text) {
  const hex = String(text ?? '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  return hex.length === 12 ? hex.match(/../g).join(':') : null;
}

export function parseArp(text) {
  const out = {};
  for (const line of String(text).split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    const mac = normalizeMac(cols[3]);
    if (cols.length >= 4 && mac && mac !== '00:00:00:00:00:00') {
      out[cols[0]] = mac;
    }
  }
  return out;
}

function arpTable() {
  try {
    return parseArp(fs.readFileSync(ARP_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function primaryIpv4() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) {
        return a.address;
      }
    }
  }
  return null;
}

const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

/** Ask every address of the home /24 networks who speaks OCF. */
async function sweep(hints, waitMs = 2000) {
  const bases = new Set();
  for (const ip of [...hints, primaryIpv4()]) {
    if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && isPrivate(ip)) {
      bases.add(ip.split('.').slice(0, 3).join('.'));
    }
  }
  const found = new Set();
  const socket = dgram.createSocket('udp4');
  await new Promise((resolve) => { socket.once('error', resolve); socket.bind(0, resolve); });
  socket.on('message', (msg, rinfo) => found.add(rinfo.address));
  socket.on('error', () => {});
  for (const base of [...bases].slice(0, 4)) {
    for (let i = 1; i < 255; i += 1) {
      socket.send(OIC_RES_GET, DISCOVERY_PORT ?? OCF_PORT, `${base}.${i}`, () => {});
    }
    await sleep(50);
  }
  await sleep(waitMs);
  socket.close();
  return [...found];
}

// ------------------------------------------------------------------------ link

function parseBatch(body) {
  const out = {};
  for (const entry of Array.isArray(body) ? body : []) {
    const href = entry?.href;
    const rep = entry?.rep;
    if (href && rep && typeof rep === 'object' && !Array.isArray(rep) && !(rep.rt ?? []).includes('oic.wk.col')) {
      out[href] = rep;
    }
  }
  return out;
}

function linksOf(body) {
  if (Array.isArray(body)) {
    return Array.isArray(body[0]?.links) ? body[0].links : body.filter((x) => x && typeof x === 'object');
  }
  return Array.isArray(body?.links) ? body.links : [];
}

const codeStr = (code) => `${code >> 5}.${String(code & 0x1f).padStart(2, '0')}`;
const segments = (href) => href.split('/').filter(Boolean);

/** One DTLS session to one appliance. */
class Link {
  constructor(host, port, cred, onNotification, connectMs = CONNECT_TIMEOUT_MS) {
    this.host = host;
    this.port = port;
    this.onNotification = onNotification;
    this.batchQuery = null;
    this.dead = null;
    this.transport = new DtlsClientTransport({
      host, port, cert: cred.cert, key: cred.key, connectTimeoutMs: connectMs, localPort: localSourcePort(host),
    });
    this.transport.onClose = () => { this.dead ??= new Error('session closed by the appliance'); this.onDead?.(); };
    this.transport.onError = (err) => { this.dead ??= err; this.onDead?.(); };
  }

  async connect() {
    await this.transport.connect();
    // The transport's default of five datagrams a second makes one full reading
    // take about two seconds and holds a command behind it. Registrations are
    // confirmed one by one, so a faster rate does not flood the appliance.
    this.session = new CoapSession(this.transport, { defaultTimeoutMs: READ_TIMEOUT_MS, rateLimitRps: SEND_RATE_PER_S });
  }

  close() {
    try { this.session?.close(); } catch { /* already closed */ }
    this.transport.close().catch(() => {});
  }

  async get(pathSegments, query = [], timeoutMs = READ_TIMEOUT_MS) {
    if (this.dead) {
      throw this.dead;
    }
    const res = await this.session.get(pathSegments, query, timeoutMs);
    let body = null;
    if (res.code >> 5 === 2 && res.payload?.length) {
      body = decodeCbor(res.payload);
    }
    return { code: res.code, body };
  }

  async post(pathSegments, body, timeoutMs = WRITE_TIMEOUT_MS) {
    if (this.dead) {
      throw this.dead;
    }
    const res = await this.session.post(pathSegments, encodeCbor(body), timeoutMs);
    let text = null;
    if (res.payload?.length) {
      try {
        const decoded = decodeCbor(res.payload);
        text = typeof decoded === 'string' ? decoded : null;
      } catch { /* no readable detail */ }
    }
    return { code: res.code, text };
  }

  /**
   * Ask the appliance to push changes of one resource. Appliances drop
   * requests that arrive in a burst, so each one waits for the appliance's
   * first answer and is sent once more when none comes.
   */
  async subscribe(href) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let confirmed = false;
      let confirm;
      const first = new Promise((resolve) => { confirm = resolve; });
      const cancel = await this.session.observe(segments(href), () => {
        if (!confirmed) {
          confirmed = true;
          confirm();
          return; // the first answer only confirms the registration
        }
        this.onNotification?.(href);
      });
      await Promise.race([first, sleep(SUBSCRIBE_CONFIRM_MS)]);
      if (confirmed || this.dead) {
        return confirmed;
      }
      cancel();
    }
    return false;
  }

  async readIdentity() {
    const ident = {};
    for (const [name, p] of [['d', ['oic', 'd']], ['p', ['oic', 'p']]]) {
      let res = { code: 0, body: null };
      try {
        res = await this.get(p, [], 6000);
      } catch { /* optional */ }
      if (res.code === 0x81) {
        throw new HelperError('auth_rejected', 'The appliance refused this certificate (4.01).');
      }
      ident[name] = res.body && typeof res.body === 'object' && !Array.isArray(res.body) ? res.body : {};
    }
    const { d, p } = ident;
    return {
      di: typeof d.di === 'string' ? d.di : null,
      pi: typeof p.pi === 'string' ? p.pi : null,
      name: d.n || '',
      manufacturer: p.mnmn || 'Samsung',
      platformModel: p.mnmo || '',
      types: (Array.isArray(d.rt) ? d.rt : []).filter((t) => typeof t === 'string'),
    };
  }

  /** All resources as {href: rep}: one batch read, per-resource as fallback. */
  async readResources() {
    let res;
    if (this.batchQuery === null) {
      res = await this.get(['device', '0']);
      if (res.code === 0x45 && Array.isArray(res.body?.links)) {
        res = await this.get(['device', '0'], ['if=oic.if.b']);
        if (res.code === 0x45 && Array.isArray(res.body)) {
          this.batchQuery = ['if=oic.if.b'];
        }
      } else if (res.code === 0x45) {
        this.batchQuery = [];
      }
    } else {
      res = await this.get(['device', '0'], this.batchQuery);
    }
    if (res.code === 0x45 && Array.isArray(res.body)) {
      return { resources: parseBatch(res.body), readMode: 'batch' };
    }
    if (res.code === 0x81) {
      throw new HelperError('auth_rejected', 'The appliance refused this certificate (4.01).');
    }
    if (res.code !== 0x84) {
      throw new HelperError('unexpected_response', `/device/0 answered ${codeStr(res.code)}`);
    }
    const list = await this.get(['oic', 'res']);
    const out = {};
    for (const link of linksOf(list.body).slice(0, 80)) {
      const href = link?.href;
      if (typeof href !== 'string' || href.startsWith('/oic/')) {
        continue;
      }
      try {
        const one = await this.get(segments(href), [], 6000);
        if (one.code === 0x45 && one.body && typeof one.body === 'object' && !Array.isArray(one.body)) {
          out[href] = one.body;
        }
      } catch { /* skip this resource */ }
    }
    if (!Object.keys(out).length) {
      throw new HelperError('no_resources', 'The appliance answered but exposed no readable resources.');
    }
    return { resources: out, readMode: 'per_href' };
  }
}

/** Connect, trying a known port first and discovering otherwise. */
async function openLink(host, port, cred, onNotification) {
  const tried = [];
  const details = { advertised: [], probe_outcome: null };
  let last = null;
  const attempt = async (candidate, connectMs) => {
    tried.push(candidate);
    const link = new Link(host, candidate, cred, onNotification, connectMs);
    try {
      await link.connect();
      return link;
    } catch (err) {
      last = err;
      link.close();
      return null;
    }
  };
  if (port) {
    const link = await attempt(port, CONNECT_TIMEOUT_MS);
    if (link) {
      return { link, details };
    }
  }
  // Some appliances answer the port question late or only on the second ask.
  let advertised = [];
  for (const timeoutMs of DISCOVERY_ROUNDS) {
    try {
      advertised = await discoverSecurePorts(host, { timeoutMs, ...(DISCOVERY_PORT ? { discoveryPort: DISCOVERY_PORT } : {}) });
    } catch { /* discovery is best effort */ }
    if (advertised.length) {
      break;
    }
  }
  details.advertised = advertised;
  details.plaintext_answered = advertised.length > 0;
  for (const candidate of advertised.filter((p) => p !== MULTICAST_SECURE_PORT && !tried.includes(p))) {
    const link = await attempt(candidate, CONNECT_TIMEOUT_MS);
    if (link) {
      details.probe_outcome = 'selected';
      return { link, details };
    }
  }
  if (!advertised.length && port) {
    // A known appliance that is silent for a moment: its port does not change
    // while it stays powered, so ask there again instead of walking every port.
    tried.length = 0;
    const link = await attempt(port, CONNECT_TIMEOUT_MS);
    if (link) {
      return { link, details };
    }
    const info = last ? classify(last) : { code: 'connection', message: 'handshake failed' };
    throw new HelperError(info.code === 'connection' ? 'timeout' : info.code,
      `The appliance did not answer on its usual port (${info.message}).`, { triedPorts: [port], details });
  }
  if (!advertised.length) {
    // Nothing advertised: knock briefly on the usual ports.
    for (const candidate of FALLBACK_PORTS.filter((p) => !tried.includes(p))) {
      const link = await attempt(candidate, 2500);
      if (link) {
        details.probe_outcome = 'fallback';
        return { link, details };
      }
    }
    if (await legacyHttpOpen(host)) {
      throw new HelperError('legacy_http', 'This appliance only offers the older TCP 8888 interface, which this plugin does not support yet.');
    }
    throw new HelperError('no_local_api',
      'No local DTLS endpoint answered at this address. Check the IP address, that the appliance is on, and that Homebridge uses host networking.',
      { details });
  }
  const info = last ? classify(last) : { code: 'connection', message: 'handshake failed' };
  throw new HelperError(info.code, info.message, { triedPorts: tried, details, diagnosis: { port: tried[0], outcome: 'rejected', alert: null } });
}

async function probe(host, credDir, port) {
  const cred = await ensureCredentials(credDir);
  const { link, details } = await openLink(host, port, cred, null);
  try {
    const identity = await link.readIdentity();
    const { resources, readMode } = await link.readResources();
    return { host, port: link.port, identity, resources, readMode, discovery: details, mac: arpTable()[host] ?? null };
  } finally {
    link.close();
  }
}

async function identityAt(host, credDir) {
  try {
    const cred = await ensureCredentials(credDir);
    const { link } = await openLink(host, null, cred, null);
    try {
      return (await link.readIdentity()).di;
    } finally {
      link.close();
    }
  } catch {
    return null;
  }
}

/** Where is the appliance with this identity or MAC address now? */
async function locate(credDir, { di = null, mac = null, hints = [], exclude = [] } = {}) {
  mac = normalizeMac(mac);
  const responders = await sweep(hints);
  const table = arpTable();
  if (mac) {
    const host = Object.keys(table).find((ip) => table[ip] === mac && !exclude.includes(ip));
    if (host && (!di || await identityAt(host, credDir) === di)) {
      return { host, mac };
    }
  }
  if (di) {
    for (const host of responders.filter((h) => !exclude.includes(h)).slice(0, RELOCATE_MAX_CANDIDATES)) {
      if (await identityAt(host, credDir) === di) {
        return { host, mac: table[host] ?? mac };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------- worker

class DeviceWorker {
  constructor({ key, host, port, credDir, expectedDi, pollInterval, push, mac, otherHosts }) {
    Object.assign(this, { key, host, port: port ?? null, credDir, expectedDi, push, otherHosts });
    this.mac = normalizeMac(mac);
    this.pollMs = Math.max(2, Number(pollInterval) || 15) * 1000;
    this.stopping = false;
    this.link = null;
    this.reconnecting = false;
    this.notifications = 0;
    this.lastRelocate = 0;
    this.wakeAt = null;
    this.wake = null;
    this.linkedWaiters = [];
    this.done = this.#run();
  }

  stop() {
    this.stopping = true;
    this.wake?.();
    this.link?.close();
    return this.done;
  }

  requestRefresh(delayMs = 0) {
    this.wakeAt = Date.now() + delayMs;
    this.wake?.();
  }

  async write(pathSegments, body) {
    if (this.reconnecting && !this.link) {
      await Promise.race([new Promise((r) => { this.linkedWaiters.push(r); }), sleep(QUIET_RECONNECT_WAIT_MS)]);
    }
    const link = this.link;
    if (!link) {
      throw new HelperError('offline', 'The appliance is not connected right now.');
    }
    const started = Date.now();
    const { code, text } = await link.post(pathSegments, body);
    this.requestRefresh(1500);
    return { code: codeStr(code), accepted: code >> 5 === 2, detail: text, ms: Date.now() - started };
  }

  /** Sleep that ends early on stop or on a refresh request. */
  #pause(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.wake = null; resolve(); }, ms);
      this.wake = () => { clearTimeout(timer); this.wake = null; resolve(); };
    });
  }

  async #run() {
    let failures = 0;
    let offlineRounds = 0;
    let wasOnline = false;
    let graceUntil = null;
    while (!this.stopping) {
      let link = null;
      let quiet = false;
      if (wasOnline) {
        graceUntil = Date.now() + OFFLINE_GRACE_MS;
      }
      wasOnline = false;
      try {
        const cred = await ensureCredentials(this.credDir);
        ({ link } = await openLink(this.host, this.port, cred, this.push ? () => { this.notifications += 1; this.requestRefresh(300); } : null));
        this.port = link.port;
        link.onDead = () => this.wake?.();
        const identity = await link.readIdentity();
        if (this.expectedDi && identity.di && identity.di !== this.expectedDi) {
          throw new HelperError('identity_mismatch',
            'A different appliance answered at this address. Update the IP address in the plugin settings.', { fatal: true });
        }
        const { resources } = await link.readResources();
        this.link = link;
        this.reconnecting = false;
        this.linkedWaiters.splice(0).forEach((r) => r());
        wasOnline = true;
        graceUntil = null;
        failures = 0;
        offlineRounds = 0;
        this.mac = arpTable()[this.host] ?? this.mac;
        emit({ ev: 'status', key: this.key, online: true, port: link.port, identity, host: this.host, mac: this.mac });
        emit({ ev: 'state', key: this.key, resources });
        if (this.push) {
          // In the background: polling starts at once, push joins when ready.
          this.subscriptions = 0;
          (async () => {
            for (const href of OBSERVE_HREFS) {
              if (href in resources && !this.stopping && !link.dead && this.link === link) {
                this.subscriptions += await link.subscribe(href).catch(() => false) ? 1 : 0; // push is optional
              }
            }
          })();
        }
        await this.#loop(link);
      } catch (err) {
        const info = classify(err);
        if (wasOnline) {
          graceUntil = Date.now() + OFFLINE_GRACE_MS;
          wasOnline = false;
        }
        quiet = graceUntil !== null && Date.now() < graceUntil && !info.fatal && !this.stopping;
        if (!quiet) {
          graceUntil = null;
          this.reconnecting = false;
          if (!this.stopping) {
            emit({ ev: 'status', key: this.key, online: false, error: info });
          }
          offlineRounds += 1;
        }
        if (info.fatal) {
          failures = BACKOFF_STEPS_S.length;
          offlineRounds = Math.max(offlineRounds, RELOCATE_AFTER_ROUNDS);
        }
      } finally {
        this.link = null;
        link?.close();
      }
      if (this.stopping) {
        break;
      }
      if (!quiet && offlineRounds >= RELOCATE_AFTER_ROUNDS && await this.#relocate()) {
        failures = 0;
        offlineRounds = 0;
        continue;
      }
      if (quiet) {
        this.reconnecting = true;
        await this.#pause(QUIET_RECONNECT_DELAY_MS);
        continue;
      }
      const step = BACKOFF_STEPS_S[Math.min(failures, BACKOFF_STEPS_S.length - 1)] * 1000;
      failures += 1;
      await this.#pause(step + Math.random() * step * 0.2);
    }
  }

  async #relocate() {
    if (!this.expectedDi || this.stopping || (this.lastRelocate && Date.now() - this.lastRelocate < RELOCATE_MIN_INTERVAL_MS)) {
      return false;
    }
    this.lastRelocate = Date.now();
    let found = null;
    try {
      found = await locate(this.credDir, {
        di: this.expectedDi, mac: this.mac, hints: [this.host],
        exclude: [...this.otherHosts().filter((h) => h !== this.host), this.host],
      });
    } catch { /* looking is best effort */ }
    if (!found) {
      return false;
    }
    const previous = this.host;
    this.host = found.host;
    this.port = null;
    this.mac = found.mac ?? this.mac;
    emit({ ev: 'moved', key: this.key, from: previous, host: this.host, mac: this.mac });
    return true;
  }

  /** One poll; a timeout is retried on the same session. */
  async #read(link) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return (await link.readResources()).resources;
      } catch (err) {
        if (attempt === READ_RETRIES || this.stopping || classify(err).code !== 'timeout') {
          throw err;
        }
        await sleep(READ_RETRY_PAUSE_MS);
      }
    }
  }

  async #loop(link) {
    let nextPoll = Date.now() + this.pollMs;
    while (!this.stopping) {
      if (link.dead) {
        throw link.dead;
      }
      const due = this.wakeAt === null ? nextPoll : Math.min(nextPoll, this.wakeAt);
      const now = Date.now();
      if (due > now) {
        await this.#pause(due - now);
        continue;
      }
      this.wakeAt = null;
      const resources = await this.#read(link);
      // Accepted registrations count too: a quiet appliance pushes nothing for hours.
      emit({ ev: 'state', key: this.key, resources, pushes: this.notifications + (this.subscriptions ?? 0) });
      nextPoll = Date.now() + this.pollMs;
    }
  }
}

// ---------------------------------------------------------------------- helper

class Helper {
  constructor(credDir) {
    this.credDir = credDir;
    this.workers = new Map();
  }

  async handle(req) {
    switch (req.op) {
      case 'hello':
        return { helper: HELPER_VERSION, node: process.version, engine: 'javascript' };
      case 'probe':
        return probe(String(req.host), this.credDir, req.port);
      case 'locate': {
        const found = await locate(this.credDir, { di: req.di, mac: req.mac, hints: req.hints ?? [], exclude: req.exclude ?? [] });
        if (!found) {
          throw new HelperError('not_found', 'No appliance with this address was found on the local network.');
        }
        return found;
      }
      case 'open': {
        const key = String(req.key);
        const old = this.workers.get(key);
        this.workers.delete(key);
        await old?.stop();
        this.workers.set(key, new DeviceWorker({
          key, host: String(req.host), port: req.port, credDir: this.credDir, expectedDi: req.expectedDi,
          pollInterval: req.pollInterval ?? 15, push: req.push !== false, mac: req.mac,
          otherHosts: () => [...this.workers.values()].map((w) => w.host),
        }));
        return { opened: key };
      }
      case 'close': {
        const worker = this.workers.get(String(req.key));
        this.workers.delete(String(req.key));
        await worker?.stop();
        return { closed: Boolean(worker) };
      }
      case 'write':
      case 'refresh': {
        const worker = this.workers.get(String(req.key));
        if (!worker) {
          throw new HelperError('unknown_device', 'No such device is open.');
        }
        if (req.op === 'refresh') {
          worker.requestRefresh(Number(req.delay ?? 0) * 1000);
          return { scheduled: true };
        }
        return worker.write(req.path, req.body);
      }
      default:
        throw new HelperError('bad_request', `unknown op ${JSON.stringify(req.op)}`);
    }
  }

  async shutdown() {
    const workers = [...this.workers.values()];
    this.workers.clear();
    await Promise.race([Promise.all(workers.map((w) => w.stop())), sleep(4000)]);
  }
}

async function main() {
  const credDir = process.env.SAMSUNG_LOCAL_CRED_DIR;
  if (!credDir) {
    process.stderr.write('SAMSUNG_LOCAL_CRED_DIR is required\n');
    process.exit(2);
  }
  // A stray transport error must never take every appliance down with it.
  process.on('uncaughtException', (err) => process.stderr.write(`engine: ${err?.stack ?? err}\n`));
  process.on('unhandledRejection', (err) => process.stderr.write(`engine: ${err?.stack ?? err}\n`));
  const helper = new Helper(credDir);
  emit({ ev: 'ready', helper: HELPER_VERSION });
  const lines = readline.createInterface({ input: process.stdin });
  const finish = async () => { await helper.shutdown(); process.exit(0); };
  lines.on('line', (line) => {
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      return;
    }
    if (req.op === 'shutdown') {
      finish();
      return;
    }
    helper.handle(req).then(
      (result) => emit({ id: req.id, ok: true, result }),
      (err) => emit({ id: req.id, ok: false, error: classify(err) }),
    );
  });
  lines.on('close', finish);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  main();
}
