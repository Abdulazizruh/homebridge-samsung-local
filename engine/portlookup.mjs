// Finds the secure (DTLS) port an appliance advertises in its public OCF
// directory on UDP 5683. Nothing is authenticated here: the port found is
// still verified by the secure handshake that follows.
//
// Appliances differ by generation, so this asks the way the Python engine
// does: first the small filtered directory (?rt=oic.r.doxm), then the full
// one, re-asking while silent, following answers split over several blocks,
// and reading both ways a port can be written ("eps" and "p.sec/port").
import dgram from 'node:dgram';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { encode, decode, pathOptions, queryOptions, blockValue, blockFields, Opt, CoapType, Code, ContentFormat } =
  require('./vendor/coap/message.js');
const { decodeCbor } = require('./vendor/ocf/cbor.js');

const OCF_PORT = 5683;
const RESEND_MS = 700;
const FILTERED_SHARE_MS = 1000;
const MAX_BLOCKS = 32;
const MAX_LINKS = 512;
const ACCEPT_CBOR = Buffer.from([ContentFormat.CBOR]);

function linksOf(value) {
  const containers = Array.isArray(value) ? value : [value];
  const links = [];
  for (const container of containers) {
    if (!container || typeof container !== 'object') {
      return [];
    }
    const candidates = Array.isArray(container.links) ? container.links : ('href' in container ? [container] : []);
    for (const link of candidates) {
      if (link && typeof link === 'object') {
        links.push(link);
      }
      if (links.length > MAX_LINKS) {
        return [];
      }
    }
  }
  return links;
}

function isDoxm(link) {
  const rt = Array.isArray(link.rt) ? link.rt : [link.rt];
  return link.href === '/oic/sec/doxm' || rt.includes('oic.r.doxm');
}

function validPort(port) {
  return Number.isInteger(port) && port > 0 && port < 65536;
}

/** Secure ports written in a directory answer, most trusted first. */
export function securePortsFrom(value, sourceHost = null) {
  const ports = [];
  const add = (port) => {
    if (validPort(port) && !ports.includes(port)) {
      ports.push(port);
    }
  };
  const policy = [];
  for (const link of linksOf(value)) {
    if (isDoxm(link) && link.p && typeof link.p === 'object' && link.p.sec === true) {
      policy.push(link.p.port);
    }
    for (const endpoint of Array.isArray(link.eps) ? link.eps.slice(0, 16) : []) {
      const match = typeof endpoint?.ep === 'string' && /^coaps:\/\/(\[[^\]]+\]|[^:/]+):(\d+)$/i.exec(endpoint.ep);
      // An endpoint naming another address is not ours to trust.
      if (match && (!sourceHost || match[1] === sourceHost)) {
        add(Number(match[2]));
      }
    }
  }
  policy.forEach(add);
  return ports;
}

/**
 * Ask an appliance for its secure port(s).
 * Resolves { ports, answered } and never rejects.
 */
export function lookupSecurePorts(host, { discoveryPort = OCF_PORT, timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const deadline = Date.now() + timeoutMs;
    const phases = [
      { query: ['rt=oic.r.doxm'], until: Date.now() + Math.min(FILTERED_SHARE_MS, timeoutMs / 2) },
      { query: [], until: deadline },
    ];
    let phase = -1;
    let token = null;
    let chunks = [];
    let nextBlock = 0;
    let szx = 6;
    let answered = false;
    let done = false;
    let resend = null;
    let phaseTimer = null;
    let mid = Math.floor(Math.random() * 0xffff);

    const finish = (ports) => {
      if (done) {
        return;
      }
      done = true;
      clearInterval(resend);
      clearTimeout(phaseTimer);
      // Closed a moment later so an acknowledgement just queued still leaves.
      setTimeout(() => { try { socket.close(); } catch { /* already closed */ } }, 20);
      resolve({ ports, answered });
    };

    const ask = () => {
      if (done) {
        return;
      }
      mid = (mid + 1) & 0xffff;
      const options = [...pathOptions(['oic', 'res']), ...queryOptions(phases[phase].query), { number: Opt.ACCEPT, value: ACCEPT_CBOR }];
      if (nextBlock > 0) {
        options.push({ number: Opt.BLOCK2, value: blockValue(nextBlock, false, szx) });
      }
      socket.send(encode({ type: CoapType.NON, code: Code.GET, messageId: mid, token, options }), discoveryPort, host, () => {});
    };

    const startPhase = () => {
      phase += 1;
      if (phase >= phases.length) {
        finish([]);
        return;
      }
      token = Buffer.from([0x0d, 0x15 + phase, Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]);
      chunks = [];
      nextBlock = 0;
      clearInterval(resend);
      clearTimeout(phaseTimer);
      ask();
      resend = setInterval(ask, RESEND_MS);
      phaseTimer = setTimeout(startPhase, Math.max(0, phases[phase].until - Date.now()));
    };

    socket.on('error', () => finish([]));
    socket.on('message', (datagram, rinfo) => {
      if (done || rinfo.address !== host) {
        return;
      }
      let message;
      try {
        message = decode(datagram);
      } catch {
        return;
      }
      if (message.type === CoapType.CON) {
        // A confirmable answer is repeated until acknowledged.
        socket.send(encode({ type: CoapType.ACK, code: 0, messageId: message.messageId, token: Buffer.alloc(0), options: [] }),
          rinfo.port, rinfo.address, () => {});
      }
      if (!token || !message.token?.equals(token)) {
        return;
      }
      answered = true;
      if (message.code >> 5 !== 2) {
        // Refused in this form (some firmwares decline the filtered question).
        startPhase();
        return;
      }
      const blockOption = message.options.find((option) => option.number === Opt.BLOCK2);
      const block = blockOption ? blockFields(blockOption.value) : { num: 0, more: false, szx };
      if (block.num !== nextBlock) {
        return; // a repeat of a block already held
      }
      chunks.push(message.payload ?? Buffer.alloc(0));
      if (block.more && chunks.length < MAX_BLOCKS) {
        szx = block.szx;
        nextBlock += 1;
        clearInterval(resend);
        ask();
        resend = setInterval(ask, RESEND_MS);
        return;
      }
      let ports = [];
      try {
        ports = securePortsFrom(decodeCbor(Buffer.concat(chunks)), host);
      } catch { /* unreadable answer */ }
      if (ports.length) {
        finish(ports);
      } else {
        startPhase();
      }
    });
    socket.bind(0, startPhase);
  });
}
