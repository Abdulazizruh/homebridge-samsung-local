import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { HelperClient } from '../src/runtime/helperClient.js';
import { fixture, quietLog, root, tmpDir, waitFor } from './support.js';

const require = createRequire(import.meta.url);
const { SimAppliance } = require('./sim/appliance.js');
const { mintEcdsaServerCertificate } = require('../engine/vendor/auth/cert.js');
const { decodeCbor } = require('../engine/vendor/ocf/cbor.js');

const V = 'x.com.samsung.da.';

/** A simulated appliance speaking real DTLS and CoAP, fed from a capture. */
async function appliance(name) {
  const fx = fixture(name);
  const resources = { ...structuredClone(fx.resources), '/oic/d': { di: fx.identity.di, rt: fx.identity.types, n: 'sim' } };
  const device0 = [{ rt: ['oic.wk.col'] }, ...Object.entries(fx.resources).map(([href, rep]) => ({ href, rep }))];
  const sim = new SimAppliance({ resources, device0 });
  const { certPem, keyPem } = await mintEcdsaServerCertificate();
  await sim.start(certPem, keyPem);
  return { sim, di: fx.identity.di, resources };
}

function engine(credDir = tmpDir()) {
  const events = [];
  const helper = new HelperClient({
    command: process.execPath,
    args: [path.join(root, 'engine', 'bridge.mjs')],
    env: { SAMSUNG_LOCAL_CRED_DIR: credDir, SAMSUNG_LOCAL_NO_FIXED_PORT: '1' },
    restartDelaysMs: [],
    log: quietLog,
  });
  for (const ev of ['status', 'state', 'moved']) { helper.on(ev, (e) => events.push(e)); }
  return { helper, events, credDir };
}

test('JavaScript engine: real DTLS handshake, identity and resources from the appliance', async (t) => {
  const { sim, di } = await appliance('ac_windfree');
  const { helper } = engine();
  t.after(async () => { await helper.stop(); await sim.close(); });
  await helper.start();
  const hello = await helper.request('hello', {});
  assert.equal(hello.engine, 'javascript');
  const result = await helper.request('probe', { host: '127.0.0.1', port: sim.port }, 30_000);
  assert.equal(result.identity.di, di);
  assert.ok(result.identity.types.includes('oic.d.airconditioner'));
  assert.equal(result.readMode, 'batch');
  assert.equal(result.resources['/power/vs/0'][`${V}power`], fixture('ac_windfree').resources['/power/vs/0'][`${V}power`]);
});

test('JavaScript engine: session events, a write that reaches the appliance, and the certificate kept on disk', async (t) => {
  const { sim, di } = await appliance('ac_windfree');
  const { helper, events, credDir } = engine();
  t.after(async () => { await helper.stop(); await sim.close(); });
  await helper.start();
  await helper.request('open', { key: di, host: '127.0.0.1', port: sim.port, expectedDi: di, pollInterval: 2, push: true });
  await waitFor(() => events.some((e) => e.ev === 'status' && e.online), 20_000);
  await waitFor(() => events.some((e) => e.ev === 'state' && e.resources?.['/power/vs/0']), 20_000);
  // Push registrations are confirmed by the appliance and reported with the readings.
  await waitFor(() => events.some((e) => e.ev === 'state' && e.pushes > 0), 30_000);
  const answer = await helper.request('write', { key: di, path: ['power', 'vs', '0'], body: { [`${V}power`]: 'On' } }, 20_000);
  assert.equal(answer.accepted, true);
  assert.equal(sim.writes.length, 1);
  assert.equal(sim.writes[0].href, '/power/vs/0');
  assert.deepEqual(decodeCbor(sim.writes[0].payload), { [`${V}power`]: 'On' });
  const fs = await import('node:fs');
  assert.ok(fs.readFileSync(path.join(credDir, 'client.pem'), 'utf8').includes('BEGIN CERTIFICATE'));
  assert.equal(fs.statSync(path.join(credDir, 'client.key')).mode & 0o077, 0);
});

test('JavaScript engine: a different appliance at a known address is refused', async (t) => {
  const { sim } = await appliance('ac_windfree');
  const { helper, events } = engine();
  t.after(async () => { await helper.stop(); await sim.close(); });
  await helper.start();
  await helper.request('open', { key: 'k', host: '127.0.0.1', port: sim.port, expectedDi: 'someone-else', pollInterval: 2 });
  await waitFor(() => events.some((e) => e.ev === 'status' && e.online === false && e.error?.code === 'identity_mismatch'), 20_000);
});

test('engine choice: stable versions default to Python, the setting switches to JavaScript without touching Python', async () => {
  const { chosenEngine, DEFAULT_ENGINE, helperSpawn, JS_HELPER_SCRIPT } = await import('../src/runtime/engine.js');
  const { pluginPaths } = await import('../src/storage.js');
  const version = (await import('node:fs')).readFileSync(path.join(root, 'package.json'), 'utf8');
  assert.equal(DEFAULT_ENGINE, /"version": "[^"]*-(alpha|beta)/.test(version) ? 'javascript' : 'python');
  assert.equal(chosenEngine({ engine: 'javascript' }), 'javascript');
  assert.equal(chosenEngine({ engine: 'python' }), 'python');
  assert.equal(chosenEngine({ engine: 'nonsense' }), DEFAULT_ENGINE);
  const spawn = await helperSpawn(pluginPaths(tmpDir()), { engine: 'javascript' });
  assert.deepEqual([spawn.engine, spawn.command, spawn.args], ['javascript', process.execPath, [JS_HELPER_SCRIPT]]);
});

test('appliances starting together take turns for the handshake, two at a time', async () => {
  const { oneOfFewHandshakes } = await import('../engine/bridge.mjs');
  let running = 0; let most = 0;
  const work = () => oneOfFewHandshakes(async () => {
    running += 1; most = Math.max(most, running);
    await new Promise((r) => setTimeout(r, 30));
    running -= 1;
  });
  await Promise.all(Array.from({ length: 6 }, work));
  assert.equal(most, 2);
  assert.equal(running, 0);
});
