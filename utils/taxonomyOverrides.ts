/**
 * Taxonomy overrides — never let soft classifiers upgrade athletic → smart casual.
 * Mirrors Dripn-Server/services/taxonomyOverrides.js
 */

import {
  GARMENT_FAMILY,
  isAthleticTopOverride,
  isAthleticBottomOverride,
  isStructuredTailoredBottom,
  isCasualTrouserBottom,
  resolveGarmentFamily,
  outfitHasAthleticTop,
  type GarmentFamily,
} from '@/utils/garmentCategory';

type ItemLike = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  id?: string | null;
};

export function overridePrimaryStyle(
  primaryStyle: string | null | undefined,
  items: ItemLike[] = [],
): string | null {
  if (outfitHasAthleticTop(items)) return 'athleisure';
  if ((items || []).some((i) => isAthleticBottomOverride(i))
    && (items || []).some((i) => resolveGarmentFamily(i) === GARMENT_FAMILY.FOOTWEAR_ATHLETIC)) {
    return 'athleisure';
  }
  if (primaryStyle === 'smart_casual' && outfitHasAthleticTop(items)) return 'athleisure';
  return primaryStyle || null;
}

export function overrideStyleLane(
  lane: string,
  item: ItemLike | null | undefined,
): string {
  if (!item) return lane;
  if (isAthleticTopOverride(item) || isAthleticBottomOverride(item)) return 'athleisure';
  if (isStructuredTailoredBottom(item)) return 'tailored';
  if (isCasualTrouserBottom(item) && lane === 'tailored') return 'casual';
  const t = `${item.name || ''} ${item.category || ''}`.toLowerCase();
  if (/\btrousers?\b/.test(t) && !isStructuredTailoredBottom(item) && lane === 'tailored') {
    return 'casual';
  }
  return lane;
}

export function blockSmartCasualUpgrade(items: ItemLike[] = []): boolean {
  return outfitHasAthleticTop(items)
    || (items || []).some((i) => isAthleticBottomOverride(i));
}

export function laneLabelForOutfit(items: ItemLike[] = [], primaryStyle: string | null = null): string {
  const forced = overridePrimaryStyle(primaryStyle, items);
  if (forced === 'athleisure') return 'athleisure';
  if (forced === 'smart_casual') return 'smart casual';
  if (forced === 'classic_tailoring' || forced === 'formal') return 'tailoring';
  if (forced === 'streetwear') return 'street';
  return forced ? String(forced).replace(/_/g, ' ') : 'casual';
}

export type { GarmentFamily };
export {
  GARMENT_FAMILY,
  isAthleticTopOverride,
  isAthleticBottomOverride,
  isStructuredTailoredBottom,
  resolveGarmentFamily,
  outfitHasAthleticTop,
};
