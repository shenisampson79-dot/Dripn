/**
 * Published Live identity — Cloud/Vision owns first publish and copy.
 *
 * Launch: YOLO is fully off the critical path (no identity, belief, score, or
 * boxes). Staff DBG may still mention it; customer HUD never shows engine tokens
 * such as Reject:skin_overlap.
 */

/** Launch kill switch — do not run YOLO for identity, boxes, or belief. */
export const LIVE_YOLO_ENABLED = false;

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import {
  beliefKindFromDetection,
  colorFromVisionName,
  type GarmentBelief,
  type OutfitBeliefState,
} from '@/utils/liveGarmentBelief';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';

const ENGINE_HUD_RE =
  /REJECT\s*:?\s*skin_overlap|skin_overlap\s+\d|\bREJECT\s*:|\bnms\s*=|\bguard\s*=|\bYOLO_PROVEN\b|\bPIPELINE_PROVEN\b|\bBELIEF_PROVEN\b|\bANALYSIS_START\b|\bgarments_ok\b/i;

const ENGINE_LABEL_JUNK_RE =
  /\b(PASS|REJECT)\b|:skin_overlap|skin_overlap\s*[\d.>\s()]+/gi;

export function liveCloudPathBlockedByYoloProof(opts: {
  requireYoloProof: boolean;
  yoloProofOnly: boolean;
  yoloProven: boolean;
  yoloEnabled?: boolean;
}): boolean {
  if (opts.yoloEnabled === false) return false;
  if (opts.yoloProofOnly) return true;
  if (opts.requireYoloProof && !opts.yoloProven) return true;
  return false;
}

export function isLiveEngineHudText(text: string | null | undefined): boolean {
  return ENGINE_HUD_RE.test(String(text || ''));
}

/** Strip engine tokens from customer HUD. Empty if nothing user-facing remains. */
export function sanitizeLiveUserHudText(text: string | null | undefined): string {
  let t = String(text || '');
  if (!t) return '';
  t = t.replace(ENGINE_LABEL_JUNK_RE, ' ');
  t = t.replace(/\d\.\d+\s*>\s*\d\.\d+(?:\s*\([^)]*\))?/g, ' ');
  t = t.replace(/\(\s*[\d.]+\s*\)/g, ' ');
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  if (isLiveEngineHudText(t)) return '';
  return t;
}

export function sanitizeLiveBoxLabel(raw: string | null | undefined): string {
  const original = String(raw || '');
  if (!original.trim()) return '';
  // Engine overlay names ("Maxi dress PASS", "Trousers REJECT:skin_overlap")
  // never belong on the customer box — staff DBG keeps the raw string.
  if (/\b(PASS|REJECT)\b|skin_overlap/i.test(original)) return '';
  const cleaned = sanitizeLiveUserHudText(raw);
  if (!cleaned) return '';
  if (/^(item|top|bottom|clothing|garment)$/i.test(cleaned)) return '';
  return cleaned;
}

const PROVISIONAL_HEADLINE_RE = /^(Settling in|Almost there)$/i;

/** True when the pill is the pre-lock placeholder, not a published lane. */
export function isProvisionalLiveHeadline(headline: string | null | undefined): boolean {
  return PROVISIONAL_HEADLINE_RE.test(String(headline || '').trim());
}

/**
 * After a score is on screen, keep ~78 (approx) — never the "Settling in" pill.
 */
export function blankProvisionalHeadlineAfterScore(
  headline: string | null | undefined,
  score: number | null | undefined,
): string {
  const h = String(headline || '').trim();
  if (score == null || !Number.isFinite(Number(score))) return h;
  if (isProvisionalLiveHeadline(h)) return '';
  return h;
}

/**
 * Customer overlay boxes. Launch: YOLO is off, so this returns no boxes.
 * If re-enabled, map geometry onto published Cloud names — never YOLO labels.
 */
export function detectionsForCustomerPaint(
  yolo: OnDeviceDetection[],
  truth: LiveOutfitTruth | null | undefined,
): OnDeviceDetection[] {
  if (!LIVE_YOLO_ENABLED) return [];
  if (hasPublishedLiveCore(truth)) {
    return mapYoloBoxesOntoPublishedTruth(yolo, truth);
  }
  return (yolo || []).map((d) => ({
    ...d,
    name: '',
  }));
}

export function hasPublishedLiveCore(
  truth: LiveOutfitTruth | null | undefined,
): boolean {
  if (!truth) return false;
  if (isPublishedDress(truth)) return true;
  return Boolean(truth.top?.name && truth.bottom?.name);
}

function isPublishedDress(truth: LiveOutfitTruth): boolean {
  return isDressItem(truth.top) || isDressItem(truth.bottom);
}

