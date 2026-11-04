/**
 * Live / garment display localization.
 * Internal subtype stays fine-grained (sneakers|boots|sandals|flip_flops|slides).
 * Canonical families (for rules) live in footwearLayers.ts — never use those as UI labels.
 * Product default: England / UK English (trousers, trainers, grey).
 *
 * Locale order (display only; never scoring / Vision / canonical identity):
 * 1. User country / countryCode / actualCountry / locale from profile
 * 2. Device language tags (en-GB, en-US, …)
 * 3. Documented fallback: UK
 */

export type LiveLocale = 'UK' | 'US';

/** Product default — England / UK English. */
export const LIVE_LOCALE: LiveLocale = 'UK';

const UK_COUNTRY = new Set([
  'GB', 'UK', 'IE', 'NZ', 'AU', 'EU',
  'UNITED KINGDOM', 'GREAT BRITAIN', 'ENGLAND', 'SCOTLAND', 'WALES',
  'IRELAND', 'AUSTRALIA', 'NEW ZEALAND',
]);
const US_COUNTRY = new Set([
  'US', 'USA', 'CA', 'UNITED STATES', 'UNITED STATES OF AMERICA', 'CANADA',
]);

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

function countryToLiveLocale(raw?: string | null): LiveLocale | null {
  const key = String(raw || '').trim().toUpperCase().replace(/[_-]+/g, ' ');
  if (!key) return null;
  const iso = key.length === 2 ? key : key.replace(/^EN /, '');
  if (UK_COUNTRY.has(key) || UK_COUNTRY.has(iso)) return 'UK';
  if (US_COUNTRY.has(key) || US_COUNTRY.has(iso)) return 'US';
  return null;
}

function languageTagToLiveLocale(tag?: string | null): LiveLocale | null {
  const t = String(tag || '').trim().toLowerCase().replace(/_/g, '-');
  if (!t) return null;
  if (/^en-gb\b|^en-ie\b|^en-nz\b|^en-au\b/.test(t)) return 'UK';
  if (/^en-us\b|^en-ca\b/.test(t)) return 'US';
  const region = t.split('-')[1]?.toUpperCase();
  if (region) return countryToLiveLocale(region);
  return null;
}

/**
 * Display-locale resolver. Does not read religion, ethnicity, or appearance.
 */
export function resolveLiveDisplayLocale(signals: {
  country?: string | null;
  countryCode?: string | null;
  actualCountry?: string | null;
  locale?: string | null;
  deviceLanguageTags?: string[] | null;
} = {}): LiveLocale {
  const fromProfile = countryToLiveLocale(signals.locale)
    || countryToLiveLocale(signals.countryCode)
    || countryToLiveLocale(signals.actualCountry)
    || countryToLiveLocale(signals.country);
  if (fromProfile) return fromProfile;

  const tags = Array.isArray(signals.deviceLanguageTags) ? signals.deviceLanguageTags : [];
  for (const tag of tags) {
    const mapped = languageTagToLiveLocale(tag);
    if (mapped) return mapped;
  }
  return LIVE_LOCALE;
}

function swapCase(match: string, preferred: string): string {
  if (!preferred) return match;
  if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
    return preferred.charAt(0).toUpperCase() + preferred.slice(1);
  }
  return preferred;
}

/**
 * Polish Vision/US garment labels for UK Live UI.
 * Keeps sweatpants/joggers/sweatshirt intact. Never maps quilted vest/gilet to waistcoat.
 */
