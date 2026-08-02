/**
 * Live footwear gate — evidence-only shoes. Never invent.
 *
 * Pipeline: zone → shape → skin (barefoot) → belief → optional subtype → style score.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  REGION,
  centerY,
  hasReliableFabricColor,
  isHardFootwear,
  isValidShoe,
  type BBoxTuple,
} from '@/utils/bodyGeometryGuardrails';
import { appendDecision, type BeliefDecision } from '@/utils/liveBeliefDecisions';
import { buildFootwearDisplayLabel, toCanonicalFootwearFamily } from '@/utils/footwearLayers';

export type ShoeSubtype = 'sneakers' | 'boots' | 'sandals' | 'flip_flops' | 'slides';

const FOOTWEAR_LABEL_RE = /shoe|boot|sneaker|trainer|sandal|loafer|footwear|mule|heel|flip.?flop|slide|thong/i;

export type FootwearRejectReason =
  | 'cropped_frame'
  | 'outside_footwear_zone'
  | 'invalid_shape'
  | 'barefoot'
  | 'skin_unknown'
  | 'low_confidence'
  | 'not_labeled_footwear';

export type FootwearCandidateAnalysis = {
  trackId?: string;
  label: string;
  confidence: number;
  position: number;
  height: number;
  width: number;
  shapeOk: boolean;
  zoneOk: boolean;
  skinRatio: number | null;
  valid: boolean;
  rejectReason?: FootwearRejectReason;
};

export type FootZoneDiagnostics = {
  visible: boolean;
  cropped: boolean;
  brightness: number | null;
  detectionEnabled: boolean;
  reason: string;
};

export type FootwearGateResult = {
  accepted: OnDeviceDetection | null;
  candidates: FootwearCandidateAnalysis[];
  zone: FootZoneDiagnostics;
  decisions: BeliefDecision[];
  /** Positive barefoot evidence — callers must clear shoe belief, not hold it. */
  barefootEvidence: boolean;
};

export type ShoeStyleScore = {
  score: number;
  label: 'Excellent' | 'Strong' | 'Decent' | 'Weak' | 'None';
  breakdown: {
    formality: number;
    structure: number;
    style: number;
    color: number;
    context: number;
  };
  explanations: string[];
  subtype: ShoeSubtype | null;
};

export const SHOE_MIN_CONFIDENCE = 0.75;
export const SUBTYPE_CHANGE_THRESHOLD = 0.9;
/** Lowered slightly — darker skin samples often read lower after luma. */
export const BAREFOOT_SKIN_RATIO = 0.22;
export const FOOT_ZONE_BRIGHTNESS_MIN = 0.1;
/** Frames (~1.1s) to block footwear after barefoot veto. */
export const BAREFOOT_BLOCK_MS = 5500;

const SHOE_FORMALITY: Record<ShoeSubtype, number> = {
  sneakers: 0.3,
  sandals: 0.2,
  flip_flops: 0.15,
  slides: 0.18,
  boots: 0.7,
};

const COMPATIBILITY: Record<string, Partial<Record<ShoeSubtype, number>>> = {
  shorts: { sneakers: 0.9, sandals: 0.95, flip_flops: 0.97, slides: 0.96, boots: 0.3 },
  trousers: { sneakers: 0.8, boots: 0.9, sandals: 0.4, flip_flops: 0.25, slides: 0.35 },
  skirt: { sneakers: 0.75, sandals: 0.9, flip_flops: 0.7, slides: 0.8, boots: 0.55 },
};

export function isInFootwearZone(bbox: BBoxTuple): boolean {
  return bbox[1] + bbox[3] > 0.9;
}

export function isShoeShape(bbox: BBoxTuple): boolean {
  const [, , w, h] = bbox;
  return h < 0.18 && w > h;
}

