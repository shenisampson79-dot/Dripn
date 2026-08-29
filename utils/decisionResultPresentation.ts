/**
 * Pure presentation formatter for Decisions result cards (QSC / Event / Shopping).
 * No scoring, routing, or copy generation — structures existing customer-safe fields.
 */

import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';
import { containsEngineLeak, cannedFallback } from '@/utils/stylistPresentationBoundary';

export type DecisionFlowType = 'sanity-check' | 'event-outfit' | 'shopping';

/** Mirrors services/DecisionService.ts — kept local so node verify scripts stay RN-free. */
export const STYLE_RATING_DISPLAY_FLOOR = 5.4;
export const STYLE_RATING_RECOMMEND_FLOOR = 7.0;

export function shouldDisplayStyleRating(rating: number | null | undefined): boolean {
  if (rating == null || !Number.isFinite(Number(rating))) return false;
  return Number(rating) > STYLE_RATING_DISPLAY_FLOOR;
}

export type DecisionResultInput = {
  styleRating?: number | null;
  ratingLabel?: string | null;
  verdict?: string | null;
  message?: string;
  recommendation?: string;
  reasoning?: string;
  decision?: string;
  outfitId?: string;
  stylistNote?: string;
  outfitSummary?: string;
  presentation?: {
    body?: string;
    bullets?: string[];
    headline?: string;
    summary?: string;
  };
  shoppingDecision?: {
    text?: string;
    message?: string;
  };
};

export type DecisionResultDisplay = {
  verdictLabel: string | null;
  scoreDisplay: string | null;
  summary: string | null;
  bullets: string[];
  bottomLine: string | null;
};

/** Customer-facing styleRating bands for normalized verdict chips (0–10 scale). */
export const VERDICT_BAND_RETHINK_MAX = STYLE_RATING_DISPLAY_FLOOR;
export const VERDICT_BAND_TWEAK_MAX = STYLE_RATING_RECOMMEND_FLOOR;

const NORMALIZED_VERDICT_LABELS = ['WORKS', 'NEEDS A TWEAK', 'RETHINK IT'] as const;

const BOTTOM_LINE_START_RE =
  /^(?:you'?re good|you'?re set|you'?re fine|go for it|go with|wear this|stick with|safe to wear|ready to go|skip (?:this|it)|pass on|avoid this|don'?t buy|you can wear|you're good to go)/i;
const BOTTOM_LINE_PREFIX_RE = /^(?:so|overall|in short|bottom line|all in all)[,:\s\-–—]/i;

function normalizeForDedupe(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.!?…]+$/, '');
}

