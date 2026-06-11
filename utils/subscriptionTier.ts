import type { SubscriptionTier } from '@/contexts/AuthContext';

const TIER_ALIASES: Record<string, SubscriptionTier> = {
  free: 'free',
  subscription: 'subscription',
  premium: 'premium',
  pro: 'pro',
  style_chat: 'subscription',
  style_chat_monthly: 'subscription',
  style_chat_yearly: 'subscription',
  style_chat_plan: 'subscription',
  styleChatMonthly: 'subscription',
  styleChatYearly: 'subscription',
  personal_stylist: 'premium',
  personal_stylist_monthly: 'premium',
  personal_stylist_yearly: 'premium',
  personalStylistMonthly: 'premium',
  personalStylistYearly: 'premium',
  stylist_unlimited: 'pro',
  stylist_unlimited_monthly: 'pro',
  stylist_unlimited_yearly: 'pro',
  stylistUnlimitedMonthly: 'pro',
  stylistUnlimitedYearly: 'pro',
  vip: 'pro',
};

export function normalizeSubscriptionTier(tier?: string | null): SubscriptionTier {
  if (!tier) return 'free';
  return TIER_ALIASES[tier] ?? 'free';
}
