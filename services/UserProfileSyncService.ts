import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';
import {
  onboardingProfileService,
  type OnboardingProfile,
} from '@/services/OnboardingProfileService';

const TOUR_SEEN_KEY = '@dripn_tour_seen';

export function getTourSeenStorageKey(userId?: string | null): string {
  return userId ? `${TOUR_SEEN_KEY}_${userId}` : TOUR_SEEN_KEY;
}

function backendIndicatesTourSeen(source?: Record<string, any> | null): boolean {
  if (!source) return false;
  return source.hasSeenTour === true || source.profileData?.hasSeenTour === true;
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(isFilled);
  }
  return true;
}

function mergeObjectsPreferFilled<T extends Record<string, any>>(
  base: T,
  ...sources: Array<Partial<T> | null | undefined>
): T {
  const result: Record<string, any> = { ...base };
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = mergeObjectsPreferFilled(result[key], value);
      } else if (isFilled(value)) {
        result[key] = value;
      }
    }
  }
  return result as T;
}

function mapServerGenderToAppGender(gender?: string | null): UserProfile['gender'] {
  const value = String(gender || '').toLowerCase();
  if (['man', 'male', 'men', 'm'].includes(value)) return 'man';
  if (['woman', 'female', 'women', 'f'].includes(value)) return 'woman';
  if (value === 'non-binary') return 'non-binary';
  if (value === 'prefer-not-to-say') return 'prefer-not-to-say';
  return null;
}

function mapQuizGenderToAppGender(quizGender?: OnboardingProfile['quizGender']): UserProfile['gender'] {
  if (quizGender === 'male') return 'man';
  if (quizGender === 'female') return 'woman';
  return null;
}

function mapStyleProfileToUserProfile(styleProfile: Record<string, any> | null | undefined): Partial<UserProfile> {
  if (!styleProfile) return {};

  const gender = mapServerGenderToAppGender(styleProfile.gender);
  return {
    gender: gender || undefined,
    bodyShape: styleProfile.bodyType || styleProfile.body_type || undefined,
    budgetRange: styleProfile.budgetRange || styleProfile.budget_range || undefined,
    skinUndertone: styleProfile.skinUndertone || styleProfile.skin_undertone || undefined,
    hasCompletedOnboarding: styleProfile.onboardingCompleted ?? styleProfile.onboarding_completed ?? undefined,
    colorScanData: styleProfile.colorSeasonType || styleProfile.color_season_type
      ? {
          colorSeasonType: styleProfile.colorSeasonType || styleProfile.color_season_type,
          seasonSubtype: styleProfile.seasonSubtype || '',
          skinUndertone: styleProfile.skinUndertone || styleProfile.skin_undertone || '',
          powerColors: styleProfile.favoriteColors || styleProfile.favorite_colors || [],
          avoidColors: styleProfile.avoidColors || styleProfile.avoid_colors || [],
          bestMetals: '',
          analyzedAt: styleProfile.updatedAt || new Date().toISOString(),
        }
      : undefined,
    extendedPreferences: {
      lifestyle: styleProfile.lifestyleContext?.[0] || styleProfile.workEnvironment || null,
      favoriteBrands: styleProfile.preferredBrands || styleProfile.preferred_brands || [],
      colorPreferences: styleProfile.favoriteColors || styleProfile.favorite_colors || [],
      shoppingFrequency: null,
      preferOnlineShopping: Array.isArray(styleProfile.shoppingPreferences)
        ? styleProfile.shoppingPreferences.includes('online')
        : true,
      sustainabilityImportant: styleProfile.sustainabilityPriority === 'high',
      occasions: styleProfile.primaryOccasions || styleProfile.primary_occasions || [],
      favoriteShops: [],
      usageGoals: styleProfile.styleGoals || styleProfile.style_goals || [],
      culturalStyle: {
        dressCodePreference: styleProfile.dressCodePreference || styleProfile.dress_code_preference || null,
        religiousOrCulturalDressCode:
          styleProfile.religiousOrCulturalDressCode || styleProfile.religious_or_cultural_dress_code || null,
        subcultureStyle: styleProfile.subcultureStyle || styleProfile.subculture_style || null,
        subcultureDescription:
          styleProfile.subcultureDescription || styleProfile.subculture_description || null,
        dressCodeStrictness: styleProfile.dressCodeStrictness || styleProfile.dress_code_strictness || null,
      },
      bodyFitPreferences: {
        fitPreference: styleProfile.fitPreference || styleProfile.fit_preference || null,
        confidentAreas: styleProfile.confidentAreas || styleProfile.confident_areas || [],
        preferToMinimize: styleProfile.preferToMinimize || styleProfile.prefer_to_minimize || [],
      },
      colorChoices: {
        favoriteColors: styleProfile.favoriteColors || styleProfile.favorite_colors || [],
        avoidColors: styleProfile.avoidColors || styleProfile.avoid_colors || [],
      },
    },
    stylistPreferences: {
      selectedStylistId: styleProfile.preferredStylist || styleProfile.preferred_stylist || null,
      language: styleProfile.preferredLanguage || styleProfile.preferred_language || 'English',
      accent: styleProfile.preferredAccent || styleProfile.preferred_accent || 'American',
      voicePitch: 'mezzo-soprano',
      useNameInGreetings: true,
      namePronunciationConfirmed: false,
    },
  };
}

