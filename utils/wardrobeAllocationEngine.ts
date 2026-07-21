/**
 * Constraint-first multi-day wardrobe allocation with honest fallback modes.
 * AI does not choose inventory — this engine owns truth; AI may only decorate later.
 *
 * Modes (degrade in order, never fake variety):
 * 1. STRICT — no laundry-sensitive reuse; shoes unique when possible
 * 2. SOFT — shoe / accessory / outerwear soft reuse only
 * 3. ROTATION — spaced reuse of tops/bottoms with different pairings (transparent)
 * 4. FAILURE — explain capacity; do not invent outfits
 */

import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isAccessoryItem,
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import { passesEditorialOccasionGate } from '@/utils/fashionEditorialRubric';
import { isOutfitValid } from '@/utils/outfitClashRules';
import { orderItemIdsByVisualOrder } from '@/utils/outfitItemOrder';
import {
  canWearItem,
  computeWardrobePressure,
  DEFAULT_LAUNDRY_PROFILE,
  resolveCanWearRelaxLevel,
  reuseScoreComponent,
  type LaundryProfile,
} from '@/utils/wearRules';

export type AllocationMode = 'strict' | 'soft' | 'rotation' | 'failure';

export type DayAllocation = {
  dayIndex: number;
  occasionType: OutfitOccasionId;
  itemIds: string[];
  reusedSoftIds: string[];
  reusedHardIds: string[];
};

export type AllocationCapacity = {
  tops: number;
  bottoms: number;
  shoes: number;
  maxStrictOutfits: number;
  maxWithSoftShoes: number;
};

export type AllocationResult =
  | {
      ok: true;
      mode: Exclude<AllocationMode, 'failure'>;
      days: DayAllocation[];
      capacity: AllocationCapacity;
      reducedDays: boolean;
      modeLabel: string;
      modeExplanation: string;
    }
  | {
      ok: false;
      mode: 'failure';
      reason: 'insufficient_wardrobe' | 'unsolvable';
      capacity: AllocationCapacity;
      message: string;
      maxPossibleDays: number;
      guidance: string[];
    };

type UsageLog = {
  lastDay: Map<string, number>;
  weekCount: Map<string, number>;
};

const CATEGORY_WEIGHT = {
  top: 5,
  bottom: 5,
  outerwear: 3,
  shoes: 2,
  accessory: 1,
} as const;

/** Caps combinatorial search for single-day paths (Today's outfit chip). */
export const SINGLE_DAY_POOL_CAP = 12;

function capPoolForSingleDay(items: WardrobeItem[], cap = SINGLE_DAY_POOL_CAP): WardrobeItem[] {
  return items.length <= cap ? items : items.slice(0, cap);
}

function isLaundrySensitive(item: WardrobeItem): boolean {
  return isTopItem(item) || isBottomItem(item) || isOuterwearItem(item);
}

function isGymPreferred(item: WardrobeItem): boolean {
  const cat = String(item.category || '').toLowerCase();
  const text = `${item.name || ''} ${item.subcategory || ''}`.toLowerCase();
  if (cat.includes('activewear')) return true;
  if (/\b(gym|training|running|workout|legging|jogger|track|trainer|sneaker|sports?)\b/.test(text)) {
    return true;
  }
  if (Array.isArray(item.occasions) && item.occasions.includes('workout')) return true;
  return false;
}

function preferForOccasion(items: WardrobeItem[], occasion: OutfitOccasionId): WardrobeItem[] {
  const gated = items.filter((item) => passesEditorialOccasionGate(item, occasion));
  if (occasion !== 'gym') return gated;

  const preferred = gated.filter(isGymPreferred);
  const tops = preferred.filter(isTopItem);
  const bottoms = preferred.filter(isBottomItem);
  const shoes = preferred.filter(isShoesItem);
  if (tops.length >= 1 && bottoms.length >= 1 && shoes.length >= 1) {
    return preferred;
  }
  return gated;
}

export function buildOccasionPools(wardrobe: WardrobeItem[], occasion: OutfitOccasionId) {
  const pool = preferForOccasion(wardrobe, occasion);
  return {
    tops: pool.filter(isTopItem),
    bottoms: pool.filter(isBottomItem),
    shoes: pool.filter(isShoesItem),
    outerwear: pool.filter(isOuterwearItem),
    accessories: pool.filter(isAccessoryItem),
    all: pool,
  };
}

