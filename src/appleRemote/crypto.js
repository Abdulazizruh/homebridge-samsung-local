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
