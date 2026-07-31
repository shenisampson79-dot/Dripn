/**
 * Live / garment display localization.
 * Internal subtype stays sneakers|boots|sandals; UI label follows locale.
 */

export type LiveLocale = 'UK' | 'US';

/** Product default — England / UK English. */
export const LIVE_LOCALE: LiveLocale = 'UK';

const SHOE_LABELS: Record<string, Record<LiveLocale, string>> = {
  sneakers: { UK: 'trainers', US: 'sneakers' },
  trainers: { UK: 'trainers', US: 'sneakers' },
  shoes: { UK: 'trainers', US: 'shoes' },
  boots: { UK: 'boots', US: 'boots' },
  sandals: { UK: 'sandals', US: 'sandals' },
};

export function localizedShoeKind(
  subtype: string,
  locale: LiveLocale = LIVE_LOCALE,
): string {
  const key = String(subtype || 'sneakers').toLowerCase();
  return SHOE_LABELS[key]?.[locale] || SHOE_LABELS.sneakers[locale];
}
