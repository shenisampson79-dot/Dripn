/**
 * Canonical outfit visual authority helpers.
 * Published strip IDs must equal createWardrobeOutfit accepted itemIds —
 * never a second prose→wardrobe reconstruction.
 */

export type VisualPieceLike = {
  wardrobeItemId?: string | number | null;
  id?: string | number | null;
} | null;

export type WardrobeVisualLike = {
  layout?: string;
  pieces?: VisualPieceLike[] | null;
  outfits?: Array<{ pieces?: VisualPieceLike[] | null } | null> | null;
} | null;

function idsFromPieces(pieces: VisualPieceLike[] | null | undefined): string[] {
  if (!Array.isArray(pieces) || !pieces.length) return [];
  return pieces
    .map((p) => p?.wardrobeItemId ?? p?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
}

/** Ordered unique IDs from a wardrobe visual (first multi outfit, else pieces). */
export function wardrobeVisualItemIds(visual: WardrobeVisualLike): string[] {
  if (!visual || typeof visual !== 'object') return [];
  if (visual.layout === 'multi' && Array.isArray(visual.outfits) && visual.outfits.length) {
    const fromFirst = idsFromPieces(visual.outfits[0]?.pieces);
    if (fromFirst.length) return fromFirst;
  }
  return idsFromPieces(visual.pieces);
}

function sameIdSet(a: string[], b: string[]): boolean {
  const aa = [...new Set(a.map(String))].sort();
  const bb = [...new Set(b.map(String))].sort();
  if (aa.length !== bb.length) return false;
  return aa.every((id, i) => id === bb[i]);
}

/**
 * Prefer server `itemIds` as SSoT. Drop visual if it disagrees (fail closed —
 * never keep a prose-completed strip that diverges from the beam).
 */
export function assertCanonicalOutfitVisual(params: {
  itemIds?: Array<string | number> | null;
  wardrobeVisual?: WardrobeVisualLike;
}): { wardrobeVisual: WardrobeVisualLike; ok: boolean; reason?: string } {
  const accepted = Array.isArray(params.itemIds)
    ? params.itemIds.map(String).filter(Boolean)
    : [];
  const visual = params.wardrobeVisual ?? null;
  if (!visual) {
    return { wardrobeVisual: null, ok: accepted.length === 0, reason: accepted.length ? 'missing_visual' : undefined };
  }
  if (!accepted.length) {
    // Clarify / Tier-B narrow: no accepted IDs — strip must stay null upstream.
    return { wardrobeVisual: visual, ok: true };
  }
  const visualIds = wardrobeVisualItemIds(visual);
  if (!visualIds.length) {
    return { wardrobeVisual: null, ok: false, reason: 'empty_visual_pieces' };
  }
  if (!sameIdSet(visualIds, accepted)) {
    return { wardrobeVisual: null, ok: false, reason: 'visual_ids_diverge_from_itemIds' };
  }
  return { wardrobeVisual: visual, ok: true };
}
