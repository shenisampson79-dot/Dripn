/**
 * Merge live Chat + persisted Chat + Event + GON outfit recency for outfit-from-wardrobe.
 */
import type { RecentOutfitMessage } from '@/utils/extractRecentOutfitIdLists';
import { extractRecentOutfitIdLists } from '@/utils/extractRecentOutfitIdLists';
import { loadChatRecentOutfitHistory } from '@/utils/chatRecentOutfitHistory';
import { loadEventRecentOutfitHistory } from '@/utils/eventRecentOutfitHistory';
import { loadGetOutfitsSession } from '@/utils/getOutfitsSessionStore';
import {
  extractGonRecentOutfitIdLists,
  flattenGonPenalizeItemIds,
} from '@/utils/extractGonRecentOutfitIdLists';

export const MERGED_OUTFIT_RECENCY_MAX = 7;
const LIVE_CHAT_RECENCY_LIMIT = 5;
const GON_RECENCY_LIMIT = 5;

function outfitTupleKey(ids: string[]): string {
  return [...new Set(ids.map(String).filter(Boolean))].sort().join('|');
}

/** Dedupe outfit tuples; first occurrence wins (newest-first sources). */
export function mergeOutfitRecencyLists(
  sources: string[][],
  limit = MERGED_OUTFIT_RECENCY_MAX,
): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  for (const ids of sources) {
    if (!Array.isArray(ids) || ids.length < 2) continue;
    const normalized = ids.map(String).filter(Boolean);
    if (normalized.length < 2) continue;
    const key = outfitTupleKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

export type ChatOutfitRecencyBundle = {
  recentOutfits: string[][];
  penalizeItemIds: string[];
};

export async function resolveChatOutfitRecencyForRequest(params: {
  userId?: string | null;
  messages: RecentOutfitMessage[];
}): Promise<ChatOutfitRecencyBundle> {
  const liveChat = extractRecentOutfitIdLists(params.messages, LIVE_CHAT_RECENCY_LIMIT);
  const persistedChat = params.userId
    ? await loadChatRecentOutfitHistory(String(params.userId))
    : [];
  const event = params.userId
    ? await loadEventRecentOutfitHistory(String(params.userId))
    : [];
  const gonSession = await loadGetOutfitsSession();
  const gon = extractGonRecentOutfitIdLists(gonSession?.outfitOptions || [], GON_RECENCY_LIMIT);

  const merged = mergeOutfitRecencyLists([
    ...liveChat,
    ...persistedChat,
    ...event,
    ...gon,
  ]);

  return {
    recentOutfits: merged,
    penalizeItemIds: flattenGonPenalizeItemIds(merged),
  };
}
