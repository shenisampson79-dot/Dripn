import type { Feather } from '@expo/vector-icons';

export type OutfitOccasionId =
  | 'work_outfit'
  | 'date_night'
  | 'casual_day'
  | 'weekend'
  | 'smart_casual'
  | 'gym'
  | 'evening_out'
  | 'travel'
  | 'custom';

export type OutfitOccasionOption = {
  id: OutfitOccasionId;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
};

/** Shared occasion list — excludes today's look (use Weather Outfits instead). */
export const OUTFIT_OCCASION_OPTIONS: OutfitOccasionOption[] = [
  { id: 'work_outfit', icon: 'briefcase', label: 'Work Outfit', description: 'Professional & polished' },
  { id: 'date_night', icon: 'heart', label: 'Date Night', description: 'Stylish & confident' },
  { id: 'casual_day', icon: 'coffee', label: 'Casual Day', description: 'Comfortable & effortless' },
  { id: 'weekend', icon: 'sunset', label: 'Weekend', description: 'Relaxed & put-together' },
  { id: 'smart_casual', icon: 'layers', label: 'Smart Casual', description: 'Elevated everyday style' },
  { id: 'gym', icon: 'activity', label: 'Gym', description: 'Functional & stylish' },
  { id: 'evening_out', icon: 'star', label: 'Evening Out', description: 'Elevated & memorable' },
  { id: 'travel', icon: 'navigation', label: 'Travel', description: 'Comfortable yet stylish' },
];

export const OUTFIT_OCCASION_CHIPS = OUTFIT_OCCASION_OPTIONS.slice(0, 4);

/**
 * Default multi-day plan by calendar weekday — no casual-Friday assumption.
 * Mon–Fri → work; Sat–Sun → weekend.
 */
export function occasionForWeekday(date: Date): OutfitOccasionId {
  const day = date.getDay(); // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return 'weekend';
  return 'work_outfit';
}

export function buildWeekOccasionRotation(
  days: number,
  focusOccasionId?: OutfitOccasionId | null,
  startDate: Date = new Date(),
): OutfitOccasionId[] {
  if (focusOccasionId) {
    return Array.from({ length: days }, () => focusOccasionId);
  }
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return occasionForWeekday(d);
  });
}

export const OCCASION_TO_PLANNED_EVENT: Record<OutfitOccasionId, string> = {
  work_outfit: 'work',
  date_night: 'date-night',
  casual_day: 'casual',
  weekend: 'casual',
  smart_casual: 'casual',
  gym: 'workout',
  evening_out: 'party',
  travel: 'travel',
  custom: 'everyday',
};

export function getOccasionLabel(id: OutfitOccasionId): string {
  return OUTFIT_OCCASION_OPTIONS.find((o) => o.id === id)?.label ?? id.replace(/_/g, ' ');
}
