export type GeneratedOutfitApiItem = {
  id: string | number;
  name?: string;
  category?: string;
  color?: string;
  imageUri?: string | null;
  imageUrl?: string | null;
};

/** Minimal shape needed to merge look rows onto session/wardrobe items. */
export type HydrateWardrobeLike = {
  id: string | number;
  imageUri?: string | null;
  enhancedImageUri?: string | null;
  imageProcessed?: boolean;
  category?: string;
  color?: string;
  name?: string;
  [key: string]: unknown;
};

/** Merge API look rows onto local wardrobe/session items (keeps scan id + local crop when present). */
export function hydrateGeneratedOutfitItems<T extends HydrateWardrobeLike>(
  outfitItems: GeneratedOutfitApiItem[],
  wardrobeItems: T[],
): Array<T | (HydrateWardrobeLike & { userId: string; seasons: string[]; occasions: string[]; timesWorn: number; isFavorite: boolean; createdAt: string; updatedAt: string })> {
  return outfitItems.map((apiItem) => {
    const local = wardrobeItems.find((w) => String(w.id) === String(apiItem.id));
    const apiImage = apiItem.imageUri || apiItem.imageUrl || '';
    if (local) {
      const localImage = local.enhancedImageUri || local.imageUri || '';
      if (localImage) return local;
      if (!apiImage) return local;
      return {
        ...local,
        imageUri: apiImage,
        enhancedImageUri: apiImage,
        imageProcessed: true,
      };
    }

    const imageUri = apiImage;
    return {
      id: String(apiItem.id),
      userId: '',
      imageUri,
      enhancedImageUri: imageUri || undefined,
      imageProcessed: Boolean(imageUri),
      category: apiItem.category || 'tops',
      color: apiItem.color || 'multicolor',
      name: apiItem.name || 'Item',
      seasons: ['all-season'],
      occasions: ['everyday'],
      timesWorn: 0,
      isFavorite: false,
      createdAt: '',
      updatedAt: '',
    };
  });
}
