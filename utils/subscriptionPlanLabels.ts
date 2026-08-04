import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import {
  getCanonicalPlanDisplayName,
  sanitizePlanDisplayName,
} from '@/utils/planDisplayNames';

const TIER_I18N_KEYS: Record<string, string> = {
  free: 'subscription.plan.free.name',
  personal_stylist: 'subscription.plan.personalStylist.name',
  stylist_unlimited: 'subscription.plan.stylistUnlimited.name',
};

/** Localized plan name; never surfaces legacy "Stylist Unlimited". */
export function resolvePlanDisplayName(
  tier: string | null | undefined,
  t?: (key: string) => string,
): string {
  const normalized = normalizeSubscriptionTier(tier);
  const canonical = getCanonicalPlanDisplayName(normalized);
  if (!t) return canonical;
  const fromT =
    t(`subscription.tier.${normalized}`) ||
    t(TIER_I18N_KEYS[normalized]) ||
    '';
  return sanitizePlanDisplayName(fromT) || canonical;
}

/** Localized plan name + optional "Plan" suffix for Settings subtitle. */
export function getLocalizedSubscriptionSubtitle(
  tier: string | null | undefined,
  t: (key: string) => string,
): string {
  const planName = resolvePlanDisplayName(tier, t);
  const planWord = t('settings.plan') || 'Plan';
  return `${planName} ${planWord}`.trim();
}
