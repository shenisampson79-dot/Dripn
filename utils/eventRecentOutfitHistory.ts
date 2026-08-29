/**
 * Cross-session Event outfit id history for diversity (survives Done / remount).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  extractEventRecentOutfitIdLists,
  type EventOutfitPieceRef,
} from '@/utils/extractEventRecentOutfitIdLists';

const HISTORY_KEY = (userId: string) => `@dripn_event_recent_outfits_${userId}`;
const MAX_LISTS = 5;

export async function loadEventRecentOutfitHistory(userId: string): Promise<string[][]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => Array.isArray(entry) && entry.length >= 2)
      .map((entry) => entry.map(String).filter(Boolean))
      .slice(0, MAX_LISTS);
  } catch {
    return [];
  }
}

export async function saveEventRecentOutfitHistory(
  userId: string,
  lists: string[][],
): Promise<void> {
  if (!userId) return;
  const normalized = (lists || [])
    .filter((entry) => Array.isArray(entry) && entry.length >= 2)
    .map((entry) => entry.map(String).filter(Boolean))
    .slice(0, MAX_LISTS);
  try {
    await AsyncStorage.setItem(HISTORY_KEY(userId), JSON.stringify(normalized));
  } catch {
    // non-blocking
  }
}

export async function appendEventRecentOutfitHistory(
  userId: string,
  pieces: EventOutfitPieceRef[] | null | undefined,
): Promise<string[][]> {
  if (!userId) return [];
  const prior = await loadEventRecentOutfitHistory(userId);
  const next = extractEventRecentOutfitIdLists(prior, pieces, MAX_LISTS);
  await saveEventRecentOutfitHistory(userId, next);
  return next;
}

export async function clearEventRecentOutfitHistory(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(HISTORY_KEY(userId));
  } catch {
    // ignore
  }
}
