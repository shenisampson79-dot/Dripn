/**
 * Live AR overlay: source-image → preview coordinate mapping.
 *
 * Detection bboxes stay in normalized source space. This module only maps them
 * onto the camera preview (cover/contain scale + offsets). Do not change
 * detector geometry here.
 */

export type PreviewFitMode = 'cover' | 'contain';

export type NormalizedBBox = [number, number, number, number];

export type PreviewFit = {
  mode: PreviewFitMode;
  srcW: number;
  srcH: number;
  previewW: number;
  previewH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  scaledW: number;
  scaledH: number;
};

export type ScreenBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LiveBboxDiagnostic = {
  srcW: number;
  srcH: number;
  bbox: NormalizedBBox;
  previewW: number;
  previewH: number;
  fit: PreviewFitMode;
  scale: number;
  offsetX: number;
  offsetY: number;
  screen: ScreenBBox;
};

/** Camera preview fills the wrap — match VisionCamera default. */
export const LIVE_PREVIEW_FIT_MODE: PreviewFitMode = 'cover';

export function computePreviewFit(
  srcW: number,
  srcH: number,
  previewW: number,
  previewH: number,
  mode: PreviewFitMode = LIVE_PREVIEW_FIT_MODE,
): PreviewFit {
  const sw = Math.max(1, Number(srcW) || 1);
  const sh = Math.max(1, Number(srcH) || 1);
  const pw = Math.max(1, Number(previewW) || 1);
  const ph = Math.max(1, Number(previewH) || 1);
  const scale = mode === 'contain'
    ? Math.min(pw / sw, ph / sh)
    : Math.max(pw / sw, ph / sh);
  const scaledW = sw * scale;
  const scaledH = sh * scale;
  return {
    mode,
    srcW: sw,
    srcH: sh,
    previewW: pw,
    previewH: ph,
    scale,
    offsetX: (pw - scaledW) / 2,
    offsetY: (ph - scaledH) / 2,
    scaledW,
    scaledH,
  };
}

export function mapNormalizedBboxToPreview(
  bbox: NormalizedBBox,
  fit: PreviewFit,
): ScreenBBox {
  const [nx, ny, nw, nh] = bbox;
  return {
    x: nx * fit.srcW * fit.scale + fit.offsetX,
    y: ny * fit.srcH * fit.scale + fit.offsetY,
    w: nw * fit.srcW * fit.scale,
    h: nh * fit.srcH * fit.scale,
  };
}

export function liveBboxDiagnostic(
  bbox: NormalizedBBox,
  fit: PreviewFit,
): LiveBboxDiagnostic {
  return {
    srcW: fit.srcW,
    srcH: fit.srcH,
    bbox,
    previewW: fit.previewW,
    previewH: fit.previewH,
    fit: fit.mode,
    scale: fit.scale,
    offsetX: fit.offsetX,
    offsetY: fit.offsetY,
    screen: mapNormalizedBboxToPreview(bbox, fit),
  };
}

/** One-line tuple for console: srcW/srcH, bbox, previewW/previewH, fit, scale, offsets, screen. */
export function formatLiveBboxDiagnostic(d: LiveBboxDiagnostic): string {
  const b = d.bbox.map((n) => Number(n.toFixed(3)));
  const s = d.screen;
  return [
    `srcW=${d.srcW}`,
    `srcH=${d.srcH}`,
    `bbox=[${b.join(',')}]`,
    `previewW=${d.previewW}`,
    `previewH=${d.previewH}`,
    `fit=${d.fit}`,
    `scale=${Number(d.scale.toFixed(4))}`,
    `offsetX=${Number(d.offsetX.toFixed(2))}`,
    `offsetY=${Number(d.offsetY.toFixed(2))}`,
    `screen=[${[s.x, s.y, s.w, s.h].map((n) => Number(n.toFixed(1))).join(',')}]`,
  ].join(' ');
}
