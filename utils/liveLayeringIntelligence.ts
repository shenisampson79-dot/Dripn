/**
 * Thin Layering Intelligence — temporal consistency + category vetoes.
 * Sits between raw detections and UI; boxes/DBG/coaching read belief after LIM.
 */

import type { ShoeSubtype } from '@/utils/liveFootwearGate';
import { polishUkCoaching, polishUkLiveLabel } from '@/utils/liveLocaleLabels';
import { LIVE_SUMMARY_MAX, packSummary } from '@/utils/packSummary';

export type LimSample = {
  label: string;
  confidence: number;
  color?: string | null;
};

/** Specific labels beat coarse remaps (ChatGPT pickBetter). */
export const SUBTYPE_SPECIFICITY: Record<string, number> = {
  flip_flops: 12,
  slides: 11,
  // Peer band — Vision may flip boat↔sneakers; specificity alone must not lock YOLO mistakes
  boat_shoes: 8,
  sandals: 6,
  sneakers: 8,
  trainers: 8,
  boots: 7,
  oxford_shirt: 9,
  linen_shirt: 9,
  button_up: 8,
  casual_shorts: 7,
  tailored_shorts: 8,
  linen_shorts: 7,
  athletic_shorts: 6,
  shorts: 3,
  sweatpants: 9,
  joggers: 9,
  trousers: 5,
  top: 1,
  shoes: 1,
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
  flip_flops: ['sandals', 'sneakers'],
  slides: ['sandals', 'sneakers'],
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

/** Prefer more specific subtype; never coarsen flip_flops→sandals, boat→trainers. */
export function pickMoreSpecificSubtype(
  prev: string | null | undefined,
  next: string | null | undefined,
): string | null {
  const a = prev ? String(prev).toLowerCase().replace(/[\s-]+/g, '_') : null;
  const b = next ? String(next).toLowerCase().replace(/[\s-]+/g, '_') : null;
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  const sa = SUBTYPE_SPECIFICITY[a] ?? 0;
  const sb = SUBTYPE_SPECIFICITY[b] ?? 0;
  if (sb > sa) return b;
  if (sa > sb) return a;
  return b;
}

/** Stability score — lock when high confidence + enough agreeing frames. */
export function computeStabilityScore(args: {
  confidence: number;
  seenFrames: number;
  agreeRatio: number;
}): number {
  const conf = Math.max(0, Math.min(1, args.confidence));
  const frames = Math.max(0, args.seenFrames);
  const agree = Math.max(0, Math.min(1, args.agreeRatio));
  return conf * 0.5 + Math.min(1, Math.log10(frames + 1) / Math.log10(6)) * 0.3 + agree * 0.2;
}

export function shouldLockBelief(args: {
  confidence: number;
  seenFrames: number;
  agreeRatio: number;
}): boolean {
  return args.seenFrames >= 3 && computeStabilityScore(args) >= 0.75;
}

/** Median-ish colour from last N frames (weighted vote). */
export function stabilizeColorFromHistory(args: {
  history: LimSample[];
  proposed: LimSample | null;
  lockedColor?: string | null;
}): { color: string | null; history: LimSample[] } {
  const history = [...(args.history || [])];
  if (args.proposed) {
    history.push({
      label: args.proposed.label || 'slot',
      confidence: args.proposed.confidence,
      color: args.proposed.color ?? null,
    });
  }
  const recent = history.slice(-LIM_HISTORY_LEN);
  const vote = weightedVote(
    recent
      .filter((h) => h.color)
      .map((h) => ({ value: String(h.color), confidence: h.confidence })),
  );
  let color = vote || args.proposed?.color || args.lockedColor || null;
  // Dim frames: don't let black win a light lock.
  if (
    args.lockedColor
    && /^(white|gray|grey|cream|beige|ivory)$/i.test(args.lockedColor)
    && color
    && /^(black|charcoal)$/i.test(color)
  ) {
    const blackFrames = recent.filter((h) => /black|charcoal/i.test(String(h.color || ''))).length;
    if (blackFrames < LIM_SUSTAINED_CHANGE) color = args.lockedColor;
  }
  return { color, history: recent };
}

export type BeliefPieceForCoach = {
  name: string;
  category: string;
  subcategory?: string | null;
  color?: string | null;
};

function isDressPiece(p: BeliefPieceForCoach): boolean {
  const blob = `${p.category} ${p.subcategory || ''} ${p.name || ''}`.toLowerCase();
  if (/dress[\s_-]*shirt|shirt[\s_-]*dress/.test(blob)) return false;
  return /\bdress\b/.test(blob) || /dresses/.test(blob);
}

function isTopPiece(p: BeliefPieceForCoach): boolean {
  const blob = `${p.category} ${p.subcategory || ''} ${p.name || ''}`.toLowerCase();
  if (isDressPiece(p)) return false;
  return /top|shirt|outer|blouse|tee|polo|jacket|knit|coat|blazer/.test(blob);
}

function isBottomPiece(p: BeliefPieceForCoach): boolean {
  const blob = `${p.category} ${p.subcategory || ''} ${p.name || ''}`.toLowerCase();
  if (isDressPiece(p)) return false;
  return /bottom|short|trouser|skirt|pant|chino|sweatpant|jogger/.test(blob);
}

function isShoePiece(p: BeliefPieceForCoach): boolean {
  const blob = `${p.category} ${p.subcategory || ''} ${p.name || ''}`.toLowerCase();
  return /shoe|footwear|boot|loafer|trainer|sneaker|sandal|oxford|chelsea/.test(blob)
    && !/oxford\s*shirt|dress\s*shirt/.test(blob);
}

function isAccessoryPiece(p: BeliefPieceForCoach): boolean {
  const blob = `${p.category} ${p.subcategory || ''} ${p.name || ''}`.toLowerCase();
  return /\btie\b|necktie|bow\s*tie|scarf|belt|accessor/.test(blob);
}

function footwearGroundVerb(name: string): string {
  return /\b(shoes|boots|trainers|sneakers|loafers|oxfords|sandals|slides|flip-?flops)\b/i.test(name)
    ? 'ground'
    : 'grounds';
}

/**
 * Force coaching copy to use belief display names — single UI truth.
 * Belief must already carry Vision-fused labels (specificity wins).
 */
export function syncCoachingToBelief<T extends {
  summary?: string;
  headline?: string;
  bullets?: string[];
  outfitSignature?: string;
}>(
  coaching: T | null | undefined,
  pieces: BeliefPieceForCoach[],
): T | null | undefined {
  if (!coaching?.summary || !pieces.length) return coaching;

  const dress = pieces.find(isDressPiece);
  const top = pieces.find(isTopPiece);
  const bottom = pieces.find(isBottomPiece);
  const shoes = pieces.find(isShoePiece);
  const outer = pieces.find((p) =>
    /outer|jacket|coat|blazer/i.test(`${p.category} ${p.subcategory || ''} ${p.name || ''}`),
  );
  const accessory = pieces.find(isAccessoryPiece);

  const parts: string[] = [];
  if (dress && !bottom) {
    parts.push(`${dress.name} carries the look`);
    if (outer?.name) parts.push(`${outer.name} adds a relaxed layer`);
  } else if (top?.name && bottom?.name) {
    parts.push(`${top.name} and ${bottom.name} work well together`);
    if (outer?.name && outer !== top) parts.push(`${outer.name} adds a relaxed layer`);
  } else if (top?.name) {
    parts.push(`${top.name} carries the look`);
  } else if (bottom?.name) {
    parts.push(`${bottom.name} carry the look`);
  } else if (dress?.name) {
    parts.push(`${dress.name} carries the look`);
  }

  if (accessory?.name) {
    parts.push(`${accessory.name} finishes the look`);
  }

  if (shoes?.name && !/\bdress\b/i.test(shoes.name)) {
    parts.push(`${shoes.name} ${footwearGroundVerb(shoes.name)} the look`);
  }

  let summary: string;
  if (parts.length >= 1) {
    summary = packSummary(parts, LIVE_SUMMARY_MAX);
    if (summary) {
      summary = `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
      if (!/[.!?]$/.test(summary)) summary = `${summary}.`;
    }
  } else {
    summary = String(coaching.summary);
    summary = summary.replace(
      /(?:,\s*)?(?:and\s+)?[^.,—]*?\bgrounds?\s+the\s+look\b/gi,
      '',
    );
    summary = summary.replace(/\b\w+\s+Dress\s+grounds?\s+the\s+look\b/gi, '');
  }

  summary = summary
    .replace(/_/g, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s*,\s+and\s+/gi, ' and ')
    .replace(/\s+and\s*\./gi, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
  if (summary && !/[.!?]$/.test(summary)) summary = `${summary}.`;

  const bullets = Array.isArray(coaching.bullets)
    ? coaching.bullets.map((b) => String(b).replace(/_/g, ' '))
    : coaching.bullets;

  return polishUkCoaching({
    ...coaching,
    summary: polishUkLiveLabel(summary),
    bullets,
    ...(coaching.outfitSignature
      ? { outfitSignature: polishUkLiveLabel(String(coaching.outfitSignature).replace(/_/g, ' ')) }
      : {}),
  }) as T;
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
    const proposedConf = args.proposed?.confidence ?? 0;
    const peerFlip =
      (args.lockedSubtype === 'boat_shoes' && (subtype === 'sneakers' || subtype === 'trainers'))
      || (args.lockedSubtype === 'sneakers' && subtype === 'boat_shoes')
      || (args.lockedSubtype === 'trainers' && subtype === 'boat_shoes');
    // High-confidence Vision peer (sneakers ↔ boat) may unlock — don't hard-veto.
    if (!(peerFlip && proposedConf >= 0.85)) {
      subtype = applyFootwearVeto(args.lockedSubtype, subtype);
    }
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
    const peerFlip =
      (args.lockedSubtype === 'boat_shoes' && (subtype === 'sneakers' || subtype === 'trainers'))
      || ((args.lockedSubtype === 'sneakers' || args.lockedSubtype === 'trainers')
        && subtype === 'boat_shoes');
    const disagreeStrong = disagree.filter((h) => h.confidence >= (peerFlip ? 0.85 : LIM_UNLOCK_CONFIDENCE));
    const canUnlock = lockConf < LIM_LOCK_CONFIDENCE
      || disagreeStrong.length >= 1
      || disagree.length >= LIM_SUSTAINED_CHANGE
      || (peerFlip && (args.proposed?.confidence ?? 0) >= 0.85);
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
  stabilizeColor: stabilizeColorFromHistory,
  resolveShorts: resolveShortsWithContext,
  normalizeColor: normalizeWarmLightingColor,
  applyFootwearVeto,
  pickMoreSpecific: pickMoreSpecificSubtype,
  syncCoaching: syncCoachingToBelief,
  shouldLock: shouldLockBelief,
};
