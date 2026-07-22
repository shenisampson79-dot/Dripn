import { WardrobeItem } from '@/contexts/WardrobeContext';
import { DFYLiteDelivery, DFYOutfit, StylistId } from '@/services/DFYService';
import { enrichOutfitWithWardrobeImages } from '@/utils/dfyOutfitImages';
import type { LaundryProfile } from '@/utils/wearRules';
import { generateGuaranteedCoreCalendar } from '@/utils/coreCalendarEngine';

export interface DFYCalendarMappedOutfit {
  id: string;
  date: string;
  title: string;
  stylistNote: string;
  stylistId: StylistId;
  weatherNote?: string;
  wasWorn: boolean;
  alternativesCount: number;
  itemIds: string[];
  items: Array<{
    id: string;
    name: string;
    imageUri?: string;
    category?: string;
    color?: string;
  }>;
  dayNumber: number;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function mapLookbookOutfitToCalendarEntry(
  outfit: DFYOutfit,
  planStartDate: Date,
  dayIndex: number,
  wardrobeItems: WardrobeItem[] = [],
): DFYCalendarMappedOutfit | null {
  if (!outfit.items?.length) return null;

  const enriched = enrichOutfitWithWardrobeImages(outfit, wardrobeItems);
  const date = new Date(planStartDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(planStartDate.getDate() + dayIndex);

  return {
    id: outfit.id || `lookbook-day-${dayIndex + 1}`,
    date: formatDateKey(date),
    title: outfit.title || `Day ${dayIndex + 1} Look`,
    stylistNote: enriched.stylistNote || '',
    weatherNote: enriched.weatherNote,
    stylistId: enriched.stylistId || 'ruby',
    wasWorn: false,
    alternativesCount: 0,
    dayNumber: outfit.dayNumber || dayIndex + 1,
    itemIds: enriched.items.map((item) => String(item.id)),
    items: enriched.items.map((item) => ({
      id: String(item.id),
      name: item.name,
      imageUri: item.imageUri,
      category: item.category,
      color: item.color,
    })),
  };
}

export function mapLookbookDeliveryToCalendarOutfits(
  delivery: DFYLiteDelivery,
  planStartDate: Date,
  wardrobeItems: WardrobeItem[] = [],
): DFYCalendarMappedOutfit[] {
  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);
  const totalDays = delivery.totalDays || 14;

  return delivery.outfits
    .slice(0, totalDays)
    .map((outfit, idx) => mapLookbookOutfitToCalendarEntry(outfit, start, idx, wardrobeItems))
    .filter((entry): entry is DFYCalendarMappedOutfit => Boolean(entry));
}

export function mapApiLookbookToCalendarOutfits(
  rawOutfits: any[],
  planStartDate: Date,
  wardrobeItems: WardrobeItem[] = [],
  stylistId: StylistId = 'ruby',
): DFYCalendarMappedOutfit[] {
  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);

  return rawOutfits
    .map((raw, idx) => {
      const dayIndex = (raw.day || raw.dayNumber || idx + 1) - 1;
      const outfit: DFYOutfit = {
        id: raw.id || `outfit_${idx + 1}`,
        dayNumber: raw.day || raw.dayNumber || idx + 1,
        title: raw.title || raw.occasion || `Day ${idx + 1} Look`,
        description: raw.description || raw.stylistNote || '',
        items: (raw.items || []).map((it: any) => ({
          id: String(it.id),
          name: it.name || '',
          category: it.category || '',
          color: it.color || '',
          imageUri: it.imageUri || it.processedImageUrl || it.imageUrl || undefined,
          imageUrl: it.imageUrl,
          processedImageUrl: it.processedImageUrl,
        })),
        occasion: raw.occasion || 'casual',
        stylistNote: raw.stylistNote || raw.notes,
        weatherNote: raw.weatherNote,
        stylistId: (raw.stylistId || stylistId) as StylistId,
        saved: false,
      };
      return mapLookbookOutfitToCalendarEntry(outfit, start, dayIndex, wardrobeItems);
    })
    .filter((entry): entry is DFYCalendarMappedOutfit => Boolean(entry));
}

