/**
 * Hard body-geometry guardrails for Live / on-device detection.
 *
 * Authority: REGION (hard) → SHAPE → VISION → YOLO (weak).
 * Soft heuristics alone caused tops↔trousers↔shoes cascades.
 */

import { localizedShoeKind, polishUkLiveLabel } from '@/utils/liveLocaleLabels';

export const REGION = {
  TOP_MAX: 0.42,
  BOTTOM_MIN: 0.55,
  /** Raised — when feet are cropped, shorts sit near frame bottom and must NOT hit footwear. */
  FOOTWEAR_MIN: 0.80,
} as const;

export type StrictBodyRegion = 'top' | 'transition' | 'bottom' | 'footwear';

export type BBoxTuple = [number, number, number, number];

export function centerY(bbox: BBoxTuple): number {
  return bbox[1] + bbox[3] / 2;
}

export function getStrictBodyRegion(bbox: BBoxTuple): StrictBodyRegion {
  const cy = centerY(bbox);
  if (cy < REGION.TOP_MAX) return 'top';
  if (cy < REGION.BOTTOM_MIN) return 'transition';
  if (cy < REGION.FOOTWEAR_MIN) return 'bottom';
  return 'footwear';
}

/** Legacy 3-band alias used by older callers — maps transition→middle. */
export function getBodyRegionLegacy(bbox: BBoxTuple): 'top' | 'middle' | 'bottom' {
  const r = getStrictBodyRegion(bbox);
  if (r === 'top') return 'top';
  if (r === 'transition') return 'middle';
  return 'bottom';
}

function aspectHW(bbox: BBoxTuple): number {
  return bbox[3] / Math.max(bbox[2], 1e-6);
}

function area(bbox: BBoxTuple): number {
  return Math.max(0, bbox[2]) * Math.max(0, bbox[3]);
}

export type RegionLockedLabel = {
  category: string;
  subcategory: string;
  name: string;
  repair: string | null;
};

/**
 * HARD footwear — shoe-shaped at the floor.
 * Mid-calf boots (Docs) are taller than trainers — allow a taller shaft.
 */
export function isHardFootwear(bbox: BBoxTuple): boolean {
  const [, y, w, h] = bbox;
  const cy = centerY(bbox);
  const bottom = y + h;
  // Mid-calf boot shaft (still footwear, not a pant column) — must stay wider than tall
  if (h >= 0.14 && h < 0.28 && bottom >= 0.90 && cy >= 0.78 && w > h && w < 0.42) {
    return true;
  }
  if (h >= 0.20) return false;
  if (w <= h) return false; // shoes are wider than tall
  if (w >= 0.38) return false;
  if (bottom < 0.90) return false;
  if (cy < 0.82) return false;
  if (aspectHW(bbox) >= 1.0) return false;
  return area(bbox) <= 0.10;
}

/** Shoe only if geometry passes AND ROI is not skin-dominant.
 *  Reliable fabric colour (black trainers etc.) may pass when skin sample is missing.
 */
export function isValidShoe(
  bbox: BBoxTuple,
  skinRatio?: number | null,
  fabricColor?: string | null,
): boolean {
  if (!isHardFootwear(bbox)) return false;
  if (skinRatio != null && skinRatio >= 0.22) return false;
  if (skinRatio == null) return hasReliableFabricColor(fabricColor);
  return true;
}

export function isFloorTouching(bbox: BBoxTuple): boolean {
  return bbox[1] + bbox[3] > 0.92;
}

export function isLikelyTruncatedBottom(
  current: BBoxTuple,
  previous: BBoxTuple | null | undefined,
): boolean {
  if (!previous) return false;
  return current[3] < previous[3] * 0.7;
}

export type BottomSubtype = 'shorts' | 'trousers' | 'skirt';

/**
 * Shorts often get a YOLO box that includes bare legs / socks / boots to the floor.
 * Lower-ROI skin → fabric ends mid-thigh even if the box touches the floor.
 */
export function hasLegBleedBelowHem(
  bbox: BBoxTuple,
  lowerSkinRatio?: number | null,
): boolean {
  if (lowerSkinRatio == null) return false;
  const [, y, , h] = bbox;
  const bottom = y + h;
  // Tall box reaching near floor with skin-heavy lower half = shorts + legs
  if (bottom >= 0.85 && h >= 0.28 && lowerSkinRatio >= 0.32) return true;
  if (bottom >= 0.88 && lowerSkinRatio >= 0.28) return true;
  return false;
}

/**
 * Shorts + dark socks + boots: box starts mid-thigh and swallows calves/feet.
 * Lower half is fabric (not skin), so leg-bleed alone misses this.
 */
export function looksLikeShortsWithFootwearExtension(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null },
): boolean {
  const [, y, , h] = bbox;
  const bottom = y + h;
  if (y < 0.48) return false; // true trousers usually start nearer the waist
  if (h >= 0.52) return false; // full pant column
  if (bottom < 0.86) return false;
  // Mid-thigh / hip start + floor reach = shorts fused with socks/boots
  if (y >= 0.50 && h <= 0.50 && bottom >= 0.90) return true;
  if (y >= 0.48 && h < 0.42 && bottom >= 0.90) return true;
  // Dark sock fill: low lower-skin, clearly not a waist-high pant
  const lowerSkin = opts?.lowerSkinRatio;
  if (lowerSkin != null && lowerSkin < 0.28 && y >= 0.50 && h < 0.48 && bottom >= 0.90) {
    return true;
  }
  return false;
}

