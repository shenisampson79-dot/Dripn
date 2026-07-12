import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lifestyle, StyleTheme, DripnGoal, Gender, UserProfile } from '@/contexts/AuthContext';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { DressFor, OnboardingProfile } from '@/services/OnboardingProfileService';
import { generateWardrobeOutfit } from '@/utils/generatedOutfit';
import { wardrobeCanBuildCompleteOutfit } from '@/utils/completeOutfit';
import {
  countWardrobeOutfitBasics,
  describeOutfitPlanningGap,
} from '@/utils/wardrobeOutfitReadiness';

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

const STORAGE_KEY = '@dripn_todays_wardrobe_outfit';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

export function resolveTodaysOccasion(
  profile: OnboardingProfile,
  user?: OutfitUserContext,
): {
  dressFor: DressFor;
  occasionType: OutfitOccasionId | 'todays_look';
  dayLabel: string;
  isWeekday: boolean;
  occasionLabel: string;
} {
  const now = new Date();
  const day = now.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const dayLabel = DAY_NAMES[day];
  const lifestyle = user?.lifestyle;
  const goals = user?.usageGoals || [];
  const style = user?.stylePreference;
  const professional =
    lifestyle === 'professional' ||
    goals.includes('professional-image') ||
    style === 'business' ||
    style === 'smart-casual';

  const explicit = profile.dressFor;
  let dressFor: DressFor;
  if (isWeekday) {
    if (professional || explicit === 'work') dressFor = 'work';
    else if (explicit === 'date' || explicit === 'event') dressFor = explicit;
    else dressFor = 'myself';
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

  const occasionLabel =
    dressFor === 'work'
      ? professional
        ? 'Work / office'
        : 'Weekday / campus'
      : dressFor === 'myself'
        ? 'Everyday'
        : dressFor === 'friends'
          ? 'Weekend / friends'
          : dressFor === 'date'
            ? 'Date'
            : 'Event';

  return { dressFor, occasionType, dayLabel, isWeekday, occasionLabel };
}

export async function fetchWeatherSnapshot(): Promise<WeatherSnapshot | null> {
  try {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({});
    const lat = location.coords.latitude;
    const lon = location.coords.longitude;

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
    );
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
    return parsed;
  } catch {
    return null;
  }
}

export async function storeTodaysWardrobeOutfit(outfit: WardrobeTodaysOutfit): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
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

  if (!forceRefresh) {
    const stored = await loadStoredTodaysWardrobeOutfit();
    if (stored) {
      const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
      const items = stored.itemIds.map((id) => byId.get(String(id))).filter(Boolean) as WardrobeItem[];
      if (items.length >= 3) {
        return { ok: true, outfit: stored, items };
      }
    }
  }

  const readiness = getWardrobeReadinessMessage(wardrobeItems);
  if (readiness) {
    return { ok: false, reason: 'not_ready', message: readiness };
  }

  const weather = await fetchWeatherSnapshot();
  const userContext: OutfitUserContext = {
    gender: user?.gender,
    lifestyle: user?.lifestyle,
    stylePreference: user?.stylePreference,
    usageGoals: user?.usageGoals,
    country: user?.country,
    stylistId: user?.stylistPreferences?.selectedStylistId,
  };
  const { dressFor, occasionType, dayLabel, occasionLabel } = resolveTodaysOccasion(profile, userContext);

  try {
    const generated = await generateWardrobeOutfit({
      occasionType,
      wardrobeItems,
      stylistId: userContext.stylistId || 'ruby',
      user,
      onboardingProfile: profile,
      weather: weather
        ? { temperature: weather.temperature, condition: weather.condition }
        : null,
      calendarDate: dateKey(),
    });

    const outfit: WardrobeTodaysOutfit = {
      dateKey: dateKey(),
      itemIds: generated.items.map((i) => String(i.id)),
      stylistMessage: generated.stylistMessage,
      vibeLabel: generated.vibeLabel,
      occasionType,
      dressFor,
      weatherTemp: weather?.temperature,
      weatherCondition: weather?.condition,
      weatherLocation: weather?.location,
      dayLabel,
      occasionLabel,
    };

    await storeTodaysWardrobeOutfit(outfit);
    return { ok: true, outfit, items: generated.items };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not build today’s outfit from your wardrobe. Try again.';
    return { ok: false, reason: 'generate_failed', message };
  }
}
