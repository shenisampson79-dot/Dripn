/**
 * Client-side wardrobe near-duplicate heuristics (offline / pre-check).
 * Server dHash + embedding is authoritative when online.
 *
 * LAUNCH CONTRACT v2 (lockstep with Dripn-Server wardrobeDuplicateDetection.js):
 *   1. Same-scan / same-source (captureSessionId, sourceImageId, cropId)
 *   2. Perceptual image similarity (dHash / embedding)
 *   3. Normalized garment identity as SUPPORT only
 *   4. Colour / material / brand as supporting; disagreement reduces confidence
 *
 * Image identity is primary. Category/name only interpret the match.
 * User has the final say when confidence is ambiguous.
 */

export type DuplicateDecisionType =
  | 'duplicate'
  | 'similar_item'
  | 'classification_conflict'
  | 'already_owned'
  | 'ok';

export type WardrobeDupeCandidate = {
  id?: string | number | null;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  brand?: string | null;
  material?: string | null;
  imageUri?: string | null;
  imagePhash?: string | null;
  dHash?: string | null;
  sourceCropId?: string | null;
  cropId?: string | null;
  scanSessionId?: string | null;
  captureSessionId?: string | null;
  sourceImageId?: string | null;
  dedupeOverrideAgainst?: string | string[] | Array<{ id?: string | number; itemId?: string | number }> | null;
  aiTags?: Record<string, unknown> | null;
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
  imageSimilarity?: number | null;
  hamming?: number | null;
  message?: string;
  matchScope?: 'wardrobe' | 'batch';
  matchedCandidateIndex?: number;
  tier?: DuplicateDecisionType | string;
  isDuplicate?: boolean;
  sameScanExactCrop?: boolean;
  categoryCompatible?: boolean;
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
  silver: 'gray',
  navy: 'blue',
  indigo: 'blue',
  cobalt: 'blue',
  burgundy: 'red',
  maroon: 'red',
  crimson: 'red',
  beige: 'tan',
  khaki: 'tan',
  cream: 'white',
  ivory: 'white',
  offwhite: 'white',
  'off-white': 'white',
};

/** Hamming ≤ 8 maps to imageSimilarity >= 0.94 (exact / rembg / compress). */
export const DHASH_NEAR_DUP = 8;
/** Hamming 9–16 maps into the probable band (angle / fold / lighting). */
export const DHASH_ANGLE_WARN = 16;
/** Beyond this, hashes are treated as distinct garments. */
export const DHASH_AMBIGUOUS_MAX = 24;

export const IMAGE_SIM_HARD = 0.94;
export const IMAGE_SIM_PROBABLE = 0.82;

export const GARMENT_FAMILIES = Object.freeze({
  top: Object.freeze(['tops', 'activewear_tops', 'sleepwear']),
  bottom: Object.freeze(['bottoms', 'activewear_bottoms']),
  outerwear: Object.freeze(['outerwear', 'formal']),
  footwear: Object.freeze(['shoes']),
  dress_one_piece: Object.freeze(['dresses']),
  accessory: Object.freeze(['accessories', 'bags', 'swimwear']),
});

export const DEDUPE_COPY = Object.freeze({
  hard: 'Looks like you already have this',
  probable: 'Is this a different item?',
  conflict: 'This looks familiar',
});

export const LAUNCH_DEDUPE_CONTRACT = Object.freeze({
  version: '2026-08-launch-v2',
  priority: Object.freeze([
    'same_source_scan',
    'perceptual_image_similarity',
    'normalized_garment_identity_support',
    'colour_material_brand_support',
  ] as const),
  imageSimHard: IMAGE_SIM_HARD,
  imageSimProbable: IMAGE_SIM_PROBABLE,
  dhashNearDup: DHASH_NEAR_DUP,
  dhashAngleWarn: DHASH_ANGLE_WARN,
  families: Object.keys(GARMENT_FAMILIES),
  neverMergeOnNameOnly: true,
  neverSubstringCategory: true,
  neverAutoDeleteExisting: true,
  keepAddAnyway: true,
  shoppingIsolated: true,
});

