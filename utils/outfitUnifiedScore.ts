import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { RegionalStyleContext } from '@/utils/outfitRegionalContext';
import {
  analyzeOutfitAesthetic,
  evaluateAestheticRejection,
  type StyleArchetype,
} from '@/utils/outfitAestheticClassifier';
import {
  buildOutfitContext,
  detectOutfitClashes,
  type OutfitClash,
} from '@/utils/outfitClashRules';
import {
  scoreColorHarmony,
  type ColorWheelRelation,
} from '@/utils/outfitColorHarmony';
import { scoreOutfitSilhouette } from '@/utils/outfitSilhouetteScore';
import type { BrandTier, ClothingSeason, OutfitContextMeta, OutfitOccasion } from '@/utils/outfitContextEnrichment';

export type { BrandTier, ClothingSeason, OutfitContextMeta, OutfitOccasion };

/** Default production weights — tunable per region or A/B test. */
export const DEFAULT_UNIFIED_WEIGHTS = {
  style: 0.4,
  color: 0.3,
  fit: 0.3,
} as const;

export type UnifiedOutfitWeights = typeof DEFAULT_UNIFIED_WEIGHTS;

export type OutfitQualityLabel = 'bad' | 'average' | 'good';

export type UnifiedOutfitItem = {
  type: string;
  name: string;
  color?: string;
  brand_tier?: BrandTier;
  seasons?: ClothingSeason[];
};

export type UnifiedContextBreakdown = {
  season: ClothingSeason;
  occasion: OutfitOccasion;
  brand_tiers: BrandTier[];
  brand_coherence: number;
  season_fit: number;
};

export type UnifiedStyleBreakdown = {
  primary_style: StyleArchetype | null;
  style_consistency: number;
  formality_match: number;
  occasion_fit: number;
  STYLE_SCORE: number;
};

export type UnifiedColorBreakdown = {
  palette: string[];
  harmony_type: ColorWheelRelation;
  contrast_score: number;
  clash_penalty: number;
  seasonal_match: number | null;
  COLOR_SCORE: number;
};

export type UnifiedFitBreakdown = {
  top_fit: string;
  bottom_fit: string;
  silhouette: string;
  proportion_score: number;
  silhouette_balance: number;
  fit_quality: number;
  FIT_SCORE: number;
};

/** Full training / export row (one outfit). */
export type UnifiedOutfitRecord = {
  outfit_id: string;
  items: UnifiedOutfitItem[];
  context: UnifiedContextBreakdown;
  style: UnifiedStyleBreakdown;
  color: UnifiedColorBreakdown;
  fit: UnifiedFitBreakdown;
  final_score: number;
  label: OutfitQualityLabel;
  feedback: string[];
  hard_cap?: number;
  clash_id?: string;
  /** Original CSV label when re-scoring imported data */
  source_label?: OutfitQualityLabel;
};

export type UnifiedOutfitScoreResult = {
  record: UnifiedOutfitRecord;
  weights: UnifiedOutfitWeights;
  clash: OutfitClash | null;
  rejected: boolean;
};

const HARMONY_BASE: Record<ColorWheelRelation, number> = {
  monochromatic: 0.95,
  analogous: 0.9,
  neutral_dominant: 0.88,
  mixed_harmonious: 0.82,
  complementary: 0.75,
  triadic: 0.72,
  clashing: 0.3,
};

const FIT_QUALITY_MAP: Record<string, number> = {
  tailored: 0.95,
  slim: 0.85,
  tapered: 0.85,
  relaxed: 0.75,
  oversized: 0.7,
  boxy: 0.65,
  mixed: 0.72,
  structured: 0.88,
  regular: 0.78,
  ill_fitting: 0.3,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number(n.toFixed(4))));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function categoryToType(category: string): string {
  const map: Record<string, string> = {
    tops: 'top',
    activewear_tops: 'top',
    bottoms: 'bottom',
    activewear_bottoms: 'bottom',
    shoes: 'shoes',
    outerwear: 'outerwear',
    dresses: 'dress',
    formal: 'formal',
    accessories: 'accessory',
  };
  return map[category] ?? category;
}

