/**
 * Live JPEG encode must run in Hermes (no Node Buffer).
 * Run: npx tsx utils/liveFrameBuffer.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeRgbaToJpegBase64 } from './liveFrameBuffer';

const dir = dirname(fileURLToPath(import.meta.url));
const NODE_BUFFER_RE = /\bBuffer\.(from|alloc|concat|isBuffer)\b|globalThis\.Buffer|\bglobal\.Buffer\b/;

const encodeSources = [
  readFileSync(join(dir, 'liveFrameBuffer.ts'), 'utf8'),
  readFileSync(join(dir, 'vendor', 'jpegEncoderUint8.js'), 'utf8'),
];
for (const src of encodeSources) {
  assert.doesNotMatch(src, NODE_BUFFER_RE, 'Live JPEG encode must not reference Node Buffer');
}

const g = globalThis as typeof globalThis & { Buffer?: unknown };
const hadBuffer = Object.prototype.hasOwnProperty.call(g, 'Buffer');
const previousBuffer = g.Buffer;
delete g.Buffer;

try {
  const width = 8;
  const height = 8;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 180;
    rgba[i + 1] = 40;
    rgba[i + 2] = 40;
    rgba[i + 3] = 255;
  }
  const jpeg = encodeRgbaToJpegBase64(rgba, width, height, 55);
  assert.equal(typeof jpeg, 'string');
  assert.ok(jpeg.startsWith('/9j/'), 'JPEG SOI marker in base64');
  assert.ok(jpeg.length > 32);
  assert.equal(typeof g.Buffer, 'undefined', 'encode must not install a global Buffer');
} finally {
  if (hadBuffer) g.Buffer = previousBuffer;
}

console.log('liveFrameBuffer.test.ts: all passed');
