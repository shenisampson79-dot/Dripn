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
import {
  localDateKey,
  TODAYS_OUTFIT_ANTI_REPEAT_DAYS,
} from '@/utils/localDateKey';
import { apiService } from '@/services/ApiService';
import {
  countTrioChanges,
  diversityBanBottomAndShoes,
  diversityExcludeIdsFromHistory,
  isTooSimilar,
  TODAY_DIVERSITY_HISTORY,
} from '@/utils/outfitDiversityHard';
import { isTopItem, isBottomItem, isShoesItem } from '@/utils/completeOutfit';

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

export type TodaysOutfitDiversityMeta = {
  historyCount: number;
  rejectedSimilar?: number;
  wardrobeLocked?: boolean;
  cacheHit?: boolean;
  forceRefresh?: boolean;
  pickedItemIds?: string[];
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
  /** Lightweight explainability from shared server engine (when available). */
  why?: string[];
  /** true when built via POST /api/stylist/generate; false for offline fallback. */
  fromServer?: boolean;
  diversity?: TodaysOutfitDiversityMeta;
};

export type TodaysOutfitFallbackTier = 'strict' | 'relaxed' | 'minimal' | 'emergency';

export const TODAYS_OUTFIT_GENERATION_BUDGET_MS = 2000;

/**
 * Offline / UX fallback only. Server (`/api/stylist/generate`, intent: today) is authority.
 * Kept so Today still works with no network; do not treat as a parallel product pipeline.
 */
export const TODAYS_OUTFIT_OFFLINE_FALLBACK = true;

const STORAGE_KEY = '@dripn_todays_wardrobe_outfit';
const HISTORY_KEY = '@dripn_todays_outfit_history';
/** Last non-today recommendation kept so day-rollover / OTA can seed priorOutfits. */
const PREVIOUS_KEY = '@dripn_todays_wardrobe_outfit_previous';
/** One-shot: clear stuck same-day cache after hard-diversity cache-bust ship. */
const DIVERSITY_BUST_KEY = '@dripn_todays_diversity_bust_v3';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Loud diversity diagnostics — always on (user already frustrated by silent repeats). */
function logDiversity(tag: string, detail: Record<string, unknown>): void {
  console.warn(`[TodaysOutfit:diversity:${tag}]`, detail);
  void traceTodaysOutfit('generate', { diversityTag: tag, ...detail });
}

/** Local calendar day — must match dismiss keys and user-facing “today”. */
export function dateKey(now: Date = new Date()) {
  return localDateKey(now);
}

type TodaysOutfitHistoryEntry = {
  dateKey: string;
  itemIds: string[];
};

async function loadTodaysOutfitHistory(): Promise<TodaysOutfitHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TodaysOutfitHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.dateKey === 'string' && Array.isArray(e.itemIds),
    );
  } catch {
    return [];
  }
}

async function persistHistory(entries: TodaysOutfitHistoryEntry[]): Promise<void> {
  const next = entries
    .filter((e) => e && typeof e.dateKey === 'string' && Array.isArray(e.itemIds) && e.itemIds.length)
    .slice(0, Math.max(TODAYS_OUTFIT_ANTI_REPEAT_DAYS * 2, 14));
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

async function mergeHistoryEntry(entry: TodaysOutfitHistoryEntry): Promise<void> {
  const itemIds = (entry.itemIds || []).map(String).filter(Boolean);
  if (!itemIds.length || !entry.dateKey) return;
  try {
    const existing = await loadTodaysOutfitHistory();
    await persistHistory([
      { dateKey: entry.dateKey, itemIds },
      ...existing.filter((e) => e.dateKey !== entry.dateKey),
    ]);
  } catch {
    // non-fatal
  }
}

async function loadRawStoredOutfit(): Promise<WardrobeTodaysOutfit | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WardrobeTodaysOutfit;
    if (!parsed?.itemIds?.length) return null;
    return withStableId(parsed);
  } catch {
    return null;
  }
}

