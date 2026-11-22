import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import test from 'node:test';
import { createRequire } from 'node:module';
import { lookupSecurePorts, securePortsFrom } from '../engine/portlookup.mjs';

const require = createRequire(import.meta.url);
const { encode, decode, blockValue, blockFields, Opt, CoapType, mkCode } = require('../engine/vendor/coap/message.js');
const { encodeCbor } = require('../engine/vendor/ocf/cbor.js');
const { CoapSession } = require('../engine/vendor/coap/session.js');

/** A plaintext directory that answers the way `behave` decides. */
async function directory(behave) {
  const socket = dgram.createSocket('udp4');
  const seen = [];
  socket.on('message', (datagram, rinfo) => {
    const message = decode(datagram);
    if (message.type === CoapType.ACK) { seen.push({ ack: message.messageId }); return; }
    const query = message.options.filter((o) => o.number === Opt.URI_QUERY).map((o) => o.value.toString());
    const blockOption = message.options.find((o) => o.number === Opt.BLOCK2);
    const request = { message, query, block: blockOption ? blockFields(blockOption.value).num : 0, count: seen.length };
    seen.push(request);
    const reply = behave(request);
    if (reply) {
      socket.send(encode({ type: CoapType.NON, messageId: 7, token: message.token, options: [], ...reply }), rinfo.port, rinfo.address);
    }
  });
  await new Promise((resolve) => socket.bind(0, '127.0.0.1', resolve));
  return { port: socket.address().port, seen, close: () => socket.close() };
}

const OK = mkCode(2, 5);

test('port lookup: reads the older "p.sec/port" form from the full directory, over two blocks', async (t) => {
  const links = [
    ...Array.from({ length: 12 }, (_, i) => ({ href: `/filler/${i}`, rt: ['x.com.samsung.da.filler'], if: ['oic.if.baseline'] })),
    { href: '/oic/sec/doxm', rt: ['oic.r.doxm'], p: { bm: 1, sec: true, port: 49155 } },
  ];
  const full = encodeCbor(links);
  assert.ok(full.length > 512 && full.length <= 1024);
  const dir = await directory(({ query, block }) => {
    if (query.length) { return null; } // silent on the filtered question
    const chunk = full.subarray(block * 512, block * 512 + 512);
    return { code: OK, options: [{ number: Opt.BLOCK2, value: blockValue(block, (block + 1) * 512 < full.length, 5) }], payload: Buffer.from(chunk) };
  });
  t.after(dir.close);
  const found = await lookupSecurePorts('127.0.0.1', { discoveryPort: dir.port, timeoutMs: 2500 });
  assert.deepEqual(found, { ports: [49155], answered: true });
});

test('port lookup: asks again when the first question is lost, and acknowledges a confirmable answer', async (t) => {
  const payload = encodeCbor([{ href: '/oic/sec/doxm', rt: ['oic.r.doxm'], eps: [{ ep: 'coaps://127.0.0.1:49153' }, { ep: 'coaps://10.9.9.9:1234' }] }]);
  const dir = await directory(({ count }) => (count === 0 ? null : { type: CoapType.CON, code: OK, payload }));
  t.after(dir.close);
  const found = await lookupSecurePorts('127.0.0.1', { discoveryPort: dir.port, timeoutMs: 2500 });
  assert.deepEqual(found.ports, [49153]);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(dir.seen.some((entry) => entry.ack === 7));
});

test('port lookup: a refusal of the filtered question moves on to the full directory; silence ends empty', async (t) => {
  const payload = encodeCbor([{ links: [{ href: '/oic/sec/doxm', rt: ['oic.r.doxm'], eps: [{ ep: 'coaps://127.0.0.1:49160' }] }] }]);
  const dir = await directory(({ query }) => (query.length ? { code: mkCode(4, 6) } : { code: OK, payload }));
  t.after(dir.close);
  assert.deepEqual((await lookupSecurePorts('127.0.0.1', { discoveryPort: dir.port, timeoutMs: 2500 })).ports, [49160]);
  const silent = await directory(() => null);
  t.after(silent.close);
  assert.deepEqual(await lookupSecurePorts('127.0.0.1', { discoveryPort: silent.port, timeoutMs: 600 }), { ports: [], answered: false });
  assert.deepEqual(securePortsFrom('nonsense'), []);
});

test('JavaScript engine: a command states the reply format it accepts, as the Python engine does', async () => {
  const sent = [];
  const link = { send: async (buf) => { sent.push(decode(buf)); }, onData: null };
  const session = new CoapSession(link, { rateLimitRps: 100, defaultTimeoutMs: 200 });
  session.post(['power', 'vs', '0'], encodeCbor({ 'x.com.samsung.da.power': 'On' })).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 50));
  const numbers = sent[0].options.map((o) => o.number);
  assert.deepEqual(numbers, [Opt.URI_PATH, Opt.URI_PATH, Opt.URI_PATH, Opt.CONTENT_FORMAT, Opt.ACCEPT]);
  assert.deepEqual([...sent[0].options.at(-1).value], [60]);
  session.close?.();
});
