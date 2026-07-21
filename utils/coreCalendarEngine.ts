/**
 * Guaranteed 30-day Core calendar generation — local, deterministic, constraint-first.
 * AI never picks items. Always returns exactly `totalDays` outfits when the wardrobe
 * can build at least one complete outfit (top + bottom + shoes).
 */

import { buildWeekOccasionRotation } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { StylistId } from '@/services/DFYService';
import {
  isBottomItem,
  isShoesItem,
  isTopItem,
  wardrobeCanBuildCompleteOutfit,
} from '@/utils/completeOutfit';
import {
  type DFYCalendarMappedOutfit,
  mapApiLookbookToCalendarOutfits,
} from '@/utils/dfyCalendarBridge';
import {
  createDiversityTracker,
  hashOutfit,
  passesHardOutfitChecks,
  pickMostDiverse,
  updateDiversityTracker,
} from '@/utils/outfitDiversity';
import { orderItemIdsByVisualOrder } from '@/utils/outfitItemOrder';
import type { LaundryProfile } from '@/utils/wearRules';
import { DEFAULT_LAUNDRY_PROFILE } from '@/utils/wearRules';
import {
  allocateMultiDayPlan,
  buildOccasionPools,
  type AllocationMode,
  type DayAllocation,
} from '@/utils/wardrobeAllocationEngine';

export const CORE_CALENDAR_ENGINE_VERSION = 'core_v2.1';
export const LITE_LOOKBOOK_ENGINE_VERSION = 'lite_travel_v2.0';

const MAX_EMERGENCY_COMBOS = 80;

export type GuaranteedCoreCalendarResult = {
  outfits: DFYCalendarMappedOutfit[];
  mode: AllocationMode;
  modeLabel: string;
  emergencyDays: number;
  generatedLocally: true;
};

function lastWornDay(itemId: string, usageLog: Map<string, number>): number {
  return usageLog.get(itemId) ?? -999;
}

/** Pick a valid outfit for one day when the main allocator could not fill the slot. */
function buildEmergencyDayItems(
  wardrobe: WardrobeItem[],
  dayIndex: number,
  occasionType: Parameters<typeof buildOccasionPools>[1],
  usageLog: Map<string, number>,
  diversity = createDiversityTracker(),
): WardrobeItem[] {
  const pools = buildOccasionPools(wardrobe, occasionType);
  const tops = pools.tops.length ? pools.tops : wardrobe.filter(isTopItem);
  const bottoms = pools.bottoms.length ? pools.bottoms : wardrobe.filter(isBottomItem);
  const shoes = pools.shoes.length ? pools.shoes : wardrobe.filter(isShoesItem);

  const byFreshness = (items: WardrobeItem[]) =>
    [...items].sort(
      (a, b) => lastWornDay(String(a.id), usageLog) - lastWornDay(String(b.id), usageLog),
    );

  const sortedTops = byFreshness(tops);
  const sortedBottoms = byFreshness(bottoms);
  const sortedShoes = byFreshness(shoes);

  if (!sortedTops.length || !sortedBottoms.length || !sortedShoes.length) {
    return [];
  }

  const candidates: WardrobeItem[][] = [];
  let attempts = 0;
  for (let ti = 0; ti < sortedTops.length && attempts < MAX_EMERGENCY_COMBOS; ti++) {
    const top = sortedTops[(dayIndex + ti) % sortedTops.length];
    for (let bi = 0; bi < sortedBottoms.length && attempts < MAX_EMERGENCY_COMBOS; bi++) {
      const bottom = sortedBottoms[(dayIndex + bi) % sortedBottoms.length];
      for (let si = 0; si < sortedShoes.length && attempts < MAX_EMERGENCY_COMBOS; si++) {
        attempts++;
        const shoe = sortedShoes[(dayIndex + si) % sortedShoes.length];
        const combo = [top, bottom, shoe];
        const sig = hashOutfit(combo);
        if (sig && diversity.outfitHashes.has(sig)) continue;
        if (!passesHardOutfitChecks(combo)) continue;
        candidates.push(combo);
      }
    }
  }

  const best = pickMostDiverse(candidates, diversity);
  return best || [];
}

function markUsage(items: WardrobeItem[], dayIndex: number, usageLog: Map<string, number>): void {
  for (const item of items) {
    usageLog.set(String(item.id), dayIndex);
  }
}

/**
 * Allocate exactly `totalDays` with progressive constraint relaxation + emergency backfill.
 * Never throws; returns fewer than totalDays only when the wardrobe cannot build any outfit.
 */
