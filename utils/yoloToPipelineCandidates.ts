/**
 * Map on-device YOLO detections ↔ outfit auto-analysis pipeline.
 */
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { applyHybridDetection } from '@/utils/hybridDetectionLayer';
import {
  feetLikelyCropped,
  isCroppedFrame,
  isHardFootwear,
  resolveClassByRegionLock,
  type BBoxTuple,
} from '@/utils/bodyGeometryGuardrails';
import {
  applyGeometryGuardrails,
  canonicalizeCategory,
  majorityVoteCategories,
  runOutfitAutoPipeline,
  type DetectionCandidate,
  type PipelineResult,
} from '@/utils/outfitAutoAnalysisPipeline';
import { resolveQuickAddCategory } from '@/utils/quickAddPerception';

/** Wardrobe category → pipeline role / category vocabulary. */
function wardrobeToPipelineCategory(category: string, subcategory?: string): string {
  const c = String(category || '').toLowerCase();
  const s = String(subcategory || '').toLowerCase();
  if (c === 'shoes' || /shoe|boot|sneaker|loafer/.test(s)) return 'footwear';
  if (c === 'dresses' || c === 'dress') return 'dress';
  if (c === 'bottoms') {
    if (/jean/.test(s)) return 'jeans';
    if (/skirt/.test(s)) return 'skirt';
    if (/short/.test(s)) return 'shorts';
    return 'trousers';
  }
  if (c === 'outerwear') {
    if (/blazer/.test(s)) return 'blazer';
    if (/cardigan/.test(s)) return 'cardigan';
    return 'jacket';
  }
  if (c === 'bags' || c === 'accessories') return 'accessory';
  if (/polo/.test(s)) return 'polo';
  if (/sweater|jumper|knit/.test(s)) return 'sweater';
  if (/t-?shirt|tee/.test(s)) return 't-shirt';
  if (/blouse/.test(s)) return 'blouse';
  if (/shirt/.test(s)) return 'shirt';
  return 'other';
}

function roleHintForWardrobe(category: string): DetectionCandidate['roleHint'] {
  const c = String(category || '').toLowerCase();
  if (c === 'shoes') return 'footwear';
  if (c === 'bottoms') return 'bottom';
  if (c === 'outerwear') return 'outerwear';
  if (c === 'bags' || c === 'accessories') return 'accessory';
  return 'top';
}

function pipelineCategoryToWardrobe(cat: string): { category: string; subcategory?: string; name: string } {
  const c = canonicalizeCategory(cat);
  if (c === 'footwear') return { category: 'shoes', subcategory: 'shoes', name: 'Shoes' };
  if (c === 'dress') return { category: 'dresses', subcategory: 'dress', name: 'Dress' };
  if (c === 'jeans') return { category: 'bottoms', subcategory: 'jeans', name: 'Jeans' };
  if (c === 'skirt') return { category: 'bottoms', subcategory: 'skirt', name: 'Skirt' };
  if (c === 'shorts') return { category: 'bottoms', subcategory: 'shorts', name: 'Shorts' };
  if (c === 'trousers') return { category: 'bottoms', subcategory: 'trousers', name: 'Trousers' };
  if (c === 'blazer') return { category: 'outerwear', subcategory: 'blazer', name: 'Blazer' };
  if (c === 'cardigan') return { category: 'outerwear', subcategory: 'cardigan', name: 'Cardigan' };
  if (c === 'jacket' || c === 'coat' || c === 'waistcoat') {
    return { category: 'outerwear', subcategory: c, name: c[0].toUpperCase() + c.slice(1) };
  }
  if (c === 'accessory' || c === 'necktie') {
    return { category: 'accessories', subcategory: c === 'necktie' ? 'tie' : 'accessory', name: 'Accessory' };
  }
  if (c === 'polo') return { category: 'tops', subcategory: 'polo', name: 'Polo' };
  if (c === 'sweater' || c === 'knit') return { category: 'tops', subcategory: c, name: 'Knit' };
  if (c === 't-shirt') return { category: 'tops', subcategory: 't-shirt', name: 'T-Shirt' };
  if (c === 'blouse') return { category: 'tops', subcategory: 'blouse', name: 'Blouse' };
  if (c === 'shirt' || c === 'tops') return { category: 'tops', subcategory: c === 'shirt' ? 'shirt' : 'top', name: 'Top' };
  return { category: 'tops', subcategory: 'top', name: 'Top' };
}

export function onDeviceDetectionsToCandidates(
  detections: OnDeviceDetection[],
): DetectionCandidate[] {
  return detections.map((d) => {
    const [x, y, w, h] = d.bbox;
    const mapped = wardrobeToPipelineCategory(d.category, d.subcategory);
    const footwearHeuristic = isHardFootwear([x, y, w, h]) ? 'footwear' : null;
    return {
      id: d.trackId,
      category: mapped,
      subcategory: d.subcategory || null,
      color: d.color || null,
      confidence: d.confidence,
      bbox: { x, y, w, h },
      aspectRatio: h > 0 ? w / h : 1,
      categoryVotes: [mapped, d.category, d.name].filter(Boolean) as string[],
      heuristicCategory: footwearHeuristic,
      roleHint: roleHintForWardrobe(d.category),
    };
  });
}

/**
 * Run self-correcting pipeline on YOLO boxes; return corrected wardrobe detections.
 * On discard / empty, returns the original list unchanged.
 */
