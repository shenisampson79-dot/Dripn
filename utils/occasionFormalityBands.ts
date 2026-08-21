/**
 * Nice-dinner / elevated occasion compatibility — formality bands + candidate filters.
 * Mirrors Dripn-Server/services/occasionFormalityBands.js
 */

export type FormalityBand =
  | 'casual'
  | 'elevated_casual'
  | 'smart_casual'
  | 'evening_out'
  | 'date_night'
  | 'work'
  | 'formal';

export const FORMALITY_BANDS = {
  casual: 'casual',
  elevated_casual: 'elevated_casual',
  smart_casual: 'smart_casual',
  evening_out: 'evening_out',
  date_night: 'date_night',
  work: 'work',
  formal: 'formal',
} as const;

type ItemLike = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
};

export function occasionToFormalityBand(occasion?: string | null): FormalityBand {
  const occ = String(occasion || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (!occ) return FORMALITY_BANDS.casual;
  if (['formal', 'formal_event', 'black_tie', 'wedding', 'gala', 'white_tie'].includes(occ)) {
    return FORMALITY_BANDS.formal;
  }
  if (['work', 'work_outfit', 'office', 'business', 'interview', 'job_interview'].includes(occ)) {
    return FORMALITY_BANDS.work;
  }
  if (['date_night', 'first_date', 'date'].includes(occ)) return FORMALITY_BANDS.date_night;
  if (['evening_out', 'evening', 'dinner', 'party', 'cocktail', 'night_out'].includes(occ)) {
    return FORMALITY_BANDS.evening_out;
  }
  if (['smart_casual', 'smartcasual'].includes(occ)) return FORMALITY_BANDS.smart_casual;
  if (['elevated_casual', 'elevated', 'nice_dinner', 'somewhere_nice'].includes(occ)) {
    return FORMALITY_BANDS.elevated_casual;
  }
  return FORMALITY_BANDS.casual;
}

export function isElevatedBand(band: FormalityBand): boolean {
  return (
    band === FORMALITY_BANDS.elevated_casual
    || band === FORMALITY_BANDS.smart_casual
    || band === FORMALITY_BANDS.evening_out
    || band === FORMALITY_BANDS.date_night
    || band === FORMALITY_BANDS.work
    || band === FORMALITY_BANDS.formal
  );
}

function itemText(item: ItemLike = {}): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${item.brand || ''}`.toLowerCase();
}

function isFootwear(item: ItemLike = {}): boolean {
  const cat = String(item.category || '').toLowerCase();
  return cat === 'shoes' || cat === 'footwear' || /shoe|footwear|boot/.test(cat);
}

function isBottom(item: ItemLike = {}): boolean {
  const cat = String(item.category || '').toLowerCase();
  return cat === 'bottoms' || /bottom|trouser|pant|short|skirt|jean/.test(cat);
}

export function isChunkyOutdoorBoot(item: ItemLike = {}): boolean {
  if (!isFootwear(item)) return false;
  const t = itemText(item);
  if (
    /\b(chelsea|loafer|derby|oxford|dress\s*boot|ankle\s*boot)\b/.test(t)
    && !/\b(hiking|trail|combat|chunky|work\s*boot|timberland|doc\b|marten)\b/.test(t)
  ) {
    return false;
  }
  return (
    /\b(chunky\s*boot|combat\s*boot|hiking\s*boot|trail\s*boot|work\s*boot|doc\b|dr\.?\s*marten|timberland|army\s*boot|outdoor\s*boot|walking\s*boot)\b/.test(t)
    || (/\bboots?\b/.test(t) && /\b(hiking|trail|combat|chunky|outdoor|utility|work)\b/.test(t))
  );
}

export function isCargoShorts(item: ItemLike = {}): boolean {
  return /\bcargo\s*shorts?\b/.test(itemText(item));
}

export function isCargoBottom(item: ItemLike = {}): boolean {
  return /\bcargo(?:\s*(?:pant|trouser|short))?s?\b/.test(itemText(item));
}

export function isShortsItem(item: ItemLike = {}): boolean {
  if (!isBottom(item) && !/\bshorts?\b/.test(itemText(item))) return false;
  const t = itemText(item);
  if (/\b(trouser|pant|chino|jean|skirt)\b/.test(t) && !/\bshorts?\b/.test(t)) return false;
  return /\bshorts?\b/.test(t) || String(item.subcategory || '').toLowerCase().includes('short');
}

export function isTailoredOrLinenShorts(item: ItemLike = {}): boolean {
  const t = itemText(item);
  const sub = String(item.subcategory || '').toLowerCase();
  return (
    sub === 'tailored_shorts'
    || sub === 'linen_shorts'
    || /\b(tailored|linen|chinos?\s*shorts?|dress\s*shorts?)\b/.test(t)
  );
}

export function isAthleticOuterwear(item: ItemLike = {}): boolean {
  const cat = String(item.category || '').toLowerCase();
  const t = itemText(item);
  if (/\b(blazer|suit|tailored|wool\s*coat|overcoat)\b/.test(t)) return false;
  return (
    (cat === 'outerwear' || /jacket|coat|track|windbreaker/.test(t))
    && /\b(athletic|sports?|track|windbreaker|training|adidas|nike)\b/.test(t)
  );
}

export function warmWeatherAllowsShorts(weather?: { temperature?: number; temp?: number } | null): boolean {
  if (!weather || typeof weather !== 'object') return false;
  const temp = weather.temperature ?? weather.temp;
  if (typeof temp !== 'number' || Number.isNaN(temp)) return false;
  return temp >= 22;
}

export function elevatedCandidateBanReason(
  item: ItemLike,
  occasion?: string | null,
  options: { weather?: { temperature?: number; temp?: number } | null } = {},
): string | null {
  const band = occasionToFormalityBand(occasion);
  if (!isElevatedBand(band) || !item) return null;
  const weather = options.weather || null;
  const t = itemText(item);

  if (band === FORMALITY_BANDS.formal || band === FORMALITY_BANDS.work) {
    if (isCargoBottom(item)) return 'cargo';
    if (isChunkyOutdoorBoot(item)) return 'chunky_outdoor_boot';
    if (isAthleticOuterwear(item)) return 'athletic_outerwear';
    if (isShortsItem(item) && !isTailoredOrLinenShorts(item)) return 'shorts_not_elevated';
    if (isShortsItem(item) && !warmWeatherAllowsShorts(weather) && band === FORMALITY_BANDS.formal) {
      return 'shorts_need_warm_weather';
    }
  }

  if (
    band === FORMALITY_BANDS.evening_out
    || band === FORMALITY_BANDS.date_night
    || band === FORMALITY_BANDS.smart_casual
    || band === FORMALITY_BANDS.elevated_casual
  ) {
    if (isCargoShorts(item)) return 'cargo_shorts';
    if (
      band !== FORMALITY_BANDS.elevated_casual
      && isCargoBottom(item)
      && /\bcargo\s*(pant|trouser)/.test(t)
      && (band === FORMALITY_BANDS.evening_out || band === FORMALITY_BANDS.date_night)
    ) {
      return 'cargo_utility';
    }
    if (isChunkyOutdoorBoot(item)) return 'chunky_outdoor_boot';
    if (isAthleticOuterwear(item)) return 'athletic_outerwear';
    if (isShortsItem(item)) {
      if (isCargoShorts(item)) return 'cargo_shorts';
      if (
        !isTailoredOrLinenShorts(item)
        && (band === FORMALITY_BANDS.evening_out || band === FORMALITY_BANDS.date_night)
      ) {
        return 'shorts_not_elevated';
      }
      if (!warmWeatherAllowsShorts(weather)) return 'shorts_need_warm_weather';
    }
  }

  return null;
}

export const NICE_DINNER_COMPATIBILITY_CONTRACT = {
  version: 1,
  elevatedRules: {
    preferBottoms: ['clean trousers', 'chinos', 'dark denim'],
    preferFootwear: ['loafers', 'chelsea boots', 'derby/oxford', 'clean refined sneakers (elevated_casual only)'],
    shorts: 'only with warm-weather justification (temp ≥ 22°C) and tailored/linen — never cargo',
    chunkyOutdoorBoots: 'normally blocked on elevated bands',
    cargoShorts: 'blocked on elevated bands',
    athleticOuterwear: 'blocked on elevated bands',
  },
  applyAt: 'candidate_filter_before_selection',
} as const;
