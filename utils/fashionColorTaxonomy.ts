/**
 * Fashion-aware colour language.
 *
 * RAW label → BASE colour → FASHION category (+ brightness / temperature)
 *
 * Detection stays responsible for "what colour is this pixel cluster?".
 * This module turns that into stable, human-meaningful fashion semantics
 * for scoring, advice, and debug — without inventing teal/cyan as bases.
 */

/** Tight, stable foundation — no teal/cyan/mauve here. */
export const BASE_COLORS = [
  'black',
  'white',
  'grey',
  'brown',
  'blue',
  'green',
  'red',
  'pink',
  'purple',
  'yellow',
  'orange',
] as const;

export type BaseColor = (typeof BASE_COLORS)[number];

/** Scoring / style layer. */
export type FashionColorCategory = 'neutral' | 'pastel' | 'bold' | 'dark' | 'earth';

export type ColorBrightness = 'light' | 'medium' | 'dark';
export type ColorTemperature = 'warm' | 'cool' | 'neutral';

/** Compatible with outfitColorHarmony.ColorGroup — kept local to avoid import cycles. */
export type HarmonyBridgeGroup =
  | 'neutral'
  | 'earth'
  | 'cool'
  | 'warm'
  | 'soft'
  | 'loud'
  | 'unknown';

export type FashionColorProfile = {
  raw: string | null;
  base: BaseColor | null;
  category: FashionColorCategory | 'unknown';
  brightness: ColorBrightness | 'unknown';
  temperature: ColorTemperature;
};

/** Raw / alias → base colour. Teal/cyan always → blue. */
const TO_BASE: Record<string, BaseColor> = {
  black: 'black',
  charcoal: 'black',
  graphite: 'black',
  white: 'white',
  ivory: 'white',
  cream: 'white',
  gray: 'grey',
  grey: 'grey',
  light_gray: 'grey',
  light_grey: 'grey',
  silver: 'grey',
  slate: 'grey',
  ash: 'grey',
  brown: 'brown',
  tan: 'brown',
  camel: 'brown',
  taupe: 'brown',
  chocolate: 'brown',
  mocha: 'brown',
  espresso: 'brown',
  beige: 'brown',
  khaki: 'brown',
  sand: 'brown',
  nude: 'brown',
  blue: 'blue',
  navy: 'blue',
  teal: 'blue',
  cyan: 'blue',
  turquoise: 'blue',
  aqua: 'blue',
  cobalt: 'blue',
  indigo: 'blue',
  sapphire: 'blue',
  denim: 'blue',
  green: 'green',
  olive: 'green',
  mint: 'green',
  sage: 'green',
  forest: 'green',
  emerald: 'green',
  lime: 'green',
  red: 'red',
  burgundy: 'red',
  maroon: 'red',
  wine: 'red',
  rust: 'red',
  coral: 'orange',
  pink: 'pink',
  rose: 'pink',
  blush: 'pink',
  magenta: 'pink',
  fuchsia: 'pink',
  mauve: 'purple',
  purple: 'purple',
  lavender: 'purple',
  violet: 'purple',
  plum: 'purple',
  yellow: 'yellow',
  mustard: 'yellow',
  gold: 'yellow',
  lemon: 'yellow',
  amber: 'yellow',
  orange: 'orange',
  peach: 'orange',
  apricot: 'orange',
  terracotta: 'orange',
};

const PASTEL_RAW = new Set([
  'mint', 'lavender', 'peach', 'blush', 'rose', 'mauve',
  'baby_pink', 'baby_blue', 'powder_blue', 'light_pink', 'light_blue', 'sage',
]);

const EARTH_RAW = new Set([
  'olive', 'rust', 'mustard', 'tan', 'camel', 'khaki',
  'sand', 'terracotta', 'brown', 'chocolate', 'mocha',
]);

const DARK_RAW = new Set([
  'black', 'charcoal', 'navy', 'burgundy', 'maroon', 'wine', 'espresso',
  'forest', 'graphite', 'indigo',
]);

const NEUTRAL_RAW = new Set([
  'white', 'cream', 'ivory', 'beige', 'gray', 'grey', 'light_gray', 'light_grey',
  'silver', 'taupe', 'ash', 'slate',
]);

const BOLD_RAW = new Set([
  'red', 'orange', 'yellow', 'hot_pink', 'magenta', 'fuchsia', 'lime',
  'neon', 'cobalt', 'royal', 'coral',
]);

const COOL_BASE = new Set<BaseColor>(['blue', 'green', 'purple', 'grey']);
const WARM_BASE = new Set<BaseColor>(['red', 'orange', 'yellow', 'brown', 'pink']);

