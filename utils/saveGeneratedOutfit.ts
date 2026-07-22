import apiService from '@/services/ApiService';

export type SaveGeneratedOutfitParams = {
  name: string;
  description?: string;
  occasion: string;
  wardrobeItemIds: string[];
  loved?: boolean;
};

export async function saveGeneratedOutfitToProfile(params: SaveGeneratedOutfitParams) {
  const { name, description, occasion, wardrobeItemIds, loved } = params;

  await apiService.saveMixAndMatchOutfit({
    name,
    occasion,
    wardrobeItemIds,
    notes: description?.trim() || undefined,
    loved,
  });

  apiService.recordOutfitEngagement({
    items: wardrobeItemIds,
    signal: loved ? 'liked' : 'saved',
    occasion,
  }).catch(() => {});
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
