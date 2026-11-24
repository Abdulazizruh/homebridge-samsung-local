import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import srp from 'fast-srp-hap';
import bplistCreator from 'bplist-creator';
import { pack, unpack } from '../src/appleRemote/opack.js';
import { Tlv, readTlv, writeTlv } from '../src/appleRemote/tlv8.js';
import { agreement, counterNonce, hkdf, open, seal, signer } from '../src/appleRemote/crypto.js';
import { AppleRemote, identityOf, pruneAppleRemote } from '../src/appleRemote/bridge.js';
import { applyEdit } from '../src/appleRemote/rti.js';
import { Swipes, Pointer } from '../src/appleRemote/gestures.js';

const { SRP, SrpClient } = srp;
const quiet = { info() {}, warn() {}, debug() {} };

/** A small stand-in for the iPhone side of the protocol. */
class Phone {
  constructor(port, same = null) {
    this.id = same?.id ?? crypto.randomUUID();
    this.signer = same?.signer ?? signer(crypto.randomBytes(32));
    this.inbox = []; this.waiters = []; this.buffer = Buffer.alloc(0);
    this.keys = null; this.n = { out: 0, in: 0 }; this.xid = 100;
    this.socket = net.connect(port, '127.0.0.1');
    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 4 && this.buffer.length >= 4 + this.buffer.readUIntBE(1, 3)) {
        const len = this.buffer.readUIntBE(1, 3);
        const header = this.buffer.subarray(0, 4); let body = this.buffer.subarray(4, 4 + len);
        this.buffer = this.buffer.subarray(4 + len);
        if (this.keys) { body = open(this.keys.in, counterNonce(this.n.in), body, header); this.n.in += 1; }
        const msg = unpack(body)[0];
        const w = this.waiters.shift();
        if (w) { w(msg); } else { this.inbox.push(msg); }
      }
    });
  }

  next() { return this.inbox.length ? Promise.resolve(this.inbox.shift()) : new Promise((r) => this.waiters.push(r)); }
  send(type, data) {
    let body = pack(data);
    const header = Buffer.alloc(4); header[0] = type; header.writeUIntBE(body.length + (this.keys ? 16 : 0), 1, 3);
    if (this.keys) { body = seal(this.keys.out, counterNonce(this.n.out), body, header); this.n.out += 1; }
    this.socket.write(Buffer.concat([header, body]));
  }

  async request(name, content = {}) {
    this.xid += 1;
    this.send(8, { _i: name, _x: this.xid, _t: 2, _c: content });
    for (;;) { const m = await this.next(); if (m._t === 3 && m._x === this.xid) { return m; } this.events.push(m); }
  }

  events = [];
  async event(name) {
    const at = this.events.findIndex((m) => m._i === name);
    if (at >= 0) { return this.events.splice(at, 1)[0]; }
    for (;;) { const m = await this.next(); if (m._i === name) { return m; } this.events.push(m); }
  }

  async pair(pin) {
    this.send(3, { _pd: writeTlv([[Tlv.Method, [0]], [Tlv.SeqNo, [1]]]), _pwTy: 1 });
    const m2 = readTlv((await this.next())._pd);
    const client = new SrpClient(SRP.params.hap, m2.get(Tlv.Salt), Buffer.from('Pair-Setup'), Buffer.from(pin), crypto.randomBytes(32));
    client.setB(m2.get(Tlv.PublicKey));
    this.send(4, { _pd: writeTlv([[Tlv.SeqNo, [3]], [Tlv.PublicKey, client.computeA()], [Tlv.Proof, client.computeM1()]]) });
    const m4 = readTlv((await this.next())._pd);
    if (m4.has(Tlv.Error)) { return false; }
    const K = client.computeK();
    const key = hkdf('Pair-Setup-Encrypt-Salt', 'Pair-Setup-Encrypt-Info', K);
    const x = hkdf('Pair-Setup-Controller-Sign-Salt', 'Pair-Setup-Controller-Sign-Info', K);
    const id = Buffer.from(this.id);
    const body = writeTlv([[Tlv.Identifier, id], [Tlv.PublicKey, this.signer.publicKey], [Tlv.Signature, this.signer.sign(Buffer.concat([x, id, this.signer.publicKey]))]]);
    this.send(4, { _pd: writeTlv([[Tlv.SeqNo, [5]], [Tlv.EncryptedData, seal(key, 'PS-Msg05', body)]]) });
    const m6 = readTlv((await this.next())._pd);
    return m6.has(Tlv.EncryptedData);
  }

  async verify() {
    const mine = agreement();
    this.send(5, { _pd: writeTlv([[Tlv.SeqNo, [1]], [Tlv.PublicKey, mine.publicKey]]) });
    const m2 = readTlv((await this.next())._pd);
    const shared = mine.shared(m2.get(Tlv.PublicKey));
    const key = hkdf('Pair-Verify-Encrypt-Salt', 'Pair-Verify-Encrypt-Info', shared);
    const id = Buffer.from(this.id);
    const body = writeTlv([[Tlv.Identifier, id], [Tlv.Signature, this.signer.sign(Buffer.concat([mine.publicKey, id, m2.get(Tlv.PublicKey)]))]]);
    this.send(6, { _pd: writeTlv([[Tlv.SeqNo, [3]], [Tlv.EncryptedData, seal(key, 'PV-Msg03', body)]]) });
    const m4 = readTlv((await this.next())._pd);
    if (m4.has(Tlv.Error)) { return false; }
    this.keys = { out: hkdf('', 'ClientEncrypt-main', shared), in: hkdf('', 'ServerEncrypt-main', shared) };
    return true;
  }

  typed({ insert = null, remove = 0, assert: all = null }) {
    const output = { ...(insert !== null ? { insertionText: insert } : {}), ...(remove ? { deletionCount: remove } : {}) };
    const archive = bplistCreator({ $top: { textOperations: { UID: 1 } }, $objects: ['$null', { keyboardOutput: { UID: 2 }, ...(all !== null ? { textToAssert: all } : {}) }, output] });
    this.send(8, { _i: '_tiC', _x: 9, _t: 1, _c: { _tiD: archive } });
  }
}

