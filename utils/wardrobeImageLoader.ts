import * as FileSystem from 'expo-file-system/legacy';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { apiService } from '@/services/ApiService';
import {
  buildWardrobeImageProxyUrl,
  isProxyWardrobeImageUri,
  isRemoteImageUri,
  itemHasProcessedCutout,
} from '@/utils/wardrobeImage';
import {
  localWardrobeFileExists,
  resolveLocalWardrobePhoto,
} from '@/utils/wardrobeLocalPhotos';

const Base64Encoding = 'base64' as const;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

function cachePathFor(id: string | number): string | null {
  const dir = wardrobeCacheDir();
  if (!dir) return null;
  return `${dir}${itemKey(id)}.jpg`;
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

async function writeBufferToCache(dest: string, buffer: ArrayBuffer): Promise<string | null> {
  const base64 = arrayBufferToBase64(buffer);
  if (!base64) return null;

  try {
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: Base64Encoding });
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 0) > 256) {
      return info.uri || dest;
    }
  } catch (error) {
    if (__DEV__) console.warn('[WardrobeImage] cache write failed:', error);
  }

  return `data:image/jpeg;base64,${base64}`;
}

function remoteCdnCandidates(item: WardrobeImageFields): string[] {
  const urls: string[] = [];
  const add = (uri?: string | null) => {
    if (typeof uri !== 'string' || !uri.trim()) return;
    const normalized = uri.trim();
    if (!isRemoteImageUri(normalized)) return;
    if (isProxyWardrobeImageUri(normalized)) return;
    if (!urls.includes(normalized)) urls.push(normalized);
  };

  add(item.enhancedImageUri);
  add(item.imageUri);
  add(item.originalImageUri);
  return urls;
}

function dataUriCandidate(item: WardrobeImageFields): string | null {
  for (const uri of [item.enhancedImageUri, item.imageUri, item.originalImageUri]) {
    if (typeof uri === 'string' && uri.startsWith('data:')) return uri;
  }
  return null;
}

async function fetchAuthProxyToCache(id: string | number): Promise<string | null> {
  await apiService.init();
  const token = await apiService.getToken();
  if (!token) {
    logSource(id, 'proxy-error', 'no-token');
    return null;
  }

  const dest = cachePathFor(id);
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

    const written = await writeBufferToCache(dest, buffer);
    if (written) logSource(id, 'proxy');
    return written;
  } catch (error) {
    if (__DEV__) console.warn('[WardrobeImage] proxy download error', id, error);
    logSource(id, 'proxy-error', 'network');
    return null;
  }
}

async function fetchRemoteToCache(url: string, id: string | number): Promise<string | null> {
  const dest = cachePathFor(id);
  if (!dest) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;

    const written = await writeBufferToCache(dest, buffer);
    if (written) logSource(id, 'cdn');
    return written;
  } catch {
    return null;
  }
}

function remember(id: string, uri: string): string {
  memoryCache.set(id, uri);
  return uri;
}

export function getCachedWardrobeImageUri(id: string | number): string | null {
  return memoryCache.get(itemKey(id)) ?? null;
}

export function invalidateWardrobeImageCache(id?: string | number): void {
  if (id == null) {
    memoryCache.clear();
    inflight.clear();
    return;
  }
  const key = itemKey(id);
  memoryCache.delete(key);
  inflight.delete(key);
}

export async function loadWardrobeImageForItem(item: WardrobeImageFields): Promise<string | null> {
  if (!item?.id) return null;

  const id = itemKey(item.id);
  const existing = memoryCache.get(id);
  if (existing) {
    logSource(item.id, 'memory');
    return existing;
  }

  const pending = inflight.get(id);
  if (pending) return pending;

  const task = (async (): Promise<string | null> => {
    await ensureCacheDir();

    const diskPath = cachePathFor(item.id);
    if (diskPath) {
      const cached = await isFreshDiskCache(diskPath);
      if (cached) {
        return remember(id, cached);
      }
    }

    // After bg removal, prefer the processed CDN/proxy cutout — not the original carpet photo.
    const skipLocalOriginal = itemHasProcessedCutout(item);

    if (!skipLocalOriginal) {
      const local = await resolveLocalWardrobePhoto(item.id, item);
      if (local) {
        logSource(item.id, 'local');
        return remember(id, local);
      }
    }

    const fromProxy = await fetchAuthProxyToCache(item.id);
    if (fromProxy) return remember(id, fromProxy);

    for (const url of remoteCdnCandidates(item)) {
      const fromCdn = await fetchRemoteToCache(url, item.id);
      if (fromCdn) return remember(id, fromCdn);
    }

    const dataUri = dataUriCandidate(item);
    if (dataUri) {
      logSource(item.id, 'data');
      return remember(id, dataUri);
    }

    for (const url of remoteCdnCandidates(item)) {
      logSource(item.id, 'cdn', 'direct-url');
      return remember(id, url);
    }

    logSource(item.id, 'none');
    return null;
  })();

  inflight.set(id, task);
  try {
    return await task;
  } finally {
    inflight.delete(id);
  }
}

export async function resolveWardrobeImageSource(
  uri: string,
  itemId?: string | number,
): Promise<{ uri: string } | null> {
  if (!uri) return null;

  if (uri.startsWith('data:')) return { uri };

  if (!isRemoteImageUri(uri)) {
    return (await localWardrobeFileExists(uri)) ? { uri } : null;
  }

  if (isProxyWardrobeImageUri(uri) && itemId != null) {
    const loaded = await loadWardrobeImageForItem({ id: String(itemId), imageUri: uri, imageProcessed: true });
    return loaded ? { uri: loaded } : null;
  }

  return { uri };
}
