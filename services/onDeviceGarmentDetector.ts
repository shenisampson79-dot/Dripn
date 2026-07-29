/**
 * On-device garment detector (YOLOv8n clothing TFLite via react-native-fast-tflite).
 *
 * Requires a native EAS binary that links Nitro + TFLite. OTA JS on older binaries
 * feature-detects and falls back to cloud Vision — do not rely on Expo Go / OTA alone.
 *
 * Model: assets/models/garment-yolo-n320.tflite (~11.6 MB float32)
 * Source: kesimeg/yolov8n-clothing-detection (Fashionpedia 4-class) exported @ 320.
 * Classes: Clothing, Shoes, Bags, Accessories — Clothing is remapped via bbox geometry.
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import type { LiveTrackedItem } from '@/types/liveStylist';
import {
  mapYoloClassToWardrobeCategory,
  parseYoloGarmentOutput,
  type ParsedYoloBox,
} from '@/services/yoloGarmentParse';

/** Flip true once the TFLite native path ships in JS (this build). */
export const ON_DEVICE_YOLO_NATIVE = true;

export type OnDeviceDetection = {
  name?: string;
  category: string;
  subcategory?: string;
  color?: string;
  confidence: number;
  bbox: [number, number, number, number];
  suggestion?: string;
  trackId?: string;
};

const INPUT_SIZE = 320;
const MODEL_ASSET = require('../assets/models/garment-yolo-n320.tflite');

type TfLiteModel = {
  inputs: Array<{ shape: number[]; dataType: string }>;
  outputs: Array<{ shape: number[]; dataType: string }>;
  run: (inputs: ArrayBuffer[]) => Promise<ArrayBuffer[]>;
};

type LoadFn = (
  source: number | { url: string },
  delegates: Array<'core-ml' | 'metal' | 'nnapi' | 'android-gpu'>,
) => Promise<TfLiteModel>;

let loadModelFn: LoadFn | null | undefined;
let modelPromise: Promise<TfLiteModel | null> | null = null;
let nativeUnavailableReason: string | null = null;

function tryGetLoadFn(): LoadFn | null {
  if (loadModelFn !== undefined) return loadModelFn;
  if (Platform.OS === 'web') {
    loadModelFn = null;
    nativeUnavailableReason = 'On-device YOLO is not supported on web.';
    return null;
  }
  try {
    // Dynamic require: module init creates Nitro hybrid objects and throws on
    // binaries that were not rebuilt with react-native-fast-tflite.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-fast-tflite') as {
      loadTensorflowModel: LoadFn;
    };
    if (typeof mod?.loadTensorflowModel !== 'function') {
      loadModelFn = null;
      nativeUnavailableReason = 'TFLite native module missing loadTensorflowModel.';
      return null;
    }
    loadModelFn = mod.loadTensorflowModel;
    return loadModelFn;
  } catch (err) {
    loadModelFn = null;
    nativeUnavailableReason =
      err instanceof Error
        ? err.message
        : 'TFLite native module not linked in this binary.';
    return null;
  }
}

function preferredDelegates(): Array<'core-ml' | 'metal' | 'nnapi' | 'android-gpu'> {
  if (Platform.OS === 'ios') return ['core-ml'];
  if (Platform.OS === 'android') return ['nnapi'];
  return [];
}

async function ensureModel(): Promise<TfLiteModel | null> {
  if (!ON_DEVICE_YOLO_NATIVE) return null;
  const load = tryGetLoadFn();
  if (!load) return null;
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        try {
          return await load(MODEL_ASSET, preferredDelegates());
        } catch {
          // Delegate unsupported on some devices — fall back to CPU.
          return await load(MODEL_ASSET, []);
        }
      } catch (err) {
        nativeUnavailableReason =
          err instanceof Error ? err.message : 'Failed to load garment YOLO model.';
        console.warn('[onDeviceYolo] model load failed:', nativeUnavailableReason);
        return null;
      }
    })();
  }
  return modelPromise;
}

/** Prefetch TFLite weights (safe no-op when native module is missing). */
export async function warmUpOnDeviceYolo(): Promise<boolean> {
  const model = await ensureModel();
  return model != null;
}

export function isOnDeviceYoloAvailable(): boolean {
  if (!ON_DEVICE_YOLO_NATIVE || Platform.OS === 'web') return false;
  if (nativeUnavailableReason) return false;
  return tryGetLoadFn() != null;
}

