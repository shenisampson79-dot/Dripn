/**
 * Schedule-driven lookbook allocator.
 *
 * Plan item usage FIRST (deterministic distribution), then build outfits from
 * those assignments. Penalties alone cannot prevent clustering — this does.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import { isOutfitValid } from '@/utils/outfitClashRules';
import { passesHardOutfitChecks } from '@/utils/outfitDiversity';
import { buildFlightOutfit } from '@/utils/flightOutfitBuilder';
import {
  type ActivityConstraintId,
  violatesActivitySoftRules,
} from '@/utils/travelActivityConstraints';
import { isStatementItem } from '@/utils/travelCapsule';

export const LOOKBOOK_REUSE_RULES = {
  minGapTop: 2,
  minGapBottom: 1,
  minGapShoes: 1,
  minGapLayer: 1,
  maxUsesTop: 3,
  maxUsesBottom: 5,
  maxUsesShoes: 5,
  maxUsesLayer: 4,
  maxUsesStatement: 2,
  minGapStatement: 4,
  noConsecutiveOutfitOverlap: true,
} as const;

export type UsagePlan = Record<string, number[]>;

export type ScheduleDayPlan = {
  dayIndex: number;
  activity: ActivityConstraintId;
};

export type ScheduleDrivenResult = {
  outfits: WardrobeItem[][];
  usagePlan: UsagePlan;
  modeLabel: string;
  validation: LookbookValidationReport;
};

export type LookbookValidationReport = {
  ok: boolean;
  consecutiveSameTop: number[];
  similarityCollisions: number[];
  overusedItemIds: string[];
  invalidDays: number[];
};

function stableSort(items: WardrobeItem[]): WardrobeItem[] {
  return [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function itemId(item: WardrobeItem): string {
  return String(item.id);
}

function maxUsesForItem(item: WardrobeItem, baseMax: number): number {
  if (isStatementItem(item)) {
    return Math.min(baseMax, LOOKBOOK_REUSE_RULES.maxUsesStatement);
  }
  return baseMax;
}

function minGapForItem(item: WardrobeItem, baseGap: number): number {
  if (isStatementItem(item)) {
    return Math.max(baseGap, LOOKBOOK_REUSE_RULES.minGapStatement);
  }
  return baseGap;
}

/**
 * Assign exactly one item per day for a category, with even spread,
 * max-use caps, and minimum gaps. Deterministic (id-sorted round-robin).
 */
export function scheduleCategoryDays(
  items: WardrobeItem[],
  totalDays: number,
  baseMaxUses: number,
  baseMinGap: number,
): { dayToItemId: (string | null)[]; usagePlan: UsagePlan } {
  const sorted = stableSort(items);
  const dayToItemId: (string | null)[] = Array.from({ length: totalDays }, () => null);
  const usagePlan: UsagePlan = {};
  const useCount = new Map<string, number>();
  const lastDay = new Map<string, number>();

  for (const item of sorted) {
    usagePlan[itemId(item)] = [];
    useCount.set(itemId(item), 0);
  }

  if (!sorted.length || totalDays <= 0) {
    return { dayToItemId, usagePlan };
  }

  let cursor = 0;
  for (let day = 0; day < totalDays; day++) {
    let placed: WardrobeItem | null = null;

    for (let attempt = 0; attempt < sorted.length; attempt++) {
      const item = sorted[(cursor + attempt) % sorted.length];
      const id = itemId(item);
      const maxUses = maxUsesForItem(item, baseMaxUses);
      const minGap = minGapForItem(item, baseMinGap);
      const used = useCount.get(id) || 0;
      const last = lastDay.get(id);

      if (used >= maxUses) continue;
      if (last != null && day - last < minGap) continue;

      placed = item;
      cursor = (cursor + attempt + 1) % sorted.length;
      break;
    }

    // Soft fallback: least-used item that respects gap (ignore max briefly)
    if (!placed) {
      let best: WardrobeItem | null = null;
      let bestScore = Infinity;
      for (const item of sorted) {
        const id = itemId(item);
        const minGap = minGapForItem(item, baseMinGap);
        const last = lastDay.get(id);
        if (last != null && day - last < minGap) continue;
        const used = useCount.get(id) || 0;
        const score = used * 100 + id.charCodeAt(0);
        if (score < bestScore) {
          bestScore = score;
          best = item;
        }
      }
      placed = best || sorted[day % sorted.length];
    }

    const id = itemId(placed);
    dayToItemId[day] = id;
    useCount.set(id, (useCount.get(id) || 0) + 1);
    lastDay.set(id, day);
    usagePlan[id] = [...(usagePlan[id] || []), day + 1];
  }

  return { dayToItemId, usagePlan };
}

