import type { WardrobeItem } from '@/contexts/WardrobeContext';

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
  const category = norm(item.category);
  return ['tops', 'activewear_tops', 'formal'].includes(category)
    || matchesHint(category, ['top', 'shirt', 'blouse', 'sweater', 'hoodie', 'tee', 't-shirt', 'polo', 'tank', 'singlet', 'jersey']);
}

export function isBottomItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  return ['bottoms', 'activewear_bottoms', 'dresses'].includes(category)
    || matchesHint(category, ['bottom', 'pant', 'jean', 'trouser', 'skirt', 'short', 'jogger', 'legging', 'dress', 'jumpsuit']);
}

export function isOuterwearItem(item: OutfitItemLike): boolean {
  const category = norm(item.category);
  return category === 'outerwear'
    || matchesHint(category, ['jacket', 'coat', 'blazer', 'outerwear', 'parka', 'gilet']);
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
): string[] {
  const byId = new Map(wardrobe.map((item) => [String(item.id), item]));
  const result: string[] = [];

  const add = (id: string): boolean => {
    const key = String(id);
    if (!byId.has(key) || result.includes(key)) return false;
    result.push(key);
    return true;
  };

  for (const id of selectedIds) add(String(id));

  const inOutfit = (): OutfitItemLike[] =>
    result.map((id) => byId.get(id)).filter(Boolean) as OutfitItemLike[];

  const available = () => wardrobe.filter((item) => !result.includes(String(item.id)));

  const pickFirst = (predicate: (item: OutfitItemLike) => boolean): boolean => {
    const found = available().find(predicate);
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
  return unique.length >= MIN_OUTFIT_ITEMS && outfitHasRequiredShoes(unique, wardrobe);
}
