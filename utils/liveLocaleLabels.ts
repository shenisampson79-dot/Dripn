/**
 * Live / garment display localization.
 * Internal subtype stays fine-grained (sneakers|boots|sandals|flip_flops|slides).
 * Canonical families (for rules) live in footwearLayers.ts — never use those as UI labels.
 * Product default: England / UK English (trousers, trainers, grey).
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

/**
 * Polish Vision/US garment labels for UK Live UI.
 * Keeps sweatpants/joggers intact — only remaps bare "pants" and sneakers/gray.
 */
export function polishUkLiveLabel(raw?: string | null, locale: LiveLocale = LIVE_LOCALE): string {
  const input = String(raw || '').trim();
  if (!input || locale !== 'UK') return input;

  let out = input;

  // Colour spelling
  out = out.replace(/\bGray\b/g, 'Grey').replace(/\bgray\b/g, 'grey');

  // Footwear: sneakers → trainers (keep boat shoes / casual shoes phrasing)
  out = out
    .replace(/\bSneakers\b/g, 'Trainers')
    .replace(/\bsneakers\b/g, 'trainers')
    .replace(/\bSneaker\b/g, 'Trainer')
    .replace(/\bsneaker\b/g, 'trainer');

  // Bottoms: "pants" → "trousers" but never sweatpants / track pants / yoga pants
  out = out.replace(/\bPants\b/g, (match, offset, full) => {
    const before = String(full).slice(Math.max(0, offset - 12), offset).toLowerCase();
    if (/sweat|track|yoga|pajama|pyjama|capri/.test(before)) return match;
    return 'Trousers';
  });
  out = out.replace(/\bpants\b/g, (match, offset, full) => {
    const before = String(full).slice(Math.max(0, offset - 12), offset).toLowerCase();
    if (/sweat|track|yoga|pajama|pyjama|capri/.test(before)) return match;
    return 'trousers';
  });

  // "Casual shoes" soft remap when clearly athletic-ish — leave boat/deck alone
  // (no-op: keep as-is unless sneakers already handled)

  return out;
}

/** Polish coaching summary / headline / bullets for UK Live. */
export function polishUkCoaching<T extends {
  summary?: string;
  headline?: string;
  bullets?: string[];
}>(coaching: T | null | undefined, locale: LiveLocale = LIVE_LOCALE): T | null | undefined {
  if (!coaching || locale !== 'UK') return coaching;
  return {
    ...coaching,
    ...(coaching.summary != null ? { summary: polishUkLiveLabel(coaching.summary, locale) } : {}),
    ...(coaching.headline != null ? { headline: polishUkLiveLabel(coaching.headline, locale) } : {}),
    ...(Array.isArray(coaching.bullets)
      ? { bullets: coaching.bullets.map((b) => polishUkLiveLabel(b, locale)) }
      : {}),
  };
}
