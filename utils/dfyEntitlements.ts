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
      return "We've saved a Styling Sprint for you — a handful of looks for that trip or event you've got coming up.";
    case 'full_wardrobe_setup':
      return "We've saved this for you — quick start or full digitise, let's get your wardrobe working for real life.";
    default:
      return 'Your stylist can set up your wardrobe for you — included with Personal Stylist or Stylist Unlimited.';
  }
}

/** Active styling window for a subscriber's included activation. */
export function getIncludedStylingWindowDays(
  subscriptionTier: string | null | undefined,
  dfyTier: DFYTier,
): number {
  const benefit = getDfyBenefitForSubscription(subscriptionTier);
  if (benefit === 'full_wardrobe_setup') return 30;
  if (benefit === 'styling_sprint') return 14;
  return dfyTier === 'lite' ? 14 : 30;
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

export function getDfyPathDescription(
  tier: DFYTier,
  benefit: DfySubscriptionBenefit = 'none',
): string {
  if (tier === 'lite') {
    const windowLabel =
      benefit === 'full_wardrobe_setup' ? '30-day styling window' : '14-day styling sprint';
    return `5–7 outfit photos · fast win · ${windowLabel}`;
  }
  return 'Up to 30 items · wardrobe saved forever · 30-day active styling';
}

export function subscriptionTierDisplayName(tier?: SubscriptionTier | string | null): string {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'personal_stylist') return 'Personal Stylist';
  if (normalized === 'stylist_unlimited') return 'Stylist Unlimited';
  return 'Free';
}
