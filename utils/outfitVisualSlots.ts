/**
 * Pure outfit visual slot resolution for chat cards / fixtures.
 * Mirrors OutfitPiecesVisual slot rules without React Native.
 */
import { sanitizeOutfitPieces, type SanitizedOutfitPiece } from '@/utils/safeRender';
import { getOutfitPieceSlot, type OutfitVisualSlot } from './outfitVisualSlotResolve';

export type { OutfitVisualSlot };
export { getOutfitPieceSlot };

const STACK_ORDER: OutfitVisualSlot[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes'];

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
