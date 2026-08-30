/**
 * Local curated shop thumbnails — preferred over remote stock for formal SKUs.
 * Keys match server `imageKey` / garmentType from retailOutfitBuilder.
 *
 * Conservative: no title-keyword guessing. Only explicit keys or vetted remote URLs.
 */
import type { ImageSourcePropType } from 'react-native';

const THUMBS: Record<string, ImageSourcePropType> = {
  formal_white_shirt: require('../assets/images/shop-thumbs/formal_white_shirt.jpg'),
  formal_dress_trousers: require('../assets/images/shop-thumbs/formal_dress_trousers.jpg'),
  formal_black_oxfords: require('../assets/images/shop-thumbs/formal_black_oxfords.jpg'),
  formal_navy_blazer: require('../assets/images/shop-thumbs/formal_navy_blazer.jpg'),
  dress_shirt: require('../assets/images/shop-thumbs/formal_white_shirt.jpg'),
  oxford: require('../assets/images/shop-thumbs/formal_black_oxfords.jpg'),
  derby: require('../assets/images/shop-thumbs/formal_black_oxfords.jpg'),
  trousers: require('../assets/images/shop-thumbs/formal_dress_trousers.jpg'),
  blazer: require('../assets/images/shop-thumbs/formal_navy_blazer.jpg'),
  suit_jacket: require('../assets/images/shop-thumbs/formal_navy_blazer.jpg'),
};

const REJECTED_REMOTE = [
  'photo-1460353581641-37baddab0fa2',
  'photo-1602810318383-e386cc2a3ccf',
  'photo-1594938298603-c8148c4dae35',
  'photo-1473966968600-fa801b869a1a',
  'photo-1596755094514-f87e34085b2c',
  'photo-1579664531470-ac357f8f8e2b',
  // Men's shirt stock reused for women's blouse labels
  'pexels-photo-804069',
  // Men's blazer rack reused for women's blazer labels
  'pexels-photo-325876',
  // Shoe-led crop previously used as trousers
  '2989593',
  'pexels-photo-2989593',
];

function normalizeShopGender(gender?: string | null): 'female' | 'male' | null {
  const g = String(gender || '').toLowerCase();
  if (/female|woman|women|f\b/.test(g)) return 'female';
  if (/male|man|men|m\b/.test(g)) return 'male';
  return null;
}

function isFeminineShopProduct(product: {
  garmentType?: string | null;
  category?: string | null;
  title?: string | null;
}): boolean {
  const title = String(product.title || '').toLowerCase();
  const type = String(product.garmentType || product.category || '').toLowerCase();
  return /blouse|midi|skirt|court|heel|women'?s/.test(title)
    || /blouse|skirt|heel|court/.test(type);
}

function isMasculineShopProduct(product: {
  garmentType?: string | null;
  category?: string | null;
  title?: string | null;
}): boolean {
  const title = String(product.title || '').toLowerCase();
  const type = String(product.garmentType || product.category || '').toLowerCase();
  return /oxford|dress shirt|men'?s/.test(title)
    || /dress_shirt|oxford/.test(type);
}

function isRejectedRemote(url: string): boolean {
  return REJECTED_REMOTE.some((id) => url.includes(id));
}

/** Men's curated local thumbs must not appear for feminine-labelled products. */
function localThumbAllowedForProduct(
  key: string,
  product: { title?: string | null; garmentType?: string | null; category?: string | null },
  feminine: boolean,
  masculine: boolean,
): boolean {
  if (feminine) return false;
  if (!masculine && /blouse|skirt|midi|heel|court|women/i.test(String(product.title || ''))) {
    return false;
  }
  const menOnlyKeys = ['formal_white_shirt', 'dress_shirt', 'formal_navy_blazer', 'blazer', 'suit_jacket'];
  if (!masculine && menOnlyKeys.includes(key)) return false;
  return Boolean(THUMBS[key]);
}

export function resolveShopThumb(
  product: {
    imageKey?: string | null;
    garmentType?: string | null;
    category?: string | null;
    image?: string | null;
    title?: string | null;
  },
  gender?: string | null,
): ImageSourcePropType | { uri: string } | null {
  const shopGender = normalizeShopGender(gender);
  const feminine = shopGender === 'female' || (shopGender !== 'male' && isFeminineShopProduct(product));
  const masculine = shopGender === 'male' || (!feminine && isMasculineShopProduct(product));

  const key = String(product.imageKey || product.garmentType || '').toLowerCase();
  if (key && localThumbAllowedForProduct(key, product, feminine, masculine)) {
    return THUMBS[key] || null;
  }

  const remote = product.image;
  if (remote && /^https?:\/\//i.test(remote) && !isRejectedRemote(remote)) {
    if (feminine && (remote.includes('804069') || remote.includes('325876'))) {
      return null;
    }
    return { uri: remote };
  }

  return null;
}
