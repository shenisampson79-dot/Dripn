/**
 * Contract 1 — client mirror of server compileRefineIntent.
 * Occasion inheritance for refine POSTs; lock polarity is server-authoritative.
 * Keep in sync with Dripn-Server/services/compileRefineIntent.js
 */

export type OutfitSlot = 'top' | 'bottom' | 'footwear' | 'layer' | 'accessory';

export type RefineMode = 'slot_swap' | 'partial_recompose' | 'refresh' | 'ambiguous' | 'none';

export type RefineIntent = {
  keep: OutfitSlot[];
  replace: OutfitSlot[];
  mode: RefineMode;
  occasion: string;
  occasionSource: 'inherited' | 'explicit_ask' | 'raise_formality';
  confidence: 'high' | 'ambiguous';
  clarifySlot?: OutfitSlot;
  isRefresh: boolean;
  raiseFormality: boolean;
  dressierRefresh?: boolean;
  refine: string | null;
};

const OUTFIT_SLOTS: OutfitSlot[] = ['top', 'bottom', 'footwear', 'layer', 'accessory'];

const SLOT_PATTERNS: Record<OutfitSlot, RegExp> = {
  top: /\b(tops?|tee|t-?shirt|shirt|tank|blouse|polo|knit|sweater|jumper)\b/i,
  bottom: /\b(bottoms?|trousers?|pants?|shorts?|jeans?|cargos?|chinos?|skirt|joggers?|leggings?)\b/i,
  footwear: /\b(shoes?|trainers?|sneakers?|boots?|footwear|loafers?|sandals?|heels?|uggs?)\b/i,
  layer: /\b(layer|jacket|blazer|coat|overshirt|cardigan|gilet|vest|hoodie|zip)\b/i,
  accessory: /\b(accessor(?:y|ies)|bag|tote|belt|hat|cap|scarf)\b/i,
};

const KEEP_VERB = /\b(keep|keeping|same|still)\b/i;
// "instead" is replace only when slotsFromClause already found a garment slot.
const REPLACE_VERB = /\b(change|changing|swap|swapping|different|other|new|replace|replacing|instead)\b/i;

const EXPLICIT_OCCASION_CUES: Array<{ re: RegExp; occasion: string }> = [
  { re: /\b(gym|workout|training|run|exercise)\b/i, occasion: 'gym' },
  { re: /\b(date night|date-night|anniversary)\b/i, occasion: 'date_night' },
  { re: /\b(dinner|evening out|night out|drinks|cocktail|theatre|theater|opera|somewhere nice|nice dinner)\b/i, occasion: 'evening_out' },
  { re: /\b(work|office|interview|client meeting)\b/i, occasion: 'work_outfit' },
  { re: /\b(smart casual|business casual)\b/i, occasion: 'smart_casual' },
  { re: /\b(travel|airport|flight)\b/i, occasion: 'travel' },
  { re: /\b(weekend|saturday|sunday|brunch|pub|friends|park|errands)\b/i, occasion: 'casual_day' },
];