/**
 * Knee-boundary evidence: box crosses the knee with fabric both above and below.
 * Shorts end above the knee; trousers are continuous from waist. With long socks
 * the dark column continues, but the knee still sits inside a shorts+socks fuse.
 */
export function hasKneeBreakEvidence(bbox: BBoxTuple): boolean {
  const [, y, , h] = bbox;
  const bottom = y + h;
  const kneeY = 0.62; // typical knee in full-body mirror selfies
  if (y >= kneeY || bottom <= kneeY + 0.1) return false;
  const above = kneeY - y;
  const below = bottom - kneeY;
  // Mid-thigh start (shorts hem), not waist-start trousers
  return y >= 0.50 && y < 0.58 && h < 0.50 && above >= 0.06 && below >= 0.18 && bottom >= 0.88;
}

/**
 * Soft shorts vs trousers scores for layered legs (multi-hypothesis).
 * Higher shorts score when knee-break / sock-boot fuse is present.
 */
export function scoreBottomHypotheses(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null; fabricColor?: string | null },
): { shorts: number; trousers: number; winner: BottomSubtype } {
  const [, y, , h] = bbox;
  const bottom = y + h;
  let shorts = 0.4;
  let trousers = 0.4;
  if (looksLikeShortsWithFootwearExtension(bbox, opts)) {
    shorts += 0.3;
    trousers -= 0.22;
  }
  if (hasKneeBreakEvidence(bbox)) {
    shorts += 0.24;
    trousers -= 0.18;
  }
  if (hasLegBleedBelowHem(bbox, opts?.lowerSkinRatio)) {
    shorts += 0.16;
    trousers -= 0.12;
  }
  if (y < 0.42 && h >= 0.45 && bottom >= 0.88) {
    trousers += 0.28;
    shorts -= 0.16;
  } else if (y <= 0.48 && h >= 0.42 && bottom > 0.92
    && !looksLikeShortsWithFootwearExtension(bbox, opts)
    && !hasKneeBreakEvidence(bbox)) {
    trousers += 0.22;
    shorts -= 0.12;
  }
  if (y >= 0.48 && h < 0.4) {
    shorts += 0.18;
    trousers -= 0.1;
  }
  shorts = Math.max(0.05, Math.min(0.95, shorts));
  trousers = Math.max(0.05, Math.min(0.95, trousers));
  const winner: BottomSubtype = shorts >= trousers ? 'shorts' : 'trousers';
  return { shorts, trousers, winner };
}

/** Clip a shorts box so the overlay ends near the hem, not the feet. */
export function clipShortsBbox(bbox: BBoxTuple): BBoxTuple {
  const [x, y, w, h] = bbox;
  const bottom = y + h;
  if (bottom <= 0.82) return bbox;
  const clippedH = Math.max(0.18, Math.min(h, 0.78 - y));
  return [x, y, w, clippedH];
}

/**
 * Tall floor-reaching bottom = trousers evidence.
 * Socks/boots fused under shorts must NOT count as trousers.
 */
export function isFloorLengthTrousersEvidence(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null; fabricColor?: string | null },
): boolean {
  const [, y, , h] = bbox;
  const bottom = y + h;
  if (looksLikeShortsWithFootwearExtension(bbox, opts)) return false;
  if (hasLegBleedBelowHem(bbox, opts?.lowerSkinRatio)) return false;
  // True trousers: start near waist and form a tall fabric column
  if (bottom > 0.92 && h >= 0.42 && y <= 0.48) return true;
  return h >= 0.42 && bottom >= 0.88 && y <= 0.48;
}

/**
 * Fabric spanning thigh *and* calf, even when the box never reaches the floor.
 *
 * Detectors routinely stop a dark trouser box at mid-calf, and the floor-contact
 * tests then fail, so black sweatpants kept landing as "Dark Shorts" until a
 * cloud round trip corrected them. Shorts end above the knee: a hip-start box
 * whose hem sits well below the knee line is not a pair of shorts, whatever the
 * label says. The shorts+socks fuse and visible-leg cases are checked first, so
 * this only speaks when nothing suggests a bare leg under a hem.
 */
export function coversKneeAndCalf(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null },
): boolean {
  const [, y, , h] = bbox;
  const bottom = y + h;
  if (looksLikeShortsWithFootwearExtension(bbox, opts)) return false;
  if (hasKneeBreakEvidence(bbox)) return false;
  if (hasLegBleedBelowHem(bbox, opts?.lowerSkinRatio)) return false;
  // Waist start (not a thigh-start shorts hem), hem past the knee line, tall panel.
  return y <= 0.46 && bottom >= 0.72 && h >= 0.26;
}

