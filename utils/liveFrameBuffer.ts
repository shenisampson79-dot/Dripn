/**
 * Live frame helpers: Nitro Image → RGBA, hashing, JPEG encode for cloud fill.
 */

import type { Image, PixelFormat } from 'react-native-nitro-image';

import encodeJpeg from './vendor/jpegEncoderUint8';
import { stripBase64Prefix } from '@/utils/liveFrameHash';

export type LiveRgbaFrame = {
  rgba: Uint8Array;
  width: number;
  height: number;
};

const MAX_LIVE_EDGE = 640;

function nitroPixelFormatToString(fmt: PixelFormat | string): string {
  return String(fmt || 'rgba').toLowerCase();
}

/** Unpack Nitro raw pixels into tightly packed RGBA. */
export function rawPixelsToRgba(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  pixelFormat: PixelFormat | string,
): Uint8Array {
  const src = new Uint8Array(buffer);
  const fmt = nitroPixelFormatToString(pixelFormat);
  const isBgra = fmt === 'bgra' || fmt === 'bgrx' || fmt.includes('bgra');
  const isAbgr = fmt === 'abgr' || fmt === 'xbgr';
  const isArgb = fmt === 'argb' || fmt === 'xrgb';
  const isBgr = fmt === 'bgr';
  const isRgb3 = fmt === 'rgb';
  const bpp = isRgb3 || isBgr ? 3 : 4;
  const stride = width * bpp;
  if (src.byteLength < width * height * bpp) {
    throw new Error(
      `Raw pixels too small (${src.byteLength}B for ${width}x${height} ${fmt})`,
    );
  }
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = y * stride + x * bpp;
      const di = (y * width + x) * 4;
      if (isBgra) {
        out[di] = src[si + 2] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si] ?? 0;
        out[di + 3] = src[si + 3] ?? 255;
      } else if (isAbgr) {
        out[di] = src[si + 3] ?? 0;
        out[di + 1] = src[si + 2] ?? 0;
        out[di + 2] = src[si + 1] ?? 0;
        out[di + 3] = src[si] ?? 255;
      } else if (isArgb) {
        out[di] = src[si + 1] ?? 0;
        out[di + 1] = src[si + 2] ?? 0;
        out[di + 2] = src[si + 3] ?? 0;
        out[di + 3] = src[si] ?? 255;
      } else if (isBgr) {
        out[di] = src[si + 2] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si] ?? 0;
        out[di + 3] = 255;
      } else if (isRgb3) {
        out[di] = src[si] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si + 2] ?? 0;
        out[di + 3] = 255;
      } else {
        // RGBA / RGBX
        out[di] = src[si] ?? 0;
        out[di + 1] = src[si + 1] ?? 0;
        out[di + 2] = src[si + 2] ?? 0;
        out[di + 3] = src[si + 3] ?? 255;
      }
    }
  }
  return out;
}

/**
 * Resize + extract RGBA from a Nitro Image (safe CPU path).
 * Installed nitro-image exposes sync `toRawPixelData` and async `toRawPixelDataAsync`.
 * Prefer sync so pixels are fully copied before any await/dispose boundary.
 */
export function imageToLiveRgba(image: Image, maxEdge = MAX_LIVE_EDGE): LiveRgbaFrame {
  const maxDim = Math.max(image.width, image.height);
  let working = image;
  let createdResize = false;
  if (maxDim > maxEdge) {
    const scale = maxEdge / maxDim;
    working = image.resize(
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
    );
    createdResize = true;
  }
  try {
    const raw = working.toRawPixelData(false);
    const rgba = rawPixelsToRgba(raw.buffer, raw.width, raw.height, raw.pixelFormat);
    return { rgba, width: raw.width, height: raw.height };
  } finally {
    if (createdResize) {
      try {
        working.dispose();
      } catch {
        /* ignore */
      }
    }
  }
}

/** Sample whether raw pixel bytes look non-empty (not all zeros). */
export function sampleNonZeroPixels(bytes: ArrayBuffer | Uint8Array, maxSample = 4096): number {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let nonzero = 0;
  const end = Math.min(view.byteLength, maxSample);
  for (let i = 0; i < end; i += 16) {
    if ((view[i] ?? 0) > 0) nonzero += 1;
  }
  return nonzero;
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
  // Avoid String.fromCharCode(...hugeArray) — Hermes blows the call stack on VGA frames.
  const chunk = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const end = Math.min(i + chunk, bytes.length);
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]!);
    }
  }
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa unavailable — cannot encode live JPEG');
  }
  return globalThis.btoa(binary);
}

/** JPEG base64 (no data-URI prefix) for liveScanFrame cloud fill. */
export function encodeRgbaToJpegBase64(
  rgba: Uint8Array,
  width: number,
  height: number,
  quality = 55,
): string {
  if (rgba.byteLength < width * height * 4) {
    throw new Error(`RGBA too small for ${width}x${height}`);
  }
  // Proven RGBA → JPEG via Uint8Array encoder (Hermes-safe; no Node binary globals).
  const encoded = encodeJpeg({ data: rgba, width, height }, quality);
  const raw = encoded.data instanceof Uint8Array
    ? encoded.data
    : new Uint8Array(encoded.data as ArrayBuffer);
  return stripBase64Prefix(bytesToBase64(raw));
}

/** Prefer native JPEG encode from Nitro Image when available. */
export function encodeImageToJpegBase64(image: Image, quality = 55): string {
  const enc = image.toEncodedImageData('jpg', Math.round(quality));
  const bytes = new Uint8Array(enc.buffer);
  return stripBase64Prefix(bytesToBase64(bytes));
}