function itemText(item: Pick<WardrobeItem, 'name' | 'category' | 'subcategory'>): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function inferFitLabel(
  items: WardrobeItem[],
  role: 'top' | 'bottom',
): string {
  const pool = items.filter((i) => {
    const cat = String(i.category || '');
    if (role === 'top') return /tops|activewear_tops|outerwear|dresses/.test(cat);
    return /bottoms|activewear_bottoms|dresses/.test(cat);
  });
  const text = pool.map(itemText).join(' ');
  if (/\b(oversized|baggy|wide leg|wide-leg|parachute|boxy)\b/.test(text)) return 'oversized';
  if (/\b(slim|skinny|fitted|tapered|tailored)\b/.test(text)) return 'slim';
  if (/\b(blazer|suit|dress shirt|oxford|trouser|chino)\b/.test(text)) return 'tailored';
  if (/\b(relaxed|loose|straight leg|comfort)\b/.test(text)) return 'relaxed';
  if (/\b(hoodie|sweatpant|jogger|track pant|legging)\b/.test(text)) return 'relaxed';
  return 'regular';
}

function fitQualityScore(topFit: string, bottomFit: string, silhouetteType: string): number {
  const topQ = FIT_QUALITY_MAP[topFit] ?? FIT_QUALITY_MAP.regular;
  const bottomQ = FIT_QUALITY_MAP[bottomFit] ?? FIT_QUALITY_MAP.regular;
  const silQ = FIT_QUALITY_MAP[silhouetteType] ?? FIT_QUALITY_MAP.mixed;
  if (topFit === 'oversized' && bottomFit === 'oversized' && silhouetteType !== 'oversized') {
    return FIT_QUALITY_MAP.ill_fitting;
  }
  return clamp01((topQ + bottomQ + silQ) / 3);
}

function labelFromFinalScore(score: number): OutfitQualityLabel {
  if (score >= 0.7) return 'good';
  if (score >= 0.4) return 'average';
  return 'bad';
}

function computeOccasionFit(
  occasion: OutfitOccasion | string | null,
  items: WardrobeItem[],
  ctx: ReturnType<typeof buildOutfitContext>,
): number {
  if (!occasion) return 0.8;

  const occ = occasion.toLowerCase();
  const text = items.map(itemText).join(' ');

  switch (occ) {
    case 'office':
    case 'work':
      if (/blazer|trouser|oxford|dress shirt|chino|loafer|derby|heel pump/.test(text) && !/hoodie|jogger|shorts|slides|flip flop/.test(text)) return 0.93;
      if (/track pant|tank top|gym shorts|slides/.test(text)) return 0.28;
      return ctx.maxTier >= 3 && ctx.tierSpread <= 2 ? 0.78 : 0.45;

    case 'gym':
    case 'workout':
      if (/jogger|legging|tank top|track pant|gym shorts|running|sneaker|trainer/.test(text) && !/blazer|oxford|heel|loafer|tie/.test(text)) return 0.92;
      if (/blazer|dress shoe|heel|suit/.test(text)) return 0.25;
      return 0.55;

    case 'date':
      if (/heel|slip dress|silk|blazer|dress shirt|loafer|chelsea|midi/.test(text) && ctx.tierSpread <= 2) return 0.9;
      if (/gym shorts|slides|hoodie|track pant/.test(text)) return 0.32;
      return 0.68;

    case 'travel':
      if (/jogger|hoodie|cargo|sneaker|trainer|comfort|denim|layer|backpack/.test(text) && ctx.tierSpread <= 2) return 0.88;
      if (/heel|formal|suit|blazer.*shorts/.test(text)) return 0.4;
      return 0.72;

    case 'event':
    case 'formal':
      if (ctx.maxTier >= 4 && /blazer|suit|dress|heel|oxford|loafer/.test(text)) return 0.94;
      if (ctx.minTier <= 2) return 0.3;
      return 0.6;

    case 'weekend':
    case 'casual':
    case 'casual-hangout':
      if (ctx.tierSpread <= 2) return 0.88;
      return 0.62;

    default:
      return 0.75;
  }
}

