/**
 * Lightweight IoU tracker for live digitize — promote only stable detections.
 */

export type TrackedBBox = [number, number, number, number]; // normalized x,y,w,h

export type TrackedDetection = {
  trackId: string;
  category: string;
  name?: string;
  color?: string;
  confidence: number;
  bbox: TrackedBBox;
  hits: number;
  lastSeen: number;
  promoted: boolean;
};

function iou(a: TrackedBBox, b: TrackedBBox): number {
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

function smooth(a: TrackedBBox, b: TrackedBBox, alpha = 0.35): TrackedBBox {
  return [
    a[0] * (1 - alpha) + b[0] * alpha,
    a[1] * (1 - alpha) + b[1] * alpha,
    a[2] * (1 - alpha) + b[2] * alpha,
    a[3] * (1 - alpha) + b[3] * alpha,
  ];
}

export class DigitizeDetectionTracker {
  private tracks: TrackedDetection[] = [];
  private readonly iouMatch: number;
  private readonly promoteHits: number;
  private readonly minConfidence: number;
  private readonly ttlMs: number;

  constructor(opts?: {
    iouMatch?: number;
    promoteHits?: number;
    minConfidence?: number;
    ttlMs?: number;
  }) {
    this.iouMatch = opts?.iouMatch ?? 0.5;
    this.promoteHits = opts?.promoteHits ?? 5;
    this.minConfidence = opts?.minConfidence ?? 0.55;
    this.ttlMs = opts?.ttlMs ?? 2500;
  }

  reset() {
    this.tracks = [];
  }

  get promoteFrameTarget(): number {
    return this.promoteHits;
  }

  /** Hits needed before “Hold steady…” (locked) — one frame before promote. */
  get lockFrameTarget(): number {
    return Math.max(1, this.promoteHits - 1);
  }

  /**
   * Update with frame detections. Returns newly promoted tracks (emit once).
   */
  update(
    detections: Array<{
      category: string;
      name?: string;
      color?: string;
      confidence: number;
      bbox: TrackedBBox;
    }>,
    now = Date.now(),
  ): TrackedDetection[] {
    this.tracks = this.tracks.filter((t) => now - t.lastSeen < this.ttlMs);
    const promoted: TrackedDetection[] = [];

    for (const det of detections) {
      if (det.confidence < this.minConfidence) continue;
      if (det.bbox[2] < 0.08 || det.bbox[3] < 0.08) continue;

      const match = this.tracks.find(
        (t) =>
          t.category === det.category
          && iou(t.bbox, det.bbox) >= this.iouMatch,
      );

      if (match) {
        match.bbox = smooth(match.bbox, det.bbox);
        match.confidence = Math.max(match.confidence, det.confidence);
        match.name = det.name || match.name;
        match.color = det.color || match.color;
        match.hits += 1;
        match.lastSeen = now;
        if (!match.promoted && match.hits >= this.promoteHits) {
          match.promoted = true;
          promoted.push({ ...match });
        }
      } else {
        this.tracks.push({
          trackId: `trk_${det.category}_${now}_${Math.random().toString(36).slice(2, 7)}`,
          category: det.category,
          name: det.name,
          color: det.color,
          confidence: det.confidence,
          bbox: det.bbox,
          hits: 1,
          lastSeen: now,
          promoted: false,
        });
      }
    }

    return promoted;
  }

  snapshot(): TrackedDetection[] {
    return this.tracks.map((t) => ({ ...t }));
  }
}
