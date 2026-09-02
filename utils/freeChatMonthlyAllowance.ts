/**
 * Server-authoritative Free Chat remaining (UTC month).
 * Does not invent a second meter — reads monthlyChatCount / chatHardCap
 * already returned by GET /api/usage/ai (publicCostSnapshot).
 */

export type ServerChatUsage = {
  monthlyChatCount?: number | null;
  chatHardCap?: number | null;
};

export type ChatEntitlements = {
  chatMessages?: number | null;
};

export function resolveChatHardCap(
  usage?: ServerChatUsage | null,
  entitlements?: ChatEntitlements | null,
): number | null {
  const fromUsage = usage?.chatHardCap;
  if (typeof fromUsage === 'number' && Number.isFinite(fromUsage) && fromUsage >= 0) {
    return fromUsage;
  }
  const fromEntitlements = entitlements?.chatMessages;
  if (typeof fromEntitlements === 'number' && Number.isFinite(fromEntitlements) && fromEntitlements >= 0) {
    return fromEntitlements;
  }
  return null;
}

export function remainingMonthlyChatActions(
  usage?: ServerChatUsage | null,
  entitlements?: ChatEntitlements | null,
): { remaining: number; cap: number | null; used: number; isHardCapped: boolean } {
  const cap = resolveChatHardCap(usage, entitlements);
  const used = Math.max(0, Number(usage?.monthlyChatCount) || 0);
  if (cap == null) {
    return { remaining: Number.POSITIVE_INFINITY, cap: null, used, isHardCapped: false };
  }
  return {
    remaining: Math.max(0, cap - used),
    cap,
    used,
    isHardCapped: true,
  };
}

export function canSendHardCappedChat(opts: {
  monthlyBudgetExhausted: boolean;
  remaining: number;
  bonusRequests?: number;
}): boolean {
  if (opts.monthlyBudgetExhausted) return false;
  if (!Number.isFinite(opts.remaining)) return true;
  if (opts.remaining > 0) return true;
  return (Number(opts.bonusRequests) || 0) > 0;
}
