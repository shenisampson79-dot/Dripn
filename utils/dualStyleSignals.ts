/**
 * Dual-style soft scoring: Sloane (luxury) × Croydon (casual) with context weights.
 *
 * Never flatten both corpora into one unconditional boost — that makes sneakers
 * win on work days. Weight lanes by occasion / dress code instead.
 */
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import luxuryJson from '@/data/sloane_street_dataset/signals.luxury.json';
import casualJson from '@/data/shop_window_corpus/signals.casual.json';
import weightsJson from '@/data/shop_window_corpus/dual_style_weights.json';
import {
  applySloaneStreetBoosts,
  type SloaneBoostContext,
} from '@/utils/sloaneStreetSignals';

type ColourCombo = { combo: string; frequency: number; score_boost: number };
type GarmentPairing = { pairing: string; frequency: number; score_boost: number };
type FootwearEntry = { subcategory: string; frequency: number; score_boost: number };

type LaneSignals = {
  colour_combos?: ColourCombo[];
  garment_pairings?: GarmentPairing[];
  footwear_by_style?: Record<string, FootwearEntry[]>;
};

type DualWeights = {
  contexts: Record<string, { luxury: number; casual: number }>;
};

const luxury = luxuryJson as LaneSignals;
const casual = casualJson as LaneSignals;
const dualWeights = weightsJson as DualWeights;

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
  burgundy: 'red',
  maroon: 'red',
};

export type DualStyleContext = SloaneBoostContext & {
  /** Explicit lane override when known */
  styleLane?: 'luxury' | 'casual' | 'elevated_casual' | null;
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
    'loafers', 'oxfords', 'derby', 'chelsea_boots', 'heels', 'sandals',
    'sneakers', 'boots', 'mules', 'flats', 'espadrilles', 'mary_janes',
  ] as const;
  for (const k of keys) {
    const needle = k.replace(/_/g, ' ');
    if (blob.includes(k) || blob.includes(needle)) return k;
  }
  if (/loafer/.test(blob)) return 'loafers';
  if (/oxford/.test(blob)) return 'oxfords';
  if (/sneaker|trainer|running/.test(blob)) return 'sneakers';
  if (/heel|pump|stiletto/.test(blob)) return 'heels';
  if (/sandal/.test(blob)) return 'sandals';
  if (/boot/.test(blob)) return 'boots';
  return null;
}

function isTailoredBottom(item: WardrobeItem | undefined): boolean {
  if (!item) return false;
  const blob = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  return /trouser|chino|tailored|pleat|wide.?leg|straight/.test(blob) && !/jogger|sweat|cargo|short/.test(blob);
}

/** Map occasion / dress code → dual-style context key. */
export function resolveDualStyleContextKey(ctx: DualStyleContext = {}): string {
  if (ctx.styleLane === 'elevated_casual') return 'elevated_casual';
  if (ctx.styleLane === 'luxury') return 'work';
  if (ctx.styleLane === 'casual') return 'casual';

  const hint = `${ctx.styleHint || ''} ${ctx.workDressCode || ''} ${ctx.occasion || ''}`
    .toLowerCase()
    .trim();

  if (/business_formal|black.?tie|interview|office|work_outfit|work\b|business/.test(hint)) {
    if (/creative|smart_casual/.test(hint)) return 'smart_casual';
    return /business_formal|interview|black.?tie/.test(hint) ? 'business' : 'work';
  }
  if (/weekend|todays|everyday|athleisure|gym/.test(hint)) return 'weekend';
  if (/resort|vacation|holiday|beach/.test(hint)) return 'resort';
  if (/smart.?casual/.test(hint)) return 'smart_casual';
  if (/casual/.test(hint)) return 'casual';
  return 'smart_casual';
}

export function dualStyleLaneWeights(ctx: DualStyleContext = {}): { luxury: number; casual: number; key: string } {
  const key = resolveDualStyleContextKey(ctx);
  const row = dualWeights.contexts?.[key] || dualWeights.contexts?.smart_casual || { luxury: 0.6, casual: 0.5 };
  return { luxury: row.luxury, casual: row.casual, key };
}

function colourBoost(items: WardrobeItem[], signals: LaneSignals): number {
  const colors = new Set<string>();
  for (const item of items) {
    for (const c of itemColors(item)) colors.add(c);
  }
  const list = [...colors];
  if (list.length < 2) return 0;
  let best = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const key = pairKey(list[i], list[j]);
      if (!key) continue;
      const hit = (signals.colour_combos || []).find((c) => c.combo === key);
      if (hit) best = Math.max(best, hit.score_boost || 0);
    }
  }
  return Math.max(0, Math.min(8, best));
}

function pairingBoost(items: WardrobeItem[], signals: LaneSignals): number {
  const top = items.find(isTopItem) || items.find((i) => String(i.category).toLowerCase() === 'dresses');
  const bottom = items.find(isBottomItem);
  const topCat = classifyTopCat(top);
  const bottomCat = classifyBottomCat(bottom);
  if (!topCat || !bottomCat || topCat === 'dress') return 0;
  const key = `${topCat}×${bottomCat}`;
  const hit = (signals.garment_pairings || []).find((p) => p.pairing === key);
  return Math.max(0, Math.min(6, hit?.score_boost || 0));
}

