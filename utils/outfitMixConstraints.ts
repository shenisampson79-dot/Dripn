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
