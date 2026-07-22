/**
 * Single source of truth for Travel Capsule / Lite lookbook day index.
 * dayNumber / "Today" / progress = f(tripStartDate, today).
 *
 * Hard rule: trip start is never mutated to "today". Calendar dates are a pure
 * projection of lookbook day index onto that immutable trip anchor.
 */

export const LOOKBOOK_DEFAULT_TOTAL_DAYS = 14;

export type TripAnchorSource = {
  travelPlan?: { startDate?: string | null; endDate?: string | null } | null;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * Resolve the trip calendar anchor (YYYY-MM-DD preferred).
 * Prefers travelPlan.startDate → delivery.startDate. Does NOT invent "today".
 */
export function resolveTripAnchorIso(
  source?: TripAnchorSource | null,
): string | null {
  const raw =
    source?.travelPlan?.startDate
    || source?.startDate
    || null;
  if (!raw) return null;
  const parsed = parseLocalDateOnly(raw);
  return parsed ? formatLocalDateKey(parsed) : null;
}

/** Inclusive return date from user endDate when present. */
export function resolveTripEndIso(
  source?: TripAnchorSource | null,
): string | null {
  const raw = source?.travelPlan?.endDate || source?.endDate || null;
  if (!raw) return null;
  const parsed = parseLocalDateOnly(raw);
  return parsed ? formatLocalDateKey(parsed) : null;
}

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

/** Display travel dates as DD/MM/YYYY (e.g. 21/07/2026). */
export function formatDisplayDate(iso: string | null | undefined): string {
  const parsed = parseLocalDateOnly(iso);
  if (!parsed) return '';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${parsed.getFullYear()}`;
}

/** Parse DD/MM/YYYY or YYYY-MM-DD into an ISO date key. */
export function parseDisplayDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
    ) {
      return formatLocalDateKey(date);
    }
    return null;
  }

  return parseLocalDateOnly(trimmed) ? formatLocalDateKey(parseLocalDateOnly(trimmed)!) : null;
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
