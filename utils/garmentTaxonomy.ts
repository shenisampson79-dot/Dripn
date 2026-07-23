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
  aliases?: string[];
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
  outfitIntents?: Record<string, {
    name: string;
    label?: string;
    summaryTone?: string;
    formalityTarget?: number | null;
    structureBias?: string;
    effortLevel?: string;
    boldness?: string;
    colorRules?: Record<string, unknown>;
    silhouetteRules?: Record<string, unknown>;
    preferredSubtypes?: string[];
    avoidedSubtypes?: string[];
    rules?: Record<string, unknown>;
  }>;
};

const corpus = corpusJson as TaxonomyCorpus;

let _aliasIndex: Map<string, GarmentMeta> | null = null;

function loadCorpus(): TaxonomyCorpus {
  return corpus;
}

function buildAliasIndex(): Map<string, GarmentMeta> {
  if (_aliasIndex) return _aliasIndex;
  const map = new Map<string, GarmentMeta>();
  for (const g of loadCorpus().garments || []) {
    map.set(g.subtype, g);
    for (const a of g.aliases || []) {
      map.set(a, g);
    }
  }
  // Legacy renames without requiring aliases on every consumer
  const legacy: Record<string, string> = {
    dress_shoe: 'oxfords',
    loafer: 'loafers',
    sandals: 'leather_sandals',
    chunky_boots: 'combat_boots',
    classic_heels: 'stilettos',
  };
  for (const [from, to] of Object.entries(legacy)) {
    if (!map.has(from) && map.has(to)) map.set(from, map.get(to)!);
  }
  _aliasIndex = map;
  return _aliasIndex;
}

export function getGarmentDb(): GarmentMeta[] {
  return loadCorpus().garments;
}

export function resolveSubtype(subtype: string | null | undefined): string | null {
  if (!subtype) return null;
  const hit = buildAliasIndex().get(subtype);
  return hit?.subtype || subtype;
}

export function getGarmentBySubtype(subtype: string | null | undefined): GarmentMeta | null {
  if (!subtype) return null;
  return buildAliasIndex().get(subtype) || null;
}

export function getStyleProfiles() {
  return loadCorpus().styleProfiles || {};
}

export function getStylePreferenceMap() {
  return loadCorpus().stylePreferenceMap || {};
}

export function getOutfitIntents() {
  return loadCorpus().outfitIntents || {};
}

