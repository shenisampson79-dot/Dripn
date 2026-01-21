/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, SubscriptionTier } from '@/contexts/AuthContext';

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  price: number;
  interval: 'month' | 'year';
  priceId?: string;
  productId?: string;
  features: string[];
  popular?: boolean;
}

export interface TierLimits {
  uploadsPerMonth: number;
  aiAdvicePerMonth: number;
  voiceCommentsPerMonth: number;
  comparisonPollsPerMonth: number;
  maxImagesPerPost: number;
  maxVideoSeconds: number;
  canUploadVideo: boolean;
  prioritySupport: boolean;
  exclusiveContent: boolean;
  affiliateAccess: boolean;
  customThemes: boolean;
  canMakeVideoCalls: boolean;
  stylistSessionsPerMonth: number;
  canCallVIPMembers: boolean;
  styleShuffleSwipesPerDay: number;
  visualSearchPerMonth: number;
  wardrobeItemsLimit: number;
  aiChatMessagesPerDay: number;
  outfitSuggestionsPerDay: number;
  canAccessChallenges: boolean;
  canAccessOutfitCalendar: boolean;
  canAccessSustainabilityFeatures: boolean;
  virtualTryOnPerMonth: number;
}

export interface UsageStats {
  uploadsThisMonth: number;
  aiAdviceThisMonth: number;
  voiceCommentsThisMonth: number;
  comparisonPollsThisMonth: number;
  lastResetDate: string;
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  limits: TierLimits;
  usage: UsageStats;
  plans: SubscriptionPlan[];
  currentPlan: SubscriptionPlan | undefined;
  canUpload: () => boolean;
  canRequestAIAdvice: () => boolean;
  canRecordVoice: () => boolean;
  canCreatePoll: () => boolean;
  incrementUpload: () => Promise<void>;
  incrementAIAdvice: () => Promise<void>;
  incrementVoiceComment: () => Promise<void>;
  incrementPoll: () => Promise<void>;
  getRemainingUploads: () => number;
  getRemainingAIAdvice: () => number;
  getRemainingVoice: () => number;
  getRemainingPolls: () => number;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  startTrial: () => Promise<void>;
  referralCode: string;
  referralCount: number;
  selectPlan: (planId: string) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const USAGE_STORAGE_KEY = '@dripn_usage';
const TRIAL_STORAGE_KEY = '@dripn_trial';

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    uploadsPerMonth: 5,
    aiAdvicePerMonth: 3,
    voiceCommentsPerMonth: 0,
    comparisonPollsPerMonth: 2,
    maxImagesPerPost: 2,
    maxVideoSeconds: 0,
    canUploadVideo: false,
    prioritySupport: false,
    exclusiveContent: false,
    affiliateAccess: false,
    customThemes: false,
    canMakeVideoCalls: false,
    stylistSessionsPerMonth: 0,
    canCallVIPMembers: false,
    styleShuffleSwipesPerDay: 10,
    visualSearchPerMonth: 3,
    wardrobeItemsLimit: 20,
    aiChatMessagesPerDay: 25,
    outfitSuggestionsPerDay: 3,
    canAccessChallenges: false,
    canAccessOutfitCalendar: false,
    canAccessSustainabilityFeatures: false,
    virtualTryOnPerMonth: 0,
  },
  premium: {
    uploadsPerMonth: Infinity,
    aiAdvicePerMonth: Infinity,
    voiceCommentsPerMonth: Infinity,
    comparisonPollsPerMonth: Infinity,
    maxImagesPerPost: 12,
    maxVideoSeconds: 180,
    canUploadVideo: true,
    prioritySupport: true,
    exclusiveContent: true,
    affiliateAccess: true,
    customThemes: true,
    canMakeVideoCalls: false,
    stylistSessionsPerMonth: 0,
    canCallVIPMembers: false,
    styleShuffleSwipesPerDay: Infinity,
    visualSearchPerMonth: Infinity,
    wardrobeItemsLimit: Infinity,
    aiChatMessagesPerDay: Infinity,
    outfitSuggestionsPerDay: Infinity,
    canAccessChallenges: true,
    canAccessOutfitCalendar: true,
    canAccessSustainabilityFeatures: true,
    virtualTryOnPerMonth: 10,
  },
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'Style Chat',
    price: 0,
    interval: 'month',
    features: [
      'Basic styling tips',
      'Limited voice conversations',
      'Community voting (after 5 decisions)',
      'Wardrobe basics',
    ],
  },
  {
    id: 'premium',
    tier: 'premium',
    name: 'Personal Stylist',
    price: 14.99,
    interval: 'month',
    priceId: 'price_personal_stylist_monthly',
    productId: 'monthly',
    popular: true,
    features: [
      'Unlimited voice conversations',
      'Your personal AI stylist (Ruby, Max, Ace, or Ivy)',
      'Unlimited outfit advice',
      'Full wardrobe analysis',
      'Priority support',
      'Ad-free experience',
    ],
  },
];

const createDefaultUsage = (): UsageStats => ({
  uploadsThisMonth: 0,
  aiAdviceThisMonth: 0,
  voiceCommentsThisMonth: 0,
  comparisonPollsThisMonth: 0,
  lastResetDate: new Date().toISOString(),
});

