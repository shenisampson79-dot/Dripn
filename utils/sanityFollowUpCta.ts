/**
 * When to offer a follow-up CTA after Quick Sanity Check.
 * Decisive "looks good / skip it" answers should end on Done — not open chat.
 */

/** Match DecisionService STYLE_RATING_RECOMMEND_FLOOR — keep local to avoid RN import in tests. */
const STYLE_RATING_RECOMMEND_FLOOR = 7.0;

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

const QUESTION_RE = /\?/;
const SWAP_OR_BUY_RE =
  /\b(swap|replace|instead|clash|doesn't work|does not work|do not work|won't work|would change|I'd change|i would change|try your|from your wardrobe|wear your|pull from|buy|shop for|pick up|get a|missing|upgrade|recommended)\b/i;

function responseText(res: SanityFollowUpResponse): string {
  return [res.stylistNote, res.outfitSummary, res.recommendation, res.reasoning, res.confidenceNote]
    .filter(Boolean)
    .join('\n');
}

/** True when the stylist invites more work: a question, a wardrobe swap, or a buy suggestion. */
export function shouldShowSanityFollowUpCta(res: SanityFollowUpResponse | null | undefined): boolean {
  if (!res) return false;

  const text = responseText(res);
  if (QUESTION_RE.test(text)) return true;

  if (res.isFallback || res.type === 'fallback_outfit' || res.status === 'fallback_outfit') {
    return true;
  }
  if (
    res.status === 'wardrobe_gap'
    || res.status === 'refused'
    || res.status === 'no_outfit_possible'
  ) {
    return true;
  }

  if ((res.missing?.length || 0) > 0 || (res.missingPieces?.length || 0) > 0) return true;
  if (res.outfitPieces?.some((p) => p?.type === 'recommended')) return true;
  if ((res.suggestions?.length || 0) > 0) return true;

  const rating = res.styleRating ?? res.unifiedScore?.final_score;
  if (rating != null && Number.isFinite(Number(rating)) && Number(rating) < STYLE_RATING_RECOMMEND_FLOOR) {
    return true;
  }

  if (SWAP_OR_BUY_RE.test(text)) return true;

  return false;
}
