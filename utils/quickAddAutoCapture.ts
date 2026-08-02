/**
 * Quick Add auto-capture gating.
 *
 * 3-state UX (trust loop):
 *   idle  (white)  — nothing useful seen → "Centre the garment in the box…"
 *   hold  (amber)  — weak / partial hit → specific "Almost there…" hint
 *   ready (green)  — locked → countdown → snap
 *
 * Single-item UX: pick the largest usable detection only.
 * The guide is a target for the garment centre — items may overflow the box.
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
  weakConfidence: 0.14,
  /** Alias used by selectors — same as weak so UI never stays white on a hit. */
  selectConfidence: 0.14,
  /**
   * Default snap confidence for clothing; see captureConfidenceFor().
   * Flat-lay beige/tan on carpet often sits ~0.28–0.36 — 0.38 felt “stuck amber”.
   */
  captureConfidence: 0.30,
  /**
   * HOLD may arm with this if shape/coverage is good (boots often sit here).
   * Ready still needs captureConfidenceFor() after boost.
   */
  holdConfidence: 0.22,
  /** ~2 samples @ 850ms ≈ 1.7s stable before green. */
  stableFrames: 2,
  /** Shoes / accessories often sit under 0.12 of frame. */
  minArea: 0.015,
  /** Ready: ≥70% of the object must sit inside the guide (≈20% overflow OK). */
  readyCoverage: 0.55,
  /** Hold: show amber once this much of the object overlaps the guide. */
  holdCoverage: 0.28,
  /** Looser IoU — flat-lays jitter between samples and used to reset stability. */
  iouThreshold: 0.34,
  captureCooldownMs: 1800,
  /**
   * Keep amber across 1–2 missed YOLO samples (~850ms each) instead of
   * flashing white and cancelling the green countdown.
   */
  missGraceMs: 1800,
  /**
   * Temporal UI (time-based, not frame-reactive).
   * Sample interval is ~850ms — buffer of 4 ≈ 3.4s (not 10 frames).
   */
  confBufferSize: 4,
  /** Count as a buffer "hit" when confidence clears this floor. */
  bufferHitConfidence: 0.22,
  /** hitRate ≥ this → prefer amber presence. */
  amberHitRate: 0.25,
  /** hitRate ≥ this + geometry ready → prefer green presence. */
  greenHitRate: 0.6,
  /** Minimum amber dwell before green/countdown is allowed. */
  amberMinMs: 800,
  /** Ready-band samples required after amber min before arming green. */
  greenStableSamples: 2,
  /** Sustained true loss before white + cancel countdown. */
  idleCancelMs: 1000,
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
  if (isFootwearClass(c)) return 0.2;
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
  const bottomHeavy = cy >= 0.3;
  const bottomTouch = bbox.y + bbox.height >= 0.72;
  return area >= 0.008 && area <= 0.35 && aspect >= 0.65 && aspect <= 4.1 && (bottomTouch || bottomHeavy);
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
  // Expand beyond the visible square so bbox drift doesn't block GREEN.
  const padX = (frameSize * 0.3) / sw;
  const padY = (frameSize * 0.34) / sh;
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

/** Fraction of the guide filled by the item (1 = guide fully covered). */
export function guideFilledByItem(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
): number {
  const guideArea = Math.max(1e-6, frame.width * frame.height);
  return intersectionArea(bbox, frame) / guideArea;
}

