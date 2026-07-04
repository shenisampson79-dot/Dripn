import { Dimensions } from 'react-native';
import type { ClothingCategory } from '@/contexts/WardrobeContext';

/** Matches Outfit Mix center column width ratio. */
export const OUTFIT_REEL_CENTER_RATIO = 0.66;

/** Typical reel row height on a phone — used for add-item preview aspect ratio. */
export const OUTFIT_REEL_REFERENCE_ROW_HEIGHT = 112;

export const DEFAULT_OUTFIT_REEL_IMAGE_SCALE = 1.4;

/** Zoom inside reel tiles — same values in Outfit Mix and add-item preview. */
export const OUTFIT_REEL_IMAGE_SCALE: Partial<Record<ClothingCategory, number>> = {
  outerwear: 1.4,
  tops: 1.42,
  dresses: 1.38,
  formal: 1.34,
  bottoms: 1.44,
  shoes: 1.48,
  activewear_tops: 1.42,
  activewear_bottoms: 1.44,
};

export function normalizeOutfitReelCategory(
  category: ClothingCategory | null | undefined,
): ClothingCategory | null {
  if (!category) return null;
  if (category === 'activewear' || category === 'activewear_tops') return 'tops';
  if (category === 'activewear_bottoms') return 'bottoms';
  return category;
}

export function getOutfitReelImageScale(
  category: ClothingCategory | null | undefined,
): number {
  const key = normalizeOutfitReelCategory(category) ?? category;
  if (!key) return DEFAULT_OUTFIT_REEL_IMAGE_SCALE;
  return OUTFIT_REEL_IMAGE_SCALE[key] ?? DEFAULT_OUTFIT_REEL_IMAGE_SCALE;
}

/** Landscape box matching Outfit Mix reel proportions. */
export function getOutfitReelPreviewAspectRatio(
  screenWidth = Dimensions.get('window').width,
): number {
  return (screenWidth * OUTFIT_REEL_CENTER_RATIO) / OUTFIT_REEL_REFERENCE_ROW_HEIGHT;
}
