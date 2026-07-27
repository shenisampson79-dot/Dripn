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
  selectConfidence: 0.6,
  captureConfidence: 0.75,
  stableFrames: 6,
  minArea: 0.12,
  iouThreshold: 0.6,
  captureCooldownMs: 2000,
  /** Approx guide frame as fraction of full preview (280pt box on ~390pt phone). */
  guide: { x: 0.14, y: 0.22, width: 0.72, height: 0.42 } as QuickAddBBox,
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

export function selectBestDetection(
  detections: QuickAddYoloDetection[],
  minConfidence = QUICK_ADD_CAPTURE.selectConfidence,
): QuickAddYoloDetection | null {
  const ranked = detections
    .filter((d) => d.confidence > minConfidence)
    .sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
  return ranked[0] || null;
}

/** Soft containment: centre of bbox must sit inside guide; area mostly overlaps guide. */
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
  const overlap = iou(bbox, frame);
  return overlap >= 0.2;
}

export function addPadding(bbox: QuickAddBBox, padding = 0.1): QuickAddBBox {
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
        : 'Center the item',
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

  if (det && (isCentered || track.stableFrames > 1)) {
    return {
      shouldCapture: false,
      ui: 'hold',
      hint: 'Hold still…',
      isBigEnough,
      isCentered,
      isStable,
      isConfident,
    };
  }

  return {
    shouldCapture: false,
    ui: 'idle',
    hint: 'Center the item',
    isBigEnough,
    isCentered,
    isStable,
    isConfident,
  };
}

export class QuickAddCaptureController {
  track: QuickAddTrackState = createEmptyTrack();
  lastCaptureTime = 0;

  reset() {
    this.track = createEmptyTrack();
  }

  onFrame(
    detections: QuickAddYoloDetection[],
    now = Date.now(),
  ): { best: QuickAddYoloDetection | null; eval: CaptureEval; trigger: boolean } {
    const best = selectBestDetection(detections);
    if (!best) {
      const evaluation = evaluateCapture(null, this.track);
      // Don't wipe firstSeenAt while briefly losing detection mid-lock.
      if (now - this.track.lastUpdated > 1200) {
        this.track = createEmptyTrack();
      }
      return { best: null, eval: evaluation, trigger: false };
    }

    this.track = updateTracking(this.track, best, now);
    const evaluation = evaluateCapture(best, this.track);
    let trigger = false;
    if (evaluation.shouldCapture && now - this.lastCaptureTime >= QUICK_ADD_CAPTURE.captureCooldownMs) {
      this.lastCaptureTime = now;
      trigger = true;
    }
    return { best, eval: evaluation, trigger };
  }
}
