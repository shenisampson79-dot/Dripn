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
import { Platform } from 'react-native';
import { StyleTheme } from '@/constants/theme';
import { apiService } from '@/services/ApiService';

WebBrowser.maybeCompleteAuthSession();

export type Gender = 'woman' | 'man' | 'non-binary' | 'prefer-not-to-say' | null;
export type SizeRange = 'XS-S' | 'S-M' | 'M-L' | 'L-XL' | 'XL-2X' | '3X+' | null;
export type BodyShape = 'Hourglass' | 'Pear' | 'Apple' | 'Rectangle' | 'Athletic' | 'Inverted Triangle' | 'Trapezoid' | 'Oval' | null;
export type BudgetRange = 'Budget' | 'Mid-Range' | 'Premium' | 'Luxury' | null;
export type SubscriptionTier = 'free' | 'subscription' | 'premium' | 'pro';
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
export type BodyArea = 'Arms' | 'Shoulders' | 'Chest' | 'Waist' | 'Hips' | 'Legs' | 'Back' | 'Neck' | 'Tummy' | 'Thighs';
export type RubyVoicePitch = 'mezzo-soprano';
export type MaxVoiceRange = 'tenor' | 'baritone' | 'bass';
export type VoicePitch = RubyVoicePitch | MaxVoiceRange;

export interface StylistPreferences {
  selectedStylistId: StylistId;
  language: string;
  accent: string;
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
  loginAsTestUser: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (profile: Partial<UserProfile>) => Promise<void>;
  completeQuiz: (quizData: Partial<UserProfile>) => Promise<void>;
  switchBackToActualLocation: () => Promise<void>;
  detectActualLocation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = '@dripn_user';

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
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (userData: UserProfile) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Failed to save user:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const result = await apiService.login(email, password);
      const backendUser = result.user;
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      let userProfile: UserProfile;
      
      if (existingData) {
        const existingUser = JSON.parse(existingData);
        if (existingUser.email === email) {
          userProfile = { ...existingUser, id: backendUser.id?.toString() || existingUser.id };
        } else {
          userProfile = createDefaultUser(email, backendUser.displayName || email.split('@')[0]);
          userProfile.id = backendUser.id?.toString() || userProfile.id;
        }
      } else {
        userProfile = createDefaultUser(email, backendUser.displayName || email.split('@')[0]);
        userProfile.id = backendUser.id?.toString() || userProfile.id;
      }
      await saveUser(userProfile);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsAuthenticating(true);
    try {
      const result = await apiService.register(email, password, name);
      const backendUser = result.user;
      const newUser = createDefaultUser(email, name);
      newUser.id = backendUser.id?.toString() || newUser.id;
      await saveUser(newUser);
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
      
      const newUser = createDefaultUser(
        backendUser.email || userEmail || `${provider}_user@${provider}.com`,
        backendUser.displayName || userName || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`
      );
      newUser.id = backendUser.id.toString();
      await saveUser(newUser);
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
      subscriptionTier: 'pro',
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
    await saveUser(updatedUser);
  };

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
        loginAsTestUser,
        logout,
        updateProfile,
        completeOnboarding,
        completeQuiz,
        switchBackToActualLocation,
        detectActualLocation,
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
