/**
 * Outfit Mix analysis statement inventory + score-band ↔ copy alignment.
 *
 * Authority: deterministic clash/score owns the %. Copy must match severity —
 * never nag "refine footwear" / "confused" on excellent looks.
 *
 * Inventory snapshot (keep in sync via getAnalysisStatementInventory()):
 * - Band templates (praise / polish / conflict / lane-commit)
 * - Contextual templates (incomplete, footwear intent, etc.)
 * - Clash-rule hints (from CLASH_RULES)
 * - Aesthetic rejection hints
 *
 * @see scripts/verify-outfit-score.ts — asserts inventory count + band guards
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { styleArchetypeLabel, type OutfitAestheticAnalysis } from '@/utils/outfitAestheticClassifier';
import {
  CLASH_RULES,
  detectAllOutfitClashes,
  type OutfitClash,
} from '@/utils/outfitClashRules';

export const SCORE_BANDS = {
  excellent: { id: 'excellent', min: 90, label: 'Excellent' },
  strong: { id: 'strong', min: 80, label: 'Strong' },
  mixed: { id: 'mixed', min: 65, label: 'Mixed' },
  poor: { id: 'poor', min: 0, label: 'Poor' },
} as const;

export type ScoreBandId = keyof typeof SCORE_BANDS;

/** Fixed band / contextual templates shown as Style match captions. */
export const BAND_STATEMENT_TEMPLATES = [
  { id: 'band_excellent_cohesive', band: 'excellent', text: 'Cohesive look — pieces sit in the same style lane' },
  { id: 'band_excellent_praise', band: 'excellent', text: 'Excellent combo — polished and intentional' },
  { id: 'band_excellent_archetype', band: 'excellent', text: 'Intentional {archetype} — reads cohesive end to end' },
  { id: 'band_strong_solid', band: 'strong', text: 'Strong outfit' },
  { id: 'band_strong_polish', band: 'strong', text: 'Strong base — optional polish: {softClash}' },
  { id: 'band_mixed_conflict', band: 'mixed', text: '{conflict}' },
  { id: 'band_mixed_palette', band: 'mixed', text: 'Acceptable colour story — simplify to 2–3 tones' },
  { id: 'band_mixed_silhouette', band: 'mixed', text: 'Proportions read off — balance fitted and relaxed pieces' },
  { id: 'band_poor_lane', band: 'poor', text: 'Commit to one style lane — swap the piece that breaks the story' },
  { id: 'band_poor_editorial', band: 'poor', text: 'This outfit lacks editorial clarity — swap the piece that breaks the style story' },
] as const;

export const CONTEXTUAL_STATEMENT_TEMPLATES = [
  { id: 'ctx_empty', text: 'Swipe rows to build a look' },
  { id: 'ctx_single', text: 'Add more pieces to score the outfit' },
  { id: 'ctx_no_shoes', text: "Add occasion-appropriate footwear — shoes define the outfit's intent" },
  { id: 'ctx_incomplete_base', text: 'Add the missing top or bottom so the silhouette reads as a complete outfit' },
  { id: 'ctx_confused_major', text: 'This look reads confused — commit to one style lane (athleisure, smart casual, tailoring, etc.)' },
  { id: 'ctx_smart_casual_trainers', text: 'Intentional {archetype} — tailored pieces with clean fashion trainers read cohesive' },
  { id: 'ctx_soft_footwear_polish', text: '{softClash}' },
  { id: 'ctx_competing_colours', text: 'Reduce competing colours or repeat one accent to unify the palette' },
  // Legacy (suppressed at excellent scores — kept for inventory / migration tests)
  { id: 'legacy_refine_footwear', text: 'Solid {archetype} base — refine footwear or one finishing detail to elevate', deprecated: true },
] as const;

export const AESTHETIC_STATEMENT_TEMPLATES = [
  { id: 'aesthetic_conflict', text: 'Outfit mixes incompatible style worlds — pick one aesthetic lane' },
  { id: 'aesthetic_footwear_breaks_intent', text: "Footwear breaks the outfit's style intent — athleisure needs trainers; polished boots need tailored or smart-casual bases" },
  { id: 'aesthetic_unclear_identity', text: 'Outfit lacks a clear style identity — pieces read like they were grabbed from different wardrobes' },
  { id: 'aesthetic_confused_lanes', text: 'This look reads confused — commit to one style lane (athleisure, smart casual, tailoring, etc.)' },
] as const;