/** Prefer hard footwear geometry; fall back to ChatGPT-style zone+shape. */
export function passesShoeGeometry(bbox: BBoxTuple): boolean {
  if (isHardFootwear(bbox)) return true;
  return isInFootwearZone(bbox) && isShoeShape(bbox) && centerY(bbox) >= 0.82;
}

export function assessFootZone(opts: {
  detections?: Array<{ bbox: BBoxTuple }>;
  bottomBandBrightness?: number | null;
}): FootZoneDiagnostics {
  const brightness =
    opts.bottomBandBrightness != null && Number.isFinite(opts.bottomBandBrightness)
      ? Math.max(0, Math.min(1, opts.bottomBandBrightness))
      : null;

  if (brightness != null) {
    const visible = brightness >= FOOT_ZONE_BRIGHTNESS_MIN;
    return {
      visible,
      cropped: !visible,
      brightness,
      detectionEnabled: visible,
      reason: visible
        ? 'foot zone brightness ok — footwear detection enabled'
        : 'foot zone dark/empty — treated as cropped',
    };
  }

  const dets = opts.detections || [];
  if (!dets.length) {
    return {
      visible: false,
      cropped: true,
      brightness: null,
      detectionEnabled: false,
      reason: 'no detections — footwear disabled',
    };
  }

  const maxBottom = Math.max(...dets.map((d) => d.bbox[1] + d.bbox[3]));
  const hardShoe = dets.some((d) => isHardFootwear(d.bbox));
  const reachesFootBand = maxBottom >= REGION.FOOTWEAR_MIN || hardShoe;

  if (hardShoe) {
    return {
      visible: true,
      cropped: false,
      brightness: null,
      detectionEnabled: true,
      reason: 'hard footwear box in frame',
    };
  }
  if (reachesFootBand) {
    return {
      visible: true,
      cropped: false,
      brightness: null,
      detectionEnabled: true,
      reason: 'detection reaches footwear band',
    };
  }

  return {
    visible: false,
    cropped: true,
    brightness: null,
    detectionEnabled: false,
    reason: 'no box reaches footwear band (likely cropped) — use brightness when available',
  };
}

export function analyzeFootwearCandidate(
  det: OnDeviceDetection,
  opts?: { cropped?: boolean },
): FootwearCandidateAnalysis {
  const bbox = det.bbox as BBoxTuple;
  const position = bbox[1] + bbox[3];
  const skinRatio = det.skinRatio != null ? det.skinRatio : null;
  const fabricOk = hasReliableFabricColor(det.color);
  const zoneOk = isInFootwearZone(bbox) || isHardFootwear(bbox);
  const shapeOk = isShoeShape(bbox) || isHardFootwear(bbox);
  const labeled = FOOTWEAR_LABEL_RE.test(
    `${det.category} ${det.subcategory || ''} ${det.name || ''}`,
  );

  let rejectReason: FootwearRejectReason | undefined;
  let valid = true;

  if (opts?.cropped) {
    valid = false;
    rejectReason = 'cropped_frame';
  } else if (!labeled && !passesShoeGeometry(bbox)) {
    valid = false;
    rejectReason = 'not_labeled_footwear';
  } else if (!zoneOk) {
    valid = false;
    rejectReason = 'outside_footwear_zone';
  } else if (!shapeOk) {
    valid = false;
    rejectReason = 'invalid_shape';
  } else if (skinRatio == null && !fabricOk) {
    // No skin + no fabric colour → refuse to guess (barefoot / dark-skin miss)
    valid = false;
    rejectReason = 'skin_unknown';
  } else if (skinRatio != null && skinRatio >= BAREFOOT_SKIN_RATIO) {
    valid = false;
    rejectReason = 'barefoot';
  } else if (!isValidShoe(bbox, skinRatio, det.color)) {
    valid = false;
    rejectReason = 'invalid_shape';
  } else if (det.confidence < (fabricOk || labeled ? 0.62 : SHOE_MIN_CONFIDENCE)) {
    valid = false;
    rejectReason = 'low_confidence';
  }

  return {
    trackId: det.trackId,
    label: det.name || 'Shoes',
    confidence: det.confidence,
    position: Number(position.toFixed(3)),
    height: Number(bbox[3].toFixed(3)),
    width: Number(bbox[2].toFixed(3)),
    shapeOk,
    zoneOk,
    skinRatio,
    valid,
    rejectReason,
  };
}

