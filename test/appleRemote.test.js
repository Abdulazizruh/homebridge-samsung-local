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
import { Swipes } from '../src/appleRemote/gestures.js';

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
  const bridge = new AppleRemote({ file, tvId: 'tv-1', name: 'Bed TV +', log: quiet, advertise: false });
  const server = await bridge.start();
  t.after(() => bridge.stop());
  const seen = { keys: [], texts: [], power: [], sessions: [] };
  server.on('key', (k) => seen.keys.push(k)); server.on('text', (x) => seen.texts.push(x));
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

test('a real iPhone follows each keystroke with a message that is not typing: it is left out by what it is, in the sequences its log showed', async () => {
  const { Echoes } = await import('../src/appleRemote/rti.js');
  const echoes = new Echoes();
  let field = ''; let said = ''; // `said`: everything inserted since the keyboard opened, as the phone repeats it
  const edit = (e) => { const full = { assert: null, insert: null, remove: 0, keyboard: false, ...e }; if (!echoes.isEcho(full)) { field = applyEdit(field, full); } };
  const key = (letter) => { said += letter; edit({ insert: letter, keyboard: true }); edit({ insert: said }); };
  const back = () => edit({ remove: 1, keyboard: true });
  for (const letter of 'هلا') { key(letter); }
  assert.equal(field, 'هلا');
  key(' '); for (const letter of 'book') { key(letter); } // a real double letter stays
  assert.equal(field, 'هلا book');
  for (let i = 0; i < 8; i += 1) { back(); }
  assert.equal(field, '');
  key('H'); key('i'); // after deleting, the phone still repeats all it ever inserted: 9 and 10 letters, never typed again
  assert.equal(field, 'Hi');
  back(); edit({ insert: 'i', keyboard: true }); // a keystroke with no message after it
  edit({ insert: 'pasted', keyboard: false }); // then text from elsewhere: it does not end with that keystroke, so it is typing
  assert.equal(field, 'Hipasted');
  edit({ insert: '1', keyboard: true }); edit({ insert: '1', keyboard: true }); // two real taps on one key
  assert.equal(field, 'Hipasted11');
  edit({ assert: 'Hello' });
  assert.equal(field, 'Hello');

  const old = new Echoes(); // a phone whose messages carry no keyboard state at all: nothing is ever left out
  field = '';
  for (const part of ['a', 'a', 'ab']) { const e = { assert: null, insert: part, remove: 0, keyboard: false }; if (!old.isEcho(e)) { field = applyEdit(field, e); } }
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