function computeStyleBreakdown(
  items: WardrobeItem[],
  aesthetic: ReturnType<typeof analyzeOutfitAesthetic>,
  regional: RegionalStyleContext | null,
  occasion: string | null,
  clash: OutfitClash | null,
  aestheticRejected: boolean,
  context: OutfitContextMeta | null,
): UnifiedStyleBreakdown {
  const ctx = buildOutfitContext(items, regional);

  let styleConsistency = aesthetic.purity;
  if (aesthetic.aestheticConflict) styleConsistency *= 0.45;
  if (aesthetic.unclearIdentity) styleConsistency *= 0.55;
  if (aesthetic.footwearBreaksIntent) styleConsistency *= 0.5;
  if (aestheticRejected) styleConsistency = Math.min(styleConsistency, 0.35);

  const formalityMatch = clamp01(1 - ctx.tierSpread / 4);
  const clashPenalty = clash
    ? clash.severity === 'fatal'
      ? 0.15
      : clash.severity === 'major'
        ? 0.35
        : clash.severity === 'moderate'
          ? 0.55
          : 0.75
    : 1;

  const occasionFit = computeOccasionFit(occasion, items, ctx);

  let STYLE_SCORE = clamp01(
    (0.5 * styleConsistency + 0.3 * formalityMatch * clashPenalty + 0.2 * occasionFit)
    * (aesthetic.confidence >= 0.65 ? 1 : 0.92),
  );

  if (context) {
    STYLE_SCORE = clamp01(
      STYLE_SCORE * (0.82 + 0.18 * context.season_fit) * (0.82 + 0.18 * context.brand_coherence),
    );
  }

  return {
    primary_style: aesthetic.primaryStyle,
    style_consistency: round2(styleConsistency),
    formality_match: round2(formalityMatch * clashPenalty),
    occasion_fit: round2(occasionFit),
    STYLE_SCORE: round2(STYLE_SCORE),
  };
}

function computeColorBreakdown(
  items: WardrobeItem[],
  primaryStyle: StyleArchetype | null,
  userSeason: string | null,
): UnifiedColorBreakdown {
  const harmony = scoreColorHarmony(items, primaryStyle, userSeason);
  const palette = [...new Set(items.map((i) => (i.color || 'unknown').toLowerCase()).filter(Boolean))];
  const harmonyBase = HARMONY_BASE[harmony.wheelRelationship] ?? 0.7;
  const contrastScore = clamp01(harmony.score / 100);

  let clashPenalty = 0;
  if (harmony.wheelRelationship === 'clashing') clashPenalty += 0.55;
  if (harmony.issues.includes('color_wheel_clash')) clashPenalty += 0.25;
  if (harmony.issues.includes('too_many_color_groups')) clashPenalty += 0.2;
  const loudCount = harmony.groups.filter((g) => g === 'loud').length;
  if (loudCount >= 1 && harmony.groups.filter((g) => g === 'warm').length >= 1) clashPenalty += 0.35;
  if (loudCount >= 1 || palette.length >= 3 && contrastScore < 0.45) clashPenalty += 0.25;
  if (contrastScore < 0.35) clashPenalty += 0.2;
  clashPenalty = clamp01(clashPenalty);

  const seasonalBoost = harmony.seasonalMatch != null
    ? harmony.seasonalMatch >= 75 ? 0.05 : harmony.seasonalMatch < 50 ? -0.08 : 0
    : 0;

  const blendedHarmony = clamp01(0.55 * harmonyBase + 0.45 * contrastScore);
  const COLOR_SCORE = clamp01(
    0.4 * blendedHarmony + 0.3 * contrastScore + 0.3 * (1 - clashPenalty) + seasonalBoost,
  );

  return {
    palette,
    harmony_type: harmony.wheelRelationship,
    contrast_score: round2(contrastScore),
    clash_penalty: round2(clashPenalty),
    seasonal_match: harmony.seasonalMatch,
    COLOR_SCORE: round2(COLOR_SCORE),
  };
}

