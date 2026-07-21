import type { WardrobeItem, ClothingSeason } from '@/contexts/WardrobeContext';

export type { ClothingSeason };
export type OutfitOccasion = 'office' | 'gym' | 'date' | 'travel' | 'casual' | 'weekend' | 'event';
export type BrandTier = 'luxury' | 'premium' | 'mid' | 'fast_fashion';

export type OutfitContextMeta = {
  season: ClothingSeason;
  occasion: OutfitOccasion;
  brand_tiers: BrandTier[];
  brand_coherence: number;
  season_fit: number;
};

const LUXURY_KEYWORDS = /\b(cashmere|silk|designer|couture|brioni|tom ford|gucci|prada|loro piana|hermes|burberry trench)\b/i;
const PREMIUM_KEYWORDS = /\b(blazer|oxford|merino|wool coat|leather jacket|chelsea|loafer|trench|tailored|suede)\b/i;
const FAST_FASHION_KEYWORDS = /\b(tee|t-shirt|hoodie|jogger|track pant|graphic|tank top|slides|flip flop|basic)\b/i;

const SUMMER_ITEMS = /\b(linen|shorts|sandal|slides|tank top|swim|mesh|cap sleeve)\b/i;
const WINTER_ITEMS = /\b(wool|coat|puffer|fleece|boot|turtleneck|cashmere|down jacket|thermal)\b/i;
const SPRING_ITEMS = /\b(light jacket|raincoat|cardigan|chino|denim jacket)\b/i;
const AUTUMN_ITEMS = /\b(flannel|corduroy|sweater|boot|layer|trench)\b/i;

