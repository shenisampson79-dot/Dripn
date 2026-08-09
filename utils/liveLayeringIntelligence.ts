/**
 * Thin Layering Intelligence — temporal consistency + category vetoes.
 * Sits between raw detections and UI; boxes/DBG/coaching read belief after LIM.
 */

import { CONFUSABLE_SHOE_FLIPS, type ShoeSubtype } from '@/utils/liveFootwearGate';
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
  chino_shorts: 8,
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

/** Single source for known detector confusions — see liveFootwearGate. */
const FOOTWEAR_VETO = CONFUSABLE_SHOE_FLIPS;

export const LIM_HISTORY_LEN = 5;
export const LIM_LOCK_CONFIDENCE = 0.85;
export const LIM_UNLOCK_CONFIDENCE = 0.97;
/** Sustained disagreeing frames required to break a lock. */
export const LIM_SUSTAINED_CHANGE = 3;
/** Peer swaps (boat ↔ trainers) are plausible but must not flip on one frame. */
export const LIM_PEER_SUSTAINED_CHANGE = 2;

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
  // Outerwear is the layer slot — never also fill {top} or layering copy
  // becomes "Worn over light blue blazer, light blue blazer…".
  if (/outerwear/.test(blob) || (
    /\b(jacket|coat|blazer|parka|gilet|anorak|overshirt)\b/.test(blob)
    && !/\b(t-?shirt|tee|polo|blouse|shirt)\b/.test(blob)
  )) {
    return false;
  }
  return /top|shirt|blouse|tee|polo|knit/.test(blob);
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

/**
 * Mirror of the server's sentence-case rule: garment names stay Title Case on
 * overlay labels but read as sentence case inside a summary clause.
 */
export function sentenceCaseGarmentName(name: string, atSentenceStart = false): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const colourOrTone = /^(black|white|navy|grey|gray|brown|cream|beige|khaki|olive|red|blue|green|pink|purple|orange|yellow|turquoise|charcoal|stone|tan|neon|light|dark|multicolou?r)$/i;
  const garmentWord = /^(t-?shirts?|tees?|shirts?|jeans|trousers?|pants?|trainers?|sneakers?|boots?|loafers?|sandals?|heels?|tote|bag|bags?|jacket|blazer|coat|hoodie|polo|blouse|skirt|dress|shorts?|joggers?|singlet|overshirt|cargos?|chinos?|utility|plaid|striped|check(?:ed)?|henley|oxford)$/i;
  const descriptor = /^(relaxed|slim|straight|wide|cropped|canvas|leather|cotton|wool|knit|crew|low-?top|high-?top|insulated|elastic-?waist|button-?(?:up|down)|short-?sleeve(?:d)?|long-?sleeve(?:d)?|sleeveless|running)$/i;
  const lowered = words.map((word) => {
    if (/^[A-Z]{2,}$/.test(word)) return word;
    if (colourOrTone.test(word) || garmentWord.test(word) || descriptor.test(word)) {
      return word.toLowerCase();
    }
    // Soften leftover Title Case tokens (Cream → cream) while keeping mixed brands.
    if (/^[A-Z][a-z'’]*(-[A-Za-z][a-z'’]*)*$/.test(word)) return word.toLowerCase();
    return word;
  });
  const out = lowered.join(' ');
  if (!atSentenceStart) return out;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Render server-owned summary copy with current belief display names.
 * Belief supplies nouns only; it never writes or changes the sentence meaning.
 */
