/**
 * Hard body-geometry guardrails for Live / on-device detection.
 *
 * Authority: REGION (hard) → SHAPE → VISION → YOLO (weak).
 * Soft heuristics alone caused tops↔trousers↔shoes cascades.
 */

import { localizedShoeKind } from '@/utils/liveLocaleLabels';

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
 * HARD footwear — must look like a shoe at the floor, not a bare foot / hem.
 * Skin dominance is checked separately via isValidShoe / detector path.
 */
export function isHardFootwear(bbox: BBoxTuple): boolean {
  const [, y, w, h] = bbox;
  const cy = centerY(bbox);
  const bottom = y + h;
  if (h >= 0.20) return false;
  if (w <= h) return false; // shoes are wider than tall
  if (w >= 0.38) return false;
  if (bottom < 0.90) return false;
  if (cy < 0.82) return false;
  if (aspectHW(bbox) >= 1.0) return false;
  return area(bbox) <= 0.10;
}

/** Shoe only if geometry passes AND ROI is not skin-dominant. */
export function isValidShoe(bbox: BBoxTuple, skinRatio?: number | null): boolean {
  if (!isHardFootwear(bbox)) return false;
  if (skinRatio == null) return false;
  if (skinRatio >= 0.22) return false;
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
 * Shorts often get a YOLO box that includes bare legs down to the floor.
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

/** Clip a shorts box so the overlay ends near the hem, not the feet. */
export function clipShortsBbox(bbox: BBoxTuple): BBoxTuple {
  const [x, y, w, h] = bbox;
  const bottom = y + h;
  if (bottom <= 0.82) return bbox;
  const clippedH = Math.max(0.18, Math.min(h, 0.78 - y));
  return [x, y, w, clippedH];
}

/**
 * Tall floor-reaching bottom = trousers evidence (overrides a locked “shorts” mistake).
 * Hard lock: bottom edge past 0.92 → always trousers (geometry > skin).
 */
export function isFloorLengthTrousersEvidence(bbox: BBoxTuple): boolean {
  const [, , , h] = bbox;
  const bottom = bbox[1] + h;
  if (bottom > 0.92) return true;
  return h >= 0.38 && bottom >= 0.84;
}

/**
 * Structural bottoms classifier.
 * Floor-length trousers with visible ankles must NOT become shorts.
 */
export function classifyBottomSubtype(
  bbox: BBoxTuple,
  opts?: { lowerSkinRatio?: number | null; fabricColor?: string | null },
): BottomSubtype {
  const [, y, , h] = bbox;
  const bottom = y + h;
  const lowerSkin = opts?.lowerSkinRatio;
  const legBleed = hasLegBleedBelowHem(bbox, lowerSkin);
  const fabric = String(opts?.fabricColor || '').toLowerCase();
  const solidFabric = /gray|grey|black|navy|blue|charcoal|beige|khaki|cream|white|brown|green/.test(fabric);

  // Absolute geometry lock — floor contact cannot become shorts
  // Exception: mid-body start + extreme lower skin = shorts box that includes bare legs
  if (bottom > 0.92) {
    if (legBleed && lowerSkin != null && lowerSkin >= 0.42 && y >= 0.48) {
      return 'shorts';
    }
    return 'trousers';
  }

  // Solid fabric colour + long box → trousers (carpet/ankle skin must not win)
  if (solidFabric && isFloorLengthTrousersEvidence(bbox)) {
    return 'trousers';
  }

  // Full-length bottoms first: tall box deep into the frame = trousers
  // Ankle/foot skin under trousers is normal when barefoot — do not flip to shorts
  if (h >= 0.40 && bottom >= 0.85) {
    // Shorts + bare legs: box starts mid-body and lower half is very skin-heavy
    if (legBleed && lowerSkin != null && lowerSkin >= 0.42 && y >= 0.48 && !solidFabric) {
      return 'shorts';
    }
    return 'trousers';
  }
  if (h >= 0.42 && bottom >= 0.82 && (lowerSkin == null || lowerSkin < 0.4)) {
    return 'trousers';
  }

  if (legBleed && h < 0.42) return 'shorts';

  // Clear mid-thigh ending → shorts
  if (bottom < 0.82 && h < 0.36) return 'shorts';
  if (bottom < 0.80 && h < 0.40) return 'shorts';

  // True floor-length fabric
  if (isFloorTouching(bbox) && h >= 0.36 && (lowerSkin == null || lowerSkin < 0.35)) {
    return 'trousers';
  }

  // Ambiguous short ROI
  if (y >= 0.45 && y <= 0.62 && h < 0.38 && bottom < 0.88) return 'shorts';

  return 'trousers';
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
  const color = String(args.color || '').trim().toLowerCase();
  const sub = String(args.subcategory || '').toLowerCase();
  const cat = String(args.category || '').toLowerCase();
  let kind = 'item';
  if (/short/.test(sub) || /short/.test(cat)) kind = 'shorts';
  else if (/trouser|jean|pant/.test(sub) || /trouser|jean|pant/.test(cat)) kind = 'trousers';
  else if (/skirt/.test(sub)) kind = 'skirt';
  else if (/sandal/.test(sub)) kind = localizedShoeKind('sandals');
  else if (/boot/.test(sub)) kind = localizedShoeKind('boots');
  else if (/sneaker|trainer/.test(sub)) kind = localizedShoeKind('sneakers');
  else if (/shoe|boot|sneaker|sandal|trainer/.test(sub) || cat === 'shoes') {
    kind = localizedShoeKind(sub || 'sneakers');
  }
  else if (/outer|blazer|jacket|coat/.test(sub) || cat === 'outerwear') kind = 'jacket';
  else if (/top|shirt|tee|polo|knit|sweater|blouse|dress/.test(`${cat} ${sub}`)) kind = 'top';
  else if (args.fallbackName) return String(args.fallbackName);

  const prettyColor = color && color !== 'other' && color !== 'unknown'
    ? color.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  if (prettyColor) {
    // All dark-family bottoms display as "Dark" — no grey↔dark flicker
    const tone =
      /^(black|charcoal|gray|grey)$/.test(color) && (kind === 'shorts' || kind === 'trousers')
        ? 'Dark'
        : prettyColor;
    return `${tone} ${kind}`;
  }
  return kind[0].toUpperCase() + kind.slice(1);
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

function isFootwearCat(category: string, subcategory?: string): boolean {
  return /shoe|boot|sneaker|loafer|footwear|heel|sandal|mule|oxford/i.test(
    `${category || ''} ${subcategory || ''}`,
  );
}

function isBottomCat(category: string): boolean {
  return /bottom|trouser|jean|short|skirt|pant/i.test(String(category || ''));
}

function isTopCat(category: string): boolean {
  return /top|shirt|polo|blouse|knit|sweater|outer|blazer|jacket|coat|vest|gilet|dress/i.test(
    String(category || ''),
  );
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

  // 1) Hard footwear — only tiny floor-touching boxes
  if (isHardFootwear(args.bbox)) {
    return { category: 'shoes', subcategory: 'shoes', name: 'Shoes', repair: 'region_lock→footwear' };
  }

  // 2) Region locks
  if (region === 'top') {
    return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'region_lock→top' };
  }
  if (region === 'bottom') {
    return bottomsLabel(args.bbox, bottomOpts);
  }
  if (region === 'footwear') {
    return bottomsLabel(args.bbox, bottomOpts);
  }

  // 3) Transition zone (0.42–0.55): never shoes; prefer tops unless clearly tall bottoms
  if (isFootwearCat(yolo) || isFootwearCat(vision)) {
    return { category: 'tops', subcategory: 'top', name: 'Top', repair: 'transition_block_shoes→tops' };
  }
  const h = args.bbox[3];
  const cy = centerY(args.bbox);
  const clearlyBottom = (isBottomCat(yolo) || isBottomCat(vision)) && h > 0.32 && cy >= 0.48;
  if (clearlyBottom) {
    return bottomsLabel(args.bbox, bottomOpts);
  }

  // Vision within transition if confident and not impossible
  if (vConf >= 0.7 && vision) {
    if (isTopCat(vision) || /outer|blazer|jacket/i.test(vision)) {
      return {
        category: /outer|blazer|jacket|coat|vest/i.test(vision) ? 'outerwear' : 'tops',
        subcategory: /blazer/i.test(vision) ? 'blazer' : 'top',
        name: /blazer/i.test(vision) ? 'Blazer' : 'Top',
        repair: 'transition_vision',
      };
    }
  }

  if (isTopCat(yolo) || !yolo) {
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
    if (isBottomCat(c)) return 'bottoms';
    if (isTopCat(c)) return 'tops';
    return c;
  };
  return role(a) === role(b);
}

/** Color priority — red last (skin/warm light bias). */
export function classifyColorFromRgb(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  if (max < 40) return 'black';
  if (min > 210) return 'white';

  // white / cream / beige first
  if (min > 175 && chroma < 40 && r >= g - 5 && g >= b - 10) {
    if (r - b > 12) return 'cream';
    if (r - b > 6) return 'beige';
    return 'white';
  }
  if (r >= g - 10 && g >= b - 5 && min > 105 && chroma < 85 && r - b < 60 && r - g < 40) {
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

  // teal / cyan / turquoise — G and B both high (was falling through to "other")
  if (
    chroma > 30
    && b > r + 12
    && g > r + 12
    && Math.abs(g - b) < 55
    && Math.max(g, b) > 90
  ) {
    return g > b + 18 ? 'green' : 'blue';
  }

  // blue / green before red
  if (b > r + 25 && b > g + 20) return max < 110 ? 'navy' : 'blue';
  if (g > r + 18 && g > b + 15 && r > 45 && max < 170) return 'green';
  if (g > r + 25 && g > b + 20) return 'green';

  if (r > 150 && g > 120 && b < 90) return 'mustard';
  if (r > 160 && g > 100 && b < 100 && chroma > 50) return 'orange';
  if (r > 140 && g < 100 && b > 120) return 'purple';

  // red LAST — needs strong chroma
  if (r > g + 45 && r > b + 45 && chroma > 60) return r > 160 ? 'red' : 'burgundy';

  if (r > 150 && g > 130 && b > 100) return 'beige';
  return 'other';
}
