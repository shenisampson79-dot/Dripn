export type OutfitLayerSlot = 'outerwear' | 'top' | 'bottom' | 'shoes' | 'dress' | 'accessory';

const LAYER_RANK: Record<OutfitLayerSlot, number> = {
  outerwear: 0,
  top: 1,
  dress: 2,
  bottom: 3,
  shoes: 4,
  accessory: 5,
};

function inferSlotFromText(text: string): OutfitLayerSlot | null {
  const t = text.toLowerCase();
  if (/\b(dress|jumpsuit|romper|playsuit)\b/.test(t)) return 'dress';
  if (/\b(blazer|jacket|coat|outerwear|cardigan|parka|trench|overcoat|gilet|vest)\b/.test(t)) return 'outerwear';
  if (/\b(trouser|pant|jean|short|skirt|cargo|chino|bottom|legging)\b/.test(t)) return 'bottom';
  if (/\b(shoe|trainer|sneaker|boot|loafer|heel|sandal|footwear|mule|flat)\b/.test(t)) return 'shoes';
  if (/\b(bag|tote|purse|belt|scarf|hat|tie|bowtie|accessory|necklace|earring|watch)\b/.test(t)) return 'accessory';
  if (/\b(shirt|blouse|top|tee|t-shirt|sweater|knit|polo|tank|camisole)\b/.test(t)) return 'top';
  return null;
}

export function getOutfitItemLayerSlot(item: { category?: string; name?: string }): OutfitLayerSlot {
  const category = String(item.category || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();

  if (category === 'dresses' || category === 'dress') return 'dress';
  if (category === 'outerwear') return 'outerwear';
  if (['bottoms', 'bottom', 'activewear_bottoms'].includes(category)) return 'bottom';
  if (['footwear', 'shoes'].includes(category)) return 'shoes';
  if (['bags', 'accessories'].includes(category)) return 'accessory';
  if (['tops', 'top', 'activewear_tops', 'formal'].includes(category)) return 'top';

  return inferSlotFromText(name) || 'top';
}

/** Outerwear → top → dress → bottom → shoes → accessories (how outfits read on the body). */
export function sortOutfitItemsByVisualOrder<T extends { category?: string; name?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = LAYER_RANK[getOutfitItemLayerSlot(a)];
    const rankB = LAYER_RANK[getOutfitItemLayerSlot(b)];
    return rankA - rankB;
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