const REFINE_FOOTWEAR_RE = /refine footwear|finishing detail to elevate/i;
const CONFUSED_LANE_RE = /reads confused|commit to one style lane|incompatible style worlds|different style worlds/i;
const HARD_FOOTWEAR_CLASH_IDS = new Set([
  'blazer_chunky_trainers',
  'trainers_suit',
  'athletic_formal_shoes',
  'athletic_boots',
  'athletic_boots_shorts',
  'athletic_heels',
  'joggers_dressy_boots',
  'formal_shoes_athletic',
  'aesthetic_footwear_breaks_intent',
]);

export function scoreBandForValue(score: number): ScoreBandId {
  if (score >= SCORE_BANDS.excellent.min) return 'excellent';
  if (score >= SCORE_BANDS.strong.min) return 'strong';
  if (score >= SCORE_BANDS.mixed.min) return 'mixed';
  return 'poor';
}

export type HintSelectionContext = {
  score: number;
  hasShoes: boolean;
  hasCompleteBase: boolean;
  allowsSmartCasualTrainers: boolean;
  majorConfused: boolean;
  primaryClash: OutfitClash | null;
  aesthetic: OutfitAestheticAnalysis | null;
  colorSummary?: string | null;
  colorScore?: number;
  silhouetteOverall?: number;
  uniqueColorCount?: number;
};

function fillArchetype(template: string, aesthetic: OutfitAestheticAnalysis | null): string {
  return template.replace('{archetype}', styleArchetypeLabel(aesthetic?.primaryStyle ?? null));
}

/**
 * Major multi-lane confusion — NOT soft blazer+lifestyle trainers, NOT mild purity
 * inside the same style cluster (e.g. smart_casual + classic_tailoring).
 */
export function isMajorConfusedLook(
  aesthetic: OutfitAestheticAnalysis | null | undefined,
  options?: { allowsSmartCasualTrainers?: boolean; clashId?: string | null },
): boolean {
  if (!aesthetic) return false;
  if (options?.allowsSmartCasualTrainers && options.clashId === 'blazer_trainers') return false;
  if (aesthetic.aestheticConflict) return true;
  if (aesthetic.unclearIdentity) return true;
  // Explicit multi-lane clash ids (confused copy only when these drive the look)
  if (options?.clashId && /hoodie_blazer_cargo|blazer_shorts_trainers|tier1_tier5|swimwear_formal|sleepwear_formal|aesthetic_confused_lanes|aesthetic_conflict_/.test(options.clashId)) {
    return true;
  }
  return false;
}

export function selectAnalysisHint(ctx: HintSelectionContext): string {
  const {
    score,
    hasShoes,
    hasCompleteBase,
    allowsSmartCasualTrainers,
    majorConfused,
    primaryClash,
    aesthetic,
    colorSummary,
    colorScore = 100,
    silhouetteOverall = 10,
    uniqueColorCount = 0,
  } = ctx;

  const band = scoreBandForValue(score);
  const softClash = primaryClash?.severity === 'moderate' || primaryClash?.severity === 'minor'
    ? primaryClash
    : null;
  const hardClash = primaryClash?.severity === 'fatal' || primaryClash?.severity === 'major'
    ? primaryClash
    : null;

  if (!hasShoes) return CONTEXTUAL_STATEMENT_TEMPLATES.find((t) => t.id === 'ctx_no_shoes')!.text;
  if (!hasCompleteBase) return CONTEXTUAL_STATEMENT_TEMPLATES.find((t) => t.id === 'ctx_incomplete_base')!.text;

  // Hard clash / major confused always name the conflict (score should already be low)
  if (hardClash) return hardClash.hint;
  if (majorConfused) {
    return CONTEXTUAL_STATEMENT_TEMPLATES.find((t) => t.id === 'ctx_confused_major')!.text;
  }

  if (band === 'excellent') {
    if (allowsSmartCasualTrainers) {
      return fillArchetype(
        CONTEXTUAL_STATEMENT_TEMPLATES.find((t) => t.id === 'ctx_smart_casual_trainers')!.text,
        aesthetic,
      );
    }
    if (aesthetic?.primaryStyle && aesthetic.purity >= 0.7) {
      return fillArchetype(
        BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_excellent_archetype')!.text,
        aesthetic,
      );
    }
    return BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_excellent_praise')!.text;
  }

  if (band === 'strong') {
    // Optional light polish only when a real soft clash exists — never generic refine-footwear
    if (softClash) {
      return BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_strong_polish')!.text
        .replace('{softClash}', softClash.hint);
    }
    return BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_strong_solid')!.text;
  }

  if (band === 'mixed') {
    if (softClash) return softClash.hint;
    if (colorScore < 50 && colorSummary) return colorSummary;
    if (silhouetteOverall < 5.5) {
      return BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_mixed_silhouette')!.text;
    }
    if ((uniqueColorCount ?? 0) >= 4) {
      return CONTEXTUAL_STATEMENT_TEMPLATES.find((t) => t.id === 'ctx_competing_colours')!.text;
    }
    if (allowsSmartCasualTrainers) {
      return fillArchetype(
        CONTEXTUAL_STATEMENT_TEMPLATES.find((t) => t.id === 'ctx_smart_casual_trainers')!.text,
        aesthetic,
      );
    }
    return BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_mixed_palette')!.text;
  }

  // poor
  if (softClash) return softClash.hint;
  if (colorScore < 50 && colorSummary) return colorSummary;
  return BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_poor_editorial')!.text;
}

