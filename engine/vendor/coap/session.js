"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoapSession = void 0;
/**
 * CoAP request/response session over a DTLS datagram link.
 *
 * Mirrors the wire semantics the reference library established against real
 * Samsung firmware (smartthings_local/protocol/dtls_session.py header):
 *  - Correlate replies by TOKEN, not arrival order; interleaved one-shot and
 *    OBSERVE traffic would otherwise mis-attribute.
 *  - The appliance answers larger requests with ACK then a SEPARATE CON; we
 *    ACK that CON and still resolve the original request by its token.
 *  - Multi-block GET uses the SAME token across every block (token-stable
 *    Block2). A fresh token per block is silently dropped by the server.
 *  - Reads retransmit (RFC 7252 §4.2 backoff); writes send once.
 *  - Requests are paced to avoid bursts the appliance drops under load.
 */
const message_1 = require("./message");
const CBOR_ACCEPT = Buffer.from([message_1.ContentFormat.CBOR]);
const CF_CBOR = Buffer.from([message_1.ContentFormat.CBOR]);
const hex = (b) => b.toString("hex");
class CoapSession {
    link;
    rps;
    defaultTimeoutMs;
    szx;
    maxBlocks;
    mid;
    tokenCounter = 1;
    pending = new Map();
    observers = new Map();
    lastSendAt = 0;
    sendChain = Promise.resolve();
    closed = false;
    constructor(link, opts = {}) {
        this.link = link;
        this.rps = opts.rateLimitRps ?? 5;
        this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 8000;
        this.szx = opts.blockSzx ?? 6;
        this.maxBlocks = opts.maxBlocks ?? 128;
        this.mid = (Math.random() * 0xffff) & 0xffff;
        link.onData = (buf) => this.onDatagram(buf);
    }
    nextMid() {
        this.mid = (this.mid + 1) & 0xffff;
        return this.mid;
    }
    nextToken() {
        const t = Buffer.alloc(2);
        t.writeUInt16BE(this.tokenCounter & 0xffff, 0);
        this.tokenCounter = (this.tokenCounter + 1) & 0xffff;
        if (this.tokenCounter === 0)
            this.tokenCounter = 1;
        return t;
    }
    /** Pace sends so a burst never exceeds rateLimitRps. */
    paced(buf) {
        const minGap = 1000 / this.rps;
        this.sendChain = this.sendChain.then(async () => {
            const wait = Math.max(0, this.lastSendAt + minGap - Date.now());
            if (wait > 0)
                await new Promise((r) => setTimeout(r, wait));
            this.lastSendAt = Date.now();
            if (!this.closed)
                await this.link.send(buf);
        });
        return this.sendChain;
    }
    /** GET a resource href (path segments), Block2-aware. */
    get(path, query = [], timeoutMs = this.defaultTimeoutMs) {
        const token = this.nextToken();
        const options = [
            ...(0, message_1.pathOptions)(path),
            ...(0, message_1.queryOptions)(query),
            { number: message_1.Opt.ACCEPT, value: CBOR_ACCEPT },
        ];
        const msg = { type: message_1.CoapType.CON, code: message_1.Code.GET, messageId: this.nextMid(), token, options };
        const datagram = (0, message_1.encode)(msg);
        return this.track(token, path, query, datagram, true, timeoutMs);
    }
    /** POST (write) a CBOR payload to a resource href. Sent once (no retransmit). */
    post(path, payload, timeoutMs = this.defaultTimeoutMs) {
        const token = this.nextToken();
        const options = [
            ...(0, message_1.pathOptions)(path),
            { number: message_1.Opt.CONTENT_FORMAT, value: CF_CBOR },
            // Sent as the Python engine sends it: some firmwares answer 4.00
            // to a command that does not say which reply format it accepts.
            { number: message_1.Opt.ACCEPT, value: CBOR_ACCEPT },
        ];
        const msg = { type: message_1.CoapType.CON, code: message_1.Code.POST, messageId: this.nextMid(), token, options, payload };
        const datagram = (0, message_1.encode)(msg);
        return this.track(token, path, [], datagram, false, timeoutMs);
    }
    /** Subscribe to CoAP Observe on a resource. Returns an unsubscribe fn. */
    async observe(path, handler, query = []) {
        const token = this.nextToken();
        const href = "/" + path.join("/");
        const options = [
            { number: message_1.Opt.OBSERVE, value: Buffer.alloc(0) }, // 0 = register
            ...(0, message_1.pathOptions)(path),
            ...(0, message_1.queryOptions)(query),
            { number: message_1.Opt.ACCEPT, value: CBOR_ACCEPT },
        ];
        const msg = { type: message_1.CoapType.CON, code: message_1.Code.GET, messageId: this.nextMid(), token, options };
        this.observers.set(hex(token), { tokenHex: hex(token), href, handler, lastSeq: null });
        await this.paced((0, message_1.encode)(msg));
        return () => {
            const t = Buffer.from(token);
            const dereg = {
                type: message_1.CoapType.CON, code: message_1.Code.GET, messageId: this.nextMid(), token: t,
                options: [{ number: message_1.Opt.OBSERVE, value: Buffer.from([1]) }, ...(0, message_1.pathOptions)(path), ...(0, message_1.queryOptions)(query), { number: message_1.Opt.ACCEPT, value: CBOR_ACCEPT }],
            };
            this.observers.delete(hex(t));
            void this.paced((0, message_1.encode)(dereg)).catch(() => { });
        };
    }
    track(token, path, query, datagram, retransmit, timeoutMs) {
        const tokenHex = hex(token);
        return new Promise((resolve, reject) => {
            const p = {
                tokenHex, resolve, reject, path, query, blocks: [], expectBlock: 0,
                szx: this.szx, datagram, retransmit, acked: false,
            };
            this.pending.set(tokenHex, p);
            p.overall = setTimeout(() => this.fail(tokenHex, new Error(`CoAP timeout after ${timeoutMs}ms for /${path.join("/")}`)), timeoutMs);
            if (retransmit)
                this.scheduleRetransmit(p, 2000, 0);
            this.paced(datagram).catch((e) => this.fail(tokenHex, e instanceof Error ? e : new Error(String(e))));
        });
    }
    scheduleRetransmit(p, delay, count) {
        // RFC 7252 §4.2: up to 4 retransmissions, doubling backoff. Stop once ACKed.
        if (count >= 4)
            return;
        p.timer = setTimeout(() => {
            if (this.closed || !this.pending.has(p.tokenHex) || p.acked)
                return;
            void this.paced(p.datagram).catch(() => { });
            this.scheduleRetransmit(p, delay * 2, count + 1);
        }, delay);
    }
    fail(tokenHex, err) {
        const p = this.pending.get(tokenHex);
        if (!p)
            return;
        this.pending.delete(tokenHex);
        if (p.timer)
            clearTimeout(p.timer);
        if (p.overall)
            clearTimeout(p.overall);
        p.reject(err);
    }
    settle(p, code, payload, options) {
        this.pending.delete(p.tokenHex);
        if (p.timer)
            clearTimeout(p.timer);
        if (p.overall)
            clearTimeout(p.overall);
        p.resolve({ code, payload, options });
    }
    option(options, number) {
        return options.find((o) => o.number === number)?.value;
    }
    onDatagram(buf) {
        let msg;
        try {
            msg = (0, message_1.decode)(buf);
        }
        catch {
            return; // ignore malformed datagrams
        }
        const tokenHex = hex(msg.token);
        // Empty ACK for one of our CONs: the real response arrives separately.
        if (msg.type === message_1.CoapType.ACK && msg.code === message_1.Code.EMPTY) {
            const p = this.pending.get(tokenHex);
            if (p) {
                p.acked = true;
                if (p.timer)
                    clearTimeout(p.timer); // stop retransmit; await separate CON
            }
            return;
        }
        // A CON carrying data (separate response or an OBSERVE notification): ACK it.
        if (msg.type === message_1.CoapType.CON) {
            void this.paced((0, message_1.encode)({ type: message_1.CoapType.ACK, code: message_1.Code.EMPTY, messageId: msg.messageId, token: Buffer.alloc(0), options: [] })).catch(() => { });
        }
        // OBSERVE notification?
        const obs = this.observers.get(tokenHex);
        if (obs && this.option(msg.options, message_1.Opt.OBSERVE) !== undefined) {
            const seqBuf = this.option(msg.options, message_1.Opt.OBSERVE);
            const seq = seqBuf.length ? (0, message_1.bufToUint)(seqBuf) : null;
            if (seq !== null && obs.lastSeq !== null && !seqNewer(obs.lastSeq, seq))
                return; // stale/dup
            if (seq !== null)
                obs.lastSeq = seq;
            obs.handler(obs.href, msg.payload ?? Buffer.alloc(0), seq);
            return;
        }
        // Ordinary response matched by token.
        const p = this.pending.get(tokenHex);
        if (!p)
            return;
        p.acked = true;
        if (p.timer)
            clearTimeout(p.timer);
        const block2 = this.option(msg.options, message_1.Opt.BLOCK2);
        if (p.firstCode === undefined) {
            p.firstCode = msg.code;
            p.firstOptions = msg.options;
        }
        if (block2) {
            const { num, more, szx } = (0, message_1.blockFields)(block2);
            p.szx = szx;
            p.blocks[num] = msg.payload ?? Buffer.alloc(0);
            if (more) {
                if (num + 1 >= this.maxBlocks)
                    return this.fail(p.tokenHex, new Error("Block2 exceeded maxBlocks"));
                // request the next block with the SAME token (token-stable Block2)
                const next = {
                    type: message_1.CoapType.CON, code: message_1.Code.GET, messageId: this.nextMid(),
                    token: Buffer.from(p.tokenHex, "hex"),
                    options: [...(0, message_1.pathOptions)(p.path), ...(0, message_1.queryOptions)(p.query),
                        { number: message_1.Opt.ACCEPT, value: CBOR_ACCEPT },
                        { number: message_1.Opt.BLOCK2, value: (0, message_1.blockValue)(num + 1, false, szx) }],
                };
                p.datagram = (0, message_1.encode)(next);
                p.acked = false;
                if (p.timer)
                    clearTimeout(p.timer);
                if (p.retransmit)
                    this.scheduleRetransmit(p, 2000, 0);
                void this.paced(p.datagram).catch(() => { });
                return;
            }
            // last block: concatenate
            const full = Buffer.concat(p.blocks.filter((b) => b !== undefined));
            return this.settle(p, p.firstCode, full, p.firstOptions);
        }
        // single-block response
        this.settle(p, msg.code, msg.payload ?? Buffer.alloc(0), msg.options);
    }
    close() {
        this.closed = true;
        for (const tokenHex of [...this.pending.keys()])
            this.fail(tokenHex, new Error("session closed"));
        this.observers.clear();
    }
}
exports.CoapSession = CoapSession;
/** RFC 7641 §3.4: compare 24-bit sequence numbers with wraparound (newer?). */
function seqNewer(oldSeq, newSeq) {
    const T = 1 << 23;
    return (oldSeq < newSeq && newSeq - oldSeq < T) || (oldSeq > newSeq && oldSeq - newSeq > T);
}
