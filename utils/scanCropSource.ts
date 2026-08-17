/**
 * Pure helpers for GON scan-crop → outfit-list hydration.
 * Kept free of expo-file-system / RN so Node regression tests can import them.
 */

export function safeFileId(id: string): string {
  return String(id || 'item').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export function stripDataUri(input: string): string {
  const raw = String(input || '').trim();
  const idx = raw.indexOf('base64,');
  return idx >= 0 ? raw.slice(idx + 'base64,'.length) : raw;
}

/**
 * Decide whether an outfit-list row still needs a data: crop materialized to disk.
 * Returns the data: source to persist, or null if the row already has a loader-safe URI.
 */
export function resolveScanCropDataSource(
  item: {
    id: string | number;
    imageUri?: string | null;
    enhancedImageUri?: string | null;
  },
  cropById?: Record<string, string>,
): string | null {
  const id = String(item.id);
  const existing = item.enhancedImageUri || item.imageUri || '';
  if (existing && !existing.startsWith('data:')) return null;
  if (existing.startsWith('data:')) return existing;
  const crop = cropById?.[id];
  if (!crop) return null;
  return crop.startsWith('data:') ? crop : `data:image/jpeg;base64,${crop}`;
}
