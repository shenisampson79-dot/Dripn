/**
 * Style Coherence Engine — hard lane / footwear / tailoring scoring authority.
 * Stylist judgement layers, not soft fluff. Mirrors server styleCoherenceEngine.js.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  classifyItem,
  isBlazerItem,
  type ItemSignals,
} from '@/utils/outfitClashRules';
import {
  isChunkyOrTechTrainer,
  isFashionTrainer,
} from '@/utils/outfitRegionalContext';
import { classifyGarment, coherenceLaneFromDb } from '@/utils/garmentTaxonomy';

export type StyleLane = 'tailored' | 'casual' | 'athleisure' | 'street';

export type FootwearClass =
  | 'dress'
  | 'minimal_sneaker'
  | 'chunky_sneaker'
  | 'runner'
  | 'combat_boots'
  | 'slides'
  | 'other'
  | null;

export type DetectedSignals = {
  laneConflict: boolean;
  multiLaneChaos: boolean;
  footwearMismatch: boolean;
  footwearLaneMismatch?: boolean;
  colorClash?: boolean;
  overdressedPiece?: string | null;
  underdressedPiece?: string | null;
  /** Distinct style lanes present in the outfit. */
  lanesPresent: StyleLane[];
  footwearClass: FootwearClass;
  tailoringClash: boolean;
  invalidTwoLaneMix: boolean;
  /** Soft Outfit Intent name (why worn) — never a hard clash. */
  intent?: string | null;
  intentLabel?: string | null;
};

export type CoherenceBreakdown = {
  /** Absolute score when hard coherence fails; otherwise soft adjustment (-N..+N). */
  mode: 'hard_cap' | 'adjust';
  scoreImpact: number;
  hardCap: number | null;
  footwearScore: number;
  tailoringClash: boolean;
  signals: DetectedSignals;
  hint: string | null;
  clashId: string | null;
  severity: 'fatal' | 'major' | 'moderate' | 'minor' | null;
};

type ItemLike = {
  id?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  color?: string;
};

function itemText(item: ItemLike): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

/** Map a wardrobe piece onto one of four style lanes. */
export function getStyleLane(item: ItemLike, signals?: ItemSignals): StyleLane {
  const sig = signals || classifyItem(item as WardrobeItem);
  const t = itemText(item);
  const cat = String(item.category || '').toLowerCase();

  if (sig.garmentLane && (sig.garmentConfidence || 0) >= 0.7) {
    const mapped = coherenceLaneFromDb(sig.garmentLane);
    if (mapped) return mapped as StyleLane;
  }
  const garment = classifyGarment(item);
  if (!garment.coarseOnly && garment.lane && garment.confidence >= 0.7) {
    const mapped = coherenceLaneFromDb(garment.lane);
    if (mapped) return mapped as StyleLane;
  }

  // Footwear lanes first — shoes often define the street/athleisure pull
  if (cat === 'shoes') {
    if (sig.isFormalShoes || sig.isHeels || sig.isDressyBoots) return 'tailored';
    if (isRunnerFootwear(item) || (sig.isChunkyOrTechTrainer && /running|gym|training|hoka|pegasus|ultraboost/.test(t))) {
      return 'athleisure';
    }
    if (sig.isChunkyOrTechTrainer || /chunky|dad shoe|bulky|platform sneaker/.test(t)) {
      return 'street';
    }
    if (sig.isCasualTrainer || sig.isFashionTrainer || sig.isAthleticShoes) return 'casual';
    if (sig.isUggs) return 'casual';
    return 'casual';
  }

  if (sig.isBlazer || sig.isSuitPiece || sig.isTie || sig.isFormalAccessory || sig.isEveningWear || sig.isGown) {
    return 'tailored';
  }
  if (sig.isDressShirt || sig.isStructuredShirt) return 'tailored';
  if (sig.isAthleticTop || sig.isAthleticBottom || sig.isJoggers || sig.isLoungeBottom) {
    return 'athleisure';
  }
  if (cat === 'activewear_tops' || cat === 'activewear_bottoms' || cat === 'activewear') {
    return 'athleisure';
  }
  if (sig.isHoodie || /cargo|oversized|graphic tee|hype|skate|y2k|baggy|street/.test(t)) {
    return 'street';
  }
  if (cat === 'formal') return 'tailored';
  if (/chino|trouser|slack|khaki|loafer|oxford|dress pant/.test(t) && !sig.isJoggers) {
    // Chinos alone are casual bridge — not full tailored unless paired language is suit-level
    if (/suit|tailored trouser|dress trouser|dress pant/.test(t)) return 'tailored';
    return 'casual';
  }
  return 'casual';
}

