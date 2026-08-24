/**
 * Stylist Chat "Refresh thread" integrity.
 *
 * Server chat_messages is one canonical conversation per (userId, stylist).
 * Local AsyncStorage + in-memory cache must stay aligned with DELETE /api/chat/history,
 * otherwise tab-away → remount hydrates the discarded thread from the server.
 */

export const STYLIST_CHAT_CLEARED_TOMBSTONE_KEY = '@dripn_ai_stylist_chat_cleared';

export type StylistChatClearedTombstone = {
  stylistId: string;
  at: number;
};

export function parseStylistChatClearedTombstone(
  raw: string | null | undefined,
): StylistChatClearedTombstone | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StylistChatClearedTombstone>;
    const stylistId = String(parsed?.stylistId || '').trim().toLowerCase();
    const at = Number(parsed?.at);
    if (!stylistId || !Number.isFinite(at)) return null;
    return { stylistId, at };
  } catch {
    return null;
  }
}

/** True when server hydrate must be skipped after an intentional Refresh thread. */
export function shouldSuppressServerChatHydrate(
  tombstone: StylistChatClearedTombstone | null,
  stylistId: string,
): boolean {
  if (!tombstone) return false;
  return tombstone.stylistId === String(stylistId || '').trim().toLowerCase();
}

export function buildStylistChatClearedTombstone(
  stylistId: string,
  at = Date.now(),
): StylistChatClearedTombstone {
  return {
    stylistId: String(stylistId || '').trim().toLowerCase(),
    at,
  };
}
