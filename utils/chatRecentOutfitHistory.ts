/**
 * Cross-session Chat outfit id history for diversity — survives Refresh thread /
 * DELETE /api/chat/history (conversation reset, not outfit-recency reset).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecentOutfitMessage } from '@/utils/extractRecentOutfitIdLists';
import { extractRecentOutfitIdLists } from '@/utils/extractRecentOutfitIdLists';

const HISTORY_KEY = (userId: string) => `@dripn_chat_recent_outfits_${userId}`;
export const CHAT_OUTFIT_RECENCY_MAX_LISTS = 7;

function outfitTupleKey(ids: string[]): string {
  return [...new Set(ids.map(String).filter(Boolean))].sort().join('|');
}

/** Newest look first; skip duplicate tuple; require ≥2 ids. */
export function prependChatOutfitIdList(
  prior: string[][],
  itemIds: string[],
  limit = CHAT_OUTFIT_RECENCY_MAX_LISTS,
): string[][] {
  const ids = itemIds.map(String).filter(Boolean);
  if (ids.length < 2) return prior.slice(0, limit);
  const key = outfitTupleKey(ids);
  const rest = (prior || [])
    .filter((entry) => Array.isArray(entry) && entry.length >= 2)
    .filter((entry) => outfitTupleKey(entry) !== key);
  return [[...ids], ...rest].slice(0, limit);
}

export async function loadChatRecentOutfitHistory(userId: string): Promise<string[][]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => Array.isArray(entry) && entry.length >= 2)
      .map((entry) => entry.map(String).filter(Boolean))
      .slice(0, CHAT_OUTFIT_RECENCY_MAX_LISTS);
  } catch {
    return [];
  }
}

export async function saveChatRecentOutfitHistory(
  userId: string,
  lists: string[][],
): Promise<void> {
  if (!userId) return;
  const normalized = (lists || [])
    .filter((entry) => Array.isArray(entry) && entry.length >= 2)
    .map((entry) => entry.map(String).filter(Boolean))
    .slice(0, CHAT_OUTFIT_RECENCY_MAX_LISTS);
  try {
    await AsyncStorage.setItem(HISTORY_KEY(userId), JSON.stringify(normalized));
  } catch {
    // non-blocking
  }
}

export async function appendChatRecentOutfitHistory(
  userId: string,
  itemIds: string[] | Array<string | number>,
): Promise<string[][]> {
  if (!userId) return [];
  const ids = (itemIds || []).map(String).filter(Boolean);
  if (ids.length < 2) return await loadChatRecentOutfitHistory(userId);
  const prior = await loadChatRecentOutfitHistory(userId);
  const next = prependChatOutfitIdList(prior, ids);
  await saveChatRecentOutfitHistory(userId, next);
  return next;
}

export function outfitItemIdsFromPublishedTurn(
  assistantMessage: RecentOutfitMessage,
  responseItemIds?: Array<string | number> | null,
): string[] {
  const fromApi = (responseItemIds || []).map(String).filter(Boolean);
  if (fromApi.length >= 2) return fromApi;
  const fromVisual = extractRecentOutfitIdLists([assistantMessage], 1);
  return fromVisual[0] || [];
}
