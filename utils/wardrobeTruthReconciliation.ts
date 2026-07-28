/**
 * Truth Reconciliation Layer (client) — AI labels are guesses until validated.
 * Mirrors server/services/wardrobeTruthReconciliation.js
 */

export type ReconciliationFlag = {
  code: string;
  message: string;
  suggestion?: string;
};

export type ReconciledWardrobeLabel = {
  name: string;
  suggestedName: string;
  category: string;
  subcategory: string | null;
  color: string | null;
  pattern: string | null;
  confidence: number;
  confidenceBreakdown: { score: number; topIssue: string | null; issues: string[] };
  needsReview: boolean;
  flags: ReconciliationFlag[];
};

const PATTERN_WORDS = [
  'plaid', 'check', 'checked', 'gingham', 'striped', 'stripe', 'stripes',
  'floral', 'print', 'printed', 'polka', 'houndstooth', 'argyle', 'camo', 'camouflage',
];

const BOTTOM_RE = /\b(trousers?|pants?|jeans?|chinos?|leggings?|skirt|shorts?|joggers?)\b/i;
const TOP_RE = /\b(shirts?|tees?\b|t-?shirts?|blouse|hoodie|polo|sweater|henley|jersey|tank)\b/i;
const SLEEVE_RE = /\b(short|long)[- ]?sleeves?\b/gi;

function sleeveSafe(text: string): string {
  return String(text || '').replace(SLEEVE_RE, ' ');
}

