/** The few cryptographic pieces of the pairing and the session, on Node's own crypto. */
import crypto from 'node:crypto';

export const hkdf = (salt, info, secret) => Buffer.from(crypto.hkdfSync('sha512', secret, Buffer.from(salt), Buffer.from(info), 32));

const padNonce = (nonce) => Buffer.concat([Buffer.alloc(12 - nonce.length), nonce]);

export function seal(key, nonce, plain, aad = null) {
  const c = crypto.createCipheriv('chacha20-poly1305', key, padNonce(Buffer.from(nonce)), { authTagLength: 16 });
  if (aad) { c.setAAD(aad, { plaintextLength: plain.length }); }
  return Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
}

export function open(key, nonce, sealed, aad = null) {
  if (sealed.length < 16) { throw new RangeError('sealed data too short'); }
  const d = crypto.createDecipheriv('chacha20-poly1305', key, padNonce(Buffer.from(nonce)), { authTagLength: 16 });
  if (aad) { d.setAAD(aad, { plaintextLength: sealed.length - 16 }); }
  d.setAuthTag(sealed.subarray(sealed.length - 16));
  return Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
}

/** A counter as the 12 nonce bytes, low byte first. */
export function counterNonce(n) {
  const out = Buffer.alloc(12);
  out.writeBigUInt64LE(BigInt(n));
  return out;
}

const ED_PRIVATE = Buffer.from('302e020100300506032b657004220420', 'hex');
const ED_PUBLIC = Buffer.from('302a300506032b6570032100', 'hex');
const X_PUBLIC = Buffer.from('302a300506032b656e032100', 'hex');

export function signer(seed) {
  const key = crypto.createPrivateKey({ key: Buffer.concat([ED_PRIVATE, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
  return { publicKey: Buffer.from(publicKey), sign: (data) => crypto.sign(null, data, key) };
}

export function verify(publicKey, data, signature) {
  try {
    const key = crypto.createPublicKey({ key: Buffer.concat([ED_PUBLIC, publicKey]), format: 'der', type: 'spki' });
    return crypto.verify(null, data, key, signature);
  } catch {
    return false;
  }
}

/** A fresh key agreement for one connection. */
export function agreement() {
  const pair = crypto.generateKeyPairSync('x25519');
  return {
    publicKey: Buffer.from(pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)),
    shared: (peer) => crypto.diffieHellman({
      privateKey: pair.privateKey,
      publicKey: crypto.createPublicKey({ key: Buffer.concat([X_PUBLIC, peer]), format: 'der', type: 'spki' }),
    }),
  };
}

/** SipHash-2-4 of a message under a 16-byte key, as a 64-bit number. */
export function sipHash24(key, message) {
  const M = (1n << 64n) - 1n;
  const rotl = (x, b) => ((x << b) | (x >> (64n - b))) & M;
  const k0 = key.readBigUInt64LE(0); const k1 = key.readBigUInt64LE(8);
  let v0 = k0 ^ 0x736f6d6570736575n; let v1 = k1 ^ 0x646f72616e646f6dn;
  let v2 = k0 ^ 0x6c7967656e657261n; let v3 = k1 ^ 0x7465646279746573n;
  const round = () => {
    v0 = (v0 + v1) & M; v1 = rotl(v1, 13n) ^ v0; v0 = rotl(v0, 32n);
    v2 = (v2 + v3) & M; v3 = rotl(v3, 16n) ^ v2;
    v0 = (v0 + v3) & M; v3 = rotl(v3, 21n) ^ v0;
    v2 = (v2 + v1) & M; v1 = rotl(v1, 17n) ^ v2; v2 = rotl(v2, 32n);
  };
  const data = Buffer.from(message);
  const whole = data.length - (data.length % 8);
  for (let i = 0; i < whole; i += 8) { const m = data.readBigUInt64LE(i); v3 ^= m; round(); round(); v0 ^= m; }
  let last = BigInt(data.length & 0xff) << 56n;
  for (let i = whole; i < data.length; i += 1) { last |= BigInt(data[i]) << BigInt(8 * (i - whole)); }
  v3 ^= last; round(); round(); v0 ^= last;
  v2 ^= 0xffn; round(); round(); round(); round();
  return v0 ^ v1 ^ v2 ^ v3;
}

/**
 * The six-byte tag by which a paired phone recognises one of its own devices in a network
 * announcement without connecting to it: SipHash-2-4 of the announced data under the key
 * handed over at pairing, its low six bytes, highest first.
 */
export function authTag(key, data) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(sipHash24(key, data));
  return out.subarray(2);
}
