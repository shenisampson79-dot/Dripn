import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isIntentionalSmartCasualTrainerLook,
  DEFAULT_SMART_CASUAL_REGIONAL,
  type RegionalStyleContext,
} from '@/utils/outfitRegionalContext';

/** 1 = athletic · 2 = casual · 3 = smart casual · 4 = business · 5 = formal */
export type FormalityTier = 1 | 2 | 3 | 4 | 5;

export type ItemSignals = {
  formalityTier: FormalityTier;
  isAthleticTop: boolean;
  isAthleticBottom: boolean;
  isBlazer: boolean;
  isSuitPiece: boolean;
  isShorts: boolean;
  isDress: boolean;
  isSkirt: boolean;
  isTie: boolean;
  isAthleticShoes: boolean;
  isFormalShoes: boolean;
  isBoots: boolean;
  isHeels: boolean;
  isCasualTrainer: boolean;
  isSwimwear: boolean;
  isSleepwear: boolean;
  isJeans: boolean;
  isHoodie: boolean;
  isEveningWear: boolean;
  isUggs: boolean;
  isGown: boolean;
  isJoggers: boolean;
  isDressShirt: boolean;
  isDressyBoots: boolean;
};

export type OutfitClash = {
  id: string;
  penalty: number;
  hint: string;
  severity: 'fatal' | 'major' | 'moderate' | 'minor';
};

export type OutfitContext = {
  items: WardrobeItem[];
  signals: ItemSignals[];
  text: string;
  maxTier: FormalityTier;
  minTier: FormalityTier;
  tierSpread: number;
  regional: RegionalStyleContext | null;
  isSmartCasualLook: boolean;
  has: (flag: keyof ItemSignals) => boolean;
  any: (flag: keyof ItemSignals) => boolean;
};

