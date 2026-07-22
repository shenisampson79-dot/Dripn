import type { OutfitPieceVisual } from '@/components/OutfitPiecesVisual';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  DFYLiteDelivery,
  DFYOccasion,
  DFYOutfit,
  DFYOutfitItem,
  LITE_LOOKBOOK_DAYS,
  StylistId,
} from '@/services/DFYService';
import { DailyForecast, DailyForecastDay } from '@/services/WeatherService';
import { LITE_LOOKBOOK_ENGINE_VERSION } from '@/utils/coreCalendarEngine';
import { wardrobeCanBuildCompleteOutfit } from '@/utils/completeOutfit';
import { isOutfitValid } from '@/utils/outfitClashRules';
import { passesHardOutfitChecks } from '@/utils/outfitDiversity';
import { buildTravelCapsule, defaultTravelPlan, resolveTravelTripDays, type TravelPlan } from '@/utils/travelCapsule';
import {
  ACTIVITY_CONSTRAINTS,
  assignDayActivities,
  summarizeActivitiesForCopy,
} from '@/utils/travelActivityConstraints';
import { flightOutfitNote } from '@/utils/flightOutfitBuilder';
import { generatePackingSummary } from '@/utils/packingSummary';
import {
  allocateScheduleDrivenLookbook,
  generateNotesFromOutfit,
} from '@/utils/scheduleDrivenAllocator';
import {
  allocateMultiDayPlan,
  allocateSingleDayOutfit,
  normalizeAllocatorOccasion,
} from '@/utils/wardrobeAllocationEngine';
import {
  buildWardrobeImageProxyUrl,
  enrichWardrobeItemForOutfitVisual,
  normalizeRemoteApiUrl,
  resolveWardrobeImageUri,
} from '@/utils/wardrobeImage';
import { parseLocalDateOnly, formatLocalDateKey } from '@/utils/lookbookTripDay';

export type RawDFYOutfitItem = DFYOutfitItem & {
  imageUrl?: string | null;
  processedImageUrl?: string | null;
};

export function resolveDFYItemImageUri(
  item: RawDFYOutfitItem,
  wardrobeItem?: Pick<
    WardrobeItem,
    'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
  >,
): string | undefined {
  if (item.imageUri) return item.imageUri;

  const serverUrl =
    normalizeRemoteApiUrl(item.processedImageUrl) || normalizeRemoteApiUrl(item.imageUrl);
  if (typeof serverUrl === 'string' && serverUrl.length > 0) {
    return serverUrl;
  }

  if (wardrobeItem) {
    const uri = resolveWardrobeImageUri(wardrobeItem);
    if (uri) return uri;
  }

  if (item.id) {
    return buildWardrobeImageProxyUrl(item.id);
  }

  return undefined;
}

export function findWardrobeItemForDFYOutfitItem(
  item: DFYOutfitItem,
  wardrobeItems: WardrobeItem[],
): WardrobeItem | undefined {
  const byId = wardrobeItems.find((w) => String(w.id) === String(item.id));
  if (byId) return byId;

  const norm = String(item.name || '').toLowerCase().trim();
  if (!norm) return undefined;

  return (
    wardrobeItems.find((w) => w.name?.toLowerCase().trim() === norm)
    || wardrobeItems.find((w) => norm.includes(w.name?.toLowerCase().trim() || ''))
    || wardrobeItems.find((w) => (w.name?.toLowerCase() || '').includes(norm.slice(0, 24)))
  );
}

export function dfyOutfitItemsToVisualPieces(
  items: DFYOutfitItem[],
  wardrobeItems: WardrobeItem[],
): OutfitPieceVisual[] {
  return items.map((item) => {
    const wardrobe = findWardrobeItemForDFYOutfitItem(item, wardrobeItems);
    const processedUri = wardrobe
      ? enrichWardrobeItemForOutfitVisual(wardrobe).imageUri
      : resolveDFYItemImageUri(item as RawDFYOutfitItem, wardrobe);
    const serverUri =
      normalizeRemoteApiUrl(item.processedImageUrl)
      || normalizeRemoteApiUrl(item.imageUrl)
      || item.imageUri;
    const imageUrl = processedUri || serverUri || (item.id ? buildWardrobeImageProxyUrl(item.id) : undefined);

    return {
      wardrobeItemId: wardrobe ? wardrobe.id : item.id,
      name: item.name,
      category: item.category || wardrobe?.category,
      imageUrl,
    };
  });
}

export function enrichOutfitWithWardrobeImages(
  outfit: DFYOutfit,
  wardrobeItems: WardrobeItem[],
): DFYOutfit {
  return {
    ...outfit,
    items: (outfit.items || []).map((item) => {
      const wardrobe = findWardrobeItemForDFYOutfitItem(item, wardrobeItems);
      let imageUri = resolveDFYItemImageUri(item as RawDFYOutfitItem, wardrobe);
      if (!imageUri && item.id) {
        imageUri = buildWardrobeImageProxyUrl(item.id);
      }
      return imageUri ? { ...item, imageUri } : item;
    }),
  };
}

