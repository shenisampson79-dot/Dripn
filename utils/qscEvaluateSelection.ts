/**
 * QSC evaluate_outfit selection integrity.
 * Visible picker IDs at submit must equal selectedWardrobeIds and derived images.
 */

export type QscSelectableItem = {
  id?: string | number;
  enhancedImageUri?: string | null;
  imageUri?: string | null;
};

export function normalizeSelectedWardrobeIds(
  ids: Array<string | number> | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids || []) {
    const id = String(raw ?? '').trim();
    if (!id || id === 'undefined' || id === 'null') continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** IDs the customer can actually see as selected in the wardrobe picker. */
export function visibleQscWardrobeIds(
  selectedIds: Array<string | number> | null | undefined,
  items: QscSelectableItem[] | null | undefined,
): string[] {
  const allowed = new Set(
    (items || [])
      .filter((item) => Boolean(item.enhancedImageUri || item.imageUri))
      .map((item) => String(item.id)),
  );
  return normalizeSelectedWardrobeIds(selectedIds).filter((id) => allowed.has(id));
}

/**
 * Auto-unlock of a stale completed QSC snapshot is a new check, not edit-and-rerun.
 * Prior piece IDs must not remain selected.
 */
export function clearQscWardrobeSelectionForFreshStart<T extends {
  selectedWardrobeIds?: string[];
  images?: string[];
  imageDataUris?: string[];
}>(input: T): T {
  return {
    ...input,
    selectedWardrobeIds: [],
    images: [],
    imageDataUris: [],
  };
}

export function resolveQscEvaluateSubmitSelection(args: {
  selectedWardrobeIds: Array<string | number>;
  galleryImages: string[];
  wardrobeItems: QscSelectableItem[];
  maxWardrobeItems: number;
}): {
  selectedWardrobeIds: string[];
  imageUris: string[];
  usedWardrobe: boolean;
} {
  const ids = visibleQscWardrobeIds(args.selectedWardrobeIds, args.wardrobeItems)
    .slice(0, Math.max(0, args.maxWardrobeItems));

  if (ids.length > 0) {
    const byId = new Map(
      (args.wardrobeItems || []).map((item) => [String(item.id), item]),
    );
    const imageUris = ids
      .map((id) => {
        const item = byId.get(id);
        return item?.enhancedImageUri || item?.imageUri || '';
      })
      .filter((uri) => Boolean(uri));
    return { selectedWardrobeIds: ids, imageUris, usedWardrobe: true };
  }

  return {
    selectedWardrobeIds: [],
    imageUris: Array.isArray(args.galleryImages) ? args.galleryImages.filter(Boolean) : [],
    usedWardrobe: false,
  };
}
