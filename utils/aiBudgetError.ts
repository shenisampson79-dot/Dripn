/** Detect monthly AI usage-limit errors from live / scan API responses. */

export function isAiBudgetError(err: unknown): boolean {
  if (!err) return false;
  const e = err as {
    message?: string;
    error?: string;
    errorCode?: string;
    code?: string;
  };
  const code = `${e.errorCode || ''} ${e.error || ''} ${e.code || ''}`.toLowerCase();
  if (/monthly_budget|rembg_.?limit|chat_monthly_limit|usage_limit/.test(code)) return true;
  const msg = String(e.message || (typeof err === 'string' ? err : '')).toLowerCase();
  if (/you've reached your plan|usage limit for this month|plan's usage|monthly.?budget|ai budget|allotted/.test(msg)) {
    return true;
  }
  return false;
}
