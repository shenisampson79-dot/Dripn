import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { loadWardrobeImageForItem } from '@/utils/wardrobeImageLoader';

const DEFAULT_HIGH_PRIORITY = 6;

export async function preloadWardrobeImages(
  items: Pick<
    WardrobeItem,
    'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed'
  >[],
  options?: { highPriorityCount?: number },
): Promise<void> {
  if (!items.length) return;

  const highPriorityCount = options?.highPriorityCount ?? DEFAULT_HIGH_PRIORITY;
  const highPriority = items.slice(0, highPriorityCount);
  const rest = items.slice(highPriorityCount);

  await Promise.allSettled(highPriority.map((item) => loadWardrobeImageForItem(item)));

  if (rest.length) {
    Promise.allSettled(rest.map((item) => loadWardrobeImageForItem(item))).catch(() => {});
  }
}
