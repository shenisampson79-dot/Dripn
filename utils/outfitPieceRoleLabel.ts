import { getOutfitPieceSlot } from './outfitVisualSlotResolve';

export type OutfitPieceRoleLabelHints = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

/** Singular role labels for outfit piece lists (Top, not Tops), except dress-shirt remap → Tops. */
export function formatOutfitPieceRoleLabel(
  role?: string | null,
  hints?: OutfitPieceRoleLabelHints,
): string {
  const raw = String(role || 'piece').toLowerCase().trim();
  const category = String(hints?.category || '').toLowerCase().trim();
  const dressLike = raw === 'dress' || raw === 'dresses' || category === 'dress' || category === 'dresses';
  if (dressLike) {
    const slot = getOutfitPieceSlot({
      role: raw,
      category: category || 'dresses',
      name: hints?.name,
      subcategory: hints?.subcategory,
    });
    if (slot === 'top') return 'Tops';
    if (slot === 'shoes') return 'Shoes';
    if (slot === 'dress') return raw === 'dress' ? 'Dress' : 'Dresses';
  }
  const map: Record<string, string> = {
    top: 'Top',
    tops: 'Top',
    shirt: 'Top',
    bottom: 'Bottom',
    bottoms: 'Bottom',
    pants: 'Bottom',
    trousers: 'Bottom',
    shoes: 'Shoes',
    shoe: 'Shoes',
    footwear: 'Shoes',
    outerwear: 'Outerwear',
    outer: 'Outerwear',
    jacket: 'Outerwear',
    bag: 'Bag',
    bags: 'Bag',
    accessory: 'Accessory',
    accessories: 'Accessory',
    dress: 'Dress',
    piece: 'Piece',
  };
  if (map[raw]) return map[raw];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