export function polishUkLiveLabel(raw?: string | null, locale: LiveLocale = LIVE_LOCALE): string {
  const input = String(raw || '').trim();
  if (!input || locale !== 'UK') return input;

  let out = input;

  out = out.replace(/\bGray\b/g, 'Grey').replace(/\bgray\b/g, 'grey');

  out = out
    .replace(/\bSneakers\b/g, 'Trainers')
    .replace(/\bsneakers\b/g, 'trainers')
    .replace(/\bSneaker\b/g, 'Trainer')
    .replace(/\bsneaker\b/g, 'trainer');

  out = out.replace(/\bflip[\s-]?flops?\b/gi, 'flip-flops');

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

  out = out.replace(/\bSweaters?\b/g, (match, offset, full) => {
    const slice = String(full).slice(offset, offset + match.length + 8).toLowerCase();
    if (/^sweatshirt/.test(slice) || /^sweater\s+vest/.test(slice)) return match;
    return swapCase(match, /s$/i.test(match) ? 'jumpers' : 'jumper');
  });
  out = out.replace(/\bsweaters?\b/g, (match, offset, full) => {
    const slice = String(full).slice(offset, offset + match.length + 8).toLowerCase();
    if (/^sweatshirt/.test(slice) || /^sweater\s+vest/.test(slice)) return match;
    return /s$/i.test(match) ? 'jumpers' : 'jumper';
  });

  out = out.replace(/\bDenim\s+Overalls\b/g, 'Denim Dungarees');
  out = out.replace(/\bdenim\s+overalls\b/g, 'denim dungarees');
  out = out.replace(/\bBib\s+Overalls\b/g, 'Bib Dungarees');
  out = out.replace(/\bbib\s+overalls\b/g, 'bib dungarees');
  out = out.replace(/\bOveralls\b/g, (match, offset, full) => {
    const before = String(full).slice(Math.max(0, offset - 16), offset).toLowerCase();
    if (/denim|bib/.test(before)) return 'Dungarees';
    return match;
  });
  out = out.replace(/\boveralls\b/g, (match, offset, full) => {
    const before = String(full).slice(Math.max(0, offset - 16), offset).toLowerCase();
    if (/denim|bib/.test(before)) return 'dungarees';
    return match;
  });

  out = out.replace(/\bVests?\b/g, (match, offset, full) => {
    const window = `${String(full).slice(Math.max(0, offset - 28), offset)} ${String(full).slice(offset, offset + match.length + 10)}`.toLowerCase();
    if (/quilt|gilet|puffer|down|fleece|padded|knit|sweater/.test(window)) return match;
    if (/\b(suit|tailored|dress|formal)\b/.test(window)) {
      return swapCase(match, /s$/i.test(match) ? 'waistcoats' : 'waistcoat');
    }
    return match;
  });
  out = out.replace(/\bvests?\b/g, (match, offset, full) => {
    const window = `${String(full).slice(Math.max(0, offset - 28), offset)} ${String(full).slice(offset, offset + match.length + 10)}`.toLowerCase();
    if (/quilt|gilet|puffer|down|fleece|padded|knit|sweater/.test(window)) return match;
    if (/\b(suit|tailored|dress|formal)\b/.test(window)) {
      return /s$/i.test(match) ? 'waistcoats' : 'waistcoat';
    }
    return match;
  });

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

export function polishLiveFeedback<T extends {
  coaching?: {
    summary?: string;
    headline?: string;
    bullets?: string[];
    [key: string]: unknown;
  } | null;
  issues?: string[];
  hints?: string[];
  suggestions?: string[];
  [key: string]: unknown;
}>(feedback: T | null | undefined, locale: LiveLocale = LIVE_LOCALE): T | null | undefined {
  if (!feedback || locale !== 'UK') return feedback;
  return {
    ...feedback,
    ...(feedback.coaching ? { coaching: polishUkCoaching(feedback.coaching, locale) } : {}),
    ...(Array.isArray(feedback.issues)
      ? { issues: feedback.issues.map((s) => polishUkLiveLabel(s, locale)) }
      : {}),
    ...(Array.isArray(feedback.hints)
      ? { hints: feedback.hints.map((s) => polishUkLiveLabel(s, locale)) }
      : {}),
    ...(Array.isArray(feedback.suggestions)
      ? { suggestions: feedback.suggestions.map((s) => polishUkLiveLabel(s, locale)) }
      : {}),
  };
}

export function polishLiveHudItems<T extends {
  name?: string | null;
  displayName?: string | null;
}>(
  items: T[] | null | undefined,
  locale: LiveLocale = LIVE_LOCALE,
): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const raw = item.displayName || item.name;
    const name = polishUkLiveLabel(raw, locale);
    if (name === item.name) return item;
    return { ...item, name };
  });
}
