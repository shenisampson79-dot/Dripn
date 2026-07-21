/**
 * Multi-day outfit diversity scoring — used by the allocator, Core calendar,
 * Lite lookbook, and single-day stylist paths.
 *
 * Correctness (clashes / structure) stays in outfitClashRules + completeOutfit.
 * This module only scores variety so plans feel curated, not repetitive.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import { isOutfitValid } from '@/utils/outfitClashRules';

export type DiversityTracker = {
  usedItems: Map<string, number>;
  usedColors: Map<string, number>;
  usedFits: Map<string, number>;
  silhouettes: Map<string, number>;
  outfitHashes: Set<string>;
};

export type OutfitFeatures = {
  itemIds: string[];
  colors: string[];
  fit: string;
  silhouette: string;
};

const ITEM_REUSE_PENALTY = 18;
/** Extra weight so hero pieces (tops) spread across the plan instead of clustering. */
const TOP_REUSE_EXTRA_PENALTY = 14;
const COLOR_REUSE_PENALTY = 5;
const FIT_REUSE_PENALTY = 8;
const SILHOUETTE_REUSE_PENALTY = 12;
const DUPLICATE_OUTFIT_PENALTY = 10000;

export function createDiversityTracker(): DiversityTracker {
  return {
    usedItems: new Map(),
    usedColors: new Map(),
    usedFits: new Map(),
    silhouettes: new Map(),
    outfitHashes: new Set(),
  };
}

export function cloneDiversityTracker(tracker: DiversityTracker): DiversityTracker {
  return {
    usedItems: new Map(tracker.usedItems),
    usedColors: new Map(tracker.usedColors),
    usedFits: new Map(tracker.usedFits),
    silhouettes: new Map(tracker.silhouettes),
    outfitHashes: new Set(tracker.outfitHashes),
  };
}

function colorKey(item: WardrobeItem): string {
  return String(item.color || 'unknown').toLowerCase().trim();
}

function fitKey(item: WardrobeItem): string {
  const text = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/slim|skinny|fitted|tailored/.test(text)) return 'slim';
  if (/oversized|relaxed|baggy|wide/.test(text)) return 'relaxed';
  if (/straight|regular|classic/.test(text)) return 'regular';
  return String(item.subcategory || item.category || 'regular').toLowerCase();
}

function silhouetteKey(outfit: WardrobeItem[]): string {
  const top = outfit.find(isTopItem);
  const bottom = outfit.find(isBottomItem);
  return `${fitKey(top || ({} as WardrobeItem))}-${fitKey(bottom || ({} as WardrobeItem))}`;
}

export function hashOutfit(items: WardrobeItem[]): string {
  return items
    .map((i) => String(i.id))
    .filter(Boolean)
    .sort()
    .join('|');
}

export function extractFeatures(items: WardrobeItem[]): OutfitFeatures {
  return {
    itemIds: items.map((i) => String(i.id)).filter(Boolean),
    colors: items.map(colorKey).filter(Boolean),
    fit: fitKey(items.find(isTopItem) || items[0] || ({} as WardrobeItem)),
    silhouette: silhouetteKey(items),
  };
}

/** Non-negotiable structure: top (or dress), bottom (unless dress), shoes. */
export function hasRequiredStructure(items: WardrobeItem[]): boolean {
  if (!items?.length) return false;
  const hasDress = items.some((i) => {
    const cat = String(i.category || '').toLowerCase();
    return cat === 'dresses' || cat === 'dress' || /dress|jumpsuit/.test(`${i.name || ''}`.toLowerCase());
  });
  const hasTop = items.some(isTopItem) || hasDress;
  const hasBottom = items.some(isBottomItem) || hasDress;
  const hasShoes = items.some(isShoesItem);
  return hasTop && hasBottom && hasShoes;
}

export function passesHardOutfitChecks(items: WardrobeItem[]): boolean {
  return hasRequiredStructure(items) && isOutfitValid(items);
}

/** Higher is better. Base 100 minus reuse penalties across the plan so far. */
export function scoreOutfitDiversity(items: WardrobeItem[], tracker: DiversityTracker): number {
  const features = extractFeatures(items);
  let score = 100;

  const hash = hashOutfit(items);
  if (hash && tracker.outfitHashes.has(hash)) {
    return -DUPLICATE_OUTFIT_PENALTY;
  }

  for (const id of features.itemIds) {
    const uses = tracker.usedItems.get(id) || 0;
    score -= uses * ITEM_REUSE_PENALTY;
    const piece = items.find((i) => String(i.id) === id);
    if (piece && isTopItem(piece)) {
      score -= uses * TOP_REUSE_EXTRA_PENALTY;
    }
  }
  for (const color of features.colors) {
    score -= (tracker.usedColors.get(color) || 0) * COLOR_REUSE_PENALTY;
  }
  score -= (tracker.usedFits.get(features.fit) || 0) * FIT_REUSE_PENALTY;
  score -= (tracker.silhouettes.get(features.silhouette) || 0) * SILHOUETTE_REUSE_PENALTY;

  return score;
}

export function updateDiversityTracker(items: WardrobeItem[], tracker: DiversityTracker): void {
  const features = extractFeatures(items);
  const hash = hashOutfit(items);
  if (hash) tracker.outfitHashes.add(hash);

  for (const id of features.itemIds) {
    tracker.usedItems.set(id, (tracker.usedItems.get(id) || 0) + 1);
  }
  for (const color of features.colors) {
    tracker.usedColors.set(color, (tracker.usedColors.get(color) || 0) + 1);
  }
  tracker.usedFits.set(features.fit, (tracker.usedFits.get(features.fit) || 0) + 1);
  tracker.silhouettes.set(
    features.silhouette,
    (tracker.silhouettes.get(features.silhouette) || 0) + 1,
  );
}

/** Seed tracker from prior outfits (stylist regenerations, weekly planner continuity). */
export function seedDiversityTracker(
  priorOutfits: WardrobeItem[][],
  tracker: DiversityTracker = createDiversityTracker(),
): DiversityTracker {
  for (const outfit of priorOutfits) {
    if (outfit?.length) updateDiversityTracker(outfit, tracker);
  }
  return tracker;
}

/** Prefer optional pieces that keep the look valid; never force an invalid layer. */
export function tryAddOptionalPiece(
  base: WardrobeItem[],
  candidate: WardrobeItem | undefined,
): WardrobeItem[] {
  if (!candidate) return base;
  const next = [...base, candidate];
  if (!isOutfitValid(next)) return base;
  return next;
}

export function pickMostDiverse(
  candidates: WardrobeItem[][],
  tracker: DiversityTracker,
): WardrobeItem[] | null {
  let best: WardrobeItem[] | null = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    if (!passesHardOutfitChecks(candidate)) continue;
    const score = scoreOutfitDiversity(candidate, tracker);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Mark excluded IDs as already “used” so single-day picks lean toward unused pieces. */
export function seedTrackerFromExcludeIds(
  excludeItemIds: string[] | undefined,
  tracker: DiversityTracker = createDiversityTracker(),
): DiversityTracker {
  for (const id of excludeItemIds || []) {
    const key = String(id);
    if (!key) continue;
    tracker.usedItems.set(key, (tracker.usedItems.get(key) || 0) + 2);
  }
  return tracker;
}
