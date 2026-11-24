/**
 * An Apple TV stand-in for the iPhone's own remote (Control Centre → Apple TV
 * Remote). The iPhone pairs with it once using a four-digit code, then sends
 * its buttons, swipes and — when the TV has a text field open — what is typed
 * on the iPhone keyboard. Everything stays on the home network.
 *
 * Apple does not publish this protocol ("Companion Link"). This is a port of
 * the open implementations in pyatv and atvr4samsung (both MIT); see NOTICE.md.
 */
import crypto from 'node:crypto';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import srp from 'fast-srp-hap';
import { pack, unpack } from './opack.js';
import { Tlv, TlvError, readTlv, writeTlv } from './tlv8.js';
import { agreement, counterNonce, hkdf, open, seal, signer, verify } from './crypto.js';
import { Typing, documentState, readEdit } from './rti.js';
import { PHASE, Swipes } from './gestures.js';

const { SRP, SrpServer } = srp;
const FRAME = { NoOp: 1, PS_Start: 3, PS_Next: 4, PV_Start: 5, PV_Next: 6, E_OPACK: 8 };
const AUTH_FRAMES = new Set([FRAME.PS_Start, FRAME.PS_Next, FRAME.PV_Start, FRAME.PV_Next]);
const MAX_FRAME = 256 * 1024;
const AUTH_DEADLINE_MS = 60_000;
const IDLE_CLOSE_MS = 1000; // a connection that only said who it is and then nothing
const IDLE_LOOP_MS = 120_000;
const IDLE_LOOP_MAX = 30; // closed this often in two minutes, it is left alone
const MAX_CONNECTIONS = 8;
const MAX_WRONG_CODES = 10;
const VOLUME_FLAG = 0x0100;
const SELECT_REPEAT_MS = 250;

// What each remote button means for a TV. 18 and 19 are how current iOS sends Mute and Power.
const BUTTONS = new Map([
  [1, 'KEY_UP'], [2, 'KEY_DOWN'], [3, 'KEY_LEFT'], [4, 'KEY_RIGHT'], [5, 'KEY_RETURN'], [6, 'KEY_ENTER'], [7, 'KEY_HOME'],
  [8, 'KEY_VOLUP'], [9, 'KEY_VOLDOWN'], [14, 'KEY_PLAY_BACK'], [15, 'KEY_CHUP'], [16, 'KEY_CHDOWN'], [17, 'KEY_GUIDE'],
  [18, 'KEY_MUTE'], [29, 'KEY_MUTE'],
]);
const POWER = new Map([[19, 'toggle'], [30, 'toggle'], [12, false], [13, true]]);
const SWIPE_KEYS = { UP: 'KEY_UP', DOWN: 'KEY_DOWN', LEFT: 'KEY_LEFT', RIGHT: 'KEY_RIGHT', SELECT: 'KEY_ENTER' };

