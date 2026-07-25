/**
 * Strip internal scoring meta and snake_case tokens from user-facing stylist prose.
 * Keep scoring/refinement/style-rule ids for the engine — never show them to users.
 */

import { rewriteStylistCtaJargon } from '@/utils/shopDressCodeFilters';

const SCORED_FOR_RE = /\bScored for\b[^.!?\n]*[.!?]?/gi;
const REFINEMENT_RE = /\bRefinement\s*:\s*[^.!?\n]*[.!?]?/gi;
/** word_word (snake_case labels) → word word; leave URLs/emails alone. */
const SNAKE_CASE_RE = /\b([a-z][a-z0-9]*)_([a-z0-9]+(?:_[a-z0-9]+)*)\b/gi;
const RELATED_STYLE_RULES_LINE_RE = /^[ \t]*Related style rules\s*:[^\n]*/gim;
const STYLE_RULE_HASH_TRAIL_RE = /(?:^|\n)[ \t]*(?:#\d{1,3}\s+[A-Za-z][^\n·]*(?:\s*·\s*#\d{1,3}\s+[A-Za-z][^\n·]*)+)\s*$/g;
const STYLE_RULE_HASH_INLINE_RE = /#\d{1,3}\s+[A-Z][A-Za-z0-9 &'/-]{2,40}/g;
/** Engine outfit contracts must never reach the UI. */
const DRIPN_OUTFIT_BLOCK_RE =
  /<<<\s*DRIPN[_\s-]?OUTFIT\s*>>>[\s\S]*?(?:<<<\s*END[_\s-]?DRIPN[_\s-]?OUTFIT\s*>>>|$)/gi;
const DRIPN_OUTFIT_JSON_RE =
  /\{\s*"outfit"\s*:\s*\{[\s\S]*?\}\s*(?:,\s*"avoid"\s*:\s*\[[\s\S]*?\])?(?:,\s*"explanation"\s*:\s*"[^"]*")?\s*\}/gi;

function humanizeSnakeCase(match: string): string {
  return match.replace(/_/g, ' ');
}

export function sanitizeStylistUserText(input?: string | null): string {
  if (typeof input !== 'string' || !input.trim()) return '';
  let text = input;
  text = text.replace(DRIPN_OUTFIT_BLOCK_RE, ' ');
  text = text.replace(DRIPN_OUTFIT_JSON_RE, ' ');
  text = text.replace(SCORED_FOR_RE, ' ');
  text = text.replace(REFINEMENT_RE, ' ');
  text = text.replace(RELATED_STYLE_RULES_LINE_RE, ' ');
  text = text.replace(STYLE_RULE_HASH_TRAIL_RE, ' ');
  text = text.replace(STYLE_RULE_HASH_INLINE_RE, ' ');
  text = text.replace(SNAKE_CASE_RE, humanizeSnakeCase);
  text = rewriteStylistCtaJargon(text);
  return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Singular role labels for outfit piece lists (Top, not Tops). */
export function formatOutfitPieceRoleLabel(role?: string | null): string {
  const raw = String(role || 'piece').toLowerCase().trim();
  const map: Record<string, string> = {
    top: 'Top',
    tops: 'Top',
    shirt: 'Top',
    bottom: 'Bottom',
    bottoms: 'Bottom',
    pants: 'Bottom',
    trousers: 'Bottom',
    shoes: 'Shoes',
    shoe: 'Shoes',
    footwear: 'Shoes',
    outerwear: 'Outerwear',
    outer: 'Outerwear',
    jacket: 'Outerwear',
    bag: 'Bag',
    bags: 'Bag',
    accessory: 'Accessory',
    accessories: 'Accessory',
    dress: 'Dress',
    piece: 'Piece',
  };
  if (map[raw]) return map[raw];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Stylist rejected the user's look (do not re-show that outfit). */
export function isOutfitRejectedByStylist(text?: string | null): boolean {
  const blob = String(text || '').toLowerCase();
  if (!blob.trim()) return false;
  return (
    /\bno\s*[—–-]\s*/.test(blob)
    || /\bnot appropriate\b/.test(blob)
    || /\binappropriate\b/.test(blob)
    || /\bwon'?t work\b/.test(blob)
    || /\bdon'?t wear\b/.test(blob)
    || /\bdo not wear\b/.test(blob)
    || /\btoo casual for\b/.test(blob)
    || /\bnothing suitable\b/.test(blob)
    || /\bwardrobe (needs|gap)\b/.test(blob)
  );
}
