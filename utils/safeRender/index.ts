/**
 * System-level Safe Rendering Layer for StyleWise.
 * Raw Data → Validation → Sanitization → Safe View Models → UI + Error Boundaries
 */

export {
  sanitizeOutfit,
  sanitizeOutfitPieces,
  sanitizeWardrobeVisual,
  toOutfitViewModel,
  type OutfitViewModel,
  type SanitizedOutfitPiece,
  type SafeWardrobeVisual,
  type SafeWardrobeOutfit,
} from '@/utils/safeRender/sanitizeOutfit';

export {
  logInvalidRender,
  type InvalidRenderType,
} from '@/utils/safeRender/logInvalidRender';