const until = async (check) => { const end = Date.now() + 3000; while (!check() && Date.now() < end) { await new Promise((r) => setTimeout(r, 15)); } };

test('iPhone remote: pairs with the code once, then buttons, swipes and typed text come through; the keyboard follows the TV', async (t) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-phone-')), 'apple-remote.json');
  const lines = [];
  const bridge = new AppleRemote({ file, tvId: 'tv-1', name: 'Bed TV +', log: { ...quiet, info: (m) => lines.push(m) }, advertise: false });
  const server = await bridge.start();
  t.after(() => bridge.stop());
  const seen = { keys: [], texts: [], power: [], sessions: [] };
  // The TV side reports back what became of each press; here the arrows reach it and Mute does not.
  server.on('key', (k, from) => { seen.keys.push(k); from.note('button', k === 'KEY_MUTE' ? 'off' : 'sent'); }); server.on('text', (x) => seen.texts.push(x));
  server.on('power', (p) => seen.power.push(p)); server.on('sessions', (n) => seen.sessions.push(n));
  const { pin, port } = JSON.parse(fs.readFileSync(file, 'utf8'))['tv-1'];
  assert.equal(pin, '0000', 'the default code');

  const stranger = new Phone(port);
  assert.equal(await stranger.pair(pin === '0000' ? '1111' : '0000'), false, 'a wrong code is refused');
  stranger.socket.destroy();

  const phone = new Phone(port);
  t.after(() => phone.socket.destroy());
  assert.equal(await phone.pair(pin), true);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))['tv-1'].clients).length, 1, 'the phone is remembered');
  phone.socket.destroy();

  const again = new Phone(port, phone); // a later connection proves itself with the stored keys, no code
  t.after(() => again.socket.destroy());
  assert.equal(await again.verify(), true);
  await again.request('_systemInfo', {});
  // The same request read one place off, as a real phone's other wording came out: its name under another field.
  again.send(8, { _btHP: false, _c: { model: 'iPhone' }, _t: 2, _x: 77, 'SOME-IDENTIFIER': '_systemInfo' });
  let named; for (;;) { named = await again.next(); if (named._t === 3 && named._x === 77) { break; } again.events.push(named); }
  assert.equal(named._i, undefined, 'an answer carries no request name');
  assert.equal(named._x, 77, 'answered as the request it is');
  assert.equal(named._c.model, 'AppleTV14,1');
  await again.request('TVRCSessionStart', {});
  assert.equal((await again.event('MediaControlStatus'))._c.MediaControlFlags, 0x100, 'volume buttons are offered');
  assert.equal((await again.request('_touchStart', { _width: 1000, _height: 1000 }))._c._i, 1);
  await again.request('_hidC', { _hidC: 1, _hBtS: 1 });
  await again.request('_hidC', { _hidC: 1, _hBtS: 2 });
  await again.request('_hidC', { _hidC: 18, _hBtS: 2 });
  await again.request('_hidC', { _hidC: 19, _hBtS: 2 });
  again.send(8, { _i: '_hidT', _x: 5, _t: 1, _c: { _tPh: 1, _cx: 200, _cy: 500 } });
  again.send(8, { _i: '_hidT', _x: 6, _t: 1, _c: { _tPh: 4, _cx: 700, _cy: 520 } });
  assert.deepEqual((await again.request('_tiStart', {}))._c, {}, 'no keyboard until the TV opens a field');

  server.setKeyboard(true);
  assert.ok(Buffer.isBuffer((await again.event('_tiStarted'))._c._tiD), 'the iPhone keyboard is opened');
  again.typed({ insert: 'مكه' }); again.typed({ remove: 1 }); again.typed({ insert: 'ة 2026' }); again.typed({ assert: 'المدينة' });
  await until(() => seen.texts.length === 4);
  server.setKeyboard(false);
  await again.event('_tiStopped');
  again.typed({ insert: 'late' }); // typed after the field closed: dropped
  await new Promise((r) => setTimeout(r, 80));
  server.setKeyboard(true);
  await again.event('_tiStarted');
  again.typed({ insert: 'مكة 2026' }); // a new field starts empty
  await until(() => seen.texts.length === 5);


  assert.deepEqual(seen.keys, ['KEY_UP', 'KEY_MUTE', 'KEY_RIGHT']);
  assert.deepEqual(seen.power, ['toggle']);
  assert.deepEqual(seen.texts, ['مكه', 'مك', 'مكة 2026', 'المدينة', 'مكة 2026']);
  assert.deepEqual(seen.sessions, [1]);

  // On closing, the remote says what became of its presses: counts only, no names or text.
  again.socket.destroy();
  await until(() => lines.some((m) => m.includes('closed after')));
  const closed = lines.find((m) => m.includes('closed after'));
  assert.match(closed, /4 button presses, 2 reached the TV, 1 not sent \(the TV was off and did not answer when asked\), 1 still on their way/);
  assert.doesNotMatch(closed, /KEY_|مك/);

  const unknown = new Phone(port); // never paired: refused without the code
  t.after(() => unknown.socket.destroy());
  assert.equal(await unknown.verify(), false);
});

