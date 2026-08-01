/**
 * Quick Add capture pipeline — perception system, not a blocking processor.
 *
 * Fast path: crop → vision (≤2s race) → UI tags
 * Async: YOLO refine only if no snap box; rembg never blocks UI
 */

import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

import { apiService } from '@/services/ApiService';
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import {
  detectGarmentsOnDeviceHybrid,
  SINGLE_ITEM_HYBRID_OPTS,
} from '@/utils/onDeviceHybridDetect';
import {
  QUICK_ADD_CAPTURE,
  addPadding,
  bboxFromTuple,
  bboxToTuple,
  paddingForBBox,
  paddingForCategory,
  selectBestDetection,
  type QuickAddBBox,
  type QuickAddYoloDetection,
} from '@/utils/quickAddAutoCapture';
import {
  QUICK_ADD_VISION_TIMEOUT_MS,
  pickVisionFields,
  resolveQuickAddCategory,
  type PerceptionBBox,
} from '@/utils/quickAddPerception';

export type CapturePipelineResult = {
  imageUri: string;
  imageBase64?: string;
  cropped: boolean;
  categoryHint?: string;
  detectionConfidence?: number;
  analysis: any;
  /** True when tags came from timeout / local heuristic before vision finished. */
  provisional?: boolean;
};

export type ProcessQuickAddOptions = {
  /** Default false — rembg is background-only via onBackgroundReady. */
  removeBackground?: boolean;
  /** Called when rembg finishes (never delays tags). */
  onBackgroundReady?: (imageUri: string) => void;
  /** Called when a late vision result refines provisional tags. */
  onPartial?: (result: CapturePipelineResult) => void;
  visionTimeoutMs?: number;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, ms);
    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
  });
}

export async function cropNormalizedRegion(
  imageUri: string,
  bbox: QuickAddBBox,
  opts?: { padding?: number; maxWidth?: number; compress?: number },
): Promise<{ uri: string; base64?: string } | null> {
  try {
    const pad = opts?.padding ?? paddingForBBox(bbox);
    const padded = addPadding(bbox, pad);
    let width = 0;
    let height = 0;
    try {
      const size = await getImageSize(imageUri);
      width = size.width;
      height = size.height;
    } catch {
      const meta = await ImageManipulator.manipulateAsync(imageUri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });
      width = meta.width || 1024;
      height = meta.height || 1024;
    }

    const originX = Math.max(0, Math.floor(padded.x * width));
    const originY = Math.max(0, Math.floor(padded.y * height));
    const cropW = Math.max(8, Math.min(width - originX, Math.floor(padded.width * width)));
    const cropH = Math.max(8, Math.min(height - originY, Math.floor(padded.height * height)));

    const cropped = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { crop: { originX, originY, width: cropW, height: cropH } },
        { resize: { width: opts?.maxWidth ?? 800 } },
      ],
      {
        compress: opts?.compress ?? 0.78,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    return { uri: cropped.uri, base64: cropped.base64 || undefined };
  } catch {
    return null;
  }
}

async function resolveDetection(
  photoUri: string,
  detection?: QuickAddYoloDetection | null,
): Promise<QuickAddYoloDetection | null> {
  if (detection?.bbox) return detection;
  try {
    const onDevice = await detectGarmentsOnDeviceHybrid(photoUri, {
      ...SINGLE_ITEM_HYBRID_OPTS,
    });
    if (!onDevice?.length) return null;
    const mapped: QuickAddYoloDetection[] = onDevice.map((d) => ({
      class: d.category || d.name || 'clothing',
      confidence: d.confidence,
      bbox: bboxFromTuple(d.bbox),
    }));
    return selectBestDetection(mapped);
  } catch {
    return null;
  }
}

function bboxPerception(d: QuickAddYoloDetection | null): PerceptionBBox | null {
  if (!d?.bbox) return null;
  return { x: d.bbox.x, y: d.bbox.y, w: d.bbox.width, h: d.bbox.height };
}

function buildTaggedAnalysis(
  analysis: any,
  resolved: QuickAddYoloDetection | null,
  categoryHint: string,
): any {
  const vision = pickVisionFields(analysis || {});
  const base = analysis && typeof analysis === 'object' ? analysis : {};
  return {
    ...base,
    categoryHint,
    suggestedCategory: categoryHint,
    detectionConfidence: resolved?.confidence,
    analysis: {
      ...(base.analysis && typeof base.analysis === 'object' ? base.analysis : {}),
      category: categoryHint,
      color: vision.color || base.analysis?.color,
      confidence: vision.confidence,
      brand: vision.brand,
      material: vision.material,
      suggestedName: vision.suggestedName,
      seasons: vision.seasons,
      occasions: vision.occasions,
      description: vision.description,
    },
  };
}