/**
 * Structural bottoms classifier.
 * Floor-length trousers with visible ankles must NOT become shorts —
 * but shorts + socks/boots must NOT become trousers.
 */
export function classifyBottomSubtype(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null; fabricColor?: string | null },
): BottomSubtype {
  const [, y, , h] = bbox;
  const bottom = y + h;
  const lowerSkin = opts?.lowerSkinRatio;
  const legBleed = hasLegBleedBelowHem(bbox, lowerSkin);
  const sockBootExt = looksLikeShortsWithFootwearExtension(bbox, opts);
  const kneeBreak = hasKneeBreakEvidence(bbox);
  const fabric = String(opts?.fabricColor || '').toLowerCase();
  const solidFabric = /gray|grey|black|navy|blue|charcoal|beige|khaki|cream|white|brown|green/.test(fabric);

  // Layered legs: shorts + socks/boots (continuous dark column is NOT trousers)
  if (sockBootExt || kneeBreak || (legBleed && y >= 0.48 && h < 0.48)) {
    return 'shorts';
  }

  // Soft hypothesis when geometry is ambiguous — prefer layered shorts
  const soft = scoreBottomHypotheses(bbox, opts);
  if (soft.shorts >= 0.58 && soft.shorts - soft.trousers >= 0.08) {
    return 'shorts';
  }

  // Floor contact: only trousers when waist-start tall column
  if (bottom > 0.92) {
    if (legBleed && lowerSkin != null && lowerSkin >= 0.32 && y >= 0.48) {
      return 'shorts';
    }
    if (y >= 0.50 && h <= 0.50) return 'shorts';
    if (h >= 0.42 && y <= 0.48) return 'trousers';
    return 'shorts';
  }

  // Solid fabric colour + long waist-start box → trousers
  if (solidFabric && isFloorLengthTrousersEvidence(bbox, opts)) {
    return 'trousers';
  }

  // Full-length bottoms: tall box from near waist
  if (h >= 0.40 && bottom >= 0.85 && y < 0.48) {
    if (legBleed && lowerSkin != null && lowerSkin >= 0.42 && y >= 0.45) {
      return 'shorts';
    }
    return 'trousers';
  }
  if (h >= 0.42 && bottom >= 0.82 && y < 0.48 && (lowerSkin == null || lowerSkin < 0.4)) {
    return 'trousers';
  }

  if (legBleed && h < 0.42) return 'shorts';

  // Truncated box that still covers knee and calf → full-length, not shorts.
  if (coversKneeAndCalf(bbox, opts)) return 'trousers';

  // Clear mid-thigh ending → shorts
  if (bottom < 0.82 && h < 0.36) return 'shorts';
  if (bottom < 0.80 && h < 0.40) return 'shorts';

  // True floor-length fabric from waist
  if (isFloorTouching(bbox) && h >= 0.42 && y < 0.48 && (lowerSkin == null || lowerSkin < 0.35)) {
    return 'trousers';
  }

  // Beige/cream solid fabric with a mid-thigh-truncated box still often = full trousers
  // (YOLO only drew the hip→thigh region). Prefer trousers when the box reaches low
  // and legs aren't clearly bare under a hem.
  if (
    solidFabric
    && /beige|khaki|cream|white|brown/.test(fabric)
    && bottom >= 0.78
    && (lowerSkin == null || lowerSkin < 0.28)
    && !sockBootExt
  ) {
    return 'trousers';
  }

  // Ambiguous short ROI / mid-body start → shorts (not trousers-by-default)
  if (y >= 0.45 && h < 0.42) return 'shorts';
  if (y >= 0.45 && y <= 0.62 && h < 0.38 && bottom < 0.88) return 'shorts';

  return y < 0.48 && h >= 0.40 ? 'trousers' : 'shorts';
}

/** Shorts vs trousers for bottom-region garments. */
export function bottomsLabel(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null; fabricColor?: string | null },
): RegionLockedLabel {
  const [, y] = bbox;
  if (y < 0.4 && centerY(bbox) < REGION.BOTTOM_MIN) {
    return {
      category: 'tops',
      subcategory: 'top',
      name: 'Top',
      repair: 'region_lock→top_from_high_bottom',
    };
  }
  const subtype = classifyBottomSubtype(bbox, opts);
  if (subtype === 'shorts') {
    return {
      category: 'bottoms',
      subcategory: 'shorts',
      name: 'Shorts',
      repair: 'region_lock→shorts',
    };
  }
  return {
    category: 'bottoms',
    subcategory: 'trousers',
    name: 'Trousers',
    repair: 'region_lock→trousers',
  };
}

