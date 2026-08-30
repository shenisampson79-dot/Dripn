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

export type GarmentImageFields = Pick<
  WardrobeItem,
  'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
>;

type ImageFields = GarmentImageFields;

function trimUri(uri?: string | null): string {
  return typeof uri === 'string' ? uri.trim() : '';
}

export function isLikelyLocalGarmentUri(uri?: string | null): boolean {
  const value = trimUri(uri);
  if (!value) return false;
  if (value.startsWith('data:')) return false;
  return !isRemoteImageUri(value);
}

/**
 * URI evidence of a cutout. Never trust `imageProcessed` alone —
 * that flag is what poisoned the carpet cache.
 */
export function hasVerifiedCutoutUri(item: Pick<ImageFields, 'imageUri' | 'enhancedImageUri'>): boolean {
  for (const uri of [item.enhancedImageUri, item.imageUri]) {
    const value = trimUri(uri);
    if (!value) continue;
    if (isProxyWardrobeImageUri(value)) return true;
    if (isRemoteImageUri(value) && isProcessedWardrobeCdnUrl(value)) return true;
  }
  return false;
}

/**
 * Classic failure mode: imageProcessed=true but display URIs still point at the
 * local carpet original (hydration overwrite).
 */
export function isFalselyMarkedProcessed(item: ImageFields): boolean {
  if (!item.imageProcessed) return false;
  if (hasVerifiedCutoutUri(item)) return false;

  const display = trimUri(item.enhancedImageUri) || trimUri(item.imageUri);
  // Missing display URIs is not carpet poison — proxy may still serve the cutout.
  if (!display) return false;
  if (isRemoteImageUri(display) || isProxyWardrobeImageUri(display)) return false;

  const original = trimUri(item.originalImageUri);
  return !original || display === original;
}

/**
 * True when UI may treat the item as a rembg cutout (white tile / Pro badge).
 * Requires verified URI evidence, or a non-poisoned processed flag that can use proxy.
 */
export function itemHasProcessedCutout(item: ImageFields): boolean {
  if (isFalselyMarkedProcessed(item)) return false;
  if (hasVerifiedCutoutUri(item)) return true;
  if ((item.imageProcessed || item.aiAnalyzed) && item.id) return true;
  return false;
}

/**
 * Strict display priority (processed assets are immutable and always win):
 * 1. Verified processed CDN / Replicate cutout
 * 2. Auth proxy when server cutout is expected
 * 3. Other remote durable URLs
 * 4. Local display (never when a cutout is expected)
 * 5. Local original / fallback
 */
export function resolveWardrobeImageUri(item: ImageFields): string {
  const enhanced = trimUri(item.enhancedImageUri);
  const image = trimUri(item.imageUri);
  const original = trimUri(item.originalImageUri);
  const candidates = [enhanced, image].filter(Boolean);

  // 1. Verified cutout CDN
  for (const uri of candidates) {
    if (isRemoteImageUri(uri) && isProcessedWardrobeCdnUrl(uri)) return uri;
  }

  // 2. Proxy when cutout is expected (server is source of truth)
  if (item.id && itemHasProcessedCutout(item)) {
    const proxy = candidates.find(isProxyWardrobeImageUri);
    return proxy || buildWardrobeImageProxyUrl(item.id);
  }

  // 3. Local original only when NOT processed (carpet is fallback, never truth after rembg)
  if (original && isLikelyLocalGarmentUri(original) && !itemHasProcessedCutout(item)) {
    return original;
  }

  const localDisplay = candidates.find((uri) => isLikelyLocalGarmentUri(uri));
  if (localDisplay && !itemHasProcessedCutout(item)) return localDisplay;

  // 4. Durable remote (non-proxy)
  const durableCdn = candidates.find(
    (uri) => isRemoteImageUri(uri) && !isProxyWardrobeImageUri(uri) && isDurableWardrobeCdnUrl(uri),
  );
  if (durableCdn) return durableCdn;

  const remoteCdn = candidates.find(
    (uri) => isRemoteImageUri(uri) && !isProxyWardrobeImageUri(uri),
  );
  if (remoteCdn) return remoteCdn;

  if (candidates[0]) return candidates[0];
  if (original) return original;

  if (item.id) return buildWardrobeImageProxyUrl(item.id);
  return '';
}

/**
 * Last-mile guard: never leave display URIs equal to the carpet original when a
 * cutout exists / is expected. Clears poisoned processed flags.
 */
