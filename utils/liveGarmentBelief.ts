/**
 * Live garment belief engine — source of truth for Live overlays.
 *
 * Rule: Belief > Frame. Weak / occluded / cloud-noisy frames cannot override
 * a stable belief. Chromatic colors (red) never downgrade to phone-black.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  formatGarmentDisplayName,
  hasReliableFabricColor,
  isBareTorsoTopLike,
  isFloorLengthTrousersEvidence,
  looksLikeShortsWithFootwearExtension,
  type BBoxTuple,
  type BottomSubtype,
} from '@/utils/bodyGeometryGuardrails';
import {
  appendDecision,
  type BeliefDecision,
} from '@/utils/liveBeliefDecisions';
import {
  stabilizeShoeSubtype,
  type ShoeSubtype,
} from '@/utils/liveFootwearGate';

export type { BeliefDecision, BeliefDecisionType } from '@/utils/liveBeliefDecisions';

export type BeliefKind = 'top' | 'shorts' | 'trousers' | 'skirt' | 'shoes' | 'other';

export type GarmentBelief = {
  kind: BeliefKind;
  category: string;
  subcategory: string;
  color: string | null;
  confidence: number;
  /** 0–1 resistance to change. Reinforced by agreeing frames. */
  stability: number;
  bbox: BBoxTuple;
  trackId?: string;
  lastChangedAt: number;
  lastSeenAt: number;
};

export type OutfitBeliefState = {
  top: GarmentBelief | null;
  bottom: GarmentBelief | null;
  footwear: GarmentBelief | null;
};

/** Minimum confidence to change kind OR color. Below this → ignore proposal. */
export const CHANGE_THRESHOLD = 0.88;
/** Adopt a first colour (seed / fill-null) even when below CHANGE_THRESHOLD. */
export const COLOR_ADOPT_THRESHOLD = 0.62;
export const BELIEF_CHANGE_COOLDOWN_MS = 1000;
export const BELIEF_STABILITY_RESIST = 0.55;
export const BELIEF_SWITCH_CONF = 0.93;
export const BELIEF_MISS_TTL_MS = 18000;
export const BELIEF_DECAY = 0.985;
export const BELIEF_FLOOR = 0.15;

const COLOR_ALIASES: Record<string, string> = {
  grey: 'gray',
  'dark_grey': 'black',
  'dark_gray': 'black',
  charcoal: 'black',
  burgundy: 'red',
  maroon: 'red',
  navy: 'navy',
  // Fashion base normalisation — never store teal/cyan as distinct bases
  teal: 'blue',
  cyan: 'blue',
  turquoise: 'blue',
  aqua: 'blue',
};

const CHROMATIC = new Set([
  'red', 'burgundy', 'orange', 'yellow', 'mustard', 'green', 'blue', 'purple', 'pink', 'brown',
]);
const DARK_FAMILY = new Set(['black', 'charcoal', 'gray', 'navy']);
const LIGHT_FAMILY = new Set(['white', 'cream', 'beige', 'ivory']);

export function createOutfitBeliefState(): OutfitBeliefState {
  return { top: null, bottom: null, footwear: null };
}

