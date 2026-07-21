import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { classifyItemFromDataset } from '@/utils/outfitStyleTagMatcher';

/** Non-overlapping style worlds — outfits should commit to one primary lane. */
export type StyleArchetype =
  | 'athleisure'
  | 'streetwear'
  | 'smart_casual'
  | 'classic_tailoring'
  | 'minimalist'
  | 'luxury_casual'
  | 'edgy_fashion'
  | 'formal';

export type OutfitAestheticAnalysis = {
  primaryStyle: StyleArchetype | null;
  styleScores: Partial<Record<StyleArchetype, number>>;
  confidence: number;
  purity: number;
  aestheticConflict: boolean;
  conflictReason: string | null;
  conflictingStyles: [StyleArchetype, StyleArchetype] | null;
  unclearIdentity: boolean;
  footwearBreaksIntent: boolean;
  coherentAthleisureUniform: boolean;
};

export type AestheticRejection = {
  rejected: true;
  scoreCap: number;
  hint: string;
  clashId: string;
  severity: 'fatal' | 'major';
  analysis: OutfitAestheticAnalysis;
};

type ItemLike = Pick<WardrobeItem, 'name' | 'category' | 'subcategory' | 'color'>;

const STYLE_ARCHETYPES: StyleArchetype[] = [
  'athleisure',
  'streetwear',
  'smart_casual',
  'classic_tailoring',
  'minimalist',
  'luxury_casual',
  'edgy_fashion',
  'formal',
];

/** How far apart two style worlds are (3 = never mix). */
const AESTHETIC_DISTANCE: Partial<Record<StyleArchetype, Partial<Record<StyleArchetype, number>>>> = {
  athleisure: {
    classic_tailoring: 3,
    formal: 3,
    luxury_casual: 2,
    smart_casual: 2,
    edgy_fashion: 1,
  },
  streetwear: {
    classic_tailoring: 2,
    formal: 3,
    luxury_casual: 1,
  },
  classic_tailoring: {
    athleisure: 3,
    streetwear: 2,
    edgy_fashion: 2,
  },
  formal: {
    athleisure: 3,
    streetwear: 3,
    edgy_fashion: 2,
  },
  smart_casual: {
    athleisure: 2,
    formal: 2,
  },
};

const STYLE_CLUSTERS: StyleArchetype[][] = [
  ['classic_tailoring', 'smart_casual', 'luxury_casual', 'formal', 'minimalist'],
  ['athleisure', 'streetwear'],
  ['edgy_fashion'],
];

function stylesShareCluster(a: StyleArchetype, b: StyleArchetype): boolean {
  return STYLE_CLUSTERS.some((cluster) => cluster.includes(a) && cluster.includes(b));
}

function dominantCluster(styles: StyleArchetype[]): boolean {
  if (styles.length <= 1) return true;
  const first = styles[0];
  return styles.every((s) => stylesShareCluster(first, s));
}

const CATEGORY_WEIGHT: Record<string, number> = {
  shoes: 3,
  outerwear: 2,
  tops: 2,
  activewear_tops: 2,
  bottoms: 2,
  activewear_bottoms: 2,
  dresses: 2,
  formal: 2,
  accessories: 1,
  bags: 1,
};

function itemText(item: ItemLike): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function itemWeight(item: ItemLike): number {
  const cat = String(item.category || '').toLowerCase();
  return CATEGORY_WEIGHT[cat] ?? 1.5;
}