export function correctOnDeviceDetections(
  detections: OnDeviceDetection[],
  opts?: {
    id?: string;
    context?: string | null;
    brand?: string | null;
    /** Hybrid opts — Live Stylist keeps defaults; Digitize/Quick Add disable soft shoe invent. */
    hybrid?: {
      rematerializeBottom?: boolean;
      inferMissingFootwear?: boolean;
    };
  },
): {
  detections: OnDeviceDetection[];
  pipeline: PipelineResult | null;
  hybridRepairs?: string[];
} {
  if (!detections?.length) {
    return { detections, pipeline: null, hybridRepairs: [] };
  }

  // Hybrid first: region correction + shoe recovery (YOLO suggests, system decides)
  const cropped = isCroppedFrame(
    detections.map((d) => ({
      category: d.category,
      subcategory: d.subcategory,
      bbox: d.bbox as BBoxTuple,
    })),
  );
  const hybrid = applyHybridDetection(detections, {
    ...opts?.hybrid,
    croppedFrame: cropped || opts?.hybrid?.croppedFrame,
    inferMissingFootwear: cropped ? false : opts?.hybrid?.inferMissingFootwear,
    rematerializeBottom: cropped ? false : opts?.hybrid?.rematerializeBottom,
  });
  const seeded: OnDeviceDetection[] = hybrid.detections.map((d) => ({
    name: d.name,
    category: d.category,
    subcategory: d.subcategory,
    color: d.color,
    confidence: d.confidence,
    bbox: d.bbox,
    suggestion: d.suggestion,
    trackId: d.trackId,
  }));

  const candidates = onDeviceDetectionsToCandidates(seeded);
  const pipeline = runOutfitAutoPipeline({
    id: opts?.id || `frame_${Date.now()}`,
    detections: candidates,
    context: opts?.context || null,
    brand: opts?.brand || null,
    imageMeta: {
      itemCount: seeded.length,
      hasCentralSubject: seeded.length > 0,
    },
  });

  if (pipeline.discarded) {
    return { detections: seeded, pipeline, hybridRepairs: hybrid.repairs };
  }

  // Per-detection vote + geometry (same rules as pipeline), then hard re-lock
  // so pipeline soft rules cannot revive thigh→shoes / shorts→trousers errors.
  const corrected = seeded.map((d, i) => {
    const cand = candidates[i];
    if (!cand) return d;
    const voted = majorityVoteCategories(
      [...(cand.categoryVotes || []), cand.category],
      cand.heuristicCategory,
    );
    const geo = applyGeometryGuardrails(voted, cand.bbox, cand.aspectRatio);
    const mapped = pipelineCategoryToWardrobe(geo.category);
    const locked = resolveClassByRegionLock({
      bbox: d.bbox as BBoxTuple,
      yoloCategory: mapped.category,
      yoloSubcategory: mapped.subcategory || d.subcategory,
      visionCategory: mapped.category,
    });
    return {
      ...d,
      category: locked.category,
      subcategory: locked.subcategory || mapped.subcategory || d.subcategory,
      name: locked.name || mapped.name || d.name,
      confidence: Math.max(d.confidence, pipeline.confidence * 0.85, hybrid.confidence * 0.7),
    };
  });

  // Never soft-append shoes — only keep what hybrid/YOLO already classified as shoes
  const stillCropped = cropped || feetLikelyCropped(corrected.map((d) => d.bbox as BBoxTuple));
  const finalDets = stillCropped
    ? corrected.filter((d) => d.category !== 'shoes')
    : corrected;

  if (hybrid.repairs.length) {
    pipeline.repairs = [...hybrid.repairs, ...(pipeline.repairs || [])];
  }
  if (stillCropped) {
    pipeline.repairs = [...(pipeline.repairs || []), 'cropped_frame→no_footwear'];
  }

  return { detections: finalDets, pipeline, hybridRepairs: hybrid.repairs };
}

/**
 * Resolve a single-item category using perception hierarchy (VISION > hybrid > YOLO).
 */
export function resolveCategoryWithPipelineVote(args: {
  yoloClass?: string | null;
  analysisCategory?: string | null;
  suggestedCategory?: string | null;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  sleeve?: 'short' | 'long' | 'sleeveless' | null;
  visionConfidence?: number | null;
}): string | null {
  const visionRaw = args.analysisCategory || args.suggestedCategory || null;
  const yoloRaw = args.yoloClass || null;
  if (!visionRaw && !yoloRaw && !args.bbox) return null;
  return resolveQuickAddCategory({
    yoloClass: yoloRaw,
    visionCategory: visionRaw,
    visionConfidence: args.visionConfidence,
    bbox: args.bbox,
  });
}

/** Map user favorite brand strings → luxury signal keys when known. */
export function resolveBrandInspiration(favoriteBrands?: string[] | null): string | null {
  if (!favoriteBrands?.length) return null;
  const KNOWN: Array<[RegExp, string]> = [
    [/loro\s*piana/i, 'loro_piana'],
    [/zegna/i, 'zegna'],
    [/brunello|cucinelli/i, 'brunello_cucinelli'],
    [/ralph\s*lauren/i, 'ralph_lauren'],
    [/varley/i, 'varley'],
    [/sandro/i, 'sandro'],
    [/veronica\s*beard/i, 'veronica_beard'],
    [/quiet\s*luxury/i, 'quiet_luxury'],
  ];
  for (const brand of favoriteBrands) {
    for (const [re, key] of KNOWN) {
      if (re.test(brand)) return key;
    }
  }
  // Soft fallback: first brand slug for pairing bias if present in signals later
  const first = String(favoriteBrands[0] || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return first || null;
}
