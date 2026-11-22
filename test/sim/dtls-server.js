"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSimDtlsServer = startSimDtlsServer;
/**
 * In-process DTLS server for the appliance simulator.
 *
 * This is a TEST FIXTURE, not an interop oracle: it uses werift on both ends,
 * so it exercises the plugin's CoAP/OCF/registry/HomeKit layers against a
 * working DTLS peer. Foreign-peer wire interop is proven separately against
 * OpenSSL in research/interop/ (see research/DTLS-WERIFT-FINDINGS.md).
 *
 * It presents an ECDSA P-256 certificate (as the appliance does, for the
 * ECDHE-ECDSA cipher) and requests the client certificate.
 */
const node_dgram_1 = require("node:dgram");
const index_js_1 = require("werift-dtls/lib/dtls/src/index.js");
const SIG_ECDSA = { hash: 4, signature: 3 };
/** Start a one-peer DTLS server on an ephemeral UDP port. */
async function startSimDtlsServer(cert, key, fixedPort = 0) {
    const sock = (0, node_dgram_1.createSocket)("udp4");
    let peer;
    let server;
    let onDataCb = () => { };
    let resolveConnected;
    const connected = new Promise((r) => (resolveConnected = r));
    const backing = {
        type: "udp",
        address: { address: "0.0.0.0", family: "IPv4", port: 0 },
        closed: false,
        onData: (_d, _a) => { },
        send: (data) => new Promise((resolve, reject) => {
            if (!peer)
                return resolve();
            sock.send(data, peer.port, peer.address, (e) => (e ? reject(e) : resolve()));
        }),
        close: async () => {
            try {
                sock.close();
            }
            catch {
                /* ignore */
            }
        },
    };
    sock.on("message", (msg, rinfo) => {
        peer = rinfo;
        backing.onData(msg, [rinfo.address, rinfo.port]);
    });
    await new Promise((resolve, reject) => { sock.once("error", reject); sock.bind(fixedPort, () => resolve()); });
    const port = sock.address().port;
    server = new index_js_1.DtlsServer({
        transport: backing,
        cert,
        key,
        certificateRequest: true,
        signatureHash: SIG_ECDSA,
    });
    server.onConnect.subscribe(() => resolveConnected());
    server.onData.subscribe((buf) => onDataCb(buf));
    return {
        port,
        set onData(cb) {
            onDataCb = cb;
        },
        get onData() {
            return onDataCb;
        },
        send: (data) => server.send(data),
        connected,
        close: async () => {
            try {
                server?.close();
            }
            catch {
                /* ignore */
            }
            await backing.close();
        },
    };
}
