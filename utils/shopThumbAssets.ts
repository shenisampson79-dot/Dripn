/**
 * Local curated shop thumbnails — preferred over remote stock for formal SKUs.
 * Keys match server `imageKey` / garmentType from retailOutfitBuilder.
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
  // Shoe-led crop previously used as trousers
  '2989593',
  'pexels-photo-2989593',
];

export function resolveShopThumb(product: {
  imageKey?: string | null;
  garmentType?: string | null;
  category?: string | null;
  image?: string | null;
  title?: string | null;
}): ImageSourcePropType | { uri: string } | null {
  const key = String(product.imageKey || product.garmentType || '').toLowerCase();
  if (key && THUMBS[key]) return THUMBS[key];

  const title = String(product.title || '').toLowerCase();
  if (/white|poplin|oxford.*shirt|dress shirt/.test(title) && THUMBS.formal_white_shirt) {
    return THUMBS.formal_white_shirt;
  }
  if (/oxford|derby|dress shoe/.test(title) && THUMBS.formal_black_oxfords) {
    return THUMBS.formal_black_oxfords;
  }
  if (/trouser|pant|chino/.test(title) && THUMBS.formal_dress_trousers) {
    return THUMBS.formal_dress_trousers;
  }
  if (/blazer|jacket|suit/.test(title) && THUMBS.formal_navy_blazer) {
    return THUMBS.formal_navy_blazer;
  }

  const remote = product.image;
  if (remote && !REJECTED_REMOTE.some((id) => remote.includes(id))) {
    return { uri: remote };
  }
  return null;
}
