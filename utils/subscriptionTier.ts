import type { SubscriptionTier } from '@/contexts/AuthContext';
import { PLAN_DISPLAY_NAME, STYLIST_PRO_PLAN_NAME } from '@/utils/planDisplayNames';
import type { BillingPlanId } from '@/utils/tierMatrix';

export type { BillingPlanId };
export { PLAN_DISPLAY_NAME, STYLIST_PRO_PLAN_NAME };

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

  // Top tier — internal id stylist_unlimited; display name is Stylist Pro
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
  free: PLAN_DISPLAY_NAME.free,
  style_chat: PLAN_DISPLAY_NAME.personal_stylist,
  stylist_unlimited: PLAN_DISPLAY_NAME.stylist_unlimited,
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
  if (!planOrTier) return PLAN_DISPLAY_NAME.free;
  if (planOrTier in BILLING_PLAN_DISPLAY) {
    return BILLING_PLAN_DISPLAY[planOrTier as BillingPlanId];
  }
  return getTierFeaturesDisplayName(planOrTier);
}

export function getTierFeaturesDisplayName(tier?: string | null): string {
  return PLAN_DISPLAY_NAME[normalizeSubscriptionTier(tier)];
}

export function isPaidTier(tier?: string | null): boolean {
  return normalizeSubscriptionTier(tier) !== 'free';
}

function overrideLooksRecognised(tierOverride?: string | null): boolean {
  if (tierOverride == null || String(tierOverride).trim() === '') return false;
  const key = String(tierOverride).trim().toLowerCase();
  if (key === 'free' || key in TIER_ALIASES) return true;
  return TIER_ALIASES[tierOverride] != null;
}

/**
 * Review/tester feature access — never aliases billing `subscriptionTier`.
 * Requires isTester === true AND a recognised override (or server featureTier).
 */
export function effectiveFeatureTierFromTesterOverride(opts: {
  isTester?: boolean | null;
  tierOverride?: string | null;
  billingTier?: string | null;
}): SubscriptionTier {
  const billing = normalizeSubscriptionTier(opts.billingTier);
  if (opts.isTester !== true) return billing;
  if (!overrideLooksRecognised(opts.tierOverride)) return billing;
  return normalizeSubscriptionTier(opts.tierOverride);
}

export function featureAccessTier(user?: {
  subscriptionTier?: string | null;
  featureTier?: string | null;
  isTester?: boolean | null;
  tierOverride?: string | null;
} | null): SubscriptionTier {
  return effectiveFeatureTierFromTesterOverride({
    isTester: user?.isTester,
    tierOverride: user?.tierOverride ?? user?.featureTier,
    billingTier: user?.subscriptionTier,
  });
}

/** /api/auth/me + login hydrate: billing stays billing; featureTier is derived. */
export function applyServerReviewFeatureEntitlement<T extends {
  subscriptionTier?: string | null;
  isTester?: boolean;
  featureTier?: SubscriptionTier;
  tierOverride?: string | null;
}>(
  profile: T,
  source?: Record<string, any> | null,
): T {
  const billing = normalizeSubscriptionTier(profile.subscriptionTier);
  const isTester = source?.isTester === true;
  const featureTier = effectiveFeatureTierFromTesterOverride({
    isTester,
    tierOverride:
      source?.tierOverride
      ?? source?.featureTier
      ?? source?.styleProfile?.tierOverride,
    billingTier: billing,
  });
  return {
    ...profile,
    subscriptionTier: billing,
    isTester,
    featureTier,
    tierOverride: isTester ? (source?.tierOverride ?? profile.tierOverride ?? null) : null,
  };
}

/** Never persist review/billing entitlement through client-controlled profile JSON. */
export function omitClientControlledFeatureEntitlement<T extends Record<string, any>>(
  source?: T | null,
): T | null {
  if (!source || typeof source !== 'object') return source ?? null;
  const {
    subscriptionTier: _billing,
    featureTier: _feature,
    isTester: _tester,
    tierOverride: _override,
    billingPlatform: _platform,
    ...rest
  } = source;
  return rest as T;
}

export function isTopTier(tier?: string | null): boolean {
  return normalizeSubscriptionTier(tier) === 'stylist_unlimited';
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  personal_stylist: 1,
  stylist_unlimited: 2,
};

/** Prefer the higher feature tier (optimistic local upgrades during purchase). */
export function preferHigherSubscriptionTier(
  a?: string | null,
  b?: string | null,
): SubscriptionTier {
  const left = normalizeSubscriptionTier(a);
  const right = normalizeSubscriptionTier(b);
  return TIER_RANK[left] >= TIER_RANK[right] ? left : right;
}

/**
 * Billing truth wins — including free/expired.
 * Only keep a higher local tier when explicitly unlocked (staff Testing Mode).
 */
export function authoritativeBillingTierFromHydrate(opts: {
  serverBillingTier?: string | null;
  profileJsonTier?: string | null;
  localTier?: string | null;
  allowLocalUnlock?: boolean;
}): SubscriptionTier {
  void opts.profileJsonTier;
  return reconcileSubscriptionTier({
    local: opts.localTier,
    remote: opts.serverBillingTier,
    allowLocalUnlock: opts.allowLocalUnlock,
  });
}

export function reconcileSubscriptionTier(opts: {
  local?: string | null;
  remote?: string | null;
  /** Staff / __DEV__ Testing Mode — local Pro unlock may stick. */
  allowLocalUnlock?: boolean;
}): SubscriptionTier {
  const local = normalizeSubscriptionTier(opts.local);
  if (opts.allowLocalUnlock) {
    return preferHigherSubscriptionTier(local, opts.remote);
  }
  if (opts.remote != null && String(opts.remote).trim() !== '') {
    return normalizeSubscriptionTier(opts.remote);
  }
  return local;
}