async function loadPreviousOutfit(): Promise<WardrobeTodaysOutfit | null> {
  try {
    const raw = await AsyncStorage.getItem(PREVIOUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WardrobeTodaysOutfit;
    if (!parsed?.itemIds?.length) return null;
    return withStableId(parsed);
  } catch {
    return null;
  }
}

function yesterdayDateKey(now: Date = new Date()): string {
  const y = new Date(now);
  y.setHours(12, 0, 0, 0);
  y.setDate(y.getDate() - 1);
  return dateKey(y);
}

/**
 * Seed history from previous-day cache / previous key so first request after OTA
 * still has priorOutfits for hard diversity (empty history was the silent fail).
 */
export async function seedTodaysOutfitHistoryFromStorage(): Promise<{
  historyCount: number;
  seededFrom: string[];
}> {
  const today = dateKey();
  const seededFrom: string[] = [];
  let history = await loadTodaysOutfitHistory();

  const ensurePrior = async (source: string, outfit: WardrobeTodaysOutfit | null) => {
    if (!outfit?.itemIds?.length) return;
    const day = outfit.dateKey || today;
    const entryDay = day < today ? day : yesterdayDateKey();
    const sig = [...outfit.itemIds].map(String).sort().join('|');
    const hasPriorDay = history.some((e) => e.dateKey !== today);
    const dup = history.some(
      (e) => [...e.itemIds].map(String).sort().join('|') === sig && e.dateKey !== today,
    );
    if (dup || (hasPriorDay && history.some((e) => e.dateKey === entryDay))) return;
    await mergeHistoryEntry({ dateKey: entryDay, itemIds: outfit.itemIds.map(String) });
    seededFrom.push(source);
    history = await loadTodaysOutfitHistory();
  };

  await ensurePrior('previous_key', await loadPreviousOutfit());

  const rawStored = await loadRawStoredOutfit();
  if (rawStored?.dateKey && rawStored.dateKey < today) {
    await ensurePrior('stale_today_cache', rawStored);
  }

  // Stuck same-day cache after OTA: treat as yesterday so hard filter has a prior.
  if (!history.some((e) => e.dateKey !== today) && rawStored?.itemIds?.length) {
    await ensurePrior('today_cache_as_yesterday', rawStored);
  }

  history = await loadTodaysOutfitHistory();
  const historyCount = history.filter((e) => e.dateKey !== today).length;
  logDiversity('seed_history', { dateKey: today, historyCount, seededFrom });
  return { historyCount, seededFrom };
}

async function rememberTodaysOutfitRecommendation(
  outfit: WardrobeTodaysOutfit,
): Promise<void> {
  const today = outfit.dateKey || dateKey();
  const itemIds = (outfit.itemIds || []).map(String).filter(Boolean);
  if (!itemIds.length) return;
  await mergeHistoryEntry({ dateKey: today, itemIds });
}

export async function clearTodaysOutfitCache(): Promise<void> {
  try {
    const raw = await loadRawStoredOutfit();
    if (raw?.itemIds?.length) {
      await AsyncStorage.setItem(PREVIOUS_KEY, JSON.stringify(raw));
      const priorDay =
        raw.dateKey && raw.dateKey < dateKey() ? raw.dateKey : yesterdayDateKey();
      await mergeHistoryEntry({ dateKey: priorDay, itemIds: raw.itemIds.map(String) });
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    logDiversity('clear_cache', {
      dateKey: dateKey(),
      clearedItemIds: raw?.itemIds || [],
    });
  } catch {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Soft anti-repeat: item ids recommended/shown in the last N local days
 * (excluding today). Used as server penalize + offline priorOutfits.
 */
export async function getRecentTodaysOutfitItemIds(options?: {
  days?: number;
  now?: Date;
  excludeToday?: boolean;
}): Promise<string[]> {
  const days = options?.days ?? TODAYS_OUTFIT_ANTI_REPEAT_DAYS;
  const now = options?.now ?? new Date();
  const today = dateKey(now);
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = dateKey(cutoff);

  await seedTodaysOutfitHistoryFromStorage();
  const history = await loadTodaysOutfitHistory();
  const ids = new Set<string>();
  for (const entry of history) {
    if (options?.excludeToday !== false && entry.dateKey === today) continue;
    if (entry.dateKey < cutoffKey) continue;
    for (const id of entry.itemIds) ids.add(String(id));
  }
  return [...ids];
}

function priorOutfitsFromHistory(
  history: TodaysOutfitHistoryEntry[],
  wardrobeItems: WardrobeItem[],
  today: string,
): WardrobeItem[][] {
  const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
  return history
    .filter((e) => e.dateKey !== today)
    .slice(0, TODAY_DIVERSITY_HISTORY)
    .map((e) =>
      e.itemIds
        .map((id) => byId.get(String(id)))
        .filter((item): item is WardrobeItem => Boolean(item)),
    )
    .filter((items) => items.length >= 2);
}

/** Prior outfit id lists for server hard diversity (most recent first). */
function priorOutfitIdListsFromHistory(
  history: TodaysOutfitHistoryEntry[],
  today: string,
): string[][] {
  return history
    .filter((e) => e.dateKey !== today)
    .slice(0, TODAY_DIVERSITY_HISTORY)
    .map((e) => e.itemIds.map(String).filter(Boolean))
    .filter((ids) => ids.length >= 2);
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
  priorOutfits: WardrobeItem[][] = [],
  excludeItemIds: string[] = [],
): WardrobeItem[] | null {
  const allocated = allocateSingleDayOutfit({
    wardrobe: wardrobeItems,
    occasionType: tryOccasion,
    laundryProfile,
    priorOutfits,
    excludeItemIds,
  });
  if (!allocated.ok || allocated.items.length < MIN_OUTFIT_ITEMS) return null;
  if (!isOutfitValid(allocated.items)) return null;

  // Hard diversity reject — jacket-only / same base look vs recent history
  if (priorOutfits.length && priorOutfits.some((h) => isTooSimilar(allocated.items, h))) {
    return null;
  }
  // Prefer changing ≥2 of {top,bottom,footwear} vs yesterday when alternatives exist
  const yesterday = priorOutfits[0];
  if (yesterday?.length) {
    const trioChanges = countTrioChanges(allocated.items, yesterday);
    const hasAltTop = wardrobeItems.filter(isTopItem).length > 1;
    const hasAltBottom = wardrobeItems.filter(isBottomItem).length > 1;
    const hasAltShoes = wardrobeItems.filter(isShoesItem).length > 1;
    if (trioChanges < 2 && (hasAltTop || hasAltBottom || hasAltShoes)) {
      return null;
    }
  }
  return allocated.items;
}

function generateLocalTiered(params: {
  wardrobeItems: WardrobeItem[];
  occasionType: OutfitOccasionId | 'todays_look';
  deadlineMs: number;
  laundryProfile?: LaundryProfile;
  priorOutfits?: WardrobeItem[][];
  dateKey?: string;
}): LocalGenerationResult | null {
  const {
    wardrobeItems,
    occasionType,
    deadlineMs,
    laundryProfile = laundryProfileFromUser(null),
    priorOutfits = [],
  } = params;
  const cascade = allocationCascadeFor(occasionType);
  const started = Date.now();
  const withinBudget = () => Date.now() - started < deadlineMs;

  const hardExcludeRounds: string[][] = [
    [],
    diversityBanBottomAndShoes(priorOutfits),
    diversityExcludeIdsFromHistory(priorOutfits),
  ];

  // strict — occasion standard + hard validity + hard diversity
  for (const excludeItemIds of hardExcludeRounds) {
    for (const tryOccasion of cascade) {
      if (!withinBudget()) break;
      const items = allocateLocal(
        wardrobeItems,
        tryOccasion,
        laundryProfile,
        priorOutfits,
        excludeItemIds,
      );
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
  }

  void traceTodaysOutfit('fallback', { tier: 'relaxed' });

  // relaxed — hard validity + hard diversity
  for (const excludeItemIds of hardExcludeRounds) {
    for (const tryOccasion of cascade) {
      if (!withinBudget()) break;
      const items = allocateLocal(
        wardrobeItems,
        tryOccasion,
        laundryProfile,
        priorOutfits,
        excludeItemIds,
      );
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
  }

  void traceTodaysOutfit('fallback', { tier: 'minimal' });

  // minimal — casual_day; last resort allow soft-similar if wardrobe too small
  if (withinBudget()) {
    for (const excludeItemIds of hardExcludeRounds) {
      const items = allocateLocal(
        wardrobeItems,
        'casual_day',
        laundryProfile,
        priorOutfits,
        excludeItemIds,
      );
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
    // Absolute last resort: allocator without hard trio preference (still clash-valid)
    const fallback = allocateSingleDayOutfit({
      wardrobe: wardrobeItems,
      occasionType: 'casual_day',
      laundryProfile,
      priorOutfits,
    });
    if (fallback.ok && fallback.items.length >= MIN_OUTFIT_ITEMS && isOutfitValid(fallback.items)) {
      return {
        items: fallback.items,
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
  try {
    const prev = await loadRawStoredOutfit();
    if (
      prev?.itemIds?.length
      && prev.dateKey
      && prev.dateKey !== stable.dateKey
    ) {
      await AsyncStorage.setItem(PREVIOUS_KEY, JSON.stringify(prev));
      await mergeHistoryEntry({
        dateKey: prev.dateKey,
        itemIds: prev.itemIds.map(String),
      });
    }
  } catch {
    // non-fatal
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stable));
  await rememberTodaysOutfitRecommendation(stable);
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
    fromServer: false,
    why: [
      'Offline fallback — local allocator (server authority unavailable).',
      `Tier: ${generated.tier}.`,
    ],
  });
}

function buildOutfitFromServer(params: {
  itemIds: string[];
  items: WardrobeItem[];
  occasionType: OutfitOccasionId | 'todays_look';
  dressFor: DressFor;
  dayLabel: string;
  stylistMessage?: string;
  vibeLabel?: string;
  why?: string[];
  serverId?: string;
  dateKeyOverride?: string;
}): WardrobeTodaysOutfit {
  const honest = reconcileHonestOccasion(
    params.items,
    params.occasionType,
    normalizeAllocatorOccasion(params.occasionType),
  );

  return withStableId({
    id: params.serverId,
    dateKey: params.dateKeyOverride || dateKey(),
    itemIds: params.itemIds,
    stylistMessage: params.stylistMessage,
    vibeLabel: params.vibeLabel || honest.occasionLabel,
    occasionType: honest.occasionType,
    dressFor: dressForFromHonestOccasion(honest.occasionType, params.dressFor),
    dayLabel: params.dayLabel,
    occasionLabel: honest.occasionLabel,
    fromServer: true,
    why: params.why,
  });
}

async function tryGenerateTodaysOutfitFromServer(params: {
  wardrobeItems: WardrobeItem[];
  occasionType: OutfitOccasionId | 'todays_look';
  dressFor: DressFor;
  dayLabel: string;
  stylistId?: string;
  weather?: WeatherSnapshot | null;
  penalizeItemIds?: string[];
  priorOutfits?: string[][];
  dateKey?: string;
  excludeItemIds?: string[];
}): Promise<{ outfit: WardrobeTodaysOutfit; items: WardrobeItem[] } | null> {
  try {
    const today = params.dateKey || dateKey();
    const localItems = params.wardrobeItems.slice(0, 120).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      color: item.color,
      brand: item.brand,
      occasions: item.occasions,
      subcategory: item.subcategory,
      imageUrl: item.enhancedImageUri || item.imageUri,
    }));

    const result = await apiService.generateStylistOutfit({
      intent: 'today',
      occasionType: params.occasionType === 'todays_look' ? 'casual_day' : params.occasionType,
      dressFor: params.dressFor,
      stylistId: params.stylistId || 'ruby',
      dateKey: today,
      penalizeItemIds: params.penalizeItemIds || [],
      priorOutfits: params.priorOutfits || [],
      excludeItemIds: params.excludeItemIds || [],
      weather: params.weather
        ? {
            temperature: params.weather.temperature,
            condition: params.weather.condition,
            location: params.weather.location,
          }
        : null,
      localItems,
      environment: {
        occasion: params.occasionType === 'todays_look' ? 'casual_day' : params.occasionType,
        dressCode: params.dressFor,
        intent: 'today',
        dateKey: today,
        weather: params.weather || undefined,
      },
    });

    if (!result?.success || !result.outfit?.itemIds?.length) {
      await traceTodaysOutfit('fallback', { reason: 'server_empty', error: result?.error });
      return null;
    }

    const itemIds = result.outfit.itemIds.map(String);
    const items = hydrateItems(itemIds, params.wardrobeItems);
    if (items.length < MIN_OUTFIT_ITEMS || !isOutfitValid(items)) {
      await traceTodaysOutfit('fallback', {
        reason: 'server_hydrate_invalid',
        itemCount: items.length,
      });
      return null;
    }

    const diversityMeta = (result as { diversity?: TodaysOutfitDiversityMeta }).diversity;
    const outfit = buildOutfitFromServer({
      itemIds,
      items,
      occasionType: (result.occasionType || params.occasionType) as OutfitOccasionId | 'todays_look',
      dressFor: params.dressFor,
      dayLabel: params.dayLabel,
      stylistMessage: result.outfit.stylistMessage,
      vibeLabel: result.outfit.vibeLabel,
      why: result.why,
      serverId: result.outfit.id,
      dateKeyOverride: today,
    });
    if (diversityMeta) {
      outfit.diversity = {
        ...diversityMeta,
        pickedItemIds: itemIds,
        cacheHit: false,
      };
    }

    return { outfit, items };
  } catch (error) {
    await traceTodaysOutfit('fallback', {
      reason: 'server_error',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function resolveCachedTodaysOutfit(params: {
  wardrobeItems: WardrobeItem[];
  profile: OnboardingProfile;
  user?: UserProfile | null;
}): Promise<{ outfit: WardrobeTodaysOutfit; items: WardrobeItem[] } | null> {
  const stored = await loadStoredTodaysWardrobeOutfit();
  if (!stored) {
    logDiversity('cache_miss', { dateKey: dateKey(), reason: 'no_store' });
    return null;
  }

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
    logDiversity('cache_miss', { dateKey: stored.dateKey, reason: 'prefs_changed' });
    return null;
  }

  const items = hydrateItems(stored.itemIds, params.wardrobeItems);
  if (items.length < MIN_OUTFIT_ITEMS) {
    logDiversity('cache_miss', { dateKey: stored.dateKey, reason: 'hydrate_short' });
    return null;
  }

  // Diversity gate: never serve a cached look that is too similar to history.
  const seeded = await seedTodaysOutfitHistoryFromStorage();
  const history = await loadTodaysOutfitHistory();
  const today = dateKey();
  const priorOutfits = priorOutfitsFromHistory(history, params.wardrobeItems, today);
  const tooSimilar = priorOutfits.some((h) => isTooSimilar(items, h));

  // One-shot OTA bust: stuck users had empty history → same cache forever.
  let migrationBust = false;
  try {
    const busted = await AsyncStorage.getItem(DIVERSITY_BUST_KEY);
    if (!busted) {
      await AsyncStorage.setItem(DIVERSITY_BUST_KEY, '1');
      migrationBust = true;
    }
  } catch {
    // ignore
  }

  if (tooSimilar || migrationBust) {
    // Do not thrash when wardrobe truly cannot diversify — serve locked look.
    if (tooSimilar && !migrationBust && stored.diversity?.wardrobeLocked) {
      logDiversity('cache_hit_locked', {
        dateKey: today,
        historyCount: priorOutfits.length,
        rejectedSimilar: 1,
        wardrobeLocked: true,
        pickedItemIds: stored.itemIds,
        cacheHit: true,
      });
    } else {
      logDiversity('cache_reject', {
        dateKey: today,
        historyCount: priorOutfits.length,
        rejectedSimilar: tooSimilar ? 1 : 0,
        migrationBust,
        seededFrom: seeded.seededFrom,
        pickedItemIds: stored.itemIds,
        cacheHit: false,
      });
      await clearTodaysOutfitCache();
      return null;
    }
  }

  const honest = reconcileHonestOccasion(
    items,
    expected.occasionType,
    normalizeAllocatorOccasion(expected.occasionType),
  );

  logDiversity('cache_hit', {
    dateKey: today,
    historyCount: priorOutfits.length,
    rejectedSimilar: tooSimilar ? 1 : 0,
    wardrobeLocked: Boolean(stored.diversity?.wardrobeLocked || tooSimilar),
    pickedItemIds: stored.itemIds,
    cacheHit: true,
  });

  return {
    outfit: withStableId({
      ...stored,
      dayLabel: expected.dayLabel,
      occasionLabel: honest.occasionLabel,
      occasionType: honest.occasionType,
      dressFor: dressForFromHonestOccasion(honest.occasionType, expected.dressFor),
      vibeLabel: stored.vibeLabel || honest.occasionLabel,
      diversity: {
        historyCount: priorOutfits.length,
        rejectedSimilar: tooSimilar ? 1 : 0,
        wardrobeLocked: Boolean(stored.diversity?.wardrobeLocked || tooSimilar),
        cacheHit: true,
        pickedItemIds: stored.itemIds.map(String),
      },
    }),
    items,
  };
}

/**
 * Background precompute at app launch / wardrobe sync — never blocks UI.
 * Prefers shared server engine; weather enriches asynchronously.
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
    await rememberTodaysOutfitRecommendation(cached.outfit);
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

  if (forceRefresh) {
    await clearTodaysOutfitCache();
  }

  if (!forceRefresh) {
    const cached = await resolveCachedTodaysOutfit({ wardrobeItems, profile, user });
    if (cached) {
      await traceTodaysOutfit('cache_hit', { id: cached.outfit.id });
      await rememberTodaysOutfitRecommendation(cached.outfit);
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

  const today = dateKey();
  const seeded = await seedTodaysOutfitHistoryFromStorage();
  const history = await loadTodaysOutfitHistory();
  const priorOutfits = priorOutfitsFromHistory(history, wardrobeItems, today);
  const priorOutfitIdLists = priorOutfitIdListsFromHistory(history, today);
  // Include prior same-day recommendation when regenerating so stuck users get a new look.
  const penalizeItemIds = await getRecentTodaysOutfitItemIds({
    excludeToday: false,
  });
  // Also ban last outfit's ids explicitly on force
  if (forceRefresh && priorOutfitIdLists[0]?.length) {
    for (const id of priorOutfitIdLists[0]) {
      if (!penalizeItemIds.includes(String(id))) penalizeItemIds.push(String(id));
    }
  }

  logDiversity('generate_start', {
    dateKey: today,
    historyCount: priorOutfits.length,
    penalizeCount: penalizeItemIds.length,
    forceRefresh: Boolean(forceRefresh),
    seededFrom: seeded.seededFrom,
    cacheHit: false,
  });

  const started = Date.now();
  try {
    const weather = await Promise.race([
      fetchWeatherSnapshot(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    const fromServer = await tryGenerateTodaysOutfitFromServer({
      wardrobeItems,
      occasionType,
      dressFor,
      dayLabel,
      stylistId: userContext.stylistId,
      weather,
      penalizeItemIds,
      priorOutfits: priorOutfitIdLists,
      dateKey: today,
      excludeItemIds: [
        ...diversityBanBottomAndShoes(priorOutfits),
      ],
    });

    if (fromServer) {
      const stillSimilar = priorOutfits.some((h) => isTooSimilar(fromServer.items, h));
      const outfit = withStableId({
        ...fromServer.outfit,
        dateKey: today,
        weatherTemp: weather?.temperature,
        weatherCondition: weather?.condition,
        weatherLocation: weather?.location,
        diversity: {
          historyCount: priorOutfits.length,
          rejectedSimilar: stillSimilar ? 1 : 0,
          wardrobeLocked: stillSimilar,
          forceRefresh: Boolean(forceRefresh),
          cacheHit: false,
          pickedItemIds: fromServer.outfit.itemIds.map(String),
        },
        why: [
          ...(fromServer.outfit.why || []),
          ...(stillSimilar
            ? ['Your wardrobe only supports a look similar to a recent day — try adding another bottom or pair of shoes.']
            : []),
        ],
      });
      if (stillSimilar) {
        outfit.stylistMessage = `${outfit.stylistMessage || 'Here’s today’s look.'} (Limited wardrobe variety — this is close to a recent day.)`;
      }
      await storeTodaysWardrobeOutfit(outfit);
      logDiversity('generate_server', {
        dateKey: today,
        historyCount: priorOutfits.length,
        rejectedSimilar: stillSimilar ? 1 : 0,
        wardrobeLocked: stillSimilar,
        pickedItemIds: outfit.itemIds,
        cacheHit: false,
        elapsedMs: Date.now() - started,
      });
      await traceTodaysOutfit('generate', {
        id: outfit.id,
        dateKey: today,
        itemIds: outfit.itemIds,
        source: 'server',
        elapsedMs: Date.now() - started,
        network: true,
        whyCount: outfit.why?.length || 0,
        penalizeCount: penalizeItemIds.length,
        priorOutfitCount: priorOutfitIdLists.length,
      });
      if (outfit.weatherTemp == null) {
        void enrichOutfitWeatherInBackground(outfit);
      }
      return { ok: true, outfit, items: fromServer.items };
    }

    if (!TODAYS_OUTFIT_OFFLINE_FALLBACK) {
      throw new Error('Could not build today’s outfit from the stylist server.');
    }

    const generated = generateLocalTiered({
      wardrobeItems,
      occasionType,
      deadlineMs: TODAYS_OUTFIT_GENERATION_BUDGET_MS,
      laundryProfile: laundryProfileFromUser(user),
      priorOutfits,
      dateKey: today,
    });

    if (!generated) {
      throw new Error('Could not build today’s outfit from your wardrobe.');
    }

    const stillSimilar = priorOutfits.some((h) => isTooSimilar(generated.items, h));
    const outfit = withStableId({
      ...buildOutfitFromLocal(generated, occasionType, dressFor, dayLabel),
      diversity: {
        historyCount: priorOutfits.length,
        rejectedSimilar: stillSimilar ? 1 : 0,
        wardrobeLocked: stillSimilar,
        forceRefresh: Boolean(forceRefresh),
        cacheHit: false,
        pickedItemIds: generated.items.map((i) => String(i.id)),
      },
      why: [
        'Offline fallback — local allocator (server authority unavailable).',
        `Tier: ${generated.tier}.`,
        ...(stillSimilar
          ? ['Wardrobe too small for a fully distinct look vs recent days.']
          : []),
      ],
    });
    if (stillSimilar) {
      outfit.stylistMessage = `${outfit.stylistMessage || 'Here’s today’s look.'} (Limited wardrobe variety — this is close to a recent day.)`;
    }
    await storeTodaysWardrobeOutfit(outfit);

    logDiversity('generate_offline', {
      dateKey: outfit.dateKey,
      historyCount: priorOutfits.length,
      rejectedSimilar: stillSimilar ? 1 : 0,
      wardrobeLocked: stillSimilar,
      pickedItemIds: outfit.itemIds,
      cacheHit: false,
      tier: generated.tier,
    });

    await traceTodaysOutfit('generate', {
      id: outfit.id,
      dateKey: outfit.dateKey,
      itemIds: outfit.itemIds,
      tier: generated.tier,
      source: 'offline_fallback',
      elapsedMs: Date.now() - started,
      network: false,
      penalizeCount: penalizeItemIds.length,
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