export function enrichDeliveryWithWardrobeImages(
  delivery: DFYLiteDelivery,
  wardrobeItems: WardrobeItem[],
): DFYLiteDelivery {
  return {
    ...delivery,
    outfits: delivery.outfits.map((outfit) => enrichOutfitWithWardrobeImages(outfit, wardrobeItems)),
  };
}

export function deliveryNeedsImageHydration(delivery: DFYLiteDelivery): boolean {
  return delivery.outfits.some((outfit) =>
    (outfit.items || []).some((item) => {
      const raw = item as RawDFYOutfitItem;
      return !resolveDFYItemImageUri(raw);
    }),
  );
}

function categorizeWardrobeItem(item: WardrobeItem): string {
  const cat = String(item.category || '').toLowerCase();
  if (cat === 'tops' || cat === 'top' || cat === 'activewear_tops') return 'tops';
  if (cat === 'bottoms' || cat === 'bottom' || cat === 'activewear_bottoms') return 'bottoms';
  if (cat === 'outerwear') return 'outerwear';
  if (cat === 'footwear' || cat === 'shoes') return 'footwear';
  if (cat === 'dresses' || cat === 'dress') return 'dresses';
  return cat;
}

function outfitHasFootwear(items: DFYOutfitItem[]): boolean {
  return items.some((item) => {
    const cat = String(item.category || '').toLowerCase();
    return cat === 'shoes' || cat === 'footwear';
  });
}

function wardrobeItemToOutfitItem(item: WardrobeItem): DFYOutfitItem {
  const imageUri = resolveWardrobeImageUri(item);
  return {
    id: String(item.id),
    name: item.name || 'Wardrobe item',
    category: String(item.category || 'item'),
    color: String(item.color || ''),
    imageUri: imageUri || undefined,
  };
}

const LOCAL_OCCASIONS: DFYOccasion[] = ['work', 'casual', 'casual', 'event', 'browsing', 'holiday', 'work'];

const DFY_TO_ALLOCATOR: Record<DFYOccasion, OutfitOccasionId> = {
  work: 'work_outfit',
  casual: 'casual_day',
  browsing: 'casual_day',
  event: 'evening_out',
  holiday: 'travel',
};

export function dfyOccasionToAllocator(occasion?: string | null, dayIndex = 0): OutfitOccasionId {
  const key = String(occasion || '').toLowerCase().trim() as DFYOccasion;
  if (key && DFY_TO_ALLOCATOR[key]) return DFY_TO_ALLOCATOR[key];
  const mapped = normalizeAllocatorOccasion(key || LOCAL_OCCASIONS[dayIndex % LOCAL_OCCASIONS.length]);
  return mapped;
}

function allocatorOccasionToDfy(occasion: OutfitOccasionId): DFYOccasion {
  if (occasion === 'work_outfit' || occasion === 'smart_casual') return 'work';
  if (occasion === 'evening_out' || occasion === 'date_night') return 'event';
  if (occasion === 'travel') return 'holiday';
  if (occasion === 'weekend') return 'casual';
  return 'casual';
}

function dayOccasionForIndex(dayIndex: number, startDate = new Date()): OutfitOccasionId {
  const d = new Date(startDate);
  d.setDate(startDate.getDate() + dayIndex);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return 'weekend';
  if (dow === 5) return 'smart_casual';
  return 'work_outfit';
}

function itemStyleText(item: { name?: string; subcategory?: string; category?: string; brand?: string }): string {
  return `${item.name || ''} ${item.subcategory || ''} ${item.category || ''} ${item.brand || ''}`.toLowerCase();
}

/** Insulated/winter layers that should not appear on warm days. */
export function isHeavyWarmthOuterwear(item: {
  name?: string;
  subcategory?: string;
  category?: string;
  brand?: string;
}): boolean {
  return /down|puffer|puffa|parka|winter|ski|quilted|insulated|thermal|duvet|heavy\s*coat|padded|gore-?tex\s*park/i.test(
    itemStyleText(item),
  );
}

/** Warm midlayers (often tagged as tops) — too hot for high-20s/30°C days. */
export function isWarmMidlayer(item: {
  name?: string;
  subcategory?: string;
  category?: string;
  brand?: string;
}): boolean {
  const text = itemStyleText(item);
  if (isHeavyWarmthOuterwear(item)) return true;
  if (
    /\bfleece\b|hoodie|sweatshirt|\bsweater\b|\bjumper\b|full-?zip\s*fleece|half-?zip\s*fleece|knit\s*jacket|track\s*top|sherpa|polar\s*fleece|french\s*terry|heavy\s*knit/i.test(
      text,
    )
  ) {
    return true;
  }
  // "Full-zip" without rain/shell language is almost always a warm midlayer
  if (/full-?zip/i.test(text) && !/rain|shell|windbreaker|softshell|anorak|denim|blazer/i.test(text)) {
    return true;
  }
  return false;
}

