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
  pickMoreSpecificSubtype,
  stabilizeColorFromHistory,
  stabilizeFootwearIdentity,
  type LimSample,
} from '@/utils/liveLayeringIntelligence';
import { buildFootwearDisplayLabel } from '@/utils/footwearLayers';

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
  // Only promote shorts→trousers for true waist→floor columns
  if (subtype === 'shorts' && isFloorLengthTrousersEvidence(det.bbox as BBoxTuple)) {
    subtype = 'trousers';
  }
  // Demote false trousers when the box is shorts+socks/boots
  if (subtype === 'trousers' && looksLikeShortsWithFootwearExtension(det.bbox as BBoxTuple)) {
    subtype = 'shorts';
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
    // LIM: median colour over last frames — dim ROI must not paint light shorts black.
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
    const color = colorLim.color || bottom.color;
    return {
      ...bottom,
      color,
      name: formatGarmentDisplayName({
        color,
        category: bottom.category,
        subcategory: bottom.subcategory || 'shorts',
      }),
    };
  });

  let footwearHistory = memory.footwearHistory || [];
  let acceptedShoe = gated.accepted && !blockedByBarefoot ? gated.accepted : null;

  // LIM: temporal vote + hierarchy veto before belief commits.
  if (acceptedShoe) {
    const lim = stabilizeFootwearIdentity({
      history: footwearHistory,
      proposed: {
        label: String(acceptedShoe.subcategory || 'sneakers'),
        confidence: acceptedShoe.confidence,
        color: acceptedShoe.color,
      },
      lockedSubtype: (memory.belief?.footwear?.subcategory as ShoeSubtype) || null,
      lockedColor: memory.belief?.footwear?.color || null,
    });
    footwearHistory = lim.history;
    if (lim.subtype) {
      const specific = pickMoreSpecificSubtype(
        memory.belief?.footwear?.subcategory,
        lim.subtype,
      ) || lim.subtype;
      const keepBoatName = specific === 'boat_shoes'
        && /boat|deck|topsider|sperry/i.test(String(acceptedShoe.name || ''));
      acceptedShoe = {
        ...acceptedShoe,
        subcategory: specific,
        color: lim.color || acceptedShoe.color,
        name: keepBoatName
          ? String(acceptedShoe.name)
          : buildFootwearDisplayLabel({
            type: specific,
            color: lim.color || acceptedShoe.color,
            fallbackName: specific === 'boat_shoes' ? 'Boat shoes' : acceptedShoe.name,
          }),
      };
    }
    prepared.push(acceptedShoe);
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
      footwearHistory = [];
    }
    if (gated.barefootEvidence) {
      footwearBlockedUntil = Math.max(footwearBlockedUntil, now + BAREFOOT_BLOCK_MS);
    }
  }

  const believed = applyOutfitBelief(beliefMem, prepared, { now, decisions });
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
