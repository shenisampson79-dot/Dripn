import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DressFor } from '@/services/OnboardingProfileService';

const PREFS_KEY = '@dripn_todays_outfit_popup_prefs';

export type TodaysOutfitOccasionPref = DressFor | 'auto';

export type TodaysOutfitPopupPrefs = {
  /** When false, never auto-show the popup (manual chip still works). */
  enabled: boolean;
  /**
   * Local hour (0–23) when the popup becomes eligible.
   * Once that time has passed today, it stays until the user acts on it.
   */
  appearAtHour: number;
  /** Force an occasion, or auto = time-aware. */
  preferredOccasion: TodaysOutfitOccasionPref;
};

/** @deprecated Kept for reading older stored prefs only. */
type LegacyTodaysOutfitPopupPrefs = Partial<TodaysOutfitPopupPrefs> & {
  showFromHour?: number;
  showUntilHour?: number;
};

export const DEFAULT_TODAYS_OUTFIT_POPUP_PREFS: TodaysOutfitPopupPrefs = {
  enabled: true,
  appearAtHour: 8,
  preferredOccasion: 'auto',
};

export const OCCASION_PREF_OPTIONS: Array<{ id: TodaysOutfitOccasionPref; label: string }> = [
  { id: 'auto', label: 'Auto (time-aware)' },
  { id: 'work', label: 'Work / meetings' },
  { id: 'friends', label: 'Going out with friends' },
  { id: 'date', label: 'Date night' },
  { id: 'event', label: 'Event or special occasion' },
];

function clampHour(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(23, Math.max(0, Math.round(value)));
}

export function normalizeTodaysOutfitPopupPrefs(
  raw?: LegacyTodaysOutfitPopupPrefs | null,
): TodaysOutfitPopupPrefs {
  const base = { ...DEFAULT_TODAYS_OUTFIT_POPUP_PREFS, ...(raw || {}) };
  const legacyFrom =
    typeof raw?.showFromHour === 'number' ? raw.showFromHour : undefined;
  const appearAtHour = clampHour(
    typeof base.appearAtHour === 'number'
      ? base.appearAtHour
      : (legacyFrom ?? DEFAULT_TODAYS_OUTFIT_POPUP_PREFS.appearAtHour),
    DEFAULT_TODAYS_OUTFIT_POPUP_PREFS.appearAtHour,
  );
  // "myself" / "yourself today" is not offered in the popup picker — treat as Auto.
  const preferredOccasion =
    base.preferredOccasion === 'work' ||
    base.preferredOccasion === 'friends' ||
    base.preferredOccasion === 'date' ||
    base.preferredOccasion === 'event' ||
    base.preferredOccasion === 'auto'
      ? base.preferredOccasion
      : 'auto';

  return {
    enabled: base.enabled !== false,
    appearAtHour,
    preferredOccasion,
  };
}

export async function getTodaysOutfitPopupPrefs(): Promise<TodaysOutfitPopupPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_TODAYS_OUTFIT_POPUP_PREFS };
    return normalizeTodaysOutfitPopupPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TODAYS_OUTFIT_POPUP_PREFS };
  }
}

export async function saveTodaysOutfitPopupPrefs(
  partial: Partial<TodaysOutfitPopupPrefs>,
): Promise<TodaysOutfitPopupPrefs> {
  const current = await getTodaysOutfitPopupPrefs();
  const next = normalizeTodaysOutfitPopupPrefs({ ...current, ...partial });
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

export function formatHourLabel(hour: number): string {
  const h = clampHour(hour, 0);
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

/**
 * True when the popup is eligible: enabled, and local time is at/after appearAtHour
 * on the current calendar day. It stays eligible until the user dismisses/acts
 * (dismissal is tracked separately per local day).
 *
 * Uses local getHours() — matches Settings "Appear at" labels.
 */
export function isWithinTodaysOutfitPopupWindow(
  prefs: TodaysOutfitPopupPrefs,
  now: Date = new Date(),
): boolean {
  if (!prefs.enabled) return false;
  return now.getHours() >= prefs.appearAtHour;
}

export function getOccasionPrefLabel(pref: TodaysOutfitOccasionPref): string {
  return OCCASION_PREF_OPTIONS.find((o) => o.id === pref)?.label || String(pref);
}