export function isLightOuterwear(item: {
  name?: string;
  subcategory?: string;
  category?: string;
  brand?: string;
}): boolean {
  if (isHeavyWarmthOuterwear(item) || isWarmMidlayer(item)) return false;
  return /rain|trench|blazer|denim|windbreaker|anorak|shacket|overshirt|softshell|light\s*jacket|utility|chore|bomber(?!\s*padded)/i.test(
    itemStyleText(item),
  );
}

function isMeaningfullyWetDay(dayForecast: DailyForecastDay): boolean {
  if (dayForecast.condition === 'stormy' || dayForecast.condition === 'snowy') return true;
  if (dayForecast.precipitationProbability >= 40) return true;
  // Ignore vague "light drizzle" with low rain chance — not enough to justify warm layers
  if (
    dayForecast.precipitationProbability >= 25 &&
    (dayForecast.condition === 'rainy' || /rain|drizzle|shower/i.test(dayForecast.description || ''))
  ) {
    return true;
  }
  return false;
}

function outfitHasTopAndBottom(items: WardrobeItem[]): boolean {
  const hasTop = items.some((i) => {
    const cat = categorizeWardrobeItem(i);
    return cat === 'tops' || cat === 'dresses' || cat === 'outerwear';
  });
  const hasBottom = items.some((i) => categorizeWardrobeItem(i) === 'bottoms');
  const hasDress = items.some((i) => categorizeWardrobeItem(i) === 'dresses');
  return (hasTop && hasBottom) || hasDress;
}

function mapOutfitItemsToWardrobe(
  items: DFYOutfitItem[],
  wardrobeItems: WardrobeItem[],
): WardrobeItem[] {
  return items
    .map((item) => findWardrobeItemForDFYOutfitItem(item, wardrobeItems))
    .filter((item): item is WardrobeItem => Boolean(item));
}

/** Clear lookbook slots that fail hard-validity (tie+gym, missing top, etc.). */
export function stripInvalidLookbookOutfits(
  delivery: DFYLiteDelivery,
  wardrobeItems: WardrobeItem[],
): DFYLiteDelivery {
  const seenSignatures = new Set<string>();

  const outfits = delivery.outfits.map((slot) => {
    const mapped = mapOutfitItemsToWardrobe(slot.items || [], wardrobeItems);
    if (mapped.length < 2 || !outfitHasTopAndBottom(mapped) || !isOutfitValid(mapped)) {
      return { ...slot, items: [] as DFYOutfitItem[] };
    }
    const sig = mapped.map((i) => String(i.id)).sort().join('|');
    if (sig && seenSignatures.has(sig)) {
      return { ...slot, items: [] as DFYOutfitItem[] };
    }
    if (sig) seenSignatures.add(sig);
    return slot;
  });

  return { ...delivery, outfits };
}

function shouldIncludeOuterwear(dayForecast?: DailyForecastDay | null, dayNumber?: number): boolean {
  if (!dayForecast) return (dayNumber ?? 1) % 3 !== 0;
  // Hot days: never add coats/jackets for warmth (light rain shell handled separately only when truly wet)
  if (dayForecast.tempMax >= 26) {
    return isMeaningfullyWetDay(dayForecast);
  }
  if (dayForecast.tempMax < 14) return true;
  if (isMeaningfullyWetDay(dayForecast)) return true;
  // Mild days: only when under 20°C
  return dayForecast.tempMax < 20;
}

function pickOuterwearForWeather(
  outerwear: WardrobeItem[],
  day: number,
  dayForecast?: DailyForecastDay | null,
): WardrobeItem | null {
  if (!outerwear.length || !shouldIncludeOuterwear(dayForecast, day)) return null;

  const tempMax = dayForecast?.tempMax;
  let pool = outerwear;

  if (typeof tempMax === 'number') {
    if (tempMax >= 22) {
      // Warm/hot: light rain shells / blazers only — never fleece/down
      pool = outerwear.filter(isLightOuterwear);
      if (!pool.length) return null;
    } else if (tempMax < 12) {
      const heavy = outerwear.filter(isHeavyWarmthOuterwear);
      pool = heavy.length ? heavy : outerwear;
    } else {
      const lightOrMid = outerwear.filter((i) => !isHeavyWarmthOuterwear(i) && !isWarmMidlayer(i));
      pool = lightOrMid.length ? lightOrMid : outerwear.filter((i) => !isHeavyWarmthOuterwear(i));
      if (!pool.length) pool = outerwear;
    }
  }

  return pool[day % pool.length];
}

