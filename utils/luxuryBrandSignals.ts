/**
 * Soft boosts from luxury / Sloane Street brand pattern mining.
 * Complements sloaneStreetSignals — quiet-luxury palettes, brand pairings,
 * silhouette affinity, footwear rules. Caps keep this soft.
 */
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import signalsJson from '@/data/sloane_street_dataset/signals.json';

type QuietPalette = { combo: string; frequency: number; score_boost: number };
type BrandPairing = { pair: string; frequency: number; brand_bias: string };
type BrandSilhouette = { brand: string; silhouette: string; frequency: number };
type FootwearRule = { context: string; preferred: string[]; avoided: string[] };

type LuxuryBlock = {
  quiet_luxury_palettes?: QuietPalette[];
  brand_pairings?: BrandPairing[];
  brand_silhouettes?: BrandSilhouette[];
  footwear_rules?: FootwearRule[];
  style_tags?: Array<{ tag: string; frequency: number }>;
};

type SignalsFile = {
  luxury?: LuxuryBlock;
  silhouette_counts?: Array<{ silhouette: string; frequency: number }>;
};

const signals = signalsJson as SignalsFile;
const luxury: LuxuryBlock = signals.luxury || {};

const COLOUR_ALIAS: Record<string, string> = {
  gray: 'grey',
  charcoal: 'grey',
  off_white: 'cream',
  ivory: 'cream',
  taupe: 'beige',
  tan: 'beige',
  khaki: 'beige',
  light_blue: 'blue',
  terracotta: 'brown',
  gold: 'beige',
};

export type LuxuryBoostContext = {
  occasion?: string | null;
  workDressCode?: string | null;
  styleHint?: string | null;
  /** Optional user intent e.g. "zegna", "loro_piana", "quiet luxury" */
  brandInspiration?: string | null;
};

function canonColor(raw: unknown): string {
  const x = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return COLOUR_ALIAS[x] || x;
}

function pairKey(a: string, b: string): string | null {
  if (!a || !b || a === b) return null;
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

function outfitColors(items: WardrobeItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const c = canonColor(item.color);
    if (c) set.add(c);
    const sec = canonColor((item as { secondaryColor?: string }).secondaryColor);
    if (sec) set.add(sec);
  }
  return [...set];
}

function classifyTopCat(item: WardrobeItem | undefined): string | null {
  if (!item) return null;
  const blob = `${item.category || ''} ${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/dress/.test(blob) || item.category === 'dresses') return 'dress';
  if (/polo/.test(blob)) return 'polo';
  if (/blouse|camisole|tunic/.test(blob)) return 'blouse';
  if (/sweater|jumper|cardigan/.test(blob)) return 'sweater';
  if (/knit/.test(blob)) return 'knit';
  if (/\bt-?shirt\b|tee\b/.test(blob)) return 't-shirt';
  if (/shirt/.test(blob)) return 'shirt';
  if (isTopItem(item)) return 'other';
  return null;
}

function classifyBottomCat(item: WardrobeItem | undefined): string | null {
  if (!item) return null;
  const blob = `${item.category || ''} ${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/jean|denim/.test(blob)) return 'jeans';
  if (/skirt/.test(blob)) return 'skirt';
  if (/short/.test(blob)) return 'shorts';
  if (/trouser|pant|chino|jogger/.test(blob) || isBottomItem(item)) return 'trousers';
  return null;
}

function classifyFootwear(item: WardrobeItem | undefined): string | null {
  if (!item) return null;
  const blob = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/loafer/.test(blob)) return 'loafers';
  if (/oxford/.test(blob)) return 'oxfords';
  if (/derby/.test(blob)) return 'derby';
  if (/chelsea/.test(blob)) return 'chelsea_boots';
  if (/rugged|combat|hiking|chunky/.test(blob)) return 'chunky_boots';
  if (/sneaker|trainer/.test(blob)) return 'sneakers';
  if (/sandal/.test(blob)) return 'sandals';
  if (/mule/.test(blob)) return 'mules';
  if (/espadrille/.test(blob)) return 'espadrilles';
  if (/boot/.test(blob)) return 'boots';
  return null;
}

function resolveStyleBucket(ctx?: LuxuryBoostContext): string {
  const hint = String(ctx?.styleHint || ctx?.workDressCode || ctx?.occasion || '')
    .toLowerCase()
    .trim();
  if (hint.includes('business') || hint === 'work_outfit' || hint === 'work') {
    return 'business_casual';
  }
  if (hint.includes('smart')) return 'smart_casual';
  if (hint.includes('resort') || hint.includes('vacation')) return 'resort';
  if (hint.includes('casual') || hint.includes('weekend')) return 'casual';
  return 'smart_casual';
}

/** Quiet-luxury / low-contrast neutral palette match (0–6). */
export function luxuryPaletteBoost(items: WardrobeItem[]): number {
  const colors = outfitColors(items);
  if (colors.length < 2) return 0;
  const table = luxury.quiet_luxury_palettes || [];
  let best = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const key = pairKey(colors[i], colors[j]);
      if (!key) continue;
      const hit = table.find((c) => c.combo === key);
      if (hit) best = Math.max(best, hit.score_boost || 0);
    }
  }
  return Math.max(0, Math.min(6, best));
}

