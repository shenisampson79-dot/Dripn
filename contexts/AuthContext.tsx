import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleTheme } from '@/constants/theme';

export type SizeRange = 'XS-S' | 'M-L' | 'XL-2X' | '3X+' | null;
export type BodyShape = 'Hourglass' | 'Pear' | 'Apple' | 'Rectangle' | 'Athletic' | null;
export type BudgetRange = 'Budget' | 'Mid-Range' | 'Premium' | 'Luxury' | null;
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'vip';
export type ContributorTier = 'none' | 'styleContributor' | 'fashionAdvisor' | 'styleExpert' | 'fashionGuru';
export type FeedPreference = 'global' | 'regional' | 'local';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  country: string;
  stylePreference: StyleTheme;
  sizeRange: SizeRange;
  bodyShape: BodyShape;
  budgetRange: BudgetRange;
  subscriptionTier: SubscriptionTier;
  contributorTier: ContributorTier;
  feedPreference: FeedPreference;
  postsCount: number;
  helpfulVotes: number;
  thanksReceived: number;
  createdAt: string;
  hasCompletedOnboarding: boolean;
  hasDismissedTrialOffer: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (profile: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = '@stylewise_user';

const createDefaultUser = (email: string, name: string): UserProfile => ({
  id: Date.now().toString(),
  email,
  name,
  avatar: null,
  country: 'United States',
  stylePreference: 'luxury',
  sizeRange: null,
  bodyShape: null,
  budgetRange: null,
  subscriptionTier: 'free',
  contributorTier: 'none',
  feedPreference: 'global',
  postsCount: 0,
  helpfulVotes: 0,
  thanksReceived: 0,
  createdAt: new Date().toISOString(),
  hasCompletedOnboarding: false,
  hasDismissedTrialOffer: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
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

  const login = async (email: string, _password: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
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

  const signup = async (email: string, _password: string, name: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const newUser = createDefaultUser(email, name);
      await saveUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
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
      hasCompletedOnboarding: true 
    };
    await saveUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateProfile,
        completeOnboarding,
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
