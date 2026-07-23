/**
 * Unified garment taxonomy — subtype classifier + pairing/soft-profile helpers.
 * Corpus: data/garmentTaxonomy.json (synced from Dripn-Server).
 */
// @ts-nocheck — classifier rules mirror server JS; public API is typed in the header zone below.

import corpusJson from '@/data/garmentTaxonomy.json';

export type GarmentCategory = 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory' | 'dress';
export type GarmentLane = 'tailored' | 'casual' | 'street' | 'athleisure' | 'evening';
export type GarmentGender = 'menswear' | 'womenswear' | 'unisex';

export type GarmentMeta = {
  subtype: string;
  category: GarmentCategory;
  gender: GarmentGender;
  formality: number;
  lane: GarmentLane;
  silhouette?: string;
  fabric?: string;
  visualWeight?: string;
  worksWith: string[];
  avoidWith: string[];
  isRevealing?: boolean;
  isTailored?: boolean;
};

export type GarmentClassification = {
  subtype: string | null;
  confidence: number;
  meta: GarmentMeta | null;
  lane: GarmentLane | string | null;
  formality: number | null;
  coarseOnly: boolean;
};

type TaxonomyCorpus = {
  version: number;
  garments: GarmentMeta[];
  styleProfiles: Record<string, {
    preferLanes: string[];
    preferSubtypes: string[];
    avoidSubtypes: string[];
    laneBonus: number;
    subtypeBonus: number;
  }>;
  stylePreferenceMap: Record<string, string>;
};

const corpus = corpusJson as TaxonomyCorpus;

function loadCorpus(): TaxonomyCorpus {
  return corpus;
}

export function getGarmentDb(): GarmentMeta[] {
  return loadCorpus().garments;
}

export function getGarmentBySubtype(subtype: string | null | undefined): GarmentMeta | null {
  if (!subtype) return null;
  return getGarmentDb().find((g) => g.subtype === subtype) || null;
}

export function getStyleProfiles() {
  return loadCorpus().styleProfiles || {};
}

export function getStylePreferenceMap() {
  return loadCorpus().stylePreferenceMap || {};
}

type ItemLike = {
  name?: string;
  category?: string;
  subcategory?: string;
  type?: string;
  garmentType?: string;
  tags?: string[];
  aiTags?: string[];
  subtype?: string;
  garmentSubtype?: string;
  taxonomySubtype?: string;
  color?: string;
  id?: string;
};

function itemText(item: ItemLike | null | undefined): string {
  const tags = Array.isArray(item?.tags)
    ? item!.tags!.join(' ')
    : Array.isArray(item?.aiTags)
      ? item!.aiTags!.join(' ')
      : '';
  return `${item?.name || ''} ${item?.category || ''} ${item?.subcategory || ''} ${item?.type || ''} ${item?.garmentType || ''} ${tags}`.toLowerCase();
}

function categoryBucket(item: ItemLike | null | undefined): GarmentCategory | null {
  const cat = String(item?.category || '').toLowerCase();
  if (cat === 'tops' || cat === 'activewear_tops' || cat === 'shirts') return 'top';
  if (cat === 'bottoms' || cat === 'activewear_bottoms') return 'bottom';
  if (cat === 'outerwear') return 'outerwear';
  if (cat === 'shoes') return 'footwear';
  if (cat === 'dresses') return 'dress';
  if (cat === 'accessories' || cat === 'bags') return 'accessory';
  if (cat === 'formal') return 'outerwear';
  return null;
}

function isShortsText(t) {
  return /\bshorts?\b|bermuda|cutoff|cut-off/.test(t) && !/short[\s-]?sleeve/.test(t);
}

