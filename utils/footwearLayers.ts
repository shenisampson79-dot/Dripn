/**
 * Three-layer footwear model — prevents detection→display coarsening bugs.
 *
 * 1. DETECTION (truth): fine type + colour from vision (flip_flops, grey, …)
 * 2. CANONICAL (logic): family for rules/scoring buckets (sandals, casual_shoes, …)
 * 3. DISPLAY (user): always built from fine type + colour — NEVER from canonical
 *
 * Critical rule: displayLabel must never equal canonicalCategory alone.
 */

import { formatGarmentDisplayName } from '@/utils/bodyGeometryGuardrails';

/** Coarse families for clash / style rules — not for UI labels. */
export type CanonicalFootwearFamily =
  | 'sandals'
  | 'casual_shoes'
  | 'boots'
  | 'formal_shoes'
  | 'unknown';

const FINE_TO_CANONICAL: Record<string, CanonicalFootwearFamily> = {
  flip_flops: 'sandals',
  slides: 'sandals',
  sandals: 'sandals',
  sneakers: 'casual_shoes',
  trainers: 'casual_shoes',
  boots: 'boots',
  loafers: 'formal_shoes',
  oxfords: 'formal_shoes',
  derby: 'formal_shoes',
};

/** Layer 2 — map fine detection subtype → scoring/rules family. */
export function toCanonicalFootwearFamily(
  fineType?: string | null,
): CanonicalFootwearFamily {
  const key = String(fineType || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (!key) return 'unknown';
  if (FINE_TO_CANONICAL[key]) return FINE_TO_CANONICAL[key];
  if (/flip|thong|slide|sandal/.test(key)) return 'sandals';
  if (/sneaker|trainer|runner/.test(key)) return 'casual_shoes';
  if (/boot/.test(key)) return 'boots';
  if (/loafer|oxford|derby|formal/.test(key)) return 'formal_shoes';
  return 'unknown';
}

/**
 * Layer 3 — user-facing label from fine type + colour only.
 * Never pass a canonical family as the only display source.
 */
export function buildFootwearDisplayLabel(args: {
  type?: string | null;
  color?: string | null;
  fallbackName?: string | null;
}): string {
  const type = String(args.type || '').toLowerCase().trim();
  if (type === 'casual_shoes') {
    return formatGarmentDisplayName({
      color: args.color,
      category: 'shoes',
      subcategory: 'sneakers',
      fallbackName: args.fallbackName || 'Trainers',
    });
  }
  if (type === 'formal_shoes') {
    return formatGarmentDisplayName({
      color: args.color,
      category: 'shoes',
      subcategory: 'loafers',
      fallbackName: args.fallbackName || 'Shoes',
    });
  }
  return formatGarmentDisplayName({
    color: args.color,
    category: 'shoes',
    subcategory: type || 'sneakers',
    fallbackName: args.fallbackName || null,
  });
}

/** True when a label looks like it was coarsened away from flip-flops/slides. */
export function isCoarsenedFootwearDisplay(label: string, fineType?: string | null): boolean {
  const L = String(label || '').toLowerCase();
  const fine = String(fineType || '').toLowerCase();
  if (/flip/.test(fine) && /sandal/.test(L) && !/flip/.test(L)) return true;
  if (/\bslides?\b/.test(fine) && /sandal/.test(L) && !/slide/.test(L)) return true;
  return false;
}

export type FootwearLayers = {
  detection: { type: string; color: string | null; confidence: number };
  canonical: CanonicalFootwearFamily;
  displayLabel: string;
};

export function buildFootwearLayers(args: {
  type: string;
  color?: string | null;
  confidence?: number;
}): FootwearLayers {
  const type = args.type;
  const color = args.color ?? null;
  return {
    detection: {
      type,
      color,
      confidence: args.confidence ?? 0,
    },
    canonical: toCanonicalFootwearFamily(type),
    displayLabel: buildFootwearDisplayLabel({ type, color }),
  };
}
