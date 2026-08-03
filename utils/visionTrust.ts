/**
 * Trust Vision First — high-confidence cloud/YOLO labels are ground truth.
 * Geometry / memory may refine bbox or colour; they must not redefine category.
 */

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

export const VISION_TRUST_CONF = 0.6;

export type TrustedGarmentFamily =
  | 'trousers'
  | 'shorts'
  | 'skirt'
  | 'boots'
  | 'dress_shirt'
  | 'blazer'
  | 'tie'
  | null;

export type VisionMutationDiff = {
  stage: string;
  before: string;
  after: string;
  reason: string;
};

function blobOf(det: Pick<OnDeviceDetection, 'name' | 'subcategory' | 'category'>): string {
  return `${det.category || ''} ${det.subcategory || ''} ${det.name || ''}`.toLowerCase();
}

function labelKey(det: OnDeviceDetection | null | undefined): string {
  if (!det) return '∅';
  return `${det.category || '?'}/${det.subcategory || '?'}/${det.name || '?'}`;
}

/**
 * Specific vision display names (e.g. "Gray Sweatpants", "Multicolor Boat Shoes").
 * When present, never rebuild from color + category.
 */
export function isSpecificVisionName(name?: string | null): boolean {
  const n = String(name || '').trim();
  if (n.length < 4) return false;
  if (/^(top|item|bottom|shoes?|garment)$/i.test(n)) return false;
  return /[a-z]/i.test(n) && /\s/.test(n);
}

/** Prefer locked vision identity label over any color+subtype rebuild. */
export function preferVisionIdentityName(
  name?: string | null,
  conf?: number | null,
  minConf = 0.45,
): string | null {
  if (conf != null && conf < minConf) return null;
  return isSpecificVisionName(name) ? String(name).trim() : null;
}

