/** Redaction for logs and diagnostics. Keeps the shape of the data so a
 * resource can still be supported later, and drops what identifies a home. */

const SECRET_KEY = /(serial|duid|mac|ssid|password|passwd|token|secret|psk|private|email|account|deviceid|presence|location|latitude|longitude|address|bssid|\bip\b|hostname)/i;
const MAC = /\b[0-9a-f]{2}([:-])[0-9a-f]{2}(\1[0-9a-f]{2}){4}\b/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const PEM = /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g;

export const REDACTED = '**REDACTED**';

export function redactString(text) {
  return String(text)
    .replace(PEM, REDACTED)
    .replace(MAC, REDACTED)
    .replace(UUID, REDACTED)
    .replace(IPV4, REDACTED);
}

export function redact(value, key = '') {
  if (value === null || value === undefined) {
    return value;
  }
  if (key && SECRET_KEY.test(key) && typeof value !== 'object') {
    return REDACTED;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, key));
  }
  if (typeof value === 'object') {
    if ('$bytes' in value) {
      return REDACTED;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redact(v, k);
    }
    return out;
  }
  return value;
}

/** Short, stable, non-reversible label for a device id in logs. */
export function shortId(id) {
  return id ? `…${String(id).slice(-6)}` : 'unknown';
}
