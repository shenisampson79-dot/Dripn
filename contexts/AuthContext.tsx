/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform, AppState } from 'react-native';
import { StyleTheme } from '@/constants/theme';
import { apiService } from '@/services/ApiService';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import {
  clearGuestSessionLocal,
  readGuestConversationsForClaim,
  seedAiStylistChatFromGuest,
} from '@/services/GuestChatStorage';
import {
  establishStylistChatAccountSession,
  getActiveStylistChatUserId,
  relinquishStylistChatAccountSession,
  resumeStylistChatSession,
  shouldPreserveStylistChatLocal,
} from '@/utils/stylistChatAccountSession';
import { clearPasswordResetToken } from '@/utils/passwordResetDeepLink';
import { hydrateAndSyncUserProfileAfterAuth, hydrateUserProfileAfterAuth, getTourSeenStorageKey, persistTourSeenLocally, syncHydratedProfileToBackend } from '@/services/UserProfileSyncService';
import { normalizeSubscriptionTier, preferHigherSubscriptionTier, reconcileSubscriptionTier } from '@/utils/subscriptionTier';
import { shouldApplyTestingUnlock } from '@/utils/devTesting';
import { shouldUseAppleIAP } from '@/utils/platformPayments';
import {
  appleIAPService,
  resolveTierFromCustomerInfo,
  serializeCustomerInfoForSyncWithStorefront,
} from '@/services/AppleIAPService';
WebBrowser.maybeCompleteAuthSession();

export type Gender = 'woman' | 'man' | 'non-binary' | 'prefer-not-to-say' | null;
export type SizeRange = 'XS-S' | 'S-M' | 'M-L' | 'L-XL' | 'XL-2X' | '3X+' | null;
export type BodyShape = 'Hourglass' | 'Pear' | 'Apple' | 'Rectangle' | 'Athletic' | 'Inverted Triangle' | 'Trapezoid' | 'Oval' | null;
export type BudgetRange = 'Budget' | 'Mid-Range' | 'Premium' | 'Luxury' | null;
export type SubscriptionTier = 'free' | 'personal_stylist' | 'stylist_unlimited';
export type ContributorTier = 'none' | 'styleContributor' | 'fashionAdvisor' | 'styleExpert' | 'fashionGuru';
export type FeedPreference = 'global' | 'regional' | 'local';
export type Lifestyle = 'casual' | 'professional' | 'active' | 'creative' | 'minimalist' | 'trendsetter' | null;
export type ShoppingFrequency = 'weekly' | 'monthly' | 'seasonal' | 'rarely' | null;
export type DripnGoal = 'dress-better' | 'meet-people' | 'find-offers' | 'get-inspired' | 'build-wardrobe' | 'special-events' | 'professional-image';
export type HeightUnit = 'cm' | 'ft';
export type WeightUnit = 'kg' | 'lbs';
export type StylistId = 'ruby' | 'max' | 'ace' | 'ivy' | null;

// Cultural dress code types
export type DressCodePreference = 'hijab-friendly' | 'tzniut' | 'lds-modest' | 'hindu-traditional' | 'sikh' | 'amish-plain' | 'modest-general' | 'other' | 'none' | null;
export type SubcultureStyle = 'goth' | 'emo' | 'punk' | 'cottagecore' | 'dark-academia' | 'light-academia' | 'y2k' | 'vintage' | 'grunge' | 'kawaii' | 'streetwear' | 'hypebeast' | 'old-money' | 'clean-girl' | 'coastal-grandmother' | 'other' | 'none' | null;
export type DressCodeStrictness = 'flexible' | 'moderate' | 'strict' | null;
export type FitPreference = 'Fitted' | 'Tailored' | 'Relaxed' | 'Oversized' | null;
export type SkinUndertone = 'warm' | 'cool' | 'neutral' | null;
export type BodyArea = 'Arms' | 'Shoulders' | 'Chest' | 'Waist' | 'Hips' | 'Legs' | 'Back' | 'Neck' | 'Tummy' | 'Thighs';
export type RubyVoicePitch = 'mezzo-soprano';
export type MaxVoiceRange = 'tenor' | 'baritone' | 'bass';
export type VoicePitch = RubyVoicePitch | MaxVoiceRange;

export interface StylistPreferences {
  selectedStylistId: StylistId;
  language: string;
  accent?: string;
  voicePitch: VoicePitch;
  // Name pronunciation preferences
  useNameInGreetings: boolean; // Whether to use member's name in voice greetings
  namePronunciationConfirmed: boolean; // Whether member has confirmed pronunciation is correct
  phoneticSpelling?: string; // Optional phonetic spelling for future voice recording feature
}

export type MeasurementUnit = 'cm' | 'inches';

