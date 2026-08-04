import type { SubscriptionTier } from '@/contexts/AuthContext';

/**
 * Single source of truth for plan display names.
 * Internal tier id `stylist_unlimited` must always show as Stylist Pro in UI.
 */
export const PLAN_DISPLAY_NAME = {
  free: 'Free',
  personal_stylist: 'Personal Stylist',
  stylist_unlimited: 'Stylist Pro',
} as const satisfies Record<SubscriptionTier, string>;

/** Canonical top-tier product name — never show "Stylist Unlimited". */
export const STYLIST_PRO_PLAN_NAME = PLAN_DISPLAY_NAME.stylist_unlimited;

const LEGACY_TOP_TIER_NAME = /stylist\s*unlimited/gi;

/** Replace any leftover "Stylist Unlimited" with Stylist Pro. */
export function sanitizePlanDisplayName(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  return name.replace(LEGACY_TOP_TIER_NAME, STYLIST_PRO_PLAN_NAME).trim();
}

export function getCanonicalPlanDisplayName(tier: SubscriptionTier): string {
  return PLAN_DISPLAY_NAME[tier];
}
