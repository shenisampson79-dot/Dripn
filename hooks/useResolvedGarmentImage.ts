import { useMemo } from 'react';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  coerceWardrobeDisplayImages,
  hasVerifiedCutoutUri,
  isFalselyMarkedProcessed,
  itemHasProcessedCutout,
  resolveWardrobeImageUri,
  type GarmentImageFields,
} from '@/utils/wardrobeImage';

type Result = {
  /** Always resolve through priority — never raw imageUri. */
  resolvedUri: string;
  /** True only when URI evidence (or safe proxy path) says cutout. */
  isCutout: boolean;
  /** Poisoned imageProcessed=true with carpet display was cleared. */
  repaired: boolean;
  item: GarmentImageFields;
};

/**
 * Last-mile garment image resolver.
 * Enforces: server/verified cutout > enhanced > image > local original.
 * Never trusts imageProcessed alone.
 */
export function useResolvedGarmentImage(
  item: Pick<
    WardrobeItem,
    'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
  >,
): Result {
  return useMemo(() => {
    const repairedFlag = isFalselyMarkedProcessed(item);
    const coerced = coerceWardrobeDisplayImages(item);
    const resolvedUri = resolveWardrobeImageUri(coerced);
    const isCutout =
      itemHasProcessedCutout(coerced) || hasVerifiedCutoutUri(coerced);

    return {
      resolvedUri,
      isCutout,
      repaired: repairedFlag,
      item: coerced,
    };
  }, [
    item.id,
    item.imageUri,
    item.enhancedImageUri,
    item.originalImageUri,
    item.imageProcessed,
    item.aiAnalyzed,
  ]);
}
