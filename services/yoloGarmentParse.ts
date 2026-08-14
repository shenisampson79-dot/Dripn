/**
 * YOLOv8 detect post-process for the bundled garment TFLite
 * (kesimeg/yolov8n-clothing-detection @ imgsz=320).
 *
 * Output tensor: [1, 8, 2100] = 4 box channels (cx,cy,w,h in pixels) + 4 classes.
 * Classes: Clothing, Shoes, Bags, Accessories.
 */

export type YoloClassId = 0 | 1 | 2 | 3;

export const YOLO_GARMENT_CLASS_NAMES = [
  'Clothing',
  'Shoes',
  'Bags',
  'Accessories',
] as const;

export type ParsedYoloBox = {
  classId: YoloClassId;
  className: string;
  confidence: number;
  /** Normalized [x, y, w, h] top-left, relative to letterboxed 320 canvas. */
  bbox: [number, number, number, number];
};

const NUM_CLASSES = 4;
const NUM_CHANNELS = 4 + NUM_CLASSES;

function iou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
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

function nms(boxes: ParsedYoloBox[], iouThresh: number): ParsedYoloBox[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept: ParsedYoloBox[] = [];
  for (const box of sorted) {
    let ok = true;
    for (const k of kept) {
      if (iou(box.bbox, k.bbox) > iouThresh) {
        ok = false;
        break;
      }
    }
    if (ok) kept.push(box);
  }
  return kept;
}

/**
 * Parse raw TFLite output [1, 8, N] float32 into boxes on the 320 canvas,
 * then map into original image normalized coords using letterbox meta.
 */
export function parseYoloGarmentOutput(
  output: Float32Array,
  opts: {
    inputSize?: number;
    confThreshold?: number;
    iouThreshold?: number;
    maxDetections?: number;
    /** Letterbox scale applied when building the 320 tensor. */
    scale: number;
    padX: number;
    padY: number;
    srcWidth: number;
    srcHeight: number;
  },
): ParsedYoloBox[] {
  const inputSize = opts.inputSize ?? 320;
  const confThreshold = opts.confThreshold ?? 0.28;
  const iouThreshold = opts.iouThreshold ?? 0.45;
  const maxDetections = opts.maxDetections ?? 8;

  const channels = NUM_CHANNELS;
  const numPred = Math.floor(output.length / channels);
  if (numPred < 1) return [];

  // Layout: [1, 8, N] → index = c * N + i
  const raw: ParsedYoloBox[] = [];
  for (let i = 0; i < numPred; i++) {
    let bestCls = 0;
    let bestScore = -1;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = output[(4 + c) * numPred + i] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestCls = c;
      }
    }
    if (bestScore < confThreshold) continue;

    const cx = output[0 * numPred + i] ?? 0;
    const cy = output[1 * numPred + i] ?? 0;
    const w = output[2 * numPred + i] ?? 0;
    const h = output[3 * numPred + i] ?? 0;

    // Pixel coords on the letterboxed 320 canvas → strip pad → original image.
    const x0 = (cx - w / 2 - opts.padX) / opts.scale;
    const y0 = (cy - h / 2 - opts.padY) / opts.scale;
    const bw = w / opts.scale;
    const bh = h / opts.scale;

    const nx = Math.max(0, Math.min(1, x0 / opts.srcWidth));
    const ny = Math.max(0, Math.min(1, y0 / opts.srcHeight));
    const nw = Math.max(0.01, Math.min(1 - nx, bw / opts.srcWidth));
    const nh = Math.max(0.01, Math.min(1 - ny, bh / opts.srcHeight));

    // Reject degenerate / canvas-edge noise.
    if (nw * nh < 0.002) continue;
    if (nx + nw > 1.02 || ny + nh > 1.02) continue;

    raw.push({
      classId: bestCls as YoloClassId,
      className: YOLO_GARMENT_CLASS_NAMES[bestCls] || 'Clothing',
      confidence: Math.max(0, Math.min(1, bestScore)),
      bbox: [nx, ny, nw, nh],
    });
  }

  return nms(raw, iouThreshold).slice(0, maxDetections);
}

/**
 * Detector-internal: confidence distribution BEFORE threshold / NMS / guards.
 * Used to distinguish "model output near zero" vs "filtered to empty".
 */
export function inspectYoloRawOutput(output: Float32Array): {
  numPred: number;
  channels: number;
  outputLength: number;
  maxScore: number;
  meanBestScore: number;
  above: { t05: number; t10: number; t15: number; t20: number; t28: number; t50: number };
  first8: number[];
  top3: Array<{ cls: number; score: number; i: number }>;
} {
  const channels = NUM_CHANNELS;
  const numPred = Math.floor(output.length / channels);
  const above = { t05: 0, t10: 0, t15: 0, t20: 0, t28: 0, t50: 0 };
  let maxScore = 0;
  let sumBest = 0;
  const top3: Array<{ cls: number; score: number; i: number }> = [];

  for (let i = 0; i < numPred; i++) {
    let bestCls = 0;
    let bestScore = -1;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = output[(4 + c) * numPred + i] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestCls = c;
      }
    }
    sumBest += Math.max(0, bestScore);
    if (bestScore > maxScore) maxScore = bestScore;
    if (bestScore >= 0.05) above.t05 += 1;
    if (bestScore >= 0.10) above.t10 += 1;
    if (bestScore >= 0.15) above.t15 += 1;
    if (bestScore >= 0.20) above.t20 += 1;
    if (bestScore >= 0.28) above.t28 += 1;
    if (bestScore >= 0.50) above.t50 += 1;

    if (bestScore > 0.01) {
      top3.push({ cls: bestCls, score: bestScore, i });
      top3.sort((a, b) => b.score - a.score);
      if (top3.length > 3) top3.length = 3;
    }
  }

  const first8: number[] = [];
  for (let i = 0; i < Math.min(8, output.length); i++) {
    first8.push(Number((output[i] ?? 0).toFixed(4)));
  }

  return {
    numPred,
    channels,
    outputLength: output.length,
    maxScore: Number(maxScore.toFixed(4)),
    meanBestScore: numPred > 0 ? Number((sumBest / numPred).toFixed(5)) : 0,
    above,
    first8,
    top3: top3.map((t) => ({
      cls: t.cls,
      score: Number(t.score.toFixed(4)),
      i: t.i,
    })),
  };
}

