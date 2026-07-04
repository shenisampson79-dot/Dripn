import { WardrobeItem } from '@/contexts/WardrobeContext';
import { DFYLiteDelivery, DFYOutfit, StylistId } from '@/services/DFYService';
import { enrichOutfitWithWardrobeImages } from '@/utils/dfyOutfitImages';

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
    title: outfit.title || (dayIndex === 0 ? "Today's Look" : `Day ${dayIndex + 1} Look`),
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
        title: raw.title || (idx === 0 ? "Today's Look" : `Day ${idx + 1} Look`),
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