/**
 * Evidence-only footwear gate. Never invents shoes.
 */
export function gateFootwearDetections(
  detections: OnDeviceDetection[],
  opts?: {
    now?: number;
    bottomBandBrightness?: number | null;
    decisions?: BeliefDecision[];
  },
): FootwearGateResult {
  const now = opts?.now ?? Date.now();
  const decisions = opts?.decisions || [];
  const zone = assessFootZone({
    detections: detections.map((d) => ({ bbox: d.bbox as BBoxTuple })),
    bottomBandBrightness: opts?.bottomBandBrightness,
  });

  const shoeLike = detections.filter((d) => {
    const blob = `${d.category} ${d.subcategory || ''} ${d.name || ''}`.toLowerCase();
    return FOOTWEAR_LABEL_RE.test(blob) || passesShoeGeometry(d.bbox as BBoxTuple);
  });

  if (!zone.detectionEnabled) {
    appendDecision(decisions, {
      type: 'reject',
      message: 'Footwear blocked',
      reason: zone.reason,
      slot: 'footwear',
      time: now,
    });
    return {
      accepted: null,
      candidates: shoeLike.map((d) => analyzeFootwearCandidate(d, { cropped: true })),
      zone,
      decisions,
      barefootEvidence: false,
    };
  }

  const candidates = shoeLike.map((d) => analyzeFootwearCandidate(d, { cropped: false }));
  const barefootEvidence = candidates.some(
    (c) => c.rejectReason === 'barefoot' || c.rejectReason === 'skin_unknown',
  );

  for (const c of candidates) {
    if (!c.valid && c.rejectReason) {
      appendDecision(decisions, {
        type: 'reject',
        message: `Footwear rejected: ${c.label}`,
        reason: rejectReasonLabel(c.rejectReason, c.skinRatio),
        slot: 'footwear',
        time: now,
      });
    }
  }

  const best = candidates
    .map((c, i) => ({ c, d: shoeLike[i] }))
    .filter((x) => x.c.valid)
    .sort((a, b) => b.c.confidence - a.c.confidence)[0];

  if (!best) {
    return { accepted: null, candidates, zone, decisions, barefootEvidence };
  }

  const subtype = classifyShoeSubtype({
    bbox: best.d.bbox as BBoxTuple,
    skinRatio: best.c.skinRatio,
    name: best.d.name,
    subcategory: best.d.subcategory,
  });

  const accepted: OnDeviceDetection = {
    ...best.d,
    category: 'shoes',
    subcategory: subtype,
    color: best.d.color,
    // Display from fine subtype — never from canonical family
    name: buildFootwearDisplayLabel({
      type: subtype,
      color: best.d.color,
      fallbackName: subtype === 'boots'
        ? 'Boots'
        : subtype === 'flip_flops'
          ? 'Flip-flops'
          : subtype === 'slides'
            ? 'Slides'
            : subtype === 'sandals'
              ? 'Sandals'
              : 'Trainers',
    }),
    confidence: best.d.confidence,
    skinRatio: best.c.skinRatio ?? best.d.skinRatio,
  };

  const family = toCanonicalFootwearFamily(subtype);
  appendDecision(decisions, {
    type: 'update',
    message: `Footwear detected: ${accepted.name}`,
    reason: `zone+shape+skin ok · fine=${subtype} · canonical=${family}`,
    slot: 'footwear',
    time: now,
  });

  return { accepted, candidates, zone, decisions, barefootEvidence: false };
}

