/**
 * Normalize AI season/occasion labels to wardrobe chip values.
 * Always prefer a non-empty selection so single-upload can save with one tap.
 */

export type ClothingSeasonChip = 'spring' | 'summer' | 'autumn' | 'winter' | 'all-season';
export type ClothingOccasionChip =
  | 'casual'
  | 'work'
  | 'formal'
  | 'date-night'
  | 'workout'
  | 'vacation'
  | 'party'
  | 'everyday';

export const VALID_SEASON_CHIPS: ClothingSeasonChip[] = [
  'spring', 'summer', 'autumn', 'winter', 'all-season',
];

export const VALID_OCCASION_CHIPS: ClothingOccasionChip[] = [
  'casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday',
];

const SEASON_ALIASES: Record<string, ClothingSeasonChip> = {
  fall: 'autumn',
  'all-year': 'all-season',
  'all year': 'all-season',
  'all season': 'all-season',
  'all seasons': 'all-season',
  allseason: 'all-season',
  'year-round': 'all-season',
  'year round': 'all-season',
  allyear: 'all-season',
};

const OCCASION_ALIASES: Record<string, ClothingOccasionChip> = {
  sport: 'workout',
  sports: 'workout',
  gym: 'workout',
  sportswear: 'workout',
  athletic: 'workout',
  exercise: 'workout',
  training: 'workout',
  'smart-casual': 'casual',
  'smart casual': 'casual',
  outdoor: 'casual',
  outdoors: 'casual',
  travel: 'vacation',
  office: 'work',
  professional: 'work',
  business: 'work',
  evening: 'date-night',
  night: 'date-night',
  'night out': 'date-night',
  nightout: 'date-night',
  beach: 'vacation',
  lounge: 'casual',
  loungewear: 'casual',
  special: 'formal',
  'special occasion': 'formal',
  wedding: 'formal',
  gala: 'formal',
  cocktail: 'party',
  festival: 'party',
  club: 'party',
  brunch: 'casual',
  daily: 'everyday',
  day: 'everyday',
  daytime: 'everyday',
};

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,/|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeSeasonChips(raw: unknown): ClothingSeasonChip[] {
  const out: ClothingSeasonChip[] = [];
  for (const s of asList(raw)) {
    const lower = s.toLowerCase().trim();
    let mapped: ClothingSeasonChip | null = null;
    if (VALID_SEASON_CHIPS.includes(lower as ClothingSeasonChip)) {
      mapped = lower as ClothingSeasonChip;
    } else if (SEASON_ALIASES[lower]) {
      mapped = SEASON_ALIASES[lower];
    }
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

export function normalizeOccasionChips(raw: unknown): ClothingOccasionChip[] {
  const out: ClothingOccasionChip[] = [];
  for (const o of asList(raw)) {
    const lower = o.toLowerCase().trim();
    let mapped: ClothingOccasionChip | null = null;
    if (VALID_OCCASION_CHIPS.includes(lower as ClothingOccasionChip)) {
      mapped = lower as ClothingOccasionChip;
    } else if (OCCASION_ALIASES[lower]) {
      mapped = OCCASION_ALIASES[lower];
    }
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

export function inferDefaultSeasons(ctx: {
  category?: string | null;
  style?: string | null;
  type?: string | null;
} = {}): ClothingSeasonChip[] {
  const blob = `${ctx.category || ''} ${ctx.style || ''} ${ctx.type || ''}`.toLowerCase();
  if (/swim|beach|sandal|short sleeve|tank/.test(blob) && /summer|beach|swim/.test(blob)) {
    return ['summer'];
  }
  if (/swimwear|swimsuit|bikini/.test(blob)) return ['summer'];
  if (/puffer|parka|winter coat|snow|thermal/.test(blob)) return ['autumn', 'winter'];
  if (/outerwear|coat|blazer/.test(blob) && /winter|wool|heavy/.test(blob)) return ['autumn', 'winter'];
  return ['all-season'];
}

export function inferDefaultOccasions(ctx: {
  category?: string | null;
  style?: string | null;
  type?: string | null;
} = {}): ClothingOccasionChip[] {
  const blob = `${ctx.category || ''} ${ctx.style || ''} ${ctx.type || ''}`.toLowerCase();
  if (/activewear|workout|gym|sport|athletic|jersey|training/.test(blob)) return ['workout', 'casual'];
  if (/formal|suit|blazer|tuxedo|gown|dress shirt/.test(blob)) return ['formal', 'work'];
  if (/party|evening|cocktail|club/.test(blob)) return ['party', 'date-night'];
  if (/swim|vacation|beach|resort/.test(blob)) return ['vacation', 'casual'];
  if (/sleep|lounge|pajama|pyjama/.test(blob)) return ['everyday', 'casual'];
  if (/work|office|business|professional/.test(blob)) return ['work', 'everyday'];
  return ['everyday', 'casual'];
}

/** Map AI arrays → chips, falling back to inferred defaults so save is never blocked. */
export function resolveSeasonChips(
  raw: unknown,
  ctx?: { category?: string | null; style?: string | null; type?: string | null },
): ClothingSeasonChip[] {
  const mapped = normalizeSeasonChips(raw);
  return mapped.length > 0 ? mapped : inferDefaultSeasons(ctx);
}

export function resolveOccasionChips(
  raw: unknown,
  ctx?: { category?: string | null; style?: string | null; type?: string | null },
): ClothingOccasionChip[] {
  const mapped = normalizeOccasionChips(raw);
  return mapped.length > 0 ? mapped : inferDefaultOccasions(ctx);
}
