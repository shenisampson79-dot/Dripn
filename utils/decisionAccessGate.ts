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

export interface DecisionAccessSnapshot {
  canMakeDecision: boolean;
  reason?: string;
}

export const FREE_DAILY_DECISION_REASON =
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

/** Unlimited tiers must never carry stale Free daily access snapshots. */
export function sanitizeDecisionAccessStatus<T extends DecisionAccessSnapshot | null>(
  tier: SubscriptionTier | string | null | undefined,
  status: T,
): T {
  if (!status) return status;
  if (!tierHasUnlimitedDecisions(normalizeSubscriptionTier(tier))) return status;
  return {
    ...status,
    canMakeDecision: true,
    reason: undefined,
  };
}

/** Unlimited tiers must never be blocked by stale local Free access state. */
export function canSubmitDecisionAtGuard(
  tier: SubscriptionTier | string | null | undefined,
  accessStatus: { canMakeDecision: boolean } | null,
  authReady = true,
): boolean {
  if (!authReady) return true;
  if (tierHasUnlimitedDecisions(normalizeSubscriptionTier(tier))) return true;
  return accessStatus?.canMakeDecision !== false;
}

/** Daily Decision paywall applies to Free only — never PS / Pro. */
export function isDailyDecisionPaywallTier(
  tier: SubscriptionTier | string | null | undefined,
): boolean {
  return !tierHasUnlimitedDecisions(normalizeSubscriptionTier(tier));
}

/** Clear latched upgrade modal once access re-evaluates allowed or tier is unlimited. */
export function resolveDecisionUpgradeModalVisible(
  canMakeDecision: boolean,
  showPaywallIfBlocked: boolean | undefined,
  tier?: SubscriptionTier | string | null,
  authReady = true,
): boolean {
  if (!authReady) return false;
  if (!isDailyDecisionPaywallTier(tier)) return false;
  if (canMakeDecision) return false;
  return showPaywallIfBlocked !== false;
}

/** Presentation gate — suppress stale latched modal state for unlimited tiers / auth hydrate. */
export function shouldShowDecisionUpgradeModal(
  showUpgradeModal: boolean,
  tier: SubscriptionTier | string | null | undefined,
  authReady = true,
): boolean {
  if (!showUpgradeModal) return false;
  if (!authReady) return false;
  return isDailyDecisionPaywallTier(tier);
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

/** Modal copy — ignore stale Free daily reason when resolved tier is unlimited. */
export function getDecisionPaywallModalCopy(
  tier: SubscriptionTier | string | null | undefined,
  accessStatus: { reason?: string } | null,
): DecisionPaywallCopy {
  const normalized = normalizeSubscriptionTier(tier);
  if (!isDailyDecisionPaywallTier(normalized)) {
    return getDecisionPaywallCopy(normalized);
  }
  return getDecisionPaywallCopy(normalized, accessStatus?.reason);
}
