/**
 * Self-correcting outfit analysis pipeline.
 *
 * Detect → validate → auto-correct → keep only high-confidence outputs.
 * Operates on structured candidates (YOLO / vision / human labels).
 * Does not trust a single model vote.
 */

import { feetLikelyCropped, isHardFootwear, type BBoxTuple } from '@/utils/bodyGeometryGuardrails';

export type BBox = {
  /** Normalised 0–1 */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DetectionCandidate = {
  id?: string;
  /** Category votes from multiple models / heuristics */
  categoryVotes?: string[];
  heuristicCategory?: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  bbox?: BBox | null;
  aspectRatio?: number | null;
  confidence?: number | null;
  sleeve?: 'short' | 'long' | 'sleeveless' | null;
  roleHint?: 'top' | 'bottom' | 'footwear' | 'outerwear' | 'accessory' | null;
};

export type ImageQualityMeta = {
  /** 0–1, higher = blurrier */
  blurScore?: number;
  /** 0–1, higher = darker */
  darknessScore?: number;
  itemCount?: number;
  hasCentralSubject?: boolean;
};

export type OutfitPiece = {
  category: string;
  subcategory: string | null;
  color: string | null;
  confidence: number;
  role: 'top' | 'bottom' | 'footwear' | 'outerwear' | 'accessory';
};

export type StructuredOutfit = {
  top: OutfitPiece | null;
  bottom: OutfitPiece | null;
  outerwear: OutfitPiece | null;
  footwear: OutfitPiece | null;
  accessory: OutfitPiece | null;
};

export type PipelineResult = {
  id: string;
  discarded: boolean;
  discardReason?: string;
  outfit: StructuredOutfit;
  style: { primary: string; secondary: string[] };
  colour_palette: string[];
  features: { layering: string; contrast: string; silhouette: string };
  brand: string | null;
  price_tier: string;
  style_tags: string[];
  confidence: number;
  validated: boolean;
  violations: string[];
  repairs: string[];
  iterations: number;
};

export type PipelineInput = {
  id: string;
  detections: DetectionCandidate[];
  imageMeta?: ImageQualityMeta;
  brand?: string | null;
  price_tier?: string | null;
  context?: string | null;
  maxRepairIterations?: number;
  acceptConfidence?: number;
  repairConfidence?: number;
};

const FOOTWEAR = new Set([
  'footwear',
  'shoes',
  'boots',
  'sneakers',
  'loafers',
  'heels',
  'sandals',
  'oxfords',
  'derby',
  'mules',
  'flats',
  'espadrilles',
]);

const BOTTOMS = new Set(['trousers', 'jeans', 'skirt', 'shorts', 'pants', 'bottom', 'bottoms']);
const TOPS = new Set([
  'shirt',
  'blouse',
  'sweater',
  'polo',
  't-shirt',
  'tee',
  'knit',
  'top',
  'tops',
  'camisole',
]);
const DRESSES = new Set(['dress', 'dresses', 'gown']);
const OUTER = new Set(['blazer', 'jacket', 'coat', 'cardigan', 'outerwear', 'vest', 'waistcoat']);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normCat(raw: unknown): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

/** Map noisy labels onto canonical outfit categories. */
export function canonicalizeCategory(raw: unknown): string {
  const c = normCat(raw);
  if (!c) return 'other';
  if (FOOTWEAR.has(c) || /boot|shoe|sneaker|loafer|heel|sandal|oxford|derby|mule|flat|espadrille/.test(c)) {
    return 'footwear';
  }
  if (DRESSES.has(c)) return 'dress';
  if (BOTTOMS.has(c) || /trouser|jean|skirt|short|chino|pant/.test(c)) {
    if (/jean/.test(c)) return 'jeans';
    if (/skirt/.test(c)) return 'skirt';
    if (/short/.test(c)) return 'shorts';
    return 'trousers';
  }
  if (OUTER.has(c) || /blazer|jacket|coat|cardigan/.test(c)) {
    if (/blazer/.test(c)) return 'blazer';
    if (/cardigan/.test(c)) return 'cardigan';
    if (/waistcoat|vest/.test(c)) return 'waistcoat';
    return 'jacket';
  }
  if (/polo/.test(c)) return 'polo';
  if (/blouse|camisole|tunic/.test(c)) return 'blouse';
  if (/sweater|jumper/.test(c)) return 'sweater';
  if (/knit/.test(c)) return 'knit';
  if (/\bt_?shirt\b|tee/.test(c)) return 't-shirt';
  if (/shirt/.test(c)) return 'shirt';
  if (TOPS.has(c)) return 'tops';
  if (/tie|necktie/.test(c)) return 'necktie';
  if (/bag|tote|hat|cap|belt|jewelry|eyewear|glasses/.test(c)) return 'accessory';
  return c === 'other' ? 'other' : c;
}

/**
 * Majority vote across model labels + heuristic.
 * Footwear heuristic always wins over dress when present (boots ≠ dress).
 */
export function majorityVoteCategories(
  votes: Array<string | null | undefined>,
  heuristic?: string | null,
): string {
  const cleaned = votes.map(canonicalizeCategory).filter(Boolean);
  if (heuristic) cleaned.push(canonicalizeCategory(heuristic));
  if (!cleaned.length) return 'other';

  // Hard rule: any footwear vote → never dress
  if (cleaned.some((c) => c === 'footwear') && cleaned.includes('dress')) {
    return 'footwear';
  }

  const counts = new Map<string, number>();
  for (const c of cleaned) counts.set(c, (counts.get(c) || 0) + 1);
  let best = cleaned[0];
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN || (n === bestN && k === 'footwear')) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** Geometry guardrails — e.g. bottom-heavy short boxes → footwear. */
export function applyGeometryGuardrails(
  category: string,
  bbox?: BBox | null,
  aspectRatio?: number | null,
): { category: string; applied: string | null } {
  if (!bbox) return { category, applied: null };
  const ar = aspectRatio ?? (bbox.h > 0 ? bbox.w / bbox.h : 1);
  const bottomHeavy = bbox.y + bbox.h > 0.72 && bbox.y > 0.45;
  const shortTall = ar < 0.65 && bbox.h < 0.35;

  if ((category === 'dress' || category === 'skirt' || category === 'other') && bottomHeavy && shortTall) {
    return { category: 'footwear', applied: 'bbox_bottom_heavy_footwear' };
  }
  if (category === 'dress' && bottomHeavy && ar < 0.55) {
    return { category: 'footwear', applied: 'aspect_ratio_footwear' };
  }
  return { category, applied: null };
}

export function shouldDiscardImage(meta?: ImageQualityMeta): string | null {
  if (!meta) return null;
  if ((meta.blurScore ?? 0) > 0.6) return 'too_blurry';
  if ((meta.darknessScore ?? 0) > 0.75) return 'too_dark';
  if (meta.hasCentralSubject === false) return 'no_central_subject';
  if ((meta.itemCount ?? 0) > 6) return 'too_many_items';
  return null;
}

function roleForCategory(cat: string, hint?: DetectionCandidate['roleHint']): OutfitPiece['role'] {
  if (hint) return hint;
  if (cat === 'footwear') return 'footwear';
  if (cat === 'dress') return 'top';
  if (['trousers', 'jeans', 'skirt', 'shorts'].includes(cat)) return 'bottom';
  if (['blazer', 'jacket', 'coat', 'cardigan', 'waistcoat'].includes(cat)) return 'outerwear';
  if (cat === 'accessory' || cat === 'necktie') return 'accessory';
  return 'top';
}

function toPiece(det: DetectionCandidate, category: string, conf: number): OutfitPiece {
  return {
    category,
    subcategory: det.subcategory ? normCat(det.subcategory) : null,
    color: det.color ? String(det.color).toLowerCase() : null,
    confidence: clamp01(conf),
    role: roleForCategory(category, det.roleHint),
  };
}

/** Vertical body region from normalised bbox centre Y. */
export function getBodyRegion(bbox?: BBox | null): 'top' | 'middle' | 'bottom' | 'unknown' {
  if (!bbox) return 'unknown';
  const cy = bbox.y + bbox.h / 2;
  if (cy < 0.33) return 'top';
  if (cy < 0.66) return 'middle';
  return 'bottom';
}

/**
 * Recover footwear only from hard shoe-shaped boxes already in the frame.
 * Never soft-invent shoes for barefoot / trousers-only outfits.
 */
export function recoverMissingFootwear(
  outfit: StructuredOutfit,
  detections: DetectionCandidate[],
): { outfit: StructuredOutfit; recovered: DetectionCandidate | null; repair: string | null } {
  if (outfit.footwear) {
    return { outfit, recovered: null, repair: null };
  }

  if (feetLikelyCropped(
    detections.filter((d) => d.bbox).map((d) => [d.bbox!.x, d.bbox!.y, d.bbox!.w, d.bbox!.h] as BBoxTuple),
  )) {
    return { outfit, recovered: null, repair: null };
  }

  const hardFoot = detections
    .filter((d) => d.bbox)
    .map((d) => ({
      d,
      box: [d.bbox!.x, d.bbox!.y, d.bbox!.w, d.bbox!.h] as BBoxTuple,
    }))
    .filter((c) => isHardFootwear(c.box))
    .sort((a, b) => (b.box[2] * b.box[3]) - (a.box[2] * a.box[3]));

  const best = hardFoot[0];
  if (!best) {
    return { outfit, recovered: null, repair: null };
  }

  const piece: OutfitPiece = {
    category: 'footwear',
    subcategory: 'shoes',
    color: best.d.color ? String(best.d.color).toLowerCase() : null,
    confidence: Math.min(0.65, Math.max(0.4, best.d.confidence ?? 0.45)),
    role: 'footwear',
  };
  return {
    outfit: { ...outfit, footwear: piece },
    recovered: {
      ...best.d,
      category: 'footwear',
      roleHint: 'footwear',
      heuristicCategory: 'footwear',
      confidence: piece.confidence,
    },
    repair: 'recover_footwear_bottom_region',
  };
}

/** Structure pieces into top / bottom / footwear / outerwear by role + vertical position. */
export function structureOutfit(pieces: OutfitPiece[], detections: DetectionCandidate[]): StructuredOutfit {
  const withY = pieces.map((p, i) => ({
    piece: p,
    y: detections[i]?.bbox ? detections[i]!.bbox!.y + detections[i]!.bbox!.h / 2 : null,
  }));

  const pick = (role: OutfitPiece['role'], preferLowY?: boolean): OutfitPiece | null => {
    const pool = withY.filter((x) => x.piece.role === role);
    if (!pool.length) return null;
    pool.sort((a, b) => {
      if (a.y == null && b.y == null) return b.piece.confidence - a.piece.confidence;
      if (a.y == null) return 1;
      if (b.y == null) return -1;
      return preferLowY ? b.y - a.y : a.y - b.y;
    });
    return pool[0].piece;
  };

  let top = pick('top', false);
  let bottom = pick('bottom', true);
  let footwear = pick('footwear', true);
  const outerwear = pick('outerwear', false);
  const accessory = pick('accessory', false);

  // Dress absorbs bottom
  if (top?.category === 'dress') bottom = null;

  return { top, bottom, outerwear, footwear, accessory };
}

function contrastFromPalette(colors: string[]): string {
  const uniq = [...new Set(colors.filter(Boolean))];
  if (uniq.length <= 1) return 'low';
  const neutrals = new Set(['black', 'white', 'cream', 'beige', 'grey', 'gray', 'taupe', 'brown', 'tan', 'navy']);
  const nonNeutral = uniq.filter((c) => !neutrals.has(c));
  if (nonNeutral.length === 0) return 'low';
  if (nonNeutral.length >= 2) return 'high';
  return 'medium';
}

function inferStyle(outfit: StructuredOutfit, context?: string | null): { primary: string; secondary: string[] } {
  const ctx = String(context || '').toLowerCase();
  if (ctx.includes('work') || ctx.includes('business')) {
    return { primary: 'business_casual', secondary: ['smart_casual'] };
  }
  const fw = outfit.footwear?.subcategory || outfit.footwear?.category || '';
  const top = outfit.top?.category || '';
  if (/sneaker/.test(fw) || top === 't-shirt') {
    return { primary: 'casual', secondary: ['smart_casual'] };
  }
  if (outfit.top?.category === 'dress') {
    return { primary: 'resort', secondary: ['smart_casual'] };
  }
  return { primary: 'smart_casual', secondary: ['minimal'] };
}

function styleTagsFor(
  stylePrimary: string,
  features: { contrast: string; silhouette: string; layering: string },
  brand?: string | null,
): string[] {
  const tags = new Set<string>();
  if (features.contrast === 'low') tags.add('quiet luxury');
  if (features.silhouette.includes('tailored')) tags.add('tailored');
  if (features.silhouette.includes('relaxed')) tags.add('relaxed');
  if (stylePrimary === 'smart_casual') tags.add('smart casual');
  if (stylePrimary === 'resort') tags.add('resort');
  if (brand && /loro|zegna|cucinelli|piana/.test(brand)) tags.add('quiet luxury');
  return [...tags];
}

/**
 * Confidence = 0.3 detection + 0.25 classification + 0.2 rules + 0.15 attributes + 0.1 coherence
 */
export function scorePipelineConfidence(args: {
  detectionAvg: number;
  classificationAvg: number;
  rulesOk: number;
  attributesOk: number;
  coherence: number;
}): number {
  return clamp01(
    0.3 * args.detectionAvg
      + 0.25 * args.classificationAvg
      + 0.2 * args.rulesOk
      + 0.15 * args.attributesOk
      + 0.1 * args.coherence,
  );
}

function outfitCoherence(outfit: StructuredOutfit): number {
  let score = 0.5;
  if (outfit.top) score += 0.2;
  if (outfit.bottom || outfit.top?.category === 'dress') score += 0.15;
  if (outfit.footwear) score += 0.1;
  if (outfit.top && outfit.bottom && outfit.top.category === 'dress') score -= 0.2;
  return clamp01(score);
}

/** Soft clash-style auto-fixes on structured outfit. */
export function applyOutfitGuardrails(
  outfit: StructuredOutfit,
  context?: string | null,
): { outfit: StructuredOutfit; repairs: string[]; violations: string[] } {
  const repairs: string[] = [];
  const violations: string[] = [];
  const next: StructuredOutfit = {
    top: outfit.top ? { ...outfit.top } : null,
    bottom: outfit.bottom ? { ...outfit.bottom } : null,
    outerwear: outfit.outerwear ? { ...outfit.outerwear } : null,
    footwear: outfit.footwear ? { ...outfit.footwear } : null,
    accessory: outfit.accessory ? { ...outfit.accessory } : null,
  };

  // Tie + short sleeve → remove tie
  if (
    next.accessory?.category === 'necktie'
    && next.top?.subcategory
    && /short/.test(next.top.subcategory)
  ) {
    next.accessory = null;
    repairs.push('remove_tie_short_sleeve');
  }

  // Boots mislabelled as dress already handled in vote/geometry; double-check
  if (next.top?.category === 'footwear') {
    next.footwear = next.top;
    next.top = null;
    repairs.push('move_footwear_from_top');
  }

  const ctx = String(context || '').toLowerCase();
  const fwBlob = `${next.footwear?.subcategory || ''} ${next.footwear?.category || ''}`.toLowerCase();
  if (
    (ctx.includes('work') || ctx.includes('business'))
    && /rugged|combat|chunky|hiking|work_boot/.test(fwBlob)
  ) {
    violations.push('work_rugged_footwear');
    if (next.footwear) next.footwear = { ...next.footwear, confidence: Math.min(next.footwear.confidence, 0.4) };
    repairs.push('downgrade_rugged_work_footwear');
  }

  // Work (non-creative) sneakers — soft penalty only; clash engine may hard-cap later
  const creative = /creative|smart_casual|casual/.test(ctx);
  if (
    (ctx.includes('work') || ctx.includes('business') || ctx.includes('office'))
    && !creative
    && /sneaker|trainer|running/.test(fwBlob)
  ) {
    violations.push('work_sneaker_soft_penalty');
    if (next.footwear) next.footwear = { ...next.footwear, confidence: Math.min(next.footwear.confidence, 0.45) };
    repairs.push('downgrade_work_sneakers');
  }

  return { outfit: next, repairs, violations };
}

function dropWeakest(outfit: StructuredOutfit): { outfit: StructuredOutfit; repair: string | null } {
  const entries: Array<{ key: keyof StructuredOutfit; conf: number }> = [];
  (['top', 'bottom', 'outerwear', 'footwear', 'accessory'] as const).forEach((key) => {
    const p = outfit[key];
    if (p) entries.push({ key, conf: p.confidence });
  });
  if (entries.length <= 1) return { outfit, repair: null };
  entries.sort((a, b) => a.conf - b.conf);
  const weakest = entries[0];
  // Prefer dropping accessory/outerwear before core pieces
  const preferred = entries.find((e) => e.key === 'accessory' || e.key === 'outerwear') || weakest;
  const next = { ...outfit, [preferred.key]: null };
  return { outfit: next, repair: `drop_${preferred.key}` };
}

function emptyOutfit(): StructuredOutfit {
  return { top: null, bottom: null, outerwear: null, footwear: null, accessory: null };
}

/**
 * Full pipeline: quality filter → vote → guardrails → structure → confidence → repair loop.
 */
export function runOutfitAutoPipeline(input: PipelineInput): PipelineResult {
  const maxIter = input.maxRepairIterations ?? 3;
  const acceptAt = input.acceptConfidence ?? 0.8;
  const repairBelow = input.repairConfidence ?? 0.75;
  const repairs: string[] = [];
  const violations: string[] = [];

  const discard = shouldDiscardImage(input.imageMeta);
  if (discard) {
    return {
      id: input.id,
      discarded: true,
      discardReason: discard,
      outfit: emptyOutfit(),
      style: { primary: 'casual', secondary: [] },
      colour_palette: [],
      features: { layering: 'none', contrast: 'low', silhouette: 'unknown' },
      brand: input.brand || null,
      price_tier: input.price_tier || 'unknown',
      style_tags: [],
      confidence: 0,
      validated: false,
      violations: [discard],
      repairs: [],
      iterations: 0,
    };
  }

  // Vote + geometry per detection
  let workingDets = input.detections.map((d) => {
    const voted = majorityVoteCategories(
      [...(d.categoryVotes || []), d.category],
      d.heuristicCategory,
    );
    const geo = applyGeometryGuardrails(voted, d.bbox, d.aspectRatio);
    if (geo.applied) repairs.push(geo.applied);
    return { ...d, category: geo.category };
  });

  let iterations = 0;
  let confidence = 0;
  let outfit = emptyOutfit();
  let style = { primary: 'smart_casual', secondary: [] as string[] };
  let palette: string[] = [];
  let features = { layering: 'none', contrast: 'low', silhouette: 'relaxed_tailored' };

  while (iterations <= maxIter) {
    iterations += 1;
    const pieces = workingDets.map((d) =>
      toPiece(d, canonicalizeCategory(d.category), d.confidence ?? 0.7),
    );
    outfit = structureOutfit(pieces, workingDets);
    const shoeRecovery = recoverMissingFootwear(outfit, workingDets);
    outfit = shoeRecovery.outfit;
    if (shoeRecovery.repair) {
      repairs.push(shoeRecovery.repair);
      if (
        shoeRecovery.recovered
        && !workingDets.some((d) => canonicalizeCategory(d.category) === 'footwear')
      ) {
        workingDets = [...workingDets, shoeRecovery.recovered];
      }
    }
    const guarded = applyOutfitGuardrails(outfit, input.context);
    outfit = guarded.outfit;
    repairs.push(...guarded.repairs);
    violations.push(...guarded.violations);

    palette = [
      outfit.top?.color,
      outfit.bottom?.color,
      outfit.outerwear?.color,
      outfit.footwear?.color,
    ].filter(Boolean) as string[];

    const layering =
      outfit.outerwear && outfit.top ? 'structured' : outfit.outerwear || outfit.accessory ? 'light' : 'none';
    features = {
      layering,
      contrast: contrastFromPalette(palette),
      silhouette: outfit.outerwear?.category === 'blazer' ? 'tailored' : 'relaxed_tailored',
    };
    style = inferStyle(outfit, input.context);

    const detAvg =
      workingDets.reduce((s, d) => s + (d.confidence ?? 0.65), 0) / Math.max(1, workingDets.length);
    const classAvg = pieces.reduce((s, p) => s + p.confidence, 0) / Math.max(1, pieces.length);
    const rulesOk = violations.length ? 0.45 : 0.95;
    const attrOk = palette.length ? 0.85 : 0.55;
    confidence = scorePipelineConfidence({
      detectionAvg: detAvg,
      classificationAvg: classAvg,
      rulesOk,
      attributesOk: attrOk,
      coherence: outfitCoherence(outfit),
    });

    if (confidence >= acceptAt) break;
    if (confidence >= repairBelow && iterations > 1) break;
    if (iterations > maxIter) break;

    // Repair strategies
    if (confidence < repairBelow) {
      // 1) heuristic override on weakest category
      workingDets = workingDets.map((d) => {
        if ((d.confidence ?? 1) < 0.7 && d.heuristicCategory) {
          repairs.push('heuristic_override');
          return { ...d, category: canonicalizeCategory(d.heuristicCategory), confidence: 0.75 };
        }
        return d;
      });
      // 2) drop weakest accessory/outerwear
      const dropped = dropWeakest(outfit);
      if (dropped.repair) {
        repairs.push(dropped.repair);
        const role = dropped.repair.replace('drop_', '') as keyof StructuredOutfit;
        workingDets = workingDets.filter((d) => roleForCategory(canonicalizeCategory(d.category), d.roleHint) !== role);
      }
      // 3) rebuild roles from bbox Y
      repairs.push('rebuild_outfit_structure');
    }
  }

  const validated = confidence >= repairBelow && !shouldDiscardImage(input.imageMeta);
  if (!validated && iterations > maxIter) {
    violations.push('max_repair_iterations');
  }

  const brand = input.brand || null;
  const tags = styleTagsFor(style.primary, features, brand);

  return {
    id: input.id,
    discarded: false,
    outfit,
    style,
    colour_palette: [...new Set(palette)],
    features,
    brand,
    price_tier: input.price_tier || (brand ? 'luxury' : 'unknown'),
    style_tags: tags,
    confidence,
    validated,
    violations: [...new Set(violations)],
    repairs: [...new Set(repairs)],
    iterations,
  };
}

/** Convert pipeline result into dataset-shaped JSON row. */
export function pipelineResultToDatasetRow(result: PipelineResult, imagePath: string) {
  const piece = (p: OutfitPiece | null) =>
    p
      ? {
          category: p.category === 'footwear' ? 'shoes' : p.category,
          subcategory: p.subcategory,
          color: p.color,
        }
      : null;

  return {
    id: result.id,
    source: 'sloane_street',
    image_path: imagePath,
    brand: result.brand,
    price_tier: result.price_tier,
    outfit: {
      top: piece(result.outfit.top),
      bottom: piece(result.outfit.bottom),
      outerwear: piece(result.outfit.outerwear),
      footwear: piece(result.outfit.footwear),
      accessory: piece(result.outfit.accessory),
    },
    style: result.style,
    style_tags: result.style_tags,
    colour_palette: result.colour_palette,
    features: result.features,
    notes: result.repairs.length ? `auto-repaired: ${result.repairs.join(', ')}` : '',
    confidence: result.confidence,
    score_hint: {
      base_score: Math.round(result.confidence * 100),
      boost: result.validated,
    },
    rules: {
      valid: result.validated && !result.discarded,
      violations: result.violations,
    },
  };
}