/** Strong garment families that must not be geometry-rewritten when confidence is high. */
export function trustedGarmentFamily(
  det: OnDeviceDetection | null | undefined,
): TrustedGarmentFamily {
  if (!det || (det.confidence ?? 0) < VISION_TRUST_CONF) return null;
  const blob = blobOf(det);
  if (/dress[\s_-]*shirt|oxford[\s_-]*shirt|button[\s_-]?down|button[\s_-]?up/.test(blob)
    && !/\b(maxi|midi|mini)\s*dress\b/.test(blob)) {
    return 'dress_shirt';
  }
  if (/blazer|suit\s*jacket/.test(blob)) return 'blazer';
  if (/\btie\b|necktie|bow\s*tie/.test(blob)) return 'tie';
  if (/\bboots?\b|chelsea/.test(blob) && !/boat|deck/.test(blob)) return 'boots';
  if (/\bshorts?\b/.test(blob) && !/shirt/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  if (/trouser|jean|chino|pant(?!y)|slacks|sweatpant|jogger|track\s*pant/.test(blob)) return 'trousers';
  return null;
}

export function isTrustedVisionBottom(det: OnDeviceDetection | null | undefined): boolean {
  const f = trustedGarmentFamily(det);
  return f === 'trousers' || f === 'shorts' || f === 'skirt';
}

/**
 * Sweatpants/joggers — never demote to shorts via geometry, at any confidence.
 * Chinos/jeans/slacks resist when confidence is at least VISION_TRUST_CONF.
 */
export function resistsShortsGeometryDemotion(
  det: OnDeviceDetection | null | undefined,
): boolean {
  if (!det) return false;
  const blob = blobOf(det);
  // Hard identity lock — geometry must never rewrite these
  if (/sweatpant|jogger|track\s*pant/.test(blob)) return true;
  if ((det.confidence ?? 0) < VISION_TRUST_CONF) return false;
  return /chino|jean|slacks/.test(blob);
}

export function isTrustedVisionBoots(det: OnDeviceDetection | null | undefined): boolean {
  return trustedGarmentFamily(det) === 'boots';
}

/** Diff category/subcategory/name between input detections and belief output. */
export function diffVisionToBelief(
  before: OnDeviceDetection[],
  after: OnDeviceDetection[],
  stage = 'belief',
): VisionMutationDiff[] {
  const diffs: VisionMutationDiff[] = [];
  const afterByRole = new Map<string, OnDeviceDetection>();
  for (const d of after) {
    const role = /shoe|boot|sneaker|trainer|loafer|sandal|flip|slide/i.test(blobOf(d))
      ? 'footwear'
      : /bottom|trouser|short|skirt|pant|chino|jean|dress/i.test(blobOf(d))
        && !/dress[\s_-]*shirt/i.test(blobOf(d))
        ? 'bottom'
        : /outer|blazer|jacket|coat/i.test(blobOf(d))
          ? 'layer'
          : 'top';
    const prev = afterByRole.get(role);
    if (!prev || d.confidence > prev.confidence) afterByRole.set(role, d);
  }

  for (const d of before) {
    const trust = trustedGarmentFamily(d);
    const specific = isSpecificVisionName(d.name);
    if (!trust && !specific) continue;
    const role = trust === 'boots' ? 'footwear'
      : trust === 'trousers' || trust === 'shorts' || trust === 'skirt' ? 'bottom'
        : trust === 'blazer' ? 'layer'
          : /shoe|boot|sneaker|trainer|loafer|sandal|boat|flip|slide/i.test(blobOf(d))
            ? 'footwear'
            : /bottom|trouser|short|skirt|pant|chino|jean|sweatpant|jogger/i.test(blobOf(d))
              ? 'bottom'
              : 'top';
    const out = afterByRole.get(role);
    const beforeKey = labelKey(d);
    const afterKey = labelKey(out);
    if (beforeKey === afterKey) continue;

    const beforeSub = String(d.subcategory || '').toLowerCase();
    const afterSub = String(out?.subcategory || '').toLowerCase();
    const beforeName = String(d.name || '').toLowerCase();
    const afterName = String(out?.name || '').toLowerCase();
    const lost = !out;
    const token = beforeName.split(/\s+/).find((w) => w.length > 3) || '';
    const benignTrouserCanon =
      trust === 'trousers'
      && /trouser|chino|jean|pant|slacks|sweatpant|jogger/.test(`${afterSub} ${afterName}`)
      && !/short/.test(`${afterSub} ${afterName}`)
      && (!specific || !token || afterName.includes(token));
    const benignBootCanon =
      trust === 'boots'
      && /boot|chelsea/.test(`${afterSub} ${afterName}`);
    const identityLost =
      specific
      && !!out
      && beforeName !== afterName
      && (
        /dark\s*(trouser|short)/i.test(afterName)
        || (/^((dark|black|grey|gray|red|blue|white|multicolou?r)\s+)?(top|trousers?|shorts?|boat shoes)$/i.test(afterName)
          && (!token || !afterName.includes(token)))
      );
    const flipped =
      (trust === 'trousers' && /short/.test(`${afterSub} ${afterName}`))
      || (trust === 'boots' && /sneaker|trainer/.test(`${afterSub} ${afterName}`))
      || (trust === 'dress_shirt' && (lost || (/\bdress\b/.test(afterName) && !/shirt/.test(afterName))))
      || (trust === 'shorts' && /trouser|dress/.test(`${afterSub} ${afterName}`) && !/short/.test(afterSub))
      || (beforeSub && afterSub && beforeSub !== afterSub
        && !benignTrouserCanon && !benignBootCanon
        && trust !== 'dress_shirt' && trust !== 'blazer' && trust !== 'tie');

    if (lost || identityLost || (flipped && !benignTrouserCanon && !benignBootCanon)) {
      diffs.push({
        stage,
        before: beforeKey,
        after: afterKey,
        reason: lost
          ? `trusted ${trust || 'label'} dropped`
          : identityLost
            ? 'vision identity rewritten'
            : `trusted ${trust} rewritten`,
      });
    }
  }
  return diffs;
}
