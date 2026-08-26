/**
 * Pure outfit visual slot resolution for chat cards / fixtures.
 * Mirrors OutfitPiecesVisual slot rules without React Native.
 */
import { sanitizeOutfitPieces, type SanitizedOutfitPiece } from '@/utils/safeRender';

export type OutfitVisualSlot = 'outerwear' | 'top' | 'bottom' | 'shoes' | 'dress' | 'accessory';

const STACK_ORDER: OutfitVisualSlot[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes'];

function inferSlotFromText(text: string): OutfitVisualSlot | null {
  const t = text.toLowerCase();
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

export function getOutfitPieceSlot(piece: {
  role?: string | null;
  category?: string | null;
  name?: string | null;
}): OutfitVisualSlot {
  const role = String(piece.role || '').toLowerCase();
  const category = String(piece.category || '').toLowerCase();
  const name = String(piece.name || '').toLowerCase();

  if (['dress', 'jumpsuit'].includes(role) || category === 'dresses') return 'dress';
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

/**
 * Slots that the chat card will present for a piece list.
 * Dress layouts suppress top/bottom; accessories are always included when present.
 */
export function resolveOutfitVisualSlots(
  pieces: SanitizedOutfitPiece[] | unknown,
): OutfitVisualSlot[] {
  const safe = sanitizeOutfitPieces(pieces, { log: false });
  const bySlot = new Map<OutfitVisualSlot, SanitizedOutfitPiece>();
  const accessories: SanitizedOutfitPiece[] = [];

  for (const piece of safe) {
    const slot = getOutfitPieceSlot(piece);
    if (slot === 'accessory') {
      accessories.push(piece);
      continue;
    }
    if (!bySlot.has(slot)) bySlot.set(slot, piece);
  }

  const hasDress = bySlot.has('dress');
  const stack: OutfitVisualSlot[] = [];
  for (const slot of STACK_ORDER) {
    if (hasDress && (slot === 'top' || slot === 'bottom')) continue;
    if (bySlot.has(slot)) stack.push(slot);
  }
  return [...stack, ...accessories.map(() => 'accessory' as const)];
}
