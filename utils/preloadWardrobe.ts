import { InteractionManager } from 'react-native';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { loadWardrobeImageForItem } from '@/utils/wardrobeImageLoader';

const DEFAULT_HIGH_PRIORITY = 4;
/** Hard cap: never stampede every wardrobe photo on cold start (iOS jetsam). */
const DEFAULT_MAX_TOTAL = 10;
const MAX_CONCURRENCY = 2;

type WardrobeImageItem = Pick<
  WardrobeItem,
  'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed'
>;

async function mapWithConcurrency(
  items: WardrobeImageItem[],
  concurrency: number,
  fn: (item: WardrobeImageItem) => Promise<unknown>,
): Promise<void> {
  if (!items.length) return;
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        await fn(items[index]);
      } catch {
        // Individual image failures must never abort the pool.
      }
    }
  });
  await Promise.all(workers);
}

function deferUntilIdle(ms: number): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

/**
 * Warm a small number of wardrobe images with low concurrency.
 * Full-wardrobe parallel preload caused iOS memory kills shortly after launch.
 */
export async function preloadWardrobeImages(
  items: WardrobeImageItem[],
  options?: { highPriorityCount?: number; maxTotal?: number; deferRestMs?: number },
): Promise<void> {
  if (!items.length) return;

  const highPriorityCount = options?.highPriorityCount ?? DEFAULT_HIGH_PRIORITY;
  const maxTotal = options?.maxTotal ?? DEFAULT_MAX_TOTAL;
  const deferRestMs = options?.deferRestMs ?? 2500;
  const limited = items.slice(0, Math.max(0, maxTotal));
  if (!limited.length) return;

  const highPriority = limited.slice(0, highPriorityCount);
  const rest = limited.slice(highPriorityCount);

  await mapWithConcurrency(highPriority, MAX_CONCURRENCY, loadWardrobeImageForItem);

  if (!rest.length) return;

  // Let Today's outfit / hub paint settle before more disk/network image work.
  await deferUntilIdle(deferRestMs);
  await mapWithConcurrency(rest, MAX_CONCURRENCY, loadWardrobeImageForItem);
}
