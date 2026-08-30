/**
 * Decisions follow-up / refine→Chat CTA gate.
 * Launch contract: completed Decisions/QSC end on Done — no Refine→Chat handoff.
 */

export type DecisionRefineFlow = 'sanity-check' | 'event-outfit' | 'shopping' | string;

export type SanityFollowUpResponse = {
  stylistNote?: string | null;
  outfitSummary?: string | null;
  recommendation?: string | null;
  reasoning?: string | null;
  confidenceNote?: string | null;
  status?: string | null;
  type?: string | null;
  isFallback?: boolean;
  styleRating?: number | null;
  suggestions?: string[] | null;
  missingPieces?: string[] | null;
  missing?: unknown[] | null;
  outfitPieces?: Array<{ type?: string | null } | null> | null;
  unifiedScore?: { final_score?: number | null } | null;
};

/** Always false — no Decisions→Stylist Chat refine CTA at launch. */
export function shouldShowDecisionRefineCta(
  _decisionType?: DecisionRefineFlow | null,
  _res?: SanityFollowUpResponse | null,
): boolean {
  return false;
}

/** Always false — no Get Outfits Now→Stylist Chat refine CTA at launch. */
export function shouldShowGonRefineCta(): boolean {
  return false;
}

/** @deprecated Prefer shouldShowDecisionRefineCta — kept for existing verify imports. */
export function shouldShowSanityFollowUpCta(
  res?: SanityFollowUpResponse | null,
): boolean {
  return shouldShowDecisionRefineCta('sanity-check', res);
}
