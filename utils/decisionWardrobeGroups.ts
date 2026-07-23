import type { ClothingCategory } from '@/contexts/WardrobeContext';
import { normalizeWardrobeCategory } from '@/utils/wardrobeCategories';

export type DecisionWardrobeGroupKey =
  | 'outerwear'
  | 'tops'
  | 'bottoms'
  | 'footwear'
  | 'accessories'
  | 'dresses'
  | 'other';

export interface DecisionWardrobeGroupDef {
  key: DecisionWardrobeGroupKey;
  /** i18n key under stylistFlow.wardrobeGroup.* */
  labelKey: string;
}

/** Display order for decision wardrobe pickers (Sanity / Event / shared). */
export const DECISION_WARDROBE_GROUPS: DecisionWardrobeGroupDef[] = [
  { key: 'outerwear', labelKey: 'stylistFlow.wardrobeGroup.outerwear' },
  { key: 'tops', labelKey: 'stylistFlow.wardrobeGroup.tops' },
  { key: 'bottoms', labelKey: 'stylistFlow.wardrobeGroup.bottoms' },
  { key: 'footwear', labelKey: 'stylistFlow.wardrobeGroup.footwear' },
  { key: 'accessories', labelKey: 'stylistFlow.wardrobeGroup.accessories' },
  { key: 'dresses', labelKey: 'stylistFlow.wardrobeGroup.dresses' },
  { key: 'other', labelKey: 'stylistFlow.wardrobeGroup.other' },
];

/** Max wardrobe pieces for outfit-style decisions (top+bottom+shoes+optional layers). */
export const MAX_DECISION_WARDROBE_ITEMS = 8;

/** Gallery photo caps stay separate from wardrobe selection. */
export const MAX_SANITY_CHECK_PHOTOS = 1;

function mapCategoryToGroup(category: ClothingCategory): DecisionWardrobeGroupKey {
  switch (category) {
    case 'outerwear':
      return 'outerwear';
    case 'tops':
    case 'activewear_tops':
      return 'tops';
    case 'bottoms':
    case 'activewear_bottoms':
      return 'bottoms';
    case 'shoes':
      return 'footwear';
    case 'accessories':
    case 'bags':
      return 'accessories';
    case 'dresses':
      return 'dresses';
    default:
      return 'other';
  }
}

export function getDecisionWardrobeGroup(item: {
  category?: string | null;
  name?: string;
  subcategory?: string;
}): DecisionWardrobeGroupKey {
  const category = normalizeWardrobeCategory(item.category, {
    name: item.name,
    subcategory: item.subcategory,
  });
  return mapCategoryToGroup(category);
}

export function groupWardrobeItemsForDecision<T extends {
  id?: string | number;
  category?: string | null;
  name?: string;
  subcategory?: string;
  enhancedImageUri?: string | null;
  imageUri?: string | null;
}>(items: T[]): Array<DecisionWardrobeGroupDef & { items: T[] }> {
  const buckets = new Map<DecisionWardrobeGroupKey, T[]>();
  for (const def of DECISION_WARDROBE_GROUPS) {
    buckets.set(def.key, []);
  }

  for (const item of items) {
    const uri = item.enhancedImageUri || item.imageUri;
    if (!uri) continue;
    const group = getDecisionWardrobeGroup(item);
    buckets.get(group)!.push(item);
  }

  return DECISION_WARDROBE_GROUPS
    .map((def) => ({ ...def, items: buckets.get(def.key) || [] }))
    .filter((section) => section.items.length > 0);
}