/**
 * Map YOLO clothing classes → Scan Wardrobe / live-frame categories.
 * "Clothing" is ambiguous — use bbox geometry as a coarse tops/bottoms/dress prior.
 *
 * Flat-laid garments are often misclassified as Bags by the 4-class model.
 * Remap large clothing-shaped blobs away from bags unless they look compact/bag-like.
 */
export function mapYoloClassToWardrobeCategory(
  classId: YoloClassId,
  bbox: [number, number, number, number],
): { category: string; subcategory: string; name: string } {
  const [, y, w, h] = bbox;
  const aspect = h / Math.max(w, 1e-6);
  const area = w * h;
  const cy = y + h / 2;

  if (classId === 1) {
    return { category: 'shoes', subcategory: 'shoes', name: 'Shoes' };
  }

  if (classId === 2) {
    // Flat-laid shirts/tops are often classed as Bags. Prefer clothing when shape is garment-like.
    // Tall / elongated (aspect > 1.3) almost never has bag handles in this model.
    if (aspect > 1.3 || area >= 0.22 || w >= 0.55) {
      return clothingGeometryToCategory(cy, aspect, h, w);
    }
    // Compact square-ish mid-size blob → keep as bag.
    const looksLikeBag = aspect >= 0.7 && aspect <= 1.3;
    if (!looksLikeBag) {
      return clothingGeometryToCategory(cy, aspect, h, w);
    }
    return { category: 'bags', subcategory: 'bag', name: 'Bag' };
  }

  if (classId === 3) {
    return { category: 'accessories', subcategory: 'accessory', name: 'Accessory' };
  }

  return clothingGeometryToCategory(cy, aspect, h, w);
}

/**
 * True only for short, floor-anchored foot boxes in the footwear region.
 * Delegates to hard guardrails — never shoes on torso/legs.
 */
export function looksLikeFootwearBbox(bbox: [number, number, number, number]): boolean {
  const [, ny, nw, nh] = bbox;
  const cy = ny + nh / 2;
  const bottom = ny + nh;
  if (nh >= 0.20) return false;
  if (nw <= nh) return false;
  if (nw >= 0.38) return false;
  if (bottom < 0.90) return false;
  if (cy < 0.82) return false;
  const aspect = nh / Math.max(nw, 1e-6);
  if (aspect >= 1.0) return false;
  return nw * nh <= 0.10;
}

function clothingGeometryToCategory(
  cy: number,
  aspect: number,
  h: number,
  w: number,
): { category: string; subcategory: string; name: string } {
  if (cy < 0.42) {
    return { category: 'tops', subcategory: 'top', name: 'Top' };
  }
  const y = cy - h / 2;
  const bottom = y + h;
  if (cy >= 0.80) {
    if (h < 0.20 && w > h && w < 0.38 && bottom >= 0.90 && aspect < 1.0 && w * h <= 0.10) {
      return { category: 'shoes', subcategory: 'shoes', name: 'Shoes' };
    }
    if (bottom > 0.92 || h >= 0.40) {
      return { category: 'bottoms', subcategory: 'trousers', name: 'Trousers' };
    }
    if (bottom < 0.80 && h < 0.28) {
      return { category: 'bottoms', subcategory: 'shorts', name: 'Shorts' };
    }
    return { category: 'bottoms', subcategory: 'trousers', name: 'Trousers' };
  }
  if (cy >= 0.55) {
    if (bottom > 0.92 || h >= 0.40) {
      return { category: 'bottoms', subcategory: 'trousers', name: 'Trousers' };
    }
    if (bottom < 0.80 && h < 0.28) {
      return { category: 'bottoms', subcategory: 'shorts', name: 'Shorts' };
    }
    if (bottom < 0.80 && h < 0.36) {
      return { category: 'bottoms', subcategory: 'shorts', name: 'Shorts' };
    }
    return { category: 'bottoms', subcategory: 'trousers', name: 'Trousers' };
  }
  if (aspect > 1.55 && h > 0.4) {
    return { category: 'dresses', subcategory: 'dress', name: 'Dress / one-piece' };
  }
  if (aspect > 1.05 && h > 0.3) {
    return { category: 'outerwear', subcategory: 'outerwear', name: 'Outerwear' };
  }
  return { category: 'tops', subcategory: 'top', name: 'Top' };
}