function itemText(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function isShortSleeveTop(item: WardrobeItem): boolean {
  return /short[\s-]?sleeve|short\s+sleeve/.test(itemText(item));
}

export function isShortsItem(item: WardrobeItem): boolean {
  if (isShortSleeveTop(item)) return false;
  const t = itemText(item);
  if (item.category === 'bottoms') {
    return /\bshorts?\b|cut-off|cutoff|bermuda|chino short/.test(t)
      || (/short/.test(t) && !/short[\s-]?sleeve/.test(t));
  }
  return /\bshorts\b|cut-off|cutoff|bermuda/.test(t);
}

export function isBlazerItem(item: WardrobeItem): boolean {
  const t = itemText(item);
  return /blazer|sport coat|suit jacket|formal jacket|tailored jacket/.test(t)
    || (item.category === 'outerwear' && /blazer|suit jacket|sport coat|tailored/.test(t));
}

export function isAthleticTop(item: WardrobeItem): boolean {
  const t = itemText(item);
  return item.category === 'activewear_tops'
    || item.category === 'activewear'
    || /singlet|tank|sleeveless|jersey|running vest|gym vest|training vest|athletic vest|performance vest|running|athletic|gym|training|performance|compression|sports top|sports bra/.test(t);
}

export function isAthleticBottom(item: WardrobeItem): boolean {
  const t = itemText(item);
  return item.category === 'activewear_bottoms'
    || /jogger|track pant|legging|gym short|athletic short|sweatpant|training pant/.test(t);
}

export function isAthleticFootwear(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  return /trainer|sneaker|runner|athletic|sport|tennis|gym|slide|flip-flop|sandal|running shoe/.test(t);
}

export function isFormalFootwear(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  return /oxford|derby|brogue|loafer|dress shoe|heel|pump|stiletto|court shoe|formal shoe/.test(t);
}

export function isBootFootwear(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  if (/trainer|sneaker|athletic|sport|tennis|gym/.test(t)) return false;
  return /boot|chelsea|combat|hiking|work boot|lace-up boot|timberland|dr\.? ?martens|ugg/.test(t);
}

/** Polished leather / Chelsea / dress boots — not combat, hiking, or UGGs. */
export function isDressyBootFootwear(item: WardrobeItem): boolean {
  if (!isBootFootwear(item)) return false;
  const t = itemText(item);
  if (/combat|hiking|work boot|timberland|ugg|shearling|doc\b|dr\.? ?marten|chukka|desert boot/.test(t)) {
    return false;
  }
  return /chelsea|dress boot|riding boot|heeled boot|ankle boot|leather boot|leather chelsea/.test(t)
    || (/leather/.test(t) && /boot/.test(t));
}

export function isCasualTrainer(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  if (isFormalFootwear(item)) return false;
  if (/boot/.test(t) && !/trainer|sneaker|athletic/.test(t)) return false;
  return /trainer|sneaker|runner|athletic|sport|tennis|gym|asics|nike|adidas|new balance|skate shoe|canvas shoe/.test(t);
}

export function classifyItem(item: WardrobeItem): ItemSignals {
  const t = itemText(item);
  const cat = item.category || '';

  const isSwimwear = cat === 'swimwear' || /swim|bikini|trunks|swimsuit/.test(t);
  const isSleepwear = cat === 'sleepwear' || /pyjama|pajama|nightdress|robe|loungewear|sleep/.test(t);
  const isTie = /\btie\b|necktie|bow tie/.test(t);
  const isDress = cat === 'dresses' || /\bdress\b/.test(t) && !/dress shoe|dress shirt/.test(t);
  const isGown = /gown|evening dress|ballgown|cocktail dress/.test(t);
  const isEveningWear = isGown || (cat === 'formal' && /evening|gala/.test(t));
  const isSuitPiece = /suit trouser|suit pant|dress trouser|dress pant|tailored trouser/.test(t)
    || (cat === 'formal' && /suit/.test(t));
  const isBlazer = isBlazerItem(item);
  const isShorts = isShortsItem(item);
  const isJeans = /jean|denim/.test(t) && cat === 'bottoms';
  const isHoodie = /hoodie|hooded sweat/.test(t);
  const isJoggers = /jogger|sweatpant|track pant/.test(t);
  const isDressShirt = /dress shirt|button-down|button down|oxford shirt/.test(t);
  const isSkirt = cat === 'bottoms' && /skirt/.test(t);
  const athleticTop = isAthleticTop(item);
  const athleticBottom = isAthleticBottom(item) || isJoggers;
  const athleticShoes = isAthleticFootwear(item);
  const formalShoes = isFormalFootwear(item);
  const boots = isBootFootwear(item);
  const dressyBoots = isDressyBootFootwear(item);
  const heels = /heel|pump|stiletto/.test(t) && cat === 'shoes';
  const casualTrainer = isCasualTrainer(item);
  const isUggs = /\bugg|shearling boot|sheepskin/.test(t);

  let formalityTier: FormalityTier = 3;

  if (isSwimwear || athleticTop || athleticBottom || isJoggers || (isShorts && athleticBottom)) {
    formalityTier = 1;
  } else if (isSleepwear || isHoodie || isShorts || casualTrainer || athleticShoes) {
    formalityTier = 2;
  } else if (isJeans || (boots && !dressyBoots)) {
    formalityTier = 3;
  } else if (isDressShirt || isTie || isSuitPiece || isBlazer || dressyBoots) {
    formalityTier = 4;
  }

  if (isEveningWear || isGown || (isTie && isSuitPiece)) formalityTier = 5;
  if (athleticTop || athleticBottom) formalityTier = Math.min(formalityTier, 1) as FormalityTier;
  if (formalShoes || heels || dressyBoots) formalityTier = Math.max(formalityTier, 4) as FormalityTier;
  if (athleticShoes && !formalShoes) formalityTier = Math.min(formalityTier, 2) as FormalityTier;

  return {
    formalityTier,
    isAthleticTop: athleticTop,
    isAthleticBottom: athleticBottom,
    isBlazer,
    isSuitPiece,
    isShorts,
    isDress,
    isSkirt,
    isTie,
    isAthleticShoes: athleticShoes,
    isFormalShoes: formalShoes,
    isBoots: boots,
    isHeels: heels,
    isCasualTrainer: casualTrainer,
    isSwimwear,
    isSleepwear,
    isJeans,
    isHoodie,
    isEveningWear,
    isUggs,
    isGown,
    isJoggers,
    isDressShirt,
    isDressyBoots: dressyBoots,
  };
}

export function buildOutfitContext(
  items: WardrobeItem[],
  regional: RegionalStyleContext | null = null,
): OutfitContext {
  const signals = items.map(classifyItem);
  const tiers = signals.map((s) => s.formalityTier);
  const maxTier = Math.max(...tiers, 1) as FormalityTier;
  const minTier = Math.min(...tiers, 5) as FormalityTier;
  const isSmartCasualLook = isIntentionalSmartCasualTrainerLook(items, regional)
    || (regional == null && isIntentionalSmartCasualTrainerLook(items, DEFAULT_SMART_CASUAL_REGIONAL));

  return {
    items,
    signals,
    text: items.map(itemText).join(' | '),
    maxTier,
    minTier,
    tierSpread: maxTier - minTier,
    regional,
    isSmartCasualLook,
    has: (flag) => signals.every((s) => s[flag]),
    any: (flag) => signals.some((s) => s[flag]),
  };
}

const CLASH_RULES: Array<{
  id: string;
  penalty: number;
  hint: string;
  severity: OutfitClash['severity'];
  when: (ctx: OutfitContext) => boolean;
}> = [
  // ── Fatal (do not wear) ──────────────────────────────────────────────
  {
    id: 'tie_jersey',
    penalty: 92,
    hint: 'Tie + sports jersey — never pair formal neckwear with athletic tops',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && /jersey|football|rugby|basketball/.test(ctx.text),
  },
  {
    id: 'tie_athletic_top',
    penalty: 90,
    hint: 'Tie + athletic top clash',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && ctx.any('isAthleticTop'),
  },
  {
    id: 'tie_athletic_bottom',
    penalty: 90,
    hint: 'Tie with joggers or track pants — formal neckwear needs tailored trousers',
    severity: 'major',
    when: (ctx) => ctx.any('isTie') && (ctx.any('isJoggers') || ctx.any('isAthleticBottom')),
  },
  {
    id: 'tie_shorts',
    penalty: 88,
    hint: 'Tie with shorts — keep tailoring with full-length trousers',
    severity: 'major',
    when: (ctx) => ctx.any('isTie') && ctx.any('isShorts'),
  },
  {
    id: 'tie_uggs',
    penalty: 84,
    hint: 'Tie with UGG-style boots — formality lanes mixed',
    severity: 'major',
    when: (ctx) => ctx.any('isTie') && ctx.any('isUggs'),
  },
  {
    id: 'tie_tshirt',
    penalty: 86,
    hint: 'Tie needs a dress shirt collar — not a tee or casual top',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie')
      && /t-shirt|tee\b|graphic top|crew[\s-]?neck|polo\b/.test(ctx.text)
      && !ctx.any('isDressShirt'),
  },
  {
    id: 'swimwear_formal',
    penalty: 88,
    hint: 'Swimwear mixed with everyday or formal pieces',
    severity: 'fatal',
    when: (ctx) => ctx.any('isSwimwear') && (ctx.maxTier >= 3 || ctx.any('isBlazer') || ctx.any('isTie')),
  },
  {
    id: 'sleepwear_formal',
    penalty: 84,
    hint: 'Loungewear or sleepwear with structured formal pieces',
    severity: 'fatal',
    when: (ctx) => ctx.any('isSleepwear') && (ctx.any('isBlazer') || ctx.any('isTie') || ctx.any('isFormalShoes')),
  },

  // ── Major formality clashes ──────────────────────────────────────────
  {
    id: 'tier1_tier5',
    penalty: 86,
    hint: 'Athletic pieces with formal evening wear — formality tiers are too far apart',
    severity: 'major',
    when: (ctx) => ctx.minTier === 1 && ctx.maxTier >= 5,
  },
  {
    id: 'athletic_formal_shoes',
    penalty: 80,
    hint: 'Athletic top + formal shoes clash',
    severity: 'major',
    when: (ctx) => ctx.any('isAthleticTop') && (ctx.any('isFormalShoes') || ctx.any('isHeels')),
  },
  {
    id: 'athletic_boots_shorts',
    penalty: 82,
    hint: 'Gym top, shorts & boots clash',
    severity: 'major',
    when: (ctx) => ctx.any('isAthleticTop') && ctx.any('isShorts') && ctx.any('isBoots'),
  },
  {
    id: 'athletic_boots',
    penalty: 76,
    hint: 'Athletic top + boots clash — trainers or sport shoes work better',
    severity: 'major',
    when: (ctx) => ctx.any('isAthleticTop') && ctx.any('isBoots'),
  },
  {
    id: 'athletic_heels',
    penalty: 78,
    hint: 'Athletic wear + heels clash',
    severity: 'major',
    when: (ctx) => (ctx.any('isAthleticTop') || ctx.any('isAthleticBottom')) && ctx.any('isHeels'),
  },
  {
    id: 'blazer_athletic_top',
    penalty: 88,
    hint: 'Running vest or gym top under a blazer — sportswear and tailoring do not mix',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isAthleticTop'),
  },
  {
    id: 'blazer_shorts_uggs',
    penalty: 84,
    hint: 'Blazer, shorts & UGGs clash',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isShorts') && ctx.any('isUggs'),
  },
  {
    id: 'blazer_shorts_trainers',
    penalty: 78,
    hint: 'Blazer, shorts & trainers — formality lanes mixed',
    severity: 'major',
    when: (ctx) => !ctx.isSmartCasualLook && ctx.any('isBlazer') && ctx.any('isShorts') && ctx.any('isCasualTrainer'),
  },
  {
    id: 'blazer_shorts',
    penalty: 74,
    hint: 'Blazer + shorts clash — tailoring reads office, shorts read leisure',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isShorts'),
  },
  {
    id: 'evening_athletic_bottom',
    penalty: 80,
    hint: 'Evening wear with athletic bottoms',
    severity: 'major',
    when: (ctx) => ctx.any('isEveningWear') && (ctx.any('isAthleticBottom') || ctx.any('isJoggers') || ctx.any('isShorts')),
  },
  {
    id: 'dress_jeans',
    penalty: 72,
    hint: 'Dress layered over jeans — pick one silhouette anchor',
    severity: 'major',
    when: (ctx) => ctx.any('isDress') && ctx.any('isJeans'),
  },
  {
    id: 'formal_shoes_athletic',
    penalty: 76,
    hint: 'Dress shoes with gym or athletic pieces',
    severity: 'major',
    when: (ctx) => ctx.any('isFormalShoes') && (ctx.any('isAthleticTop') || ctx.any('isAthleticBottom') || ctx.any('isJoggers')),
  },
  {
    id: 'joggers_dressy_boots',
    penalty: 74,
    hint: 'Sweatpants or joggers with leather Chelsea/dress boots clash — keep athleisure with trainers, or boots with jeans/chinos',
    severity: 'major',
    when: (ctx) => (ctx.any('isJoggers') || ctx.any('isAthleticBottom')) && ctx.any('isDressyBoots'),
  },
  {
    id: 'trainers_suit',
    penalty: 70,
    hint: 'Trainers with suit-level formality',
    severity: 'major',
    when: (ctx) => !ctx.isSmartCasualLook
      && ctx.any('isCasualTrainer')
      && (
        ctx.any('isTie')
        || (ctx.any('isSuitPiece') && /dress shirt|button-down|button down|oxford shirt|blouse/.test(ctx.text))
        || (ctx.any('isBlazer') && /dress shirt|button-down|button down|oxford shirt|blouse/.test(ctx.text))
      ),
  },
  {
    id: 'hoodie_formal_trousers',
    penalty: 68,
    hint: 'Hoodie with dress trousers and formal shoes',
    severity: 'major',
    when: (ctx) => ctx.any('isHoodie') && (ctx.any('isSuitPiece') || /dress trouser|tailored trouser/.test(ctx.text)) && ctx.any('isFormalShoes'),
  },

  // ── Moderate clashes ─────────────────────────────────────────────────
  {
    id: 'blazer_trainers',
    penalty: 52,
    hint: 'Blazer + trainers skew casual — chinos and loafers elevate this',
    severity: 'moderate',
    when: (ctx) => !ctx.isSmartCasualLook
      && ctx.any('isBlazer')
      && ctx.any('isCasualTrainer')
      && !ctx.any('isJeans')
      && !ctx.any('isAthleticTop'),
  },
  {
    id: 'shorts_formal_shoes',
    penalty: 58,
    hint: 'Shorts with formal shoes — sandals or trainers match better',
    severity: 'moderate',
    when: (ctx) => ctx.any('isShorts') && (ctx.any('isFormalShoes') || ctx.any('isHeels')),
  },
  {
    id: 'shorts_boots',
    penalty: 48,
    hint: 'Shorts + heavy boots can feel unbalanced — try trainers or loafers',
    severity: 'moderate',
    when: (ctx) => ctx.any('isShorts') && ctx.any('isBoots') && !ctx.any('isAthleticTop'),
  },
  {
    id: 'tier_spread_3',
    penalty: 56,
    hint: 'Formality mismatch across the outfit — pieces sit too far apart',
    severity: 'moderate',
    when: (ctx) => !ctx.isSmartCasualLook && ctx.tierSpread >= 3 && !ctx.any('isBlazer'),
  },
  {
    id: 'tier_spread_2_athletic_formal',
    penalty: 44,
    hint: 'Sportswear mixed with business pieces — bridge with smart casual items',
    severity: 'moderate',
    when: (ctx) => ctx.tierSpread >= 2 && ctx.any('isAthleticTop') && ctx.maxTier >= 4,
  },
  {
    id: 'dress_shorts',
    penalty: 62,
    hint: 'Dress with shorts underneath reads accidental — choose one hero piece',
    severity: 'moderate',
    when: (ctx) => ctx.any('isDress') && ctx.any('isShorts'),
  },
  {
    id: 'joggers_blazer',
    penalty: 64,
    hint: 'Joggers with a blazer — athleisure needs intentional styling to work',
    severity: 'moderate',
    when: (ctx) => ctx.any('isJoggers') && ctx.any('isBlazer'),
  },
  {
    id: 'athletic_outerwear_formal',
    penalty: 50,
    hint: 'Technical outerwear over formal bases needs a clearer style lane',
    severity: 'moderate',
    when: (ctx) => /puffer|windbreaker|track jacket|shell jacket/.test(ctx.text)
      && (ctx.any('isSuitPiece') || ctx.any('isTie') || ctx.any('isFormalShoes')),
  },

  // ── Minor friction ───────────────────────────────────────────────────
  {
    id: 'athletic_top_non_athletic_shoes',
    penalty: 32,
    hint: 'Gym top needs sport shoes to feel intentional',
    severity: 'minor',
    when: (ctx) => ctx.any('isAthleticTop')
      && !ctx.any('isAthleticShoes')
      && !ctx.any('isCasualTrainer')
      && ctx.items.some((i) => i.category === 'shoes'),
  },
  {
    id: 'cargo_hoodie_formal_shoes',
    penalty: 45,
    hint: 'Cargo and hoodie need trainers — loafers fight the casual lane',
    severity: 'moderate',
    when: (ctx) => /cargo/.test(ctx.text) && ctx.any('isHoodie')
      && (ctx.any('isFormalShoes') || ctx.any('isDressyBoots'))
      && !ctx.any('isCasualTrainer'),
  },
  {
    id: 'denim_jacket_dress_shirt',
    penalty: 48,
    hint: 'Denim jacket over a dress shirt splits casual and smart lanes — wear a tee under denim or drop the shirt collar',
    severity: 'moderate',
    when: (ctx) => /denim jacket/.test(ctx.text) && ctx.any('isDressShirt') && !ctx.any('isBlazer'),
  },
  {
    id: 'blazer_hoodie_jeans_formal_shoes',
    penalty: 50,
    hint: 'Blazer-over-hoodie with denim needs fashion trainers — loafers fight the casual lane',
    severity: 'moderate',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isHoodie') && ctx.any('isJeans')
      && (ctx.any('isFormalShoes') || ctx.any('isDressyBoots'))
      && !ctx.any('isCasualTrainer'),
  },
  {
    id: 'slides_tailored_bottoms',
    penalty: 55,
    hint: 'Pool slides with chinos or trousers reads too casual — trainers or loafers finish the look',
    severity: 'moderate',
    when: (ctx) => ctx.items.some((i) => i.category === 'shoes' && /slides?|flip.?flop|pool slide/.test(itemText(i)))
      && /chino|trouser|slack/.test(ctx.text)
      && !ctx.any('isShorts'),
  },
  {
    id: 'hoodie_dress_shirt',
    penalty: 58,
    hint: 'Hoodie over a dress shirt reads accidental — wear one or the other, or add a blazer for intentional layering',
    severity: 'moderate',
    when: (ctx) => ctx.any('isHoodie') && ctx.any('isDressShirt') && !ctx.any('isBlazer'),
  },
  {
    id: 'hoodie_blazer_cargo',
    penalty: 38,
    hint: 'Hoodie + blazer + cargo pulls three style lanes — pick one anchor piece',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isHoodie')
      && ctx.items.some((i) => /cargo/.test(itemText(i))),
  },
  {
    id: 'blazer_hoodie_no_jeans',
    penalty: 28,
    hint: 'Blazer over hoodie works best with denim to anchor the casual lane',
    severity: 'minor',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isHoodie') && !ctx.any('isJeans')
      && !ctx.items.some((i) => /cargo/.test(itemText(i))),
  },
];

export function detectOutfitClashes(
  items: WardrobeItem[],
  regional: RegionalStyleContext | null = null,
): OutfitClash | null {
  const matched = detectAllOutfitClashes(items, regional);
  if (matched.length === 0) return null;
  return matched[0];
}

/**
 * Hard validity gate for candidate outfits.
 * Fatal/major clashes make an outfit impossible — not merely low-scored.
 * Moderate/minor stay as soft score pressure elsewhere.
 */
export function isOutfitValid(
  items: WardrobeItem[],
  regional: RegionalStyleContext | null = null,
): boolean {
  if (!items || items.length < 2) return true;
  const clashes = detectAllOutfitClashes(items, regional);
  return !clashes.some((c) => c.severity === 'fatal' || c.severity === 'major');
}

/** All clash rules that match, sorted by severity then penalty (highest first). */
export function detectAllOutfitClashes(
  items: WardrobeItem[],
  regional: RegionalStyleContext | null = null,
): OutfitClash[] {
  if (items.length < 2) return [];

  const ctx = buildOutfitContext(items, regional);
  const matched = CLASH_RULES.filter((rule) => rule.when(ctx));
  if (matched.length === 0) return [];

  const severityRank: Record<OutfitClash['severity'], number> = {
    fatal: 4,
    major: 3,
    moderate: 2,
    minor: 1,
  };

  matched.sort((a, b) => {
    const sev = severityRank[b.severity] - severityRank[a.severity];
    if (sev !== 0) return sev;
    return b.penalty - a.penalty;
  });

  return matched.map((top) => ({
    id: top.id,
    penalty: top.penalty,
    hint: top.hint,
    severity: top.severity,
  }));
}

/** Secondary clashes add small extra penalties (capped). */
export function collectSecondaryClashPenalty(
  items: WardrobeItem[],
  primary: OutfitClash | null,
  regional: RegionalStyleContext | null = null,
): number {
  if (items.length < 2) return 0;

  const ctx = buildOutfitContext(items, regional);
  const matched = CLASH_RULES.filter((rule) => rule.when(ctx));
  if (matched.length <= 1) return 0;

  const extra = matched
    .filter((rule) => rule.id !== primary?.id && rule.severity !== 'minor')
    .slice(0, 2)
    .reduce((sum, rule) => sum + Math.round(rule.penalty * 0.12), 0);

  return Math.min(12, extra);
}

export function clashToScore(penalty: number, extraPenalty = 0): number {
  return Math.max(5, Math.min(100, 100 - penalty - extraPenalty));
}

export function scoreHintForValue(score: number, clashHint?: string): string {
  if (clashHint) return clashHint;
  if (score >= 82) return 'Strong outfit';
  if (score >= 68) return 'Good combo';
  if (score >= 45) return 'Room to refine';
  if (score >= 30) return 'Needs work';
  return 'Clash risk';
}

export function localScoreLooksLikeClash(score: number, hint: string): boolean {
  return score < 50 || /clash|needs work|formality|skew|gym|never pair|mismatch|unbalanced|accidental/i.test(hint);
}
