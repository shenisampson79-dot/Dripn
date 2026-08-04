import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';

const TIER_I18N_KEYS: Record<string, string> = {
  free: 'subscription.plan.free.name',
  personal_stylist: 'subscription.plan.personalStylist.name',
  stylist_unlimited: 'subscription.plan.stylistUnlimited.name',
};

/** Localized plan name + optional "Plan" suffix for Settings subtitle. */
export function getLocalizedSubscriptionSubtitle(
  tier: string | null | undefined,
  t: (key: string) => string,
): string {
  const normalized = normalizeSubscriptionTier(tier);
  const planName =
    t(`subscription.tier.${normalized}`) ||
    t(TIER_I18N_KEYS[normalized]) ||
    (normalized === 'personal_stylist'
      ? 'Personal Stylist'
      : normalized === 'stylist_unlimited'
        ? 'Stylist Pro'
        : 'Free');
  const planWord = t('settings.plan') || 'Plan';
  return `${planName} ${planWord}`.trim();
}