function computeFitBreakdown(
  items: WardrobeItem[],
  primaryStyle: StyleArchetype | null,
): UnifiedFitBreakdown {
  const sil = scoreOutfitSilhouette(items, primaryStyle);
  const topFit = inferFitLabel(items, 'top');
  const bottomFit = inferFitLabel(items, 'bottom');
  const silhouetteBalance = clamp01(sil.proportionBalance / 10);
  const proportionScore = clamp01(sil.silhouetteShape / 10);
  const fitQuality = fitQualityScore(topFit, bottomFit, sil.silhouetteType);

  const FIT_SCORE = clamp01(
    0.4 * silhouetteBalance + 0.3 * proportionScore + 0.3 * fitQuality,
  );

  return {
    top_fit: topFit,
    bottom_fit: bottomFit,
    silhouette: sil.silhouetteType,
    proportion_score: round2(proportionScore),
    silhouette_balance: round2(silhouetteBalance),
    fit_quality: round2(fitQuality),
    FIT_SCORE: round2(FIT_SCORE),
  };
}

function buildFeedback(
  style: UnifiedStyleBreakdown,
  color: UnifiedColorBreakdown,
  fit: UnifiedFitBreakdown,
  clash: OutfitClash | null,
  aesthetic: ReturnType<typeof analyzeOutfitAesthetic>,
  context: UnifiedContextBreakdown | null,
): string[] {
  const lines: string[] = [];
  if (clash?.hint) lines.push(clash.hint);
  if (aesthetic.aestheticConflict && aesthetic.conflictReason) lines.push(aesthetic.conflictReason);
  if (aesthetic.footwearBreaksIntent) {
    lines.push('Footwear breaks the outfit\'s style intent');
  }
  if (aesthetic.unclearIdentity) {
    lines.push('Style inconsistency — pieces read like different wardrobes');
  }
  if (color.clash_penalty >= 0.4) {
    lines.push(`Color ${color.harmony_type.replace(/_/g, ' ')} — simplify palette or add a neutral anchor`);
  }
  if (fit.silhouette_balance < 0.55) {
    lines.push('Fit imbalance — balance fitted and relaxed pieces');
  }
  if (fit.fit_quality < 0.5) {
    lines.push('Proportions read off — avoid double oversized unless streetwear/athleisure');
  }
  if (style.formality_match < 0.5) {
    lines.push('Formality mismatch across items');
  }
  if (context) {
    if (context.season_fit < 0.5) {
      lines.push(`Season mismatch — this look reads ${context.season} but pieces feel off-season`);
    }
    if (context.brand_coherence < 0.55) {
      lines.push('Brand tier clash — mixing luxury with fast fashion reads unintentional');
    }
    if (style.occasion_fit < 0.5 && context.occasion) {
      lines.push(`Not ideal for ${context.occasion} — swap pieces to match the occasion`);
    }
  }
  return [...new Set(lines)].slice(0, 6);
}

