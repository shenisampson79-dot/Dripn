/**
 * Strip internal scoring meta and snake_case tokens from user-facing stylist prose.
 * Keep scoring/refinement/style-rule ids for the engine — never show them to users.
 */

import { rewriteStylistCtaJargon, stripNonActionableSaveLookProse } from '@/utils/shopDressCodeFilters';
import { editorialGarmentName } from '@/utils/wardrobeItemName';
import { cannedFallback, containsEngineLeak, isFatalEngineLeak, presentText } from '@/utils/stylistPresentationBoundary';

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
    || /\btoo sporty\b/.test(blob)
    || /\bconsider swapping\b/.test(blob)
    || /\bmight feel\b/.test(blob)
    || /\bwear this instead\b/.test(blob)
    || /\bnothing suitable\b/.test(blob)
    || /\bwardrobe (needs|gap)\b/.test(blob)
  );
}

const OPEN_QUESTION_OFFER_RE =
  /\s*(?:Want\s+me\s+to\b[^.!?\n]*[.!?]?|Would\s+you\s+like\s+(?:me\s+to\s+)?[^.!?\n]*[.!?]?|Shall\s+I\b[^.!?\n]*[.!?]?)/gi;
const ROLE_LABEL_LINE_RE =
  /^[ \t]*(?:Tops?|Bottoms?|Footwear|Shoes?|Outerwear|Layers?|Accessories?|Dress(?:es)?)\s*:\s*.+$/gim;
const ROLE_LABEL_INLINE_RE =
  /\b(?:Tops?|Bottoms?|Footwear|Shoes?|Outerwear|Layers?|Accessories?)\s*:\s*/gi;
const WEAR_THIS_INSTEAD_DUP_RE =
  /(?:Wear this instead[.!]?\s*){2,}/gi;
/** Ideal-outfit override lectures (different from the collage) */
const IDEAL_OVERRIDE_RE =
  /\b(?:a\s+blazer\s+might|might\s+elevate|would\s+elevate|better\s+still|ideally)\b[^.!?\n]*[.!?]?/gi;
const WORKPLACE_SETTINGS_RE = /\bWorkplace dress code from Settings:[^.!\n]*[.!]?/gi;
const JUDGE_AGAINST_RE = /\b(?:For work\s*\/\s*office\s*\/\s*work[- ]?(?:appropriate|right) looks[^.!\n]*[.!]?|judge against this code[^.!\n]*[.!]?|not a generic office default[^.!\n]*[.!]?)/gi;
const TRAINER_PROMPT_RE =
  /\b(?:Never recommend trainers or sneakers for this workplace|Trainers only if they are clean\/minimal lifestyle)[^.!\n]*[.!]?/gi;
const STYLE_LANE_PROMPT_RE = /\bKeep one clear style lane end to end[^.!\n]*[.!]?/gi;

function stripInternalPromptLeaks(input: string): string {
  let text = input.replace(/\\"/g, '"').replace(/\\'/g, "'");
  text = text.replace(WORKPLACE_SETTINGS_RE, ' ');
  text = text.replace(JUDGE_AGAINST_RE, ' ');
  text = text.replace(TRAINER_PROMPT_RE, ' ');
  text = text.replace(STYLE_LANE_PROMPT_RE, ' ');
  text = text.replace(/I've got your look for\s*["'][^"']{0,240}["']/gi, (m) => (
    /Settings|judge against|office default|work-appropr/i.test(m)
      ? "I've got your look"
      : m
  ));
  return text.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}

export function sanitizeStylistUserText(input?: string | null): string {
  if (typeof input !== 'string' || !input.trim()) return '';
  if (isFatalEngineLeak(input)) return cannedFallback('qsc');
  let text = stripInternalPromptLeaks(input);
  if (!text) {
    return cannedFallback('qsc');
  }
  // Defense-in-depth: strip internal outfit-engine jargon before other rewrites.
  text = text.replace(/\bclash-safe\b/gi, '');
  text = text.replace(/\bwardrobe allocator\b/gi, 'wardrobe');
  text = text.replace(/\bClosest issue:\s*[^.!?\n]*[.!?]?/gi, ' ');
  text = text.replace(DRIPN_OUTFIT_BLOCK_RE, ' ');
  text = text.replace(DRIPN_OUTFIT_JSON_RE, ' ');
  text = text.replace(SCORED_FOR_RE, ' ');
  text = text.replace(REFINEMENT_RE, ' ');
  text = text.replace(RELATED_STYLE_RULES_LINE_RE, ' ');
  text = text.replace(STYLE_RULE_HASH_TRAIL_RE, ' ');
  text = text.replace(STYLE_RULE_HASH_INLINE_RE, ' ');
  text = text.replace(ROLE_LABEL_LINE_RE, ' ');
  text = text.replace(ROLE_LABEL_INLINE_RE, ' ');
  text = text.replace(IDEAL_OVERRIDE_RE, ' ');
  text = text.replace(WEAR_THIS_INSTEAD_DUP_RE, 'Wear this instead. ');
  text = text.replace(SNAKE_CASE_RE, humanizeSnakeCase);
  text = rewriteStylistCtaJargon(text);
  text = stripNonActionableSaveLookProse(text);
  text = text.replace(OPEN_QUESTION_OFFER_RE, ' ');
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  // Soften Title Case garment dumps in chat (Wear the / Opt for / …)
  text = text.replace(
    /((?:Wear this(?:\s+instead)?|You could go with|Opt for(?:\s+the)?|Instead,\s*wear(?:\s+the)?|Wear the|Try the|Keeping)\s*[:—–-]?\s*)([^.!?\n]+)/gi,
    (_m, lead, list) => {
      const raw = String(list);
      const parts = raw
        .split(/\s*\+\s*|,\s*/)
        .map((p) => p.replace(/^and\s+/i, '').replace(/\.$/, '').trim())
        .filter(Boolean);
      const soften = (n: string) => editorialGarmentName(n, { atSentenceStart: false });
      if (parts.length < 2) {
        return `${lead}${soften(raw.replace(/\.$/, ''))}${/\.$/.test(raw) ? '.' : ''}`;
      }
      const softened = parts.map(soften);
      const body = softened.length === 2
        ? `${softened[0]} and ${softened[1]}`
        : `${softened.slice(0, -1).join(', ')}, and ${softened[softened.length - 1]}`;
      return `${lead}${body}${/\.$/.test(raw) ? '.' : ''}`;
    },
  );
  // Mid-prose Title Case dumps are fixed upstream via spoken-label evidence SSoT — no client regex.
  // Post-transform editorial integrity (after any lead strip upstream)
  text = text
    .replace(/^(?:Wear this instead\s*[—–-]?\s*)+/i, '')
    .trim();
  text = text.replace(/(^|[.!?]\s+|—\s*|–\s*)([a-z])/g, (_, lead, ch) => `${lead}${String(ch).toUpperCase()}`);
  if (text && !/^[A-ZÀ-ÖØ-Þ]/.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (containsEngineLeak(input) || containsEngineLeak(text) || !text) {
    return presentText(text, 'qsc');
  }
  return text;
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
