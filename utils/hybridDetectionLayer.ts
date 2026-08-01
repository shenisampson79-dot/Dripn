/**
 * Hybrid detection layer — YOLO suggests, hard geometry decides.
 *
 * Strict body regions (top / transition / bottom / footwear) prevent
 * impossible interpretations: arm→shirt, top→trousers, trousers→shoes.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  REGION,
  getStrictBodyRegion,
  isHardFootwear,
  isCroppedFrame,
  feetLikelyCropped,
  resolveClassByRegionLock,
  resolveDetectionConflicts,
  type StrictBodyRegion,
  type BBoxTuple,
} from '@/utils/bodyGeometryGuardrails';

export type BodyRegion = StrictBodyRegion;

export type HybridDetection = OnDeviceDetection & {
  region: BodyRegion;
  inferred?: boolean;
  hybridRepairs?: string[];
};

export type HybridDetectionResult = {
  detections: HybridDetection[];
  repairs: string[];
  hasFootwear: boolean;
  confidence: number;
};

const MAX_DETECTIONS = 6;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** @deprecated Prefer getStrictBodyRegion — kept as re-export for callers. */
export function getBodyRegion(bbox: [number, number, number, number]): BodyRegion {
  return getStrictBodyRegion(bbox);
}

export { REGION, getStrictBodyRegion, isHardFootwear };

function isFootwearCategory(category: string, subcategory?: string): boolean {
  const blob = `${category || ''} ${subcategory || ''}`.toLowerCase();
  return /shoe|boot|sneaker|loafer|footwear|heel|sandal|mule|oxford/.test(blob);
}

/** Region lock — REGION > shape > yolo. */
export function correctClassByRegion(det: OnDeviceDetection): {
  detection: OnDeviceDetection;
  repairs: string[];
} {
  const locked = resolveClassByRegionLock({
    bbox: det.bbox as BBoxTuple,
    yoloCategory: det.category,
    yoloSubcategory: det.subcategory,
  });
  const next = {
    ...det,
    category: locked.category,
    subcategory: locked.subcategory,
    name: locked.name,
  };
  const changed =
    String(det.category).toLowerCase() !== locked.category
    || (isFootwearCategory(det.category, det.subcategory) && locked.category !== 'shoes');
  return {
    detection: next,
    repairs: changed && locked.repair ? [locked.repair] : [],
  };
}

function pickLargest(dets: OnDeviceDetection[]): OnDeviceDetection | null {
  if (!dets.length) return null;
  return [...dets].sort(
    (a, b) => b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3],
  )[0] || null;
}

/** Recover missing shoes only from hard-footwear boxes, or soft-infer. */
export function recoverShoes(
  detections: OnDeviceDetection[],
  opts?: {
    rematerializeBottom?: boolean;
    inferMissingFootwear?: boolean;
    /** Absolute: when true, never promote/infer footwear. */
    croppedFrame?: boolean;
  },
): {
  detections: HybridDetection[];
  repairs: string[];
} {
  const rematerializeBottom = opts?.rematerializeBottom !== false;
  // Soft invent OFF by default — barefoot must not spawn phantom shoes
  const inferMissingFootwear = opts?.inferMissingFootwear === true;
  const croppedFrame =
    opts?.croppedFrame === true
    || isCroppedFrame(detections.map((d) => ({
      category: d.category,
      subcategory: d.subcategory,
      bbox: d.bbox as BBoxTuple,
    })));
  const repairs: string[] = [];
  const withRegions: HybridDetection[] = detections.map((d) => ({
    ...d,
    region: getStrictBodyRegion(d.bbox),
    hybridRepairs: [],
  }));

  if (croppedFrame) {
    // Absolute lock — strip any footwear labels that leaked through
    const stripped = withRegions.map((d) => {
      if (!isFootwearCategory(d.category, d.subcategory)) return d;
      const locked = resolveClassByRegionLock({
        bbox: d.bbox as BBoxTuple,
        yoloCategory: 'bottoms',
        yoloSubcategory: 'shorts',
      });
      repairs.push('cropped_frame→block_footwear');
      return {
        ...d,
        category: locked.category,
        subcategory: locked.subcategory,
        name: locked.name,
        region: getStrictBodyRegion(d.bbox),
        hybridRepairs: ['cropped_frame→block_footwear'],
      };
    });
    return { detections: stripped, repairs };
  }

  if (withRegions.some((d) => isFootwearCategory(d.category, d.subcategory))) {
    return { detections: withRegions, repairs };
  }

  if (rematerializeBottom) {
    const footCandidates = withRegions.filter((d) => isHardFootwear(d.bbox));
    const best = pickLargest(footCandidates);
    if (best) {
      const repaired: HybridDetection = {
        ...best,
        category: 'shoes',
        subcategory: 'shoes',
        name: 'Shoes',
        confidence: Math.max(0.45, Math.min(0.75, best.confidence)),
        inferred: true,
        region: 'footwear',
        hybridRepairs: ['recover_shoes_from_footwear_zone'],
        trackId: best.trackId ? `${best.trackId}_shoe` : `inferred_shoe_${Date.now()}`,
      };
      repairs.push('recover_shoes_from_footwear_zone');
      const rest = withRegions.filter((d) => d !== best && d.trackId !== best.trackId);
      return { detections: [...rest, repaired], repairs };
    }
  }

  if (inferMissingFootwear) {
    if (feetLikelyCropped(withRegions.map((d) => d.bbox as BBoxTuple))) {
      return { detections: withRegions, repairs };
    }
    const hasTop = withRegions.some((d) => /top|outer|dress/.test(String(d.category).toLowerCase()));
    const bottoms = withRegions.filter((d) =>
      /bottom|jean|short|skirt|trouser/.test(String(d.category).toLowerCase()),
    );
    const longBottoms = bottoms.some((d) => {
      const h = d.bbox[3];
      const bottom = d.bbox[1] + h;
      return h >= 0.36 && bottom >= 0.88 && !/short/i.test(`${d.subcategory || ''} ${d.name || ''}`);
    });
    if (hasTop && longBottoms) {
      const inferred: HybridDetection = {
        name: 'Shoes',
        category: 'shoes',
        subcategory: 'shoes',
        confidence: 0.4,
        bbox: [0.35, 0.82, 0.3, 0.14],
        inferred: true,
        region: 'footwear',
        hybridRepairs: ['infer_missing_footwear'],
        trackId: `inferred_shoe_${Date.now()}`,
      };
      repairs.push('infer_missing_footwear');
      return { detections: [...withRegions, inferred], repairs };
    }
  }

  return { detections: withRegions, repairs };
}

