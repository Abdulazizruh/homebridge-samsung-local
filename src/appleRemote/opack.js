/**
 * OPACK, the compact serialisation Apple's Companion Link uses.
 * Ported from pyatv (MIT, Pierre Ståhl); see NOTICE.md in this folder.
 *
 * JavaScript values: null, boolean, number (integers; wrap in Float for a
 * double), bigint, string, Buffer, Array, plain object.
 */
export class Float {
  constructor(value) { this.value = Number(value); }
}
export class Uuid {
  constructor(bytes) { this.bytes = Buffer.from(bytes); }
}

function le(value, size) {
  const out = Buffer.alloc(size);
  out.writeBigUInt64LE !== undefined && size === 8 ? out.writeBigUInt64LE(BigInt(value)) : out.writeUIntLE(Number(value), 0, size);
  return out;
}

export function pack(data) {
  if (data === null || data === undefined) { return Buffer.from([0x04]); }
  if (typeof data === 'boolean') { return Buffer.from([data ? 1 : 2]); }
  if (data instanceof Uuid) { return Buffer.concat([Buffer.from([0x05]), data.bytes]); }
  if (data instanceof Float) {
    const out = Buffer.alloc(9); out[0] = 0x36; out.writeDoubleLE(data.value, 1); return out;
  }
  if (typeof data === 'number' && !Number.isInteger(data)) { return pack(new Float(data)); }
  if (typeof data === 'number' || typeof data === 'bigint') {
    const n = BigInt(data);
    if (n < 0n) { throw new TypeError('negative integer'); }
    if (n < 0x28n) { return Buffer.from([Number(n) + 8]); }
    if (n <= 0xffn) { return Buffer.concat([Buffer.from([0x30]), le(n, 1)]); }
    if (n <= 0xffffn) { return Buffer.concat([Buffer.from([0x31]), le(n, 2)]); }
    if (n <= 0xffffffffn) { return Buffer.concat([Buffer.from([0x32]), le(n, 4)]); }
    return Buffer.concat([Buffer.from([0x33]), le(n, 8)]);
  }
  if (typeof data === 'string') {
    const bytes = Buffer.from(data, 'utf8');
    if (bytes.length <= 0x20) { return Buffer.concat([Buffer.from([0x40 + bytes.length]), bytes]); }
    if (bytes.length <= 0xff) { return Buffer.concat([Buffer.from([0x61]), le(bytes.length, 1), bytes]); }
    if (bytes.length <= 0xffff) { return Buffer.concat([Buffer.from([0x62]), le(bytes.length, 2), bytes]); }
    return Buffer.concat([Buffer.from([0x64]), le(bytes.length, 4), bytes]);
  }
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    const bytes = Buffer.from(data);
    if (bytes.length <= 0x20) { return Buffer.concat([Buffer.from([0x70 + bytes.length]), bytes]); }
    if (bytes.length <= 0xff) { return Buffer.concat([Buffer.from([0x91]), le(bytes.length, 1), bytes]); }
    if (bytes.length <= 0xffff) { return Buffer.concat([Buffer.from([0x92]), le(bytes.length, 2), bytes]); }
    return Buffer.concat([Buffer.from([0x93]), le(bytes.length, 4), bytes]);
  }
  if (Array.isArray(data)) {
    const parts = [Buffer.from([0xd0 + Math.min(data.length, 0xf)]), ...data.map(pack)];
    if (data.length >= 0xf) { parts.push(Buffer.from([0x03])); }
    return Buffer.concat(parts);
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    const parts = [Buffer.from([0xe0 + Math.min(entries.length, 0xf)])];
    for (const [k, v] of entries) { parts.push(pack(k), pack(v)); }
    if (entries.length >= 0xf) { parts.push(Buffer.from([0x03])); }
    return Buffer.concat(parts);
  }
  throw new TypeError(`cannot pack ${typeof data}`);
}

