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
      return 'Try a Styling Sprint once with your plan — 5–7 looks for your next trip or event.';
    case 'full_wardrobe_setup':
      return 'Try Full Wardrobe Setup once — quick start or full digitise, then pay for more.';
    default:
      return 'One included stylist setup with Personal Stylist or Stylist Unlimited.';
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
