/**
 * Final Outfit Truth — thin snapshot after arbitration.
 *
 * Position in the pipeline:
 *   YOLO + Vision → belief arbitration → sanitize → buildOutfitTruth → UI
 *
 * This module does NOT recompute score, rewrite summaries, or re-run geometry.
 * Those already live in the scorer and belief engines. It only:
 *   1. strips invalid labels that must never enter truth (defense in depth)
 *   2. clamps identity flicker against the previous truth
 *   3. freezes the resolved outfit into one object
 *   4. derives a single hasConflict flag reconciled with score + lane
 *   5. carries seed detections so a live restart within ~2s can warm-start
 *
 * Downstream systems read this. They do not reinterpret the outfit.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import type { LiveCoaching, LiveFeedback } from '@/types/liveStylist';
import type { GarmentBelief, OutfitBeliefState } from '@/utils/liveGarmentBelief';
import { liveBeliefIsSettled } from '@/utils/liveScoreStability';

/** Keep last stable truth this long after Stop so restart does not cold-boot. */
export const LIVE_TRUTH_WARM_MS = 2000;

/**
 * Confidence gap required to accept a new label over the previous truth.
 * Matches the belief continuity rule — clothes do not change between frames.
 */
export const TRUTH_CONTINUITY_CONF_GAP = 0.25;

/** Cohesive scores at or above this cannot be forced into conflict by archetype alone. */
export const TRUTH_COHESIVE_SCORE = 65;

export type LiveTruthItem = {
  name: string;
  category: string;
  subcategory?: string;
  color?: string | null;
  confidence: number;
  stability: number;
  bbox?: [number, number, number, number];
};

export type LiveOutfitTruth = {
  top: LiveTruthItem | null;
  layer: LiveTruthItem | null;
  bottom: LiveTruthItem | null;
  footwear: LiveTruthItem | null;
  lane: string | null;
  /** Gated score already decided upstream — never recomputed here. */
  score: number | null;
  /** Single conflict flag: summary, bullets, and suggestions must agree. */
  hasConflict: boolean;
  isStable: boolean;
  /**
   * high = core + top locked; medium = core locked, top still drifting.
   * Downstream softens strong labels on medium — scoring is not blocked.
   */
  confidenceLevel: 'high' | 'medium';
  signature: string;
  timestamp: number;
  /** Detections that can re-seed belief on a warm restart. */
  seedDetections: OnDeviceDetection[];
};

export type WarmTruthStash = {
  truth: LiveOutfitTruth;
  stoppedAt: number;
};

const COHESION_PRAISE_RE =
  /work(s| well)? together|consistent direction|feel(s)? balanced|complement each other|holds a consistent/i;
const TENSION_BULLET_RE =
  /inconsistenc|different wardrobes|different directions|formality|pieces are mixed|read as one outfit|do not (fully )?come together|shapes of these pieces/i;

/**
 * Household textiles and hangers that have slipped past belief before.
 * Belief already drops these; this is the last gate before freeze.
 */
const BLOCKED_LABEL_RE =
  /\b(towel|blanket|duvet|quilt|curtain|cushion|pillow|bedding|bed\s*sheet|rug|door\s*mat|hanger|fabric)s?\b/i;

function itemFromBelief(b: GarmentBelief | null | undefined): LiveTruthItem | null {
  if (!b) return null;
  return {
    name: String(b.name || b.subcategory || b.kind || '').trim(),
    category: String(b.category || ''),
    subcategory: b.subcategory || undefined,
    color: b.color ?? null,
    confidence: Number(b.confidence) || 0,
    stability: Number(b.stability) || 0,
    bbox: Array.isArray(b.bbox) && b.bbox.length === 4
      ? (b.bbox as [number, number, number, number])
      : undefined,
  };
}

/**
 * Nothing invalid enters truth. A towel that somehow survived arbitration is
 * dropped here rather than frozen and scored.
 */
export function sanitizeTruthItem(item: LiveTruthItem | null): LiveTruthItem | null {
  if (!item) return null;
  const blob = `${item.name} ${item.subcategory || ''} ${item.category || ''}`;
  if (BLOCKED_LABEL_RE.test(blob)) return null;
  if (!item.name.trim()) return null;
  return item;
}

/**
 * Continuity clamp: a louder stranger on one slot does not replace the held
 * garment unless confidence clears the gap. Per-slot — a real top change must
 * not freeze the whole previous outfit.
 */