export function beliefKindFromDetection(det: OnDeviceDetection): BeliefKind {
  const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  if (/shoe|boot|sneaker|footwear/.test(blob)) return 'shoes';
  if (/short/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  if (/trouser|jean|pant|bottom/.test(blob)) return 'trousers';
  if (/top|shirt|tee|polo|knit|sweater|blouse|jersey|outer|blazer|jacket|coat|dress/.test(blob)) {
    return 'top';
  }
  return 'other';
}

function kindToWardrobe(kind: BeliefKind, det?: OnDeviceDetection): { category: string; subcategory: string } {
  if (kind === 'shorts') return { category: 'bottoms', subcategory: 'shorts' };
  if (kind === 'trousers') return { category: 'bottoms', subcategory: 'trousers' };
  if (kind === 'skirt') return { category: 'bottoms', subcategory: 'skirt' };
  if (kind === 'shoes') {
    const sub = String(det?.subcategory || '').toLowerCase();
    if (/sandal/.test(sub)) return { category: 'shoes', subcategory: 'sandals' };
    if (/boot/.test(sub)) return { category: 'shoes', subcategory: 'boots' };
    if (/sneaker|trainer/.test(sub)) return { category: 'shoes', subcategory: 'sneakers' };
    return { category: 'shoes', subcategory: 'sneakers' };
  }
  if (kind === 'top') return { category: 'tops', subcategory: 'top' };
  return { category: 'tops', subcategory: 'top' };
}

/** Canonical belief color — dark family collapses to black. */
export function normalizeBeliefColor(raw?: string | null): string | null {
  const c = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!c || c === 'other' || c === 'unknown' || c === 'dark') return c === 'dark' ? 'black' : null;
  const aliased = COLOR_ALIASES[c] || c;
  if (aliased === 'gray' || aliased === 'charcoal') return 'black';
  return aliased;
}

export function colorFamily(color?: string | null): 'light' | 'dark' | 'color' | 'unknown' {
  const c = normalizeBeliefColor(color);
  if (!c) return 'unknown';
  if (LIGHT_FAMILY.has(c)) return 'light';
  if (DARK_FAMILY.has(c)) return 'dark';
  if (CHROMATIC.has(c)) return 'color';
  return 'unknown';
}

export function colorDistance(a?: string | null, b?: string | null): number {
  const x = normalizeBeliefColor(a);
  const y = normalizeBeliefColor(b);
  if (!x || !y) return 1;
  if (x === y) return 0;
  if (DARK_FAMILY.has(x) && DARK_FAMILY.has(y)) return 0;
  if ((x === 'red' || x === 'burgundy') && (y === 'red' || y === 'burgundy')) return 0.1;
  if (LIGHT_FAMILY.has(x) && LIGHT_FAMILY.has(y)) return 0.15;
  if (CHROMATIC.has(x) && CHROMATIC.has(y)) return 0.4;
  return 1;
}

export type StabilizeColorResult = {
  color: string | null;
  changed: boolean;
  reason?: string;
  code?:
    | 'same_family'
    | 'chromatic_lock'
    | 'low_confidence'
    | 'dark_bottom_lock'
    | 'hard_flip'
    | 'hold'
    | 'init';
};

/**
 * Belief-dominant color resolution with why-tag.
 * Weak frames ignored. Chromatic → black never allowed (phone/shadow).
 * Once a colour is set it cannot disappear to null (occlusion / missing sample).
 */
export function stabilizeColorDetailed(
  prev: string | null | undefined,
  current: string | null | undefined,
  currentConfidence: number,
  kind?: BeliefKind,
): StabilizeColorResult {
  const p = normalizeBeliefColor(prev);
  const c = normalizeBeliefColor(current);
  if (!p) return { color: c, changed: Boolean(c), code: 'init' };
  // Persistence: colour once set cannot vanish on a weak / empty frame
  if (!c) return { color: p, changed: false, code: 'hold', reason: 'color persistence — missing proposal' };

  if (colorDistance(p, c) < 0.2) {
    return { color: p, changed: false, code: 'same_family', reason: 'same color family' };
  }

  if (CHROMATIC.has(p) && DARK_FAMILY.has(c)) {
    return {
      color: p,
      changed: false,
      code: 'chromatic_lock',
      reason: 'color downgrade blocked',
    };
  }

  if (currentConfidence < CHANGE_THRESHOLD) {
    return {
      color: p,
      changed: false,
      code: 'low_confidence',
      reason: 'low confidence — keep prior colour',
    };
  }

  if (
    (kind === 'shorts' || kind === 'trousers' || kind === 'skirt')
    && DARK_FAMILY.has(p)
    && DARK_FAMILY.has(c)
  ) {
    return {
      color: 'black',
      changed: false,
      code: 'dark_bottom_lock',
      reason: 'dark family normalized',
    };
  }

  if (currentConfidence >= 0.96) {
    return {
      color: c,
      changed: p !== c,
      code: 'hard_flip',
      reason: 'high-confidence color change',
    };
  }

  return { color: p, changed: false, code: 'hold', reason: 'insufficient evidence' };
}

