/**
 * Cheap frame fingerprint for client-side dedupe before network calls.
 * Not cryptographic — good enough to skip near-identical sampled JPEGs.
 */

export function stripBase64Prefix(value: string): string {
  if (!value) return '';
  const idx = value.indexOf('base64,');
  return idx >= 0 ? value.slice(idx + 7) : value;
}

/** djb2-ish hash over sampled characters of a base64 JPEG. */
export function hashBase64Frame(base64: string): string {
  const raw = stripBase64Prefix(base64);
  if (!raw) return '';
  const len = raw.length;
  let h = 5381 >>> 0;
  // Sample head, mid, tail to stay cheap on large payloads
  const step = Math.max(1, Math.floor(len / 256));
  for (let i = 0; i < len; i += step) {
    h = (((h << 5) + h) ^ raw.charCodeAt(i)) >>> 0;
  }
  h = (((h << 5) + h) ^ (len & 0xffff)) >>> 0;
  return `${len.toString(36)}_${h.toString(16)}`;
}

/** True when frames are effectively unchanged. */
export function framesLikelySame(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}
