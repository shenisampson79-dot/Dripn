/**
 * Quick Add perception rules — VISION > hybrid > YOLO.
 * Shared by capture pipeline + tag drafting.
 */

import { canonicalizeCategory } from '@/utils/outfitAutoAnalysisPipeline';
import type { ClothingColor } from '@/contexts/WardrobeContext';

export const QUICK_ADD_VISION_TIMEOUT_MS = 4000;
/** Extra wait after timeout before showing a provisional result (stay on “Identifying…”). */
export const QUICK_ADD_PROVISIONAL_GRACE_MS = 4000;
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
 * Macro roles for Quick Add reconciliation.
 * Used to block weak on-device guesses from forcing an incompatible wardrobe category
 * over confident Vision (e.g. jacket→shoes, trousers→shoes, shirt→bag).
 */
export type QuickAddMacroRole =
  | 'footwear'
  | 'outerwear'
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'bags'
  | 'accessories'
  | 'other';

export function quickAddMacroRole(wardrobeCategory: string | null | undefined): QuickAddMacroRole {
  const c = String(wardrobeCategory || '').toLowerCase().trim();
  if (c === 'shoes' || c === 'footwear') return 'footwear';
  if (c === 'outerwear') return 'outerwear';
  if (c === 'bottoms' || c === 'activewear_bottoms') return 'bottoms';
  if (c === 'dresses' || c === 'dress') return 'dresses';
  if (c === 'bags') return 'bags';
  if (c === 'accessories') return 'accessories';
  if (c === 'tops' || c === 'activewear_tops' || c === 'formal') return 'tops';
  return 'other';
}

/**
 * True when two wardrobe categories are fundamentally incompatible.
 * Soft pairs (tops ↔ outerwear) are allowed — layering / hanger ambiguity.
 */
export function areFundamentallyIncompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ra = quickAddMacroRole(a);
  const rb = quickAddMacroRole(b);
  if (ra === 'other' || rb === 'other') return false;
  if (ra === rb) return false;
  // Soft-compatible: top vs outerwear (blazer vs shirt on hanger)
  if (
    (ra === 'tops' && rb === 'outerwear')
    || (ra === 'outerwear' && rb === 'tops')
  ) {
    return false;
  }
  return true;
}

/**
 * Production hierarchy — reconciled evidence, Vision-first:
 * 1. Confident Vision wins over incompatible on-device (YOLO / soft bbox) guesses
 * 2. Exception: dress + footwear device → shoes (boots ≠ dress)
 * 3. Hybrid geometry when Vision is missing
 * 4. YOLO last
 *
 * Final wardrobe `category` (not just display name) must come from this path —
 * Outfit Mix / Get Outfits key off `item.category`.
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

  const deviceCanon = yoloRaw
    ? canonicalizeCategory(yoloRaw)
    : (footwearHeuristic === 'footwear' ? 'footwear' : null);
  const deviceWardrobe = deviceCanon ? wardrobeFromCanon(deviceCanon) : null;

  if (visionRaw) {
    const visionCanon = canonicalizeCategory(visionRaw);
    if (visionCanon && visionCanon !== 'other') {
      const visionWardrobe = wardrobeFromCanon(visionCanon);
      const visionConfident = conf >= QUICK_ADD_VISION_CONFIDENCE_WIN || conf <= 0;

      // Boots ≠ dress: only known case where device footwear may correct Vision.
      if (
        visionCanon === 'dress'
        && deviceWardrobe === 'shoes'
      ) {
        return 'shoes';
      }

      // Confident Vision: never let weak/on-device force an incompatible role.
      if (
        visionConfident
        && deviceWardrobe
        && areFundamentallyIncompatible(visionWardrobe, deviceWardrobe)
      ) {
        return visionWardrobe;
      }

      if (visionConfident) {
        return visionWardrobe;
      }

      // Low-confidence vision: still prefer over incompatible device; hanger may fix bottoms→tops.
      if (
        deviceWardrobe
        && areFundamentallyIncompatible(visionWardrobe, deviceWardrobe)
      ) {
        return visionWardrobe;
      }
      if (isHangerShape(box) && perceptionRegion(box) === 'middle') {
        if (visionWardrobe === 'bottoms') return 'tops';
      }
      return visionWardrobe;
    }
  }

  // Hybrid fallback (no usable vision)
  const region = perceptionRegion(box);
  if (isHangerShape(box) && (region === 'middle' || region === 'top')) {
    return 'tops';
  }
  if (region === 'top') return 'tops';
  if (region === 'bottom' && box && box.h > 0.28) return 'bottoms';

  if (deviceWardrobe) return deviceWardrobe;
  if (yoloRaw) {
    return wardrobeFromCanon(canonicalizeCategory(yoloRaw));
  }

  return 'tops';
}

export function pickVisionFields(analysis: any): {
  category: string | null;
  subcategory?: string;
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
  const itemBlock = (analysis?.item && typeof analysis.item === 'object')
    ? analysis.item
    : (nested?.item && typeof nested.item === 'object' ? nested.item : {});
  const main =
    nested?.mainItem
    || analysis?.clothingAnalysis
    || (nested.category || nested.color ? nested : null)
    || (itemBlock.category || itemBlock.color ? itemBlock : null)
    || {};

  const category =
    nested?.category
    || nested?.type
    || main?.type
    || main?.category
    || analysis?.suggestedCategory
    || analysis?.category
    || null;

  const subcategory =
    nested?.subcategory
    || main?.subcategory
    || analysis?.subcategory
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
    subcategory: subcategory ? String(subcategory) : undefined,
    color: color ? String(color) : null,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    brand: (analysis?.brand || itemBlock?.brand || main?.brand || nested?.brand)
      ? String(analysis?.brand || itemBlock?.brand || main?.brand || nested?.brand)
      : undefined,
    material: (analysis?.material || itemBlock?.material || main?.material || nested?.material)
      ? String(analysis?.material || itemBlock?.material || main?.material || nested?.material)
      : undefined,
    suggestedName: analysis?.suggestedName || nested?.suggestedName || itemBlock?.name || undefined,
    seasons: main?.seasons || nested?.seasons || itemBlock?.season,
    occasions: main?.occasions || nested?.occasions || itemBlock?.occasions,
    description: main?.description || nested?.description || undefined,
  };
}
