/**
 * Shop product imagery — only show when confidently correct for the named item.
 * Otherwise callers render text-only / bag icon (never a misleading category stock photo).
 */
import type { ImageSourcePropType } from 'react-native';

import { resolveShopThumb } from '@/utils/shopThumbAssets';

export function ensureShopImage(
  product: {
    imageKey?: string | null;
    garmentType?: string | null;
    category?: string | null;
    image?: string | null;
    title?: string | null;
  } | null | undefined,
  gender?: string | null,
): ImageSourcePropType | null {
  if (!product) return null;
  const resolved = resolveShopThumb(product, gender);
  if (!resolved) return null;
  return resolved;
}
