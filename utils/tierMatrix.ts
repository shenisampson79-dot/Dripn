/**
 * Single source of truth for the 3-tier product ladder:
 * Free → Personal Stylist → Stylist Unlimited
 */
import type { SubscriptionTier } from '@/contexts/AuthContext';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';

export type BillingPlanId = 'free' | 'style_chat' | 'stylist_unlimited';

export interface TierFeatureMatrix {
  displayName: string;
  tagline: string;
  jobToBeDone: string;
  billingPlanId: BillingPlanId;
  monthlyPriceUsd: number;

  decisionsPerDay: number | 'unlimited';
  maxComparisonImages: number;
  /** Max photos for What should I wear? / Outfit for an event */
  maxOutfitDecisionImages: number;
  hasDecisionHistory: boolean;
  hasWardrobeAwareDecisions: boolean;

  wardrobeItemsLimit: number;
  maxBulkUploadBatch: number;
  priorityBackgroundRemoval: boolean;

  aiChatMessagesPerDay: number | 'unlimited';
  outfitSuggestionsPerDay: number | 'unlimited';
  voiceCommentsPerMonth: number | 'unlimited';
  virtualTryOnPerMonth: number | 'unlimited';

  hasOutfitCalendar: boolean;
  hasEventPlanning: boolean;
  hasSustainabilityFeatures: boolean;
  canAccessChallenges: boolean;
  canUploadVideo: boolean;
  prioritySupport: boolean;

  uploadsPerMonth: number | 'unlimited';
  visualSearchPerMonth: number | 'unlimited';
  styleShuffleSwipesPerDay: number | 'unlimited';
  maxImagesPerPost: number;
  maxVideoSeconds: number;
}

export const TIER_MATRIX: Record<SubscriptionTier, TierFeatureMatrix> = {
  free: {
    displayName: 'Free',
    tagline: 'Try the stylist once',
    jobToBeDone: 'Does this work?',
    billingPlanId: 'free',
    monthlyPriceUsd: 0,

    decisionsPerDay: 1,
    maxComparisonImages: 2,
    maxOutfitDecisionImages: 3,
    hasDecisionHistory: false,
    hasWardrobeAwareDecisions: false,

    wardrobeItemsLimit: 15,
    maxBulkUploadBatch: 5,
    priorityBackgroundRemoval: false,

    aiChatMessagesPerDay: 10,
    outfitSuggestionsPerDay: 2,
    voiceCommentsPerMonth: 0,
    virtualTryOnPerMonth: 0,

    hasOutfitCalendar: false,
    hasEventPlanning: false,
    hasSustainabilityFeatures: false,
    canAccessChallenges: false,
    canUploadVideo: false,
    prioritySupport: false,

    uploadsPerMonth: 3,
    visualSearchPerMonth: 2,
    styleShuffleSwipesPerDay: 5,
    maxImagesPerPost: 2,
    maxVideoSeconds: 0,
  },

  personal_stylist: {
    displayName: 'Personal Stylist',
    tagline: 'Decide faster, daily',
    jobToBeDone: 'Help me decide every day',
    billingPlanId: 'style_chat',
    monthlyPriceUsd: 9.99,

    decisionsPerDay: 'unlimited',
    maxComparisonImages: 3,
    maxOutfitDecisionImages: 5,
    hasDecisionHistory: true,
    hasWardrobeAwareDecisions: true,

    wardrobeItemsLimit: 75,
    maxBulkUploadBatch: 10,
    priorityBackgroundRemoval: false,

    aiChatMessagesPerDay: 'unlimited',
    outfitSuggestionsPerDay: 15,
    voiceCommentsPerMonth: 20,
    virtualTryOnPerMonth: 5,

    hasOutfitCalendar: false,
    hasEventPlanning: false,
    hasSustainabilityFeatures: false,
    canAccessChallenges: true,
    canUploadVideo: true,
    prioritySupport: false,

    uploadsPerMonth: 20,
    visualSearchPerMonth: 15,
    styleShuffleSwipesPerDay: 30,
    maxImagesPerPost: 4,
    maxVideoSeconds: 30,
  },

  stylist_unlimited: {
    displayName: 'Stylist Unlimited',
    tagline: 'Plan your style life',
    jobToBeDone: 'Save my time — plan, pack, and prioritise',
    billingPlanId: 'stylist_unlimited',
    monthlyPriceUsd: 19.99,

    decisionsPerDay: 'unlimited',
    maxComparisonImages: 5,
    maxOutfitDecisionImages: 5,
    hasDecisionHistory: true,
    hasWardrobeAwareDecisions: true,

    wardrobeItemsLimit: Number.POSITIVE_INFINITY,
    maxBulkUploadBatch: 20,
    priorityBackgroundRemoval: true,

    aiChatMessagesPerDay: 'unlimited',
    outfitSuggestionsPerDay: 'unlimited',
    voiceCommentsPerMonth: 100,
    virtualTryOnPerMonth: 'unlimited',

    hasOutfitCalendar: true,
    hasEventPlanning: true,
    hasSustainabilityFeatures: true,
    canAccessChallenges: true,
    canUploadVideo: true,
    prioritySupport: true,

    uploadsPerMonth: 'unlimited',
    visualSearchPerMonth: 'unlimited',
    styleShuffleSwipesPerDay: 'unlimited',
    maxImagesPerPost: 12,
    maxVideoSeconds: 180,
  },
};

export function getTierFeatures(tier?: string | null): TierFeatureMatrix {
  return TIER_MATRIX[normalizeSubscriptionTier(tier)];
}

export function tierHasUnlimitedDecisions(tier?: string | null): boolean {
  return getTierFeatures(tier).decisionsPerDay === 'unlimited';
}

export function getMaxComparisonImages(tier?: string | null): number {
  return getTierFeatures(tier).maxComparisonImages;
}

export function getOutfitDecisionImageLimit(tier?: string | null): number {
  return getTierFeatures(tier).maxOutfitDecisionImages;
}

export function canUseWardrobeInDecisions(tier?: string | null): boolean {
  return getTierFeatures(tier).hasWardrobeAwareDecisions;
}

export function canSaveDecisionHistory(tier?: string | null): boolean {
  return getTierFeatures(tier).hasDecisionHistory;
}

export interface TrendPreviewLimits {
  itemLimit: number;
  influencerLimit: number;
  colorTrendLimit: number;
  includeStyleMovement: boolean;
  culturalNotesLimit: number;
  colorForecastLimit: number;
  includeInfluencerSpotlight: boolean;
  includeColorForecastTip: boolean;
  includeEarlyAccessTip: boolean;
}

/** Trend preview depth by tier — null means no paid trend block. */
export function getTrendPreviewLimits(tier?: string | null): TrendPreviewLimits | null {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'free') return null;
  if (normalized === 'personal_stylist') {
    return {
      itemLimit: 2,
      influencerLimit: 1,
      colorTrendLimit: 3,
      includeStyleMovement: false,
      culturalNotesLimit: 2,
      colorForecastLimit: 4,
      includeInfluencerSpotlight: true,
      includeColorForecastTip: false,
      includeEarlyAccessTip: false,
    };
  }
  return {
    itemLimit: 5,
    influencerLimit: 4,
    colorTrendLimit: Number.POSITIVE_INFINITY,
    includeStyleMovement: true,
    culturalNotesLimit: Number.POSITIVE_INFINITY,
    colorForecastLimit: Number.POSITIVE_INFINITY,
    includeInfluencerSpotlight: true,
    includeColorForecastTip: true,
    includeEarlyAccessTip: true,
  };
}
