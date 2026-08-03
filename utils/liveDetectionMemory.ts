/**
 * Live detection temporal memory — wraps the garment belief state machine.
 *
 * Frames are noisy. Belief is what we render.
 * Footwear: evidence-only via liveFootwearGate (never invent).
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  classifyBottomSubtype,
  clipShortsBbox,
  formatGarmentDisplayName,
  isCroppedFrame,
  isFloorLengthTrousersEvidence,
  looksLikeShortsWithFootwearExtension,
  type BBoxTuple,
  type BottomSubtype,
} from '@/utils/bodyGeometryGuardrails';
import { type BeliefDecision } from '@/utils/liveBeliefDecisions';
import {
  BAREFOOT_BLOCK_MS,
  gateFootwearDetections,
  scoreShoeStyle,
  type FootwearCandidateAnalysis,
  type FootZoneDiagnostics,
  type ShoeStyleScore,
  type ShoeSubtype,
} from '@/utils/liveFootwearGate';
import { appendDecision } from '@/utils/liveBeliefDecisions';
import {
  applyOutfitBelief,
  createOutfitBeliefState,
  type OutfitBeliefState,
} from '@/utils/liveGarmentBelief';
import {
  stabilizeColorFromHistory,
  stabilizeFootwearIdentity,
  type LimSample,
} from '@/utils/liveLayeringIntelligence';

export type OutfitRole = 'top' | 'bottom' | 'footwear' | 'other';

export type MemorySlot = OnDeviceDetection & {
  role: OutfitRole;
  lastSeenAt: number;
};

export type DetectionMemory = {
  top: MemorySlot | null;
  bottom: MemorySlot | null;
  footwear: MemorySlot | null;
  bottomHistory: BottomSubtype[];
  belief: OutfitBeliefState;
  lastFootwearCandidates: FootwearCandidateAnalysis[];
  lastFootZone: FootZoneDiagnostics | null;
  lastShoeScore: ShoeStyleScore | null;
  /** Barefoot veto — block footwear proposals until this timestamp. */
  footwearBlockedUntil: number;
  /** Temporal footwear identity samples (LIM stability engine). */
  footwearHistory: LimSample[];
  /** Temporal bottom colour samples — median vote resists dim-room black. */
  bottomColorHistory: LimSample[];
};

export function createDetectionMemory(): DetectionMemory {
  return {
    top: null,
    bottom: null,
    footwear: null,
    bottomHistory: [],
    belief: createOutfitBeliefState(),
    lastFootwearCandidates: [],
    lastFootZone: null,
    lastShoeScore: null,
    footwearBlockedUntil: 0,
    footwearHistory: [],
    bottomColorHistory: [],
  };
}

export function roleOfCategory(category: string, subcategory?: string): OutfitRole {
  const blob = `${category || ''} ${subcategory || ''}`.toLowerCase();
  if (/shoe|boot|sneaker|loafer|footwear|heel|sandal|mule|oxford|boat|deck|topsider/.test(blob)) {
    return 'footwear';
  }
  if (/bottom|trouser|jean|short|skirt|pant/.test(blob)) return 'bottom';
  if (/top|shirt|polo|blouse|knit|sweater|outer|blazer|jacket|coat|vest|gilet|dress/.test(blob)) {
    return 'top';
  }
  return 'other';
}

