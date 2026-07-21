/**
 * Packing summary — turns capsule + outfits into user-facing “what to pack”.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import { isOutfitValid } from '@/utils/outfitClashRules';
import {
  normalizeTripActivities,
  summarizeActivitiesForCopy,
} from '@/utils/travelActivityConstraints';
import type { TravelPlan } from '@/utils/travelCapsule';

export type PackingGroup = {
  key: 'tops' | 'bottoms' | 'shoes' | 'layers' | 'extras';
  label: string;
  items: Array<{ id: string; name: string }>;
};

export type PackingSummary = {
  title: string;
  coverageText: string;
  howItWorks: string;
  whyTheseItems: string[];
  activityLine: string;
  groupedItems: PackingGroup[];
  itemCount: number;
  estimatedCombos: number;
  tripDays: number;
  optionalAddOns: string[];
};

function itemName(item: WardrobeItem): string {
  return item.name || item.category || 'Item';
}

function isDressLike(item: WardrobeItem): boolean {
  const cat = String(item.category || '').toLowerCase();
  return cat === 'dresses' || cat === 'dress' || /\bdress\b|jumpsuit/.test(`${item.name || ''}`.toLowerCase());
}

function groupCapsule(items: WardrobeItem[]): PackingGroup[] {
  const tops = items.filter((i) => isTopItem(i) || isDressLike(i));
  const bottoms = items.filter(isBottomItem);
  const shoes = items.filter(isShoesItem);
  const layers = items.filter(isOuterwearItem);
  const used = new Set(
    [...tops, ...bottoms, ...shoes, ...layers].map((i) => String(i.id)),
  );
  const extras = items.filter((i) => !used.has(String(i.id)));

  const toGroup = (
    key: PackingGroup['key'],
    label: string,
    rows: WardrobeItem[],
  ): PackingGroup | null => {
    if (!rows.length) return null;
    return {
      key,
      label: `${label} (${rows.length})`,
      items: rows.map((i) => ({ id: String(i.id), name: itemName(i) })),
    };
  };

  return [
    toGroup('tops', 'Tops', tops),
    toGroup('bottoms', 'Bottoms', bottoms),
    toGroup('shoes', 'Shoes', shoes),
    toGroup('layers', 'Layers', layers),
    toGroup('extras', 'Extras', extras),
  ].filter(Boolean) as PackingGroup[];
}

function estimateValidCombos(items: WardrobeItem[]): number {
  const tops = items.filter((i) => isTopItem(i) || isDressLike(i));
  const bottoms = items.filter(isBottomItem);
  const shoes = items.filter(isShoesItem);
  if (!tops.length || !bottoms.length) return 0;
  let valid = 0;
  const shoePool = shoes.length ? shoes : [null];
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoePool) {
        const combo = shoe ? [top, bottom, shoe] : [top, bottom];
        if (isOutfitValid(combo)) valid++;
      }
    }
  }
  return valid || tops.length * bottoms.length * Math.max(1, shoes.length);
}

function weatherWhy(tempMin: number | null, tempMax: number | null): string | null {
  if (tempMax == null) return null;
  if (tempMax >= 26) return 'Lightweight, breathable pieces for warm weather';
  if (tempMax < 14) return 'Includes warmer layers for cooler conditions';
  if (tempMin != null && tempMax - tempMin >= 10) {
    return `Works across ${tempMin}–${tempMax}°C with removable layers`;
  }
  return `Packed for about ${tempMin ?? tempMax - 4}–${tempMax}°C`;
}

export function generatePackingSummary(params: {
  capsuleItems: WardrobeItem[];
  travelPlan?: TravelPlan | null;
  tempMin?: number | null;
  tempMax?: number | null;
  lookbookDays?: number;
}): PackingSummary {
  const {
    capsuleItems,
    travelPlan,
    tempMin = null,
    tempMax = null,
    lookbookDays = 14,
  } = params;

  const tripDays = travelPlan?.tripDays || lookbookDays;
  const combos = estimateValidCombos(capsuleItems);
  const grouped = groupCapsule(capsuleItems);
  const activityLine = summarizeActivitiesForCopy(travelPlan?.activities);
  const activities = normalizeTripActivities(travelPlan?.activities);

  const coverageRatio = Math.min(1, combos / Math.max(tripDays, 1));
  let coverageText: string;
  if (coverageRatio >= 1 && combos >= tripDays * 1.5) {
    coverageText = `Covers all ${tripDays} trip days with extra options (${combos}+ mixes)`;
  } else if (coverageRatio >= 1) {
    coverageText = `Fully covers your ${tripDays}-day trip`;
  } else {
    coverageText = `Covers your trip with smart re-wear across ${lookbookDays} looks`;
  }

  const why: string[] = [];
  const weather = weatherWhy(tempMin, tempMax);
  if (weather) why.push(weather);
  why.push(activityLine);
  why.push('Designed for versatility and minimal packing');
  if (tripDays > 7) {
    why.push('Includes a re-wear strategy so you pack less for longer trips');
  }

  const optionalAddOns: string[] = [];
  if (!activities.includes('dinner')) {
    optionalAddOns.push('+1 elevated piece if you add dinner plans');
  }
  if (grouped.find((g) => g.key === 'tops') && (grouped.find((g) => g.key === 'tops')?.items.length || 0) < 5) {
    optionalAddOns.push('+1 backup top if you want more variety');
  }

  return {
    title: `You only need ${capsuleItems.length} items for this trip`,
    coverageText,
    howItWorks: `Each top pairs with multiple bottoms and shoes — about ${combos} outfit combinations from this capsule.`,
    whyTheseItems: why,
    activityLine,
    groupedItems: grouped,
    itemCount: capsuleItems.length,
    estimatedCombos: combos,
    tripDays,
    optionalAddOns,
  };
}
