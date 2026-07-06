import type { SubscriptionTier } from '@/contexts/AuthContext';
import type { DFYTier } from '@/services/DFYService';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';

/** What the subscription markets as one included DFY benefit (not two SKUs). */
export type DfySubscriptionBenefit = 'none' | 'styling_sprint' | 'full_wardrobe_setup';

export function getDfyBenefitForSubscription(tier?: string | null): DfySubscriptionBenefit {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'personal_stylist') return 'styling_sprint';
  if (normalized === 'stylist_unlimited') return 'full_wardrobe_setup';
  return 'none';
}

export function getDfyBenefitTitle(benefit: DfySubscriptionBenefit): string {
  switch (benefit) {
    case 'styling_sprint':
      return 'Styling Sprint';
    case 'full_wardrobe_setup':
      return 'Full Wardrobe Setup';
    default:
      return 'Done-For-You Setup';
  }
}

export function getDfyBenefitSubtitle(benefit: DfySubscriptionBenefit): string {
  switch (benefit) {
    case 'styling_sprint':
      return '5–7 ready-to-wear looks for your next trip or event (14-day styling window).';
    case 'full_wardrobe_setup':
      return 'Digitise your wardrobe and remix outfits — choose a quick start or full setup.';
    default:
      return 'Included with Personal Stylist and Stylist Unlimited.';
  }
}

/** Whether this DFY path is allowed for the subscriber's included benefit. */
export function isDfyTierAllowedForSubscription(
  subscriptionTier: string | null | undefined,
  dfyTier: DFYTier,
): boolean {
  const benefit = getDfyBenefitForSubscription(subscriptionTier);
  if (benefit === 'none') return false;
  if (benefit === 'styling_sprint') return dfyTier === 'lite';
  return dfyTier === 'lite' || dfyTier === 'core';
}

export function getCurrentDfyActivationPeriodKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** First day of next calendar month — when the included activation resets. */
export function getNextIncludedActivationResetDate(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function formatIncludedActivationResetLabel(date = new Date()): string {
  return getNextIncludedActivationResetDate(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

export function getDfyPathLabel(tier: DFYTier): string {
  return tier === 'lite' ? 'Quick Start' : 'Full Setup';
}

export function getDfyPathDescription(tier: DFYTier): string {
  if (tier === 'lite') {
    return '5–7 outfit photos · fast win · 14-day styling sprint';
  }
  return 'Up to 30 items · wardrobe saved forever · 30-day active styling';
}

export function subscriptionTierDisplayName(tier?: SubscriptionTier | string | null): string {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'personal_stylist') return 'Personal Stylist';
  if (normalized === 'stylist_unlimited') return 'Stylist Unlimited';
  return 'Free';
}