/** Display label: "Red top", "Dark shorts", UK "White trainers". */
export function formatGarmentDisplayName(args: {
  color?: string | null;
  category: string;
  subcategory?: string | null;
  fallbackName?: string | null;
}): string {
  const fallback = String(args.fallbackName || '').trim();
  // Preserve specific vision labels — never rebuild "Gray Sweatpants" → "Dark trousers"
  if (
    fallback.length >= 4
    && /\s/.test(fallback)
    && /[a-z]/i.test(fallback)
    && !/^(top|item|bottom|shoes?|garment)$/i.test(fallback)
  ) {
    return polishUkLiveLabel(fallback);
  }

  const color = String(args.color || '').trim().toLowerCase();
  const sub = String(args.subcategory || '').toLowerCase();
  const cat = String(args.category || '').toLowerCase();
  let kind = 'item';
  // Dress shirt before dress — "Light Pink dress shirt" must not become "Light Pink dress"
  if (/dress[\s_-]*shirt|shirt[\s_-]*dress|oxford[\s_-]*shirt|button[\s_-]?down|button[\s_-]?up/.test(`${cat} ${sub} ${fallback}`)
    && !/\b(maxi|midi|mini)\s*dress\b/.test(`${sub} ${fallback}`)) {
    kind = 'top';
  }
  else if (/short/.test(sub) || /short/.test(cat)) kind = 'shorts';
  else if (/\bdress\b/.test(sub) || cat === 'dresses' || cat === 'dress') kind = 'dress';
  else if (/sweatpant/.test(sub)) kind = 'sweatpants';
  else if (/jogger|track\s*pant/.test(sub)) kind = 'joggers';
  else if (/chino/.test(sub) || /trouser|jean|pant/.test(sub) || /trouser|jean|pant/.test(cat)) kind = 'trousers';
  else if (/skirt/.test(sub)) kind = 'skirt';
  else if (/flip.?flop|thong/.test(sub)) kind = localizedShoeKind('flip_flops');
  else if (/\bslides?\b/.test(sub)) kind = localizedShoeKind('slides');
  else if (/sandal/.test(sub)) kind = localizedShoeKind('sandals');
  else if (/boat/.test(sub)) kind = 'boat shoes';
  else if (/\bboots?\b/.test(sub) || /chelsea/.test(sub)) kind = localizedShoeKind('boots');
  else if (/sneaker|trainer/.test(sub)) kind = localizedShoeKind('sneakers');
  else if (/shoe|boot|sneaker|sandal|trainer|flip|slide|boat|loafer|oxford|chelsea/.test(sub) || cat === 'shoes') {
    kind = localizedShoeKind(sub || 'sneakers');
  }
  else if (/outer|blazer|jacket|coat/.test(sub) || cat === 'outerwear') kind = 'jacket';
  else if (/top|shirt|tee|polo|knit|sweater|blouse/.test(`${cat} ${sub}`)) kind = 'top';
  else if (fallback) return fallback;

  const prettyColor = color && color !== 'other' && color !== 'unknown'
    ? color.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  // Vision names arrive title-cased ("Pink Flower Sandals"), so rebuilt names
  // must match or the same card shows "Blue shorts" beside "Pink Flower Sandals".
  const prettyKind = kind.replace(/\b\w/g, (c) => c.toUpperCase());
  if (prettyColor) {
    // True black bottoms → "Dark". Mid grey chinos stay "Grey" (not Dark).
    // Footwear keeps Grey distinct (flip-flops must not become "Black …")
    const tone =
      /^(black|charcoal)$/.test(color) && (kind === 'shorts' || kind === 'trousers')
        ? 'Dark'
        : /^(gray|grey)$/.test(color)
          ? 'Grey'
          : prettyColor;
    return `${tone} ${prettyKind}`;
  }
  return prettyKind;
}

/**
 * Bare-foot / skin-dominated boxes must never become shoes.
 */
export function isBareFootLikeFootwear(bbox: BBoxTuple, skinRatio: number): boolean {
  if (skinRatio >= 0.22 && (isHardFootwear(bbox) || bbox[1] + bbox[3] > 0.88)) {
    return true;
  }
  return false;
}

/** True when detections never reach the floor — feet likely out of frame. */
export function feetLikelyCropped(bboxes: BBoxTuple[]): boolean {
  if (!bboxes.length) return true;
  const maxBottom = Math.max(...bboxes.map((b) => b[1] + b[3]));
  return maxBottom < REGION.FOOTWEAR_MIN;
}

/** True footwear visible near the floor of the frame. */
export function isFullBodyFrame(detections: Array<{
  category?: string;
  subcategory?: string;
  bbox: BBoxTuple;
}>): boolean {
  return detections.some((d) => {
    const bottom = d.bbox[1] + d.bbox[3];
    return isHardFootwear(d.bbox) && bottom > 0.9;
  });
}

/**
 * Frame incompleteness — cropped mirror selfies where feet are off-screen.
 * Prefer bottom-band brightness when available (garment boxes alone mislead after shorts clip).
 */
export function isCroppedFrame(
  detections: Array<{
    category?: string;
    subcategory?: string;
    bbox: BBoxTuple;
  }>,
  opts?: { bottomBandBrightness?: number | null },
): boolean {
  if (opts?.bottomBandBrightness != null && Number.isFinite(opts.bottomBandBrightness)) {
    return opts.bottomBandBrightness < 0.1;
  }
  if (!detections.length) return true;
  if (isFullBodyFrame(detections)) return false;
  const maxBottom = Math.max(...detections.map((d) => d.bbox[1] + d.bbox[3]));
  if (maxBottom >= REGION.FOOTWEAR_MIN) return false;
  if (detections.some((d) => isHardFootwear(d.bbox))) return false;
  return feetLikelyCropped(detections.map((d) => d.bbox));
}