export function classifyFootwear(item: ItemLike | null | undefined): FootwearClass {
  if (!item || String(item.category || '').toLowerCase() !== 'shoes') return null;
  const sig = classifyItem(item as WardrobeItem);
  const garment = classifyGarment(item);
  const subtype = garment.subtype || sig.subtype;
  const t = itemText(item);

  if (['oxfords', 'derby', 'loafers', 'heels', 'stilettos', 'block_heels', 'statement_heels', 'chelsea_boots'].includes(subtype || '')
    || sig.isFormalShoes || sig.isHeels || sig.isDressyBoots || sig.isChelseaBoots) {
    return 'dress';
  }
  if (subtype === 'slides' || subtype === 'leather_sandals' || subtype === 'espadrilles'
    || /sandal|slide|flip.?flop|pool slide|espadrille/.test(t)) {
    return subtype === 'slides' ? 'slides' : 'other';
  }
  if (subtype === 'runner' || isRunnerFootwear(item)) return 'runner';
  if (subtype === 'chunky_trainer' || subtype === 'combat_boots'
    || sig.isChunkyOrTechTrainer || isChunkyOrTechTrainer(item)) {
    return subtype === 'combat_boots' ? 'combat_boots' : 'chunky_sneaker';
  }
  if (subtype === 'minimal_sneaker' || sig.isFashionTrainer || isFashionTrainer(item)
    || /minimal|plain white|clean white|lifestyle|samba|gazelle|stan smith|air force|af1|common projects/.test(t)) {
    return 'minimal_sneaker';
  }
  if (sig.isCasualTrainer) return 'minimal_sneaker';
  if (sig.isAthleticShoes && /\b(trainers?|sneakers?)\b/.test(t)) return 'minimal_sneaker';
  return 'other';
}

function isRunnerFootwear(item: ItemLike): boolean {
  const t = itemText(item);
  if (String(item.category || '').toLowerCase() !== 'shoes') return false;
  return /runner|running shoe|pegasus|zoomx|vaporfly|alpha.?fly|hoka|ultraboost|fresh foam|gel-?kayano|nimbus|vomero|invincible|cloudmonster|gym shoe|training shoe|cross.?train/.test(t)
    || (/running|gym|training|performance/.test(t) && /\b(trainers?|sneakers?|shoes?)\b/.test(t));
}

const ALLOWED_TWO_LANE = new Set([
  'tailored+casual',
  'casual+tailored',
  'street+casual',
  'casual+street',
  // Same-family soft pairs that shouldn't hard-fail
  'athleisure+street',
  'street+athleisure',
]);

function twoLaneKey(a: StyleLane, b: StyleLane): string {
  return `${a}+${b}`;
}

function isInvalidTwoLane(lanes: StyleLane[]): boolean {
  if (lanes.length !== 2) return false;
  const [a, b] = lanes;
  if (ALLOWED_TWO_LANE.has(twoLaneKey(a, b))) return false;
  // tailored + athleisure is the classic hard fail
  if ((a === 'tailored' && b === 'athleisure') || (a === 'athleisure' && b === 'tailored')) {
    return true;
  }
  // tailored + street without casual bridge is harsh (chunky under blazer)
  if ((a === 'tailored' && b === 'street') || (a === 'street' && b === 'tailored')) {
    return true;
  }
  return false;
}