export function clampTruthContinuity(
  next: LiveTruthItem | null,
  prev: LiveTruthItem | null | undefined,
): LiveTruthItem | null {
  if (!next) return null;
  if (!prev?.name) return next;
  if (next.name.toLowerCase() === prev.name.toLowerCase()) return next;
  const delta = Number(next.confidence) - Number(prev.confidence);
  if (delta < TRUTH_CONTINUITY_CONF_GAP) return prev;
  return next;
}

function detectionFromTruthItem(
  item: LiveTruthItem | null,
  trackId: string,
): OnDeviceDetection | null {
  if (!item?.name) return null;
  return {
    name: item.name,
    category: item.category || 'tops',
    subcategory: item.subcategory,
    color: item.color || undefined,
    confidence: Math.max(0.85, Number(item.confidence) || 0.85),
    bbox: item.bbox || [0.25, 0.2, 0.4, 0.35],
    trackId,
  };
}

function hasTensionEvidence(args: {
  coaching?: LiveCoaching | null;
  issues?: string[] | null;
}): boolean {
  const coaching = args.coaching;
  // sameLane=false alone is soft disagreement — not hard tension evidence.
  // Treating it as tension made high scores keep Mixed directions forever.
  const issues = Array.isArray(args.issues) ? args.issues : [];
  const bullets = Array.isArray(coaching?.bullets) ? coaching.bullets : [];
  return [...issues, ...bullets, String(coaching?.summary || '')]
    .some((line) => TENSION_BULLET_RE.test(String(line)));
}

/**
 * Conflict is one boolean. A high cohesive score + agreeing lane outranks an
 * orphaned tension archetype so the UI cannot be forced into conflict mode
 * when the number already says the look holds together.
 */
export function deriveOutfitConflict(args: {
  score?: number | null;
  coaching?: LiveCoaching | null;
  issues?: string[] | null;
}): boolean {
  const coaching = args.coaching;
  const score = Number(args.score);
  const cohesiveHigh = Number.isFinite(score) && score >= 80;
  const cohesive = Number.isFinite(score)
    && score >= TRUTH_COHESIVE_SCORE
    && coaching?.sameLane !== false;
  const tensionEvidence = hasTensionEvidence(args);

  // High scores must not keep Mixed directions from a soft sameLane=false.
  if (cohesiveHigh && !tensionEvidence) {
    if (coaching?.hasConflict && coaching?.sameLane === false) return false;
    if (coaching?.sameLane === false && !coaching?.hasConflict) return false;
  }

  if (coaching && typeof coaching.hasConflict === 'boolean') {
    if (coaching.hasConflict && cohesive && !tensionEvidence) return false;
    if (coaching.hasConflict && cohesiveHigh && !tensionEvidence) return false;
    return coaching.hasConflict;
  }
  if (coaching?.sameLane === false) {
    if (cohesiveHigh && !tensionEvidence) return false;
    return true;
  }
  if (String(coaching?.summaryArchetype || '') === 'tension') {
    // Archetype alone is not enough when score + lane already say cohesive.
    if (cohesive && !tensionEvidence) return false;
    if (cohesiveHigh && !tensionEvidence) return false;
    return true;
  }
  if (Number.isFinite(score) && score < TRUTH_COHESIVE_SCORE && tensionEvidence) return true;
  if (TENSION_BULLET_RE.test(String(coaching?.summary || ''))) return true;
  return false;
}

