import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isAccessoryItem,
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';

const DEFAULT_MAX_PER_ROLE = 10;

function candidateScore(item: WardrobeItem): number {
  let score = 0;
  if (item.isFavorite) score += 40;
  if (typeof item.wardrobeConfidence === 'number') {
    score += Math.max(0, Math.min(1, item.wardrobeConfidence)) * 35;
  }
  if (item.imageProcessed) score += 12;
  if (item.imageUri || item.enhancedImageUri) score += 8;
  // Prefer lightly worn items over never-worn and over overused.
  const worn = item.timesWorn || 0;
  if (worn === 0) score += 4;
  else if (worn <= 8) score += 10;
  else score += 2;
  const updated = Date.parse(item.updatedAt || item.createdAt || '') || 0;
  if (updated > 0) {
    const ageDays = Math.max(0, (Date.now() - updated) / (1000 * 60 * 60 * 24));
    score += Math.max(0, 15 - Math.min(15, ageDays / 7));
  }
  return score;
}

function pickRole(
  items: WardrobeItem[],
  predicate: (item: WardrobeItem) => boolean,
  limit: number,
): WardrobeItem[] {
  return items
    .filter(predicate)
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .slice(0, limit);
}

/**
 * Outfit generation must not combinatorial-search the entire wardrobe.
 * Keep metadata for all items, but allocate from a scored subset.
 */
export function selectOutfitCandidatePool(
  items: WardrobeItem[],
  maxPerRole: number = DEFAULT_MAX_PER_ROLE,
): WardrobeItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (items.length <= maxPerRole * 4) return items;

  const tops = pickRole(items, isTopItem, maxPerRole);
  const bottoms = pickRole(items, isBottomItem, maxPerRole);
  const shoes = pickRole(items, isShoesItem, maxPerRole);
  const outerwear = pickRole(items, isOuterwearItem, Math.min(5, maxPerRole));
  const accessories = pickRole(items, isAccessoryItem, Math.min(5, maxPerRole));
  const dresses = pickRole(
    items,
    (item) => item.category === 'dresses' || item.category === 'formal',
    maxPerRole,
  );

  const seen = new Set<string>();
  const out: WardrobeItem[] = [];
  for (const item of [...tops, ...bottoms, ...shoes, ...outerwear, ...accessories, ...dresses]) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}