/** Ordered keyword rules: first match wins. */
const CLASSIFIER_RULES = [
  // Footwear (oxford shoe before oxford shirt)
  { subtype: 'uggs', test: (t, cat) => cat === 'footwear' && /\bugg|shearling|sheepskin/.test(t) },
  { subtype: 'heels', test: (t, cat) => cat === 'footwear' && /heel|pump|stiletto|court shoe/.test(t) },
  {
    subtype: 'chunky_trainer',
    test: (t, cat) =>
      cat === 'footwear'
      && /\b(trainers?|sneakers?|runners?)\b/.test(t)
      && /chunky|dad shoe|bulky|technical|trail|hoka|zoomx|pegasus|ultraboost|fresh foam|cross.?train|running|gym|training|performance|asics gel|gel-?kayano|nimbus|vomero|invincible|vaporfly|cloudmonster|max cushion|platform sneaker/.test(t),
  },
  {
    subtype: 'minimal_sneaker',
    test: (t, cat) =>
      cat === 'footwear'
      && /\b(trainers?|sneakers?|runners?)\b/.test(t)
      && !/chunky|hoka|running|gym|ultraboost|pegasus|trail|dad shoe/.test(t),
  },
  { subtype: 'loafer', test: (t, cat) => cat === 'footwear' && /loafer/.test(t) },
  {
    subtype: 'dress_shoe',
    test: (t, cat) =>
      cat === 'footwear' && /oxford|derby|brogue|dress shoe|formal shoe/.test(t) && !/shirt/.test(t),
  },
  {
    subtype: 'ankle_boots',
    test: (t, cat) =>
      cat === 'footwear'
      && /ankle boot|chelsea|heeled boot|leather boot|riding boot|\bboots?\b/.test(t)
      && !/\bugg|shearling|trainer|sneaker/.test(t),
  },
  { subtype: 'sandals', test: (t, cat) => cat === 'footwear' && /sandal|espadrille|slide|flip.?flop/.test(t) },

  // Dresses — no generic invent; only keyword hits
  { subtype: 'slip_dress', test: (t, cat) => (cat === 'dress' || /\bdress\b/.test(t)) && /slip\s*dress|bias\s*cut|silk\s*slip|satin\s*slip/.test(t) },
  { subtype: 'bodycon_dress', test: (t, cat) => (cat === 'dress' || /\bdress\b/.test(t)) && /bodycon|body\s*con|bandage\s*dress/.test(t) },
  { subtype: 'wrap_dress', test: (t, cat) => (cat === 'dress' || /\bdress\b/.test(t)) && /wrap\s*dress/.test(t) },
  { subtype: 'shirt_dress', test: (t, cat) => (cat === 'dress' || /\bdress\b/.test(t)) && /shirt\s*dress/.test(t) },
  { subtype: 'maxi_dress', test: (t, cat) => (cat === 'dress' || /\bdress\b/.test(t)) && /maxi\s*dress|\bmaxi\b/.test(t) },
  { subtype: 'slip_dress', test: (t, cat) => cat === 'dress' && /slip|silk|satin|cocktail|evening|gown/.test(t) },

  // Skirts
  { subtype: 'mini_skirt', test: (t, cat) => cat === 'bottom' && /mini\s*skirt/.test(t) },
  { subtype: 'midi_skirt', test: (t, cat) => cat === 'bottom' && /midi\s*skirt/.test(t) },
  { subtype: 'pleated_skirt', test: (t, cat) => cat === 'bottom' && /pleated\s*skirt|pleat/.test(t) },
  { subtype: 'denim_skirt', test: (t, cat) => cat === 'bottom' && /denim\s*skirt|jean\s*skirt/.test(t) },
  { subtype: 'slip_skirt', test: (t, cat) => cat === 'bottom' && /slip\s*skirt|bias\s*skirt/.test(t) },
  { subtype: 'midi_skirt', test: (t, cat) => cat === 'bottom' && /\bskirt\b/.test(t) },

  // Shorts
  {
    subtype: 'athletic_shorts',
    test: (t, cat) =>
      (cat === 'bottom' || isShortsText(t))
      && /athletic\s*short|gym\s*short|sweat\s*short|jersey\s*short|running\s*short|sport\s*short|basketball\s*short|training\s*short|french\s*terry|sweat|gym|athletic|sport|jersey|terry/.test(t)
      && isShortsText(t),
  },
  { subtype: 'cargo_shorts', test: (t, cat) => (cat === 'bottom' || isShortsText(t)) && /cargo\s*short/.test(t) },
  { subtype: 'linen_shorts', test: (t, cat) => (cat === 'bottom' || isShortsText(t)) && /linen\s*short/.test(t) },
  {
    subtype: 'tailored_shorts',
    test: (t, cat) =>
      (cat === 'bottom' || isShortsText(t))
      && /tailored\s*short|chino\s*short|dress\s*short|bermuda|suit\s*short|smart\s*short|pleated\s*short|wool\s*short|structured\s*short/.test(t),
  },
  {
    subtype: 'tailored_shorts',
    test: (t, cat) => cat === 'bottom' && isShortsText(t) && /tailored|chino|wool|structured|pleat/.test(t),
  },
  {
    subtype: 'athletic_shorts',
    test: (t, cat) => cat === 'bottom' && isShortsText(t) && !/tailored|chino|linen|cargo|bermuda|dress\s*short|wool|smart/.test(t),
  },

  // Trousers
  { subtype: 'joggers', test: (t, cat) => cat === 'bottom' && /jogger|sweatpant|sweat\s*pant|sweat\s*bottom/.test(t) },
  { subtype: 'tracksuit_bottoms', test: (t, cat) => cat === 'bottom' && /track\s?pant|tracksuit|track\s*suit|track\s*bottom/.test(t) },
  { subtype: 'cargo_pants', test: (t, cat) => cat === 'bottom' && /cargo/.test(t) && !/short/.test(t) },
  {
    subtype: 'tailored_trousers',
    test: (t, cat) =>
      cat === 'bottom'
      && /suit\s*trouser|suit\s*pant|dress\s*trouser|dress\s*pant|tailored\s*trouser|tailored\s*pant|wool\s*trouser/.test(t),
  },
  { subtype: 'chinos', test: (t, cat) => cat === 'bottom' && /chino|khaki|slack/.test(t) && !/short/.test(t) },
  { subtype: 'jeans', test: (t, cat) => cat === 'bottom' && /jean|denim/.test(t) && !/jacket|skirt|short/.test(t) },
  {
    subtype: 'chinos',
    test: (t, cat) => cat === 'bottom' && /trouser|pant/.test(t) && !/sweat|jogger|track|cargo|short|suit|dress|tailored|wool/.test(t),
  },

  // Outerwear
  { subtype: 'blazer', test: (t) => /blazer|sport\s*coat|suit\s*jacket|formal\s*jacket|tailored\s*jacket|windowpane/.test(t) },
  { subtype: 'denim_jacket', test: (t) => /denim\s*jacket|jean\s*jacket/.test(t) },
  { subtype: 'puffer', test: (t, cat) => (cat === 'outerwear' || /jacket|coat/.test(t)) && /puffer|down\s*jacket|quilted|insulated|parka/.test(t) },
  { subtype: 'fleece', test: (t) => /\bfleece\b/.test(t) },
  { subtype: 'cardigan', test: (t) => /cardigan/.test(t) },
  { subtype: 'tailored_coat', test: (t) => /tailored\s*coat|wool\s*coat|overcoat|trench|pea\s*coat/.test(t) },
  { subtype: 'cropped_jacket', test: (t) => /cropped\s*jacket|crop\s*jacket|bolero/.test(t) },

  // Tops
  {
    subtype: 'oxford_shirt',
    test: (t, cat) =>
      (cat === 'top' || cat == null)
      && cat !== 'footwear'
      && (
        /dress\s*shirt|button-down|button\s*down|button-up|button\s*up|oxford\s*shirt|chambray|structured\s*shirt/.test(t)
        || (/denim.{0,24}shirt/.test(t) && !/jacket/.test(t))
        || (/\boxford\b/.test(t) && !/shoe|loafer|boot/.test(t))
      ),
  },
  { subtype: 'linen_shirt', test: (t, cat) => (cat === 'top' || cat == null) && /linen\s*shirt|linen\s*top/.test(t) },
  { subtype: 'polo', test: (t, cat) => (cat === 'top' || cat == null) && /\bpolo\b/.test(t) },
  { subtype: 'hoodie', test: (t) => /hoodie|hooded\s*sweat/.test(t) },
  { subtype: 'crop_top', test: (t, cat) => (cat === 'top' || cat == null) && /crop\s*top|cropped\s*tee|cropped\s*top/.test(t) },
  { subtype: 'blouse', test: (t, cat) => (cat === 'top' || cat == null) && /blouse|silk\s*top|camisole/.test(t) },
  { subtype: 'knit_top', test: (t, cat) => (cat === 'top' || cat == null) && /knit|sweater|jumper|crew\s*neck|fine\s*gauge/.test(t) },
  { subtype: 'oversized_tee', test: (t, cat) => (cat === 'top' || cat == null) && /oversized|graphic\s*tee|baggy\s*tee|boxy\s*tee/.test(t) },
  { subtype: 'basic_tee', test: (t, cat) => (cat === 'top' || cat == null) && /t-shirt|\btee\b|tshirt/.test(t) },

  // Accessories
  { subtype: 'tie', test: (t) => /\btie\b|necktie|bow\s*tie/.test(t) },
  { subtype: 'cap', test: (t) => /\bcap\b|baseball\s*hat|beanie|bucket\s*hat/.test(t) },
  { subtype: 'belt', test: (t) => /\bbelt\b/.test(t) },
  { subtype: 'scarf', test: (t) => /scarf|shawl/.test(t) },
  { subtype: 'handbag', test: (t, cat) => (cat === 'accessory' || /bag/.test(t)) && /handbag|shoulder\s*bag|crossbody|clutch|purse/.test(t) },
  { subtype: 'tote_bag', test: (t, cat) => (cat === 'accessory' || /bag/.test(t)) && /tote/.test(t) },
  { subtype: 'handbag', test: (t, cat) => cat === 'accessory' && /bag/.test(t) },
];

