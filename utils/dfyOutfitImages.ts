import type { OutfitPieceVisual } from '@/components/OutfitPiecesVisual';
import { WardrobeItem } from '@/contexts/WardrobeContext';
import { DFYLiteDelivery, DFYOccasion, DFYOutfit, DFYOutfitItem, StylistId } from '@/services/DFYService';
import { DailyForecast, DailyForecastDay } from '@/services/WeatherService';
import {
  buildWardrobeImageProxyUrl,
  enrichWardrobeItemForOutfitVisual,
  normalizeRemoteApiUrl,
  resolveWardrobeImageUri,
} from '@/utils/wardrobeImage';

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

function shouldIncludeOuterwear(dayForecast?: DailyForecastDay | null, dayNumber?: number): boolean {
  if (!dayForecast) return (dayNumber ?? 1) % 3 !== 0;
  if (dayForecast.tempMax >= 26) return false;
  if (dayForecast.tempMax < 14) return true;
  if (
    dayForecast.precipitationProbability >= 40 ||
    dayForecast.condition === 'rainy' ||
    dayForecast.condition === 'stormy' ||
    dayForecast.condition === 'snowy'
  ) {
    return true;
  }
  return dayForecast.tempMax < 20;
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

  const tops = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'tops');
  const bottoms = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'bottoms');
  const dresses = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'dresses');
  const outerwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'outerwear');
  const footwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'footwear');

  const items: DFYOutfitItem[] = [];
  const day = dayNumber;

  if (dresses.length && day % 4 === 0) {
    items.push(wardrobeItemToOutfitItem(dresses[day % dresses.length]));
  } else {
    if (tops.length) items.push(wardrobeItemToOutfitItem(tops[day % tops.length]));
    if (bottoms.length) items.push(wardrobeItemToOutfitItem(bottoms[day % bottoms.length]));
  }
  if (outerwear.length && shouldIncludeOuterwear(dayForecast, day)) {
    items.push(wardrobeItemToOutfitItem(outerwear[day % outerwear.length]));
  }
  const shoe = pickFootwearItem(footwear, day, dayForecast);
  if (shoe) items.push(wardrobeItemToOutfitItem(shoe));

  if (items.length < 2) {
    for (let i = 0; i < wardrobeItems.length && items.length < 3; i++) {
      const candidate = wardrobeItems[(dayIndex + i) % wardrobeItems.length];
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

export function fillEmptyLookbookSlots(
  delivery: DFYLiteDelivery,
  wardrobeItems: WardrobeItem[],
  stylistId: StylistId,
  forecast?: DailyForecast | null,
): DFYLiteDelivery {
  const outfits = delivery.outfits.map((slot, idx) => {
    if (slot.items && slot.items.length > 0) return slot;
    const dayForecast = forecast?.days?.find((d) => d.dayIndex === slot.dayNumber) || forecast?.days?.[idx] || null;
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
    if (!local) return slot;
    return {
      ...local,
      id: slot.id,
      dayNumber: slot.dayNumber,
      title: slot.title,
      userReaction: slot.userReaction ?? null,
      saved: slot.saved ?? false,
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

function pickDifferentItem(
  pool: WardrobeItem[],
  offset: number,
  excludeIds: Set<string>,
): WardrobeItem | null {
  if (!pool.length) return null;
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(offset + i) % pool.length];
    if (!excludeIds.has(String(candidate.id))) return candidate;
  }
  return pool[offset % pool.length];
}

export function buildLocalAlternatives(
  currentItemIds: string[],
  dayNumber: number,
  wardrobeItems: WardrobeItem[],
  count = 2,
): DFYAlternativeOutfit[] {
  if (wardrobeItems.length < 3) return [];

  const currentIds = new Set(currentItemIds.map(String));
  const tops = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'tops');
  const bottoms = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'bottoms');
  const dresses = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'dresses');
  const outerwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'outerwear');
  const footwear = wardrobeItems.filter((i) => categorizeWardrobeItem(i) === 'footwear');

  const notes = [
    'A more relaxed take on today\'s look',
    'A sharper, more polished option',
  ];

  const alternatives: DFYAlternativeOutfit[] = [];

  for (let altIdx = 1; altIdx <= count; altIdx++) {
    const offset = dayNumber + altIdx * 3;
    const items: DFYOutfitItem[] = [];
    const usedIds = new Set<string>();

    if (dresses.length && (dayNumber + altIdx) % 4 === 0) {
      const dress = pickDifferentItem(dresses, offset, currentIds);
      if (dress) {
        items.push(wardrobeItemToOutfitItem(dress));
        usedIds.add(String(dress.id));
      }
    } else {
      const top = pickDifferentItem(tops, offset, currentIds);
      const bottom = pickDifferentItem(bottoms, offset + 1, currentIds);
      if (top) {
        items.push(wardrobeItemToOutfitItem(top));
        usedIds.add(String(top.id));
      }
      if (bottom) {
        items.push(wardrobeItemToOutfitItem(bottom));
        usedIds.add(String(bottom.id));
      }
    }

    if (outerwear.length && (dayNumber + altIdx) % 2 === 0) {
      const layer = pickDifferentItem(outerwear, offset + 2, new Set([...currentIds, ...usedIds]));
      if (layer) {
        items.push(wardrobeItemToOutfitItem(layer));
        usedIds.add(String(layer.id));
      }
    }

    const shoe = pickFootwearItem(footwear, offset + altIdx, null);
    if (shoe && !currentIds.has(String(shoe.id))) {
      items.push(wardrobeItemToOutfitItem(shoe));
    } else if (footwear.length) {
      const altShoe = pickDifferentItem(footwear, offset + altIdx, currentIds);
      if (altShoe) items.push(wardrobeItemToOutfitItem(altShoe));
    }

    if (items.length < 2) continue;

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
    const shoe = footwear[(outfit.dayNumber || idx + 1) % footwear.length];
    return enrichOutfitWithWardrobeImages(
      { ...outfit, items: [...outfit.items, wardrobeItemToOutfitItem(shoe)] },
      wardrobeItems,
    );
  });

  return { ...delivery, outfits };
}