function isDuplicate(a: string, b: string): boolean {
  const na = normalizeForDedupe(a);
  const nb = normalizeForDedupe(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function safeText(raw?: string | null): string {
  const text = sanitizeStylistUserText(String(raw || '').trim());
  if (!text || containsEngineLeak(text)) return '';
  const fallback = cannedFallback('qsc');
  if (text === fallback) return text;
  return text;
}

/** Prefer server ratingLabel only when it is already a short verdict-style label. */
export function ratingLabelAsVerdictChip(ratingLabel?: string | null): string | null {
  const label = safeText(ratingLabel);
  if (!label) return null;
  const upper = label.toUpperCase().replace(/\s+/g, ' ');
  if ((NORMALIZED_VERDICT_LABELS as readonly string[]).includes(upper)) return upper;
  if (label.length > 36 || /[.!?…]./.test(label)) return null;
  if (/^works\b/i.test(label)) return 'WORKS';
  if (/needs a tweak|needs tweaking|small tweak|minor tweak/i.test(label)) return 'NEEDS A TWEAK';
  if (/rethink|doesn'?t work|does not work|not working|avoid/i.test(label)) return 'RETHINK IT';
  return null;
}

/** Map customer-facing styleRating (0–10) to a three-state verdict chip. */
export function verdictFromStyleRating(styleRating: number): (typeof NORMALIZED_VERDICT_LABELS)[number] {
  if (styleRating >= VERDICT_BAND_TWEAK_MAX) return 'WORKS';
  if (styleRating > VERDICT_BAND_RETHINK_MAX) return 'NEEDS A TWEAK';
  return 'RETHINK IT';
}

export function resolveVerdictLabel(input: {
  styleRating?: number | null;
  ratingLabel?: string | null;
  verdict?: string | null;
}): string | null {
  const fromLabel = ratingLabelAsVerdictChip(input.ratingLabel);
  if (fromLabel) return fromLabel;

  const rating = input.styleRating;
  if (rating != null && Number.isFinite(Number(rating))) {
    return verdictFromStyleRating(Number(rating));
  }

  const v = String(input.verdict || '').toLowerCase().replace(/\s+/g, '_');
  if (v === 'works' || v === 'work' || v === 'yes' || v === 'ok') return 'WORKS';
  if (v === 'doesnt_work' || v === "doesn't_work" || v === 'no' || v === 'reject') return 'RETHINK IT';
  return null;
}

export function resolveScoreDisplay(
  decisionType: DecisionFlowType,
  styleRating?: number | null,
): string | null {
  if (styleRating == null || !Number.isFinite(Number(styleRating))) return null;
  const rating = Number(styleRating);
  if (decisionType === 'sanity-check') {
    return `${rating.toFixed(1)}/10`;
  }
  if (!shouldDisplayStyleRating(rating)) return null;
  return `${rating.toFixed(1)}/10`;
}

/** Deterministic sentence segmentation — preserves punctuation, no rewriting. */
export function splitIntoSentences(text: string): string[] {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines
    .filter((l) => /^[-•*]\s+/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, '').trim())
    .filter(Boolean);
  if (bulletLines.length >= 2) return bulletLines;

  if (!/[.!?…]/.test(trimmed) && trimmed.length <= 280) {
    return [trimmed];
  }

  const sentences: string[] = [];
  const re = /[^.!?…]+(?:[.!?…]+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const s = match[0].trim();
    if (s) sentences.push(s);
  }
  if (!sentences.length && trimmed) return [trimmed];
  return sentences;
}

export function isBottomLineCandidate(sentence: string): boolean {
  const t = sentence.trim();
  if (!t || t.length > 140) return false;
  if (BOTTOM_LINE_START_RE.test(t)) return true;
  if (BOTTOM_LINE_PREFIX_RE.test(t)) return true;
  if (/^(?:swap|switch|add|drop|try|consider)\s+/i.test(t) && t.length <= 90) return true;
  return false;
}

function collectProseSource(
  res: DecisionResultInput,
  decisionType: DecisionFlowType,
  opts: { rejected?: boolean },
): string {
  if (decisionType === 'shopping') {
    const multi = safeText(
      res.presentation?.body
      || res.message
      || res.shoppingDecision?.text
      || res.shoppingDecision?.message
      || res.recommendation
      || res.decision
      || '',
    );
    if (multi) return multi;
  }

  let recommendation = safeText(
    res.presentation?.body
    || res.message
    || res.recommendation
    || res.decision
    || '',
  );
  const reasoning = (res.message || res.outfitId)
    ? ''
    : safeText(res.reasoning || '');

  if (opts.rejected) {
    recommendation = recommendation
      .replace(/^Wear this instead\s*[—–-]?\s*/i, '')
      .trim();
  }

  if (reasoning && recommendation && !isDuplicate(reasoning, recommendation)) {
    return `${recommendation} ${reasoning}`.trim();
  }
  return recommendation || reasoning;
}

function buildFromSentences(sentences: string[]): Pick<DecisionResultDisplay, 'summary' | 'bullets' | 'bottomLine'> {
  const unique = sentences.filter(Boolean);
  if (!unique.length) {
    return { summary: null, bullets: [], bottomLine: null };
  }

  if (unique.length === 1) {
    return { summary: unique[0], bullets: [], bottomLine: null };
  }

  let bottomLine: string | null = null;
  let pool = [...unique];
  const last = pool[pool.length - 1];
  if (pool.length >= 3 && isBottomLineCandidate(last)) {
    bottomLine = last;
    pool = pool.slice(0, -1);
  }

  const summary = pool[0] || null;
  let bullets = pool.slice(1);
  if (!bullets.length && summary && pool.length === 1) {
    return { summary, bullets: [], bottomLine };
  }

  if (bullets.length > 4) {
    bullets = bullets.slice(0, 4);
  }

  const dedupedBullets = bullets.filter(
    (b) => !isDuplicate(b, summary || '') && !isDuplicate(b, bottomLine || ''),
  );

  return {
    summary,
    bullets: dedupedBullets,
    bottomLine: bottomLine && !isDuplicate(bottomLine, summary || '') ? bottomLine : null,
  };
}

export function formatDecisionResultPresentation(
  res: DecisionResultInput,
  decisionType: DecisionFlowType,
  opts: { rejected?: boolean } = {},
): DecisionResultDisplay {
  const verdictLabel = resolveVerdictLabel({
    styleRating: res.styleRating,
    ratingLabel: res.ratingLabel,
    verdict: res.verdict,
  });
  const scoreDisplay = resolveScoreDisplay(decisionType, res.styleRating);

  const presentationBullets = (Array.isArray(res.presentation?.bullets) ? res.presentation!.bullets : [])
    .map((b) => safeText(b))
    .filter(Boolean)
    .slice(0, 4);

  const noteSummary = safeText(res.stylistNote || res.outfitSummary || '');
  const descriptiveRating = safeText(res.ratingLabel || '');
  const ratingIsVerdict = Boolean(ratingLabelAsVerdictChip(res.ratingLabel));

  if (presentationBullets.length >= 2) {
    const summary = noteSummary || safeText(res.presentation?.headline || res.presentation?.summary || '') || null;
    return {
      verdictLabel,
      scoreDisplay,
      summary: summary && !isDuplicate(summary, presentationBullets[0] || '') ? summary : null,
      bullets: presentationBullets,
      bottomLine: null,
    };
  }

  const prose = collectProseSource(res, decisionType, opts);
  const segmented = buildFromSentences(splitIntoSentences(prose));

  let summary = segmented.summary;
  let bullets = segmented.bullets;
  let bottomLine = segmented.bottomLine;

  if (noteSummary && !looksLikeItemNameList(noteSummary)) {
    if (!summary) summary = noteSummary;
    else if (!isDuplicate(noteSummary, summary)) {
      bullets = [summary, ...bullets].filter(
        (b, i, arr) => arr.findIndex((x) => isDuplicate(x, b)) === i,
      );
      summary = noteSummary;
    }
  }

  if (descriptiveRating && !ratingIsVerdict) {
    if (!summary) summary = descriptiveRating;
    else if (!isDuplicate(descriptiveRating, summary) && !bullets.some((b) => isDuplicate(b, descriptiveRating))) {
      if (bullets.length < 4) bullets = [descriptiveRating, ...bullets];
    }
  }

  bullets = bullets
    .filter((b) => !isDuplicate(b, summary || '') && !isDuplicate(b, bottomLine || ''))
    .slice(0, 4);

  if (summary && bottomLine && isDuplicate(summary, bottomLine)) bottomLine = null;

  return {
    verdictLabel,
    scoreDisplay,
    summary,
    bullets,
    bottomLine,
  };
}

function looksLikeItemNameList(text: string): boolean {
  const value = String(text || '').trim();
  if (!value) return false;
  return / · /.test(value) && !/[.!?…]/.test(value);
}