function footwearBoost(
  items: WardrobeItem[],
  signals: LaneSignals,
  styleBucket: string,
  opts: { penalizeSneakers?: boolean; boostSneakers?: boolean } = {},
): number {
  const shoe = items.find(isShoesItem);
  const sub = classifyFootwear(shoe);
  if (!sub) return 0;

  const table = signals.footwear_by_style?.[styleBucket] || signals.footwear_by_style?.casual || [];
  const hit = table.find((e) => e.subcategory === sub);
  let score = hit ? Math.max(0, Math.min(6, hit.score_boost || 0)) : 0;

  if (opts.penalizeSneakers && sub === 'sneakers') {
    score = Math.min(score, 0) - 3;
  }
  if (opts.boostSneakers && sub === 'sneakers') {
    score = Math.max(score, 5);
  }
  if (opts.penalizeSneakers && (sub === 'loafers' || sub === 'oxfords' || sub === 'derby')) {
    score = Math.max(score, 5);
  }
  return Math.max(-4, Math.min(6, score));
}

function styleBucketForKey(key: string): string {
  if (key === 'work' || key === 'business') return 'business_casual';
  if (key === 'weekend' || key === 'casual') return 'casual';
  if (key === 'resort') return 'resort';
  if (key === 'elevated_casual') return 'smart_casual';
  return 'smart_casual';
}

/**
 * Modern smart-casual hybrid seen across both corpora:
 * tee/polo + tailored trousers + sneakers.
 * Soft only — never applied on strict business dress codes.
 */
export function elevatedCasualHybridBoost(
  items: WardrobeItem[],
  ctx: DualStyleContext = {},
): number {
  const code = String(ctx.workDressCode || '').toLowerCase();
  const key = resolveDualStyleContextKey(ctx);
  if (code === 'business_formal' || code === 'business_casual' || key === 'work' || key === 'business') {
    return 0;
  }

  const top = items.find(isTopItem);
  const bottom = items.find(isBottomItem);
  const shoe = items.find(isShoesItem);
  const topCat = classifyTopCat(top);
  const fw = classifyFootwear(shoe);
  if (!topCat || !bottom || !fw) return 0;
  if ((topCat === 't-shirt' || topCat === 'polo') && isTailoredBottom(bottom) && fw === 'sneakers') {
    return 6;
  }
  return 0;
}

function laneRawScore(items: WardrobeItem[], signals: LaneSignals, ctxKey: string, lane: 'luxury' | 'casual'): number {
  const bucket = styleBucketForKey(ctxKey);
  const isWorkish = ctxKey === 'work' || ctxKey === 'business';
  const isCasualish = ctxKey === 'casual' || ctxKey === 'weekend';

  const colour = colourBoost(items, signals);
  const pairing = pairingBoost(items, signals);
  const footwear = footwearBoost(items, signals, bucket, {
    penalizeSneakers: lane === 'luxury' && isWorkish,
    boostSneakers: lane === 'casual' && isCasualish,
  });
  return colour + pairing + footwear;
}

export type DualStyleBreakdown = {
  final: number;
  luxury: number;
  casual: number;
  hybrid: number;
  weights: { luxury: number; casual: number };
  contextKey: string;
};

/**
 * Context-weighted dual-style soft boost. Cap −6…+14.
 * Prefer this over applySloaneStreetBoosts for ranking.
 */
export function applyDualStyleBoosts(
  items: WardrobeItem[],
  ctx: DualStyleContext = {},
): number {
  return scoreDualStyleBoosts(items, ctx).final;
}

export function scoreDualStyleBoosts(
  items: WardrobeItem[],
  ctx: DualStyleContext = {},
): DualStyleBreakdown {
  if (!items?.length) {
    return {
      final: 0,
      luxury: 0,
      casual: 0,
      hybrid: 0,
      weights: { luxury: 0, casual: 0 },
      contextKey: 'smart_casual',
    };
  }

  const { luxury: luxW, casual: casW, key } = dualStyleLaneWeights(ctx);
  const luxuryScore = laneRawScore(items, luxury, key, 'luxury');
  const casualScore = laneRawScore(items, casual, key, 'casual');
  const hybrid = elevatedCasualHybridBoost(items, ctx);

  // Soft blend — work days almost ignore casual frequency; weekend leans Croydon
  const blended = luxW * luxuryScore + casW * casualScore + hybrid;
  const final = Math.max(-6, Math.min(14, Math.round(blended * 10) / 10));

  return {
    final,
    luxury: luxuryScore,
    casual: casualScore,
    hybrid,
    weights: { luxury: luxW, casual: casW },
    contextKey: key,
  };
}

/**
 * Legacy combined-corpus boost kept for A/B / fallback.
 * Prefer applyDualStyleBoosts.
 */
export function applyLegacyCombinedBoosts(
  items: WardrobeItem[],
  ctx: SloaneBoostContext = {},
): number {
  return applySloaneStreetBoosts(items, ctx);
}
