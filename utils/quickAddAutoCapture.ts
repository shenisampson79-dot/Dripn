/**
 * Quick Add auto-capture gating.
 *
 * 3-state UX (trust loop):
 *   idle  (white)  — nothing useful seen → "Move item into frame"
 *   hold  (amber)  — weak / partial hit → specific "Almost there…" hint
 *   ready (green)  — locked → countdown → snap
 *
 * Single-item UX: pick the largest usable detection only.
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
  /** Floor to enter amber HOLD (must stay ≤ YOLO parse ~0.16). */
  weakConfidence: 0.15,
  /** Alias used by selectors — same as weak so UI never stays white on a hit. */
  selectConfidence: 0.15,
  /** Default snap confidence for clothing; see captureConfidenceFor(). */
  captureConfidence: 0.38,
  /**
   * HOLD may arm with this if shape/coverage is good (boots often sit here).
   * Ready still needs captureConfidenceFor() after boost.
   */
  holdConfidence: 0.22,
  /** ~2 samples @ 850ms ≈ 1.7s stable before green. */
  stableFrames: 2,
  /** Shoes / accessories often sit under 0.12 of frame. */
  minArea: 0.018,
  /** Ready: ≥70% of the object must sit inside the guide (≈20% overflow OK). */
  readyCoverage: 0.7,
  /** Hold: show amber once this much of the object overlaps the guide. */
  holdCoverage: 0.4,
  iouThreshold: 0.42,
  captureCooldownMs: 1800,
  /**
   * Fallback guide when layout is unknown. Prefer guideFromLayout().
   * Taller than the visual square to absorb preview↔photo crop mismatch.
   */
  guide: { x: 0.1, y: 0.2, width: 0.8, height: 0.52 } as QuickAddBBox,
  strugglingMs: 3200,
} as const;

export function isFootwearClass(classOrCategory?: string | null): boolean {
  return /shoe|boot|sandal|sneaker|heel|loafer|footwear/.test(
    String(classOrCategory || '').toLowerCase(),
  );
}

/** Confidence required to auto-snap — shoes/boots are harder for YOLO. */
export function captureConfidenceFor(classOrCategory?: string | null): number {
  const c = String(classOrCategory || '').toLowerCase();
  if (isFootwearClass(c)) return 0.24;
  if (/accessor|bag|hat|belt|scarf/.test(c)) return 0.3;
  return QUICK_ADD_CAPTURE.captureConfidence;
}

/**
 * Tall / bottom-heavy blobs → treat as footwear and boost confidence.
 * Rain boots & dark shoes often score weakly as Clothing/Accessories.
 */
export function looksLikeFootwear(bbox: QuickAddBBox): boolean {
  const aspect = bbox.height / Math.max(bbox.width, 1e-6);
  const area = bbox.width * bbox.height;
  const cy = bbox.y + bbox.height / 2;
  const bottomHeavy = cy >= 0.4;
  return area >= 0.015 && area <= 0.3 && aspect >= 0.85 && aspect <= 2.9 && bottomHeavy;
}

export function boostDetection(det: QuickAddYoloDetection): QuickAddYoloDetection {
  const shoeClass = isFootwearClass(det.class);
  const footwearShape = looksLikeFootwear(det.bbox);
  if (shoeClass) {
    return {
      ...det,
      confidence: Math.min(0.95, det.confidence * 1.22 + 0.05),
    };
  }
  if (footwearShape && !/bag/.test(String(det.class).toLowerCase())) {
    return {
      ...det,
      class: 'shoes',
      confidence: Math.min(0.95, det.confidence * 1.28 + 0.06),
    };
  }
  return det;
}

export function boostDetections(detections: QuickAddYoloDetection[]): QuickAddYoloDetection[] {
  return detections.map(boostDetection);
}

/**
 * Normalize the on-screen square guide into camera-image [0–1] coords,
 * expanded so preview↔photo crop mismatch doesn't block HOLD/READY.
 */
export function guideFromLayout(layout: {
  screenWidth: number;
  screenHeight: number;
  overlayTop: number;
  overlayBottom: number;
  frameSize: number;
}): QuickAddBBox {
  const { screenWidth: sw, screenHeight: sh, overlayTop, overlayBottom, frameSize } = layout;
  if (sw <= 0 || sh <= 0) return { ...QUICK_ADD_CAPTURE.guide };
  const usableH = Math.max(frameSize, sh - overlayTop - overlayBottom);
  const left = (sw - frameSize) / 2;
  const topInUsable = (usableH - frameSize) / 2;
  // ~20% overflow tolerance beyond the visible square.
  const padX = (frameSize * 0.2) / sw;
  const padY = (frameSize * 0.24) / sh;
  const x = Math.max(0, left / sw - padX);
  const y = Math.max(0, (overlayTop + topInUsable) / sh - padY);
  return {
    x,
    y,
    width: Math.min(1 - x, frameSize / sw + padX * 2),
    height: Math.min(1 - y, frameSize / sh + padY * 2),
  };
}

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

/** Fraction of the item that overlaps the guide (1 = fully inside). */
export function itemGuideCoverage(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
): number {
  const itemArea = Math.max(1e-6, bbox.width * bbox.height);
  return intersectionArea(bbox, frame) / itemArea;
}

export function centreInGuide(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
): boolean {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  return (
    cx >= frame.x
    && cx <= frame.x + frame.width
    && cy >= frame.y
    && cy <= frame.y + frame.height
  );
}