/**
 * Classify a wardrobe item into a GARMENT_DB subtype.
 * @returns {{ subtype: string|null, confidence: number, meta: object|null, lane: string|null, formality: number|null, coarseOnly: boolean }}
 */
export function classifyGarment(item) {
  if (!item) {
    return { subtype: null, confidence: 0, meta: null, lane: null, formality: null, coarseOnly: true };
  }

  const t = itemText(item);
  const bucket = categoryBucket(item);

  // Explicit subtype field wins
  const explicit = item.subtype || item.garmentSubtype || item.taxonomySubtype;
  if (explicit && getGarmentBySubtype(explicit)) {
    const meta = getGarmentBySubtype(explicit);
    return {
      subtype: meta.subtype,
      confidence: 1,
      meta,
      lane: meta.lane,
      formality: meta.formality,
      coarseOnly: false,
    };
  }

  for (const rule of CLASSIFIER_RULES) {
    try {
      if (rule.test(t, bucket, item)) {
        const meta = getGarmentBySubtype(rule.subtype);
        if (!meta) continue;
        // Soft category guard: prefer matching category when known
        if (bucket && meta.category !== bucket) {
          // allow outerwear/formal mismatches and accessory bags
          if (!(bucket === 'outerwear' && meta.category === 'outerwear')
            && !(bucket === 'accessory' && meta.category === 'accessory')
            && meta.category !== bucket) {
            // still accept high-signal keywords (blazer named in tops, etc.)
            if (!['blazer', 'hoodie', 'tie', 'cap', 'belt', 'scarf'].includes(rule.subtype)) {
              continue;
            }
          }
        }
        const confidence = /windowpane|hoka|oxford shirt|button-up|button up|sweat short|chunky|slip dress|tailored short/.test(t)
          ? 0.92
          : 0.78;
        return {
          subtype: meta.subtype,
          confidence,
          meta,
          lane: meta.lane,
          formality: meta.formality,
          coarseOnly: false,
        };
      }
    } catch {
      // ignore bad rule
    }
  }

  // Coarse fallback from category — no invented subtype
  const coarseLane = {
    top: 'casual',
    bottom: 'casual',
    outerwear: 'casual',
    footwear: 'casual',
    dress: 'casual',
    accessory: 'casual',
  }[bucket] || null;

  const coarseFormality = {
    top: 3,
    bottom: 3,
    outerwear: 3,
    footwear: 2,
    dress: 3,
    accessory: 2,
  }[bucket] ?? null;

  return {
    subtype: null,
    confidence: 0.35,
    meta: null,
    lane: coarseLane,
    formality: coarseFormality,
    coarseOnly: true,
  };
}