export function computeAllocationCapacity(
  wardrobe: WardrobeItem[],
  occasion: OutfitOccasionId,
): AllocationCapacity {
  const { tops, bottoms, shoes } = buildOccasionPools(wardrobe, occasion);
  const topN = tops.length;
  const bottomN = bottoms.length;
  const shoeN = shoes.length;
  return {
    tops: topN,
    bottoms: bottomN,
    shoes: shoeN,
    maxStrictOutfits: Math.min(topN, bottomN, Math.max(shoeN, 0)),
    maxWithSoftShoes: Math.min(topN, bottomN),
  };
}

export function resolveAllocationMode(
  requestedDays: number,
  capacity: AllocationCapacity,
): AllocationMode {
  if (capacity.maxWithSoftShoes < 1) return 'failure';
  if (requestedDays <= capacity.maxStrictOutfits) return 'strict';
  if (requestedDays <= capacity.maxWithSoftShoes) return 'soft';
  return 'rotation';
}

export function modeUserCopy(
  mode: AllocationMode,
  capacity: AllocationCapacity,
  requestedDays: number,
  occasion: OutfitOccasionId,
): { label: string; explanation: string; guidance: string[] } {
  const gym = occasion === 'gym';
  const pieceLine = `Tops ${capacity.tops} · bottoms ${capacity.bottoms} · shoes ${capacity.shoes}`;
  switch (mode) {
    case 'strict':
      return {
        label: 'Full rotation available',
        explanation: 'Enough unique pieces for every day — no sweaty-item reuse.',
        guidance: [],
      };
    case 'soft':
      return {
        label: 'Limited wardrobe — smart reuse applied',
        explanation: `${pieceLine}. Unique tops/bottoms each day; shoes may repeat when needed.`,
        guidance: [],
      };
    case 'rotation':
      return {
        label: 'Rotation mode active',
        explanation: gym
          ? `${pieceLine}. Not enough unique gym sets for ${requestedDays} days — spaced reuse with different pairings.`
          : `${pieceLine}. Not enough unique outfits for ${requestedDays} days — spaced reuse with different pairings.`,
        guidance: [
          `You asked for ${requestedDays} days but only have ~${capacity.maxWithSoftShoes} unique top+bottom sets.`,
          'Reuse is spaced and pairings change — not the same outfit pasted N times.',
          gym ? 'Add 1–2 more gym tops/bottoms for full no-reuse variety.' : 'Add more tops/bottoms for full variety.',
        ],
      };
    case 'failure':
    default:
      return {
        label: 'Need more items for full variety',
        explanation: gym
          ? `Not enough gym-appropriate pieces (${pieceLine}) to build outfits.`
          : `Not enough tops, bottoms, and shoes (${pieceLine}) to build outfits.`,
        guidance: [
          gym
            ? 'Add at least one gym top, bottom, and trainers.'
            : 'Add tops, bottoms, and shoes so we can plan days.',
          'Or choose fewer days once you have a usable set.',
        ],
      };
  }
}

function colorKey(item: WardrobeItem): string {
  return String(item.color || 'unknown').toLowerCase().trim();
}

function silhouetteKey(item: WardrobeItem): string {
  return String(item.subcategory || item.category || 'item').toLowerCase();
}

function categoryWeight(item: WardrobeItem): number {
  if (isTopItem(item)) return CATEGORY_WEIGHT.top;
  if (isBottomItem(item)) return CATEGORY_WEIGHT.bottom;
  if (isOuterwearItem(item)) return CATEGORY_WEIGHT.outerwear;
  if (isShoesItem(item)) return CATEGORY_WEIGHT.shoes;
  return CATEGORY_WEIGHT.accessory;
}

function daysSinceUsed(itemId: string, dayIndex: number, log: UsageLog): number {
  const last = log.lastDay.get(itemId);
  if (last == null) return 999;
  return dayIndex - last;
}

function isSameFullOutfitAsPrevious(items: WardrobeItem[], previous: WardrobeItem[] | null): boolean {
  if (!previous?.length || items.length !== previous.length) return false;
  const prevIds = new Set(previous.map((i) => String(i.id)));
  return items.every((item) => prevIds.has(String(item.id)));
}

