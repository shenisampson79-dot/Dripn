/**
 * Live garment belief engine — source of truth for Live overlays.
 *
 * Rule: Belief > Frame. Weak / occluded / cloud-noisy frames cannot override
 * a stable belief. Chromatic colors (red) never downgrade to phone-black.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  detectTorsoState,
  formatGarmentDisplayName,
  hasReliableFabricColor,
  isBareTorsoTopLike,
  isFloorLengthTrousersEvidence,
  looksLikeDress,
  looksLikeShortsWithFootwearExtension,
  type BBoxTuple,
  type BottomSubtype,
  type TorsoState,
} from '@/utils/bodyGeometryGuardrails';
import {
  appendDecision,
  type BeliefDecision,
} from '@/utils/liveBeliefDecisions';
import { buildFootwearDisplayLabel } from '@/utils/footwearLayers';
import {
  stabilizeShoeSubtype,
  type ShoeSubtype,
} from '@/utils/liveFootwearGate';
import { isSpecificVisionName, preferVisionIdentityName, resistsShortsGeometryDemotion } from '@/utils/visionTrust';

export type { BeliefDecision, BeliefDecisionType } from '@/utils/liveBeliefDecisions';
export { isSpecificVisionName } from '@/utils/visionTrust';

export type BeliefKind =
  | 'top'
  | 'outerwear'
  | 'dress'
  | 'shorts'
  | 'trousers'
  | 'skirt'
  | 'shoes'
  | 'other';

export type GarmentBelief = {
  kind: BeliefKind;
  category: string;
  subcategory: string;
  /** Vision display name when specific — prefer over rebuilt color+subtype labels. */
  name?: string | null;
  color: string | null;
  confidence: number;
  /** 0–1 resistance to change. Reinforced by agreeing frames. */
  stability: number;
  bbox: BBoxTuple;
  trackId?: string;
  lastChangedAt: number;
  lastSeenAt: number;
};

/** Prefer colour words stated in the vision label over noisy ROI sampling. */
export function colorFromVisionName(name?: string | null): string | null {
  const n = String(name || '').toLowerCase();
  if (!n) return null;
  if (/multicolou?r|multi[- ]?colou?r|multi[- ]?tone/.test(n)) return 'multicolor';
  if (/\b(light\s*)?(grey|gray)\b/.test(n)) return 'gray';
  if (/\b(black|charcoal)\b/.test(n)) return 'black';
  if (/\bnavy\b/.test(n)) return 'navy';
  if (/\b(white|cream|ivory)\b/.test(n)) return 'white';
  if (/\b(beige|tan|khaki)\b/.test(n)) return 'beige';
  if (/\bbrown\b/.test(n)) return 'brown';
  if (/\b(red|burgundy|maroon)\b/.test(n)) return 'red';
  if (/\blight\s*blue\b/.test(n)) return 'light_blue';
  if (/\bblue\b/.test(n)) return 'blue';
  if (/\bgreen\b/.test(n)) return 'green';
  if (/\bpink\b/.test(n)) return 'pink';
  return null;
}

/** Keep specific vision labels (e.g. "Gray Sweatpants") instead of "Dark trousers". */
/** Minimum confidence to adopt colour from a vision display name. */
export const VISION_NAME_COLOR_CONF = 0.6;

