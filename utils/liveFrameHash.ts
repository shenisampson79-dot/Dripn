/**
 * Cheap frame fingerprint for client-side dedupe before network calls.
 * Not cryptographic — good enough to skip near-identical sampled JPEGs.
 */

export function stripBase64Prefix(value: string): string {
  if (!value) return '';
  const idx = value.indexOf('base64,');
  return idx >= 0 ? value.slice(idx + 7) : value;
}

/** djb2-ish hash over sampled characters of a base64 JPEG. */
export function hashBase64Frame(base64: string): string {
  const raw = stripBase64Prefix(base64);
  if (!raw) return '';
  const len = raw.length;
  let h = 5381 >>> 0;
  // Sample head, mid, tail to stay cheap on large payloads
  const step = Math.max(1, Math.floor(len / 256));
  for (let i = 0; i < len; i += step) {
    h = (((h << 5) + h) ^ raw.charCodeAt(i)) >>> 0;
  }
  h = (((h << 5) + h) ^ (len & 0xffff)) >>> 0;
  return `${len.toString(36)}_${h.toString(16)}`;
}

/** True when frames are effectively unchanged. */
export function framesLikelySame(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}

/** Encoded byte-length component stored before the underscore in our hash. */
export function encodedFrameLength(hash: string | null | undefined): number | null {
  const raw = String(hash || '').split('_')[0];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 36);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function encodedFrameLengthDelta(
  previousHash: string | null | undefined,
  currentHash: string | null | undefined,
): number {
  const previous = encodedFrameLength(previousHash);
  const current = encodedFrameLength(currentHash);
  if (!previous || !current) return 0;
  return Math.abs(current - previous) / Math.max(previous, current);
}

export type LiveSceneDetection = {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
  color?: string | null;
  confidence?: number | null;
  bbox?: number[] | null;
};

const UPPER_RE = /top|shirt|tee|blouse|jacket|blazer|coat|outer|hoodie|sweater|knit|dress/i;
const LAYER_RE = /jacket|blazer|coat|outer|hoodie|cardigan|overshirt|gilet|vest/i;
const UNKNOWN_COLOR_RE = /^(unknown|other|none|n\/a|-)?$/i;

function blob(det: LiveSceneDetection): string {
  return `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
}

function upperDetections(detections: LiveSceneDetection[]): LiveSceneDetection[] {
  return (detections || []).filter((det) => UPPER_RE.test(blob(det)));
}

function bboxMetric(det: LiveSceneDetection): { width: number; area: number } | null {
  const box = det.bbox;
  if (!Array.isArray(box) || box.length < 4) return null;
  const width = Number(box[2]);
  const height = Number(box[3]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, area: width * height };
}

function relativeDelta(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(a, b);
}

/**
 * Event signal for classes YOLO cannot represent (notably a newly worn jacket).
 * It compares against the last cloud-verified scene, not the previous frame, so
 * gradual changes accumulate. A high JPEG-size delta is a fallback when YOLO's
 * top box stays generic.
 */
export function hasMeaningfulLiveSceneChange(
  baselineDetections: LiveSceneDetection[],
  currentDetections: LiveSceneDetection[],
  baselineFrameHash?: string | null,
  currentFrameHash?: string | null,
): boolean {
  const previousUppers = upperDetections(baselineDetections);
  const currentUppers = upperDetections(currentDetections);
  if (!previousUppers.length || !currentUppers.length) return false;
  if (previousUppers.length !== currentUppers.length) return true;

  const strongest = (list: LiveSceneDetection[]) =>
    [...list].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
  const previous = strongest(previousUppers);
  const current = strongest(currentUppers);
  const previousBlob = blob(previous);
  const currentBlob = blob(current);

  // A layer cue appearing where there was none is the strongest direct signal.
  if (LAYER_RE.test(currentBlob) !== LAYER_RE.test(previousBlob)
    && Number(current.confidence || 0) >= 0.6) {
    return true;
  }

  const previousColor = String(previous.color || '').trim().toLowerCase();
  const currentColor = String(current.color || '').trim().toLowerCase();
  if (
    previousColor !== currentColor
    && !UNKNOWN_COLOR_RE.test(previousColor)
    && !UNKNOWN_COLOR_RE.test(currentColor)
    && Number(current.confidence || 0) >= 0.6
  ) {
    return true;
  }

  const previousBox = bboxMetric(previous);
  const currentBox = bboxMetric(current);
  if (previousBox && currentBox) {
    if (relativeDelta(previousBox.width, currentBox.width) >= 0.12) return true;
    if (relativeDelta(previousBox.area, currentBox.area) >= 0.18) return true;
  }

  // JPEG length is not semantic by itself, so require a large cumulative shift.
  return encodedFrameLengthDelta(baselineFrameHash, currentFrameHash) >= 0.18;
}