test('iPhone remote: everything it keeps is one file, and switching the option off removes it', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-phone-')), 'apple-remote.json');
  const a = identityOf(file, 'tv-a'); identityOf(file, 'tv-b');
  assert.deepEqual(identityOf(file, 'tv-a'), a, 'the identity and the code stay the same across restarts');
  pruneAppleRemote(file, ['tv-b']);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))), ['tv-b']);
  pruneAppleRemote(file, []);
  assert.equal(fs.existsSync(file), false);
});

test('iPhone remote: edits count whole characters; a short touch is Select and a long one an arrow', () => {
  assert.equal(applyEdit('مرحبا 😀', { assert: null, insert: null, remove: 1 }), 'مرحبا ');
  const s = new Swipes();
  s.feed('press', 500, 500); assert.equal(s.feed('release', 510, 505), 'SELECT');
  s.feed('press', 500, 800); assert.equal(s.feed('release', 520, 300), 'UP');
  s.feed('press', 500, 500); assert.equal(s.feed('release', 650, 640), null, 'a diagonal is no clear direction');
});

test('touch area as a pointer: the finger\'s way becomes the pointer\'s way, at a steady pace, and nothing is lost', () => {
  let clock = 0;
  const p = new Pointer(() => clock);
  const moves = [];
  const feed = (phase, x, y) => { const m = p.feed(phase, x, y); if (m) { moves.push(m); } };
  feed('press', 100, 500);
  for (let x = 110; x <= 300; x += 10) { clock += 8; feed('hold', x, 500); } // reports arrive faster than the TV is told
  clock += 8; feed('release', 300, 500);
  const total = moves.reduce((sum, m) => sum + m.dx, 0);
  assert.equal(total, 320, 'the whole slide, scaled, reaches the TV');
  assert.ok(moves.length < 12, 'gathered, not one command per report');
  assert.ok(moves.every((m) => m.dy === 0));
  // A very slow movement is kept until it adds up to a whole unit.
  const slow = new Pointer(() => (clock += 40));
  slow.feed('press', 0, 0);
  assert.equal(slow.feed('hold', 0.3, 0), null);
  assert.deepEqual(slow.feed('hold', 0.7, 0), { dx: 1, dy: 0 });
  // A tap moves nothing.
  const tap = new Pointer(() => (clock += 40));
  tap.feed('press', 500, 500);
  assert.equal(tap.feed('release', 500, 500), null);
});

