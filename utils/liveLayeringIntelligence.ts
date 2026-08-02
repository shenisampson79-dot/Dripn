/**
 * Thin Layering Intelligence — temporal consistency + category vetoes.
 * Sits between raw footwear/bottom proposals and belief; not a second pipeline.
 */

import type { ShoeSubtype } from '@/utils/liveFootwearGate';

export type LimSample = {
  label: string;
  confidence: number;
  color?: string | null;
};

/** Specific closed-shoe labels beat coarse remaps when votes tie. */
export const FOOTWEAR_PRIORITY: ShoeSubtype[] = [
  'boat_shoes',
  'flip_flops',
  'slides',
  'sandals',
  'sneakers',
  'boots',
];

const FOOTWEAR_VETO: Partial<Record<ShoeSubtype, ShoeSubtype[]>> = {
  boat_shoes: ['boots', 'sneakers'],
};

export const LIM_HISTORY_LEN = 5;
export const LIM_LOCK_CONFIDENCE = 0.85;
export const LIM_UNLOCK_CONFIDENCE = 0.97;
/** Sustained disagreeing frames required to break a lock. */
export const LIM_SUSTAINED_CHANGE = 3;

export function weightedVote(
  samples: Array<{ value: string; confidence: number }>,
): string | null {
  if (!samples.length) return null;
  const scores = new Map<string, number>();
  for (const s of samples) {
    const key = String(s.value || '').trim();
    if (!key) continue;
    const w = Number.isFinite(s.confidence) ? Math.max(0.05, s.confidence) : 0.5;
    scores.set(key, (scores.get(key) || 0) + w);
  }
  if (!scores.size) return null;
  let best: string | null = null;
  let bestScore = -1;
  for (const [label, score] of scores) {
    if (score > bestScore) {
      best = label;
      bestScore = score;
    }
  }
  return best;
}

function priorityRank(label: string): number {
  const i = FOOTWEAR_PRIORITY.indexOf(label as ShoeSubtype);
  return i >= 0 ? i : FOOTWEAR_PRIORITY.length + 1;
}

/** Prefer higher-specificity footwear when vote weights are close. */
export function pickFootwearByPriority(labels: string[]): ShoeSubtype | null {
  const uniq = [...new Set(labels.filter(Boolean))];
  if (!uniq.length) return null;
  uniq.sort((a, b) => priorityRank(a) - priorityRank(b));
  return uniq[0] as ShoeSubtype;
}

export function applyFootwearVeto(
  locked: ShoeSubtype | null | undefined,
  proposed: ShoeSubtype,
): ShoeSubtype {
  if (!locked || locked === proposed) return proposed;
  const vetoed = FOOTWEAR_VETO[locked];
  if (vetoed?.includes(proposed)) return locked;
  return proposed;
}

/**
 * Temporal footwear identity: vote last N frames, honor locks + boat vetoes.
 */
export function stabilizeFootwearIdentity(args: {
  history: LimSample[];
  proposed: LimSample | null;
  lockedSubtype?: ShoeSubtype | null;
  lockedColor?: string | null;
}): { subtype: ShoeSubtype | null; color: string | null; history: LimSample[] } {
  const history = [...(args.history || [])];
  if (args.proposed?.label) {
    history.push({
      label: args.proposed.label,
      confidence: args.proposed.confidence,
      color: args.proposed.color ?? null,
    });
  }
  const recent = history.slice(-LIM_HISTORY_LEN);

  const voteLabel = weightedVote(
    recent.map((h) => ({ value: h.label, confidence: h.confidence })),
  );
  const voteColor = weightedVote(
    recent
      .filter((h) => h.color)
      .map((h) => ({ value: String(h.color), confidence: h.confidence })),
  );

  let subtype = (voteLabel || args.proposed?.label || args.lockedSubtype || null) as ShoeSubtype | null;
  if (subtype && args.lockedSubtype) {
    subtype = applyFootwearVeto(args.lockedSubtype, subtype);
  }

  // Confidence lock: hold identity until stronger or sustained disagreement.
  if (args.lockedSubtype && subtype && subtype !== args.lockedSubtype) {
    const lockConf = Math.max(
      ...recent
        .filter((h) => h.label === args.lockedSubtype)
        .map((h) => h.confidence),
      0,
    );
    const disagree = recent.filter((h) => h.label === subtype);
    const disagreeStrong = disagree.filter((h) => h.confidence >= LIM_UNLOCK_CONFIDENCE);
    const canUnlock = lockConf < LIM_LOCK_CONFIDENCE
      || disagreeStrong.length >= 1
      || disagree.length >= LIM_SUSTAINED_CHANGE;
    if (!canUnlock) subtype = args.lockedSubtype;
  }

  let color = voteColor || args.proposed?.color || args.lockedColor || null;
  color = normalizeWarmLightingColor(args.lockedColor, color, {
    subtype: subtype || args.lockedSubtype,
  });

  return { subtype, color, history: recent };
}

/** Warm lamps invent brown over red/white boat shoes; keep chromatic when locked. */
export function normalizeWarmLightingColor(
  prev: string | null | undefined,
  next: string | null | undefined,
  opts?: { subtype?: string | null },
): string | null {
  const p = prev ? String(prev).toLowerCase() : null;
  const c = next ? String(next).toLowerCase() : null;
  if (!c) return p;
  if (!p) return c;

  const boatish = /boat/.test(String(opts?.subtype || ''));
  if (
    (p === 'red' || p === 'burgundy' || p === 'white')
    && c === 'brown'
    && (boatish || p === 'red' || p === 'burgundy')
  ) {
    return p;
  }
  if (p === 'brown' && (c === 'red' || c === 'burgundy' || c === 'white') && boatish) {
    return c;
  }
  return c;
}

export type ShortsResolveContext = {
  topName?: string | null;
  topSubtype?: string | null;
  hasDrawstring?: boolean;
  meshTexture?: boolean;
};

/** Neutral default for plain shorts; athletic only with sport cues. */
export function resolveShortsWithContext(
  currentSubtype: string | null | undefined,
  context: ShortsResolveContext = {},
): 'athletic_shorts' | 'casual_shorts' | 'tailored_shorts' | 'linen_shorts' | string {
  const sub = String(currentSubtype || '').toLowerCase();
  const topBlob = `${context.topName || ''} ${context.topSubtype || ''}`.toLowerCase();
  const structuredTop = /oxford_shirt|linen_shirt|button[\s-]?up|button[\s-]?down|linen/.test(topBlob)
    || (/\bshirt\b/.test(topBlob) && !/t-?shirt|\btee\b/.test(topBlob));

  if (context.hasDrawstring || context.meshTexture) return 'athletic_shorts';
  if (/athletic_shorts|gym|sweat|jersey|running|sport/.test(sub) && !structuredTop) {
    return 'athletic_shorts';
  }
  if (/tailored|chino|smart|bermuda/.test(sub)) return 'tailored_shorts';
  if (/linen/.test(sub)) return 'linen_shorts';
  if (structuredTop) return 'casual_shorts';
  if (/athletic/.test(sub)) return 'casual_shorts';
  return sub || 'casual_shorts';
}

export const liveLayeringIntelligence = {
  weightedVote,
  stabilizeFootwear: stabilizeFootwearIdentity,
  resolveShorts: resolveShortsWithContext,
  normalizeColor: normalizeWarmLightingColor,
  applyFootwearVeto,
};
