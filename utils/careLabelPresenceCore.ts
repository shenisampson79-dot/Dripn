/**
 * Pure care-label presence scoring (no RN / Expo imports).
 */
import type { QuickAddCaptureUi } from '@/utils/quickAddAutoCapture';

export type CareLabelPresenceMetrics = {
  score: number;
  meanLuma: number;
  contrast: number;
  brightRatio: number;
};

/** Normalised ROI matching the tall portrait guide (centre of frame). */
export const CARE_LABEL_ROI = {
  x: 0.28,
  y: 0.16,
  width: 0.44,
  height: 0.58,
} as const;

export const CARE_LABEL_PRESENCE = {
  holdScore: 0.34,
  readyScore: 0.5,
  sampleWidth: 180,
} as const;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function scoreCareLabelRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  roi = CARE_LABEL_ROI,
): CareLabelPresenceMetrics {
  const x0 = Math.max(0, Math.floor(roi.x * width));
  const y0 = Math.max(0, Math.floor(roi.y * height));
  const x1 = Math.min(width, Math.ceil((roi.x + roi.width) * width));
  const y1 = Math.min(height, Math.ceil((roi.y + roi.height) * height));

  let sum = 0;
  let sumSq = 0;
  let bright = 0;
  let edge = 0;
  let n = 0;
  let edgeN = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const L = luma(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
      sum += L;
      sumSq += L * L;
      n += 1;
      if (L >= 150) bright += 1;

      if (x + 1 < x1) {
        const j = (y * width + (x + 1)) * 4;
        const L2 = luma(rgba[j] ?? 0, rgba[j + 1] ?? 0, rgba[j + 2] ?? 0);
        edge += Math.abs(L - L2);
        edgeN += 1;
      }
      if (y + 1 < y1) {
        const j = ((y + 1) * width + x) * 4;
        const L2 = luma(rgba[j] ?? 0, rgba[j + 1] ?? 0, rgba[j + 2] ?? 0);
        edge += Math.abs(L - L2);
        edgeN += 1;
      }
    }
  }

  if (n < 20) {
    return { score: 0, meanLuma: 0, contrast: 0, brightRatio: 0 };
  }

  const meanLuma = sum / n;
  const variance = Math.max(0, sumSq / n - meanLuma * meanLuma);
  const std = Math.sqrt(variance);
  const contrast = edgeN > 0 ? edge / edgeN : std;
  const brightRatio = bright / n;

  const brightnessTerm = clamp01((meanLuma - 70) / 110);
  const contrastTerm = clamp01(contrast / 28);
  const brightTerm = clamp01(brightRatio / 0.35);
  let score = 0.3 * brightnessTerm + 0.45 * contrastTerm + 0.25 * brightTerm;

  if (meanLuma > 170 && contrast < 8) score *= 0.35;
  if (meanLuma < 55) score *= 0.25;

  return {
    score: clamp01(score),
    meanLuma,
    contrast,
    brightRatio,
  };
}

export function presenceToUi(score: number): { ui: QuickAddCaptureUi; hint: string } {
  if (score >= CARE_LABEL_PRESENCE.readyScore) {
    return { ui: 'ready', hint: 'Label in view — hold still or tap capture' };
  }
  if (score >= CARE_LABEL_PRESENCE.holdScore) {
    return { ui: 'hold', hint: 'Almost — fill the tall box with the tag' };
  }
  return { ui: 'idle', hint: 'Fill the tall box with the care label' };
}