/** Score(O) = V(O) - R(O) - C(O); higher is better. */
function scoreCombo(
  items: WardrobeItem[],
  dayIndex: number,
  previous: WardrobeItem[] | null,
  log: UsageLog,
  mode: Exclude<AllocationMode, 'failure'>,
  occasion: OutfitOccasionId,
  laundryProfile: LaundryProfile,
  referenceDate: Date,
  wardrobePressure: number,
): number {
  let score = 0;
  const gym = occasion === 'gym';

  if (isSameFullOutfitAsPrevious(items, previous)) {
    score -= 10000;
  }

  // Variety vs previous day
  if (previous?.length) {
    const prevColors = new Set(previous.map(colorKey));
    const prevSil = new Set(previous.map(silhouetteKey));
    const prevIds = new Set(previous.map((i) => String(i.id)));
    for (const item of items) {
      const id = String(item.id);
      if (!prevIds.has(id)) score += 4;
      if (!prevColors.has(colorKey(item))) score += 2;
      if (!prevSil.has(silhouetteKey(item))) score += 1;
    }
  }

  score += reuseScoreComponent(items, referenceDate, laundryProfile, wardrobePressure);

  // Reuse penalty R(O)
  for (const item of items) {
    const id = String(item.id);
    const days = daysSinceUsed(id, dayIndex, log);
    const w = categoryWeight(item);
    const uses = log.weekCount.get(id) || 0;

    if (mode === 'strict') {
      if (days < 999 && isLaundrySensitive(item)) score -= 1000 * w;
      else if (days < 999 && isShoesItem(item)) score -= 50 * w;
    } else if (mode === 'soft') {
      if (days < 999 && isLaundrySensitive(item)) score -= 1000 * w;
      else if (days < 999 && isShoesItem(item)) score -= 8 * w;
      else if (days < 999) score -= 4 * w;
    } else {
      // rotation: spaced reuse — heavy if too soon; prefer less-used pieces without hard-failing long plans
      const gap = gym ? 2 : 1;
      if (isLaundrySensitive(item)) {
        if (days < gap) score -= 300 * w;
        else if (days < 7) score -= 20 * w;
        score -= Math.min(uses, 8) * 3 * w; // soft preference for fresher pieces
      } else if (isShoesItem(item)) {
        if (days < 1) score -= 10 * w;
      }
      // Require different pairing when reusing a top: bonus already from prevIds
    }
  }

  // Hard incomplete would be filtered out; small bonus for optional pieces
  if (items.some(isOuterwearItem)) score += 0.5;

  return score;
}

type Combo = {
  top: WardrobeItem;
  bottom: WardrobeItem;
  shoes: WardrobeItem;
  outerwear?: WardrobeItem;
  accessory?: WardrobeItem;
};

function comboItems(combo: Combo): WardrobeItem[] {
  return [combo.top, combo.bottom, combo.shoes, combo.outerwear, combo.accessory].filter(
    Boolean,
  ) as WardrobeItem[];
}

/**
 * First optional piece that keeps the full outfit hard-valid.
 * Prefer omit over forcing an invalid accessory/outerwear (no first-fit).
 */
function pickValidOptional(
  candidates: WardrobeItem[],
  baseItems: WardrobeItem[],
  dayIndex: number,
  log: UsageLog,
  mode: Exclude<AllocationMode, 'failure'>,
  occasion: OutfitOccasionId,
  laundryProfile: LaundryProfile,
  referenceDate: Date,
  canWearRelaxLevel: 0 | 1 | 2,
): WardrobeItem | undefined {
  for (const item of candidates) {
    if (!itemAllowed(item, dayIndex, log, mode, occasion, laundryProfile, referenceDate, canWearRelaxLevel)) continue;
    if (isOutfitValid([...baseItems, item])) return item;
  }
  return undefined;
}

function itemAllowed(
  item: WardrobeItem,
  dayIndex: number,
  log: UsageLog,
  mode: Exclude<AllocationMode, 'failure'>,
  occasion: OutfitOccasionId,
  laundryProfile: LaundryProfile,
  referenceDate: Date,
  canWearRelaxLevel: 0 | 1 | 2,
): boolean {
  const id = String(item.id);
  const days = daysSinceUsed(id, dayIndex, log);
  const gym = occasion === 'gym';

  if (!canWearItem(item, referenceDate, laundryProfile, { relaxLevel: canWearRelaxLevel })) {
    return false;
  }

  if (mode === 'strict') {
    return days >= 999;
  }
  if (mode === 'soft') {
    // Soft: never reuse tops/bottoms; shoes / outerwear / accessories OK
    if (isTopItem(item) || isBottomItem(item)) return days >= 999;
    return true;
  }
  // rotation — spaced reuse; scoring prefers less-used pieces (no hard weekly cap that breaks long DFY plans)
  if (isLaundrySensitive(item)) {
    const gap = gym ? 2 : 1;
    if (days < gap) return false;
    return true;
  }
  return true;
}

