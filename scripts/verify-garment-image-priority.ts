/**
 * Invariant checks for garment image priority.
 * Run: npx tsx scripts/verify-garment-image-priority.ts
 */
import assert from 'node:assert/strict';

import {
  assignLocalOriginalOnly,
  buildWardrobeImageCacheEntryFromItem,
  coerceWardrobeDisplayImages,
  isFalselyMarkedProcessed,
  itemHasProcessedCutout,
  mergeMappedItemWithImageCache,
  resolveWardrobeImageUri,
} from '../utils/wardrobeImage';

const carpet = 'file:///data/wardrobe/tee-original.jpg';
const cutout = 'https://res.cloudinary.com/demo/image/upload/v1/tee_processed.png';

function base(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    imageUri: carpet,
    enhancedImageUri: carpet,
    originalImageUri: carpet,
    imageProcessed: false,
    ...overrides,
  } as any;
}

// 1) Verified cutout always wins over local carpet
{
  const item = base({
    imageUri: carpet,
    enhancedImageUri: cutout,
    imageProcessed: true,
  });
  assert.equal(resolveWardrobeImageUri(item), cutout);
  assert.equal(itemHasProcessedCutout(item), true);
}

// 2) Poisoned flag: processed=true but display === original local
{
  const item = base({ imageProcessed: true });
  assert.equal(isFalselyMarkedProcessed(item), true);
  assert.equal(itemHasProcessedCutout(item), false);
  const coerced = coerceWardrobeDisplayImages(item);
  assert.equal(coerced.imageProcessed, false);
  assert.equal(resolveWardrobeImageUri(coerced), carpet);
}

// 3) Hydration must not overwrite cutout with local original
{
  const item = base({
    imageUri: cutout,
    enhancedImageUri: cutout,
    imageProcessed: true,
  });
  const hydrated = assignLocalOriginalOnly(item, carpet);
  assert.equal(hydrated.imageUri, cutout);
  assert.equal(hydrated.enhancedImageUri, cutout);
  assert.equal(hydrated.originalImageUri, carpet);
}

// 4) Unprocessed local still uses carpet
{
  const item = base();
  assert.equal(resolveWardrobeImageUri(item), carpet);
  assert.equal(itemHasProcessedCutout(item), false);
}

// 5) Processed with no local display URIs → proxy (not falsely marked)
{
  const item = base({
    imageUri: '',
    enhancedImageUri: '',
    originalImageUri: '',
    imageProcessed: true,
  });
  assert.equal(isFalselyMarkedProcessed(item), false);
  assert.equal(itemHasProcessedCutout(item), true);
  assert.ok(resolveWardrobeImageUri(item).includes('/api/wardrobe/item-1/image'));
}

// 6) CLIENT_SELECTS_ORIGINAL: stale local cache must not override durable server cutout
{
  const mapped = base({
    imageUri: cutout,
    enhancedImageUri: cutout,
    imageProcessed: true,
  });
  const cacheEntry = {
    imageUri: carpet,
    enhancedImageUri: carpet,
    originalImageUri: carpet,
    imageProcessed: true,
  };
  const merged = mergeMappedItemWithImageCache(mapped, cacheEntry, { serverProcessed: true });
  assert.equal(resolveWardrobeImageUri(merged), cutout);
  assert.equal(merged.originalImageUri, carpet);

  const cached = buildWardrobeImageCacheEntryFromItem(mapped, cacheEntry);
  assert.equal(cached.imageUri, cutout);
  assert.equal(cached.originalImageUri, carpet);
  assert.equal(cached.imageProcessed, true);
}

// 7) Flicker guard: re-hydrate after cache write must not revert cutout to carpet
{
  const mapped = base({
    imageUri: cutout,
    enhancedImageUri: cutout,
    imageProcessed: true,
  });
  const staleCache = {
    imageUri: carpet,
    enhancedImageUri: carpet,
    originalImageUri: carpet,
    imageProcessed: true,
  };
  const first = mergeMappedItemWithImageCache(mapped, staleCache, { serverProcessed: true });
  assert.equal(resolveWardrobeImageUri(first), cutout);
  const reCached = buildWardrobeImageCacheEntryFromItem(first, staleCache);
  const second = mergeMappedItemWithImageCache(mapped, reCached, { serverProcessed: true });
  assert.equal(resolveWardrobeImageUri(second), cutout);
  assert.equal(second.originalImageUri, carpet);
}

console.log('verify-garment-image-priority: ok');