export function selectBestDetection(
  detections: QuickAddYoloDetection[],
  minConfidence = QUICK_ADD_CAPTURE.selectConfidence,
): QuickAddYoloDetection | null {
  const ranked = detections
    .filter((d) => d.confidence >= minConfidence)
    .sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
  return ranked[0] || null;
}

/**
 * Ready containment: centre in guide + ≥70% of object inside (≈20% overflow OK).
 */
export function isInsideGuideFrame(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
  minCoverage = QUICK_ADD_CAPTURE.readyCoverage,
): boolean {
  if (!centreInGuide(bbox, frame)) return false;
  return itemGuideCoverage(bbox, frame) >= minCoverage;
}

/** Soft presence for amber HOLD — partial overlap or centre near frame. */
export function isAlmostInGuide(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
): boolean {
  if (centreInGuide(bbox, frame)) return true;
  return itemGuideCoverage(bbox, frame) >= QUICK_ADD_CAPTURE.holdCoverage;
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
  coverage: number;
};

function primaryHint(flags: {
  isBigEnough: boolean;
  isCentered: boolean;
  isStable: boolean;
  isConfident: boolean;
  coverage: number;
}): string {
  if (!flags.isBigEnough) return 'Almost there — move closer';
  if (!flags.isCentered || flags.coverage < QUICK_ADD_CAPTURE.readyCoverage) {
    return 'Almost there — centre the item';
  }
  if (!flags.isConfident) return 'Almost there — hold steady';
  if (!flags.isStable) return 'Hold still…';
  return 'Hold still…';
}

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
        ? 'Try clearer lighting or move closer'
        : 'Move item into frame',
      isBigEnough: false,
      isCentered: false,
      isStable: false,
      isConfident: false,
      coverage: 0,
    };
  }

  const area = det.bbox.width * det.bbox.height;
  const coverage = itemGuideCoverage(det.bbox, conf.guide);
  const isBigEnough = area > conf.minArea;
  const isCentered = isInsideGuideFrame(det.bbox, conf.guide, conf.readyCoverage);
  const almostIn = isAlmostInGuide(det.bbox, conf.guide);
  const isStable = track.stableFrames >= conf.stableFrames;
  const snapConf = captureConfidenceFor(det.class);
  const isConfident = det.confidence >= snapConf;
  const isWeakHit = det.confidence >= conf.weakConfidence;

  if (isBigEnough && isCentered && isStable && isConfident) {
    return {
      shouldCapture: true,
      ui: 'ready',
      hint: 'Locked — hold still',
      isBigEnough,
      isCentered,
      isStable,
      isConfident,
      coverage,
    };
  }

  const hint = primaryHint({
    isBigEnough,
    isCentered,
    isStable,
    isConfident,
    coverage,
  });

  // Amber HOLD: any weak detection with some frame presence — never stay white.
  if (isWeakHit && (almostIn || isBigEnough || track.stableFrames > 0)) {
    return {
      shouldCapture: false,
      ui: 'hold',
      hint,
      isBigEnough,
      isCentered,
      isStable,
      isConfident,
      coverage,
    };
  }

  if (isWeakHit) {
    return {
      shouldCapture: false,
      ui: 'hold',
      hint: 'Almost there — centre the item',
      isBigEnough,
      isCentered,
      isStable,
      isConfident,
      coverage,
    };
  }

  return {
    shouldCapture: false,
    ui: 'idle',
    hint: 'Move item into frame',
    isBigEnough,
    isCentered,
    isStable,
    isConfident,
    coverage,
  };
}

/** Category-aware crop padding — tighter = subject fills more of the saved frame. */
export function paddingForCategory(categoryHint?: string | null, bbox?: QuickAddBBox | null): number {
  const cat = String(categoryHint || '').toLowerCase();
  const area = bbox ? bbox.width * bbox.height : 0.15;
  if (isFootwearClass(cat)) {
    return area < 0.1 ? 0.04 : 0.05;
  }
  if (/accessor|bag|hat|belt|scarf|jewel|watch|sunglass/.test(cat)) {
    return area < 0.1 ? 0.05 : 0.07;
  }
  if (area < 0.08) return 0.05;
  if (area < 0.18) return 0.06;
  return 0.07;
}

export function countConfidentDetections(
  detections: QuickAddYoloDetection[],
  minConfidence = QUICK_ADD_CAPTURE.selectConfidence,
): number {
  return detections.filter((d) => d.confidence >= minConfidence).length;
}

export class QuickAddCaptureController {
  track: QuickAddTrackState = createEmptyTrack();
  lastCaptureTime = 0;
  guide: QuickAddBBox = { ...QUICK_ADD_CAPTURE.guide };

  reset() {
    this.track = createEmptyTrack();
  }

  setGuide(guide: QuickAddBBox) {
    this.guide = guide;
  }

  /** Call when a photo is actually taken (auto or manual) so cooldown applies. */
  markCaptured(now = Date.now()) {
    this.lastCaptureTime = now;
  }

  onFrame(
    detections: QuickAddYoloDetection[],
    now = Date.now(),
  ): { best: QuickAddYoloDetection | null; eval: CaptureEval; armed: boolean; multiCount: number } {
    const boosted = boostDetections(detections);
    const multiCount = countConfidentDetections(boosted);
    const best = selectBestDetection(boosted);
    if (!best) {
      const evaluation = evaluateCapture(null, this.track, { guide: this.guide });
      if (now - this.track.lastUpdated > 1200) {
        this.track = createEmptyTrack();
      }
      return { best: null, eval: evaluation, armed: false, multiCount };
    }

    this.track = updateTracking(this.track, best, now);
    const evaluation = evaluateCapture(best, this.track, { guide: this.guide });
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
