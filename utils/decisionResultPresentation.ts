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

/** Generic house-style secondaries — not outfit-specific WHY bullets. */
const GENERIC_EVENT_WHY_RES: RegExp[] = [
  /\bIt reads dressed-up without feeling forced\b/i,
  /\bIt feels considered without ever looking overdone\b/i,
  /\bFeels put-together without looking forced\b/i,
  /\bPolished without trying too hard\b/i,
  /\bClean, composed, and deliberately simple\b/i,
  /\bNothing unnecessary, just clean performance\b/i,
  /\bI chose these pieces to read polished and occasion-correct\b/i,
];

const DRESS_CODE_LABELS: Record<string, string> = {
  casual: 'casual',
  'smart-casual': 'smart casual',
  business: 'business',
  cocktail: 'cocktail',
  formal: 'formal',
  'black-tie': 'black tie',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  interview: 'interview',
  dinner: 'formal dinner',
  hiking: 'hiking',
  wedding: 'wedding',
  other: 'event',
};

export type EventPieceRef = { role?: string; name?: string };

export type EventOccasionContext = { eventType?: string; dressCode?: string };

const QSC_SWAP_CANNED_RE = /\bIf a piece fights the rest of the outfit, swap that piece only\b/i;
const QSC_GOT_LOOK_RE = /^I've got your look\.?$/i;

/** Server seal occasionally injects QSC canned copy into Event reasoning when reasoning is empty/leaked. */
export function isEventCannedReasoning(text?: string | null): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  const qscCanned = cannedFallback('qsc');
  if (t === qscCanned) return true;
  if (QSC_GOT_LOOK_RE.test(t)) return true;
  if (QSC_SWAP_CANNED_RE.test(t)) return true;
  if (QSC_GOT_LOOK_RE.test(t.split(/[.!?…]/)[0]?.trim() || '') && QSC_SWAP_CANNED_RE.test(t)) return true;
  return false;
}

export function isGenericEventWhyBullet(text?: string | null): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  if (isEventCannedReasoning(t)) return true;
  if (containsEngineLeak(t)) return true;
  if (GENERIC_EVENT_WHY_RES.some((re) => re.test(t))) return true;
  return false;
}

export function filterEventWhyBullets(bullets: string[]): string[] {
  return bullets.filter((b) => !isGenericEventWhyBullet(b));
}

function normalizeOutfitRole(role?: string | null): string {
  const r = String(role || '').toLowerCase().trim();
  if (!r) return '';
  if (/top|shirt|blouse|tee|t-?shirt|knit|sweater|polo/.test(r)) return 'top';
  if (/bottom|trouser|pant|jean|chino|skirt|short/.test(r)) return 'bottom';
  if (/shoe|footwear|loafer|boot|sneaker|trainer|heel|oxford/.test(r)) return 'shoes';
  if (/outer|jacket|blazer|coat|layer/.test(r)) return 'outerwear';
  return r;
}

function garmentNameSatisfiesRole(name: string, role: string): boolean {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  switch (role) {
    case 'top':
      return /\b(shirts?|blouses?|oxfords?|tees?|t-?shirts?|tops?|knits?|polos?|tyrwhitt|button[- ]?downs?)\b/.test(n);
    case 'bottom':
      return /\b(trousers?|pants?|jeans?|chinos?|skirts?|shorts?|bottoms?|legs?)\b/.test(n);
    case 'shoes':
      return /\b(shoes?|loafers?|boots?|sneakers?|trainers?|heels?|oxfords?|footwear)\b/.test(n);
    case 'outerwear':
      return /\b(blazers?|jackets?|coats?|outerwear|overcoats?|cardigans?)\b/.test(n);
    default:
      return false;
  }
}

