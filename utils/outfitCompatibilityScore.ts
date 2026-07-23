import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { RegionalStyleContext } from '@/utils/outfitRegionalContext';
import { isIntentionalSmartCasualTrainerLook, DEFAULT_SMART_CASUAL_REGIONAL } from '@/utils/outfitRegionalContext';
import { scoreColorHarmony, type ColorHarmonyResult } from '@/utils/outfitColorHarmony';
import { scoreOutfitSilhouette, type SilhouetteScoreResult } from '@/utils/outfitSilhouetteScore';
import {
  analyzeOutfitAesthetic,
  evaluateAestheticRejection,
  styleArchetypeLabel,
  type OutfitAestheticAnalysis,
} from '@/utils/outfitAestheticClassifier';
import {
  clashToScore,
  collectSecondaryClashPenalty,
  detectOutfitClashes,
  localScoreLooksLikeClash,
} from '@/utils/outfitClashRules';
import {
  buildDeterministicItemNotes,
  isMajorConfusedLook,
  sanitizeHintForScore,
  selectAnalysisHint,
  type ItemAnalysisNote,
} from '@/utils/outfitAnalysisStatements';
import {
  evaluateStyleCoherence,
  type DetectedSignals,
  type CoherenceBreakdown,
} from '@/utils/styleCoherenceEngine';
import {
  scoreOutfitSubtypeCompatibility,
  scoreStyleProfileBias,
  detectSubtypeConflicts,
} from '@/utils/garmentTaxonomy';
import {
  resolveOutfitIntent,
  scoreOutfitIntentBias,
} from '@/utils/outfitIntent';
import {
  buildStylistAnalysis,
  type StylistAnalysis,
} from '@/utils/stylistVoiceEngine';
import {
  weatherOuterwearScoreAdjustment,
  type WeatherLike,
} from '@/utils/weatherOuterwear';
import { isOuterwearItem } from '@/utils/completeOutfit';

export type { OutfitClash, FormalityTier, ItemSignals } from '@/utils/outfitClashRules';
export type { DetectedSignals, StyleLane, FootwearClass } from '@/utils/styleCoherenceEngine';
export {
  getStyleLane,
  classifyFootwear,
  evaluateStyleCoherence,
  serializeDetectedSignals,
} from '@/utils/styleCoherenceEngine';
export type { StylistAnalysis, StylistTone, StylistItemNote } from '@/utils/stylistVoiceEngine';
export { buildStylistAnalysis, stylistAnalysisToItemNotes } from '@/utils/stylistVoiceEngine';
export {
  classifyItem,
  detectOutfitClashes,
  isAthleticFootwear,
  isAthleticTop,
  isBlazerItem,
  isBootFootwear,
  isCasualTrainer,
  isShortsItem,
  buildOutfitContext,
} from '@/utils/outfitClashRules';

export type { OutfitAestheticAnalysis, StyleArchetype } from '@/utils/outfitAestheticClassifier';
export {
  analyzeOutfitAesthetic,
  evaluateAestheticRejection,
  classifyItemAesthetics,
} from '@/utils/outfitAestheticClassifier';

export interface OutfitScoreResult {
  score: number;
  hint: string;
  clashId?: string;
  severity?: 'fatal' | 'major' | 'moderate' | 'minor';
  aesthetic?: OutfitAestheticAnalysis;
  colorHarmony?: ColorHarmonyResult;
  silhouette?: SilhouetteScoreResult;
  hardCap?: number;
  /** Style Coherence Engine signals — authority for stylist voice. */
  signals?: DetectedSignals;
  coherence?: CoherenceBreakdown;
  stylistAnalysis?: StylistAnalysis;
  footwearScore?: number;
  tailoringClash?: boolean;
}

export type OutfitApiScoreResult = {
  score: number;
  hardRuleViolations?: string[];
  hardCapApplied?: string | null;
  verdict?: string;
  analysis?: string;
  headline?: string;
  explanations?: string[];
  improvements?: string[];
  unifiedScoreApplied?: boolean;
  dimensions?: Record<string, number>;
  usedFallback?: boolean;
};