export function stabilizeColor(
  prev: string | null | undefined,
  current: string | null | undefined,
  currentConfidence: number,
  kind?: BeliefKind,
): string | null {
  return stabilizeColorDetailed(prev, current, currentConfidence, kind).color;
}

/** Rough IoU for detecting a different physical garment in-frame. */
export function beliefBboxIou(a: BBoxTuple, b: BBoxTuple): number {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];
  const ix0 = Math.max(a[0], b[0]);
  const iy0 = Math.max(a[1], b[1]);
  const ix1 = Math.min(ax2, bx2);
  const iy1 = Math.min(ay2, by2);
  const iw = Math.max(0, ix1 - ix0);
  const ih = Math.max(0, iy1 - iy0);
  const inter = iw * ih;
  const uni = a[2] * a[3] + b[2] * b[3] - inter;
  return uni > 0 ? inter / uni : 0;
}

/**
 * Build an observation — strip unreliable color proposals (black-on-top, very weak conf).
 * Colour at COLOR_ADOPT_THRESHOLD+ is kept so new outfits can seed "Blue top" /
 * "Dark shorts"; stabilizeColor still blocks weak flips once a colour is locked.
 */
export function observationFromDetection(
  det: OnDeviceDetection,
  now = Date.now(),
  log?: BeliefDecision[],
): GarmentBelief {
  const kind = beliefKindFromDetection(det);
  const { category, subcategory } = kindToWardrobe(kind, det);
  const conf = Math.max(0, Math.min(1, det.confidence || 0.5));
  const rawColor = normalizeBeliefColor(det.color);
  let color = rawColor;
  const slot = kind === 'top' ? 'top' as const
    : kind === 'shorts' || kind === 'trousers' || kind === 'skirt' ? 'bottom' as const
      : undefined;

  if (conf < COLOR_ADOPT_THRESHOLD && rawColor) {
    appendDecision(log, {
      type: 'ignore',
      message: `Ignored color: ${rawColor}`,
      reason: 'low confidence',
      slot,
      time: now,
    });
    color = null;
  }

  // Tops: black is last resort — almost always phone/shadow; don't propose it
  if (kind === 'top' && color && DARK_FAMILY.has(color) && conf < 0.98) {
    appendDecision(log, {
      type: 'reject',
      message: `Rejected black on top (${conf.toFixed(2)})`,
      reason: 'black is last resort / likely occlusion',
      slot: 'top',
      time: now,
    });
    color = null;
  }

  // Tops: warm neutrals often come from wall/skin bleed under mirror light
  if (kind === 'top' && color && /^(beige|cream|ivory|brown)$/.test(color) && conf < 0.92) {
    appendDecision(log, {
      type: 'ignore',
      message: `Ignored wall-like top colour: ${color}`,
      reason: 'beige/cream often background bleed',
      slot: 'top',
      time: now,
    });
    color = null;
  }

  return {
    kind,
    category,
    subcategory,
    color,
    confidence: conf,
    stability: 0.35,
    bbox: det.bbox as BBoxTuple,
    trackId: det.trackId,
    lastChangedAt: now,
    lastSeenAt: now,
  };
}

// Note: skinRatio stays on OnDeviceDetection only; gate reads it before belief.

function canChangeState(prev: GarmentBelief, now: number): boolean {
  return now - prev.lastChangedAt >= BELIEF_CHANGE_COOLDOWN_MS;
}