test('touch area like an Apple TV: a long slide moves several steps, a flick one, a tap selects', () => {
  const s = new Swipes();
  const out = [];
  s.feed('press', 100, 500);
  for (let x = 120; x <= 700; x += 20) { const d = s.feed('hold', x, 505); if (d) { out.push(d); } }
  const end = s.feed('release', 700, 505); if (end) { out.push(end); }
  assert.deepEqual(out, ['RIGHT', 'RIGHT', 'RIGHT'], 'one step for every stretch of the slide');
  s.feed('press', 500, 500); s.feed('hold', 500, 420);
  assert.equal(s.feed('release', 500, 370), 'UP', 'a short flick is one step');
  s.feed('press', 500, 500);
  assert.equal(s.feed('release', 504, 498), 'SELECT');
  s.feed('press', 500, 500); s.feed('hold', 560, 500); s.feed('hold', 500, 500);
  assert.equal(s.feed('release', 500, 500), null, 'a finger that wandered and came back is no tap');
});

test('pairing code: 0000 unless the owner chose four digits, and changing it keeps the phones already paired', async () => {
  const { identityOf, pinOf } = await import('../src/appleRemote/bridge.js');
  assert.equal(pinOf(undefined), '0000');
  assert.equal(pinOf('12'), '0000');
  assert.equal(pinOf('4821'), '4821');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-pin-')), 'apple-remote.json');
  const first = identityOf(file, 'tv-1');
  assert.equal(first.pin, '0000');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data['tv-1'].clients = { phone: 'aa' };
  fs.writeFileSync(file, JSON.stringify(data));
  const second = identityOf(file, 'tv-1', '4821');
  assert.equal(second.pin, '4821');
  assert.equal(second.seed, first.seed);
  assert.deepEqual(second.clients, { phone: 'aa' });
});

test('a real iPhone says the whole text after every change: the field follows it, in the sequences its log showed', async () => {
  const { Typing } = await import('../src/appleRemote/rti.js');
  const typing = new Typing();
  let field = ''; let phone = ''; // `phone`: the text as the phone itself has it
  const edit = (e) => { field = typing.apply(field, { assert: null, insert: null, remove: 0, keyboard: false, ...e }).text; };
  const key = (letter) => { phone += letter; edit({ insert: letter, keyboard: true }); edit({ insert: phone }); };
  const back = () => { phone = phone.slice(0, -1); edit({ remove: 1, keyboard: true }); edit({ insert: phone }); };
  for (const letter of 'هلا book') { key(letter); } // letters, a space, a real double letter
  assert.equal(field, 'هلا book');
  back(); back();
  assert.equal(field, 'هلا bo');
  edit({ keyboard: true }); phone = 'هلا book '; edit({ insert: phone }); // a suggestion was accepted: only the picture says what changed
  assert.equal(field, 'هلا book ');
  phone = `X${phone}`; edit({ insert: 'X', keyboard: true }); edit({ insert: phone }); // typed with the cursor at the start
  assert.equal(field, 'Xهلا book ');
  edit({ remove: 1, keyboard: true }); // a deletion the phone says nothing after: applied as it is
  assert.equal(field, 'Xهلا book');
  edit({ assert: 'Hello', keyboard: true });
  assert.equal(field, 'Hello');

  const old = new Typing(); // a phone that never sends keyboard state: every insertion is typing
  field = '';
  for (const part of ['a', 'a', 'ab']) { field = old.apply(field, { assert: null, insert: part, remove: 0, keyboard: false }).text; }
  assert.equal(field, 'aaab');
});