/** Drop warmth-inappropriate coats/fleeces when a forecast is known. */
export function filterOutfitItemsForWeather(
  items: DFYOutfitItem[],
  dayForecast?: DailyForecastDay | null,
  wardrobeItems?: WardrobeItem[],
): DFYOutfitItem[] {
  if (!items?.length || !dayForecast || typeof dayForecast.tempMax !== 'number') return items;

  const wet = isMeaningfullyWetDay(dayForecast);

  return items.filter((item) => {
    const wardrobe = wardrobeItems?.length
      ? findWardrobeItemForDFYOutfitItem(item, wardrobeItems)
      : undefined;
    const asWardrobe = {
      category: item.category || wardrobe?.category,
      name: item.name || wardrobe?.name,
      subcategory: (item as any).subcategory || wardrobe?.subcategory,
      brand: (item as any).brand || wardrobe?.brand,
    } as WardrobeItem;
    const cat = categorizeWardrobeItem(asWardrobe);
    const warmLayer = isWarmMidlayer(asWardrobe) || isHeavyWarmthOuterwear(asWardrobe);

    // Hot day (high ≥26°C): no fleece/hoodie/down; only a light rain shell if rain is meaningful
    if (dayForecast.tempMax >= 26) {
      if (warmLayer) return false;
      if (cat === 'outerwear') return wet && isLightOuterwear(asWardrobe);
      return true;
    }

    // Warm day (high ≥22°C): strip fleeces and heavy coats even if tagged as tops
    if (dayForecast.tempMax >= 22 && warmLayer) return false;

    if (cat === 'outerwear' && dayForecast.tempMax >= 22 && !isLightOuterwear(asWardrobe)) return false;

    return true;
  });
}

function pickFootwearItem(
  footwear: WardrobeItem[],
  day: number,
  dayForecast?: DailyForecastDay | null,
): WardrobeItem | null {
  if (!footwear.length) return null;
  const wetDay =
    !!dayForecast &&
    (dayForecast.precipitationProbability >= 40 ||
      dayForecast.condition === 'rainy' ||
      dayForecast.condition === 'stormy' ||
      dayForecast.condition === 'snowy');

  if (wetDay) {
    const practical = footwear.filter((item) =>
      /boot|trainer|sneaker|loafer|shoe/i.test(`${item.name || ''} ${item.subcategory || ''}`),
    );
    if (practical.length) return practical[day % practical.length];
  }

  return footwear[day % footwear.length];
}

export function buildLocalOutfitForDay(
  dayIndex: number,
  wardrobeItems: WardrobeItem[],
  stylistId: StylistId,
  dayNumber: number,
  title: string,
  dayForecast?: DailyForecastDay | null,
  weatherNote?: string,
): DFYOutfit | null {
  if (wardrobeItems.length === 0) return null;

  const tops = wardrobeItems.filter(
    (i) => categorizeWardrobeItem(i) === 'tops' && !isWarmMidlayer(i),
  );
  const warmTops = wardrobeItems.filter(
    (i) => categorizeWardrobeItem(i) === 'tops' && isWarmMidlayer(i),
  );
  const bottoms = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'bottoms');
  const dresses = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'dresses');
  const outerwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'outerwear');
  const footwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'footwear');

  const items: DFYOutfitItem[] = [];
  const day = dayNumber;
  const hotDay = !!dayForecast && dayForecast.tempMax >= 22;
  // Never fall back to fleeces/hoodies as the top on a warm/hot day
  const topPool = hotDay
    ? tops
    : tops.length
      ? [...tops, ...warmTops]
      : warmTops;

  if (dresses.length && day % 4 === 0) {
    items.push(wardrobeItemToOutfitItem(dresses[day % dresses.length]));
  } else {
    if (topPool.length) items.push(wardrobeItemToOutfitItem(topPool[day % topPool.length]));
    if (bottoms.length) items.push(wardrobeItemToOutfitItem(bottoms[day % bottoms.length]));
  }
  const layer = pickOuterwearForWeather(outerwear, day, dayForecast);
  if (layer) items.push(wardrobeItemToOutfitItem(layer));
  const shoe = pickFootwearItem(footwear, day, dayForecast);
  if (shoe) items.push(wardrobeItemToOutfitItem(shoe));

  if (items.length < 2) {
    for (let i = 0; i < wardrobeItems.length && items.length < 3; i++) {
      const candidate = wardrobeItems[(dayIndex + i) % wardrobeItems.length];
      if (hotDay && (isWarmMidlayer(candidate) || isHeavyWarmthOuterwear(candidate))) continue;
      if (!items.some((it) => it.id === String(candidate.id))) {
        items.push(wardrobeItemToOutfitItem(candidate));
      }
    }
  }

  if (items.length === 0) return null;

  const hero = items[0];
  const partner = items[1];
  const weatherLine = dayForecast
    ? ` Forecast: ${dayForecast.description.toLowerCase()} (${dayForecast.tempMin}–${dayForecast.tempMax}°C).`
    : '';

  return {
    id: `local-outfit-${dayNumber}`,
    dayNumber,
    title,
    description: '',
    items,
    occasion: LOCAL_OCCASIONS[dayIndex % LOCAL_OCCASIONS.length],
    stylistNote:
      items.length >= 2
        ? `Day ${dayNumber}: ${hero.name} with ${partner?.name || 'your pieces'} — styled for your wardrobe rotation.${weatherLine}`
        : `Day ${dayNumber}: built around your ${hero.name}.${weatherLine}`,
    weatherNote,
    stylistId,
    userReaction: null,
    saved: false,
  };
}

