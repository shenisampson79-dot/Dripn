/**
 * Travel Capsule — packing optimizer for DFY Lite (Travel Capsule product).
 * Selects a high-density 9–12 item subset that can cover 14 days of outfits.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
  wardrobeCanBuildCompleteOutfit,
} from '@/utils/completeOutfit';
import { isOutfitValid } from '@/utils/outfitClashRules';
import {
  LOOKBOOK_DEFAULT_TOTAL_DAYS,
  addLocalDays,
  formatLocalDateKey,
  parseLocalDateOnly,
  startOfLocalDay,
} from '@/utils/lookbookTripDay';
import {
  activityBoostForItem,
  pickActivityCapsuleRequirements,
} from '@/utils/travelActivityConstraints';

export type TravelVibe = 'casual' | 'dressy' | 'mixed';

/** Core trip activities (UI). Legacy ids still accepted and normalized. */
export type TravelActivity =
  | 'explore'
  | 'dinner'
  | 'beach'
  | 'nightlife'
  // legacy aliases (still accepted)
  | 'city'
  | 'walking'
  | 'business'
  | 'outdoors';

export type TravelPlan = {
  destination: string;
  startDate: string;
  endDate: string;
  /** Trip length in days (UI); engine still generates 14 looks. */
  tripDays: number;
  vibe: TravelVibe;
  activities: TravelActivity[];
  /** Optional resolved coords for destination weather */
  lat?: number;
  lon?: number;
  createdAt: string;
};

export type TravelCapsuleResult = {
  items: WardrobeItem[];
  itemIds: string[];
  summary: {
    tops: number;
    bottoms: number;
    shoes: number;
    layers: number;
    estimatedCombos: number;
  };
  notes: string[];
};

const TARGET = {
  tops: { min: 4, max: 5 },
  bottoms: { min: 2, max: 3 },
  shoes: { min: 2, max: 3 },
  layers: { min: 1, max: 2 },
  totalMax: 12,
};