test('pairing code: 0000 unless the owner chose four digits, and changing it keeps the phones already paired', async () => {
  const { identityOf, pinOf } = await import('../src/appleRemote/bridge.js');
  assert.equal(pinOf(undefined), '0000');
  assert.equal(pinOf('12'), '0000');
  assert.equal(pinOf('4821'), '4821');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-pin-')), 'apple-remote.json');
  const first = identityOf(file, 'tv-1');
  assert.equal(first.pin, '0000');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data['tv-1'].clients = { phone: 'aa' };
  fs.writeFileSync(file, JSON.stringify(data));
  const second = identityOf(file, 'tv-1', '4821');
  assert.equal(second.pin, '4821');
  assert.equal(second.seed, first.seed);
  assert.deepEqual(second.clients, { phone: 'aa' });
});

test('pairing code: 0000 unless the owner chose four digits, and changing it keeps the phones already paired', async () => {
  const { identityOf, pinOf } = await import('../src/appleRemote/bridge.js');
  assert.equal(pinOf(undefined), '0000');
  assert.equal(pinOf('12'), '0000');
  assert.equal(pinOf('4821'), '4821');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-pin-')), 'apple-remote.json');
  const first = identityOf(file, 'tv-1');
  assert.equal(first.pin, '0000');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data['tv-1'].clients = { phone: 'aa' };
  fs.writeFileSync(file, JSON.stringify(data));
  const second = identityOf(file, 'tv-1', '4821');
  assert.equal(second.pin, '4821');
  assert.equal(second.seed, first.seed);
  assert.deepEqual(second.clients, { phone: 'aa' });
});


test('OPACK: minus one, as Apple writes it, is read rather than refused', async () => {
  const { unpack } = await import('../src/appleRemote/opack.js');
  assert.deepEqual(unpack(Buffer.from([0xe1, 0x41, 0x61, 0x07]))[0], { a: -1 });
});

test('OPACK: a pointer past a list is read as the sender numbered it', async () => {
  const { unpack } = await import('../src/appleRemote/opack.js');
  const s = (t) => Buffer.concat([Buffer.from([0x40 + t.length]), Buffer.from(t)]);
  // { _c: { l: ["xy"] }, _i: "_systemInfo", k: <pointer 5> }, numbered as a phone does:
  // "_c"=0, "l"=1, "xy"=2, the list=3, the inner dictionary=4, "_i"=5, "_systemInfo"=6.
  const inner = Buffer.concat([Buffer.from([0xe1]), s('l'), Buffer.from([0xd1]), s('xy')]);
  const message = Buffer.concat([Buffer.from([0xe3]), s('_c'), inner, s('_i'), s('_systemInfo'), s('k'), Buffer.from([0xa5])]);
  assert.deepEqual(unpack(message)[0], { _c: { l: ['xy'] }, _i: '_systemInfo', k: '_i' });
  // An empty text takes one byte and gets no number, so the same pointer still finds "_i".
  const emptyFirst = Buffer.concat([Buffer.from([0xe4]), s('_c'), inner, s('_i'), s('_systemInfo'), s('k'), Buffer.from([0xa5]), s('e'), Buffer.from([0x40])]);
  assert.equal(unpack(emptyFirst)[0].k, '_i');
});

test('a remote that has asked for its session is not cut by a second connection of the same phone', async (t) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-phone-')), 'apple-remote.json');
  const bridge = new AppleRemote({ file, tvId: 'tv-1', name: 'Bed TV', log: quiet, advertise: false });
  const server = await bridge.start();
  t.after(() => bridge.stop());
  const keys = []; server.on('key', (k) => keys.push(k));
  const { pin, port } = JSON.parse(fs.readFileSync(file, 'utf8'))['tv-1'];
  const paired = new Phone(port);
  assert.equal(await paired.pair(pin), true);
  paired.socket.destroy();

  const first = new Phone(port, paired);
  t.after(() => first.socket.destroy());
  assert.equal(await first.verify(), true);
  await first.request('_systemInfo', {});
  await first.request('_sessionStart', { _srvT: 'com.apple.tvremoteservices', _sid: 7 });

  // The same phone connects once more before the first has opened its remote.
  const second = new Phone(port, paired);
  t.after(() => second.socket.destroy());
  assert.equal(await second.verify(), true);

  await first.request('TVRCSessionStart', {}); // the first is still there and opens
  await first.request('_hidC', { _hidC: 1, _hBtS: 1 });
  await first.request('_hidC', { _hidC: 1, _hBtS: 2 });
  assert.deepEqual(keys, ['KEY_UP']);
});
