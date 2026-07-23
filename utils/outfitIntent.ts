/**
 * Outfit Intent — soft bias for *why* an outfit is worn.
 * Mirrors Dripn-Server/services/outfitIntent.js. Never invents garments; never hard-blocks.
 */
import {
  classifyGarment,
  getOutfitIntent,
  getOutfitIntents,
  type GarmentClassification,
} from '@/utils/garmentTaxonomy';
import { getColorGroup, detectWheelRelationship } from '@/utils/outfitColorHarmony';

export type OutfitIntentName =
  | 'effortless'
  | 'power'
  | 'date_night'
  | 'editorial'
  | 'casual_day'
  | 'smart_casual'
  | string;

export type OutfitIntentDef = {
  name: string;
  label?: string;
  summaryTone?: string;
  formalityTarget?: number | null;
  structureBias?: 'relaxed' | 'structured' | 'balanced' | 'any' | string;
  effortLevel?: string;
  boldness?: string;
  colorRules?: {
    maxColors?: number;
    preferMonochrome?: boolean;
    allowContrast?: boolean;
  };
  silhouetteRules?: {
    preferRelaxed?: boolean;
    preferStructured?: boolean;
    preferBalanced?: boolean;
    allowOversized?: boolean;
    preferContrast?: boolean;
  };
  preferredSubtypes?: string[];
  avoidedSubtypes?: string[];
  rules?: {
    restrictLayers?: number;
    requireAnchor?: boolean;
  };
};

export type ResolveOutfitIntentInput = {
  query?: string | null;
  occasion?: string | null;
  dressFor?: string | null;
  styleProfile?: string | null;
  source?: string | null;
  vibe?: string | null;
  intent?: string | null;
};

export type ResolvedOutfitIntent = {
  name: string;
  intent: OutfitIntentDef;
  source: string;
  reason: string;
};

export type IntentScoreResult = {
  adjustment: number;
  intent: string | null;
  hits: Array<{ subtype?: string; kind: string; count?: number }>;
  details: Record<string, unknown>;
  resolvedName?: string;
  resolveReason?: string;
  resolveSource?: string;
};

const STRUCTURED_SUBTYPES = new Set([
  'blazer',
  'tailored_coat',
  'tailored_trousers',
  'oxford_shirt',
  'oxfords',
  'derby',
  'stilettos',
  'heels',
  'block_heels',
  'chelsea_boots',
  'tie',
]);

const RELAXED_SUBTYPES = new Set([
  'linen_shirt',
  'linen_shorts',
  'oversized_tee',
  'basic_tee',
  'hoodie',
  'joggers',
  'leather_sandals',
  'slides',
  'espadrilles',
  'uggs',
]);

const ANCHOR_SUBTYPES = new Set([
  'blazer',
  'tailored_coat',
  'oxfords',
  'derby',
  'loafers',
  'heels',
  'stilettos',
  'block_heels',
  'statement_heels',
  'chelsea_boots',
  'combat_boots',
  'minimal_sneaker',
  'ankle_boots',
]);

const OCCASION_TO_INTENT: Record<string, string> = {
  effortless: 'effortless',
  power: 'power',
  date_night: 'date_night',
  'date-night': 'date_night',
  first_date: 'date_night',
  'first-date': 'date_night',
  editorial: 'editorial',
  casual_day: 'casual_day',
  casual: 'casual_day',
  'casual-hangout': 'casual_day',
  everyday: 'casual_day',
  weekend: 'casual_day',
  smart_casual: 'smart_casual',
  'smart-casual': 'smart_casual',
  work_outfit: 'power',
  work: 'power',
  office: 'power',
  interview: 'power',
  'job-interview': 'power',
  business: 'power',
  formal: 'power',
  wedding: 'power',
  gala: 'power',
  black_tie: 'power',
  'black-tie': 'power',
  evening_out: 'date_night',
  dinner: 'date_night',
  party: 'editorial',
  travel: 'effortless',
  gym: 'casual_day',
  workout: 'casual_day',
  'gym-active': 'casual_day',
};

const DRESS_FOR_TO_INTENT: Record<string, string> = {
  work: 'power',
  date: 'date_night',
  event: 'power',
  friends: 'casual_day',
  myself: 'effortless',
};

