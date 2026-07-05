import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { isRemoteImageUri } from '@/utils/wardrobeImage';
import {
  localWardrobeFileExists,
  persistWardrobePhotoToAppStorage,
  resolvePermanentWardrobePhoto,
} from '@/utils/persistWardrobePhoto';

const IMAGE_CACHE_KEY = '@dripn_wardrobe_image_cache';
const WARDROBE_STORAGE_KEY = '@dripn_wardrobe';

export { localWardrobeFileExists };

async function readJson(key: string): Promise<any> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Collect every on-device photo path we know about for a wardrobe item. */
export async function listLocalWardrobePhotoCandidates(
  itemId: string | number,
  item?: Pick<WardrobeItem, 'originalImageUri' | 'imageUri' | 'enhancedImageUri'>,
): Promise<string[]> {
  const uris: string[] = [];
  const add = (uri?: string | null) => {
    if (typeof uri !== 'string' || !uri.trim()) return;
    const normalized = uri.trim();
    if (/^https?:\/\//i.test(normalized)) return;
    if (normalized.startsWith('data:')) return;
    if (!uris.includes(normalized)) uris.push(normalized);
  };

  const permanent = await resolvePermanentWardrobePhoto(itemId);
  if (permanent) add(permanent);

  add(item?.originalImageUri);
  add(item?.imageUri);
  add(item?.enhancedImageUri);

  const key = String(itemId);
  const imageCache = await readJson(IMAGE_CACHE_KEY);
  const cacheEntry = imageCache?.[key];
  if (cacheEntry) {
    add(cacheEntry.originalImageUri);
    add(cacheEntry.imageUri);
    add(cacheEntry.enhancedImageUri);
  }

  const wardrobeItems: WardrobeItem[] | null = await readJson(WARDROBE_STORAGE_KEY);
  if (Array.isArray(wardrobeItems)) {
    const saved = wardrobeItems.find((row) => String(row.id) === key);
    if (saved) {
      add(saved.originalImageUri);
      add(saved.imageUri);
      add(saved.enhancedImageUri);
    }
  }

  return uris;
}

export async function resolveLocalWardrobePhoto(
  itemId: string | number,
  item?: Pick<WardrobeItem, 'originalImageUri' | 'imageUri' | 'enhancedImageUri'>,
): Promise<string | null> {
  const permanent = await resolvePermanentWardrobePhoto(itemId);
  if (permanent) return permanent;

  const candidates = await listLocalWardrobePhotoCandidates(itemId, item);
  for (const uri of candidates) {
    if (await localWardrobeFileExists(uri)) {
      const persisted = await persistWardrobePhotoToAppStorage(uri, itemId);
      return persisted || uri;
    }
  }
  return null;
}

export async function hydrateWardrobeItemWithLocalPhoto(item: WardrobeItem): Promise<WardrobeItem> {
  const permanent = await resolvePermanentWardrobePhoto(item.id);

  if (item.imageProcessed) {
    if (permanent) {
      return {
        ...item,
        imageUri: permanent,
        enhancedImageUri: permanent,
        originalImageUri: item.originalImageUri || permanent,
      };
    }
    return item;
  }

  const local = permanent || (await resolveLocalWardrobePhoto(item.id, item));
  if (!local) return item;

  return {
    ...item,
    originalImageUri: local,
    imageUri: local,
    enhancedImageUri: local,
  };
}

export async function hydrateWardrobeItemsWithLocalPhotos(items: WardrobeItem[]): Promise<WardrobeItem[]> {
  return Promise.all(items.map((item) => hydrateWardrobeItemWithLocalPhoto(item)));
}

export async function migrateWardrobeItemsToPermanentPhotos(items: WardrobeItem[]): Promise<WardrobeItem[]> {
  const migrated: WardrobeItem[] = [];
  for (const item of items) {
    const existing = await resolvePermanentWardrobePhoto(item.id);
    if (existing) {
      if (item.imageProcessed) {
        migrated.push({
          ...item,
          imageUri: existing,
          enhancedImageUri: existing,
          originalImageUri: item.originalImageUri || existing,
        });
      } else {
        migrated.push({
          ...item,
          originalImageUri: existing,
          imageUri: existing,
          enhancedImageUri: existing,
        });
      }
      continue;
    }

    const candidates = await listLocalWardrobePhotoCandidates(item.id, item);
    let saved: string | null = null;
    for (const uri of candidates) {
      if (await localWardrobeFileExists(uri)) {
        saved = await persistWardrobePhotoToAppStorage(uri, item.id);
        if (saved) break;
      }
    }

    if (saved) {
      migrated.push({
        ...item,
        originalImageUri: saved,
        imageUri: saved,
        enhancedImageUri: saved,
      });
    } else {
      migrated.push(item);
    }
  }
  return migrated;
}
