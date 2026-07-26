/**
 * Outfit Mix occasion constraints — prune invalid candidates BEFORE pick.
 * Mirrors Dripn-Server/services/outfitMixConstraints.js
 */

import {
  isAthleticTopOverride,
  isAthleticBottomOverride,
  isCargoOverride,
  isAthleticFootwearOverride,
  resolveGarmentFamily,
  GARMENT_FAMILY,
} from '@/utils/garmentCategory';
import { resolveWardrobeImageUri } from '@/utils/wardrobeImage';

export const STRICT_MIX_OCCASIONS = [
  'formal',
  'wedding',
  'work',
  'office',
  'job_interview',
  'interview',
  'business',
  'black_tie',
  'gala',
] as const;

export const PARTY_PENALIZE_ATHLETIC = [
  'party',
  'editorial',
  'evening_out',
  'evening',
] as const;

type ItemLike = {
  id?: string | null;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function normalizeOccasion(raw?: string | null): string | null {
  if (!raw) return null;
  return String(raw).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
}

export function isStrictMixOccasion(occasion?: string | null): boolean {
  const occ = normalizeOccasion(occasion);
  return Boolean(occ && (STRICT_MIX_OCCASIONS as readonly string[]).includes(occ));
}

export function isPartyMixOccasion(occasion?: string | null): boolean {
  const occ = normalizeOccasion(occasion);
  return Boolean(occ && (PARTY_PENALIZE_ATHLETIC as readonly string[]).includes(occ));
}

export function mixCandidateBanReason(item: ItemLike, occasion?: string | null): string | null {
  if (!item || !isStrictMixOccasion(occasion)) return null;
  if (isAthleticTopOverride(item)) return 'athletic_top';
  if (isAthleticBottomOverride(item)) return 'athletic_bottom';
  if (isCargoOverride(item)) return 'cargo';
  if (isAthleticFootwearOverride(item)) return 'trainers';
  const family = resolveGarmentFamily(item);
  if (family === GARMENT_FAMILY.ATHLETIC || family === GARMENT_FAMILY.FOOTWEAR_ATHLETIC) {
    return 'athletic_family';
  }
  return null;
}

export function pruneMixCandidates<T extends ItemLike>(
  items: T[],
  occasion?: string | null,
  options: { allowLifestyleTrainers?: boolean } = {},
): { kept: T[]; removed: T[]; reasons: Record<string, string> } {
  const list = Array.isArray(items) ? items : [];
  if (!isStrictMixOccasion(occasion)) {
    return { kept: list.slice(), removed: [], reasons: {} };
  }
  const allowTrainers = options.allowLifestyleTrainers === true;
  const kept: T[] = [];
  const removed: T[] = [];
  const reasons: Record<string, string> = {};
  for (const item of list) {
    let reason = mixCandidateBanReason(item, occasion);
    if (reason === 'trainers' && allowTrainers && !/\b(running|gym|hoka|performance|chunky)\b/i.test(`${item.name || ''}`)) {
      reason = null;
    }
    if (reason) {
      removed.push(item);
      reasons[String(item.id || item.name)] = reason;
    } else {
      kept.push(item);
    }
  }
  return { kept, removed, reasons };
}

export function buildMixOccasionConstraints(occasion?: string | null) {
  const occ = normalizeOccasion(occasion);
  if (!occ) {
    return {
      occasion: null as string | null,
      banAthleticTops: false,
      banAthleticBottoms: false,
      banCargo: false,
      banTrainers: false,
      strict: false,
      partyPenalizeAthletic: false,
    };
  }
  const strict = isStrictMixOccasion(occ);
  return {
    occasion: occ,
    banAthleticTops: strict || isPartyMixOccasion(occ),
    banAthleticBottoms: strict,
    banCargo: strict,
    banTrainers: strict,
    strict,
    partyPenalizeAthletic: isPartyMixOccasion(occ),
  };
}

export function filterCatalogueForMixOccasion<T extends ItemLike>(
  catalogue: T[],
  occasion?: string | null,
  options: { allowLifestyleTrainers?: boolean } = {},
): T[] {
  return pruneMixCandidates(catalogue, occasion, options).kept;
}

/** Default Outfit Mix reel category order (body top → feet). */
export const MIX_REEL_KEYS = [
  'outerwear',
  'tops',
  'dresses',
  'formal',
  'bottoms',
  'shoes',
] as const;

export type MixReelKey = (typeof MIX_REEL_KEYS)[number];

function itemBlob(item: ItemLike): string {
  return `${item?.name || ''} ${item?.subcategory || ''} ${item?.category || ''}`.toLowerCase();
}

/** Bottoms reel: wardrobe bottoms + formal trousers/skirts (not jackets/shirts). */
export function isMixBottomsCandidate(item: ItemLike): boolean {
  const cat = String(item?.category || '').toLowerCase();
  if (cat === 'bottoms' || cat === 'activewear_bottoms') return true;
  if (cat !== 'formal') return false;
  const t = itemBlob(item);
  if (/\b(blazer|jacket|coat|shirt|tuxedo|waistcoat|suit jacket|tie|bow)\b/.test(t)) return false;
  return /\b(trousers?|pants?|slacks?|chinos?|skirt|shorts?|jeans?)\b/.test(t);
}

/** Shoes reel: shoes category + formal footwear mis-filed under formal. */
export function isMixShoesCandidate(item: ItemLike): boolean {
  const cat = String(item?.category || '').toLowerCase();
  if (cat === 'shoes') return true;
  if (cat !== 'formal') return false;
  return /\b(shoes?|oxford|loafer|derby|brogue|boot|heel|pump|trainer|sneaker|sandal)\b/.test(itemBlob(item));
}

/** Skip blank cards when nothing can be resolved for display. */
export function hasMixDisplayImage(item: ItemLike & {
  id?: string | null;
  imageUri?: string | null;
  enhancedImageUri?: string | null;
  originalImageUri?: string | null;
  imageUrl?: string | null;
}): boolean {
  if (!item) return false;
  const raw = [
    (item as any).enhancedImageUri,
    (item as any).imageUri,
    (item as any).originalImageUri,
    (item as any).imageUrl,
  ].some((u) => typeof u === 'string' && u.trim().length > 0);
  if (raw) return true;
  try {
    return Boolean(resolveWardrobeImageUri(item as any)?.trim());
  } catch {
    return Boolean(item.id);
  }
}

/**
 * Build swipe pools for Outfit Mix.
 * Selection is LOCKED: occasion may prune candidates, but never strips the
 * currently selected piece from a reel (banned items stay visible/scorable).
 */
export function buildMixReelPools<T extends ItemLike & { category?: string | null; id?: string | null }>(
  catalogue: T[],
  occasion: string | null | undefined,
  selection: Partial<Record<string, string | null>>,
  reelKeys: readonly string[] = MIX_REEL_KEYS,
): Record<string, T[]> {
  const items = Array.isArray(catalogue) ? catalogue : [];
  // Work/formal: keep lifestyle trainers in the shoes reel so users can still
  // browse what they own; scoring already warns when they're wrong for the occasion.
  const pool = isStrictMixOccasion(occasion)
    ? filterCatalogueForMixOccasion(items, occasion, { allowLifestyleTrainers: true })
    : items;
  const map: Record<string, T[]> = {};
  for (const key of reelKeys) {
    let list: T[];
    if (key === 'tops') {
      list = pool.filter((i) => i.category === 'tops' || i.category === 'activewear_tops');
    } else if (key === 'bottoms') {
      list = pool.filter((i) => isMixBottomsCandidate(i));
    } else if (key === 'shoes') {
      list = pool.filter((i) => isMixShoesCandidate(i));
    } else {
      list = pool.filter((i) => i.category === key);
    }
    list = list.filter((i) => hasMixDisplayImage(i));
    const selectedId = selection[key];
    if (selectedId && !list.some((i) => i.id === selectedId)) {
      const selectedItem = items.find((i) => i.id === selectedId);
      if (selectedItem) list = [selectedItem, ...list];
    }
    map[key] = list;
  }
  return map;
}

/**
 * Occasion chip contract: selection IDs are immutable across chip changes.
 * Evaluation/reels may change; selectedOutfit must not.
 */
export function preserveSelectionAcrossOccasion<T extends Partial<Record<string, string | null>>>(
  selection: T,
): T {
  return { ...selection };
}
