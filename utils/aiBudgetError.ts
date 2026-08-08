/** Detect monthly AI usage-limit errors from live / scan / stylist chat API responses. */

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

/** In-chat copy when stylist AI monthly allowance is spent — conversion, not a network snag. */
export function stylistMonthlyAllowanceMessage(args: {
  stylistName: string;
  stylistId?: string;
  tier?: string | null;
}): string {
  const name = String(args.stylistName || 'your stylist').trim() || 'your stylist';
  const isMale = String(args.stylistId || '').toLowerCase() === 'max';
  const isAce = String(args.stylistId || '').toLowerCase() === 'ace';
  const tier = String(args.tier || 'free').toLowerCase();
  const isFree = !tier || tier === 'free';

  if (isFree) {
    if (isMale) {
      return `You've used 100% of your monthly AI allowance — that's the Free plan cap, not a connection blip. Upgrade to Personal Stylist for a bigger allowance so ${name} can keep helping you. Tap See plans below, or open Settings → Subscription.`;
    }
    if (isAce) {
      return `You've used 100% of your monthly AI allowance. That is a Free plan limit, not a temporary glitch. Upgrade to Personal Stylist for a bigger allowance so we can keep going. Tap See plans, or open Settings → Subscription.`;
    }
    return `You've used 100% of your monthly AI allowance, gorgeous — that's your Free plan limit, not a connection problem. Upgrade to Personal Stylist for a bigger allowance so ${name} can keep styling with you. Tap See plans, or open Settings → Subscription.`;
  }

  if (isMale) {
    return `You've used 100% of your monthly AI allowance for this plan. Upgrade for a bigger pot, or buy more AI credit in Settings so ${name} can keep going.`;
  }
  if (isAce) {
    return `You've used 100% of your monthly AI allowance for this plan. Upgrade for a bigger allowance, or buy more AI credit in Settings to continue.`;
  }
  return `You've used 100% of your monthly AI allowance for this plan, darling. Upgrade for a bigger pot, or buy more AI credit in Settings so ${name} can keep helping you.`;
}