function hasSmartCasualBottoms(items: ItemLike[], signals: ItemSignals[]): boolean {
  return items.some((item, i) => {
    const cat = String(item.category || '').toLowerCase();
    if (cat !== 'bottoms' && cat !== 'formal') return false;
    const sig = signals[i];
    if (sig.isJoggers || sig.isAthleticBottom || sig.isLoungeBottom || sig.isShorts) return false;
    const t = itemText(item);
    return /chino|khaki|trouser|slack|jean|denim|skirt|dress pant|suit pant/.test(t) || sig.isJeans || sig.isSuitPiece;
  });
}

/** Blazer + hoodie + denim + non-chunky trainers — accepted streetwear (do not multi-lane nuke). */
function isAcceptedStreetwearLayering(items: ItemLike[], signals: ItemSignals[], footwearClass: FootwearClass): boolean {
  const hasBlazer = signals.some((s) => s.isBlazer) || items.some((i) => isBlazerItem(i as WardrobeItem));
  const hasHoodie = signals.some((s) => s.isHoodie);
  const hasJeans = signals.some((s) => s.isJeans);
  const hasTrainer = footwearClass === 'minimal_sneaker'
    || items.some((i) => String(i.category || '').toLowerCase() === 'shoes' && /\b(sneakers?|trainers?)\b/.test(itemText(i)));
  if (footwearClass === 'chunky_sneaker' || footwearClass === 'runner') return false;
  return hasBlazer && hasHoodie && hasJeans && hasTrainer;
}

/**
 * Core coherence evaluation. Hard caps on chaos / invalid mixes / tailoring kills.
 */