/** Returns [value, bytesUsed]. The sender may point back at values it sent earlier in the same message. */
export function unpack(data) {
  const seen = [];
  const need = (at, n) => { if (at + n > data.length) { throw new RangeError('truncated OPACK'); } };
  const int = (at, size) => {
    need(at, size);
    if (size === 8) { const v = data.readBigUInt64LE(at); return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v; }
    return data.readUIntLE(at, size);
  };
  const read = (at, depth) => {
    if (depth > 32) { throw new RangeError('OPACK nested too deep'); }
    need(at, 1);
    const tag = data[at];
    let value; let next; let remember = true;
    if (tag === 0x01) { value = true; next = at + 1; remember = false; }
    else if (tag === 0x02) { value = false; next = at + 1; remember = false; }
    else if (tag === 0x04) { value = null; next = at + 1; remember = false; }
    else if (tag === 0x05) { need(at + 1, 16); value = new Uuid(data.subarray(at + 1, at + 17)); next = at + 17; }
    else if (tag === 0x07) { value = -1; next = at + 1; remember = false; }
    else if (tag === 0x06) { value = int(at + 1, 8); next = at + 9; }
    else if (tag >= 0x08 && tag <= 0x2f) { value = tag - 8; next = at + 1; remember = false; }
    else if (tag === 0x35) { need(at + 1, 4); value = data.readFloatLE(at + 1); next = at + 5; }
    else if (tag === 0x36) { need(at + 1, 8); value = data.readDoubleLE(at + 1); next = at + 9; }
    else if ((tag & 0xf0) === 0x30) {
      const size = 2 ** (tag & 0xf);
      if (size > 8) { throw new TypeError('unsupported integer size'); }
      value = int(at + 1, size); next = at + 1 + size;
    } else if (tag >= 0x40 && tag <= 0x60) {
      const len = tag - 0x40; need(at + 1, len);
      value = data.toString('utf8', at + 1, at + 1 + len); next = at + 1 + len;
    } else if (tag > 0x60 && tag <= 0x64) {
      const size = tag & 0xf; const len = Number(int(at + 1, size)); need(at + 1 + size, len);
      value = data.toString('utf8', at + 1 + size, at + 1 + size + len); next = at + 1 + size + len;
    } else if (tag >= 0x70 && tag <= 0x90) {
      const len = tag - 0x70; need(at + 1, len);
      value = Buffer.from(data.subarray(at + 1, at + 1 + len)); next = at + 1 + len;
    } else if (tag >= 0x91 && tag <= 0x94) {
      const size = 1 << ((tag & 0xf) - 1); const len = Number(int(at + 1, size)); need(at + 1 + size, len);
      value = Buffer.from(data.subarray(at + 1 + size, at + 1 + size + len)); next = at + 1 + size + len;
    } else if ((tag & 0xf0) === 0xd0) {
      const count = tag & 0xf; const out = []; let ptr = at + 1;
      if (count === 0xf) {
        for (;;) { need(ptr, 1); if (data[ptr] === 0x03) { ptr += 1; break; } const [v, n] = read(ptr, depth + 1); out.push(v); ptr = n; }
      } else {
        for (let i = 0; i < count; i += 1) { const [v, n] = read(ptr, depth + 1); out.push(v); ptr = n; }
      }
      value = out; next = ptr;
    } else if ((tag & 0xe0) === 0xe0) {
      const count = tag & 0xf; const out = {}; let ptr = at + 1;
      const pair = () => { const [k, n1] = read(ptr, depth + 1); const [v, n2] = read(n1, depth + 1); out[String(k)] = v; ptr = n2; };
      if (count === 0xf) {
        for (;;) { need(ptr, 1); if (data[ptr] === 0x03) { ptr += 1; break; } pair(); }
      } else {
        for (let i = 0; i < count; i += 1) { pair(); }
      }
      value = out; next = ptr;
    } else if (tag >= 0xa0 && tag <= 0xc0) {
      if (tag - 0xa0 >= seen.length) { throw new RangeError('bad OPACK reference'); }
      return [seen[tag - 0xa0].value, at + 1];
    } else if (tag >= 0xc1 && tag <= 0xc4) {
      const size = tag - 0xc0; const index = Number(int(at + 1, size));
      if (index >= seen.length) { throw new RangeError('bad OPACK reference'); }
      return [seen[index].value, at + 1 + size];
    } else {
      throw new TypeError(`unknown OPACK tag 0x${tag.toString(16)}`);
    }
    // The sender numbers every value it wrote in more than one byte, lists and dictionaries included
    // (after what they hold), each distinct wording once; a later value may point back at a number.
    if (remember && next - at > 1) {
      const bytes = data.subarray(at, next);
      if (!seen.some((x) => x.bytes.equals(bytes))) { seen.push({ bytes, value }); }
    }
    return [value, next];
  };
  return read(0, 0);
}
