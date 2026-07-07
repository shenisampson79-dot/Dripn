/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, SubscriptionTier } from '@/contexts/AuthContext';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import { TIER_MATRIX } from '@/utils/tierMatrix';

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
  maxBulkUploadBatch: number;
  priorityBackgroundRemoval: boolean;
  maxComparisonImages: number;
  decisionsPerDay: number | 'unlimited';
  hasDecisionHistory: boolean;
  hasWardrobeAwareDecisions: boolean;
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

function matrixToLimits(tier: SubscriptionTier): TierLimits {
  const m = TIER_MATRIX[tier];
  const num = (v: number | 'unlimited') => (v === 'unlimited' ? Infinity : v);
  return {
    uploadsPerMonth: num(m.uploadsPerMonth),
    aiAdvicePerMonth: num(m.outfitSuggestionsPerDay) * 30,
    voiceCommentsPerMonth: num(m.voiceCommentsPerMonth),
    comparisonPollsPerMonth: tier === 'free' ? 0 : tier === 'personal_stylist' ? 5 : Infinity,
    maxImagesPerPost: m.maxImagesPerPost,
    maxVideoSeconds: m.maxVideoSeconds,
    canUploadVideo: m.canUploadVideo,
    prioritySupport: m.prioritySupport,
    exclusiveContent: tier === 'stylist_unlimited',
    affiliateAccess: tier === 'stylist_unlimited',
    customThemes: tier === 'stylist_unlimited',
    canMakeVideoCalls: tier === 'stylist_unlimited',
    stylistSessionsPerMonth: tier === 'stylist_unlimited' ? Infinity : 0,
    canCallVIPMembers: tier === 'stylist_unlimited',
    styleShuffleSwipesPerDay: num(m.styleShuffleSwipesPerDay),
    visualSearchPerMonth: num(m.visualSearchPerMonth),
    wardrobeItemsLimit: m.wardrobeItemsLimit,
    aiChatMessagesPerDay: num(m.aiChatMessagesPerDay),
    outfitSuggestionsPerDay: num(m.outfitSuggestionsPerDay),
    canAccessChallenges: m.canAccessChallenges,
    canAccessOutfitCalendar: m.hasOutfitCalendar,
    canAccessSustainabilityFeatures: m.hasSustainabilityFeatures,
    virtualTryOnPerMonth: num(m.virtualTryOnPerMonth),
    maxBulkUploadBatch: m.maxBulkUploadBatch,
    priorityBackgroundRemoval: m.priorityBackgroundRemoval,
    maxComparisonImages: m.maxComparisonImages,
    decisionsPerDay: m.decisionsPerDay,
    hasDecisionHistory: m.hasDecisionHistory,
    hasWardrobeAwareDecisions: m.hasWardrobeAwareDecisions,
  };
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: matrixToLimits('free'),
  personal_stylist: matrixToLimits('personal_stylist'),
  stylist_unlimited: matrixToLimits('stylist_unlimited'),
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: TIER_MATRIX.free.displayName,
    price: 0,
    interval: 'month',
    features: [
      '1 stylist decision per day',
      'Compare 2 shopping options',
      'Up to 15 wardrobe items',
      'Basic AI chat',
    ],
  },
  {
    id: 'personal_stylist',
    tier: 'personal_stylist',
    name: TIER_MATRIX.personal_stylist.displayName,
    price: TIER_MATRIX.personal_stylist.monthlyPriceUsd,
    interval: 'month',
    priceId: 'price_style_chat_monthly',
    productId: 'style_chat',
    features: [
      'Unlimited stylist decisions',
      'Compare up to 3 options',
      'Decision history & wardrobe memory',
      'Wardrobe-aware recommendations',
      '75 wardrobe items',
      'Voice styling sessions',
    ],
  },
  {
    id: 'stylist_unlimited',
    tier: 'stylist_unlimited',
    name: TIER_MATRIX.stylist_unlimited.displayName,
    price: TIER_MATRIX.stylist_unlimited.monthlyPriceUsd,
    interval: 'month',
    priceId: 'price_stylist_unlimited_monthly',
    productId: 'stylist_unlimited',
    popular: true,
    features: [
      'Everything in Personal Stylist',
      'Outfit calendar & event planning',
      'Unlimited wardrobe & try-on',
      'Priority photo processing',
      'Bulk upload (20 items)',
      'Priority support',
    ],
  },
];

// Yearly pricing (Stripe product IDs unchanged)
export const YEARLY_PRICING: Record<string, { productId: string; price: number }> = {
  personal_stylist: { productId: 'style_chat_yearly', price: 95.99 },
  stylist_unlimited: { productId: 'stylist_unlimited_yearly', price: 191.99 },
};

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
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);

  const tier = normalizeSubscriptionTier(user?.subscriptionTier);
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.tier === tier);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const data = await AsyncStorage.getItem(USAGE_STORAGE_KEY);
        if (data) {
          const parsed: UsageStats = JSON.parse(data);
          const lastReset = new Date(parsed.lastResetDate);
          const now = new Date();
          if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
            setUsage(createDefaultUsage());
          } else {
            setUsage(parsed);
          }
        }
      } catch {}
    };
    loadUsage();
  }, []);

  useEffect(() => {
    if (user?.id) {
      setReferralCode(generateReferralCode(user.id));
    }
  }, [user?.id]);

  const saveUsage = async (newUsage: UsageStats) => {
    setUsage(newUsage);
    await AsyncStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(newUsage));
  };

  const canUpload = () => usage.uploadsThisMonth < limits.uploadsPerMonth;
  const canRequestAIAdvice = () => usage.aiAdviceThisMonth < limits.aiAdvicePerMonth;
  const canRecordVoice = () => limits.voiceCommentsPerMonth > 0 && usage.voiceCommentsThisMonth < limits.voiceCommentsPerMonth;
  const canCreatePoll = () => usage.comparisonPollsThisMonth < limits.comparisonPollsPerMonth;

  const incrementUpload = async () => {
    await saveUsage({ ...usage, uploadsThisMonth: usage.uploadsThisMonth + 1 });
  };
  const incrementAIAdvice = async () => {
    await saveUsage({ ...usage, aiAdviceThisMonth: usage.aiAdviceThisMonth + 1 });
  };
  const incrementVoiceComment = async () => {
    await saveUsage({ ...usage, voiceCommentsThisMonth: usage.voiceCommentsThisMonth + 1 });
  };
  const incrementPoll = async () => {
    await saveUsage({ ...usage, comparisonPollsThisMonth: usage.comparisonPollsThisMonth + 1 });
  };

  const getRemainingUploads = () => Math.max(0, limits.uploadsPerMonth - usage.uploadsThisMonth);
  const getRemainingAIAdvice = () => Math.max(0, limits.aiAdvicePerMonth - usage.aiAdviceThisMonth);
  const getRemainingVoice = () => Math.max(0, limits.voiceCommentsPerMonth - usage.voiceCommentsThisMonth);
  const getRemainingPolls = () => Math.max(0, limits.comparisonPollsPerMonth - usage.comparisonPollsThisMonth);

  const startTrial = async () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    await AsyncStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ endDate: trialEnd.toISOString() }));
    setIsTrialActive(true);
    setTrialDaysRemaining(7);
  };

  const selectPlan = async (planId: string) => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (plan && plan.tier !== 'free') {
      await updateProfile({ subscriptionTier: plan.tier });
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
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

export { SUBSCRIPTION_PLANS, TIER_LIMITS };
