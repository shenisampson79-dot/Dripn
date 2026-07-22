import type { SavedLookbookOutfit } from '@/services/DFYService';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { SavedOutfitTableRow } from '@/components/outfit/SavedOutfitsTable';
import type { OutfitPieceVisual } from '@/components/OutfitPiecesVisual';
import { resolveDFYItemImageUri, type RawDFYOutfitItem } from '@/utils/dfyOutfitImages';
import { sortOutfitItemsByVisualOrder } from '@/utils/outfitItemOrder';
import {
  buildWardrobeImageProxyUrl,
  enrichWardrobeItemForOutfitVisual,
  normalizeRemoteApiUrl,
  resolveWardrobeImageUri,
} from '@/utils/wardrobeImage';
import {
  getLocalizedLookbookDayTag,
  getLocalizedLookbookTitle,
} from '@/utils/profileLabelLocalization';

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
  wardrobeItemIds?: string[];
};

type TranslateFn = (key: string) => string;

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

function mixOutfitItemIds(outfit: MixAndMatchSavedOutfit): string[] {
  const fromItems = (outfit.items || []).map((item) => String(item.id)).filter(Boolean);
  if (fromItems.length > 0) return [...new Set(fromItems)];

  const fromIds = [
    ...(outfit.wardrobeItemIds || []),
    ...(outfit.wardrobe_item_ids || []),
  ].map((id) => String(id)).filter(Boolean);

  return [...new Set(fromIds)];
}

function resolveMixItemImageUri(
  itemId: string,
  apiItem: { imageUri?: string | null; imageUrl?: string | null } | undefined,
  wardrobe: WardrobeItem | undefined,
): string | null {
  // Prefer durable server / cutout URLs (same priority as DFY calendar lookbook items)
  const serverUri =
    normalizeRemoteApiUrl(apiItem?.imageUri) ||
    normalizeRemoteApiUrl(apiItem?.imageUrl) ||
    (typeof apiItem?.imageUri === 'string' && apiItem.imageUri.length > 0 && !apiItem.imageUri.startsWith('data:')
      ? apiItem.imageUri
      : null) ||
    (typeof apiItem?.imageUrl === 'string' && apiItem.imageUrl.length > 0 && !apiItem.imageUrl.startsWith('data:')
      ? apiItem.imageUrl
      : null);

  if (wardrobe) {
    const enriched = enrichWardrobeItemForOutfitVisual(wardrobe);
    const wardrobeUri = resolveWardrobeImageUri(enriched);
    if (wardrobeUri) return wardrobeUri;
  }

  if (serverUri) return serverUri;

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
  const uniqueIds = mixOutfitItemIds(outfit);

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

/** Build stacked visual pieces the same way calendar / lookbook saves do. */
export function mixOutfitToVisualPieces(
  outfit: MixAndMatchSavedOutfit,
  wardrobeItems: WardrobeItem[],
): OutfitPieceVisual[] {
  const resolvedItems = resolveMixOutfitItems(outfit, wardrobeItems);
  const orderedItems = sortOutfitItemsByVisualOrder(
    resolvedItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
    })),
  );

  return orderedItems
    .map((slot) => {
      const item = resolvedItems.find((row) => String(row.id) === String(slot.id));
      const wardrobe = wardrobeItems.find((w) => String(w.id) === String(slot.id));
      const imageUri =
        item?.imageUri ||
        (wardrobe
          ? resolveDFYItemImageUri(
              { id: slot.id, name: item?.name || slot.name, category: item?.category || slot.category } as RawDFYOutfitItem,
              wardrobe,
            )
          : null) ||
        (slot.id ? buildWardrobeImageProxyUrl(slot.id) : null);

      return {
        wardrobeItemId: slot.id,
        name: item?.name || slot.name || 'Item',
        category: item?.category || slot.category || wardrobe?.category,
        imageUrl: imageUri,
      };
    })
    .filter((piece) => Boolean(piece.imageUrl || piece.wardrobeItemId));
}

export function buildSavedOutfitTableRows(
  lookbookOutfits: SavedLookbookOutfit[],
  mixOutfits: MixAndMatchSavedOutfit[],
  wardrobeItems: WardrobeItem[],
  t?: TranslateFn,
): SavedOutfitTableRow[] {
  const translate: TranslateFn = t || ((key) => key);

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

    const dayTag = getLocalizedLookbookDayTag(outfit.dayNumber, translate);
    const itemsLabel = (translate('profile.itemsCount') || '{count} items').replace(
      '{count}',
      String(ordered.length),
    );

    return {
      id: `lookbook-${outfit.id}`,
      title: getLocalizedLookbookTitle(outfit.title, outfit.dayNumber, translate),
      description: outfit.description || outfit.stylistNote || itemsLabel,
      itemCount: ordered.length,
      badgeLabel: dayTag,
      badgeColors: ['#E07A5F', '#C46A4F'] as const,
      previewItems: previewFromItems(previewItems),
    };
  });

  const mixRows: SavedOutfitTableRow[] = mixOutfits
    .map((outfit) => {
      const resolvedItems = resolveMixOutfitItems(outfit, wardrobeItems);
      if (resolvedItems.length === 0) return null;

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
      const loved = outfit.tags?.includes('loved');

      return {
        id: `mix-${outfit.id}`,
        title: outfit.name || translate('profile.myOutfit') || 'My Outfit',
        description: outfit.description?.trim() || occasionLabel,
        itemCount: resolvedItems.length,
        badgeLabel: loved
          ? translate('profile.lovedOutfit') || 'Loved Outfit'
          : translate('profile.myOutfit') || 'My Outfit',
        badgeColors: loved
          ? (['#E8B4B8', '#DB2777'] as const)
          : (['#E8B4B8', '#8B2F39'] as const),
        previewItems: previewFromItems(previewItems),
      };
    })
    .filter((row): row is SavedOutfitTableRow => Boolean(row));

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

export { resolveMixOutfitItems, resolveMixItemImageUri, mixOutfitItemIds };