export function syncCoachingToBelief<T extends {
  summary?: string;
  summaryTemplate?: string;
  headline?: string;
  bullets?: string[];
  outfitSignature?: string;
  sameLane?: boolean;
}>(
  coaching: T | null | undefined,
  pieces: BeliefPieceForCoach[],
  _opts: { score?: number | null } = {},
): T | null | undefined {
  if (!coaching?.summary) return coaching;
  const dress = pieces.find(isDressPiece);
  const outer = pieces.find((p) =>
    /outerwear/i.test(String(p.category || ''))
    || /outer|jacket|coat|blazer|parka|gilet/i.test(`${p.subcategory || ''} ${p.name || ''}`),
  );
  const top = pieces.find((p) => p !== outer && isTopPiece(p));
  const bottom = pieces.find(isBottomPiece);
  const shoes = pieces.find(isShoePiece);
  const accessory = pieces.find(isAccessoryPiece);

  // The server owns the complete sentence. The client only injects current
  // belief names into explicit role slots, so stale frame labels are corrected
  // without inventing praise, tension, or footwear meaning on-device.
  let summary = String(coaching.summary);
  const template = String(coaching.summaryTemplate || '').trim();
  if (template) {
    const names: Record<string, string | undefined> = {
      onePiece: dress?.name,
      layer: outer?.name,
      top: top?.name,
      bottom: bottom?.name,
      shoes: shoes?.name,
      accessory: accessory?.name,
    };
    // Same garment in both slots is a merge bug — leave the server sentence.
    if (
      names.layer
      && names.top
      && String(names.layer).toLowerCase() === String(names.top).toLowerCase()
    ) {
      names.top = undefined;
    }
    let unresolved = false;
    const rendered = template.replace(
      /\{(onePiece|layer|top|bottom|shoes|accessory)\}/g,
      (_match, role: string, offset: number) => {
        const name = names[role];
        if (!name) {
          unresolved = true;
          return '';
        }
        return sentenceCaseGarmentName(name, offset === 0);
      },
    );
    if (!unresolved) summary = rendered;
  }

  summary = summary
    .replace(/_/g, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s*,\s+and\s+/gi, ' and ')
    .replace(/\s+and\s*\./gi, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
  summary = packSummary([summary], LIVE_SUMMARY_MAX);
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
    const peerFlip =
      (args.lockedSubtype === 'boat_shoes' && (subtype === 'sneakers' || subtype === 'trainers'))
      || (args.lockedSubtype === 'sneakers' && subtype === 'boat_shoes')
      || (args.lockedSubtype === 'trainers' && subtype === 'boat_shoes');
    // A Vision peer (boat ↔ trainers) may unlock the veto, but it has to hold
    // across frames — one confident frame made the label alternate on camera.
    const peerFrames = recent.filter(
      (h) => h.label === subtype && h.confidence >= 0.85,
    ).length;
    if (!(peerFlip && peerFrames >= LIM_PEER_SUSTAINED_CHANGE)) {
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
    // A peer flip is plausible enough that one confident frame used to be
    // enough — which made boat shoes and trainers alternate frame to frame.
    // Two agreeing frames still corrects a wrong lock within a second or two.
    const requiredStrong = peerFlip ? LIM_PEER_SUSTAINED_CHANGE : 1;
    const canUnlock = lockConf < LIM_LOCK_CONFIDENCE
      || disagreeStrong.length >= requiredStrong
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
  footwearName?: string | null;
  footwearSubtype?: string | null;
  hasDrawstring?: boolean;
  meshTexture?: boolean;
};

/**
 * Disambiguate bare Vision "shorts" using outfit context.
 * Tee + trainers/flip-flops → athletic; chino cues or shirt/loafers/hoodie → casual/tailored.
 */
export function resolveShortsWithContext(
  currentSubtype: string | null | undefined,
  context: ShortsResolveContext = {},
): 'athletic_shorts' | 'casual_shorts' | 'tailored_shorts' | 'linen_shorts' | 'cargo_shorts' | string {
  const sub = String(currentSubtype || '').toLowerCase();
  const topBlob = `${context.topName || ''} ${context.topSubtype || ''}`.toLowerCase();
  const shoeBlob = `${context.footwearName || ''} ${context.footwearSubtype || ''}`.toLowerCase();
  const structuredTop = /oxford_shirt|linen_shirt|button[\s-]?up|button[\s-]?down|dress[\s_-]*shirt|linen/.test(topBlob)
    || (/\bshirt\b/.test(topBlob) && !/t-?shirt|\btee\b/.test(topBlob));
  const teeLike = !structuredTop && (/\b(t-?shirt|tee|jersey)\b/.test(topBlob) || /basic_tee|oversized_tee/.test(topBlob));
  const hoodieLike = /\b(hoodie|sweatshirt|crewneck|crew\s*neck)\b/.test(topBlob);
  const athleticShoes = /\b(trainers?|sneakers?|runners?|flip[-\s]?flops?|slides?|sliders?|sandals?|wellington|wellies|gumboot)\b/.test(shoeBlob);
  const dressyShoes = /\b(loafers?|oxfords?|brogues?|derbies?|boat\s*shoes?|deck\s*shoes?|dress\s*shoes?|chelsea|monk)\b/.test(shoeBlob);
  const strongAthletic = /gym|sweat|jersey|running|sport|basketball|training|terry|drawstring|mesh/.test(sub)
    || Boolean(context.hasDrawstring || context.meshTexture);
  const softAthleticStamp = sub === 'athletic_shorts' && !strongAthletic;

  if (/tailored|chino|smart|bermuda|pleat/.test(sub)) return 'tailored_shorts';
  if (/linen/.test(sub)) return 'linen_shorts';
  if (/cargo/.test(sub)) return 'cargo_shorts';

  if (softAthleticStamp && (dressyShoes || hoodieLike || structuredTop || /\bpolo\b/.test(topBlob))) {
    return 'casual_shorts';
  }

  if (context.hasDrawstring || context.meshTexture) {
    if (!structuredTop) return 'athletic_shorts';
  }
  if (strongAthletic && /athletic_shorts|gym|sweat|jersey|running|sport|basketball|training|terry/.test(sub) && !structuredTop) {
    return 'athletic_shorts';
  }
  if (structuredTop || dressyShoes || /\bpolo\b/.test(topBlob)) return 'casual_shorts';
  if (hoodieLike && !strongAthletic) return 'casual_shorts';
  if (teeLike && athleticShoes && !dressyShoes) return 'athletic_shorts';
  if (teeLike && !dressyShoes && (!sub || sub === 'shorts')) return 'athletic_shorts';
  if (structuredTop && /athletic/.test(sub)) return 'casual_shorts';
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