export interface BodyMeasurements {
  height: number | null;
  heightUnit: HeightUnit;
  weight: number | null;
  weightUnit: WeightUnit;
  // Additional body measurements (all optional, in cm or inches based on measurementUnit)
  measurementUnit?: MeasurementUnit;
  chest?: number | null;        // Chest/Bust circumference
  waist?: number | null;        // Waist circumference
  hips?: number | null;         // Hip circumference
  inseam?: number | null;       // Inseam length (crotch to ankle)
  shoulderWidth?: number | null; // Shoulder width (shoulder to shoulder)
  sleeveLength?: number | null; // Sleeve length (shoulder to wrist)
  neck?: number | null;         // Neck circumference
  thigh?: number | null;        // Thigh circumference
  armLength?: number | null;    // Full arm length
  torsoLength?: number | null;  // Torso length (shoulder to waist)
  shoeSize?: string | null;     // Shoe size (varies by region)
}

export interface CulturalStylePreferences {
  dressCodePreference: DressCodePreference;
  religiousOrCulturalDressCode: string | null; // Free-text for personal dress code details
  subcultureStyle: SubcultureStyle;
  subcultureDescription: string | null; // Free-text for custom subculture description
  dressCodeStrictness: DressCodeStrictness;
}

export interface BodyFitPreferences {
  fitPreference: FitPreference;
  confidentAreas: BodyArea[];
  preferToMinimize: BodyArea[];
}

export interface ColorPreferences {
  favoriteColors: string[];
  avoidColors: string[];
}

export interface ExtendedPreferences {
  lifestyle: Lifestyle;
  favoriteBrands: string[];
  colorPreferences: string[];
  shoppingFrequency: ShoppingFrequency;
  preferOnlineShopping: boolean;
  sustainabilityImportant: boolean;
  occasions: string[];
  favoriteShops: string[];
  usageGoals: DripnGoal[];
  culturalStyle: CulturalStylePreferences;
  bodyFitPreferences: BodyFitPreferences;
  colorChoices: ColorPreferences;
  laundryHabit?: import('@/utils/wearRules').LaundryHabit;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  country: string;
  actualCountry?: string;
  gender: Gender;
  stylePreference: StyleTheme;
  sizeRange: SizeRange;
  bodyShape: BodyShape;
  budgetRange: BudgetRange;
  skinUndertone: SkinUndertone;
  subscriptionTier: SubscriptionTier;
  contributorTier: ContributorTier;
  feedPreference: FeedPreference;
  aiSuggestionsEnabled: boolean;
  postsCount: number;
  helpfulVotes: number;
  thanksReceived: number;
  createdAt: string;
  hasCompletedOnboarding: boolean;
  hasCompletedQuiz: boolean;
  hasSeenTour: boolean;
  hasDismissedTrialOffer: boolean;
  bodyMeasurements: BodyMeasurements;
  extendedPreferences: ExtendedPreferences;
  stylistPreferences: StylistPreferences;
  role?: string;
  isAdmin?: boolean;
  profileData?: Record<string, unknown>;
  colorScanData?: {
    colorSeasonType: string;
    seasonSubtype: string;
    skinUndertone: string;
    powerColors: string[];
    avoidColors: string[];
    bestMetals: string;
    analyzedAt: string;
  } | null;
  onboardingProfile?: {
    identity?: string;
    dressFor?: string;
    workDressCode?: string | null;
    quizGender?: 'female' | 'male';
    likedStyles?: string[];
    quizComplete?: boolean;
  };
}

type LocationPermissionStatus = 'unknown' | 'granted' | 'denied' | 'denied_forever';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  isExploringOtherCountry: boolean;
  explorationCountry: string | null;
  actualCountry: string | null;
  locationPermissionStatus: LocationPermissionStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'facebook' | 'apple') => Promise<void>;
  googleLoginWithTokens: (accessToken: string, idToken?: string, userEmail?: string, userName?: string) => Promise<void>;
  loginAsTestUser: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (profile: Partial<UserProfile>) => Promise<void>;
  completeQuiz: (quizData: Partial<UserProfile>) => Promise<void>;
  switchBackToActualLocation: () => Promise<void>;
  detectActualLocation: () => Promise<void>;
  refreshSubscriptionFromBackend: (sessionId?: string) => Promise<void>;
  /** Unlock subscription locally from StoreKit/RC without waiting for backend sync. */
  applyLocalSubscriptionTier: (tier: SubscriptionTier) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = '@dripn_user';

async function resolvePriorAuthenticatedUserId(): Promise<string | null> {
  const active = getActiveStylistChatUserId();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return active;
    const parsed = JSON.parse(raw) as { id?: string };
    return String(parsed?.id || active || '').trim() || null;
  } catch {
    return active;
  }
}