/**
 * Final guard: strip stressful / mismatched copy after AI merge.
 * Excellent (≥90): no refine-footwear; no confused unless hard footwear clash (rare).
 */
export function sanitizeHintForScore(
  hint: string,
  score: number,
  options?: {
    clashId?: string | null;
    severity?: OutfitClash['severity'] | null;
    fallbackPraise?: string;
  },
): string {
  const band = scoreBandForValue(score);
  const hardFootwear = options?.clashId && HARD_FOOTWEAR_CLASH_IDS.has(options.clashId);
  const majorSev = options?.severity === 'fatal' || options?.severity === 'major';
  let next = hint || '';

  if (band === 'excellent') {
    if (REFINE_FOOTWEAR_RE.test(next) && !hardFootwear) {
      next = options?.fallbackPraise
        || BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_excellent_praise')!.text;
    }
    if (CONFUSED_LANE_RE.test(next) && !majorSev) {
      next = options?.fallbackPraise
        || BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_excellent_cohesive')!.text;
    }
  }

  if (band === 'strong' && REFINE_FOOTWEAR_RE.test(next) && !hardFootwear && !softFootwearAllowed(options?.clashId)) {
    next = BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_strong_solid')!.text;
  }

  // Never show confused at ≥80 unless major severity
  if (score >= 80 && CONFUSED_LANE_RE.test(next) && !majorSev) {
    next = score >= 90
      ? BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_excellent_cohesive')!.text
      : BAND_STATEMENT_TEMPLATES.find((t) => t.id === 'band_strong_solid')!.text;
  }

  return next;
}

function softFootwearAllowed(clashId?: string | null): boolean {
  return clashId === 'blazer_trainers' || clashId === 'shorts_boots' || clashId === 'slides_tailored_bottoms';
}

export type ItemAnalysisNote = {
  id: string;
  role: string;
  name: string;
  note: string;
};

function roleForCategory(category: string): string {
  const c = String(category || '').toLowerCase();
  if (c === 'shoes') return 'footwear';
  if (c === 'outerwear' || c === 'formal') return 'layer';
  if (c === 'bottoms' || c === 'activewear_bottoms') return 'bottoms';
  if (c === 'tops' || c === 'activewear_tops') return 'top';
  if (c === 'dresses') return 'dress';
  if (c === 'accessories') return 'accessory';
  return c || 'piece';
}

