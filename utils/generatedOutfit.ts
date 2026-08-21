import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { UserProfile } from '@/contexts/AuthContext';
import type { OnboardingProfile } from '@/services/OnboardingProfileService';
import { completeOutfitItemIds } from '@/utils/completeOutfit';
import { orderItemIdsByVisualOrder, sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import { resolveRegionalStyleContext } from '@/utils/outfitRegionalContext';
import {
  allocateSingleDayOutfit,
  normalizeAllocatorOccasion,
} from '@/utils/wardrobeAllocationEngine';
import { laundryProfileFromUser } from '@/utils/wearRules';
import apiService from '@/services/ApiService';
import type { WorkDressCode } from '@/services/OnboardingProfileService';
import { normalizeWorkDressCode } from '@/services/OnboardingProfileService';
import { getTodaysOutfitPopupPrefs } from '@/utils/todaysOutfitPrefs';
import { resolveBrandInspiration } from '@/utils/yoloToPipelineCandidates';
import { hydrateOutfitFeedbackBrain } from '@/utils/outfitFeedbackBrain';
import {
  hydrateGeneratedOutfitItems,
  type GeneratedOutfitApiItem,
} from '@/utils/hydrateGeneratedOutfitItems';
import { buildDeterministicOutfitExplain } from '@/utils/buildDeterministicOutfitExplain';
import { resolveWeatherForAllocator } from '@/utils/weatherOuterwear';

export { hydrateGeneratedOutfitItems, type GeneratedOutfitApiItem };

async function getTodaysOutfitPrefsSafe() {
  try {
    return await getTodaysOutfitPopupPrefs();
  } catch {
    return null;
  }
}

export type GeneratedOutfitDisplay = {
  items: WardrobeItem[];
  stylistMessage?: string;
  vibeLabel?: string;
  allocationMode?: string;
};

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
  opts?: {
    weather?: { temperature: number; condition: string } | null;
    userAsk?: string | null;
  },
): GeneratedOutfitDisplay {
  const explain = buildDeterministicOutfitExplain({
    items: allocated.items,
    occasionType: allocated.occasionType,
    weather: opts?.weather || null,
    userAsk: opts?.userAsk || null,
  });
  const label = allocated.occasionType.replace(/_/g, ' ');
  return {
    items: sortOutfitItemsByVisualOrder(allocated.items),
    vibeLabel: label,
    stylistMessage: explain || undefined,
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
  workDressCode?: WorkDressCode | null;
  brandInspiration?: string | null;
  /** Original user ask — grounds deterministic card footer. */
  userAsk?: string | null;
  /** Optional lat for calendar-season heavy-layer fallback when weather is null. */
  weatherLat?: number | null;
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
    userAsk,
    weatherLat,
  } = params;

  void hydrateOutfitFeedbackBrain();

  let workDressCode = params.workDressCode ?? null;
  let brandInspiration = params.brandInspiration ?? null;
  if (workDressCode == null || brandInspiration == null) {
    try {
      const prefs = await getTodaysOutfitPrefsSafe();
      if (workDressCode == null) {
        workDressCode = normalizeWorkDressCode(
          prefs?.workDressCode ?? onboardingProfile?.workDressCode ?? null,
        );
      }
      if (brandInspiration == null) {
        brandInspiration = resolveBrandInspiration(
          user?.extendedPreferences?.favoriteBrands || null,
        );
      }
    } catch {
      /* keep nulls */
    }
  }

  const resolvedWeather = resolveWeatherForAllocator(weather || null, {
    lat: weatherLat ?? null,
  });

  const allocated = allocateSingleDayOutfit({
    wardrobe: wardrobeItems,
    occasionType,
    excludeItemIds,
    laundryProfile: laundryProfileFromUser(user),
    priorOutfits,
    weather: resolvedWeather,
    workDressCode,
    brandInspiration,
  });
  if (!allocated.ok) {
    throw new Error(allocated.message || 'Could not build a complete outfit from your wardrobe.');
  }

  const base = displayFromAllocation(allocated, {
    weather: resolvedWeather as { temperature: number; condition: string } | null,
    userAsk,
  });
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
      weather: resolvedWeather || undefined,
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
      const decorated =
        result.stylistMessage
        || result.outfit?.stylistMessage
        || '';
      // Prefer grounded deterministic explain over generic "pieces you already own" decorate.
      const useDecorated = decorated
        && !/pieces you already own/i.test(decorated)
        && !/^here'?s a .+ look from/i.test(decorated);
      return {
        ...base,
        raw: result,
        stylistMessage: useDecorated ? decorated : (base.stylistMessage || decorated),
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