/**
 * Constraint-first fill for empty DFY lookbook days.
 * Plans all empty slots together so tops/bottoms are not round-robin duplicated.
 */
export function fillEmptyLookbookSlots(
  delivery: DFYLiteDelivery,
  wardrobeItems: WardrobeItem[],
  stylistId: StylistId,
  forecast?: DailyForecast | null,
): DFYLiteDelivery {
  const emptyIndexes = delivery.outfits
    .map((slot, idx) => (!(slot.items && slot.items.length > 0) ? idx : -1))
    .filter((idx) => idx >= 0);

  if (emptyIndexes.length === 0) {
    return enrichDeliveryWithWardrobeImages(delivery, wardrobeItems);
  }

  const occasionTypes = emptyIndexes.map((idx) => {
    const slot = delivery.outfits[idx];
    if (slot.occasion) return dfyOccasionToAllocator(slot.occasion, idx);
    return dayOccasionForIndex(idx);
  });

  const plan = allocateMultiDayPlan({
    wardrobe: wardrobeItems,
    occasionTypes,
  });

  const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
  const outfits = [...delivery.outfits];

  if (plan.ok) {
    plan.days.forEach((day, planIdx) => {
      const slotIdx = emptyIndexes[planIdx];
      if (slotIdx == null) return;
      const slot = outfits[slotIdx];
      const items = day.itemIds
        .map((id) => byId.get(String(id)))
        .filter((item): item is WardrobeItem => Boolean(item))
        .map(wardrobeItemToOutfitItem);
      if (items.length < 2) return;

      const dayForecast =
        forecast?.days?.find((d) => d.dayIndex === slot.dayNumber) || forecast?.days?.[slotIdx] || null;
      const weatherNote = dayForecast
        ? `${dayForecast.tempMin}–${dayForecast.tempMax}°C, ${dayForecast.description}`
        : undefined;
      const hero = items[0];
      const partner = items[1];
      const weatherLine = dayForecast
        ? ` Forecast: ${dayForecast.description.toLowerCase()} (${dayForecast.tempMin}–${dayForecast.tempMax}°C).`
        : '';
      const modeNote =
        plan.mode === 'rotation'
          ? ` (${plan.modeLabel})`
          : plan.mode === 'soft'
            ? ` (${plan.modeLabel})`
            : '';

      outfits[slotIdx] = {
        ...slot,
        items,
        occasion: allocatorOccasionToDfy(day.occasionType),
        stylistNote:
          slot.stylistNote
          || `Day ${slot.dayNumber}: ${hero.name} with ${partner?.name || 'your pieces'}${modeNote}.${weatherLine}`,
        weatherNote: slot.weatherNote || weatherNote,
        stylistId: slot.stylistId || stylistId,
      };
    });
  } else {
    // Last resort: legacy per-day builder (may soft-reuse)
    emptyIndexes.forEach((idx) => {
      const slot = outfits[idx];
      const dayForecast =
        forecast?.days?.find((d) => d.dayIndex === slot.dayNumber) || forecast?.days?.[idx] || null;
      const weatherNote = dayForecast
        ? `${dayForecast.tempMin}–${dayForecast.tempMax}°C, ${dayForecast.description}`
        : undefined;
      const local = buildLocalOutfitForDay(
        idx,
        wardrobeItems,
        stylistId,
        slot.dayNumber,
        slot.title,
        dayForecast,
        weatherNote,
      );
      if (!local) return;
      outfits[idx] = {
        ...local,
        id: slot.id,
        dayNumber: slot.dayNumber,
        title: slot.title,
        userReaction: slot.userReaction ?? null,
        saved: slot.saved ?? false,
      };
    });
  }

  return enrichDeliveryWithWardrobeImages({ ...delivery, outfits }, wardrobeItems);
}

/**
 * Re-plan inventory for an entire lookbook (keep titles/notes; replace item sets).
 * Used so AI decoration cannot invent fake variety.
 */
