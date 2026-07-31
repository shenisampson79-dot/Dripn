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
  };
}

export function roleOfCategory(category: string, subcategory?: string): OutfitRole {
  const blob = `${category || ''} ${subcategory || ''}`.toLowerCase();
  if (/shoe|boot|sneaker|loafer|footwear|heel|sandal|mule|oxford/.test(blob)) return 'footwear';
  if (/bottom|trouser|jean|short|skirt|pant/.test(blob)) return 'bottom';
  if (/top|shirt|polo|blouse|knit|sweater|outer|blazer|jacket|coat|vest|gilet|dress/.test(blob)) {
    return 'top';
  }
  return 'other';
}

export function bottomSubtypeOf(det: OnDeviceDetection | null | undefined): BottomSubtype | null {
  if (!det) return null;
  const blob = `${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  if (/short/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  if (/trouser|jean|pant/.test(blob)) return 'trousers';
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

function prelabelBottom(det: OnDeviceDetection): OnDeviceDetection {
  if (roleOfCategory(det.category, det.subcategory) !== 'bottom') return det;
  let subtype = bottomSubtypeOf(det) || classifyBottomSubtype(det.bbox as BBoxTuple, {
    fabricColor: det.color,
  });
  // Never keep shorts when the box clearly reaches the floor
  if (subtype === 'shorts' && isFloorLengthTrousersEvidence(det.bbox as BBoxTuple)) {
    subtype = 'trousers';
  }
  const subcategory = subtype === 'shorts' ? 'shorts' : subtype === 'skirt' ? 'skirt' : 'trousers';
  const bbox = subtype === 'shorts' ? clipShortsBbox(det.bbox as BBoxTuple) : det.bbox;
  return {
    ...det,
    category: 'bottoms',
    subcategory,
    bbox,
    name: formatGarmentDisplayName({
      color: det.color,
      category: 'bottoms',
      subcategory,
    }),
  };
}

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
    return prelabelBottom(d);
  });

  if (gated.accepted && !blockedByBarefoot) {
    prepared.push(gated.accepted);
  }

  let beliefMem = memory.belief || createOutfitBeliefState();
  if (!('footwear' in beliefMem) || beliefMem.footwear === undefined) {
    (beliefMem as OutfitBeliefState).footwear = null;
  }

  let footwearBlockedUntil = memory.footwearBlockedUntil || 0;

  // Barefoot is a VETO — clear footwear and block for several frames
  if (gated.barefootEvidence || (shoeProps.length > 0 && !gated.accepted)) {
    if (beliefMem.footwear || gated.barefootEvidence) {
      appendDecision(decisions, {
        type: 'reject',
        message: 'Footwear cleared',
        reason: gated.barefootEvidence
          ? 'barefoot detected (high confidence veto)'
          : 'invalid shoe frame',
        slot: 'footwear',
        time: now,
      });
      beliefMem = { ...beliefMem, footwear: null };
    }
    if (gated.barefootEvidence) {
      footwearBlockedUntil = Math.max(footwearBlockedUntil, now + BAREFOOT_BLOCK_MS);
    }
  }

  const believed = applyOutfitBelief(beliefMem, prepared, { now, decisions });
  repairs.push(...believed.repairs);

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
  };

  return {
    detections: believed.detections,
    memory: nextMemory,
    cropped: gated.zone.cropped || cropped,
    repairs,
    decisions: believed.decisions,
  };
}
