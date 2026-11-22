"use strict";
/**
 * CoAP message wire codec — RFC 7252 (binary header + options + payload).
 *
 * Scope: exactly what a Samsung OCF appliance client needs. Encodes/decodes a
 * single CoAP message over a datagram (DTLS carries it). Block-wise, Observe
 * and request pacing live in CoapSession; this file is only the wire format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentFormat = exports.Opt = exports.codeClass = exports.codeString = exports.mkCode = exports.Code = exports.CoapType = void 0;
exports.encode = encode;
exports.decode = decode;
exports.uintToBuf = uintToBuf;
exports.bufToUint = bufToUint;
exports.blockValue = blockValue;
exports.blockFields = blockFields;
exports.pathOptions = pathOptions;
exports.queryOptions = queryOptions;
/** CoAP message type (2-bit T field). */
var CoapType;
(function (CoapType) {
    CoapType[CoapType["CON"] = 0] = "CON";
    CoapType[CoapType["NON"] = 1] = "NON";
    CoapType[CoapType["ACK"] = 2] = "ACK";
    CoapType[CoapType["RST"] = 3] = "RST";
})(CoapType || (exports.CoapType = CoapType = {}));
/** Method/response codes as class*32 + detail (the 8-bit Code field). */
exports.Code = {
    EMPTY: 0,
    GET: 1, // 0.01
    POST: 2, // 0.02
    PUT: 3, // 0.03
    DELETE: 4, // 0.04
};
/** Build a response code from class.detail, e.g. mkCode(2,5) === 2.05 Content. */
const mkCode = (klass, detail) => (klass << 5) | detail;
exports.mkCode = mkCode;
/** Human form "c.dd" of a code byte, e.g. 69 -> "2.05". */
const codeString = (code) => `${code >> 5}.${(code & 0x1f).toString().padStart(2, "0")}`;
exports.codeString = codeString;
const codeClass = (code) => code >> 5;
exports.codeClass = codeClass;
/** Option numbers used by OCF/CoAP (RFC 7252 + 7641 + 7959). */
exports.Opt = {
    IF_MATCH: 1,
    URI_HOST: 3,
    ETAG: 4,
    IF_NONE_MATCH: 5,
    OBSERVE: 6, // RFC 7641
    URI_PORT: 7,
    LOCATION_PATH: 8,
    URI_PATH: 11,
    CONTENT_FORMAT: 12,
    MAX_AGE: 14,
    URI_QUERY: 15,
    ACCEPT: 17,
    LOCATION_QUERY: 20,
    BLOCK2: 23, // RFC 7959
    BLOCK1: 27, // RFC 7959
    SIZE2: 28,
    PROXY_URI: 35,
    SIZE1: 60,
};
/** OCF content format identifiers (CoAP Content-Format option values). */
exports.ContentFormat = {
    // application/cbor (RFC 7049) is 60; OCF also uses 10000 (application/vnd.ocf+cbor).
    CBOR: 60,
    OCF_CBOR: 10000,
};
const PAYLOAD_MARKER = 0xff;
function encodeExt(value) {
    if (value < 13)
        return { nibble: value, ext: Buffer.alloc(0) };
    if (value < 269)
        return { nibble: 13, ext: Buffer.from([value - 13]) };
    const ext = Buffer.alloc(2);
    ext.writeUInt16BE(value - 269, 0);
    return { nibble: 14, ext };
}
/** Encode a CoAP message to a single datagram buffer. */
function encode(msg) {
    if (msg.token.length > 8)
        throw new Error("CoAP token too long (>8)");
    const parts = [];
    const header = Buffer.alloc(4);
    header[0] = (1 << 6) | ((msg.type & 0x3) << 4) | (msg.token.length & 0x0f);
    header[1] = msg.code & 0xff;
    header.writeUInt16BE(msg.messageId & 0xffff, 2);
    parts.push(header, Buffer.from(msg.token));
    // Options must be encoded in ascending option-number order (delta coding).
    const opts = [...msg.options].sort((a, b) => a.number - b.number);
    let last = 0;
    for (const o of opts) {
        if (o.number < last)
            throw new Error("options not sorted");
        const delta = encodeExt(o.number - last);
        const len = encodeExt(o.value.length);
        const head = Buffer.from([(delta.nibble << 4) | len.nibble]);
        parts.push(head, delta.ext, len.ext, o.value);
        last = o.number;
    }
    if (msg.payload && msg.payload.length > 0) {
        parts.push(Buffer.from([PAYLOAD_MARKER]), msg.payload);
    }
    return Buffer.concat(parts);
}
function readExt(nibble, buf, pos) {
    if (nibble < 13)
        return nibble;
    if (nibble === 13) {
        const v = buf[pos.i] + 13;
        pos.i += 1;
        return v;
    }
    if (nibble === 14) {
        const v = buf.readUInt16BE(pos.i) + 269;
        pos.i += 2;
        return v;
    }
    throw new Error("reserved option nibble 15");
}
/** Decode a single CoAP datagram. Throws on malformed input. */
function decode(buf) {
    if (buf.length < 4)
        throw new Error("CoAP message too short");
    const version = buf[0] >> 6;
    if (version !== 1)
        throw new Error(`unsupported CoAP version ${version}`);
    const type = (buf[0] >> 4) & 0x3;
    const tkl = buf[0] & 0x0f;
    if (tkl > 8)
        throw new Error("invalid token length");
    const code = buf[1];
    const messageId = buf.readUInt16BE(2);
    const pos = { i: 4 };
    if (buf.length < pos.i + tkl)
        throw new Error("truncated token");
    const token = buf.subarray(pos.i, pos.i + tkl);
    pos.i += tkl;
    const options = [];
    let optNumber = 0;
    let payload;
    while (pos.i < buf.length) {
        const b = buf[pos.i];
        if (b === PAYLOAD_MARKER) {
            pos.i += 1;
            payload = buf.subarray(pos.i);
            if (payload.length === 0)
                throw new Error("payload marker with empty payload");
            break;
        }
        pos.i += 1;
        const deltaNibble = b >> 4;
        const lenNibble = b & 0x0f;
        const delta = readExt(deltaNibble, buf, pos);
        const length = readExt(lenNibble, buf, pos);
        optNumber += delta;
        if (buf.length < pos.i + length)
            throw new Error("truncated option value");
        options.push({ number: optNumber, value: Buffer.from(buf.subarray(pos.i, pos.i + length)) });
        pos.i += length;
    }
    return { type, code, messageId, token: Buffer.from(token), options, payload };
}
/** Big-endian minimal-length unsigned encoding used by CoAP uint options. */
function uintToBuf(n) {
    if (n === 0)
        return Buffer.alloc(0);
    const bytes = [];
    let v = n;
    while (v > 0) {
        bytes.unshift(v & 0xff);
        v = Math.floor(v / 256);
    }
    return Buffer.from(bytes);
}
function bufToUint(b) {
    let v = 0;
    for (const byte of b)
        v = v * 256 + byte;
    return v;
}
/** Encode an RFC 7959 Block option value (num,more,szx) with minimal length. */
function blockValue(num, more, szx) {
    const v = (num << 4) | ((more ? 1 : 0) << 3) | (szx & 7);
    if (v <= 0xff)
        return Buffer.from([v]);
    if (v <= 0xffff) {
        const b = Buffer.alloc(2);
        b.writeUInt16BE(v, 0);
        return b;
    }
    const b = Buffer.alloc(4);
    b.writeUInt32BE(v, 0);
    return b.subarray(1); // 3-byte max per RFC 7959
}
/** Decode a Block option value → {num, more, szx}. Empty ⇒ block 0. */
function blockFields(value) {
    const v = bufToUint(value);
    return { num: v >> 4, more: ((v >> 3) & 1) === 1, szx: v & 0x07 };
}
/** Convenience: Uri-Path options from path segments (no leading slash). */
function pathOptions(segments) {
    return segments.map((s) => ({ number: exports.Opt.URI_PATH, value: Buffer.from(s, "utf8") }));
}
function queryOptions(queries) {
    return queries.map((q) => ({ number: exports.Opt.URI_QUERY, value: Buffer.from(q, "utf8") }));
}
