/**
 * Soft boosts from Sloane Street shop-window dataset (signals.json).
 * Caps are intentional — these nudge ranking, they do not override hard rules.
 */
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import signalsJson from '@/data/sloane_street_dataset/signals.json';

type ColourCombo = { combo: string; frequency: number; score_boost: number };
type GarmentPairing = { pairing: string; frequency: number; score_boost: number };
type FootwearEntry = { subcategory: string; frequency: number; score_boost: number };

type SloaneSignals = {
  version: number;
  colour_combos: ColourCombo[];
  garment_pairings: GarmentPairing[];
  footwear_by_style: Record<string, FootwearEntry[]>;
  insights?: string;
};

const signals = signalsJson as SloaneSignals;

const COLOUR_ALIAS: Record<string, string> = {
  gray: 'grey',
  charcoal: 'grey',
  off_white: 'cream',
  ivory: 'cream',
  denim: 'blue',
  light_blue: 'blue',
  taupe: 'beige',
  tan: 'beige',
  khaki: 'beige',
  olive: 'green',
  forest: 'green',
  burgundy: 'red',
  maroon: 'red',
  coral: 'coral',
  mauve: 'pink',
  gold: 'beige',
  multicolour: 'multicolor',
};

export type SloaneBoostContext = {
  occasion?: string | null;
  workDressCode?: string | null;
  styleHint?: string | null;
};

function canonColor(raw: unknown): string {
  const x = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return COLOUR_ALIAS[x] || x;
}

function itemColors(item: WardrobeItem): string[] {
  const out: string[] = [];
  const primary = canonColor(item.color);
  if (primary) out.push(primary);
  const secondary = canonColor((item as { secondaryColor?: string }).secondaryColor);
  if (secondary && secondary !== primary) out.push(secondary);
  return out;
}

function outfitColors(items: WardrobeItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const c of itemColors(item)) set.add(c);
  }
  return [...set];
}

function pairKey(a: string, b: string): string | null {
  if (!a || !b || a === b) return null;
  return a < b ? `${a}+${b}` : `${b}+${a}`;
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
  const keys = [
    'loafers',
    'oxfords',
    'derby',
    'chelsea_boots',
    'heels',
    'sandals',
    'sneakers',
    'boots',
    'mules',
    'flats',
    'espadrilles',
    'mary_janes',
  ] as const;
  for (const k of keys) {
    const needle = k.replace(/_/g, ' ');
    if (blob.includes(k) || blob.includes(needle)) return k;
  }
  if (/loafer/.test(blob)) return 'loafers';
  if (/oxford/.test(blob)) return 'oxfords';
  if (/derby/.test(blob)) return 'derby';
  if (/chelsea/.test(blob)) return 'chelsea_boots';
  if (/heel|pump|stiletto/.test(blob)) return 'heels';
  if (/sandal/.test(blob)) return 'sandals';
  if (/sneaker|trainer|running/.test(blob)) return 'sneakers';
  if (/mule|sabot/.test(blob)) return 'mules';
  if (/espadrille/.test(blob)) return 'espadrilles';
  if (/mary\s*jane/.test(blob)) return 'mary_janes';
  if (/flat|ballet/.test(blob)) return 'flats';
  if (/boot/.test(blob)) return 'boots';
  return null;
}

function resolveStyleHint(ctx?: SloaneBoostContext): string {
  const hint = String(ctx?.styleHint || ctx?.workDressCode || ctx?.occasion || '')
    .toLowerCase()
    .trim();
  if (hint.includes('business') || hint === 'work_outfit' || hint === 'work') {
    return 'business_casual';
  }
  if (hint.includes('smart')) return 'smart_casual';
  if (hint.includes('resort') || hint.includes('vacation') || hint.includes('holiday')) {
    return 'resort';
  }
  if (hint.includes('casual') || hint.includes('weekend') || hint.includes('todays')) {
    return 'casual';
  }
  return 'smart_casual';
}

/** Colour-combo soft boost from Sloane frequency table (0–8). */
export function sloaneColourBoost(items: WardrobeItem[]): number {
  const colors = outfitColors(items);
  if (colors.length < 2) return 0;
  let best = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const key = pairKey(colors[i], colors[j]);
      if (!key) continue;
      const hit = signals.colour_combos.find((c) => c.combo === key);
      if (hit) best = Math.max(best, hit.score_boost || 0);
    }
  }
  return Math.max(0, Math.min(8, best));
}

/** Top×bottom pairing soft boost (0–6). Dresses are not scored as dress×none. */
export function sloanePairingBoost(items: WardrobeItem[]): number {
  const top = items.find(isTopItem) || items.find((i) => String(i.category).toLowerCase() === 'dresses');
  const bottom = items.find(isBottomItem);
  const topCat = classifyTopCat(top);
  const bottomCat = classifyBottomCat(bottom);
  if (!topCat || !bottomCat || topCat === 'dress') return 0;
  const key = `${topCat}×${bottomCat}`;
  const hit = signals.garment_pairings.find((p) => p.pairing === key);
  return Math.max(0, Math.min(6, hit?.score_boost || 0));
}

/**
 * Footwear affinity vs Sloane style bucket.
 * Positive when shoe subtype is common for the style; mild negative when mismatched.
 */
export function sloaneFootwearAffinity(
  items: WardrobeItem[],
  styleHint?: string | null,
): number {
  const shoe = items.find(isShoesItem);
  const sub = classifyFootwear(shoe);
  if (!sub) return 0;

  const style = resolveStyleHint({ styleHint });
  const table = signals.footwear_by_style?.[style] || [];
  const hit = table.find((e) => e.subcategory === sub);
  if (hit) return Math.max(0, Math.min(6, hit.score_boost || 0));

  // Seen elsewhere but not in this style bucket → mild penalty
  const anyStyle = Object.values(signals.footwear_by_style || {}).some((rows) =>
    rows.some((e) => e.subcategory === sub),
  );
  if (anyStyle) return -2;

  // Completely unseen footwear subtype for Sloane corpus
  return -4;
}

/**
 * Legacy combined-corpus soft boost (capped +12).
 * Prefer applyDualStyleBoosts from dualStyleSignals.ts for ranking.
 */
export function applySloaneStreetBoosts(
  items: WardrobeItem[],
  ctx: SloaneBoostContext = {},
): number {
  if (!items?.length) return 0;
  const colour = sloaneColourBoost(items);
  const pairing = sloanePairingBoost(items);
  const footwear = sloaneFootwearAffinity(items, resolveStyleHint(ctx));
  const raw = colour + pairing + footwear;
  return Math.max(-4, Math.min(12, raw));
}

export function sloaneSignalsInsights(): string {
  return signals.insights || '';
}
