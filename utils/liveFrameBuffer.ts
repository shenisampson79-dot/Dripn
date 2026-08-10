/**
 * Live frame helpers: RGBA normalization, cheap hashing, JPEG encode for cloud fill.
 * Used by the VisionCamera frame-output path (no photo capture).
 */

import { encode as encodeJpeg } from 'jpeg-js';

import { stripBase64Prefix } from '@/utils/liveFrameHash';

export type LiveFrameSample = {
  width: number;
  height: number;
  /** Raw camera buffer (may be BGRA/RGBA with row padding). */
  buffer: ArrayBuffer;
  pixelFormat: string;
  bytesPerRow?: number;
};

/** Unpack camera buffer into tightly packed RGBA (handles rgb / rgba / bgra). */
export function frameBufferToRgba(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  pixelFormat: string,
  bytesPerRow?: number,
): Uint8Array {
  const src = new Uint8Array(buffer);
  const fmt = String(pixelFormat || 'rgba').toLowerCase();
  const isBgra = fmt.includes('bgra');
  const isRgb3 = fmt === 'rgb' || (fmt.includes('rgb') && !fmt.includes('a') && !isBgra);
  const bpp = isRgb3 ? 3 : 4;
  const stride = bytesPerRow && bytesPerRow >= width * bpp ? bytesPerRow : width * bpp;
  const out = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const si = row + x * bpp;
      const di = (y * width + x) * 4;
      if (isBgra) {
        out[di] = src[si + 2] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si] ?? 0;
        out[di + 3] = src[si + 3] ?? 255;
      } else if (isRgb3) {
        out[di] = src[si] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si + 2] ?? 0;
        out[di + 3] = 255;
      } else {
        out[di] = src[si] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si + 2] ?? 0;
        out[di + 3] = src[si + 3] ?? 255;
      }
    }
  }
  return out;
}

/** Nearest-neighbour downscale so YOLO / JPEG stay cheap. */
export function downscaleRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  maxEdge = 640,
): { data: Uint8Array; width: number; height: number } {
  const maxDim = Math.max(width, height);
  if (maxDim <= maxEdge) return { data: rgba, width, height };
  const scale = maxEdge / maxDim;
  const nw = Math.max(1, Math.round(width * scale));
  const nh = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const si = (sy * width + sx) * 4;
      const di = (y * nw + x) * 4;
      out[di] = rgba[si] ?? 0;
      out[di + 1] = rgba[si + 1] ?? 0;
      out[di + 2] = rgba[si + 2] ?? 0;
      out[di + 3] = rgba[si + 3] ?? 255;
    }
  }
  return { data: out, width: nw, height: nh };
}

/** djb2-ish hash over sampled RGBA bytes (dedupe before cloud). */
export function hashRgbaFrame(rgba: Uint8Array, width: number, height: number): string {
  const len = rgba.byteLength;
  if (!len) return '';
  let h = 5381 >>> 0;
  const step = Math.max(4, Math.floor(len / 256));
  for (let i = 0; i < len; i += step) {
    h = (((h << 5) + h) ^ (rgba[i] ?? 0)) >>> 0;
  }
  h = (((h << 5) + h) ^ ((width & 0xffff) << 16) ^ (height & 0xffff)) >>> 0;
  return `${len.toString(36)}_${h.toString(16)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  // Hermes / RN provide btoa
  return globalThis.btoa(binary);
}

/** JPEG base64 (no data-URI prefix) for liveScanFrame cloud fill. */
export function encodeRgbaToJpegBase64(
  rgba: Uint8Array,
  width: number,
  height: number,
  quality = 55,
): string {
  const encoded = encodeJpeg({ data: rgba, width, height }, quality);
  const raw = encoded.data instanceof Uint8Array
    ? encoded.data
    : new Uint8Array(encoded.data as ArrayBuffer);
  return stripBase64Prefix(bytesToBase64(raw));
}
