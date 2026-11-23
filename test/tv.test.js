import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { WebSocketServer } from 'ws';
import { SamsungLocalPlatform } from '../src/platform.js';
import { PLATFORM_NAME } from '../src/settings.js';
import { pluginPaths, readJson } from '../src/storage.js';
import { TizenRemote, tvInfo } from '../src/tv/tizenClient.js';
import { makeApi, quietLog, tmpDir, waitFor } from './support.js';

/** A stand-in TV: the info page and the remote-control channel, without TLS. */
async function fakeTv({ power = 'on', allow = true } = {}) {
  const tv = { keys: [], texts: [], tokens: [], emits: [], moves: [], clicks: 0, power, allow, keyboardOpen: false };
  const web = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ device: { id: 'uuid:tv-test-1', name: 'Living Room TV', modelName: 'QA65TEST', wifiMac: 'aa:bb:cc:00:11:22', TokenAuthSupport: 'true', ...(tv.power ? { PowerState: tv.power } : {}) } }));
  });
  const wss = new WebSocketServer({ port: 0 });
  wss.on('connection', (socket, req) => {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    tv.tokens.push(token);
    if (!tv.allow) {
      socket.send(JSON.stringify({ event: 'ms.channel.unauthorized' }));
      return;
    }
    socket.send(JSON.stringify({ event: 'ms.channel.connect', data: token ? {} : { token: '12345678' } }));
    if (tv.keyboardOpen) { socket.send(JSON.stringify({ event: 'ms.remote.imeStart', data: 'x' })); }
    socket.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.method === 'ms.channel.emit') { tv.emits.push(msg.params.event); tv.texts.push('<announce>'); return; }
      if (msg.params.TypeOfRemote === 'ProcessMouseDevice') {
        if (msg.params.Cmd === 'Move') { tv.moves.push([msg.params.Position.x, msg.params.Position.y]); } else { tv.clicks += 1; }
        return;
      }
      if (msg.params.TypeOfRemote === 'SendInputString') {
        tv.texts.push(Buffer.from(msg.params.Cmd, 'base64').toString('utf8'));
        // A real TV says back what the field now holds.
        socket.send(JSON.stringify({ event: 'ms.remote.imeUpdate', data: msg.params.Cmd }));
        return;
      }
      if (msg.params.TypeOfRemote === 'SendInputEnd') {
        tv.texts.push('<end>');
        socket.send(JSON.stringify({ event: 'ms.remote.imeEnd' }));
        return;
      }
      tv.keys.push(msg.params.DataOfCmd);
      if (msg.params.DataOfCmd === 'KEY_POWER') { tv.power = tv.power === 'on' ? 'standby' : 'on'; }
    });
  });
  await new Promise((r) => { web.listen(0, '127.0.0.1', r); });
  tv.ports = { httpPort: web.address().port, wsPort: wss.address().port, secure: false };
  tv.say = (event) => { for (const c of wss.clients) { c.send(JSON.stringify({ event })); } };
  tv.close = () => { web.close(); for (const c of wss.clients) { c.terminate(); } wss.close(); };
  return tv;
}

test('TV: recognised by its info page; pairing yields a token that is reused', async (t) => {
  const tv = await fakeTv();
  t.after(tv.close);
  const info = await tvInfo('127.0.0.1', tv.ports);
  assert.deepEqual([info.id, info.model, info.mac, info.power, info.tokenAuth], ['tv-test-1', 'QA65TEST', 'aa:bb:cc:00:11:22', true, true]);
  assert.equal(await tvInfo('127.0.0.1', { httpPort: 1, timeoutMs: 300 }), null);

  let saved = null;
  const first = new TizenRemote({ host: '127.0.0.1', ...tv.ports, onToken: (x) => { saved = x; } });
  await first.key('KEY_MUTE');
  first.close();
  assert.equal(saved, '12345678');
  const second = new TizenRemote({ host: '127.0.0.1', ...tv.ports, token: saved });
  await second.key('KEY_VOLUP');
  second.close();
  await waitFor(() => tv.keys.length === 2);
  assert.deepEqual(tv.keys, ['KEY_MUTE', 'KEY_VOLUP']);
  assert.deepEqual(tv.tokens, [null, '12345678']);
});

test('TV: a refusal on the TV screen is reported as such', async (t) => {
  const tv = await fakeTv({ allow: false });
  t.after(tv.close);
  const remote = new TizenRemote({ host: '127.0.0.1', ...tv.ports });
  await assert.rejects(() => remote.key('KEY_MUTE'), { code: 'tv_denied' });
});

