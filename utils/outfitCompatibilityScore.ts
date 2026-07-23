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

export type { OutfitClash, FormalityTier, ItemSignals } from '@/utils/outfitClashRules';
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
): OutfitScoreResult {
  if (selected.length === 0) {
    return { score: 0, hint: 'Swipe rows to build a look' };
  }

  if (selected.length === 1) {
    return { score: 28, hint: 'Add more pieces to score the outfit' };
  }

  const aesthetic = analyzeOutfitAesthetic(selected);

  const primaryClash = detectOutfitClashes(selected, regional);
  const isHardClash = primaryClash?.severity === 'fatal' || primaryClash?.severity === 'major';

  if (primaryClash && isHardClash) {
    const extra = collectSecondaryClashPenalty(selected, primaryClash, regional);
    const cap = primaryClash.severity === 'fatal' ? 35 : 40;
    const score = Math.min(clashToScore(primaryClash.penalty, extra), cap);
    return {
      score,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
      severity: primaryClash.severity,
      aesthetic,
      hardCap: cap,
    };
  }

  const aestheticRejection = evaluateAestheticRejection(selected);
  if (aestheticRejection) {
    return {
      score: aestheticRejection.scoreCap,
      hint: aestheticRejection.hint,
      clashId: aestheticRejection.clashId,
      severity: aestheticRejection.severity,
      aesthetic: aestheticRejection.analysis,
      hardCap: aestheticRejection.scoreCap,
    };
  }

  if (primaryClash) {
    const extra = collectSecondaryClashPenalty(selected, primaryClash, regional);
    const score = clashToScore(primaryClash.penalty, extra);
    return {
      score,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
      severity: primaryClash.severity,
      aesthetic,
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
  });
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

  return {
    score,
    hint,
    aesthetic,
    colorHarmony,
    silhouette,
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
