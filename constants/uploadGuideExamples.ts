import type { Gender } from '@/contexts/AuthContext';

export type UploadGuideImageSource = string | number;

export type UploadGuideComparison = {
  id: string;
  doLabel: string;
  avoidLabel: string;
  doImage: UploadGuideImageSource;
  avoidImage: UploadGuideImageSource;
};

const MEN_IMAGES = {
  flatLay: require('@/assets/upload-guide/men/flat-lay-good.jpg'),
  singleItem: require('@/assets/upload-guide/men/single-item.jpg'),
  fullFrame: require('@/assets/upload-guide/men/full-frame-good.jpg'),
  croppedBad: require('@/assets/upload-guide/men/cropped-bad.jpg'),
  wrinkledPile: require('@/assets/upload-guide/men/wrinkled-pile.jpg'),
  multipleItems: require('@/assets/upload-guide/men/multiple-items.jpg'),
};

const WOMEN_IMAGES = {
  flatLay: require('@/assets/upload-guide/women/flat-lay-good.jpg'),
  singleItem: require('@/assets/upload-guide/women/single-item.jpg'),
  fullFrame: require('@/assets/upload-guide/women/full-frame-good.jpg'),
  croppedBad: require('@/assets/upload-guide/women/cropped-bad.jpg'),
  wrinkledPile: require('@/assets/upload-guide/women/wrinkled-pile.jpg'),
  multipleItems: require('@/assets/upload-guide/women/multiple-items.jpg'),
};

function buildClothingComparisons(
  images: typeof MEN_IMAGES,
): UploadGuideComparison[] {
  return [
    {
      id: 'flat-lay',
      doLabel: 'Lay flat on a bed or floor',
      avoidLabel: 'Bunched pile of clothes',
      doImage: images.flatLay,
      avoidImage: images.wrinkledPile,
    },
    {
      id: 'single-item',
      doLabel: 'One item per photo',
      avoidLabel: 'Multiple items together',
      doImage: images.singleItem,
      avoidImage: images.multipleItems,
    },
    {
      id: 'clear-view',
      doLabel: 'Full item in frame',
      avoidLabel: 'Cropped or hard to see',
      doImage: images.fullFrame,
      avoidImage: images.croppedBad,
    },
  ];
}

export function getClothingUploadComparisons(gender?: Gender | null): UploadGuideComparison[] {
  const images = gender === 'man' ? MEN_IMAGES : WOMEN_IMAGES;
  return buildClothingComparisons(images);
}

/** @deprecated Use getClothingUploadComparisons(user?.gender) */
export const CLOTHING_UPLOAD_COMPARISONS = buildClothingComparisons(WOMEN_IMAGES);

/** Bundled accessory tip photos (remote Unsplash IDs previously used here return 404). */
const ACCESSORY_IMAGES = {
  arranged: require('@/assets/images/accessory-tips-correct.png'),
  cluttered: require('@/assets/images/accessory-tips-incorrect.png'),
};

export const ACCESSORY_UPLOAD_COMPARISONS: UploadGuideComparison[] = [
  {
    id: 'accessories-flat',
    doLabel: 'Arranged on a plain surface',
    avoidLabel: 'Cluttered or tangled',
    doImage: ACCESSORY_IMAGES.arranged,
    avoidImage: ACCESSORY_IMAGES.cluttered,
  },
];

export const OUTFIT_UPLOAD_COMPARISONS: UploadGuideComparison[] = [
  {
    id: 'full-outfit',
    doLabel: 'Full outfit visible head to toe',
    avoidLabel: 'Cropped or missing shoes',
    doImage:
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=540&h=400&q=80',
    avoidImage:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=540&h=400&q=80',
  },
  {
    id: 'mirror-light',
    doLabel: 'Mirror shot in good light',
    avoidLabel: 'Dark or blurry photo',
    doImage:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=540&h=400&q=80',
    avoidImage:
      'https://images.unsplash.com/photo-1485968579169-a6f4c5cb8365?auto=format&fit=crop&w=540&h=400&q=80',
  },
];