export function truthSignature(truth: Pick<LiveOutfitTruth, 'top' | 'layer' | 'bottom' | 'footwear'>): string {
  return [
    truth.top?.name,
    truth.layer?.name,
    truth.bottom?.name,
    truth.footwear?.name,
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
}

/**
 * Snapshot the arbitrated belief + already-gated score into one immutable truth.
 * Sanitize and continuity-clamp first so garbage never freezes.
 */
export function buildOutfitTruth(args: {
  belief: OutfitBeliefState | null | undefined;
  feedback?: LiveFeedback | null;
  prev?: LiveOutfitTruth | null;
  now?: number;
  confidenceLevel?: 'high' | 'medium';
}): LiveOutfitTruth {
  const belief = args.belief;
  const feedback = args.feedback;
  const prev = args.prev;

  let top = sanitizeTruthItem(itemFromBelief(belief?.top));
  let layer = sanitizeTruthItem(itemFromBelief(belief?.layer));
  let bottom = sanitizeTruthItem(
    belief?.bottom?.kind === 'dress'
      ? itemFromBelief(belief.bottom)
      : itemFromBelief(belief?.bottom),
  );
  let footwear = sanitizeTruthItem(itemFromBelief(belief?.footwear));

  top = clampTruthContinuity(top, prev?.top);
  layer = clampTruthContinuity(layer, prev?.layer);
  bottom = clampTruthContinuity(bottom, prev?.bottom);
  footwear = clampTruthContinuity(footwear, prev?.footwear);

  // Top and layer must never hold the same garment (blazer/trench duplicate).
  if (top?.name && layer?.name) {
    const same =
      top.name.toLowerCase().replace(/\s+/g, ' ')
      === layer.name.toLowerCase().replace(/\s+/g, ' ');
    if (same) {
      if (Number(top.confidence) >= Number(layer.confidence)) layer = null;
      else top = null;
    }
  }

  const score = feedback?.score ?? null;
  const coaching = feedback?.coaching;
  const hasConflict = deriveOutfitConflict({
    score,
    coaching,
    issues: feedback?.issues,
  });
  const isStable = liveBeliefIsSettled([
    belief?.top,
    belief?.layer,
    belief?.bottom,
    belief?.footwear,
  ]);
  const seedDetections = [
    detectionFromTruthItem(top, 'warm_top'),
    detectionFromTruthItem(layer, 'warm_layer'),
    detectionFromTruthItem(bottom, 'warm_bottom'),
    detectionFromTruthItem(footwear, 'warm_shoes'),
  ].filter(Boolean) as OnDeviceDetection[];

  const truth: LiveOutfitTruth = {
    top,
    layer,
    bottom,
    footwear,
    lane: coaching?.styleLane || null,
    score: score == null ? null : Number(score),
    hasConflict,
    isStable,
    confidenceLevel: args.confidenceLevel
      || (isStable ? 'high' : 'medium'),
    signature: '',
    timestamp: args.now ?? Date.now(),
    seedDetections,
  };
  truth.signature = truthSignature(truth);
  return truth;
}

/**
 * Safety net only. Server composeLiveCritique now generates bullets already
 * aligned to hasConflict; this strips any residual drift before paint without
 * being the primary author of meaning.
 */
export function alignCoachingToTruth<T extends LiveCoaching>(
  coaching: T | null | undefined,
  truth: LiveOutfitTruth,
): T | null | undefined {
  if (!coaching) return coaching;
  const bullets = Array.isArray(coaching.bullets) ? [...coaching.bullets] : [];
  let nextBullets = bullets;
  if (truth.hasConflict) {
    nextBullets = bullets.filter((b) => !COHESION_PRAISE_RE.test(String(b)));
  } else {
    nextBullets = bullets.filter((b) => !TENSION_BULLET_RE.test(String(b)));
  }
  let headline = coaching.headline;
  // Sticky Mixed directions after conflict clears — rewrite to lane/band tone.
  if (!truth.hasConflict && /mixed directions?/i.test(String(headline || ''))) {
    const score = Number(truth.score);
    if (Number.isFinite(score) && score >= 90) headline = 'Polished';
    else if (Number.isFinite(score) && score >= 80) headline = 'Looking good';
    else if (truth.lane === 'athleisure') headline = 'Sport-ready';
    else if (truth.lane === 'smart_casual') headline = 'Smart casual';
    else headline = 'Looking good';
  }
  return {
    ...coaching,
    headline,
    hasConflict: truth.hasConflict,
    sameLane: truth.hasConflict ? coaching.sameLane : true,
    bullets: nextBullets,
  };
}

export function canWarmStartTruth(
  stash: WarmTruthStash | null | undefined,
  now = Date.now(),
): boolean {
  if (!stash?.truth?.seedDetections?.length) return false;
  if (now - stash.stoppedAt > LIVE_TRUTH_WARM_MS) return false;
  // Unstable last session must not seed the identity buffer into an instant lock.
  return Boolean(stash.truth.isStable);
}

export function stashWarmTruth(
  truth: LiveOutfitTruth | null | undefined,
  now = Date.now(),
): WarmTruthStash | null {
  if (!truth?.seedDetections?.length) return null;
  if (!truth.isStable) return null;
  return { truth, stoppedAt: now };
}