function filterPoolWithWearConstraints(
  items: WardrobeItem[],
  dayIndex: number,
  log: UsageLog,
  mode: Exclude<AllocationMode, 'failure'>,
  occasion: OutfitOccasionId,
  laundryProfile: LaundryProfile,
  referenceDate: Date,
  minNeeded: number,
): { items: WardrobeItem[]; relaxLevel: 0 | 1 | 2; pressure: number } {
  const base = items.filter((item) =>
    itemAllowed(item, dayIndex, log, mode, occasion, laundryProfile, referenceDate, 0),
  );
  let pressure = computeWardrobePressure(base.length, minNeeded);
  if (base.length >= minNeeded) {
    return { items: base, relaxLevel: 0, pressure };
  }

  for (const relaxLevel of [1, 2] as const) {
    const relaxed = items.filter((item) =>
      itemAllowed(item, dayIndex, log, mode, occasion, laundryProfile, referenceDate, relaxLevel),
    );
    pressure = computeWardrobePressure(relaxed.length, minNeeded);
    if (relaxed.length >= minNeeded) {
      return { items: relaxed, relaxLevel, pressure };
    }
  }

  const fallback = items.filter((item) =>
    itemAllowed(item, dayIndex, log, mode, occasion, laundryProfile, referenceDate, 2),
  );
  return {
    items: fallback.length ? fallback : base,
    relaxLevel: 2,
    pressure: computeWardrobePressure(fallback.length, minNeeded),
  };
}

function markUsage(items: WardrobeItem[], dayIndex: number, log: UsageLog): void {
  for (const item of items) {
    const id = String(item.id);
    log.lastDay.set(id, dayIndex);
    log.weekCount.set(id, (log.weekCount.get(id) || 0) + 1);
  }
}

function classifyReuse(
  items: WardrobeItem[],
  dayIndex: number,
  log: UsageLog,
): { soft: string[]; hard: string[] } {
  const soft: string[] = [];
  const hard: string[] = [];
  for (const item of items) {
    const id = String(item.id);
    if (daysSinceUsed(id, dayIndex, log) >= 999) continue;
    if (isLaundrySensitive(item)) hard.push(id);
    else soft.push(id);
  }
  return { soft, hard };
}