class Connection {
  constructor(server, socket) {
    this.server = server;
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.keys = null; // { out, in } once the phone has proved itself
    this.counters = { out: 0, in: 0 };
    this.verified = null;
    this.setup = null;
    this.pv = null;
    this.rti = { registered: false, uuid: null, open: false };
    this.swipes = new Swipes();
    this.typing = new Typing();
    this.born = Date.now();
    this.remote = false; // a TV Remote session is open on this connection
    this.lastSelect = 0;
    this.deadline = setTimeout(() => { if (!this.keys) { this.close(); } }, AUTH_DEADLINE_MS);
    socket.on('data', (chunk) => this.#data(chunk));
    socket.on('error', () => {});
    socket.on('close', () => this.#gone());
  }

  close() { this.socket.destroy(); }

  /** "device 1", "device 2": the paired phones and tablets in the order they were paired. Never a name or an identifier. */
  who() {
    const n = [...this.server.clients.keys()].indexOf(this.verified);
    return n >= 0 ? `device ${n + 1}` : 'a device not paired';
  }

  #gone() {
    clearTimeout(this.deadline);
    clearTimeout(this.idle);
    const s = this.server;
    const lasted = ((Date.now() - this.born) / 1000).toFixed(1);
    if (this.opened) {
      s.log.info(`[${s.name}] iPhone remote of ${this.who()} ended after ${lasted}s${this.remote ? ', without the phone closing its remote first' : ''}.`);
    } else if (this.verified) {
      s.log.info(`[${s.name}] ${this.who()} connected and left ${lasted}s later without opening the remote${this.closedIdle ? ' (closed by the plugin for being idle)' : ''}. It asked: ${(this.asked ?? []).join(', ') || 'nothing'}. ${this.#heard()}`);
    } else if (this.stage) {
      // It reached us but never proved itself: where it stopped explains a remote that hangs before it opens.
      s.log.info(`[${s.name}] a device connected and left ${lasted}s later without proving itself; it got as far as: ${this.stage}.`);
    }
    this.server.forget(this);
  }

  /** What arrived on this connection, as kinds and counts only: for a connection that stayed silent. */
  #heard() {
    const kinds = [...(this.frames ?? new Map())].map(([type, n]) => `${n} of kind ${type}`).join(', ') || 'none';
    const last = this.lastHeard ? `${((Date.now() - this.lastHeard) / 1000).toFixed(1)}s before it left` : 'never';
    const notes = [];
    if (this.bad) { notes.push(`${this.bad} not understood (${[...(this.badWhy ?? [])].join('; ')})`); }
    if (this.answers) { notes.push(`${this.answers} without a request name (${this.answerShape})`); }
    if (this.renamed) { notes.push(`${this.renamed} recognised by name although worded in another order`); }
    if (this.infoShape !== undefined) { notes.push(`about itself it sent: ${this.infoShape || 'nothing'}`); }
    if (this.buffer.length) { notes.push(`${this.buffer.length} bytes of an unfinished message`); }
    return `Messages after proving itself: ${kinds}; the last one ${last}${notes.length ? `; ${notes.join(', ')}` : ''}.`;
  }

