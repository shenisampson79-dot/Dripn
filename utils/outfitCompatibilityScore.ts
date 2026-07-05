import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { RegionalStyleContext } from '@/utils/outfitRegionalContext';
import { isIntentionalSmartCasualTrainerLook } from '@/utils/outfitRegionalContext';
import {
  clashToScore,
  collectSecondaryClashPenalty,
  detectOutfitClashes,
  localScoreLooksLikeClash,
  scoreHintForValue,
} from '@/utils/outfitClashRules';

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

export interface OutfitScoreResult {
  score: number;
  hint: string;
  clashId?: string;
  severity?: 'fatal' | 'major' | 'moderate' | 'minor';
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
};

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'gray', 'navy', 'beige', 'cream', 'denim', 'brown', 'multicolor',
]);

const CASUAL_CATEGORIES = new Set([
  'activewear', 'activewear_tops', 'activewear_bottoms', 'sleepwear', 'swimwear',
]);

export function computeLocalOutfitScore(
  selected: WardrobeItem[],
  regional: RegionalStyleContext | null = null,
): OutfitScoreResult {
  if (selected.length === 0) {
    return { score: 0, hint: 'Swipe rows to build a look' };
  }

  if (selected.length === 1) {
    return { score: 28, hint: 'Add more pieces to score the outfit' };
  }

  const primaryClash = detectOutfitClashes(selected, regional);
  if (primaryClash) {
    const extra = collectSecondaryClashPenalty(selected, primaryClash, regional);
    const score = clashToScore(primaryClash.penalty, extra);
    return {
      score,
      hint: primaryClash.hint,
      clashId: primaryClash.id,
      severity: primaryClash.severity,
    };
  }

  let score = 42;
  const categories = new Set(selected.map((item) => item.category));
  const names = selected.map((item) => (item.name || '').toLowerCase()).join(' ');

  const hasTop = categories.has('tops') || categories.has('activewear_tops');
  const hasBottom = categories.has('bottoms') || categories.has('activewear_bottoms');
  const hasDress = categories.has('dresses');
  const hasShoes = categories.has('shoes');
  const hasOuterwear = categories.has('outerwear');

  if (hasDress && !hasBottom) score += 14;
  else if (hasTop && hasBottom) score += 16;
  else if (hasTop || hasBottom) score += 4;

  if (hasShoes) score += 8;
  if (hasOuterwear && selected.length >= 3) score += 5;
  if (selected.length >= 4) score += 4;
  if (selected.length >= 5) score += 2;

  const colors = selected.map((item) => item.color).filter(Boolean) as string[];
  const uniqueColors = new Set(colors);
  if (uniqueColors.size <= 2) score += 12;
  else if (uniqueColors.size <= 3) score += 7;
  else if (uniqueColors.size === 4) score += 2;
  else if (uniqueColors.size >= 5) score -= 18;

  const neutralCount = colors.filter((color) => NEUTRAL_COLORS.has(color)).length;
  if (neutralCount >= 2) score += 5;
  else if (neutralCount === 1) score += 2;

  const seasons = selected.flatMap((item) => item.seasons || []);
  if (seasons.length > 0) {
    const seasonSet = new Set(seasons);
    if (seasonSet.size <= 2 || seasonSet.has('all-season')) score += 4;
    if (seasonSet.size >= 4) score -= 10;
  }

  if (hasDress && hasBottom) score -= 22;
  if (categories.has('formal') && [...categories].some((cat) => CASUAL_CATEGORIES.has(cat))) score -= 26;

  const fingerprint = selected
    .map((item) => `${item.category}:${item.color}:${(item.name || '').length % 7}`)
    .join('|');
  const variance = fingerprint.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 9;
  score += variance - 4;

  if (isIntentionalSmartCasualTrainerLook(selected, regional)) {
    score += 14;
  }

  score = Math.max(5, Math.min(100, Math.round(score)));

  const smartCasualHint = isIntentionalSmartCasualTrainerLook(selected, regional)
    ? 'Smart-casual look — tailored pieces with fashion trainers read intentional'
    : scoreHintForValue(score);

  return {
    score,
    hint: smartCasualHint,
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
      headline: null,
      dimensions: null,
      explanations: [],
      aiApplied: false,
    };
  }

  const aiScore = Math.round(Math.max(0, Math.min(100, api.score)));
  const violations = api.hardRuleViolations || [];
  const hasHardCap = Boolean(api.hardCapApplied) || violations.length > 0;
  const apiFallback = api.usedFallback === true || (aiScore === 50 && !api.verdict && !violations.length);
  const localIsClash = localScoreLooksLikeClash(local.score, local.hint);
  const fatalOrMajor = local.severity === 'fatal' || local.severity === 'major';
  const regionalSmartCasual = options?.allowsSmartCasualTrainers
    && (local.clashId === 'blazer_trainers' || local.severity === 'moderate')
    && !fatalOrMajor;

  let finalScore: number;
  if (apiFallback) {
    finalScore = local.score;
  } else if (hasHardCap || fatalOrMajor) {
    finalScore = Math.min(aiScore, local.score, fatalOrMajor ? 35 : 40);
  } else if (localIsClash && !regionalSmartCasual) {
    finalScore = Math.min(aiScore, local.score);
  } else {
    const blended = Math.round((aiScore * 0.45) + (local.score * 0.55));
    finalScore = aiScore - local.score > 20
      ? Math.min(blended, local.score + 10)
      : blended;
  }

  const violationHint = violations[0] || api.improvements?.[0];
  const honestHint =
    finalScore < 55
      ? (local.hint || api.analysis || api.verdict || violationHint || 'Needs refinement')
      : (api.verdict || api.explanations?.[0] || api.analysis || local.hint);

  const hint =
    api.headline && finalScore >= 70 && !violationHint && !localIsClash
      ? api.headline
      : (honestHint || local.hint);

  return {
    score: finalScore,
    hint,
    headline: api.verdict || null,
    dimensions: api.dimensions || null,
    explanations: [
      ...violations,
      ...(api.explanations || []),
      ...(api.improvements || []),
    ].filter(Boolean),
    aiApplied: !apiFallback,
  };
}