function canon(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Map any detection label to a stable base colour.
 * Teal / cyan / turquoise → blue (users expect "blue top").
 */
export function toBaseColor(raw?: string | null): BaseColor | null {
  const c = canon(raw);
  if (!c || c === 'other' || c === 'unknown' || c === 'dark') {
    return c === 'dark' ? 'black' : null;
  }
  if (TO_BASE[c]) return TO_BASE[c];
  // Phrase fragments: "light blue", "hot pink", "royal blue"
  for (const [key, base] of Object.entries(TO_BASE)) {
    if (c.includes(key)) return base;
  }
  return null;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/** Hue-bucket base when RGB is available (teal band → blue). */
export function baseColorFromHue(h: number, s: number, l: number): BaseColor | null {
  if (s < 0.12) {
    if (l < 0.18) return 'black';
    if (l > 0.85) return 'white';
    return 'grey';
  }
  if (l < 0.12) return 'black';
  if (l > 0.92 && s < 0.25) return 'white';
  // teal / cyan → blue (140–260)
  if (h >= 140 && h <= 260) return 'blue';
  if (h >= 60 && h < 140) return 'green';
  if (h >= 260 && h < 320) return 'purple';
  if (h >= 320 || h < 15) return 'red';
  if (h >= 15 && h < 40) return 'orange';
  if (h >= 40 && h < 60) return 'yellow';
  return null;
}

function brightnessFromRaw(c: string, base: BaseColor | null): ColorBrightness | 'unknown' {
  if (/light_|baby_|powder_|pale_/.test(c) || c === 'cream' || c === 'ivory' || c === 'white') {
    return 'light';
  }
  if (DARK_RAW.has(c) || base === 'black') return 'dark';
  if (c === 'navy' || c === 'burgundy' || c === 'charcoal') return 'dark';
  if (base === 'white' || base === 'yellow' || c === 'beige' || c === 'peach') return 'light';
  if (base) return 'medium';
  return 'unknown';
}

function brightnessFromHsl(l: number): ColorBrightness {
  if (l >= 0.72) return 'light';
  if (l <= 0.28) return 'dark';
  return 'medium';
}

function temperatureOf(base: BaseColor | null, c: string): ColorTemperature {
  if (c === 'grey' || c === 'gray' || c === 'black' || c === 'white' || c === 'silver') {
    return 'neutral';
  }
  if (!base) return 'neutral';
  if (COOL_BASE.has(base)) return 'cool';
  if (WARM_BASE.has(base)) return 'warm';
  return 'neutral';
}

function categoryFromSignals(args: {
  raw: string;
  base: BaseColor | null;
  brightness: ColorBrightness | 'unknown';
  saturation?: number;
}): FashionColorCategory | 'unknown' {
  const { raw, base, brightness, saturation } = args;
  if (!base && !raw) return 'unknown';

  // Explicit pastel names / soft light chromatic
  if (PASTEL_RAW.has(raw) || (brightness === 'light' && saturation != null && saturation < 0.45 && saturation > 0.12)) {
    if (base && base !== 'black' && base !== 'white' && base !== 'grey') return 'pastel';
    if (PASTEL_RAW.has(raw)) return 'pastel';
  }

  // Earth before generic brown — but beige/taupe stay neutral
  if (NEUTRAL_RAW.has(raw) || base === 'white' || base === 'grey') {
    return 'neutral';
  }

  if (EARTH_RAW.has(raw) || (base === 'brown' && !NEUTRAL_RAW.has(raw))) {
    return 'earth';
  }
  if (base === 'green' && (raw === 'olive' || raw === 'khaki')) return 'earth';
  if (base === 'yellow' && raw === 'mustard') return 'earth';

  // Deep tones
  if (DARK_RAW.has(raw) || (brightness === 'dark' && (base === 'black' || base === 'blue' || base === 'red' || base === 'green'))) {
    return 'dark';
  }

  // High-impact
  if (BOLD_RAW.has(raw) || (saturation != null && saturation >= 0.55 && brightness !== 'dark')) {
    return 'bold';
  }
  if (base && ['red', 'orange', 'yellow', 'pink', 'blue', 'green', 'purple'].includes(base)) {
    if (brightness === 'light') return 'pastel';
    return 'bold';
  }

  if (base === 'black') return 'dark';
  return 'unknown';
}

/**
 * Full fashion profile from a detection colour label (and optional RGB).
 */
export function classifyFashionColor(
  raw?: string | null,
  rgb?: { r: number; g: number; b: number } | null,
): FashionColorProfile {
  const c = canon(raw);
  let base = toBaseColor(c);
  let saturation: number | undefined;
  let brightness: ColorBrightness | 'unknown' = brightnessFromRaw(c, base);

  if (rgb) {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    saturation = hsl.s;
    brightness = brightnessFromHsl(hsl.l);
    if (!base) base = baseColorFromHue(hsl.h, hsl.s, hsl.l);
    // Prefer hue-bucket for teal band even if raw said "other"
    if (!c || c === 'other' || c === 'unknown') {
      base = baseColorFromHue(hsl.h, hsl.s, hsl.l);
    }
  }

  const category = categoryFromSignals({ raw: c, base, brightness, saturation });
  return {
    raw: c || null,
    base,
    category,
    brightness,
    temperature: temperatureOf(base, c),
  };
}

/** Bridge to existing outfitColorHarmony ColorGroup vocabulary. */
export function fashionCategoryToHarmonyGroup(
  profile: FashionColorProfile,
): HarmonyBridgeGroup {
  switch (profile.category) {
    case 'neutral':
      return 'neutral';
    case 'earth':
      return 'earth';
    case 'pastel':
      return 'soft';
    case 'bold':
      return profile.temperature === 'warm' ? 'warm' : 'loud';
    case 'dark':
      return profile.base === 'blue' || profile.base === 'green' || profile.base === 'purple'
        ? 'cool'
        : 'neutral';
    default:
      return 'unknown';
  }
}

/** Compact debug line for Live DBG overlay. */
export function formatColorPipelineDebug(
  profile: FashionColorProfile,
  opts?: { accepted?: boolean; reason?: string; fallback?: string | null },
): string {
  const raw = profile.raw || 'none';
  const base = profile.base || '—';
  const cat = profile.category;
  if (opts?.accepted === false) {
    return `Raw: ${raw} → ${base}/${cat} ✗ ${opts.reason || 'rejected'}${
      opts.fallback ? ` → keep ${opts.fallback}` : ''
    }`;
  }
  return `Raw: ${raw} → ${base} · ${cat} · ${profile.temperature}`;
}

/**
 * Pairwise harmony hint for scoring (neutral+bold = balanced, bold+bold = risky).
 * Returns adjustment in roughly −15…+15.
 */
export function fashionCategoryHarmonyAdjustment(
  a: FashionColorCategory | 'unknown',
  b: FashionColorCategory | 'unknown',
): number {
  if (a === 'unknown' || b === 'unknown') return 0;
  const key = [a, b].sort().join('|');
  const table: Record<string, number> = {
    'neutral|neutral': 10,
    'bold|neutral': 12,
    'dark|neutral': 10,
    'bold|dark': 12,
    'earth|neutral': 11,
    'neutral|pastel': 10,
    'earth|earth': 9,
    'pastel|pastel': 9,
    'dark|dark': 6,
    'bold|earth': 3,
    'bold|pastel': 2,
    'bold|bold': -6,
    'dark|pastel': 5,
    'earth|pastel': 7,
    'dark|earth': 8,
  };
  return table[key] ?? 0;
}

export type FashionPaletteScore = {
  categories: Array<FashionColorCategory | 'unknown'>;
  bases: Array<BaseColor | null>;
  /** Additive points for 0–100 harmony score (clamped by caller). */
  adjustment: number;
  /** Average pairwise category fit −1…1 normalised. */
  pairFit: number;
  summary: string | null;
};

/**
 * Score an outfit palette via fashion categories.
 * Used by colour harmony + unified scoring.
 */
export function scoreFashionPalette(
  items: Array<{ color?: string | null }>,
): FashionPaletteScore {
  const profiles = items
    .map((i) => classifyFashionColor(i.color))
    .filter((p) => p.base || (p.category !== 'unknown'));

  const categories = profiles.map((p) => p.category);
  const bases = profiles.map((p) => p.base);

  if (categories.length < 2) {
    return {
      categories,
      bases,
      adjustment: 0,
      pairFit: 0.5,
      summary: null,
    };
  }

  let sum = 0;
  let pairs = 0;
  let boldBold = 0;
  let hasNeutral = false;
  let hasBold = false;
  for (let i = 0; i < categories.length; i++) {
    if (categories[i] === 'neutral' || categories[i] === 'dark') hasNeutral = true;
    if (categories[i] === 'bold') hasBold = true;
    for (let j = i + 1; j < categories.length; j++) {
      const adj = fashionCategoryHarmonyAdjustment(categories[i], categories[j]);
      sum += adj;
      pairs += 1;
      if (categories[i] === 'bold' && categories[j] === 'bold') boldBold += 1;
    }
  }

  const avg = pairs > 0 ? sum / pairs : 0;
  // Map typical avg (−6…12) → score delta (−10…+10)
  const adjustment = Math.max(-10, Math.min(10, Math.round(avg * 0.85)));
  const pairFit = Math.max(0, Math.min(1, (avg + 6) / 18));

  let summary: string | null = null;
  if (boldBold > 0 && !hasNeutral) {
    summary = 'Competing bold colours — anchor with a neutral';
  } else if (hasNeutral && hasBold && adjustment >= 6) {
    summary = 'Balanced — neutral base with a bold accent';
  } else if (categories.every((c) => c === 'pastel' || c === 'neutral')) {
    summary = 'Soft cohesive palette';
  } else if (categories.every((c) => c === 'neutral' || c === 'dark')) {
    summary = 'Clean neutral / dark palette';
  } else if (categories.every((c) => c === 'earth' || c === 'neutral' || c === 'dark')) {
    summary = 'Earth / natural palette';
  }

  return { categories, bases, adjustment, pairFit, summary };
}

/** Human feedback line from fashion palette (or null). */
export function fashionPaletteFeedbackLine(palette: FashionPaletteScore): string | null {
  if (palette.summary) return palette.summary;
  if (palette.adjustment <= -5) {
    return 'Colour categories clash — simplify to neutral + one accent';
  }
  if (palette.adjustment >= 7) {
    return 'Colours sit well across fashion categories';
  }
  return null;
}
