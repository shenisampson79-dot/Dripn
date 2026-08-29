/**
 * Never blank shop / hero imagery.
 * Prefer curated local thumbs, then valid http, then type-specific default.
 */
import type { ImageSourcePropType } from 'react-native';

import { resolveShopThumb } from '@/utils/shopThumbAssets';

const CATEGORY_FALLBACK: Record<string, ImageSourcePropType> = {
  top: require('../assets/images/shop-thumbs/formal_white_shirt.jpg'),
  bottom: require('../assets/images/shop-thumbs/formal_dress_trousers.jpg'),
  shoes: require('../assets/images/shop-thumbs/formal_black_oxfords.jpg'),
  outerwear: require('../assets/images/shop-thumbs/formal_navy_blazer.jpg'),
  default: require('../assets/images/shop-thumbs/formal_white_shirt.jpg'),
};

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
  const resolved = product ? resolveShopThumb(product, gender) : null;
  if (resolved) return resolved;

  const shopGender = String(gender || '').toLowerCase();
  const feminine = /female|woman|women/.test(shopGender)
    || /blouse|midi|skirt|court|heel|women'?s/i.test(String(product?.title || ''));
  if (feminine) {
    return null;
  }

  const cat = String(product?.category || 'default').toLowerCase();
  return CATEGORY_FALLBACK[cat] || CATEGORY_FALLBACK.default;
}