function assembleResult(args: {
  workUri: string;
  base64?: string;
  cropped: boolean;
  resolved: QuickAddYoloDetection | null;
  analysis: any;
  provisional?: boolean;
}): CapturePipelineResult {
  const box = bboxPerception(args.resolved);
  const vision = pickVisionFields(args.analysis || {});
  const categoryHint = resolveQuickAddCategory({
    yoloClass: args.resolved?.class || null,
    visionCategory: vision.category,
    visionConfidence: vision.confidence,
    bbox: box,
  });
  const analysis = buildTaggedAnalysis(args.analysis, args.resolved, categoryHint);
  return {
    imageUri: args.workUri,
    imageBase64: args.base64,
    cropped: args.cropped,
    categoryHint,
    detectionConfidence: args.resolved?.confidence,
    analysis,
    provisional: args.provisional,
  };
}

/**
 * Perception fast path: crop → vision (raced) → tags.
 * YOLO is not awaited before vision when a snap detection already exists.
 * rembg never blocks — use onBackgroundReady.
 */
export async function processQuickAddCapture(
  photoUri: string,
  detection?: QuickAddYoloDetection | null,
  opts?: ProcessQuickAddOptions,
): Promise<CapturePipelineResult> {
  const visionTimeoutMs = opts?.visionTimeoutMs ?? QUICK_ADD_VISION_TIMEOUT_MS;

  // Prefer snap box immediately — do not block vision on a fresh YOLO pass.
  let resolved: QuickAddYoloDetection | null = detection?.bbox ? detection : null;
  const yoloRefinePromise = resolved
    ? Promise.resolve(resolved)
    : resolveDetection(photoUri, null);

  const cropBox: QuickAddBBox = resolved?.bbox || QUICK_ADD_CAPTURE.guide;
  const crop = await cropNormalizedRegion(photoUri, cropBox, {
    padding: resolved
      ? paddingForBBox(resolved.bbox, resolved.class)
      : paddingForCategory(undefined, QUICK_ADD_CAPTURE.guide),
    maxWidth: 800,
    compress: 0.78,
  });

  let workUri = photoUri;
  let cropped = false;
  let base64: string | undefined;
  if (crop?.uri) {
    workUri = crop.uri;
    base64 = crop.base64;
    cropped = true;
  }

  if (!base64) {
    const resized = await ImageManipulator.manipulateAsync(
      workUri,
      [{ resize: { width: 800 } }],
      { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    workUri = resized.uri;
    base64 = resized.base64 || (await convertImageToBase64(resized.uri));
  }

  // Kick YOLO refine in parallel (gallery / no snap box) — do not await before vision.
  const yoloRunning = yoloRefinePromise.then((d) => {
    if (d) resolved = d;
    return d;
  });

  const analyzePromise = apiService.analyzeGarmentPhoto(base64, { detailed: false });

  // Background rembg — only when explicitly requested; never blocks tags
  if (opts?.removeBackground) {
    void apiService.removeBackground(base64)
      .then((bg) => {
        if (bg?.imageUrl && bg?.removed !== false) {
          opts?.onBackgroundReady?.(bg.imageUrl);
        }
      })
      .catch(() => {});
  }

  const raced = await withTimeout(analyzePromise, visionTimeoutMs);
  // Best-effort YOLO by now (usually already done on auto-snap)
  await Promise.race([
    yoloRunning,
    new Promise((r) => setTimeout(r, 50)),
  ]);

  if (raced) {
    return assembleResult({
      workUri,
      base64,
      cropped,
      resolved,
      analysis: raced,
      provisional: false,
    });
  }

  // Timeout / vision failure → provisional tags now; refine when vision lands
  let fallbackAnalysis: any = null;
  try {
    // Don't await long extract on the hot path — provisional from YOLO/hanger only
    fallbackAnalysis = null;
  } catch {
    fallbackAnalysis = null;
  }

  const provisional = assembleResult({
    workUri,
    base64,
    cropped,
    resolved,
    analysis: fallbackAnalysis,
    provisional: true,
  });

  void analyzePromise
    .then(async (late) => {
      if (!late || !opts?.onPartial) return;
      await yoloRunning;
      opts.onPartial(assembleResult({
        workUri,
        base64,
        cropped,
        resolved,
        analysis: late,
        provisional: false,
      }));
    })
    .catch(async () => {
      if (!opts?.onPartial) return;
      try {
        const extract = await apiService.extractClothing({ imageBase64: base64 });
        await yoloRunning;
        opts.onPartial(assembleResult({
          workUri,
          base64,
          cropped,
          resolved,
          analysis: {
            clothingAnalysis: extract?.clothingAnalysis,
            suggestedName: extract?.analysis?.suggestedName,
            analysis: extract?.analysis,
          },
          provisional: false,
        }));
      } catch {
        /* keep provisional */
      }
    });

  return provisional;
}

/** Exported for digitize parity / tests. */
export function paddedBBoxTuple(
  bbox: [number, number, number, number],
  padding = 0.1,
): [number, number, number, number] {
  return bboxToTuple(addPadding(
    { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] },
    padding,
  ));
}
