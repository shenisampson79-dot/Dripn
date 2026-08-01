/**
 * On-device garment detector (YOLOv8n clothing TFLite via react-native-fast-tflite).
 *
 * Requires a native EAS binary that links Nitro + TFLite. OTA JS on older binaries
 * feature-detects and falls back to cloud Vision — do not rely on Expo Go / OTA alone.
 *
 * Production model: assets/models/garment-yolo-n320.tflite
 *   = Fashionpedia 4-class (kesimeg/yolov8n-clothing-detection @ 320). Backup twin:
 *   garment-yolo-n320.fashionpedia.bak.tflite
 *
 * Do NOT ship shop-window fine-tunes until shoes recall / mAP50 are competitive.
 * Experimental weights (if present): garment-yolo-n320.shopwindows.experimental.tflite
 *
 * Classes: Clothing, Shoes, Bags, Accessories — Clothing is remapped via bbox geometry.
 * Hybrid layer (utils/outfitAutoAnalysisPipeline) recovers missed shoes after inference.
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import type { LiveTrackedItem } from '@/types/liveStylist';
import {
  looksLikeFootwearBbox,
  mapYoloClassToWardrobeCategory,
  parseYoloGarmentOutput,
  type ParsedYoloBox,
} from '@/services/yoloGarmentParse';
import {
  SKIN_DISCARD_RATIO,
  classifyColorFromRgb,
  clipShortsBbox,
  formatGarmentDisplayName,
  isBareTorsoTopLike,
  isFloorLengthTrousersEvidence,
  isSkinPixel,
  measureBottomBandBrightness,
  measureLowerSkinRatio,
  measureSkinRatio,
  resolveClassByRegionLock,
} from '@/utils/bodyGeometryGuardrails';
import { FOOT_ZONE_BRIGHTNESS_MIN } from '@/utils/liveFootwearGate';

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
  /** Skin fraction in ROI — used by footwear barefoot gate. */
  skinRatio?: number;
};

export type OnDeviceFootZoneMeta = {
  brightness: number;
  visible: boolean;
  cropped: boolean;
};

let lastFootZoneMeta: OnDeviceFootZoneMeta | null = null;

export function getLastOnDeviceFootZone(): OnDeviceFootZoneMeta | null {
  return lastFootZoneMeta;
}

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

type ColorSampleMode = 'top' | 'bottom' | 'footwear' | 'garment';