function applyStabilizedColor(
  prev: GarmentBelief,
  current: GarmentBelief,
  log: BeliefDecision[] | undefined,
  now: number,
  slot: 'top' | 'bottom' | 'footwear',
): string | null {
  const result = stabilizeColorDetailed(prev.color, current.color, current.confidence, prev.kind);
  if (result.code === 'chromatic_lock' && prev.color && current.color) {
    appendDecision(log, {
      type: 'reject',
      message: `Blocked ${prev.color} → ${current.color}`,
      reason: result.reason || 'color downgrade blocked',
      slot,
      time: now,
    });
  } else if (result.code === 'low_confidence' && current.color && prev.color !== current.color) {
    appendDecision(log, {
      type: 'ignore',
      message: `Ignored color: ${current.color}`,
      reason: result.reason || 'low confidence',
      slot,
      time: now,
    });
  } else if (result.changed && result.color) {
    appendDecision(log, {
      type: 'update',
      message: `Color → ${result.color}`,
      reason: result.reason || 'high-confidence color change',
      slot,
      time: now,
    });
  }
  return result.color;
}

function slotOfKind(kind: BeliefKind): 'top' | 'bottom' | 'footwear' {
  if (kind === 'top') return 'top';
  if (kind === 'shoes') return 'footwear';
  return 'bottom';
}

function resolveConflict(
  prev: GarmentBelief,
  current: GarmentBelief,
  now: number,
  log?: BeliefDecision[],
): GarmentBelief {
  const slot = slotOfKind(prev.kind);

  // Locked trousers: only hold against shorts when this still looks like a pant column
  if (prev.kind === 'trousers' && current.kind === 'shorts') {
    if (looksLikeShortsWithFootwearExtension(current.bbox) || !isFloorLengthTrousersEvidence(prev.bbox)) {
      appendDecision(log, {
        type: 'update',
        message: 'trousers → shorts',
        reason: 'shorts geometry overrides false trousers lock',
        slot: 'bottom',
        time: now,
      });
      return {
        ...current,
        color: applyStabilizedColor(prev, current, log, now, 'bottom') || current.color,
        stability: Math.max(0.45, prev.stability * 0.55),
        lastChangedAt: now,
        lastSeenAt: now,
      };
    }
    appendDecision(log, {
      type: 'reject',
      message: 'Blocked shorts downgrade',
      reason: 'Cannot downgrade full-length garment',
      slot: 'bottom',
      time: now,
    });
    return {
      ...prev,
      lastSeenAt: now,
      confidence: Math.min(1, prev.confidence + 0.02),
      bbox: isFloorLengthTrousersEvidence(current.bbox) ? current.bbox : prev.bbox,
      color: applyStabilizedColor(prev, current, log, now, 'bottom'),
    };
  }

  // Locked shorts must yield to true waist→floor trousers (not socks/boots fuse)
  if (
    prev.kind === 'shorts'
    && current.kind === 'trousers'
    && isFloorLengthTrousersEvidence(current.bbox)
    && !looksLikeShortsWithFootwearExtension(current.bbox)
    && current.confidence >= 0.75
  ) {
    appendDecision(log, {
      type: 'update',
      message: 'shorts → trousers',
      reason: 'floor-length geometry override',
      slot: 'bottom',
      time: now,
    });
    return {
      ...current,
      color: applyStabilizedColor(prev, current, log, now, 'bottom') || current.color,
      stability: Math.max(0.45, prev.stability * 0.6),
      lastChangedAt: now,
      lastSeenAt: now,
    };
  }

  if (current.confidence < CHANGE_THRESHOLD) {
    appendDecision(log, {
      type: 'ignore',
      message: `Ignored ${current.kind} challenge`,
      reason: 'low confidence',
      slot,
      time: now,
    });
    return {
      ...prev,
      lastSeenAt: now,
      confidence: Math.min(1, prev.confidence + 0.01),
    };
  }

  if (prev.stability > BELIEF_STABILITY_RESIST && current.confidence < BELIEF_SWITCH_CONF) {
    appendDecision(log, {
      type: 'reject',
      message: `Kept ${prev.kind} over ${current.kind}`,
      reason: 'belief stability resists change',
      slot,
      time: now,
    });
    return {
      ...prev,
      confidence: Math.min(1, prev.confidence + 0.02),
      lastSeenAt: now,
      color: applyStabilizedColor(prev, current, log, now, slot),
      bbox: current.confidence >= prev.confidence ? current.bbox : prev.bbox,
    };
  }

  if (current.confidence >= BELIEF_SWITCH_CONF && canChangeState(prev, now)) {
    appendDecision(log, {
      type: 'update',
      message: `${prev.kind} → ${current.kind}`,
      reason: 'strong evidence override',
      slot,
      time: now,
    });
    // New kind = new garment — take observation colour (don't inherit old hue)
    return {
      ...current,
      color: current.color,
      stability: 0.4,
      lastChangedAt: now,
      lastSeenAt: now,
    };
  }

  return {
    ...prev,
    confidence: Math.max(BELIEF_FLOOR, prev.confidence * 0.99),
    stability: Math.max(0.4, prev.stability * 0.98),
    lastSeenAt: now,
    color: applyStabilizedColor(prev, current, log, now, slot),
    bbox: current.confidence >= prev.confidence ? current.bbox : prev.bbox,
  };
}