export function reallocateLookbookInventory(
  delivery: DFYLiteDelivery,
  wardrobeItems: WardrobeItem[],
  stylistId: StylistId,
  forecast?: DailyForecast | null,
): DFYLiteDelivery {
  if (wardrobeItems.length < 3 || delivery.outfits.length === 0) {
    return fillEmptyLookbookSlots(delivery, wardrobeItems, stylistId, forecast);
  }

  const occasionTypes = delivery.outfits.map((slot, idx) => {
    if (slot.occasion) return dfyOccasionToAllocator(slot.occasion, idx);
    return dayOccasionForIndex(idx);
  });

  const plan = allocateMultiDayPlan({
    wardrobe: wardrobeItems,
    occasionTypes,
  });

  if (!plan.ok) {
    return fillEmptyLookbookSlots(
      {
        ...delivery,
        outfits: delivery.outfits.map((o) => ({ ...o, items: [] })),
      },
      wardrobeItems,
      stylistId,
      forecast,
    );
  }

  const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
  const outfits = delivery.outfits.map((slot, idx) => {
    const day = plan.days[idx];
    if (!day) return slot;
    const items = day.itemIds
      .map((id) => byId.get(String(id)))
      .filter((item): item is WardrobeItem => Boolean(item));
    if (items.length < 2 || !outfitHasTopAndBottom(items) || !isOutfitValid(items)) {
      return { ...slot, items: [] as DFYOutfitItem[] };
    }
    const mappedItems = items.map(wardrobeItemToOutfitItem);

    const dayForecast =
      forecast?.days?.find((d) => d.dayIndex === slot.dayNumber) || forecast?.days?.[idx] || null;
    const weatherNote = dayForecast
      ? `${dayForecast.tempMin}–${dayForecast.tempMax}°C, ${dayForecast.description}`
      : undefined;
    const modeSuffix =
      plan.mode !== 'strict' ? ` · ${plan.modeLabel}` : '';

    return {
      ...slot,
      items: mappedItems,
      occasion: slot.occasion || allocatorOccasionToDfy(day.occasionType),
      stylistNote: slot.stylistNote
        ? `${slot.stylistNote}${modeSuffix && !slot.stylistNote.includes(plan.modeLabel) ? modeSuffix : ''}`
        : `Day ${slot.dayNumber}: allocated from your wardrobe${modeSuffix}.`,
      weatherNote: slot.weatherNote || weatherNote,
      stylistId: slot.stylistId || stylistId,
    };
  });

  return enrichDeliveryWithWardrobeImages({ ...delivery, outfits }, wardrobeItems);
}

export function countFilledLookbookDays(delivery: DFYLiteDelivery): number {
  return delivery.outfits.filter((o) => o.items && o.items.length > 0).length;
}

export interface DFYAlternativeOutfit {
  id: string;
  items: DFYOutfitItem[];
  stylistNote: string;
}

export function buildLocalAlternatives(
  currentItemIds: string[],
  dayNumber: number,
  wardrobeItems: WardrobeItem[],
  count = 2,
): DFYAlternativeOutfit[] {
  if (wardrobeItems.length < 3) return [];

  const notes = [
    'A more relaxed take on today\'s look',
    'A sharper, more polished option',
  ];

  const alternatives: DFYAlternativeOutfit[] = [];
  const excludeSoFar = [...currentItemIds.map(String)];
  const priorOutfits: WardrobeItem[][] = [];
  const byId = new Map(wardrobeItems.map((w) => [String(w.id), w]));
  const currentItems = currentItemIds
    .map((id) => byId.get(String(id)))
    .filter((item): item is WardrobeItem => Boolean(item));
  if (currentItems.length) priorOutfits.push(currentItems);

  for (let altIdx = 1; altIdx <= count; altIdx++) {
    const allocated = allocateSingleDayOutfit({
      wardrobe: wardrobeItems,
      occasionType: dayOccasionForIndex(Math.max(0, dayNumber - 1 + altIdx)),
      excludeItemIds: excludeSoFar,
      priorOutfits,
    });
    if (!allocated.ok || allocated.items.length < 2 || !passesHardOutfitChecks(allocated.items)) continue;

    const items = allocated.items.map(wardrobeItemToOutfitItem);
    excludeSoFar.push(...allocated.itemIds);
    priorOutfits.push(allocated.items);
    const hero = items[0];
    const partner = items[1];
    alternatives.push({
      id: `alt-${dayNumber}-${altIdx}`,
      items,
      stylistNote: `${notes[altIdx - 1] || 'Another way to wear your wardrobe'}: ${hero.name} with ${partner?.name || 'your pieces'}.`,
    });
  }

  return alternatives;
}