const RAISE_FORMALITY_RE = /\b(not appropriate|too casual|dressier|smarter|more formal|nice dinner|somewhere nice|sharper)\b/i;
const DRESSIER_REFRESH_RE = /\b(not appropriate|too casual|dressier|more formal|nice dinner|somewhere nice|sharper)\b/i;
const REFRESH_RE = /\b(make it (smarter|dressier|sharper|better)|different (outfit|look)|try (again|another|something else)|don'?t like|do not like|another (option|look)|give me another|something different|reject|hate)\b/i;

function uniq<T>(list: T[]): T[] {
  return [...new Set(list.filter(Boolean))];
}

export function splitRefineClauses(text: string): string[] {
  const raw = String(text || '').trim();
  if (!raw) return [];
  return raw
    .split(/\s*(?:\bbut\b|\bhowever\b|\.|!|\?|;)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function slotsFromClause(clause: string): { keep: OutfitSlot[]; replace: OutfitSlot[] } {
  const keep: OutfitSlot[] = [];
  const replace: OutfitSlot[] = [];
  const hasKeep = KEEP_VERB.test(clause);
  const hasReplace = REPLACE_VERB.test(clause);
  const found: OutfitSlot[] = [];
  for (const slot of OUTFIT_SLOTS) {
    if (SLOT_PATTERNS[slot].test(clause)) found.push(slot);
  }
  if (!found.length) return { keep, replace };

  if (hasReplace && !hasKeep) {
    for (const s of found) replace.push(s);
  } else if (hasKeep && !hasReplace) {
    for (const s of found) keep.push(s);
  } else if (hasKeep && hasReplace) {
    const lastIndex = (re: RegExp) => {
      let m: RegExpExecArray | null;
      let last = -1;
      const r = new RegExp(re.source, 'gi');
      while ((m = r.exec(clause))) last = m.index;
      return last;
    };
    const keepIdx = lastIndex(KEEP_VERB);
    const replaceIdx = lastIndex(REPLACE_VERB);
    for (const slot of found) {
      const slotIdx = clause.search(SLOT_PATTERNS[slot]);
      if (slotIdx < 0) continue;
      const distKeep = keepIdx >= 0 ? Math.abs(slotIdx - keepIdx) : Infinity;
      const distReplace = replaceIdx >= 0 ? Math.abs(slotIdx - replaceIdx) : Infinity;
      if (distReplace <= distKeep) replace.push(slot);
      else keep.push(slot);
    }
  }
  return { keep, replace };
}

export function resolveRefineOccasion(
  text: string,
  priorOccasion?: string | null,
): { occasion: string; occasionSource: RefineIntent['occasionSource'] } {
  const prior = String(priorOccasion || '').trim() || 'casual_day';
  const t = String(text || '');

  // Same-kind / another-option continuation: keep prior structured occasion.
  // Words like "drinks" inside "same kind of lunch or drinks" must NOT promote
  // to evening_out unless the user explicitly changes occasion / dressiness.
  const sameKindContinuation = /\b(same\s+kind|same\s+(look|vibe|style|direction)|another\s+(option|look|way)|give\s+me\s+another|something\s+different|different\s+(outfit|look)|try\s+(again|another))\b/i.test(t);
  // Genuine lane change — not plain "make it smarter" (formality raise stays separate).
  const explicitOccasionChange = /\b(change\s+(?:it\s+)?to|actually\s+(?:make\s+it\s+)?|instead\s+(?:make\s+it\s+)?|for\s+tonight|tonight|this\s+evening|something\s+for\s+tonight)\b/i.test(t)
    || /\bmake\s+it\s+(?:a\s+)?(?:dinner|evening|night\s+out|work|office|gym|date)\b/i.test(t);

  if (sameKindContinuation && !explicitOccasionChange) {
    if (!RAISE_FORMALITY_RE.test(t)) {
      return { occasion: prior, occasionSource: 'inherited' };
    }
  }

  for (const cue of EXPLICIT_OCCASION_CUES) {
    if (cue.re.test(t)) {
      if (sameKindContinuation && !explicitOccasionChange) {
        return { occasion: prior, occasionSource: 'inherited' };
      }
      return { occasion: cue.occasion, occasionSource: 'explicit_ask' };
    }
  }

  if (RAISE_FORMALITY_RE.test(t)) {
    const p = prior.toLowerCase().replace(/\s+/g, '_');
    if (/gym|workout/.test(p)) {
      return { occasion: 'gym', occasionSource: 'inherited' };
    }
    if (!DRESSIER_REFRESH_RE.test(t)) {
      return { occasion: prior, occasionSource: 'inherited' };
    }
    return {
      occasion: /evening|date|dinner/.test(p) ? prior : 'evening_out',
      occasionSource: 'raise_formality',
    };
  }

  return { occasion: prior, occasionSource: 'inherited' };
}

export function classifyRefineMode(input: {
  keep: string[];
  replace: string[];
  isRefresh: boolean;
}): RefineMode {
  if (input.isRefresh && !input.keep.length && !input.replace.length) return 'refresh';
  if (!input.keep.length && input.replace.length === 1 && !input.isRefresh) return 'slot_swap';
  if (input.keep.length || input.replace.length > 1 || (input.keep.length && input.replace.length)) {
    return 'partial_recompose';
  }
  return 'none';
}

function refineEnumFromSlots(intent: {
  keep: string[];
  replace: string[];
  isRefresh?: boolean;
  raiseFormality?: boolean;
  dressierRefresh?: boolean;
  mode?: string;
}): string | null {
  const keep = new Set(intent.keep || []);
  const replace = new Set(intent.replace || []);
  if (intent.isRefresh || intent.mode === 'refresh') {
    return intent.dressierRefresh ? 'refresh_dressier' : 'refresh_smarter';
  }
  if (keep.has('top') && replace.has('bottom') && replace.has('footwear') && !replace.has('top')) {
    return 'keep_top_replace_bottom_footwear';
  }
  if (keep.has('footwear') && replace.has('top') && replace.has('bottom')) {
    return 'keep_footwear_change_top_bottom';
  }
  if (intent.mode === 'slot_swap' && replace.has('footwear') && replace.size === 1) {
    return 'swap_footwear';
  }
  if (replace.has('footwear') && replace.has('bottom') && !keep.size) {
    return 'exclude_shoes_bottoms';
  }
  if (keep.size || replace.size) {
    const k = [...keep].sort().join('+') || 'none';
    const r = [...replace].sort().join('+') || 'none';
    return `keep_${k}_replace_${r}`;
  }
  return null;
}

export function compileRefineIntent(
  text: string,
  opts: { priorOccasion?: string | null } = {},
): RefineIntent {
  const raw = String(text || '').trim();
  const occ = resolveRefineOccasion(raw, opts.priorOccasion);
  const raiseFormality = RAISE_FORMALITY_RE.test(raw);
  const dressierRefresh = DRESSIER_REFRESH_RE.test(raw);
  const isRefresh = REFRESH_RE.test(raw);

  const keep: OutfitSlot[] = [];
  const replace: OutfitSlot[] = [];
  const clauses = splitRefineClauses(raw);
  for (const clause of clauses.length ? clauses : [raw]) {
    const part = slotsFromClause(clause);
    keep.push(...part.keep);
    replace.push(...part.replace);
  }

  let keepU = uniq(keep);
  let replaceU = uniq(replace);

  // Same slot in keep and replace: the replace clause is the slot op
  // ("keep the rest but change the shoes" also names the current shoes).
  // Drop the slot from keep so slot_swap can lock the rest of the prior look.
  if (keepU.some((s) => replaceU.includes(s))) {
    keepU = keepU.filter((s) => !replaceU.includes(s));
  }

  if (!keepU.length && !replaceU.length) {
    if (
      /\b(swap|change|different|other)\b.{0,24}\b(shoe|shoes|trainer|trainers|sneaker|sneakers|boot|boots|footwear)\b/i.test(raw)
      || /\b(shoe|shoes|trainer|trainers|boot|boots)\b.{0,16}\b(swap|change|different|other)\b/i.test(raw)
    ) {
      replaceU = ['footwear'];
    }
  }

  if (isRefresh && !keepU.length && !replaceU.length) {
    return {
      keep: [],
      replace: [],
      mode: 'refresh',
      occasion: occ.occasion,
      occasionSource: occ.occasionSource,
      confidence: 'high',
      isRefresh: true,
      raiseFormality,
      dressierRefresh,
      refine: refineEnumFromSlots({
        isRefresh: true,
        raiseFormality,
        dressierRefresh,
        mode: 'refresh',
      }),
    };
  }

  const mode = classifyRefineMode({
    keep: keepU,
    replace: replaceU,
    isRefresh: false,
  });

  if (mode === 'slot_swap') {
    const replaced = replaceU[0];
    const implicitKeep = (['top', 'bottom', 'layer', 'accessory'] as OutfitSlot[])
      .filter((s) => s !== replaced);
    return {
      keep: implicitKeep,
      replace: replaceU,
      mode: 'slot_swap',
      occasion: occ.occasion,
      occasionSource: occ.occasionSource,
      confidence: 'high',
      isRefresh: false,
      raiseFormality,
      refine: refineEnumFromSlots({
        keep: implicitKeep,
        replace: replaceU,
        mode: 'slot_swap',
      }),
    };
  }

  return {
    keep: keepU,
    replace: replaceU,
    mode: mode === 'none' ? 'partial_recompose' : mode,
    occasion: occ.occasion,
    occasionSource: occ.occasionSource,
    confidence: 'high',
    isRefresh: false,
    raiseFormality,
    refine: refineEnumFromSlots({
      keep: keepU,
      replace: replaceU,
      mode: mode === 'none' ? 'partial_recompose' : mode,
    }),
  };
}
