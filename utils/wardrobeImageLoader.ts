import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { apiService } from '@/services/ApiService';
import {
  buildWardrobeImageProxyUrl,
  hasVerifiedCutoutUri,
  isLikelyLocalGarmentUri,
  isProxyWardrobeImageUri,
  isRemoteImageUri,
  itemHasProcessedCutout,
  resolveWardrobeImageUri,
} from '@/utils/wardrobeImage';
import {
  localWardrobeFileExists,
  resolveLocalWardrobePhoto,
} from '@/utils/wardrobeLocalPhotos';
import { runWithPerformanceBudget } from '@/utils/performanceBudget';
import { logScale } from '@/utils/scaleDiagnostics';

const Base64Encoding = 'base64' as const;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** View-driven image sizes — grid never needs full camera resolution. */
export type WardrobeImageVariant = 'thumb' | 'medium' | 'full';

const VARIANT_WIDTH: Record<WardrobeImageVariant, number> = {
  thumb: 400,
  medium: 800,
  full: 1200,
};

export type WardrobeImageFields = Pick<
  WardrobeItem,
  'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed'
>;

const memoryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

let cacheDirReady = false;

function itemKey(id: string | number): string {
  return String(id).replace(/[^\w-]/g, '');
}

function cacheKey(id: string | number, variant: WardrobeImageVariant): string {
  return `${itemKey(id)}:${variant}`;
}

function wardrobeCacheDir(): string | null {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  return base ? `${base}wardrobe/` : null;
}

async function ensureCacheDir(): Promise<string | null> {
  const dir = wardrobeCacheDir();
  if (!dir) return null;

  if (!cacheDirReady) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      cacheDirReady = true;
    } catch (error) {
      if (__DEV__) console.warn('[WardrobeImage] cache dir error:', error);
      return null;
    }
  }

  return dir;
}

function cachePathFor(id: string | number, variant: WardrobeImageVariant = 'medium'): string | null {
  const dir = wardrobeCacheDir();
  if (!dir) return null;
  const suffix = variant === 'medium' ? '' : `_${variant}`;
  return `${dir}${itemKey(id)}${suffix}.jpg`;
}

function logSource(
  id: string | number,
  from: 'memory' | 'disk' | 'local' | 'proxy' | 'cdn' | 'data' | 'none' | 'proxy-error',
  detail?: string,
) {
  if (__DEV__) console.log('[WardrobeImage]', { id, from, ...(detail ? { detail } : {}) });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length) return null;

  if (typeof globalThis.btoa !== 'function') return null;

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return globalThis.btoa(binary);
}

async function isFreshDiskCache(path: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || (info.size ?? 0) < 256) return null;

    const mtime = (info as { modificationTime?: number }).modificationTime;
    if (typeof mtime === 'number' && Date.now() - mtime * 1000 > CACHE_TTL_MS) {
      return null;
    }

    return info.uri || path;
  } catch {
    return null;
  }
}

async function downscaleCachedFile(
  path: string,
  variant: WardrobeImageVariant = 'medium',
): Promise<string> {
  try {
    const resized = await ImageManipulator.manipulateAsync(
      path,
      [{ resize: { width: VARIANT_WIDTH[variant] } }],
      { compress: variant === 'thumb' ? 0.7 : 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    if (!resized?.uri || resized.uri === path) return path;
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
      await FileSystem.copyAsync({ from: resized.uri, to: path });
      await FileSystem.deleteAsync(resized.uri, { idempotent: true });
      return path;
    } catch {
      return resized.uri;
    }
  } catch {
    return path;
  }
}

async function writeBufferToCache(
  dest: string,
  buffer: ArrayBuffer,
  variant: WardrobeImageVariant = 'medium',
): Promise<string | null> {
  if (buffer.byteLength > 8 * 1024 * 1024) {
    if (__DEV__) console.warn('[WardrobeImage] skip oversized image buffer', buffer.byteLength);
    return null;
  }

  const base64 = arrayBufferToBase64(buffer);
  if (!base64) return null;

  try {
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: Base64Encoding });
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 0) > 256) {
      return downscaleCachedFile(info.uri || dest, variant);
    }
  } catch (error) {
    if (__DEV__) console.warn('[WardrobeImage] cache write failed:', error);
  }

  // Never return data: URIs — they retain multi-MB strings in JS heap.
  return null;
}

