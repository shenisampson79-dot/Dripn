/**
 * Today's Outfit daily state — single source of truth for user actions.
 *
 * plannedOutfits / server hydrate are INPUTS only. They must MERGE into this
 * store and never wipe `worn` / `saved`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { dateKeyInTimeZone, TODAYS_OUTFIT_TIMEZONE } from '@/utils/todaysOutfitTime';

export const TODAYS_OUTFIT_DAILY_STORAGE_KEY = '@dripn_todays_outfit_daily_v1';

/** Locked subtitle — never "Different from yesterday". */
export const TODAYS_OUTFIT_SUBTITLE_CONTRACT = 'Curated from your wardrobe';

export type TodaysOutfitDailyState = {
  date: string; // YYYY-MM-DD (Europe/London)
  outfitId: string;
  worn: boolean;
  saved: boolean;
};

export type TodaysOutfitSheetMode = 'view' | 'save';

export function todaysOutfitDateKey(now: Date = new Date()): string {
  return dateKeyInTimeZone(now, TODAYS_OUTFIT_TIMEZONE);
}

export function createInitialDailyState(outfitId: string, date = todaysOutfitDateKey()): TodaysOutfitDailyState {
  return {
    date,
    outfitId: String(outfitId || ''),
    worn: false,
    saved: false,
  };
}

/** Merge hydrate: preserve worn/saved; update outfitId for today's date. */
export function mergeDailyState(
  local: TodaysOutfitDailyState | null | undefined,
  outfitId: string,
  date = todaysOutfitDateKey(),
): TodaysOutfitDailyState {
  const id = String(outfitId || '');
  if (!local || local.date !== date) {
    return createInitialDailyState(id, date);
  }
  return {
    ...local,
    date,
    outfitId: id || local.outfitId,
    worn: local.worn === true,
    saved: local.saved === true,
  };
}

export function markWorn(state: TodaysOutfitDailyState): TodaysOutfitDailyState {
  return { ...state, worn: true };
}

export function markSaved(state: TodaysOutfitDailyState): TodaysOutfitDailyState {
  return { ...state, saved: true };
}

export function parseDailyState(raw: string | null | undefined): TodaysOutfitDailyState | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TodaysOutfitDailyState>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return null;
    return {
      date: parsed.date,
      outfitId: String(parsed.outfitId || ''),
      worn: parsed.worn === true,
      saved: parsed.saved === true,
    };
  } catch {
    return null;
  }
}

export async function loadDailyState(
  date = todaysOutfitDateKey(),
): Promise<TodaysOutfitDailyState | null> {
  try {
    const raw = await AsyncStorage.getItem(TODAYS_OUTFIT_DAILY_STORAGE_KEY);
    const parsed = parseDailyState(raw);
    if (!parsed || parsed.date !== date) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveDailyState(state: TodaysOutfitDailyState): Promise<void> {
  await AsyncStorage.setItem(TODAYS_OUTFIT_DAILY_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Hydrate from outfit id without wiping user actions.
 * Returns the authoritative daily state after merge + persist.
 */
export async function hydrateDailyState(outfitId: string): Promise<TodaysOutfitDailyState> {
  const date = todaysOutfitDateKey();
  const local = await loadDailyState(date);
  const next = mergeDailyState(local, outfitId, date);
  await saveDailyState(next);
  return next;
}

export async function setWornDaily(outfitId: string): Promise<TodaysOutfitDailyState> {
  const current = await hydrateDailyState(outfitId);
  const next = markWorn(current);
  await saveDailyState(next);
  return next;
}

export async function setSavedDaily(outfitId: string): Promise<TodaysOutfitDailyState> {
  const current = await hydrateDailyState(outfitId);
  const next = markSaved(current);
  await saveDailyState(next);
  return next;
}

/** Pure HQG-style contracts for Today's Outfit UI + state. */
export type TodaysOutfitUiSnapshot = {
  subtitle: string;
  wearLabel: string;
  cardOpen: boolean;
  sheetMode: TodaysOutfitSheetMode;
  saveUsesStackedModal: boolean;
};

export type TodaysOutfitHqgResult = {
  pass: boolean;
  confidence: number;
  issues: string[];
};

export function runTodaysOutfitHqg(input: {
  event: 'WEAR' | 'SAVE' | 'REOPEN' | 'RENDER';
  daily: TodaysOutfitDailyState;
  ui: TodaysOutfitUiSnapshot;
}): TodaysOutfitHqgResult {
  const issues: string[] = [];

  if (/different from yesterday/i.test(input.ui.subtitle)) {
    issues.push('Forbidden subtitle: Different from yesterday');
  }
  if (input.ui.subtitle !== TODAYS_OUTFIT_SUBTITLE_CONTRACT) {
    issues.push(`Subtitle contract violated: expected "${TODAYS_OUTFIT_SUBTITLE_CONTRACT}"`);
  }
  if (input.ui.saveUsesStackedModal) {
    issues.push('Layout contract: no stacked modals');
  }

  if (input.event === 'WEAR') {
    if (!input.daily.worn) issues.push('Wear action not persisted');
    if (!input.ui.cardOpen) issues.push('Card closed after wear action');
    if (!/wearing today/i.test(input.ui.wearLabel)) {
      issues.push('UI not reflecting wearing state');
    }
  }

  if (input.event === 'REOPEN' && input.daily.worn) {
    if (!/wearing today/i.test(input.ui.wearLabel)) {
      issues.push('Worn state lost on reopen');
    }
  }

  if (input.event === 'SAVE' && input.ui.sheetMode !== 'save' && !input.daily.saved) {
    // After opening save flow, mode must be save (inline). After confirm, saved=true.
    issues.push('Save flow must use inline sheet mode');
  }

  const confidence = Math.max(0, 1 - issues.length * 0.2);
  return { pass: issues.length === 0, confidence, issues };
}

export const TODAYS_OUTFIT_LAYOUT_CONTRACT = {
  noStackedModals: true,
  primaryCTAAlwaysClickable: true,
  statePersistsAcrossSessions: true,
  noDerivedStateOverrides: true,
  wearDoesNotCloseCard: true,
  lockedSubtitle: TODAYS_OUTFIT_SUBTITLE_CONTRACT,
} as const;
