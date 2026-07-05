import { PANTONE_COLOR_OF_YEAR_BY_YEAR, type PantoneColorOfYearEntry } from '@/data/pantoneColorOfYear';
import { getCurrentCalendarSeason, getCurrentFashionYear } from '@/utils/fashionSeason';

export interface ColorOfTheYearDisplay extends PantoneColorOfYearEntry {
  year: number;
  source?: 'pantone' | 'api' | 'fallback' | 'ai-detected';
}

export function getKnownColorOfTheYear(year = getCurrentFashionYear()): ColorOfTheYearDisplay | null {
  const entry = PANTONE_COLOR_OF_YEAR_BY_YEAR[year];
  if (!entry) return null;
  return { ...entry, year, source: 'pantone' };
}

/** Offline-safe COTY — current year from verified map, else previous year. */
export function buildOfflineColorOfTheYear(year = getCurrentFashionYear()): ColorOfTheYearDisplay {
  const current = getKnownColorOfTheYear(year);
  if (current) return current;

  const previous = getKnownColorOfTheYear(year - 1);
  if (previous) {
    return { ...previous, year, source: 'fallback' };
  }

  const legacy = PANTONE_COLOR_OF_YEAR_BY_YEAR[2025];
  return { ...legacy, year, source: 'fallback' };
}

export function normalizeApiColorOfTheYear(
  raw: unknown,
  fallbackYear = getCurrentFashionYear(),
): ColorOfTheYearDisplay | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const name = record.name as string | undefined;
  const hexCode = (record.hexCode ?? record.hex) as string | undefined;
  if (!name || !hexCode) return null;

  const suitableFor = record.suitableFor as string[] | undefined;
  const bestFor = (record.bestFor as string[] | undefined)
    ?? suitableFor?.map((v) => v.charAt(0).toUpperCase() + v.slice(1));

  return {
    name,
    hexCode,
    pantoneCode: record.pantoneCode as string | undefined,
    description: (record.description as string) || '',
    pairingColors: (record.pairingColors as string[]) || [],
    bestFor: bestFor || ['Neutral'],
    year: (record.year as number) || fallbackYear,
    source: 'api',
  };
}

export interface SeasonalPaletteColor {
  id: string;
  name: string;
  hexCode: string;
  pantoneCode?: string;
  season: string;
  year: number;
  description: string;
  pairingColors: string[];
  bestFor: string[];
}