export type OutfitBeliefState = {
  /** Base upper (tee, tank, blouse). */
  top: GarmentBelief | null;
  /** Optional layer over the base (shirt, overshirt, jacket, knit). */
  layer: GarmentBelief | null;
  bottom: GarmentBelief | null;
  footwear: GarmentBelief | null;
  /** Upstream body truth — bare kills ghost tops even if belief wants to hold. */
  torsoState?: TorsoState;
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
/** Overlap needed to keep a dress locked against trousers/skirt/shorts flips. */
export const DRESS_PERSIST_IOU = 0.6;

const COLOR_ALIASES: Record<string, string> = {
  grey: 'gray',
  // Keep dark greys as grey — collapsing to black caused "Dark trousers"
  'dark_grey': 'gray',
  'dark_gray': 'gray',
  charcoal: 'gray',
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
  return { top: null, layer: null, bottom: null, footwear: null, torsoState: 'uncertain' };
}

/** Jacket / overshirt / button-up — sits over a base tee when both are seen. */
export function isUpperLayerCandidate(det: OnDeviceDetection): boolean {
  const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  if (/outer|jacket|blazer|coat|gilet|vest|cardigan|hoodie|sweater|knit|overshirt/.test(blob)) return true;
  // Collared shirt only — athletic / sports / t-shirts are base tops, not layers
  if (/\bshirt\b/.test(blob)
    && !/t-?shirt|\btee\b|athletic|sport|jersey|polo|sweat/.test(blob)) {
    return true;
  }
  return false;
}

/** Collared shirt / button-up — base under a blazer, not a competing layer. */
export function isCollaredShirtCandidate(det: OnDeviceDetection): boolean {
  const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  if (/outer|jacket|blazer|coat|gilet|vest|hoodie|cardigan/.test(blob)) return false;
  return /dress[\s_-]*shirt|oxford[\s_-]*shirt|button[\s_-]?down|button[\s_-]?up|\bshirt\b/.test(blob)
    && !/t-?shirt|\btee\b/.test(blob);
}

/** Tee / tank / plain top — base under a layer. */
export function isBaseTopCandidate(det: OnDeviceDetection): boolean {
  const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  if (isUpperLayerCandidate(det)) return false;
  return /tee|t-?shirt|tank|singlet|polo|blouse|^top$|\btop\b/.test(blob)
    || beliefKindFromDetection(det) === 'top';
}

function isOuterwearLayer(det: OnDeviceDetection): boolean {
  const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  return beliefKindFromDetection(det) === 'outerwear'
    || /outer|jacket|blazer|coat|gilet|vest|cardigan|hoodie/.test(blob);
}

function splitUpperDetections(uppers: OnDeviceDetection[]): {
  base: OnDeviceDetection | null;
  layer: OnDeviceDetection | null;
} {
  if (!uppers.length) return { base: null, layer: null };
  const sorted = [...uppers].sort((a, b) => b.confidence - a.confidence);
  const layers = sorted.filter(isUpperLayerCandidate);
  const bases = sorted.filter(isBaseTopCandidate);
  if (layers.length && bases.length) {
    return { base: bases[0], layer: layers[0] };
  }
  if (layers.length && !bases.length) {
    // Blazer + dress shirt both look like "layers" — keep shirt as base under outerwear.
    const outers = layers.filter(isOuterwearLayer);
    const shirts = layers.filter(isCollaredShirtCandidate);
    if (outers.length && shirts.length) {
      return { base: shirts[0], layer: outers[0] };
    }
    if (outers.length >= 2) {
      return { base: null, layer: outers[0] };
    }
    if (shirts.length >= 2) {
      return { base: shirts[0], layer: shirts[1] };
    }
    // Jacket alone — show as layer; no phantom base tee
    return { base: null, layer: layers[0] };
  }
  if (bases.length >= 2) {
    // Two tops, neither strongly a layer: keep strongest as base, second as layer
    return { base: bases[0], layer: bases[1] };
  }
  return { base: bases[0] || sorted[0], layer: null };
}

export function beliefKindFromDetection(det: OnDeviceDetection): BeliefKind {
  const blob = `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
  if (/shoe|boot|sneaker|footwear|sandal|flip.?flop|slide|thong|mule|loafer|chelsea|oxford/.test(blob)
    && !/oxford\s*shirt|dress\s*shirt/.test(blob)) {
    return 'shoes';
  }
  // Dress shirt / button-up — never a one-piece dress (pink shirt was locking as Pink dress)
  if (/dress[\s_-]*shirt|shirt[\s_-]*dress|oxford[\s_-]*shirt|button[\s_-]?down|button[\s_-]?up/.test(blob)
    && !/\b(maxi|midi|mini)\s*dress\b/.test(blob)) {
    return 'top';
  }
  if (/\bdress\b/.test(blob) && !/dress[\s_-]*shirt|dress[\s_-]*shoe/.test(blob)) return 'dress';
  if (/outer|jacket|blazer|coat|gilet|vest/.test(blob)) return 'outerwear';
  if (/short/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  if (/trouser|jean|pant|chino|bottom/.test(blob)) return 'trousers';
  if (/top|shirt|tee|polo|knit|sweater|blouse|jersey/.test(blob)) {
    return 'top';
  }
  return 'other';
}

function kindToWardrobe(kind: BeliefKind, det?: OnDeviceDetection): { category: string; subcategory: string } {
  if (kind === 'shorts') return { category: 'bottoms', subcategory: 'shorts' };
  if (kind === 'trousers') return { category: 'bottoms', subcategory: 'trousers' };
  if (kind === 'skirt') return { category: 'bottoms', subcategory: 'skirt' };
  if (kind === 'dress') {
    const sub = String(det?.subcategory || '').toLowerCase();
    if (/maxi/.test(sub)) return { category: 'dresses', subcategory: 'maxi_dress' };
    if (/midi/.test(sub)) return { category: 'dresses', subcategory: 'midi_dress' };
    return { category: 'dresses', subcategory: sub || 'dress' };
  }
  if (kind === 'outerwear') {
    const blob = `${det?.subcategory || ''} ${det?.name || ''}`.toLowerCase();
    return {
      category: 'outerwear',
      subcategory: /blazer/.test(blob) ? 'blazer' : (/coat/.test(blob) ? 'coat' : 'jacket'),
    };
  }
  if (kind === 'shoes') {
    const sub = String(det?.subcategory || '').toLowerCase().replace(/[\s-]+/g, '_');
    const name = String(det?.name || '').toLowerCase();
    const blob = `${sub} ${name}`;
    if (/flip.?flop|thong/.test(blob)) return { category: 'shoes', subcategory: 'flip_flops' };
    if (/\bslides?\b/.test(blob) && !/sandal/.test(blob)) return { category: 'shoes', subcategory: 'slides' };
    if (/sandal/.test(blob)) return { category: 'shoes', subcategory: 'sandals' };
    if (/boat\s*shoe|deck\s*shoe|topsider|sperry|boat_shoes/.test(blob)) {
      return { category: 'shoes', subcategory: 'boat_shoes' };
    }
    if (/chelsea/.test(blob)) return { category: 'shoes', subcategory: 'boots' };
    if (/\bboots?\b/.test(blob)) return { category: 'shoes', subcategory: 'boots' };
    if (/loafer/.test(blob)) return { category: 'shoes', subcategory: 'loafers' };
    if (/oxford|derby|dress\s*shoe/.test(blob)) return { category: 'shoes', subcategory: 'oxfords' };
    if (/sneaker|trainer/.test(blob)) return { category: 'shoes', subcategory: 'sneakers' };
    if (
      sub === 'flip_flops' || sub === 'slides' || sub === 'sandals'
      || sub === 'boots' || sub === 'sneakers' || sub === 'boat_shoes'
      || sub === 'loafers' || sub === 'oxfords' || sub === 'chelsea_boots'
    ) {
      return { category: 'shoes', subcategory: sub === 'chelsea_boots' ? 'boots' : sub };
    }
    // Unknown shoe → generic, never invent "sneakers"
    return { category: 'shoes', subcategory: sub && sub !== 'shoes' ? sub : 'shoes' };
  }
  if (kind === 'top') {
    const rawSub = String(det?.subcategory || '').trim();
    const subNorm = rawSub.toLowerCase().replace(/[\s-]+/g, '_');
    const blob = `${subNorm} ${det?.name || ''}`.toLowerCase();
    if (rawSub && subNorm !== 'top' && subNorm !== 'tops') {
      return { category: 'tops', subcategory: rawSub };
    }
    if (/polo/.test(blob)) return { category: 'tops', subcategory: 'polo' };
    if (/t-?shirt|\btee\b/.test(blob)) return { category: 'tops', subcategory: 't-shirt' };
    if (/oxford|button[\s_-]?up|button[\s_-]?down|dress[\s_-]?shirt/.test(blob)) {
      return { category: 'tops', subcategory: 'shirt' };
    }
    if (/hoodie/.test(blob)) return { category: 'tops', subcategory: 'hoodie' };
    if (/sweater|knit|jumper/.test(blob)) return { category: 'tops', subcategory: 'sweater' };
    return { category: 'tops', subcategory: 'top' };
  }
  return { category: 'tops', subcategory: 'top' };
}

function isBottomLikeKind(kind: BeliefKind): boolean {
  return kind === 'trousers' || kind === 'skirt' || kind === 'shorts';
}

function preferUpperDetection(a: OnDeviceDetection, b: OnDeviceDetection): number {
  const aOuter = beliefKindFromDetection(a) === 'outerwear' ? 1 : 0;
  const bOuter = beliefKindFromDetection(b) === 'outerwear' ? 1 : 0;
  if (aOuter !== bOuter) return bOuter - aOuter;
  return b.confidence - a.confidence;
}

/** Canonical belief color — dark family collapses carefully; grey bottoms stay grey. */
export function normalizeBeliefColor(raw?: string | null, kind?: BeliefKind): string | null {
  const c = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!c || c === 'other' || c === 'unknown') return null;
  // "dark" without a real sample — bottoms may use black; footwear must not invent black
  if (c === 'dark') return kind === 'shoes' ? null : 'black';
  const aliased = COLOR_ALIASES[c] || c;
  // Grey must stay grey for bottoms + footwear — collapsing trousers→black made "Dark trousers"
  if (aliased === 'gray') {
    return 'gray';
  }
  if (aliased === 'charcoal') {
    if (kind === 'shoes' || kind === 'shorts' || kind === 'trousers' || kind === 'skirt') return 'gray';
    return 'black';
  }
  return aliased;
}

export function colorFamily(color?: string | null, kind?: BeliefKind): 'light' | 'dark' | 'color' | 'unknown' {
  const c = normalizeBeliefColor(color, kind);
  if (!c) return 'unknown';
  if (LIGHT_FAMILY.has(c)) return 'light';
  if (DARK_FAMILY.has(c)) return 'dark';
  if (CHROMATIC.has(c)) return 'color';
  return 'unknown';
}

export function colorDistance(a?: string | null, b?: string | null, kind?: BeliefKind): number {
  const x = normalizeBeliefColor(a, kind);
  const y = normalizeBeliefColor(b, kind);
  if (!x || !y) return 1;
  if (x === y) return 0;
  // Grey bottoms/shoes are distinct from black — never treat as same family
  if (
    (x === 'gray' || y === 'gray')
    && (x === 'black' || y === 'black')
  ) {
    return 0.45;
  }
  if (kind === 'shoes' && (x === 'gray' || x === 'black') && (y === 'gray' || y === 'black')) {
    return x === y ? 0 : 0.35;
  }
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
    | 'warm_neutral_lock'
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
  const p = normalizeBeliefColor(prev, kind);
  const c = normalizeBeliefColor(current, kind);
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

  // Warm neutrals: beige/cream must not flicker to white under bright light.
  if (
    /^(beige|cream|ivory)$/.test(p || '')
    && c === 'white'
    && currentConfidence < 0.98
  ) {
    return {
      color: p,
      changed: false,
      code: 'warm_neutral_lock',
      reason: 'beige/cream resists white flicker',
    };
  }

  // Footwear: warm lamps often invent brown over red/white boat shoes.
  if (
    kind === 'shoes'
    && p === 'brown'
    && /^(red|burgundy|white)$/.test(c || '')
    && currentConfidence >= 0.75
  ) {
    return {
      color: c,
      changed: true,
      code: 'hard_flip',
      reason: 'chromatic footwear beats warm-lamp brown',
    };
  }

  // Shorts: overexposure often reads grey chino as white — allow grey upgrade.
  if (
    kind === 'shorts'
    && p === 'white'
    && /^(gray|grey|light_gray|light_grey)$/.test(c || '')
    && currentConfidence >= 0.72
  ) {
    return {
      color: c === 'light_grey' || c === 'grey' ? 'gray' : c,
      changed: true,
      code: 'hard_flip',
      reason: 'grey shorts under bright light',
    };
  }

  // False dark lock: dim ROI painted light bottoms black — recover on light proposals.
  if (
    (kind === 'shorts' || kind === 'trousers')
    && p === 'black'
    && /^(white|gray|grey|cream|beige|ivory|light_gray|light_grey)$/.test(c || '')
    && currentConfidence >= 0.75
  ) {
    return {
      color: c === 'grey' || c === 'light_grey' || c === 'light_gray' ? 'gray' : c,
      changed: true,
      code: 'hard_flip',
      reason: 'light bottoms recover from false black',
    };
  }

  // Shirt reflection: cool cast paints grey/cream chinos "blue" — recover on light proposals.
  if (
    (kind === 'shorts' || kind === 'trousers')
    && p === 'blue'
    && /^(white|gray|grey|cream|beige|ivory|black|light_gray|light_grey|light_blue)$/.test(c || '')
    && currentConfidence >= 0.72
  ) {
    const next = c === 'grey' || c === 'light_grey' || c === 'light_gray' ? 'gray'
      : c === 'light_blue' ? 'gray'
      : c;
    return {
      color: next,
      changed: true,
      code: 'hard_flip',
      reason: 'false blue bottom recovers to light/dark sample',
    };
  }

  // Mint/green misread of light blue linen — allow light_blue upgrade on tops.
  if (
    kind === 'top'
    && p === 'green'
    && /^(light_blue|blue|white|cream)$/.test(c || '')
    && currentConfidence >= 0.78
  ) {
    return {
      color: c === 'blue' ? 'light_blue' : c,
      changed: true,
      code: 'hard_flip',
      reason: 'light blue recovers from false green',
    };
  }

  // Cool-confusion hysteresis: green ↔ blue flicker needs stronger evidence.
  // (light_blue recovery above already ran; this blocks the reverse chaos.)
  if (
    kind === 'top'
    && currentConfidence < 0.94
    && (
      (p === 'light_blue' && /^(green|blue)$/.test(c || ''))
      || (p === 'blue' && c === 'green')
      || (p === 'green' && c === 'blue')
    )
  ) {
    return {
      color: p,
      changed: false,
      code: 'low_confidence',
      reason: 'cool-colour hysteresis — need stronger evidence',
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
    // Grey sweatpants / joggers must not become "Dark" via black collapse
    if (p === 'gray' || c === 'gray') {
      return {
        color: 'gray',
        changed: p !== 'gray',
        code: p === 'gray' ? 'same_family' : 'hard_flip',
        reason: 'prefer grey over dark collapse',
      };
    }
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
 * High-conf vision names win over ROI colour noise.
 */
export function observationFromDetection(
  det: OnDeviceDetection,
  now = Date.now(),
  log?: BeliefDecision[],
): GarmentBelief {
  const kind = beliefKindFromDetection(det);
  const { category, subcategory } = kindToWardrobe(kind, det);
  const conf = Math.max(0, Math.min(1, det.confidence || 0.5));
  const namedColor = colorFromVisionName(det.name);
  const rawColor = normalizeBeliefColor(det.color, kind);
  // Vision label colour beats sampled ROI when the name is specific (Grey Sweatpants, Multicolor…)
  let color = (namedColor && conf >= VISION_NAME_COLOR_CONF)
    ? normalizeBeliefColor(namedColor, kind)
    : rawColor;
  if (!color && namedColor) color = normalizeBeliefColor(namedColor, kind);
  const slot = kind === 'top' || kind === 'outerwear' ? 'top' as const
    : kind === 'shorts' || kind === 'trousers' || kind === 'skirt' || kind === 'dress' ? 'bottom' as const
      : undefined;

  if (conf < COLOR_ADOPT_THRESHOLD && color && !(namedColor && conf >= VISION_NAME_COLOR_CONF)) {
    appendDecision(log, {
      type: 'ignore',
      message: `Ignored color: ${color}`,
      reason: 'low confidence',
      slot,
      time: now,
    });
    color = null;
  }

  // Tops: black is last resort unless vision named it / gave a specific garment label
  const nameSaysDark = /black|grey|gray|charcoal/i.test(String(det.name || ''));
  const namedGarment = isSpecificVisionName(det.name);
  const darkTopGate = (namedGarment || nameSaysDark) ? 0.6 : 0.98;
  if (kind === 'top' && color && DARK_FAMILY.has(color) && conf < darkTopGate && !nameSaysDark && !namedGarment) {
    appendDecision(log, {
      type: 'reject',
      message: `Rejected black on top (${conf.toFixed(2)})`,
      reason: 'black is last resort / likely occlusion',
      slot: 'top',
      time: now,
    });
    color = null;
  }

  // Base tees only — jackets/layers keep beige/cream (not wall-bleed).
  if (kind === 'top' && color && /^(beige|cream|ivory|brown)$/.test(color) && conf < 0.92) {
    appendDecision(log, {
      type: 'ignore',
      message: `Ignored wall-like top colour: ${color}`,
      reason: 'beige/cream often background bleed on tees',
      slot: 'top',
      time: now,
    });
    color = null;
  }

  const visionName = isSpecificVisionName(det.name) ? String(det.name).trim() : null;

  return {
    kind,
    category,
    subcategory,
    name: visionName,
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
  if (kind === 'top' || kind === 'outerwear') return 'top';
  if (kind === 'shoes') return 'footwear';
  // dress shares bottom slot so jacket (top) + dress can coexist
  return 'bottom';
}

function resolveConflict(
  prev: GarmentBelief,
  current: GarmentBelief,
  now: number,
  log?: BeliefDecision[],
): GarmentBelief {
  const slot = slotOfKind(prev.kind);

  // Trousers persistence: truncated mid-thigh YOLO boxes must not flip long pants to shorts.
  if (prev.kind === 'trousers' && current.kind === 'shorts') {
    if (beliefBboxIou(prev.bbox, current.bbox) >= 0.45 || isFloorLengthTrousersEvidence(prev.bbox)) {
      appendDecision(log, {
        type: 'reject',
        message: 'Kept trousers over shorts',
        reason: 'trousers persistence vs truncated shorts box',
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
  }

  // Dress persistence: overlapping trousers/skirt/shorts must not reclassify a real one-piece.
  // Fast override when the challenger is clearly stronger (fixes ~60s false dress-shirt lock).
  if (prev.kind === 'dress' && isBottomLikeKind(current.kind)) {
    if (current.confidence >= prev.confidence + 0.2) {
      appendDecision(log, {
        type: 'update',
        message: `dress → ${current.kind}`,
        reason: 'fast override — stronger bottom evidence',
        slot: 'bottom',
        time: now,
      });
      return {
        ...current,
        color: applyStabilizedColor(prev, current, log, now, 'bottom') || current.color,
        stability: Math.max(0.4, prev.stability * 0.55),
        lastChangedAt: now,
        lastSeenAt: now,
      };
    }
    if (beliefBboxIou(prev.bbox, current.bbox) >= DRESS_PERSIST_IOU) {
      appendDecision(log, {
        type: 'reject',
        message: `Kept dress over ${current.kind}`,
        reason: 'dress persistence IoU lock',
        slot: 'bottom',
        time: now,
      });
      return {
        ...prev,
        lastSeenAt: now,
        confidence: Math.min(1, prev.confidence + 0.03),
        stability: Math.min(1, prev.stability + 0.08),
        bbox: current.bbox,
        color: applyStabilizedColor(prev, current, log, now, 'bottom'),
      };
    }
  }

  // Strong dress evidence may correct a trousers misread (geometry or overlap).
  if (isBottomLikeKind(prev.kind) && current.kind === 'dress') {
    const iou = beliefBboxIou(prev.bbox, current.bbox);
    if (iou >= DRESS_PERSIST_IOU || looksLikeDress(current.bbox)) {
      appendDecision(log, {
        type: 'update',
        message: `${prev.kind} → dress`,
        reason: iou >= DRESS_PERSIST_IOU ? 'dress IoU override' : 'dress geometry override',
        slot: 'bottom',
        time: now,
      });
      return {
        ...current,
        color: applyStabilizedColor(prev, current, log, now, 'bottom') || current.color,
        stability: Math.max(0.5, prev.stability * 0.7),
        lastChangedAt: now,
        lastSeenAt: now,
      };
    }
  }

  // Outerwear wins over generic top in the same upper slot when boxes overlap.
  if (prev.kind === 'top' && current.kind === 'outerwear') {
    appendDecision(log, {
      type: 'update',
      message: 'top → outerwear',
      reason: 'outerwear priority',
      slot: 'top',
      time: now,
    });
    return {
      ...current,
      color: current.color,
      stability: Math.max(0.45, prev.stability * 0.6),
      lastChangedAt: now,
      lastSeenAt: now,
    };
  }
  if (prev.kind === 'outerwear' && current.kind === 'top') {
    if (beliefBboxIou(prev.bbox, current.bbox) >= 0.35 || current.confidence < BELIEF_SWITCH_CONF) {
      appendDecision(log, {
        type: 'reject',
        message: 'Kept outerwear over top',
        reason: 'outerwear resists generic top',
        slot: 'top',
        time: now,
      });
      return {
        ...prev,
        lastSeenAt: now,
        confidence: Math.min(1, prev.confidence + 0.02),
        bbox: current.confidence >= prev.confidence ? current.bbox : prev.bbox,
        color: applyStabilizedColor(prev, current, log, now, 'top'),
      };
    }
  }

  // Locked trousers: only hold against shorts when this still looks like a pant column
  // Trust Vision First: sweatpants/joggers never demote via geometry.
  if (prev.kind === 'trousers' && current.kind === 'shorts') {
    const resistDet = {
      name: prev.name || current.name || '',
      category: prev.category,
      subcategory: prev.subcategory,
      confidence: Math.max(prev.confidence, current.confidence),
    };
    if (resistsShortsGeometryDemotion(resistDet)) {
      appendDecision(log, {
        type: 'reject',
        message: 'Blocked shorts downgrade',
        reason: 'vision sweatpants/joggers lock',
        slot: 'bottom',
        time: now,
      });
      return {
        ...prev,
        name: preferVisionIdentityName(prev.name) || preferVisionIdentityName(current.name) || prev.name,
        lastSeenAt: now,
        confidence: Math.min(1, prev.confidence + 0.02),
        bbox: current.confidence >= prev.confidence ? current.bbox : prev.bbox,
        color: applyStabilizedColor(prev, current, log, now, 'bottom'),
      };
    }
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
        name: preferVisionIdentityName(current.name) || current.name,
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
      name: preferVisionIdentityName(prev.name) || prev.name,
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
    && current.confidence >= 0.68
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
    // Fast override: strong new evidence beats a soft lock (confidence +0.2)
    if (current.confidence < prev.confidence + 0.2) {
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
    // Never demote vision sweatpants/joggers/chinos via geometry.
    if (
      p.kind === 'trousers'
      && !resistsShortsGeometryDemotion({
        name: `${p.name || ''} ${c.name || ''}`,
        category: p.category,
        subcategory: p.subcategory,
        confidence: Math.max(p.confidence, c.confidence),
      })
      && !/sweatpant|jogger|chino|jean|slacks/i.test(`${p.name || ''} ${c.name || ''}`)
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
        name: preferVisionIdentityName(c.name) || c.name,
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
      name: preferVisionIdentityName(p.name)
        || preferVisionIdentityName(c.name)
        || ((color === p.color)
          ? (p.name || c.name || null)
          : (isSpecificVisionName(c.name) ? c.name : (p.name || c.name || null))),
      lastSeenAt: now,
    };
  }

  return resolveConflict(p, c, now, log);
}

export function beliefToDetection(belief: GarmentBelief): OnDeviceDetection {
  // Prefer stored vision name — never rebuild "Gray Sweatpants" into "Dark trousers"
  const preserved = isSpecificVisionName(belief.name) ? String(belief.name).trim() : null;
  const name = preserved
    || (belief.kind === 'shoes' || String(belief.category).toLowerCase() === 'shoes'
      ? buildFootwearDisplayLabel({
        type: belief.subcategory,
        color: belief.color,
        fallbackName: belief.subcategory === 'boat_shoes' ? 'Boat shoes' : null,
      })
      : formatGarmentDisplayName({
        color: belief.color,
        category: belief.category,
        subcategory: belief.subcategory,
        fallbackName: belief.name,
      }));
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
  opts?: {
    now?: number;
    decisions?: BeliefDecision[];
    /** Barefoot veto — clear footwear inside belief (single mutation owner). */
    clearFootwear?: boolean;
  },
): {
  state: OutfitBeliefState;
  detections: OnDeviceDetection[];
  repairs: string[];
  decisions: BeliefDecision[];
} {
  const now = opts?.now ?? Date.now();
  const repairs: string[] = [];
  const decisions = opts?.decisions || [];

  const topsRaw = detections.filter((d) => {
    const k = beliefKindFromDetection(d);
    return k === 'top' || k === 'outerwear';
  });
  const tops = topsRaw.filter((d) => !isBareTorsoTopLike({
    category: d.category,
    subcategory: d.subcategory,
    name: d.name,
    skinRatio: d.skinRatio,
    fabricColor: d.color,
  }));
  const bottoms = detections.filter((d) => {
    const k = beliefKindFromDetection(d);
    return k === 'shorts' || k === 'trousers' || k === 'skirt' || k === 'dress';
  });
  const shoes = detections.filter((d) => beliefKindFromDetection(d) === 'shoes');

  const torsoState = detectTorsoState({
    topDetections: topsRaw,
    hasFabricTop: tops.some((d) => hasReliableFabricColor(d.color)),
  });

  // Bare torso: never feed a top observation (even a "held" one cannot reinforce)
  // When tee + shirt/jacket both fire, keep both (base + layer).
  const split = torsoState === 'bare' ? { base: null, layer: null } : splitUpperDetections(tops);
  // Jacket alone → top slot. Tee + jacket → top=tee, layer=jacket.
  const resolvedTopObs = split.base || split.layer;
  const layerObs = split.base && split.layer ? split.layer : null;
  const hasShirtTop = Boolean(
    (resolvedTopObs && beliefKindFromDetection(resolvedTopObs) === 'top')
    || state.top?.kind === 'top',
  );
  const nonDressBottoms = bottoms.filter((d) => beliefKindFromDetection(d) !== 'dress');
  let bottomObs = bottoms.sort((a, b) => {
    const aDress = beliefKindFromDetection(a) === 'dress' ? 1 : 0;
    const bDress = beliefKindFromDetection(b) === 'dress' ? 1 : 0;
    // Shirt/top visible → prefer trousers/shorts over a false one-piece dress lock
    if (hasShirtTop && aDress !== bDress) return aDress - bDress;
    if (!hasShirtTop && aDress !== bDress) return bDress - aDress;
    return b.confidence - a.confidence;
  })[0] || null;

  // Contradiction: dress-shirt misread as dress must yield when top + bottom both fire
  if (
    hasShirtTop
    && nonDressBottoms.length
    && bottomObs
    && beliefKindFromDetection(bottomObs) === 'dress'
  ) {
    bottomObs = nonDressBottoms.sort((a, b) => b.confidence - a.confidence)[0] || bottomObs;
    repairs.push('dress_contradicted_by_top+bottom');
    appendDecision(decisions, {
      type: 'update',
      message: 'Cleared false dress',
      reason: 'top + bottom contradict one-piece dress',
      slot: 'bottom',
      time: now,
    });
  }
  // Locked dress + new top/trousers this frame → force trousers into the slot (fast unwind)
  if (
    state.bottom?.kind === 'dress'
    && hasShirtTop
    && nonDressBottoms.length
  ) {
    const preferred = nonDressBottoms.sort((a, b) => b.confidence - a.confidence)[0];
    if (preferred) {
      bottomObs = preferred;
      repairs.push('dress_soft_unlock→bottom');
    }
  }

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
        name: preferVisionIdentityName(bottomObs.name)
          || formatGarmentDisplayName({
            color: bottomObs.color,
            category: 'bottoms',
            subcategory: 'trousers',
            fallbackName: bottomObs.name,
          }),
      };
    }
  }
  // False trousers from shorts+socks/boots → shorts
  // Trust Vision First: never demote sweatpants/joggers/chinos via geometry.
  if (
    bottomObs
    && /trouser|pant|jean|chino/i.test(`${bottomObs.subcategory} ${bottomObs.name}`)
    && !resistsShortsGeometryDemotion(bottomObs)
  ) {
    if (looksLikeShortsWithFootwearExtension(bottomObs.bbox as BBoxTuple)) {
      bottomObs = {
        ...bottomObs,
        subcategory: 'shorts',
        name: preferVisionIdentityName(bottomObs.name)
          || formatGarmentDisplayName({
            color: bottomObs.color,
            category: 'bottoms',
            subcategory: 'shorts',
            fallbackName: bottomObs.name,
          }),
      };
    }
  }

  // Weak / barefoot shoes never enter belief — fabric-coloured / labeled shoes may
  if (shoeObs) {
    const skin = shoeObs.skinRatio;
    const fabricOk = hasReliableFabricColor(shoeObs.color);
    const labeled = /shoe|boot|sneaker|trainer|loafer|sandal|boat|deck|footwear/i.test(
      `${shoeObs.category || ''} ${shoeObs.subcategory || ''} ${shoeObs.name || ''}`,
    );
    const skinOk = skin != null && skin < 0.22;
    const confMin = fabricOk || labeled ? 0.52 : 0.75;
    if ((!skinOk && !fabricOk && !labeled) || shoeObs.confidence < confMin) {
      shoeObs = null;
    }
  }

  const prevTopKind = state.top?.kind;
  const prevBottomKind = state.bottom?.kind;
  const prevTopColor = state.top?.color;
  const prevBottomColor = state.bottom?.color;
  const prevShoeSub = state.footwear?.subcategory;

  // Structural override: bare torso DESTROYS top + layer belief (not TTL hold)
  let top: GarmentBelief | null = null;
  let layer: GarmentBelief | null = null;
  if (torsoState === 'bare') {
    if (state.top || state.layer) {
      repairs.push('cleared_bare_torso_top');
      appendDecision(decisions, {
        type: 'update',
        message: 'Cleared top/layer',
        reason: 'torsoState=bare',
        slot: 'top',
        time: now,
      });
    }
  } else {
    top = updateBelief(
      state.top,
      resolvedTopObs ? observationFromDetection(resolvedTopObs, now, decisions) : null,
      now,
      decisions,
    );
    layer = updateBelief(
      state.layer ?? null,
      layerObs ? observationFromDetection(layerObs, now, decisions) : null,
      now,
      decisions,
    );
  }
  const bottom = updateBelief(
    state.bottom,
    bottomObs ? observationFromDetection(bottomObs, now, decisions) : null,
    now,
    decisions,
  );
  // Hard unlock: top + separate bottom contradict a one-piece dress lock (IoU persistence loses)
  let bottomFinal = bottom;
  if (
    state.bottom?.kind === 'dress'
    && bottom?.kind === 'dress'
    && hasShirtTop
    && bottomObs
    && beliefKindFromDetection(bottomObs) !== 'dress'
  ) {
    bottomFinal = observationFromDetection(bottomObs, now, decisions);
    repairs.push('dress_hard_unlock→bottom');
    appendDecision(decisions, {
      type: 'update',
      message: `dress → ${bottomFinal.kind}`,
      reason: 'hard unlock — top + bottom contradict dress',
      slot: 'bottom',
      time: now,
    });
  }
  // Barefoot veto clears footwear here — not in detection memory.
  let footwear: GarmentBelief | null = null;
  if (opts?.clearFootwear) {
    if (state.footwear) {
      repairs.push('cleared_barefoot_footwear');
      appendDecision(decisions, {
        type: 'reject',
        message: 'Footwear cleared',
        reason: 'barefoot detected (high confidence veto)',
        slot: 'footwear',
        time: now,
      });
    }
  } else {
    footwear = updateBelief(
      state.footwear,
      shoeObs ? observationFromDetection(shoeObs, now, decisions) : null,
      now,
      decisions,
    );

    // Subtype lock — single owner (footwear gate proposes; belief locks).
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
  }

  if (prevTopKind && top && prevTopKind !== top.kind) repairs.push(`belief_top→${top.kind}`);
  if (prevBottomKind && bottomFinal && prevBottomKind !== bottomFinal.kind) {
    repairs.push(`belief_bottom→${bottomFinal.kind}`);
  }
  if (prevTopColor && top?.color && prevTopColor !== top.color) {
    repairs.push(`belief_top_color→${top.color}`);
  }
  if (prevBottomColor && bottomFinal?.color && prevBottomColor !== bottomFinal.color) {
    repairs.push(`belief_bottom_color→${bottomFinal.color}`);
  }
  if (state.top && !resolvedTopObs && top) repairs.push('belief_top_held');
  if (state.layer && !layerObs && layer) repairs.push('belief_layer_held');
  if (state.bottom && !bottomObs && bottomFinal) repairs.push('belief_bottom_held');
  if (state.footwear && !shoeObs && footwear) repairs.push('belief_footwear_held');
  if (prevShoeSub && footwear?.subcategory && prevShoeSub !== footwear.subcategory) {
    repairs.push(`belief_footwear→${footwear.subcategory}`);
  }

  const next: OutfitBeliefState = { top, layer, bottom: bottomFinal, footwear, torsoState };
  const out: OnDeviceDetection[] = [];
  if (top) out.push(beliefToDetection(top));
  if (layer) out.push(beliefToDetection(layer));
  if (bottomFinal) out.push(beliefToDetection(bottomFinal));
  if (footwear) out.push(beliefToDetection(footwear));

  return { state: next, detections: out, repairs, decisions };
}
