/**
 * One look around the home network for appliances this plugin can work with.
 * It runs only when the owner asks for it on the settings page, never by
 * itself. It sends one small question to each address of the home network:
 * the public OCF question on UDP 5683 (air conditioners, washers, ...) and
 * the TV's own info page on TCP 8001. Nothing is opened, changed or stored;
 * reading an appliance's identity is a separate, later step.
 */
import dgram from 'node:dgram';
import os from 'node:os';
import { tvInfo } from './tv/tizenClient.js';

// CoAP NON GET /oic/res: any OCF device answers it.
const OIC_RES_GET = Buffer.concat([Buffer.from([0x50, 0x01, 0x53, 0x4c, 0xb3]), Buffer.from('oic'), Buffer.from([0x03]), Buffer.from('res')]);
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
  const own = Object.values(interfaces).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
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

/** Addresses that answer the OCF question. */
function sweepOcf(hosts, { port, waitMs }) {
  return new Promise((resolve) => {
    const answered = new Set();
    let socket;
    try {
      socket = dgram.createSocket('udp4');
    } catch {
      resolve([]);
      return;
    }
    const finish = () => {
      try { socket.close(); } catch { /* already closed */ }
      resolve([...answered]);
    };
    socket.on('error', finish);
    socket.on('message', (_msg, rinfo) => answered.add(rinfo.address));
    socket.bind(0, () => {
      // Sent in small groups, so the network is never flooded.
      let i = 0;
      const group = () => {
        for (const host of hosts.slice(i, i + 32)) {
          socket.send(OIC_RES_GET, port, host, () => {});
        }
        i += 32;
        if (i < hosts.length) {
          setTimeout(group, 25);
        } else {
          setTimeout(finish, waitMs);
        }
      };
      group();
    });
  });
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
export async function scanNetwork({ hints = [], hosts = null, ocfPort = 5683, tvPort = 8001, waitMs = 2500, tvTimeoutMs = 1200, concurrency = 32 } = {}) {
  const { bases, own } = scanNetworks(hints);
  const list = hosts ?? hostsOf(bases, own);
  const [ocf, tvs] = await Promise.all([
    sweepOcf(list, { port: ocfPort, waitMs }),
    sweepTvs(list, { port: tvPort, timeoutMs: tvTimeoutMs, concurrency }),
  ]);
  const tvHosts = new Set(tvs.map((tv) => tv.host));
  const byAddress = (a, b) => a.split('.').map((x) => x.padStart(3, '0')).join('').localeCompare(b.split('.').map((x) => x.padStart(3, '0')).join(''));
  return {
    networks: bases.map((base) => `${base}.0/24`),
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
