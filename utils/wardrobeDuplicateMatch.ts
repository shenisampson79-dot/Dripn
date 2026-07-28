/**
 * Client-side wardrobe near-duplicate heuristics (offline / pre-check).
 * Server dHash + embedding is authoritative when online; this mirrors attribute scoring.
 */

export type DuplicateDecisionType = 'duplicate' | 'similar_item' | 'already_owned' | 'ok';

export type WardrobeDupeCandidate = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  brand?: string | null;
  imageUri?: string | null;
};

export type DuplicateMatch = {
  id?: string | number;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  brand?: string | null;
  imageUri?: string | null;
  imageUrl?: string | null;
  confidence?: 'high' | 'medium' | 'low' | string;
  reason?: string;
  attrScore?: number;
  embeddingScore?: number | null;
  similarityScore?: number | null;
  hamming?: number | null;
  message?: string;
  matchScope?: 'wardrobe' | 'batch';
  matchedCandidateIndex?: number;
  tier?: DuplicateDecisionType | string;
};

export type WardrobeDupeMatch = DuplicateMatch & {
  id: string;
  name: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  attrScore: number;
};

export type NormalizedDuplicateDecision = {
  type: DuplicateDecisionType;
  matches: DuplicateMatch[];
  message?: string;
  isDuplicate: boolean;
  candidateIndex?: number;
};

const COLOR_ALIASES: Record<string, string> = {
  grey: 'gray',
  charcoal: 'gray',
  navy: 'blue',
  burgundy: 'red',
  maroon: 'red',
  beige: 'tan',
  khaki: 'tan',
  cream: 'white',
  ivory: 'white',
};

const ATTR_SOFT_THRESHOLD = 0.82;

/** Generic detector labels — never treat as exact-name duplicates. */
const GENERIC_ITEM_NAMES = new Set([
  'bag',
  'bags',
  'top',
  'tops',
  'clothing',
  'item',
  'shoes',
  'bottoms',
  'accessory',
  'accessories',
  'outerwear',
  'dress',
  'dress / one-piece',
]);

function isGenericItemName(name?: string | null): boolean {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return true;
  if (GENERIC_ITEM_NAMES.has(n)) return true;
  // "White Bag", "Item bags", etc.
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2 && tokens.some((t) => GENERIC_ITEM_NAMES.has(t))) return true;
  return false;
}

function normalizeColor(color?: string | null): string {
  if (!color) return '';
  const c = color.toLowerCase().trim().replace(/\s+/g, ' ');
  const first = c.split(/[/,|&]/)[0].trim();
  return COLOR_ALIASES[first] || first;
}

function normalizeCategory(category?: string | null): string {
  if (!category) return '';
  return category.toLowerCase().trim().replace(/\s+/g, '_');
}

export function categoriesCompatible(a?: string | null, b?: string | null): boolean {
  const ca = normalizeCategory(a);
  const cb = normalizeCategory(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca === 'activewear_tops' && cb === 'tops') return true;
  if (ca === 'tops' && cb === 'activewear_tops') return true;
  if (ca === 'activewear_bottoms' && cb === 'bottoms') return true;
  if (ca === 'bottoms' && cb === 'activewear_bottoms') return true;
  return false;
}

