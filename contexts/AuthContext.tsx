/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StyleTheme } from '@/constants/theme';
import { apiService } from '@/services/ApiService';

export type Gender = 'woman' | 'man' | 'non-binary' | 'prefer-not-to-say' | null;
export type SizeRange = 'XS-S' | 'M-L' | 'XL-2X' | '3X+' | null;
export type BodyShape = 'Hourglass' | 'Pear' | 'Apple' | 'Rectangle' | 'Athletic' | 'Inverted Triangle' | 'Trapezoid' | 'Oval' | null;
export type BudgetRange = 'Budget' | 'Mid-Range' | 'Premium' | 'Luxury' | null;
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'vip';
export type ContributorTier = 'none' | 'styleContributor' | 'fashionAdvisor' | 'styleExpert' | 'fashionGuru';
export type FeedPreference = 'global' | 'regional' | 'local';
export type Lifestyle = 'casual' | 'professional' | 'active' | 'creative' | 'minimalist' | 'trendsetter' | null;
export type ShoppingFrequency = 'weekly' | 'monthly' | 'seasonal' | 'rarely' | null;
export type DripnGoal = 'dress-better' | 'meet-people' | 'find-offers' | 'get-inspired' | 'build-wardrobe' | 'special-events' | 'professional-image';
export type HeightUnit = 'cm' | 'ft';
export type WeightUnit = 'kg' | 'lbs';
export type StylistId = 'ruby' | 'max' | null;
export type RubyVoicePitch = 'soprano' | 'mezzo-soprano' | 'contralto';
export type MaxVoiceRange = 'tenor' | 'baritone' | 'bass';
export type VoicePitch = RubyVoicePitch | MaxVoiceRange;

export interface StylistPreferences {
  selectedStylistId: StylistId;
  language: string;
  accent: string;
  voicePitch: VoicePitch;
}

export interface BodyMeasurements {
  height: number | null;
  heightUnit: HeightUnit;
  weight: number | null;
  weightUnit: WeightUnit;
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
  isAuthenticated: boolean;
  isExploringOtherCountry: boolean;
  explorationCountry: string | null;
  actualCountry: string | null;
  locationPermissionStatus: LocationPermissionStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'facebook' | 'apple') => Promise<void>;
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
  },
  stylistPreferences: {
    selectedStylistId: null,
    language: 'English',
    accent: 'American',
    voicePitch: 'contralto',
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
      
      if (status === 'granted') {
        setLocationPermissionStatus('granted');
      } else if (status === 'denied' && !canAskAgain) {
        setLocationPermissionStatus('denied_forever');
        return false;
      } else if (status !== 'granted') {
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
    setIsLoading(true);
    try {
      try {
        await apiService.login(email, password);
      } catch {
      }
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      if (existingData) {
        const existingUser = JSON.parse(existingData);
        if (existingUser.email === email) {
          setUser(existingUser);
          return;
        }
      }
      const newUser = createDefaultUser(email, email.split('@')[0]);
      await saveUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      try {
        await apiService.register(email, password, name);
      } catch {
      }
      const newUser = createDefaultUser(email, name);
      await saveUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const socialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      const mockEmail = `${provider}_user_${Date.now()}@${provider}.com`;
      const mockName = `${providerName} User`;
      const newUser = createDefaultUser(mockEmail, mockName);
      await saveUser(newUser);
    } finally {
      setIsLoading(false);
    }
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
        isAuthenticated: !!user,
        isExploringOtherCountry,
        explorationCountry,
        actualCountry,
        locationPermissionStatus,
        login,
        signup,
        socialLogin,
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