/** Pull outfit arrays from Core calendar blob / package payload shapes. */
export function extractRawOutfitsFromDfyPayload(payload: any): any[] {
  if (!payload || typeof payload !== 'object') return [];

  if (Array.isArray(payload.outfits) && payload.outfits.length > 0) {
    return payload.outfits;
  }
  if (Array.isArray(payload.lookbook) && payload.lookbook.length > 0) {
    return payload.lookbook;
  }
  if (Array.isArray(payload.calendar) && payload.calendar.length > 0) {
    return payload.calendar
      .map((entry: any, idx: number) => {
        const outfit = entry?.outfit || entry;
        if (!outfit || typeof outfit !== 'object') return null;
        return {
          ...outfit,
          day: entry?.day ?? outfit.day ?? outfit.dayNumber ?? idx + 1,
          dayNumber: entry?.day ?? outfit.dayNumber ?? outfit.day ?? idx + 1,
          date: entry?.date || outfit.date,
        };
      })
      .filter(Boolean);
  }
  if (Array.isArray(payload.delivery?.outfits) && payload.delivery.outfits.length > 0) {
    return payload.delivery.outfits;
  }
  return [];
}

/**
 * Map DFY Core calendar payload (outfit_calendar_data / package / generate response)
 * onto dated calendar entries. Prefers payload.startDate when present.
 */
export function mapDfyCalendarPayloadToOutfits(
  payload: any,
  fallbackStartDate: Date,
  wardrobeItems: WardrobeItem[] = [],
  stylistId: StylistId = 'ruby',
): DFYCalendarMappedOutfit[] {
  const rawOutfits = extractRawOutfitsFromDfyPayload(payload);
  if (rawOutfits.length === 0) return [];

  let planStart = new Date(fallbackStartDate);
  const startCandidate =
    (typeof payload?.startDate === 'string' && payload.startDate) ||
    (typeof payload?.generatedAt === 'string' && payload.generatedAt.slice(0, 10)) ||
    null;
  if (startCandidate) {
    const parsed = new Date(startCandidate);
    if (!Number.isNaN(parsed.getTime())) {
      planStart = parsed;
    }
  }
  planStart.setHours(0, 0, 0, 0);

  // Prefer explicit dates on calendar rows when available
  const withExplicitDates = rawOutfits.every(
    (o) => typeof o?.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.date),
  );
  if (withExplicitDates) {
    return rawOutfits
      .map((raw, idx) => {
        const outfit: DFYOutfit = {
          id: raw.id || `outfit_${idx + 1}`,
          dayNumber: raw.day || raw.dayNumber || idx + 1,
          title: raw.title || raw.occasion || `Day ${idx + 1} Look`,
          description: raw.description || raw.stylistNote || '',
          items: (raw.items || []).map((it: any) => ({
            id: String(it.id),
            name: it.name || '',
            category: it.category || '',
            color: it.color || '',
            imageUri: it.imageUri || it.processedImageUrl || it.imageUrl || undefined,
            imageUrl: it.imageUrl,
            processedImageUrl: it.processedImageUrl,
          })),
          occasion: raw.occasion || 'casual',
          stylistNote: raw.stylistNote || raw.notes,
          weatherNote: raw.weatherNote,
          stylistId: (raw.stylistId || stylistId) as StylistId,
          saved: false,
        };
        if (!outfit.items?.length) return null;
        const enriched = enrichOutfitWithWardrobeImages(outfit, wardrobeItems);
        const dateKey = String(raw.date).slice(0, 10);
        return {
          id: outfit.id,
          date: dateKey,
          title: outfit.title,
          stylistNote: enriched.stylistNote || '',
          weatherNote: enriched.weatherNote,
          stylistId: enriched.stylistId || stylistId,
          wasWorn: Boolean(raw.wasWorn || raw.worn),
          alternativesCount: 0,
          dayNumber: outfit.dayNumber,
          itemIds: enriched.items.map((item) => String(item.id)),
          items: enriched.items.map((item) => ({
            id: String(item.id),
            name: item.name,
            imageUri: item.imageUri,
            category: item.category,
            color: item.color,
          })),
        } as DFYCalendarMappedOutfit;
      })
      .filter((entry): entry is DFYCalendarMappedOutfit => Boolean(entry));
  }

  return mapApiLookbookToCalendarOutfits(rawOutfits, planStart, wardrobeItems, stylistId);
}

/**
 * Build a Core calendar locally — guaranteed to return `totalDays` outfits when
 * the wardrobe can form at least one complete outfit.
 */
export function buildLocalCoreCalendarOutfits(
  wardrobeItems: WardrobeItem[],
  planStartDate: Date,
  totalDays: number,
  stylistId: StylistId = 'ruby',
  laundryProfile?: LaundryProfile,
): DFYCalendarMappedOutfit[] {
  const result = generateGuaranteedCoreCalendar({
    wardrobe: wardrobeItems,
    planStartDate,
    totalDays,
    stylistId,
    laundryProfile,
  });
  return result?.outfits ?? [];
}