function remoteCdnCandidates(item: WardrobeImageFields): string[] {
  const urls: string[] = [];
  const add = (uri?: string | null) => {
    if (typeof uri !== 'string' || !uri.trim()) return;
    const normalized = uri.trim();
    if (normalized.startsWith('data:')) return;
    if (!isRemoteImageUri(normalized)) return;
    if (isProxyWardrobeImageUri(normalized)) return;
    if (!urls.includes(normalized)) urls.push(normalized);
  };

  add(item.enhancedImageUri);
  add(item.imageUri);
  add(item.originalImageUri);
  return urls;
}

async function fetchAuthProxyToCache(
  id: string | number,
  variant: WardrobeImageVariant,
): Promise<string | null> {
  await apiService.init();
  const token = await apiService.getToken();
  if (!token) {
    logSource(id, 'proxy-error', 'no-token');
    return null;
  }

  const dest = cachePathFor(id, variant);
  if (!dest) return null;

  const url = buildWardrobeImageProxyUrl(id);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      logSource(id, 'proxy-error', String(response.status));
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;

    const written = await writeBufferToCache(dest, buffer, variant);
    if (written) logSource(id, 'proxy');
    return written;
  } catch (error) {
    if (__DEV__) console.warn('[WardrobeImage] proxy download error', id, error);
    logSource(id, 'proxy-error', 'network');
    return null;
  }
}

async function fetchRemoteToCache(
  url: string,
  id: string | number,
  variant: WardrobeImageVariant,
): Promise<string | null> {
  const dest = cachePathFor(id, variant);
  if (!dest) return null;

  try {
    // Prefer download-to-disk (no giant ArrayBuffer + base64 in JS heap).
    const downloaded = await FileSystem.downloadAsync(url, dest);
    if (downloaded.status === 200) {
      const scaled = await downscaleCachedFile(downloaded.uri || dest, variant);
      logSource(id, 'cdn');
      return scaled;
    }
  } catch {
    // Fall through to fetch path.
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;

    const written = await writeBufferToCache(dest, buffer, variant);
    if (written) logSource(id, 'cdn');
    return written;
  } catch {
    return null;
  }
}

function remember(key: string, uri: string): string | null {
  if (!uri || uri.startsWith('data:')) return null;
  memoryCache.set(key, uri);
  return uri;
}

export function getCachedWardrobeImageUri(
  id: string | number,
  variant: WardrobeImageVariant = 'thumb',
): string | null {
  return (
    memoryCache.get(cacheKey(id, variant))
    ?? memoryCache.get(cacheKey(id, 'medium'))
    ?? memoryCache.get(itemKey(id))
    ?? null
  );
}

export function invalidateWardrobeImageCache(id?: string | number): void {
  if (id == null) {
    memoryCache.clear();
    inflight.clear();
    return;
  }
  for (const variant of ['thumb', 'medium', 'full'] as WardrobeImageVariant[]) {
    memoryCache.delete(cacheKey(id, variant));
    inflight.delete(cacheKey(id, variant));
  }
  memoryCache.delete(itemKey(id));
  inflight.delete(itemKey(id));
}

/** Drop memory + on-disk cache for an item so a new photo/cutout is shown. */
export async function purgeWardrobeImageCache(id: string | number): Promise<void> {
  invalidateWardrobeImageCache(id);
  for (const variant of ['thumb', 'medium', 'full'] as WardrobeImageVariant[]) {
    const diskPath = cachePathFor(id, variant);
    if (!diskPath) continue;
    try {
      await FileSystem.deleteAsync(diskPath, { idempotent: true });
    } catch {
      // Non-fatal
    }
  }
}

export async function loadWardrobeImageForItem(
  item: WardrobeImageFields,
  options?: { variant?: WardrobeImageVariant },
): Promise<string | null> {
  if (!item?.id) return null;
  const variant = options?.variant ?? 'thumb';

  return runWithPerformanceBudget(() => loadWardrobeImageForItemInner(item, variant));
}