export function bottomSubtypeOf(det: OnDeviceDetection | null | undefined): BottomSubtype | null {
  if (!det) return null;
  const blob = `${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  // Vision "chinos" / "trousers" / "pants" must win over hip-cropped bbox→shorts.
  // Check trousers family BEFORE /short/ so we never mis-read labels.
  if (/trouser|jean|chino|pant(?!y)|slacks/.test(blob) && !/\bshorts?\b/.test(blob)) {
    return 'trousers';
  }
  if (/\bshorts?\b/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  return classifyBottomSubtype(det.bbox as BBoxTuple);
}

/** @deprecated Prefer belief state — kept for tests / callers. */
export function lockRoleTransition(
  previous: OutfitRole | null | undefined,
  current: OutfitRole,
): OutfitRole {
  if (!previous || previous === 'other') return current;
  if (previous === current) return current;
  const invalid =
    (previous === 'top' && current === 'footwear')
    || (previous === 'bottom' && current === 'top')
    || (previous === 'bottom' && current === 'footwear')
    || (previous === 'footwear' && current === 'top');
  return invalid ? previous : current;
}

function visionBottomLabelStrong(det: OnDeviceDetection): boolean {
  const blob = `${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  return /trouser|jean|chino|pant(?!y)|slacks|\bshorts?\b|skirt/.test(blob);
}

function prelabelBottom(det: OnDeviceDetection): OnDeviceDetection {
  if (roleOfCategory(det.category, det.subcategory) !== 'bottom') return det;
  // Cloud/YOLO already named the piece — trust the label; geometry only fills blanks.
  const labeled = visionBottomLabelStrong(det);
  let subtype = bottomSubtypeOf(det) || classifyBottomSubtype(det.bbox as BBoxTuple, {
    fabricColor: det.color,
  });
  if (!labeled) {
    // Only promote shorts→trousers for true waist→floor columns
    if (subtype === 'shorts' && isFloorLengthTrousersEvidence(det.bbox as BBoxTuple)) {
      subtype = 'trousers';
    }
    // Demote false trousers when the box is shorts+socks/boots
    if (subtype === 'trousers' && looksLikeShortsWithFootwearExtension(det.bbox as BBoxTuple)) {
      subtype = 'shorts';
    }
  } else if (subtype === 'trousers') {
    // Never demote vision trousers/chinos to shorts on a short hip crop
  } else if (subtype === 'shorts' && isFloorLengthTrousersEvidence(det.bbox as BBoxTuple)) {
    subtype = 'trousers';
  }
  const subcategory = subtype === 'shorts' ? 'shorts' : subtype === 'skirt' ? 'skirt' : 'trousers';
  const bbox = subtype === 'shorts' && !labeled ? clipShortsBbox(det.bbox as BBoxTuple) : det.bbox;
    return {
      ...det,
      category: 'bottoms',
      subcategory,
      bbox,
      name: visionBottomLabelStrong(det) && det.name
        ? det.name
        : formatGarmentDisplayName({
          color: det.color,
          category: 'bottoms',
          subcategory,
          fallbackName: det.name,
        }),
    };
  };

function toSlot(det: OnDeviceDetection | null | undefined, role: OutfitRole, now: number): MemorySlot | null {
  if (!det) return null;
  return { ...det, role, lastSeenAt: now };
}

/**
 * Merge frame detections into belief state.
 * Footwear only when gate accepts a real shoe (no invent).
 */
export function applyDetectionMemory(
  detections: OnDeviceDetection[],
  memory: DetectionMemory,
  opts?: {
    now?: number;
    decisions?: BeliefDecision[];
    bottomBandBrightness?: number | null;
    occasionType?: string | null;
  },
): {
  detections: OnDeviceDetection[];
  memory: DetectionMemory;
  cropped: boolean;
  repairs: string[];
  decisions: BeliefDecision[];
} {
  const now = opts?.now ?? Date.now();
  const repairs: string[] = [];
  const decisions = opts?.decisions || [];

  const cropped = isCroppedFrame(
    detections.map((d) => ({
      category: d.category,
      subcategory: d.subcategory,
      bbox: d.bbox as BBoxTuple,
    })),
    { bottomBandBrightness: opts?.bottomBandBrightness },
  );

  // Split garments vs raw shoe proposals
  const nonShoes = detections.filter(
    (d) => roleOfCategory(d.category, d.subcategory) !== 'footwear',
  );
  const shoeProps = detections.filter(
    (d) => roleOfCategory(d.category, d.subcategory) === 'footwear',
  );

  const blockedByBarefoot = now < (memory.footwearBlockedUntil || 0);

  let gated = gateFootwearDetections(
    [...nonShoes, ...shoeProps],
    {
      now,
      bottomBandBrightness: opts?.bottomBandBrightness,
      decisions,
    },
  );

  if (blockedByBarefoot && gated.accepted) {
    appendDecision(decisions, {
      type: 'reject',
      message: 'Footwear blocked',
      reason: 'barefoot veto window',
      slot: 'footwear',
      time: now,
    });
    gated = { ...gated, accepted: null, barefootEvidence: true };
  }

  if (gated.zone.cropped && shoeProps.length) {
    repairs.push('belief→block_footwear_cropped');
  } else if (shoeProps.length && !gated.accepted) {
    repairs.push('belief→reject_footwear');
  }

  let bottomColorHistory = memory.bottomColorHistory || [];
  const prepared = nonShoes.map((d) => {
    if (roleOfCategory(d.category, d.subcategory) === 'top') {
      return {
        ...d,
        name: formatGarmentDisplayName({
          color: d.color,
          category: d.category,
          subcategory: d.subcategory || 'top',
          fallbackName: d.name,
        }),
      };
    }
    const bottom = prelabelBottom(d);
    if (roleOfCategory(bottom.category, bottom.subcategory) !== 'bottom') return bottom;
    // Record colour samples for DBG — belief stabilizeColor owns the final colour.
    const colorLim = stabilizeColorFromHistory({
      history: bottomColorHistory,
      proposed: {
        label: String(bottom.subcategory || 'shorts'),
        confidence: bottom.confidence,
        color: bottom.color,
      },
      lockedColor: memory.belief?.bottom?.color || null,
    });
    bottomColorHistory = colorLim.history;
    return {
      ...bottom,
      name: bottom.name && /sweatpant|jogger|chino|trouser|jean|skirt|short/i.test(bottom.name)
        ? bottom.name
        : formatGarmentDisplayName({
          color: bottom.color,
          category: bottom.category,
          subcategory: bottom.subcategory || 'shorts',
          fallbackName: bottom.name,
        }),
    };
  });

  let footwearHistory = memory.footwearHistory || [];
  let acceptedShoe = gated.accepted && !blockedByBarefoot ? gated.accepted : null;

  // Record footwear samples for DBG — gate proposes subtype; belief locks it.
  // Do not run a second LIM identity lock before belief (dual-lock thrash).
  if (acceptedShoe) {
    const lim = stabilizeFootwearIdentity({
      history: footwearHistory,
      proposed: {
        label: String(acceptedShoe.subcategory || 'shoes'),
        confidence: acceptedShoe.confidence,
        color: acceptedShoe.color,
      },
      lockedSubtype: (memory.belief?.footwear?.subcategory as ShoeSubtype) || null,
      lockedColor: memory.belief?.footwear?.color || null,
    });
    footwearHistory = lim.history;
    prepared.push(acceptedShoe);
  }

  let beliefMem = memory.belief || createOutfitBeliefState();
  if (!('footwear' in beliefMem) || beliefMem.footwear === undefined) {
    (beliefMem as OutfitBeliefState).footwear = null;
  }

  let footwearBlockedUntil = memory.footwearBlockedUntil || 0;
  const clearFootwear = Boolean(gated.barefootEvidence);

  // Barefoot veto window only — belief owns clearing the footwear slot.
  if (gated.barefootEvidence) {
    footwearBlockedUntil = Math.max(footwearBlockedUntil, now + BAREFOOT_BLOCK_MS);
    footwearHistory = [];
  }

  const believed = applyOutfitBelief(beliefMem, prepared, {
    now,
    decisions,
    clearFootwear,
  });
  repairs.push(...believed.repairs);
  if (!believed.state.bottom) bottomColorHistory = [];

  const topDet = believed.detections.find((d) => roleOfCategory(d.category, d.subcategory) === 'top') || null;
  const bottomDet = believed.detections.find((d) => roleOfCategory(d.category, d.subcategory) === 'bottom') || null;
  const shoeDet = believed.detections.find((d) => roleOfCategory(d.category, d.subcategory) === 'footwear') || null;

  const shoeScore = scoreShoeStyle({
    subtype: (shoeDet?.subcategory as ShoeSubtype) || null,
    color: shoeDet?.color,
    bottomKind: bottomDet?.subcategory || believed.state.bottom?.kind,
    occasionType: opts?.occasionType,
  });

  const nextMemory: DetectionMemory = {
    top: toSlot(topDet, 'top', now),
    bottom: toSlot(bottomDet, 'bottom', now),
    footwear: toSlot(shoeDet, 'footwear', now),
    bottomHistory: memory.bottomHistory || [],
    belief: believed.state,
    lastFootwearCandidates: gated.candidates,
    lastFootZone: gated.zone,
    lastShoeScore: shoeScore.label === 'None' ? null : shoeScore,
    footwearBlockedUntil,
    footwearHistory,
    bottomColorHistory,
  };

  return {
    detections: believed.detections,
    memory: nextMemory,
    cropped: gated.zone.cropped || cropped,
    repairs,
    decisions: believed.decisions,
  };
}