export function ensureLookbookOutfitsHaveFootwear(
  delivery: DFYLiteDelivery,
  wardrobeItems: WardrobeItem[],
): DFYLiteDelivery {
  const footwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'footwear');
  if (footwear.length === 0) return delivery;

  const outfits = delivery.outfits.map((outfit, idx) => {
    if (!outfit.items?.length || outfitHasFootwear(outfit.items)) return outfit;

    const baseMapped = mapOutfitItemsToWardrobe(outfit.items, wardrobeItems);
    if (baseMapped.length < 2 || !outfitHasTopAndBottom(baseMapped) || !isOutfitValid(baseMapped)) {
      return outfit;
    }

    const dayNum = outfit.dayNumber || idx + 1;
    for (let offset = 0; offset < footwear.length; offset++) {
      const shoe = footwear[(dayNum + offset) % footwear.length];
      const candidate = [...baseMapped, shoe];
      if (!isOutfitValid(candidate)) continue;
      return enrichOutfitWithWardrobeImages(
        {
          ...outfit,
          items: [...outfit.items, wardrobeItemToOutfitItem(shoe)],
        },
        wardrobeItems,
      );
    }

    return outfit;
  });

  return { ...delivery, outfits };
}

/**
 * Guaranteed 14-day Travel Capsule lookbook.
 * Packs a capsule subset, then allocates 14 looks with travel-friendly reuse.
 * Never trusts server inventory. Always exactly 14 days.
 *
 * @param options.fillGapsOnly — keep existing filled days; only allocate empty slots
 * @param options.force — full regenerate (ignores fillGapsOnly)
 */