export function buildUsagePlan(
  capsule: WardrobeItem[],
  totalDays: number,
): {
  usagePlan: UsagePlan;
  topsByDay: (string | null)[];
  bottomsByDay: (string | null)[];
  shoesByDay: (string | null)[];
  layersByDay: (string | null)[];
} {
  const tops = capsule.filter(isTopItem);
  const bottoms = capsule.filter(isBottomItem);
  const shoes = capsule.filter(isShoesItem);
  const layers = capsule.filter(isOuterwearItem);

  const topSched = scheduleCategoryDays(
    tops,
    totalDays,
    LOOKBOOK_REUSE_RULES.maxUsesTop,
    LOOKBOOK_REUSE_RULES.minGapTop,
  );
  const bottomSched = scheduleCategoryDays(
    bottoms,
    totalDays,
    LOOKBOOK_REUSE_RULES.maxUsesBottom,
    LOOKBOOK_REUSE_RULES.minGapBottom,
  );
  const shoeSched = scheduleCategoryDays(
    shoes,
    totalDays,
    LOOKBOOK_REUSE_RULES.maxUsesShoes,
    LOOKBOOK_REUSE_RULES.minGapShoes,
  );
  const layerSched = scheduleCategoryDays(
    layers,
    totalDays,
    LOOKBOOK_REUSE_RULES.maxUsesLayer,
    LOOKBOOK_REUSE_RULES.minGapLayer,
  );

  return {
    usagePlan: {
      ...topSched.usagePlan,
      ...bottomSched.usagePlan,
      ...shoeSched.usagePlan,
      ...layerSched.usagePlan,
    },
    topsByDay: topSched.dayToItemId,
    bottomsByDay: bottomSched.dayToItemId,
    shoesByDay: shoeSched.dayToItemId,
    layersByDay: layerSched.dayToItemId,
  };
}

export function outfitsTooSimilar(a: WardrobeItem[], b: WardrobeItem[]): boolean {
  if (!a?.length || !b?.length) return false;
  const aTop = a.find(isTopItem);
  const bTop = b.find(isTopItem);
  const aBottom = a.find(isBottomItem);
  const bBottom = b.find(isBottomItem);
  const aShoes = a.find(isShoesItem);
  const bShoes = b.find(isShoesItem);

  let overlap = 0;
  if (aTop && bTop && itemId(aTop) === itemId(bTop)) overlap++;
  if (aBottom && bBottom && itemId(aBottom) === itemId(bBottom)) overlap++;
  if (aShoes && bShoes && itemId(aShoes) === itemId(bShoes)) overlap++;
  return overlap >= 2;
}

function sameTop(a: WardrobeItem[], b: WardrobeItem[]): boolean {
  const aTop = a.find(isTopItem);
  const bTop = b.find(isTopItem);
  return Boolean(aTop && bTop && itemId(aTop) === itemId(bTop));
}

function findById(capsule: WardrobeItem[], id: string | null | undefined): WardrobeItem | undefined {
  if (!id) return undefined;
  return capsule.find((i) => itemId(i) === String(id));
}

