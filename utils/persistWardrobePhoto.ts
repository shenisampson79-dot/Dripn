import * as FileSystem from 'expo-file-system/legacy';

const WARDROBE_PHOTOS_DIR = 'wardrobe/';

export function permanentWardrobePhotoPath(itemId: string | number): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  const safeId = String(itemId).replace(/[^\w-]/g, '');
  return `${base}${WARDROBE_PHOTOS_DIR}${safeId}.jpg`;
}

async function ensureWardrobePhotosDir(): Promise<string | null> {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  const dir = `${base}${WARDROBE_PHOTOS_DIR}`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch {
    return null;
  }
}

export async function localWardrobeFileExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  if (uri.startsWith('data:')) return uri.length > 128;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !!(info.exists && (info.size ?? 0) > 256);
  } catch {
    return false;
  }
}

/** Copy a picker/cache photo into app permanent storage so it survives iOS cache clears. */
export async function persistWardrobePhotoToAppStorage(
  sourceUri: string,
  itemId: string | number,
): Promise<string | null> {
  if (!sourceUri || sourceUri.startsWith('http')) return null;

  const dest = permanentWardrobePhotoPath(itemId);
  if (!dest) return null;

  await ensureWardrobePhotosDir();

  try {
    if (!(await localWardrobeFileExists(sourceUri))) return null;

    if (sourceUri === dest) return dest;

    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 0) > 256) {
      return info.uri || dest;
    }
  } catch (error) {
    if (__DEV__) console.warn('[WardrobePhoto] persist failed', itemId, error);
  }

  return null;
}

export async function resolvePermanentWardrobePhoto(itemId: string | number): Promise<string | null> {
  const dest = permanentWardrobePhotoPath(itemId);
  if (!dest) return null;
  if (await localWardrobeFileExists(dest)) {
    const info = await FileSystem.getInfoAsync(dest);
    return info.uri || dest;
  }
  return null;
}
