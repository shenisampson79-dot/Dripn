/**
 * Outfit Mix occasion constraints — prune for scoring preference, not erasure.
 * Visibility is governed by UI Reality Layer: owned items must remain browsable.
 *
 * Mirrors Dripn-Server/services/outfitMixConstraints.js for ban reasons,
 * but Mix reels use soft demotion + ensureMinimumCoverage (not silent drop).
 */

import {
  isAthleticTopOverride,
  isAthleticBottomOverride,
  isCargoOverride,
  isAthleticFootwearOverride,
  resolveGarmentFamily,
  GARMENT_FAMILY,
} from '@/utils/garmentCategory';
import {
  OUTFIT_MIX_COVERAGE,
  ensureMinimumCoverage,
  partitionMixVisibility,
} from '@/utils/uiRealityLayer/outfitMixUiReality';

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
  imageUri?: string | null;
  enhancedImageUri?: string | null;
  originalImageUri?: string | null;
  imageUrl?: string | null;
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

export function hasMixDisplayImage(item: ItemLike): boolean {
  if (!item) return false;
  return [
    item.enhancedImageUri,
    item.imageUri,
    item.originalImageUri,
    item.imageUrl,
  ].some((u) => typeof u === 'string' && u.trim().length > 0);
}

/**
 * Mark items missing display images for UI fallback (icon tile).
 * Never drop inventory — blank cards become labeled placeholders.
 */
export function withMixImageFallback<T extends ItemLike>(item: T, _reelKey: string): T & {
  _mixImageFallback?: boolean;
  softBanned?: boolean;
} {
  if (hasMixDisplayImage(item)) return item;
  return { ...item, _mixImageFallback: true };
}

function candidatesForReel<T extends ItemLike>(items: T[], key: string): T[] {
  if (key === 'tops') {
    return items.filter((i) => i.category === 'tops' || i.category === 'activewear_tops');
  }
  if (key === 'bottoms') return items.filter((i) => isMixBottomsCandidate(i));
  if (key === 'shoes') return items.filter((i) => isMixShoesCandidate(i));
  return items.filter((i) => i.category === key);
}

function minCoverageForReel(key: string): number {
  if (key === 'bottoms') return OUTFIT_MIX_COVERAGE.bottoms;
  if (key === 'shoes') return OUTFIT_MIX_COVERAGE.shoes;
  if (key === 'tops') return OUTFIT_MIX_COVERAGE.tops;
  return 1;
}

/**
 * Build swipe pools for Outfit Mix.
 *
 * Visibility ≠ scoring preference:
 * - Preferred = passes occasion prune (sorted first)
 * - Soft-visible = owned but demoted (cargo/trainers on work) — still shown
 * - ensureMinimumCoverage backfills so filters cannot collapse a row to 1 item
 * - Missing images get category fallbacks (never silent inventory loss)
 */
export function buildMixReelPools<T extends ItemLike & { category?: string | null; id?: string | null }>(
  catalogue: T[],
  occasion: string | null | undefined,
  selection: Partial<Record<string, string | null>>,
  reelKeys: readonly string[] = MIX_REEL_KEYS,
): Record<string, T[]> {
  const items = Array.isArray(catalogue) ? catalogue : [];
  const map: Record<string, T[]> = {};

  for (const key of reelKeys) {
    const allCandidates = candidatesForReel(items, key);
    // Preferred order for occasion — never the sole visibility source
    const pruned = pruneMixCandidates(allCandidates, occasion, {
      allowLifestyleTrainers: true,
    });
    const { preferred, softVisible } = partitionMixVisibility(allCandidates, pruned.kept);
    // Visibility guarantee: every owned candidate stays browsable (preferred first).
    // ensureMinimumCoverage is a floor if partition ever under-fills vs inventory.
    const minCount = Math.min(minCoverageForReel(key), allCandidates.length);
    let list = ensureMinimumCoverage(
      [...preferred, ...softVisible],
      softVisible,
      allCandidates,
      minCount,
    );

    // Mark soft-banned for UI opacity / scoring hints (optional consumers)
    const preferredIds = new Set(preferred.map((i) => String(i.id)));
    list = list.map((item) => {
      const withImg = withMixImageFallback(item, key);
      if (preferredIds.has(String(item.id))) return withImg as T;
      return { ...withImg, softBanned: true } as T;
    });

    const selectedId = selection[key];
    if (selectedId && !list.some((i) => i.id === selectedId)) {
      const selectedItem = items.find((i) => i.id === selectedId);
      if (selectedItem) {
        list = [withMixImageFallback(selectedItem, key) as T, ...list];
      }
    }
    map[key] = list;
  }
  return map;
}

/**
 * Filter transparency: fraction of reel inventory dropped by hard prune alone.
 * UI Reality fails if drop ratio is extreme while inventory remains.
 */
export function mixFilterDropRatio(
  catalogue: ItemLike[],
  reelKey: string,
  occasion?: string | null,
): number {
  const all = candidatesForReel(catalogue, reelKey);
  if (!all.length) return 0;
  const kept = pruneMixCandidates(all, occasion, { allowLifestyleTrainers: true }).kept.length;
  return 1 - kept / all.length;
}

/**
 * Occasion chip contract: selection IDs are immutable across chip changes.
 */
export function preserveSelectionAcrossOccasion<T extends Partial<Record<string, string | null>>>(
  selection: T,
): T {
  return { ...selection };
}
