/**
 * Launch-bounded Live copy: at most one hosiery/sock bullet after score exists.
 *
 * Never scores. Never infers from skin tone, tan, shadows, or dark legs.
 * Cloud/Vision must positively identify the garment (type + confidence ≥ 0.80).
 */

import type { LiveLegwear, LiveLegwearStyle, LiveLegwearType } from '@/types/liveStylist';
import { LIVE_LEGWEAR_MIN_CONFIDENCE } from '@/types/liveStylist';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';

export { LIVE_LEGWEAR_MIN_CONFIDENCE };

const LEGWEAR_TYPES = new Set<LiveLegwearType>([
  'socks',
  'tights',
  'stockings',
  'hosiery',
  'none',
  'unknown',
]);

const LEGWEAR_STYLES = new Set<LiveLegwearStyle>([
  'athletic',
  'dress',
  'casual',
  'sheer',
  'opaque',
  'patterned',
  'unknown',
]);

const SKIN_INFERENCE_KEY_RE =
  /^(skin|skintone|skincolour|skincolor|darklegs|legdarkness|legtone|undertone|tan)$/i;
const SKIN_INFERENCE_FROM_RE = /skin|dark\s*legs?|leg\s*dark|shadow|fake\s*tan|undertone/i;
const HOSIERY_ITEM_RE =
  /\b(socks?|tights?|stockings?|hosiery|pantyhose|nylons?)\b/i;
const LEGGINGS_BOTTOM_RE = /\b(legging|compression\s*tight|gym\s*tight|running\s*tight)\b/i;
const DRESSY_SHOE_RE = /loafer|oxford|derby|brogue|dress\s*shoe|heel|court\s*shoe/;
const ATHLETIC_SHOE_RE = /trainer|sneaker|runner|running\s*shoe|court\s*trainer/;
const BOOT_RE = /\bboots?\b/;
const SPORT_BOTTOM_RE = /athletic|gym|sweat|jersey|sport|jogger|track/;
const TAILORED_RE =
  /trouser|chino|tailor|suit|blazer|oxford|dress\s*shirt|pleat|wool|smart/;
const FORMAL_SUIT_RE = /\b(suit|blazer|tailored\s*jacket|waistcoat|dress\s*shirt)\b/;
const PATTERN_RE = /pattern|print|plaid|check|stripe|floral|fairisle|argyle|polka|motif/;
const LIGHT_DELICATE_COLOUR_RE = /\b(white|ivory|cream|blush|pastel|champagne|pearl)\b/;
const DELICATE_FABRIC_RE = /\b(chiffon|silk|lace|organza|satin|sundress|sheer\s*dress)\b/;
const DARK_COLOUR_RE = /\b(black|navy|charcoal|dark|ink|espresso)\b/;
const NEUTRAL_COLOUR_RE =
  /\b(black|white|grey|gray|navy|beige|cream|ivory|tan|camel|brown|khaki|stone|charcoal|off[\s-]?white)\b/;
const ACCENT_COLOUR_RE =
  /\b(burgundy|wine|maroon|oxblood|bordeaux|plum|berry|red|emerald|forest|cobalt|mustard|rust|olive)\b/;
const CLASH_SUMMARY_RE =
  /sit awkwardly|dressy shoes need|keep pieces in one style lane|formal neckwear/i;
const LEGWEAR_BULLET_RE = /\b(socks?|tights?|stockings?|hosiery|ankles?)\b/i;

export type LegwearAdvisoryInput = {
  truth: Pick<
    LiveOutfitTruth,
    'top' | 'layer' | 'bottom' | 'footwear' | 'lane' | 'hasConflict' | 'score'
  >;
  legwear?: LiveLegwear | null;
  occasion?: string | null;
  season?: string | null;
};

