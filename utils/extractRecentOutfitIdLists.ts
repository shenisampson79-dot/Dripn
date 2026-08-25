/**
 * Recent outfit id lists for Chat diversity — newest first.
 * Prefer wardrobeVisual strip IDs (published look) over legacy suggestion.
 */

export type RecentOutfitMessage = {
  role?: string;
  wardrobeVisual?: {
    layout?: string;
    pieces?: Array<{ wardrobeItemId?: string | number; id?: string | number } | null> | null;
    outfits?: Array<{
      pieces?: Array<{ wardrobeItemId?: string | number; id?: string | number } | null> | null;
    } | null> | null;
  } | null;
  looks?: Array<{ itemIds?: Array<string | number> } | null> | null;
  outfitSuggestion?: {
    items?: Array<{ id?: string | number } | null> | null;
  } | null;
};

function idsFromPieces(
  pieces: Array<{ wardrobeItemId?: string | number; id?: string | number } | null> | null | undefined,
): string[] {
  if (!Array.isArray(pieces) || !pieces.length) return [];
  return pieces
    .map((p) => p?.wardrobeItemId ?? p?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
}

/**
 * @returns string[][] newest look first
 */
export function extractRecentOutfitIdLists(
  messages: RecentOutfitMessage[],
  limit = 5,
): string[][] {
  const out: string[][] = [];
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const msg = list[i];
    if (!msg || msg.role !== 'assistant') continue;
    let ids: string[] = [];

    const visual = msg.wardrobeVisual;
    if (visual?.layout === 'multi' && Array.isArray(visual.outfits) && visual.outfits.length) {
      // Prefer first outfit in multi strip as the published look
      ids = idsFromPieces(visual.outfits[0]?.pieces);
    }
    if (ids.length < 2) {
      ids = idsFromPieces(visual?.pieces);
    }
    if (ids.length < 2 && Array.isArray(msg.looks?.[0]?.itemIds) && msg.looks[0]!.itemIds!.length) {
      ids = msg.looks[0]!.itemIds!.map(String);
    }
    if (ids.length < 2 && Array.isArray(msg.outfitSuggestion?.items) && msg.outfitSuggestion!.items!.length) {
      ids = msg.outfitSuggestion!.items!
        .map((it) => String(it?.id || ''))
        .filter(Boolean);
    }
    if (ids.length >= 2) out.push(ids);
  }
  return out;
}
