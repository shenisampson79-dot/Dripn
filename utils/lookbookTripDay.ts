/**
 * Single source of truth for Travel Capsule / Lite lookbook day index.
 * dayNumber / "Today" / progress = f(tripStartDate, today).
 */

export const LOOKBOOK_DEFAULT_TOTAL_DAYS = 14;

/** Local calendar midnight (avoids UTC date-only parse shifting the day). */
export function startOfLocalDay(date: Date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Parse YYYY-MM-DD (or ISO) as a local calendar date. */
export function parseLocalDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

export function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addLocalDays(isoOrDate: string | Date, days: number): string {
  const base = typeof isoOrDate === 'string' ? parseLocalDateOnly(isoOrDate) : startOfLocalDay(isoOrDate);
  if (!base) return formatLocalDateKey(startOfLocalDay());
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return formatLocalDateKey(next);
}

/**
 * 1-based trip day for "today" within a lookbook window.
 * Before start → 1; after end → totalDays.
 */
export function computeLookbookDayNumber(
  startDateIso: string | null | undefined,
  today: Date = new Date(),
  totalDays: number = LOOKBOOK_DEFAULT_TOTAL_DAYS,
): number {
  const start = parseLocalDateOnly(startDateIso);
  if (!start) return 1;
  const now = startOfLocalDay(today);
  const elapsed = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const day = elapsed + 1;
  const cap = Math.max(1, totalDays);
  if (day < 1) return 1;
  if (day > cap) return cap;
  return day;
}

/** Inclusive days left in the lookbook window (Day 3 of 14 → 12). */
export function computeLookbookDaysRemaining(
  startDateIso: string | null | undefined,
  today: Date = new Date(),
  totalDays: number = LOOKBOOK_DEFAULT_TOTAL_DAYS,
): number {
  const current = computeLookbookDayNumber(startDateIso, today, totalDays);
  return Math.max(0, totalDays - current + 1);
}

/** Calendar date for lookbook dayNumber (1-based). */
export function lookbookDateForDay(
  startDateIso: string | null | undefined,
  dayNumber: number,
): Date | null {
  const start = parseLocalDateOnly(startDateIso);
  if (!start) return null;
  const date = new Date(start);
  date.setDate(start.getDate() + Math.max(1, dayNumber) - 1);
  return date;
}