/** Tag each item with weighted style signals. Dataset first, regex fallback. Shoes dominate. */
export function classifyItemAesthetics(item: ItemLike): Partial<Record<StyleArchetype, number>> {
  const t = itemText(item);
  const cat = String(item.category || '').toLowerCase();
  const w = itemWeight(item);

  const datasetTags = classifyItemFromDataset(t, cat, w);
  if (datasetTags && Object.keys(datasetTags).length > 0) {
    return datasetTags;
  }

  const tags: Partial<Record<StyleArchetype, number>> = {};

  const add = (style: StyleArchetype, amount = w) => {
    tags[style] = (tags[style] || 0) + amount;
  };

  if (
    cat === 'activewear_tops' || cat === 'activewear_bottoms' || cat === 'activewear'
    || /\b(joggers?|sweatpants?|sweats|track pants?|leggings?|gym|training|running|performance|sports bra|athletic)\b/.test(t)
  ) {
    add('athleisure', w * 1.2);
  }

  if (
    /\b(oversized|graphic tee|cargo|street|hype|skate|y2k|baggy)\b/.test(t)
    || (cat === 'tops' && /hoodie/.test(t))
  ) {
    add('streetwear');
  }

  if (
    /\b(blazers?|suits?|dress shirts?|oxford shirts?|tailored|trousers?|chinos?|loafers?|chelseas?|derbies?|brogues?)\b/.test(t)
    || cat === 'formal'
  ) {
    add('classic_tailoring');
    if (/\b(chelseas?|loafers?|blazers?|chinos?)\b/.test(t)) add('smart_casual', w * 0.6);
  }

  if (/\b(chelsea boots?|leather boots?|dress boots?|ankle boots?|chelseas?)\b/.test(t) && cat === 'shoes') {
    add('classic_tailoring', w * 1.1);
    add('smart_casual', w * 0.5);
    add('luxury_casual', w * 0.4);
  }

  if (/\b(oxfords?|derbies?|brogues?|dress shoes?|heels?|pumps?|stilettos?)\b/.test(t) && cat === 'shoes') {
    add('classic_tailoring', w * 1.2);
    add('formal', w * 0.8);
  }

  const isAthleticFootwear = cat === 'shoes'
    && /\b(trainers?|sneakers?|runners?|sport shoes?|tennis shoes?|gym shoes?)\b/.test(t);

  if (isAthleticFootwear) {
    add('athleisure', w * 0.9);
    add('streetwear', w * 0.7);
    add('smart_casual', w * 0.4);
  }

  if (/\b(minimal|clean|plain|neutral|basic tee|crew neck|simple)\b/.test(t)) {
    add('minimalist');
  }

  if (/\b(luxury|cashmere|silk|designer|premium leather)\b/.test(t)) {
    add('luxury_casual');
  }

  if (
    /\b(stud|punk|goth|avant|deconstructed|statement)\b/.test(t)
    || (/\bleather\b/.test(t) && !isAthleticFootwear && !/\b(chelsea|loafer|oxford|derby|brogue|dress shoe|boot)\b/.test(t))
  ) {
    add('edgy_fashion');
  }

  if (/\b(tuxedo|evening gown|black tie|cocktail dress|gala)\b/.test(t)) {
    add('formal', w * 1.3);
  }

  if (cat === 'tops' && /\b(tee|t-shirt|t shirt)\b/.test(t) && !tags.streetwear) {
    add('minimalist', w * 0.5);
    add('athleisure', w * 0.3);
  }

  if (Object.keys(tags).length === 0) {
    if (['tops', 'bottoms', 'dresses'].includes(cat)) add('minimalist', w * 0.6);
    else if (cat === 'shoes') add('smart_casual', w * 0.5);
  }

  return tags;
}

function detectCoherentAthleisureUniform(
  items: ItemLike[],
  styleScores: Partial<Record<StyleArchetype, number>>,
): boolean {
  const allText = items.map(itemText).join(' ');
  const hasAthleisureBottom = /\b(joggers?|sweatpants?|sweat pants|leggings?|track pants|track trousers|gym shorts|athletic shorts)\b/.test(allText);
  const hasAthleticFootwear = items.some(
    (item) => String(item.category || '').toLowerCase() === 'shoes'
      && /\b(sneakers?|trainers?|running shoes?|running sneakers?|sport shoes?)\b/.test(itemText(item)),
  );
  const hasIncompatibleTop = items.some((item) => {
    const cat = String(item.category || '').toLowerCase();
    if (!['tops', 'outerwear'].includes(cat)) return false;
    return /\b(silk|cashmere|dress shirt|blazer|suit jacket|blouse|tie|evening)\b/.test(itemText(item));
  });
  if (hasIncompatibleTop) return false;

  return hasAthleisureBottom && hasAthleticFootwear && (styleScores.athleisure || 0) >= 6;
}

/** Blazer + hoodie + denim + trainers = accepted streetwear layering. */
function detectAcceptedStreetwearLayering(items: ItemLike[]): boolean {
  const text = items.map(itemText).join(' ');
  const hasBlazer = /\bblazer\b/.test(text);
  const hasHoodie = /\bhoodie\b/.test(text);
  const hasJeans = items.some(
    (item) => String(item.category || '').toLowerCase() === 'bottoms'
      && /\b(jeans|denim)\b/.test(itemText(item)),
  );
  const hasTrainer = items.some(
    (item) => String(item.category || '').toLowerCase() === 'shoes'
      && /\b(sneakers?|trainers?)\b/.test(itemText(item)),
  );
  return hasBlazer && hasHoodie && hasJeans && hasTrainer;
}

