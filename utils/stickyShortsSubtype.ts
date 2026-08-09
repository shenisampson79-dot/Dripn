/**
 * Sticky shorts classification — stabilise interpretation, not raw Vision.
 *
 * Hierarchy: tailored/chino (high) > casual > athletic (low) > bare "shorts".
 * Downgrading specificity (chino → athletic) requires strong evidence.
 */

import { SUBTYPE_SPECIFICITY } from '@/utils/liveLayeringIntelligence';

function normSub(raw: string | null | undefined): string | null {
  const s = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_').trim();
  return s || null;
}

function shortsSpecificity(sub: string | null): number {
  if (!sub) return 0;
  if (sub in SUBTYPE_SPECIFICITY) return SUBTYPE_SPECIFICITY[sub];
  if (/chino|tailored|bermuda|smart/.test(sub)) return 8;
  if (/casual/.test(sub)) return 7;
  if (/athletic|gym|sweat|sport/.test(sub)) return 6;
  if (/linen/.test(sub)) return 7;
  if (/cargo/.test(sub)) return 6;
  if (/shorts/.test(sub)) return 3;
  return 0;
}

export const SHORTS_DOWNGRADE_MIN_CONF = 0.92;
export const SHORTS_STICKY_STABILITY = 0.55;

/**
 * Prefer higher-specificity shorts. Refuse chino/tailored → athletic unless
 * Vision is very confident AND belief is not yet sticky-stable.
 */
export function stickShortsSubtype(args: {
  prev: string | null | undefined;
  next: string | null | undefined;
  nextConfidence?: number | null;
  prevStability?: number | null;
}): string | null {
  const a = normSub(args.prev);
  const b = normSub(args.next);
  if (!a && !b) return null;
  if (!a) return b;
  if (!b || a === b) return a;

  const sa = shortsSpecificity(a);
  const sb = shortsSpecificity(b);

  // Upgrade specificity (athletic → chino) — always allow.
  if (sb > sa) return b;

  // Downgrade (chino → athletic / tailored → casual).
  if (sa > sb) {
    const sticky = (args.prevStability ?? 0) >= SHORTS_STICKY_STABILITY;
    const strong = (args.nextConfidence ?? 0) >= SHORTS_DOWNGRADE_MIN_CONF;
    if (sticky && !strong) return a;
    if (!strong) return a;
    return b;
  }

  // Same specificity band — keep prev unless next is clearly stronger conf (handled upstream).
  return a;
}

export function isShortsSubtypeFamily(sub: string | null | undefined): boolean {
  const s = normSub(sub);
  if (!s) return false;
  return /short/.test(s) || s === 'athletic_shorts' || s === 'casual_shorts'
    || s === 'tailored_shorts' || s === 'linen_shorts' || s === 'cargo_shorts'
    || s === 'chino_shorts';
}
