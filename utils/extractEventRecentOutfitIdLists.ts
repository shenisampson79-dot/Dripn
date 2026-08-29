/**
 * Recent outfit id lists for Event diversity — newest look first.
 */

export type EventOutfitPieceRef = {
  wardrobeItemId?: string | number;
  id?: string | number;
};

export function outfitPiecesToIdList(
  pieces: EventOutfitPieceRef[] | null | undefined,
): string[] {
  if (!Array.isArray(pieces) || !pieces.length) return [];
  return pieces
    .map((p) => p?.wardrobeItemId ?? p?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
}

/** @returns string[][] newest look first */
export function extractEventRecentOutfitIdLists(
  priorLists: string[][] | null | undefined,
  latestPieces?: EventOutfitPieceRef[] | null,
  limit = 5,
): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();

  const push = (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length < 2) return;
    const sig = [...ids].sort().join('|');
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(ids);
  };

  const latest = outfitPiecesToIdList(latestPieces);
  if (latest.length >= 2) push(latest);

  for (const list of priorLists || []) {
    if (out.length >= limit) break;
    push(Array.isArray(list) ? list.map(String).filter(Boolean) : []);
  }

  return out.slice(0, limit);
}