const GENERIC_ITEM_NAMES = new Set([
  'bag',
  'bags',
  'top',
  'tops',
  'shirt',
  'shirts',
  'tee',
  'tees',
  't-shirt',
  'clothing',
  'item',
  'piece',
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
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2 && tokens.some((t) => GENERIC_ITEM_NAMES.has(t))) return true;
  const last = tokens[tokens.length - 1];
  if (tokens.length <= 4 && last && GENERIC_ITEM_NAMES.has(last)) return true;
  return false;
}

function normalizeColor(color?: string | null): string {
  if (!color) return '';
  const c = color.toLowerCase().trim().replace(/\s+/g, ' ');
  const first = c.split(/[/,|&]/)[0].trim();
  return COLOR_ALIASES[first] || first;
}

export function normalizeCategory(category?: string | null): string {
  if (!category) return '';
  return category.toLowerCase().trim().replace(/\s+/g, '_');
}

export function garmentFamily(category?: string | null): string | null {
  const c = normalizeCategory(category);
  if (!c) return null;
  for (const [family, cats] of Object.entries(GARMENT_FAMILIES)) {
    if ((cats as readonly string[]).includes(c)) return family;
  }
  return c;
}

export function categoriesCompatible(a?: string | null, b?: string | null): boolean {
  const fa = garmentFamily(a);
  const fb = garmentFamily(b);
  if (!fa || !fb) return false;
  return fa === fb;
}

const NAME_TOKEN_SYNONYMS: Record<string, string> = {
  jacket: 'jacket',
  jackets: 'jacket',
  blazer: 'jacket',
  blazers: 'jacket',
  coat: 'jacket',
  coats: 'jacket',
  outerwear: 'jacket',
  overcoat: 'jacket',
  sportcoat: 'jacket',
  'sport-coat': 'jacket',
  parka: 'jacket',
  trench: 'jacket',
  bomber: 'jacket',
  windbreaker: 'jacket',
  gilet: 'jacket',
  suit: 'suit',
  suits: 'suit',
  tuxedo: 'suit',
  tux: 'suit',
  denim: 'denim',
  jean: 'denim',
  jeans: 'denim',
  tee: 'tshirt',
  tees: 'tshirt',
  tshirt: 'tshirt',
  't-shirt': 'tshirt',
  shirt: 'tshirt',
  shirts: 'tshirt',
  sneaker: 'shoe',
  sneakers: 'shoe',
  trainer: 'shoe',
  trainers: 'shoe',
  shoe: 'shoe',
  shoes: 'shoe',
  boot: 'shoe',
  boots: 'shoe',
};

function canonicalizeNameToken(token: string): string {
  const t = String(token || '').toLowerCase().trim();
  if (!t) return '';
  return NAME_TOKEN_SYNONYMS[t] || t;
}

function tokenSet(str?: string | null, useSynonyms = true): Set<string> {
  return new Set(
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => (useSynonyms ? canonicalizeNameToken(t) : t))
      .filter((t) => t.length > 1),
  );
}

