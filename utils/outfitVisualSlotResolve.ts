/**
 * Pure garment slot resolution (no React Native, no safeRender).
 */
import { normalizeWardrobeCategory } from './wardrobeCategories';

export type OutfitVisualSlot = 'outerwear' | 'top' | 'bottom' | 'shoes' | 'dress' | 'accessory';

/** Visible accessory-strip title. Chat collage only; Event and default stay "Also wearing". */
export function accessoryStripHeading(layoutVariant?: string | null): 'Accessories' | 'Also wearing' {
  return layoutVariant === 'chat' ? 'Accessories' : 'Also wearing';
}

function isDressShirtName(text: string): boolean {
  return /dress[\s_-]*shirt|oxford[\s_-]*shirt/.test(text);
}

function isShirtDressName(text: string): boolean {
  return /shirt[\s_-]*dress/.test(text) && !isDressShirtName(text);
}

function inferSlotFromText(text: string): OutfitVisualSlot | null {
  const t = text.toLowerCase();
  // Shirt-dress / shirtdress is a one-piece dress — not a dress shirt.
  if (isShirtDressName(t)) return 'dress';
  // Dress shirts / oxfords / button-ups are tops; dress shoes are footwear.
  if (
    (isDressShirtName(t) || /button[\s_-]?down|button[\s_-]?up/.test(t))
    && !/\b(maxi|midi|mini)\s*dress\b/.test(t)
    && !isShirtDressName(t)
  ) {
    return 'top';
  }
  if (/dress[\s_-]*shoe/.test(t) || (/\bdress\b/.test(t) && /\b(shoe|trainer|sneaker|boot|loafer|heel|sandal|footwear)\b/.test(t))) {
    return 'shoes';
  }
  if (/\b(dress|jumpsuit|romper|playsuit)\b/.test(t)) return 'dress';
  if (/\b(blazer|jacket|coat|outerwear|cardigan|parka|trench|overcoat|gilet|vest)\b/.test(t)) return 'outerwear';
  if (/\b(trouser|pant|jean|short|skirt|cargo|chino|bottom|legging)\b/.test(t)) return 'bottom';
  if (/\b(shoe|trainer|sneaker|boot|loafer|heel|sandal|footwear|mule|flat)\b/.test(t)) return 'shoes';
  if (/\b(bag|tote|purse|belt|scarf|hat|tie|bowtie|accessory|necklace|earring|watch)\b/.test(t)) {
    return 'accessory';
  }
  if (/\b(shirt|blouse|top|tee|t-shirt|sweater|knit|polo|tank|camisole)\b/.test(t)) return 'top';
  return null;
}

function isDressLikeRoleOrCategory(role: string, category: string): boolean {
  return ['dress', 'dresses', 'jumpsuit'].includes(role) || category === 'dresses' || category === 'dress';
}

export function getOutfitPieceSlot(piece: {
  role?: string | null;
  category?: string | null;
  name?: string | null;
  subcategory?: string | null;
}): OutfitVisualSlot {
  const role = String(piece.role || '').toLowerCase();
  const category = String(piece.category || '').toLowerCase();
  const name = String(piece.name || '').toLowerCase();
  const subcategory = String(piece.subcategory || '');

  if (isDressLikeRoleOrCategory(role, category)) {
    const fromName = inferSlotFromText(`${name} ${subcategory}`.trim());
    // Shirt-dress must stay a dress even if wardrobe normalisation would call it a top.
    if (fromName === 'dress') return 'dress';
    if (fromName === 'top' || fromName === 'shoes') return fromName;
    const rawCategory = category || (role === 'jumpsuit' ? 'jumpsuit' : 'dresses');
    const normalized = normalizeWardrobeCategory(rawCategory, { name, subcategory });
    if (normalized === 'tops' || normalized === 'activewear_tops' || normalized === 'formal') return 'top';
    if (normalized === 'shoes') return 'shoes';
    return 'dress';
  }
  if (['outerwear', 'blazer', 'jacket', 'coat'].includes(role) || category === 'outerwear') return 'outerwear';
  if (['bottom', 'trousers', 'pants', 'jeans', 'skirt'].includes(role) || ['bottoms', 'activewear_bottoms'].includes(category)) {
    return 'bottom';
  }
  if (['shoes', 'footwear', 'trainers', 'boots', 'sneakers'].includes(role) || ['shoes', 'footwear'].includes(category)) {
    return 'shoes';
  }
  if (['accessory', 'accessories', 'bag'].includes(role) || ['bags', 'accessories'].includes(category)) {
    return 'accessory';
  }
  if (['top', 'shirt', 'blouse', 'sweater'].includes(role) || ['tops', 'activewear_tops', 'formal'].includes(category)) {
    return 'top';
  }
  return inferSlotFromText(`${role} ${name}`) || 'top';
}
