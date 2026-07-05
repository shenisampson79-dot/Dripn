import type { SavedLookbookOutfit } from '@/services/DFYService';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { SavedOutfitTableRow } from '@/components/outfit/SavedOutfitsTable';
import { resolveDFYItemImageUri, type RawDFYOutfitItem } from '@/utils/dfyOutfitImages';
import { sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import { buildWardrobeImageProxyUrl, resolveWardrobeImageUri } from '@/utils/wardrobeImage';

export type MixAndMatchSavedOutfit = {
  id: string;
  name: string;
  description?: string | null;
  occasion?: string;
  tags?: string[];
  items?: Array<{
    id: string;
    name: string;
    category?: string;
    color?: string;
    colour?: string;
    imageUri?: string;
    imageUrl?: string | null;
  }>;
  wardrobe_item_ids?: string[];
};

function previewFromItems(
  items: Array<{ id: string; name: string; imageUri?: string | null }>,
): SavedOutfitTableRow['previewItems'] {
  return items.slice(0, 3).map((item) => ({
    id: String(item.id),
    name: item.name,
    imageUri: item.imageUri || null,
  }));
}

function mixOccasionLabel(outfit: MixAndMatchSavedOutfit): string {
  if (outfit.occasion) {
    return outfit.occasion.replace(/-/g, ' ');
  }
  const occasionTag = outfit.tags?.find((tag) => tag !== 'mix-and-match' && tag !== 'loved');
  return occasionTag ? occasionTag.replace(/-/g, ' ') : 'Custom';
}

function resolveMixItemImageUri(
  itemId: string,
  apiItem: { imageUri?: string | null; imageUrl?: string | null } | undefined,
  wardrobe: WardrobeItem | undefined,
): string | null {
  if (wardrobe) {
    const wardrobeUri = resolveWardrobeImageUri(wardrobe);
    if (wardrobeUri) return wardrobeUri;
  }

  const apiUri = apiItem?.imageUri || apiItem?.imageUrl;
  if (typeof apiUri === 'string' && apiUri.length > 0 && !apiUri.startsWith('data:')) {
    return apiUri;
  }

  if (itemId) {
    return buildWardrobeImageProxyUrl(itemId);
  }

  return null;
}

function resolveMixOutfitItems(
  outfit: MixAndMatchSavedOutfit,
  wardrobeItems: WardrobeItem[],
): Array<{ id: string; name: string; category?: string; imageUri: string | null }> {
  const rawItems = outfit.items || [];
  const itemIds = rawItems.length > 0
    ? rawItems.map((item) => String(item.id))
    : (outfit.wardrobe_item_ids || []).map((id) => String(id));

  const uniqueIds = [...new Set(itemIds.filter(Boolean))];

  return uniqueIds.map((id) => {
    const apiItem = rawItems.find((row) => String(row.id) === id);
    const wardrobe = wardrobeItems.find((w) => String(w.id) === id);
    return {
      id,
      name: apiItem?.name || wardrobe?.name || 'Item',
      category: apiItem?.category || wardrobe?.category,
      imageUri: resolveMixItemImageUri(id, apiItem, wardrobe),
    };
  });
}

export function buildSavedOutfitTableRows(
  lookbookOutfits: SavedLookbookOutfit[],
  mixOutfits: MixAndMatchSavedOutfit[],
  wardrobeItems: WardrobeItem[],
): SavedOutfitTableRow[] {
  const lookbookRows: SavedOutfitTableRow[] = lookbookOutfits.map((outfit) => {
    const ordered = sortOutfitItemsByVisualOrder(outfit.items || []);
    const previewItems = ordered.map((item) => {
      const wardrobe = wardrobeItems.find((w) => String(w.id) === String(item.id));
      return {
        id: String(item.id),
        name: item.name,
        imageUri: resolveDFYItemImageUri(item as RawDFYOutfitItem, wardrobe),
      };
    });

    return {
      id: `lookbook-${outfit.id}`,
      title: outfit.title || `Lookbook · Day ${outfit.dayNumber}`,
      description: outfit.description || outfit.stylistNote || `${ordered.length} items`,
      itemCount: ordered.length,
      badgeLabel: `Lookbook · Day ${outfit.dayNumber}`,
      badgeColors: ['#E07A5F', '#C46A4F'] as const,
      previewItems: previewFromItems(previewItems),
    };
  });

  const mixRows: SavedOutfitTableRow[] = mixOutfits.map((outfit) => {
    const resolvedItems = resolveMixOutfitItems(outfit, wardrobeItems);
    const ordered = sortOutfitItemsByVisualOrder(
      resolvedItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
      })),
    );
    const previewItems = ordered.map((slot) => {
      const item = resolvedItems.find((row) => String(row.id) === String(slot.id));
      return {
        id: String(slot.id),
        name: item?.name || slot.name || 'Item',
        imageUri: item?.imageUri || null,
      };
    });

    const occasionLabel = mixOccasionLabel(outfit);

    return {
      id: `mix-${outfit.id}`,
      title: outfit.name || 'My Outfit',
      description: outfit.description?.trim() || occasionLabel,
      itemCount: resolvedItems.length,
      badgeLabel: outfit.tags?.includes('loved') ? 'Loved Outfit' : 'My Outfit',
      badgeColors: outfit.tags?.includes('loved')
        ? (['#E8B4B8', '#DB2777'] as const)
        : (['#E8B4B8', '#8B2F39'] as const),
      previewItems: previewFromItems(previewItems),
    };
  });

  return [...lookbookRows, ...mixRows];
}

export function findLookbookOutfitByRowId(
  rowId: string | null,
  lookbookOutfits: SavedLookbookOutfit[],
): SavedLookbookOutfit | null {
  if (!rowId?.startsWith('lookbook-')) return null;
  const id = rowId.replace('lookbook-', '');
  return lookbookOutfits.find((outfit) => String(outfit.id) === id) || null;
}

export function findMixOutfitByRowId(
  rowId: string | null,
  mixOutfits: MixAndMatchSavedOutfit[],
): MixAndMatchSavedOutfit | null {
  if (!rowId?.startsWith('mix-')) return null;
  const id = rowId.replace('mix-', '');
  return mixOutfits.find((outfit) => String(outfit.id) === id) || null;
}

export { resolveMixOutfitItems, resolveMixItemImageUri };
