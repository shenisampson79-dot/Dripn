/**
 * Quick Add auto-capture gating (YOLO → stable → centered → snap).
 * Single-item UX: pick the largest confident detection only.
 */

export type QuickAddBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type QuickAddYoloDetection = {
  class: string;
  confidence: number;
  bbox: QuickAddBBox;
};

export type QuickAddCaptureUi = 'idle' | 'hold' | 'ready' | 'struggling';

export const QUICK_ADD_CAPTURE = {
  selectConfidence: 0.5,
  captureConfidence: 0.62,
  /** Sample interval is ~0.7s — 3 frames ≈ 2s hold, not ~7s. */
  stableFrames: 3,
  /** Shoes / accessories often sit under 0.12 of frame. */
  minArea: 0.04,
  iouThreshold: 0.55,
  captureCooldownMs: 2000,
  /**
   * Matches the on-screen square guide (~280pt) as a fraction of a typical phone preview.
   * Used for gating and as a crop fallback when YOLO misses.
   */
  guide: { x: 0.12, y: 0.22, width: 0.76, height: 0.48 } as QuickAddBBox,
  strugglingMs: 3500,
} as const;

export function bboxFromTuple(bbox: [number, number, number, number]): QuickAddBBox {
  return { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] };
}

export function bboxToTuple(bbox: QuickAddBBox): [number, number, number, number] {
  return [bbox.x, bbox.y, bbox.width, bbox.height];
}

export function iou(a: QuickAddBBox, b: QuickAddBBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
}

