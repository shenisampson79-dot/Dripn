import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isIntentionalSmartCasualTrainerLook,
  DEFAULT_SMART_CASUAL_REGIONAL,
  isChunkyOrTechTrainer as isChunkyOrTechTrainerFn,
  isFashionTrainer as isFashionTrainerFn,
  type RegionalStyleContext,
} from '@/utils/outfitRegionalContext';
import {
  classifyGarment,
  detectSubtypeConflicts,
} from '@/utils/garmentTaxonomy';

/** 1 = athletic · 2 = casual · 3 = smart casual · 4 = business · 5 = formal */
export type FormalityTier = 1 | 2 | 3 | 4 | 5;

export type ItemSignals = {
  formalityTier: FormalityTier;
  subtype?: string | null;
  garmentLane?: string | null;
  garmentConfidence?: number;
  isAthleticTop: boolean;
  isAthleticBottom: boolean;
  isBlazer: boolean;
  isSuitPiece: boolean;
  isShorts: boolean;
  isTailoredShorts?: boolean;
  isAthleticShorts?: boolean;
  isDress: boolean;
  isSkirt: boolean;
  isTie: boolean;
  isAthleticShoes: boolean;
  isFormalShoes: boolean;
  isBoots: boolean;
  isHeels: boolean;
  isCasualTrainer: boolean;
  isChunkyOrTechTrainer: boolean;
  isFashionTrainer: boolean;
  isSwimwear: boolean;
  isSleepwear: boolean;
  isJeans: boolean;
  isHoodie: boolean;
  isEveningWear: boolean;
  isUggs: boolean;
  isGown: boolean;
  isJoggers: boolean;
  isDressShirt: boolean;
  /** Dress / button-down / oxford / denim / chambray shirt (not denim jacket). */
  isStructuredShirt: boolean;
  isDressyBoots: boolean;
  isFleeceOrInsulated: boolean;
  isLoungeBottom: boolean;
  isFormalAccessory: boolean;
  isRevealing?: boolean;
  isSlipDress?: boolean;
  isCombatBoots?: boolean;
  isChelseaBoots?: boolean;
  isSlides?: boolean;
  isLeatherSandals?: boolean;
  /** Short-sleeve top (incl. linen / button-down) — never pair with a necktie. */
  isShortSleeve?: boolean;
};

export type OutfitClash = {
  id: string;
  penalty: number;
  hint: string;
  severity: 'fatal' | 'major' | 'moderate' | 'minor';
};

export type WorkDressCode =
  | 'creative'
  | 'smart_casual'
  | 'business_casual'
  | 'business_formal';

export type ClashDetectOptions = {
  regional?: RegionalStyleContext | null;
  occasion?: string | null;
  eventType?: string | null;
  /** User workplace dress expectation — creative/smart_casual skip office footwear lock. */
  workDressCode?: WorkDressCode | null;
};

export type OutfitContext = {
  items: WardrobeItem[];
  signals: ItemSignals[];
  text: string;
  maxTier: FormalityTier;
  minTier: FormalityTier;
  tierSpread: number;
  regional: RegionalStyleContext | null;
  options?: ClashDetectOptions;
  occasion?: string | null;
  isSmartCasualLook: boolean;
  has: (flag: keyof ItemSignals) => boolean;
  any: (flag: keyof ItemSignals) => boolean;
};