export function getOutfitIntent(name?: string | null) {
  if (!name) return null;
  const key = String(name).toLowerCase().trim();
  return getOutfitIntents()[key] || null;
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
  // Footwear — specific before generic
  { subtype: 'uggs', test: (t, cat) => cat === 'footwear' && /\bugg|shearling|sheepskin/.test(t) },
  {
    subtype: 'stilettos',
    test: (t, cat) => cat === 'footwear' && /stiletto|pump|court shoe|classic heel/.test(t),
  },
  {
    subtype: 'block_heels',
    test: (t, cat) => cat === 'footwear' && /block\s*heel/.test(t),
  },
  {
    subtype: 'statement_heels',
    test: (t, cat) => cat === 'footwear' && /statement\s*heel|sculptural\s*heel|platform\s*heel|embellished\s*heel/.test(t),
  },
  {
    subtype: 'heels',
    test: (t, cat) => cat === 'footwear' && /heel/.test(t) && !/block|stiletto|statement|boot/.test(t),
  },
  {
    subtype: 'chelsea_boots',
    test: (t, cat) =>
      cat === 'footwear'
      && /chelsea|desert boot|chukka/.test(t)
      && !/\bugg|shearling|combat|doc\b|dr\.?\s*marten/.test(t),
  },
  {
    // True combat / work / hiking boots only — NOT dressy leather lace-ups
    subtype: 'combat_boots',
    test: (t, cat) =>
      cat === 'footwear'
      && /combat|doc\b|dr\.?\s*marten|chunky boot|hiking boot|work boot|timberland|army boot|ranger boot/.test(t)
      && !/\bugg|shearling|chelsea|desert/.test(t),
  },
  {
    subtype: 'slides',
    test: (t, cat) => cat === 'footwear' && /slide|flip.?flop|pool slide|shower slide/.test(t),
  },
  {
    subtype: 'espadrilles',
    test: (t, cat) => cat === 'footwear' && /espadrille/.test(t),
  },
  {
    subtype: 'leather_sandals',
    test: (t, cat) => cat === 'footwear' && /sandal|birkenstock|fisherman sandal/.test(t),
  },
  {
    // Tech / performance runners only — never boots
    subtype: 'runner',
    test: (t, cat) =>
      cat === 'footwear'
      && !/\bboots?\b/.test(t)
      && (
        /\b(runners?|running shoe|tech runner)\b/.test(t)
        || /hoka|salomon|pegasus|zoomx|vaporfly|ultraboost|fresh foam|gel-?kayano|nimbus|vomero|invincible|cloudmonster/.test(t)
        || (
          /\b(trainers?|sneakers?)\b/.test(t)
          && /gym|training|performance|asics gel|tech runner/.test(t)
        )
      ),
  },
  {
    // Chunky athletic sneakers only (Hoka/Salomon soles, dad shoes) — never leather boots
    subtype: 'chunky_trainer',
    test: (t, cat) =>
      cat === 'footwear'
      && !/\bboots?\b/.test(t)
      && /\b(trainers?|sneakers?)\b/.test(t)
      && /chunky|dad shoe|bulky|technical|trail|platform sneaker|max cushion|tech sneaker|cross.?train|hoka|salomon/.test(t),
  },
  {
    subtype: 'minimal_sneaker',
    test: (t, cat) =>
      cat === 'footwear'
      && !/\bboots?\b/.test(t)
      && (
        /stan smith|common projects|clean court|white leather low-?top|plain white (trainer|sneaker)|lifestyle sneaker/.test(t)
        || (
          /\b(trainers?|sneakers?|runners?)\b/.test(t)
          && !/chunky|hoka|salomon|running|gym|ultraboost|pegasus|trail|dad shoe|tech|platform/.test(t)
        )
      ),
  },
  {
    subtype: 'loafers',
    test: (t, cat) => cat === 'footwear' && /loafer|penny loafer/.test(t),
  },
  {
    // Derby *shoes* only — derby boots fall through to ankle_boots
    subtype: 'derby',
    test: (t, cat) =>
      cat === 'footwear'
      && /\bderby\b/.test(t)
      && !/shirt/.test(t)
      && !/\bboots?\b/.test(t),
  },
  {
    subtype: 'oxfords',
    test: (t, cat) =>
      cat === 'footwear' && /oxford|brogue|dress shoe|formal shoe/.test(t) && !/shirt/.test(t) && !/\bboots?\b/.test(t),
  },
  {
    // Leather lace-ups, derby boots, ankle/riding boots — NOT combat/chunky trainers
    subtype: 'ankle_boots',
    test: (t, cat) =>
      cat === 'footwear'
      && (
        /ankle\s*boot|heeled\s*boot|leather\s*boot|riding\s*boot|derby\s*boot|dress\s*boot|lace[\s-]?up\s*boot|\bboots?\b/.test(t)
      )
      && !/\bugg|shearling|trainer|sneaker|chelsea|combat|doc\b|dr\.?\s*marten|desert|chukka|hiking|work boot|timberland|army boot/.test(t),
  },

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

  // Explicit subtype field wins — unless it clearly contradicts boot names
  // (e.g. AI tagged leather lace-ups as chunky_trainer).
  const explicit = item.subtype || item.garmentSubtype || item.taxonomySubtype;
  if (explicit && getGarmentBySubtype(explicit)) {
    const meta = getGarmentBySubtype(explicit);
    const trainerish = ['chunky_trainer', 'runner', 'minimal_sneaker'].includes(meta.subtype);
    const clearlyBoots = /\bboots?\b/.test(t) && !/\b(trainers?|sneakers?)\b/.test(t);
    if (!(trainerish && clearlyBoots)) {
      return {
        subtype: meta.subtype,
        confidence: 1,
        meta,
        lane: meta.lane,
        formality: meta.formality,
        coarseOnly: false,
      };
    }
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
        const confidence = /windowpane|hoka|salomon|stan smith|chelsea|combat|stiletto|oxford shirt|button-up|button up|sweat short|chunky|slip dress|tailored short/.test(t)
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
  if (ca.meta.avoidWith?.includes(cb.subtype) || cb.meta.avoidWith?.includes(ca.subtype)
    || ca.meta.avoidWith?.includes(resolveSubtype(cb.subtype))
    || cb.meta.avoidWith?.includes(resolveSubtype(ca.subtype))) {
    delta -= 10;
  }
  if (ca.meta.worksWith?.includes(cb.subtype) || cb.meta.worksWith?.includes(ca.subtype)
    || ca.meta.worksWith?.includes(resolveSubtype(cb.subtype))
    || cb.meta.worksWith?.includes(resolveSubtype(ca.subtype))) {
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

  // Visual weight stack — heavy footwear + heavy top/outer soft penalty
  if (ca.meta.category === 'footwear' || cb.meta.category === 'footwear') {
    const shoe = ca.meta.category === 'footwear' ? ca.meta : cb.meta;
    const other = ca.meta.category === 'footwear' ? cb.meta : ca.meta;
    if (shoe.visualWeight === 'heavy' && other.visualWeight === 'heavy'
      && (other.category === 'top' || other.category === 'outerwear')) {
      delta -= 3;
    }
  }

  return delta;
}

const STREET_ATHLEISURE_FOOTWEAR = new Set([
  'chunky_trainer', 'runner', 'combat_boots', 'slides', 'uggs',
]);
const TAILORED_BRIDGE_FOOTWEAR = new Set([
  'minimal_sneaker', 'chelsea_boots', 'ankle_boots', 'loafers', 'derby', 'oxfords',
  'heels', 'stilettos', 'block_heels',
]);
const TAILORED_PIECES = new Set([
  'blazer', 'tailored_trousers', 'oxford_shirt', 'tie', 'tailored_coat', 'tailored_shorts',
]);

function labelSubtype(subtype: string | null | undefined): string {
  return String(subtype || 'footwear').replace(/_/g, ' ');
}

export function footwearVoiceHint(subtype: string | null | undefined, kind = 'lane_mismatch'): string {
  const name = labelSubtype(subtype);
  if (kind === 'anchor_ok') {
    if (subtype === 'chelsea_boots') return 'Chelsea boots anchor this tailored look';
    if (subtype === 'oxfords' || subtype === 'derby') return `${name} lock in the tailored direction`;
    if (subtype === 'minimal_sneaker') return 'Minimal sneakers keep this smart-casual intentional';
    return `${name} set a clear footwear direction`;
  }
  if (kind === 'dress') {
    if (subtype === 'combat_boots') return 'Combat boots undercut a dress — swap to heels or ankle boots';
    if (subtype === 'chunky_trainer' || subtype === 'runner') {
      return 'Chunky trainers pull this dress out of evening — heels or minimal sneakers fit better';
    }
    return `${name} fights the dress silhouette`;
  }
  if (subtype === 'chunky_trainer' || subtype === 'runner') {
    return 'Chunky trainers pull this out of tailoring';
  }
  if (subtype === 'combat_boots') return 'Combat boots pull this into street — drop the blazer or swap boots';
  if (subtype === 'slides') return 'Slides collapse tailored formality — swap to loafers or minimal sneakers';
  if (subtype === 'uggs') return 'UGGs fight tailored pieces — keep them with casual/athleisure bases';
  return `${name} sets a different lane than the rest of this outfit`;
}

/**
 * Footwear-as-anchor scoring for Outfit Mix / allocator.
 * Exposes footwear_lane_mismatch when street/athleisure shoes fight tailored without a bridge.
 */
export function scoreFootwearDirection(items, options: { occasion?: string; eventType?: string } = {}) {
  const classifications = (items || []).map((item) => classifyGarment(item));
  const shoes = classifications.filter((c) => c.meta?.category === 'footwear');
  if (!shoes.length) {
    return { adjustment: 0, signals: [], classifications };
  }

  const shoe = shoes[0];
  const shoeSubtype = shoe.subtype;
  const shoeLane = coherenceLaneFromDb(shoe.lane) || shoe.lane;
  const others = classifications.filter((c) => c !== shoe && c.subtype);
  const hasTailored = others.some((c) => TAILORED_PIECES.has(c.subtype) || c.lane === 'tailored' || c.meta?.isTailored);
  const hasBlazer = others.some((c) => c.subtype === 'blazer');
  const hasDress = others.some((c) => c.meta?.category === 'dress' || c.subtype?.includes('dress'));
  const signals = [];
  let adjustment = 0;

  const streetAthleisureShoe = STREET_ATHLEISURE_FOOTWEAR.has(shoeSubtype)
    || shoeLane === 'street'
    || shoeLane === 'athleisure';

  if (streetAthleisureShoe && hasTailored && !TAILORED_BRIDGE_FOOTWEAR.has(shoeSubtype)) {
    const bridgeOk = shoeSubtype === 'minimal_sneaker' && hasBlazer;
    if (!bridgeOk) {
      adjustment -= 12;
      signals.push({
        id: 'footwear_lane_mismatch',
        severity: 'major',
        hint: footwearVoiceHint(shoeSubtype, 'lane_mismatch'),
        shoeSubtype,
      });
    }
  }

  if (shoe.meta?.visualWeight === 'heavy') {
    const heavyStack = others.some(
      (c) => c.meta?.visualWeight === 'heavy'
        && (c.meta.category === 'outerwear' || c.meta.category === 'top'),
    );
    if (heavyStack) {
      adjustment -= 4;
      signals.push({
        id: 'footwear_visual_weight',
        severity: 'soft',
        hint: 'Heavy footwear plus a heavy top/outer stacks visual weight',
        shoeSubtype,
      });
    }
  }

  if (hasDress && (shoeSubtype === 'chunky_trainer' || shoeSubtype === 'runner' || shoeSubtype === 'combat_boots')) {
    adjustment -= 14;
    signals.push({
      id: 'dress_street_footwear',
      severity: 'major',
      hint: footwearVoiceHint(shoeSubtype, 'dress'),
      shoeSubtype,
    });
  }

  const occasion = String(options.occasion || options.eventType || '').toLowerCase();
  if (occasion && /formal|black.?tie|gala|wedding|office|business|interview/.test(occasion)) {
    const f = shoe.formality ?? shoe.meta?.formality ?? 2;
    if (f < 4) {
      adjustment -= 16;
      signals.push({
        id: 'occasion_footwear_lock',
        severity: 'hard',
        hint: `Formal occasion needs smarter footwear — ${labelSubtype(shoeSubtype)} reads too casual`,
        shoeSubtype,
      });
    }
  }

  if (shoeSubtype === 'chelsea_boots' && hasBlazer) {
    adjustment += 5;
    signals.push({
      id: 'footwear_anchor_ok',
      severity: 'info',
      hint: footwearVoiceHint(shoeSubtype, 'anchor_ok'),
      shoeSubtype,
    });
  }
  if ((shoeSubtype === 'oxfords' || shoeSubtype === 'derby') && hasTailored) {
    adjustment += 4;
  }
  if ((shoeSubtype === 'stilettos' || shoeSubtype === 'heels' || shoeSubtype === 'block_heels') && hasDress) {
    adjustment += 4;
  }

  adjustment = Math.max(-18, Math.min(8, adjustment));
  return { adjustment, signals, classifications, shoeSubtype, shoeLane };
}

/**
 * Soft outfit bonus from pairwise subtype compatibility + footwear direction.
 */
export function scoreOutfitSubtypeCompatibility(items, options: { occasion?: string; eventType?: string } = {}) {
  if (!Array.isArray(items) || items.length < 2) {
    return { adjustment: 0, pairs: [], classifications: [], footwearSignals: [] };
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

  const footwear = scoreFootwearDirection(items, options);
  total += footwear.adjustment * Math.max(1, counted / 2);

  // Cap soft influence so clash authority stays primary
  const adjustment = Math.max(-16, Math.min(12, Math.round(total / Math.max(1, counted / 2))));
  return {
    adjustment,
    pairs,
    classifications,
    footwearSignals: footwear.signals,
  };
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
        const shoe = a.meta.category === 'footwear' ? a : (b.meta.category === 'footwear' ? b : null);
        const other = shoe === a ? b : a;
        let hint = `${a.subtype.replace(/_/g, ' ')} clashes with ${b.subtype.replace(/_/g, ' ')}`;
        if (shoe) {
          if (shoe.subtype === 'chelsea_boots' && other.subtype === 'blazer') {
            hint = 'Chelsea boots anchor this tailored look';
          } else if (['chunky_trainer', 'runner'].includes(shoe.subtype) && (other.subtype === 'blazer' || other.meta?.isTailored)) {
            hint = 'Chunky trainers pull this out of tailoring';
          } else if (shoe.subtype === 'combat_boots' && (other.subtype === 'blazer' || other.subtype === 'slip_dress')) {
            hint = footwearVoiceHint(shoe.subtype, other.subtype === 'slip_dress' ? 'dress' : 'lane_mismatch');
          } else if (shoe.subtype === 'slides' && (other.subtype === 'blazer' || other.meta?.isTailored)) {
            hint = footwearVoiceHint('slides');
          } else if (a.meta.category === 'footwear' || b.meta.category === 'footwear') {
            hint = footwearVoiceHint(shoe.subtype);
          }
        }
        conflicts.push({
          a: a.subtype,
          b: b.subtype,
          itemA: a.item,
          itemB: b.item,
          hint,
          footwearAnchor: Boolean(shoe),
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

  const footwear = scoreFootwearDirection(items);
  for (const sig of footwear.signals) {
    if (sig.severity === 'info') continue;
    const shoeCls = classifications.find((c) => c.subtype === sig.shoeSubtype);
    if (!shoeCls) continue;
    conflicts.push({
      a: sig.shoeSubtype,
      b: null,
      itemA: shoeCls.item,
      itemB: null,
      hint: sig.hint,
      id: sig.id,
      footwearAnchor: true,
    });
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