export type MergedOutfitScore = {
  score: number;
  hint: string;
  headline: string | null;
  dimensions: Record<string, number> | null;
  explanations: string[];
  aiApplied: boolean;
  itemNotes?: ItemAnalysisNote[];
};

export type { ItemAnalysisNote };
export { buildDeterministicItemNotes, sanitizeHintForScore, selectAnalysisHint, isMajorConfusedLook };

const CASUAL_CATEGORIES = new Set([
  'activewear', 'activewear_tops', 'activewear_bottoms', 'sleepwear', 'swimwear',
]);

function isAestheticRejection(result: OutfitScoreResult): boolean {
  return Boolean(
    result.hardCap != null
    || result.clashId?.startsWith('aesthetic_')
    || (result.severity === 'fatal' && result.aesthetic?.aestheticConflict),
  );
}

/**
 * Taste-first local score: rejection gate → clash rules → earn points from 50 baseline.
 * Neutral + complete is NOT enough to reach 70+ without coherent identity.
 */
export function computeLocalOutfitScore(
  selected: WardrobeItem[],
  regional: RegionalStyleContext | null = null,
  userSeason: string | null = null,
  userProfile: { stylePreference?: string | null; lifestyle?: string | null } | null = null,
  options: {
    occasion?: string | null;
    dressFor?: string | null;
    query?: string | null;
    intent?: string | null;
    source?: string | null;
    weather?: WeatherLike | null;
  } = {},
): OutfitScoreResult {
  if (selected.length === 0) {
    return { score: 0, hint: 'Swipe rows to build a look' };
  }

  if (selected.length === 1) {
    return { score: 28, hint: 'Add more pieces to score the outfit' };
  }

  const aesthetic = analyzeOutfitAesthetic(selected);
  const coherence = evaluateStyleCoherence(selected);
  const resolvedIntent = resolveOutfitIntent({
    occasion: options.occasion,
    dressFor: options.dressFor,
    query: options.query,
    intent: options.intent,
    source: options.source || 'outfit_mix',
  });
  const signals: DetectedSignals = {
    ...coherence.signals,
    intent: resolvedIntent.name,
    intentLabel: resolvedIntent.intent?.label || resolvedIntent.name,
  };

  const primaryClash = detectOutfitClashes(selected, regional);
  const isHardClash = primaryClash?.severity === 'fatal' || primaryClash?.severity === 'major';

  // Style Coherence hard caps (multi-lane nuke, invalid 2-lane, tailoring, footwear)
  // Prefer the lower of clash-rule score vs coherence cap so both authorities hold.
  // Specific garment clash ids win for clashId/hint when fatal/major rules also fire.
  if (coherence.mode === 'hard_cap' && coherence.hardCap != null) {
    let score = coherence.hardCap;
    let hint = coherence.hint || primaryClash?.hint || 'Style lanes conflict';
    let clashId = coherence.clashId || primaryClash?.id;
    let severity: OutfitScoreResult['severity'] = coherence.severity || primaryClash?.severity || 'major';

    if (primaryClash && isHardClash) {
      const extra = collectSecondaryClashPenalty(selected, primaryClash, regional);
      const clashCap = primaryClash.severity === 'fatal' ? 35 : 40;
      const clashScore = Math.min(clashToScore(primaryClash.penalty, extra), clashCap);
      score = Math.min(score, clashScore);
      // Always prefer specific garment clash identity over generic coherence ids
      hint = primaryClash.hint;
      clashId = primaryClash.id;
      severity = primaryClash.severity;
    }

    const stylistAnalysis = buildStylistAnalysis(selected, {
      score,
      signals,
      aesthetic,
      hint,
      clashId,
    });

    return {
      score,
      hint,
      clashId,
      severity,
      aesthetic,
      hardCap: Math.min(coherence.hardCap, score),
      signals,
      coherence,
      stylistAnalysis,
      footwearScore: coherence.footwearScore,
      tailoringClash: coherence.tailoringClash || signals.tailoringClash,
    };
  }

  if (primaryClash && isHardClash) {
    const extra = collectSecondaryClashPenalty(selected, primaryClash, regional);
    const cap = primaryClash.severity === 'fatal' ? 35 : 40;
    const score = Math.min(clashToScore(primaryClash.penalty, extra), cap);
    const stylistAnalysis = buildStylistAnalysis(selected, {
      score,
      signals,
      aesthetic,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
    });
    return {
      score,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
      severity: primaryClash.severity,
      aesthetic,
      hardCap: cap,
      signals,
      coherence,
      stylistAnalysis,
      footwearScore: coherence.footwearScore,
      tailoringClash: signals.tailoringClash,
    };
  }

  const aestheticRejection = evaluateAestheticRejection(selected);
  if (aestheticRejection) {
    const score = aestheticRejection.scoreCap;
    const stylistAnalysis = buildStylistAnalysis(selected, {
      score,
      signals,
      aesthetic: aestheticRejection.analysis,
      hint: aestheticRejection.hint,
      clashId: aestheticRejection.clashId,
    });
    return {
      score,
      hint: aestheticRejection.hint,
      clashId: aestheticRejection.clashId,
      severity: aestheticRejection.severity,
      aesthetic: aestheticRejection.analysis,
      hardCap: aestheticRejection.scoreCap,
      signals,
      coherence,
      stylistAnalysis,
      footwearScore: coherence.footwearScore,
      tailoringClash: signals.tailoringClash,
    };
  }

  if (primaryClash) {
    const extra = collectSecondaryClashPenalty(selected, primaryClash, regional);
    let score = clashToScore(primaryClash.penalty, extra);
    // Soft coherence may only tighten further — never inflate a clash score
    if (coherence.mode === 'adjust' && coherence.scoreImpact < 0) {
      score = Math.max(5, Math.min(94, score + coherence.scoreImpact));
    }
    const stylistAnalysis = buildStylistAnalysis(selected, {
      score,
      signals,
      aesthetic,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
    });
    return {
      score,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
      severity: primaryClash.severity,
      aesthetic,
      signals,
      coherence,
      stylistAnalysis,
      footwearScore: coherence.footwearScore,
      tailoringClash: signals.tailoringClash,
    };
  }

  let score = 50;
  const categories = new Set(selected.map((item) => item.category));

  const hasTop = categories.has('tops') || categories.has('activewear_tops');
  const hasBottom = categories.has('bottoms') || categories.has('activewear_bottoms');
  const hasDress = categories.has('dresses');
  const hasShoes = categories.has('shoes');
  const hasOuterwear = categories.has('outerwear');

  if (aesthetic.coherentAthleisureUniform) score += 6;

  // ── Coherence (identity + footwear) ─────────────────────────────────────
  if (aesthetic.purity >= 0.78) score += 14;
  else if (aesthetic.purity >= 0.65) score += 8;
  else if (aesthetic.purity < 0.55) score -= 12;

  if (aesthetic.confidence >= 0.72) score += 6;
  else if (aesthetic.confidence < 0.5) score -= 8;

  if (aesthetic.primaryStyle) {
    score += 4;
  }

  if (!aesthetic.footwearBreaksIntent && hasShoes) score += 6;

  // Style Coherence soft adjust (footwearScore + lane purity bonuses)
  if (coherence.mode === 'adjust') {
    score += coherence.scoreImpact;
  }

  // Subtype worksWith/avoidWith soft pairing + style profile + outfit intent bias
  try {
    const subtypeScore = scoreOutfitSubtypeCompatibility(selected, {
      occasion: options.occasion || undefined,
    });
    score += Math.max(-3, Math.min(3, Math.round(subtypeScore.adjustment * 0.25)));
    if (userProfile) {
      const profileBias = scoreStyleProfileBias(selected, userProfile);
      score += Math.max(-4, Math.min(4, profileBias.adjustment));
    }
    const intentBias = scoreOutfitIntentBias(selected, {
      occasion: options.occasion,
      dressFor: options.dressFor,
      query: options.query,
      intent: resolvedIntent.name,
      source: options.source || 'outfit_mix',
    });
    score += Math.max(-5, Math.min(6, Math.round(intentBias.adjustment * 0.5)));
  } catch {
    // optional
  }

  // ── Execution (earned, not passive) ───────────────────────────────────
  if (hasDress && !hasBottom) score += 6;
  else if (hasTop && hasBottom) score += 5;
  else score -= 10;

  if (!hasShoes) score -= 8;

  const colorHarmony = scoreColorHarmony(selected, aesthetic.primaryStyle, userSeason);
  const silhouette = scoreOutfitSilhouette(selected, aesthetic.primaryStyle);
  score += colorHarmony.adjustment;
  score += silhouette.adjustment;

  const uniqueColors = new Set(selected.map((item) => item.color).filter(Boolean));

  if (hasOuterwear && selected.length >= 3) score += 3;

  const seasons = selected.flatMap((item) => item.seasons || []);
  if (seasons.length > 0) {
    const seasonSet = new Set(seasons);
    if (seasonSet.size >= 4) score -= 8;
  }

  if (hasDress && hasBottom) score -= 22;
  if (categories.has('formal') && [...categories].some((cat) => CASUAL_CATEGORIES.has(cat))) score -= 20;

  const allowsSmartCasualTrainers = isIntentionalSmartCasualTrainerLook(selected, regional)
    || (regional == null && isIntentionalSmartCasualTrainerLook(selected, DEFAULT_SMART_CASUAL_REGIONAL));

  if (allowsSmartCasualTrainers) {
    score += 10;
  }

  score = Math.max(5, Math.min(94, Math.round(score)));

  // Confused multi-lane looks must not sit near 80% — align % with feedback severity.
  // Only major multi-lane confusion (not soft blazer + lifestyle trainers).
  const majorConfused = isMajorConfusedLook(aesthetic, {
    allowsSmartCasualTrainers,
    clashId: primaryClash?.id,
  }) || signals.multiLaneChaos;
  if (majorConfused) {
    score = Math.min(score, 58);
  }

  let hint = selectAnalysisHint({
    score,
    hasShoes,
    hasCompleteBase: hasDress || (hasTop && hasBottom),
    allowsSmartCasualTrainers,
    majorConfused,
    primaryClash,
    aesthetic,
    colorSummary: colorHarmony.summary,
    colorScore: colorHarmony.score,
    silhouetteOverall: silhouette.overall,
    uniqueColorCount: uniqueColors.size,
  });

  hint = sanitizeHintForScore(hint, score, {
    clashId: primaryClash?.id,
    severity: primaryClash?.severity,
  });

  // Weather outerwear: hard-cap illegal heavy layers when temp known; skip if no temp
  const weatherAdj = weatherOuterwearScoreAdjustment(selected, options.weather || null);
  if (weatherAdj <= -40) {
    score = Math.min(score, 35);
    if (selected.some((i) => isOuterwearItem(i))) {
      hint = 'Heavy outerwear does not match current temperature — drop the fleece/puffer for heat.';
    }
  } else if (weatherAdj !== 0) {
    score = Math.max(5, Math.min(94, score + Math.round(weatherAdj / 5)));
  }

  // Soft favorites boost
  const favCount = selected.filter((i) => i.isFavorite).length;
  if (favCount > 0 && weatherAdj > -40) {
    score = Math.min(94, score + Math.min(favCount * 2, 6));
  }

  const stylistAnalysis = buildStylistAnalysis(selected, {
    score,
    signals,
    aesthetic,
    hint,
    clashId: primaryClash?.id,
    intent: resolvedIntent.name,
  });

  // Prefer stylist summary when signals drove a clearer read than band templates
  if (stylistAnalysis.overallTone === 'excellent' || stylistAnalysis.overallTone === 'good') {
    hint = stylistAnalysis.summary;
  } else if (signals.laneConflict || signals.footwearMismatch || signals.tailoringClash) {
    hint = stylistAnalysis.summary;
  }

  return {
    score,
    hint,
    aesthetic,
    colorHarmony,
    silhouette,
    signals,
    coherence,
    stylistAnalysis,
    footwearScore: coherence.footwearScore,
    tailoringClash: signals.tailoringClash,
  };
}