/** Brand-biased garment pairing soft boost (0–5). */
export function luxuryPairingBoost(items: WardrobeItem[], brandInspiration?: string | null): number {
  const top = items.find(isTopItem) || items.find((i) => String(i.category).toLowerCase() === 'dresses');
  const bottom = items.find(isBottomItem);
  const topCat = classifyTopCat(top);
  const bottomCat = classifyBottomCat(bottom);
  if (!topCat || !bottomCat || topCat === 'dress') return 0;
  const key = `${topCat}×${bottomCat}`;
  const rows = luxury.brand_pairings || [];
  const brand = String(brandInspiration || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  let best = 0;
  for (const row of rows) {
    if (row.pair !== key) continue;
    let pts = Math.min(5, 2 + Math.min(3, row.frequency));
    if (brand && row.brand_bias === brand) pts += 2;
    best = Math.max(best, pts);
  }
  return Math.max(0, Math.min(5, best));
}

/**
 * Footwear luxury rules: preferred → boost, avoided → penalty.
 */
export function luxuryFootwearRules(
  items: WardrobeItem[],
  ctx: LuxuryBoostContext = {},
): number {
  const shoe = items.find(isShoesItem);
  const sub = classifyFootwear(shoe);
  if (!sub) return 0;
  const bucket = resolveStyleBucket(ctx);
  const rule = (luxury.footwear_rules || []).find((r) => r.context === bucket);
  if (!rule) return 0;
  if (rule.preferred.includes(sub)) return 4;
  if (rule.avoided.includes(sub)) return -6;
  if (
    /chunky|rugged|combat/.test(sub)
    && (bucket === 'smart_casual' || bucket === 'business_casual')
  ) {
    return -8;
  }
  return 0;
}

/** Silhouette corpus affinity (0–3). */
export function luxurySilhouetteBoost(items: WardrobeItem[]): number {
  const counts = signals.silhouette_counts || [];
  if (!counts.length) return 0;
  const hasBlazer = items.some((i) => /blazer|suit/.test(`${i.category} ${i.name}`.toLowerCase()));
  const target = hasBlazer ? 'tailored' : 'relaxed_tailored';
  const hit = counts.find((s) => s.silhouette === target || s.silhouette.includes('tailored'));
  if (!hit) return 0;
  return Math.min(3, 1 + Math.min(2, Math.floor(hit.frequency / 10)));
}

/**
 * Brand inspiration soft match ("dress like Zegna / Loro Piana").
 * Uses quiet-luxury tags + brand silhouette when inspiration is set.
 */
export function brandInspirationBoost(
  items: WardrobeItem[],
  brandInspiration?: string | null,
): number {
  const brand = String(brandInspiration || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!brand) return 0;

  let pts = 0;
  const sil = (luxury.brand_silhouettes || []).find((b) => b.brand === brand);
  if (sil) {
    const hasBlazer = items.some((i) => /blazer/.test(`${i.category} ${i.name}`.toLowerCase()));
    if (/tailored/.test(sil.silhouette) && hasBlazer) pts += 4;
    else if (/relaxed/.test(sil.silhouette)) pts += 2;
  }

  // Quiet luxury brands: reward low-contrast neutrals
  if (/loro_piana|zegna|brunello|quiet/.test(brand)) {
    pts += Math.min(4, Math.floor(luxuryPaletteBoost(items) / 1.5));
  }

  return Math.max(0, Math.min(8, pts));
}

/** Total luxury soft boost, capped −8…+8 (separate from Sloane +12). */
export function applyLuxuryBrandBoosts(
  items: WardrobeItem[],
  ctx: LuxuryBoostContext = {},
): number {
  if (!items?.length) return 0;
  const palette = luxuryPaletteBoost(items);
  const pairing = luxuryPairingBoost(items, ctx.brandInspiration);
  const footwear = luxuryFootwearRules(items, ctx);
  const silhouette = luxurySilhouetteBoost(items);
  const brand = brandInspirationBoost(items, ctx.brandInspiration);
  const raw = palette + pairing + footwear + silhouette + brand;
  return Math.max(-8, Math.min(8, raw));
}

/**
 * Lightweight style embedding for future "dress like X" matching.
 * Dimensions: [neutral_palette, low_contrast, tailored, smart_casual, quiet_luxury]
 */
export function outfitStyleVector(items: WardrobeItem[]): number[] {
  const colors = outfitColors(items);
  const neutrals = new Set(['black', 'white', 'cream', 'beige', 'grey', 'taupe', 'brown', 'navy', 'tan']);
  const neutralRatio = colors.length
    ? colors.filter((c) => neutrals.has(c)).length / colors.length
    : 0;
  const lowContrast = luxuryPaletteBoost(items) > 0 ? 1 : neutralRatio > 0.8 ? 0.7 : 0.3;
  const tailored = items.some((i) =>
    /blazer|trouser|oxford|loafer|dress shirt|chino/.test(
      `${i.category} ${i.subcategory || ''} ${i.name || ''}`.toLowerCase(),
    ),
  )
    ? 1
    : 0.3;
  const smart = items.some(isShoesItem) && items.some(isTopItem) ? 0.8 : 0.4;
  const quiet = Math.min(1, (neutralRatio + lowContrast + (tailored > 0.5 ? 0.3 : 0)) / 2);
  return [
    Math.round(neutralRatio * 100) / 100,
    Math.round(lowContrast * 100) / 100,
    tailored,
    smart,
    Math.round(quiet * 100) / 100,
  ];
}

/** Cosine similarity between two style vectors (0–1). */
export function styleVectorSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
}

export function luxurySignalsInsights(): string {
  const tags = (luxury.style_tags || [])
    .slice(0, 5)
    .map((t) => t.tag)
    .join(', ');
  const palettes = (luxury.quiet_luxury_palettes || [])
    .slice(0, 3)
    .map((p) => p.combo)
    .join(', ');
  const parts = [
    tags ? `style tags: ${tags}` : '',
    palettes ? `quiet palettes: ${palettes}` : '',
  ].filter(Boolean);
  return parts.length ? `Luxury signals — ${parts.join('; ')}` : 'Luxury signals ready';
}