async function loadWardrobeImageForItemInner(
  item: WardrobeImageFields,
  variant: WardrobeImageVariant,
): Promise<string | null> {
  const id = itemKey(item.id);
  const key = cacheKey(item.id, variant);

  // Shared "preview" id must never hit permanent/disk cache — it reused one photo across retakes.
  if (id === 'preview') {
    const raw =
      (typeof item.enhancedImageUri === 'string' && item.enhancedImageUri.trim()) ||
      (typeof item.imageUri === 'string' && item.imageUri.trim()) ||
      (typeof item.originalImageUri === 'string' && item.originalImageUri.trim()) ||
      null;
    const previewUri = raw && !raw.startsWith('data:') ? raw : null;
    logSource(item.id, previewUri ? 'local' : 'none', 'preview-bypass-cache');
    return previewUri;
  }

  const preferredResolved = resolveWardrobeImageUri(item);
  const cutoutExpected = itemHasProcessedCutout(item) || hasVerifiedCutoutUri(item);
  const preferredRaw =
    preferredResolved ||
    (typeof item.enhancedImageUri === 'string' && item.enhancedImageUri.trim()) ||
    (typeof item.imageUri === 'string' && item.imageUri.trim()) ||
    null;
  const preferredProp =
    preferredRaw && !preferredRaw.startsWith('data:') ? preferredRaw : null;

  // Fresh local picker/camera URIs win ONLY when no cutout is expected.
  // Otherwise carpet originals poison the render cache forever.
  if (
    !cutoutExpected &&
    preferredProp &&
    isLikelyLocalGarmentUri(preferredProp)
  ) {
    if (await localWardrobeFileExists(preferredProp)) {
      memoryCache.delete(key);
      inflight.delete(key);
      logSource(item.id, 'local', 'prefer-prop-uri');
      return remember(key, preferredProp);
    }
  }

  // New remote / proxy cutout should invalidate an older cached carpet file.
  if (preferredProp && (isRemoteImageUri(preferredProp) || isProxyWardrobeImageUri(preferredProp) || cutoutExpected)) {
    const existing = memoryCache.get(key);
    if (
      existing &&
      existing !== preferredProp &&
      !existing.startsWith('data:') &&
      (isLikelyLocalGarmentUri(existing) || cutoutExpected)
    ) {
      memoryCache.delete(key);
    }
    const diskPath = cachePathFor(item.id, variant);
    if (diskPath) {
      const cached = await isFreshDiskCache(diskPath);
      if (cached && (cutoutExpected || cached !== preferredProp)) {
        try {
          await FileSystem.deleteAsync(diskPath, { idempotent: true });
        } catch {
          // Non-fatal
        }
      }
    }
  }

  const existing = memoryCache.get(key);
  if (existing?.startsWith('data:')) {
    memoryCache.delete(key);
  } else if (existing && !(cutoutExpected && isLikelyLocalGarmentUri(existing))) {
    logSource(item.id, 'memory');
    return existing;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async (): Promise<string | null> => {
    await ensureCacheDir();

    const diskPath = cachePathFor(item.id, variant);
    // After rembg, never serve a stale local disk jpg ahead of proxy/CDN cutout.
    if (diskPath && !cutoutExpected) {
      const cached = await isFreshDiskCache(diskPath);
      if (cached) {
        return remember(key, cached);
      }
    }

    // After bg removal, prefer the processed CDN/proxy cutout — not the original carpet photo.
    if (!cutoutExpected) {
      const local = await resolveLocalWardrobePhoto(item.id, item);
      if (local) {
        // Downscale local originals into the variant cache when possible.
        if (diskPath && isLikelyLocalGarmentUri(local)) {
          try {
            const scaled = await ImageManipulator.manipulateAsync(
              local,
              [{ resize: { width: VARIANT_WIDTH[variant] } }],
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
            );
            if (scaled?.uri) {
              try {
                await FileSystem.copyAsync({ from: scaled.uri, to: diskPath });
                logSource(item.id, 'local', `scaled-${variant}`);
                return remember(key, diskPath);
              } catch {
                logSource(item.id, 'local');
                return remember(key, scaled.uri);
              }
            }
          } catch {
            // fall through to raw local
          }
        }
        logSource(item.id, 'local');
        return remember(key, local);
      }
    }

    const fromProxy = await fetchAuthProxyToCache(item.id, variant);
    if (fromProxy) return remember(key, fromProxy);

    for (const url of remoteCdnCandidates(item)) {
      const fromCdn = await fetchRemoteToCache(url, item.id, variant);
      if (fromCdn) return remember(key, fromCdn);
    }

    // Never serve data: URIs from wardrobe items — they jetsam iOS under load.
    for (const url of remoteCdnCandidates(item)) {
      logSource(item.id, 'cdn', 'direct-url');
      return remember(key, url);
    }

    logSource(item.id, 'none');
    logScale('image_miss', { id: item.id, variant });
    return null;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export async function resolveWardrobeImageSource(
  uri: string,
  itemId?: string | number,
): Promise<{ uri: string } | null> {
  if (!uri) return null;

  if (uri.startsWith('data:')) return null;

  if (!isRemoteImageUri(uri)) {
    return (await localWardrobeFileExists(uri)) ? { uri } : null;
  }

  if (isProxyWardrobeImageUri(uri) && itemId != null) {
    const loaded = await loadWardrobeImageForItem({ id: String(itemId), imageUri: uri, imageProcessed: true });
    return loaded ? { uri: loaded } : null;
  }

  return { uri };
}
