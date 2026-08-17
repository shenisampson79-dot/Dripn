import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { passesEditorialOccasionGate } from '@/utils/fashionEditorialRubric';

export const MIN_OUTFIT_ITEMS = 4;

const SHOE_HINTS = ['shoe', 'footwear', 'sneaker', 'trainer', 'boot', 'sandal', 'loafer', 'heel', 'flat', 'runner'];

type OutfitItemLike = Pick<WardrobeItem, 'id' | 'category' | 'name' | 'color'>;

function norm(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function matchesHint(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

export function isShoesItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  const name = norm(item.name);
  if (category === 'shoes') return true;
  return matchesHint(category, SHOE_HINTS) || matchesHint(name, SHOE_HINTS);
}

export function isTopItem(item: OutfitItemLike): boolean {
  if (isMidLayerItem(item)) return false;
  const category = norm(item.category);
  if (category === 'outerwear') return false;
  return ['tops', 'activewear_tops', 'formal'].includes(category)
    || matchesHint(category, ['top', 'shirt', 'blouse', 'sweater', 'tee', 't-shirt', 'polo', 'tank', 'singlet', 'jersey']);
}

export function isBottomItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  return ['bottoms', 'activewear_bottoms', 'dresses'].includes(category)
    || matchesHint(category, ['bottom', 'pant', 'jean', 'trouser', 'skirt', 'short', 'jogger', 'legging', 'dress', 'jumpsuit']);
}

export function isDressItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  const name = norm(item.name);
  return category === 'dresses'
    || matchesHint(category, ['dress', 'jumpsuit', 'romper'])
    || matchesHint(name, ['dress', 'jumpsuit', 'romper']);
}

export function isSwimOrBeachItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  const name = norm(item.name);
  const sub = norm((item as { subcategory?: string }).subcategory);
  return category === 'swimwear'
    || matchesHint(category, ['swim', 'bikini', 'trunk'])
    || matchesHint(sub, ['swim', 'bikini', 'trunk', 'board'])
    || matchesHint(name, ['swim', 'bikini', 'swimsuit', 'trunks', 'board short', 'rash guard', 'cover[- ]?up']);
}

/** Hard completeness: top+bottom+shoes; dress+shoes; or swim/beach set. Blazer ≠ base top. */
export function hasCoreOutfitRoles(items: OutfitItemLike[] = []): boolean {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length < 1) return false;

  const swimOnly = list.every(
    (item) => isSwimOrBeachItem(item) || isShoesItem(item) || isAccessoryItem(item),
  ) && list.some(isSwimOrBeachItem);
  if (swimOnly) return true;

  if (!list.some(isShoesItem)) return false;
  if (list.some(isDressItem)) return true;
  return list.some(isTopItem) && list.some(isBottomItem);
}

/** Quarter-zips / athletic pullovers / overshirts — over a base tee when layered. */
export function isMidLayerItem(item: OutfitItemLike): boolean {
  const subtype = norm((item as { subcategory?: string; classified?: { subtype?: string } }).classified?.subtype
    || (item as { subcategory?: string }).subcategory).replace(/\s+/g, '_');
  const text = `${norm(item.name)} ${norm((item as { subcategory?: string }).subcategory)} ${subtype}`;
  if (
    ['quarter_zip', 'half_zip', 'athletic_pullover', 'overshirt', 'shacket', 'zip_up_layer'].includes(subtype)
  ) {
    return true;
  }
  if (/\b(quarter[\s_-]?zip|half[\s_-]?zip)\b/.test(text)) return true;
  if (/\bathletic[\s_-]?pullover\b/.test(text)) return true;
  if (/\b(overshirt|shacket)\b/.test(text)) return true;
  if (/\b(hoodie|hooded)\b/.test(text) && /\b(zip|athletic|tech)\b/.test(text)) return true;
  return false;
}

export function isOuterwearItem(item: OutfitItemLike): boolean {
  if (isMidLayerItem(item)) return true;
  const category = norm(item.category);
  // Category wins: "coated trousers" must not become a coat.
  if (['bottoms', 'activewear_bottoms', 'shoes', 'dresses', 'accessories', 'bags'].includes(category)) {
    return false;
  }
  const name = norm(item.name);
  return category === 'outerwear'
    || matchesHint(category, ['jacket', 'coat', 'blazer', 'outerwear', 'parka', 'gilet'])
    || /\b(jacket|coats?|blazer|parka|puffer|gilet|cardigan)\b/.test(name);
}

export function isAccessoryItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  return ['accessories', 'bags'].includes(category)
    || matchesHint(category, ['accessory', 'bag', 'belt', 'hat', 'scarf', 'watch', 'jewel']);
}

export function outfitHasRequiredShoes(itemIds: string[], wardrobe: OutfitItemLike[]): boolean {
  const byId = new Map(wardrobe.map((item) => [String(item.id), item]));
  return itemIds.some((id) => {
    const item = byId.get(String(id));
    return item ? isShoesItem(item) : false;
  });
}

export function wardrobeCanBuildCompleteOutfit(wardrobe: OutfitItemLike[]): boolean {
  if (wardrobe.length < MIN_OUTFIT_ITEMS) return false;
  if (!wardrobe.some(isShoesItem)) return false;
  const hasTop = wardrobe.some(isTopItem);
  const hasBottom = wardrobe.some(isBottomItem);
  return hasTop && hasBottom;
}

export function completeOutfitItemIds(
  selectedIds: string[],
  wardrobe: OutfitItemLike[],
  occasion?: OutfitOccasionId | 'todays_look',
): string[] {
  const byId = new Map(wardrobe.map((item) => [String(item.id), item]));
  const result: string[] = [];

  const add = (id: string): boolean => {
    const key = String(id);
    if (!byId.has(key) || result.includes(key)) return false;
    result.push(key);
    return true;
  };

  for (const id of selectedIds) {
    const item = byId.get(String(id));
    if (item && passesEditorialOccasionGate(item, occasion)) add(String(id));
  }

  const inOutfit = (): OutfitItemLike[] =>
    result.map((id) => byId.get(id)).filter(Boolean) as OutfitItemLike[];

  const available = () => wardrobe.filter((item) => !result.includes(String(item.id)));

  const pickFirst = (predicate: (item: OutfitItemLike) => boolean): boolean => {
    const found = available().find(
      (item) => predicate(item) && passesEditorialOccasionGate(item, occasion),
    );
    return found ? add(String(found.id)) : false;
  };

  const hasShoes = () => inOutfit().some(isShoesItem);
  const hasTop = () => inOutfit().some(isTopItem);
  const hasBottomOrDress = () => inOutfit().some(isBottomItem);

  if (!hasShoes()) pickFirst(isShoesItem);
  if (!hasTop()) pickFirst(isTopItem);
  if (!hasBottomOrDress()) pickFirst(isBottomItem);

  const fillOrder: Array<(item: OutfitItemLike) => boolean> = [
    isOuterwearItem,
    isAccessoryItem,
    isTopItem,
    isBottomItem,
    isShoesItem,
    () => true,
  ];

  while (result.length < MIN_OUTFIT_ITEMS) {
    let added = false;
    for (const predicate of fillOrder) {
      if (pickFirst(predicate)) {
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  return result;
}

export function isCompleteOutfit(itemIds: string[], wardrobe: OutfitItemLike[]): boolean {
  const unique = [...new Set(itemIds.map(String))];
  if (unique.length < 3) return false;
  const byId = new Map(wardrobe.map((item) => [String(item.id), item]));
  const items = unique.map((id) => byId.get(id)).filter(Boolean) as OutfitItemLike[];
  return hasCoreOutfitRoles(items);
}
