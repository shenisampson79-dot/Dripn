/**
 * Suspicious on-device reads that should escalate to cloud Vision now, rather
 * than waiting for the next verify pass.
 *
 * YOLO reports confidence in its own label, not in whether the label is right.
 * The two field failures — full-length trousers called "shorts" because the box
 * stopped mid-calf, and a pink top read as green under warm light — both looked
 * perfectly confident. These are cheap, checkable contradictions: ask once per
 * belief, not once per frame.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { roleOfCategory } from '@/utils/liveDetectionMemory';

/** A shorts box reaching this far down the frame has covered too much leg. */
export const SHORTS_MAX_BOTTOM_EDGE = 0.62;
/** A shorts box taller than this covers thigh to calf — trouser territory. */
export const SHORTS_MAX_HEIGHT = 0.22;

const UNRELIABLE_COLOUR_RE = /^(other|unknown|dark|light|neutral|)$/i;

export type SuspectLiveRead = {
  reason: 'bottom_length' | 'garment_colour';
  /** Stable key for the belief being questioned — ask once, not every frame. */
  signature: string;
};

function bbox(det: OnDeviceDetection): [number, number, number, number] {
  const b = det.bbox;
  return (Array.isArray(b) && b.length === 4 ? b : [0, 0, 0, 0]) as [number, number, number, number];
}

function labelBlob(det: OnDeviceDetection): string {
  return `${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
}

/**
 * Geometry contradicts a shorts label: shorts end above the knee, so a box that
 * runs deep into the lower frame is either trousers or a skirt.
 */
export function looksTooLongForShorts(det: OnDeviceDetection): boolean {
  if (!/\bshorts?\b/.test(labelBlob(det))) return false;
  // Swim / boxer / patterned shorts are Vision-confirmed identities already.
  if (/swim|board|boxer|brief|trunk/.test(labelBlob(det))) return false;
  const [, y, , h] = bbox(det);
  if (!(h > 0)) return false;
  return y + h >= SHORTS_MAX_BOTTOM_EDGE || h >= SHORTS_MAX_HEIGHT;
}

/** A garment we are painting without a colour we can defend. */
export function hasUnreliableColour(det: OnDeviceDetection): boolean {
  return UNRELIABLE_COLOUR_RE.test(String(det.color || '').trim());
}

/**
 * First contradiction worth a cloud call, or null when the read is coherent.
 * Length outranks colour: a wrong garment type changes the score, a wrong
 * colour only changes the copy.
 */
export function detectSuspectLiveRead(
  detections: OnDeviceDetection[],
): SuspectLiveRead | null {
  const list = Array.isArray(detections) ? detections : [];
  const bottoms = list.filter((d) => roleOfCategory(d.category, d.subcategory) === 'bottom');
  const uppers = list.filter((d) => roleOfCategory(d.category, d.subcategory) === 'top');

  for (const det of bottoms) {
    if (looksTooLongForShorts(det)) {
      return {
        reason: 'bottom_length',
        signature: `length:${det.subcategory || 'bottom'}:${det.color || 'na'}`,
      };
    }
  }

  for (const det of [...uppers, ...bottoms]) {
    if (hasUnreliableColour(det)) {
      return {
        reason: 'garment_colour',
        signature: `colour:${roleOfCategory(det.category, det.subcategory)}:${det.subcategory || 'na'}`,
      };
    }
  }

  return null;
}