function jaccard(a?: string | null, b?: string | null, useSynonyms = true): number {
  const sa = tokenSet(a, useSynonyms);
  const sb = tokenSet(b, useSynonyms);
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

  const candBrand = String(candidate.brand || '').toLowerCase().trim();
  const existBrand = String(existing.brand || '').toLowerCase().trim();
  const sameBrand = Boolean(
    candBrand
    && existBrand
    && (candBrand === existBrand || candBrand.includes(existBrand) || existBrand.includes(candBrand)),
  );

  const nameSim = jaccard(candidate.name, existing.name, sameBrand);

  const candColor = normalizeColor(candidate.color);
  const existColor = normalizeColor(existing.color);
  const sameColor = Boolean(
    candColor
    && existColor
    && (candColor === existColor || candColor.includes(existColor) || existColor.includes(candColor)),
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

  if (sameColor && nameSim < 0.45 && !sameBrand) {
    score = Math.min(score, 0.78);
  }

  if (
    (isGenericItemName(candidate.name) || isGenericItemName(existing.name))
    && !sameBrand
  ) {
    score = Math.min(score, 0.72);
  }

  return Math.max(0, Math.min(1, score));
}

export function hammingDistanceHex(a?: string | null, b?: string | null): number {
  if (!a || !b) return Infinity;
  const aa = a.replace(/^0x/i, '').toLowerCase();
  const bb = b.replace(/^0x/i, '').toLowerCase();
  if (aa.length !== bb.length || aa.length === 0) return Infinity;
  let dist = 0;
  for (let i = 0; i < aa.length; i++) {
    let x = parseInt(aa[i], 16) ^ parseInt(bb[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

export function hexWithHammingDistance(hex: string, distance: number): string {
  const clean = String(hex || '').replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean)) return clean;
  const bits = clean
    .split('')
    .map((c) => parseInt(c, 16).toString(2).padStart(4, '0'))
    .join('')
    .split('');
  const n = Math.max(0, Math.min(bits.length, Number(distance) || 0));
  for (let i = 0; i < n; i++) {
    bits[i] = bits[i] === '0' ? '1' : '0';
  }
  let out = '';
  for (let i = 0; i < bits.length; i += 4) {
    out += parseInt(bits.slice(i, i + 4).join(''), 2).toString(16);
  }
  return out;
}

export function dhashToImageSimilarity(hamming: number | null | undefined): number | null {
  if (hamming == null || !Number.isFinite(hamming)) return null;
  const h = Math.max(0, hamming);
  if (h <= DHASH_NEAR_DUP) return Number((1 - h * ((1 - IMAGE_SIM_HARD) / DHASH_NEAR_DUP)).toFixed(4));
  if (h <= DHASH_ANGLE_WARN) {
    return Number((IMAGE_SIM_HARD - (h - DHASH_NEAR_DUP) * ((IMAGE_SIM_HARD - IMAGE_SIM_PROBABLE) / (DHASH_ANGLE_WARN - DHASH_NEAR_DUP))).toFixed(4));
  }
  if (h <= DHASH_AMBIGUOUS_MAX) {
    return Number((IMAGE_SIM_PROBABLE - (h - DHASH_ANGLE_WARN) * (0.32 / (DHASH_AMBIGUOUS_MAX - DHASH_ANGLE_WARN))).toFixed(4));
  }
  return Number(Math.max(0, 0.50 - (h - DHASH_AMBIGUOUS_MAX) * 0.02).toFixed(4));
}

function readBindId(item: WardrobeDupeCandidate & Record<string, unknown>, keys: string[]): string | null {
  const bags: unknown[] = [item, (item as any).aiTags, (item as any).ai_tags, (item as any).metadata];
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue;
    for (const key of keys) {
      const val = (bag as Record<string, unknown>)[key];
      if (val != null && String(val).trim()) return String(val).trim();
    }
  }
  return null;
}

export function getSourceImageId(item: WardrobeDupeCandidate): string | null {
  const id = readBindId(item as WardrobeDupeCandidate & Record<string, unknown>, ['sourceImageId', 'source_image_id']);
  return id && id.length >= 4 ? id : null;
}

export function getCaptureSessionId(item: WardrobeDupeCandidate): string | null {
  const id = readBindId(item as WardrobeDupeCandidate & Record<string, unknown>, [
    'captureSessionId',
    'capture_session_id',
    'scanSessionId',
    'scan_session_id',
    'sessionId',
  ]);
  return id && id.length >= 4 ? id : null;
}

export function getCropId(item: WardrobeDupeCandidate): string | null {
  const id = readBindId(item as WardrobeDupeCandidate & Record<string, unknown>, [
    'cropId',
    'sourceCropId',
    'source_crop_id',
  ]);
  return id && id.length >= 2 ? id : null;
}

export function sameScanExactCrop(a: WardrobeDupeCandidate, b: WardrobeDupeCandidate): boolean {
  const imgA = getSourceImageId(a);
  const imgB = getSourceImageId(b);
  const cropA = getCropId(a);
  const cropB = getCropId(b);
  if (imgA && imgB && cropA && cropB && imgA === imgB && cropA === cropB) return true;
  if (imgA || imgB) return false;
  const sessA = getCaptureSessionId(a);
  const sessB = getCaptureSessionId(b);
  return Boolean(sessA && sessB && cropA && cropB && sessA === sessB && cropA === cropB);
}

export function sameSourceDifferentCrop(a: WardrobeDupeCandidate, b: WardrobeDupeCandidate): boolean {
  const imgA = getSourceImageId(a);
  const imgB = getSourceImageId(b);
  const cropA = getCropId(a);
  const cropB = getCropId(b);
  return Boolean(imgA && imgB && cropA && cropB && imgA === imgB && cropA !== cropB);
}

export function canonicalSourceCropKey(item: WardrobeDupeCandidate): string | null {
  const image = getSourceImageId(item);
  const session = getCaptureSessionId(item);
  const crop = getCropId(item);
  if (!crop) return null;
  if (image) return `${image}::${crop}`;
  if (!session) return null;
  return `${session}::${crop}`;
}

function overrideIdList(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((row) => {
    if (row == null) return '';
    if (typeof row === 'object') return String((row as { itemId?: unknown; id?: unknown }).itemId || (row as { id?: unknown }).id || '').trim();
    return String(row).trim();
  }).filter(Boolean);
}

export function hasDedupeOverride(candidate: WardrobeDupeCandidate, existing: WardrobeDupeCandidate): boolean {
  const existId = existing?.id != null ? String(existing.id) : '';
  const candId = candidate?.id != null ? String(candidate.id) : '';
  const against = [
    ...overrideIdList(candidate?.dedupeOverrideAgainst),
    ...overrideIdList(candidate?.aiTags?.dedupeOverrideAgainst),
  ];
  const fromExisting = [
    ...overrideIdList(existing?.dedupeOverrideAgainst),
    ...overrideIdList(existing?.aiTags?.dedupeOverrideAgainst),
  ];
  if (existId && against.includes(existId)) return true;
  if (candId && fromExisting.includes(candId)) return true;
  return false;
}

export function overrideIdsFromMatches(matches: Array<{ id?: string | number | null }>): string[] {
  return [...new Set(matches.map((m) => (m.id != null ? String(m.id) : '')).filter(Boolean))];
}

export function scanItemDedupeBind(
  item: { tempId: string; sourceImageId?: string | null },
  captureSessionId?: string | null,
): {
  sourceCropId: string;
  cropId: string;
  scanSessionId?: string;
  captureSessionId?: string;
  sourceImageId?: string;
} {
  return {
    sourceCropId: item.tempId,
    cropId: item.tempId,
    scanSessionId: captureSessionId || undefined,
    captureSessionId: captureSessionId || undefined,
    sourceImageId: item.sourceImageId || undefined,
  };
}

export type LocalDuplicateScore = {
  isDuplicate: boolean;
  type: DuplicateDecisionType;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  hamming: number | null;
  attrScore: number;
  imageSimilarity: number | null;
  sameScanExactCrop: boolean;
  categoryCompatible: boolean;
  message?: string;
};

/**
 * Offline mirror of server scoreDuplicateMatch (no embeddings).
 */
export function scoreLocalDuplicateMatch(
  candidate: WardrobeDupeCandidate,
  existing: WardrobeDupeCandidate,
): LocalDuplicateScore {
  const attrScore = attributeSimilarity(candidate, existing);
  const candHash = candidate.imagePhash || candidate.dHash || null;
  const existHash = existing.imagePhash || existing.dHash || null;
  const hamming = (candHash && existHash) ? hammingDistanceHex(candHash, existHash) : null;
  const sameCat = categoriesCompatible(candidate.category, existing.category);
  const imgSim = dhashToImageSimilarity(hamming);
  const exactCrop = sameScanExactCrop(candidate, existing);
  const differentCropSamePhoto = sameSourceDifferentCrop(candidate, existing);

  const candColor = normalizeColor(candidate.color);
  const existColor = normalizeColor(existing.color);
  const colorConflict = Boolean(candColor && existColor && candColor !== existColor);
  const candMat = String(candidate.material || '').toLowerCase().trim();
  const existMat = String(existing.material || '').toLowerCase().trim();
  const materialConflict = Boolean(candMat && existMat && candMat !== existMat);
  const metadataConflict = colorConflict || materialConflict;

  const candName = String(candidate.name || '').trim().toLowerCase();
  const existName = String(existing.name || '').trim().toLowerCase();
  const sameName = Boolean(candName && existName && candName === existName);
  const candidateHasCategory = Boolean(normalizeCategory(candidate.category));

  const base = {
    hamming,
    attrScore,
    imageSimilarity: imgSim,
    sameScanExactCrop: exactCrop,
    categoryCompatible: sameCat,
  };

  if (hasDedupeOverride(candidate, existing)) {
    return { ...base, isDuplicate: false, type: 'ok', reason: 'user_override', confidence: 'low' };
  }

  if (differentCropSamePhoto) {
    return { ...base, isDuplicate: false, type: 'ok', reason: 'same_source_different_crop', confidence: 'low' };
  }

  if (exactCrop) {
    return {
      ...base,
      isDuplicate: true,
      type: 'duplicate',
      reason: 'same_scan_exact_crop',
      confidence: 'high',
      message: DEDUPE_COPY.hard,
    };
  }

  if (sameName && (imgSim == null || imgSim < IMAGE_SIM_PROBABLE) && hamming != null && hamming > DHASH_AMBIGUOUS_MAX) {
    return { ...base, isDuplicate: false, type: 'ok', reason: 'same_name_different_visual', confidence: 'low' };
  }

  const hardImage = imgSim != null && imgSim >= IMAGE_SIM_HARD;
  const probableImage = imgSim != null && imgSim >= IMAGE_SIM_PROBABLE && imgSim < IMAGE_SIM_HARD;

  if (hardImage && candidateHasCategory && !sameCat) {
    return {
      ...base,
      isDuplicate: true,
      type: 'classification_conflict',
      reason: 'classification_conflict',
      confidence: 'high',
      message: DEDUPE_COPY.conflict,
    };
  }

  if (hardImage && sameCat && !metadataConflict) {
    return {
      ...base,
      isDuplicate: true,
      type: 'duplicate',
      reason: 'visual_near_duplicate',
      confidence: 'high',
      message: DEDUPE_COPY.hard,
    };
  }

  if ((hardImage && sameCat && metadataConflict) || (probableImage && sameCat)) {
    return {
      ...base,
      isDuplicate: false,
      type: 'similar_item',
      reason: metadataConflict ? 'visual_metadata_conflict' : 'visual_probable',
      confidence: 'medium',
      message: DEDUPE_COPY.probable,
    };
  }

  return { ...base, isDuplicate: false, type: 'ok', reason: 'no_match', confidence: 'low' };
}

function matchRank(type: DuplicateDecisionType | string | undefined): number {
  if (type === 'classification_conflict' || type === 'duplicate' || type === 'already_owned') return 0;
  if (type === 'similar_item') return 1;
  return 2;
}

/**
 * Local duplicate scan (used offline / before server check).
 * Returns hard BLOCK, classification conflict, and probable WARN hits.
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
    const scored = scoreLocalDuplicateMatch(candidate, item);
    if (scored.type === 'ok') continue;
    matches.push({
      id: String(item.id),
      name: item.name || 'Wardrobe item',
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      brand: item.brand,
      imageUri: item.imageUri,
      confidence: scored.confidence,
      reason: scored.reason,
      attrScore: scored.attrScore,
      hamming: scored.hamming,
      imageSimilarity: scored.imageSimilarity,
      similarityScore: scored.imageSimilarity,
      message: scored.message,
      tier: scored.type,
      isDuplicate: scored.isDuplicate,
      sameScanExactCrop: scored.sameScanExactCrop,
      categoryCompatible: scored.categoryCompatible,
    });
  }
  return matches.sort((a, b) => {
    const rank = matchRank(a.tier) - matchRank(b.tier);
    if (rank !== 0) return rank;
    return (b.imageSimilarity || b.attrScore || 0) - (a.imageSimilarity || a.attrScore || 0);
  }).slice(0, 5);
}

export function decisionFromLocalMatches(matches: WardrobeDupeMatch[]): NormalizedDuplicateDecision {
  if (!matches.length) return { type: 'ok', matches: [], isDuplicate: false };
  const top = matches[0];
  const type: DuplicateDecisionType =
    top.tier === 'classification_conflict'
      ? 'classification_conflict'
      : top.tier === 'similar_item'
        ? 'similar_item'
        : top.isDuplicate
          ? 'duplicate'
          : 'similar_item';
  return {
    type,
    matches,
    isDuplicate: type === 'duplicate' || type === 'classification_conflict' || type === 'already_owned',
    message: top.message,
  };
}

export function formatDuplicateNames(matches: Array<{ name?: string | null }>): string {
  const names = matches.map((m) => m.name || 'item').filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function normalizeDuplicateDecision(input: {
  type?: string | null;
  isDuplicate?: boolean;
  message?: string | null;
  matches?: DuplicateMatch[] | null;
  similarMatches?: DuplicateMatch[] | null;
  conflictMatches?: DuplicateMatch[] | null;
  decision?: { type?: string; matches?: DuplicateMatch[]; message?: string } | null;
  candidateIndex?: number;
} | null | undefined): NormalizedDuplicateDecision {
  const decisionType = (input?.decision?.type || input?.type || '').toLowerCase();
  const matches = (input?.decision?.matches || input?.matches || []).filter(Boolean);
  const similar = (input?.similarMatches || []).filter(Boolean);
  const conflicts = (input?.conflictMatches || []).filter(Boolean);
  const message = input?.decision?.message || input?.message || undefined;

  if (decisionType === 'classification_conflict' || conflicts.length > 0) {
    return {
      type: 'classification_conflict',
      matches: conflicts.length ? conflicts : matches,
      message: message || DEDUPE_COPY.conflict,
      isDuplicate: true,
      candidateIndex: input?.candidateIndex,
    };
  }
  if (decisionType === 'already_owned') {
    return { type: 'already_owned', matches, message, isDuplicate: true, candidateIndex: input?.candidateIndex };
  }
  if (decisionType === 'duplicate' || (input?.isDuplicate && decisionType !== 'similar_item')) {
    return {
      type: 'duplicate',
      matches: matches.length ? matches : similar,
      message: message || DEDUPE_COPY.hard,
      isDuplicate: true,
      candidateIndex: input?.candidateIndex,
    };
  }
  if (decisionType === 'similar_item' || similar.length > 0) {
    return {
      type: 'similar_item',
      matches: similar.length ? similar : matches,
      message: message || similar[0]?.message || matches[0]?.message || DEDUPE_COPY.probable,
      isDuplicate: false,
      candidateIndex: input?.candidateIndex,
    };
  }
  return { type: 'ok', matches: [], message: undefined, isDuplicate: false, candidateIndex: input?.candidateIndex };
}

/**
 * Offline pairwise within-batch duplicates.
 * Only the later item is flagged — the first occurrence is kept.
 * Hard BLOCK / classification conflict only; probable WARN does not collapse a batch.
 */
export function findLocalWithinBatchDuplicates(
  candidates: Array<WardrobeDupeCandidate & { id: string }>,
): Array<{ id: string; matches: WardrobeDupeMatch[]; matchedIds: string[] }> {
  const out = candidates.map((c) => ({ id: c.id, matches: [] as WardrobeDupeMatch[], matchedIds: [] as string[] }));
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const scored = scoreLocalDuplicateMatch(candidates[i], candidates[j]);
      if (!scored.isDuplicate) continue;
      out[j].matches.push({
        id: candidates[i].id,
        name: candidates[i].name || 'Item',
        category: candidates[i].category,
        color: candidates[i].color,
        brand: candidates[i].brand,
        imageUri: candidates[i].imageUri,
        confidence: scored.confidence,
        reason: scored.reason === 'visual_near_duplicate' ? 'batch_visual_match' : scored.reason,
        attrScore: scored.attrScore,
        hamming: scored.hamming,
        imageSimilarity: scored.imageSimilarity,
        matchScope: 'batch',
        matchedCandidateIndex: i,
        message: scored.message,
        tier: scored.type,
        isDuplicate: true,
      });
      out[j].matchedIds.push(candidates[i].id);
    }
  }
  return out;
}
