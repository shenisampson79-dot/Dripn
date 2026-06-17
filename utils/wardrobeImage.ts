import { API_URL } from '@/config/api';
import type { WardrobeItem } from '@/contexts/WardrobeContext';

const HTTP_PREFIX = /^https?:\/\//i;

export function isRemoteImageUri(uri?: string | null): uri is string {
  return typeof uri === 'string' && HTTP_PREFIX.test(uri);
}

export function isProxyWardrobeImageUri(uri?: string | null): boolean {
  return typeof uri === 'string' && uri.includes('/api/wardrobe/') && uri.endsWith('/image');
}

export function buildWardrobeImageProxyUrl(itemId: string | number): string {
  return `${API_URL}/api/wardrobe/${itemId}/image`;
}

type ImageFields = Pick<
  WardrobeItem,
  'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
>;

export function resolveWardrobeImageUri(item: ImageFields): string {
  const candidates = [
    item.enhancedImageUri,
    item.imageUri,
    item.originalImageUri,
  ].filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);

  const remote = candidates.find(isRemoteImageUri);
  if (remote) return remote;

  if (candidates[0]) return candidates[0];

  if (item.id && item.imageProcessed) {
    return buildWardrobeImageProxyUrl(item.id);
  }

  return '';
}

export function resolveWardrobeFallbackUri(
  item: Pick<WardrobeItem, 'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri'>,
  primaryUri: string,
): string | undefined {
  const fallbacks = [item.originalImageUri, item.imageUri, item.enhancedImageUri].filter(
    (uri): uri is string => typeof uri === 'string' && uri.length > 0 && uri !== primaryUri,
  );
  if (fallbacks[0]) return fallbacks[0];
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
  if (preferCover || usingFallback) return 'cover';
  return item.imageProcessed || item.aiAnalyzed ? 'contain' : 'cover';
}

export function wardrobeImageBackground(
  isDark: boolean,
  item: Pick<WardrobeItem, 'imageProcessed' | 'aiAnalyzed' | 'imageUri'>,
  uri?: string,
): string | undefined {
  const activeUri = uri || item.imageUri || '';
  const showProcessedBg =
    item.imageProcessed ||
    item.aiAnalyzed ||
    isProxyWardrobeImageUri(activeUri);

  if (!showProcessedBg) return undefined;
  return isDark ? '#2C2C2E' : '#EBEBEF';
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
    row.processedImageUrl ||
    row.processed_image_url ||
    row.imageUrl ||
    row.image_url ||
    row.backgroundRemoved ||
    row.background_removed
  );
}