function itemText(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${item.color || ''}`.toLowerCase();
}

function isHeavyLayer(item: WardrobeItem): boolean {
  return /down|puffer|parka|winter|ski|quilted|insulated|thermal|padded/.test(itemText(item));
}

function isWarmLayer(item: WardrobeItem): boolean {
  if (isHeavyLayer(item)) return true;
  return /\bfleece\b|hoodie|sweatshirt|\bsweater\b|\bjumper\b/.test(itemText(item));
}

function isDressLike(item: WardrobeItem): boolean {
  const cat = String(item.category || '').toLowerCase();
  return cat === 'dresses' || cat === 'dress' || /\bdress\b|jumpsuit/.test(itemText(item));
}

/** High-visibility pieces that must be spaced harder across a lookbook. */
export function isStatementItem(item: WardrobeItem): boolean {
  const t = itemText(item);
  return /graphic|print|logo|bold|neon|sequin|embroider|jersey|fc\b|football|kit\b|team shirt|liverpool|arsenal|chelsea|manchester/.test(t);
}

function isStatement(item: WardrobeItem): boolean {
  return isStatementItem(item);
}

function isNeutralColor(item: WardrobeItem): boolean {
  return /black|white|grey|gray|navy|beige|cream|tan|brown|khaki|olive|denim|blue/.test(
    String(item.color || '').toLowerCase(),
  );
}

function versatilityScore(item: WardrobeItem): number {
  const t = itemText(item);
  if (isDressLike(item)) return 0.75;
  if (isTopItem(item)) {
    if (/oxford|button|blouse|linen|plain|solid|crew/.test(t) && !isStatement(item)) return 0.95;
    if (/tee|t-shirt|polo/.test(t) && !isStatement(item)) return 0.9;
    if (isStatement(item)) return 0.55;
    return 0.75;
  }
  if (isBottomItem(item)) {
    if (/jean|chino|trouser|khaki/.test(t)) return 0.95;
    if (/short/.test(t)) return 0.6;
    if (/jogger|sweat|track/.test(t)) return 0.5;
    return 0.8;
  }
  if (isShoesItem(item)) {
    if (/sneaker|trainer|loafer|boot|derby|oxford/.test(t)) return 0.9;
    if (/heel|sandal|slide/.test(t)) return 0.55;
    return 0.7;
  }
  if (isOuterwearItem(item)) {
    if (isHeavyLayer(item)) return 0.55;
    return 0.85;
  }
  return 0.5;
}

function weatherFitScore(
  item: WardrobeItem,
  tempMin: number | null,
  tempMax: number | null,
): number {
  if (tempMax == null || tempMin == null) return 0.7;
  const avg = (tempMin + tempMax) / 2;
  if (avg >= 22) {
    if (isHeavyLayer(item) || isWarmLayer(item)) return 0.15;
    if (/short|linen|sandal|tee|tank/.test(itemText(item))) return 0.95;
    return 0.7;
  }
  if (avg <= 10) {
    if (/short|sandal|linen|tank/.test(itemText(item))) return 0.2;
    if (isHeavyLayer(item) || isWarmLayer(item)) return 0.95;
    return 0.75;
  }
  return 0.8;
}

function formalityFlexScore(item: WardrobeItem, vibe: TravelVibe): number {
  const t = itemText(item);
  const dressy = /blazer|oxford|loafer|trouser|heel|dress shirt|tailored/.test(t);
  const casual = /tee|jean|sneaker|hoodie|short|sandal/.test(t);
  if (vibe === 'dressy') return dressy ? 1 : casual ? 0.4 : 0.7;
  if (vibe === 'casual') return casual ? 1 : dressy ? 0.45 : 0.75;
  return dressy && casual ? 0.9 : 0.75;
}

function preferenceScore(item: WardrobeItem): number {
  let score = 0.6;
  if (item.isFavorite) score += 0.25;
  const worn = item.timesWorn || 0;
  if (worn > 0 && worn < 20) score += 0.1;
  if (worn >= 40) score -= 0.05;
  return Math.max(0, Math.min(1, score));
}

function pairCompatible(a: WardrobeItem, b: WardrobeItem): boolean {
  if (String(a.id) === String(b.id)) return false;
  // Top+bottom or dress alone tested later; here check any two-piece clash
  return isOutfitValid([a, b]);
}

function compatibilityScore(item: WardrobeItem, wardrobe: WardrobeItem[]): number {
  const partners = wardrobe.filter((other) => {
    if (String(other.id) === String(item.id)) return false;
    const aTop = isTopItem(item) || isDressLike(item);
    const bBottom = isBottomItem(other);
    const aBottom = isBottomItem(item);
    const bTop = isTopItem(other) || isDressLike(other);
    if ((aTop && bBottom) || (aBottom && bTop)) return pairCompatible(item, other);
    if (isShoesItem(item) || isShoesItem(other)) return true;
    return false;
  });
  const pool = Math.max(1, wardrobe.length - 1);
  return Math.min(1, partners.length / Math.min(pool, 12));
}

function scoreItem(
  item: WardrobeItem,
  wardrobe: WardrobeItem[],
  plan: TravelPlan,
  tempMin: number | null,
  tempMax: number | null,
): number {
  return (
    versatilityScore(item) * 0.35
    + compatibilityScore(item, wardrobe) * 0.25
    + weatherFitScore(item, tempMin, tempMax) * 0.2
    + formalityFlexScore(item, plan.vibe) * 0.1
    + preferenceScore(item) * 0.1
    + activityBoostForItem(item, plan.activities)
  );
}

function similarity(a: WardrobeItem, b: WardrobeItem): number {
  let score = 0;
  if (String(a.category || '').toLowerCase() === String(b.category || '').toLowerCase()) score += 0.35;
  if (String(a.color || '').toLowerCase() === String(b.color || '').toLowerCase()) score += 0.3;
  const sa = `${a.subcategory || ''}`.toLowerCase();
  const sb = `${b.subcategory || ''}`.toLowerCase();
  if (sa && sb && sa === sb) score += 0.25;
  if (isTopItem(a) === isTopItem(b) && isBottomItem(a) === isBottomItem(b)) score += 0.1;
  return score;
}

function countCombos(items: WardrobeItem[]): number {
  const tops = items.filter((i) => isTopItem(i) || isDressLike(i));
  const bottoms = items.filter(isBottomItem);
  const shoes = items.filter(isShoesItem);
  if (!tops.length || !bottoms.length) return 0;
  const shoeFactor = Math.max(1, shoes.length);
  return tops.length * bottoms.length * shoeFactor;
}

function categoryCounts(items: WardrobeItem[]) {
  return {
    tops: items.filter((i) => isTopItem(i) || isDressLike(i)).length,
    bottoms: items.filter(isBottomItem).length,
    shoes: items.filter(isShoesItem).length,
    layers: items.filter(isOuterwearItem).length,
  };
}

function needsCategory(selected: WardrobeItem[], kind: keyof typeof TARGET): boolean {
  const counts = categoryCounts(selected);
  return counts[kind] < TARGET[kind].min;
}

function atCategoryCap(selected: WardrobeItem[], kind: keyof typeof TARGET): boolean {
  const counts = categoryCounts(selected);
  return counts[kind] >= TARGET[kind].max;
}

function itemKind(item: WardrobeItem): keyof typeof TARGET | 'other' {
  if (isShoesItem(item)) return 'shoes';
  if (isOuterwearItem(item)) return 'layers';
  if (isBottomItem(item)) return 'bottoms';
  if (isTopItem(item) || isDressLike(item)) return 'tops';
  return 'other';
}

function marginalGain(
  candidate: WardrobeItem,
  selected: WardrobeItem[],
  wardrobe: WardrobeItem[],
  scored: Map<string, number>,
  tempMin: number | null,
  tempMax: number | null,
): number {
  const before = countCombos(selected);
  const after = countCombos([...selected, candidate]);
  const newCombos = after - before;
  const avgCompat =
    selected.length === 0
      ? compatibilityScore(candidate, wardrobe)
      : selected.reduce((sum, s) => sum + (pairCompatible(candidate, s) ? 1 : 0), 0) / selected.length;
  const redundancy = selected.reduce((max, s) => Math.max(max, similarity(candidate, s)), 0);
  const weatherBoost = weatherFitScore(candidate, tempMin, tempMax);
  const base = scored.get(String(candidate.id)) || 0;
  const neutralBoost = isNeutralColor(candidate) ? 0.15 : 0;

  return (
    newCombos * 2
    + avgCompat * 1.5
    - redundancy * 2
    + weatherBoost * 1.2
    + base
    + neutralBoost
  );
}

/**
 * Build a travel capsule (9–12 items) from the full wardrobe.
 * Falls back to the full viable wardrobe if packing selection cannot cover structure.
 */
export function buildTravelCapsule(
  wardrobe: WardrobeItem[],
  plan: TravelPlan,
  options?: { tempMin?: number | null; tempMax?: number | null },
): TravelCapsuleResult {
  const notes: string[] = [];
  const tempMin = options?.tempMin ?? null;
  const tempMax = options?.tempMax ?? null;

  if (!wardrobeCanBuildCompleteOutfit(wardrobe)) {
    return {
      items: wardrobe,
      itemIds: wardrobe.map((i) => String(i.id)),
      summary: { ...categoryCounts(wardrobe), estimatedCombos: countCombos(wardrobe) },
      notes: ['Add more wardrobe pieces so we can pack a complete capsule.'],
    };
  }

  const scored = new Map<string, number>();
  for (const item of wardrobe) {
    scored.set(String(item.id), scoreItem(item, wardrobe, plan, tempMin, tempMax));
  }

  const selected: WardrobeItem[] = [];
  const remaining = [...wardrobe].sort(
    (a, b) => (scored.get(String(b.id)) || 0) - (scored.get(String(a.id)) || 0),
  );

  const tryAdd = (item: WardrobeItem): boolean => {
    const kind = itemKind(item);
    if (kind !== 'other' && atCategoryCap(selected, kind) && !needsCategory(selected, kind)) {
      return false;
    }
    if (selected.some((s) => similarity(s, item) > 0.85)) return false;
    if (selected.filter(isStatement).length >= 2 && isStatement(item)) return false;
    selected.push(item);
    return true;
  };

  // Seed must-haves: best neutral sneaker-like shoe, best jeans/chino, best versatile top
  const seedPools: Array<(i: WardrobeItem) => boolean> = [
    (i) => isShoesItem(i) && /sneaker|trainer|loafer|boot/.test(itemText(i)),
    (i) => isBottomItem(i) && /jean|chino|trouser|khaki/.test(itemText(i)),
    (i) => isTopItem(i) && !isStatement(i),
  ];
  for (const pred of seedPools) {
    const pick = remaining.find((i) => pred(i) && !selected.includes(i));
    if (pick) tryAdd(pick);
  }

  while (selected.length < TARGET.totalMax) {
    let best: WardrobeItem | null = null;
    let bestGain = -Infinity;
    for (const candidate of remaining) {
      if (selected.some((s) => String(s.id) === String(candidate.id))) continue;
      const kind = itemKind(candidate);
      if (kind !== 'other' && atCategoryCap(selected, kind) && !needsCategory(selected, kind)) {
        continue;
      }
      if (selected.some((s) => similarity(s, candidate) > 0.85)) continue;
      const gain = marginalGain(candidate, selected, wardrobe, scored, tempMin, tempMax);
      // Prefer filling missing categories
      const priority =
        kind !== 'other' && needsCategory(selected, kind) ? gain + 3 : gain;
      if (priority > bestGain) {
        bestGain = priority;
        best = candidate;
      }
    }
    if (!best) break;
    if (!tryAdd(best)) {
      // remove from consideration by marking as selected-failed — skip next loops
      remaining.splice(remaining.indexOf(best), 1);
      continue;
    }
    const counts = categoryCounts(selected);
    if (
      counts.tops >= TARGET.tops.min
      && counts.bottoms >= TARGET.bottoms.min
      && counts.shoes >= TARGET.shoes.min
      && countCombos(selected) >= 18
      && selected.length >= 9
    ) {
      // Soft stop once dense enough and mins met
      if (!needsCategory(selected, 'layers') || counts.layers >= TARGET.layers.min) {
        break;
      }
    }
  }

  // Enforce structure from full wardrobe if capsule is incomplete
  const ensure = (pred: (i: WardrobeItem) => boolean) => {
    if (selected.some(pred)) return;
    const pick = wardrobe
      .filter(pred)
      .sort((a, b) => (scored.get(String(b.id)) || 0) - (scored.get(String(a.id)) || 0))[0];
    if (pick && !selected.some((s) => String(s.id) === String(pick.id))) {
      selected.push(pick);
      notes.push(`Added ${pick.name || 'a piece'} to complete packing essentials.`);
    }
  };
  ensure(isTopItem);
  ensure(isBottomItem);
  ensure(isShoesItem);

  if (tempMax != null && tempMax < 14) {
    ensure((i) => isOuterwearItem(i) || isWarmLayer(i));
  }

  // Activity + flight must-haves (sandals for beach, elevated shoes for dinner, etc.)
  const activityAdds = pickActivityCapsuleRequirements(wardrobe, selected, plan.activities);
  for (const add of activityAdds) {
    if (selected.length >= 14) break;
    if (!selected.some((s) => String(s.id) === String(add.id))) {
      selected.push(add);
      notes.push(`Packed ${add.name || 'a piece'} for your trip activities.`);
    }
  }

  let items = selected;
  if (!wardrobeCanBuildCompleteOutfit(items) || countCombos(items) < 12) {
    notes.push('Expanded capsule slightly so you have enough mix-and-match looks.');
    // Expand: take top-scoring remaining until combos ok or max 14
    const extras = wardrobe
      .filter((w) => !items.some((s) => String(s.id) === String(w.id)))
      .sort((a, b) => (scored.get(String(b.id)) || 0) - (scored.get(String(a.id)) || 0));
    for (const extra of extras) {
      if (items.length >= 14) break;
      items = [...items, extra];
      if (countCombos(items) >= 18 && wardrobeCanBuildCompleteOutfit(items)) break;
    }
  }

  const summary = {
    ...categoryCounts(items),
    estimatedCombos: countCombos(items),
  };

  notes.unshift(
    `Packed ${items.length} pieces for ${plan.destination || 'your trip'} — ~${summary.estimatedCombos} outfit combos.`,
  );

  return {
    items,
    itemIds: items.map((i) => String(i.id)),
    summary,
    notes,
  };
}

export function tripLengthDays(startDate: string, endDate: string): number {
  const start = parseLocalDateOnly(startDate);
  const end = parseLocalDateOnly(endDate);
  if (!start || !end) return LOOKBOOK_DEFAULT_TOTAL_DAYS;
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(LOOKBOOK_DEFAULT_TOTAL_DAYS, days));
}

/**
 * Resolve trip length for flight-day placement.
 * Prefers endDate − startDate; falls back to tripDays; defaults to full 14-day capsule
 * so Return Travel Day is not stranded mid-lookbook when dates were never set.
 */
export function resolveTravelTripDays(plan?: Partial<TravelPlan> | null): number {
  if (plan?.startDate && plan?.endDate) {
    return tripLengthDays(plan.startDate, plan.endDate);
  }
  if (typeof plan?.tripDays === 'number' && plan.tripDays > 0) {
    return Math.max(1, Math.min(LOOKBOOK_DEFAULT_TOTAL_DAYS, Math.round(plan.tripDays)));
  }
  return LOOKBOOK_DEFAULT_TOTAL_DAYS;
}

export function defaultTravelPlan(partial?: Partial<TravelPlan>): TravelPlan {
  const start =
    partial?.startDate
    || formatLocalDateKey(startOfLocalDay());
  const end =
    partial?.endDate
    || addLocalDays(start, LOOKBOOK_DEFAULT_TOTAL_DAYS - 1);
  const tripDays = partial?.tripDays ?? tripLengthDays(start, end);
  return {
    destination: partial?.destination || '',
    startDate: start,
    endDate: end,
    tripDays,
    vibe: partial?.vibe || 'mixed',
    activities: partial?.activities || ['explore'],
    lat: partial?.lat,
    lon: partial?.lon,
    createdAt: partial?.createdAt || new Date().toISOString(),
  };
}
