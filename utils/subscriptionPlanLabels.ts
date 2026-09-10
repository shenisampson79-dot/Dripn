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

/**
 * Display-only billing label. Unresolved authenticated hydration must not
 * coerce missing/local-unknown tier to Free (cold-launch flash).
 */
export function resolveSubscriptionDisplayLabel(opts: {
  subscriptionTier?: string | null;
  billingResolved: boolean;
  t?: (key: string) => string;
}): string {
  if (!opts.billingResolved) return '';
  return resolvePlanDisplayName(opts.subscriptionTier, opts.t);
}

export function getHydratingSubscriptionSubtitle(
  tier: string | null | undefined,
  billingResolved: boolean,
  t: (key: string) => string,
): string {
  const planName = resolveSubscriptionDisplayLabel({
    subscriptionTier: tier,
    billingResolved,
    t,
  });
  if (!planName) return '';
  const planWord = t('settings.plan') || 'Plan';
  return `${planName} ${planWord}`.trim();
}

/** Cold-start display frames: process start → cached user → /me. */
export function coldLaunchSubscriptionLabelSequence(opts: {
  localTier?: string | null;
  meTier: string;
}): string[] {
  return [
    resolveSubscriptionDisplayLabel({
      subscriptionTier: undefined,
      billingResolved: false,
    }),
    resolveSubscriptionDisplayLabel({
      subscriptionTier: opts.localTier,
      billingResolved: false,
    }),
    resolveSubscriptionDisplayLabel({
      subscriptionTier: opts.meTier,
      billingResolved: true,
    }),
  ];
}
