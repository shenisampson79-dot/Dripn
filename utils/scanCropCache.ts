/**
 * Persist GON scan crops to disk so WardrobeItemImage can display them.
 * (The wardrobe loader intentionally rejects data: URIs to avoid iOS jetsam.)
 */

import * as FileSystem from 'expo-file-system/legacy';
import {
  resolveScanCropDataSource,
  safeFileId,
  stripDataUri,
} from '@/utils/scanCropSource';

export {
  resolveScanCropDataSource,
  safeFileId,
  stripDataUri,
} from '@/utils/scanCropSource';

const CROP_DIR = `${FileSystem.cacheDirectory || ''}gon-scan-crops/`;

export async function persistScanCropToFile(
  itemId: string,
  base64OrDataUri: string,
): Promise<string | null> {
  const base64 = stripDataUri(base64OrDataUri);
  if (!base64 || !itemId || !FileSystem.cacheDirectory) return null;
  try {
    await FileSystem.makeDirectoryAsync(CROP_DIR, { intermediates: true });
    const path = `${CROP_DIR}${safeFileId(itemId)}.jpg`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  } catch (err) {
    console.warn('[scanCropCache] persist failed:', (err as Error)?.message || err);
    return null;
  }
}

/** Map session items / hydrated rows that still hold base64 crops onto file:// URIs. */
export async function materializeWardrobeItemImages<
  T extends {
    id: string | number;
    imageUri?: string | null;
    enhancedImageUri?: string | null;
    imageProcessed?: boolean;
  },
>(
  items: T[],
  cropById?: Record<string, string>,
): Promise<T[]> {
  const out: T[] = [];
  for (const item of items || []) {
    const id = String(item.id);
    const source = resolveScanCropDataSource(item, cropById);
    if (!source) {
      out.push(item);
      continue;
    }

    const fileUri = await persistScanCropToFile(id, source);
    if (!fileUri) {
      out.push(item);
      continue;
    }
    out.push({
      ...item,
      imageUri: fileUri,
      enhancedImageUri: fileUri,
      imageProcessed: true,
    });
  }
  return out;
}
