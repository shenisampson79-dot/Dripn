import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem, ClothingCategory } from '@/contexts/WardrobeContext';
import type { UserProfile } from '@/contexts/AuthContext';
import type { OnboardingProfile } from '@/services/OnboardingProfileService';
import { completeOutfitItemIds, MIN_OUTFIT_ITEMS } from '@/utils/completeOutfit';
import { orderItemIdsByVisualOrder, sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import { resolveRegionalStyleContext } from '@/utils/outfitRegionalContext';
import {
  allocateSingleDayOutfit,
  normalizeAllocatorOccasion,
} from '@/utils/wardrobeAllocationEngine';
import { laundryProfileFromUser } from '@/utils/wearRules';
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
  allocationMode?: string;
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

function displayFromAllocation(
  allocated: Extract<ReturnType<typeof allocateSingleDayOutfit>, { ok: true }>,
): GeneratedOutfitDisplay {
  const label = allocated.occasionType.replace(/_/g, ' ');
  return {
    items: sortOutfitItemsByVisualOrder(allocated.items),
    vibeLabel: label,
    stylistMessage: `Here's a ${label} look from pieces you already own.`,
    allocationMode: allocated.mode,
  };
}

/**
 * Constraint-first wardrobe outfit generation.
 * Allocator picks inventory; API may only decorate copy (and is never trusted to invent items).
 */
export async function generateWardrobeOutfit(params: {
  occasionType: OutfitOccasionId | 'todays_look';
  wardrobeItems: WardrobeItem[];
  stylistId?: string;
  saveToCalendar?: boolean;
  calendarDate?: string;
  user?: UserProfile | null;
  onboardingProfile?: OnboardingProfile | null;
  weather?: { temperature: number; condition: string } | null;
  excludeItemIds?: string[];
  /** Recent outfits to diversify against (stylist regenerations). */
  priorOutfits?: WardrobeItem[][];
  /** Local allocator only — skip slow API decorate (Today's outfit, quick chips). */
  skipDecorate?: boolean;
}): Promise<GeneratedOutfitDisplay & { raw?: Awaited<ReturnType<typeof apiService.generateOutfit>> }> {
  const {
    occasionType,
    wardrobeItems,
    stylistId,
    saveToCalendar,
    calendarDate,
    user,
    onboardingProfile,
    weather,
    excludeItemIds,
    priorOutfits,
    skipDecorate = false,
  } = params;

  const allocated = allocateSingleDayOutfit({
    wardrobe: wardrobeItems,
    occasionType,
    excludeItemIds,
    laundryProfile: laundryProfileFromUser(user),
    priorOutfits,
  });

  if (!allocated.ok) {
    throw new Error(allocated.message || 'Could not build a complete outfit from your wardrobe.');
  }

  const base = displayFromAllocation(allocated);
  if (skipDecorate) {
    return base;
  }

  const regional = resolveRegionalStyleContext(user, onboardingProfile);
  const occasionForApi = normalizeAllocatorOccasion(occasionType);

  // Optional decorate: ask API for stylist voice only, constrained to allocated items
  try {
    const result = await apiService.generateOutfit({
      occasionType: occasionForApi as Parameters<typeof apiService.generateOutfit>[0]['occasionType'],
      stylistId,
      saveToCalendar,
      calendarDate,
      weather: weather || undefined,
      countryCode: regional.countryCode || undefined,
      preferredStyles: regional.styleTags,
      // Pass ONLY allocated pieces so the server cannot invent substitutes
      localItems: allocated.items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        color: i.color,
        imageUri: i.imageUri,
      })),
      excludeItemIds: wardrobeItems
        .map((i) => String(i.id))
        .filter((id) => !allocated.itemIds.includes(id)),
      contextNotes:
        `CONSTRAINT ENGINE already selected these exact item IDs: ${allocated.itemIds.join(', ')}. ` +
        `Use ONLY these items (they are the full wardrobe for this request). ` +
        `Return them unchanged. Write stylistMessage + vibeLabel only — do not substitute pieces.`,
    });

    if (result.success) {
      return {
        ...base,
        raw: result,
        stylistMessage:
          result.stylistMessage
          || result.outfit?.stylistMessage
          || base.stylistMessage,
        vibeLabel: result.vibeLabel || result.outfit?.vibe || base.vibeLabel,
      };
    }
  } catch (error) {
    console.warn(
      '[generateWardrobeOutfit] Decorate call failed; keeping allocator outfit:',
      error instanceof Error ? error.message : error,
    );
  }

  return base;
}
