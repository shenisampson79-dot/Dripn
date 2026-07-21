import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lifestyle, StyleTheme, DripnGoal, Gender, UserProfile } from '@/contexts/AuthContext';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  getTodaysOutfitPopupPrefs,
  type TodaysOutfitPopupPrefs,
} from '@/utils/todaysOutfitPrefs';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { DressFor, OnboardingProfile } from '@/services/OnboardingProfileService';
import {
  completeOutfitItemIds,
  MIN_OUTFIT_ITEMS,
  wardrobeCanBuildCompleteOutfit,
} from '@/utils/completeOutfit';
import { sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import {
  countWardrobeOutfitBasics,
  describeOutfitPlanningGap,
} from '@/utils/wardrobeOutfitReadiness';
import {
  allocateSingleDayOutfit,
  normalizeAllocatorOccasion,
} from '@/utils/wardrobeAllocationEngine';
import { laundryProfileFromUser, type LaundryProfile } from '@/utils/wearRules';
import {
  occasionLabelForType,
  outfitMeetsOccasionStandard,
} from '@/utils/fashionEditorialRubric';
import { isOutfitValid } from '@/utils/outfitClashRules';
import { traceTodaysOutfit } from '@/utils/todaysOutfitTrace';

export type WeatherSnapshot = {
  temperature: number;
  condition: string;
  location: string;
};

export type OutfitUserContext = {
  gender?: Gender;
  lifestyle?: Lifestyle;
  stylePreference?: StyleTheme;
  usageGoals?: DripnGoal[];
  country?: string;
  stylistId?: string;
};

export type WardrobeTodaysOutfit = {
  /** Stable id for button actions — dateKey + sorted item ids. */
  id: string;
  dateKey: string;
  itemIds: string[];
  stylistMessage?: string;
  vibeLabel?: string;
  occasionType: OutfitOccasionId | 'todays_look';
  dressFor?: DressFor;
  weatherTemp?: number;
  weatherCondition?: string;
  weatherLocation?: string;
  dayLabel?: string;
  occasionLabel?: string;
};

export type TodaysOutfitFallbackTier = 'strict' | 'relaxed' | 'minimal' | 'emergency';

export const TODAYS_OUTFIT_GENERATION_BUDGET_MS = 2000;

const STORAGE_KEY = '@dripn_todays_wardrobe_outfit';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

export function stableTodaysOutfitId(date: string, itemIds: string[]): string {
  const sorted = [...itemIds].map(String).sort().join('|');
  return `${date}:${sorted}`;
}

function withStableId(outfit: Omit<WardrobeTodaysOutfit, 'id'> & { id?: string }): WardrobeTodaysOutfit {
  return {
    ...outfit,
    id: outfit.id || stableTodaysOutfitId(outfit.dateKey, outfit.itemIds),
  };
}

function hydrateItems(itemIds: string[], wardrobeItems: WardrobeItem[]): WardrobeItem[] {
  const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
  return itemIds.map((id) => byId.get(String(id))).filter(Boolean) as WardrobeItem[];
}

export function resolveTodaysOccasion(
  profile: OnboardingProfile,
  user?: OutfitUserContext,
  prefs?: Pick<TodaysOutfitPopupPrefs, 'preferredOccasion'>,
  now: Date = new Date(),
): {
  dressFor: DressFor;
  occasionType: OutfitOccasionId | 'todays_look';
  dayLabel: string;
  isWeekday: boolean;
} {
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekday = day >= 1 && day <= 5;
  const isDaytime = hour < 17;
  const datePart = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const dayLabel = `${DAY_NAMES[day]} · ${datePart}`;
  const lifestyle = user?.lifestyle;
  const goals = user?.usageGoals || [];
  const style = user?.stylePreference;
  const professional =
    lifestyle === 'professional'
    || goals.includes('professional-image')
    || style === 'business'
    || style === 'smart-casual';

  const explicit = profile.dressFor;
  const forced = prefs?.preferredOccasion && prefs.preferredOccasion !== 'auto'
    ? prefs.preferredOccasion
    : null;

  let dressFor: DressFor;
  if (forced) {
    dressFor = forced;
  } else if (isWeekday && isDaytime) {
    if (professional || explicit === 'work') dressFor = 'work';
    else dressFor = 'myself';
  } else if (isWeekday) {
    if (explicit === 'date' || explicit === 'event' || explicit === 'friends') dressFor = explicit;
    else if (professional || explicit === 'work') dressFor = 'myself';
    else dressFor = explicit || 'myself';
  } else if (explicit === 'date' || explicit === 'event' || explicit === 'friends') {
    dressFor = explicit;
  } else if (explicit === 'work') {
    dressFor = 'myself';
  } else {
    dressFor = explicit || 'friends';
  }

  const occasionType: OutfitOccasionId | 'todays_look' =
    dressFor === 'work'
      ? professional
        ? 'work_outfit'
        : 'smart_casual'
      : dressFor === 'date'
        ? 'date_night'
        : dressFor === 'event'
          ? 'evening_out'
          : dressFor === 'friends'
            ? isWeekday
              ? 'casual_day'
              : 'weekend'
            : isWeekday
              ? 'casual_day'
              : 'weekend';

  return { dressFor, occasionType, dayLabel, isWeekday };
}

const OCCASION_ALLOCATION_CASCADE: Partial<Record<OutfitOccasionId | 'todays_look', OutfitOccasionId[]>> = {
  work_outfit: ['work_outfit', 'smart_casual', 'casual_day'],
  smart_casual: ['smart_casual', 'casual_day'],
  date_night: ['date_night', 'smart_casual', 'evening_out', 'casual_day'],
  evening_out: ['evening_out', 'date_night', 'smart_casual'],
  weekend: ['weekend', 'casual_day'],
  casual_day: ['casual_day', 'weekend'],
  todays_look: ['casual_day', 'weekend'],
  gym: ['gym'],
  travel: ['travel', 'casual_day'],
  custom: ['custom', 'casual_day'],
};

function allocationCascadeFor(occasionType: OutfitOccasionId | 'todays_look'): OutfitOccasionId[] {
  return OCCASION_ALLOCATION_CASCADE[occasionType] || [normalizeAllocatorOccasion(occasionType), 'casual_day'];
}

function reconcileHonestOccasion(
  items: WardrobeItem[],
  requested: OutfitOccasionId | 'todays_look',
  allocated: OutfitOccasionId,
): { occasionType: OutfitOccasionId | 'todays_look'; occasionLabel: string } {
  const cascade = allocationCascadeFor(requested);
  for (const candidate of [allocated, ...cascade]) {
    if (outfitMeetsOccasionStandard(items, candidate)) {
      return { occasionType: candidate, occasionLabel: occasionLabelForType(candidate) };
    }
  }
  return { occasionType: 'casual_day', occasionLabel: occasionLabelForType('casual_day') };
}

function dressForFromHonestOccasion(
  honest: OutfitOccasionId | 'todays_look',
  fallback: DressFor,
): DressFor {
  if (honest === 'work_outfit') return 'work';
  if (honest === 'date_night') return 'date';
  if (honest === 'evening_out') return 'event';
  return fallback;
}

type LocalGenerationResult = {
  items: WardrobeItem[];
  stylistMessage?: string;
  vibeLabel?: string;
  allocatedOccasion: OutfitOccasionId;
  tier: TodaysOutfitFallbackTier;
};

function allocateLocal(
  wardrobeItems: WardrobeItem[],
  tryOccasion: OutfitOccasionId,
  laundryProfile = laundryProfileFromUser(null),
): WardrobeItem[] | null {
  const allocated = allocateSingleDayOutfit({
    wardrobe: wardrobeItems,
    occasionType: tryOccasion,
    laundryProfile,
  });
  if (!allocated.ok || allocated.items.length < MIN_OUTFIT_ITEMS) return null;
  if (!isOutfitValid(allocated.items)) return null;
  return allocated.items;
}

function generateLocalTiered(params: {
  wardrobeItems: WardrobeItem[];
  occasionType: OutfitOccasionId | 'todays_look';
  deadlineMs: number;
  laundryProfile?: LaundryProfile;
}): LocalGenerationResult | null {
  const { wardrobeItems, occasionType, deadlineMs, laundryProfile = laundryProfileFromUser(null) } = params;
  const cascade = allocationCascadeFor(occasionType);
  const started = Date.now();

  const withinBudget = () => Date.now() - started < deadlineMs;

  // strict — occasion standard + hard validity
  for (const tryOccasion of cascade) {
    if (!withinBudget()) break;
    const items = allocateLocal(wardrobeItems, tryOccasion, laundryProfile);
    if (items && outfitMeetsOccasionStandard(items, tryOccasion)) {
      return {
        items,
        vibeLabel: occasionLabelForType(tryOccasion),
        stylistMessage: `Here's a ${occasionLabelForType(tryOccasion).toLowerCase()} look from pieces you already own.`,
        allocatedOccasion: tryOccasion,
        tier: 'strict',
      };
    }
  }

  void traceTodaysOutfit('fallback', { tier: 'relaxed' });

  // relaxed — hard validity only
  for (const tryOccasion of cascade) {
    if (!withinBudget()) break;
    const items = allocateLocal(wardrobeItems, tryOccasion, laundryProfile);
    if (items) {
      return {
        items,
        vibeLabel: occasionLabelForType(tryOccasion),
        stylistMessage: `Here's a ${occasionLabelForType(tryOccasion).toLowerCase()} look from pieces you already own.`,
        allocatedOccasion: tryOccasion,
        tier: 'relaxed',
      };
    }
  }

  void traceTodaysOutfit('fallback', { tier: 'minimal' });

  // minimal — casual_day allocator only
  if (withinBudget()) {
    const items = allocateLocal(wardrobeItems, 'casual_day', laundryProfile);
    if (items) {
      return {
        items,
        vibeLabel: occasionLabelForType('casual_day'),
        stylistMessage: "Here's an everyday look from pieces you already own.",
        allocatedOccasion: 'casual_day',
        tier: 'minimal',
      };
    }
  }

  void traceTodaysOutfit('fallback', { tier: 'emergency' });

  // emergency — completeOutfitItemIds heuristic
  if (withinBudget()) {
    const fallbackIds = completeOutfitItemIds([], wardrobeItems, occasionType);
    const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
    const items = sortOutfitItemsByVisualOrder(
      fallbackIds
        .map((id) => byId.get(String(id)))
        .filter((item): item is WardrobeItem => Boolean(item)),
    );
    if (items.length >= MIN_OUTFIT_ITEMS && isOutfitValid(items)) {
      return {
        items,
        vibeLabel: occasionLabelForType('casual_day'),
        stylistMessage: "Here's a quick look from your wardrobe.",
        allocatedOccasion: 'casual_day',
        tier: 'emergency',
      };
    }
  }

  if (!withinBudget()) {
    void traceTodaysOutfit('timeout', { elapsedMs: Date.now() - started, budgetMs: deadlineMs });
  }

  return null;
}

export async function fetchWeatherSnapshot(): Promise<WeatherSnapshot | null> {
  try {
    const Location = await import('expo-location');
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    const status = existing;
    if (status !== 'granted') {
      return null;
    }

    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!location || !('coords' in location)) return null;

    const lat = location.coords.latitude;
    const lon = location.coords.longitude;

    const weatherResponse = await Promise.race([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (!weatherResponse || !('ok' in weatherResponse) || !weatherResponse.ok) return null;

    const weatherData = await weatherResponse.json();
    if (!weatherData.current_weather) return null;

    const temp = Math.round(weatherData.current_weather.temperature);
    const weatherCode = weatherData.current_weather.weathercode;
    let condition = 'mild';
    if (weatherCode <= 3) condition = 'clear';
    else if (weatherCode <= 48) condition = 'cloudy';
    else if (weatherCode <= 67) condition = 'rainy';
    else if (weatherCode <= 77) condition = 'snowy';
    else condition = 'stormy';

    let locationName = 'Your area';
    try {
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1`,
      );
      const geoData = await geoResponse.json();
      if (geoData.results?.length) {
        locationName = geoData.results[0].name || geoData.results[0].admin1 || locationName;
      }
    } catch {
      // keep default
    }

    return { temperature: temp, condition, location: locationName };
  } catch {
    return null;
  }
}

async function enrichOutfitWeatherInBackground(outfit: WardrobeTodaysOutfit): Promise<void> {
  try {
    const weather = await fetchWeatherSnapshot();
    if (!weather) return;
    const updated = withStableId({
      ...outfit,
      weatherTemp: weather.temperature,
      weatherCondition: weather.condition,
      weatherLocation: weather.location,
    });
    await storeTodaysWardrobeOutfit(updated);
  } catch {
    // non-fatal decoration
  }
}

export function getWardrobeReadinessMessage(items: WardrobeItem[]): string | null {
  if (wardrobeCanBuildCompleteOutfit(items)) return null;
  const counts = countWardrobeOutfitBasics(items);
  return describeOutfitPlanningGap(counts);
}

export async function loadStoredTodaysWardrobeOutfit(): Promise<WardrobeTodaysOutfit | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WardrobeTodaysOutfit;
    if (parsed.dateKey !== dateKey()) return null;
    if (!parsed.itemIds?.length) return null;
    return withStableId(parsed);
  } catch {
    return null;
  }
}

export async function storeTodaysWardrobeOutfit(outfit: WardrobeTodaysOutfit): Promise<void> {
  const stable = withStableId(outfit);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stable));
}

function buildOutfitFromLocal(
  generated: LocalGenerationResult,
  occasionType: OutfitOccasionId | 'todays_look',
  dressFor: DressFor,
  dayLabel: string,
): WardrobeTodaysOutfit {
  const honest = reconcileHonestOccasion(
    generated.items,
    occasionType,
    generated.allocatedOccasion,
  );

  void traceTodaysOutfit('validate', {
    tier: generated.tier,
    occasionType: honest.occasionType,
    occasionLabel: honest.occasionLabel,
    itemCount: generated.items.length,
    hardValid: isOutfitValid(generated.items),
  });

  const itemIds = generated.items.map((i) => String(i.id));
  return withStableId({
    dateKey: dateKey(),
    itemIds,
    stylistMessage: generated.stylistMessage,
    vibeLabel: generated.vibeLabel || honest.occasionLabel,
    occasionType: honest.occasionType,
    dressFor: dressForFromHonestOccasion(honest.occasionType, dressFor),
    dayLabel,
    occasionLabel: honest.occasionLabel,
  });
}

export async function resolveCachedTodaysOutfit(params: {
  wardrobeItems: WardrobeItem[];
  profile: OnboardingProfile;
  user?: UserProfile | null;
}): Promise<{ outfit: WardrobeTodaysOutfit; items: WardrobeItem[] } | null> {
  const stored = await loadStoredTodaysWardrobeOutfit();
  if (!stored) return null;

  const popupPrefs = await getTodaysOutfitPopupPrefs();
  const expected = resolveTodaysOccasion(
    params.profile,
    {
      gender: params.user?.gender,
      lifestyle: params.user?.lifestyle,
      stylePreference: params.user?.stylePreference,
      usageGoals: params.user?.usageGoals,
      country: params.user?.country,
      stylistId: params.user?.stylistPreferences?.selectedStylistId,
    },
    popupPrefs,
  );

  if (stored.dressFor && stored.dressFor !== expected.dressFor) {
    return null;
  }

  const items = hydrateItems(stored.itemIds, params.wardrobeItems);
  if (items.length < MIN_OUTFIT_ITEMS) return null;

  const honest = reconcileHonestOccasion(
    items,
    expected.occasionType,
    normalizeAllocatorOccasion(expected.occasionType),
  );

  return {
    outfit: withStableId({
      ...stored,
      dayLabel: expected.dayLabel,
      occasionLabel: honest.occasionLabel,
      occasionType: honest.occasionType,
      dressFor: dressForFromHonestOccasion(honest.occasionType, expected.dressFor),
      vibeLabel: stored.vibeLabel || honest.occasionLabel,
    }),
    items,
  };
}

/**
 * Background precompute at app launch / wardrobe sync — never blocks UI.
 * Hot path is fully local; weather enriches asynchronously.
 */
export async function prewarmTodaysWardrobeOutfit(params: {
  wardrobeItems: WardrobeItem[];
  profile: OnboardingProfile;
  user?: UserProfile | null;
}): Promise<void> {
  await traceTodaysOutfit('trigger', { source: 'prewarm' });

  if (!wardrobeCanBuildCompleteOutfit(params.wardrobeItems)) return;

  const cached = await resolveCachedTodaysOutfit(params);
  if (cached) {
    await traceTodaysOutfit('cache_hit', { id: cached.outfit.id });
    if (cached.outfit.weatherTemp == null) {
      void enrichOutfitWeatherInBackground(cached.outfit);
    }
    return;
  }

  await traceTodaysOutfit('cache_miss', { source: 'prewarm' });
  await generateTodaysWardrobeOutfit({ ...params, forceRefresh: false });
}

export async function generateTodaysWardrobeOutfit(params: {
  wardrobeItems: WardrobeItem[];
  profile: OnboardingProfile;
  user?: UserProfile | null;
  forceRefresh?: boolean;
}): Promise<
  | { ok: true; outfit: WardrobeTodaysOutfit; items: WardrobeItem[] }
  | { ok: false; reason: 'not_ready' | 'generate_failed'; message: string }
> {
  const { wardrobeItems, profile, user, forceRefresh } = params;

  await traceTodaysOutfit('trigger', { forceRefresh: Boolean(forceRefresh) });

  if (!forceRefresh) {
    const cached = await resolveCachedTodaysOutfit({ wardrobeItems, profile, user });
    if (cached) {
      await traceTodaysOutfit('cache_hit', { id: cached.outfit.id });
      if (cached.outfit.weatherTemp == null) {
        void enrichOutfitWeatherInBackground(cached.outfit);
      }
      return { ok: true, ...cached };
    }
    await traceTodaysOutfit('cache_miss', {});
  }

  const readiness = getWardrobeReadinessMessage(wardrobeItems);
  if (readiness) {
    return { ok: false, reason: 'not_ready', message: readiness };
  }

  const popupPrefs = await getTodaysOutfitPopupPrefs();
  const userContext: OutfitUserContext = {
    gender: user?.gender,
    lifestyle: user?.lifestyle,
    stylePreference: user?.stylePreference,
    usageGoals: user?.usageGoals,
    country: user?.country,
    stylistId: user?.stylistPreferences?.selectedStylistId,
  };
  const { dressFor, occasionType, dayLabel } = resolveTodaysOccasion(
    profile,
    userContext,
    popupPrefs,
  );

  const started = Date.now();
  try {
    // Fully local hot path — skipDecorate, bounded allocator, tiered fallback, 2s budget.
    const generated = generateLocalTiered({
      wardrobeItems,
      occasionType,
      deadlineMs: TODAYS_OUTFIT_GENERATION_BUDGET_MS,
      laundryProfile: laundryProfileFromUser(user),
    });

    if (!generated) {
      throw new Error('Could not build today’s outfit from your wardrobe.');
    }

    const outfit = buildOutfitFromLocal(generated, occasionType, dressFor, dayLabel);
    await storeTodaysWardrobeOutfit(outfit);

    await traceTodaysOutfit('generate', {
      id: outfit.id,
      tier: generated.tier,
      elapsedMs: Date.now() - started,
      network: false,
    });

    void enrichOutfitWeatherInBackground(outfit);

    return { ok: true, outfit, items: generated.items };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not build today’s outfit from your wardrobe. Try again.';
    return { ok: false, reason: 'generate_failed', message };
  }
}
