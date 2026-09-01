/**
 * Recent outfit id lists for Chat diversity — newest first.
 * Prefer wardrobeVisual strip IDs (published look) over legacy suggestion.
 */

type VisualPiece = {
  wardrobeItemId?: string | number;
  id?: string | number;
  name?: string | null;
} | null;

export type RecentOutfitMessage = {
  role?: string;
  wardrobeVisual?: {
    layout?: string;
    pieces?: Array<VisualPiece> | null;
    outfits?: Array<{
      pieces?: Array<VisualPiece> | null;
    } | null> | null;
  } | null;
  looks?: Array<{ itemIds?: Array<string | number> } | null> | null;
  outfitSuggestion?: {
    items?: Array<{ id?: string | number; name?: string | null } | null> | null;
  } | null;
};

export type CurrentLookWardrobeRow = {
  id?: string | number | null;
  name?: string | null;
};

function idsFromPieces(
  pieces: Array<VisualPiece> | null | undefined,
): string[] {
  if (!Array.isArray(pieces) || !pieces.length) return [];
  return pieces
    .map((p) => p?.wardrobeItemId ?? p?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
}

function displayedVisualPieces(msg: RecentOutfitMessage | null | undefined): VisualPiece[] {
  const visual = msg?.wardrobeVisual;
  if (visual?.layout === 'multi' && Array.isArray(visual.outfits) && visual.outfits.length) {
    const first = visual.outfits[0]?.pieces;
    if (Array.isArray(first) && first.length) return first;
  }
  if (Array.isArray(visual?.pieces) && visual.pieces.length) return visual.pieces;
  return [];
}

function messageHasDisplayedLook(msg: RecentOutfitMessage | null | undefined): boolean {
  if (!msg) return false;
  if (displayedVisualPieces(msg).length) return true;
  if (Array.isArray(msg.outfitSuggestion?.items) && msg.outfitSuggestion.items.length) return true;
  return false;
}

function idsFromSuggestion(msg: RecentOutfitMessage | null | undefined): string[] {
  const items = msg?.outfitSuggestion?.items;
  if (!Array.isArray(items) || !items.length) return [];
  return items.map((it) => String(it?.id || '')).filter(Boolean);
}

function idsFromPieceNames(
  pieces: VisualPiece[],
  wardrobeItems: CurrentLookWardrobeRow[] = [],
): string[] {
  if (!pieces.length || !wardrobeItems.length) return [];
  const byName = new Map(
    wardrobeItems
      .filter((row) => row?.id != null && String(row.name || '').trim())
      .map((row) => [String(row.name).toLowerCase().trim(), String(row.id)]),
  );
  const ids: string[] = [];
  for (const piece of pieces) {
    const name = String(piece?.name || '').toLowerCase().trim();
    if (!name) continue;
    const id = byName.get(name);
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * IDs for the look actually shown on one assistant turn.
 * Visual strip / outfitSuggestion only — never ranked `looks` when a strip is displayed.
 */
export function idsFromDisplayedAssistantMessage(
  msg: RecentOutfitMessage | null | undefined,
  wardrobeItems: CurrentLookWardrobeRow[] = [],
): string[] {
  const pieces = displayedVisualPieces(msg);
  let ids = idsFromPieces(pieces);
  if (ids.length < 2) {
    const fromSuggestion = idsFromSuggestion(msg);
    if (fromSuggestion.length >= 2) ids = fromSuggestion;
  }
  if (ids.length < 2 && pieces.length) {
    const fromNames = idsFromPieceNames(pieces, wardrobeItems);
    if (fromNames.length >= 2) ids = fromNames;
  }
  return ids;
}

/**
 * Current-look IDs for Chat refine locks.
 * Newest displayed visual wins; older structured looks / ranked `looks[]` must not leak in.
 */
export function extractCurrentLookItemIds(
  messages: Array<RecentOutfitMessage | null | undefined>,
  wardrobeItems: CurrentLookWardrobeRow[] = [],
): string[] {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const msg = list[i];
    if (!msg || msg.role !== 'assistant') continue;
    if (messageHasDisplayedLook(msg)) {
      return idsFromDisplayedAssistantMessage(msg, wardrobeItems);
    }
    const lookIds = Array.isArray(msg.looks?.[0]?.itemIds)
      ? msg.looks[0]!.itemIds!.map(String).filter(Boolean)
      : [];
    if (lookIds.length >= 2) return lookIds;
  }
  return [];
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