function allocateWithMode(params: {
  wardrobe: WardrobeItem[];
  occasionTypes: OutfitOccasionId[];
  mode: Exclude<AllocationMode, 'failure'>;
  daysToPlan: number;
  laundryProfile?: LaundryProfile;
  referenceDate?: Date;
}): DayAllocation[] | null {
  const {
    wardrobe,
    occasionTypes,
    mode,
    daysToPlan,
    laundryProfile = DEFAULT_LAUNDRY_PROFILE,
    referenceDate = new Date(),
  } = params;
  const primaryOccasion = occasionTypes[0] || 'casual_day';
  const log: UsageLog = { lastDay: new Map(), weekCount: new Map() };
  const days: DayAllocation[] = [];
  let previous: WardrobeItem[] | null = null;

  for (let dayIndex = 0; dayIndex < daysToPlan; dayIndex++) {
    const occasionType = occasionTypes[dayIndex] || primaryOccasion;
    const planDate = new Date(referenceDate);
    planDate.setDate(planDate.getDate() + dayIndex);
    const pools = buildOccasionPools(wardrobe, occasionType);
    const boundPools = daysToPlan === 1
      ? {
          tops: capPoolForSingleDay(pools.tops),
          bottoms: capPoolForSingleDay(pools.bottoms),
          shoes: capPoolForSingleDay(pools.shoes),
          outerwear: capPoolForSingleDay(pools.outerwear),
          accessories: capPoolForSingleDay(pools.accessories),
        }
      : pools;

    const topsFiltered = filterPoolWithWearConstraints(
      boundPools.tops,
      dayIndex,
      log,
      mode,
      occasionType,
      laundryProfile,
      planDate,
      1,
    );
    const bottomsFiltered = filterPoolWithWearConstraints(
      boundPools.bottoms,
      dayIndex,
      log,
      mode,
      occasionType,
      laundryProfile,
      planDate,
      1,
    );
    const shoesFiltered = filterPoolWithWearConstraints(
      boundPools.shoes,
      dayIndex,
      log,
      mode,
      occasionType,
      laundryProfile,
      planDate,
      1,
    );
    const canWearRelaxLevel = resolveCanWearRelaxLevel(
      Math.max(topsFiltered.pressure, bottomsFiltered.pressure, shoesFiltered.pressure),
    );
    const wardrobePressure = Math.max(
      topsFiltered.pressure,
      bottomsFiltered.pressure,
      shoesFiltered.pressure,
    );

    const tops = topsFiltered.items;
    const bottoms = bottomsFiltered.items;
    let shoes = shoesFiltered.items;
    if (!shoes.length && (mode === 'soft' || mode === 'rotation')) {
      shoes = boundPools.shoes.filter((item) =>
        canWearItem(item, planDate, laundryProfile, { relaxLevel: canWearRelaxLevel }),
      );
      if (!shoes.length) shoes = boundPools.shoes;
    }

    if (!tops.length || !bottoms.length || !shoes.length) return null;

    let best: Combo | null = null;
    let bestScore = -Infinity;

    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoe of shoes) {
          // Rotation: never repeat yesterday's exact top+bottom pair; when reusing one, switch the other
          if (mode === 'rotation' && previous) {
            const topReuse = daysSinceUsed(String(top.id), dayIndex, log) < 999;
            const bottomReuse = daysSinceUsed(String(bottom.id), dayIndex, log) < 999;
            const samePairAsYesterday =
              previous.some((p) => String(p.id) === String(top.id))
              && previous.some((p) => String(p.id) === String(bottom.id));
            if (samePairAsYesterday) continue;
            if (topReuse && previous.some((p) => String(p.id) === String(bottom.id))) continue;
            if (bottomReuse && previous.some((p) => String(p.id) === String(top.id))) continue;
          }

          if (isSameFullOutfitAsPrevious([top, bottom, shoe], previous)) continue;

          const baseItems: WardrobeItem[] = [top, bottom, shoe];
          // Hard filter before soft reuse/variety scoring — invalid outfits never enter the candidate set
          if (!isOutfitValid(baseItems)) continue;

          const outerwear = pickValidOptional(
            boundPools.outerwear,
            baseItems,
            dayIndex,
            log,
            mode,
            occasionType,
            laundryProfile,
            planDate,
            canWearRelaxLevel,
          );
          const withOuterwear = outerwear ? [...baseItems, outerwear] : baseItems;
          const accessory =
            occasionType === 'gym'
              ? undefined
              : pickValidOptional(
                  boundPools.accessories,
                  withOuterwear,
                  dayIndex,
                  log,
                  mode,
                  occasionType,
                  laundryProfile,
                  planDate,
                  canWearRelaxLevel,
                );

          const combo: Combo = { top, bottom, shoes: shoe, outerwear, accessory };
          const items = comboItems(combo);
          if (!isOutfitValid(items)) continue;
          if (isSameFullOutfitAsPrevious(items, previous)) continue;

          const score = scoreCombo(
            items,
            dayIndex,
            previous,
            log,
            mode,
            occasionType,
            laundryProfile,
            planDate,
            wardrobePressure,
          );
          if (score > bestScore) {
            bestScore = score;
            best = combo;
          }
        }
      }
    }

    if (!best || bestScore < -8000) return null;

    const selected = comboItems(best);
    const reuse = classifyReuse(selected, dayIndex, log);
    markUsage(selected, dayIndex, log);

    days.push({
      dayIndex,
      occasionType,
      itemIds: orderItemIdsByVisualOrder(
        selected.map((i) => String(i.id)),
        wardrobe,
      ),
      reusedSoftIds: reuse.soft,
      reusedHardIds: reuse.hard,
    });
    previous = selected;
  }

  return days;
}

/**
 * Allocate a multi-day plan with honest fallback modes.
 * Never fakes variety: if uniqueness is impossible, uses transparent rotation or fails.
 */