async function transitionStylistChatSessionForAuth(nextUserId: string): Promise<void> {
  const priorUserId = await resolvePriorAuthenticatedUserId();
  await establishStylistChatAccountSession(nextUserId, {
    preserveLocal: shouldPreserveStylistChatLocal(priorUserId, nextUserId),
  });
}

async function syncHydratedProfileToBackendSafe(profile: UserProfile): Promise<void> {
  try {
    await syncHydratedProfileToBackend(profile);
  } catch (err) {
    console.log('[Auth] Background profile sync failed (local profile still updated):', err);
  }
}

const createDefaultUser = (email: string, name: string): UserProfile => ({
  id: Date.now().toString(),
  email,
  name,
  avatar: null,
  country: 'United States',
  gender: null,
  stylePreference: 'luxury',
  sizeRange: null,
  bodyShape: null,
  budgetRange: null,
  skinUndertone: null,
  subscriptionTier: 'free',
  contributorTier: 'none',
  feedPreference: 'global',
  aiSuggestionsEnabled: true,
  postsCount: 0,
  helpfulVotes: 0,
  thanksReceived: 0,
  createdAt: new Date().toISOString(),
  hasCompletedOnboarding: false,
  hasCompletedQuiz: false,
  hasSeenTour: false,
  hasDismissedTrialOffer: false,
  bodyMeasurements: {
    height: null,
    heightUnit: 'cm',
    weight: null,
    weightUnit: 'kg',
    measurementUnit: 'cm',
    chest: null,
    waist: null,
    hips: null,
    inseam: null,
    shoulderWidth: null,
    sleeveLength: null,
    neck: null,
    thigh: null,
    armLength: null,
    torsoLength: null,
    shoeSize: null,
  },
  extendedPreferences: {
    lifestyle: null,
    favoriteBrands: [],
    colorPreferences: [],
    shoppingFrequency: null,
    preferOnlineShopping: true,
    sustainabilityImportant: false,
    occasions: [],
    favoriteShops: [],
    usageGoals: [],
    culturalStyle: {
      dressCodePreference: null,
      religiousOrCulturalDressCode: null,
      subcultureStyle: null,
      subcultureDescription: null,
      dressCodeStrictness: null,
    },
    bodyFitPreferences: {
      fitPreference: null,
      confidentAreas: [],
      preferToMinimize: [],
    },
    colorChoices: {
      favoriteColors: [],
      avoidColors: [],
    },
  },
  stylistPreferences: {
    selectedStylistId: null,
    language: 'English',
    accent: 'American',
    voicePitch: 'mezzo-soprano',
    useNameInGreetings: true, // Default to using name
    namePronunciationConfirmed: false, // Not yet confirmed
  },
});

const COUNTRY_MAPPING: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'UK': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'FR': 'France',
  'DE': 'Germany',
  'IT': 'Italy',
  'ES': 'Spain',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'IN': 'India',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'AE': 'United Arab Emirates',
  'SA': 'Saudi Arabia',
  'ZA': 'South Africa',
  'NG': 'Nigeria',
  'NL': 'Netherlands',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'IE': 'Ireland',
  'NZ': 'New Zealand',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'TW': 'Taiwan',
  'TH': 'Thailand',
  'MY': 'Malaysia',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'VN': 'Vietnam',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
  'EG': 'Egypt',
  'KE': 'Kenya',
  'GH': 'Ghana',
  'MA': 'Morocco',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'AT': 'Austria',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'PT': 'Portugal',
  'GR': 'Greece',
  'PL': 'Poland',
  'CZ': 'Czech Republic',
  'RO': 'Romania',
  'HU': 'Hungary',
  'TR': 'Turkey',
  'RU': 'Russia',
  'UA': 'Ukraine',
  'IL': 'Israel',
  'QA': 'Qatar',
  'KW': 'Kuwait',
  'BH': 'Bahrain',
  'OM': 'Oman',
  'JO': 'Jordan',
  'LB': 'Lebanon',
};