function norm(raw: unknown): string {
  return String(raw || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
}

function itemBlob(item: LiveTruthItem | null | undefined): string {
  if (!item) return '';
  return norm(`${item.name} ${item.category} ${item.subcategory || ''} ${item.color || ''}`);
}

function outfitBlob(truth: LegwearAdvisoryInput['truth']): string {
  return [
    itemBlob(truth.top),
    itemBlob(truth.layer),
    itemBlob(truth.bottom),
    itemBlob(truth.footwear),
    norm(truth.lane),
  ].join(' ');
}

function looksLikeSkinInference(raw: Record<string, unknown>, type: string | undefined): boolean {
  const keys = Object.keys(raw);
  const skinKeys = keys.filter((k) => SKIN_INFERENCE_KEY_RE.test(k.replace(/[^a-z]/gi, '')));
  if (skinKeys.length && !LEGWEAR_TYPES.has(type as LiveLegwearType)) return true;
  const inferred = String(raw.inferredFrom || raw.reason || raw.sourceNote || '');
  if (SKIN_INFERENCE_FROM_RE.test(inferred)) return true;
  if (type && SKIN_INFERENCE_FROM_RE.test(type)) return true;
  return false;
}

/**
 * Parse Vision legwear. Returns null unless type is an explicit garment enum.
 * Does not infer hosiery from skin / darkness fields.
 */
export function parseLiveLegwear(raw: unknown): LiveLegwear | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const typeRaw = norm(rec.type);
  if (looksLikeSkinInference(rec, typeRaw)) return null;
  if (!LEGWEAR_TYPES.has(typeRaw as LiveLegwearType)) return null;

  let style = norm(rec.style) as LiveLegwearStyle;
  if (!LEGWEAR_STYLES.has(style)) style = 'unknown';

  let confidence = Number(rec.confidence);
  if (!Number.isFinite(confidence)) return null;
  confidence = Math.min(1, Math.max(0, confidence));

  const colour = rec.colour ?? rec.color;
  const colourText = colour == null ? null : String(colour).trim().slice(0, 32) || null;

  return {
    type: typeRaw as LiveLegwearType,
    colour: colourText,
    style,
    confidence,
  };
}

/** Hosiery/socks must not enter outfit scoring item lists. Leggings stay bottoms. */
export function isLiveLegwearScoreItem(item: {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
} | null | undefined): boolean {
  if (!item) return false;
  const blob = norm(`${item.name} ${item.category} ${item.subcategory || ''}`);
  if (LEGGINGS_BOTTOM_RE.test(blob) && !/\bsocks?\b/.test(blob)) return false;
  if (HOSIERY_ITEM_RE.test(blob)) return true;
  const cat = norm(item.category);
  return cat === 'legwear' || cat === 'hosiery' || cat === 'socks';
}

export function itemsForLiveScore<T>(items: T[]): T[] {
  return (Array.isArray(items) ? items : []).filter((item) => !isLiveLegwearScoreItem(item as never));
}

function extractLegwearFromItems(items: unknown[]): LiveLegwear | null {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (isLiveLegwearScoreItem(rec as { name?: string; category?: string; subcategory?: string })) {
      const parsed = parseLiveLegwear({
        type: rec.type
          || (/\bsocks?\b/i.test(String(rec.name)) ? 'socks'
            : /\bstocking/i.test(String(rec.name)) ? 'stockings'
              : /\btights?\b/i.test(String(rec.name)) ? 'tights'
                : 'hosiery'),
        colour: rec.color || rec.colour,
        style: rec.style,
        confidence: rec.confidence,
      });
      if (parsed) return parsed;
    }
  }
  return null;
}

export function resolveLiveLegwear(
  dedicated: unknown,
  items: unknown[] = [],
): LiveLegwear | null {
  return parseLiveLegwear(dedicated) || extractLegwearFromItems(items);
}

function publishedBottomKind(bottomBlob: string): 'shorts' | 'skirt' | 'dress' | 'trousers' | 'other' {
  // Shorts / skirts win over "pant" fragments so athletic shorts never become "trousers".
  if (/\bshorts?\b/.test(bottomBlob)) return 'shorts';
  if (/\bskirt\b/.test(bottomBlob)) return 'skirt';
  if (/\bdress\b/.test(bottomBlob) && !/dress\s*shirt/.test(bottomBlob)) return 'dress';
  if (/trouser|chino|\bpants?\b|jean/.test(bottomBlob)) return 'trousers';
  return 'other';
}

