"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securePortsFromLinks = securePortsFromLinks;
exports.discoverSecurePorts = discoverSecurePorts;
/**
 * Local OCF secure-port discovery (no DTLS). An appliance's coaps (DTLS) port
 * varies per unit and after a power cycle; it advertises it in its plaintext
 * /oic/res directory on UDP 5683 as a "coaps://host:PORT" endpoint. This sends
 * a plaintext CoAP GET /oic/res?rt=oic.r.doxm and parses the secure port(s).
 *
 * Mirrors the reference's discover_ocf_secure_ports (unicast form). It only
 * reads a public directory; it authenticates nothing.
 */
const node_dgram_1 = require("node:dgram");
const message_1 = require("../coap/message");
const cbor_1 = require("./cbor");
const DISCOVERY_PORT = 5683;
/** Parse coaps ports out of an /oic/res link array. */
function securePortsFromLinks(links) {
    const ports = new Set();
    const arr = Array.isArray(links) ? links : [];
    for (const link of arr) {
        for (const ep of link.eps ?? []) {
            const m = typeof ep.ep === "string" && /^coaps:\/\/.*:(\d+)$/.exec(ep.ep);
            if (m) {
                const port = Number(m[1]);
                if (port > 0 && port < 65536)
                    ports.add(port);
            }
        }
    }
    return [...ports];
}
/**
 * Discover an appliance's DTLS secure port(s) by reading its plaintext
 * /oic/res. Returns candidate ports (unauthenticated — still probe/verify
 * before trusting). Resolves [] if nothing answers in time.
 */
function discoverSecurePorts(host, opts = {}) {
    const port = opts.discoveryPort ?? DISCOVERY_PORT;
    const timeoutMs = opts.timeoutMs ?? 3000;
    return new Promise((resolve) => {
        const sock = (0, node_dgram_1.createSocket)("udp4");
        const found = new Set();
        const token = Buffer.from([0x0d, 0x15]);
        let done = false;
        const finish = () => {
            if (done)
                return;
            done = true;
            try {
                sock.close();
            }
            catch {
                /* ignore */
            }
            resolve([...found]);
        };
        sock.on("message", (msg) => {
            try {
                const m = (0, message_1.decode)(msg);
                if (m.token.equals(token) && m.code >> 5 === 2) {
                    for (const p of securePortsFromLinks((0, cbor_1.decodeCbor)(m.payload ?? Buffer.alloc(0))))
                        found.add(p);
                }
            }
            catch {
                /* ignore malformed */
            }
        });
        sock.on("error", finish);
        sock.bind(0, () => {
            const req = (0, message_1.encode)({
                type: message_1.CoapType.NON,
                code: message_1.Code.GET,
                messageId: Math.floor(Math.random() * 0xffff),
                token,
                options: [
                    ...(0, message_1.pathOptions)(["oic", "res"]),
                    ...(0, message_1.queryOptions)(["rt=oic.r.doxm"]),
                    { number: message_1.Opt.ACCEPT, value: Buffer.from([message_1.ContentFormat.CBOR]) },
                ],
            });
            sock.send(req, port, host, () => { });
        });
        setTimeout(finish, timeoutMs);
    });
}