/** Blazer/chinos + clean trainers is valid smart casual — not an athleisure clash. */
function detectValidSmartCasualTrainers(items: ItemLike[]): boolean {
  const text = items.map(itemText).join(' ');
  const hasTrainer = items.some(
    (item) => String(item.category || '').toLowerCase() === 'shoes'
      && /\b(sneakers?|trainers?)\b/.test(itemText(item)),
  );
  const hasTailoringAnchor = /\b(blazer|chinos?|trousers?|oxford shirt|dress shirt)\b/.test(text);
  const hasGymwear = /\b(joggers?|sweatpants?|leggings?|gym shorts|running vest|track pants)\b/.test(text);
  return hasTrainer && hasTailoringAnchor && !hasGymwear;
}

/** Suit jacket + denim + fashion trainers = intentional high-low contrast. */
function detectFashionForwardSuitJacketDenim(items: ItemLike[]): boolean {
  const text = items.map(itemText).join(' ');
  if (!/\bsuit jacket\b/.test(text)) return false;
  const hasJeans = items.some(
    (item) => String(item.category || '').toLowerCase() === 'bottoms'
      && /\b(jeans?|denim)\b/.test(itemText(item)),
  );
  const hasFashionTrainer = items.some(
    (item) => String(item.category || '').toLowerCase() === 'shoes'
      && /\b(sneakers?|trainers?)\b/.test(itemText(item))
      && !/\b(running|gym|training|performance)\b/.test(itemText(item)),
  );
  return hasJeans && hasFashionTrainer;
}

/** Cargo + hoodie + fashion trainers = coherent streetwear uniform. */
function detectCoherentStreetwearUniform(
  items: ItemLike[],
  styleScores: Partial<Record<StyleArchetype, number>>,
): boolean {
  const text = items.map(itemText).join(' ');
  const hasCargo = /cargo/.test(text);
  const hasHoodie = /\bhoodie\b/.test(text);
  const hasTrainer = items.some(
    (item) => String(item.category || '').toLowerCase() === 'shoes'
      && /\b(sneakers?|trainers?)\b/.test(itemText(item)),
  );
  return hasCargo && hasHoodie && hasTrainer && (styleScores.streetwear || 0) >= 4;
}

export function analyzeOutfitAesthetic(items: ItemLike[]): OutfitAestheticAnalysis {
  const styleScores: Partial<Record<StyleArchetype, number>> = {};

  for (const item of items) {
    const itemTags = classifyItemAesthetics(item);
    for (const [style, score] of Object.entries(itemTags) as [StyleArchetype, number][]) {
      styleScores[style] = (styleScores[style] || 0) + score;
    }
  }

  const entries = Object.entries(styleScores) as [StyleArchetype, number][];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const primaryStyle = sorted[0]?.[0] ?? null;
  const maxScore = sorted[0]?.[1] ?? 0;
  const secondScore = sorted[1]?.[1] ?? 0;
  const purity = total > 0 ? maxScore / total : 0;
  const confidence = total > 0 ? maxScore / (maxScore + secondScore * 0.65) : 0;

  let aestheticConflict = false;
  let conflictReason: string | null = null;
  let conflictingStyles: [StyleArchetype, StyleArchetype] | null = null;
  let maxDistance = 0;

  const presentStyles = sorted.filter(([, s]) => s >= total * 0.22).map(([k]) => k);
  for (let i = 0; i < presentStyles.length; i++) {
    for (let j = i + 1; j < presentStyles.length; j++) {
      const a = presentStyles[i];
      const b = presentStyles[j];
      const dist = AESTHETIC_DISTANCE[a]?.[b] ?? AESTHETIC_DISTANCE[b]?.[a] ?? 0;
      if (dist >= 2 && dist > maxDistance) {
        maxDistance = dist;
        aestheticConflict = true;
        conflictingStyles = [a, b];
        conflictReason = `Mixes ${a.replace(/_/g, ' ')} with ${b.replace(/_/g, ' ')} — different style worlds`;
      }
    }
  }

  const coherentAthleisureUniform = detectCoherentAthleisureUniform(items, styleScores);
  const validSmartCasualTrainers = detectValidSmartCasualTrainers(items);
  const acceptedStreetwearLayering = detectAcceptedStreetwearLayering(items);
  const fashionForwardSuitDenim = detectFashionForwardSuitJacketDenim(items);
  const coherentStreetwearUniform = detectCoherentStreetwearUniform(items, styleScores);
  const suppressStyleConflict = coherentAthleisureUniform
    || validSmartCasualTrainers
    || acceptedStreetwearLayering
    || fashionForwardSuitDenim
    || coherentStreetwearUniform;

  const unclearIdentity = !suppressStyleConflict
    && purity < 0.52
    && presentStyles.length >= 2
    && secondScore >= maxScore * 0.55
    && !dominantCluster(presentStyles);

  const footwearBreaksIntent = detectFootwearBreaksIntent(items, primaryStyle, styleScores);
  const resolvedPrimaryStyle = coherentAthleisureUniform
    ? 'athleisure'
    : coherentStreetwearUniform
      ? 'streetwear'
    : acceptedStreetwearLayering
      ? 'streetwear'
      : fashionForwardSuitDenim
        ? 'streetwear'
        : validSmartCasualTrainers
          ? 'smart_casual'
          : primaryStyle;

  return {
    primaryStyle: resolvedPrimaryStyle,
    styleScores,
    confidence: Math.round(confidence * 100) / 100,
    purity: Math.round((coherentAthleisureUniform || coherentStreetwearUniform ? Math.max(purity, 0.68) : purity) * 100) / 100,
    aestheticConflict: suppressStyleConflict ? false : aestheticConflict,
    conflictReason: suppressStyleConflict ? null : conflictReason,
    conflictingStyles: suppressStyleConflict ? null : conflictingStyles,
    unclearIdentity,
    footwearBreaksIntent,
    coherentAthleisureUniform,
  };
}

