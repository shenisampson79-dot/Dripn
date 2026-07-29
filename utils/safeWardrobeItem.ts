import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ClothingCategory,
  ClothingColor,
  ClothingOccasion,
  ClothingSeason,
  ItemOrigin,
  WardrobeItem,
} from '@/contexts/WardrobeContext';
import {
  normalizeWardrobeCategoryForGender,
  type PresentationGender,
} from '@/utils/wardrobeCategories';
import { coerceWardrobeDisplayImages } from '@/utils/wardrobeImage';

const WARDROBE_STORAGE_KEY = '@dripn_wardrobe';

/** Drop in-memory base64 — even one full-res data URI can jetsam iOS. */
function safeImageUri(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const uri = value.trim();
  if (uri.startsWith('data:')) return '';
  return uri;
}

function safeOptionalImageUri(value: unknown): string | undefined {
  const uri = safeImageUri(value);
  return uri || undefined;
}

const VALID_COLORS = new Set<string>([
  'black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange',
  'yellow', 'green', 'blue', 'purple', 'denim', 'cream', 'multicolor',
]);

function asColor(value: unknown): ClothingColor {
  const key = typeof value === 'string' ? value.toLowerCase().trim() : '';
  return (VALID_COLORS.has(key) ? key : 'black') as ClothingColor;
}

function asSeasons(value: unknown): ClothingSeason[] {
  if (!Array.isArray(value)) return [];
  const out: ClothingSeason[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const s = raw.toLowerCase().trim() as ClothingSeason;
    if (['spring', 'summer', 'autumn', 'winter', 'all-season'].includes(s) && !out.includes(s)) {
      out.push(s);
    }
  }
  return out;
}

function asOccasions(value: unknown): ClothingOccasion[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set([
    'casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday',
  ]);
  const out: ClothingOccasion[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const o = raw.toLowerCase().trim() as ClothingOccasion;
    if (allowed.has(o) && !out.includes(o)) out.push(o);
  }
  return out;
}

/** Coerce one wardrobe row into a render-safe item, or null if unusable. */
export function coerceWardrobeItemForList(
  raw: unknown,
  gender: PresentationGender = 'neutral',
): WardrobeItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<WardrobeItem> & Record<string, unknown>;
  const id = row.id != null ? String(row.id).trim() : '';
  if (!id) return null;

  try {
    const category = normalizeWardrobeCategoryForGender(
      (row.category as string) || 'tops',
      gender,
      { name: typeof row.name === 'string' ? row.name : undefined, subcategory: row.subcategory },
    ) as ClothingCategory;

    const base: WardrobeItem = {
      id,
      userId: String(row.userId ?? ''),
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Item',
      category,
      subcategory: typeof row.subcategory === 'string' ? row.subcategory : undefined,
      color: asColor(row.color),
      secondaryColor: row.secondaryColor ? asColor(row.secondaryColor) : undefined,
      brand: typeof row.brand === 'string' ? row.brand : undefined,
      seasons: asSeasons(row.seasons),
      occasions: asOccasions(row.occasions),
      origin: (['owned', 'inspiration', 'wishlist'].includes(String(row.origin))
        ? row.origin
        : 'owned') as ItemOrigin,
      isFavorite: Boolean(row.isFavorite),
      timesWorn: Number.isFinite(Number(row.timesWorn)) ? Number(row.timesWorn) : 0,
      lastWorn: typeof row.lastWorn === 'string' ? row.lastWorn : undefined,
      wearCountSinceWash: Number.isFinite(Number(row.wearCountSinceWash))
        ? Number(row.wearCountSinceWash)
        : undefined,
      isDirty: Boolean(row.isDirty),
      imageUri: safeImageUri(row.imageUri),
      enhancedImageUri: safeOptionalImageUri(row.enhancedImageUri),
      originalImageUri: safeOptionalImageUri(row.originalImageUri),
      imageProcessed: Boolean(row.imageProcessed),
      aiAnalyzed: row.aiAnalyzed as boolean | undefined,
      aiTags: Array.isArray(row.aiTags) ? row.aiTags.filter((t) => typeof t === 'string') : undefined,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
      purchasePrice: typeof row.purchasePrice === 'number' ? row.purchasePrice : undefined,
      purchaseCurrency: typeof row.purchaseCurrency === 'string' ? row.purchaseCurrency : undefined,
      notes: typeof row.notes === 'string' ? row.notes : undefined,
      wardrobeConfidence:
        typeof row.wardrobeConfidence === 'number' ? row.wardrobeConfidence : undefined,
      needsReview: Boolean(row.needsReview),
    };

    return coerceWardrobeDisplayImages(base);
  } catch (err) {
    if (__DEV__) {
      console.warn('[safeWardrobeItem] skipped malformed row', id, err);
    }
    return null;
  }
}

export function sanitizeWardrobeItemList(
  items: unknown,
  gender: PresentationGender = 'neutral',
): WardrobeItem[] {
  if (!Array.isArray(items)) return [];
  const out: WardrobeItem[] = [];
  for (const raw of items) {
    const item = coerceWardrobeItemForList(raw, gender);
    if (item) out.push(item);
  }
  return out;
}

/** Fast path: show cached wardrobe immediately while remote sync runs. */
export async function readCachedWardrobeItemsForUser(
  userId: string | undefined,
  gender: PresentationGender = 'neutral',
): Promise<WardrobeItem[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(WARDROBE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const mine = parsed.filter(
      (row) => row && typeof row === 'object' && String((row as WardrobeItem).userId) === String(userId),
    );
    return sanitizeWardrobeItemList(mine, gender);
  } catch (err) {
    if (__DEV__) {
      console.warn('[safeWardrobeItem] cache read failed', err);
    }
    return [];
  }
}
