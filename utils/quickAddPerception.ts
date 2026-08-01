/**
 * Quick Add perception rules — VISION > hybrid > YOLO.
 * Shared by capture pipeline + tag drafting.
 */

import { canonicalizeCategory } from '@/utils/outfitAutoAnalysisPipeline';
import type { ClothingColor } from '@/contexts/WardrobeContext';

export const QUICK_ADD_VISION_TIMEOUT_MS = 2000;
export const QUICK_ADD_FORCE_UI_MS = 3000;
export const QUICK_ADD_VISION_CONFIDENCE_WIN = 0.7;

export type PerceptionBBox = { x: number; y: number; w: number; h: number };

/** Wide-on-hanger silhouettes (tee/blazer in a square guide). */
export function isHangerShape(box: { w: number; h: number } | null | undefined): boolean {
  if (!box || !(box.h > 0) || !(box.w > 0)) return false;
  return box.w > box.h * 1.4;
}

export function perceptionRegion(
  box: PerceptionBBox | null | undefined,
): 'top' | 'middle' | 'bottom' | 'unknown' {
  if (!box) return 'unknown';
  const cy = box.y + box.h / 2;
  if (cy < 0.38) return 'top';
  if (cy < 0.62) return 'middle';
  return 'bottom';
}

const COLOR_KEYS: ClothingColor[] = [
  'black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink',
  'orange', 'yellow', 'green', 'blue', 'purple', 'denim', 'cream', 'multicolor', 'other',
];

const COLOR_ALIASES: Record<string, ClothingColor> = {
  grey: 'gray',
  charcoal: 'gray',
  ivory: 'cream',
  'off-white': 'cream',
  off_white: 'cream',
  offwhite: 'cream',
  ecru: 'cream',
  oatmeal: 'cream',
  tan: 'beige',
  khaki: 'beige',
  taupe: 'beige',
  camel: 'brown',
  nude: 'beige',
  sand: 'beige',
  stone: 'beige',
  multicolour: 'multicolor',
  multicoloured: 'multicolor',
  multi: 'multicolor',
  multi_color: 'multicolor',
  'multi-color': 'multicolor',
  'multi-coloured': 'multicolor',
  olive: 'green',
  burgundy: 'red',
  maroon: 'red',
  navy_blue: 'navy',
  'navy blue': 'navy',
  unknown: 'other',
  other: 'other',
  n_a: 'other',
  na: 'other',
};

/**
 * Normalize vision color. Unknown → `other` (never invent multicolor).
 * Explicit multi / patterned strings still map to multicolor.
 */
export function normalizeQuickAddColor(raw?: string | null): ClothingColor {
  const c = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!c) return 'other';
  if (COLOR_KEYS.includes(c as ClothingColor)) {
    return c as ClothingColor;
  }
  if (COLOR_ALIASES[c]) return COLOR_ALIASES[c];
  for (const part of c.split(/[_/-]+/)) {
    if (COLOR_KEYS.includes(part as ClothingColor)) return part as ClothingColor;
    if (COLOR_ALIASES[part]) return COLOR_ALIASES[part];
  }
  return 'other';
}

function wardrobeFromCanon(canon: string): string {
  if (canon === 'footwear') return 'shoes';
  if (canon === 'dress') return 'dresses';
  if (['jeans', 'skirt', 'shorts', 'trousers'].includes(canon)) return 'bottoms';
  if (['blazer', 'jacket', 'coat', 'cardigan', 'waistcoat'].includes(canon)) return 'outerwear';
  if (canon === 'accessory' || canon === 'necktie') return 'accessories';
  return 'tops';
}

/**
 * Production hierarchy:
 * 1. Vision if confident (≥0.7) or any real garment label
 * 2. Hybrid: hanger mid → tops; region top → tops; region bottom → bottoms
 * 3. YOLO last
 * Footwear geometry still beats a dress mislabel.
 */
export function resolveQuickAddCategory(args: {
  yoloClass?: string | null;
  visionCategory?: string | null;
  visionConfidence?: number | null;
  bbox?: PerceptionBBox | null;
}): string {
  const visionRaw = args.visionCategory || null;
  const yoloRaw = args.yoloClass || null;
  const conf = Number(args.visionConfidence ?? 0);
  const box = args.bbox || null;

  const footwearHeuristic =
    box && box.y + box.h > 0.72 && box.y > 0.4 ? 'footwear' : null;

  if (visionRaw) {
    const visionCanon = canonicalizeCategory(visionRaw);
    const yoloCanon = yoloRaw ? canonicalizeCategory(yoloRaw) : null;
    const visionIsFootwear = visionCanon === 'footwear';
    const yoloIsFootwear = yoloCanon === 'footwear' || footwearHeuristic === 'footwear';

    // Boots ≠ dress: keep shoe recovery when vision is dress-like on a shoe box
    if (!visionIsFootwear && yoloIsFootwear) {
      return 'shoes';
    }

    if (visionCanon && visionCanon !== 'other') {
      if (conf >= QUICK_ADD_VISION_CONFIDENCE_WIN || conf <= 0) {
        // conf<=0 means API omitted confidence — still trust named vision label
        return wardrobeFromCanon(visionCanon);
      }
      // Low-confidence vision: still prefer over YOLO for tops↔bottoms, but allow hybrid override for hanger
      if (isHangerShape(box) && perceptionRegion(box) === 'middle') {
        const v = wardrobeFromCanon(visionCanon);
        if (v === 'bottoms') return 'tops';
      }
      return wardrobeFromCanon(visionCanon);
    }
  }

  // Hybrid fallback (no usable vision)
  const region = perceptionRegion(box);
  if (isHangerShape(box) && (region === 'middle' || region === 'top')) {
    return 'tops';
  }
  if (region === 'top') return 'tops';
  if (region === 'bottom' && box && box.h > 0.28) return 'bottoms';

  if (yoloRaw) {
    return wardrobeFromCanon(canonicalizeCategory(yoloRaw));
  }

  return 'tops';
}

export function pickVisionFields(analysis: any): {
  category: string | null;
  color: string | null;
  confidence: number;
  brand?: string;
  material?: string;
  suggestedName?: string;
  seasons?: unknown;
  occasions?: unknown;
  description?: string;
} {
  const nested = analysis?.analysis && typeof analysis.analysis === 'object'
    ? analysis.analysis
    : {};
  const main =
    nested?.mainItem
    || analysis?.clothingAnalysis
    || (nested.category || nested.color ? nested : null)
    || {};

  const category =
    nested?.category
    || nested?.type
    || main?.type
    || main?.category
    || analysis?.suggestedCategory
    || analysis?.category
    || null;

  const color =
    main?.color
    || nested?.color
    || nested?.primaryColor
    || nested?.color?.primary
    || (typeof nested?.color === 'object' ? nested?.color?.primary : null)
    || analysis?.color
    || analysis?.clothingAnalysis?.color
    || null;

  const confidence = Number(
    nested?.confidence
    || analysis?.confidence
    || main?.confidence
    || 0,
  );

  return {
    category: category ? String(category) : null,
    color: color ? String(color) : null,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    brand: main?.brand || nested?.brand ? String(main?.brand || nested?.brand) : undefined,
    material: main?.material || nested?.material
      ? String(main?.material || nested?.material)
      : undefined,
    suggestedName: analysis?.suggestedName || nested?.suggestedName || undefined,
    seasons: main?.seasons || nested?.seasons,
    occasions: main?.occasions || nested?.occasions,
    description: main?.description || nested?.description || undefined,
  };
}