export type FrameCompleteness = {
  cropped: boolean;
  fullBody: boolean;
  maxBottom: number;
};

export function assessFrameCompleteness(bboxes: BBoxTuple[]): FrameCompleteness {
  const maxBottom = bboxes.length
    ? Math.max(...bboxes.map((b) => b[1] + b[3]))
    : 0;
  const cropped = !bboxes.length || maxBottom < REGION.FOOTWEAR_MIN;
  return { cropped, fullBody: !cropped && maxBottom > 0.9, maxBottom };
}

/** Mean luminance of the bottom band of the frame (foot zone). */
export function measureBottomBandBrightness(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts?: { yStart?: number },
): number {
  const yStart = Math.max(0, Math.min(1, opts?.yStart ?? 0.88));
  const y0 = Math.floor(yStart * height);
  if (width <= 0 || height <= 0 || y0 >= height) return 0;
  let sum = 0;
  let n = 0;
  const stepX = Math.max(1, Math.floor(width / 24));
  const stepY = Math.max(1, Math.floor((height - y0) / 8));
  for (let y = y0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      const r = rgba[i] ?? 0;
      const g = rgba[i + 1] ?? 0;
      const b = rgba[i + 2] ?? 0;
      sum += (r + g + b) / (3 * 255);
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

export function isSkinPixel(r: number, g: number, b: number): boolean {
  // Classic lighter-skin rule
  const light =
    r > 95
    && g > 40
    && b > 20
    && Math.max(r, g, b) - Math.min(r, g, b) > 15
    && Math.abs(r - g) > 15
    && r > g
    && r > b;
  if (light) return true;

  // Darker skin (Fitzpatrick IV–VI): lower luma, R still leads, modest chroma
  const darker =
    r >= 40
    && r <= 170
    && g >= 20
    && b >= 12
    && r >= g
    && g >= b - 8
    && (r - b) >= 8
    && (r - g) <= 55
    && (g - b) <= 40
    && Math.max(r, g, b) - Math.min(r, g, b) >= 8;
  if (darker) return true;

  // Deep / very dark skin — still warm-leaning, low absolute channels
  const deep =
    r >= 22
    && r <= 95
    && g >= 12
    && b >= 6
    && r >= g - 2
    && g >= b - 10
    && (r - b) >= 4
    && (r - g) <= 40
    && Math.max(r, g, b) - Math.min(r, g, b) >= 4;
  if (deep) return true;

  // Mid / olive tones
  const mid =
    r > 70
    && g > 35
    && b > 18
    && r >= g - 5
    && r > b
    && (r - b) > 12
    && Math.abs(r - g) < 45;
  return mid;
}

/** Fraction of ROI samples that look like skin (0–1). */
export function measureSkinRatio(
  rgba: Uint8Array,
  width: number,
  height: number,
  bbox: BBoxTuple,
): number {
  const [nx, ny, nw, nh] = bbox;
  const x0 = Math.max(0, Math.floor(nx * width));
  const y0 = Math.max(0, Math.floor(ny * height));
  const x1 = Math.min(width, Math.ceil((nx + nw) * width));
  const y1 = Math.min(height, Math.ceil((ny + nh) * height));
  if (x1 <= x0 || y1 <= y0) return 0;

  const mx0 = x0 + Math.floor((x1 - x0) * 0.15);
  const mx1 = x1 - Math.floor((x1 - x0) * 0.15);
  const my0 = y0 + Math.floor((y1 - y0) * 0.15);
  const my1 = y1 - Math.floor((y1 - y0) * 0.15);
  const sx0 = mx1 > mx0 ? mx0 : x0;
  const sx1 = mx1 > mx0 ? mx1 : x1;
  const sy0 = my1 > my0 ? my0 : y0;
  const sy1 = my1 > my0 ? my1 : y1;

  let skin = 0;
  let n = 0;
  const stepX = Math.max(1, Math.floor((sx1 - sx0) / 14));
  const stepY = Math.max(1, Math.floor((sy1 - sy0) / 14));
  for (let y = sy0; y < sy1; y += stepY) {
    for (let x = sx0; x < sx1; x += stepX) {
      const i = (y * width + x) * 4;
      const r = rgba[i] ?? 0;
      const g = rgba[i + 1] ?? 0;
      const b = rgba[i + 2] ?? 0;
      if (isSkinPixel(r, g, b)) skin += 1;
      n += 1;
    }
  }
  return n ? skin / n : 0;
}

/** Skin ratio in the lower 40% of a bbox — detects bare legs under shorts. */
export function measureLowerSkinRatio(
  rgba: Uint8Array,
  width: number,
  height: number,
  bbox: BBoxTuple,
): number {
  const [nx, ny, nw, nh] = bbox;
  const lower: BBoxTuple = [nx, ny + nh * 0.55, nw, nh * 0.45];
  return measureSkinRatio(rgba, width, height, lower);
}

export const SKIN_DISCARD_RATIO = 0.4;
/** Tops/outerwear: lower threshold — bare torso must not become a locked "Top". */
export const BARE_TORSO_SKIN_RATIO = 0.22;

export function hasReliableFabricColor(color?: string | null): boolean {
  const c = String(color || '').toLowerCase().trim();
  if (!c) return false;
  return !/^(other|unknown|none|n\/a|-)$/.test(c);
}

/**
 * Bare chest / arms boxed as Clothing→Top. Discard when ROI is skin-heavy
 * or lacks a real fabric colour (colour pipeline skips skin → other/unknown).
 * Fabric colour matters more than skin ratio — deep skin often undercounts.
 */
export function isBareTorsoTopLike(args: {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
  skinRatio?: number | null;
  fabricColor?: string | null;
}): boolean {
  const cat = `${args.category || ''} ${args.subcategory || ''} ${args.name || ''}`.toLowerCase();
  const isTopLike = /top|shirt|tee|polo|blouse|knit|sweater|outer|blazer|jacket|coat|vest|gilet|clothing|dress/.test(cat)
    && !/bottom|trouser|short|skirt|pant|shoe|boot|bag/.test(cat);
  if (!isTopLike) return false;
  const named = String(args.name || '').trim();
  const specificNamed =
    named.length >= 4
    && /\s/.test(named)
    && /[a-z]/i.test(named)
    && !/^(top|item|bottom|shoes?|garment)$/i.test(named);
  // Named garment with a real fabric colour is never "bare chest"
  if (specificNamed && hasReliableFabricColor(args.fabricColor)) return false;
  const skin = args.skinRatio;
  if (skin != null && skin >= BARE_TORSO_SKIN_RATIO) return true;
  // Missing fabric colour alone is not enough — blue tees often lose colour under
  // mirror glare; only discard when skin is also elevated (likely bare chest).
  if (!hasReliableFabricColor(args.fabricColor) && skin != null && skin >= 0.12) return true;
  return false;
}

export type TorsoState = 'covered' | 'bare' | 'uncertain';

/**
 * Structural torso state (upstream truth) — not just a discard filter.
 * Used so belief can hard-clear ghost tops when the chest is bare.
 */
export function detectTorsoState(args: {
  topDetections?: Array<{
    category?: string | null;
    subcategory?: string | null;
    name?: string | null;
    skinRatio?: number | null;
    color?: string | null;
  }> | null;
  hasFabricTop?: boolean;
}): TorsoState {
  const tops = Array.isArray(args.topDetections) ? args.topDetections : [];
  if (args.hasFabricTop) return 'covered';

  if (tops.length === 0) return 'uncertain';

  const bareHits = tops.filter((t) => isBareTorsoTopLike({
    category: t.category,
    subcategory: t.subcategory,
    name: t.name,
    skinRatio: t.skinRatio,
    fabricColor: t.color,
  }));
  if (bareHits.length > 0 && bareHits.length >= tops.length) return 'bare';

  const covered = tops.some((t) => hasReliableFabricColor(t.color)
    && (t.skinRatio == null || t.skinRatio < BARE_TORSO_SKIN_RATIO));
  if (covered) return 'covered';

  if (bareHits.length > 0) return 'bare';
  return 'uncertain';
}

function isFootwearCat(category: string, subcategory?: string): boolean {
  return /shoe|boot|sneaker|loafer|footwear|heel|sandal|mule|oxford/i.test(
    `${category || ''} ${subcategory || ''}`,
  );
}

function isBottomCat(category: string): boolean {
  return /bottom|trouser|jean|short|skirt|pant/i.test(String(category || ''));
}

function isOuterCat(category: string): boolean {
  return /outer|blazer|jacket|coat|vest|gilet/i.test(String(category || ''));
}

function isDressCat(category: string): boolean {
  return /dress/i.test(String(category || ''));
}

function isTopCat(category: string): boolean {
  // Tops only — outerwear/dress are separate roles so jacket+dress can coexist.
  return /top|shirt|polo|blouse|knit|sweater/i.test(String(category || ''))
    && !isOuterCat(category)
    && !isDressCat(category);
}

/** Floor-length column from upper torso → dress, not trousers. */
export function looksLikeDress(bbox: BBoxTuple): boolean {
  const [, y, , h] = bbox;
  const bottom = y + h;
  // Must start near shoulders (not waist) so trousers/joggers aren't re-read as dresses.
  return y <= 0.30 && bottom >= 0.88 && h >= 0.60;
}

/** Short/wide upper box or explicit jacket prior → outerwear. */
export function looksLikeJacket(
  bbox: BBoxTuple,
  opts?: { yoloCategory?: string | null; yoloSubcategory?: string | null; visionCategory?: string | null; fabricColor?: string | null },
): boolean {
  const yoloBlob = `${opts?.yoloCategory || ''} ${opts?.yoloSubcategory || ''}`;
  const vision = String(opts?.visionCategory || '');
  if (/outer|jacket|blazer|coat|denim/i.test(`${yoloBlob} ${vision}`)) return true;
  const [, , w, h] = bbox;
  const aspect = h / Math.max(w, 1e-6);
  const jacketShape = h < 0.48 && w > 0.22 && aspect < 1.4;
  const denimTone = /blue|denim|indigo/i.test(String(opts?.fabricColor || ''));
  return jacketShape && (denimTone || /outer|jacket/i.test(yoloBlob));
}

/**
 * REGION lock first — impossible outfit interpretations are rejected.
 * Vision may refine within the allowed band; YOLO is only a weak prior.
 */
export function resolveClassByRegionLock(args: {
  bbox: BBoxTuple;
  yoloCategory?: string | null;
  yoloSubcategory?: string | null;
  visionCategory?: string | null;
  visionConfidence?: number | null;
  lowerSkinRatio?: number | null;
  fabricColor?: string | null;
}): RegionLockedLabel {
  const region = getStrictBodyRegion(args.bbox);
  const yolo = String(args.yoloCategory || '');
  const vision = String(args.visionCategory || '');
  const vConf = Number(args.visionConfidence ?? 0);
  const bottomOpts = { lowerSkinRatio: args.lowerSkinRatio, fabricColor: args.fabricColor };
  const jacketOpts = {
    yoloCategory: args.yoloCategory,
    yoloSubcategory: args.yoloSubcategory,
    visionCategory: args.visionCategory,
    fabricColor: args.fabricColor,
  };

  // 1) Hard footwear — trainers OR mid-calf boots at the floor
  if (isHardFootwear(args.bbox)) {
    const [, , , h] = args.bbox;
    const sub = h >= 0.14 ? 'boots' : 'shoes';
    return {
      category: 'shoes',
      subcategory: sub,
      name: h >= 0.14 ? 'Boots' : 'Shoes',
      repair: 'region_lock→footwear',
    };
  }

  // Full-body dress column (before region splits jacket vs hem)
  if (looksLikeDress(args.bbox) && !looksLikeJacket(args.bbox, jacketOpts)) {
    return {
      category: 'dresses',
      subcategory: 'maxi_dress',
      name: 'Maxi dress',
      repair: 'region_lock→dress',
    };
  }

  // 2) Region locks
  if (region === 'top') {
    if (looksLikeJacket(args.bbox, jacketOpts)) {
      return {
        category: 'outerwear',
        subcategory: 'jacket',
        name: 'Jacket',
        repair: 'region_lock→outerwear',
      };
    }
    return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'region_lock→top' };
  }
  if (region === 'bottom') {
    if (looksLikeDress(args.bbox)) {
      return {
        category: 'dresses',
        subcategory: 'maxi_dress',
        name: 'Maxi dress',
        repair: 'region_lock→dress',
      };
    }
    return bottomsLabel(args.bbox, bottomOpts);
  }
  if (region === 'footwear') {
    // Shin/boot shaft in footwear band → shoes, not trousers
    const [, y, w, h] = args.bbox;
    const bottom = y + h;
    if (bottom >= 0.88 && h < 0.30 && w < 0.45) {
      return {
        category: 'shoes',
        subcategory: h >= 0.14 ? 'boots' : 'shoes',
        name: h >= 0.14 ? 'Boots' : 'Shoes',
        repair: 'region_lock→boot_shaft',
      };
    }
    if (looksLikeDress(args.bbox)) {
      return {
        category: 'dresses',
        subcategory: 'maxi_dress',
        name: 'Maxi dress',
        repair: 'region_lock→dress',
      };
    }
    return bottomsLabel(args.bbox, bottomOpts);
  }

  // 3) Transition zone (0.42–0.55): never shoes; prefer tops unless clearly tall bottoms
  if (isFootwearCat(yolo) || isFootwearCat(vision)) {
    return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'transition_block_shoes→tops' };
  }
  if (looksLikeJacket(args.bbox, jacketOpts)) {
    return {
      category: 'outerwear',
      subcategory: 'jacket',
      name: 'Jacket',
      repair: 'transition→outerwear',
    };
  }
  const h = args.bbox[3];
  const cy = centerY(args.bbox);
  const clearlyBottom = (isBottomCat(yolo) || isBottomCat(vision)) && h > 0.32 && cy >= 0.48;
  if (clearlyBottom) {
    return bottomsLabel(args.bbox, bottomOpts);
  }

  // Vision within transition if confident and not impossible
  if (vConf >= 0.7 && vision) {
    if (isOuterCat(vision) || /outer|blazer|jacket/i.test(vision)) {
      return {
        category: 'outerwear',
        subcategory: /blazer/i.test(vision) ? 'blazer' : 'jacket',
        name: /blazer/i.test(vision) ? 'Blazer' : 'Jacket',
        repair: 'transition_vision',
      };
    }
    if (isDressCat(vision)) {
      return {
        category: 'dresses',
        subcategory: 'dress',
        name: 'Dress',
        repair: 'transition_vision→dress',
      };
    }
    if (isTopCat(vision)) {
      return {
        category: 'tops',
        subcategory: 'top',
        name: 'Top',
        repair: 'transition_vision',
      };
    }
  }

  if (isTopCat(yolo) || isOuterCat(yolo) || !yolo) {
    return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'transition→tops' };
  }
  if (isBottomCat(yolo)) {
    return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'transition_block_bottoms→tops' };
  }
  return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'transition_default→tops' };
}