function rejectReasonLabel(reason: FootwearRejectReason, skin: number | null): string {
  if (reason === 'barefoot') {
    return `barefoot detected${skin != null ? ` (skin ${skin.toFixed(2)})` : ''}`;
  }
  if (reason === 'skin_unknown') return 'no skin sample — refuse to guess shoes';
  if (reason === 'cropped_frame') return 'cropped frame';
  if (reason === 'outside_footwear_zone') return 'outside footwear zone';
  if (reason === 'invalid_shape') return 'not shoe-like shape';
  if (reason === 'low_confidence') return 'low confidence';
  return 'not labeled footwear';
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Rule-based subtype — shaft height + sole bulk beat low-res “sneakers” default. */
export function scoreBootEvidence(bbox: BBoxTuple): number {
  const [, y, w, h] = bbox;
  const bottom = y + h;
  const aspect = w / Math.max(0.01, h);
  let score = 0;
  if (y < 0.84) score += 0.35; // shaft rises above ankle
  if (y < 0.80) score += 0.12;
  if (h >= 0.11) score += 0.22;
  if (h >= 0.14) score += 0.14;
  if (aspect > 1.05 && aspect < 2.4) score += 0.12; // chunky lace-up silhouette
  if (bottom >= 0.92) score += 0.08;
  return Math.min(1, score);
}

export function classifyShoeSubtype(args: {
  bbox: BBoxTuple;
  skinRatio?: number | null;
  name?: string;
  subcategory?: string;
}): ShoeSubtype {
  const blob = `${args.name || ''} ${args.subcategory || ''}`.toLowerCase();
  // Keep flip-flops / slides distinct — do not collapse to generic "sandals"
  if (/flip.?flop|thong/.test(blob)) return 'flip_flops';
  if (/\bslides?\b/.test(blob) && !/sandal/.test(blob)) return 'slides';
  if (/sandal/.test(blob)) return 'sandals';
  if (/boot/.test(blob)) return 'boots';
  if (/sneaker|trainer|runner/.test(blob) && scoreBootEvidence(args.bbox) < 0.5) {
    return 'sneakers';
  }

  const openness = args.skinRatio ?? 0;
  // High skin but below barefoot reject threshold → open shoe
  if (openness > 0.14 && openness < BAREFOOT_SKIN_RATIO) return 'sandals';

  const bootScore = scoreBootEvidence(args.bbox);
  if (bootScore >= 0.55) return 'boots';

  const height = args.bbox[3];
  const shaftTop = args.bbox[1];
  const bulk = args.bbox[2] / Math.max(0.01, args.bbox[3]);
  if (height >= 0.11 && shaftTop < 0.84) return 'boots';
  if (height > 0.12 && bulk > 1.05) return 'boots';
  return 'sneakers';
}

export function stabilizeShoeSubtype(
  prev: ShoeSubtype | null | undefined,
  next: ShoeSubtype,
  confidence: number,
): ShoeSubtype {
  if (!prev) return next;
  if (prev === next) return prev;
  if (confidence < SUBTYPE_CHANGE_THRESHOLD) return prev;
  return next;
}

/** Outfit formality heuristic from top/bottom kinds. */
export function estimateOutfitFormality(args: {
  bottomKind?: string | null;
  topKind?: string | null;
}): number {
  const bottom = String(args.bottomKind || '').toLowerCase();
  if (/short/.test(bottom)) return 0.2;
  if (/skirt/.test(bottom)) return 0.35;
  if (/trouser|pant|jean/.test(bottom)) return 0.55;
  return 0.35;
}

/**
 * Style score for detected shoes vs current outfit belief.
 * No shoes → None (never invent a score that implies footwear).
 */
export function scoreShoeStyle(args: {
  subtype: ShoeSubtype | null;
  color?: string | null;
  bottomKind?: string | null;
  occasionType?: string | null;
}): ShoeStyleScore {
  if (!args.subtype) {
    return {
      score: 0,
      label: 'None',
      breakdown: { formality: 0, structure: 0, style: 0, color: 0, context: 0 },
      explanations: ['No footwear detected'],
      subtype: null,
    };
  }

  const subtype = args.subtype;
  const outfitFormality = estimateOutfitFormality({ bottomKind: args.bottomKind });
  const shoeFormality = SHOE_FORMALITY[subtype];
  const formality = 1 - Math.abs(shoeFormality - outfitFormality);

  const bottomKey = /short/i.test(String(args.bottomKind || ''))
    ? 'shorts'
    : /skirt/i.test(String(args.bottomKind || ''))
      ? 'skirt'
      : 'trousers';
  const structure = COMPATIBILITY[bottomKey]?.[subtype] ?? 0.5;

  const styleType = subtype === 'boots'
    ? 'structured'
    : (subtype === 'sandals' || subtype === 'flip_flops' || subtype === 'slides')
      ? 'relaxed'
      : 'casual';
  const outfitStyle = bottomKey === 'shorts' ? 'casual' : bottomKey === 'skirt' ? 'relaxed' : 'structured';
  const style =
    styleType === outfitStyle ? 0.9
      : (styleType === 'casual' && outfitStyle === 'relaxed') || (styleType === 'relaxed' && outfitStyle === 'casual')
        ? 0.75
        : 0.4;

  const colorRaw = String(args.color || '').toLowerCase();
  const color =
    /white|black|gray|grey|cream|beige|charcoal|navy/.test(colorRaw) ? 0.9
      : colorRaw ? 0.65
        : 0.7;

  const occasion = String(args.occasionType || 'casual').toLowerCase();
  let context = 0.75;
  if (/casual|day|weekend|travel/.test(occasion) && (subtype === 'sneakers' || subtype === 'sandals' || subtype === 'flip_flops' || subtype === 'slides')) {
    context = 0.9;
  }
  if (/work|formal|office/.test(occasion) && subtype === 'boots') context = 0.85;
  if (/work|formal|office/.test(occasion) && subtype === 'sandals') context = 0.35;
  if (/beach|hot|summer/.test(occasion) && subtype === 'boots') context = 0.3;

  const score =
    formality * 0.3
    + structure * 0.25
    + style * 0.2
    + color * 0.15
    + context * 0.1;

  const explanations: string[] = [];
  if (structure >= 0.85) {
    explanations.push(
      subtype === 'sneakers' && bottomKey === 'shorts'
        ? 'Sneakers pair naturally with shorts'
        : `${capitalize(subtype)} fit this bottom well`,
    );
  }
  if (structure < 0.45) {
    explanations.push(`${capitalize(subtype)} feel mismatched with ${bottomKey}`);
  }
  if (formality >= 0.8) explanations.push('Matches outfit formality');
  if (color >= 0.85) explanations.push('Neutral shoe tone works with the outfit');
  if (context < 0.45) explanations.push('Less ideal for this occasion / weather');

  const label =
    score > 0.85 ? 'Excellent'
      : score > 0.7 ? 'Strong'
        : score > 0.55 ? 'Decent'
          : 'Weak';

  return {
    score: Number(score.toFixed(3)),
    label,
    breakdown: {
      formality: Number(formality.toFixed(3)),
      structure: Number(structure.toFixed(3)),
      style: Number(style.toFixed(3)),
      color: Number(color.toFixed(3)),
      context: Number(context.toFixed(3)),
    },
    explanations,
    subtype,
  };
}

/** Soft Live score nudge (−6..+4). Only when shoes already detected. */
export function shoeStyleScoreDelta(score: ShoeStyleScore): number {
  if (score.label === 'None') return 0;
  if (score.score >= 0.85) return 4;
  if (score.score >= 0.7) return 2;
  if (score.score >= 0.55) return 0;
  return -4;
}
