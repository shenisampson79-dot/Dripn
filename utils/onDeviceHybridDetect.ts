/**
 * Shared on-device detect + hybrid correction for Digitize / Quick Add / Live.
 */
import {
  detectGarmentsOnDevice,
  type OnDeviceDetection,
} from '@/services/onDeviceGarmentDetector';
import {
  applyHybridDetection,
  type HybridDetectionOptions,
} from '@/utils/hybridDetectionLayer';

export type DetectHybridOptions = HybridDetectionOptions & {
  confThreshold?: number;
  maxDetections?: number;
};

function toPlainDetection(d: OnDeviceDetection): OnDeviceDetection {
  return {
    name: d.name,
    category: d.category,
    subcategory: d.subcategory,
    color: d.color,
    confidence: d.confidence,
    bbox: d.bbox,
    suggestion: d.suggestion,
    trackId: d.trackId,
  };
}

/**
 * Run YOLO then hybrid class/region repair.
 * Digitize / Quick Add should pass `{ inferMissingFootwear: false }` so we
 * don't invent shoes when tagging a single garment.
 */
export async function detectGarmentsOnDeviceHybrid(
  imageUri: string,
  opts?: DetectHybridOptions,
): Promise<OnDeviceDetection[]> {
  const raw = await detectGarmentsOnDevice(imageUri, {
    confThreshold: opts?.confThreshold,
    maxDetections: opts?.maxDetections,
  });
  if (!raw?.length) return [];

  const hybrid = applyHybridDetection(raw, {
    rematerializeBottom: opts?.rematerializeBottom,
    inferMissingFootwear: opts?.inferMissingFootwear,
  });
  return hybrid.detections.map(toPlainDetection);
}

/** Defaults for single-item wardrobe capture flows. */
export const SINGLE_ITEM_HYBRID_OPTS: HybridDetectionOptions = {
  rematerializeBottom: true,
  inferMissingFootwear: false,
};
