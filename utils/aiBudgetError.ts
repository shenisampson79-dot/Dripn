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

/** In-chat copy when stylist AI monthly allowance is spent — conversion, not a network error. */
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

  const unlockLines = [
    '• Unlimited outfit advice',
    '• Wardrobe-aware recommendations',
    '• Instant answers when you need them',
  ].join('\n');

  if (isFree) {
    if (isMale) {
      return `You've used your free monthly allowance — so ${name} has to pause for now.\n\nUpgrade to Personal Stylist to keep getting:\n${unlockLines}\n\nTap See plans to continue now. After you upgrade, I'll retry your last question automatically.`;
    }
    if (isAce) {
      return `You've used your free monthly allowance, so I have to pause for now.\n\nUpgrade to Personal Stylist to keep getting:\n${unlockLines}\n\nTap See plans to continue now. After you upgrade, I'll retry your last question automatically.`;
    }
    return `You've used your free monthly allowance, gorgeous — so ${name} has to pause for now.\n\nUpgrade to Personal Stylist to keep getting:\n${unlockLines}\n\nTap See plans to continue now. After you upgrade, I'll retry your last question automatically.`;
  }

  if (isMale) {
    return `You've hit your monthly AI allowance for this plan — so ${name} has to pause.\n\nUpgrade for a bigger pot, or buy more AI credit in Settings, to keep getting outfit advice instantly. After you top up, I'll retry your last question.`;
  }
  if (isAce) {
    return `You've hit your monthly AI allowance for this plan, so I have to pause.\n\nUpgrade for a bigger allowance, or buy more AI credit in Settings, to keep getting outfit advice instantly. After you top up, I'll retry your last question.`;
  }
  return `You've hit your monthly AI allowance for this plan, darling — so ${name} has to pause.\n\nUpgrade for a bigger pot, or buy more AI credit in Settings, to keep getting outfit advice instantly. After you top up, I'll retry your last question.`;
}