function itemText(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function isShortSleeveTop(item: WardrobeItem): boolean {
  const t = itemText(item);
  if (/long[\s-]?sleeve/.test(t)) return false;
  // Camp / Cuban / bowling shirts are short-sleeve by cut; otherwise require an explicit short-sleeve cue.
  return /short[\s-]?sleeve|short\s+sleeve|½\s*sleeve|half[\s-]?sleeve/.test(t)
    || /(camp|cuban|bowling)\s+(shirt|top)/.test(t);
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
  const cat = String(item.category || '').toLowerCase();
  if (cat === 'shoes' || cat === 'bottoms' || cat === 'activewear_bottoms') return false;
  const t = itemText(item);
  return item.category === 'activewear_tops'
    || item.category === 'activewear'
    || /singlet|tank|sleeveless|jersey|running vest|gym vest|training vest|athletic vest|performance vest|running top|athletic top|gym top|training top|performance top|compression|sports top|sports bra|running\s*t-?shirts?|running\s*tees?|runner(?:'s)?\s*t-?shirts?|performance\s*tee|gym\s*tee|athletic\s*tee|sport(?:s)?\s*tee|dri-?fit|hwpo|\bnike\b.*\b(run|training|gym|sport)/.test(t);
}

export function isAthleticBottom(item: WardrobeItem): boolean {
  const t = itemText(item);
  return item.category === 'activewear_bottoms'
    || /jogger|track ?pant|tracksuit|track suit|legging|gym short|athletic short|sweatpant|sweat pant|training pant|sweat short|jersey short|french terry|sweat bottom/.test(t);
}

/** Structured button-down family — dress, oxford, denim, chambray. Not denim jacket. */
export function isStructuredShirt(item: WardrobeItem): boolean {
  const t = itemText(item);
  if (/denim jacket|jean jacket/.test(t)) return false;
  // Never classify footwear / bottoms as shirts (e.g. "oxford" shoes)
  if (item.category === 'shoes' || item.category === 'bottoms' || item.category === 'activewear_bottoms') {
    return false;
  }
  // button-up / button up (Travel Capsule naming) + denim…shirt with words between
  if (
    /dress shirt|button-down|button down|button-up|button up|oxford shirt|chambray/.test(t)
    || /denim.{0,24}shirt/.test(t)
  ) {
    return true;
  }
  // Bare "oxford" only counts on tops
  return (item.category === 'tops' || item.category === 'shirts' || !item.category)
    && /\boxford\b/.test(t)
    && !/shoe|loafer|boot/.test(t);
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
  if (/combat|hiking|work boot|timberland|ugg|shearling|doc\b|dr\.? ?marten|army boot|chunky boot/.test(t)) {
    return false;
  }
  // Do not treat generic "leather boots" as dressy — rugged work boots were slipping through.
  return /chelsea|dress boot|riding boot|heeled boot|ankle boot|leather chelsea|derby\s*boot|chukka/.test(t);
}

export function isCasualTrainer(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  if (isFormalFootwear(item)) return false;
  if (/boot/.test(t) && !/trainer|sneaker|athletic/.test(t)) return false;
  return /trainer|sneaker|runner|athletic|sport|tennis|gym|asics|nike|adidas|new balance|skate shoe|canvas shoe/.test(t);
}

export function isChunkyOrTechTrainer(item: WardrobeItem): boolean {
  return isChunkyOrTechTrainerFn(item);
}

export function isLifestyleFashionTrainer(item: WardrobeItem): boolean {
  return isFashionTrainerFn(item);
}

export function classifyItem(item: WardrobeItem): ItemSignals {
  const t = itemText(item);
  const cat = item.category || '';
  const garment = classifyGarment(item);
  const subtype = garment.subtype || null;

  const isSwimwear = cat === 'swimwear' || /swim|bikini|trunks|swimsuit/.test(t);
  const isSleepwear = cat === 'sleepwear' || /pyjama|pajama|nightdress|robe|loungewear|sleep/.test(t);
  const isTie = subtype === 'tie' || /\btie\b|necktie|bow tie/.test(t);
  const isDress = cat === 'dresses' || /\bdress\b/.test(t) && !/dress shoe|dress shirt/.test(t);
  const isGown = /gown|evening dress|ballgown|cocktail dress/.test(t);
  const isEveningWear = isGown || (cat === 'formal' && /evening|gala/.test(t))
    || garment.lane === 'evening';
  const isSuitPiece = subtype === 'tailored_trousers'
    || /suit trouser|suit pant|dress trouser|dress pant|tailored trouser/.test(t)
    || (cat === 'formal' && /suit/.test(t));
  const isBlazer = subtype === 'blazer' || isBlazerItem(item);
  const isShorts = isShortsItem(item)
    || ['tailored_shorts', 'athletic_shorts', 'cargo_shorts', 'linen_shorts'].includes(subtype || '');
  const isTailoredShorts = subtype === 'tailored_shorts';
  const isAthleticShorts = subtype === 'athletic_shorts';
  const isJeans = subtype === 'jeans' || (/jean|denim/.test(t) && cat === 'bottoms');
  const isHoodie = subtype === 'hoodie' || /hoodie|hooded sweat/.test(t);
  const isJoggers = subtype === 'joggers' || subtype === 'tracksuit_bottoms'
    || /jogger|sweatpant|sweat pant|track ?pant|tracksuit|track suit|sweat bottom/.test(t);
  const isDressShirt = subtype === 'oxford_shirt'
    || /dress shirt|button-down|button down|button-up|button up|oxford shirt/.test(t)
    || /denim.{0,24}shirt/.test(t);
  const structuredShirt = subtype === 'oxford_shirt' || isStructuredShirt(item) || isDressShirt;
  const isSkirt = Boolean(subtype?.endsWith('_skirt')) || (cat === 'bottoms' && /skirt/.test(t));
  const athleticTop = isAthleticTop(item);
  const athleticBottom = subtype === 'athletic_shorts' || subtype === 'joggers' || subtype === 'tracksuit_bottoms'
    || isAthleticBottom(item) || isJoggers;
  const athleticShoes = isAthleticFootwear(item);
  const formalShoes = ['oxfords', 'derby', 'loafers', 'dress_shoe', 'loafer'].includes(subtype || '')
    || isFormalFootwear(item);
  const boots = ['ankle_boots', 'uggs', 'chelsea_boots', 'combat_boots'].includes(subtype || '')
    || isBootFootwear(item);
  const dressyBoots = subtype === 'ankle_boots' || subtype === 'chelsea_boots' || isDressyBootFootwear(item);
  const heels = ['heels', 'stilettos', 'block_heels', 'statement_heels'].includes(subtype || '')
    || (/heel|pump|stiletto/.test(t) && cat === 'shoes');
  const casualTrainer = ['minimal_sneaker', 'chunky_trainer', 'runner'].includes(subtype || '')
    || isCasualTrainer(item);
  const chunkyOrTechTrainer = subtype === 'chunky_trainer' || subtype === 'runner'
    || isChunkyOrTechTrainer(item);
  const fashionTrainer = subtype === 'minimal_sneaker' || isLifestyleFashionTrainer(item);
  const isUggs = subtype === 'uggs' || /\bugg|shearling boot|sheepskin/.test(t);
  const isCombatBoots = subtype === 'combat_boots'
    || (/combat|doc\b|dr\.?\s*marten|chunky boot|hiking boot|work boot|timberland|army boot/.test(t) && cat === 'shoes');
  const isChelseaBoots = subtype === 'chelsea_boots' || /chelsea|desert boot|chukka/.test(t);
  const isSlides = subtype === 'slides' || /slide|flip.?flop|pool slide/.test(t);
  const isLeatherSandals = subtype === 'leather_sandals' || subtype === 'espadrilles'
    || (/sandal|birkenstock|espadrille/.test(t) && cat === 'shoes' && !isSlides);
  const isFleeceOrInsulated = subtype === 'fleece' || subtype === 'puffer'
    || (/fleece|insulated|puffer|down jacket|parka|quilted|thermal outer|winter coat/.test(t)
      && (cat === 'outerwear' || /jacket|coat|fleece|parka|puffer/.test(t)));
  const isLoungeBottom = athleticBottom || isJoggers
    || (cat === 'bottoms' && /sweat|french terry|jersey short|lounge/.test(t));
  const isFormalAccessory = isTie
    || (cat === 'accessories' && /cufflink|pocket square|lapel|cravat|ascot/.test(t));
  const isRevealing = Boolean(garment.meta?.isRevealing);
  const isSlipDress = subtype === 'slip_dress';
  const shortSleeve = (cat === 'tops' || cat === 'shirts' || cat === 'formal' || structuredShirt || isDressShirt)
    && isShortSleeveTop(item);

  let formalityTier: FormalityTier = 3;

  if (isSwimwear || athleticTop || athleticBottom || isJoggers || (isShorts && athleticBottom && !isTailoredShorts) || isSlides) {
    formalityTier = 1;
  } else if (isSleepwear || isHoodie || (isShorts && !isTailoredShorts) || casualTrainer || athleticShoes || isUggs || isLeatherSandals) {
    formalityTier = 2;
  } else if (isJeans || isTailoredShorts || (boots && !isUggs && !isCombatBoots)) {
    formalityTier = 3;
  } else if (structuredShirt || isTie || isSuitPiece || isBlazer) {
    formalityTier = 4;
  }

  if (isEveningWear || isGown || (isTie && isSuitPiece)) formalityTier = 5;
  if (athleticTop || athleticBottom) formalityTier = Math.min(formalityTier, 1) as FormalityTier;
  if (formalShoes || heels || isChelseaBoots) formalityTier = Math.max(formalityTier, 4) as FormalityTier;
  if (athleticShoes && !formalShoes) formalityTier = Math.min(formalityTier, 2) as FormalityTier;
  if (isUggs || isSlides || isCombatBoots) formalityTier = Math.min(formalityTier, 2) as FormalityTier;
  if (isFleeceOrInsulated) formalityTier = Math.min(formalityTier, 3) as FormalityTier;

  if (garment.formality != null && garment.confidence >= 0.75 && !garment.coarseOnly) {
    formalityTier = Math.max(1, Math.min(5, Math.round(garment.formality) || formalityTier)) as FormalityTier;
  }
  // Evening / gown / black-tie always win over DB formality
  if (isEveningWear || isGown || (isTie && isSuitPiece)) formalityTier = 5;
  if (athleticTop || athleticBottom) formalityTier = Math.min(formalityTier, 1) as FormalityTier;

  return {
    formalityTier,
    subtype,
    garmentLane: garment.lane || null,
    garmentConfidence: garment.confidence || 0,
    isAthleticTop: athleticTop,
    isAthleticBottom: athleticBottom,
    isBlazer,
    isSuitPiece,
    isShorts,
    isTailoredShorts,
    isAthleticShorts,
    isDress,
    isSkirt,
    isTie,
    isAthleticShoes: athleticShoes,
    isFormalShoes: formalShoes,
    isBoots: boots,
    isHeels: heels,
    isCasualTrainer: casualTrainer,
    isChunkyOrTechTrainer: chunkyOrTechTrainer,
    isFashionTrainer: fashionTrainer,
    isSwimwear,
    isSleepwear,
    isJeans,
    isHoodie,
    isEveningWear,
    isUggs,
    isGown,
    isJoggers,
    isDressShirt: isDressShirt || structuredShirt,
    isStructuredShirt: structuredShirt,
    isDressyBoots: dressyBoots,
    isFleeceOrInsulated,
    isLoungeBottom,
    isFormalAccessory,
    isRevealing,
    isSlipDress,
    isCombatBoots,
    isChelseaBoots,
    isSlides,
    isLeatherSandals,
    isShortSleeve: shortSleeve,
  };
}

function isRegionalContext(v: unknown): v is RegionalStyleContext {
  return !!v && typeof v === 'object' && 'allowsSmartCasualTrainers' in (v as object);
}

function normalizeClashArg(
  regionalOrOptions: RegionalStyleContext | ClashDetectOptions | null = null,
): { regional: RegionalStyleContext | null; options: ClashDetectOptions; occasion: string | null } {
  if (!regionalOrOptions) {
    return { regional: null, options: { occasion: 'casual' }, occasion: 'casual' };
  }
  if (isRegionalContext(regionalOrOptions)) {
    return {
      regional: regionalOrOptions,
      options: { regional: regionalOrOptions, occasion: 'casual' },
      occasion: 'casual',
    };
  }
  const opts = regionalOrOptions as ClashDetectOptions;
  const occasion = opts.occasion || opts.eventType || 'casual';
  return {
    regional: opts.regional ?? null,
    options: { ...opts, occasion },
    occasion: String(occasion),
  };
}

export function buildOutfitContext(
  items: WardrobeItem[],
  regionalOrOptions: RegionalStyleContext | ClashDetectOptions | null = null,
): OutfitContext {
  const { regional, options, occasion: occasionFromOpts } = normalizeClashArg(regionalOrOptions);
  const signals = items.map(classifyItem);
  const tiers = signals.map((s) => s.formalityTier);
  const maxTier = Math.max(...tiers, 1) as FormalityTier;
  const minTier = Math.min(...tiers, 5) as FormalityTier;
  const isSmartCasualLook = isIntentionalSmartCasualTrainerLook(items, regional)
    || (regional == null && isIntentionalSmartCasualTrainerLook(items, DEFAULT_SMART_CASUAL_REGIONAL));
  const itemOccasion = items
    .map((i) => (i as WardrobeItem & { occasion?: string; eventType?: string }).occasion
      || (i as WardrobeItem & { eventType?: string }).eventType)
    .find(Boolean) || null;
  const resolvedOccasion = occasionFromOpts || itemOccasion;

  return {
    items,
    signals,
    text: items.map(itemText).join(' | '),
    maxTier,
    minTier,
    tierSpread: maxTier - minTier,
    regional,
    options,
    occasion: resolvedOccasion ? String(resolvedOccasion) : null,
    isSmartCasualLook,
    has: (flag) => signals.every((s) => s[flag]),
    any: (flag) => signals.some((s) => s[flag]),
  };
}

/** Exported for Outfit Mix statement inventory / audits. */
export const CLASH_RULES: Array<{
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
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && (ctx.any('isJoggers') || ctx.any('isAthleticBottom') || ctx.any('isLoungeBottom')),
  },
  {
    id: 'tie_shorts',
    penalty: 88,
    hint: 'Tie with shorts — keep tailoring with full-length trousers',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && ctx.any('isShorts'),
  },
  {
    id: 'tie_uggs',
    penalty: 84,
    hint: 'Tie with UGG-style boots — formality lanes mixed',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && ctx.any('isUggs'),
  },
  {
    id: 'tie_low_formality_base',
    penalty: 86,
    hint: 'Tie needs smart-casual+ bottoms and shoes — not lounge or ultra-casual bases',
    severity: 'fatal',
    when: (ctx) => {
      if (!ctx.any('isTie')) return false;
      const bottoms = ctx.signals.filter((sig, i) => {
        const cat = String(ctx.items[i]?.category || '').toLowerCase();
        return cat === 'bottoms' || cat === 'activewear_bottoms' || sig.isShorts || sig.isJoggers || sig.isAthleticBottom || sig.isLoungeBottom || sig.isSuitPiece || sig.isSkirt;
      });
      const shoes = ctx.signals.filter((_sig, i) => String(ctx.items[i]?.category || '').toLowerCase() === 'shoes');
      const bottomOk = bottoms.length === 0 || bottoms.every((sig) => sig.formalityTier >= 3 && !sig.isShorts && !sig.isLoungeBottom && !sig.isAthleticBottom);
      const shoesOk = shoes.length === 0 || shoes.every((sig) => sig.formalityTier >= 3 && !sig.isUggs && !sig.isAthleticShoes);
      return !(bottomOk && shoesOk);
    },
  },
  {
    id: 'formal_accessory_lounge_bottom',
    penalty: 88,
    hint: 'Formal accessories clash with lounge or sweat bottoms',
    severity: 'fatal',
    when: (ctx) => ctx.any('isFormalAccessory') && (ctx.any('isLoungeBottom') || ctx.any('isAthleticBottom') || ctx.any('isJoggers')),
  },
  {
    id: 'fleece_shorts_season',
    penalty: 86,
    hint: 'Fleece/insulated outerwear with shorts — seasonal clash',
    severity: 'fatal',
    when: (ctx) => ctx.any('isFleeceOrInsulated') && ctx.any('isShorts'),
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
    id: 'tie_short_sleeve',
    penalty: 90,
    hint: 'A necktie needs a long-sleeve collared shirt — not short sleeves',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && ctx.any('isShortSleeve'),
  },
  {
    id: 'tie_linen_casual',
    penalty: 90,
    hint: 'Linen / camp shirts are too casual for a necktie',
    severity: 'fatal',
    when: (ctx) => {
      if (!ctx.any('isTie')) return false;
      return ctx.items.some((item, i) => {
        const s = ctx.signals[i];
        const cat = String(item.category || '').toLowerCase();
        const isTop = cat === 'tops' || cat === 'shirts' || cat === 'formal'
          || s.isDressShirt || s.isStructuredShirt;
        if (!isTop) return false;
        const t = `${item.name || ''} ${item.subcategory || ''}`.toLowerCase();
        return /linen/.test(t) || /(camp|cuban|bowling)\s+(shirt|top)/.test(t);
      });
    },
  },
  {
    id: 'tie_open_collar_casual',
    penalty: 86,
    hint: 'A tie needs a closed, structured collar — not an open casual neckline',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && /open[\s-]?collar|unbuttoned collar|spread casual|band collar|mandarin/.test(ctx.text),
  },
  {
    id: 'work_dress_tie_blocked',
    penalty: 92,
    hint: 'Ties don’t fit this workplace dress code — save them for business casual or formal',
    severity: 'fatal',
    when: (ctx) => {
      const code = String(ctx.options?.workDressCode || '').toLowerCase();
      return ctx.any('isTie') && (code === 'creative' || code === 'smart_casual');
    },
  },
  {
    id: 'casual_occasion_tie_blocked',
    penalty: 94,
    hint: 'Drop the tie for a casual day — keep the collared shirt open-collar or go without neckwear',
    severity: 'fatal',
    when: (ctx) => {
      if (!ctx.any('isTie')) return false;
      const occasion = String(ctx.occasion || ctx.options?.occasion || '').toLowerCase();
      return occasion === 'casual_day'
        || occasion === 'weekend'
        || occasion === 'casual';
    },
  },
  {
    id: 'tie_no_structured_collar',
    penalty: 88,
    hint: 'Tie needs a structured collared shirt',
    severity: 'fatal',
    when: (ctx) => ctx.any('isTie') && !ctx.any('isStructuredShirt') && !ctx.any('isDressShirt'),
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
    id: 'structured_shirt_sweat_bottom',
    penalty: 78,
    hint: 'Denim or button-down with sweat/jersey lounge bottoms — prefer chino or tailored shorts',
    severity: 'major',
    when: (ctx) => {
      if (!ctx.any('isStructuredShirt')) return false;
      if (!(ctx.any('isAthleticBottom') || ctx.any('isJoggers'))) return false;
      // Tee / hoodie / jersey / athletic tops are fine with sweat bottoms — only structured shirts clash
      const structuredTops = ctx.items.filter((i) => classifyItem(i).isStructuredShirt);
      if (structuredTops.length === 0) return false;
      return structuredTops.every((i) => {
        const s = classifyItem(i);
        return !s.isAthleticTop && !s.isHoodie && !/jersey|t-shirt|\btee\b/.test(itemText(i));
      });
    },
  },
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
    id: 'athletic_shorts_blazer',
    penalty: 88,
    hint: 'Athletic shorts with a blazer — sportswear and tailoring do not mix',
    severity: 'fatal',
    when: (ctx) => ctx.any('isBlazer') && (ctx.any('isAthleticShorts')
      || ctx.signals.some((s) => s.subtype === 'athletic_shorts' || s.subtype === 'cargo_shorts')),
  },
  {
    id: 'blazer_shorts_uggs',
    penalty: 84,
    hint: 'Blazer, shorts & UGGs clash',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isShorts') && ctx.any('isUggs') && !ctx.any('isTailoredShorts'),
  },
  {
    id: 'blazer_shorts_trainers',
    penalty: 78,
    hint: 'Blazer, shorts & trainers — formality lanes mixed',
    severity: 'major',
    when: (ctx) => !ctx.isSmartCasualLook && ctx.any('isBlazer') && ctx.any('isShorts') && ctx.any('isCasualTrainer')
      && !ctx.any('isTailoredShorts'),
  },
  {
    id: 'blazer_shorts',
    penalty: 74,
    hint: 'Blazer + casual shorts clash — keep blazers with tailored shorts, chinos, or trousers',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isShorts') && !ctx.any('isTailoredShorts'),
  },
  {
    id: 'slip_dress_chunky_trainer',
    penalty: 82,
    hint: 'Slip dress with chunky trainers — evening silhouette needs heels or minimal footwear',
    severity: 'major',
    when: (ctx) => (ctx.any('isSlipDress') || ctx.signals.some((s) => s.subtype === 'slip_dress' || s.subtype === 'bodycon_dress'))
      && ctx.any('isChunkyOrTechTrainer'),
  },
  {
    id: 'slip_dress_combat_boots',
    penalty: 80,
    hint: 'Slip dress with combat boots — street footwear undercuts the evening read',
    severity: 'major',
    when: (ctx) => (ctx.any('isSlipDress') || ctx.signals.some((s) => s.subtype === 'slip_dress' || s.subtype === 'bodycon_dress'))
      && ctx.any('isCombatBoots'),
  },
  {
    id: 'blazer_slides',
    penalty: 84,
    hint: 'Slides with a blazer — athleisure footwear collapses tailored formality',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isSlides'),
  },
  {
    id: 'blazer_combat_boots',
    penalty: 76,
    hint: 'Combat boots pull a blazer into street — keep combat with cargo/denim, not tailoring',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isCombatBoots'),
  },
  {
    id: 'blazer_leather_sandals',
    penalty: 72,
    hint: 'Leather sandals with a blazer — open casual footwear fights structured tailoring',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isLeatherSandals'),
  },
  {
    id: 'footwear_lane_mismatch',
    penalty: 78,
    hint: 'Footwear lane fights the rest of the outfit — shoes set the direction',
    severity: 'major',
    when: (ctx) => {
      const { conflicts } = detectSubtypeConflicts(ctx.items);
      return conflicts.some((c) => c.id === 'footwear_lane_mismatch' || c.id === 'dress_street_footwear');
    },
  },
  {
    id: 'occasion_footwear_lock',
    penalty: 88,
    hint: 'Formal occasion needs footwear formality of 4+ — these shoes read too casual',
    severity: 'fatal',
    when: (ctx) => {
      const occasion = String(ctx.occasion || ctx.options?.occasion || 'casual').toLowerCase();
      // work_outfit / work dress codes need smart shoes (oxford, loafer, Chelsea) — not rugged boots.
      if (
        !occasion
        || occasion === 'casual'
        || !/formal|black.?tie|gala|wedding|office|business|interview|work_outfit|work\b/.test(occasion)
      ) {
        return false;
      }
      // Creative / casual workplaces opt out via workDressCode.
      const dressCode = String(ctx.options?.workDressCode || '').toLowerCase();
      if (dressCode === 'creative' || dressCode === 'smart_casual') return false;

      return ctx.signals.some((s) => {
        const shoeLike = s.isCasualTrainer || s.isFormalShoes || s.isHeels || s.isBoots
          || s.isSlides || s.isLeatherSandals || s.isUggs || s.isCombatBoots;
        if (!shoeLike) return false;
        // Rugged / combat boots never pass office lock even if mis-tiered.
        if (s.isCombatBoots || (s.isBoots && !s.isDressyBoots && !s.isChelseaBoots && !s.isFormalShoes)) {
          return true;
        }
        return (s.formalityTier ?? 3) < 4;
      });
    },
  },
  {
    id: 'revealing_stack',
    penalty: 70,
    hint: 'Two revealing pieces compete — pick one hero silhouette',
    severity: 'major',
    when: (ctx) => ctx.signals.filter((s) => s.isRevealing).length >= 2,
  },
  {
    id: 'subtype_avoid_pair',
    penalty: 76,
    hint: 'Garment subtypes clash — lanes or pairing rules conflict',
    severity: 'major',
    when: (ctx) => {
      const { conflicts } = detectSubtypeConflicts(ctx.items);
      return conflicts.some((c) => {
        const pair = new Set([c.a, c.b]);
        if (pair.has('athletic_shorts') && pair.has('blazer')) return false;
        if (pair.has('joggers') && pair.has('blazer')) return false;
        if (pair.has('chunky_trainer') && pair.has('blazer')) return false;
        if (pair.has('runner') && pair.has('blazer')) return false;
        if (pair.has('slip_dress') && pair.has('chunky_trainer')) return false;
        if (pair.has('slip_dress') && pair.has('combat_boots')) return false;
        if (pair.has('blazer') && pair.has('slides')) return false;
        if (pair.has('blazer') && pair.has('combat_boots')) return false;
        if (c.id === 'revealing_stack' || c.id === 'footwear_lane_mismatch' || c.id === 'dress_street_footwear') return false;
        const hard: Array<[string, string]> = [
          ['oxford_shirt', 'athletic_shorts'],
          ['oxford_shirt', 'joggers'],
          ['tie', 'athletic_shorts'],
          ['heels', 'athletic_shorts'],
          ['stilettos', 'athletic_shorts'],
          ['oxfords', 'athletic_shorts'],
          ['loafers', 'athletic_shorts'],
          ['chelsea_boots', 'athletic_shorts'],
        ];
        return hard.some(([x, y]) => pair.has(x) && pair.has(y));
      });
    },
  },
  {
    id: 'evening_athletic_bottom',
    penalty: 80,
    hint: 'Evening wear with athletic bottoms',
    severity: 'major',
    when: (ctx) => ctx.any('isEveningWear') && (ctx.any('isAthleticBottom') || ctx.any('isJoggers') || (ctx.any('isShorts') && !ctx.any('isTailoredShorts'))),
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
    id: 'blazer_chunky_trainers',
    penalty: 78,
    hint: 'Chunky or technical athletic trainers with a blazer — keep tailoring with plain lifestyle sneakers or dress shoes',
    severity: 'major',
    when: (ctx) => ctx.any('isBlazer') && ctx.any('isChunkyOrTechTrainer'),
  },
  {
    id: 'joggers_blazer',
    penalty: 76,
    hint: 'Joggers or tracksuit bottoms with a blazer — athleisure and tailoring clash',
    severity: 'major',
    when: (ctx) => (ctx.any('isJoggers') || ctx.any('isAthleticBottom') || ctx.any('isLoungeBottom'))
      && ctx.any('isBlazer'),
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
    // Soft path: plain/minimal lifestyle trainers + smart bottoms can pass via isSmartCasualLook.
    // Chunky/tech already major via blazer_chunky_trainers; generic athletic trainers still penalize.
    when: (ctx) => !ctx.isSmartCasualLook
      && ctx.any('isBlazer')
      && ctx.any('isCasualTrainer')
      && !ctx.any('isFashionTrainer')
      && !ctx.any('isChunkyOrTechTrainer')
      && !ctx.any('isJeans')
      && !ctx.any('isAthleticTop'),
  },
  {
    id: 'shorts_formal_shoes',
    penalty: 58,
    hint: 'Shorts with formal shoes — sandals or trainers match better',
    severity: 'moderate',
    when: (ctx) => ctx.any('isShorts') && !ctx.any('isTailoredShorts')
      && (ctx.any('isFormalShoes') || ctx.any('isHeels')),
  },
  {
    id: 'shorts_boots',
    penalty: 48,
    hint: 'Shorts + heavy boots can feel unbalanced — try trainers or loafers',
    severity: 'moderate',
    when: (ctx) => ctx.any('isShorts') && ctx.any('isBoots') && !ctx.any('isAthleticTop') && !ctx.any('isTailoredShorts'),
  },
  {
    id: 'formality_span_lock',
    penalty: 82,
    hint: 'Formality span too wide — keep pieces within 2 tiers of each other',
    severity: 'fatal',
    when: (ctx) => ctx.tierSpread > 2,
  },
  {
    id: 'tier_spread_3',
    penalty: 56,
    hint: 'Formality mismatch across the outfit — pieces sit too far apart',
    severity: 'fatal',
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
  regionalOrOptions: RegionalStyleContext | ClashDetectOptions | null = null,
): OutfitClash | null {
  const matched = detectAllOutfitClashes(items, regionalOrOptions);
  if (matched.length === 0) return null;

  // Prefer specific garment clashes over generic formality/tier span when both fire.
  const primary = matched[0];
  if (/^formality_span|^tier_spread/.test(primary.id)) {
    const specific = matched.find(
      (c) => !/^formality_span|^tier_spread/.test(c.id)
        && (c.severity === 'fatal' || c.severity === 'major'),
    );
    if (specific) return specific;
  }
  return primary;
}

/**
 * Hard validity gate for candidate outfits.
 * Fatal/major clashes make an outfit impossible — not merely low-scored.
 * Moderate/minor stay as soft score pressure elsewhere.
 */
export function isOutfitValid(
  items: WardrobeItem[],
  regionalOrOptions: RegionalStyleContext | ClashDetectOptions | null = null,
): boolean {
  if (!items || items.length < 2) return true;
  const clashes = detectAllOutfitClashes(items, regionalOrOptions);
  return !clashes.some((c) => c.severity === 'fatal' || c.severity === 'major');
}

/** All clash rules that match, sorted by severity then penalty (highest first). */
export function detectAllOutfitClashes(
  items: WardrobeItem[],
  regionalOrOptions: RegionalStyleContext | ClashDetectOptions | null = null,
): OutfitClash[] {
  if (items.length < 2) return [];

  const ctx = buildOutfitContext(items, regionalOrOptions);
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
  regionalOrOptions: RegionalStyleContext | ClashDetectOptions | null = null,
): number {
  if (items.length < 2) return 0;

  const ctx = buildOutfitContext(items, regionalOrOptions);
  const matched = CLASH_RULES.filter((rule) => rule.when(ctx));
  if (matched.length <= 1) return 0;

  const extra = matched
    .filter((rule) => rule.id !== primary?.id && rule.severity !== 'minor')
    .slice(0, 2)
    .reduce((sum, rule) => sum + Math.round(rule.penalty * 0.12), 0);

  return Math.min(12, extra);
}

/** Actionable fix copy for clash IDs (mirrors server CLASH_SUGGESTIONS). */
export const CLASH_SUGGESTIONS: Record<string, string> = {
  slip_dress_chunky_trainer: 'Swap chunky trainers for heels or minimal sneakers with a slip dress',
  slip_dress_combat_boots: 'Swap combat boots for heels, stilettos, or polished ankle boots',
  blazer_slides: 'Swap slides for loafers, oxfords, or minimal sneakers under a blazer',
  blazer_combat_boots: 'Keep combat boots with cargo/denim — or swap to Chelsea boots under a blazer',
  blazer_leather_sandals: 'Swap sandals for loafers or minimal sneakers with a blazer',
  footwear_lane_mismatch: 'Let footwear set one direction — match shoes to the tailored or street lane',
  occasion_footwear_lock: 'Formal occasions need loafers, oxfords, heels, or Chelsea boots',
  tie_short_sleeve: 'Drop the tie with short sleeves — or switch to a long-sleeve collared shirt',
  tie_linen_casual: 'Drop the tie with linen or camp shirts — or switch to a dress shirt',
  work_dress_tie_blocked: 'Skip the tie for this workplace, or raise your work dress code in Settings',
  casual_occasion_tie_blocked: 'Drop the tie for a casual day — keep the collared shirt open-collar or go without neckwear',
  blazer_chunky_trainers: 'Swap chunky athletic trainers for plain white lifestyle sneakers, or drop the blazer',
  athletic_shorts_blazer: 'Swap athletic shorts for tailored shorts, chinos, or trousers',
  revealing_stack: 'Keep one revealing hero piece — tone down the second silhouette',
  subtype_avoid_pair: 'Swap one piece so subtypes share a lane',
};

export function clashToScore(penalty: number, extraPenalty = 0): number {
  return Math.max(5, Math.min(100, 100 - penalty - extraPenalty));
}

/** Band-aligned short labels (Style match %). Prefer selectAnalysisHint for full captions. */
export function scoreHintForValue(score: number, clashHint?: string): string {
  if (clashHint) return clashHint;
  if (score >= 90) return 'Excellent combo — polished and intentional';
  if (score >= 80) return 'Strong outfit';
  if (score >= 65) return 'Acceptable colour story — simplify to 2–3 tones';
  if (score >= 45) return 'Commit to one style lane — swap the piece that breaks the story';
  if (score >= 30) return 'Needs work';
  return 'Clash risk';
}

export function localScoreLooksLikeClash(score: number, hint: string): boolean {
  return score < 50 || /clash|needs work|formality|skew|gym|never pair|mismatch|unbalanced|accidental/i.test(hint);
}