/** Deterministic per-item tips grounded in clash results (AI fallback). */
export function buildDeterministicItemNotes(
  items: WardrobeItem[],
  options?: {
    score?: number;
    clashId?: string | null;
    clashHint?: string | null;
    aesthetic?: OutfitAestheticAnalysis | null;
  },
): ItemAnalysisNote[] {
  const clashes = detectAllOutfitClashes(items);
  const primary = clashes[0] || null;
  const score = options?.score ?? 70;
  const band = scoreBandForValue(score);
  const aesthetic = options?.aesthetic ?? null;

  return items.map((item) => {
    const role = roleForCategory(item.category);
    const name = item.name || 'Item';
    const text = `${item.name || ''} ${item.category || ''} ${item.color || ''}`.toLowerCase();

    let note: string;
    if (band === 'excellent') {
      note = aesthetic?.primaryStyle
        ? `Works in this ${styleArchetypeLabel(aesthetic.primaryStyle)} story — colour and formality align with the rest.`
        : 'Supports a cohesive, intentional finish.';
    } else if (primary && /blazer/.test(text) && /trainer|sneaker|chunky|running/.test(primary.hint.toLowerCase())) {
      note = primary.id === 'blazer_chunky_trainers'
        ? 'Tailoring reads office; chunky athletic trainers pull the look into gym territory — swap to plain lifestyle sneakers or dress shoes.'
        : 'Blazer sets a smarter lane — footwear needs to match (lifestyle sneakers or loafers), not fight it.';
    } else if (primary && role === 'footwear' && /shoe|trainer|boot|loafer|heel|footwear/.test(primary.hint.toLowerCase())) {
      note = `Clash focus: ${primary.hint}`;
    } else if (primary && (
      (role === 'layer' && /blazer|outer|jacket|hoodie/.test(primary.hint.toLowerCase()))
      || (role === 'bottoms' && /jogger|short|sweat|trouser|jean|bottom/.test(primary.hint.toLowerCase()))
      || (role === 'top' && /tee|shirt|top|hoodie|athletic/.test(primary.hint.toLowerCase()))
    )) {
      note = `In tension with the outfit: ${primary.hint}`;
    } else if (band === 'strong') {
      note = 'Holds the look together — only a light finishing tweak would elevate further.';
    } else if (band === 'mixed') {
      note = `${name} is wearable here, but the overall mix still needs one clearer style anchor.`;
    } else {
      note = `Reconsider how ${name} sits with the other pieces — pick one style lane and commit.`;
    }

    // Excellent scores: never nag footwear
    if (band === 'excellent' && role === 'footwear' && REFINE_FOOTWEAR_RE.test(note)) {
      note = 'Footwear finishes the look cleanly — leave it.';
    }

    return { id: item.id, role, name, note };
  });
}

export type AnalysisStatementInventory = {
  bandTemplates: number;
  contextualTemplates: number;
  aestheticTemplates: number;
  clashHints: number;
  /** Unique statement strings across all buckets (clash hints + templates). */
  uniqueStatementCount: number;
  statements: Array<{ id: string; bucket: string; text: string }>;
};

/** Full inventory for audits / snapshot tests. */
export function getAnalysisStatementInventory(): AnalysisStatementInventory {
  const statements: Array<{ id: string; bucket: string; text: string }> = [];

  for (const t of BAND_STATEMENT_TEMPLATES) {
    statements.push({ id: t.id, bucket: `band:${t.band}`, text: t.text });
  }
  for (const t of CONTEXTUAL_STATEMENT_TEMPLATES) {
    statements.push({ id: t.id, bucket: 'contextual', text: t.text });
  }
  for (const t of AESTHETIC_STATEMENT_TEMPLATES) {
    statements.push({ id: t.id, bucket: 'aesthetic', text: t.text });
  }
  for (const rule of CLASH_RULES) {
    statements.push({ id: `clash:${rule.id}`, bucket: `clash:${rule.severity}`, text: rule.hint });
  }

  const unique = new Set(statements.map((s) => s.text.trim().toLowerCase()));

  return {
    bandTemplates: BAND_STATEMENT_TEMPLATES.length,
    contextualTemplates: CONTEXTUAL_STATEMENT_TEMPLATES.length,
    aestheticTemplates: AESTHETIC_STATEMENT_TEMPLATES.length,
    clashHints: CLASH_RULES.length,
    uniqueStatementCount: unique.size,
    statements,
  };
}

/** Expected inventory size after this change (asserted in verify-outfit-score). */
export const EXPECTED_CLASH_HINT_COUNT = 46;
export const EXPECTED_BAND_TEMPLATE_COUNT = BAND_STATEMENT_TEMPLATES.length;
export const EXPECTED_CONTEXTUAL_TEMPLATE_COUNT = CONTEXTUAL_STATEMENT_TEMPLATES.length;
export const EXPECTED_AESTHETIC_TEMPLATE_COUNT = AESTHETIC_STATEMENT_TEMPLATES.length;