/** Hide dress-code template upgrades when the selected outfit already fills that role. */
export function filterEventMissingUpgrades<T extends { role?: string; label?: string; name?: string }>(
  missing: T[] | null | undefined,
  pieces: Array<{ role?: string; name?: string }>,
): T[] {
  if (!Array.isArray(missing) || !missing.length) return [];
  if (!Array.isArray(pieces) || !pieces.length) return missing;

  return missing.filter((item) => {
    const role = normalizeOutfitRole(item.role);
    if (!role) return true;
    const filled = pieces.some(
      (p) => normalizeOutfitRole(p.role) === role && garmentNameSatisfiesRole(String(p.name || ''), role),
    );
    return !filled;
  });
}

export function shouldDisplayStyleRating(rating: number | null | undefined): boolean {
  if (rating == null || !Number.isFinite(Number(rating))) return false;
  return Number(rating) > STYLE_RATING_DISPLAY_FLOOR;
}

export type DecisionResultInput = {
  /** QSC-only customer outfit score (1.0–10.0) from server outfitScore field. */
  outfitScore?: number | null;
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
  outfitScore?: number | null,
): string | null {
  if (decisionType !== 'sanity-check') return null;
  if (outfitScore == null || !Number.isFinite(Number(outfitScore))) return null;
  return `${Number(outfitScore).toFixed(1)}/10`;
}

/** Deterministic sentence segmentation — preserves punctuation, no rewriting. */
export function splitIntoSentences(text: string): string[] {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  // Explicit paragraph breaks → split before sentence logic.
  if (/\n\s*\n/.test(trimmed)) {
    const paragraphs = trimmed.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
      const merged: string[] = [];
      for (const para of paragraphs) {
        merged.push(...splitIntoSentences(para.replace(/\n+/g, ' ')));
      }
      return merged.filter(Boolean);
    }
  }

  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines
    .filter((l) => /^[-•*]\s+/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, '').trim())
    .filter(Boolean);
  if (bulletLines.length >= 2) return bulletLines;

  // Newline-separated prose without bullets — treat each line as its own unit.
  if (lines.length >= 2 && !/[.!?…]/.test(trimmed)) {
    return lines;
  }

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
  const reasoning = decisionType === 'event-outfit'
    ? safeText(res.reasoning || '')
    : ((res.message || res.outfitId)
      ? ''
      : safeText(res.reasoning || ''));

  if (opts.rejected) {
    recommendation = recommendation
      .replace(/^Wear this instead\s*[—–-]?\s*/i, '')
      .trim();
  }

  // Event: primary prose only — reasoning merges as WHY bullets in the formatter.
  if (decisionType === 'event-outfit') {
    return recommendation || reasoning;
  }

  if (reasoning && recommendation && !isDuplicate(reasoning, recommendation)) {
    return `${recommendation} ${reasoning}`.trim();
  }
  return recommendation || reasoning;
}

function buildEventOccasionPhrase(ctx?: EventOccasionContext | null): string {
  if (!ctx) return 'this occasion';
  const eventLabel = EVENT_TYPE_LABELS[ctx.eventType || '']
    || (ctx.eventType ? ctx.eventType.replace(/-/g, ' ') : '');
  const dressLabel = DRESS_CODE_LABELS[ctx.dressCode || '']
    || (ctx.dressCode ? ctx.dressCode.replace(/-/g, ' ') : '');
  if (eventLabel) return `this ${eventLabel}`;
  if (dressLabel) return `this ${dressLabel} occasion`;
  return 'this occasion';
}