async function bootTv(tv, tvMode, storage = tmpDir(), extra = {}) {
  const api = makeApi(storage);
  const platform = new SamsungLocalPlatform(quietLog,
    { platform: PLATFORM_NAME, devices: [{ host: '127.0.0.1', id: 'tv-tv-test-1', type: 'tv', tvMode, name: 'Majlis TV', ...extra }] }, api,
    { tv: { ports: { ...tv.ports, screenPort: tv.screenPort ?? 1 }, pollMs: 60 }, appleRemote: { advertise: false }, createHelper: () => { throw new Error('a TV must not need the Python helper'); } });
  await platform.start();
  return { api, platform, storage };
}

test('TV as a tile: published on its own, power and remote keys reach the TV, token kept in the plugin folder', async (t) => {
  const tv = await fakeTv();
  const { api, platform, storage } = await bootTv(tv, 'tile');
  t.after(() => { platform.stop(); tv.close(); });
  assert.equal(api.external.length, 1);
  assert.equal(api.registered.length, 0);
  const handler = platform.tvs[0];
  const C = api.hap.Characteristic;
  const tile = handler.services.get('tv');
  await waitFor(() => tile.getCharacteristic(C.Active).value === 1);
  await tile.getCharacteristic(C.RemoteKey).handleSetRequest(C.RemoteKey.ARROW_UP);
  await handler.services.get('speaker').getCharacteristic(C.VolumeSelector).handleSetRequest(C.VolumeSelector.INCREMENT);
  await tile.getCharacteristic(C.Active).handleSetRequest(0);
  await waitFor(() => tv.keys.length === 3);
  assert.deepEqual(tv.keys, ['KEY_UP', 'KEY_VOLUP', 'KEY_POWER']);
  assert.equal(tile.getCharacteristic(C.Active).value, 0);
  assert.equal(readJson(pluginPaths(storage).tvTokens)['tv-tv-test-1'], '12345678');
});

test('TV as switches: inside the bridge, named after the TV, standby shown as off', async (t) => {
  const tv = await fakeTv({ power: 'standby' });
  const { api, platform } = await bootTv(tv, 'switches');
  t.after(() => { platform.stop(); tv.close(); });
  assert.equal(api.external.length, 0);
  assert.equal(api.registered.length, 1);
  const handler = platform.tvs[0];
  const C = api.hap.Characteristic;
  assert.equal(handler.services.get('power').getCharacteristic(C.ConfiguredName).value, 'Majlis TV');
  assert.equal(handler.services.get('volumeUp').getCharacteristic(C.ConfiguredName).value, 'Majlis TV Volume Up');
  await handler.poll();
  assert.equal(handler.services.get('power').getCharacteristic(C.On).value, false);
  // Standby still listens: switching on is a key press, not a wake-up packet.
  await handler.services.get('power').getCharacteristic(C.On).handleSetRequest(true);
  await waitFor(() => tv.keys.includes('KEY_POWER'));
});

test('TV tile follows the TV: switched with its own remote, the tile changes; the power toggle is never sent the wrong way', async (t) => {
  const tv = await fakeTv();
  const { api, platform } = await bootTv(tv, 'tile');
  t.after(() => { platform.stop(); tv.close(); });
  const handler = platform.tvs[0];
  const C = api.hap.Characteristic;
  const active = handler.services.get('tv').getCharacteristic(C.Active);
  await waitFor(() => active.value === 1);
  // Someone switches the TV off with its own remote.
  tv.power = 'standby';
  await handler.poll();
  assert.equal(active.value, 0);
  // The tile is stale (still "off") while the TV was switched on again at the set:
  // asking for "on" must not send the toggle, which would switch it off.
  tv.power = 'on';
  await active.handleSetRequest(1);
  assert.deepEqual(tv.keys, []);
  assert.equal(active.value, 1);
  // Switched off from Apple Home: one key press, and a TV that has not followed yet is not believed...
  await active.handleSetRequest(0);
  assert.equal(active.value, 0);
  await handler.poll(); // the key is still on its way: the TV says "on" and is not believed yet
  assert.equal(active.value, 0);
  await waitFor(() => tv.keys.length === 1);
  assert.deepEqual(tv.keys, ['KEY_POWER']);
  await handler.poll();
  assert.equal(active.value, 0);
  // ...but once it agrees the wait is over, and a later change by its remote shows at the next look.
  tv.power = 'standby';
  await handler.poll();
  tv.power = 'on';
  await handler.poll();
  assert.equal(active.value, 1);
});

