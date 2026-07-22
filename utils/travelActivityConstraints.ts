/**
 * Activity → constraint mapping for Travel Capsule.
 * Hard = reject outfit; soft = scoring bias; style = preference only.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import type { TravelActivity } from '@/utils/travelCapsule';

export type ActivityConstraintId =
  | 'beach'
  | 'dinner'
  | 'explore'
  | 'nightlife'
  | 'flight';

export type ActivityScoringWeights = {
  breathability?: number;
  comfort?: number;
  formality?: number;
  versatility?: number;
  styleImpact?: number;
  mobility?: number;
  layering?: number;
};

export type ActivityConstraints = {
  id: ActivityConstraintId;
  label: string;
  /** Soft preferred item patterns (name/category text) */
  preferredPatterns: RegExp[];
  /** Patterns that should be packed when this activity is on the trip */
  capsuleRequirePatterns: RegExp[];
  /** Soft forbidden patterns for day outfits */
  softForbiddenPatterns: RegExp[];
  scoringWeights: ActivityScoringWeights;
  maxLayers?: number;
};

function itemText(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${item.color || ''}`.toLowerCase();
}

export const ACTIVITY_CONSTRAINTS: Record<ActivityConstraintId, ActivityConstraints> = {
  beach: {
    id: 'beach',
    label: 'beach days',
    preferredPatterns: [/short/, /linen/, /sandal/, /slide/, /tee|t-shirt|tank/, /swim/],
    capsuleRequirePatterns: [/sandal|slide|flip.?flop/, /short|linen|tee|t-shirt/],
    softForbiddenPatterns: [/\btie\b|necktie/, /boot|ugg/, /blazer|suit/, /puffer|parka|wool coat/],
    scoringWeights: {
      breathability: 2,
      comfort: 1.5,
      formality: -2,
    },
    maxLayers: 1,
  },
  dinner: {
    id: 'dinner',
    label: 'dinners',
    preferredPatterns: [/oxford|button|blouse|dress shirt|polo/, /trouser|chino|tailored|skirt/, /loafer|derby|heel|boot/],
    capsuleRequirePatterns: [/oxford|button|blouse|dress shirt|polo|blazer/, /loafer|derby|heel|chelsea|dress shoe/],
    softForbiddenPatterns: [/jogger|sweat|track|gym|legging/, /slide|sandal|flip.?flop/, /graphic tee|jersey/],
    scoringWeights: {
      formality: 2.5,
      styleImpact: 1.2,
      comfort: 0.5,
    },
  },
  explore: {
    id: 'explore',
    label: 'exploring',
    preferredPatterns: [/tee|t-shirt|shirt/, /jean|chino|trouser/, /sneaker|trainer|loafer/],
    capsuleRequirePatterns: [/sneaker|trainer|walking|loafer/],
    softForbiddenPatterns: [/stiletto|heel.*4|tight.*suit/, /gown|tuxedo/],
    scoringWeights: {
      comfort: 2,
      versatility: 1.5,
      breathability: 1,
      mobility: 1.2,
    },
  },
  nightlife: {
    id: 'nightlife',
    label: 'nightlife',
    preferredPatterns: [/dark|black|navy/, /fitted|slim|tailored/, /boot|loafer|heel|sneaker/],
    capsuleRequirePatterns: [/blazer|oxford|dress|dark jean|black/],
    softForbiddenPatterns: [/running shoe|trail|gym short|athletic short/],
    scoringWeights: {
      styleImpact: 2.2,
      formality: 1.2,
    },
  },
  flight: {
    id: 'flight',
    label: 'travel days',
    preferredPatterns: [/hoodie|overshirt|cardigan|light jacket|softshell/, /chino|tailored|relaxed|soft/, /sneaker|trainer/],
    capsuleRequirePatterns: [/hoodie|overshirt|cardigan|jacket|blazer|fleece/, /sneaker|trainer/],
    softForbiddenPatterns: [/sandal|slide|flip.?flop/, /stiletto|tight jean|skinny jean.*stiff/],
    scoringWeights: {
      comfort: 3,
      layering: 2,
      mobility: 1.5,
    },
  },
};

/** Map UI / legacy activity ids onto the core constraint set. */
export function normalizeActivityId(raw: string): ActivityConstraintId | null {
  const key = String(raw || '').toLowerCase().trim();
  if (key === 'beach') return 'beach';
  if (key === 'dinner' || key === 'business') return 'dinner';
  if (key === 'explore' || key === 'city' || key === 'walking' || key === 'outdoors') return 'explore';
  if (key === 'nightlife') return 'nightlife';
  if (key === 'flight') return 'flight';
  return null;
}

export function normalizeTripActivities(activities?: string[] | null): ActivityConstraintId[] {
  const out: ActivityConstraintId[] = [];
  for (const a of activities || []) {
    const id = normalizeActivityId(a);
    if (id && id !== 'flight' && !out.includes(id)) out.push(id);
  }
  if (!out.length) out.push('explore');
  return out;
}

export function summarizeActivitiesForCopy(activities?: string[] | null): string {
  const ids = normalizeTripActivities(activities);
  const labels = ids.map((id) => ACTIVITY_CONSTRAINTS[id].label);
  if (labels.length === 1) return `Optimized for ${labels[0]}`;
  if (labels.length === 2) return `Optimized for ${labels[0]} and ${labels[1]}`;
  return `Optimized for ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function matchesAny(item: WardrobeItem, patterns: RegExp[]): boolean {
  const text = itemText(item);
  return patterns.some((p) => p.test(text));
}

/** Soft score delta for an outfit under an activity (higher is better). */
export function scoreOutfitForActivity(items: WardrobeItem[], activity: ActivityConstraintId): number {
  const rules = ACTIVITY_CONSTRAINTS[activity];
  let score = 0;
  const layers = items.filter(isOuterwearItem).length;

  for (const item of items) {
    if (matchesAny(item, rules.preferredPatterns)) score += 1.2;
    if (matchesAny(item, rules.softForbiddenPatterns)) score -= 3;
  }

  const w = rules.scoringWeights;
  const hasComfortBottom = items.some(
    (i) => isBottomItem(i) && /jogger|chino|relaxed|linen|soft/.test(itemText(i)),
  );
  const hasElevated = items.some((i) =>
    /oxford|blazer|loafer|trouser|dress shirt|heel/.test(itemText(i)),
  );
  const hasBreathable = items.some((i) => /linen|short|tee|sandal|cotton/.test(itemText(i)));

  if (w.comfort) score += (hasComfortBottom ? 1 : 0) * w.comfort;
  if (w.formality) score += (hasElevated ? 1 : w.formality < 0 ? 0 : -0.5) * Math.abs(w.formality) * Math.sign(w.formality);
  if (w.breathability) score += (hasBreathable ? 1 : 0) * w.breathability;
  if (w.layering) score += (layers >= 1 ? 1 : -0.5) * w.layering;
  if (w.styleImpact) score += (hasElevated || items.some((i) => /black|navy|fitted/.test(itemText(i))) ? 1 : 0) * w.styleImpact;
  if (w.mobility) score += (items.some((i) => isShoesItem(i) && /sneaker|trainer/.test(itemText(i))) ? 1 : 0) * w.mobility;

  if (rules.maxLayers != null && layers > rules.maxLayers) score -= 2;

  return score;
}

/** Soft reject: true if outfit is clearly wrong for the activity. */
export function violatesActivitySoftRules(items: WardrobeItem[], activity: ActivityConstraintId): boolean {
  const rules = ACTIVITY_CONSTRAINTS[activity];
  const hits = items.filter((i) => matchesAny(i, rules.softForbiddenPatterns)).length;
  if (activity === 'beach' && items.some((i) => /\btie\b/.test(itemText(i)))) return true;
  if (activity === 'dinner' && items.some((i) => isBottomItem(i) && /jogger|sweat|gym/.test(itemText(i)))) {
    return true;
  }
  if (activity === 'flight' && items.some((i) => isShoesItem(i) && /sandal|slide|flip.?flop/.test(itemText(i)))) {
    return true;
  }
  return hits >= 2;
}

/**
 * Ensure capsule contains at least one item matching each activity's must-pack patterns.
 * Returns items to force-add from the full wardrobe.
 */
export function pickActivityCapsuleRequirements(
  wardrobe: WardrobeItem[],
  selected: WardrobeItem[],
  activities: TravelActivity[] | string[],
): WardrobeItem[] {
  const ids = normalizeTripActivities(activities);
  // Always pack for flight comfort when building a travel capsule
  if (!ids.includes('explore')) {
    // explore shoes often double as flight shoes
  }
  const needed = [...ids];
  // Flight layer + closed shoes should always be considered for travel
  const forcePatterns: RegExp[] = [
    ...ACTIVITY_CONSTRAINTS.flight.capsuleRequirePatterns,
  ];
  for (const id of needed) {
    forcePatterns.push(...ACTIVITY_CONSTRAINTS[id].capsuleRequirePatterns);
  }

  const additions: WardrobeItem[] = [];
  const selectedIds = new Set(selected.map((i) => String(i.id)));

  for (const pattern of forcePatterns) {
    const already = [...selected, ...additions].some((i) => pattern.test(itemText(i)));
    if (already) continue;
    const pick = wardrobe.find(
      (i) => !selectedIds.has(String(i.id)) && pattern.test(itemText(i)),
    );
    if (pick) {
      additions.push(pick);
      selectedIds.add(String(pick.id));
    }
  }

  return additions;
}

/** Assign a primary activity for each lookbook day (flight on edges). */
export function assignDayActivities(
  totalDays: number,
  tripDays: number,
  activities?: string[] | null,
): ActivityConstraintId[] {
  const ids = normalizeTripActivities(activities);
  const plan: ActivityConstraintId[] = [];
  const activeTrip = Math.max(1, Math.min(totalDays, tripDays || totalDays));

  for (let i = 0; i < totalDays; i++) {
    if (i === 0 || i === activeTrip - 1) {
      plan.push('flight');
      continue;
    }
    if (i >= activeTrip) {
      // Extra looks beyond trip: rotate trip activities
      plan.push(ids[(i - activeTrip) % ids.length]);
      continue;
    }
    // Mid-trip: rotate selected activities (prefer explore as default filler)
    const rotation = ids.length ? ids : (['explore'] as ActivityConstraintId[]);
    plan.push(rotation[(i - 1) % rotation.length]);
  }

  return plan;
}

export function activityBoostForItem(item: WardrobeItem, activities: string[] | null | undefined): number {
  const ids = normalizeTripActivities(activities);
  let boost = 0;
  for (const id of ids) {
    const rules = ACTIVITY_CONSTRAINTS[id];
    if (matchesAny(item, rules.preferredPatterns)) boost += 0.15;
    if (matchesAny(item, rules.capsuleRequirePatterns)) boost += 0.25;
    if (matchesAny(item, rules.softForbiddenPatterns)) boost -= 0.2;
  }
  // Flight-friendly layers/shoes always useful on trips
  if (matchesAny(item, ACTIVITY_CONSTRAINTS.flight.preferredPatterns)) boost += 0.1;
  if (isTopItem(item) || isBottomItem(item) || isShoesItem(item) || isOuterwearItem(item)) {
    // no-op structural preference
  }
  return boost;
}
