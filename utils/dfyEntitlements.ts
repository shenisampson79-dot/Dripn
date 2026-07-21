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
      return 'Travel Capsule';
    case 'full_wardrobe_setup':
      return 'Full Wardrobe Setup';
    default:
      return 'Done-For-You Setup';
  }
}

export function getDfyBenefitSubtitle(benefit: DfySubscriptionBenefit): string {
  switch (benefit) {
    case 'styling_sprint':
      return "We've saved Travel Capsule for you — a packed wardrobe and 14 looks for your next trip.";
    case 'full_wardrobe_setup':
      return "Your plan includes one setup — choose Travel Capsule for a trip, or Full Setup to digitise your whole closet.";
    default:
      return 'Your stylist can set up your wardrobe for you — included with Personal Stylist or Stylist Unlimited.';
  }
}

/** Hero copy when the user already has an active styling window. */
export function getDfyActiveWindowSubtitle(tier: DFYTier): string {
  if (tier === 'lite') {
    return "You're in your Travel Capsule window — pick up where you left off and keep your trip looks coming.";
  }
  return "You're in your Full Setup styling window — pick up where you left off and keep digitising your wardrobe.";
}

export function formatDfyDaysRemaining(daysRemaining: number, windowDays: number): string {
  if (windowDays > 0) {
    return `${daysRemaining} of ${windowDays} day${windowDays === 1 ? '' : 's'} left`;
  }
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
}

/** Active styling window for a subscriber's included activation. */
export function getIncludedStylingWindowDays(
  subscriptionTier: string | null | undefined,
  dfyTier: DFYTier,
): number {
  // Path length is defined by DFY tier, not subscription marketing tier
  if (dfyTier === 'lite') return 14;
  if (dfyTier === 'core') return 30;
  const benefit = getDfyBenefitForSubscription(subscriptionTier);
  if (benefit === 'full_wardrobe_setup') return 30;
  if (benefit === 'styling_sprint') return 14;
  return 14;
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
  return tier === 'lite' ? 'Travel Capsule' : 'Full Setup';
}

/** Title for the user's currently active DFY path (not the subscription marketing benefit name). */
export function getDfyActivePathTitle(tier: DFYTier): string {
  return getDfyPathLabel(tier);
}

export type DfyCoreFeature = 'swap_item' | 'remix';

export function getDfyCoreFeaturePaywallCopy(
  feature: DfyCoreFeature,
  onQuickStart: boolean,
): { title: string; description: string; cta: string } {
  if (onQuickStart) {
    if (feature === 'swap_item') {
      return {
        title: "Travel Capsule doesn't include swap",
        description:
          'Swapping items needs your full wardrobe mapped. Upgrade to Full Setup to remix pieces your way.',
        cta: 'Upgrade to Full Setup',
      };
    }
    return {
      title: "Travel Capsule doesn't include remix",
      description:
        'Remixing outfits needs your full wardrobe in the system. Upgrade to Full Setup for unlimited combinations.',
      cta: 'Upgrade to Full Setup',
    };
  }
  if (feature === 'swap_item') {
    return {
      title: 'Unlock Full Setup',
      description:
        'Swapping individual items requires your full wardrobe mapped. With Full Setup, I can break down every piece and rebuild outfits your way.',
      cta: 'Start Full Setup',
    };
  }
  return {
    title: 'Unlock Full Setup',
    description:
      'Creating remixes needs your full wardrobe in the system. Full Setup gives you unlimited combinations from all your pieces.',
    cta: 'Start Full Setup',
  };
}

export function getDfyPathDescription(
  tier: DFYTier,
  benefit: DfySubscriptionBenefit = 'none',
): string {
  if (tier === 'lite') {
    if (benefit === 'styling_sprint' || benefit === 'full_wardrobe_setup') {
      return 'Pack smart — a travel capsule and 14 destination looks';
    }
    return 'Pack less, look sorted — weather-aware looks for your trip';
  }
  if (benefit === 'full_wardrobe_setup') {
    return 'Dress with ease — your whole closet, organised and styled';
  }
  return 'Save time every morning — your wardrobe, working for you';
}

export function subscriptionTierDisplayName(tier?: SubscriptionTier | string | null): string {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'personal_stylist') return 'Personal Stylist';
  if (normalized === 'stylist_unlimited') return 'Stylist Unlimited';
  return 'Free';
}