/** Map DB evening lane → coherence lane used by getStyleLane. */
export function coherenceLaneFromDb(lane) {
  if (lane === 'evening') return 'tailored';
  if (lane === 'tailored' || lane === 'casual' || lane === 'street' || lane === 'athleisure') {
    return lane;
  }
  return null;
}

/**
 * Pairwise soft score from worksWith / avoidWith.
 * Returns delta in roughly -12..+8 range.
 */
export function scoreSubtypePair(a, b) {
  const ca = typeof a === 'string' ? { subtype: a, meta: getGarmentBySubtype(a) } : a;
  const cb = typeof b === 'string' ? { subtype: b, meta: getGarmentBySubtype(b) } : b;
  if (!ca?.subtype || !cb?.subtype || !ca.meta || !cb.meta) return 0;

  let delta = 0;
  if (ca.meta.avoidWith?.includes(cb.subtype) || cb.meta.avoidWith?.includes(ca.subtype)) {
    delta -= 10;
  }
  if (ca.meta.worksWith?.includes(cb.subtype) || cb.meta.worksWith?.includes(ca.subtype)) {
    delta += 4;
  }

  // Formality span soft penalty (hard rules still own hard fails)
  const span = Math.abs((ca.meta.formality ?? 3) - (cb.meta.formality ?? 3));
  if (span >= 3) delta -= 4;
  else if (span === 2) delta -= 1;

  // Lane soft mismatch
  const la = coherenceLaneFromDb(ca.meta.lane);
  const lb = coherenceLaneFromDb(cb.meta.lane);
  if (la && lb && la !== lb) {
    const ok = new Set([
      'tailored+casual', 'casual+tailored',
      'street+casual', 'casual+street',
      'athleisure+street', 'street+athleisure',
    ]);
    if (!ok.has(`${la}+${lb}`)) delta -= 3;
  }

  return delta;
}