  #data(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUIntBE(1, 3);
      if (length > MAX_FRAME) { this.close(); return; }
      if (this.buffer.length < 4 + length) { return; }
      const header = this.buffer.subarray(0, 4);
      const payload = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);
      try {
        this.#frame(header, payload);
      } catch (err) {
        // Said aloud, once per reason: a request that is not understood gets no answer, and the phone waits for one.
        const why = `kind ${header[0]}: ${String(err.message).replace(/[^\w .:-]/g, '?').slice(0, 60)}`;
        (this.badWhy ??= new Set()).add(why);
        const told = (this.server.notUnderstood ??= new Set());
        if (told.size < 20 && !told.has(why)) {
          told.add(why);
          this.server.log.info(`[${this.server.name}] iPhone remote: a message of ${payload.length} bytes was not understood (${why}).`);
        }
        this.bad = (this.bad ?? 0) + 1;
        if (this.bad > 8) { this.close(); return; }
      }
    }
  }

  #frame(header, payload) {
    const type = header[0];
    if (AUTH_FRAMES.has(type)) {
      if (this.keys) { this.close(); return; } // never renegotiate inside a session
      const [message] = unpack(payload);
      const tlv = readTlv(message?._pd ?? Buffer.alloc(0));
      const step = tlv.get(Tlv.SeqNo)?.[0];
      const verifyFlow = type === FRAME.PV_Start || type === FRAME.PV_Next;
      if (verifyFlow && step === 1) { this.stage = 'the first step of proving itself'; this.#verify1(tlv); }
      else if (verifyFlow && step === 3) { this.stage = 'the last step of proving itself'; this.#verify3(tlv); }
      else if (!verifyFlow && step === 1) { this.stage = 'asking to pair'; this.#setup1(); }
      else if (!verifyFlow && step === 3) { this.#setup3(tlv); }
      else if (!verifyFlow && step === 5) { this.#setup5(tlv); }
      else { this.close(); }
      return;
    }
    if (!this.keys) { this.close(); return; }
    (this.frames ??= new Map()).set(type, (this.frames.get(type) ?? 0) + 1);
    this.lastHeard = Date.now();
    if (type === FRAME.NoOp && payload.length === 0) { return; }
    let plain;
    try {
      plain = open(this.keys.in, counterNonce(this.counters.in), payload, header);
    } catch {
      this.bad = (this.bad ?? 0) + 1;
      (this.badWhy ??= new Set()).add(`kind ${type}: could not be opened with this connection's key`);
      this.close();
      return;
    }
    this.counters.in += 1;
    const [message] = unpack(plain);
    if (!message || typeof message !== 'object') { return; }
    if (typeof message._i !== 'string' && Number(message._t) === 2) {
      // A request whose name landed under the wrong field: some phones word the same request in another
      // order, and the name is then read one place off. The request is still recognised by its name.
      for (const [field, value] of Object.entries(message)) {
        if (typeof value === 'string' && Object.hasOwn(HANDLERS, value.toLowerCase())) {
          delete message[field];
          message._i = value;
          this.renamed = (this.renamed ?? 0) + 1;
          break;
        }
      }
    }
    if (typeof message._i !== 'string') { // a reply to one of our events, or something not understood
      this.answers = (this.answers ?? 0) + 1;
      // Apple's field names only, never a value: what kind of message came without a request name.
      // Only what looks like one of Apple's field names is written; anything else could be an identifier.
      const names = (o) => Object.keys(o ?? {}).sort().map((k) => (/^[_A-Za-z][A-Za-z]{0,23}$/.test(k) ? k : '(other)')).join(',').slice(0, 200);
      this.answerShape = `fields ${names(message)}; kind ${Number(message._t) || '-'}; name is ${message._i === undefined ? 'missing' : typeof message._i}; inside: ${typeof message._c === 'object' ? names(message._c) : '-'}`;
      return;
    }
    if ((this.asked ??= []).length < 25) { this.asked.push(message._i.slice(0, 40).replace(/[^\w.-]/g, '?')); } // Apple's request names, for the log
    const handler = HANDLERS[message._i.toLowerCase()];
    if (handler) { handler.call(this, message, message._c ?? {}); return; }
    this.error(message, 'No request handler', 58822);
    const asked = (this.server.unanswered ??= new Set());
    const name = message._i.slice(0, 60).replace(/[^\w.-]/g, '?');
    if (asked.size < 30 && !asked.has(name)) { // each name once: these are Apple's request names, never content
      asked.add(name);
      this.server.log.info(`[${this.server.name}] iPhone remote asked for something this plugin does not answer: ${name}.`);
    }
  }

  send(type, data) {
    if (this.socket.destroyed) { return; }
    let body = pack(data);
    const header = Buffer.alloc(4);
    header[0] = type;
    header.writeUIntBE(body.length + (this.keys ? 16 : 0), 1, 3);
    if (this.keys) {
      body = seal(this.keys.out, counterNonce(this.counters.out), body, header);
      this.counters.out += 1;
    }
    this.socket.write(Buffer.concat([header, body]));
  }

  reply(request, content = {}) { this.send(FRAME.E_OPACK, { _i: request._i, _x: request._x, _t: 3, _c: content }); }
  event(name, content = {}, xid = 1234) { this.send(FRAME.E_OPACK, { _i: name, _x: xid, _t: 1, _c: content }); }
  error(request, message, code = 1337) {
    this.send(FRAME.E_OPACK, { _i: request._i, _x: request._x, _t: 3, _ec: code, _ed: 'RPErrorDomain', _em: message });
  }

  // ---- pairing, once: the four-digit code proves the owner is at the settings page
  #setupError(step, code) {
    this.send(FRAME.PS_Next, { _pd: writeTlv([[Tlv.SeqNo, [step]], [Tlv.Error, [code]]]) });
  }

  #setup1() {
    const s = this.server;
    if (s.wrongCodes >= MAX_WRONG_CODES) { this.#setupError(2, TlvError.Unavailable); return; }
    const salt = crypto.randomBytes(16);
    const secret = crypto.randomBytes(32);
    const session = new SrpServer(SRP.params.hap, salt, Buffer.from('Pair-Setup'), Buffer.from(String(s.pin)), secret);
    this.setup = { session, proven: false };
    s.log.info(`[${s.name}] an iPhone asks to pair its remote. The code is in the plugin settings, under this TV.`);
    this.send(FRAME.PS_Next, { _pd: writeTlv([[Tlv.SeqNo, [2]], [Tlv.Salt, salt], [Tlv.PublicKey, session.computeB()], [Tlv.Flags, [1]]]), _pwTy: 1 });
  }

  #setup3(tlv) {
    const s = this.server;
    const session = this.setup?.session;
    if (!session || !tlv.get(Tlv.PublicKey) || !tlv.get(Tlv.Proof)) { this.close(); return; }
    try {
      session.setA(tlv.get(Tlv.PublicKey));
      session.checkM1(tlv.get(Tlv.Proof));
    } catch {
      s.wrongCodes += 1;
      s.log.warn(`[${s.name}] the pairing code entered on the iPhone was wrong (${s.wrongCodes} of ${MAX_WRONG_CODES} before pairing is switched off until a restart).`);
      this.setup = null;
      this.#setupError(4, TlvError.Authentication);
      return;
    }
    this.setup.proven = true;
    this.setup.key = session.computeK();
    this.send(FRAME.PS_Next, { _pd: writeTlv([[Tlv.SeqNo, [4]], [Tlv.Proof, session.computeM2()]]) });
  }

  #setup5(tlv) {
    const s = this.server;
    if (!this.setup?.proven || !tlv.get(Tlv.EncryptedData)) { this.close(); return; }
    const K = this.setup.key;
    const sessionKey = hkdf('Pair-Setup-Encrypt-Salt', 'Pair-Setup-Encrypt-Info', K);
    let phone;
    try {
      phone = readTlv(open(sessionKey, 'PS-Msg05', tlv.get(Tlv.EncryptedData)));
    } catch {
      this.#setupError(6, TlvError.Authentication);
      return;
    }
    const id = phone.get(Tlv.Identifier); const ltpk = phone.get(Tlv.PublicKey); const sig = phone.get(Tlv.Signature);
    const phoneX = hkdf('Pair-Setup-Controller-Sign-Salt', 'Pair-Setup-Controller-Sign-Info', K);
    if (!id || ltpk?.length !== 32 || !sig || !verify(ltpk, Buffer.concat([phoneX, id, ltpk]), sig)) {
      this.#setupError(6, TlvError.Authentication);
      return;
    }
    const mine = Buffer.from(s.identity.id);
    const myX = hkdf('Pair-Setup-Accessory-Sign-Salt', 'Pair-Setup-Accessory-Sign-Info', K);
    const info = {
      altIRK: s.identity.irk, accountID: s.identity.account, model: s.model, wifiMAC: s.identity.mac, name: s.name, mac: s.identity.mac,
    };
    const body = writeTlv([
      [Tlv.Identifier, mine], [Tlv.PublicKey, s.signer.publicKey],
      [Tlv.Signature, s.signer.sign(Buffer.concat([myX, mine, s.signer.publicKey]))], [Tlv.Info, pack(info)],
    ]);
    s.remember(id.toString('utf8'), ltpk);
    this.setup = null;
    this.send(FRAME.PS_Next, { _pd: writeTlv([[Tlv.SeqNo, [6]], [Tlv.EncryptedData, seal(sessionKey, 'PS-Msg06', body)]]) });
    s.log.info(`[${s.name}] an iPhone paired its remote.`);
  }

  // ---- every later connection: both sides prove they hold the keys from the pairing
  #verify1(tlv) {
    const s = this.server;
    const theirs = tlv.get(Tlv.PublicKey);
    if (theirs?.length !== 32) { this.close(); return; }
    const mine = agreement();
    const shared = mine.shared(theirs);
    const sessionKey = hkdf('Pair-Verify-Encrypt-Salt', 'Pair-Verify-Encrypt-Info', shared);
    const id = Buffer.from(s.identity.id);
    const body = writeTlv([[Tlv.Identifier, id], [Tlv.Signature, s.signer.sign(Buffer.concat([mine.publicKey, id, theirs]))]]);
    this.pv = { sessionKey, theirs, mine: mine.publicKey, out: hkdf('', 'ServerEncrypt-main', shared), in: hkdf('', 'ClientEncrypt-main', shared) };
    this.send(FRAME.PV_Next, { _pd: writeTlv([[Tlv.SeqNo, [2]], [Tlv.PublicKey, mine.publicKey], [Tlv.EncryptedData, seal(sessionKey, 'PV-Msg02', body)]]) });
  }

  #verify3(tlv) {
    const s = this.server;
    const pv = this.pv;
    const refuse = () => {
      this.pv = null;
      this.send(FRAME.PV_Next, { _pd: writeTlv([[Tlv.SeqNo, [4]], [Tlv.Error, [TlvError.Authentication]]]) });
    };
    if (!pv || !tlv.get(Tlv.EncryptedData)) { this.close(); return; }
    let phone;
    try {
      phone = readTlv(open(pv.sessionKey, 'PV-Msg03', tlv.get(Tlv.EncryptedData)));
    } catch {
      refuse();
      return;
    }
    const id = phone.get(Tlv.Identifier); const sig = phone.get(Tlv.Signature);
    const ltpk = id ? s.clients.get(id.toString('utf8')) : null;
    if (!ltpk || !sig || !verify(ltpk, Buffer.concat([pv.theirs, id, pv.mine]), sig)) { refuse(); return; }
    this.send(FRAME.PV_Next, { _pd: writeTlv([[Tlv.SeqNo, [4]]]) });
    this.keys = { out: pv.out, in: pv.in };
    this.verified = id.toString('utf8');
    this.verifiedMs = Date.now() - this.born;
    // A phone has one remote. When it comes back on a new connection, the one it left behind is closed:
    // a real phone that found its old connection still open sat on "Connecting" for half a minute.
    // Only a connection whose remote is not open is closed: a phone may open a second
    // connection just to ask something, and that must never cut the remote in use.
    let closed = 0; let kept = 0;
    for (const other of [...s.connections]) {
      if (other === this || other.verified !== this.verified) { continue; }
      if (other.remote) { kept += 1; } else { other.close(); closed += 1; }
    }
    this.siblings = { closed, kept };
    if (closed) { s.log.info(`[${s.name}] the same iPhone or iPad came back; ${closed} earlier connection${closed === 1 ? '' : 's'} without an open remote ${closed === 1 ? 'was' : 'were'} closed.`); }
    this.pv = null;
    clearTimeout(this.deadline);
  }

  // ---- what the remote does
  key(name) {
    if (name === 'KEY_ENTER') {
      // A tap arrives both as a touch and as a button; one press on the TV is meant.
      const now = Date.now();
      if (now - this.lastSelect < SELECT_REPEAT_MS) { return; }
      this.lastSelect = now;
    }
    this.server.emit('key', name);
  }

  flags(xid) {
    this.event('MediaControlStatus', { MediaControlFlags: VOLUME_FLAG }, xid);
    this.event('_iMC', { _mcF: VOLUME_FLAG }, xid);
  }

  /** Whether the TV is awake, as an Apple TV tells every phone that connects. */
  status(xid) {
    const state = this.server.awake ? 3 : 1;
    this.event('SystemStatus', { state }, xid);
    this.event('TVSystemStatus', { state }, xid);
  }

  /** The TV opened or closed a text field: show or hide the iPhone keyboard. */
  keyboard(open_) {
    if (!this.rti.registered || this.rti.open === open_) { return false; }
    this.rti.open = open_;
    if (open_) {
      this.event('_tiStarted', { _tiD: documentState(this.rti.uuid, this.server.text) });
    } else {
      this.event('_tiStopped', {});
    }
    return open_;
  }
}

