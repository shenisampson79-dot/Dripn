import { ClothingCategory } from '@/contexts/WardrobeContext';

export const MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING = 3;

export const WARDROBE_TOP_CATEGORIES: ClothingCategory[] = ['tops', 'activewear_tops'];
export const WARDROBE_BOTTOM_CATEGORIES: ClothingCategory[] = ['bottoms', 'activewear_bottoms'];
export const WARDROBE_SHOE_CATEGORIES: ClothingCategory[] = ['shoes'];

export type WardrobeOutfitBasicCounts = {
  tops: number;
  bottoms: number;
  shoes: number;
};

export function countWardrobeOutfitBasics(
  items: Array<{ category: ClothingCategory; origin?: string }>,
): WardrobeOutfitBasicCounts {
  const owned = items.filter((item) => item.origin !== 'inspiration');

  return {
    tops: owned.filter((item) => WARDROBE_TOP_CATEGORIES.includes(item.category)).length,
    bottoms: owned.filter((item) => WARDROBE_BOTTOM_CATEGORIES.includes(item.category)).length,
    shoes: owned.filter((item) => WARDROBE_SHOE_CATEGORIES.includes(item.category)).length,
  };
}

export function canOfferOutfitPlanning(counts: WardrobeOutfitBasicCounts): boolean {
  return (
    counts.tops >= MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING &&
    counts.bottoms >= MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING &&
    counts.shoes >= MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING
  );
}

function remaining(have: number): number {
  return Math.max(0, MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING - have);
}

/** User-facing copy when the wardrobe is not yet ready for outfit planning. */
export function describeOutfitPlanningGap(
  counts: WardrobeOutfitBasicCounts,
  translate?: (key: string) => string,
): string {
  const t = (key: string, fallback: string) => {
    const value = translate?.(key);
    return value && value.trim() ? value : fallback;
  };

  const needTops = remaining(counts.tops);
  const needBottoms = remaining(counts.bottoms);
  const needShoes = remaining(counts.shoes);

  if (needTops === MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING &&
      needBottoms === MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING &&
      needShoes === MIN_WARDROBE_PIECES_FOR_OUTFIT_PLANNING) {
    return t(
      'home.wardrobeNeedBasics',
      'Add at least 3 tops, 3 bottoms, and 3 pairs of shoes — then we can plan full outfits from your wardrobe.',
    );
  }

  const gaps: string[] = [];
  if (needTops > 0) {
    gaps.push(
      needTops === 1
        ? t('home.wardrobeGapOneTop', '1 more top')
        : t('home.wardrobeGapMoreTops', '{count} more tops').replace('{count}', String(needTops)),
    );
  }
  if (needBottoms > 0) {
    gaps.push(
      needBottoms === 1
        ? t('home.wardrobeGapOneBottom', '1 more bottom')
        : t('home.wardrobeGapMoreBottoms', '{count} more bottoms').replace('{count}', String(needBottoms)),
    );
  }
  if (needShoes > 0) {
    gaps.push(
      needShoes === 1
        ? t('home.wardrobeGapOneShoe', '1 more pair of shoes')
        : t('home.wardrobeGapMoreShoes', '{count} more pairs of shoes').replace('{count}', String(needShoes)),
    );
  }

  return t(
    'home.wardrobeNeedPartial',
    'You have {tops} top(s), {bottoms} bottom(s), and {shoes} pair(s) of shoes. Add {gaps} to unlock outfit planning.',
  )
    .replace('{tops}', String(counts.tops))
    .replace('{bottoms}', String(counts.bottoms))
    .replace('{shoes}', String(counts.shoes))
    .replace('{gaps}', gaps.join(', '));
}
