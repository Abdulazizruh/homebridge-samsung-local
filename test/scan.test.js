import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import http from 'node:http';
import test from 'node:test';
import { scanNetwork, scanNetworks, tidyName } from '../src/scan.js';

test('network scan: finds an appliance by the OCF question and a TV by its info page, each once', async (t) => {
  // An appliance: answers the OCF question.
  const appliance = dgram.createSocket('udp4');
  appliance.on('message', (msg, rinfo) => appliance.send(Buffer.from([0x50, 0x45, 0x53, 0x4c]), rinfo.port, rinfo.address));
  await new Promise((r) => appliance.bind(0, '127.0.0.1', r));
  // A TV: answers on its info page.
  const tv = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ device: { id: 'uuid:tv-9', name: '[TV] Samsung 7 Series (55)', modelName: 'QA55TEST', wifiMac: 'aa:bb:cc:00:11:22', TokenAuthSupport: 'true', PowerState: 'on' } }));
  });
  await new Promise((r) => tv.listen(0, '127.0.0.1', r));
  t.after(() => { appliance.close(); tv.close(); });

  const found = await scanNetwork({ hosts: ['127.0.0.1'], ocfPort: appliance.address().port, tvPort: tv.address().port, waitMs: 300 });
  // The same address answered both ways: it is a TV, listed once.
  assert.deepEqual(found.appliances, []);
  assert.equal(found.tvs.length, 1);
  assert.equal(found.tvs[0].model, 'QA55TEST');

  const onlyAppliance = await scanNetwork({ hosts: ['127.0.0.1'], ocfPort: appliance.address().port, tvPort: 1, waitMs: 300, tvTimeoutMs: 300 });
  assert.deepEqual(onlyAppliance, { networks: onlyAppliance.networks, appliances: ['127.0.0.1'], tvs: [] });
});

test('network scan: only private home networks, around this machine and known appliances', () => {
  const nets = scanNetworks(['192.168.5.20', '8.8.8.8', 'not-an-address'], {
    eth0: [{ family: 'IPv4', internal: false, address: '192.168.0.10' }],
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    wan: [{ family: 'IPv4', internal: false, address: '81.2.3.4' }],
  });
  assert.deepEqual(nets.bases, ['192.168.0', '192.168.5']);
});

test('a TV name is made safe for HomeKit', () => {
  assert.equal(tidyName('[TV] Samsung 7 Series (55)'), 'Samsung 7 Series 55');
  assert.equal(tidyName('  Living Room TV  '), 'Living Room TV');
  assert.equal(tidyName('[TV]'), 'Samsung TV');
});
