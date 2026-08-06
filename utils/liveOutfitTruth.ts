/**
 * Final Outfit Truth — thin snapshot after arbitration.
 *
 * Position in the pipeline:
 *   YOLO + Vision → belief arbitration → buildOutfitTruth → UI / score / coaching
 *
 * This module does NOT recompute score, rewrite summaries, or re-run geometry.
 * Those already live in the scorer and belief engines. It only:
 *   1. freezes the current resolved outfit into one object
 *   2. derives a single hasConflict flag everyone must honour
 *   3. carries seed detections so a live restart within ~2s can warm-start
 *
 * Downstream systems read this. They do not reinterpret the outfit.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import type { LiveCoaching, LiveFeedback } from '@/types/liveStylist';
import type { GarmentBelief, OutfitBeliefState } from '@/utils/liveGarmentBelief';
import { liveBeliefIsSettled } from '@/utils/liveScoreStability';

/** Keep last stable truth this long after Stop so restart does not cold-boot. */
export const LIVE_TRUTH_WARM_MS = 2000;

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

/**
 * Conflict is true when the server already said so, the lane disagrees, the
 * score is in the tension band with a tension bullet, or the summary archetype
 * is tension. One boolean — no second opinion downstream.
 */
export function deriveOutfitConflict(args: {
  score?: number | null;
  coaching?: LiveCoaching | null;
  issues?: string[] | null;
}): boolean {
  const coaching = args.coaching;
  if (coaching && typeof (coaching as { hasConflict?: boolean }).hasConflict === 'boolean') {
    return Boolean((coaching as { hasConflict?: boolean }).hasConflict);
  }
  if (coaching?.sameLane === false) return true;
  if (String(coaching?.summaryArchetype || '') === 'tension') return true;
  const score = Number(args.score);
  const issues = Array.isArray(args.issues) ? args.issues : [];
  const coachingBullets = Array.isArray(coaching?.bullets) ? coaching.bullets : [];
  const tensionText = [...issues, ...coachingBullets].some((line) => TENSION_BULLET_RE.test(String(line)));
  if (Number.isFinite(score) && score < 65 && tensionText) return true;
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
 */
export function buildOutfitTruth(args: {
  belief: OutfitBeliefState | null | undefined;
  feedback?: LiveFeedback | null;
  now?: number;
}): LiveOutfitTruth {
  const belief = args.belief;
  const feedback = args.feedback;
  const top = itemFromBelief(belief?.top);
  const layer = itemFromBelief(belief?.layer);
  const bottom = belief?.bottom?.kind === 'dress'
    ? itemFromBelief(belief.bottom)
    : itemFromBelief(belief?.bottom);
  const footwear = itemFromBelief(belief?.footwear);
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
    signature: '',
    timestamp: args.now ?? Date.now(),
    seedDetections,
  };
  truth.signature = truthSignature(truth);
  return truth;
}

/**
 * Final coaching alignment against the single conflict flag.
 * Server should already agree; this catches any residual drift before paint.
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
  return {
    ...coaching,
    hasConflict: truth.hasConflict,
    bullets: nextBullets,
  };
}

export function canWarmStartTruth(
  stash: WarmTruthStash | null | undefined,
  now = Date.now(),
): boolean {
  if (!stash?.truth?.seedDetections?.length) return false;
  if (now - stash.stoppedAt > LIVE_TRUTH_WARM_MS) return false;
  return stash.truth.isStable || stash.truth.seedDetections.length >= 2;
}

export function stashWarmTruth(
  truth: LiveOutfitTruth | null | undefined,
  now = Date.now(),
): WarmTruthStash | null {
  if (!truth?.seedDetections?.length) return null;
  if (!truth.isStable && truth.seedDetections.length < 2) return null;
  return { truth, stoppedAt: now };
}