function getCountryName(isoCode: string | null | undefined): string {
  if (!isoCode) return 'United States';
  return COUNTRY_MAPPING[isoCode.toUpperCase()] || isoCode;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<LocationPermissionStatus>('unknown');

  const actualCountry = detectedCountry || user?.actualCountry || null;
  const explorationCountry = user?.country || null;
  const isExploringOtherCountry = !!(actualCountry && explorationCountry && actualCountry !== explorationCountry);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && !isLoading) {
      detectActualLocationInternal();
    }
  }, [user?.id, isLoading]);

  useEffect(() => {
    if (user && detectedCountry && !user.actualCountry) {
      saveUserWithActualCountry(detectedCountry);
    }
  }, [detectedCountry, user?.id, user?.actualCountry]);

  const saveUserWithActualCountry = async (country: string) => {
    if (!user) return;
    const updatedUser = { ...user, actualCountry: country };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const detectActualLocationInternal = async (): Promise<boolean> => {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      
      if (status === Location.PermissionStatus.GRANTED) {
        setLocationPermissionStatus('granted');
      } else if (status === Location.PermissionStatus.DENIED && !canAskAgain) {
        setLocationPermissionStatus('denied_forever');
        return false;
      } else {
        const response = await Location.requestForegroundPermissionsAsync();
        if (response.status === 'granted') {
          setLocationPermissionStatus('granted');
        } else if (!response.canAskAgain) {
          setLocationPermissionStatus('denied_forever');
          return false;
        } else {
          setLocationPermissionStatus('denied');
          return false;
        }
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      
      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (reverseGeocode?.isoCountryCode) {
        const countryName = getCountryName(reverseGeocode.isoCountryCode);
        setDetectedCountry(countryName);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Could not detect location:', error);
      return false;
    }
  };

  const loadUser = async () => {
    try {
      await apiService.init();
      
      const wakeResult = await apiService.wakeBackend();
      if (wakeResult.success) {
        console.log(wakeResult.wasAsleep ? 'Backend woke up successfully' : 'Backend is ready');
      } else {
        console.log('Backend not available, using local storage');
      }

      const userData = await AsyncStorage.getItem(STORAGE_KEY);
      if (userData) {
        const localUser = JSON.parse(userData);
        localUser.subscriptionTier = normalizeSubscriptionTier(localUser.subscriptionTier);
        if (await shouldApplyTestingUnlock(localUser)) {
          localUser.subscriptionTier = 'stylist_unlimited';
        }
        setUser(localUser);
        resumeStylistChatSession(String(localUser.id || '').trim());
        
        // Try to refresh from backend to ensure onboarding + tour status is accurate
        try {
          const backendProfile = await apiService.getMe();
          if (backendProfile) {
            const deviceFlag = await AsyncStorage.getItem(getTourSeenStorageKey(localUser.id)).catch(() => null);
            const legacyFlag = await AsyncStorage.getItem('@dripn_tour_seen').catch(() => null);
            const deviceTourSeen = deviceFlag === 'true' || legacyFlag === 'true';
            const backendTourSeen = backendProfile.hasSeenTour === true
              || backendProfile.profileData?.hasSeenTour === true;
            const hasSeenTour = deviceTourSeen || backendTourSeen || localUser.hasSeenTour === true;

            if (hasSeenTour) {
              persistTourSeenLocally(localUser.id).catch(() => {});
            }

            const hydrated = await hydrateUserProfileAfterAuth(localUser, {
              backendLoginUser: backendProfile,
              preserveLocalEmail: localUser.email,
            });
            const updatedUser = {
              ...hydrated,
              hasSeenTour,
              subscriptionTier: reconcileSubscriptionTier({
                local: localUser.subscriptionTier,
                remote: hydrated.subscriptionTier,
                allowLocalUnlock: await shouldApplyTestingUnlock(hydrated),
              }),
            };
            if (await shouldApplyTestingUnlock(updatedUser)) {
              updatedUser.subscriptionTier = 'stylist_unlimited';
            }
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
            setUser(updatedUser);
            await syncHydratedProfileToBackendSafe(updatedUser);
            // Retry any Apple IAP sync that failed after purchase (e.g. missing JWT)
            apiService.flushPendingAppleSubscriptionSync().catch(() => {});
            console.log('[Auth] loadUser refresh:', { hasSeenTour, hasCompletedOnboarding: updatedUser.hasCompletedOnboarding });
          }
        } catch (backendErr) {
          // If backend fetch fails, continue with local user
          console.log('[Auth] Could not refresh from backend on init');
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUserLocalOnly = async (userData: UserProfile) => {
    const normalizedUser: UserProfile = {
      ...userData,
      subscriptionTier: normalizeSubscriptionTier(userData.subscriptionTier),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
    } catch (error) {
      console.error('Failed to save user locally:', error);
      throw error;
    }
  };

  const saveUser = async (userData: UserProfile) => {
    const normalizedUser: UserProfile = {
      ...userData,
      subscriptionTier: normalizeSubscriptionTier(userData.subscriptionTier),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      // Sync to backend so profile survives device changes / reinstalls
      if (normalizedUser.id) {
        const { id, email, ...profileData } = normalizedUser as any;
        // CRITICAL: Never sync hasSeenTour: false to the backend.
        // false just means "not yet confirmed on this device" — it is NOT authoritative.
        // Only sync it when it's definitively true. This prevents overwriting a good
        // backend value with a stale false during login when getMe() fails.
        if (profileData.hasSeenTour !== true) {
          delete profileData.hasSeenTour;
        }
        try {
          await apiService.syncProfile(profileData);
        } catch (syncErr) {
          // Sync failure is non-fatal — device storage is still updated
        }
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      throw error;
    }
  };

  /** Upload guest stylist threads to the new account; clear local guest session. Non-fatal. */
  const claimGuestConversationsAfterAuth = async () => {
    try {
      const { guestToken, conversations, seedMessages } = await readGuestConversationsForClaim();
      if (conversations.length === 0) {
        if (guestToken) await clearGuestSessionLocal();
        return;
      }
      try {
        await apiService.claimGuestConversations(guestToken, conversations);
      } catch (claimErr) {
        console.log('Guest conversation claim failed (non-fatal):', claimErr);
        // Still seed local chat + clear guest token so user isn't stuck in limbo
      }
      await seedAiStylistChatFromGuest(seedMessages);
      await clearGuestSessionLocal();
    } catch (error) {
      console.log('Guest conversation migration skipped:', error);
    }
  };

  const login = async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const result = await apiService.login(email, password);
      const backendUser = result.user;
      const userId = backendUser.id?.toString();
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      let userProfile: UserProfile;

      if (existingData) {
        const existingUser = JSON.parse(existingData);
        if (existingUser.email === email) {
          // Same account: preserve local data but update with fresh backend values
          userProfile = { ...existingUser, id: userId || existingUser.id };
        } else {
          // Different account on this device — start fresh, then try to restore from backend
          userProfile = createDefaultUser(email, backendUser.displayName || email.split('@')[0]);
          userProfile.id = userId || userProfile.id;
        }
      } else {
        // No local data at all (new device / reinstall) — restore from backend
        userProfile = createDefaultUser(email, backendUser.displayName || email.split('@')[0]);
        userProfile.id = userId || userProfile.id;
      }

      // CRITICAL: Use hasCompletedOnboarding from login response immediately
      // This is the source of truth — don't wait for getMe() which may fail
      if (backendUser.hasCompletedOnboarding !== undefined) {
        userProfile.hasCompletedOnboarding = backendUser.hasCompletedOnboarding;
      }

      if (backendUser.hasSeenTour === true || backendUser.profileData?.hasSeenTour === true) {
        userProfile.hasSeenTour = true;
      }

      if (backendUser.subscriptionTier) {
        userProfile.subscriptionTier = normalizeSubscriptionTier(backendUser.subscriptionTier);
      }
      if (backendUser.isAdmin !== undefined) {
        userProfile.isAdmin = Boolean(backendUser.isAdmin);
      }

      userProfile = await hydrateAndSyncUserProfileAfterAuth(userProfile, {
        backendLoginUser: backendUser,
        preserveLocalEmail: email,
      });

      await transitionStylistChatSessionForAuth(String(userProfile.id || userId || '').trim());
      await saveUserLocalOnly(userProfile);
      await claimGuestConversationsAfterAuth();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed. Please try again.';
      throw new Error(errorMessage);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsAuthenticating(true);
    try {
      let pendingReferral: string | undefined;
      try {
        const stored = await AsyncStorage.getItem('@dripn_pending_referral');
        if (stored) pendingReferral = stored;
      } catch {
        /* ignore */
      }

      const result = await apiService.register(email, password, name, pendingReferral);
      if (pendingReferral) {
        try {
          await AsyncStorage.removeItem('@dripn_pending_referral');
        } catch {
          /* ignore */
        }
      }
      const backendUser = result.user;
      const newUser = createDefaultUser(email, name);
      newUser.id = backendUser.id?.toString() || newUser.id;
      await transitionStylistChatSessionForAuth(String(newUser.id || '').trim());
      await saveUser(newUser);

      try {
        const dfyLink = await apiService.linkDFYPayment(email);
        if (dfyLink.linked && dfyLink.packageType) {
          console.log(`DFY payment linked: ${dfyLink.packageType}`);
        }
      } catch (dfyError) {
        console.log('No pending DFY payment to link');
      }

      await claimGuestConversationsAfterAuth();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      throw new Error(errorMessage);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const socialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setIsAuthenticating(true);
    try {
      let accessToken: string | undefined;
      let idToken: string | undefined;
      let userEmail: string | undefined;
      let userName: string | undefined;

      if (provider === 'apple') {
        if (Platform.OS !== 'ios') {
          throw new Error('Apple Sign-In is only available on iOS devices');
        }
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        idToken = credential.identityToken || undefined;
        userEmail = credential.email || undefined;
        userName = credential.fullName?.givenName 
          ? `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
          : undefined;
        if (!idToken) {
          throw new Error('Apple Sign-In did not return an identity token');
        }
        const result = await apiService.socialLogin('apple', '', idToken, {
          email: userEmail,
          displayName: userName,
          providerUserId: credential.user,
        });
        if (!result || !result.token || !result.user) {
          throw new Error('Invalid response from authentication server');
        }
        const backendUser = result.user;
        if (!backendUser.id) {
          throw new Error('Authentication failed: No user ID received');
        }
        let newUser = createDefaultUser(
          backendUser.email || userEmail || 'apple_user@privaterelay.appleid.com',
          backendUser.displayName || userName || 'Apple User'
        );
        newUser.id = backendUser.id.toString();
        if (backendUser.hasCompletedOnboarding !== undefined) {
          newUser.hasCompletedOnboarding = backendUser.hasCompletedOnboarding;
        }
        newUser = await hydrateAndSyncUserProfileAfterAuth(newUser, {
          backendLoginUser: backendUser,
          preserveLocalEmail: backendUser.email || userEmail || newUser.email,
        });
        await transitionStylistChatSessionForAuth(String(newUser.id || '').trim());
        await saveUserLocalOnly(newUser);
        await claimGuestConversationsAfterAuth();
        return;
      } else if (provider === 'google') {
        const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
        if (!googleClientId) {
          throw new Error('Google Client ID not configured. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID.');
        }
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'dripn' });
        const discovery = {
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
        };
        const authRequest = new AuthSession.AuthRequest({
          clientId: googleClientId,
          scopes: ['openid', 'profile', 'email'],
          redirectUri,
          responseType: AuthSession.ResponseType.Token,
        });
        const result = await authRequest.promptAsync(discovery);
        if (result.type === 'success' && result.authentication) {
          accessToken = result.authentication.accessToken;
          idToken = result.authentication.idToken || undefined;
        } else if (result.type === 'cancel') {
          throw new Error('Google sign-in was cancelled');
        } else {
          throw new Error('Google sign-in failed');
        }
      } else if (provider === 'facebook') {
        const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
        if (!facebookAppId) {
          throw new Error('Facebook App ID not configured. Please set EXPO_PUBLIC_FACEBOOK_APP_ID.');
        }
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'dripn' });
        const discovery = {
          authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
          tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
        };
        const authRequest = new AuthSession.AuthRequest({
          clientId: facebookAppId,
          scopes: ['public_profile', 'email'],
          redirectUri,
          responseType: AuthSession.ResponseType.Token,
        });
        const result = await authRequest.promptAsync(discovery);
        if (result.type === 'success' && result.authentication) {
          accessToken = result.authentication.accessToken;
        } else if (result.type === 'cancel') {
          throw new Error('Facebook sign-in was cancelled');
        } else {
          throw new Error('Facebook sign-in failed');
        }
      }

      if (!accessToken && !idToken) {
        throw new Error('No authentication token received');
      }

      const result = await apiService.socialLogin(provider, accessToken || '', idToken);
      
      if (!result || !result.token || !result.user) {
        throw new Error('Invalid response from authentication server');
      }
      
      const backendUser = result.user;
      if (!backendUser.id) {
        throw new Error('Authentication failed: No user ID received');
      }
      
      let newUser = createDefaultUser(
        backendUser.email || userEmail || `${provider}_user@${provider}.com`,
        backendUser.displayName || userName || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`
      );
      newUser.id = backendUser.id.toString();

      // CRITICAL: Use hasCompletedOnboarding from social login response immediately
      if (backendUser.hasCompletedOnboarding !== undefined) {
        newUser.hasCompletedOnboarding = backendUser.hasCompletedOnboarding;
      }

      newUser = await hydrateAndSyncUserProfileAfterAuth(newUser, {
        backendLoginUser: backendUser,
        preserveLocalEmail: backendUser.email || userEmail || newUser.email,
      });

      await transitionStylistChatSessionForAuth(String(newUser.id || '').trim());
      await saveUserLocalOnly(newUser);

      try {
        const email = backendUser.email || userEmail;
        if (email) {
          const dfyLink = await apiService.linkDFYPayment(email);
          if (dfyLink.linked && dfyLink.packageType) {
            console.log(`DFY payment linked via social: ${dfyLink.packageType}`);
          }
        }
      } catch (dfyError) {
        console.log('No pending DFY payment to link');
      }

      await claimGuestConversationsAfterAuth();
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Called from AuthScreen after Google OAuth hook resolves tokens
  const googleLoginWithTokens = async (accessToken: string, idToken?: string, userEmail?: string, userName?: string) => {
    setIsAuthenticating(true);
    try {
      const result = await apiService.socialLogin('google', accessToken, idToken);
      if (!result || !result.token || !result.user) {
        throw new Error('Invalid response from authentication server');
      }
      const backendUser = result.user;
      if (!backendUser.id) throw new Error('Authentication failed: No user ID received');

      let newUser = createDefaultUser(
        backendUser.email || userEmail || 'google_user@gmail.com',
        backendUser.displayName || userName || 'Google User'
      );
      newUser.id = backendUser.id.toString();

      if (backendUser.hasCompletedOnboarding !== undefined) {
        newUser.hasCompletedOnboarding = backendUser.hasCompletedOnboarding;
      }

      newUser = await hydrateAndSyncUserProfileAfterAuth(newUser, {
        backendLoginUser: backendUser,
        preserveLocalEmail: backendUser.email || userEmail || newUser.email,
      });

      await transitionStylistChatSessionForAuth(String(newUser.id || '').trim());
      await saveUserLocalOnly(newUser);

      try {
        const email = backendUser.email || userEmail;
        if (email) {
          const dfyLink = await apiService.linkDFYPayment(email);
          if (dfyLink.linked && dfyLink.packageType) {
            console.log(`DFY payment linked via Google: ${dfyLink.packageType}`);
          }
        }
      } catch (_) {}

      await claimGuestConversationsAfterAuth();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loginAsTestUser = async () => {
    if (!__DEV__) {
      console.warn('loginAsTestUser is only available in development mode');
      return;
    }
    
    const testUser: UserProfile = {
      id: 'test-user-' + Date.now().toString(),
      email: 'test@dripn.dev',
      name: 'Test User',
      avatar: null,
      country: 'United Kingdom',
      actualCountry: 'United Kingdom',
      gender: 'man',
      stylePreference: 'luxury',
      sizeRange: 'M-L',
      bodyShape: 'Athletic',
      budgetRange: 'Mid-Range',
      skinUndertone: null,
      subscriptionTier: 'stylist_unlimited',
      contributorTier: 'none',
      feedPreference: 'global',
      aiSuggestionsEnabled: true,
      postsCount: 0,
      helpfulVotes: 0,
      thanksReceived: 0,
      createdAt: new Date().toISOString(),
      hasCompletedOnboarding: true,
      hasCompletedQuiz: true,
      hasSeenTour: true,
      hasDismissedTrialOffer: false,
      bodyMeasurements: {
        height: 175,
        heightUnit: 'cm',
        weight: 75,
        weightUnit: 'kg',
        measurementUnit: 'cm',
        chest: null,
        waist: null,
        hips: null,
        inseam: null,
        shoulderWidth: null,
        sleeveLength: null,
        neck: null,
        thigh: null,
        armLength: null,
        torsoLength: null,
        shoeSize: null,
      },
      extendedPreferences: {
        lifestyle: 'professional',
        favoriteBrands: ['Nike', 'Zara', 'H&M'],
        colorPreferences: ['navy', 'white', 'gray'],
        shoppingFrequency: 'monthly',
        preferOnlineShopping: true,
        sustainabilityImportant: true,
        occasions: ['work', 'casual', 'date-night'],
        favoriteShops: [],
        usageGoals: ['dress-better', 'build-wardrobe'],
        culturalStyle: {
          dressCodePreference: null,
          religiousOrCulturalDressCode: null,
          subcultureStyle: null,
          subcultureDescription: null,
          dressCodeStrictness: null,
        },
        bodyFitPreferences: {
          fitPreference: 'Tailored',
          confidentAreas: ['Shoulders', 'Arms'],
          preferToMinimize: [],
        },
        colorChoices: {
          favoriteColors: ['navy', 'white', 'gray'],
          avoidColors: ['neon'],
        },
      },
      stylistPreferences: {
        selectedStylistId: 'ruby',
        language: 'English',
        accent: 'British',
        voicePitch: 'mezzo-soprano',
        useNameInGreetings: true,
        namePronunciationConfirmed: true,
      },
    };
    
    await saveUser(testUser);
    await apiService.setToken('dev-test-token');
    console.log('[Auth] Logged in as test user with dev token');
  };

  const logout = async () => {
    try {
      await relinquishStylistChatAccountSession();
      clearPasswordResetToken();
      await apiService.logout();
      await AsyncStorage.removeItem(STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    // Ensure hasSeenTour is always persisted with the user
    if (updates.hasSeenTour !== undefined) {
      console.log('[Auth] Updating hasSeenTour to:', updates.hasSeenTour);
    }
    if (updates.gender === 'man') {
      await onboardingProfileService.syncQuizGenderFromUserGender('man').catch(() => {});
    } else if (updates.gender === 'woman') {
      await onboardingProfileService.syncQuizGenderFromUserGender('woman').catch(() => {});
    }
    await saveUser(updatedUser);
  };

  const applyLocalSubscriptionTier = useCallback(async (tier: SubscriptionTier) => {
    if (!user) return;
    const nextTier = preferHigherSubscriptionTier(user.subscriptionTier, tier);
    if (nextTier === normalizeSubscriptionTier(user.subscriptionTier)) return;
    await saveUserLocalOnly({ ...user, subscriptionTier: nextTier });
  }, [user]);

  const refreshSubscriptionFromBackend = useCallback(async (sessionId?: string) => {
    if (!user) return;
    if (await shouldApplyTestingUnlock(user)) return;
    try {
      // Apple IAP: push RevenueCat entitlements to server (Stripe verify alone stays free)
      if (shouldUseAppleIAP()) {
        try {
          const ready = await appleIAPService.configure(user.id);
          if (ready) {
            const customerInfo = await appleIAPService.getCustomerInfo();
            const tier = resolveTierFromCustomerInfo(customerInfo);
            if (tier !== 'free') {
              await applyLocalSubscriptionTier(tier);
              const syncPayload = await serializeCustomerInfoForSyncWithStorefront(customerInfo);
              if (!syncPayload.tier || syncPayload.tier === 'free') {
                syncPayload.tier = tier;
              }
              await apiService.syncAppleSubscription(syncPayload).catch((err) => {
                console.warn('[Auth] Apple subscription sync failed:', err);
              });
            }
          }
        } catch (appleErr) {
          console.warn('[Auth] Apple entitlement refresh skipped:', appleErr);
        }
      }

      // First try direct verification (checks Stripe directly, bypasses webhook delays)
      let subStatus = await apiService.verifySubscription(sessionId).catch(async () => {
        // Fall back to status if verification fails
        return apiService.getSubscriptionStatus();
      });
      
      if (subStatus?.plan != null) {
        const mappedTier = normalizeSubscriptionTier(subStatus.plan);
        const nextTier = reconcileSubscriptionTier({
          local: user.subscriptionTier,
          remote: mappedTier,
          allowLocalUnlock: await shouldApplyTestingUnlock(user),
        });
        if (nextTier !== normalizeSubscriptionTier(user.subscriptionTier)) {
          const updatedUser = { ...user, subscriptionTier: nextTier };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      }
    } catch {
      // Silently fail — stale data is preferable to a crash
    }
  }, [user, applyLocalSubscriptionTier]);

  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        refreshSubscriptionFromBackend();
        apiService.flushPendingAppleSubscriptionSync().catch(() => {});
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, [refreshSubscriptionFromBackend]);

  const completeOnboarding = async (profile: Partial<UserProfile>) => {
    if (!user) return;
    const updatedUser = { 
      ...user, 
      ...profile,
      stylistPreferences: {
        ...user.stylistPreferences,
        ...(profile.stylistPreferences || {}),
      },
      hasCompletedOnboarding: true 
    };
    if (profile.gender === 'man') {
      await onboardingProfileService.saveProfile({ quizGender: 'male' }).catch(() => {});
    } else if (profile.gender === 'woman') {
      await onboardingProfileService.saveProfile({ quizGender: 'female' }).catch(() => {});
    }
    await saveUser(updatedUser);
  };

  const completeQuiz = async (quizData: Partial<UserProfile>) => {
    if (!user) return;
    const updatedUser = { 
      ...user, 
      ...quizData, 
      bodyMeasurements: {
        ...user.bodyMeasurements,
        ...(quizData.bodyMeasurements || {}),
      },
      extendedPreferences: {
        ...user.extendedPreferences,
        ...(quizData.extendedPreferences || {}),
      },
      hasCompletedQuiz: true 
    };
    await saveUser(updatedUser);
  };

  const detectActualLocation = useCallback(async () => {
    await detectActualLocationInternal();
  }, []);

  const switchBackToActualLocation = useCallback(async () => {
    if (!user || !actualCountry) return;
    await saveUser({ ...user, country: actualCountry });
  }, [user, actualCountry]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticating,
        isAuthenticated: !!user,
        isExploringOtherCountry,
        explorationCountry,
        actualCountry,
        locationPermissionStatus,
        login,
        signup,
        socialLogin,
        googleLoginWithTokens,
        loginAsTestUser,
        logout,
        updateProfile,
        completeOnboarding,
        completeQuiz,
        switchBackToActualLocation,
        detectActualLocation,
        refreshSubscriptionFromBackend,
        applyLocalSubscriptionTier,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