export function getOnDeviceYoloStatus(): {
  available: boolean;
  reason: string;
  requiresNativeRebuild: boolean;
} {
  if (!ON_DEVICE_YOLO_NATIVE) {
    return {
      available: false,
      reason: 'On-device YOLO flag disabled in JS.',
      requiresNativeRebuild: true,
    };
  }
  if (Platform.OS === 'web') {
    return {
      available: false,
      reason: 'On-device YOLO is mobile-only.',
      requiresNativeRebuild: false,
    };
  }
  if (tryGetLoadFn() == null) {
    return {
      available: false,
      reason:
        nativeUnavailableReason ||
        'On-device YOLO is not linked in this binary. Install a new EAS build (OTA is not enough).',
      requiresNativeRebuild: true,
    };
  }
  if (nativeUnavailableReason) {
    return {
      available: false,
      reason: `On-device YOLO unavailable — ${nativeUnavailableReason}. Falling back to cloud Vision.`,
      requiresNativeRebuild: /not linked|hybrid|nitro|native/i.test(nativeUnavailableReason),
    };
  }
  return {
    available: true,
    reason: 'Native YOLO TFLite linked (garment-yolo-n320 ~11.6 MB).',
    requiresNativeRebuild: false,
  };
}

function looksLikeFootwearBbox(bbox: [number, number, number, number]): boolean {
  const [, ny, nw, nh] = bbox;
  const aspect = nh / Math.max(nw, 1e-6);
  const area = nw * nh;
  const cy = ny + nh / 2;
  const bottomHeavy = cy >= 0.34;
  const bottomTouch = ny + nh >= 0.72;
  return area >= 0.008 && area <= 0.45 && aspect >= 0.7 && aspect <= 4.6 && (bottomTouch || bottomHeavy);
}

function estimateColorFromRoi(
  rgba: Uint8Array,
  width: number,
  height: number,
  bbox: [number, number, number, number],
): string {
  const [nx, ny, nw, nh] = bbox;
  const x0 = Math.max(0, Math.floor(nx * width));
  const y0 = Math.max(0, Math.floor(ny * height));
  const x1 = Math.min(width, Math.ceil((nx + nw) * width));
  const y1 = Math.min(height, Math.ceil((ny + nh) * height));
  if (x1 <= x0 || y1 <= y0) return 'unknown';

  const footwear = looksLikeFootwearBbox(bbox);
  // Sample inside the ROI so floor edges don’t wash the colour to grey.
  const mx0 = x0 + Math.floor((x1 - x0) * 0.22);
  const mx1 = x1 - Math.floor((x1 - x0) * 0.22);
  // Footwear: avoid the bottom edge where floor often dominates.
  const my0 = footwear
    ? y0 + Math.floor((y1 - y0) * 0.25)
    : y0 + Math.floor((y1 - y0) * 0.22);
  const my1 = footwear
    ? y0 + Math.floor((y1 - y0) * 0.82)
    : y1 - Math.floor((y1 - y0) * 0.22);
  const sx0 = mx1 > mx0 ? mx0 : x0;
  const sx1 = mx1 > mx0 ? mx1 : x1;
  const sy0 = my1 > my0 ? my0 : y0;
  const sy1 = my1 > my0 ? my1 : y1;

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const stepX = Math.max(1, Math.floor((sx1 - sx0) / 18));
  const stepY = Math.max(1, Math.floor((sy1 - sy0) / 18));
  for (let y = sy0; y < sy1; y += stepY) {
    for (let x = sx0; x < sx1; x += stepX) {
      const i = (y * width + x) * 4;
      r += rgba[i] ?? 0;
      g += rgba[i + 1] ?? 0;
      b += rgba[i + 2] ?? 0;
      n += 1;
    }
  }
  if (!n) return 'unknown';
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return 'black';
  if (min > 210) return 'white';
  if (max - min < 35) {
    if (max < 90) return 'charcoal';
    if (max < 145) return 'gray';
    // Warm near-white (cream henleys on sheets) — not "light gray"
    if (min > 165 && r >= g - 5 && g >= b - 10) {
      if (r - b > 12) return 'cream';
      if (r - b > 6) return 'beige';
      return 'white';
    }
    if (min > 170) return 'white';
    return 'light gray';
  }
  if (r > g + 25 && r > b + 25) return r > 160 ? 'red' : 'burgundy';
  if (g > r + 25 && g > b + 20) return 'green';
  if (b > r + 25 && b > g + 20) return 'blue';
  if (r > 150 && g > 120 && b < 90) return 'mustard';
  if (r > 160 && g > 100 && b < 100) return 'orange';
  if (r > 140 && g < 100 && b > 120) return 'purple';
  if (r > 150 && g > 130 && b > 100) return 'beige';
  return 'multicolor';
}

