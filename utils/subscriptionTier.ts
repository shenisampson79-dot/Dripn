import type { SubscriptionTier } from '@/contexts/AuthContext';
import { TIER_MATRIX, type BillingPlanId } from '@/utils/tierMatrix';

export type { BillingPlanId };

/** Map any plan/tier string to the 3 canonical feature tiers */
const TIER_ALIASES: Record<string, SubscriptionTier> = {
  free: 'free',

  // Middle tier — formerly Style Chat ($9.99 / style_chat)
  personal_stylist: 'personal_stylist',
  subscription: 'personal_stylist',
  style_chat: 'personal_stylist',
  style_chat_monthly: 'personal_stylist',
  style_chat_yearly: 'personal_stylist',
  style_chat_plan: 'personal_stylist',
  styleChatMonthly: 'personal_stylist',
  styleChatYearly: 'personal_stylist',

  // Top tier — merged Personal Stylist ($14.99) + Stylist Unlimited ($19.99)
  stylist_unlimited: 'stylist_unlimited',
  premium: 'stylist_unlimited',
  pro: 'stylist_unlimited',
  personal_stylist_monthly: 'stylist_unlimited',
  personal_stylist_yearly: 'stylist_unlimited',
  personalStylistMonthly: 'stylist_unlimited',
  personalStylistYearly: 'stylist_unlimited',
  stylist_unlimited_monthly: 'stylist_unlimited',
  stylist_unlimited_yearly: 'stylist_unlimited',
  stylistUnlimitedMonthly: 'stylist_unlimited',
  stylistUnlimitedYearly: 'stylist_unlimited',
  vip: 'stylist_unlimited',
  core: 'stylist_unlimited',
  core_wardrobe: 'stylist_unlimited',
  lite: 'stylist_unlimited',
  outfit_setup: 'stylist_unlimited',
};

/** UI tier → Stripe checkout plan ID */
export const TIER_TO_BILLING_PLAN: Record<SubscriptionTier, BillingPlanId> = {
  free: 'free',
  personal_stylist: 'style_chat',
  stylist_unlimited: 'stylist_unlimited',
};

export const BILLING_PLAN_DISPLAY: Record<BillingPlanId, string> = {
  free: 'Free',
  style_chat: 'Personal Stylist',
  stylist_unlimited: 'Stylist Unlimited',
};

export function normalizeSubscriptionTier(tier?: string | null): SubscriptionTier {
  if (!tier) return 'free';
  const key = tier.trim().toLowerCase();
  return TIER_ALIASES[key] ?? TIER_ALIASES[tier] ?? 'free';
}

export function tierToBillingPlan(tier: SubscriptionTier): BillingPlanId {
  return TIER_TO_BILLING_PLAN[tier] ?? 'free';
}

export function getBillingPlanDisplayName(planOrTier?: string | null): string {
  if (!planOrTier) return TIER_MATRIX.free.displayName;
  if (planOrTier in BILLING_PLAN_DISPLAY) {
    return BILLING_PLAN_DISPLAY[planOrTier as BillingPlanId];
  }
  return getTierFeaturesDisplayName(planOrTier);
}

export function getTierFeaturesDisplayName(tier?: string | null): string {
  return TIER_MATRIX[normalizeSubscriptionTier(tier)].displayName;
}

export function isPaidTier(tier?: string | null): boolean {
  return normalizeSubscriptionTier(tier) !== 'free';
}

export function isTopTier(tier?: string | null): boolean {
  return normalizeSubscriptionTier(tier) === 'stylist_unlimited';
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  personal_stylist: 1,
  stylist_unlimited: 2,
};

/** Prefer the higher feature tier (never let a stale free backend wipe a paid local unlock). */
export function preferHigherSubscriptionTier(
  a?: string | null,
  b?: string | null,
): SubscriptionTier {
  const left = normalizeSubscriptionTier(a);
  const right = normalizeSubscriptionTier(b);
  return TIER_RANK[left] >= TIER_RANK[right] ? left : right;
}
