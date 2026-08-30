import type { SubscriptionTier } from '@/contexts/AuthContext';
import { getAiAllowancePaywallCopy } from '@/utils/aiBudgetError';
import { getTierFeatures, tierHasUnlimitedDecisions } from '@/utils/tierMatrix';
import { normalizeSubscriptionTier } from '@/utils/subscriptionTier';

export interface DecisionAccessEvaluation {
  canMakeDecision: boolean;
  reason?: string;
}

export interface DecisionPaywallCopy {
  headline: string;
  body: string;
  cta: string;
}

const FREE_DAILY_DECISION_REASON =
  "That's your decision for today. Upgrade to Personal Stylist for more outfit decisions.";

/** Local daily Decision gate — sync evaluation for guards and tests. */
export function evaluateLocalDecisionAccess(
  tier: SubscriptionTier | string | null | undefined,
  decisionsToday: number,
): DecisionAccessEvaluation {
  const normalized = normalizeSubscriptionTier(tier);
  const features = getTierFeatures(normalized);
  const unlimited = tierHasUnlimitedDecisions(normalized);
  const dailyCap = unlimited ? null : (features.decisionsPerDay as number);
  const canMakeDecision = unlimited || decisionsToday < dailyCap!;
  return {
    canMakeDecision,
    reason: canMakeDecision ? undefined : FREE_DAILY_DECISION_REASON,
  };
}

/** Unlimited tiers must never be blocked by stale local Free access state. */
export function canSubmitDecisionAtGuard(
  tier: SubscriptionTier | string | null | undefined,
  accessStatus: { canMakeDecision: boolean } | null,
): boolean {
  if (tierHasUnlimitedDecisions(normalizeSubscriptionTier(tier))) return true;
  return accessStatus?.canMakeDecision !== false;
}

/** Clear latched upgrade modal once access re-evaluates to allowed. */
export function resolveDecisionUpgradeModalVisible(
  canMakeDecision: boolean,
  showPaywallIfBlocked: boolean | undefined,
): boolean {
  if (canMakeDecision) return false;
  return showPaywallIfBlocked !== false;
}

/** Tier-aware Decision paywall — never upsell Personal Stylist to existing PS subscribers. */
export function getDecisionPaywallCopy(
  tier?: SubscriptionTier | string | null,
  reason?: string,
): DecisionPaywallCopy {
  const normalized = normalizeSubscriptionTier(tier);
  if (normalized === 'free') {
    return {
      headline: 'Stop overthinking outfits.',
      body: reason || FREE_DAILY_DECISION_REASON,
      cta: 'Upgrade to Personal Stylist',
    };
  }
  const allowance = getAiAllowancePaywallCopy(normalized);
  return {
    headline: allowance.title,
    body: reason || allowance.message,
    cta: allowance.primaryLabel,
  };
}
