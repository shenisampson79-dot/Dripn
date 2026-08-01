/**
 * Pass the Quick Add front photo into Improve Recognition without stuffing
 * large base64 into navigation params (which can silently drop / fail).
 */
let pendingFrontUri: string | null = null;
let pendingFrontBase64: string | null = null;

export function setImproveRecognitionFrontHandoff(opts: {
  uri?: string | null;
  base64?: string | null;
}) {
  pendingFrontUri = opts.uri ? String(opts.uri) : null;
  pendingFrontBase64 = opts.base64
    ? String(opts.base64).replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
    : null;
}

export function takeImproveRecognitionFrontHandoff(): {
  uri: string | null;
  base64: string | null;
} {
  const out = { uri: pendingFrontUri, base64: pendingFrontBase64 };
  pendingFrontUri = null;
  pendingFrontBase64 = null;
  return out;
}