function isDressItem(item: LiveTruthItem | null | undefined): boolean {
  if (!item) return false;
  const blob = `${item.category} ${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/dress[\s_-]*shirt|shirt[\s_-]*dress/.test(blob)) return false;
  return /\bdress\b/.test(blob);
}

function bboxCenterY(bbox?: [number, number, number, number] | number[] | null): number {
  if (!bbox || bbox.length < 4) return 0.5;
  return Number(bbox[1]) + Number(bbox[3]) / 2;
}

function bboxHeight(bbox?: [number, number, number, number] | number[] | null): number {
  if (!bbox || bbox.length < 4) return 0;
  return Number(bbox[3]) || 0;
}

function isFullBodyMisread(det: OnDeviceDetection): boolean {
  const blob = `${det.name || ''} ${det.subcategory || ''} ${det.category || ''}`.toLowerCase();
  return bboxHeight(det.bbox) >= 0.55 && /\bdress\b|trouser|\bpants?\b/.test(blob);
}

function slotRegion(slot: 'top' | 'layer' | 'bottom' | 'footwear'): [number, number] {
  if (slot === 'footwear') return [0.72, 1];
  if (slot === 'bottom') return [0.38, 0.88];
  return [0, 0.48];
}

function inRegion(det: OnDeviceDetection, slot: 'top' | 'layer' | 'bottom' | 'footwear'): boolean {
  const y = bboxCenterY(det.bbox);
  const [lo, hi] = slotRegion(slot);
  return y >= lo && y <= hi;
}

function pickBoxForSlot(
  yolo: OnDeviceDetection[],
  slot: 'top' | 'layer' | 'bottom' | 'footwear',
  published: LiveTruthItem,
): OnDeviceDetection | null {
  const regional = yolo.filter((d) => inRegion(d, slot));
  const pool = regional.length ? regional : yolo;
  if (!pool.length) return null;
  const targetY = bboxCenterY(published.bbox);
  return [...pool].sort((a, b) => {
    const aFull = isFullBodyMisread(a) ? 1 : 0;
    const bFull = isFullBodyMisread(b) ? 1 : 0;
    if (aFull !== bFull) return aFull - bFull;
    return Math.abs(bboxCenterY(a.bbox) - targetY) - Math.abs(bboxCenterY(b.bbox) - targetY);
  })[0] || null;
}

function detectionFromPublished(
  item: LiveTruthItem,
  trackId: string,
  bbox?: [number, number, number, number],
): OnDeviceDetection {
  return {
    name: item.name,
    category: item.category || 'tops',
    subcategory: item.subcategory,
    color: item.color || undefined,
    confidence: Math.max(0.85, Number(item.confidence) || 0.85),
    bbox: bbox || item.bbox || [0.25, 0.2, 0.4, 0.35],
    trackId,
    source: 'published_cloud',
  };
}

/**
 * True when raw YOLO labels would replace a published top+bottom (or dress)
 * with maxi dress / trousers / engine rejects.
 */
export function yoloWouldOverwritePublishedIdentity(
  yolo: OnDeviceDetection[],
  truth: LiveOutfitTruth | null | undefined,
): boolean {
  if (!hasPublishedLiveCore(truth) || !truth) return false;
  const publishedDress = isPublishedDress(truth);
  const publishedShorts = /short/i.test(
    `${truth.bottom?.name || ''} ${truth.bottom?.subcategory || ''}`,
  );
  return yolo.some((d) => {
    const blob = `${d.name || ''} ${d.subcategory || ''} ${d.category || ''}`.toLowerCase();
    if (/reject\s*:|skin_overlap/.test(blob)) return true;
    if (!publishedDress && /\bdress\b/.test(blob) && truth.top && truth.bottom) return true;
    if (publishedShorts && /trouser|\bpants?\b/.test(blob) && !/short/.test(blob)) return true;
    return false;
  });
}

/**
 * Map YOLO boxes onto published Cloud names. Raw YOLO labels never leave this
 * function as the painted identity.
 */
export function mapYoloBoxesOntoPublishedTruth(
  yolo: OnDeviceDetection[],
  truth: LiveOutfitTruth | null | undefined,
): OnDeviceDetection[] {
  if (!hasPublishedLiveCore(truth) || !truth) {
    return (yolo || []).filter((d) => !isLiveEngineHudText(d.name || ''));
  }

  const slots: Array<{ key: 'top' | 'layer' | 'bottom' | 'footwear'; item: LiveTruthItem }> = [];
  if (truth.top && !isDressItem(truth.top)) slots.push({ key: 'top', item: truth.top });
  if (truth.layer) slots.push({ key: 'layer', item: truth.layer });
  if (truth.bottom) slots.push({ key: 'bottom', item: truth.bottom });
  else if (isDressItem(truth.top) && truth.top) slots.push({ key: 'bottom', item: truth.top });
  if (truth.footwear) slots.push({ key: 'footwear', item: truth.footwear });

  const used = new Set<OnDeviceDetection>();
  const out: OnDeviceDetection[] = [];
  for (const slot of slots) {
    const picked = pickBoxForSlot(
      yolo.filter((d) => !used.has(d)),
      slot.key,
      slot.item,
    );
    if (picked) used.add(picked);
    const bbox = picked && !isFullBodyMisread(picked)
      ? picked.bbox
      : slot.item.bbox;
    out.push(detectionFromPublished(slot.item, `pub_${slot.key}`, bbox));
  }
  return out;
}

function cloudRole(
  item: { category?: string | null; subcategory?: string | null; name?: string | null },
): 'top' | 'layer' | 'bottom' | 'footwear' | 'dress' | null {
  const kind = beliefKindFromDetection({
    name: item.name || undefined,
    category: String(item.category || ''),
    subcategory: item.subcategory || undefined,
    confidence: 1,
    bbox: [0, 0, 1, 1],
  });
  if (kind === 'shoes') return 'footwear';
  if (kind === 'dress') return 'dress';
  if (kind === 'shorts' || kind === 'trousers' || kind === 'skirt') return 'bottom';
  if (kind === 'outerwear') return 'layer';
  if (kind === 'top') return 'top';
  return null;
}

function patchSlot(
  prev: GarmentBelief | null | undefined,
  cloud: {
    name?: string | null;
    category?: string | null;
    subcategory?: string | null;
    color?: string | null;
    confidence?: number | null;
    bbox?: [number, number, number, number] | null;
  },
  kind: GarmentBelief['kind'],
): GarmentBelief {
  const name = String(cloud.name || prev?.name || '').trim();
  const color = colorFromVisionName(name) || cloud.color || prev?.color || null;
  const now = Date.now();
  return {
    kind,
    category: String(cloud.category || prev?.category || ''),
    subcategory: String(cloud.subcategory || prev?.subcategory || ''),
    name,
    color: color ? String(color) : null,
    confidence: Math.max(Number(prev?.confidence) || 0, Number(cloud.confidence) || 0, 0.85),
    stability: Math.max(Number(prev?.stability) || 0, 0.6),
    bbox: (cloud.bbox && cloud.bbox.length === 4
      ? cloud.bbox
      : prev?.bbox) || [0.25, 0.2, 0.4, 0.35],
    trackId: prev?.trackId,
    corrected: true,
    lastChangedAt: prev && prev.name === name ? (prev.lastChangedAt || now) : now,
    lastSeenAt: now,
  };
}

/**
 * Cloud/hybrid garment names become the published identity — including colour
 * words (grey vs black). YOLO-held names must not survive this merge.
 */
export function adoptCloudIdentityIntoBelief(
  belief: OutfitBeliefState | null | undefined,
  cloudItems: Array<{
    name?: string | null;
    category?: string | null;
    subcategory?: string | null;
    color?: string | null;
    confidence?: number | null;
    bbox?: [number, number, number, number] | null;
  }> | null | undefined,
): OutfitBeliefState | null {
  if (!belief) return belief ?? null;
  const items = (cloudItems || []).filter((it) => Number(it.confidence) >= 0.8 && it.name);
  if (!items.length) return belief;

  const next: OutfitBeliefState = { ...belief };
  let cloudTop = false;
  let cloudBottom = false;
  for (const item of items) {
    const role = cloudRole(item);
    if (role === 'dress') {
      next.bottom = patchSlot(next.bottom, item, 'dress');
      cloudBottom = true;
    } else if (role === 'top') {
      next.top = patchSlot(next.top, item, 'top');
      cloudTop = true;
    } else if (role === 'layer') {
      next.layer = patchSlot(next.layer, item, 'outerwear');
    } else if (role === 'bottom') {
      const kind = beliefKindFromDetection({
        name: item.name || undefined,
        category: String(item.category || 'bottoms'),
        subcategory: item.subcategory || undefined,
        confidence: 1,
        bbox: item.bbox || [0, 0.4, 1, 0.4],
      });
      next.bottom = patchSlot(
        next.bottom,
        item,
        kind === 'trousers' || kind === 'skirt' || kind === 'shorts' ? kind : 'shorts',
      );
      cloudBottom = true;
    } else if (role === 'footwear') {
      next.footwear = patchSlot(next.footwear, item, 'shoes');
    }
  }
  if (cloudTop && cloudBottom && next.bottom?.kind === 'dress') {
    // Cloud named a separate top — do not keep a YOLO one-piece dress.
    const bottomItem = items.find((it) => cloudRole(it) === 'bottom');
    if (bottomItem) {
      const kind = beliefKindFromDetection({
        name: bottomItem.name || undefined,
        category: String(bottomItem.category || 'bottoms'),
        subcategory: bottomItem.subcategory || undefined,
        confidence: 1,
        bbox: bottomItem.bbox || [0, 0.4, 1, 0.4],
      });
      next.bottom = patchSlot(
        next.bottom,
        bottomItem,
        kind === 'trousers' || kind === 'skirt' ? kind : 'shorts',
      );
    }
  }
  return next;
}