export function coerceWardrobeDisplayImages<T extends ImageFields>(item: T): T {
  if (isFalselyMarkedProcessed(item)) {
    const original = trimUri(item.originalImageUri) || trimUri(item.imageUri);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[WardrobeImage] invalid state: imageProcessed with local original only', item.id);
    }
    return {
      ...item,
      imageProcessed: false,
      originalImageUri: original || item.originalImageUri,
      imageUri: original || item.imageUri,
      enhancedImageUri: original || item.enhancedImageUri,
    };
  }

  if (!hasVerifiedCutoutUri(item) && !itemHasProcessedCutout(item)) {
    return item;
  }

  const original = trimUri(item.originalImageUri);
  const display = trimUri(item.enhancedImageUri) || trimUri(item.imageUri);
  if (original && display && isLikelyLocalGarmentUri(display) && display === original) {
    const cutout =
      [item.enhancedImageUri, item.imageUri].find(
        (uri) =>
          !!uri &&
          (isProcessedWardrobeCdnUrl(uri) || isProxyWardrobeImageUri(uri)),
      ) || (item.id ? buildWardrobeImageProxyUrl(item.id) : '');

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[WardrobeImage] invalid state: cutout expected but local original used', item.id);
    }

    if (!cutout) return item;
    return {
      ...item,
      imageUri: cutout,
      enhancedImageUri: cutout,
      originalImageUri: original,
      imageProcessed: true,
    };
  }

  return item;
}

/**
 * Safe hydration write: never copy local original onto display fields when a
 * cutout already exists or is expected.
 */
export function assignLocalOriginalOnly<T extends ImageFields>(
  item: T,
  localOriginal: string | null | undefined,
): T {
  if (!localOriginal) return item;
  if (itemHasProcessedCutout(item) || hasVerifiedCutoutUri(item)) {
    return {
      ...item,
      originalImageUri: item.originalImageUri || localOriginal,
    };
  }
  return {
    ...item,
    originalImageUri: localOriginal,
    imageUri: localOriginal,
    enhancedImageUri: localOriginal,
  };
}

export type WardrobeImageCacheEntry = {
  imageUri?: string;
  enhancedImageUri?: string;
  originalImageUri?: string;
  imageProcessed?: boolean;
};

/** Server row + mapped item agree the durable cutout is authoritative. */
export function isServerAuthoritativeProcessed(
  mapped: ImageFields,
  row?: { backgroundRemoved?: boolean; background_removed?: boolean },
): boolean {
  return Boolean(
    mapped.imageProcessed ||
    row?.backgroundRemoved ||
    row?.background_removed ||
    isProcessedWardrobeCdnUrl(mapped.imageUri || '') ||
    isProcessedWardrobeCdnUrl(mapped.enhancedImageUri || ''),
  );
}

function localGarmentUri(...candidates: Array<string | null | undefined>): string {
  for (const uri of candidates) {
    if (uri && isLikelyLocalGarmentUri(uri)) return uri;
  }
  return '';
}

/**
 * Hydration merge: stale local Quick Add capture must not override a later durable cutout.
 */
export function mergeMappedItemWithImageCache(
  mapped: ImageFields,
  cacheEntry: WardrobeImageCacheEntry | undefined,
  opts: { serverProcessed: boolean; savedLocal?: string },
): ImageFields {
  const cacheLocal = localGarmentUri(cacheEntry?.imageUri, cacheEntry?.originalImageUri);
  const savedLocal = opts.savedLocal || '';

  if (opts.serverProcessed) {
    const localOriginal = localGarmentUri(cacheLocal, savedLocal, mapped.originalImageUri);
    return coerceWardrobeDisplayImages(
      assignLocalOriginalOnly(mapped, localOriginal || undefined),
    );
  }

  if (cacheEntry?.imageUri && cacheEntry.imageProcessed) {
    const cacheOrig = cacheEntry.originalImageUri || '';
    if (cacheLocal && cacheOrig && cacheEntry.imageUri === cacheOrig) {
      return coerceWardrobeDisplayImages({
        ...mapped,
        originalImageUri: cacheOrig,
        imageUri: cacheOrig,
        enhancedImageUri: cacheOrig,
        imageProcessed: false,
      });
    }
    if (!cacheLocal) {
      return coerceWardrobeDisplayImages({
        ...mapped,
        imageUri: cacheEntry.imageUri,
        enhancedImageUri: cacheEntry.enhancedImageUri || cacheEntry.imageUri,
        originalImageUri: cacheEntry.originalImageUri || mapped.originalImageUri,
        imageProcessed: true,
      });
    }
  }

  if (savedLocal) {
    return coerceWardrobeDisplayImages({
      ...mapped,
      originalImageUri: savedLocal || mapped.originalImageUri,
      imageUri: savedLocal,
      enhancedImageUri: savedLocal,
      imageProcessed: false,
    });
  }

  return coerceWardrobeDisplayImages(mapped);
}

/**
 * Persisted device cache: processed display wins over local capture when server says cutout exists.
 */