function detectFootwearBreaksIntent(
  items: ItemLike[],
  primaryStyle: StyleArchetype | null,
  styleScores: Partial<Record<StyleArchetype, number>>,
): boolean {
  if (detectCoherentAthleisureUniform(items, styleScores)
    || detectValidSmartCasualTrainers(items)
    || detectAcceptedStreetwearLayering(items)
    || detectFashionForwardSuitJacketDenim(items)) {
    return false;
  }

  const shoes = items.filter((i) => String(i.category || '').toLowerCase() === 'shoes');
  if (shoes.length === 0 || !primaryStyle) return false;

  const shoeText = shoes.map(itemText).join(' ');
  const isAthleticShoe = /\b(trainers?|sneakers?|runners?|sport|gym|tennis)\b/.test(shoeText);
  const isDressyShoe = /\b(chelsea|oxford|derby|brogue|loafer|dress shoe|heel|pump|stiletto)\b/.test(shoeText)
    && !isAthleticShoe;
  const isCombatBoot = /\b(combat|hiking|work boot|timberland|dr\.? ?marten)\b/.test(shoeText);

  const athleisureSignal = (styleScores.athleisure || 0) > 2;
  const tailoringSignal = (styleScores.classic_tailoring || 0) > 2.5;
  const formalSignal = (styleScores.formal || 0) > 2;

  if (athleisureSignal && isDressyShoe) return true;
  if ((tailoringSignal || formalSignal) && isAthleticShoe && primaryStyle !== 'smart_casual') return true;
  if (primaryStyle === 'athleisure' && isDressyShoe) return true;
  if (primaryStyle === 'streetwear' && isDressyShoe) return true;
  if (primaryStyle === 'formal' && (isAthleticShoe || isCombatBoot)) return true;

  return false;
}

/** Stage 0 — hard rejection before heuristics or AI can inflate the score. */
export function evaluateAestheticRejection(items: ItemLike[]): AestheticRejection | null {
  if (items.length < 2) return null;

  const analysis = analyzeOutfitAesthetic(items);

  if (analysis.aestheticConflict && analysis.conflictingStyles) {
    const [a, b] = analysis.conflictingStyles;
    const dist = AESTHETIC_DISTANCE[a]?.[b] ?? AESTHETIC_DISTANCE[b]?.[a] ?? 2;
    const cap = dist >= 3 ? 34 : 40;
    return {
      rejected: true,
      scoreCap: cap,
      hint: analysis.conflictReason
        || 'Outfit mixes incompatible style worlds — pick one aesthetic lane',
      clashId: `aesthetic_conflict_${a}_${b}`,
      severity: dist >= 3 ? 'fatal' : 'major',
      analysis,
    };
  }

  if (analysis.footwearBreaksIntent) {
    return {
      rejected: true,
      scoreCap: 35,
      hint: 'Footwear breaks the outfit\'s style intent — athleisure needs trainers; polished boots need tailored or smart-casual bases',
      clashId: 'aesthetic_footwear_breaks_intent',
      severity: 'major',
      analysis,
    };
  }

  if (analysis.unclearIdentity) {
    return {
      rejected: true,
      scoreCap: 42,
      hint: 'Outfit lacks a clear style identity — pieces read like they were grabbed from different wardrobes',
      clashId: 'aesthetic_unclear_identity',
      severity: 'major',
      analysis,
    };
  }

  return null;
}

export function styleArchetypeLabel(style: StyleArchetype | null): string {
  if (!style) return 'unclear';
  return style.replace(/_/g, ' ');
}

export { STYLE_ARCHETYPES };
