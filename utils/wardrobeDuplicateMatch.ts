/**
 * Client-side wardrobe near-duplicate heuristics (offline / pre-check).
 * Server dHash is authoritative when online; this mirrors attribute scoring.
 */

export type WardrobeDupeCandidate = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  brand?: string | null;
  imageUri?: string | null;
};

export type WardrobeDupeMatch = {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  brand?: string | null;
  imageUri?: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  attrScore: number;
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
    && String(candidate.name || '').trim().length > 0;

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
