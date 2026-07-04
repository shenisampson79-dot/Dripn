/**
 * Calendar season helpers for filtering fashion content.
 */

export type CalendarSeason = 'winter' | 'spring' | 'summer' | 'autumn';

export function getCurrentFashionYear(): number {
  return new Date().getFullYear();
}

/** Northern-hemisphere calendar season (UK/Europe default for Dripn). */
export function getCurrentCalendarSeason(date = new Date()): CalendarSeason {
  const month = date.getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export function getSeasonLabel(season: CalendarSeason): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

export function mapUserGenderToNewsletterFilter(
  gender?: string | null,
): 'women' | 'men' | undefined {
  if (gender === 'woman') return 'women';
  if (gender === 'man') return 'men';
  return undefined;
}

export function mapUserGenderToRuleFilter(
  gender?: string | null,
): 'women' | 'men' | 'all' {
  if (gender === 'woman') return 'women';
  if (gender === 'man') return 'men';
  return 'all';
}