/** IoU of two normalized [x,y,w,h] boxes. */
export function bboxIou(a: BBoxTuple, b: BBoxTuple): number {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const uni = a[2] * a[3] + b[2] * b[3] - inter;
  return uni <= 0 ? 0 : inter / uni;
}

/**
 * Conflict resolution: IoU > 0.6 → keep higher confidence **only for same role**;
 * different roles (top vs bottoms) can overlap at the waist without dropping the top.
 * Same strict region + same role → keep largest.
 */
export function resolveDetectionConflicts<T extends {
  bbox: BBoxTuple;
  confidence: number;
  category: string;
}>(dets: T[], opts?: { max?: number }): T[] {
  const max = opts?.max ?? 6;
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const kept: T[] = [];

  for (const d of sorted) {
    const overlap = kept.find(
      (k) => bboxIou(k.bbox, d.bbox) > 0.6 && sameRole(k.category, d.category),
    );
    if (overlap) continue; // higher confidence already kept for this role

    const region = getStrictBodyRegion(d.bbox);
    const sameRegion = kept.find((k) => getStrictBodyRegion(k.bbox) === region
      && sameRole(k.category, d.category));
    if (sameRegion) {
      if (area(d.bbox) > area(sameRegion.bbox)) {
        const idx = kept.indexOf(sameRegion);
        kept[idx] = d;
      }
      continue;
    }
    kept.push(d);
    if (kept.length >= max) break;
  }
  return kept;
}

