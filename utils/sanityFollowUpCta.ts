/**
 * Quick Sanity Check follow-up CTA.
 * Launch contract: QSC answers only “Does this outfit work?” and ends on Done —
 * never Refine→Chat / continuity handoff.
 */

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

/** Always false — QSC has no chat follow-up CTA. */
export function shouldShowSanityFollowUpCta(
  _res?: SanityFollowUpResponse | null,
): boolean {
  return false;
}