/** Deterministic Event WHY from structured outfit pieces — no invented attributes. */
export function deriveEventWhyFromPieces(
  pieces: EventPieceRef[],
  occasionCtx?: EventOccasionContext | null,
): string[] {
  if (!Array.isArray(pieces) || !pieces.length) return [];

  const occ = buildEventOccasionPhrase(occasionCtx);
  const byRole: Record<string, string> = {};
  for (const piece of pieces) {
    const role = normalizeOutfitRole(piece.role);
    const name = String(piece.name || '').trim();
    if (!role || !name) continue;
    if (!byRole[role]) byRole[role] = name;
  }

  const bullets: string[] = [];
  const top = byRole.top;
  const bottom = byRole.bottom;
  const outerwear = byRole.outerwear;
  const shoes = byRole.shoes;

  if (top) {
    bullets.push(`${top} fills the top role for ${occ}.`);
  }
  if (outerwear) {
    bullets.push(`${outerwear} provides the selected outerwear layer.`);
  }
  if (bottom && shoes) {
    bullets.push(`${bottom} and ${shoes} complete the selected outfit for ${occ}.`);
  } else {
    if (bottom) bullets.push(`${bottom} is your selected bottom for ${occ}.`);
    if (shoes) bullets.push(`${shoes} completes the footwear for this outfit.`);
  }

  return bullets.slice(0, 4);
}

function mergeEventReasoningBullets(
  summary: string | null,
  bullets: string[],
  reasoning: string,
): string[] {
  const eventReasoning = safeText(reasoning);
  if (!eventReasoning) return bullets;

  const extras: string[] = [];
  for (const sentence of splitIntoSentences(eventReasoning)) {
    const s = sentence.trim();
    if (!s) continue;
    if (isGenericEventWhyBullet(s)) continue;
    if (isDuplicate(s, summary || '')) continue;
    if (bullets.some((b) => isDuplicate(b, s))) continue;
    if (extras.some((e) => isDuplicate(e, s))) continue;
    extras.push(s);
  }

  return [...bullets, ...extras]
    .filter((b, i, arr) => arr.findIndex((x) => isDuplicate(x, b)) === i)
    .slice(0, 4);
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
  opts: {
    rejected?: boolean;
    eventPieceNames?: string[];
    eventPieces?: EventPieceRef[];
    eventOccasionContext?: EventOccasionContext;
  } = {},
): DecisionResultDisplay {
  const qscOutfitScore = decisionType === 'sanity-check' ? (res.outfitScore ?? null) : null;
  const verdictLabel = resolveVerdictLabel({
    styleRating: qscOutfitScore,
    ratingLabel: res.ratingLabel,
    verdict: res.verdict,
  });
  const scoreDisplay = resolveScoreDisplay(decisionType, qscOutfitScore);

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

  if (decisionType === 'event-outfit' && res.reasoning && !isEventCannedReasoning(res.reasoning)) {
    bullets = mergeEventReasoningBullets(summary, bullets, String(res.reasoning));
  } else if (decisionType === 'event-outfit' && res.reasoning && isEventCannedReasoning(res.reasoning)) {
    // Drop QSC canned reasoning — never surface as Event WHY.
  }

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

  if (decisionType === 'event-outfit') {
    bullets = filterEventWhyBullets(bullets);
    if (!bullets.length && opts.eventPieces?.length) {
      bullets = deriveEventWhyFromPieces(opts.eventPieces, opts.eventOccasionContext);
    }
  }

  if (summary && bottomLine && isDuplicate(summary, bottomLine)) bottomLine = null;

  if (decisionType === 'event-outfit' && summary && opts.eventPieceNames?.length) {
    summary = stripTrailingGarmentNamesFromEventSummary(summary, opts.eventPieceNames);
  }

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

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Event headline must not trail a garment name already listed in piece rows below.
 * Server prose sometimes omits the sentence break before the first selected piece.
 */
export function stripTrailingGarmentNamesFromEventSummary(
  summary: string | null,
  pieceNames: string[] = [],
): string | null {
  if (!summary || !pieceNames.length) return summary;
  let text = summary.trim();
  const names = [...new Set(
    pieceNames.map((n) => String(n || '').trim()).filter((n) => n.length >= 3),
  )].sort((a, b) => b.length - a.length);

  for (const name of names) {
    const re = new RegExp(`\\s+${escapeRegExpLiteral(name)}\\.?$`, 'i');
    if (re.test(text)) {
      text = text.replace(re, '').trim();
      if (text && !/[.!?…]$/.test(text)) text = `${text}.`;
      break;
    }
  }
  return text || null;
}