const ok = function ok(message) { this.reply(message, {}); };
const HANDLERS = {
  _systeminfo(message, c) {
    // The phone says who it is and expects the same back. An empty answer left a real phone waiting
    // half a minute on some connections, so the stand-in now names itself, as it does when pairing.
    const s = this.server;
    this.reply(message, {
      name: s.name, model: s.model, _sv: '715.2', _bf: 0,
      _idsID: s.identity.id, _pubID: [...s.identity.mac].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':'),
    });
    this.status(message._x);
    const shape = Object.keys(c ?? {}).sort().map((k) => (/^[_A-Za-z][A-Za-z]{0,23}$/.test(k) ? k : '(other)')).join(',').slice(0, 300);
    this.infoShape = shape; // the names of what the phone sent about itself, never the values
    // A phone also connects by itself, says who it is, and then says nothing for half a minute. While such
    // a connection sat there, the remote on that phone showed "Connecting". It is closed after a short wait,
    // unless that makes the phone come straight back again and again.
    clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      if (this.opened || (this.asked ?? []).length > 1 || this.socket.destroyed) { return; }
      const now = Date.now();
      const closes = (s.idleCloses ??= new Map());
      const mine = (closes.get(this.verified) ?? []).filter((at) => now - at < IDLE_LOOP_MS);
      if (mine.length >= IDLE_LOOP_MAX) { return; } // it keeps coming back: left alone
      closes.set(this.verified, [...mine, now]);
      this.closedIdle = true;
      this.close();
    }, IDLE_CLOSE_MS);
    this.idle.unref?.();
  },
  _sessionstart(message, c) {
    this.sid = c._sid;
    // A number of its own for every session: a phone that comes back while its earlier session is
    // still winding down must never be handed that session's number again.
    this.reply(message, { _sid: crypto.randomInt(1, 0x7fffffff) });
  },
  _sessionstop: ok,
  tvrcsessionstart(message, c) {
    this.remote = true;
    this.opened = true;
    this.server.log.info(`[${this.server.name}] iPhone remote of ${this.who()} opened: the phone proved itself ${this.verifiedMs ?? 0} ms after connecting, the remote was ready after ${Date.now() - this.born} ms. Before that it asked: ${(this.asked ?? []).slice(0, -1).join(', ') || 'nothing'}..`);
    this.server.sessionsChanged();
    this.reply(message, c);
    this.flags(message._x); // within a moment, or the iPhone keeps the volume buttons for itself
  },
  tvrcsessionstop(message) { this.remote = false; this.server.sessionsChanged(); this.reply(message, {}); },
  _interest(message, c) {
    for (const name of Array.isArray(c._regEvents) ? c._regEvents : []) {
      if (name === '_iMC') { this.event('_iMC', { _mcF: VOLUME_FLAG }, message._x); }
      if (name === 'MediaControlStatus') { this.event('MediaControlStatus', { MediaControlFlags: VOLUME_FLAG }, message._x); }
      if (name === 'NowPlayingInfo') { this.event('NowPlayingInfo', {}, message._x); }
      if (name === 'SystemStatus' || name === 'TVSystemStatus') { this.event(name, { state: this.server.awake ? 3 : 1 }, message._x); }
    }
  },
  _hidc(message, c) {
    const code = Number(c._hidC); const state = Number(c._hBtS);
    this.reply(message, {});
    if (state !== 2 && state !== 0) { return; } // act once, when the finger lifts
    if (BUTTONS.has(code)) { this.key(BUTTONS.get(code)); } else if (POWER.has(code)) { this.server.emit('power', POWER.get(code)); }
  },
  _touchstart(message, c) {
    const fine = (n) => Number.isFinite(n) && n > 0 && n <= 1000;
    if (!fine(c._width) || !fine(c._height)) { this.error(message, 'Invalid touchpad width or height'); return; }
    this.reply(message, { _i: 1 }); // the iPhone ends the whole session without a touch device id
  },
  _touchstop: ok,
  _hidt(message, c) {
    const phase = PHASE[Number(c._tPh)]; const x = Number(c._cx ?? 0); const y = Number(c._cy ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { return; }
    const direction = this.swipes.feed(phase, x, y);
    if (direction) { this.key(SWIPE_KEYS[direction]); }
  },
  _mcc(message, c) {
    const cmd = Number(c._mcc);
    if (cmd === 1 || cmd === 2) { this.key('KEY_PLAY_BACK'); }
    this.reply(message, cmd === 5 ? { _vol: 0.5 } : {});
  },
  mediacontrolcommand(message, c) {
    const cmd = Number(c.MediaControlCommand);
    if (cmd === 1 || cmd === 2) { this.key('KEY_PLAY_BACK'); }
    this.reply(message, cmd === 5 ? { _vol: 0.5 } : cmd === 12 ? { _cse: false } : {});
  },
  fetchmediacontrolstatus(message) { this.reply(message, { MediaControlFlags: VOLUME_FLAG }); },
  fetchattentionstate(message) { this.reply(message, { state: this.server.awake ? 3 : 1 }); },
  _tistart(message) {
    if (message._t !== 2) { return; }
    // The session exists but the keyboard stays hidden until the TV opens a text field.
    this.rti = { registered: true, uuid: crypto.randomBytes(16), open: false };
    if (this.server.keyboardOpen) {
      this.rti.open = true;
      this.reply(message, { _tiD: documentState(this.rti.uuid, this.server.text) });
    } else {
      this.reply(message, {});
    }
  },
  _tistop(message) {
    if (message._t !== 2) { return; }
    this.rti = { registered: false, uuid: null, open: false };
    this.reply(message, {});
  },
  _tic(message, c) {
    if (!c._tiD) { return; }
    if (!this.rti.registered || !this.rti.open || !this.server.keyboardOpen) { return; } // no field is open
    const edit = readEdit(c._tiD);
    const before = this.server.text;
    const { picture: echo, text } = this.typing.apply(before, edit); // a picture of the whole text replaces the field
    // Trial: the shape of each edit, in lengths only and never the text, to see how a real iPhone words its typing.
    this.edits = (this.edits ?? 0) + 1;
    if (this.edits <= 60) {
      const n = (v) => (v === null ? '-' : Array.from(v).length);
      const tail = edit.insert && before ? Array.from(before).slice(-Array.from(edit.insert).length).join('') : '';
      const repeats = Boolean(edit.insert) && before.length > 0 && (edit.insert.startsWith(tail) || before.endsWith(edit.insert) || edit.insert.startsWith(before));
      this.server.log.info(`[${this.server.name}] iPhone edit ${this.edits}: kind ${message._t}${edit.keyboard ? ', keyboard' : ''}, whole text ${n(edit.assert)}, removed ${edit.remove}, added ${n(edit.insert)}, field ${Array.from(before).length} -> ${Array.from(text).length}${echo ? ', the whole text as the phone has it' : repeats ? ', the added part repeats what the field already holds' : ''}.`);
    }
    const shapes = (this.server.shapes ??= new Set());
    const kind = `${echo ? 'the whole text after a change' : edit.insert && !edit.keyboard ? 'letters added without keyboard state' : edit.insert ? 'letters added' : edit.remove ? 'letters removed' : 'whole text'}: ${edit.shape}`;
    if (shapes.size < 20 && !shapes.has(kind)) { // each kind once: Apple's field names, never their values
      shapes.add(kind);
      this.server.log.info(`[${this.server.name}] iPhone edit fields, ${kind}`);
    }
    if (text === this.server.text) { return; }
    this.server.text = text; // one field on the TV, whichever phone types into it
    this.server.edited = true;
    this.server.emit('text', text);
  },
  fetchsupportedactionsevent: ok, publishpresenceevent: ok, switchactiveuseraccountevent: ok, fetchupnextinfoevent: ok,
  fetchcurrenttopshelfitemsevent: ok, fetchsiriremoteinfo: ok, fetchcurrentnowplayinginfoevent: ok,
  fetchlaunchableapplicationsevent: ok, fetchuseraccountsevent: ok, _launchapp: ok,
};