export function buildWardrobeImageCacheEntryFromItem(
  item: ImageFields,
  existing: WardrobeImageCacheEntry = {},
  opts?: { proxyUrl?: string | null },
): WardrobeImageCacheEntry {
  const localUri = localGarmentUri(
    existing.originalImageUri,
    existing.imageUri,
    item.originalImageUri,
  );

  const cutoutRemote = [item.enhancedImageUri, item.imageUri].find(
    (uri) => uri && (isProcessedWardrobeCdnUrl(uri) || isProxyWardrobeImageUri(uri)),
  );
  const processedDisplay =
    cutoutRemote ||
    (item.imageProcessed && opts?.proxyUrl ? opts.proxyUrl : null) ||
    (item.imageProcessed && item.id ? buildWardrobeImageProxyUrl(item.id) : null);

  const displayUri =
    (item.imageProcessed || itemHasProcessedCutout(item))
      ? (processedDisplay || localUri || existing.imageUri || item.imageUri || '')
      : (localUri || processedDisplay || existing.imageUri || item.imageUri || '');

  return {
    ...existing,
    imageUri: displayUri,
    enhancedImageUri:
      (item.imageProcessed || itemHasProcessedCutout(item))
        ? (processedDisplay || item.enhancedImageUri || displayUri)
        : (processedDisplay || item.enhancedImageUri || existing.enhancedImageUri || displayUri),
    originalImageUri: localUri || existing.originalImageUri || item.originalImageUri,
    imageProcessed: Boolean(item.imageProcessed || existing.imageProcessed),
  };
}

export function listWardrobeImageUris(item: ImageFields): string[] {
  const uris: string[] = [];
  const add = (uri?: string | null) => {
    if (typeof uri !== 'string' || !uri.trim()) return;
    const normalized = uri.trim();
    if (!uris.includes(normalized)) uris.push(normalized);
  };

  const primary = resolveWardrobeImageUri(item);
  add(primary);

  if (itemHasProcessedCutout(item) && item.id) {
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

/** Outfit stacks / lookbook — always prefer bg-removed cutouts over carpet originals. */
export function enrichWardrobeItemForOutfitVisual(item: ImageFields): ImageFields {
  const coerced = coerceWardrobeDisplayImages(item);
  if (itemHasProcessedCutout(coerced)) {
    const uri = resolveWardrobeImageUri(coerced);
    if (!uri) return coerced;
    return {
      ...coerced,
      imageUri: uri,
      enhancedImageUri: coerced.enhancedImageUri || uri,
      imageProcessed: true,
    };
  }
  return enrichWardrobeItemForDisplay(coerced);
}

export function resolveWardrobeFallbackUri(
  item: Pick<WardrobeItem, 'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed'>,
  primaryUri: string,
): string | undefined {
  const primaryIsProcessed =
    itemHasProcessedCutout(item) || isProxyWardrobeImageUri(primaryUri);

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
  item: Pick<WardrobeItem, 'imageProcessed' | 'aiAnalyzed' | 'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri'>,
  usingFallback: boolean,
  preferCover = false,
): 'contain' | 'cover' {
  if (itemHasProcessedCutout(item as ImageFields)) return 'contain';
  if (preferCover || usingFallback) return 'cover';
  return 'cover';
}

/** Prefer on-device photos for chat/outfit visuals when available. */
/** Resolve YOURS / duplicate-sheet thumbnails through the standard wardrobe image pipeline. */
export function resolveDuplicateMatchImageUri(
  match: GarmentImageFields & { imageUrl?: string | null },
): string | undefined {
  const coerced: ImageFields = {
    id: match.id,
    imageUri: trimUri(match.imageUri) || trimUri(match.imageUrl),
    enhancedImageUri: match.enhancedImageUri,
    originalImageUri: match.originalImageUri,
    imageProcessed: match.imageProcessed,
    aiAnalyzed: match.aiAnalyzed,
  };
  const enriched = enrichWardrobeItemForDisplay(coerced);
  const uri = resolveWardrobeImageUri(enriched);
  return uri || undefined;
}

export function enrichWardrobeItemForDisplay(item: ImageFields): ImageFields {
  const coerced = coerceWardrobeDisplayImages(item);
  if (itemHasProcessedCutout(coerced)) {
    const uri = resolveWardrobeImageUri(coerced);
    if (!uri) return coerced;
    return {
      ...coerced,
      imageUri: uri,
      enhancedImageUri: coerced.enhancedImageUri || uri,
      imageProcessed: true,
    };
  }

  const localUri = listWardrobeImageUris(coerced).find((uri) => !isRemoteImageUri(uri));
  if (localUri) {
    return {
      ...coerced,
      imageUri: localUri,
      enhancedImageUri: coerced.enhancedImageUri && !isProxyWardrobeImageUri(coerced.enhancedImageUri)
        ? coerced.enhancedImageUri
        : localUri,
      imageProcessed: false,
    };
  }

  const uri = resolveWardrobeImageUri(coerced);
  if (!uri) return coerced;
  if (coerced.imageUri === uri && coerced.enhancedImageUri) return coerced;
  return {
    ...coerced,
    imageUri: uri,
    enhancedImageUri: coerced.enhancedImageUri || uri,
    imageProcessed: coerced.imageProcessed,
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