function titleCase(s: string): string {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function reconcileCategory(
  category: string | null | undefined,
  hints: { name?: string | null; subcategory?: string | null } = {},
): string {
  let next = String(category || 'tops').toLowerCase().trim().replace(/\s+/g, '_');
  const text = sleeveSafe(`${hints.name || ''} ${hints.subcategory || ''}`.toLowerCase());

  if (/\b(bag|tote|backpack|purse|handbag|satchel|crossbody|clutch)\b/.test(text) && next !== 'shoes') {
    return 'bags';
  }
  if (/\b(shoe|sneaker|boot|trainer|loafer|heel|sandal)\b/.test(text)) return 'shoes';
  if (/\b(dress|gown|romper|jumpsuit)\b/.test(text)) return 'dresses';
  if (/\b(jacket|coat|blazer|parka|trench)\b/.test(text)) return 'outerwear';

  if (BOTTOM_RE.test(text)) {
    if (/\b(jogger|legging|sweatpant|track)\b/.test(text)) return 'activewear_bottoms';
    return 'bottoms';
  }

  if ((next === 'tops' || next === 'unknown') && /\b(bottom|leg)\b/.test(text)) {
    return 'bottoms';
  }

  if (next === 'bottoms' && TOP_RE.test(text) && !BOTTOM_RE.test(text)) {
    return 'tops';
  }

  return next;
}

export function reconcilePatternInName(item: {
  name?: string | null;
  color?: string | null;
  pattern?: string | null;
  patternConfidence?: number | null;
  confidence?: number | null;
}): { name: string; patternStripped: boolean; flags: ReconciliationFlag[] } {
  const name = String(item.name || '').trim();
  if (!name) return { name, patternStripped: false, flags: [] };

  const flags: ReconciliationFlag[] = [];
  const color = String(item.color || '').toLowerCase().trim();
  const pattern = String(item.pattern || '').toLowerCase().trim();
  const patternConf = Number.isFinite(item.patternConfidence as number)
    ? (item.patternConfidence as number)
    : (Number.isFinite(item.confidence as number) ? (item.confidence as number) : 0.85);

  const nameLower = name.toLowerCase();
  const patternInName = PATTERN_WORDS.find((p) => nameLower.includes(p));
  const colourMatch = nameLower.match(
    /\b(black|white|cream|ivory|beige|navy|blue|green|red|pink|orange|yellow|purple|brown|gray|grey|charcoal|denim|multicolor)\b/,
  );
  const colourInName = colourMatch ? colourMatch[1].replace('grey', 'gray') : null;

  let nextName = name;
  let patternStripped = false;

  const lowPatternConfidence = patternConf < 0.6;
  const patternIsSolid = !pattern || pattern === 'solid' || pattern === 'plain';
  const colourConflict =
    Boolean(colourInName && color)
    && colourInName !== color
    && !(colourInName === 'cream' && (color === 'beige' || color === 'white'))
    && !(colourInName === 'ivory' && (color === 'beige' || color === 'white'))
    && !(colourInName === 'navy' && color === 'blue');

  if (patternInName && (lowPatternConfidence || patternIsSolid || colourConflict)) {
    let cleaned = name;
    for (const p of PATTERN_WORDS) {
      cleaned = cleaned.replace(new RegExp(`\\b${p}\\b`, 'ig'), ' ');
    }
    if (colourConflict && colourInName) {
      cleaned = cleaned.replace(new RegExp(`\\b${colourInName}\\b`, 'ig'), ' ');
      if (color && color !== 'unknown' && color !== 'multicolor') {
        cleaned = `${titleCase(color)} ${cleaned}`;
      }
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim().replace(/^[-–,]+|[-–,]+$/g, '').trim();
    if (cleaned.length >= 3 && cleaned.toLowerCase() !== nameLower) {
      nextName = titleCase(cleaned);
      patternStripped = true;
      flags.push({
        code: 'pattern_untrusted',
        message: lowPatternConfidence
          ? 'We’re not confident this pattern is correct'
          : colourConflict
            ? 'Name colour/pattern didn’t match the garment colour'
            : 'Pattern removed because the item looks plain',
        suggestion: colourConflict
          ? `Is this plain ${color}, not ${colourInName}${patternInName ? ` ${patternInName}` : ''}?`
          : `Is this plain, not ${patternInName}?`,
      });
    }
  }

  return { name: nextName, patternStripped, flags };
}

function dedupeFlags(flags: ReconciliationFlag[]): ReconciliationFlag[] {
  const seen = new Set<string>();
  const out: ReconciliationFlag[] = [];
  for (const f of flags || []) {
    const key = `${f.code}|${f.suggestion || f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function computeWardrobeConfidence(item: {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  confidence?: number | null;
  patternConfidence?: number | null;
  flags?: ReconciliationFlag[];
}): { score: number; topIssue: string | null; issues: string[] } {
  let score = Number.isFinite(item.confidence as number)
    ? Math.min(1, Math.max(0, item.confidence as number))
    : 0.75;
  const issues: string[] = [];

  const name = String(item.name || '').toLowerCase();
  const category = String(item.category || '').toLowerCase();
  const text = sleeveSafe(`${name} ${item.subcategory || ''}`);

  if (!name || name === 'unknown item' || name === 'fashion item') {
    score -= 0.35;
    issues.push('Missing or generic name');
  }

  if (BOTTOM_RE.test(text) && (category === 'tops' || category === 'activewear_tops')) {
    score -= 0.4;
    issues.push('Trousers/bottoms tagged as a top');
  }
  if (TOP_RE.test(text) && category === 'bottoms' && !BOTTOM_RE.test(text)) {
    score -= 0.35;
    issues.push('Top tagged as bottoms');
  }

  const patternInName = PATTERN_WORDS.find((p) => name.includes(p));
  if (patternInName && Number(item.patternConfidence ?? item.confidence ?? 1) < 0.6) {
    score -= 0.25;
    issues.push(`Uncertain pattern (${patternInName})`);
  }

  if ((item.flags || []).some((f) => f.code === 'pattern_untrusted')) score -= 0.15;
  if ((item.flags || []).some((f) => f.code === 'category_reconciled')) score += 0.05;

  if (!item.color || item.color === 'unknown') {
    score -= 0.1;
    issues.push('Colour unclear');
  }

  score = Math.max(0, Math.min(1, score));
  return {
    score: Math.round(score * 100) / 100,
    topIssue: issues[0] || null,
    issues,
  };
}

export function reconcileWardrobeLabel(raw: {
  name?: string | null;
  suggestedName?: string | null;
  category?: string | null;
  garmentType?: string | null;
  subcategory?: string | null;
  color?: string | null;
  colorTag?: string | null;
  pattern?: string | null;
  patternConfidence?: number | null;
  confidence?: number | null;
}): ReconciledWardrobeLabel {
  const flags: ReconciliationFlag[] = [];
  const subcategory = raw.subcategory || null;
  let name = String(raw.name || raw.suggestedName || '').trim();
  let category = reconcileCategory(raw.category || raw.garmentType || 'tops', {
    name,
    subcategory,
  });

  const beforeCat = String(raw.category || raw.garmentType || 'tops').toLowerCase().replace(/\s+/g, '_');
  if (category !== beforeCat && beforeCat !== 'unknown') {
    flags.push({
      code: 'category_reconciled',
      message: `Category corrected to ${category.replace(/_/g, ' ')}`,
      suggestion: category === 'bottoms'
        ? 'Is this actually trousers / bottoms?'
        : `Is this actually ${category.replace(/_/g, ' ')}?`,
    });
  }

  const patternResult = reconcilePatternInName({
    name,
    color: raw.color || raw.colorTag,
    pattern: raw.pattern,
    patternConfidence: raw.patternConfidence,
    confidence: raw.confidence,
  });
  name = patternResult.name;
  flags.push(...patternResult.flags);

  category = reconcileCategory(category, { name, subcategory });

  const confidence = computeWardrobeConfidence({
    ...raw,
    name,
    category,
    subcategory,
    flags,
  });

  const mergedFlags = dedupeFlags(flags);
  if (confidence.score < 0.7) {
    mergedFlags.push({
      code: 'low_confidence',
      message: 'Something looks off with this item — a quick check helps',
      suggestion: confidence.topIssue || 'Review name and category',
    });
  }

  const needsReview = confidence.score < 0.7
    || mergedFlags.some((f) =>
      f.code === 'pattern_untrusted' || f.code === 'category_reconciled' || f.code === 'low_confidence',
    );

  return {
    name,
    suggestedName: name,
    category,
    subcategory,
    color: raw.color || raw.colorTag || null,
    pattern: patternResult.patternStripped ? 'solid' : (raw.pattern || null),
    confidence: confidence.score,
    confidenceBreakdown: confidence,
    needsReview,
    flags: dedupeFlags(mergedFlags),
  };
}

export const OUTFIT_CONFIDENCE_FLOOR = 0.7;

export function itemPassesOutfitConfidenceGate(
  item: { wardrobeConfidence?: number | null; confidenceScore?: number | null; needsReview?: boolean | null },
  floor = OUTFIT_CONFIDENCE_FLOOR,
): boolean {
  const conf = item?.wardrobeConfidence ?? item?.confidenceScore;
  if (conf == null) return true;
  const n = typeof conf === 'number' ? conf : Number(conf);
  if (!Number.isFinite(n)) return true;
  if (item?.needsReview === true && n < floor) return false;
  return n >= floor;
}

export function filterItemsForBestLook<T extends {
  wardrobeConfidence?: number | null;
  confidenceScore?: number | null;
  needsReview?: boolean | null;
}>(items: T[], floor = OUTFIT_CONFIDENCE_FLOOR): T[] {
  const list = Array.isArray(items) ? items : [];
  const trusted = list.filter((item) => itemPassesOutfitConfidenceGate(item, floor));
  if (trusted.length >= 3) return trusted;
  return list;
}