export function allocateGuaranteedMultiDayPlan(params: {
  wardrobe: WardrobeItem[];
  totalDays: number;
  planStartDate: Date;
  laundryProfile?: LaundryProfile;
}): {
  days: DayAllocation[];
  mode: AllocationMode;
  modeLabel: string;
  emergencyDays: number;
} {
  const {
    wardrobe,
    totalDays,
    planStartDate,
    laundryProfile = DEFAULT_LAUNDRY_PROFILE,
  } = params;

  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);
  const occasionTypes = buildWeekOccasionRotation(totalDays, null, start);

  const tierModes: Array<Exclude<AllocationMode, 'failure'> | undefined> = [
    undefined,
    'soft',
    'rotation',
  ];

  let bestDays: DayAllocation[] = [];
  let bestMode: AllocationMode = 'rotation';
  let bestLabel = 'Rotation mode active';

  for (const forceMode of tierModes) {
    const plan = allocateMultiDayPlan({
      wardrobe,
      occasionTypes,
      preferReduceDaysOverRotation: false,
      allowReduceDays: false,
      forceMode,
      laundryProfile,
      referenceDate: start,
    });
    if (plan.ok && plan.days.length > bestDays.length) {
      bestDays = plan.days;
      bestMode = plan.mode;
      bestLabel = plan.modeLabel;
      if (bestDays.length >= totalDays) break;
    }
  }

  const usageLog = new Map<string, number>();
  const diversity = createDiversityTracker();
  for (const day of bestDays) {
    const dayItems = day.itemIds
      .map((id) => wardrobe.find((w) => String(w.id) === id))
      .filter((item): item is WardrobeItem => Boolean(item));
    markUsage(dayItems, day.dayIndex, usageLog);
    if (dayItems.length) updateDiversityTracker(dayItems, diversity);
  }

  let emergencyDays = 0;
  while (bestDays.length < totalDays) {
    const dayIndex = bestDays.length;
    const occasionType = occasionTypes[dayIndex] || occasionTypes[0];
    const items = buildEmergencyDayItems(
      wardrobe,
      dayIndex,
      occasionType,
      usageLog,
      diversity,
    );
    if (!passesHardOutfitChecks(items)) break;

    markUsage(items, dayIndex, usageLog);
    updateDiversityTracker(items, diversity);
    emergencyDays++;
    bestDays.push({
      dayIndex,
      occasionType,
      itemIds: orderItemIdsByVisualOrder(
        items.map((i) => String(i.id)),
        wardrobe,
      ),
      reusedSoftIds: [],
      reusedHardIds: [],
    });
  }

  return {
    days: bestDays,
    mode: emergencyDays > 0 && bestDays.length < totalDays ? 'failure' : bestMode,
    modeLabel: emergencyDays > 0 ? `${bestLabel} · emergency fill` : bestLabel,
    emergencyDays,
  };
}

/** Single entrypoint: always returns `totalDays` calendar rows when wardrobe is viable. */
export function generateGuaranteedCoreCalendar(params: {
  wardrobe: WardrobeItem[];
  planStartDate: Date;
  totalDays: number;
  stylistId?: StylistId;
  laundryProfile?: LaundryProfile;
}): GuaranteedCoreCalendarResult | null {
  const {
    wardrobe,
    planStartDate,
    totalDays,
    stylistId = 'ruby',
    laundryProfile = DEFAULT_LAUNDRY_PROFILE,
  } = params;

  if (!wardrobeCanBuildCompleteOutfit(wardrobe) || totalDays < 1) {
    return null;
  }

  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);

  const { days, mode, modeLabel, emergencyDays } = allocateGuaranteedMultiDayPlan({
    wardrobe,
    totalDays,
    planStartDate: start,
    laundryProfile,
  });

  if (days.length < totalDays) {
    return null;
  }

  const byId = new Map(wardrobe.map((w) => [String(w.id), w]));
  const modeSuffix = mode !== 'strict' || emergencyDays > 0 ? ` (${modeLabel})` : '';

  const rawOutfits = days.slice(0, totalDays).map((day, idx) => {
    const items = day.itemIds
      .map((id) => byId.get(String(id)))
      .filter((item): item is WardrobeItem => Boolean(item))
      .map((item) => ({
        id: String(item.id),
        name: item.name || '',
        category: item.category || '',
        color: item.color || '',
        imageUri: item.imageUri || item.enhancedImageUri,
      }));

    return {
      id: `core-day-${idx + 1}`,
      dayNumber: idx + 1,
      title: idx === 0 ? "Today's Look" : `Day ${idx + 1} Look`,
      occasion: day.occasionType.replace(/_/g, ' '),
      stylistNote: `Day ${idx + 1}: planned from your wardrobe${modeSuffix}.`,
      stylistId,
      items,
    };
  });

  const outfits = mapApiLookbookToCalendarOutfits(rawOutfits, start, wardrobe, stylistId);

  // Never duplicate days to pad — short calendars fail honestly
  if (outfits.length < totalDays) {
    return null;
  }

  return {
    outfits: outfits.slice(0, totalDays),
    mode,
    modeLabel,
    emergencyDays,
    generatedLocally: true,
  };
}