function intersectionArea(a: QuickAddBBox, b: QuickAddBBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

export function selectBestDetection(
  detections: QuickAddYoloDetection[],
  minConfidence = QUICK_ADD_CAPTURE.selectConfidence,
): QuickAddYoloDetection | null {
  const ranked = detections
    .filter((d) => d.confidence > minConfidence)
    .sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
  return ranked[0] || null;
}

/**
 * Soft containment: centre inside guide, and most of the item overlaps the guide.
 * Uses coverage-of-bbox (not IoU) so small shoes in a large guide still count as centered.
 */
export function isInsideGuideFrame(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
): boolean {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const centreIn =
    cx >= frame.x
    && cx <= frame.x + frame.width
    && cy >= frame.y
    && cy <= frame.y + frame.height;
  if (!centreIn) return false;
  const area = Math.max(1e-6, bbox.width * bbox.height);
  const covered = intersectionArea(bbox, frame) / area;
  return covered >= 0.45;
}

export function addPadding(bbox: QuickAddBBox, padding = 0.08): QuickAddBBox {
  const x = Math.max(0, bbox.x - padding);
  const y = Math.max(0, bbox.y - padding);
  const right = Math.min(1, bbox.x + bbox.width + padding);
  const bottom = Math.min(1, bbox.y + bbox.height + padding);
  return {
    x,
    y,
    width: Math.max(0.02, right - x),
    height: Math.max(0.02, bottom - y),
  };
}

/** Slightly tighter pad for already-small subjects so rembg doesn't leave a huge canvas. */
export function paddingForBBox(bbox: QuickAddBBox, categoryHint?: string | null): number {
  return paddingForCategory(categoryHint, bbox);
}

export type QuickAddTrackState = {
  bbox: QuickAddBBox | null;
  stableFrames: number;
  lastUpdated: number;
  firstSeenAt: number;
};

export function createEmptyTrack(): QuickAddTrackState {
  return { bbox: null, stableFrames: 0, lastUpdated: 0, firstSeenAt: 0 };
}

export function updateTracking(
  track: QuickAddTrackState,
  det: QuickAddYoloDetection,
  now = Date.now(),
  iouThreshold = QUICK_ADD_CAPTURE.iouThreshold,
): QuickAddTrackState {
  if (!track.bbox) {
    return {
      bbox: det.bbox,
      stableFrames: 1,
      lastUpdated: now,
      firstSeenAt: now,
    };
  }
  const overlap = iou(track.bbox, det.bbox);
  return {
    bbox: det.bbox,
    stableFrames: overlap > iouThreshold ? track.stableFrames + 1 : 1,
    lastUpdated: now,
    firstSeenAt: track.firstSeenAt || now,
  };
}

export type CaptureEval = {
  shouldCapture: boolean;
  ui: QuickAddCaptureUi;
  hint: string;
  isBigEnough: boolean;
  isCentered: boolean;
  isStable: boolean;
  isConfident: boolean;
};

export function evaluateCapture(
  det: QuickAddYoloDetection | null,
  track: QuickAddTrackState,
  opts?: Partial<typeof QUICK_ADD_CAPTURE>,
): CaptureEval {
  const conf = { ...QUICK_ADD_CAPTURE, ...opts };
  if (!det) {
    const struggling =
      track.firstSeenAt > 0 && Date.now() - track.firstSeenAt > conf.strugglingMs;
    return {
      shouldCapture: false,
      ui: struggling ? 'struggling' : 'idle',
      hint: struggling
        ? 'Try moving closer or clearer lighting'
        : 'Fit item inside frame',
      isBigEnough: false,
      isCentered: false,
      isStable: false,
      isConfident: false,
    };
  }

  const area = det.bbox.width * det.bbox.height;
  const isBigEnough = area > conf.minArea;
  const isCentered = isInsideGuideFrame(det.bbox, conf.guide);
  const isStable = track.stableFrames >= conf.stableFrames;
  const isConfident = det.confidence > conf.captureConfidence;

  if (isBigEnough && isCentered && isStable && isConfident) {
    return {
      shouldCapture: true,
      ui: 'ready',
      hint: 'Hold still…',
      isBigEnough,
      isCentered,
      isStable,
      isConfident,
    };
  }

  let hint = 'Fit item inside frame';
  if (!isBigEnough) hint = 'Move closer';
  else if (!isCentered) hint = 'Fit item inside frame';
  else if (!isStable || !isConfident) hint = 'Hold still…';

  if (det && (isCentered || track.stableFrames > 1 || !isBigEnough)) {
    return {
      shouldCapture: false,
      ui: 'hold',
      hint,
      isBigEnough,
      isCentered,
      isStable,
      isConfident,
    };
  }

  return {
    shouldCapture: false,
    ui: 'idle',
    hint,
    isBigEnough,
    isCentered,
    isStable,
    isConfident,
  };
}

/** Category-aware crop padding — tighter = subject fills more of the saved frame. */
export function paddingForCategory(categoryHint?: string | null, bbox?: QuickAddBBox | null): number {
  const cat = String(categoryHint || '').toLowerCase();
  const area = bbox ? bbox.width * bbox.height : 0.15;
  if (/shoe|boot|sandal|sneaker|heel|loafer|footwear/.test(cat)) {
    return area < 0.1 ? 0.04 : 0.05; // ~75% fill
  }
  if (/accessor|bag|hat|belt|scarf|jewel|watch|sunglass/.test(cat)) {
    return area < 0.1 ? 0.05 : 0.07; // ~65–75%
  }
  if (area < 0.08) return 0.05;
  if (area < 0.18) return 0.06;
  return 0.07; // tops / default ~85%
}

export function countConfidentDetections(
  detections: QuickAddYoloDetection[],
  minConfidence = QUICK_ADD_CAPTURE.selectConfidence,
): number {
  return detections.filter((d) => d.confidence > minConfidence).length;
}

export class QuickAddCaptureController {
  track: QuickAddTrackState = createEmptyTrack();
  lastCaptureTime = 0;

  reset() {
    this.track = createEmptyTrack();
  }

  /** Call when a photo is actually taken (auto or manual) so cooldown applies. */
  markCaptured(now = Date.now()) {
    this.lastCaptureTime = now;
  }

  onFrame(
    detections: QuickAddYoloDetection[],
    now = Date.now(),
  ): { best: QuickAddYoloDetection | null; eval: CaptureEval; armed: boolean; multiCount: number } {
    const multiCount = countConfidentDetections(detections);
    const best = selectBestDetection(detections);
    if (!best) {
      const evaluation = evaluateCapture(null, this.track);
      if (now - this.track.lastUpdated > 1200) {
        this.track = createEmptyTrack();
      }
      return { best: null, eval: evaluation, armed: false, multiCount };
    }

    this.track = updateTracking(this.track, best, now);
    const evaluation = evaluateCapture(best, this.track);
    let nextEval = evaluation;
    if (multiCount >= 2 && !evaluation.shouldCapture) {
      nextEval = {
        ...evaluation,
        hint: '2 items detected — capture one at a time',
        ui: evaluation.ui === 'idle' ? 'hold' : evaluation.ui,
      };
    }
    const armed =
      nextEval.shouldCapture
      && now - this.lastCaptureTime >= QUICK_ADD_CAPTURE.captureCooldownMs;
    return { best, eval: nextEval, armed, multiCount };
  }
}
