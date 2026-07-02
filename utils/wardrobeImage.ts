import { API_URL } from '@/config/api';
import type { WardrobeItem } from '@/contexts/WardrobeContext';

const HTTP_PREFIX = /^https?:\/\//i;

export function normalizeRemoteApiUrl(url?: string | null): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  if (/^http:\/\/(.*\.onrender\.com|dripn-server)/i.test(url)) {
    return url.replace(/^http:\/\//i, 'https://');
  }
  return url;
}

export function isRemoteImageUri(uri?: string | null): uri is string {
  return typeof uri === 'string' && HTTP_PREFIX.test(uri);
}

export function isProxyWardrobeImageUri(uri?: string | null): boolean {
  return typeof uri === 'string' && uri.includes('/api/wardrobe/') && uri.endsWith('/image');
}

/** Permanent CDN URLs for bg-removed cutouts (not raw originals). */
export function isProcessedWardrobeCdnUrl(uri: string): boolean {
  if (uri.includes('replicate.delivery') || uri.includes('replicate.com')) return true;
  if (uri.includes('res.cloudinary.com')) return /_processed(\.|\/|$)/i.test(uri);
  return false;
}

/** Permanent CDN URLs that do not expire (Cloudinary) or legacy Replicate delivery. */
export function isDurableWardrobeCdnUrl(uri: string): boolean {
  return (
    uri.includes('res.cloudinary.com') ||
    uri.includes('replicate.delivery') ||
    uri.includes('replicate.com')
  );
}

export function buildWardrobeImageProxyUrl(itemId: string | number): string {
  return `${API_URL}/api/wardrobe/${itemId}/image`;
}

/** Indyx-style white tile for clothing cut-outs — always white, even in dark mode. */
export const WARDROBE_CUTOUT_TILE_BG = '#FFFFFF';
export const WARDROBE_TILE_BG_LIGHT = '#FFFFFF';
export const WARDROBE_TILE_BG_DARK = '#2C2C2E';

export function wardrobeTileBackground(isDark: boolean): string {
  return isDark ? WARDROBE_TILE_BG_DARK : WARDROBE_TILE_BG_LIGHT;
}

/** Processed / bg-removed items always sit on a white product tile. */
export function wardrobeProcessedTileBackground(): string {
  return WARDROBE_CUTOUT_TILE_BG;
}

type ImageFields = Pick<
  WardrobeItem,
  'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
>;

export function listWardrobeImageUris(item: ImageFields): string[] {
  const uris: string[] = [];
  const add = (uri?: string | null) => {
    if (typeof uri !== 'string' || !uri.trim()) return;
    const normalized = uri.trim();
    if (!uris.includes(normalized)) uris.push(normalized);
  };

  const primary = resolveWardrobeImageUri(item);
  add(primary);

  if (item.imageProcessed && item.id) {
    add(buildWardrobeImageProxyUrl(item.id));
  }

  for (const uri of [item.enhancedImageUri, item.imageUri]) {
    if (uri && !isProxyWardrobeImageUri(uri)) add(uri);
  }
  add(item.originalImageUri);
  for (const uri of [item.enhancedImageUri, item.imageUri]) {
    add(uri);
  }
  if (item.id) add(buildWardrobeImageProxyUrl(item.id));
  return uris;
}

export function resolveWardrobeImageUri(item: ImageFields): string {
  const candidates = [
    item.enhancedImageUri,
    item.imageUri,
  ].filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);

  const localOriginal =
    typeof item.originalImageUri === 'string' && item.originalImageUri.length > 0
      ? item.originalImageUri
      : '';
  if (localOriginal && !isRemoteImageUri(localOriginal)) return localOriginal;

  const localFromCandidates = candidates.find((uri) => !isRemoteImageUri(uri));
  if (localFromCandidates) return localFromCandidates;

  if (item.imageProcessed && item.id) {
    const proxy = candidates.find(isProxyWardrobeImageUri);
    if (proxy) return proxy;
    return buildWardrobeImageProxyUrl(item.id);
  }

  if (item.id) {
    const proxy = candidates.find(isProxyWardrobeImageUri);
    if (proxy) return proxy;
    if (candidates.length > 0) {
      return buildWardrobeImageProxyUrl(item.id);
    }
  }

  const durableCdn = candidates.find(
    (uri) => isRemoteImageUri(uri) && !isProxyWardrobeImageUri(uri) && isDurableWardrobeCdnUrl(uri),
  );
  if (durableCdn) return durableCdn;

  const remoteCdn = candidates.find(
    (uri) => isRemoteImageUri(uri) && !isProxyWardrobeImageUri(uri),
  );
  if (remoteCdn) return remoteCdn;

  if (candidates[0]) return candidates[0];

  if (item.id) {
    return buildWardrobeImageProxyUrl(item.id);
  }

  return '';
}

