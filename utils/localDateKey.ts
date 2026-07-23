/**
 * Local calendar YYYY-MM-DD (not UTC via toISOString).
 * Today's Outfit cache / dismiss / history must follow the user's day.
 */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Inclusive lookback window for soft anti-repeat (recommended / worn). */
export const TODAYS_OUTFIT_ANTI_REPEAT_DAYS = 7;