/** Reinforce or hold belief. Missing current → hold with gentle decay (authoritative memory). */
export function updateBelief(
  prev: GarmentBelief | null,
  current: GarmentBelief | null,
  now = Date.now(),
  log?: BeliefDecision[],
): GarmentBelief | null {
  if (!prev && !current) return null;

  if (!current && prev) {
    const age = now - prev.lastSeenAt;
    if (age > BELIEF_MISS_TTL_MS) {
      appendDecision(log, {
        type: 'update',
        message: `Cleared ${prev.kind}`,
        reason: 'miss TTL expired',
        slot: slotOfKind(prev.kind),
        time: now,
      });
      return null;
    }
    appendDecision(log, {
      type: 'hold',
      message: `Held ${prev.kind}`,
      reason: 'memory persistence',
      slot: slotOfKind(prev.kind),
      time: now,
    });
    return {
      ...prev,
      confidence: Math.max(BELIEF_FLOOR, prev.confidence * BELIEF_DECAY),
      stability: Math.max(0.4, prev.stability * 0.99),
    };
  }

  if (!prev && current) {
    appendDecision(log, {
      type: 'update',
      message: `Seeded ${current.kind}`,
      reason: 'first observation',
      slot: slotOfKind(current.kind),
      time: now,
    });
    return { ...current, stability: 0.45, lastChangedAt: now, lastSeenAt: now };
  }

  const p = prev!;
  const c = current!;
  const slot = slotOfKind(p.kind);

  if (p.kind === c.kind) {
    // Locked shorts with a true waist→floor pant box → promote to trousers
    if (
      p.kind === 'shorts'
      && isFloorLengthTrousersEvidence(c.bbox)
      && !looksLikeShortsWithFootwearExtension(c.bbox)
    ) {
      appendDecision(log, {
        type: 'update',
        message: 'shorts → trousers',
        reason: 'floor-length box while believing shorts',
        slot: 'bottom',
        time: now,
      });
      return {
        ...p,
        kind: 'trousers',
        subcategory: 'trousers',
        confidence: Math.min(1, p.confidence + 0.06),
        stability: Math.min(1, Math.max(0.5, p.stability * 0.85)),
        bbox: c.bbox,
        trackId: c.trackId || p.trackId,
        color: stabilizeColor(p.color, c.color, c.confidence, 'trousers'),
        lastChangedAt: now,
        lastSeenAt: now,
      };
    }

    // Locked trousers but clear shorts+socks/boots frame → recover shorts
    if (
      p.kind === 'trousers'
      && (
        looksLikeShortsWithFootwearExtension(c.bbox)
        || (c.kind === 'trousers' && c.bbox[1] >= 0.48 && c.bbox[3] < 0.40 && c.confidence >= 0.75)
      )
    ) {
      appendDecision(log, {
        type: 'update',
        message: 'trousers → shorts',
        reason: 'shorts+socks/boots geometry override',
        slot: 'bottom',
        time: now,
      });
      return {
        ...c,
        kind: 'shorts',
        subcategory: 'shorts',
        category: 'bottoms',
        color: stabilizeColor(p.color, c.color, c.confidence, 'shorts') || c.color,
        stability: Math.max(0.45, p.stability * 0.6),
        lastChangedAt: now,
        lastSeenAt: now,
      };
    }

    let color = applyStabilizedColor(p, c, log, now, slot);
    // Low IoU + different colour → user changed outfit; don't keep old hue locked
    if (
      c.color
      && c.confidence >= CHANGE_THRESHOLD
      && colorDistance(p.color, c.color) >= 0.2
      && beliefBboxIou(p.bbox, c.bbox) < 0.28
    ) {
      appendDecision(log, {
        type: 'update',
        message: `Colour swap → ${c.color}`,
        reason: 'low IoU garment change',
        slot,
        time: now,
      });
      color = c.color;
    }
    appendDecision(log, {
      type: 'reinforce',
      message: `Reinforced ${p.kind}`,
      reason: 'agreeing frame',
      slot,
      time: now,
    });
    return {
      ...p,
      confidence: Math.min(1, p.confidence + 0.06),
      stability: Math.min(1, p.stability + 0.12),
      bbox: c.bbox,
      trackId: c.trackId || p.trackId,
      color,
      lastSeenAt: now,
    };
  }

  return resolveConflict(p, c, now, log);
}