function sockColourTransitionLine(
  bottomKind: ReturnType<typeof publishedBottomKind>,
  bottomName?: string | null,
): string | null {
  if (bottomKind === 'shorts' || bottomKind === 'skirt' || bottomKind === 'dress') {
    return null;
  }
  // Never say "trousers" when the published bottom name is shorts (mis-typed kind).
  if (/\bshorts?\b/i.test(String(bottomName || ''))) return null;
  if (bottomKind === 'trousers') {
    return 'A sock colour closer to the trousers would create a cleaner transition into the shoes.';
  }
  return 'A sock colour closer to the bottoms would create a cleaner transition into the shoes.';
}

function isAthleticSocks(legwear: LiveLegwear): boolean {
  if (legwear.type !== 'socks') return false;
  const blob = `${legwear.style} ${legwear.colour || ''}`;
  return legwear.style === 'athletic' || /sport|athletic|crew/.test(blob);
}

function isPatternedLegwear(legwear: LiveLegwear): boolean {
  return legwear.style === 'patterned' || PATTERN_RE.test(legwear.colour || '');
}

function isOpaqueDarkTights(legwear: LiveLegwear): boolean {
  if (!/tights|stockings|hosiery/.test(legwear.type)) return false;
  if (legwear.style === 'sheer') return false;
  const col = norm(legwear.colour);
  return (legwear.style === 'opaque' || DARK_COLOUR_RE.test(col)) && DARK_COLOUR_RE.test(col || 'black');
}

function colourFamily(raw: string | null | undefined): string {
  const c = norm(raw);
  if (/white|ivory|cream|off\s*white/.test(c)) return 'white';
  if (/black|charcoal|ink/.test(c)) return 'black';
  if (/navy|blue/.test(c)) return 'blue';
  if (/grey|gray|stone/.test(c)) return 'grey';
  if (/brown|tan|camel|khaki|beige/.test(c)) return 'brown';
  if (ACCENT_COLOUR_RE.test(c)) return 'accent';
  return c || '';
}

function coloursClash(a: string | null | undefined, b: string | null | undefined): boolean {
  const fa = colourFamily(a);
  const fb = colourFamily(b);
  if (!fa || !fb || fa === fb) return false;
  if ((fa === 'white' && fb !== 'white') || (fb === 'white' && fa !== 'white')) return true;
  if ((fa === 'accent' || fb === 'accent') && fa !== fb) return true;
  return fa !== fb && !['brown', 'black'].includes(fa) && !['brown', 'black'].includes(fb);
}

function isWinterish(season: string | null | undefined, occasion: string | null | undefined): boolean {
  const blob = `${norm(season)} ${norm(occasion)}`;
  return /winter|autumn|fall|cold/.test(blob);
}

function isSportswearLook(truth: LegwearAdvisoryInput['truth'], occasion?: string | null): boolean {
  const blob = `${outfitBlob(truth)} ${norm(occasion)}`;
  const sportBottom = SPORT_BOTTOM_RE.test(itemBlob(truth.bottom));
  const athleticShoes = ATHLETIC_SHOE_RE.test(itemBlob(truth.footwear));
  const lane = /athleisure|sport|gym|athletic/.test(norm(truth.lane) + ' ' + norm(occasion));
  return Boolean((sportBottom && athleticShoes) || (lane && athleticShoes));
}

function isTailoredLook(truth: LegwearAdvisoryInput['truth']): boolean {
  const blob = outfitBlob(truth);
  return TAILORED_RE.test(blob) || /smart_casual|formal|work|office/.test(norm(truth.lane));
}