function sameRole(a: string, b: string): boolean {
  const role = (c: string) => {
    if (isFootwearCat(c)) return 'shoes';
    if (isDressCat(c)) return 'dress';
    if (isOuterCat(c)) return 'outerwear';
    if (isBottomCat(c)) return 'bottoms';
    if (isTopCat(c)) return 'tops';
    return c;
  };
  return role(a) === role(b);
}

/** Color priority — red last (skin/warm light bias). High chroma ≠ beige. */
export function classifyColorFromRgb(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  if (max < 40) return 'black';
  if (min > 210) return 'white';

  // Saturated hues first — never collapse blue/teal into beige
  if (chroma > 55) {
    if (
      b > r + 12
      && g > r + 12
      && Math.abs(g - b) < 55
      && Math.max(g, b) > 90
    ) {
      return g > b + 18 ? 'green' : 'blue';
    }
    if (b > r + 25 && b > g + 20) return max < 110 ? 'navy' : 'blue';
    if (g > r + 18 && g > b + 15 && r > 45 && max < 170) return 'green';
    if (g > r + 25 && g > b + 20) return 'green';
    if (r > 150 && g > 120 && b < 90) return 'mustard';
    if (r > 160 && g > 100 && b < 100 && chroma > 50) return 'orange';
    if (r > 140 && g < 100 && b > 120) return 'purple';
    if (r > g + 45 && r > b + 45 && chroma > 60) return r > 160 ? 'red' : 'burgundy';
    // High saturation: refuse beige/cream fallback
  }

  // white / cream / beige only when low-mid chroma (unsaturated)
  // Bright + slightly warm → cream/beige (jacket fabric), not pure white.
  if (chroma < 45 && min > 175 && r >= g - 5 && g >= b - 10) {
    if (r - b > 10) return 'cream';
    if (r - b > 4 || (r > g && r - b >= 2)) return 'beige';
    return 'white';
  }
  if (chroma <= 55 && r >= g - 10 && g >= b - 5 && min > 105 && r - b < 60 && r - g < 40) {
    if (min > 155) return 'cream';
    if (min > 115) return 'beige';
  }

  // greys
  if (chroma < 35) {
    if (max < 90) return 'charcoal';
    if (max < 145) return 'gray';
    if (min > 170) return 'white';
    return 'light gray';
  }

  if (max < 55) return 'black';

  // teal / cyan / turquoise
  if (
    chroma > 30
    && b > r + 12
    && g > r + 12
    && Math.abs(g - b) < 55
    && Math.max(g, b) > 90
  ) {
    return g > b + 18 ? 'green' : 'blue';
  }

  if (b > r + 25 && b > g + 20) return max < 110 ? 'navy' : 'blue';
  if (g > r + 18 && g > b + 15 && r > 45 && max < 170) return 'green';
  if (g > r + 25 && g > b + 20) return 'green';

  if (r > 150 && g > 120 && b < 90) return 'mustard';
  if (r > 160 && g > 100 && b < 100 && chroma > 50) return 'orange';
  if (r > 140 && g < 100 && b > 120) return 'purple';

  if (r > g + 45 && r > b + 45 && chroma > 60) return r > 160 ? 'red' : 'burgundy';

  // Low-chroma warm neutrals only
  if (chroma < 45 && r > 150 && g > 130 && b > 100) return 'beige';
  return 'other';
}