test('TV in deep sleep: a TV that named its power state and then answers without one is off, also after a restart', async (t) => {
  const tv = await fakeTv();
  const first = await bootTv(tv, 'tile');
  const C = first.api.hap.Characteristic;
  const handler = first.platform.tvs[0];
  const active = handler.services.get('tv').getCharacteristic(C.Active);
  await waitFor(() => active.value === 1);
  tv.power = 'standby';
  await handler.poll();
  assert.equal(active.value, 0);
  tv.power = null; // still answers, but no longer says anything about power
  await handler.poll();
  assert.equal(active.value, 0);
  assert.equal(readJson(pluginPaths(first.storage).tvFacts)['tv-tv-test-1'].reportsPower, true);
  first.platform.stop();
  // The bridge restarts while the TV sleeps: it must not come back as "on".
  const second = await bootTv(tv, 'tile', first.storage);
  t.after(() => { second.platform.stop(); tv.close(); });
  const again = second.platform.tvs[0];
  await again.poll();
  assert.equal(again.services.get('tv').getCharacteristic(C.Active).value, 0);
  tv.power = 'on';
  await again.poll();
  assert.equal(again.services.get('tv').getCharacteristic(C.Active).value, 1);
});

test('TV that never names its power state: on while it answers', async (t) => {
  const tv = await fakeTv({ power: null });
  const { api, platform } = await bootTv(tv, 'tile');
  t.after(() => { platform.stop(); tv.close(); });
  const active = platform.tvs[0].services.get('tv').getCharacteristic(api.hap.Characteristic.Active);
  await waitFor(() => active.value === 1);
});

test('TV remote: the channel stays open between presses and is closed when the TV goes off', async (t) => {
  const tv = await fakeTv();
  const { api, platform } = await bootTv(tv, 'tile');
  t.after(() => { platform.stop(); tv.close(); });
  const handler = platform.tvs[0];
  const C = api.hap.Characteristic;
  const tile = handler.services.get('tv');
  await waitFor(() => tile.getCharacteristic(C.Active).value === 1);
  await tile.getCharacteristic(C.RemoteKey).handleSetRequest(C.RemoteKey.ARROW_UP);
  await new Promise((r) => { setTimeout(r, 150); });
  await tile.getCharacteristic(C.RemoteKey).handleSetRequest(C.RemoteKey.ARROW_DOWN);
  await waitFor(() => tv.keys.length === 2);
  assert.equal(tv.tokens.length, 1); // one connection served both presses
  assert.ok(handler.remote.idleMs >= 60_000);
  tv.power = 'standby';
  await handler.poll();
  assert.equal(handler.remote.socket, null);
});

test('TV keyboard: the TV says when its keyboard opens and closes, and a whole Arabic text reaches it', async (t) => {
  const tv = await fakeTv();
  tv.keyboardOpen = true;
  t.after(tv.close);
  const seen = [];
  const remote = new TizenRemote({ host: '127.0.0.1', ...tv.ports, token: 'abc', onKeyboard: (open) => seen.push(open) });
  t.after(() => remote.close());
  await remote.text('مكة 2026');
  await remote.text('مكة 2026', { done: true });
  const until = Date.now() + 2000;
  while (seen.length < 2 && Date.now() < until) { await new Promise((r) => setTimeout(r, 20)); }
  // The TV is told once that text is coming, then every text replaces the field.
  assert.deepEqual(tv.texts, ['<announce>', 'مكة 2026', 'مكة 2026', '<end>']);
  assert.deepEqual(tv.emits, ['custom.remote.textReceived']);
  assert.deepEqual(seen, [true, false]);
  assert.deepEqual(tv.keys, []);
  tv.say('ms.remote.imeStart'); // a second field: announced again
  while (seen.length < 3 && Date.now() < until) { await new Promise((r) => setTimeout(r, 20)); }
  await remote.text('a');
  await remote.text('ab');
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(tv.texts.slice(4), ['<announce>', 'a', 'ab']);
});