export function allocateMultiDayPlan(params: {
  wardrobe: WardrobeItem[];
  occasionTypes: OutfitOccasionId[];
  /** Prefer reducing days over entering rotation when capacity is short */
  preferReduceDaysOverRotation?: boolean;
  allowReduceDays?: boolean;
  /** Force a specific mode (advanced) */
  forceMode?: AllocationMode;
  laundryProfile?: LaundryProfile;
  referenceDate?: Date;
}): AllocationResult {
  const {
    wardrobe,
    occasionTypes,
    preferReduceDaysOverRotation = false,
    allowReduceDays = false,
    forceMode,
    laundryProfile = DEFAULT_LAUNDRY_PROFILE,
    referenceDate = new Date(),
  } = params;

  if (!occasionTypes.length) {
    const capacity = computeAllocationCapacity(wardrobe, 'casual_day');
    const copy = modeUserCopy('failure', capacity, 0, 'casual_day');
    return {
      ok: false,
      mode: 'failure',
      reason: 'insufficient_wardrobe',
      capacity,
      message: 'No days requested.',
      maxPossibleDays: 0,
      guidance: copy.guidance,
    };
  }

  const primaryOccasion = occasionTypes[0];
  const capacity = computeAllocationCapacity(wardrobe, primaryOccasion);
  const requested = occasionTypes.length;
  let mode = forceMode || resolveAllocationMode(requested, capacity);

  if (mode === 'failure') {
    const copy = modeUserCopy('failure', capacity, requested, primaryOccasion);
    return {
      ok: false,
      mode: 'failure',
      reason: 'insufficient_wardrobe',
      capacity,
      message: copy.explanation,
      maxPossibleDays: 0,
      guidance: copy.guidance,
    };
  }

  // User prefers fewer unique days over transparent top/bottom reuse
  if (mode === 'rotation' && preferReduceDaysOverRotation && capacity.maxWithSoftShoes >= 1) {
    if (!allowReduceDays) {
      const copy = modeUserCopy('rotation', capacity, requested, primaryOccasion);
      return {
        ok: false,
        mode: 'failure',
        reason: 'insufficient_wardrobe',
        capacity,
        message: copy.explanation,
        maxPossibleDays: capacity.maxWithSoftShoes,
        guidance: [
          ...copy.guidance,
          `Or plan ${capacity.maxWithSoftShoes} unique day${capacity.maxWithSoftShoes === 1 ? '' : 's'} with no top/bottom reuse.`,
        ],
      };
    }
    mode = capacity.maxStrictOutfits >= capacity.maxWithSoftShoes ? 'strict' : 'soft';
    const daysToPlan = capacity.maxWithSoftShoes;
    const allocated = allocateWithMode({
      wardrobe,
      occasionTypes: occasionTypes.slice(0, daysToPlan),
      mode,
      daysToPlan,
      laundryProfile,
      referenceDate,
    });
    if (!allocated) {
      const copy = modeUserCopy('failure', capacity, requested, primaryOccasion);
      return {
        ok: false,
        mode: 'failure',
        reason: 'unsolvable',
        capacity,
        message: copy.explanation,
        maxPossibleDays: 0,
        guidance: copy.guidance,
      };
    }
    const copy = modeUserCopy(mode, capacity, daysToPlan, primaryOccasion);
    return {
      ok: true,
      mode,
      days: allocated,
      capacity,
      reducedDays: true,
      modeLabel: copy.label,
      modeExplanation: `${copy.explanation} Planned ${daysToPlan} of ${requested} requested days.`,
    };
  }

  const daysToPlan = requested;
  const allocated = allocateWithMode({
    wardrobe,
    occasionTypes,
    mode,
    daysToPlan,
    laundryProfile,
    referenceDate,
  });

  if (!allocated) {
    // Try one softer mode before failing
    const fallbackMode: Exclude<AllocationMode, 'failure'> =
      mode === 'strict' ? 'soft' : mode === 'soft' ? 'rotation' : 'rotation';
    const retry = allocateWithMode({
      wardrobe,
      occasionTypes,
      mode: fallbackMode,
      daysToPlan,
      laundryProfile,
      referenceDate,
    });
    if (!retry) {
      const copy = modeUserCopy('failure', capacity, requested, primaryOccasion);
      return {
        ok: false,
        mode: 'failure',
        reason: 'unsolvable',
        capacity,
        message: copy.explanation,
        maxPossibleDays: capacity.maxWithSoftShoes,
        guidance: copy.guidance,
      };
    }
    const copy = modeUserCopy(fallbackMode, capacity, requested, primaryOccasion);
    return {
      ok: true,
      mode: fallbackMode,
      days: retry,
      capacity,
      reducedDays: false,
      modeLabel: copy.label,
      modeExplanation: copy.explanation,
    };
  }

  const copy = modeUserCopy(mode, capacity, requested, primaryOccasion);
  return {
    ok: true,
    mode,
    days: allocated,
    capacity,
    reducedDays: false,
    modeLabel: copy.label,
    modeExplanation: copy.explanation,
  };
}

