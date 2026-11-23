/** TLV8 as used by the pairing handshakes (the same layout as HomeKit's). */
export const Tlv = { Method: 0, Identifier: 1, Salt: 2, PublicKey: 3, Proof: 4, EncryptedData: 5, SeqNo: 6, Error: 7, BackOff: 8, Signature: 10, Info: 17, Flags: 27 };
export const TlvError = { Authentication: 2, BackOff: 3, MaxPeers: 4, Unavailable: 6 };

export function readTlv(data) {
  const out = new Map();
  let at = 0;
  while (at + 2 <= data.length) {
    const tag = data[at]; const len = data[at + 1];
    if (at + 2 + len > data.length) { throw new RangeError('truncated TLV'); }
    const piece = data.subarray(at + 2, at + 2 + len);
    out.set(tag, out.has(tag) ? Buffer.concat([out.get(tag), piece]) : Buffer.from(piece));
    at += 2 + len;
  }
  return out;
}

export function writeTlv(items) {
  const parts = [];
  for (const [tag, raw] of items instanceof Map || Array.isArray(items) ? items : Object.entries(items)) {
    const value = Buffer.from(raw);
    let at = 0;
    do {
      const piece = value.subarray(at, at + 255);
      parts.push(Buffer.from([Number(tag), piece.length]), piece);
      at += 255;
    } while (at < value.length);
  }
  return Buffer.concat(parts);
}