function applyOnboardingProfile(
  profile: UserProfile,
  onboardingProfile: OnboardingProfile,
): UserProfile {
  const next = { ...profile };
  if (!next.gender) {
    next.gender = mapQuizGenderToAppGender(onboardingProfile.quizGender);
  }
  if (onboardingProfile.quizComplete) {
    next.hasCompletedQuiz = true;
  }
  if (onboardingProfile.likedStyles?.length) {
    next.extendedPreferences = mergeObjectsPreferFilled(next.extendedPreferences, {
      colorPreferences: onboardingProfile.likedStyles,
    });
  }
  (next as UserProfile & { onboardingProfile?: OnboardingProfile }).onboardingProfile = {
    identity: onboardingProfile.identity,
    dressFor: onboardingProfile.dressFor,
    quizGender: onboardingProfile.quizGender,
    likedStyles: onboardingProfile.likedStyles,
    quizLikes: onboardingProfile.quizLikes,
    quizComplete: onboardingProfile.quizComplete,
  };
  return next;
}

async function readDeviceTourSeen(userId?: string | null): Promise<boolean> {
  try {
    if (userId) {
      const userScoped = await AsyncStorage.getItem(getTourSeenStorageKey(userId));
      if (userScoped === 'true') return true;
    }
    // Legacy device-wide flag (pre user-scoped keys)
    return (await AsyncStorage.getItem(TOUR_SEEN_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function persistTourSeenLocally(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_SEEN_KEY, 'true');
    if (userId) {
      await AsyncStorage.setItem(getTourSeenStorageKey(userId), 'true');
    }
  } catch {
    // Non-fatal
  }
}

export type HydrateProfileOptions = {
  backendLoginUser?: Record<string, any> | null;
  preserveLocalEmail?: string;
};

/**
 * Merge local profile, backend profileData, style profile, and onboarding quiz data.
 * Called after every successful authentication so features share one source of truth.
 */
export async function hydrateUserProfileAfterAuth(
  baseProfile: UserProfile,
  options: HydrateProfileOptions = {},
): Promise<UserProfile> {
  const deviceTourSeen = await readDeviceTourSeen(baseProfile.id);
  const onboardingProfile = await onboardingProfileService.getProfile();
  let backendTourSeen = backendIndicatesTourSeen(options.backendLoginUser);

  let merged = mergeObjectsPreferFilled(baseProfile, options.backendLoginUser?.profileData);

  if (options.backendLoginUser?.hasCompletedOnboarding !== undefined) {
    merged.hasCompletedOnboarding = !!options.backendLoginUser.hasCompletedOnboarding;
  }
  if (options.backendLoginUser?.subscriptionTier) {
    merged.subscriptionTier = options.backendLoginUser.subscriptionTier;
  }
  if (options.backendLoginUser?.displayName && !merged.name) {
    merged.name = options.backendLoginUser.displayName;
  }

  try {
    const me = await apiService.getCurrentUser();
    if (me?.profileData) {
      const { hasSeenTour: _ignoredTour, ...profileWithoutTour } = me.profileData;
      merged = mergeObjectsPreferFilled(merged, profileWithoutTour);
    }
    backendTourSeen = backendTourSeen || backendIndicatesTourSeen(me);
    if (me?.hasCompletedOnboarding !== undefined) {
      merged.hasCompletedOnboarding = !!me.hasCompletedOnboarding;
    }
    if (me?.onboardingCompletedAt && !merged.hasCompletedOnboarding) {
      merged.hasCompletedOnboarding = true;
    }
    if (me?.styleProfile) {
      merged = mergeObjectsPreferFilled(merged, mapStyleProfileToUserProfile(me.styleProfile));
    }
  } catch (err) {
    console.log('[ProfileSync] Could not fetch /api/auth/me during hydrate:', err);
  }

  try {
    const styleProfile = await apiService.fetchStyleProfile();
    merged = mergeObjectsPreferFilled(merged, mapStyleProfileToUserProfile(styleProfile));
  } catch {
    // Non-fatal — profileData may already contain the same fields
  }

  merged = applyOnboardingProfile(merged, onboardingProfile);

  const mappedGender = mapServerGenderToAppGender(merged.gender as string | null | undefined);
  if (mappedGender) {
    merged.gender = mappedGender;
  }

  merged.id = baseProfile.id;
  if (options.preserveLocalEmail) {
    merged.email = options.preserveLocalEmail;
  } else if (baseProfile.email) {
    merged.email = baseProfile.email;
  }

  merged.hasSeenTour =
    deviceTourSeen
    || backendTourSeen
    || merged.hasSeenTour === true;

  if (merged.hasSeenTour) {
    await persistTourSeenLocally(merged.id);
  }

  return merged;
}

export async function syncHydratedProfileToBackend(profile: UserProfile): Promise<void> {
  const { id, email, hasSeenTour, ...profileData } = profile as UserProfile & Record<string, unknown>;
  const payload = hasSeenTour === true ? { ...profileData, hasSeenTour: true } : profileData;
  await apiService.syncProfile(payload);

  const onboardingProfile = await onboardingProfileService.getProfile();
  if (Object.keys(onboardingProfile).length > 0) {
    await onboardingProfileService.syncToBackend(onboardingProfile);
  }
}

export async function hydrateAndSyncUserProfileAfterAuth(
  baseProfile: UserProfile,
  options: HydrateProfileOptions = {},
): Promise<UserProfile> {
  const hydrated = await hydrateUserProfileAfterAuth(baseProfile, options);
  await syncHydratedProfileToBackend(hydrated);
  return hydrated;
}