function isFormalBusinessLook(
  truth: LegwearAdvisoryInput['truth'],
  occasion?: string | null,
): boolean {
  const blob = `${outfitBlob(truth)} ${norm(occasion)}`;
  const shoes = itemBlob(truth.footwear);
  const formalShoes = /oxford|derby|brogue|dress\s*shoe/.test(shoes)
    || (/loafer/.test(shoes) && /suit|business|work|office|formal/.test(blob));
  const suitLike = FORMAL_SUIT_RE.test(blob) && /trouser|suit|chino/.test(blob);
  const laneFormal = /formal|business|work|office/.test(`${norm(truth.lane)} ${norm(occasion)}`);
  return Boolean(formalShoes && (suitLike || (laneFormal && /trouser|suit/.test(blob))));
}

function publishedShoesAreLoafers(truth: LegwearAdvisoryInput['truth']): boolean {
  return /loafer/.test(itemBlob(truth.footwear));
}

function dressIsPatterned(truth: LegwearAdvisoryInput['truth']): boolean {
  const one = isDressLike(truth.bottom) ? truth.bottom : isDressLike(truth.top) ? truth.top : null;
  const skirt = /\bskirt\b/.test(itemBlob(truth.bottom)) ? truth.bottom : null;
  return PATTERN_RE.test(itemBlob(one)) || PATTERN_RE.test(itemBlob(skirt));
}

function isDressLike(item: LiveTruthItem | null | undefined): boolean {
  const blob = itemBlob(item);
  if (/dress\s*shirt|shirt\s*dress/.test(blob)) return false;
  return /\bdress\b/.test(blob);
}

function lightDelicateLook(truth: LegwearAdvisoryInput['truth']): boolean {
  const dress = isDressLike(truth.bottom) ? truth.bottom : isDressLike(truth.top) ? truth.top : truth.bottom;
  const blob = itemBlob(dress);
  if (!LIGHT_DELICATE_COLOUR_RE.test(blob)) return false;
  if (DARK_COLOUR_RE.test(blob) && !LIGHT_DELICATE_COLOUR_RE.test(blob)) return false;
  return DELICATE_FABRIC_RE.test(blob) || LIGHT_DELICATE_COLOUR_RE.test(blob);
}

function outfitMostlyNeutral(truth: LegwearAdvisoryInput['truth']): boolean {
  const pieces = [truth.top, truth.layer, truth.bottom, truth.footwear].filter(Boolean) as LiveTruthItem[];
  if (!pieces.length) return false;
  return pieces.every((p) => {
    const col = norm(p.color || p.name);
    return !col || NEUTRAL_COLOUR_RE.test(col) || !ACCENT_COLOUR_RE.test(col);
  });
}

function outfitIsSimple(truth: LegwearAdvisoryInput['truth']): boolean {
  return !dressIsPatterned(truth) && !PATTERN_RE.test(outfitBlob(truth).replace(PATTERN_RE, ''));
}

/**
 * 0 or 1 bullet. Silent when unsure, compatible, or below confidence.
 */
