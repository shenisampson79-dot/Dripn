/**
 * Live / garment display localization.
 * Internal subtype stays fine-grained (sneakers|boots|sandals|flip_flops|slides).
 * Canonical families (for rules) live in footwearLayers.ts — never use those as UI labels.
 */

export type LiveLocale = 'UK' | 'US';

/** Product default — England / UK English. */
export const LIVE_LOCALE: LiveLocale = 'UK';

const SHOE_LABELS: Record<string, Record<LiveLocale, string>> = {
  sneakers: { UK: 'trainers', US: 'sneakers' },
  trainers: { UK: 'trainers', US: 'sneakers' },
  shoes: { UK: 'trainers', US: 'shoes' },
  boots: { UK: 'boots', US: 'boots' },
  boat_shoes: { UK: 'boat shoes', US: 'boat shoes' },
  sandals: { UK: 'sandals', US: 'sandals' },
  flip_flops: { UK: 'flip-flops', US: 'flip-flops' },
  slides: { UK: 'slides', US: 'slides' },
};

export function localizedShoeKind(
  subtype: string,
  locale: LiveLocale = LIVE_LOCALE,
): string {
  const key = String(subtype || 'sneakers').toLowerCase();
  return SHOE_LABELS[key]?.[locale] || SHOE_LABELS.sneakers[locale];
}
