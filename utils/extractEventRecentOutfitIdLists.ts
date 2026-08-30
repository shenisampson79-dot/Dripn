/**
 * Recent outfit id lists for Event diversity — newest look first.
 */

export type EventOutfitPieceRef = {
  wardrobeItemId?: string | number;
  id?: string | number;
};

export type EventOutfitHistorySource = {
  outfitPieces?: EventOutfitPieceRef[] | null;
  displayState?: string | null;
  status?: string | null;
  type?: string | null;
  retailOutfit?: {
    products?: Array<{ id?: string | number } | null> | null;
    outfit?: Record<string, { id?: string | number } | null> | null;
  } | null;
};

function isShopRequiredEventResult(source: EventOutfitHistorySource | null | undefined): boolean {
  if (!source) return false;
  return source.displayState === 'SHOP_REQUIRED'
    || source.status === 'SHOP_REQUIRED'
    || source.type === 'shop_required'
    || Boolean(source.retailOutfit?.products?.length || source.retailOutfit?.outfit);
}

function retailProductsToHistoryRefs(
  retailOutfit: EventOutfitHistorySource['retailOutfit'],
): EventOutfitPieceRef[] {
  const products = retailOutfit?.products;
  if (Array.isArray(products) && products.length >= 2) {
    return products
      .map((product) => (product?.id != null ? { id: product.id } : null))
      .filter(Boolean) as EventOutfitPieceRef[];
  }
  const outfit = retailOutfit?.outfit;
  if (outfit && typeof outfit === 'object') {
    const refs = Object.values(outfit)
      .map((product) => (product?.id != null ? { id: product.id } : null))
      .filter(Boolean) as EventOutfitPieceRef[];
    if (refs.length >= 2) return refs;
  }
  return [];
}

/** Resolve wardrobe or SHOP_REQUIRED retail ids for cross-event diversity history. */
export function resolveEventOutfitHistoryPieces(
  source: EventOutfitHistorySource | null | undefined,
): EventOutfitPieceRef[] | null {
  if (!source) return null;
  const wardrobePieces = source.outfitPieces;
  if (Array.isArray(wardrobePieces) && wardrobePieces.length >= 2) {
    return wardrobePieces;
  }
  if (isShopRequiredEventResult(source)) {
    const retailRefs = retailProductsToHistoryRefs(source.retailOutfit);
    if (retailRefs.length >= 2) return retailRefs;
  }
  return null;
}

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
