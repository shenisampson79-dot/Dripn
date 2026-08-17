export type OutfitLayerSlot =
  | 'outerwear'
  | 'top'
  | 'active_top'
  | 'dress'
  | 'bottom'
  | 'active_bottom'
  | 'shoes'
  | 'accessory';

const LAYER_RANK: Record<OutfitLayerSlot, number> = {
  outerwear: 0,
  top: 1,
  active_top: 2,
  dress: 3,
  bottom: 4,
  active_bottom: 5,
  shoes: 6,
  accessory: 7,
};

/** Picker / browse order: Outerwear → tops → active tops → bottoms → active bottoms → shoes… */
const CATEGORY_PICKER_RANK: Record<string, number> = {
  outerwear: 0,
  tops: 1,
  activewear_tops: 2,
  dresses: 3,
  formal: 4,
  bottoms: 5,
  activewear_bottoms: 6,
  shoes: 7,
  bags: 8,
  accessories: 9,
  swimwear: 10,
  sleepwear: 11,
};

function inferSlotFromText(text: string): OutfitLayerSlot | null {
  const t = text.toLowerCase();
  if (/\b(dress|jumpsuit|romper|playsuit)\b/.test(t)) return 'dress';
  if (/\b(blazer|jacket|coat|outerwear|cardigan|parka|trench|overcoat|gilet|vest|quarter[-\s]?zip|athletic[-\s]?pullover|overshirt|shacket)\b/.test(t)) return 'outerwear';
  if (/\b(activewear|gym|legging|joggers|track\s*pant|sweatpant)\b/.test(t) && /\b(pant|short|legging|bottom|trouser|joggers)\b/.test(t)) {
    return 'active_bottom';
  }
  if (/\b(trouser|pant|jean|short|skirt|cargo|chino|bottom|legging)\b/.test(t)) return 'bottom';
  if (/\b(shoe|trainer|sneaker|boot|loafer|heel|sandal|footwear|mule|flat)\b/.test(t)) return 'shoes';
  if (/\b(bag|tote|purse|belt|scarf|hat|tie|bowtie|accessory|necklace|earring|watch)\b/.test(t)) return 'accessory';
  if (/\b(activewear|gym|tank|sports?\s*bra|performance)\b/.test(t)) return 'active_top';
  if (/\b(shirt|blouse|top|tee|t-shirt|sweater|knit|polo|tank|camisole)\b/.test(t)) return 'top';
  return null;
}

export function getOutfitItemLayerSlot(item: { category?: string; name?: string }): OutfitLayerSlot {
  const category = String(item.category || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();

  if (category === 'dresses' || category === 'dress') return 'dress';
  if (category === 'outerwear') return 'outerwear';
  if (category === 'activewear_tops') return 'active_top';
  if (category === 'activewear_bottoms') return 'active_bottom';
  if (['bottoms', 'bottom'].includes(category)) return 'bottom';
  if (['footwear', 'shoes'].includes(category)) return 'shoes';
  if (['bags', 'accessories'].includes(category)) return 'accessory';
  if (['tops', 'top', 'formal'].includes(category)) return 'top';

  return inferSlotFromText(name) || 'top';
}

/** Outerwear → tops → active tops → dress → bottoms → active bottoms → shoes → accessories. */
export function sortOutfitItemsByVisualOrder<T extends { category?: string; name?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = LAYER_RANK[getOutfitItemLayerSlot(a)];
    const rankB = LAYER_RANK[getOutfitItemLayerSlot(b)];
    if (rankA !== rankB) return rankA - rankB;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

/** Same category sequence for wardrobe grids (Plan Outfit picker, etc.). */
export function sortWardrobeItemsByCategoryOrder<T extends { category?: string; name?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const catA = String(a.category || '').toLowerCase();
    const catB = String(b.category || '').toLowerCase();
    const rankA = CATEGORY_PICKER_RANK[catA] ?? LAYER_RANK[getOutfitItemLayerSlot(a)] + 20;
    const rankB = CATEGORY_PICKER_RANK[catB] ?? LAYER_RANK[getOutfitItemLayerSlot(b)] + 20;
    if (rankA !== rankB) return rankA - rankB;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

/** Reorder wardrobe item IDs for display/storage (outerwear first). */
export function orderItemIdsByVisualOrder(
  itemIds: string[],
  wardrobeItems: Array<{ id: string | number; category?: string; name?: string }>,
): string[] {
  const byId = new Map(wardrobeItems.map((item) => [String(item.id), item]));
  const resolved = itemIds
    .map((id) => byId.get(String(id)))
    .filter((item): item is { id: string | number; category?: string; name?: string } => Boolean(item));

  return sortOutfitItemsByVisualOrder(resolved).map((item) => String(item.id));
}