export function centreInGuide(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
): boolean {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const slackX = Math.max(0.02, frame.width * 0.12);
  const slackY = Math.max(0.02, frame.height * 0.12);
  return (
    cx >= frame.x - slackX
    && cx <= frame.x + frame.width + slackX
    && cy >= frame.y - slackY
    && cy <= frame.y + frame.height + slackY
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
 * Ready when the item centre is in the guide AND either:
 * - most of a smaller item sits inside the guide, OR
 * - a large item fills the guide (overflow OK — clothes rarely fit in the box).
 */
export function isInsideGuideFrame(
  bbox: QuickAddBBox,
  frame: QuickAddBBox = QUICK_ADD_CAPTURE.guide,
  minCoverage = QUICK_ADD_CAPTURE.readyCoverage,
): boolean {
  if (!centreInGuide(bbox, frame)) return false;
  if (itemGuideCoverage(bbox, frame) >= minCoverage) return true;
  const area = bbox.width * bbox.height;
  // Large garments fill the camera; only require centre + guide mostly filled.
  if (area >= 0.22 && guideFilledByItem(bbox, frame) >= 0.45) return true;
  return false;
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
  area: number;
}): string {
  if (!flags.isBigEnough) return 'Move a little closer';
  if (!flags.isCentered) {
    return flags.area >= 0.22
      ? 'Centre the garment in the box (it can overflow)'
      : 'Centre the item in the box';
  }
  if (!flags.isConfident) return 'Hold steady…';
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
        : 'Centre the garment in the box — it can fill the screen',
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
      hint: 'Locked — capturing…',
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
    area,
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
      hint: 'Centre the garment in the box (it can overflow)',
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
    hint: 'Centre the garment in the box — it can fill the screen',
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

/** Raw per-frame presence before temporal smoothing. */
export type QuickAddPresenceBand = 'idle' | 'hold' | 'ready';

export type QuickAddTemporalState = {
  phase: 'white' | 'amber' | 'green';
  amberEnteredAt: number | null;
  readySamples: number;
  idleEnteredAt: number | null;
  countdownActive: boolean;
  confBuffer: number[];
};

export function createQuickAddTemporalState(): QuickAddTemporalState {
  return {
    phase: 'white',
    amberEnteredAt: null,
    readySamples: 0,
    idleEnteredAt: null,
    countdownActive: false,
    confBuffer: [],
  };
}

export function pushConfidenceBuffer(
  prev: number[],
  confidence: number,
  size = QUICK_ADD_CAPTURE.confBufferSize,
): number[] {
  const next = prev.length ? [...prev, confidence] : [confidence];
  while (next.length > size) next.shift();
  return next;
}

export function bufferHitRate(
  buffer: number[],
  hitFloor = QUICK_ADD_CAPTURE.bufferHitConfidence,
): number {
  if (!buffer.length) return 0;
  const hits = buffer.filter((c) => c >= hitFloor).length;
  return hits / buffer.length;
}

/**
 * Map raw geometry eval + rolling hit-rate → presence band.
 * Detection can flicker; band stays calmer.
 * A hard miss (conf≈0) only stays hold while the buffer is still strongly warm.
 */
export function presenceBandFromSample(
  rawUi: QuickAddCaptureUi,
  confidence: number,
  hitRate: number,
  opts?: Partial<typeof QUICK_ADD_CAPTURE>,
): QuickAddPresenceBand {
  const conf = { ...QUICK_ADD_CAPTURE, ...opts };
  const hardMiss = confidence < conf.bufferHitConfidence;

  if (hardMiss && (rawUi === 'idle' || rawUi === 'struggling')) {
    // Buffer still hot → brief sticky amber; otherwise drop to white path.
    if (hitRate >= conf.greenHitRate) return 'hold';
    return 'idle';
  }

  if (rawUi === 'ready' || (hitRate >= conf.greenHitRate && rawUi === 'hold' && confidence >= conf.captureConfidence)) {
    return 'ready';
  }
  if (rawUi === 'hold' || rawUi === 'struggling' || hitRate >= conf.amberHitRate) {
    return 'hold';
  }
  return 'idle';
}

/**
 * Time-based white → amber → green. Separates detection flicker from UI commit.
 * During green countdown, brief hold/miss does NOT cancel — only sustained idle.
 */
export function advanceQuickAddTemporal(
  prev: QuickAddTemporalState,
  sample: {
    band: QuickAddPresenceBand;
    confidence: number;
    rawReady: boolean;
    /** Miss-grace ghost frames — never promote to green. */
    lockHold?: boolean;
  },
  nowMs: number,
  opts?: Partial<typeof QUICK_ADD_CAPTURE>,
): {
  state: QuickAddTemporalState;
  ui: QuickAddCaptureUi;
  startCountdown: boolean;
  cancelCountdown: boolean;
} {
  const conf = { ...QUICK_ADD_CAPTURE, ...opts };
  const confBuffer = pushConfidenceBuffer(prev.confBuffer, sample.confidence, conf.confBufferSize);
  const hitRate = bufferHitRate(confBuffer, conf.bufferHitConfidence);
  // Soften flicker with hit-rate, but never ignore a hard ready lock this frame.
  let effectiveBand: QuickAddPresenceBand = presenceBandFromSample(
    sample.band === 'ready' ? 'ready' : sample.band === 'hold' ? 'hold' : 'idle',
    sample.confidence,
    hitRate,
    conf,
  );
  if (sample.rawReady) effectiveBand = 'ready';
  if (sample.band === 'hold' && effectiveBand === 'idle') effectiveBand = 'hold';
  if (sample.lockHold) effectiveBand = 'hold';

  const base: QuickAddTemporalState = {
    ...prev,
    confBuffer,
  };

  // —— Green / countdown active ——
  if (base.countdownActive || base.phase === 'green') {
    // Use raw miss intent for cancel — don't let a warm buffer block sustained-idle cancel.
    const rawLost =
      sample.band === 'idle'
      && !sample.rawReady
      && sample.confidence < conf.bufferHitConfidence;

    if (rawLost) {
      const idleEnteredAt = base.idleEnteredAt ?? nowMs;
      const idleAge = nowMs - idleEnteredAt;
      if (idleAge >= conf.idleCancelMs) {
        return {
          state: createQuickAddTemporalState(),
          ui: 'idle',
          startCountdown: false,
          cancelCountdown: true,
        };
      }
      // Brief miss during countdown — keep green, do not cancel.
      return {
        state: {
          ...base,
          phase: 'green',
          idleEnteredAt,
          countdownActive: true,
        },
        ui: 'ready',
        startCountdown: false,
        cancelCountdown: false,
      };
    }
    return {
      state: {
        ...base,
        phase: 'green',
        idleEnteredAt: null,
        countdownActive: true,
        readySamples: base.readySamples + (effectiveBand === 'ready' ? 1 : 0),
      },
      ui: 'ready',
      startCountdown: false,
      cancelCountdown: false,
    };
  }

  // —— Idle / white ——
  if (effectiveBand === 'idle') {
    const idleEnteredAt = base.idleEnteredAt ?? nowMs;
    const idleAge = nowMs - idleEnteredAt;
    // Still in amber dwell grace from a prior hit? drop only after sustained idle.
    if (base.phase === 'amber' && idleAge < conf.idleCancelMs) {
      return {
        state: {
          ...base,
          phase: 'amber',
          idleEnteredAt,
          readySamples: 0,
        },
        ui: 'hold',
        startCountdown: false,
        cancelCountdown: false,
      };
    }
    return {
      state: {
        ...createQuickAddTemporalState(),
        confBuffer,
        idleEnteredAt,
      },
      ui: 'idle',
      startCountdown: false,
      cancelCountdown: base.phase !== 'white',
    };
  }

  // —— Enter / stay amber ——
  const amberEnteredAt =
    base.phase === 'white' || base.amberEnteredAt == null ? nowMs : base.amberEnteredAt;
  const amberAge = nowMs - amberEnteredAt;
  const readySamples =
    effectiveBand === 'ready'
      ? (base.phase === 'amber' ? base.readySamples + 1 : 1)
      : 0;

  if (
    effectiveBand === 'ready'
    && amberAge >= conf.amberMinMs
    && readySamples >= conf.greenStableSamples
  ) {
    return {
      state: {
        phase: 'green',
        amberEnteredAt,
        readySamples,
        idleEnteredAt: null,
        countdownActive: true,
        confBuffer,
      },
      ui: 'ready',
      startCountdown: true,
      cancelCountdown: false,
    };
  }

  return {
    state: {
      phase: 'amber',
      amberEnteredAt,
      readySamples,
      idleEnteredAt: null,
      countdownActive: false,
      confBuffer,
    },
    ui: 'hold',
    startCountdown: false,
    cancelCountdown: false,
  };
}

export class QuickAddCaptureController {
  track: QuickAddTrackState = createEmptyTrack();
  lastCaptureTime = 0;
  guide: QuickAddBBox = { ...QUICK_ADD_CAPTURE.guide };
  /** Last real detection — used to hold amber through brief YOLO misses. */
  lastBest: QuickAddYoloDetection | null = null;
  temporal: QuickAddTemporalState = createQuickAddTemporalState();

  reset() {
    this.track = createEmptyTrack();
    this.lastBest = null;
    this.temporal = createQuickAddTemporalState();
  }

  setGuide(guide: QuickAddBBox) {
    this.guide = guide;
  }

  /** Call when a photo is actually taken (auto or manual) so cooldown applies. */
  markCaptured(now = Date.now()) {
    this.lastCaptureTime = now;
    this.temporal = {
      ...this.temporal,
      countdownActive: false,
      phase: 'white',
      amberEnteredAt: null,
      readySamples: 0,
      idleEnteredAt: null,
    };
  }

  /** Screen calls this when countdown actually starts (keeps temporal in sync). */
  markCountdownStarted() {
    this.temporal = {
      ...this.temporal,
      phase: 'green',
      countdownActive: true,
      idleEnteredAt: null,
    };
  }

  onFrame(
    detections: QuickAddYoloDetection[],
    now = Date.now(),
  ): {
    best: QuickAddYoloDetection | null;
    eval: CaptureEval;
    armed: boolean;
    multiCount: number;
    cancelCountdown: boolean;
  } {
    const boosted = boostDetections(detections);
    const multiCount = countConfidentDetections(boosted);
    let best = selectBestDetection(boosted);
    let rawEval: CaptureEval;
    let ghostMiss = false;

    if (!best) {
      const grace = QUICK_ADD_CAPTURE.missGraceMs;
      const withinGrace =
        !!this.track.bbox
        && !!this.lastBest
        && this.track.lastUpdated > 0
        && now - this.track.lastUpdated <= grace;

      if (withinGrace && this.track.bbox && this.lastBest) {
        best = {
          ...this.lastBest,
          bbox: this.track.bbox,
        };
        rawEval = evaluateCapture(best, this.track, { guide: this.guide });
        rawEval = {
          ...rawEval,
          shouldCapture: false,
          ui: 'hold',
          hint: rawEval.isCentered || rawEval.isConfident ? 'Hold still…' : rawEval.hint,
        };
        ghostMiss = true;
      } else {
        rawEval = evaluateCapture(null, this.track, { guide: this.guide });
        if (now - this.track.lastUpdated > grace) {
          this.track = createEmptyTrack();
          this.lastBest = null;
        }
      }
    } else {
      this.lastBest = best;
      this.track = updateTracking(this.track, best, now);
      rawEval = evaluateCapture(best, this.track, { guide: this.guide });
      if (multiCount >= 2 && !rawEval.shouldCapture) {
        rawEval = {
          ...rawEval,
          hint: '2 items detected — capture one at a time',
          ui: rawEval.ui === 'idle' ? 'hold' : rawEval.ui,
        };
      }
    }

    const rawBand: QuickAddPresenceBand =
      rawEval.ui === 'ready' ? 'ready' : rawEval.ui === 'hold' || rawEval.ui === 'struggling' ? 'hold' : 'idle';

    const advanced = advanceQuickAddTemporal(
      this.temporal,
      {
        band: rawBand,
        confidence: best && !ghostMiss ? best.confidence : ghostMiss ? Math.max(0.25, best?.confidence ?? 0.25) : 0,
        rawReady: !!rawEval.shouldCapture && !ghostMiss,
        lockHold: ghostMiss,
      },
      now,
    );
    this.temporal = advanced.state;

    const smoothed: CaptureEval = {
      ...rawEval,
      ui: advanced.ui,
      shouldCapture: advanced.startCountdown,
      hint:
        advanced.ui === 'ready'
          ? 'Locked — capturing…'
          : advanced.ui === 'hold'
            ? (rawEval.ui === 'idle' ? 'Hold still…' : rawEval.hint)
            : rawEval.hint,
    };

    const armed =
      advanced.startCountdown
      && !!best
      && !ghostMiss
      && now - this.lastCaptureTime >= QUICK_ADD_CAPTURE.captureCooldownMs;

    return {
      best: best ?? null,
      eval: smoothed,
      armed,
      multiCount,
      cancelCountdown: advanced.cancelCountdown,
    };
  }
}
