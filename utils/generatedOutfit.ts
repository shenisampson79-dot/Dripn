import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem, ClothingCategory } from '@/contexts/WardrobeContext';
import type { UserProfile } from '@/contexts/AuthContext';
import type { OnboardingProfile } from '@/services/OnboardingProfileService';
import { completeOutfitItemIds, MIN_OUTFIT_ITEMS } from '@/utils/completeOutfit';
import { orderItemIdsByVisualOrder, sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import { resolveRegionalStyleContext } from '@/utils/outfitRegionalContext';
import apiService from '@/services/ApiService';
export type GeneratedOutfitApiItem = {
  id: string | number;
  name?: string;
  category?: string;
  color?: string;
  imageUri?: string | null;
  imageUrl?: string | null;
};

export type GeneratedOutfitDisplay = {
  items: WardrobeItem[];
  stylistMessage?: string;
  vibeLabel?: string;
};

export function hydrateGeneratedOutfitItems(
  outfitItems: GeneratedOutfitApiItem[],
  wardrobeItems: WardrobeItem[],
): WardrobeItem[] {
  return outfitItems.map((apiItem) => {
    const local = wardrobeItems.find((w) => String(w.id) === String(apiItem.id));
    if (local) return local;

    const imageUri = apiItem.imageUri || apiItem.imageUrl || '';
    return {
      id: String(apiItem.id),
      userId: '',
      imageUri,
      enhancedImageUri: imageUri || undefined,
      imageProcessed: Boolean(imageUri),
      category: (apiItem.category as ClothingCategory) || 'tops',
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

export function resolveGeneratedOutfitItemIds(
  result: {
    outfit?: { items?: Array<{ id?: string | number }> };
    hydratedItems?: Array<{ id?: string | number }>;
  },
  wardrobeItems: WardrobeItem[],
  occasionType?: OutfitOccasionId | 'todays_look',
): string[] {
  const wardrobeIds = new Set(wardrobeItems.map((item) => String(item.id)));
  const pickIds = (rows?: Array<{ id?: string | number }>) =>
    (rows || [])
      .map((row) => String(row.id))
      .filter((id) => wardrobeIds.has(id));

  const fromHydrated = pickIds(result.hydratedItems);
  const rawIds = fromHydrated.length > 0 ? fromHydrated : pickIds(result.outfit?.items);
  return orderItemIdsByVisualOrder(
    completeOutfitItemIds([...new Set(rawIds)], wardrobeItems, occasionType),
    wardrobeItems,
  );
}

export async function generateWardrobeOutfit(params: {
  occasionType: OutfitOccasionId | 'todays_look';
  wardrobeItems: WardrobeItem[];
  stylistId?: string;
  saveToCalendar?: boolean;
  calendarDate?: string;
  user?: UserProfile | null;
  onboardingProfile?: OnboardingProfile | null;
  weather?: { temperature: number; condition: string } | null;
}): Promise<GeneratedOutfitDisplay & { raw: Awaited<ReturnType<typeof apiService.generateOutfit>> }> {
  const {
    occasionType,
    wardrobeItems,
    stylistId,
    saveToCalendar,
    calendarDate,
    user,
    onboardingProfile,
    weather,
  } = params;
  const regional = resolveRegionalStyleContext(user, onboardingProfile);

  const result = await apiService.generateOutfit({
    occasionType: occasionType as Parameters<typeof apiService.generateOutfit>[0]['occasionType'],
    stylistId,
    saveToCalendar,
    calendarDate,
    weather: weather || undefined,
    countryCode: regional.countryCode || undefined,
    preferredStyles: regional.styleTags,
    localItems: wardrobeItems.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      color: i.color,
      imageUri: i.imageUri,
    })),
  });

  if (!result.success || !result.outfit) {
    throw new Error(result.message || 'Unable to generate outfit');
  }

  const completedIds = resolveGeneratedOutfitItemIds(result, wardrobeItems, occasionType);
  const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
  const displayItems = sortOutfitItemsByVisualOrder(
    completedIds
      .map((id) => byId.get(id))
      .filter((item): item is WardrobeItem => Boolean(item)),
  );

  if (displayItems.length < MIN_OUTFIT_ITEMS) {
    throw new Error('Could not build a complete outfit from your wardrobe. Add tops, bottoms, and shoes.');
  }

  return {
    raw: result,
    items: displayItems,
    stylistMessage: result.stylistMessage || result.outfit.stylistMessage,
    vibeLabel: result.vibeLabel || result.outfit.vibe,
  };
}