export type HybridDetectionOptions = {
  rematerializeBottom?: boolean;
  inferMissingFootwear?: boolean;
  croppedFrame?: boolean;
};

/** Full hybrid pass: region lock → shoe recover → conflict resolve. */
export function applyHybridDetection(
  detections: OnDeviceDetection[],
  opts?: HybridDetectionOptions,
): HybridDetectionResult {
  if (!detections?.length) {
    return { detections: [], repairs: [], hasFootwear: false, confidence: 0 };
  }

  const repairs: string[] = [];
  const cropped =
    opts?.croppedFrame === true
    || isCroppedFrame(detections.map((d) => ({
      category: d.category,
      subcategory: d.subcategory,
      bbox: d.bbox as BBoxTuple,
    })));

  const corrected: OnDeviceDetection[] = [];
  for (const d of detections) {
    // Cropped: never allow hard-footwear path to invent shoes from thighs
    if (cropped && isHardFootwear(d.bbox)) {
      const asBottom = resolveClassByRegionLock({
        bbox: d.bbox as BBoxTuple,
        yoloCategory: 'bottoms',
        yoloSubcategory: 'shorts',
      });
      corrected.push({
        ...d,
        category: asBottom.category,
        subcategory: asBottom.subcategory,
        name: asBottom.name,
      });
      repairs.push('cropped_frame→footwear_box_as_bottoms');
      continue;
    }
    const { detection, repairs: r } = correctClassByRegion(d);
    corrected.push(detection);
    repairs.push(...r);
  }

  const recovered = recoverShoes(corrected, {
    rematerializeBottom: cropped ? false : opts?.rematerializeBottom,
    inferMissingFootwear: cropped ? false : opts?.inferMissingFootwear,
    croppedFrame: cropped,
  });
  repairs.push(...recovered.repairs);

  const conflictFree = resolveDetectionConflicts(
    recovered.detections.map((d) => ({ ...d, bbox: d.bbox as BBoxTuple })),
    { max: MAX_DETECTIONS },
  ) as HybridDetection[];

  const cleaned = conflictFree.map((d) => ({
    ...d,
    region: d.region || getStrictBodyRegion(d.bbox),
  }));

  const hasFootwear = !cropped
    && cleaned.some((d) => isFootwearCategory(d.category, d.subcategory));

  const regionConsistency =
    cleaned.filter((d) => {
      const r = d.region || getStrictBodyRegion(d.bbox);
      if (isFootwearCategory(d.category, d.subcategory)) return r === 'footwear';
      if (/bottom/.test(String(d.category).toLowerCase())) return r === 'bottom' || r === 'transition' || r === 'footwear';
      if (/top|outer/.test(String(d.category).toLowerCase())) {
        return r === 'top' || r === 'transition';
      }
      return true;
    }).length / Math.max(1, cleaned.length);

  const completeness = cropped ? 0.7 : hasFootwear ? 1 : 0.55;
  const avgConf =
    cleaned.reduce((s, d) => s + (d.confidence || 0), 0) / Math.max(1, cleaned.length);
  const confidence = clamp01(0.45 * avgConf + 0.3 * regionConsistency + 0.25 * completeness);

  return { detections: cleaned, repairs, hasFootwear, confidence };
}
