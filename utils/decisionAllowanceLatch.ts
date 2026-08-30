/**
 * Decision submit error classification — monthly allowance latch must only
 * engage on confirmed AI budget exhaustion, not broad 429 / daily limits.
 */
import { isAiBudgetError } from '@/utils/aiBudgetError';

type SubmitErr = {
  message?: string;
  error?: string;
  errorCode?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  limitCopy?: { message?: string; cta?: string };
};

function errorCodes(err: SubmitErr): string {
  return `${err.errorCode || ''} ${err.error || ''} ${err.code || ''}`.toLowerCase();
}

/** Server/client daily Decision cap — not monthly AI budget. */
export function isDecisionDailyLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as SubmitErr;
  if (errorCodes(e).includes('daily_limit')) return true;
  const msg = String(e.limitCopy?.message || e.message || '').toLowerCase();
  return msg.includes('your decision for today');
}

/** Confirmed monthly AI allowance exhaustion — safe to latch allowanceBlocked. */
export function shouldLatchMonthlyAllowanceBlocked(err: unknown): boolean {
  if (isDecisionDailyLimitError(err)) return false;
  return isAiBudgetError(err);
}

/** Transient HTTP 429 that is neither monthly budget nor daily Decision limit. */
export function isGenericDecisionRateLimit(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as SubmitErr;
  const status = Number(e.status ?? e.statusCode);
  if (status !== 429) return false;
  return !shouldLatchMonthlyAllowanceBlocked(err) && !isDecisionDailyLimitError(err);
}