function tokenSet(str?: string | null): Set<string> {
  return new Set(
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccard(a?: string | null, b?: string | null): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

export function attributeSimilarity(
  candidate: WardrobeDupeCandidate,
  existing: WardrobeDupeCandidate,
): number {
  if (!categoriesCompatible(candidate.category, existing.category)) return 0;

  const nameSim = jaccard(candidate.name, existing.name);

  const candColor = normalizeColor(candidate.color);
  const existColor = normalizeColor(existing.color);
  const sameColor = Boolean(
    candColor
    && existColor
    && (candColor === existColor || candColor.includes(existColor) || existColor.includes(candColor)),
  );

  const candBrand = String(candidate.brand || '').toLowerCase().trim();
  const existBrand = String(existing.brand || '').toLowerCase().trim();
  const sameBrand = Boolean(
    candBrand
    && existBrand
    && (candBrand === existBrand || candBrand.includes(existBrand) || existBrand.includes(candBrand)),
  );

  const sameSub = Boolean(
    candidate.subcategory
    && existing.subcategory
    && normalizeCategory(candidate.subcategory) === normalizeCategory(existing.subcategory),
  );

  const exactName =
    String(candidate.name || '').toLowerCase().trim()
      === String(existing.name || '').toLowerCase().trim()
    && String(candidate.name || '').trim().length > 0
    && !isGenericItemName(candidate.name);

  if (exactName) return Math.min(1, 0.9 + (sameColor ? 0.05 : 0) + (sameBrand ? 0.05 : 0));

  let score = 0.35;
  score += nameSim * 0.4;
  if (sameSub) score += 0.12;
  if (sameColor) score += 0.15;
  if (sameBrand) score += 0.12;

  // Same colour + shared subtype alone should not soft-block distinct items (two black tees)
  if (sameColor && nameSim < 0.45 && !sameBrand) {
    score = Math.min(score, 0.78);
  }

  // Generic detector labels ("Bag", "Top") must not soft-dupe just by matching each other
  if (
    (isGenericItemName(candidate.name) || isGenericItemName(existing.name))
    && !sameBrand
  ) {
    score = Math.min(score, 0.72);
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Local attribute-only duplicate scan (used offline / before server check).
 */
export function findLocalWardrobeDuplicates(
  candidate: WardrobeDupeCandidate,
  wardrobe: Array<
    WardrobeDupeCandidate & {
      id: string;
      imageUri?: string | null;
      origin?: string | null;
    }
  >,
): WardrobeDupeMatch[] {
  const matches: WardrobeDupeMatch[] = [];
  for (const item of wardrobe) {
    if (item.origin === 'inspiration' || item.origin === 'wishlist') continue;
    const attrScore = attributeSimilarity(candidate, item);
    if (attrScore < ATTR_SOFT_THRESHOLD) continue;
    matches.push({
      id: String(item.id),
      name: item.name || 'Wardrobe item',
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      brand: item.brand,
      imageUri: item.imageUri,
      confidence: attrScore >= 0.9 ? 'high' : 'medium',
      reason: 'attribute_match',
      attrScore,
    });
  }
  return matches.sort((a, b) => b.attrScore - a.attrScore).slice(0, 5);
}

export function formatDuplicateNames(matches: Array<{ name?: string | null }>): string {
  const names = matches.map((m) => m.name || 'item').filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Normalize server check-duplicates / 409 / local results into a shared decision shape.
 */
export function normalizeDuplicateDecision(input: {
  type?: string | null;
  isDuplicate?: boolean;
  message?: string | null;
  matches?: DuplicateMatch[] | null;
  similarMatches?: DuplicateMatch[] | null;
  decision?: { type?: string; matches?: DuplicateMatch[]; message?: string } | null;
  candidateIndex?: number;
} | null | undefined): NormalizedDuplicateDecision {
  const decisionType = (input?.decision?.type || input?.type || '').toLowerCase();
  const matches = (input?.decision?.matches || input?.matches || []).filter(Boolean);
  const similar = (input?.similarMatches || []).filter(Boolean);
  const message = input?.decision?.message || input?.message || undefined;

  if (decisionType === 'already_owned' || (input?.isDuplicate && decisionType === 'already_owned')) {
    return { type: 'already_owned', matches, message, isDuplicate: true, candidateIndex: input?.candidateIndex };
  }
  if (decisionType === 'duplicate' || input?.isDuplicate) {
    return {
      type: 'duplicate',
      matches: matches.length ? matches : similar,
      message,
      isDuplicate: true,
      candidateIndex: input?.candidateIndex,
    };
  }
  if (decisionType === 'similar_item' || similar.length > 0) {
    return {
      type: 'similar_item',
      matches: similar.length ? similar : matches,
      message: message || similar[0]?.message || matches[0]?.message,
      isDuplicate: false,
      candidateIndex: input?.candidateIndex,
    };
  }
  return { type: 'ok', matches: [], message: undefined, isDuplicate: false, candidateIndex: input?.candidateIndex };
}

/**
 * Offline pairwise within-batch duplicates (attribute-only).
 */
export function findLocalWithinBatchDuplicates(
  candidates: Array<WardrobeDupeCandidate & { id: string }>,
): Array<{ id: string; matches: WardrobeDupeMatch[]; matchedIds: string[] }> {
  const out = candidates.map((c) => ({ id: c.id, matches: [] as WardrobeDupeMatch[], matchedIds: [] as string[] }));
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const score = attributeSimilarity(candidates[i], candidates[j]);
      if (score < ATTR_SOFT_THRESHOLD) continue;
      const left: WardrobeDupeMatch = {
        id: candidates[j].id,
        name: candidates[j].name || 'Item',
        category: candidates[j].category,
        color: candidates[j].color,
        brand: candidates[j].brand,
        imageUri: candidates[j].imageUri,
        confidence: score >= 0.9 ? 'high' : 'medium',
        reason: 'batch_attribute_match',
        attrScore: score,
        matchScope: 'batch',
      };
      const right: WardrobeDupeMatch = {
        ...left,
        id: candidates[i].id,
        name: candidates[i].name || 'Item',
        category: candidates[i].category,
        color: candidates[i].color,
        brand: candidates[i].brand,
        imageUri: candidates[i].imageUri,
      };
      out[i].matches.push(left);
      out[i].matchedIds.push(candidates[j].id);
      out[j].matches.push(right);
      out[j].matchedIds.push(candidates[i].id);
    }
  }
  return out;
}