function scoreComboForDay(
  items: WardrobeItem[],
  activity: ActivityConstraintId,
): number {
  let score = 0;
  if (passesHardOutfitChecks(items) || isOutfitValid(items)) score += 100;
  else return -10000;
  if (violatesActivitySoftRules(items, activity)) score -= 25;
  // Prefer fewer statement pieces in one look
  score -= items.filter(isStatementItem).length * 5;
  // Stable tie-break: lexicographic ids
  score -= items.map(itemId).sort().join('|').length * 0.001;
  return score;
}

function buildCandidatesForDay(params: {
  capsule: WardrobeItem[];
  dayIndex: number;
  activity: ActivityConstraintId;
  primaryTop?: WardrobeItem;
  primaryBottom?: WardrobeItem;
  primaryShoes?: WardrobeItem;
  primaryLayer?: WardrobeItem;
  previous?: WardrobeItem[] | null;
  avoidIds?: Set<string>;
  /** Hard block items that already hit their schedule max */
  blockedIds?: Set<string>;
  /** Prefer items still under their planned use budget */
  useCount?: Map<string, number>;
}): WardrobeItem[][] {
  const {
    capsule,
    activity,
    primaryTop,
    primaryBottom,
    primaryShoes,
    primaryLayer,
    previous,
    avoidIds,
    blockedIds,
    useCount,
  } = params;

  const notBlocked = (i: WardrobeItem) => !blockedIds?.has(itemId(i)) && !avoidIds?.has(itemId(i));

  const tops = stableSort(capsule.filter(isTopItem).filter(notBlocked));
  const bottoms = stableSort(capsule.filter(isBottomItem).filter(notBlocked));
  const shoes = stableSort(capsule.filter(isShoesItem).filter(notBlocked));
  const layers = stableSort(capsule.filter(isOuterwearItem).filter((i) => !blockedIds?.has(itemId(i))));

  const byLeastUsed = (pool: WardrobeItem[]) =>
    [...pool].sort((a, b) => {
      const ua = useCount?.get(itemId(a)) || 0;
      const ub = useCount?.get(itemId(b)) || 0;
      if (ua !== ub) return ua - ub;
      return itemId(a).localeCompare(itemId(b));
    });

  const topPool = primaryTop && notBlocked(primaryTop)
    ? [primaryTop, ...byLeastUsed(tops.filter((t) => itemId(t) !== itemId(primaryTop)))]
    : byLeastUsed(tops);
  const bottomPool = primaryBottom && notBlocked(primaryBottom)
    ? [primaryBottom, ...byLeastUsed(bottoms.filter((b) => itemId(b) !== itemId(primaryBottom)))]
    : byLeastUsed(bottoms);
  const shoePool = primaryShoes && notBlocked(primaryShoes)
    ? [primaryShoes, ...byLeastUsed(shoes.filter((s) => itemId(s) !== itemId(primaryShoes)))]
    : byLeastUsed(shoes);

  const candidates: WardrobeItem[][] = [];
  const maxAttempts = 64;
  let attempts = 0;

  // Prefer keeping the scheduled top — only search alternate tops if primary combos fail
  const topWaves: WardrobeItem[][] = primaryTop && notBlocked(primaryTop)
    ? [[primaryTop], topPool.filter((t) => itemId(t) !== itemId(primaryTop))]
    : [topPool];

  for (const wave of topWaves) {
    for (const top of wave) {
      for (const bottom of bottomPool) {
        for (const shoe of shoePool) {
          if (attempts >= maxAttempts) break;
          attempts++;

          if (previous && LOOKBOOK_REUSE_RULES.noConsecutiveOutfitOverlap) {
            if (sameTop([top], previous)) continue;
          }

          const base = [top, bottom, shoe];
          const withLayer = primaryLayer && !blockedIds?.has(itemId(primaryLayer))
            ? [...base, primaryLayer]
            : base;
          const layerOpts = primaryLayer && !blockedIds?.has(itemId(primaryLayer))
            ? [withLayer, base]
            : [base, ...(layers[0] ? [[...base, layers[0]]] : [])];

          for (const combo of layerOpts) {
            if (!(passesHardOutfitChecks(combo) || isOutfitValid(combo))) continue;
            if (previous && outfitsTooSimilar(combo, previous)) continue;
            candidates.push(combo);
          }
        }
      }
    }
    if (candidates.length) break; // stay on scheduled top whenever possible
  }

  // Soften: allow similarity if nothing else works (still respect blocked tops)
  if (!candidates.length) {
    attempts = 0;
    for (const top of topPool) {
      for (const bottom of bottomPool) {
        for (const shoe of shoePool) {
          if (attempts >= maxAttempts) break;
          attempts++;
          if (previous && sameTop([top], previous) && topPool.length > 1) continue;
          const combo = [top, bottom, shoe];
          if (passesHardOutfitChecks(combo) || isOutfitValid(combo)) {
            candidates.push(combo);
          }
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    const scoreDiff = scoreComboForDay(b, activity) - scoreComboForDay(a, activity);
    if (scoreDiff !== 0) return scoreDiff;
    // Prefer scheduled top
    if (primaryTop) {
      const aHas = a.some((i) => itemId(i) === itemId(primaryTop));
      const bHas = b.some((i) => itemId(i) === itemId(primaryTop));
      if (aHas !== bHas) return aHas ? -1 : 1;
    }
    const aUses = a.reduce((s, i) => s + (useCount?.get(itemId(i)) || 0), 0);
    const bUses = b.reduce((s, i) => s + (useCount?.get(itemId(i)) || 0), 0);
    return aUses - bUses;
  });
}

function maxAllowedUses(item: WardrobeItem): number {
  if (isStatementItem(item)) return LOOKBOOK_REUSE_RULES.maxUsesStatement;
  if (isTopItem(item)) return LOOKBOOK_REUSE_RULES.maxUsesTop;
  if (isBottomItem(item)) return LOOKBOOK_REUSE_RULES.maxUsesBottom;
  if (isShoesItem(item)) return LOOKBOOK_REUSE_RULES.maxUsesShoes;
  if (isOuterwearItem(item)) return LOOKBOOK_REUSE_RULES.maxUsesLayer;
  return LOOKBOOK_REUSE_RULES.maxUsesTop;
}

function blockedFromUseCount(
  capsule: WardrobeItem[],
  useCount: Map<string, number>,
): Set<string> {
  const blocked = new Set<string>();
  for (const item of capsule) {
    const used = useCount.get(itemId(item)) || 0;
    if (used >= maxAllowedUses(item)) blocked.add(itemId(item));
  }
  return blocked;
}

function markOutfitUses(items: WardrobeItem[], useCount: Map<string, number>): void {
  for (const item of items) {
    const id = itemId(item);
    useCount.set(id, (useCount.get(id) || 0) + 1);
  }
}

function pickBestCandidate(candidates: WardrobeItem[][]): WardrobeItem[] | null {
  return candidates[0] || null;
}

/** Rotate tops among the last N days when duplication is detected. */
export function rebalanceTail(
  outfits: WardrobeItem[][],
  capsule: WardrobeItem[],
  tailSize = 3,
): WardrobeItem[][] {
  if (outfits.length < tailSize) return outfits;
  const start = outfits.length - tailSize;
  const tail = outfits.slice(start);
  const tops = stableSort(capsule.filter(isTopItem));
  if (tops.length < 2) return outfits;

  let needsFix = false;
  for (let i = 1; i < tail.length; i++) {
    if (sameTop(tail[i], tail[i - 1]) || outfitsTooSimilar(tail[i], tail[i - 1])) {
      needsFix = true;
      break;
    }
  }
  if (!needsFix) return outfits;

  const next = outfits.map((o) => [...o]);
  for (let i = start; i < next.length; i++) {
    const prev = i > 0 ? next[i - 1] : null;
    const current = next[i];
    const bottom = current.find(isBottomItem);
    const shoes = current.find(isShoesItem);
    const layer = current.find(isOuterwearItem);
    if (!bottom || !shoes) continue;

    for (const top of tops) {
      if (prev && sameTop([top], prev)) continue;
      const combo = layer ? [top, bottom, shoes, layer] : [top, bottom, shoes];
      if (!(passesHardOutfitChecks(combo) || isOutfitValid(combo))) continue;
      if (prev && outfitsTooSimilar(combo, prev)) continue;
      next[i] = combo;
      break;
    }
  }
  return next;
}

export function validateLookbook(
  outfits: WardrobeItem[][],
  rules = LOOKBOOK_REUSE_RULES,
): LookbookValidationReport {
  const consecutiveSameTop: number[] = [];
  const similarityCollisions: number[] = [];
  const invalidDays: number[] = [];
  const useCount = new Map<string, number>();

  for (let i = 0; i < outfits.length; i++) {
    const outfit = outfits[i];
    if (!passesHardOutfitChecks(outfit) && !isOutfitValid(outfit)) {
      invalidDays.push(i + 1);
    }
    for (const item of outfit) {
      const id = itemId(item);
      useCount.set(id, (useCount.get(id) || 0) + 1);
    }
    if (i > 0) {
      if (sameTop(outfit, outfits[i - 1])) consecutiveSameTop.push(i + 1);
      if (rules.noConsecutiveOutfitOverlap && outfitsTooSimilar(outfit, outfits[i - 1])) {
        similarityCollisions.push(i + 1);
      }
    }
  }

  const overusedItemIds: string[] = [];
  for (const [id, count] of useCount) {
    // Infer category limits from first matching outfit piece
    let item: WardrobeItem | undefined;
    for (const outfit of outfits) {
      item = outfit.find((i) => itemId(i) === id);
      if (item) break;
    }
    if (!item) continue;
    let max = rules.maxUsesTop;
    if (isBottomItem(item)) max = rules.maxUsesBottom;
    else if (isShoesItem(item)) max = rules.maxUsesShoes;
    else if (isOuterwearItem(item)) max = rules.maxUsesLayer;
    if (isStatementItem(item)) max = Math.min(max, rules.maxUsesStatement);
    if (isTopItem(item) && count > max) overusedItemIds.push(id);
    if (isStatementItem(item) && count > rules.maxUsesStatement) {
      if (!overusedItemIds.includes(id)) overusedItemIds.push(id);
    }
  }

  return {
    ok:
      consecutiveSameTop.length === 0
      && similarityCollisions.length === 0
      && overusedItemIds.length === 0
      && invalidDays.length === 0,
    consecutiveSameTop,
    similarityCollisions,
    overusedItemIds,
    invalidDays,
  };
}

export function enforceDiversity(
  outfits: WardrobeItem[][],
  capsule: WardrobeItem[],
  dayPlans: ScheduleDayPlan[],
): WardrobeItem[][] {
  const next = outfits.map((o) => [...o]);
  for (let i = 1; i < next.length; i++) {
    if (!sameTop(next[i], next[i - 1]) && !outfitsTooSimilar(next[i], next[i - 1])) {
      continue;
    }
    const activity = dayPlans[i]?.activity || 'explore';
    const candidates = buildCandidatesForDay({
      capsule,
      dayIndex: i,
      activity,
      previous: next[i - 1],
      avoidIds: new Set(
        [...(next[i - 1].filter(isTopItem)), ...(next[i - 1].filter(isBottomItem))].map(itemId),
      ),
    });
    const best = pickBestCandidate(candidates);
    if (best) next[i] = best;
  }
  return next;
}

/**
 * Full schedule-driven allocation for Travel Capsule lookbooks.
 */
export function allocateScheduleDrivenLookbook(params: {
  capsule: WardrobeItem[];
  totalDays: number;
  dayActivities: ActivityConstraintId[];
  fullWardrobe?: WardrobeItem[];
}): ScheduleDrivenResult | null {
  const { capsule, totalDays, dayActivities } = params;
  const wardrobe = params.fullWardrobe?.length ? params.fullWardrobe : capsule;

  const tops = capsule.filter(isTopItem);
  const bottoms = capsule.filter(isBottomItem);
  const shoes = capsule.filter(isShoesItem);
  if (!tops.length || !bottoms.length || !shoes.length) return null;

  const plan = buildUsagePlan(capsule, totalDays);
  const dayPlans: ScheduleDayPlan[] = Array.from({ length: totalDays }, (_, i) => ({
    dayIndex: i,
    activity: dayActivities[i] || 'explore',
  }));

  const outfits: WardrobeItem[][] = [];
  const useCount = new Map<string, number>();

  for (let day = 0; day < totalDays; day++) {
    const activity = dayPlans[day].activity;
    const previous = outfits[day - 1] || null;
    const blockedIds = blockedFromUseCount(capsule, useCount);

    if (activity === 'flight') {
      const avoidIds = new Set(previous?.filter(isTopItem).map(itemId) || []);
      // Prefer scheduled top for this day when still under budget — keeps distribution intact
      const scheduledTop = findById(capsule, plan.topsByDay[day]);
      const flightCandidates = buildCandidatesForDay({
        capsule,
        dayIndex: day,
        activity: 'flight',
        primaryTop: scheduledTop && !blockedIds.has(itemId(scheduledTop)) ? scheduledTop : undefined,
        primaryBottom: findById(capsule, plan.bottomsByDay[day]),
        primaryShoes: findById(capsule, plan.shoesByDay[day]),
        primaryLayer: findById(capsule, plan.layersByDay[day]),
        previous,
        avoidIds,
        blockedIds,
        useCount,
      });
      let chosen = pickBestCandidate(flightCandidates);
      if (!chosen) {
        const flight = buildFlightOutfit(wardrobe, capsule, {
          avoidItemIds: new Set([...avoidIds, ...blockedIds]),
        });
        if (flight?.length) chosen = flight;
      }
      if (chosen) {
        outfits.push(chosen);
        markOutfitUses(chosen, useCount);
        continue;
      }
    }

    const primaryTop = findById(capsule, plan.topsByDay[day]);
    const primaryBottom = findById(capsule, plan.bottomsByDay[day]);
    const primaryShoes = findById(capsule, plan.shoesByDay[day]);
    const primaryLayer = findById(capsule, plan.layersByDay[day]);

    const avoidIds = new Set<string>();
    if (previous) {
      for (const t of previous.filter(isTopItem)) avoidIds.add(itemId(t));
    }

    const candidates = buildCandidatesForDay({
      capsule,
      dayIndex: day,
      activity,
      primaryTop,
      primaryBottom,
      primaryShoes,
      primaryLayer: activity === 'beach' ? undefined : primaryLayer,
      previous,
      avoidIds,
      blockedIds,
      useCount,
    });

    let best = pickBestCandidate(candidates);
    if (!best) {
      // Last resort: ignore blocks except consecutive top
      const relaxed = buildCandidatesForDay({
        capsule,
        dayIndex: day,
        activity,
        primaryTop,
        primaryBottom,
        primaryShoes,
        previous,
        avoidIds,
        useCount,
      });
      best = pickBestCandidate(relaxed);
    }
    if (!best) {
      const fallback = [primaryTop, primaryBottom, primaryShoes].filter(Boolean) as WardrobeItem[];
      if (passesHardOutfitChecks(fallback) || isOutfitValid(fallback)) {
        best = fallback;
      }
    }
    if (!best) return null;
    outfits.push(best);
    markOutfitUses(best, useCount);
  }

  // Cap overuse + fix consecutive collisions without undoing the usage schedule
  const fixed = rebalanceOverusedTops(
    rebalanceTail(outfits, capsule, 3),
    capsule,
    dayPlans,
  );

  const validation = validateLookbook(fixed);

  return {
    outfits: fixed,
    usagePlan: plan.usagePlan,
    modeLabel: 'schedule-driven',
    validation,
  };
}

/** After repairs, swap overused tops onto underused scheduled alternatives. */
function rebalanceOverusedTops(
  outfits: WardrobeItem[][],
  capsule: WardrobeItem[],
  dayPlans: ScheduleDayPlan[],
): WardrobeItem[][] {
  const next = outfits.map((o) => [...o]);
  const tops = stableSort(capsule.filter(isTopItem));

  for (let pass = 0; pass < 5; pass++) {
    const useCount = new Map<string, number>();
    for (const outfit of next) markOutfitUses(outfit, useCount);

    let changed = false;
    for (let i = 0; i < next.length; i++) {
      const top = next[i].find(isTopItem);
      if (!top) continue;
      const topUses = useCount.get(itemId(top)) || 0;
      if (topUses <= maxAllowedUses(top)) continue;

      const bottom = next[i].find(isBottomItem);
      const shoesPiece = next[i].find(isShoesItem);
      const layer = next[i].find(isOuterwearItem);
      if (!bottom || !shoesPiece) continue;

      const prev = i > 0 ? next[i - 1] : null;
      const following = i < next.length - 1 ? next[i + 1] : null;
      const underused = tops
        .filter((t) => itemId(t) !== itemId(top))
        .filter((t) => (useCount.get(itemId(t)) || 0) < maxAllowedUses(t))
        .filter((t) => !prev || !sameTop([t], prev))
        .filter((t) => !following || !sameTop([t], following))
        .sort(
          (a, b) => (useCount.get(itemId(a)) || 0) - (useCount.get(itemId(b)) || 0),
        );

      for (const alt of underused) {
        const combo = layer ? [alt, bottom, shoesPiece, layer] : [alt, bottom, shoesPiece];
        if (!(passesHardOutfitChecks(combo) || isOutfitValid(combo))) continue;
        if (prev && outfitsTooSimilar(combo, prev)) continue;
        if (following && outfitsTooSimilar(combo, following)) continue;
        next[i] = combo;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  // Diversity pass without undoing use caps: only fix consecutive collisions
  for (let i = 1; i < next.length; i++) {
    if (!sameTop(next[i], next[i - 1]) && !outfitsTooSimilar(next[i], next[i - 1])) continue;
    const useCount = new Map<string, number>();
    for (const outfit of next) markOutfitUses(outfit, useCount);
    const blockedIds = blockedFromUseCount(capsule, useCount);
    // Unblock current day's top so we can replace it
    const curTop = next[i].find(isTopItem);
    if (curTop) blockedIds.delete(itemId(curTop));

    const candidates = buildCandidatesForDay({
      capsule,
      dayIndex: i,
      activity: dayPlans[i]?.activity || 'explore',
      previous: next[i - 1],
      avoidIds: new Set(next[i - 1].filter(isTopItem).map(itemId)),
      blockedIds,
      useCount,
    });
    const best = pickBestCandidate(candidates);
    if (best) next[i] = best;
  }

  return next;
}

/** Notes must always be derived from the outfit on the card — never server copy. */
export function generateNotesFromOutfit(
  items: WardrobeItem[],
  dayNumber: number,
  extras?: { activityLabel?: string; destination?: string; capsuleSize?: number },
): string {
  const top = items.find(isTopItem);
  const bottom = items.find(isBottomItem);
  const pieceLine =
    top && bottom
      ? `${top.name} with ${bottom.name}`
      : top?.name || bottom?.name || 'your capsule pieces';
  const activityBit = extras?.activityLabel ? ` — ${extras.activityLabel}` : '';
  const destBit = extras?.destination ? ` for ${extras.destination}` : '';
  const sizeBit = extras?.capsuleSize ? ` from your ${extras.capsuleSize}-piece capsule` : '';
  return `Day ${dayNumber}: ${pieceLine}${activityBit}${sizeBit}${destBit}.`;
}
