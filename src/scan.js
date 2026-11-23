/**
 * One look around the home network for appliances this plugin can work with.
 * It runs only when the owner asks for it on the settings page, never by
 * itself. It sends a few small questions to each address of the home network:
 * the public OCF question on UDP 5683 (air conditioners, washers, ...) and
 * the TV's own info page on TCP 8001. Nothing is opened, changed or stored;
 * reading an appliance's identity is a separate, later step.
 */
import dgram from 'node:dgram';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { tvInfo } from './tv/tizenClient.js';

const require = createRequire(import.meta.url);
const { encode, pathOptions, queryOptions, Opt, CoapType, Code, ContentFormat } = require('../engine/vendor/coap/message.js');

// The public OCF question, written the three ways appliances are known to
// accept: the form both engines use to find the secure port (reply format
// stated, with and without the filter), and the bare form.
const ACCEPT = { number: Opt.ACCEPT, value: Buffer.from([ContentFormat.CBOR]) };
const question = (query, accept, tag) => encode({
  type: CoapType.NON, code: Code.GET, messageId: 0x5300 + tag, token: Buffer.from([0x53, 0x4c, tag]),
  options: [...pathOptions(['oic', 'res']), ...queryOptions(query), ...(accept ? [ACCEPT] : [])],
});
const QUESTIONS = [question([], true, 1), question(['rt=oic.r.doxm'], true, 2), question([], false, 3)];
const OCF_GROUP = '224.0.1.187'; // "all OCF nodes": appliances answer it straight back to the asker
const ROUNDS = 3;
const ROUND_MS = 900;
// Networks made by container software on the same machine hold no appliances.
const VIRTUAL = /^(docker|br-|veth|cni|flannel|virbr|podman|lo)/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivate(ip) {
  const m = IPV4.exec(ip);
  if (!m) {
    return false;
  }
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** The /24 networks worth looking at: around this machine and around known appliances. */
export function scanNetworks(hints = [], interfaces = os.networkInterfaces()) {
  const own = Object.entries(interfaces).filter(([name]) => !VIRTUAL.test(name)).flatMap(([, list]) => list ?? [])
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  const bases = [];
  for (const ip of [...own, ...hints]) {
    if (isPrivate(ip)) {
      const base = ip.split('.').slice(0, 3).join('.');
      if (!bases.includes(base)) {
        bases.push(base);
      }
    }
  }
  return { bases: bases.slice(0, 4), own };
}

function hostsOf(bases, own) {
  const hosts = [];
  for (const base of bases) {
    for (let n = 1; n <= 254; n += 1) {
      const ip = `${base}.${n}`;
      if (!own.includes(ip)) {
        hosts.push(ip);
      }
    }
  }
  return hosts;
}

/**
 * Addresses that answer the OCF question. Asked up to three times, because a
 * Wi-Fi appliance often misses the first datagram, and once more to the OCF
 * group address of each network.
 */
function sweepOcf(hosts, { port, waitMs, own = [] }) {
  return new Promise((resolve) => {
    const answered = new Set();
    let socket;
    let done = false;
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch {
      resolve([]);
      return;
    }
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      try { socket.close(); } catch { /* already closed */ }
      resolve([...answered]);
    };
    const send = (packet, host) => {
      if (!done) {
        try { socket.send(packet, port, host, () => {}); } catch { /* socket closing */ }
      }
    };
    socket.on('error', finish);
    socket.on('message', (_msg, rinfo) => {
      if (!own.includes(rinfo.address)) {
        answered.add(rinfo.address);
      }
    });
    socket.bind(0, () => {
      let round = 0;
      const startRound = () => {
        round += 1;
        for (const address of own) {
          try { socket.setMulticastInterface(address); send(QUESTIONS[0], OCF_GROUP); } catch { /* no group traffic on this interface */ }
        }
        const left = hosts.filter((host) => !answered.has(host));
        // Sent in small groups, so the network is never flooded.
        let i = 0;
        const group = () => {
          if (done) {
            return;
          }
          for (const host of left.slice(i, i + 32)) {
            for (const packet of QUESTIONS) {
              send(packet, host);
            }
          }
          i += 32;
          if (i < left.length) {
            setTimeout(group, 25);
          } else if (round < ROUNDS) {
            setTimeout(startRound, ROUND_MS);
          } else {
            setTimeout(finish, waitMs);
          }
        };
        group();
      };
      startRound();
    });
  });
}

/** How many addresses of these networks the machine has just seen alive (its neighbour table). */
function aliveCount(bases, file = '/proc/net/arp') {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(1).map((line) => line.trim().split(/\s+/))
      .filter((f) => f.length >= 4 && f[2] !== '0x0' && f[3] !== '00:00:00:00:00:00' && bases.includes(f[0].split('.').slice(0, 3).join('.'))).length;
  } catch {
    return null; // not Linux, or not readable
  }
}

/** TVs that answer on their info page, a few addresses at a time. */
async function sweepTvs(hosts, { port, timeoutMs, concurrency }) {
  const found = [];
  let next = 0;
  const worker = async () => {
    while (next < hosts.length) {
      const host = hosts[next];
      next += 1;
      const info = await tvInfo(host, { httpPort: port, timeoutMs });
      if (info) {
        found.push({ host, ...info });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, worker));
  return found;
}

/**
 * Look around once. Resolves { networks, appliances: [ip], tvs: [{host, ...}] }.
 * `hosts` replaces the address list (tests).
 */
export async function scanNetwork({ hints = [], hosts = null, ocfPort = 5683, tvPort = 8001, waitMs = 1500, tvTimeoutMs = 1500, concurrency = 32 } = {}) {
  const { bases, own } = scanNetworks(hints);
  const list = hosts ?? hostsOf(bases, own);
  const [ocf, tvs] = await Promise.all([
    sweepOcf(list, { port: ocfPort, waitMs, own }),
    sweepTvs(list, { port: tvPort, timeoutMs: tvTimeoutMs, concurrency }),
  ]);
  const tvHosts = new Set(tvs.map((tv) => tv.host));
  const byAddress = (a, b) => a.split('.').map((x) => x.padStart(3, '0')).join('').localeCompare(b.split('.').map((x) => x.padStart(3, '0')).join(''));
  return {
    networks: bases.map((base) => `${base}.0/24`),
    // For the owner to judge an empty result: addresses asked, and how many of them are alive at all.
    asked: list.length,
    alive: aliveCount(bases),
    // A TV also answers the OCF question; it is listed once, as a TV.
    appliances: ocf.filter((ip) => !tvHosts.has(ip)).sort(byAddress),
    tvs: tvs.sort((a, b) => byAddress(a.host, b.host)),
  };
}

/** A TV's own name made safe for HomeKit: letters, digits, spaces and a few marks. */
export function tidyName(name, fallback = 'Samsung TV') {
  const clean = String(name ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N} '.,-]/gu, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return clean || fallback;
}
