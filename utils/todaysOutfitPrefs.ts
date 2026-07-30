import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DressFor, WorkDressCode } from '@/services/OnboardingProfileService';
import { normalizeWorkDressCode } from '@/services/OnboardingProfileService';
import {
  getHourInTimeZone,
  TODAYS_OUTFIT_TIMEZONE,
} from '@/utils/todaysOutfitTime';

const PREFS_KEY = '@dripn_todays_outfit_popup_prefs';

export type TodaysOutfitOccasionPref = DressFor | 'auto';

export type TodaysOutfitPopupPrefs = {
  /** When false, never auto-show the popup (manual chip still works). */
  enabled: boolean;
  /**
   * Hour (0–23) when the popup becomes eligible — interpreted in Europe/London
   * so "8:00 am" means UK time even if the phone is abroad.
   */
  appearAtHour: number;
  /** Force an occasion, or auto = time-aware. */
  preferredOccasion: TodaysOutfitOccasionPref;
  /** Workplace dress code — shapes work-day footwear and formality. */
  workDressCode?: WorkDressCode | null;
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
  workDressCode: null,
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
    workDressCode: normalizeWorkDressCode(base.workDressCode),
  };
}

export async function getTodaysOutfitPopupPrefs(): Promise<TodaysOutfitPopupPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    const prefs = raw
      ? normalizeTodaysOutfitPopupPrefs(JSON.parse(raw))
      : { ...DEFAULT_TODAYS_OUTFIT_POPUP_PREFS };
    if (!prefs.workDressCode) {
      try {
        const { onboardingProfileService } = await import('@/services/OnboardingProfileService');
        const profile = await onboardingProfileService.getProfile();
        prefs.workDressCode = normalizeWorkDressCode(profile.workDressCode);
      } catch {
        /* ignore */
      }
    }
    return prefs;
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
  // Keep daily local notification in sync with Appear-at hour / enabled.
  try {
    const { syncTodaysOutfitLocalNotification } = await import(
      '@/services/todaysOutfitLocalNotify'
    );
    void syncTodaysOutfitLocalNotification(next);
  } catch {
    // non-fatal
  }
  // Mirror work dress code into onboarding profile (generator + Settings share one value).
  if (partial.workDressCode !== undefined) {
    try {
      const { onboardingProfileService } = await import('@/services/OnboardingProfileService');
      await onboardingProfileService.saveProfile({
        workDressCode: normalizeWorkDressCode(partial.workDressCode),
      });
    } catch {
      // non-fatal
    }
  }
  return next;
}

export function formatHourLabel(hour: number): string {
  const h = clampHour(hour, 0);
  const suffix = h >= 12 ? 'pm' : 'am';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix} UK`;
}

/**
 * True when the popup is eligible: enabled, and Europe/London time is at/after
 * appearAtHour on the current UK calendar day.
 */
export function isWithinTodaysOutfitPopupWindow(
  prefs: TodaysOutfitPopupPrefs,
  now: Date = new Date(),
): boolean {
  if (!prefs.enabled) return false;
  return getHourInTimeZone(now, TODAYS_OUTFIT_TIMEZONE) >= prefs.appearAtHour;
}

export function getOccasionPrefLabel(pref: TodaysOutfitOccasionPref): string {
  return OCCASION_PREF_OPTIONS.find((o) => o.id === pref)?.label || String(pref);
}