export function listOutfitIntents(): string[] {
  return Object.keys(getOutfitIntents());
}

export function loadOutfitIntent(name?: string | null): OutfitIntentDef | null {
  if (!name) return null;
  const key = String(name).toLowerCase().trim();
  return getOutfitIntent(key) || getOutfitIntent(OCCASION_TO_INTENT[key]) || null;
}

function normalizeOccasionKey(raw?: string | null): string | null {
  if (!raw) return null;
  return String(raw).toLowerCase().trim().replace(/\s+/g, '_');
}

function intentFromQuery(query = ''): string | null {
  const q = String(query || '').toLowerCase();
  if (!q) return null;
  if (/\b(editorial|runway|fashion\s*week|high[\s-]?fashion|statement\s+look|avant[\s-]?garde)\b/.test(q)) {
    return 'editorial';
  }
  if (/\b(power\s*dress|boardroom|interview|presentation|pitch|client\s+meeting|executive|boss\s+look)\b/.test(q)
    || /\bpower\b/.test(q)) {
    return 'power';
  }
  if (/\b(date\s*night|first\s*date|romantic|anniversary\s*dinner|dinner\s*date)\b/.test(q)
    || /\bdate\b/.test(q)) {
    return 'date_night';
  }
  if (/\b(effortless|easy\s+look|low[\s-]?effort|relaxed\s+vibe|undone)\b/.test(q)) {
    return 'effortless';
  }
  if (/\b(smart[\s-]?casual)\b/.test(q)) return 'smart_casual';
  if (/\b(casual\s+day|everyday|weekend\s+look)\b/.test(q)) return 'casual_day';
  return null;
}

export function resolveOutfitIntent(input: ResolveOutfitIntentInput = {}): ResolvedOutfitIntent {
  const source = String(input.source || 'unknown').toLowerCase();

  if (input.intent) {
    const direct = loadOutfitIntent(input.intent);
    if (direct) {
      return { name: direct.name, intent: direct, source, reason: 'explicit' };
    }
  }

  const fromQuery = intentFromQuery(input.query || '');
  if (fromQuery) {
    const intent = loadOutfitIntent(fromQuery);
    if (intent) return { name: intent.name, intent, source, reason: 'query_keyword' };
  }

  const vibeKey = normalizeOccasionKey(input.vibe);
  if (vibeKey && OCCASION_TO_INTENT[vibeKey]) {
    const intent = loadOutfitIntent(OCCASION_TO_INTENT[vibeKey]);
    if (intent) return { name: intent.name, intent, source, reason: 'vibe' };
  }

  const occKey = normalizeOccasionKey(input.occasion);
  if (occKey) {
    const candidates = [occKey, occKey.replace(/-/g, '_'), occKey.replace(/_/g, '-')];
    for (const c of candidates) {
      if (OCCASION_TO_INTENT[c]) {
        const intent = loadOutfitIntent(OCCASION_TO_INTENT[c]);
        if (intent) return { name: intent.name, intent, source, reason: 'occasion' };
      }
    }
  }

  const dressKey = String(input.dressFor || '').toLowerCase().trim();
  if (dressKey && DRESS_FOR_TO_INTENT[dressKey]) {
    const intent = loadOutfitIntent(DRESS_FOR_TO_INTENT[dressKey]);
    if (intent) return { name: intent.name, intent, source, reason: 'dressFor' };
  }

  if (source === 'outfit_mix' || source === 'mix') {
    const intent = loadOutfitIntent('casual_day') || loadOutfitIntent('effortless')!;
    return { name: intent.name, intent, source, reason: 'mix_default' };
  }

  if (source === 'buy' || source === 'sanity' || source === 'shopping') {
    const intent = loadOutfitIntent('effortless')!;
    return { name: intent.name, intent, source, reason: 'buy_default' };
  }

  const fallback = loadOutfitIntent('effortless') || loadOutfitIntent('casual_day')!;
  return { name: fallback.name, intent: fallback, source, reason: 'default' };
}

function itemIsAccessory(classification: GarmentClassification): boolean {
  return classification?.meta?.category === 'accessory';
}

