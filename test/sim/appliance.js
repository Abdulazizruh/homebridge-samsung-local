"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimAppliance = exports.parseDevice0 = void 0;
/**
 * Simulated Samsung OCF appliance (TEST FIXTURE).
 *
 * Serves CoAP/OCF over the in-process DTLS peer (test/sim/dtls-server.ts) from
 * a captured device fixture: /oic/res, /oic/d, the /device/0 batch (Block2 when
 * large), individual resources, POST writes, and Observe pushes.
 *
 * HONESTY: read behaviour replays REAL captures. Write and Observe behaviour is
 * MODELLED (the fixtures are state snapshots; they carry no write responses).
 * Foreign-peer DTLS interop is proven separately against OpenSSL.
 */
const message_1 = require("../../engine/vendor/coap/message");
const cbor_1 = require("../../engine/vendor/ocf/cbor");
const discovery_1 = require("../../engine/vendor/ocf/discovery");
const dtls_server_1 = require("./dtls-server");
const C_CONTENT = (0, message_1.mkCode)(2, 5); // 2.05
const C_CHANGED = (0, message_1.mkCode)(2, 4); // 2.04
const C_NOTFOUND = (0, message_1.mkCode)(4, 4); // 4.04
const C_BADREQ = (0, message_1.mkCode)(4, 0); // 4.00
/** Parse a fixture's device0 list into {href: rep} (re-exported canonical impl). */
exports.parseDevice0 = discovery_1.parseDevice0Batch;
class SimAppliance {
    state;
    server;
    observers = new Map();
    postLog = [];
    /** Turn on to answer large reads via a separate CON instead of piggyback. */
    separateResponses = false;
    constructor(state) {
        this.state = state;
    }
    get writes() {
        return this.postLog;
    }
    get port() {
        return this.server.port;
    }
    async start(cert, key, fixedPort = 0) {
        this.server = await (0, dtls_server_1.startSimDtlsServer)(cert, key, fixedPort);
        this.server.onData = (buf) => this.handle(buf);
    }
    async close() {
        await this.server?.close();
    }
    get connected() {
        return this.server.connected;
    }
    send(datagram) {
        void this.server.send(datagram);
    }
    hrefOf(msg) {
        const segs = msg.options.filter((o) => o.number === message_1.Opt.URI_PATH).map((o) => o.value.toString("utf8"));
        return "/" + segs.join("/");
    }
    queryOf(msg) {
        return msg.options.filter((o) => o.number === message_1.Opt.URI_QUERY).map((o) => o.value.toString("utf8"));
    }
    /** Build the payload for a resource href, or undefined for 4.04. */
    payloadFor(href, query) {
        if (href === "/oic/res") {
            const links = this.state.oicRes ?? this.synthOicRes();
            const filtered = query.some((q) => q.startsWith("rt="))
                ? links.filter((l) => matchesRt(l, query))
                : links;
            return (0, cbor_1.encodeCbor)(filtered);
        }
        if (href === "/device/0")
            return (0, cbor_1.encodeCbor)(this.state.device0);
        const rep = this.state.resources[href];
        if (rep)
            return (0, cbor_1.encodeCbor)(rep);
        if (href === "/oic/d" && this.state.resources["/oic/d"])
            return (0, cbor_1.encodeCbor)(this.state.resources["/oic/d"]);
        return undefined;
    }
    synthOicRes() {
        return Object.keys(this.state.resources).map((href) => ({
            href,
            rt: this.state.resources[href]["rt"] ?? [],
            if: ["oic.if.baseline", "oic.if.a"],
        }));
    }
    handle(buf) {
        let msg;
        try {
            msg = (0, message_1.decode)(buf);
        }
        catch {
            return;
        }
        // ACK from the client for our separate CON / notification — nothing to do.
        if (msg.type === message_1.CoapType.ACK)
            return;
        const href = this.hrefOf(msg);
        const query = this.queryOf(msg);
        const isGet = msg.code === 1;
        const isPost = msg.code === 2;
        // OBSERVE register/deregister
        const obsOpt = msg.options.find((o) => o.number === message_1.Opt.OBSERVE);
        if (isGet && obsOpt) {
            if (obsOpt.value.length && (0, message_1.bufToUint)(obsOpt.value) === 1) {
                this.observers.delete(href);
            }
            else {
                this.observers.set(href, { href, token: msg.token, seq: 2 });
            }
            // seed with current value, Observe seq=1
            const payload = this.payloadFor(href, query) ?? Buffer.alloc(0);
            this.send((0, message_1.encode)({
                type: message_1.CoapType.ACK, code: payload.length ? C_CONTENT : C_NOTFOUND, messageId: msg.messageId, token: msg.token,
                options: [{ number: message_1.Opt.OBSERVE, value: Buffer.from([1]) }, { number: message_1.Opt.CONTENT_FORMAT, value: Buffer.from([message_1.ContentFormat.CBOR]) }],
                payload,
            }));
            return;
        }
        if (isPost) {
            this.postLog.push({ href, payload: msg.payload ?? Buffer.alloc(0) });
            // modelled write: merge CBOR into the stored rep so a readback reflects it
            this.send((0, message_1.encode)({ type: message_1.CoapType.ACK, code: C_CHANGED, messageId: msg.messageId, token: msg.token, options: [] }));
            return;
        }
        if (isGet) {
            const full = this.payloadFor(href, query);
            if (full === undefined) {
                this.send((0, message_1.encode)({ type: message_1.CoapType.ACK, code: C_NOTFOUND, messageId: msg.messageId, token: msg.token, options: [] }));
                return;
            }
            this.respondBlockwise(msg, full);
            return;
        }
        // unsupported method
        this.send((0, message_1.encode)({ type: message_1.CoapType.ACK, code: C_BADREQ, messageId: msg.messageId, token: msg.token, options: [] }));
    }
    respondBlockwise(msg, full) {
        const reqBlock = msg.options.find((o) => o.number === message_1.Opt.BLOCK2);
        const szx = reqBlock && reqBlock.value.length ? (0, message_1.blockFields)(reqBlock.value).szx : 6;
        const blockSize = 1 << (szx + 4);
        const cfOpt = { number: message_1.Opt.CONTENT_FORMAT, value: Buffer.from([message_1.ContentFormat.CBOR]) };
        if (full.length <= blockSize && !reqBlock) {
            if (this.separateResponses) {
                // Empty ACK now, then the data as a separate CON (as real firmware does
                // for larger answers). The client must ACK the CON and match by token.
                this.send((0, message_1.encode)({ type: message_1.CoapType.ACK, code: 0, messageId: msg.messageId, token: Buffer.alloc(0), options: [] }));
                setTimeout(() => this.send((0, message_1.encode)({
                    type: message_1.CoapType.CON, code: C_CONTENT, messageId: Math.floor(Math.random() * 0xffff),
                    token: msg.token, options: [cfOpt], payload: full,
                })), 15);
                return;
            }
            this.send((0, message_1.encode)({ type: message_1.CoapType.ACK, code: C_CONTENT, messageId: msg.messageId, token: msg.token, options: [cfOpt], payload: full }));
            return;
        }
        const num = reqBlock && reqBlock.value.length ? (0, message_1.blockFields)(reqBlock.value).num : 0;
        const start = num * blockSize;
        const chunk = full.subarray(start, start + blockSize);
        const more = start + blockSize < full.length;
        this.send((0, message_1.encode)({
            type: message_1.CoapType.ACK, code: C_CONTENT, messageId: msg.messageId, token: msg.token,
            options: [cfOpt, { number: message_1.Opt.BLOCK2, value: (0, message_1.blockValue)(num, more, szx) }],
            payload: chunk.length ? Buffer.from(chunk) : undefined,
        }));
    }
    /** Push an OBSERVE notification for a resource whose rep changed. */
    pushNotification(href, rep) {
        const o = this.observers.get(href);
        if (!o)
            return;
        this.state.resources[href] = rep;
        const seq = o.seq++;
        this.send((0, message_1.encode)({
            type: message_1.CoapType.CON, code: C_CONTENT, messageId: Math.floor(Math.random() * 0xffff), token: o.token,
            options: [{ number: message_1.Opt.OBSERVE, value: seqBytes(seq) }, { number: message_1.Opt.CONTENT_FORMAT, value: Buffer.from([message_1.ContentFormat.CBOR]) }],
            payload: (0, cbor_1.encodeCbor)(rep),
        }));
    }
}
exports.SimAppliance = SimAppliance;
function matchesRt(link, query) {
    const wanted = query.filter((q) => q.startsWith("rt=")).map((q) => q.slice(3));
    const rts = link?.rt ?? [];
    return wanted.some((w) => rts.includes(w));
}
function seqBytes(seq) {
    if (seq <= 0xff)
        return Buffer.from([seq]);
    const b = Buffer.alloc(2);
    b.writeUInt16BE(seq & 0xffff, 0);
    return b;
}