export function generateLiteLookbook(params: {
  userId: string;
  wardrobeItems: WardrobeItem[];
  stylistId: StylistId;
  existing?: DFYLiteDelivery | null;
  forecast?: DailyForecast | null;
  travelPlan?: TravelPlan | null;
  options?: { fillGapsOnly?: boolean; force?: boolean };
}): DFYLiteDelivery | null {
  const { userId, wardrobeItems, stylistId, existing, forecast } = params;
  const travelPlan = params.travelPlan || existing?.travelPlan || null;
  const force = Boolean(params.options?.force);
  const fillGapsOnly = Boolean(params.options?.fillGapsOnly) && !force;

  if (!wardrobeCanBuildCompleteOutfit(wardrobeItems)) {
    return null;
  }

  if (fillGapsOnly && existing) {
    const filled = countFilledLookbookDays(existing);
    const total = existing.totalDays || LITE_LOOKBOOK_DAYS;
    if (filled >= total) {
      return enrichDeliveryWithWardrobeImages(
        {
          ...existing,
          engineVersion: existing.engineVersion || LITE_LOOKBOOK_ENGINE_VERSION,
        },
        wardrobeItems,
      );
    }
  }

  const startParsed =
    parseLocalDateOnly(travelPlan?.startDate)
    || parseLocalDateOnly(existing?.startDate)
    || new Date();
  startParsed.setHours(0, 0, 0, 0);
  const start = startParsed;
  const startDateIso = formatLocalDateKey(start);

  const tempMins = forecast?.days?.map((d) => d.tempMin) || [];
  const tempMaxes = forecast?.days?.map((d) => d.tempMax) || [];
  const avgMin = tempMins.length
    ? Math.round(tempMins.reduce((a, b) => a + b, 0) / tempMins.length)
    : null;
  const avgMax = tempMaxes.length
    ? Math.round(tempMaxes.reduce((a, b) => a + b, 0) / tempMaxes.length)
    : null;

  const capsulePlan = travelPlan || defaultTravelPlan({
    destination: forecast?.location || 'your trip',
    startDate: startDateIso,
  });

  const tripDays = resolveTravelTripDays(capsulePlan);

  const capsule = buildTravelCapsule(wardrobeItems, capsulePlan, {
    tempMin: avgMin,
    tempMax: avgMax,
  });

  const capsuleWardrobe =
    capsule.items.length >= 3 && wardrobeCanBuildCompleteOutfit(capsule.items)
      ? capsule.items
      : wardrobeItems;

  const dayActivities = assignDayActivities(
    LITE_LOOKBOOK_DAYS,
    tripDays,
    capsulePlan.activities,
  );

  const scheduled = allocateScheduleDrivenLookbook({
    capsule: capsuleWardrobe,
    totalDays: LITE_LOOKBOOK_DAYS,
    dayActivities,
    fullWardrobe: wardrobeItems,
  });

  if (!scheduled || scheduled.outfits.length < LITE_LOOKBOOK_DAYS) {
    return null;
  }

  const modeLabel = scheduled.modeLabel;
  const destLabel = capsulePlan.destination || forecast?.location || 'your trip';
  const activityCopy = summarizeActivitiesForCopy(capsulePlan.activities);

  // Debug-friendly usage lines for capsule notes
  const usageLines = Object.entries(scheduled.usagePlan)
    .filter(([, days]) => days.length > 0)
    .slice(0, 8)
    .map(([id, days]) => {
      const item = capsuleWardrobe.find((w) => String(w.id) === id);
      return item ? `${item.name} → Days ${days.join(', ')}` : null;
    })
    .filter(Boolean) as string[];

  const outfits: DFYOutfit[] = [];
  for (let idx = 0; idx < LITE_LOOKBOOK_DAYS; idx++) {
    const prev = existing?.outfits?.[idx];

    // fillGapsOnly: preserve any day that already has wardrobe items
    if (fillGapsOnly && prev?.items && prev.items.length > 0) {
      outfits.push({
        ...prev,
        id: prev.id || `lite-day-${idx + 1}`,
        dayNumber: idx + 1,
        userReaction: prev.userReaction ?? null,
        saved: prev.saved ?? false,
      });
      continue;
    }

    const dayActivity = dayActivities[idx] || 'explore';
    const mapped = scheduled.outfits[idx];

    if (!passesHardOutfitChecks(mapped) && !isOutfitValid(mapped)) {
      return null;
    }

    const dayForecast =
      forecast?.days?.find((d) => d.dayIndex === idx + 1) || forecast?.days?.[idx] || null;
    const weatherFiltered = dayForecast
      ? filterOutfitItemsForWeather(
          mapped.map(wardrobeItemToOutfitItem),
          dayForecast,
          wardrobeItems,
        )
      : mapped.map(wardrobeItemToOutfitItem);

    const weatherMapped = mapOutfitItemsToWardrobe(weatherFiltered, wardrobeItems);
    let finalItems = passesHardOutfitChecks(weatherMapped)
      ? weatherFiltered
      : mapped.map(wardrobeItemToOutfitItem);

    // Don't let weather strip flight layers / structure
    if (dayActivity === 'flight' && !passesHardOutfitChecks(mapOutfitItemsToWardrobe(finalItems, wardrobeItems))) {
      finalItems = mapped.map(wardrobeItemToOutfitItem);
    }

    const weatherLine = dayForecast
      ? `${dayForecast.tempMin}–${dayForecast.tempMax}°C in ${destLabel}`
      : undefined;

    const isReturnFlight = dayActivity === 'flight' && idx > 0;
    const activityLabel = ACTIVITY_CONSTRAINTS[dayActivity]?.label;
    const noteItems = mapOutfitItemsToWardrobe(finalItems, wardrobeItems);
    const stylistNote =
      dayActivity === 'flight'
        ? flightOutfitNote(isReturnFlight)
        : generateNotesFromOutfit(noteItems.length ? noteItems : mapped, idx + 1, {
            activityLabel,
            destination: destLabel,
            capsuleSize: capsule.items.length,
          });

    outfits.push({
      id: prev?.id || `lite-day-${idx + 1}`,
      dayNumber: idx + 1,
      title:
        prev?.saved || prev?.userReaction === 'love'
          ? (prev?.title
            || (dayActivity === 'flight'
              ? (isReturnFlight ? 'Return Travel Day' : 'Travel Day Outfit')
              : idx === 0
                ? "Today's Look"
                : `Day ${idx + 1} Look`))
          : (dayActivity === 'flight'
            ? (isReturnFlight ? 'Return Travel Day' : 'Travel Day Outfit')
            : idx === 0
              ? "Today's Look"
              : `Day ${idx + 1} Look`),
      description: activityCopy,
      items: finalItems,
      occasion: prev?.occasion || (dayActivity === 'flight' ? 'holiday' : 'casual'),
      // Always rewrite notes from the allocated pieces — never keep stale AI/server copy
      stylistNote,
      weatherNote: weatherLine || prev?.weatherNote,
      stylistId: prev?.stylistId || stylistId,
      userReaction: prev?.userReaction ?? null,
      saved: prev?.saved ?? false,
      vibeLabel: dayActivity === 'flight' ? 'Travel day' : activityLabel,
    });
  }

  const packingSummary = generatePackingSummary({
    capsuleItems: capsuleWardrobe,
    travelPlan: capsulePlan,
    tempMin: avgMin,
    tempMax: avgMax,
    lookbookDays: LITE_LOOKBOOK_DAYS,
  });

  const expiryDate = new Date(
    start.getTime() + LITE_LOOKBOOK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  return enrichDeliveryWithWardrobeImages(
    {
      userId,
      tier: 'lite',
      startDate: start.toISOString(),
      expiryDate,
      totalDays: LITE_LOOKBOOK_DAYS,
      currentDay: existing?.currentDay || 1,
      completed: false,
      nudgesShown: existing?.nudgesShown || [],
      outfits,
      travelPlan: capsulePlan,
      capsuleItemIds: capsule.itemIds,
      capsuleNotes: [
        ...capsule.notes,
        activityCopy,
        `Allocator: ${modeLabel}`,
        ...(usageLines.length ? ['Usage schedule:', ...usageLines] : []),
        scheduled.validation.ok ? 'Schedule validated' : 'Schedule repaired with soft fallbacks',
      ],
      packingSummary,
      engineVersion: LITE_LOOKBOOK_ENGINE_VERSION,
    },
    wardrobeItems,
  );
}
