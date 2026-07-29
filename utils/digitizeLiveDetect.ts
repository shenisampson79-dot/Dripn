/**
 * Live-scan detection helpers — footwear pairs, multi-item gating, bbox merge.
 */

export type LiveDetBBox = [number, number, number, number];

export function isFootwearCategory(category?: string | null): boolean {
  return /shoe|boot|sandal|sneaker|heel|loafer|footwear/.test(
    String(category || '').toLowerCase(),
  );
}

export function unionBBox(a: LiveDetBBox, b: LiveDetBBox): LiveDetBBox {
  const x1 = Math.min(a[0], b[0]);
  const y1 = Math.min(a[1], b[1]);
  const x2 = Math.max(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.max(a[1] + a[3], b[1] + b[3]);
  return [
    Math.max(0, x1),
    Math.max(0, y1),
    Math.min(1, x2) - Math.max(0, x1),
    Math.min(1, y2) - Math.max(0, y1),
  ];
}

export function bboxCenterDistance(a: LiveDetBBox, b: LiveDetBBox): number {
  const ax = a[0] + a[2] / 2;
  const ay = a[1] + a[3] / 2;
  const bx = b[0] + b[2] / 2;
  const by = b[1] + b[3] / 2;
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Two shoe boxes side-by-side (a pair) should count as one wardrobe item.
 */
export function isFootwearPair(
  a: { category: string; bbox: LiveDetBBox },
  b: { category: string; bbox: LiveDetBBox },
): boolean {
  if (!isFootwearCategory(a.category) || !isFootwearCategory(b.category)) return false;
  return bboxCenterDistance(a.bbox, b.bbox) < 0.55;
}

type LiveDet = {
  category: string;
  name?: string;
  color?: string;
  confidence: number;
  bbox: LiveDetBBox;
};

/**
 * Merge left/right shoe detections into one union box before tracking.
 */
export function coalesceFootwearDetections(detections: LiveDet[]): LiveDet[] {
  const shoes = detections.filter((d) => isFootwearCategory(d.category));
  const others = detections.filter((d) => !isFootwearCategory(d.category));
  if (shoes.length < 2) return detections;

  const remaining = [...shoes];
  const merged: LiveDet[] = [];
  while (remaining.length) {
    const seed = remaining.shift()!;
    const group = [seed];
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (isFootwearPair(seed, remaining[i])) {
        group.push(remaining.splice(i, 1)[0]);
      }
    }
    if (group.length === 1) {
      merged.push(seed);
      continue;
    }
    const bbox = group.slice(1).reduce((acc, d) => unionBBox(acc, d.bbox), group[0].bbox);
    const confidence = Math.max(...group.map((d) => d.confidence));
    const best = group.sort((a, b) => b.confidence - a.confidence)[0];
    merged.push({
      category: best.category || 'shoes',
      name: best.name || 'Shoes',
      color: best.color,
      confidence: Math.min(0.95, confidence * 1.12 + 0.04),
      bbox,
    });
  }
  return [...others, ...merged];
}

/**
 * Soft boost for weak footwear hits (rain boots, dark shoes).
 */
export function boostLiveDetection(det: LiveDet): LiveDet {
  const boosted = isFootwearCategory(det.category)
    ? {
      ...det,
      confidence: Math.min(0.95, det.confidence * 1.2 + 0.05),
    }
    : det;
  return {
    ...boosted,
    confidence: adjustConfidenceForFraming(boosted.confidence, boosted.bbox),
  };
}

/**
 * True when multiple *distinct* items block auto-capture.
 * Footwear pairs never block.
 */
export function shouldBlockMultiItem(
  tracks: Array<{ category: string; bbox: LiveDetBBox }>,
  primaryAreaRatio = 1.35,
): boolean {
  const logical = coalesceFootwearTracks(tracks);
  if (logical.length < 2) return false;

  const areas = logical
    .map((t) => Math.max(0, t.bbox[2]) * Math.max(0, t.bbox[3]))
    .sort((a, b) => b - a);
  const dominant = areas[0] >= (areas[1] || 0) * primaryAreaRatio;
  return !dominant;
}

/** Merge side-by-side shoe tracks so UI + gating see one item. */
export function coalesceFootwearTracks<T extends {
  category: string;
  bbox: LiveDetBBox;
  confidence?: number;
  trackId?: string;
}>(tracks: T[]): T[] {
  if (tracks.length < 2) return tracks;
  const remaining = [...tracks];
  const out: T[] = [];
  while (remaining.length) {
    const seed = remaining.shift()!;
    const group = [seed];
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (isFootwearPair(seed, remaining[i])) {
        group.push(remaining.splice(i, 1)[0]);
      }
    }
    if (group.length === 1) {
      out.push(seed);
      continue;
    }
    const bbox = group.slice(1).reduce(
      (acc, d) => unionBBox(acc, d.bbox),
      group[0].bbox,
    );
    const best = [...group].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    out.push({ ...best, bbox });
  }
  return out;
}

export function countItemsInView(
  tracks: Array<{ category: string; bbox: LiveDetBBox }>,
): number {
  return coalesceFootwearTracks(tracks).length;
}

/** Distance / framing coaching for live scan. */
export function liveFramingHint(bbox: LiveDetBBox): string | null {
  const area = bbox[2] * bbox[3];
  const cx = bbox[0] + bbox[2] / 2;
  const cy = bbox[1] + bbox[3] / 2;
  if (area > 0.72) return 'Move back slightly';
  if (area < 0.032) return 'Move closer';
  if (cx < 0.16 || cx > 0.84 || cy < 0.12 || cy > 0.9) return 'Centre the item';
  return null;
}

/** Large subjects (boots close-up) often score weak — soften penalty. */
export function adjustConfidenceForFraming(confidence: number, bbox: LiveDetBBox): number {
  const area = bbox[2] * bbox[3];
  if (area > 0.55) return Math.min(0.95, confidence * 1.18 + 0.04);
  if (area > 0.38) return Math.min(0.95, confidence * 1.08 + 0.02);
  return confidence;
}

export function formatLiveStatusLine(inView: number, saved: number, hint?: string | null): string {
  const base = `${inView} in view · ${saved} saved`;
  if (hint?.trim()) return `${hint} · ${base}`;
  return base;
}
