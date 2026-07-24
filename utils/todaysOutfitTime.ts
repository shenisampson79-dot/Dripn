/**
 * Timezone helpers for Today's Outfit (UK-first).
 * Avoids adding luxon — Intl is enough for hour/date keys.
 */

export const TODAYS_OUTFIT_TIMEZONE = 'Europe/London';

function part(
  now: Date,
  timeZone: string,
  type: Intl.DateTimeFormatPartTypes,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    ...options,
  }).formatToParts(now);
  return parts.find((p) => p.type === type)?.value || '0';
}

/** Hour 0–23 in a named IANA zone (e.g. Europe/London). */
export function getHourInTimeZone(
  now: Date = new Date(),
  timeZone: string = TODAYS_OUTFIT_TIMEZONE,
): number {
  const raw = Number(part(now, timeZone, 'hour', { hour: 'numeric' }));
  if (!Number.isFinite(raw)) return now.getHours();
  return raw === 24 ? 0 : raw;
}

export function getMinuteInTimeZone(
  now: Date = new Date(),
  timeZone: string = TODAYS_OUTFIT_TIMEZONE,
): number {
  const raw = Number(part(now, timeZone, 'minute', { minute: '2-digit', hour: 'numeric' }));
  return Number.isFinite(raw) ? raw : now.getMinutes();
}

/** YYYY-MM-DD in the given zone. */
export function dateKeyInTimeZone(
  now: Date = new Date(),
  timeZone: string = TODAYS_OUTFIT_TIMEZONE,
): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Next Date (device clock) when `timeZone` hits hour:00.
 * Used to schedule absolute local notifications for UK 8am even if the phone is abroad.
 */
export function nextDateAtHourInTimeZone(
  hour: number,
  timeZone: string = TODAYS_OUTFIT_TIMEZONE,
  now: Date = new Date(),
): Date {
  const targetHour = Math.min(23, Math.max(0, Math.round(hour)));
  // Scan minute-by-minute up to ~25h — reliable across DST without a TZ library.
  for (let m = 0; m <= 60 * 25; m += 1) {
    const candidate = new Date(now.getTime() + m * 60_000);
    if (
      getHourInTimeZone(candidate, timeZone) === targetHour
      && getMinuteInTimeZone(candidate, timeZone) === 0
    ) {
      // Skip "now" if we're already exactly on the minute (would fire immediately).
      if (m === 0) continue;
      return candidate;
    }
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