test('iPhone remote in pointer mode: finger movement moves the TV pointer, a tap clicks, and what the TV says back is never typed again', async (t) => {
  const tv = await fakeTv();
  const storage = tmpDir();
  const { platform } = await bootTv(tv, 'tile', storage, { appleRemote: true, appleRemoteTouch: 'pointer' });
  t.after(async () => { await platform.stop(); tv.close(); });
  const handler = platform.tvs[0];
  await waitFor(() => handler.phone && handler.on);
  assert.equal(handler.phone.touch, 'pointer');
  assert.equal(handler.phone.name, 'Majlis TV +', 'beside a TV tile the second name is marked');
  handler.phone.emit('sessions', 1);
  await waitFor(() => tv.tokens.length > 0);

  handler.phone.emit('click'); // no pointer on screen yet: the OK key
  await waitFor(() => tv.keys.length === 1);
  assert.deepEqual(tv.keys, ['KEY_ENTER']);
  handler.phone.emit('move', 10, 4); handler.phone.emit('move', 6, -1); // added up into one step
  await waitFor(() => tv.moves.length === 1);
  assert.deepEqual(tv.moves, [[16, 3]]);
  handler.phone.emit('click');
  await waitFor(() => tv.clicks === 1);
  assert.equal(tv.keys.length, 1);

  tv.say('ms.remote.imeStart');
  await waitFor(() => handler.phone.keyboardOpen);
  handler.phone.emit('text', 'H');
  await waitFor(() => tv.texts.includes('H'));
  await waitFor(() => handler.fieldLength === 1); // the TV said back what it holds
  assert.equal(handler.phone.text, ''); // and that never changes what is typed next
  handler.phone.emit('text', 'Hh');
  await waitFor(() => tv.texts.includes('Hh'));
  assert.deepEqual(tv.texts, ['<announce>', 'H', 'Hh']);
});

test('iPhone remote option: its keys and typed text reach the TV, the TV keyboard reaches the phone, and switching it off leaves no file', async (t) => {
  const tv = await fakeTv();
  const storage = tmpDir();
  const { platform } = await bootTv(tv, 'tile', storage, { appleRemote: true });
  t.after(() => tv.close());
  const handler = platform.tvs[0];
  await waitFor(() => handler.phone && handler.on);
  const file = pluginPaths(storage).appleRemote;
  assert.match(readJson(file)['tv-tv-test-1'].pin, /^\d{4}$/);

  handler.phone.emit('sessions', 1); // a remote was opened on an iPhone
  await waitFor(() => tv.tokens.length > 0);
  tv.say('ms.remote.imeStart');
  await waitFor(() => handler.phone.keyboardOpen);
  handler.phone.emit('key', 'KEY_DOWN');
  handler.phone.emit('text', 'مك');
  handler.phone.emit('text', 'مكة');
  await waitFor(() => tv.texts.includes('مكة') && tv.keys.length === 1);
  assert.deepEqual(tv.keys, ['KEY_DOWN']);
  assert.equal(tv.texts.at(-1), 'مكة');
  tv.say('ms.remote.imeEnd');
  await waitFor(() => !handler.phone.keyboardOpen);
  const before = tv.texts.length;
  handler.phone.emit('text', 'late'); // the field is closed: nothing goes to the TV
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(tv.texts.length, before);
  await platform.stop();

  const second = await bootTv(tv, 'tile', storage); // option off
  await second.platform.stop();
  assert.equal(readJson(file), null);
});

test('a TV that does not name its power state: once its screen service was seen, a closed one means off', async (t) => {
  const tv = await fakeTv({ power: null });
  const screen = net.createServer((socket) => socket.destroy());
  await new Promise((r) => screen.listen(0, '127.0.0.1', r));
  tv.screenPort = screen.address().port;
  const { api, platform, storage } = await bootTv(tv, 'tile');
  t.after(() => { platform.stop(); tv.close(); });
  const C = api.hap.Characteristic;
  const tile = platform.tvs[0].services.get('tv');
  await waitFor(() => tile.getCharacteristic(C.Active).value === 1 && readJson(pluginPaths(storage).tvFacts)?.['tv-tv-test-1']?.screenPortSeen);
  await new Promise((r) => screen.close(r)); // the screen goes dark; the TV still answers on the network
  await waitFor(() => tile.getCharacteristic(C.Active).value === 0);
  assert.equal(platform.tvs[0].reachable, true);
});

test('iPhone remote as the only remote: with switches instead of a tile it carries the plain TV name', async (t) => {
  const tv = await fakeTv();
  const { platform } = await bootTv(tv, 'switches', tmpDir(), { appleRemote: true });
  t.after(async () => { await platform.stop(); tv.close(); });
  await waitFor(() => platform.tvs[0].phone);
  assert.equal(platform.tvs[0].phone.name, 'Majlis TV');
});
