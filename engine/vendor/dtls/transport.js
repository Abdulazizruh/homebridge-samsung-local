"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DtlsClientTransport = exports.SIG_ECDSA = exports.SIG_RSA = void 0;
/**
 * DTLS 1.2 client transport for Samsung OCF appliances, over werift-dtls.
 *
 * Verified (hardware-free) against an independent OpenSSL DTLS server: this
 * config completes an ECDHE-ECDSA-AES128-GCM-SHA256 / P-256 handshake with a
 * client certificate and exchanges application data. See
 * research/DTLS-WERIFT-FINDINGS.md. The appliance's own firmware is NOT
 * verified here — see that document's limitations.
 */
const node_dgram_1 = require("node:dgram");
// werift-dtls@0.5.8's published "main" is missing; the real entry is this subpath.
// Isolated here so the quirk lives in exactly one module.
const index_js_1 = require("werift-dtls/lib/dtls/src/index.js");
/** sha256 + RSA — for an RSA-2048 client certificate (the reference default). */
exports.SIG_RSA = { hash: 4, signature: 1 };
/** sha256 + ECDSA — for an ECDSA P-256 client certificate. */
exports.SIG_ECDSA = { hash: 4, signature: 3 };
/** Minimal werift Transport backed by a connected-by-send UDP socket. */
class UdpBacking {
    sock;
    host;
    port;
    type = "udp";
    address = { address: "0.0.0.0", family: "IPv4", port: 0 };
    closed = false;
    onData = () => { };
    constructor(sock, host, port) {
        this.sock = sock;
        this.host = host;
        this.port = port;
        sock.on("message", (msg) => {
            try {
                this.onData(msg, [this.host, this.port]);
            }
            catch {
                /* werift logs its own handler errors; never let one kill the socket */
            }
        });
    }
    send = (data) => new Promise((resolve) => {
        // Resolve (never reject) once closed, and treat a post-close socket error
        // as a no-op: werift's handshake retransmit timers can fire a send after
        // teardown, and an unhandled rejection there would crash the bridge.
        if (this.closed)
            return resolve();
        try {
            this.sock.send(data, this.port, this.host, () => resolve());
        }
        catch {
            resolve();
        }
    });
    close = async () => {
        this.closed = true;
        try {
            this.sock.close();
        }
        catch {
            /* already closed */
        }
    };
}
/**
 * One DTLS session to one appliance. Datagram in/out only; CoAP framing is a
 * layer above. Lifecycle: connect() → send()/onData → close(). Not reusable
 * after close(); make a new instance to reconnect.
 */
class DtlsClientTransport {
    opts;
    client;
    backing;
    connected = false;
    closedFlag = false;
    /** Application data from the appliance (decrypted CoAP datagrams). */
    onData = () => { };
    /** Fires when the peer sends a close/alert. Silent UDP drops need a keepalive. */
    onClose = () => { };
    /** Transport-level errors after connect. */
    onError = () => { };
    constructor(opts) {
        this.opts = opts;
    }
    get isConnected() {
        return this.connected && !this.closedFlag;
    }
    async connect() {
        if (this.connected)
            throw new Error("already connected");
        if (this.closedFlag)
            throw new Error("transport closed; make a new instance");
        const timeoutMs = this.opts.connectTimeoutMs ?? 12_000;
        const sock = (0, node_dgram_1.createSocket)("udp4");
        await new Promise((resolve, reject) => {
            sock.once("error", reject);
            sock.bind(this.opts.localPort ?? 0, () => {
                sock.off("error", reject);
                resolve();
            });
        });
        const backing = new UdpBacking(sock, this.opts.host, this.opts.port);
        this.backing = backing;
        const client = new index_js_1.DtlsClient({
            transport: backing,
            cert: this.opts.cert,
            key: this.opts.key,
            certificateRequest: true,
            signatureHash: (this.opts.signatureHash ?? exports.SIG_RSA),
        });
        this.client = client;
        client.onData.subscribe((buf) => {
            if (!this.closedFlag)
                this.onData(buf);
        });
        client.onClose.subscribe(() => {
            if (!this.closedFlag) {
                this.closedFlag = true;
                this.connected = false;
                this.onClose();
            }
        });
        client.onError.subscribe((e) => {
            if (!this.closedFlag)
                this.onError(e instanceof Error ? e : new Error(String(e)));
        });
        await new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                void this.close();
                reject(new Error(`DTLS handshake timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            client.onConnect.subscribe(() => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.connected = true;
                resolve();
            });
            client.onError.subscribe((e) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                void this.close();
                reject(e instanceof Error ? e : new Error(String(e)));
            });
            client.connect().catch(() => {
                /* connect() only sends flight 1; real failures arrive via onError/timeout */
            });
        });
    }
    async send(data) {
        if (!this.client || !this.connected)
            throw new Error("not connected");
        await this.client.send(data);
    }
    async close() {
        if (this.closedFlag)
            return;
        this.closedFlag = true;
        this.connected = false;
        try {
            this.client?.close();
        }
        catch {
            /* ignore */
        }
        try {
            await this.backing?.close();
        }
        catch {
            /* ignore */
        }
    }
}
exports.DtlsClientTransport = DtlsClientTransport;