/** Map chat/today occasion aliases onto allocator occasions. */
export function normalizeAllocatorOccasion(
  occasionType: OutfitOccasionId | 'todays_look' | string,
  now: Date = new Date(),
): OutfitOccasionId {
  if (occasionType === 'todays_look') {
    const day = now.getDay();
    return day === 0 || day === 6 ? 'weekend' : 'work_outfit';
  }
  const map: Record<string, OutfitOccasionId> = {
    work: 'work_outfit',
    office: 'work_outfit',
    weekday: 'work_outfit',
    date: 'date_night',
    first_date: 'date_night',
    casual: 'casual_day',
    browsing: 'casual_day',
    weekend: 'weekend',
    event: 'evening_out',
    evening: 'evening_out',
    party: 'evening_out',
    formal_event: 'evening_out',
    holiday: 'travel',
    travel: 'travel',
    active: 'gym',
    gym: 'gym',
    workout: 'gym',
  };
  const key = String(occasionType || '')
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  if (map[key]) return map[key];
  const allowed: OutfitOccasionId[] = [
    'work_outfit',
    'date_night',
    'casual_day',
    'weekend',
    'smart_casual',
    'gym',
    'evening_out',
    'travel',
    'custom',
  ];
  if (allowed.includes(key as OutfitOccasionId)) {
    return key as OutfitOccasionId;
  }
  return 'casual_day';
}

export type SingleDayAllocation = {
  ok: true;
  occasionType: OutfitOccasionId;
  itemIds: string[];
  items: WardrobeItem[];
  mode: Exclude<AllocationMode, 'failure'>;
  modeLabel: string;
  modeExplanation: string;
} | {
  ok: false;
  message: string;
  capacity: AllocationCapacity;
};

/**
 * Single-day wardrobe allocation (chat chips, today's outfit, wardrobe create).
 * Prefers unused pieces vs excludeItemIds; degrades strict → soft → rotation.
 */
export function allocateSingleDayOutfit(params: {
  wardrobe: WardrobeItem[];
  occasionType: OutfitOccasionId | 'todays_look' | string;
  excludeItemIds?: string[];
  laundryProfile?: LaundryProfile;
  referenceDate?: Date;
}): SingleDayAllocation {
  const occasion = normalizeAllocatorOccasion(params.occasionType, params.referenceDate);
  const exclude = new Set((params.excludeItemIds || []).map(String));
  const wardrobe = params.wardrobe.filter((item) => !exclude.has(String(item.id)));
  const pool = wardrobe.length >= 3 ? wardrobe : params.wardrobe;
  const capacity = computeAllocationCapacity(pool, occasion);
  const laundryProfile = params.laundryProfile ?? DEFAULT_LAUNDRY_PROFILE;
  const referenceDate = params.referenceDate ?? new Date();

  for (const mode of ['strict', 'soft', 'rotation'] as const) {
    const plan = allocateMultiDayPlan({
      wardrobe: pool,
      occasionTypes: [occasion],
      forceMode: mode,
      laundryProfile,
      referenceDate,
    });
    if (plan.ok && plan.days[0]?.itemIds?.length) {
      const byId = new Map(params.wardrobe.map((w) => [String(w.id), w]));
      const items = plan.days[0].itemIds
        .map((id) => byId.get(String(id)))
        .filter((item): item is WardrobeItem => Boolean(item));
      if (items.length >= 3) {
        return {
          ok: true,
          occasionType: occasion,
          itemIds: plan.days[0].itemIds,
          items,
          mode: plan.mode,
          modeLabel: plan.modeLabel,
          modeExplanation: plan.modeExplanation,
        };
      }
    }
  }

  const copy = modeUserCopy('failure', capacity, 1, occasion);
  return {
    ok: false,
    message: copy.explanation,
    capacity,
  };
}
