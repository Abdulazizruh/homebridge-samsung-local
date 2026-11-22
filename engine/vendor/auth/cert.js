"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLIENT_UUID = void 0;
exports.assertValidUuid = assertValidUuid;
exports.mintClientCertificate = mintClientCertificate;
exports.mintEcdsaServerCertificate = mintEcdsaServerCertificate;
/**
 * Client-certificate minting for the Samsung OCF certificate auth path.
 *
 * A compatible appliance authorizes a client by the UUID in its certificate
 * Subject (the appliance's on-device ACL grants that UUID), not by the signer:
 * a self-signed leaf works. This mirrors the reference setup_cert.py default
 * (self-signed; UUID is a published constant). Nothing here contacts an
 * appliance or the Samsung cloud — the key and leaf are generated locally.
 *
 * See research/DTLS-WERIFT-FINDINGS.md and the upstream certificates.md.
 */
const x509 = __importStar(require("@peculiar/x509"));
const node_crypto_1 = require("node:crypto");
// Node's WebCrypto; cast through unknown because @peculiar/x509 and the
// WebCrypto algorithm params are typed against the DOM "Crypto" lib, which
// this (DOM-free) tsconfig deliberately does not include.
const crypto = node_crypto_1.webcrypto;
x509.cryptoProvider.set(node_crypto_1.webcrypto);
/**
 * The published cloud-service identity UUID that compatible appliances' ACLs
 * grant `perm=31` on `href=*`. It is the constant `CLIENT_UUID` in the
 * reference setup_cert.py (upstream docs/certificates.md explains why rotating
 * it is infeasible for Samsung). TizenRT's IoTivity locates the peer UUID with
 * `memmem(subject, "uuid:")`, so the UUID must appear as `uuid:<uuid>` in the
 * subject DN. Override per-install if a device needs a different authorized UUID.
 */
exports.DEFAULT_CLIENT_UUID = "ab0b0ac4-aae9-4958-a04d-8ec36fe1b2f9";
function pemBlock(label, der) {
    const b64 = Buffer.from(der).toString("base64").replace(/(.{64})/g, "$1\n").replace(/\n$/, "");
    return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}
/**
 * Mint an RSA-2048 self-signed client certificate carrying `uuid` in the
 * subject (OU + CN) and a SAN URI, the way the reference does. Returns PEM
 * cert + PKCS#8 key. Deterministic in structure, random in key material.
 */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Throws on a non-UUID string, so it can never reach a certificate subject or a file path. */
function assertValidUuid(uuid) {
    if (!UUID_RE.test(uuid))
        throw new Error("invalid appliance UUID (expected 8-4-4-4-12 hex): " + JSON.stringify(uuid));
}
async function mintClientCertificate(uuid) {
    assertValidUuid(uuid);
    const alg = {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    };
    const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
    // Subject + SAN mirror the reference setup_cert.py exactly: the UUID appears
    // as "uuid:<uuid>" in OU (found by memmem), with urn:/uri:/bare SAN URIs.
    const name = `OU=uuid:${uuid}, CN=urn:uuid:${uuid}`;
    const cert = await x509.X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name,
        notBefore: new Date(Date.now() - 24 * 3600 * 1000),
        notAfter: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000),
        signingAlgorithm: alg,
        keys: keys,
        extensions: [
            new x509.SubjectAlternativeNameExtension([
                { type: "url", value: `urn:uuid:${uuid}` },
                { type: "url", value: `uri:uuid:${uuid}` },
                { type: "url", value: `uuid:${uuid}` },
            ]),
        ],
    });
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
    return { certPem: cert.toString("pem") + "\n", keyPem: pemBlock("PRIVATE KEY", pkcs8), uuid };
}
/**
 * Mint an ECDSA P-256 self-signed certificate. Used by the test simulator to
 * stand in for the appliance's server certificate (the appliance presents an
 * ECDSA leaf; the ECDHE-ECDSA cipher requires it). Not used at runtime.
 */
async function mintEcdsaServerCertificate(cn = "appliance") {
    const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
    const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
    const cert = await x509.X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: `C=KR, O=Samsung Electronics, OU=OCF HA Device, CN=${cn}`,
        notBefore: new Date(Date.now() - 24 * 3600 * 1000),
        notAfter: new Date(Date.now() + 2 * 24 * 3600 * 1000),
        signingAlgorithm: alg,
        keys: keys,
    });
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
    return { certPem: cert.toString("pem") + "\n", keyPem: pemBlock("PRIVATE KEY", pkcs8) };
}
