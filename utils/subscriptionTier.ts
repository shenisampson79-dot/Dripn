import type { SubscriptionTier } from '@/contexts/AuthContext';

/** Canonical Stripe plan IDs */
export type BillingPlanId =
  | 'style_chat'
  | 'personal_stylist'
  | 'stylist_unlimited'
  | 'core_wardrobe'
  | 'outfit_setup';

/** Map any plan/tier string to frontend feature tier */
const TIER_ALIASES: Record<string, SubscriptionTier> = {
  free: 'free',
  style_chat: 'subscription',
  personal_stylist: 'premium',
  stylist_unlimited: 'pro',
  core_wardrobe: 'pro',
  outfit_setup: 'premium',
  subscription: 'subscription',
  premium: 'premium',
  pro: 'pro',
  style_chat_monthly: 'subscription',
  style_chat_yearly: 'subscription',
  style_chat_plan: 'subscription',
  styleChatMonthly: 'subscription',
  styleChatYearly: 'subscription',
  personal_stylist_monthly: 'premium',
  personal_stylist_yearly: 'premium',
  personalStylistMonthly: 'premium',
  personalStylistYearly: 'premium',
  stylist_unlimited_monthly: 'pro',
  stylist_unlimited_yearly: 'pro',
  stylistUnlimitedMonthly: 'pro',
  stylistUnlimitedYearly: 'pro',
  vip: 'pro',
  core: 'pro',
  lite: 'premium',
};

/** UI tier → Stripe checkout plan ID */
export const TIER_TO_BILLING_PLAN: Record<SubscriptionTier, BillingPlanId | 'free'> = {
  free: 'free',
  subscription: 'style_chat',
  premium: 'personal_stylist',
  pro: 'stylist_unlimited',
};

export const BILLING_PLAN_DISPLAY: Record<BillingPlanId, string> = {
  style_chat: 'Style Chat',
  personal_stylist: 'Personal Stylist',
  stylist_unlimited: 'Stylist Unlimited',
  core_wardrobe: 'Core Wardrobe Setup',
  outfit_setup: 'Outfit-Based Setup',
};

export function normalizeSubscriptionTier(tier?: string | null): SubscriptionTier {
  if (!tier) return 'free';
  return TIER_ALIASES[tier] ?? 'free';
}

export function tierToBillingPlan(tier: SubscriptionTier): BillingPlanId | 'free' {
  return TIER_TO_BILLING_PLAN[tier] ?? 'free';
}

export function getBillingPlanDisplayName(planOrTier?: string | null): string {
  if (!planOrTier) return 'Free';
  if (planOrTier in BILLING_PLAN_DISPLAY) {
    return BILLING_PLAN_DISPLAY[planOrTier as BillingPlanId];
  }
  const tier = normalizeSubscriptionTier(planOrTier);
  switch (tier) {
    case 'pro': return 'Stylist Unlimited';
    case 'premium': return 'Personal Stylist';
    case 'subscription': return 'Style Chat';
    default: return 'Free';
  }
}
