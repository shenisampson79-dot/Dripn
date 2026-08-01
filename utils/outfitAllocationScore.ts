/**
 * Calibrated 0–100 outfit score for Today's Outfit / allocator ranking.
 *
 * Hard rules (clash + dress-code gates) run BEFORE this. This module only ranks
 * survivors. Work days put Context above Style so office looks win.
 *
 * Final = wC·Cohesion + wX·Context + wU·Preference + wP·Proportion + wF·Freshness
 */

import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { WorkDressCode } from '@/services/OnboardingProfileService';
import {
  isBottomItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import { outfitMeetsOccasionStandard } from '@/utils/fashionEditorialRubric';
import {
  scoreFootwearDirection,
  scoreOutfitSubtypeCompatibility,
} from '@/utils/garmentTaxonomy';
import { scoreColorHarmony } from '@/utils/outfitColorHarmony';
import { classifyItem } from '@/utils/outfitClashRules';
import type { DiversityTracker } from '@/utils/outfitDiversity';
import { hashOutfit, scoreOutfitDiversity } from '@/utils/outfitDiversity';
import { scoreOutfitSilhouette } from '@/utils/outfitSilhouetteScore';
import {
  scoreWorkDressCodeFit,
  isRuggedWorkBoot,
  isSmartOfficeShoe,
  isBusinessFormalShoe,
} from '@/utils/workDressCodeRules';
import {
  parseWeatherTempC,
  weatherOuterwearScoreAdjustment,
  type WeatherLike,
} from '@/utils/weatherOuterwear';
import { applyDualStyleBoosts } from '@/utils/dualStyleSignals';
import { applyLuxuryBrandBoosts } from '@/utils/luxuryBrandSignals';
import {
  feedbackPreference01,
  hydrateOutfitFeedbackBrain,
} from '@/utils/outfitFeedbackBrain';export type ScoreWeights = {
  c: number;
  x: number;
  u: number;
  p: number;
  f: number;
};

export type OutfitScoreBreakdown = {
  cohesion: number;
  context: number;
  preference: number;
  proportion: number;
  freshness: number;
  weights: ScoreWeights;
  final: number;
  /** Human-readable why (debug / stylist explain). */
  reasons: string[];
};

export type AllocationScoreContext = {
  occasion: OutfitOccasionId | 'todays_look' | string;
  workDressCode?: WorkDressCode | null;
  weather?: WeatherLike | null;
  /** Yesterday / recent outfits for freshness. */
  previous?: WardrobeItem[] | null;
  priorOutfits?: WardrobeItem[][];
  diversity?: DiversityTracker | null;
  /** Cascade depth: 0 = requested occasion, 1 = first fallback, … */
  cascadeStep?: number;
  /** Optional "dress like X" brand inspiration for luxury soft boosts */
  brandInspiration?: string | null;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

/**
 * Occasion-aware weights. Work / business* pushes Context so wrong shoes
 * and dress-code misses cannot outrank a cohesive-but-wrong look.
 */
export function weightsFor(
  occasion: string,
  workDressCode?: WorkDressCode | null,
): ScoreWeights {
  const occ = String(occasion || '').toLowerCase();
  const code = workDressCode || null;

  if (occ === 'gym') return { c: 18, x: 42, u: 16, p: 12, f: 12 };
  if (occ === 'date_night' || occ === 'evening_out') {
    return { c: 32, x: 28, u: 18, p: 14, f: 8 };
  }
  if (occ === 'weekend' || occ === 'casual_day' || occ === 'todays_look') {
    return { c: 30, x: 20, u: 24, p: 14, f: 12 };
  }

  // Explicit workplace dress code (weekday majority use-case)
  if (code === 'business_formal') return { c: 20, x: 40, u: 12, p: 16, f: 12 };
  if (code === 'business_casual') return { c: 22, x: 36, u: 14, p: 16, f: 12 };
  if (code === 'creative') return { c: 28, x: 26, u: 20, p: 14, f: 12 };
  if (code === 'smart_casual') return { c: 28, x: 28, u: 18, p: 14, f: 12 };

  if (occ === 'work_outfit') return { c: 22, x: 38, u: 14, p: 16, f: 10 };
  if (occ === 'smart_casual') return { c: 28, x: 28, u: 18, p: 14, f: 12 };

  return { c: 28, x: 30, u: 18, p: 14, f: 10 };
}

function scoreCohesion01(items: WardrobeItem[], reasons: string[]): number {
  const color = scoreColorHarmony(items);
  const colour01 = clamp01((color.score ?? 50) / 100);

  const signals = items.map(classifyItem);
  const tiers = signals.map((s) => s.formalityTier);
  const span = Math.max(...tiers) - Math.min(...tiers);
  const formality01 = span <= 0 ? 1 : span === 1 ? 0.75 : span === 2 ? 0.35 : 0.05;
  if (span >= 2) reasons.push(`Formality span ${span}`);

  const subtype = scoreOutfitSubtypeCompatibility(items);
  const lane01 = clamp01(0.55 + (subtype.adjustment || 0) / 20);

  // Texture: penalise linen + rugged boots (common work fail)
  let texture01 = 0.75;
  const text = items.map((i) => `${i.name || ''} ${i.subcategory || ''}`).join(' ').toLowerCase();
  const hasLinen = /linen/.test(text);
  const hasRugged = items.some(isRuggedWorkBoot);
  if (hasLinen && hasRugged) {
    texture01 = 0.2;
    reasons.push('Linen + rugged boots');
  } else if (hasLinen && items.some((i) => classifyItem(i).isFormalShoes)) {
    texture01 = 0.55;
  } else if (/wool|tweed/.test(text) && items.some(isSmartOfficeShoe)) {
    texture01 = 0.95;
  }

  const cohesion = 0.35 * colour01 + 0.4 * formality01 + 0.15 * texture01 + 0.1 * lane01;
  return clamp01(cohesion);
}

function scoreContext01(
  items: WardrobeItem[],
  ctx: AllocationScoreContext,
  reasons: string[],
): number {
  const occasion = String(ctx.occasion || 'casual_day');
  const cascade = Math.max(0, ctx.cascadeStep ?? 0);
  let occasion01 = 0.55;
  if (outfitMeetsOccasionStandard(items, occasion as OutfitOccasionId)) {
    occasion01 = cascade === 0 ? 1 : cascade === 1 ? 0.7 : 0.45;
  } else if (cascade >= 2) {
    occasion01 = 0.25;
  } else {
    occasion01 = 0.35;
    reasons.push('Soft occasion mismatch');
  }

  const dressFit = scoreWorkDressCodeFit(items, ctx.workDressCode || null);
  const dress01 = clamp01((dressFit + 20) / 32);

  // Extra work footwear emphasis (majority of weekday time)
  const isWorkish =
    occasion === 'work_outfit'
    || ctx.workDressCode === 'business_casual'
    || ctx.workDressCode === 'business_formal';
  if (isWorkish) {
    const shoes = items.filter(isShoesItem);
    if (ctx.workDressCode === 'business_formal') {
      if (shoes.some(isBusinessFormalShoe)) {
        occasion01 = Math.min(1, occasion01 + 0.05);
      } else if (shoes.length) {
        reasons.push('Non-formal work shoes');
      }
    } else if (ctx.workDressCode === 'business_casual' || (!ctx.workDressCode && occasion === 'work_outfit')) {
      if (shoes.some(isSmartOfficeShoe)) {
        occasion01 = Math.min(1, occasion01 + 0.04);
      }
      if (shoes.some(isRuggedWorkBoot)) {
        reasons.push('Rugged boots under work dress code');
      }
    }
  }

  const footwear = scoreFootwearDirection(items, { occasion });
  const footwear01 = clamp01(0.6 + (footwear.adjustment || 0) / 24);

  const weatherAdj = weatherOuterwearScoreAdjustment(items, ctx.weather);
  const tempC = parseWeatherTempC(ctx.weather);
  let weather01 = 0.75;
  if (tempC != null) {
    if (weatherAdj >= 2) weather01 = 1;
    else if (weatherAdj <= -4) {
      weather01 = 0.25;
      reasons.push('Weather outerwear mismatch');
    } else if (weatherAdj < 0) weather01 = 0.55;
    else weather01 = 0.85;
  }

  // Work: dress code + occasion dominate context
  if (isWorkish) {
    const context = 0.35 * occasion01 + 0.45 * dress01 + 0.1 * footwear01 + 0.1 * weather01;
    return clamp01(context);
  }

  return clamp01(0.4 * occasion01 + 0.35 * dress01 + 0.1 * footwear01 + 0.15 * weather01);
}

function scorePreference01(items: WardrobeItem[], reasons: string[]): number {
  if (!items.length) return 0.5;
  // Best-effort hydrate — scoring stays sync; first ranks may be neutral until loaded
  void hydrateOutfitFeedbackBrain();

  const favShare = items.filter((i) => i.isFavorite).length / items.length;
  const wears = items.map((i) => Number(i.timesWorn) || 0);
  const avgWear = wears.reduce((a, b) => a + b, 0) / wears.length;
  let wear01 = 0.7;
  if (avgWear === 0) wear01 = 0.55;
  else if (avgWear <= 3) wear01 = 0.9;
  else if (avgWear <= 8) wear01 = 0.75;
  else wear01 = 0.45;

  const feedback01 = feedbackPreference01(items);

  if (favShare >= 0.5) reasons.push('Includes favorites');
  if (feedback01 >= 0.7) reasons.push('Matches recent likes');
  else if (feedback01 <= 0.4) reasons.push('Avoids recently skipped pieces');

  // Soft only — favorites + wear + feedback; never overrides hard clash/dress-code
  return clamp01(0.4 * favShare + 0.3 * wear01 + 0.3 * feedback01);
}

function scoreProportion01(items: WardrobeItem[], reasons: string[]): number {
  const sil = scoreOutfitSilhouette(items, null);
  const overall01 = clamp01((sil.overall ?? 50) / 100);
  const balance01 = clamp01((sil.proportionBalance ?? 50) / 100);

  // Footwear visual weight vs top formality
  let weight01 = 0.75;
  const signals = items.map(classifyItem);
  const hasRugged = items.some(isRuggedWorkBoot);
  const maxTopTier = Math.max(
    0,
    ...signals.filter((s) => s.isDressShirt || s.isStructuredShirt || s.isBlazer).map((s) => s.formalityTier),
  );
  if (hasRugged && maxTopTier >= 4) {
    weight01 = 0.25;
    reasons.push('Heavy boots under tailored top');
  } else if (items.some(isSmartOfficeShoe) && maxTopTier >= 3) {
    weight01 = 0.95;
  }

  return clamp01(0.4 * weight01 + 0.3 * overall01 + 0.3 * balance01);
}

function trioSignature(items: WardrobeItem[]): { top?: string; bottom?: string; shoes?: string } {
  return {
    top: items.find(isTopItem)?.id != null ? String(items.find(isTopItem)!.id) : undefined,
    bottom: items.find(isBottomItem)?.id != null ? String(items.find(isBottomItem)!.id) : undefined,
    shoes: items.find(isShoesItem)?.id != null ? String(items.find(isShoesItem)!.id) : undefined,
  };
}

function countTrioChanges(a: WardrobeItem[], b: WardrobeItem[]): number {
  const A = trioSignature(a);
  const B = trioSignature(b);
  let n = 0;
  if (A.top && B.top && A.top !== B.top) n += 1;
  if (A.bottom && B.bottom && A.bottom !== B.bottom) n += 1;
  if (A.shoes && B.shoes && A.shoes !== B.shoes) n += 1;
  return n;
}

function scoreFreshness01(items: WardrobeItem[], ctx: AllocationScoreContext, reasons: string[]): number {
  const hash = hashOutfit(items);
  if (hash && ctx.diversity?.outfitHashes.has(hash)) {
    reasons.push('Exact outfit already used in plan');
    return 0;
  }

  const previous = ctx.previous;
  if (previous?.length) {
    const changes = countTrioChanges(items, previous);
    if (changes === 0) return 0.1;
    if (changes === 1) return 0.35;
    if (changes === 2) return 0.85;
    return 1;
  }

  const priors = ctx.priorOutfits || [];
  if (priors.length) {
    let best = 1;
    for (const prior of priors.slice(0, 3)) {
      const changes = countTrioChanges(items, prior);
      const s = changes === 0 ? 0.05 : changes === 1 ? 0.4 : changes === 2 ? 0.8 : 1;
      best = Math.min(best, s);
    }
    return clamp01(best);
  }

  if (ctx.diversity) {
    const raw = scoreOutfitDiversity(items, ctx.diversity);
    // diversity returns ~100 base minus penalties; map roughly
    return clamp01(raw / 100);
  }

  return 0.75;
}

/**
 * Full calibrated breakdown. Call only after hard validity filters.
 */
export function scoreOutfitBreakdown(
  items: WardrobeItem[],
  ctx: AllocationScoreContext,
): OutfitScoreBreakdown {
  const reasons: string[] = [];
  if (!items?.length) {
    return {
      cohesion: 0,
      context: 0,
      preference: 0,
      proportion: 0,
      freshness: 0,
      weights: weightsFor('casual_day', null),
      final: 0,
      reasons: ['Empty outfit'],
    };
  }

  const weights = { ...weightsFor(ctx.occasion, ctx.workDressCode) };
  // Cap preference on strict business days so favorites can't override office rules
  if (
    ctx.workDressCode === 'business_formal'
    || ctx.workDressCode === 'business_casual'
    || (String(ctx.occasion) === 'work_outfit' && ctx.workDressCode !== 'creative' && ctx.workDressCode !== 'smart_casual')
  ) {
    if (weights.u > 14) {
      const extra = weights.u - 14;
      weights.u = 14;
      weights.x += extra;
    }
  }

  const cohesion = scoreCohesion01(items, reasons);
  const context = scoreContext01(items, ctx, reasons);
  const preference = scorePreference01(items, reasons);
  const proportion = scoreProportion01(items, reasons);
  const freshness = scoreFreshness01(items, ctx, reasons);

  const base = clamp100(
    weights.c * cohesion
      + weights.x * context
      + weights.u * preference
      + weights.p * proportion
      + weights.f * freshness,
  );

  const dualBoost = applyDualStyleBoosts(items, {
    occasion: String(ctx.occasion || ''),
    workDressCode: ctx.workDressCode || null,
  });
  const luxuryBoost = applyLuxuryBrandBoosts(items, {
    occasion: String(ctx.occasion || ''),
    workDressCode: ctx.workDressCode || null,
    brandInspiration: ctx.brandInspiration || null,
  });
  // Dual-style ≤14 + brand luxury ≤8, total soft clamp −6…+15
  const softBoost = Math.max(-6, Math.min(15, dualBoost + luxuryBoost));
  if (dualBoost !== 0) {
    reasons.push(
      dualBoost > 0
        ? `Dual-style boost +${dualBoost}`
        : `Dual-style affinity ${dualBoost}`,
    );
  }
  if (luxuryBoost !== 0) {
    reasons.push(
      luxuryBoost > 0
        ? `Luxury brand boost +${luxuryBoost}`
        : `Luxury brand affinity ${luxuryBoost}`,
    );
  }

  const final = clamp100(base + softBoost);

  return {
    cohesion,
    context,
    preference,
    proportion,
    freshness,
    weights,
    final,
    reasons,
  };
}

/**
 * Allocator rank key: calibrated final plus tiny diversity nudge.
 * Laundry / mode hard penalties stay in the engine (not here).
 */
export function scoreOutfitForAllocation(
  items: WardrobeItem[],
  ctx: AllocationScoreContext,
): number {
  const breakdown = scoreOutfitBreakdown(items, ctx);
  return breakdown.final;
}

/** Compare two outfits — positive if a is better for work context. */
export function workAttireRankDelta(
  a: WardrobeItem[],
  b: WardrobeItem[],
  workDressCode: WorkDressCode | null = 'business_casual',
): number {
  const ctx: AllocationScoreContext = {
    occasion: 'work_outfit',
    workDressCode,
    cascadeStep: 0,
  };
  return scoreOutfitForAllocation(a, ctx) - scoreOutfitForAllocation(b, ctx);
}