/**
 * Soft outfit bonus from pairwise subtype compatibility.
 */
export function scoreOutfitSubtypeCompatibility(items) {
  if (!Array.isArray(items) || items.length < 2) {
    return { adjustment: 0, pairs: [], classifications: [] };
  }

  const classifications = items.map((item) => classifyGarment(item));
  let total = 0;
  const pairs = [];
  let counted = 0;

  for (let i = 0; i < classifications.length; i++) {
    for (let j = i + 1; j < classifications.length; j++) {
      const delta = scoreSubtypePair(classifications[i], classifications[j]);
      if (delta !== 0) {
        pairs.push({
          a: classifications[i].subtype,
          b: classifications[j].subtype,
          delta,
        });
        total += delta;
        counted += 1;
      }
    }
  }

  // Cap soft influence so clash authority stays primary
  const adjustment = Math.max(-14, Math.min(10, Math.round(total / Math.max(1, counted / 2))));
  return { adjustment, pairs, classifications };
}

/**
 * Resolve MINIMALIST | FEMININE | STREET | LUXURY from user profile fields.
 */
export function resolveStyleProfileKey(userProfile = {}) {
  const map = getStylePreferenceMap();
  const candidates = [
    userProfile.styleProfile,
    userProfile.stylePreference,
    userProfile.preferredStyle,
    userProfile.lifestyle,
    ...(Array.isArray(userProfile.stylePreferences) ? userProfile.stylePreferences : []),
    ...(Array.isArray(userProfile.preferredStyles) ? userProfile.preferredStyles : []),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  for (const c of candidates) {
    if (map[c]) return map[c];
    const upper = c.toUpperCase();
    if (getStyleProfiles()[upper]) return upper;
  }
  return null;
}

/**
 * Soft profile bias — never blocks outfits.
 */
export function scoreStyleProfileBias(items, userProfile = {}) {
  const key = resolveStyleProfileKey(userProfile);
  if (!key) return { adjustment: 0, profile: null, hits: [] };

  const profile = getStyleProfiles()[key];
  if (!profile) return { adjustment: 0, profile: null, hits: [] };

  const hits = [];
  let bonus = 0;
  let penalty = 0;

  for (const item of items || []) {
    const c = classifyGarment(item);
    if (!c.subtype) continue;
    if (profile.preferSubtypes?.includes(c.subtype)) {
      bonus += profile.subtypeBonus || 2;
      hits.push({ subtype: c.subtype, kind: 'prefer' });
    }
    if (profile.avoidSubtypes?.includes(c.subtype)) {
      penalty += Math.min(profile.subtypeBonus || 2, 2);
      hits.push({ subtype: c.subtype, kind: 'avoid' });
    }
    const lane = c.lane;
    if (lane && profile.preferLanes?.includes(lane)) {
      bonus += Math.round((profile.laneBonus || 3) / 3);
    }
  }

  const adjustment = Math.max(-6, Math.min(8, bonus - penalty));
  return { adjustment, profile: key, hits };
}

/**
 * Detect subtype-level conflict pairs for stylist voice comments.
 */
export function detectSubtypeConflicts(items) {
  const classifications = (items || []).map((item, index) => ({
    index,
    item,
    ...classifyGarment(item),
  }));
  const conflicts = [];

  for (let i = 0; i < classifications.length; i++) {
    for (let j = i + 1; j < classifications.length; j++) {
      const a = classifications[i];
      const b = classifications[j];
      if (!a.subtype || !b.subtype || !a.meta || !b.meta) continue;
      const aAvoids = a.meta.avoidWith?.includes(b.subtype);
      const bAvoids = b.meta.avoidWith?.includes(a.subtype);
      if (aAvoids || bAvoids) {
        conflicts.push({
          a: a.subtype,
          b: b.subtype,
          itemA: a.item,
          itemB: b.item,
          hint: `${a.subtype.replace(/_/g, ' ')} clashes with ${b.subtype.replace(/_/g, ' ')}`,
        });
      }
      if (a.meta.isRevealing && b.meta.isRevealing) {
        conflicts.push({
          a: a.subtype,
          b: b.subtype,
          itemA: a.item,
          itemB: b.item,
          hint: 'Two revealing pieces compete — pick one hero silhouette',
          id: 'revealing_stack',
        });
      }
    }
  }
  return { conflicts, classifications };
}

export function taxonomyPromptAppendix(limit = 40) {
  const garments = getGarmentDb().slice(0, limit);
  const lines = garments.map(
    (g) =>
      `${g.subtype} [${g.category}/${g.lane}/f${g.formality}] works:${(g.worksWith || []).slice(0, 4).join('|')} avoid:${(g.avoidWith || []).slice(0, 4).join('|')}`,
  );
  return [
    'GARMENT TAXONOMY (subtype authority — prefer subtype over bare type=shorts):',
    ...lines,
  ].join('\n');
}

/** Optional stub — photo auto-tagging is out of scope this pass. */
export function classifyGarmentFromPhotoStub() {
  return {
    supported: false,
    message: 'Photo auto-tagging to subtype is planned next; use name/category/tags classifyGarment for now.',
  };
}