export function buildOfflineSeasonalPalette(year = getCurrentFashionYear()): SeasonalPaletteColor[] {
  const season = getCurrentCalendarSeason();
  const seasonLabel = season.charAt(0).toUpperCase() + season.slice(1);

  const palettes: Record<string, SeasonalPaletteColor[]> = {
    spring: [
      { id: `${year}-sp-1`, name: 'Powder Blue', hexCode: '#B0C4DE', pantoneCode: 'PANTONE 14-4318', season: seasonLabel, year, description: 'A soft sky blue for fresh spring layering.', pairingColors: ['#FFFFFF', '#1A1A1A', '#C9A87C'], bestFor: ['Cool', 'Neutral'] },
      { id: `${year}-sp-2`, name: 'Warm Putty', hexCode: '#C8BAA6', pantoneCode: 'PANTONE 14-1108', season: seasonLabel, year, description: 'A grounded neutral that pairs with almost everything.', pairingColors: ['#1A1A1A', '#2E3B8F', '#FFFFFF'], bestFor: ['Warm', 'Neutral'] },
      { id: `${year}-sp-3`, name: 'Terracotta Dusk', hexCode: '#C47A5A', pantoneCode: 'PANTONE 17-1436', season: seasonLabel, year, description: 'Earthy warmth for transitional spring days.', pairingColors: ['#FFFFFF', '#1A1A1A', '#C8BAA6'], bestFor: ['Warm', 'Neutral'] },
      { id: `${year}-sp-4`, name: 'Forest Shadow', hexCode: '#4A5E4A', pantoneCode: 'PANTONE 18-0125', season: seasonLabel, year, description: 'Deep green for polished spring contrast.', pairingColors: ['#FFFFFF', '#C8BAA6', '#1A1A1A'], bestFor: ['Cool', 'Neutral'] },
    ],
    summer: [
      { id: `${year}-su-1`, name: 'Sky Blue', hexCode: '#87CEEB', season: 'Summer', year, description: 'Light and airy for warm-weather wardrobes.', pairingColors: ['#FFFFFF', '#F5F5DC', '#FFD1DC'], bestFor: ['Cool', 'Neutral', 'Warm'] },
      { id: `${year}-su-2`, name: 'Butter Yellow', hexCode: '#FFFACD', season: 'Summer', year, description: 'Soft sunny yellow without overpowering the look.', pairingColors: ['#FFFFFF', '#000000', '#87CEEB'], bestFor: ['Warm', 'Neutral'] },
      { id: `${year}-su-3`, name: 'Mint Green', hexCode: '#98FB98', season: 'Summer', year, description: 'Fresh green for breathable summer outfits.', pairingColors: ['#FFFFFF', '#000000', '#F5F5DC'], bestFor: ['Cool', 'Neutral'] },
      { id: `${year}-su-4`, name: 'Cherry Red', hexCode: '#DE3163', season: 'Summer', year, description: 'Bold accent red for evening and statement looks.', pairingColors: ['#FFFFFF', '#000000', '#F5F5DC'], bestFor: ['Cool', 'Neutral'] },
    ],
    autumn: [
      { id: `${year}-au-1`, name: 'Burgundy Wine', hexCode: '#722F37', season: 'Autumn', year, description: 'Rich wine red for layered autumn elegance.', pairingColors: ['#F5F5DC', '#C19A6B', '#000000'], bestFor: ['Cool', 'Neutral', 'Warm'] },
      { id: `${year}-au-2`, name: 'Forest Green', hexCode: '#228B22', season: 'Autumn', year, description: 'Natural green that grounds autumn palettes.', pairingColors: ['#F5F5DC', '#C19A6B', '#FFFFFF'], bestFor: ['Warm', 'Neutral'] },
      { id: `${year}-au-3`, name: 'Rust Orange', hexCode: '#B7410E', season: 'Autumn', year, description: 'Warm earthy orange inspired by falling leaves.', pairingColors: ['#F5F5DC', '#2C3E50', '#FFFFFF'], bestFor: ['Warm', 'Neutral'] },
      { id: `${year}-au-4`, name: 'Camel', hexCode: '#C19A6B', season: 'Autumn', year, description: 'Timeless neutral for polished autumn layering.', pairingColors: ['#FFFFFF', '#000000', '#722F37'], bestFor: ['Warm', 'Neutral'] },
    ],
    winter: [
      { id: `${year}-wi-1`, name: 'Cobalt Blue', hexCode: '#0047AB', season: 'Winter', year, description: 'Electric blue that lifts winter wardrobes.', pairingColors: ['#FFFFFF', '#C0C0C0', '#000000'], bestFor: ['Cool', 'Neutral'] },
      { id: `${year}-wi-2`, name: 'Emerald', hexCode: '#50C878', season: 'Winter', year, description: 'Jewel-toned green for evening and holiday looks.', pairingColors: ['#FFD700', '#000000', '#FFFFFF'], bestFor: ['Cool', 'Warm', 'Neutral'] },
      { id: `${year}-wi-3`, name: 'Charcoal', hexCode: '#36454F', season: 'Winter', year, description: 'Modern alternative to black for winter outfits.', pairingColors: ['#FFFFFF', '#C0C0C0', '#87CEEB'], bestFor: ['Cool', 'Neutral', 'Warm'] },
      { id: `${year}-wi-4`, name: 'Classic Navy', hexCode: '#000080', season: 'Winter', year, description: 'Forever versatile — softer than black near the face.', pairingColors: ['#FFFFFF', '#F5F5DC', '#E74C3C'], bestFor: ['Cool', 'Neutral', 'Warm'] },
    ],
  };

  return palettes[season] ?? palettes.spring;
}