export function computeUnifiedOutfitScore(
  items: WardrobeItem[],
  options?: {
    outfitId?: string;
    weights?: Partial<UnifiedOutfitWeights>;
    regional?: RegionalStyleContext | null;
    userSeason?: string | null;
    occasion?: string | null;
    context?: OutfitContextMeta | null;
    sourceLabel?: OutfitQualityLabel;
  },
): UnifiedOutfitScoreResult {
  const weights = { ...DEFAULT_UNIFIED_WEIGHTS, ...options?.weights };
  const aesthetic = analyzeOutfitAesthetic(items);
  const aestheticRejection = evaluateAestheticRejection(items);
  const clash = detectOutfitClashes(items, options?.regional ?? null);

  const occasion = options?.context?.occasion ?? options?.occasion ?? null;
  const userSeason = options?.userSeason
    ?? (options?.context?.season ? options.context.season : null);

  const style = computeStyleBreakdown(
    items,
    aesthetic,
    options?.regional ?? null,
    occasion,
    clash,
    Boolean(aestheticRejection),
    options?.context ?? null,
  );
  const color = computeColorBreakdown(items, aesthetic.primaryStyle, userSeason);
  const fit = computeFitBreakdown(items, aesthetic.primaryStyle);

  let finalScore = clamp01(
    weights.style * style.STYLE_SCORE
    + weights.color * color.COLOR_SCORE
    + weights.fit * fit.FIT_SCORE,
  );

  let hardCap: number | undefined;
  if (aestheticRejection) {
    hardCap = aestheticRejection.scoreCap / 100;
    finalScore = Math.min(finalScore, hardCap);
  } else if (clash && (clash.severity === 'fatal' || clash.severity === 'major')) {
    hardCap = (clash.severity === 'fatal' ? 35 : 40) / 100;
    finalScore = Math.min(finalScore, hardCap);
  }

  const contextBlock: UnifiedContextBreakdown = options?.context
    ? {
      season: options.context.season,
      occasion: options.context.occasion,
      brand_tiers: options.context.brand_tiers,
      brand_coherence: options.context.brand_coherence,
      season_fit: options.context.season_fit,
    }
    : {
      season: 'all-season',
      occasion: 'casual',
      brand_tiers: [],
      brand_coherence: 0.8,
      season_fit: 0.85,
    };

  const feedback = buildFeedback(style, color, fit, clash, aesthetic, contextBlock);

  const brandTiers = options?.context?.brand_tiers ?? [];

  const record: UnifiedOutfitRecord = {
    outfit_id: options?.outfitId ?? `O-${Date.now()}`,
    items: items.map((item, idx) => ({
      type: categoryToType(item.category),
      name: item.name,
      color: item.color,
      ...(brandTiers[idx] ? { brand_tier: brandTiers[idx] } : {}),
      ...(item.seasons?.length ? { seasons: item.seasons as ClothingSeason[] } : {}),
    })),
    context: contextBlock,
    style,
    color,
    fit,
    final_score: round2(finalScore),
    label: labelFromFinalScore(finalScore),
    feedback,
    ...(options?.sourceLabel ? { source_label: options.sourceLabel } : {}),
    ...(hardCap != null ? { hard_cap: round2(hardCap) } : {}),
    ...(clash?.id ? { clash_id: clash.id } : {}),
  };

  return {
    record,
    weights,
    clash,
    rejected: Boolean(aestheticRejection),
  };
}

/** Map a unified record to flat ML features (tabular baseline). */
export function unifiedRecordToFeatures(record: UnifiedOutfitRecord): Record<string, number | string> {
  return {
    outfit_id: record.outfit_id,
    season: record.context.season,
    occasion: record.context.occasion,
    brand_coherence: record.context.brand_coherence,
    season_fit: record.context.season_fit,
    style_score: record.style.STYLE_SCORE,
    color_score: record.color.COLOR_SCORE,
    fit_score: record.fit.FIT_SCORE,
    style_consistency: record.style.style_consistency,
    formality_match: record.style.formality_match,
    occasion_fit: record.style.occasion_fit,
    contrast_score: record.color.contrast_score,
    clash_penalty: record.color.clash_penalty,
    harmony_type: record.color.harmony_type,
    proportion_score: record.fit.proportion_score,
    silhouette_balance: record.fit.silhouette_balance,
    fit_quality: record.fit.fit_quality,
    final_score: record.final_score,
    label: record.label,
    ...(record.source_label ? { source_label: record.source_label } : {}),
  };
}
