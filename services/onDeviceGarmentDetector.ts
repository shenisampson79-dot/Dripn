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
  inspectYoloRawOutput,
  YOLO_GARMENT_CLASS_NAMES,
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
  /** Detector that produced this read (e.g. on_device_yolo, cloud_vision_correction). */
  source?: string;
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
  const tops = mode === 'top' || (!footwear && !bottoms);
  const bw = x1 - x0;
  const bh = y1 - y0;
  // Tops: sample upper-central fabric (avoid wall edges + phone strip extremes)
  // Bottoms/footwear: keep prior insets
  const insetX = footwear ? 0.22 : bottoms ? 0.1 : 0.18;
  const insetY = footwear ? 0.25 : bottoms ? 0.12 : 0.12;
  const mx0 = x0 + Math.floor(bw * insetX);
  const mx1 = x1 - Math.floor(bw * insetX);
  const my0 = y0 + Math.floor(bh * (tops ? 0.12 : insetY));
  const my1 = footwear
    ? y0 + Math.floor(bh * 0.82)
    : bottoms
      ? y0 + Math.floor(bh * 0.72)
      : tops
        ? y0 + Math.floor(bh * 0.58) // upper torso fabric only
        : y1 - Math.floor(bh * insetY);
  // Phone strip — only skip a narrow centre for tops (was too wide → wall beige)
  const centreL = x0 + Math.floor(bw * (tops ? 0.42 : 0.35));
  const centreR = x0 + Math.floor(bw * (tops ? 0.58 : 0.65));

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
      if (!footwear && !tops && x >= centreL && x <= centreR) continue;
      if (tops && x >= centreL && x <= centreR) continue;
      const i = (y * width + x) * 4;
      const pr = rgba[i] ?? 0;
      const pg = rgba[i + 1] ?? 0;
      const pb = rgba[i + 2] ?? 0;
      if (!footwear && isSkinPixel(pr, pg, pb)) continue;
      const maxC = Math.max(pr, pg, pb);
      if (!footwear && !bottoms && maxC < 48) continue;
      // True black fabric only — dim rooms made light chino shorts look "black".
      if (bottoms && maxC < 55) darkN += 1;
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
  if (bottoms && n > 0) {
    const meanLuma = (r + g + b) / (3 * n);
    // Light / mid greys must not collapse to black under warm indoor light.
    if (meanLuma >= 110) {
      /* fall through to RGB classify */
    } else if (darkN / n >= 0.55 && chromaN < Math.max(4, n * 0.15) && meanLuma < 70) {
      return 'black';
    }
  }
  // Prefer chromatic samples — teal/blue tees must not fall to beige wall average
  if (chromaN >= Math.max(3, n * 0.12)) {
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

export type YoloGuardDecision = {
  index: number;
  classId: number;
  className: string;
  confidence: number;
  bbox: [number, number, number, number];
  skinRatio: number;
  lowerSkinRatio: number;
  mappedCategory: string;
  mappedSubcategory: string;
  lockedCategory: string;
  lockedName: string;
  /** Ordered guard checks — first REJECT stops the candidate. */
  checks: Array<{ name: string; result: 'PASS' | 'REJECT' | 'SKIP'; detail: string }>;
  outcome: 'PASS' | 'REJECT';
  rejectReason: string | null;
};

/**
 * Production body-guard path with full instrumentation (thresholds unchanged).
 * Does not mutate detection behaviour — only explains nms→prod drops.
 */
export function traceBodyGuardsOnBoxes(
  boxes: ParsedYoloBox[],
  rgba: Uint8Array,
  width: number,
  height: number,
): { decisions: YoloGuardDecision[]; survivors: OnDeviceDetection[] } {
  const decisions: YoloGuardDecision[] = [];
  const survivors: OnDeviceDetection[] = [];

  boxes.forEach((box, i) => {
    const checks: YoloGuardDecision['checks'] = [];
    const skinRatio = measureSkinRatio(rgba, width, height, box.bbox);
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

    let rejectReason: string | null = null;

    if (skinRatio > SKIN_DISCARD_RATIO) {
      checks.push({
        name: 'skin_overlap',
        result: 'REJECT',
        detail: `${skinRatio.toFixed(2)} > ${SKIN_DISCARD_RATIO}`,
      });
      rejectReason = `skin_overlap ${skinRatio.toFixed(2)} > ${SKIN_DISCARD_RATIO}`;
    } else {
      checks.push({
        name: 'skin_overlap',
        result: 'PASS',
        detail: `${skinRatio.toFixed(2)} ≤ ${SKIN_DISCARD_RATIO}`,
      });
    }

    if (!rejectReason) {
      if (looksLikeFootwearBbox(box.bbox) && skinRatio >= 0.22) {
        checks.push({
          name: 'barefoot_footwear_shape',
          result: 'REJECT',
          detail: `footwear-shaped + skin ${skinRatio.toFixed(2)} ≥ 0.22`,
        });
        rejectReason = `barefoot_footwear_shape skin=${skinRatio.toFixed(2)}`;
      } else if (looksLikeFootwearBbox(box.bbox)) {
        checks.push({
          name: 'barefoot_footwear_shape',
          result: 'PASS',
          detail: `footwear-shaped but skin ${skinRatio.toFixed(2)} < 0.22`,
        });
      } else {
        checks.push({
          name: 'barefoot_footwear_shape',
          result: 'SKIP',
          detail: 'not footwear-shaped',
        });
      }
    }

    if (!rejectReason) {
      if (isBareTorsoTopLike({
        category: locked.category,
        subcategory: locked.subcategory,
        name: locked.name,
        skinRatio,
        fabricColor: colorProbe,
      })) {
        checks.push({
          name: 'bare_torso_top',
          result: 'REJECT',
          detail: `top-like + skin ${skinRatio.toFixed(2)} color=${colorProbe}`,
        });
        rejectReason = `bare_torso_top skin=${skinRatio.toFixed(2)}`;
      } else {
        checks.push({
          name: 'bare_torso_top',
          result: 'PASS',
          detail: 'not bare-torso top-like',
        });
      }
    }

    if (!rejectReason) {
      if (locked.category === 'shoes' && skinRatio >= 0.22) {
        checks.push({
          name: 'shoes_skin_roi',
          result: 'REJECT',
          detail: `shoes + skin ${skinRatio.toFixed(2)} ≥ 0.22`,
        });
        rejectReason = `shoes_skin_roi skin=${skinRatio.toFixed(2)}`;
      } else if (locked.category === 'shoes') {
        checks.push({
          name: 'shoes_skin_roi',
          result: 'PASS',
          detail: `shoes skin ${skinRatio.toFixed(2)} < 0.22`,
        });
      } else {
        checks.push({
          name: 'shoes_skin_roi',
          result: 'SKIP',
          detail: `category=${locked.category}`,
        });
      }
    }

    const decision: YoloGuardDecision = {
      index: i,
      classId: box.classId,
      className: box.className,
      confidence: Number(box.confidence.toFixed(3)),
      bbox: box.bbox,
      skinRatio: Number(skinRatio.toFixed(3)),
      lowerSkinRatio: Number(lowerSkin.toFixed(3)),
      mappedCategory: yoloMapped.category,
      mappedSubcategory: yoloMapped.subcategory,
      lockedCategory: locked.category,
      lockedName: locked.name,
      checks,
      outcome: rejectReason ? 'REJECT' : 'PASS',
      rejectReason,
    };
    decisions.push(decision);

    if (rejectReason) return;

    const isShorts = locked.subcategory === 'shorts' || /short/i.test(locked.name);
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
    survivors.push({
      name,
      category: locked.category,
      subcategory: locked.subcategory,
      color,
      confidence: box.confidence,
      bbox,
      trackId: `yolo_${locked.category}_${i}`,
      skinRatio,
      source: 'on_device_yolo',
    });
  });

  return { decisions, survivors };
}

/** Compact HUD line for TestFlight (one candidate). */
export function formatGuardDecisionHud(d: YoloGuardDecision): string {
  const [x, y, w, h] = d.bbox;
  if (d.outcome === 'PASS') {
    return `#${d.index} ${d.lockedName||d.className} ${d.confidence} PASS bbox=${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)}`;
  }
  return `#${d.index} ${d.lockedName||d.className} ${d.confidence} REJECT ${d.rejectReason} bbox=${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)} skin=${d.skinRatio}`;
}

function boxesToDetections(
  boxes: ParsedYoloBox[],
  rgba: Uint8Array,
  width: number,
  height: number,
  opts?: { bodyGuards?: boolean },
): OnDeviceDetection[] {
  /** Live worn outfits only — beige coats / tan leather flat-lays look like "skin". */
  const bodyGuards = opts?.bodyGuards !== false;
  if (bodyGuards) {
    return traceBodyGuardsOnBoxes(boxes, rgba, width, height).survivors;
  }
  const out: OnDeviceDetection[] = [];
  boxes.forEach((box, i) => {
    const skinRatio = measureSkinRatio(rgba, width, height, box.bbox);
    const lowerSkin = measureLowerSkinRatio(rgba, width, height, box.bbox);
    const colorProbe = estimateColorFromRoi(rgba, width, height, box.bbox, 'garment');
    const yoloMapped = mapYoloClassToWardrobeCategory(box.classId, box.bbox);
    const locked = resolveClassByRegionLock({
      bbox: box.bbox,
      yoloCategory: yoloMapped.category,
      yoloSubcategory: yoloMapped.subcategory,
      lowerSkinRatio: 0,
      fabricColor: colorProbe,
    });
    const isShorts = locked.subcategory === 'shorts' || /short/i.test(locked.name);
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

type DetectOpts = {
  confThreshold?: number;
  maxDetections?: number;
  /**
   * When true (default), drop skin-heavy / bare-torso boxes — for Live worn outfits.
   * Flat-lay Quick Add / Digitize must set false: beige coats read as "skin".
   */
  bodyGuards?: boolean;
};

/**
 * Run YOLO on a packed RGBA buffer (Live frame-output path — no JPEG file).
 * @returns detections or null to fall back to cloud Vision.
 */
export async function detectGarmentsFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts?: DetectOpts,
): Promise<OnDeviceDetection[] | null> {
  if (!ON_DEVICE_YOLO_NATIVE) return null;

  const model = await ensureModel();
  if (!model) return null;

  try {
    const { tensor, scale, padX, padY } = letterboxRgbToFloat32(rgba, width, height, INPUT_SIZE);
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
      // Detector ran successfully with no hits — empty array, not null.
      // null is reserved for "model/run unavailable" (cloud fallback).
      const brightness = measureBottomBandBrightness(rgba, width, height);
      lastFootZoneMeta = {
        brightness,
        visible: brightness >= FOOT_ZONE_BRIGHTNESS_MIN,
        cropped: brightness < FOOT_ZONE_BRIGHTNESS_MIN,
      };
      return [];
    }
    const brightness = measureBottomBandBrightness(rgba, width, height);
    lastFootZoneMeta = {
      brightness,
      visible: brightness >= FOOT_ZONE_BRIGHTNESS_MIN,
      cropped: brightness < FOOT_ZONE_BRIGHTNESS_MIN,
    };
    return boxesToDetections(boxes, rgba, width, height, {
      bodyGuards: opts?.bodyGuards,
    });
  } catch (err) {
    console.warn('[onDeviceYolo] rgba inference failed, falling back to cloud:', err);
    lastFootZoneMeta = null;
    return null;
  }
}

export type YoloDetectorDiag = {
  source: 'live_rgba' | 'uri' | 'reference_asset';
  model: {
    available: boolean;
    inputs: Array<{ shape: number[]; dataType: string }>;
    outputs: Array<{ shape: number[]; dataType: string }>;
    expected: string;
  };
  frame: {
    width: number;
    height: number;
    byteLength: number;
    sampleMin: number;
    sampleMax: number;
    sampleMean: number;
    nonzeroSample: number;
  };
  preprocess: {
    inputSize: number;
    scale: number;
    padX: number;
    padY: number;
    channelOrder: 'RGB';
    tensorMin: number;
    tensorMax: number;
    tensorMean: number;
    letterboxed: boolean;
  };
  rawOutput: ReturnType<typeof inspectYoloRawOutput> | null;
  counts: {
    rawAbove015: number;
    afterProdConfNms: number;
    afterBodyGuards: number;
  };
  labelMap: typeof YOLO_GARMENT_CLASS_NAMES;
  /**
   * Pre-guard production-conf NMS boxes (conf≥0.28) for coordinate overlay.
   * Labels should show PASS/REJECT — not promoted to belief.
   */
  nmsOverlayDetections: OnDeviceDetection[];
  /** Per post-NMS candidate guard trace (production thresholds unchanged). */
  guardDecisions: YoloGuardDecision[];
  /** Diagnostic boxes only (low conf, no body guards) — not production defaults. */
  diagnosticDetections: OnDeviceDetection[];
  /** Production-filtered detections. */
  productionDetections: OnDeviceDetection[];
  verdict:
    | 'model_unavailable'
    | 'run_failed'
    | 'output_near_zero'
    | 'raw_boxes_exist'
    | 'filtered_to_zero'
    | 'garments_ok';
  summary: string;
};

function sampleBufferStats(buf: Uint8Array | Float32Array, step = 64): {
  min: number;
  max: number;
  mean: number;
  nonzero: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let n = 0;
  let nonzero = 0;
  for (let i = 0; i < buf.length; i += step) {
    const v = buf[i] ?? 0;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    n += 1;
    if (v > 0) nonzero += 1;
  }
  if (!n) return { min: 0, max: 0, mean: 0, nonzero: 0 };
  return {
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    mean: Number((sum / n).toFixed(5)),
    nonzero,
  };
}

/**
 * Full detector-internal diagnostic (Milestone 2b).
 * Does NOT change production thresholds permanently — reports both diagnostic
 * and production filter stacks from one inference.
 */
export async function diagnoseYoloFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  source: YoloDetectorDiag['source'] = 'live_rgba',
): Promise<YoloDetectorDiag> {
  const expected = '1x320x320x3 float32 NHWC 0..1 letterboxed → 1x8x2100';
  const labelMap = YOLO_GARMENT_CLASS_NAMES;
  const frameStats = sampleBufferStats(rgba, 32);

  const baseFail = (
    verdict: YoloDetectorDiag['verdict'],
    summary: string,
  ): YoloDetectorDiag => ({
    source,
    model: { available: false, inputs: [], outputs: [], expected },
    frame: {
      width,
      height,
      byteLength: rgba.byteLength,
      sampleMin: frameStats.min,
      sampleMax: frameStats.max,
      sampleMean: frameStats.mean,
      nonzeroSample: frameStats.nonzero,
    },
    preprocess: {
      inputSize: INPUT_SIZE,
      scale: 0,
      padX: 0,
      padY: 0,
      channelOrder: 'RGB',
      tensorMin: 0,
      tensorMax: 0,
      tensorMean: 0,
      letterboxed: false,
    },
    rawOutput: null,
    counts: { rawAbove015: 0, afterProdConfNms: 0, afterBodyGuards: 0 },
    labelMap,
    nmsOverlayDetections: [],
    guardDecisions: [],
    diagnosticDetections: [],
    productionDetections: [],
    verdict,
    summary,
  });

  if (!ON_DEVICE_YOLO_NATIVE) {
    return baseFail('model_unavailable', 'ON_DEVICE_YOLO_NATIVE=false');
  }
  const model = await ensureModel();
  if (!model) {
    return baseFail(
      'model_unavailable',
      nativeUnavailableReason || 'ensureModel() returned null',
    );
  }

  try {
    const { tensor, scale, padX, padY } = letterboxRgbToFloat32(rgba, width, height, INPUT_SIZE);
    const tStats = sampleBufferStats(tensor, 48);
    const inputBuffer = tensor.buffer.slice(
      tensor.byteOffset,
      tensor.byteOffset + tensor.byteLength,
    );
    const outputs = await model.run([inputBuffer]);
    const outBuf = outputs?.[0];
    if (!outBuf) {
      return {
        ...baseFail('run_failed', 'model.run() returned empty output'),
        model: {
          available: true,
          inputs: model.inputs?.map((i) => ({ shape: i.shape, dataType: i.dataType })) || [],
          outputs: model.outputs?.map((o) => ({ shape: o.shape, dataType: o.dataType })) || [],
          expected,
        },
        preprocess: {
          inputSize: INPUT_SIZE,
          scale,
          padX,
          padY,
          channelOrder: 'RGB',
          tensorMin: tStats.min,
          tensorMax: tStats.max,
          tensorMean: tStats.mean,
          letterboxed: padX > 0 || padY > 0,
        },
      };
    }

    const output = new Float32Array(outBuf);
    const rawOutput = inspectYoloRawOutput(output);

    // Diagnostic path: low conf, no body guards (temporary proof only).
    const diagBoxes = parseYoloGarmentOutput(output, {
      inputSize: INPUT_SIZE,
      confThreshold: 0.15,
      maxDetections: 12,
      scale,
      padX,
      padY,
      srcWidth: width,
      srcHeight: height,
    });
    const diagnosticDetections = boxesToDetections(diagBoxes, rgba, width, height, {
      bodyGuards: false,
    });

    // Production path: default conf + traced body guards (thresholds unchanged).
    const prodBoxes = parseYoloGarmentOutput(output, {
      inputSize: INPUT_SIZE,
      confThreshold: 0.28,
      maxDetections: 8,
      scale,
      padX,
      padY,
      srcWidth: width,
      srcHeight: height,
    });
    const { decisions: guardDecisions, survivors: productionDetections } =
      traceBodyGuardsOnBoxes(prodBoxes, rgba, width, height);

    // Overlay = pre-guard NMS boxes with PASS/REJECT baked into the name.
    const nmsOverlayDetections: OnDeviceDetection[] = guardDecisions.map((d) => {
      const tag = d.outcome === 'PASS' ? 'PASS' : `REJECT:${d.rejectReason || '?'}`;
      const [x, y, w, h] = d.bbox;
      return {
        name: `${d.lockedName || d.className} ${tag}`,
        category: d.lockedCategory || d.mappedCategory || 'tops',
        subcategory: d.mappedSubcategory,
        color: d.outcome === 'PASS' ? 'green' : 'red',
        confidence: d.confidence,
        bbox: d.bbox,
        trackId: `nms_${d.index}`,
        skinRatio: d.skinRatio,
        source: 'on_device_yolo_nms_trace',
        suggestion: `bbox=${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)} skin=${d.skinRatio}`,
      };
    });

    let verdict: YoloDetectorDiag['verdict'];
    let summary: string;
    const rejectSummary = guardDecisions
      .filter((d) => d.outcome === 'REJECT')
      .map((d) => `#${d.index}:${d.rejectReason}`)
      .join('; ');
    if (rawOutput.maxScore < 0.05) {
      verdict = 'output_near_zero';
      summary = `Raw maxScore=${rawOutput.maxScore} — preprocess/model mismatch likely`;
    } else if (productionDetections.length > 0) {
      verdict = 'garments_ok';
      summary = `Production OK · ${productionDetections.length} garments`;
    } else if (prodBoxes.length > 0) {
      verdict = 'filtered_to_zero';
      summary = `NMS ${prodBoxes.length} → guard 0 · ${rejectSummary || 'no reject detail'}`;
    } else if (diagnosticDetections.length > 0 || rawOutput.above.t15 > 0) {
      verdict = 'raw_boxes_exist';
      summary = `Scores ≥0.15=${rawOutput.above.t15} but below prod conf 0.28 (max=${rawOutput.maxScore})`;
    } else {
      verdict = 'filtered_to_zero';
      summary = `Scores exist but parse→0 (max=${rawOutput.maxScore})`;
    }

    const diag: YoloDetectorDiag = {
      source,
      model: {
        available: true,
        inputs: model.inputs?.map((i) => ({ shape: i.shape, dataType: i.dataType })) || [],
        outputs: model.outputs?.map((o) => ({ shape: o.shape, dataType: o.dataType })) || [],
        expected,
      },
      frame: {
        width,
        height,
        byteLength: rgba.byteLength,
        sampleMin: frameStats.min,
        sampleMax: frameStats.max,
        sampleMean: frameStats.mean,
        nonzeroSample: frameStats.nonzero,
      },
      preprocess: {
        inputSize: INPUT_SIZE,
        scale: Number(scale.toFixed(4)),
        padX,
        padY,
        channelOrder: 'RGB',
        tensorMin: tStats.min,
        tensorMax: tStats.max,
        tensorMean: tStats.mean,
        letterboxed: padX > 0 || padY > 0,
      },
      rawOutput,
      counts: {
        rawAbove015: rawOutput.above.t15,
        afterProdConfNms: prodBoxes.length,
        afterBodyGuards: productionDetections.length,
      },
      labelMap,
      nmsOverlayDetections,
      guardDecisions,
      diagnosticDetections,
      productionDetections,
      verdict,
      summary,
    };

    console.log('[YoloDiag]', JSON.stringify({
      source: diag.source,
      modelIn: diag.model.inputs,
      modelOut: diag.model.outputs,
      frame: diag.frame,
      preprocess: diag.preprocess,
      raw: diag.rawOutput,
      counts: diag.counts,
      verdict: diag.verdict,
      summary: diag.summary,
      guards: diag.guardDecisions.map((d) => ({
        i: d.index,
        cls: d.className,
        conf: d.confidence,
        bbox: d.bbox,
        outcome: d.outcome,
        reject: d.rejectReason,
        checks: d.checks,
      })),
      top3: diag.rawOutput?.top3,
      labels: diag.labelMap,
    }));

    return diag;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'run_failed';
    console.warn('[YoloDiag] failed:', msg);
    return baseFail('run_failed', msg);
  }
}

/** Same diagnostic path from a file URI (still / wardrobe / reference JPEG). */
export async function diagnoseYoloFromUri(
  imageUri: string,
  source: YoloDetectorDiag['source'] = 'uri',
): Promise<YoloDetectorDiag> {
  try {
    const { data, width, height } = await loadRgbaFromUri(imageUri);
    return diagnoseYoloFromRgba(data, width, height, source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'uri_load_failed';
    return {
      source,
      model: { available: false, inputs: [], outputs: [], expected: '1x320x320x3 float32' },
      frame: {
        width: 0,
        height: 0,
        byteLength: 0,
        sampleMin: 0,
        sampleMax: 0,
        sampleMean: 0,
        nonzeroSample: 0,
      },
      preprocess: {
        inputSize: INPUT_SIZE,
        scale: 0,
        padX: 0,
        padY: 0,
        channelOrder: 'RGB',
        tensorMin: 0,
        tensorMax: 0,
        tensorMean: 0,
        letterboxed: false,
      },
      rawOutput: null,
      counts: { rawAbove015: 0, afterProdConfNms: 0, afterBodyGuards: 0 },
      labelMap: YOLO_GARMENT_CLASS_NAMES,
      nmsOverlayDetections: [],
      guardDecisions: [],
      diagnosticDetections: [],
      productionDetections: [],
      verdict: 'run_failed',
      summary: msg,
    };
  }
}

/** Known-good flat-lay / full-frame asset for the offline vs Live split test. */
export async function diagnoseYoloReferenceAsset(): Promise<YoloDetectorDiag> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asset = require('../assets/upload-guide/men/full-frame-good.jpg');
    const AssetMod = await import('expo-asset');
    const resolved = await AssetMod.Asset.fromModule(asset).downloadAsync();
    const uri = resolved.localUri || resolved.uri;
    if (!uri) {
      return {
        source: 'reference_asset',
        model: { available: false, inputs: [], outputs: [], expected: '1x320x320x3 float32' },
        frame: {
          width: 0, height: 0, byteLength: 0,
          sampleMin: 0, sampleMax: 0, sampleMean: 0, nonzeroSample: 0,
        },
        preprocess: {
          inputSize: INPUT_SIZE, scale: 0, padX: 0, padY: 0, channelOrder: 'RGB',
          tensorMin: 0, tensorMax: 0, tensorMean: 0, letterboxed: false,
        },
        rawOutput: null,
        counts: { rawAbove015: 0, afterProdConfNms: 0, afterBodyGuards: 0 },
        labelMap: YOLO_GARMENT_CLASS_NAMES,
        nmsOverlayDetections: [],
        guardDecisions: [],
        diagnosticDetections: [],
        productionDetections: [],
        verdict: 'run_failed',
        summary: 'Reference asset URI missing',
      };
    }
    return diagnoseYoloFromUri(uri, 'reference_asset');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'reference_asset_failed';
    return {
      source: 'reference_asset',
      model: { available: false, inputs: [], outputs: [], expected: '1x320x320x3 float32' },
      frame: {
        width: 0, height: 0, byteLength: 0,
        sampleMin: 0, sampleMax: 0, sampleMean: 0, nonzeroSample: 0,
      },
      preprocess: {
        inputSize: INPUT_SIZE, scale: 0, padX: 0, padY: 0, channelOrder: 'RGB',
        tensorMin: 0, tensorMax: 0, tensorMean: 0, letterboxed: false,
      },
      rawOutput: null,
      counts: { rawAbove015: 0, afterProdConfNms: 0, afterBodyGuards: 0 },
      labelMap: YOLO_GARMENT_CLASS_NAMES,
      nmsOverlayDetections: [],
      guardDecisions: [],
      diagnosticDetections: [],
      productionDetections: [],
      verdict: 'run_failed',
      summary: msg,
    };
  }
}

/**
 * Run on-device detection from a file URI (wardrobe / Quick Add / still paths).
 * @returns detections or null to fall back to cloud Vision.
 */
export async function detectGarmentsOnDevice(
  imageUri: string,
  opts?: DetectOpts,
): Promise<OnDeviceDetection[] | null> {
  if (!ON_DEVICE_YOLO_NATIVE) return null;
  if (!(await ensureModel())) return null;

  try {
    const { data, width, height } = await loadRgbaFromUri(imageUri);
    return detectGarmentsFromRgba(data, width, height, opts);
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