/**
 * One stand-in per TV.
 * Events: 'key' (a Samsung key name), 'power' (true, false or 'toggle'),
 * 'text' (the whole text of the field), 'sessions' (how many remotes are open),
 * 'paired' (the phone's identifier).
 */
export class CompanionServer extends EventEmitter {
  constructor({ name, identity, pin, clients = {}, model = 'AppleTV14,1', log = console }) {
    super();
    this.name = name;
    this.identity = { ...identity, irk: Buffer.from(identity.irk, 'hex'), mac: Buffer.from(identity.mac, 'hex') };
    this.signer = signer(Buffer.from(identity.seed, 'hex'));
    this.pin = pin;
    this.model = model;
    this.log = log;
    this.clients = new Map(Object.entries(clients).map(([id, key]) => [id, Buffer.from(key, 'hex')]));
    this.connections = new Set();
    this.wrongCodes = 0;
    this.keyboardOpen = false;
    this.text = '';
    this.awake = true;
    this.tcp = net.createServer((socket) => {
      if (this.connections.size >= MAX_CONNECTIONS) { socket.destroy(); return; }
      socket.setNoDelay(true);
      this.connections.add(new Connection(this, socket));
    });
    this.tcp.on('error', (err) => this.log.warn(`[${name}] iPhone remote: ${err.message}`));
  }

