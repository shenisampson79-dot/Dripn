import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/ApiService';

export interface StyleProfile {
  id: string;
  userId: string;
  dominantStyles: string[];
  colorPreferences: string[];
  fashionInterests: string[];
  stylePersonality: string;
  strengthAreas: string[];
  growthAreas: string[];
  recommendedBrands: string[];
  styleInfluencerType: string;
  confidenceScore: number;
  seasonalStyle: {
    spring: string;
    summer: string;
    autumn: string;
    winter: string;
  };
  dataPoints: {
    postsCount: number;
    likesCount: number;
    dislikesCount: number;
    adviceCount: number;
  };
  analyzedAt: string;
}

export interface PersonalizedStyleOfTheDay {
  personalized: boolean;
  styleOfTheDay: {
    title: string;
    description: string;
    keyPieces: string[];
    colorPalette: string[];
    stylingTips: string;
    occasion: string;
    confidence: string;
    whyThisWorks: string;
    generatedAt: string;
  };
}

export interface PersonalizedOffer {
  category: string;
  item: string;
  description: string;
  suggestedBrands: string[];
  priceRange: string;
  matchScore: number;
}

export interface PersonalizedOffers {
  personalized: boolean;
  personalizedOffers: {
    personalizedPicks: PersonalizedOffer[];
    seasonalMustHave: {
      item: string;
      reason: string;
    };
    investmentPiece: {
      item: string;
      reason: string;
    };
    generatedAt: string;
  };
}

interface StyleProfileContextType {
  styleProfile: StyleProfile | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  personalizedStyleOfTheDay: PersonalizedStyleOfTheDay | null;
  personalizedOffers: PersonalizedOffers | null;
  hasStyleProfile: boolean;
  refreshStyleProfile: () => Promise<void>;
  analyzeStyleProfile: () => Promise<void>;
  fetchPersonalizedStyleOfTheDay: () => Promise<void>;
  fetchPersonalizedOffers: () => Promise<void>;
}

const StyleProfileContext = createContext<StyleProfileContextType | null>(null);

interface StyleProfileProviderProps {
  children: ReactNode;
}

export function StyleProfileProvider({ children }: StyleProfileProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalizedStyleOfTheDay, setPersonalizedStyleOfTheDay] = useState<PersonalizedStyleOfTheDay | null>(null);
  const [personalizedOffers, setPersonalizedOffers] = useState<PersonalizedOffers | null>(null);

  const hasStyleProfile = styleProfile !== null && styleProfile.confidenceScore > 0;

  useEffect(() => {
    if (isAuthenticated && user && apiService.isConfigured()) {
      refreshStyleProfile();
    } else {
      setStyleProfile(null);
      setPersonalizedStyleOfTheDay(null);
      setPersonalizedOffers(null);
    }
  }, [isAuthenticated, user?.id]);

  const refreshStyleProfile = useCallback(async () => {
    if (!apiService.isConfigured()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await apiService.getStyleProfile();
      setStyleProfile(profile);
    } catch (err) {
      console.error('Failed to fetch style profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch style profile');
      setStyleProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeStyleProfile = useCallback(async () => {
    if (!apiService.isConfigured()) {
      setError('Backend not configured');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await apiService.analyzeStyleProfile();
      if (result.success && result.profile) {
        setStyleProfile(result.profile as StyleProfile);
      }
    } catch (err) {
      console.error('Failed to analyze style profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze style profile');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const fetchPersonalizedStyleOfTheDay = useCallback(async () => {
    if (!apiService.isConfigured() || !hasStyleProfile) {
      return;
    }

    try {
      const result = await apiService.getPersonalizedStyleOfTheDay();
      setPersonalizedStyleOfTheDay(result);
    } catch (err) {
      console.error('Failed to fetch personalized style of the day:', err);
    }
  }, [hasStyleProfile]);

  const fetchPersonalizedOffers = useCallback(async () => {
    if (!apiService.isConfigured() || !hasStyleProfile) {
      return;
    }

    try {
      const result = await apiService.getPersonalizedOffers();
      setPersonalizedOffers(result);
    } catch (err) {
      console.error('Failed to fetch personalized offers:', err);
    }
  }, [hasStyleProfile]);

  const value: StyleProfileContextType = {
    styleProfile,
    isLoading,
    isAnalyzing,
    error,
    personalizedStyleOfTheDay,
    personalizedOffers,
    hasStyleProfile,
    refreshStyleProfile,
    analyzeStyleProfile,
    fetchPersonalizedStyleOfTheDay,
    fetchPersonalizedOffers,
  };

  return (
    <StyleProfileContext.Provider value={value}>
      {children}
    </StyleProfileContext.Provider>
  );
}

export function useStyleProfile(): StyleProfileContextType {
  const context = useContext(StyleProfileContext);
  if (!context) {
    throw new Error('useStyleProfile must be used within a StyleProfileProvider');
  }
  return context;
}
