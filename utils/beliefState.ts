/**
 * Live outfit belief — single center of gravity.
 *
 * Mutation path (only this):
 *   camera/cloud detections → updateLiveBelief() → OutfitBeliefState
 *
 * Read path:
 *   slotsFromBelief() → boxes / DBG
 *   syncCoachingToBelief() → analysis copy (never mutates belief)
 *
 * Do NOT invent a parallel outfit state in the UI or coaching layer.
 * Heavy rules stay in liveGarmentBelief / liveDetectionMemory / liveFootwearGate;
 * this file is the public contract so callers stop reaching into internals.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  appendDecision,
  type BeliefDecision,
} from '@/utils/liveBeliefDecisions';
import {
  applyOutfitBelief,
  createOutfitBeliefState,
  type GarmentBelief,
  type OutfitBeliefState,
} from '@/utils/liveGarmentBelief';
import {
  applyDetectionMemory,
  createDetectionMemory,
  type DetectionMemory,
} from '@/utils/liveDetectionMemory';
import {
  syncCoachingToBelief,
  type BeliefPieceForCoach,
} from '@/utils/liveLayeringIntelligence';
import {
  diffVisionToBelief,
  type VisionMutationDiff,
} from '@/utils/visionTrust';

export type {
  BeliefDecision,
  DetectionMemory,
  GarmentBelief,
  OutfitBeliefState,
  BeliefPieceForCoach,
  VisionMutationDiff,
};

export type BeliefSlots = {
  top: GarmentBelief | null;
  layer: GarmentBelief | null;
  bottom: GarmentBelief | null;
  shoes: GarmentBelief | null;
  onePiece: GarmentBelief | null;
  torsoState: OutfitBeliefState['torsoState'];
};

/** Empty belief — start of a live session. */
export function createBeliefState(): OutfitBeliefState {
  return createOutfitBeliefState();
}

export function createLiveBeliefMemory(): DetectionMemory {
  return createDetectionMemory();
}

/**
 * Canonical slots for UI / DBG / coaching.
 * Dress occupies bottom in belief; surface it as onePiece when present.
 */
export function slotsFromBelief(state: OutfitBeliefState | null | undefined): BeliefSlots {
  const bottom = state?.bottom ?? null;
  const isDress = bottom?.kind === 'dress';
  return {
    top: state?.top ?? null,
    layer: state?.layer ?? null,
    bottom: isDress ? null : bottom,
    shoes: state?.footwear ?? null,
    onePiece: isDress ? bottom : null,
    torsoState: state?.torsoState ?? 'uncertain',
  };
}

/**
 * Live-frame update: footwear gate + LIM colour/identity + outfit belief.
 * This is the only mutation entry the Live screen should call.
 */
export function updateLiveBelief(
  detections: OnDeviceDetection[],
  memory: DetectionMemory,
  opts?: {
    now?: number;
    bottomBandBrightness?: number | null;
    occasionType?: string | null;
    decisions?: BeliefDecision[];
  },
): {
  detections: OnDeviceDetection[];
  memory: DetectionMemory;
  slots: BeliefSlots;
  cropped: boolean;
  repairs: string[];
  decisions: BeliefDecision[];
  /** Trusted vision labels that belief rewrote — empty when trust is honoured. */
  mutations: VisionMutationDiff[];
} {
  const decisions = opts?.decisions || [];
  const result = applyDetectionMemory(detections, memory, {
    now: opts?.now,
    bottomBandBrightness: opts?.bottomBandBrightness,
    occasionType: opts?.occasionType,
    decisions,
  });
  const mutations = diffVisionToBelief(detections, result.detections, 'updateLiveBelief');
  for (const m of mutations) {
    appendDecision(decisions, {
      type: 'reject',
      message: `Vision override: ${m.before} → ${m.after}`,
      reason: m.reason,
      slot: 'frame',
      time: opts?.now ?? Date.now(),
    });
  }
  return {
    detections: result.detections,
    memory: result.memory,
    slots: slotsFromBelief(result.memory.belief),
    cropped: result.cropped,
    repairs: result.repairs,
    decisions: result.decisions,
    mutations,
  };
}

/**
 * Direct belief apply (tests / still-scan without footwear gate).
 * Prefer updateLiveBelief for the Live camera path.
 */
export function updateBeliefFromDetections(
  state: OutfitBeliefState,
  detections: OnDeviceDetection[],
  opts?: { now?: number; decisions?: BeliefDecision[] },
): {
  state: OutfitBeliefState;
  detections: OnDeviceDetection[];
  slots: BeliefSlots;
  repairs: string[];
  decisions: BeliefDecision[];
} {
  const decisions = opts?.decisions || [];
  const result = applyOutfitBelief(state, detections, {
    now: opts?.now,
    decisions,
  });
  return {
    state: result.state,
    detections: result.detections,
    slots: slotsFromBelief(result.state),
    repairs: result.repairs,
    decisions: result.decisions,
  };
}

/** Coaching copy must follow belief labels — derive only, never mutate. */
export { syncCoachingToBelief, appendDecision };