function estimateColorFromRoi(
  rgba: Uint8Array,
  width: number,
  height: number,
  bbox: [number, number, number, number],
  mode: ColorSampleMode = 'garment',
): string {
  const [nx, ny, nw, nh] = bbox;
  const x0 = Math.max(0, Math.floor(nx * width));
  const y0 = Math.max(0, Math.floor(ny * height));
  const x1 = Math.min(width, Math.ceil((nx + nw) * width));
  const y1 = Math.min(height, Math.ceil((ny + nh) * height));
  if (x1 <= x0 || y1 <= y0) return 'other';

  const footwear = mode === 'footwear' || looksLikeFootwearBbox(bbox);
  const bottoms = mode === 'bottom' || (!footwear && ny + nh * 0.5 > 0.52);
  const bw = x1 - x0;
  const bh = y1 - y0;
  // Avoid centre (phone occlusion on mirror selfies) — sample side bands for tops
  const insetX = footwear ? 0.22 : bottoms ? 0.1 : 0.12;
  const insetY = footwear ? 0.25 : bottoms ? 0.12 : 0.22;
  const mx0 = x0 + Math.floor(bw * insetX);
  const mx1 = x1 - Math.floor(bw * insetX);
  // Bottoms: bias to upper fabric (avoid ankles / carpet)
  const my0 = y0 + Math.floor(bh * insetY);
  const my1 = footwear
    ? y0 + Math.floor(bh * 0.82)
    : bottoms
      ? y0 + Math.floor(bh * 0.72)
      : y1 - Math.floor(bh * insetY);
  const centreL = x0 + Math.floor(bw * 0.35);
  const centreR = x0 + Math.floor(bw * 0.65);

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  let chromaN = 0;
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let darkN = 0;
  const stepX = Math.max(1, Math.floor((mx1 - mx0) / 18));
  const stepY = Math.max(1, Math.floor((my1 - my0) / 18));
  for (let y = my0; y < my1; y += stepY) {
    for (let x = mx0; x < mx1; x += stepX) {
      // Skip centre vertical band on garment boxes (phone / hands)
      if (!footwear && x >= centreL && x <= centreR) continue;
      const i = (y * width + x) * 4;
      const pr = rgba[i] ?? 0;
      const pg = rgba[i + 1] ?? 0;
      const pb = rgba[i + 2] ?? 0;
      if (!footwear && isSkinPixel(pr, pg, pb)) continue;
      const maxC = Math.max(pr, pg, pb);
      // Tops only: skip near-black (phone / shadow). Bottoms need those samples
      // or black/grey shorts collapse to "other" / no colour.
      if (!footwear && !bottoms && maxC < 48) continue;
      if (bottoms && maxC < 90) darkN += 1;
      r += pr;
      g += pg;
      b += pb;
      n += 1;
      const chroma = maxC - Math.min(pr, pg, pb);
      if (chroma > 40) {
        cr += pr;
        cg += pg;
        cb += pb;
        chromaN += 1;
      }
    }
  }
  if (!n && !chromaN) return 'other';
  // Dark shorts / trousers: majority near-black fabric → black (not carpet beige)
  if (bottoms && n > 0 && darkN / n >= 0.45 && chromaN < Math.max(4, n * 0.2)) {
    return 'black';
  }
  // Prefer chromatic samples when available (true garment hue over shadow)
  if (chromaN >= Math.max(4, n * 0.15)) {
    return classifyColorFromRgb(
      Math.round(cr / chromaN),
      Math.round(cg / chromaN),
      Math.round(cb / chromaN),
    );
  }
  return classifyColorFromRgb(
    Math.round(r / n),
    Math.round(g / n),
    Math.round(b / n),
  );
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
  const out: OnDeviceDetection[] = [];
  boxes.forEach((box, i) => {
    // Discard skin-dominated boxes — arms AND bare feet (never "shoes")
    const skinRatio = measureSkinRatio(rgba, width, height, box.bbox);
    if (skinRatio > SKIN_DISCARD_RATIO) {
      return;
    }
    // Extra bare-foot guard: footwear-shaped but still mostly skin
    if (looksLikeFootwearBbox(box.bbox) && skinRatio >= 0.22) {
      return;
    }

    const lowerSkin = measureLowerSkinRatio(rgba, width, height, box.bbox);
    const colorProbe = estimateColorFromRoi(rgba, width, height, box.bbox, 'garment');
    const yoloMapped = mapYoloClassToWardrobeCategory(box.classId, box.bbox);
    const locked = resolveClassByRegionLock({
      bbox: box.bbox,
      yoloCategory: yoloMapped.category,
      yoloSubcategory: yoloMapped.subcategory,
      lowerSkinRatio: lowerSkin,
      fabricColor: colorProbe,
    });
    // Bare torso / arms must never lock as a Top (swim / topless looks)
    if (isBareTorsoTopLike({
      category: locked.category,
      subcategory: locked.subcategory,
      name: locked.name,
      skinRatio,
      fabricColor: colorProbe,
    })) {
      return;
    }
    // Geometry said shoes but ROI is skin → drop
    if (locked.category === 'shoes' && skinRatio >= 0.22) {
      return;
    }
    // Never soft-boost shoe confidence — barefoot false positives looked "locked"
    const isShorts = locked.subcategory === 'shorts' || /short/i.test(locked.name);
    // Only clip after confirmed shorts — never clip a floor-length trousers box
    const bbox = isShorts && !isFloorLengthTrousersEvidence(box.bbox)
      ? clipShortsBbox(box.bbox)
      : box.bbox;
    const sampleMode: ColorSampleMode =
      locked.category === 'shoes'
        ? 'footwear'
        : locked.category === 'bottoms'
          ? 'bottom'
          : 'top';
    const color = estimateColorFromRoi(rgba, width, height, bbox, sampleMode);
    const name = formatGarmentDisplayName({
      color,
      category: locked.category,
      subcategory: locked.subcategory,
      fallbackName: locked.name,
    });
    out.push({
      name,
      category: locked.category,
      subcategory: locked.subcategory,
      color,
      confidence: box.confidence,
      bbox,
      trackId: `yolo_${locked.category}_${i}`,
      skinRatio,
    });
  });
  return out;
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
      const brightness = measureBottomBandBrightness(data, width, height);
      lastFootZoneMeta = {
        brightness,
        visible: brightness >= FOOT_ZONE_BRIGHTNESS_MIN,
        cropped: brightness < FOOT_ZONE_BRIGHTNESS_MIN,
      };
      return null;
    }
    const brightness = measureBottomBandBrightness(data, width, height);
    lastFootZoneMeta = {
      brightness,
      visible: brightness >= FOOT_ZONE_BRIGHTNESS_MIN,
      cropped: brightness < FOOT_ZONE_BRIGHTNESS_MIN,
    };
    return boxesToDetections(boxes, data, width, height);
  } catch (err) {
    console.warn('[onDeviceYolo] inference failed, falling back to cloud:', err);
    lastFootZoneMeta = null;
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
