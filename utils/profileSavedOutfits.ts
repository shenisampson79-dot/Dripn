import type { SavedLookbookOutfit } from '@/services/DFYService';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { SavedOutfitTableRow } from '@/components/outfit/SavedOutfitsTable';
import { resolveDFYItemImageUri, type RawDFYOutfitItem } from '@/utils/dfyOutfitImages';
import { sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';

export type MixAndMatchSavedOutfit = {
  id: string;
  name: string;
  description?: string | null;
  occasion?: string;
  tags?: string[];
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
  const occasionTag = outfit.tags?.find((tag) => tag !== 'mix-and-match');
  return occasionTag ? occasionTag.replace(/-/g, ' ') : 'Custom';
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
    const rawItems = outfit.items || [];
    const ordered = sortOutfitItemsByVisualOrder(
      rawItems.map((item) => ({
        id: String(item.id),
        name: item.name,
        category: item.category,
      })),
    );
    const previewItems = ordered.map((slot) => {
      const item = rawItems.find((row) => String(row.id) === String(slot.id));
      const wardrobe = wardrobeItems.find((w) => String(w.id) === String(slot.id));
      const imageUri = item?.imageUri || item?.imageUrl || wardrobe?.imageUri || wardrobe?.enhancedImageUri || null;
      return {
        id: String(slot.id),
        name: item?.name || slot.name || 'Item',
        imageUri,
      };
    });

    const occasionLabel = mixOccasionLabel(outfit);

    return {
      id: `mix-${outfit.id}`,
      title: outfit.name || 'My Outfit',
      description: outfit.description?.trim() || occasionLabel,
      itemCount: rawItems.length,
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
