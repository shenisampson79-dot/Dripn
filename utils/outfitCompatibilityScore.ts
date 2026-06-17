import type { WardrobeItem } from '@/contexts/WardrobeContext';

export interface OutfitScoreResult {
  score: number;
  hint: string;
}

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'gray', 'navy', 'beige', 'cream', 'denim', 'brown', 'multicolor',
]);

const CASUAL_CATEGORIES = new Set([
  'activewear', 'activewear_tops', 'activewear_bottoms', 'sleepwear', 'swimwear',
]);

export function computeLocalOutfitScore(selected: WardrobeItem[]): OutfitScoreResult {
  if (selected.length === 0) {
    return { score: 0, hint: 'Swipe rows to build a look' };
  }

  if (selected.length === 1) {
    return { score: 28, hint: 'Add more pieces to score the outfit' };
  }

  let score = 52;
  const categories = new Set(selected.map((item) => item.category));
  const names = selected.map((item) => (item.name || '').toLowerCase()).join(' ');

  const hasTop = categories.has('tops') || categories.has('activewear_tops');
  const hasBottom = categories.has('bottoms') || categories.has('activewear_bottoms');
  const hasDress = categories.has('dresses');
  const hasShoes = categories.has('shoes');
  const hasOuterwear = categories.has('outerwear');

  if (hasDress && !hasBottom) score += 14;
  else if (hasTop && hasBottom) score += 16;
  else if (hasTop || hasBottom) score += 4;

  if (hasShoes) score += 8;
  if (hasOuterwear && selected.length >= 3) score += 5;
  if (selected.length >= 4) score += 4;

  const colors = selected.map((item) => item.color).filter(Boolean) as string[];
  const uniqueColors = new Set(colors);
  if (uniqueColors.size <= 2) score += 12;
  else if (uniqueColors.size <= 3) score += 8;
  else if (uniqueColors.size >= 5) score -= 14;

  if (colors.some((color) => NEUTRAL_COLORS.has(color))) score += 6;

  const seasons = selected.flatMap((item) => item.seasons || []);
  if (seasons.length > 0) {
    const seasonSet = new Set(seasons);
    if (seasonSet.size <= 2 || seasonSet.has('all-season')) score += 4;
    if (seasonSet.size >= 4) score -= 6;
  }

  if (hasDress && hasBottom) score -= 18;
  if (categories.has('formal') && [...categories].some((cat) => CASUAL_CATEGORIES.has(cat))) score -= 22;
  if (names.includes('tie') && (names.includes('jersey') || names.includes('jogger') || names.includes('sneaker'))) {
    score -= 45;
  }

  score = Math.max(5, Math.min(94, Math.round(score)));

  let hint = 'Decent mix';
  if (score >= 82) hint = 'Strong outfit';
  else if (score >= 68) hint = 'Good combo';
  else if (score >= 50) hint = 'Room to refine';
  else if (score >= 32) hint = 'Needs work';
  else hint = 'Clash risk';

  return { score, hint };
}
