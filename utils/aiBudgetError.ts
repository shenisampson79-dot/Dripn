/** Detect monthly AI usage-limit errors from live / scan / stylist chat API responses. */

import { isTopTier, normalizeSubscriptionTier } from '@/utils/subscriptionTier';

export function isAiBudgetError(err: unknown): boolean {
  if (!err) return false;
  const e = err as {
    message?: string;
    error?: string;
    errorCode?: string;
    code?: string;
    status?: number;
    statusCode?: number;
  };
  const code = `${e.errorCode || ''} ${e.error || ''} ${e.code || ''}`.toLowerCase();
  if (/monthly_budget|rembg_.?limit|chat_monthly_limit|usage_limit|ai_budget/.test(code)) return true;
  const msg = String(e.message || (typeof err === 'string' ? err : '')).toLowerCase();
  if (
    /you've reached your plan|usage limit for this month|plan's usage|monthly.?budget|ai budget|allotted|monthly ai allowance|of monthly ai allowance/.test(
      msg,
    )
  ) {
    return true;
  }
  // 429 alone is ambiguous (rate limit vs budget) — only treat as budget when copy hints at a plan/month.
  const status = Number(e.status ?? e.statusCode);
  if (
    status === 429
    && /month|plan|upgrade|allowance|budget|usage limit|allotted/.test(msg)
  ) {
    return true;
  }
  return false;
}

export type AiAllowanceCta = 'upgrade' | 'topup' | 'dismiss';

export type AiAllowancePaywallCopy = {
  title: string;
  message: string;
  /** Soft warn (~90%) banner / alert when still under hard cap. */
  softTitle: string;
  softMessage: string;
  primaryLabel: string;
  primaryAction: AiAllowanceCta;
  secondaryLabel: string;
};

/**
 * Tier-aware monthly AI allowance copy.
 * Free → upgrade to Personal Stylist.
 * Personal Stylist → upgrade to Pro and/or buy credit.
 * Stylist Pro (top) → buy credit only (never "upgrade" / never "unlimited").
 */
export function getAiAllowancePaywallCopy(tier?: string | null): AiAllowancePaywallCopy {
  const normalized = normalizeSubscriptionTier(tier);
  const top = isTopTier(normalized);

  if (top) {
    return {
      title: "That's your lot for this month",
      message:
        "You've used this month's AI allowance. Buy more AI credit to keep using Live, chat, Get outfits, and decisions — you're already on Stylist Pro.",
      softTitle: "You're close to this month's AI limit",
      softMessage:
        "You've used most of this month's AI allowance. Buy more credit anytime so Live and chat don't pause mid-flow.",
      primaryLabel: 'Buy more credit',
      primaryAction: 'topup',
      secondaryLabel: 'Maybe later',
    };
  }

  if (normalized === 'personal_stylist') {
    return {
      title: "That's your lot for this month",
      message:
        "You've used this month's AI allowance. Upgrade to Stylist Pro for a bigger included pot, or buy more AI credit to keep going on your current plan.",
      softTitle: "You're close to this month's AI limit",
      softMessage:
        "You've used most of this month's AI allowance. Upgrade to Stylist Pro for a bigger pot, or buy more credit to keep going.",
      primaryLabel: 'See plans',
      primaryAction: 'upgrade',
      secondaryLabel: 'Buy more credit',
    };
  }

  return {
    title: "That's your lot for this month",
    message:
      "You've used your free monthly AI allowance. Upgrade to Personal Stylist for a bigger monthly pot, wardrobe-aware picks, and more chat — then try again.",
    softTitle: "You're close to your free monthly limit",
    softMessage:
      "Upgrade to Personal Stylist for a bigger monthly pot so outfit advice doesn't pause mid-chat.",
    primaryLabel: 'See plans',
    primaryAction: 'upgrade',
    secondaryLabel: 'Maybe later',
  };
}

/** Params for navigateToSubscription after an allowance block. */
export function aiAllowanceSubscriptionParams(
  tier: string | null | undefined,
  source: string,
): { source: string; asPaywall: true; scrollToAiTopUp: boolean; highlightPlan?: string } {
  const paywall = getAiAllowancePaywallCopy(tier);
  const normalized = normalizeSubscriptionTier(tier);
  return {
    source,
    asPaywall: true,
    scrollToAiTopUp: paywall.primaryAction === 'topup',
    highlightPlan:
      paywall.primaryAction === 'upgrade'
        ? (normalized === 'personal_stylist' ? 'stylist_unlimited' : 'personal_stylist')
        : undefined,
  };
}

/** In-chat copy when stylist AI monthly allowance is spent — conversion, not a network error. */
export function stylistMonthlyAllowanceMessage(args: {
  stylistName: string;
  stylistId?: string;
  tier?: string | null;
}): string {
  const name = String(args.stylistName || 'your stylist').trim() || 'your stylist';
  const isMale = String(args.stylistId || '').toLowerCase() === 'max';
  const isAce = String(args.stylistId || '').toLowerCase() === 'ace';
  const paywall = getAiAllowancePaywallCopy(args.tier);
  const normalized = normalizeSubscriptionTier(args.tier);

  if (normalized === 'free') {
    const unlockLines = [
      '• A bigger monthly AI pot',
      '• Wardrobe-aware recommendations',
      '• Faster answers when you need them',
    ].join('\n');
    if (isMale) {
      return `You've used your free monthly allowance — so ${name} has to pause for now.\n\nUpgrade to Personal Stylist to keep getting:\n${unlockLines}\n\nTap See plans to continue. After you upgrade, I'll retry your last question automatically.`;
    }
    if (isAce) {
      return `You've used your free monthly allowance, so I have to pause for now.\n\nUpgrade to Personal Stylist to keep getting:\n${unlockLines}\n\nTap See plans to continue. After you upgrade, I'll retry your last question automatically.`;
    }
    return `You've used your free monthly allowance, gorgeous — so ${name} has to pause for now.\n\nUpgrade to Personal Stylist to keep getting:\n${unlockLines}\n\nTap See plans to continue. After you upgrade, I'll retry your last question automatically.`;
  }

  if (isTopTier(normalized)) {
    if (isMale) {
      return `You've hit this month's AI allowance — so ${name} has to pause.\n\n${paywall.message}\n\nTap Buy more credit, then I'll retry your last question.`;
    }
    if (isAce) {
      return `You've hit this month's AI allowance, so I have to pause.\n\n${paywall.message}\n\nTap Buy more credit, then I'll retry your last question.`;
    }
    return `You've hit this month's AI allowance, darling — so ${name} has to pause.\n\n${paywall.message}\n\nTap Buy more credit, then I'll retry your last question.`;
  }

  if (isMale) {
    return `You've hit this month's AI allowance — so ${name} has to pause.\n\n${paywall.message}\n\nAfter you top up or upgrade, I'll retry your last question.`;
  }
  if (isAce) {
    return `You've hit this month's AI allowance, so I have to pause.\n\n${paywall.message}\n\nAfter you top up or upgrade, I'll retry your last question.`;
  }
  return `You've hit this month's AI allowance, darling — so ${name} has to pause.\n\n${paywall.message}\n\nAfter you top up or upgrade, I'll retry your last question.`;
}
