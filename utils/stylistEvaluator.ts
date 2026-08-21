/**
 * Client mirror of server stylistEvaluator (0–100 generation publish bands).
 * Full critic lives on Dripn-Server; this module exposes the same thresholds
 * and a thin local adapter for offline demotion / tests. Publish authority
 * remains createWardrobeOutfit on the server.
 */

export const EVALUATOR_REJECT_BELOW = 70;
export const EVALUATOR_PUBLISHABLE_FLOOR = 80;

export const EVALUATOR_BAND = {
  REJECT: 'reject',
  FALLBACK: 'fallback',
  PUBLISHABLE: 'publishable',
} as const;

export type EvaluatorBand = (typeof EVALUATOR_BAND)[keyof typeof EVALUATOR_BAND];

export function score10To100(score10: number): number {
  const n = Number(score10);
  if (!Number.isFinite(n)) return 0;
  if (n > 10 && n <= 100) return Math.max(0, Math.min(100, Math.round(n)));
  return Math.max(0, Math.min(100, Math.round(n * 10)));
}

export function evaluatorBand(score100: number): EvaluatorBand {
  const n = Number(score100);
  if (!Number.isFinite(n) || n < EVALUATOR_REJECT_BELOW) return EVALUATOR_BAND.REJECT;
  if (n < EVALUATOR_PUBLISHABLE_FLOOR) return EVALUATOR_BAND.FALLBACK;
  return EVALUATOR_BAND.PUBLISHABLE;
}

/**
 * Prefer server evaluation payload when present. Offline: map a 1–10 score.
 */
export function stylistEvaluator(
  _outfit: unknown,
  context: {
    proposedRating?: number;
    score10?: number;
    hardFails?: string[];
    confidence?: number;
    reasons?: string[];
  } = {},
) {
  const score10 = Number(context.score10 ?? context.proposedRating ?? 0) || 0;
  const score = score10To100(score10);
  const hardFails = Array.isArray(context.hardFails) ? context.hardFails : [];
  const band = hardFails.length ? EVALUATOR_BAND.REJECT : evaluatorBand(score);
  const confidence = Number(context.confidence);
  const confidenceOk = !Number.isFinite(confidence) || confidence >= 0.65;
  const publishable = band === EVALUATOR_BAND.PUBLISHABLE && confidenceOk && !hardFails.length;
  const fallbackOnly = band === EVALUATOR_BAND.FALLBACK && confidenceOk && !hardFails.length;
  return {
    score,
    scoreScale: '100' as const,
    score10,
    confidence: Number.isFinite(confidence) ? confidence : publishable ? 0.8 : 0,
    hardFails: [...hardFails],
    reasons: [...(context.reasons || [])],
    band,
    publishable,
    fallbackOnly,
    rejected: !publishable && !fallbackOnly,
  };
}
