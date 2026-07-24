/**
 * Strip internal scoring meta and snake_case tokens from user-facing stylist prose.
 * Keep scoring/refinement for engine logs — never show "Scored for…" / "Refinement:" to users.
 */

const SCORED_FOR_RE = /\bScored for\b[^.!?\n]*[.!?]?/gi;
const REFINEMENT_RE = /\bRefinement\s*:\s*[^.!?\n]*[.!?]?/gi;
/** word_word (snake_case labels) → word word; leave URLs/emails alone. */
const SNAKE_CASE_RE = /\b([a-z][a-z0-9]*)_([a-z0-9]+(?:_[a-z0-9]+)*)\b/gi;

function humanizeSnakeCase(match: string): string {
  return match.replace(/_/g, ' ');
}

export function sanitizeStylistUserText(input?: string | null): string {
  if (typeof input !== 'string' || !input.trim()) return '';
  let text = input;
  text = text.replace(SCORED_FOR_RE, ' ');
  text = text.replace(REFINEMENT_RE, ' ');
  text = text.replace(SNAKE_CASE_RE, humanizeSnakeCase);
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