function letterboxRgbToFloat32(
  rgba: Uint8Array,
  srcW: number,
  srcH: number,
  dst = INPUT_SIZE,
): { tensor: Float32Array; scale: number; padX: number; padY: number } {
  const scale = Math.min(dst / srcW, dst / srcH);
  const newW = Math.max(1, Math.round(srcW * scale));
  const newH = Math.max(1, Math.round(srcH * scale));
  const padX = Math.floor((dst - newW) / 2);
  const padY = Math.floor((dst - newH) / 2);
  const tensor = new Float32Array(dst * dst * 3);
  const fill = 114 / 255;
  tensor.fill(fill);

  for (let y = 0; y < newH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor(y / scale));
    for (let x = 0; x < newW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor(x / scale));
      const si = (srcY * srcW + srcX) * 4;
      const di = ((y + padY) * dst + (x + padX)) * 3;
      tensor[di] = (rgba[si] ?? 0) / 255;
      tensor[di + 1] = (rgba[si + 1] ?? 0) / 255;
      tensor[di + 2] = (rgba[si + 2] ?? 0) / 255;
    }
  }
  return { tensor, scale, padX, padY };
}

async function loadRgbaFromUri(imageUri: string): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
}> {
  // Downscale before decode to keep jpeg-js cheap at ~1 fps.
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 640 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const res = await fetch(resized.uri);
  const buf = await res.arrayBuffer();
  const decoded = decodeJpeg(new Uint8Array(buf), { useTArray: true });
  return {
    data: decoded.data as Uint8Array,
    width: decoded.width,
    height: decoded.height,
  };
}

function boxesToDetections(
  boxes: ParsedYoloBox[],
  rgba: Uint8Array,
  width: number,
  height: number,
): OnDeviceDetection[] {
  return boxes.map((box, i) => {
    const footwearLike = looksLikeFootwearBbox(box.bbox);
    let mapped = mapYoloClassToWardrobeCategory(box.classId, box.bbox);
    if (footwearLike) {
      mapped = { category: 'shoes', subcategory: 'shoes', name: 'Shoes' };
    }
    return {
      name: mapped.name,
      category: mapped.category,
      subcategory: mapped.subcategory,
      color: estimateColorFromRoi(rgba, width, height, box.bbox),
      confidence: footwearLike ? Math.min(0.95, box.confidence * 1.2 + 0.05) : box.confidence,
      bbox: box.bbox,
      trackId: `yolo_${mapped.category}_${i}`,
    };
  });
}

/**
 * Run on-device detection when the native plugin exists.
 * @returns detections or null to fall back to cloud Vision.
 */
export async function detectGarmentsOnDevice(
  imageUri: string,
  opts?: { confThreshold?: number; maxDetections?: number },
): Promise<OnDeviceDetection[] | null> {
  if (!ON_DEVICE_YOLO_NATIVE) return null;

  const model = await ensureModel();
  if (!model) return null;

  try {
    const { data, width, height } = await loadRgbaFromUri(imageUri);
    const { tensor, scale, padX, padY } = letterboxRgbToFloat32(data, width, height, INPUT_SIZE);
    const inputBuffer = tensor.buffer.slice(
      tensor.byteOffset,
      tensor.byteOffset + tensor.byteLength,
    );

    const outputs = await model.run([inputBuffer]);
    const outBuf = outputs?.[0];
    if (!outBuf) return null;

    const output = new Float32Array(outBuf);
    const boxes = parseYoloGarmentOutput(output, {
      inputSize: INPUT_SIZE,
      confThreshold: opts?.confThreshold,
      maxDetections: opts?.maxDetections,
      scale,
      padX,
      padY,
      srcWidth: width,
      srcHeight: height,
    });

    if (!boxes.length) {
      // Empty on-device result → let cloud Vision try (better UX than "no garments").
      return null;
    }
    return boxesToDetections(boxes, data, width, height);
  } catch (err) {
    console.warn('[onDeviceYolo] inference failed, falling back to cloud:', err);
    return null;
  }
}

/** Map on-device boxes into the live overlay item shape (client-side preview). */
export function detectionsToLiveItems(detections: OnDeviceDetection[]): LiveTrackedItem[] {
  return detections.map((d, i) => ({
    tempId: d.trackId || `yolo_${i}`,
    trackId: d.trackId || `yolo_${i}`,
    name: d.name || d.category,
    category: d.category,
    subcategory: d.subcategory || null,
    color: d.color || 'unknown',
    confidence: d.confidence,
    bbox: d.bbox,
    needsConfirm: d.confidence < 0.55,
    suggestion: d.suggestion || null,
    source: 'on_device_yolo',
  }));
}