function avgFormality(classifications: GarmentClassification[]): number | null {
  const nums = classifications
    .map((c) => (typeof c.formality === 'number' ? c.formality : c.meta?.formality))
    .filter((n): n is number => typeof n === 'number');
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function hasAnchor(classifications: GarmentClassification[]): boolean {
  return classifications.some((c) => {
    if (!c.subtype) return false;
    if (c.meta?.category === 'footwear') return true;
    return ANCHOR_SUBTYPES.has(c.subtype) || STRUCTURED_SUBTYPES.has(c.subtype);
  });
}

function colorSignals(items: Array<{ color?: string | null }>) {
  const groups = (items || [])
    .map((item) => getColorGroup(item.color))
    .filter((g) => g && g !== 'unknown');
  const uniqueGroups = new Set(groups);
  const wheel = detectWheelRelationship([], groups);
  return {
    uniqueGroupCount: uniqueGroups.size,
    isMonochrome: uniqueGroups.size <= 1 || wheel === 'monochromatic',
  };
}

export function intentScore(
  itemOrOutfit: object | object[] | null | undefined,
  intentOrName: string | OutfitIntentDef | null | undefined,
): IntentScoreResult {
  const items = Array.isArray(itemOrOutfit)
    ? itemOrOutfit
    : (itemOrOutfit ? [itemOrOutfit] : []);
  const intent = typeof intentOrName === 'string'
    ? loadOutfitIntent(intentOrName)
    : (intentOrName?.name ? loadOutfitIntent(intentOrName.name) || intentOrName : intentOrName);

  if (!intent || !items.length) {
    return { adjustment: 0, intent: intent?.name || null, hits: [], details: {} };
  }

  const classifications = items.map((item) => classifyGarment(item as any));
  const hits: IntentScoreResult['hits'] = [];
  let bonus = 0;
  let penalty = 0;

  const prefer = new Set(intent.preferredSubtypes || []);
  const avoid = new Set(intent.avoidedSubtypes || []);

  for (const c of classifications) {
    if (!c.subtype) continue;
    if (prefer.has(c.subtype)) {
      bonus += 3;
      hits.push({ subtype: c.subtype, kind: 'prefer' });
    }
    if (avoid.has(c.subtype)) {
      penalty += 4;
      hits.push({ subtype: c.subtype, kind: 'avoid' });
    }
  }

  const target = intent.formalityTarget;
  const avg = avgFormality(classifications);
  let formalityDelta = 0;
  if (typeof target === 'number' && avg != null) {
    formalityDelta = Math.abs(avg - target);
    penalty += Math.min(6, formalityDelta * 1.5);
  }

  const colors = colorSignals(items as Array<{ color?: string | null }>);
  const colorRules = intent.colorRules || {};
  if (typeof colorRules.maxColors === 'number' && colors.uniqueGroupCount > colorRules.maxColors) {
    penalty += 2 * (colors.uniqueGroupCount - colorRules.maxColors);
    hits.push({ kind: 'color_max', count: colors.uniqueGroupCount });
  }
  if (colorRules.preferMonochrome) {
    if (colors.isMonochrome || colors.uniqueGroupCount <= 2) bonus += 2;
    else penalty += 2;
  }
  if (colorRules.allowContrast && colors.uniqueGroupCount >= 2 && intent.boldness === 'high') {
    bonus += 1;
  }

  const silRules = intent.silhouetteRules || {};
  const bias = intent.structureBias || 'any';
  let structuredHits = 0;
  let relaxedHits = 0;
  let oversizedHits = 0;
  for (const c of classifications) {
    if (!c.subtype) continue;
    if (STRUCTURED_SUBTYPES.has(c.subtype) || c.meta?.isTailored) structuredHits += 1;
    if (RELAXED_SUBTYPES.has(c.subtype) || c.meta?.silhouette === 'relaxed') relaxedHits += 1;
    if (c.subtype === 'oversized_tee' || c.meta?.silhouette === 'oversized') oversizedHits += 1;
  }

  if (bias === 'structured' || silRules.preferStructured) {
    bonus += Math.min(4, structuredHits * 2);
    penalty += Math.min(4, relaxedHits + (silRules.allowOversized === false ? oversizedHits * 2 : 0));
  } else if (bias === 'relaxed' || silRules.preferRelaxed) {
    bonus += Math.min(4, relaxedHits * 2);
    if (silRules.allowOversized) bonus += Math.min(2, oversizedHits);
    penalty += Math.min(3, structuredHits > 2 ? structuredHits : 0);
  } else if (bias === 'balanced' || silRules.preferBalanced) {
    if (structuredHits >= 1 && relaxedHits <= 2) bonus += 2;
  }
  if (silRules.allowOversized && intent.boldness === 'high' && oversizedHits >= 1) {
    bonus += 1;
  }

  const rules = intent.rules || {};
  const layerCount = classifications.filter((c) => !itemIsAccessory(c)).length;
  if (typeof rules.restrictLayers === 'number' && layerCount > rules.restrictLayers) {
    penalty += (layerCount - rules.restrictLayers) * 2;
    hits.push({ kind: 'layers', count: layerCount });
  }

  let anchorOk = true;
  if (rules.requireAnchor) {
    anchorOk = hasAnchor(classifications);
    if (!anchorOk) {
      penalty += 3;
      hits.push({ kind: 'missing_anchor' });
    }
  }

  const adjustment = Math.max(-10, Math.min(12, Math.round(bonus - penalty)));
  return {
    adjustment,
    intent: intent.name,
    hits,
    details: {
      formalityAvg: avg,
      formalityTarget: target,
      formalityDelta,
      colorGroups: colors.uniqueGroupCount,
      monochrome: colors.isMonochrome,
      structuredHits,
      relaxedHits,
      oversizedHits,
      layerCount,
      anchorOk,
      label: intent.label,
      summaryTone: intent.summaryTone,
      structureBias: intent.structureBias,
      effortLevel: intent.effortLevel,
      boldness: intent.boldness,
    },
  };
}

export function scoreOutfitIntentBias(
  items: object[],
  options: ResolveOutfitIntentInput & { intent?: string | OutfitIntentDef | null } = {},
): IntentScoreResult {
  const resolved = options.intent && typeof options.intent === 'object' && (options.intent as OutfitIntentDef).name
    ? {
      name: (options.intent as OutfitIntentDef).name,
      intent: options.intent as OutfitIntentDef,
      source: options.source || 'explicit',
      reason: 'explicit',
    }
    : resolveOutfitIntent(options);
  const scored = intentScore(items, resolved.intent);
  return {
    ...scored,
    resolvedName: resolved.name,
    resolveReason: resolved.reason,
    resolveSource: resolved.source,
  };
}

export function intentSummaryPhrase(intentOrName?: string | OutfitIntentDef | null): string | null {
  const intent = typeof intentOrName === 'string'
    ? loadOutfitIntent(intentOrName)
    : intentOrName;
  if (!intent) return null;
  return intent.summaryTone || `This reads as ${intent.label || intent.name}`;
}

export function formatIntentForPrompt(resolvedOrName: string | ResolvedOutfitIntent | OutfitIntentDef | null | undefined): string {
  const intent = typeof resolvedOrName === 'string'
    ? loadOutfitIntent(resolvedOrName)
    : ((resolvedOrName as ResolvedOutfitIntent)?.intent || resolvedOrName as OutfitIntentDef);
  if (!intent) return '';
  const prefer = (intent.preferredSubtypes || []).slice(0, 8).join(', ');
  const avoid = (intent.avoidedSubtypes || []).slice(0, 6).join(', ');
  return [
    `OUTFIT INTENT: ${intent.name} (${intent.label || intent.name})`,
    intent.summaryTone ? `Tone: ${intent.summaryTone}.` : null,
    typeof intent.formalityTarget === 'number' ? `Formality target: ${intent.formalityTarget}/5.` : null,
    intent.structureBias ? `Structure bias: ${intent.structureBias}.` : null,
    intent.effortLevel ? `Effort: ${intent.effortLevel}.` : null,
    intent.boldness ? `Boldness: ${intent.boldness}.` : null,
    prefer ? `Prefer subtypes: ${prefer}.` : null,
    avoid ? `Avoid subtypes: ${avoid}.` : null,
    'Explain only — do not invent garments or override clash/score.',
  ].filter(Boolean).join('\n');
}