export function evaluateStyleCoherence(items: ItemLike[]): CoherenceBreakdown {
  const emptySignals: DetectedSignals = {
    laneConflict: false,
    multiLaneChaos: false,
    footwearMismatch: false,
    footwearLaneMismatch: false,
    colorClash: false,
    overdressedPiece: null,
    underdressedPiece: null,
    lanesPresent: [],
    footwearClass: null,
    tailoringClash: false,
    invalidTwoLaneMix: false,
  };

  if (!items || items.length < 2) {
    return {
      mode: 'adjust',
      scoreImpact: 0,
      hardCap: null,
      footwearScore: 0,
      tailoringClash: false,
      signals: emptySignals,
      hint: null,
      clashId: null,
      severity: null,
    };
  }

  const signals = items.map((item) => classifyItem(item as WardrobeItem));
  const lanes = items.map((item, i) => getStyleLane(item, signals[i]));
  const uniqueLanes = [...new Set(lanes)] as StyleLane[];

  const shoeIdx = items.findIndex((i) => String(i.category || '').toLowerCase() === 'shoes');
  const footwearClass = shoeIdx >= 0 ? classifyFootwear(items[shoeIdx]) : null;

  const hasBlazer = signals.some((s) => s.isBlazer) || items.some((i) => isBlazerItem(i as WardrobeItem));
  const hasAthleisureBottom = signals.some((s) => s.isJoggers || s.isAthleticBottom || s.isLoungeBottom);
  const hasTrackOrJogger = signals.some((s) => s.isJoggers)
    || items.some((i) => /track ?pant|tracksuit|track suit|jogger|sweatpant|sweat pant/.test(itemText(i)));

  // Multi-lane chaos: tailored colliding with 2+ other lanes (blazer + track + chunky),
  // or all four lanes. Athleisure+street+casual stacks stay valid street/athleisure uniforms.
  // Accepted blazer+hoodie+jeans streetwear is NOT chaos.
  let multiLaneChaos = (uniqueLanes.length >= 3 && uniqueLanes.includes('tailored'))
    || uniqueLanes.length >= 4;
  if (multiLaneChaos && isAcceptedStreetwearLayering(items, signals, footwearClass)) {
    multiLaneChaos = false;
  }
  let invalidTwoLaneMix = isInvalidTwoLane(uniqueLanes);
  // Blazer + street hoodie with denim bridge is intentional — not invalid tailored+street
  if (invalidTwoLaneMix && isAcceptedStreetwearLayering(items, signals, footwearClass)) {
    invalidTwoLaneMix = false;
  }
  const laneConflict = multiLaneChaos || invalidTwoLaneMix;

  // Tailoring kill: blazer + joggers/tracksuit
  const tailoringClash = hasBlazer && (hasAthleisureBottom || hasTrackOrJogger);

  // Footwear mismatch vs blazer / tailored lane
  const hasTailoredLane = uniqueLanes.includes('tailored') || hasBlazer;
  const smartBottoms = hasSmartCasualBottoms(items, signals);
  const hasShorts = signals.some((s) => s.isShorts);
  let footwearMismatch = false;
  let footwearScore = 0; // contribution when good; negative when bad
  let footwearLaneMismatch = false;

  if (hasTailoredLane && (footwearClass === 'chunky_sneaker' || footwearClass === 'runner' || footwearClass === 'combat_boots' || footwearClass === 'slides')) {
    footwearMismatch = true;
    footwearLaneMismatch = true;
    footwearScore = footwearClass === 'slides' ? -30 : -28;
  } else if (hasBlazer && footwearClass === 'minimal_sneaker' && smartBottoms && !hasAthleisureBottom && !hasShorts) {
    // Blazer + khaki + white minimal — intentional smart casual (modest bonus; avoid double-dip)
    footwearMismatch = false;
    footwearScore = 3;
  } else if (hasBlazer && footwearClass === 'dress') {
    footwearMismatch = false;
    footwearScore = 6;
  } else if (uniqueLanes.includes('athleisure') && footwearClass === 'dress') {
    footwearMismatch = true;
    footwearScore = -22;
  } else if (footwearClass === 'dress') {
    footwearScore = 3;
  } else if (footwearClass === 'minimal_sneaker' && !hasShorts) {
    footwearScore = 1;
  }

  // Identify over/under-dressed piece ids for voice engine
  let overdressedPiece: string | null = null;
  let underdressedPiece: string | null = null;
  if (hasBlazer && (footwearMismatch || hasAthleisureBottom)) {
    const blazerItem = items.find((i, idx) => signals[idx].isBlazer || isBlazerItem(i as WardrobeItem));
    overdressedPiece = blazerItem?.id ? String(blazerItem.id) : null;
    if (footwearMismatch && shoeIdx >= 0) {
      underdressedPiece = items[shoeIdx]?.id ? String(items[shoeIdx].id) : null;
    } else if (hasAthleisureBottom) {
      const bottom = items.find((i, idx) => {
        const cat = String(i.category || '').toLowerCase();
        return (cat === 'bottoms' || cat === 'activewear_bottoms')
          && (signals[idx].isJoggers || signals[idx].isAthleticBottom || signals[idx].isLoungeBottom);
      });
      underdressedPiece = bottom?.id ? String(bottom.id) : null;
    }
  }

  // Soft colour clash signal (optional) — 4+ distinct named colours
  const colors = new Set(
    items.map((i) => String(i.color || '').toLowerCase().trim()).filter((c) => c && c !== 'unknown'),
  );
  const colorClash = colors.size >= 4;

  const detected: DetectedSignals = {
    laneConflict,
    multiLaneChaos,
    footwearMismatch,
    footwearLaneMismatch,
    colorClash,
    overdressedPiece,
    underdressedPiece,
    lanesPresent: uniqueLanes,
    footwearClass,
    tailoringClash,
    invalidTwoLaneMix,
  };

  // ── Hard outcomes ──────────────────────────────────────────────────────
  // Multi-lane chaos (≥3): nuke
  if (multiLaneChaos) {
    const cap = tailoringClash && footwearMismatch ? 32 : 38;
    return {
      mode: 'hard_cap',
      scoreImpact: cap,
      hardCap: cap,
      footwearScore,
      tailoringClash,
      signals: detected,
      hint: 'This look pulls three style lanes at once — pick one story and rebuild around it',
      clashId: 'coherence_multi_lane_chaos',
      severity: 'major',
    };
  }

  // Blazer + track/joggers: hard kill (≤55, usually much lower with footwear)
  if (tailoringClash) {
    const cap = footwearMismatch ? 28 : 42;
    return {
      mode: 'hard_cap',
      scoreImpact: cap,
      hardCap: cap,
      footwearScore,
      tailoringClash: true,
      signals: detected,
      hint: 'Joggers or tracksuit bottoms with a blazer — athleisure and tailoring clash',
      clashId: 'coherence_tailoring_clash',
      severity: 'major',
    };
  }

  // Invalid 2-lane (tailored+athleisure / tailored+street)
  if (invalidTwoLaneMix) {
    const cap = footwearMismatch ? 34 : 48;
    const pair = uniqueLanes.join(' + ');
    return {
      mode: 'hard_cap',
      scoreImpact: cap,
      hardCap: cap,
      footwearScore,
      tailoringClash: false,
      signals: detected,
      hint: `Invalid mix (${pair}) — keep tailored with casual, or street with casual`,
      clashId: 'coherence_invalid_two_lane',
      severity: 'major',
    };
  }

  // Footwear-only hard fail under blazer (chunky/runner/combat/slides) even if bottoms are smart
  if (hasBlazer && footwearMismatch) {
    const shoeHint = footwearClass === 'runner'
      ? 'Running shoes fight a blazer — swap to plain lifestyle sneakers or dress shoes'
      : footwearClass === 'slides'
        ? 'Slides collapse tailored formality — swap to loafers or minimal sneakers'
        : footwearClass === 'combat_boots'
          ? 'Combat boots pull this out of tailoring — try Chelsea boots or drop the blazer'
          : 'Chunky trainers pull this out of tailoring';
    return {
      mode: 'hard_cap',
      scoreImpact: 36,
      hardCap: 36,
      footwearScore,
      tailoringClash: false,
      signals: detected,
      hint: shoeHint,
      clashId: footwearLaneMismatch ? 'footwear_lane_mismatch' : 'coherence_footwear_mismatch',
      severity: 'major',
    };
  }

  // Soft adjust path — modest rewards only when footwear finishes intentionally
  let adjust = footwearScore;
  if (footwearClass === 'dress' || footwearClass === 'minimal_sneaker') {
    if (uniqueLanes.length === 1) adjust += 3;
    else if (
      uniqueLanes.length === 2
      && ALLOWED_TWO_LANE.has(twoLaneKey(uniqueLanes[0], uniqueLanes[1]))
    ) {
      adjust += 2;
    }
  }
  if (colorClash) adjust -= 4;
  // Dress shirt / tailored lane with shorts — soft friction (not major unless blazer)
  if (hasShorts && uniqueLanes.includes('tailored') && !hasBlazer) {
    adjust -= 14;
  }

  // Cap soft upside so coherence doesn't flatten score diversity
  adjust = Math.max(-30, Math.min(6, adjust));

  return {
    mode: 'adjust',
    scoreImpact: adjust,
    hardCap: null,
    footwearScore,
    tailoringClash: false,
    signals: detected,
    hint: null,
    clashId: null,
    severity: null,
  };
}

/** Compact signals for API / GPT payloads. */
export function serializeDetectedSignals(signals: DetectedSignals): Record<string, unknown> {
  return {
    laneConflict: signals.laneConflict,
    multiLaneChaos: signals.multiLaneChaos,
    footwearMismatch: signals.footwearMismatch,
    footwearLaneMismatch: Boolean(signals.footwearLaneMismatch),
    colorClash: Boolean(signals.colorClash),
    overdressedPiece: signals.overdressedPiece || null,
    underdressedPiece: signals.underdressedPiece || null,
    lanesPresent: signals.lanesPresent,
    footwearClass: signals.footwearClass,
    tailoringClash: signals.tailoringClash,
    invalidTwoLaneMix: signals.invalidTwoLaneMix,
    intent: signals.intent || null,
    intentLabel: signals.intentLabel || null,
  };
}
