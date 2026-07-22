import apiService from '@/services/ApiService';

export type SaveGeneratedOutfitParams = {
  name: string;
  description?: string;
  occasion: string;
  wardrobeItemIds: Array<string | number>;
  loved?: boolean;
  calendarDate?: string;
  notes?: string;
};

export class OutfitSaveClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = 'OutfitSaveClientError';
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

/** Normalize wardrobe IDs to digit strings only — never fuzzy name matches. */
export function normalizeWardrobeIdsForSave(
  rawIds: Array<string | number | null | undefined>,
): string[] {
  const ids = new Set<string>();
  for (const raw of rawIds) {
    if (raw == null) continue;
    const asString = String(raw).trim();
    if (!asString) continue;
    if (!/^\d+$/.test(asString)) continue;
    ids.add(asString);
  }
  return [...ids];
}

export function wardrobeIdsFromPieces(
  pieces: Array<{ wardrobeItemId?: string | number | null; id?: string | number | null }>,
): string[] {
  const ids = new Set<string>();
  for (const piece of pieces) {
    // Prefer explicit wardrobe linkage; never treat display-only names as IDs
    const id = piece.wardrobeItemId ?? piece.id;
    if (id == null) continue;
    const asString = String(id).trim();
    if (!asString) continue;
    // Wardrobe item IDs are numeric serials from the server
    if (!/^\d+$/.test(asString)) continue;
    ids.add(asString);
  }
  return [...ids];
}

export function occasionSlugFromLabel(label?: string): string {
  if (!label?.trim()) return 'custom';
  return label.trim().toLowerCase().replace(/\s+/g, '_');
}

export function messageFromOutfitSaveError(err: unknown): string {
  const fallback = "Couldn't save — wardrobe piece missing. Refresh your wardrobe and try again.";
  if (!err) return fallback;
  const anyErr = err as {
    message?: string;
    code?: string;
    status?: number;
    statusCode?: number;
  };
  const code = anyErr.code;
  const status = anyErr.status ?? anyErr.statusCode;
  const msg = (anyErr.message || '').trim();

  if (code === 'OUTFIT_SAVE_MISSING_REFS' || /wardrobe piece missing/i.test(msg)) {
    return fallback;
  }
  if (code === 'OUTFIT_SAVE_EMPTY' || status === 400) {
    return msg || 'Could not save. Add wardrobe pieces and try again.';
  }
  if (msg && !/^request failed$/i.test(msg) && !/^http\s*\d+/i.test(msg)) {
    return msg;
  }
  return 'Could not save. Please try again in a moment.';
}

/**
 * Single client entry for profile / mix-and-match outfit saves.
 * All sources (stylist chat, Today's outfit, builder, DFY modular) should call this.
 */
export async function saveGeneratedOutfitToProfile(params: SaveGeneratedOutfitParams) {
  const { name, description, occasion, loved, calendarDate, notes } = params;
  const wardrobeItemIds = normalizeWardrobeIdsForSave(params.wardrobeItemIds || []);

  if (wardrobeItemIds.length === 0) {
    throw new OutfitSaveClientError(
      "Couldn't save — wardrobe piece missing. Refresh your wardrobe and try again.",
      { code: 'OUTFIT_SAVE_EMPTY', status: 400 },
    );
  }

  try {
    const result = await apiService.saveMixAndMatchOutfit({
      name,
      occasion,
      wardrobeItemIds,
      notes: (notes ?? description)?.trim() || undefined,
      loved,
      calendarDate,
    });

    apiService.recordOutfitEngagement({
      items: wardrobeItemIds,
      signal: loved ? 'liked' : 'saved',
      occasion,
    }).catch(() => {});

    return result;
  } catch (err) {
    const anyErr = err as { message?: string; code?: string; status?: number; statusCode?: number };
    throw new OutfitSaveClientError(messageFromOutfitSaveError(err), {
      code: anyErr.code,
      status: anyErr.status ?? anyErr.statusCode,
    });
  }
}