export function adviseLegwear(input: LegwearAdvisoryInput): string | null {
  const score = Number(input.truth.score);
  if (!Number.isFinite(score)) return null;

  const legwear = parseLiveLegwear(input.legwear);
  if (!legwear) return null;
  if (legwear.confidence < LIVE_LEGWEAR_MIN_CONFIDENCE) return null;
  if (legwear.type === 'unknown') return null;

  const shoesBlob = itemBlob(input.truth.footwear);
  const bottomBlob = itemBlob(input.truth.bottom);
  const bottomKind = publishedBottomKind(bottomBlob);
  const loafers = publishedShoesAreLoafers(input.truth);
  const sportLook = isSportswearLook(input.truth, input.occasion);
  const tailored = isTailoredLook(input.truth);
  const dressyShoes = DRESSY_SHOE_RE.test(shoesBlob);
  const athleticShoes = ATHLETIC_SHOE_RE.test(shoesBlob);
  const boots = BOOT_RE.test(shoesBlob);

  if (legwear.type === 'none') {
    if (isFormalBusinessLook(input.truth, input.occasion)) {
      return 'Socks would give the shoes and tailoring a more formal finish.';
    }
    return null;
  }

  // Silence by default: sports socks + shorts are ordinary, not a sock story.
  if (isAthleticSocks(legwear) && bottomKind === 'shorts') {
    return null;
  }

  // Published trainers: never leftover loafer/dress-sock copy.
  if (athleticShoes && !loafers) {
    if (isAthleticSocks(legwear) && sportLook) return null;
  }

  // Athletic shorts + loafers: the clash is shorts vs shoes.
  if (bottomKind === 'shorts' && (loafers || dressyShoes) && !athleticShoes) {
    return null;
  }
  if (
    input.truth.hasConflict
    && bottomKind === 'shorts'
    && loafers
  ) {
    return null;
  }

  if (isAthleticSocks(legwear) && dressyShoes && !sportLook && !athleticShoes && bottomKind === 'trousers') {
    if (loafers) {
      return 'The sports socks make the loafers feel more casual; finer dress socks would keep the smart direction cleaner.';
    }
    return 'The sports socks make the shoes feel more casual; finer dress socks would keep the smart direction cleaner.';
  }

  if (isAthleticSocks(legwear) && athleticShoes && sportLook) {
    return null;
  }

  if (isAthleticSocks(legwear) && loafers && sportLook) {
    return null;
  }

  const hosiery = /tights|stockings|hosiery/.test(legwear.type);
  if (hosiery && isPatternedLegwear(legwear) && dressIsPatterned(input.truth)) {
    return 'The patterned tights add another focal point; simpler hosiery would let the dress lead.';
  }

  if (hosiery && isPatternedLegwear(legwear) && outfitIsSimple(input.truth)) {
    return 'The tights add interest without competing with the rest of the look.';
  }

  if (hosiery && ACCENT_COLOUR_RE.test(norm(legwear.colour)) && outfitMostlyNeutral(input.truth)) {
    const shade = String(legwear.colour || 'colour').toLowerCase();
    return `The ${shade} tights add a controlled colour accent to the neutral palette.`;
  }

  if (
    hosiery
    && isOpaqueDarkTights(legwear)
    && lightDelicateLook(input.truth)
    && !boots
    && !isWinterish(input.season || null, input.occasion || null)
    && DELICATE_FABRIC_RE.test(outfitBlob(input.truth))
  ) {
    return 'Sheer hosiery or bare legs would keep the lighter direction softer.';
  }

  if (hosiery && isOpaqueDarkTights(legwear) && DARK_COLOUR_RE.test(bottomBlob) && boots) {
    return null;
  }

  if (hosiery && (legwear.style === 'sheer' || /nude|sheer|natural/.test(norm(legwear.colour)))) {
    return null;
  }

  if (
    legwear.type === 'socks'
    && !sportLook
    && coloursClash(legwear.colour, input.truth.bottom?.color || input.truth.bottom?.name)
    && (dressyShoes || tailored)
    && bottomKind === 'trousers'
  ) {
    return sockColourTransitionLine(bottomKind, input.truth.bottom?.name);
  }

  return null;
}

export function isLegwearCopyBullet(text: string): boolean {
  return LEGWEAR_BULLET_RE.test(String(text || ''));
}

/**
 * Keep the highest-severity clash bullet; add at most one legwear line.
 * Never lets hosiery replace the primary clash observation.
 */
export function mergeLegwearBullet(
  bullets: string[],
  advisory: string | null,
): string[] {
  const existing = (Array.isArray(bullets) ? bullets : [])
    .map((b) => String(b || '').trim())
    .filter(Boolean)
    .filter((b) => !isLegwearCopyBullet(b));
  if (!advisory) return existing.slice(0, 2);
  const clash = existing.find((b) => CLASH_SUMMARY_RE.test(b));
  const rest = existing.filter((b) => b !== clash);
  if (clash) return [clash, advisory];
  if (!rest.length) return [advisory];
  return [rest[0]!, advisory];
}

export function adviseLegwearFromPublishedTruth(
  truth: LiveOutfitTruth,
  extras: { occasion?: string | null; season?: string | null } = {},
): string | null {
  return adviseLegwear({
    truth,
    legwear: truth.legwear,
    occasion: extras.occasion,
    season: extras.season,
  });
}
