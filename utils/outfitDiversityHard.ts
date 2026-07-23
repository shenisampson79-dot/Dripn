/**
 * Hard outfit diversity for Today's Outfit (client mirror of server outfitDiversityHard).
 * Soft penalties alone allow jacket-only swaps — this rejects them.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isAccessoryItem,
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';

export const TODAY_DIVERSITY_TOP_K = 12;
export const TODAY_DIVERSITY_HISTORY = 7;
export const MIN_TRIO_CHANGES = 2;

type CoreSlots = {
  top: string | null;
  bottom: string | null;
  footwear: string | null;
  outerwear: string | null;
  bag: string | null;
};

function normId(id: string | number | null | undefined): string | null {
  return id == null ? null : String(id);
}

function isBagLike(item: WardrobeItem): boolean {
  const cat = String(item.category || '').toLowerCase();
  const sub = String(item.subcategory || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  if (cat === 'bags' || sub.includes('bag') || sub.includes('tote')) return true;
  if (
    isAccessoryItem(item)
    && /\b(bag|tote|handbag|backpack|crossbody|purse)\b/.test(`${sub} ${name}`)
  ) {
    return true;
  }
  return false;
}

export function coreSlotIds(items: WardrobeItem[]): CoreSlots {
  const list = (items || []).filter(Boolean);
  const find = (pred: (i: WardrobeItem) => boolean) => {
    const hit = list.find(pred);
    return hit ? normId(hit.id) : null;
  };
  return {
    top: find(isTopItem),
    bottom: find(isBottomItem),
    footwear: find(isShoesItem),
    outerwear: find(isOuterwearItem),
    bag: find(isBagLike),
  };
}

export function presentCoreSlots(
  slots: CoreSlots,
  { includeBag = true }: { includeBag?: boolean } = {},
): (keyof CoreSlots)[] {
  const keys: (keyof CoreSlots)[] = ['top', 'bottom', 'footwear', 'outerwear'];
  if (includeBag) keys.push('bag');
  return keys.filter((k) => slots[k]);
}

export function countCoreOverlap(
  aItems: WardrobeItem[],
  bItems: WardrobeItem[],
  { includeBag = true }: { includeBag?: boolean } = {},
): number {
  const a = coreSlotIds(aItems);
  const b = coreSlotIds(bItems);
  let same = 0;
  for (const key of presentCoreSlots(a, { includeBag })) {
    if (a[key] && b[key] && a[key] === b[key]) same += 1;
  }
  return same;
}

export function isTooSimilar(
  aItems: WardrobeItem[],
  bItems: WardrobeItem[],
  {
    maxOverlap = null,
    includeBag = true,
  }: { maxOverlap?: number | null; includeBag?: boolean } = {},
): boolean {
  const a = coreSlotIds(aItems);
  const b = coreSlotIds(bItems);
  const overlap = countCoreOverlap(aItems, bItems, { includeBag });
  if (maxOverlap != null) return overlap >= maxOverlap;

  const aCount = presentCoreSlots(a, { includeBag: false }).length;
  const bCount = presentCoreSlots(b, { includeBag: false }).length;
  const minCore = Math.min(aCount, bCount);
  const threshold = minCore <= 3 ? 2 : 3;
  return overlap >= threshold;
}

export function countTrioChanges(
  candidateItems: WardrobeItem[],
  yesterdayItems: WardrobeItem[],
): number {
  const a = coreSlotIds(candidateItems);
  const b = coreSlotIds(yesterdayItems);
  let changes = 0;
  for (const key of ['top', 'bottom', 'footwear'] as const) {
    if (!a[key] && !b[key]) continue;
    if (a[key] !== b[key]) changes += 1;
  }
  return changes;
}

export function hashDaySeed(dateKey: string, salt = 'todays-outfit-v2'): number {
  const s = `${salt}:${String(dateKey || '')}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function daySeededPick<T>(candidates: T[], dateKey: string): T | null {
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const seed = hashDaySeed(dateKey);
  return list[seed % list.length];
}

function outfitSignature(items: WardrobeItem[]): string {
  return [...(items || []).map((i) => String(i.id))].sort().join('|');
}

export function filterHardDiversity<T extends { items?: WardrobeItem[] } | WardrobeItem[]>(
  candidates: T[],
  historyOutfits: WardrobeItem[][],
  options: { maxOverlap?: number | null; includeBag?: boolean } = {},
): T[] {
  const history = (historyOutfits || []).filter((h) => Array.isArray(h) && h.length);
  if (!history.length) return [...(candidates || [])];
  return (candidates || []).filter((c) => {
    const items = (Array.isArray(c) ? c : c.items) as WardrobeItem[];
    return !history.some((h) => isTooSimilar(items, h, options));
  });
}

function leastSimilarCandidate<T extends { items?: WardrobeItem[] } | WardrobeItem[]>(
  candidates: T[],
  historyOutfits: WardrobeItem[][],
): T | null {
  const history = (historyOutfits || []).filter((h) => Array.isArray(h) && h.length);
  let best: T | null = null;
  let bestScore = Infinity;
  for (const c of candidates || []) {
    const items = (Array.isArray(c) ? c : c.items) as WardrobeItem[];
    const maxOverlap = history.length
      ? Math.max(...history.map((h) => countCoreOverlap(items, h)))
      : 0;
    if (maxOverlap < bestScore) {
      bestScore = maxOverlap;
      best = c;
    }
  }
  return best;
}

export type ScoredOutfitCandidate = {
  items: WardrobeItem[];
  score?: number;
};

export function pickDiverseFromTopK(
  scoredCandidates: ScoredOutfitCandidate[],
  historyOutfits: WardrobeItem[][],
  dateKey: string,
  { preferTrioChanges = MIN_TRIO_CHANGES }: { preferTrioChanges?: number } = {},
): ScoredOutfitCandidate | null {
  const ranked = [...(scoredCandidates || [])]
    .filter((c) => c?.items?.length)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (!ranked.length) return null;

  const history = (historyOutfits || [])
    .filter((h) => Array.isArray(h) && h.length)
    .slice(0, TODAY_DIVERSITY_HISTORY);
  const yesterday = history[0] || null;

  const tryPick = (pool: ScoredOutfitCandidate[]) => {
    let survivors = pool;
    if (yesterday && preferTrioChanges > 0) {
      const strong = pool.filter(
        (c) => countTrioChanges(c.items, yesterday) >= preferTrioChanges,
      );
      if (strong.length) survivors = strong;
    }
    return daySeededPick(survivors, dateKey);
  };

  let filtered = filterHardDiversity(ranked, history);
  if (filtered.length) return tryPick(filtered);

  filtered = filterHardDiversity(ranked, history, { maxOverlap: 4 });
  if (filtered.length) return tryPick(filtered);

  filtered = filterHardDiversity(ranked, history, { maxOverlap: 5 });
  if (filtered.length) return tryPick(filtered);

  return leastSimilarCandidate(ranked, history) || ranked[0];
}

export function insertTopKCandidate(
  heap: ScoredOutfitCandidate[],
  candidate: ScoredOutfitCandidate,
  k = TODAY_DIVERSITY_TOP_K,
): ScoredOutfitCandidate[] {
  if (!candidate?.items?.length || k < 1) return heap;
  const sig = outfitSignature(candidate.items);
  const existing = heap.findIndex((c) => outfitSignature(c.items) === sig);
  if (existing >= 0) {
    if ((candidate.score ?? 0) > (heap[existing].score ?? 0)) {
      heap[existing] = candidate;
    }
  } else {
    heap.push(candidate);
  }
  heap.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (heap.length > k) heap.length = k;
  return heap;
}

/**
 * Item ids to hard-exclude so retries break yesterday's base look.
 * Ban top + bottom + footwear (not just jacket) — cream+black+shoes must not persist.
 */
export function diversityExcludeIdsFromHistory(
  historyOutfits: WardrobeItem[][],
): string[] {
  const yesterday = historyOutfits?.[0];
  if (!yesterday?.length) return [];
  const slots = coreSlotIds(yesterday);
  return [slots.top, slots.bottom, slots.footwear].filter(Boolean) as string[];
}

/** Yesterday's bottom + shoes only — aggressive day-2 ban when top alternatives are scarce. */
export function diversityBanBottomAndShoes(
  historyOutfits: WardrobeItem[][],
): string[] {
  const yesterday = historyOutfits?.[0];
  if (!yesterday?.length) return [];
  const slots = coreSlotIds(yesterday);
  return [slots.bottom, slots.footwear].filter(Boolean) as string[];
}