export function beliefToDetection(belief: GarmentBelief): OnDeviceDetection {
  const name = formatGarmentDisplayName({
    color: belief.color,
    category: belief.category,
    subcategory: belief.subcategory,
  });
  return {
    name,
    category: belief.category,
    subcategory: belief.subcategory,
    color: belief.color || undefined,
    confidence: belief.confidence,
    bbox: belief.bbox,
    trackId: belief.trackId,
  };
}

export function bottomSubtypeFromBelief(kind: BeliefKind): BottomSubtype | null {
  if (kind === 'shorts') return 'shorts';
  if (kind === 'trousers') return 'trousers';
  if (kind === 'skirt') return 'skirt';
  return null;
}

/**
 * Apply belief updates — belief is authoritative output for the UI.
 */
export function applyOutfitBelief(
  state: OutfitBeliefState,
  detections: OnDeviceDetection[],
  opts?: { now?: number; decisions?: BeliefDecision[] },
): {
  state: OutfitBeliefState;
  detections: OnDeviceDetection[];
  repairs: string[];
  decisions: BeliefDecision[];
} {
  const now = opts?.now ?? Date.now();
  const repairs: string[] = [];
  const decisions = opts?.decisions || [];

  const topsRaw = detections.filter((d) => beliefKindFromDetection(d) === 'top');
  const bareTorsoEvidence = topsRaw.some((d) => isBareTorsoTopLike({
    category: d.category,
    subcategory: d.subcategory,
    name: d.name,
    skinRatio: d.skinRatio,
    fabricColor: d.color,
  }));
  const tops = topsRaw.filter((d) => !isBareTorsoTopLike({
    category: d.category,
    subcategory: d.subcategory,
    name: d.name,
    skinRatio: d.skinRatio,
    fabricColor: d.color,
  }));
  const bottoms = detections.filter((d) => {
    const k = beliefKindFromDetection(d);
    return k === 'shorts' || k === 'trousers' || k === 'skirt';
  });
  const shoes = detections.filter((d) => beliefKindFromDetection(d) === 'shoes');

  const topObs = tops.sort((a, b) => b.confidence - a.confidence)[0] || null;
  let bottomObs = bottoms.sort((a, b) => b.confidence - a.confidence)[0] || null;
  let shoeObs = shoes.sort((a, b) => b.confidence - a.confidence)[0] || null;

  // Floor-length bottoms labeled shorts → force trousers (true pant columns only)
  if (bottomObs && /short/i.test(`${bottomObs.subcategory} ${bottomObs.name}`)) {
    if (
      isFloorLengthTrousersEvidence(bottomObs.bbox as BBoxTuple)
      && !looksLikeShortsWithFootwearExtension(bottomObs.bbox as BBoxTuple)
    ) {
      bottomObs = {
        ...bottomObs,
        subcategory: 'trousers',
        name: formatGarmentDisplayName({
          color: bottomObs.color,
          category: 'bottoms',
          subcategory: 'trousers',
        }),
      };
    }
  }
  // False trousers from shorts+socks/boots → shorts
  if (bottomObs && /trouser|pant|jean/i.test(`${bottomObs.subcategory} ${bottomObs.name}`)) {
    if (looksLikeShortsWithFootwearExtension(bottomObs.bbox as BBoxTuple)) {
      bottomObs = {
        ...bottomObs,
        subcategory: 'shorts',
        name: formatGarmentDisplayName({
          color: bottomObs.color,
          category: 'bottoms',
          subcategory: 'shorts',
        }),
      };
    }
  }

  // Weak / barefoot shoes never enter belief — fabric-coloured trainers may
  if (shoeObs) {
    const skin = shoeObs.skinRatio;
    const fabricOk = hasReliableFabricColor(shoeObs.color);
    const skinOk = skin != null && skin < 0.22;
    const confMin = fabricOk ? 0.62 : 0.75;
    if ((!skinOk && !fabricOk) || shoeObs.confidence < confMin) {
      shoeObs = null;
    }
  }

  const prevTopKind = state.top?.kind;
  const prevBottomKind = state.bottom?.kind;
  const prevTopColor = state.top?.color;
  const prevBottomColor = state.bottom?.color;
  const prevShoeSub = state.footwear?.subcategory;

  const top = updateBelief(
    state.top,
    topObs ? observationFromDetection(topObs, now, decisions) : null,
    now,
    decisions,
  );
  const bottom = updateBelief(
    state.bottom,
    bottomObs ? observationFromDetection(bottomObs, now, decisions) : null,
    now,
    decisions,
  );
  let footwear = updateBelief(
    state.footwear,
    shoeObs ? observationFromDetection(shoeObs, now, decisions) : null,
    now,
    decisions,
  );

  // Subtype lock — slower than detection
  if (footwear && shoeObs?.subcategory && state.footwear?.subcategory) {
    const locked = stabilizeShoeSubtype(
      state.footwear.subcategory as ShoeSubtype,
      shoeObs.subcategory as ShoeSubtype,
      shoeObs.confidence,
    );
    if (locked !== footwear.subcategory) {
      footwear = {
        ...footwear,
        subcategory: locked,
      };
    }
  }

  if (prevTopKind && top && prevTopKind !== top.kind) repairs.push(`belief_top→${top.kind}`);
  if (prevBottomKind && bottom && prevBottomKind !== bottom.kind) {
    repairs.push(`belief_bottom→${bottom.kind}`);
  }
  if (prevTopColor && top?.color && prevTopColor !== top.color) {
    repairs.push(`belief_top_color→${top.color}`);
  }
  if (prevBottomColor && bottom?.color && prevBottomColor !== bottom.color) {
    repairs.push(`belief_bottom_color→${bottom.color}`);
  }
  if (state.top && !topObs && top) repairs.push('belief_top_held');
  if (state.bottom && !bottomObs && bottom) repairs.push('belief_bottom_held');
  if (state.footwear && !shoeObs && footwear) repairs.push('belief_footwear_held');
  if (prevShoeSub && footwear?.subcategory && prevShoeSub !== footwear.subcategory) {
    repairs.push(`belief_footwear→${footwear.subcategory}`);
  }

  const next: OutfitBeliefState = { top, bottom, footwear };
  const out: OnDeviceDetection[] = [];
  if (top) out.push(beliefToDetection(top));
  if (bottom) out.push(beliefToDetection(bottom));
  if (footwear) out.push(beliefToDetection(footwear));

  return { state: next, detections: out, repairs, decisions };
}