const generateReferralCode = (userId: string): string => {
  const base = userId.slice(-4).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SW${base}${random}`;
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [usage, setUsage] = useState<UsageStats>(createDefaultUsage());
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);

  const tier = user?.subscriptionTier || 'free';
  const limits = TIER_LIMITS[tier];
  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.tier === tier);

  useEffect(() => {
    loadUsage();
    loadTrialStatus();
    if (user?.id) {
      setReferralCode(generateReferralCode(user.id));
    }
  }, [user?.id]);

  useEffect(() => {
    checkMonthlyReset();
  }, [usage.lastResetDate]);

  const loadUsage = async () => {
    try {
      const data = await AsyncStorage.getItem(USAGE_STORAGE_KEY);
      if (data) {
        setUsage(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const loadTrialStatus = async () => {
    try {
      const data = await AsyncStorage.getItem(TRIAL_STORAGE_KEY);
      if (data) {
        const trialData = JSON.parse(data);
        setTrialStartDate(trialData.startDate);
        const startDate = new Date(trialData.startDate);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        setIsTrialActive(daysDiff < 7);
      }
    } catch (error) {
      console.error('Failed to load trial status:', error);
    }
  };

  const checkMonthlyReset = () => {
    const lastReset = new Date(usage.lastResetDate);
    const now = new Date();
    if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
      const newUsage = createDefaultUsage();
      setUsage(newUsage);
      saveUsage(newUsage);
    }
  };

  const saveUsage = async (newUsage: UsageStats) => {
    try {
      await AsyncStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(newUsage));
      setUsage(newUsage);
    } catch (error) {
      console.error('Failed to save usage:', error);
    }
  };

  const canUpload = () => {
    if (limits.uploadsPerMonth === Infinity) return true;
    return usage.uploadsThisMonth < limits.uploadsPerMonth;
  };

  const canRequestAIAdvice = () => {
    if (limits.aiAdvicePerMonth === Infinity) return true;
    return usage.aiAdviceThisMonth < limits.aiAdvicePerMonth;
  };

  const canRecordVoice = () => {
    if (limits.voiceCommentsPerMonth === Infinity) return true;
    if (limits.voiceCommentsPerMonth === 0) return false;
    return usage.voiceCommentsThisMonth < limits.voiceCommentsPerMonth;
  };

  const canCreatePoll = () => {
    if (limits.comparisonPollsPerMonth === Infinity) return true;
    return usage.comparisonPollsThisMonth < limits.comparisonPollsPerMonth;
  };

  const incrementUpload = async () => {
    const newUsage = { ...usage, uploadsThisMonth: usage.uploadsThisMonth + 1 };
    await saveUsage(newUsage);
  };

  const incrementAIAdvice = async () => {
    const newUsage = { ...usage, aiAdviceThisMonth: usage.aiAdviceThisMonth + 1 };
    await saveUsage(newUsage);
  };

  const incrementVoiceComment = async () => {
    const newUsage = { ...usage, voiceCommentsThisMonth: usage.voiceCommentsThisMonth + 1 };
    await saveUsage(newUsage);
  };

  const incrementPoll = async () => {
    const newUsage = { ...usage, comparisonPollsThisMonth: usage.comparisonPollsThisMonth + 1 };
    await saveUsage(newUsage);
  };

  const getRemainingUploads = () => {
    if (limits.uploadsPerMonth === Infinity) return Infinity;
    return Math.max(0, limits.uploadsPerMonth - usage.uploadsThisMonth);
  };

  const getRemainingAIAdvice = () => {
    if (limits.aiAdvicePerMonth === Infinity) return Infinity;
    return Math.max(0, limits.aiAdvicePerMonth - usage.aiAdviceThisMonth);
  };

  const getRemainingVoice = () => {
    if (limits.voiceCommentsPerMonth === Infinity) return Infinity;
    return Math.max(0, limits.voiceCommentsPerMonth - usage.voiceCommentsThisMonth);
  };

  const getRemainingPolls = () => {
    if (limits.comparisonPollsPerMonth === Infinity) return Infinity;
    return Math.max(0, limits.comparisonPollsPerMonth - usage.comparisonPollsThisMonth);
  };

  const trialDaysRemaining = trialStartDate
    ? Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(trialStartDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const startTrial = async () => {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ startDate: now }));
      setTrialStartDate(now);
      setIsTrialActive(true);
      if (updateProfile) {
        await updateProfile({ subscriptionTier: 'premium' });
      }
    } catch (error) {
      console.error('Failed to start trial:', error);
    }
  };

  const selectPlan = async (planId: string) => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) return;

    try {
      if (updateProfile) {
        await updateProfile({ subscriptionTier: plan.tier });
      }
    } catch (error) {
      console.error('Failed to select plan:', error);
      throw error;
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        limits,
        usage,
        plans: SUBSCRIPTION_PLANS,
        currentPlan,
        canUpload,
        canRequestAIAdvice,
        canRecordVoice,
        canCreatePoll,
        incrementUpload,
        incrementAIAdvice,
        incrementVoiceComment,
        incrementPoll,
        getRemainingUploads,
        getRemainingAIAdvice,
        getRemainingVoice,
        getRemainingPolls,
        isTrialActive,
        trialDaysRemaining,
        startTrial,
        referralCode,
        referralCount,
        selectPlan,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

export { SUBSCRIPTION_PLANS, TIER_LIMITS };
export type { SubscriptionTier };