function itemText(item: Pick<WardrobeItem, 'name' | 'category'>): string {
  return `${item.name || ''} ${item.category || ''}`.toLowerCase();
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function inferBrandTier(name: string): BrandTier {
  const t = name.toLowerCase();
  if (LUXURY_KEYWORDS.test(t)) return 'luxury';
  if (FAST_FASHION_KEYWORDS.test(t) && !PREMIUM_KEYWORDS.test(t)) return 'fast_fashion';
  if (PREMIUM_KEYWORDS.test(t)) return 'premium';
  return 'mid';
}

export function inferItemSeason(name: string): ClothingSeason[] {
  const t = name.toLowerCase();
  const seasons: ClothingSeason[] = [];
  if (SUMMER_ITEMS.test(t)) seasons.push('summer');
  if (WINTER_ITEMS.test(t)) seasons.push('winter');
  if (SPRING_ITEMS.test(t)) seasons.push('spring');
  if (AUTUMN_ITEMS.test(t)) seasons.push('autumn');
  if (seasons.length === 0) seasons.push('all-season');
  return seasons;
}

export function inferOutfitSeason(items: Pick<WardrobeItem, 'name' | 'category'>[]): ClothingSeason {
  const votes: Record<ClothingSeason, number> = {
    spring: 0, summer: 0, autumn: 0, winter: 0, 'all-season': 0,
  };
  for (const item of items) {
    for (const s of inferItemSeason(item.name || '')) votes[s]++;
  }
  const ranked = (Object.entries(votes) as [ClothingSeason, number][])
    .filter(([s]) => s !== 'all-season')
    .sort((a, b) => b[1] - a[1]);
  if (ranked[0] && ranked[0][1] > 0) return ranked[0][0];
  return 'all-season';
}

const OCCASION_POOL: OutfitOccasion[] = [
  'office', 'office', 'gym', 'gym', 'date', 'date', 'travel', 'travel',
  'casual', 'casual', 'casual', 'weekend', 'weekend', 'event',
];

export function assignOccasion(
  items: Pick<WardrobeItem, 'name' | 'category'>[],
  styleCategory: string,
  seed: string,
): OutfitOccasion {
  const text = items.map(itemText).join(' ');
  const cat = styleCategory.toLowerCase();

  if (/\b(track pant|jogger|legging|tank top|gym|running)\b/.test(text)) return 'gym';
  if (/\b(blazer|trouser|oxford|dress shirt|suit)\b/.test(text) && cat === 'business') return 'office';
  if (/\b(heels|slip dress|silk|cocktail)\b/.test(text)) return 'date';
  if (/\b(cargo|hoodie|backpack|comfort|jogger)\b/.test(text) && /travel|sport/.test(cat)) return 'travel';
  if (cat === 'sport') return 'gym';
  if (cat === 'business') return 'office';
  if (cat === 'minimal' || cat === 'casual') return 'casual';

  const idx = hashSeed(seed) % OCCASION_POOL.length;
  return OCCASION_POOL[idx];
}

export function assignBrandTiers(
  items: Pick<WardrobeItem, 'name'>[],
  seed: string,
): BrandTier[] {
  const base = items.map((i) => inferBrandTier(i.name || ''));
  const h = hashSeed(seed);
  // ~12% outfits mix tiers intentionally
  if (h % 8 === 0 && base.length >= 2) {
    const bump = (h % 3 === 0) ? 'luxury' : 'fast_fashion';
    const idx = h % base.length;
    base[idx] = bump;
  }
  return base;
}

const TIER_RANK: Record<BrandTier, number> = {
  fast_fashion: 0,
  mid: 1,
  premium: 2,
  luxury: 3,
};

export function scoreBrandCoherence(tiers: BrandTier[]): number {
  if (tiers.length === 0) return 0.8;
  const ranks = tiers.map((t) => TIER_RANK[t]);
  const spread = Math.max(...ranks) - Math.min(...ranks);
  if (spread === 0) return 1;
  if (spread === 1) return 0.88;
  if (spread === 2) return 0.62;
  return 0.35; // luxury + fast_fashion
}

export function scoreSeasonFit(
  items: Pick<WardrobeItem, 'name' | 'category'>[],
  targetSeason: ClothingSeason,
): number {
  if (targetSeason === 'all-season') return 0.85;

  const text = items.map(itemText).join(' ');
  let score = 0.82;
  const itemSeasons = items.flatMap((i) => inferItemSeason(i.name || ''));

  const matchCount = itemSeasons.filter((s) => s === targetSeason || s === 'all-season').length;
  const matchRatio = matchCount / Math.max(itemSeasons.length, 1);
  score = 0.5 + matchRatio * 0.45;

  const seasonMismatch: Record<ClothingSeason, RegExp> = {
    summer: /\b(wool coat|puffer|fleece|boot|thermal|turtleneck)\b/i,
    winter: /\b(sandals|slides|shorts|linen|tank top)\b/i,
    spring: /\b(puffer|down jacket|swim)\b/i,
    autumn: /\b(sandals|tank top|swim)\b/i,
    'all-season': /$^/,
  };

  if (seasonMismatch[targetSeason]?.test(text)) score -= 0.35;
  if (targetSeason === 'summer' && /\b(sandals|slides)\b/.test(text)) score += 0.08;
  if (targetSeason === 'winter' && /\b(boot|wool|coat)\b/.test(text)) score += 0.08;

  return Math.max(0.15, Math.min(1, score));
}

export function enrichOutfitContext(
  items: WardrobeItem[],
  styleCategory: string,
  seed: string,
): OutfitContextMeta {
  const season = inferOutfitSeason(items);
  const occasion = assignOccasion(items, styleCategory, seed);
  const brand_tiers = assignBrandTiers(items, seed);
  const brand_coherence = scoreBrandCoherence(brand_tiers);
  const season_fit = scoreSeasonFit(items, season);

  return {
    season,
    occasion,
    brand_tiers,
    brand_coherence: Math.round(brand_coherence * 100) / 100,
    season_fit: Math.round(season_fit * 100) / 100,
  };
}

export function applyBrandTiersToItems(
  items: WardrobeItem[],
  tiers: BrandTier[],
): WardrobeItem[] {
  return items.map((item, i) => ({
    ...item,
    brand: tiers[i] ?? inferBrandTier(item.name || ''),
    seasons: inferItemSeason(item.name || '') as WardrobeItem['seasons'],
  }));
}