export function resolveWardrobeFallbackUri(
  item: Pick<WardrobeItem, 'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed'>,
  primaryUri: string,
): string | undefined {
  const primaryIsProcessed =
    item.imageProcessed || isProxyWardrobeImageUri(primaryUri);

  if (primaryIsProcessed) {
    const localFallback = [item.originalImageUri, item.imageUri, item.enhancedImageUri].find(
      (uri): uri is string =>
        typeof uri === 'string' &&
        uri.length > 0 &&
        uri !== primaryUri &&
        !isRemoteImageUri(uri),
    );
    if (localFallback) return localFallback;
    return undefined;
  }

  const remoteFallbacks = [item.enhancedImageUri, item.imageUri, item.originalImageUri].filter(
    (uri): uri is string =>
      typeof uri === 'string' &&
      uri.length > 0 &&
      uri !== primaryUri &&
      isRemoteImageUri(uri),
  );
  if (remoteFallbacks[0]) return remoteFallbacks[0];

  if (item.id && !isProxyWardrobeImageUri(primaryUri)) {
    return buildWardrobeImageProxyUrl(item.id);
  }
  return undefined;
}

export function wardrobeImageContentFit(
  item: Pick<WardrobeItem, 'imageProcessed' | 'aiAnalyzed'>,
  usingFallback: boolean,
  preferCover = false,
): 'contain' | 'cover' {
  if (item.imageProcessed || item.aiAnalyzed) return 'contain';
  if (preferCover || usingFallback) return 'cover';
  return 'cover';
}

/** Prefer on-device photos for chat/outfit visuals when available. */
export function enrichWardrobeItemForDisplay(item: ImageFields): ImageFields {
  const localUri = listWardrobeImageUris(item).find((uri) => !isRemoteImageUri(uri));
  if (localUri) {
    return {
      ...item,
      imageUri: localUri,
      enhancedImageUri: item.enhancedImageUri && !isProxyWardrobeImageUri(item.enhancedImageUri)
        ? item.enhancedImageUri
        : localUri,
      imageProcessed: false,
    };
  }

  const uri = resolveWardrobeImageUri(item);
  if (!uri) return item;
  if (item.imageUri === uri && item.enhancedImageUri) return item;
  return {
    ...item,
    imageUri: uri,
    enhancedImageUri: item.enhancedImageUri || uri,
    imageProcessed: item.imageProcessed,
  };
}

export function wardrobeImageBackground(
  isDark: boolean,
  item: Pick<WardrobeItem, 'imageProcessed' | 'aiAnalyzed' | 'imageUri'>,
  uri?: string,
): string {
  return wardrobeTileBackground(isDark);
}

function isStoredWardrobeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('data:')) return url.length > 128;
  return isRemoteImageUri(url) && !isProxyWardrobeImageUri(url);
}

export function itemLikelyHasWardrobePhoto(row: {
  processedImageUrl?: string | null;
  processed_image_url?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  backgroundRemoved?: boolean;
  background_removed?: boolean;
}): boolean {
  return !!(
    isStoredWardrobeImageUrl(row.processedImageUrl) ||
    isStoredWardrobeImageUrl(row.processed_image_url) ||
    isStoredWardrobeImageUrl(row.imageUrl) ||
    isStoredWardrobeImageUrl(row.image_url) ||
    isProxyWardrobeImageUri(row.processedImageUrl) ||
    isProxyWardrobeImageUri(row.processed_image_url) ||
    isProxyWardrobeImageUri(row.imageUrl) ||
    isProxyWardrobeImageUri(row.image_url) ||
    row.backgroundRemoved ||
    row.background_removed
  );
}
