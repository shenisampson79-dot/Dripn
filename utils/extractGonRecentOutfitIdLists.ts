/**
 * Recent GON outfit id lists from persisted session options — newest first.
 */
import type { ScanOutfitOption } from '@/types/scanWardrobe';

function idsFromOption(opt: ScanOutfitOption & { itemIds?: Array<string | number> }): string[] {
  if (Array.isArray(opt.itemIds) && opt.itemIds.length >= 2) {
    return opt.itemIds.map(String).filter(Boolean);
  }
  const fromOutfit = (opt.outfit?.items || [])
    .map((it) => it?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
  if (fromOutfit.length >= 2) return fromOutfit;
  const fromHydrated = (opt.hydratedItems || [])
    .map((it) => it?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
  return fromHydrated;
}

/** @returns string[][] newest look first (most recent option last in UI → iterate reverse) */
export function extractGonRecentOutfitIdLists(
  options: ScanOutfitOption[],
  limit = 5,
): string[][] {
  const out: string[][] = [];
  const list = Array.isArray(options) ? options : [];
  for (let i = list.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const ids = idsFromOption(list[i] as ScanOutfitOption & { itemIds?: Array<string | number> });
    if (ids.length >= 2) out.push(ids);
  }
  return out;
}

export function flattenGonPenalizeItemIds(recentOutfits: string[][]): string[] {
  return [...new Set(recentOutfits.flat().map(String).filter(Boolean))];
}