export function mergeOutfitScores(
  local: OutfitScoreResult,
  api: OutfitApiScoreResult | null,
  options?: { allowsSmartCasualTrainers?: boolean },
): MergedOutfitScore {
  if (!api || typeof api.score !== 'number' || Number.isNaN(api.score)) {
    return {
      score: local.score,
      hint: local.hint,
      headline: local.aesthetic?.primaryStyle
        ? styleArchetypeLabel(local.aesthetic.primaryStyle)
        : null,
      dimensions: null,
      explanations: local.aesthetic?.conflictReason ? [local.aesthetic.conflictReason] : [],
      aiApplied: false,
    };
  }

  const aiScore = Math.round(Math.max(0, Math.min(100, api.score)));
  const violations = api.hardRuleViolations || [];
  const hasHardCap = Boolean(api.hardCapApplied) || violations.length > 0;
  const apiFallback = api.usedFallback === true || (aiScore === 50 && !api.verdict && !violations.length);
  const localIsClash = localScoreLooksLikeClash(local.score, local.hint);
  const fatalOrMajor = local.severity === 'fatal' || local.severity === 'major';
  const tasteRejection = isAestheticRejection(local);
  const regionalSmartCasual = options?.allowsSmartCasualTrainers
    && (local.clashId === 'blazer_trainers' || local.severity === 'moderate')
    && !fatalOrMajor
    && !tasteRejection;

  let finalScore: number;
  const unifiedApplied = api.unifiedScoreApplied === true;
  if (unifiedApplied && !apiFallback && !tasteRejection) {
    // When the server ran the unified (context-aware) engine, prioritize it for UX consistency.
    finalScore = local.hardCap != null ? Math.min(aiScore, local.hardCap) : aiScore;
    if (fatalOrMajor) finalScore = Math.min(finalScore, local.score);
    // Don't let unified AI pull weak/confused local scores into the 80s
    else if (local.score < 70) finalScore = Math.min(finalScore, local.score + 8);
  } else if (apiFallback || tasteRejection) {
    finalScore = local.hardCap != null
      ? Math.min(local.score, local.hardCap)
      : local.score;
  } else if (hasHardCap || fatalOrMajor) {
    finalScore = Math.min(aiScore, local.score, local.hardCap ?? (fatalOrMajor ? 35 : 40));
  } else if (localIsClash && !regionalSmartCasual) {
    finalScore = Math.min(aiScore, local.score, local.hardCap ?? 45);
  } else if (/confused|style lane|incompatible style/i.test(local.hint)) {
    // Keep confused-lane feedback honest — never let AI pull these into the 70–80s
    finalScore = Math.min(aiScore, local.score, local.hardCap ?? 58);
  } else if (local.score < 50) {
    finalScore = Math.min(aiScore, local.score + 5);
  } else {
    const blended = Math.round((local.score * 0.6) + (aiScore * 0.4));
    finalScore = aiScore - local.score > 18
      ? Math.min(blended, local.score + 8)
      : blended;
  }

  const violationHint = violations[0] || api.improvements?.[0];
  const honestHint =
    finalScore < 55
      ? (local.hint || api.analysis || api.verdict || violationHint || 'Needs refinement')
      : (api.verdict || api.explanations?.[0] || api.analysis || local.hint);

  let hint =
    (tasteRejection || finalScore < 55) && local.hint
      ? local.hint
      : api.headline && finalScore >= 70 && !violationHint && !localIsClash && !tasteRejection
        ? api.headline
        : (honestHint || local.hint);

  hint = sanitizeHintForScore(hint, finalScore, {
    clashId: local.clashId,
    severity: local.severity,
    fallbackPraise: local.hint && !/refine footwear|confused|style lane/i.test(local.hint)
      ? local.hint
      : undefined,
  });

  // At excellent scores, prefer local praise over AI "improve X" nags
  if (finalScore >= 90 && /refine|improve|swap|confused|needs work/i.test(hint) && local.hint) {
    const localClean = sanitizeHintForScore(local.hint, finalScore, {
      clashId: local.clashId,
      severity: local.severity,
    });
    if (!/refine footwear|confused/i.test(localClean)) {
      hint = localClean;
    }
  }

  return {
    score: finalScore,
    hint,
    headline: tasteRejection ? null : (api.verdict || null),
    dimensions: api.dimensions || null,
    explanations: [
      ...(local.aesthetic?.conflictReason ? [local.aesthetic.conflictReason] : []),
      ...violations,
      ...(api.explanations || []),
      ...(api.improvements || []),
    ].filter(Boolean),
    aiApplied: !apiFallback && !tasteRejection,
  };
}
