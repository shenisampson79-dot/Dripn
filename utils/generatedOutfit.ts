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
import { presentCanonicalOutfit, canonicalItemIds } from '@/utils/outfitCompatibilityGuard';

export { hydrateGeneratedOutfitItems, type GeneratedOutfitApiItem };

/**
 * Offline / internal helper only — must NOT be the primary publish path.
 * Canonical publish goes through server createWardrobeOutfit.
 * @deprecated Do not call for customer-facing publish; use generateWardrobeOutfit (server-first).
 */
export const allocateSingleDayOutfitInternal = allocateSingleDayOutfit;

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
  acceptedItemIds?: string[];
  renderedCardItemIds?: string[];
  service?: string;
};

export function resolveGeneratedOutfitItemIds(
  result: {
    outfit?: { items?: Array<{ id?: string | number }> };
    hydratedItems?: Array<{ id?: string | number }>;
    acceptedItemIds?: Array<string | number>;
    itemIds?: Array<string | number>;
  },
  wardrobeItems: WardrobeItem[],
  occasionType?: OutfitOccasionId | 'todays_look',
): string[] {
  const wardrobeIds = new Set(wardrobeItems.map((item) => String(item.id)));
  const pickIds = (rows?: Array<{ id?: string | number }>) =>
    (rows || [])
      .map((row) => String(row.id))
      .filter((id) => wardrobeIds.has(id));

  const fromAccepted = (result.acceptedItemIds || result.itemIds || [])
    .map(String)
    .filter((id) => wardrobeIds.has(id));
  if (fromAccepted.length) {
    return orderItemIdsByVisualOrder(fromAccepted, wardrobeItems);
  }

  const fromHydrated = pickIds(result.hydratedItems);
  const rawIds = fromHydrated.length > 0 ? fromHydrated : pickIds(result.outfit?.items);
  return orderItemIdsByVisualOrder(
    completeOutfitItemIds([...new Set(rawIds)], wardrobeItems, occasionType),
    wardrobeItems,
  );
}

function displayFromServerItems(
  items: WardrobeItem[],
  opts?: {
    weather?: { temperature: number; condition: string } | null;
    userAsk?: string | null;
    occasionType?: string;
    stylistMessage?: string;
    vibeLabel?: string;
    acceptedItemIds?: string[];
    service?: string;
  },
): GeneratedOutfitDisplay {
  const frozen = presentCanonicalOutfit(items, {
    occasion: opts?.occasionType || 'casual_day',
    source: 'client_canonical',
  });
  const acceptedItemIds = frozen
    ? canonicalItemIds(frozen)
    : items.map((i) => String(i.id));
  const ordered = sortOutfitItemsByVisualOrder(
    items.filter((i) => acceptedItemIds.includes(String(i.id))),
  );
  const explain = buildDeterministicOutfitExplain({
    items: ordered,
    occasionType: (opts?.occasionType || 'casual_day') as OutfitOccasionId,
    weather: opts?.weather || null,
    userAsk: opts?.userAsk || null,
  });
  const label = String(opts?.occasionType || 'casual_day').replace(/_/g, ' ');
  return {
    items: ordered,
    vibeLabel: opts?.vibeLabel || label,
    stylistMessage: opts?.stylistMessage || explain || undefined,
    allocationMode: 'createWardrobeOutfit',
    acceptedItemIds,
    renderedCardItemIds: acceptedItemIds,
    service: opts?.service || 'createWardrobeOutfit',
  };
}

/**
 * Canonical client entry for wardrobe outfit generation.
 * Always prefers server createWardrobeOutfit (/api/stylist/generate or chat outfit).
 * Local allocateSingleDayOutfit is demoted to offline-only emergency and cannot
 * publish independently when the server is reachable.
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
  /** @deprecated Ignored — server is always primary; local only on hard offline. */
  skipDecorate?: boolean;
  workDressCode?: WorkDressCode | null;
  brandInspiration?: string | null;
  /** Original user ask — grounds deterministic card footer. */
  userAsk?: string | null;
  /** Optional lat for calendar-season heavy-layer fallback when weather is null. */
  weatherLat?: number | null;
  /** Force offline local path (tests / true offline). */
  forceOffline?: boolean;
}): Promise<GeneratedOutfitDisplay & { raw?: Awaited<ReturnType<typeof apiService.generateStylistOutfit>> }> {
  const {
    occasionType,
    wardrobeItems,
    stylistId,
    user,
    onboardingProfile,
    weather,
    excludeItemIds,
    priorOutfits,
    userAsk,
    weatherLat,
    forceOffline = false,
  } = params;

  void hydrateOutfitFeedbackBrain();
  void params.skipDecorate;

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
  const occasionForApi = normalizeAllocatorOccasion(occasionType);
  const regional = resolveRegionalStyleContext(user, onboardingProfile);
  const priorIdLists = (priorOutfits || []).map((look) =>
    look.map((i) => String(i.id)),
  );

  // --- Canonical server path ---
  if (!forceOffline) {
    try {
      const result = await apiService.generateStylistOutfit({
        intent: occasionType === 'todays_look' ? 'today' : 'chat',
        occasionType: occasionForApi,
        weather: resolvedWeather
          ? {
              temperature: resolvedWeather.temperature,
              condition: resolvedWeather.condition,
            }
          : null,
        stylistId,
        localItems: wardrobeItems.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          color: i.color,
          brand: i.brand,
          subcategory: i.subcategory,
          imageUri: i.imageUri,
        })),
        excludeItemIds,
        priorOutfits: priorIdLists,
        recentOutfits: priorIdLists,
        environment: {
          weather: resolvedWeather || undefined,
          occasion: occasionForApi,
          dressCode: workDressCode || undefined,
          countryCode: regional.countryCode || undefined,
        },
      });

      if (result?.success && (result.items?.length || result.itemIds?.length || result.outfit)) {
        const ids = resolveGeneratedOutfitItemIds(
          {
            acceptedItemIds: result.acceptedItemIds || result.itemIds,
            itemIds: result.itemIds,
            outfit: result.outfit,
            hydratedItems: result.items || result.hydratedItems,
          },
          wardrobeItems,
          occasionType,
        );
        const byId = new Map(wardrobeItems.map((i) => [String(i.id), i]));
        const items = ids.map((id) => byId.get(id)).filter(Boolean) as WardrobeItem[];
        if (items.length >= 3) {
          return {
            ...displayFromServerItems(items, {
              weather: resolvedWeather as { temperature: number; condition: string } | null,
              userAsk,
              occasionType: occasionForApi,
              stylistMessage: result.stylistMessage || result.why?.[0],
              vibeLabel: result.vibeLabel,
              acceptedItemIds: ids,
              service: result.service || 'createWardrobeOutfit',
            }),
            raw: result,
          };
        }
      }
    } catch (error) {
      console.warn(
        '[generateWardrobeOutfit] Server createWardrobeOutfit failed; offline demoted path only:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  // --- Demoted offline emergency (cannot publish independently when server works) ---
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

  const offline = displayFromServerItems(allocated.items, {
    weather: resolvedWeather as { temperature: number; condition: string } | null,
    userAsk,
    occasionType: allocated.occasionType,
  });
  return {
    ...offline,
    allocationMode: 'offline_demoted_allocator',
    service: 'offline_demoted',
  };
}
