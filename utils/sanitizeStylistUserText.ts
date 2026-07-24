/**
 * Strip internal scoring meta and snake_case tokens from user-facing stylist prose.
 * Keep scoring/refinement/style-rule ids for the engine — never show them to users.
 */

const SCORED_FOR_RE = /\bScored for\b[^.!?\n]*[.!?]?/gi;
const REFINEMENT_RE = /\bRefinement\s*:\s*[^.!?\n]*[.!?]?/gi;
/** word_word (snake_case labels) → word word; leave URLs/emails alone. */
const SNAKE_CASE_RE = /\b([a-z][a-z0-9]*)_([a-z0-9]+(?:_[a-z0-9]+)*)\b/gi;
const RELATED_STYLE_RULES_LINE_RE = /^[ \t]*Related style rules\s*:[^\n]*/gim;
const STYLE_RULE_HASH_TRAIL_RE = /(?:^|\n)[ \t]*(?:#\d{1,3}\s+[A-Za-z][^\n·]*(?:\s*·\s*#\d{1,3}\s+[A-Za-z][^\n·]*)+)\s*$/g;
const STYLE_RULE_HASH_INLINE_RE = /#\d{1,3}\s+[A-Z][A-Za-z0-9 &'/-]{2,40}/g;

function humanizeSnakeCase(match: string): string {
  return match.replace(/_/g, ' ');
}

export function sanitizeStylistUserText(input?: string | null): string {
  if (typeof input !== 'string' || !input.trim()) return '';
  let text = input;
  text = text.replace(SCORED_FOR_RE, ' ');
  text = text.replace(REFINEMENT_RE, ' ');
  text = text.replace(RELATED_STYLE_RULES_LINE_RE, ' ');
  text = text.replace(STYLE_RULE_HASH_TRAIL_RE, ' ');
  text = text.replace(STYLE_RULE_HASH_INLINE_RE, ' ');
  text = text.replace(SNAKE_CASE_RE, humanizeSnakeCase);
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
