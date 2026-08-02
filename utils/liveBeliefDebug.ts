/**
 * Live belief debug — snapshot builders + UI helpers for the Live overlay.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  centerY,
  classifyBottomSubtype,
  formatGarmentDisplayName,
  getStrictBodyRegion,
  type BBoxTuple,
} from '@/utils/bodyGeometryGuardrails';
import {
  classifyFashionColor,
  formatColorPipelineDebug,
  type FashionColorProfile,
} from '@/utils/fashionColorTaxonomy';
import {
  MAX_DECISIONS,
  type BeliefDecision,
  type BeliefDecisionType,
} from '@/utils/liveBeliefDecisions';
import type {
  FootwearCandidateAnalysis,
  FootZoneDiagnostics,
  ShoeStyleScore,
} from '@/utils/liveFootwearGate';
import type { GarmentBelief, OutfitBeliefState } from '@/utils/liveGarmentBelief';

export type {
  BeliefDecision,
  BeliefDecisionType,
} from '@/utils/liveBeliefDecisions';
export {
  appendDecision,
  pushDecision,
  MAX_DECISIONS,
} from '@/utils/liveBeliefDecisions';

export type DebugFrameDetection = {
  source: 'yolo' | 'vision' | 'pipeline';
  label: string;
  confidence: number;
  rejected?: boolean;
  reason?: string;
  kind?: string;
};

export type BeliefSlotStatus =
  | 'LOCKED'
  | 'STABLE'
  | 'WARM'
  | 'HOLD'
  | 'NONE'
  | 'CROPPED FRAME'
  | 'BAREFOOT DETECTED'
  | 'BLOCKED';

export type DebugBeliefSlot = {
  label: string;
  confidence: number;
  stability: number;
  status: BeliefSlotStatus;
  color: string | null;
  kind: string;
  fashion?: FashionColorProfile;
  colorPipeline?: string;
};

export type LiveBeliefDebugSnapshot = {
  updatedAt: number;
  source: string;
  cropped: boolean;
  belief: {
    top: DebugBeliefSlot | null;
    layer?: DebugBeliefSlot | null;
    bottom: DebugBeliefSlot | null;
    shoes: DebugBeliefSlot | { status: BeliefSlotStatus; label: string };
  };
  colorPipeline: {
    top: string | null;
    bottom: string | null;
  };
  frameDetections: DebugFrameDetection[];
  decisions: BeliefDecision[];
  inspect: BoxInspect | null;
  footwear: {
    candidates: FootwearCandidateAnalysis[];
    zone: FootZoneDiagnostics | null;
    score: ShoeStyleScore | null;
  };
};

export type BoxInspect = {
  label: string;
  height: number;
  centerY: number;
  region: string;
  subtype: string | null;
  confidence: number;
};

export function decisionGlyph(type: BeliefDecisionType): string {
  if (type === 'reinforce') return '+';
  if (type === 'reject') return '!';
  if (type === 'hold') return '=';
  if (type === 'update') return '~';
  return '~';
}

export function decisionColor(type: BeliefDecisionType): string {
  if (type === 'reinforce') return '#3DDC97';
  if (type === 'reject') return '#FF6B6B';
  if (type === 'hold') return '#F4D35E';
  if (type === 'update') return '#6EC1FF';
  return '#B0B0B0';
}

function slotStatus(b: GarmentBelief | null | undefined): BeliefSlotStatus {
  if (!b) return 'NONE';
  if (b.stability >= 0.85) return 'LOCKED';
  if (b.stability >= 0.55) return 'STABLE';
  return 'WARM';
}

function slotFromBelief(b: GarmentBelief | null | undefined): DebugBeliefSlot | null {
  if (!b) return null;
  const fashion = classifyFashionColor(b.color);
  const label = formatGarmentDisplayName({
    color: b.color,
    category: b.category,
    subcategory: b.subcategory,
  });
  return {
    label: label || b.kind,
    confidence: b.confidence,
    stability: b.stability,
    status: slotStatus(b),
    color: b.color,
    kind: b.kind,
    fashion,
    colorPipeline: formatColorPipelineDebug(fashion, { accepted: Boolean(b.color) }),
  };
}

function shoesSlot(
  belief: OutfitBeliefState,
  zone: FootZoneDiagnostics | null,
  candidates: FootwearCandidateAnalysis[],
): DebugBeliefSlot | { status: BeliefSlotStatus; label: string } {
  const shoe = slotFromBelief(belief.footwear);
  if (shoe) {
    return shoe;
  }
  const barefoot = candidates.some((c) => c.rejectReason === 'barefoot');
  if (barefoot) {
    return { status: 'BAREFOOT DETECTED', label: 'None [BAREFOOT DETECTED]' };
  }
  if (zone?.cropped) {
    return { status: 'CROPPED FRAME', label: 'None [CROPPED FRAME]' };
  }
  if (candidates.some((c) => !c.valid)) {
    return { status: 'BLOCKED', label: 'None [BLOCKED]' };
  }
  return { status: 'NONE', label: 'None' };
}

export function inspectDetection(det: OnDeviceDetection): BoxInspect {
  const bbox = det.bbox as BBoxTuple;
  const region = getStrictBodyRegion(bbox);
  const subtype =
    /bottom|short|trouser|skirt|pant/i.test(`${det.category} ${det.subcategory}`)
      ? classifyBottomSubtype(bbox)
      : /shoe|boot|sneaker|sandal/i.test(`${det.category} ${det.subcategory}`)
        ? (det.subcategory || 'shoes')
        : null;
  return {
    label: det.name || formatGarmentDisplayName({
      color: det.color,
      category: det.category,
      subcategory: det.subcategory || '',
    }),
    height: Number(bbox[3].toFixed(3)),
    centerY: Number(centerY(bbox).toFixed(3)),
    region,
    subtype,
    confidence: det.confidence,
  };
}

export function buildDebugSnapshot(args: {
  belief: OutfitBeliefState;
  frameDetections: DebugFrameDetection[];
  decisions: BeliefDecision[];
  cropped: boolean;
  source: string;
  inspect?: BoxInspect | null;
  now?: number;
  footwearCandidates?: FootwearCandidateAnalysis[];
  footZone?: FootZoneDiagnostics | null;
  shoeScore?: ShoeStyleScore | null;
}): LiveBeliefDebugSnapshot {
  const candidates = args.footwearCandidates || [];
  const zone = args.footZone || null;
  const belief: OutfitBeliefState = {
    top: args.belief.top,
    layer: args.belief.layer ?? null,
    bottom: args.belief.bottom,
    footwear: args.belief.footwear ?? null,
  };
  const topSlot = slotFromBelief(belief.top);
  const layerSlot = slotFromBelief(belief.layer);
  const bottomSlot = slotFromBelief(belief.bottom);
  return {
    updatedAt: args.now ?? Date.now(),
    source: args.source,
    cropped: args.cropped,
    belief: {
      top: topSlot,
      layer: layerSlot,
      bottom: bottomSlot,
      shoes: shoesSlot(belief, zone, candidates),
    },
    colorPipeline: {
      top: topSlot?.colorPipeline ?? null,
      bottom: bottomSlot?.colorPipeline ?? null,
    },
    frameDetections: args.frameDetections,
    decisions: args.decisions.slice(-MAX_DECISIONS),
    inspect: args.inspect ?? null,
    footwear: {
      candidates,
      zone,
      score: args.shoeScore ?? null,
    },
  };
}

export function detectionsToDebugRows(
  detections: OnDeviceDetection[],
  source: DebugFrameDetection['source'] = 'yolo',
): DebugFrameDetection[] {
  return detections.map((d) => ({
    source,
    label: d.name || `${d.color || ''} ${d.subcategory || d.category}`.trim(),
    confidence: d.confidence,
    kind: d.subcategory || d.category,
  }));
}

/** Stability bar as block characters (10 cells). */
export function stabilityBar(value: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round(value * width)));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

export function emptyDebugSnapshot(source = 'idle'): LiveBeliefDebugSnapshot {
  return {
    updatedAt: Date.now(),
    source,
    cropped: false,
    belief: {
      top: null,
      bottom: null,
      shoes: { status: 'NONE', label: 'None' },
    },
    colorPipeline: { top: null, bottom: null },
    frameDetections: [],
    decisions: [],
    inspect: null,
    footwear: { candidates: [], zone: null, score: null },
  };
}