  listen(port = 0) {
    return new Promise((resolve, reject) => {
      this.tcp.once('error', reject);
      this.tcp.listen(port, () => { this.tcp.off('error', reject); resolve(this.tcp.address().port); });
    });
  }

  close() {
    for (const c of this.connections) { c.close(); }
    return new Promise((resolve) => this.tcp.close(() => resolve()));
  }

  get sessions() { return [...this.connections].filter((c) => c.remote).length; }
  sessionsChanged() { this.emit('sessions', this.sessions); }
  forget(connection) {
    const had = connection.remote;
    this.connections.delete(connection);
    if (had) { this.sessionsChanged(); }
  }

  remember(id, ltpk) {
    this.clients.set(id, Buffer.from(ltpk));
    this.emit('paired', id, Buffer.from(ltpk).toString('hex'));
  }

  /** Called when the TV says its on-screen keyboard opened or closed. */
  /**
   * The TV said what its open field holds only after the keyboard was up. Taken as the
   * starting text as long as nothing was typed yet; the phones are told the text again.
   */
  setFieldText(text) {
    if (!this.keyboardOpen || this.edited || typeof text !== 'string') { return false; }
    const next = Array.from(text).slice(0, 1024).join('');
    if (next === this.text) { return false; }
    this.text = next;
    for (const c of this.connections) {
      if (c.rti.registered && c.rti.open) { c.event('_tiStarted', { _tiD: documentState(c.rti.uuid, next) }); }
    }
    return true;
  }

  setKeyboard(open_, text = '') {
    // A field starts with what the TV says it holds: empty for a new one, its text for one opened again.
    if (Boolean(open_) !== this.keyboardOpen) { this.edited = false; this.text = open_ ? Array.from(String(text ?? '')).slice(0, 1024).join('') : ''; }
    this.keyboardOpen = Boolean(open_);
    let shown = 0;
    for (const c of this.connections) { if (c.keyboard(this.keyboardOpen)) { shown += 1; } }
    return shown; // how many remotes were asked to show the iPhone keyboard
  }

}
