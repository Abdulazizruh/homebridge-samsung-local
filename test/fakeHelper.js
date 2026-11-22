#!/usr/bin/env node
// A stand-in for python/bridge.py that speaks the same JSON-lines protocol and
// simulates appliances from fixtures. Used by the tests only.
//
// Extra ops for tests:  {"op":"sim","key"|"host",...,"action":"offline"|"online"|"remote"|"refuse"|"ignore"}
import fs from 'node:fs';
import readline from 'node:readline';

const V = 'x.com.samsung.da.';
const devices = new Map(); // host -> {identity, resources, reachable, refuse, ignore}
for (const spec of JSON.parse(process.env.FAKE_DEVICES ?? '[]')) {
  const fixture = JSON.parse(fs.readFileSync(spec.fixture, 'utf8'));
  devices.set(spec.host, {
    identity: { ...fixture.identity, ...(spec.di ? { di: spec.di } : {}) },
    resources: structuredClone(fixture.resources),
    reachable: spec.reachable !== false,
    refuse: false,
    ignore: false,
  });
}
const open = new Map(); // key -> {host, timer}
const log = process.env.FAKE_LOG;
const out = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);
const record = (entry) => { if (log) { fs.appendFileSync(log, `${JSON.stringify(entry)}\n`); } };

function applyWrite(dev, path, body) {
  const href = `/${path.join('/')}`;
  const rep = dev.resources[href] ?? (dev.resources[href] = {});
  if (href === '/power/vs/0') {
    rep[`${V}power`] = body[`${V}power`];
    if (dev.resources['/power/0']) { dev.resources['/power/0'].value = body[`${V}power`] === 'On'; }
  } else if (href === '/mode/vs/0') {
    if (body[`${V}modes`]) { rep[`${V}modes`] = body[`${V}modes`]; }
    for (const token of body[`${V}options`] ?? []) {
      const prefix = `${token.split('_')[0]}_`;
      const list = rep[`${V}options`] ?? (rep[`${V}options`] = []);
      const i = list.findIndex((x) => x.startsWith(prefix));
      if (i >= 0) { list[i] = token; } else { list.push(token); }
    }
  } else if (href === '/temperature/desired/0') {
    rep.temperature = body.temperature;
    const item = dev.resources['/temperatures/vs/0']?.[`${V}items`]?.[0];
    if (item) { item[`${V}desired`] = String(body.temperature); }
  } else if (href === '/temperatures/vs/0') {
    Object.assign(rep[`${V}items`][0], body[`${V}items`][0]);
  } else {
    Object.assign(rep, body);
  }
}

function connect(key) {
  const session = open.get(key);
  if (!session) { return; }
  clearInterval(session.timer);
  const dev = devices.get(session.host);
  if (!dev || !dev.reachable) {
    out({ ev: 'status', key, online: false, error: { code: 'no_local_api', message: 'no answer' } });
    return;
  }
  if (session.expectedDi && dev.identity.di !== session.expectedDi) {
    out({ ev: 'status', key, online: false, error: { code: 'identity_mismatch', message: 'different appliance', fatal: true } });
    return;
  }
  out({ ev: 'status', key, online: true, port: 49154, identity: dev.identity, host: session.host, mac: session.mac ?? null });
  out({ ev: 'state', key, resources: dev.resources });
  session.timer = setInterval(() => out({ ev: 'state', key, resources: dev.resources }), Number(process.env.FAKE_POLL_MS ?? 200));
}

function handle(req) {
  switch (req.op) {
    case 'hello': return { helper: 'fake', python: '0', library: '0' };
    case 'probe': {
      const dev = devices.get(req.host);
      if (!dev || !dev.reachable) {
        throw Object.assign(new Error('No local DTLS endpoint answered at this address.'), { code: 'no_local_api' });
      }
      return { host: req.host, port: 49154, identity: dev.identity, resources: dev.resources, readMode: 'batch', discovery: {} };
    }
    case 'open':
      clearInterval(open.get(req.key)?.timer);
      open.set(req.key, { host: req.host, expectedDi: req.expectedDi, timer: null });
      setImmediate(() => connect(req.key));
      return { opened: req.key };
    case 'close':
      clearInterval(open.get(req.key)?.timer);
      return { closed: open.delete(req.key) };
    case 'refresh': {
      const dev = devices.get(open.get(req.key)?.host);
      if (dev?.reachable) { setImmediate(() => out({ ev: 'state', key: req.key, resources: dev.resources })); }
      return { scheduled: true };
    }
    case 'write': {
      const dev = devices.get(open.get(req.key)?.host);
      if (!dev || !dev.reachable) { throw Object.assign(new Error('offline'), { code: 'offline' }); }
      record({ path: req.path, body: req.body });
      if (dev.refuse) { return { code: '4.05', accepted: false, detail: 'Control fail' }; }
      if (!dev.ignore) { applyWrite(dev, req.path, req.body); }
      setTimeout(() => out({ ev: 'state', key: req.key, resources: dev.resources }), 30);
      return { code: '2.04', accepted: true, detail: null };
    }
    case 'sim': {
      const host = req.host ?? open.get(req.key)?.host;
      const dev = devices.get(host);
      if (req.action === 'offline') { dev.reachable = false; }
      if (req.action === 'online') { dev.reachable = true; }
      if (req.action === 'refuse') { dev.refuse = Boolean(req.value); }
      if (req.action === 'ignore') { dev.ignore = Boolean(req.value); }
      if (req.action === 'remote') { applyWrite(dev, req.path, req.body); }
      if (req.action === 'move') { devices.set(req.to, dev); devices.delete(host); }
      for (const [key, session] of open) {
        // "follow" plays the real helper finding the appliance at its new address.
        if (req.action === 'move' && req.follow && session.host === host) {
          session.host = req.to;
          out({ ev: 'moved', key, from: host, host: req.to, mac: req.mac ?? null });
        }
        if (session.host === host || session.host === req.to) { connect(key); }
      }
      return { done: true };
    }
    default: throw Object.assign(new Error('bad op'), { code: 'bad_request' });
  }
}

out({ ev: 'ready', helper: 'fake' });
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  let req;
  try { req = JSON.parse(line); } catch { return; }
  if (req.op === 'shutdown') { process.exit(0); }
  try {
    out({ id: req.id, ok: true, result: handle(req) });
  } catch (err) {
    out({ id: req.id, ok: false, error: { code: err.code ?? 'error', message: err.message } });
  }
}).on('close', () => process.exit(0));
