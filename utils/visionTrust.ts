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

/**
 * Semantic specificity — finer labels beat coarse YOLO remaps.
 * Peers (sneakers vs boat shoes) share a band so confidence/recency decide.
 */
export function garmentSpecificityRank(
  args: { name?: string | null; subcategory?: string | null; category?: string | null },
): number {
  const blob = `${args.category || ''} ${args.subcategory || ''} ${args.name || ''}`.toLowerCase();
  if (!blob.trim()) return 0;
  // Bottoms
  if (/sweatpant|jogger|track\s*pant/.test(blob)) return 45;
  if (/chino|jean|slacks/.test(blob)) return 35;
  if (/trouser|\bpants?\b/.test(blob) && !/\bshorts?\b/.test(blob)) return 25;
  if (/\bshorts?\b/.test(blob)) return 30;
  if (/skirt/.test(blob)) return 30;
  // Footwear — peer band so Vision can flip YOLO boat↔sneaker mistakes
  if (/boat\s*shoe|deck\s*shoe|topsider/.test(blob)) return 28;
  if (/sneaker|trainer/.test(blob)) return 28;
  if (/chelsea|boot/.test(blob) && !/boat/.test(blob)) return 30;
  if (/loafer|oxford|derby/.test(blob)) return 27;
  if (/sandal|flip.?flop|slide/.test(blob)) return 26;
  if (/\bshoes?\b/.test(blob)) return 12;
  // Uppers / accessories
  if (/\btie\b|necktie|bow\s*tie/.test(blob)) return 40;
  if (/blazer|suit\s*jacket/.test(blob)) return 38;
  if (/dress[\s_-]*shirt|oxford[\s_-]*shirt|button[\s_-]?down/.test(blob)) return 36;
  if (/t-?shirt|\btee\b/.test(blob)) return 22;
  if (/top|shirt|clothing|garment/.test(blob)) return 10;
  return isSpecificVisionName(args.name) ? 18 : 5;
}

export type FusedIdentity = {
  name: string | null;
  subcategory?: string | null;
  adopted: 'prev' | 'next';
  reason: string;
};

/** Core garment type token — ignores colour words so Grey shorts ≠ Black shorts isn't a "type flip". */
export function coreGarmentToken(
  args: { name?: string | null; subcategory?: string | null },
): string {
  let blob = `${args.subcategory || ''} ${args.name || ''}`.toLowerCase();
  blob = blob
    .replace(/\b(light|dark|bright|deep|pale)\b/g, ' ')
    .replace(
      /\b(black|white|grey|gray|charcoal|navy|blue|red|green|brown|beige|cream|ivory|pink|purple|yellow|orange|multicolou?r|multi)\b/g,
      ' ',
    )
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/sweatpant/.test(blob)) return 'sweatpants';
  if (/jogger|track\s*pant/.test(blob)) return 'joggers';
  if (/chino/.test(blob)) return 'chinos';
  if (/jean/.test(blob)) return 'jeans';
  if (/trouser|slacks|\bpants?\b/.test(blob)) return 'trousers';
  if (/\bshorts?\b/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  if (/boat|deck|topsider/.test(blob)) return 'boat_shoes';
  if (/sneaker|trainer/.test(blob)) return 'sneakers';
  if (/chelsea|boot/.test(blob)) return 'boots';
  if (/loafer/.test(blob)) return 'loafers';
  if (/sandal|flip.?flop|slide/.test(blob)) return 'sandals';
  if (/\btie\b|necktie/.test(blob)) return 'tie';
  if (/blazer/.test(blob)) return 'blazer';
  if (/t-?shirt|\btee\b/.test(blob)) return 'tshirt';
  if (/shirt/.test(blob)) return 'shirt';
  if (/top/.test(blob)) return 'top';
  return blob || 'unknown';
}

/**
 * Fusion: specificity wins; else Vision/next when type token changes with good conf.
 * Prevents stable "Gray Trousers" from blocking "Gray Sweatpants".
 */
export function resolveFusedIdentity(
  prev: { name?: string | null; subcategory?: string | null; confidence?: number | null },
  next: { name?: string | null; subcategory?: string | null; confidence?: number | null },
): FusedIdentity {
  const prevName = preferVisionIdentityName(prev.name, prev.confidence ?? null, 0.4);
  const nextName = preferVisionIdentityName(next.name, next.confidence ?? null, 0.4);
  const prevConf = Number(prev.confidence ?? 0);
  const nextConf = Number(next.confidence ?? 0);
  const prevRank = garmentSpecificityRank({
    name: prev.name,
    subcategory: prev.subcategory,
  });
  const nextRank = garmentSpecificityRank({
    name: next.name,
    subcategory: next.subcategory,
  });
  const prevToken = coreGarmentToken(prev);
  const nextToken = coreGarmentToken(next);

  const pickNext = (reason: string): FusedIdentity => ({
    name: nextName || (next.name ? String(next.name).trim() : null),
    subcategory: next.subcategory ?? null,
    adopted: 'next',
    reason,
  });
  const pickPrev = (reason: string): FusedIdentity => ({
    name: prevName || (prev.name ? String(prev.name).trim() : null),
    subcategory: prev.subcategory ?? null,
    adopted: 'prev',
    reason,
  });

  if (!prevName && nextName) return pickNext('vision identity fill');
  if (prevName && !nextName) return pickPrev('hold specific identity');
  if (!prevName && !nextName) {
    return nextConf >= prevConf ? pickNext('confidence') : pickPrev('hold');
  }

  // Same display name
  if (String(prevName).toLowerCase() === String(nextName).toLowerCase()) {
    return pickPrev('agree');
  }

  // Specificity wins (sweatpants > trousers, tie > clothing, …)
  if (nextRank > prevRank + 2) return pickNext('specificity wins');
  if (prevRank > nextRank + 2 && prevToken === nextToken) return pickPrev('specificity holds');
  if (prevRank > nextRank + 2 && prevToken !== nextToken && nextConf < 0.75) {
    return pickPrev('specificity holds');
  }

  // Type-token flip (boat→sneaker, trousers→sweatpants already handled by rank):
  // Vision peer at ≥0.75 wins even against a 0.99 YOLO lock.
  if (prevToken !== nextToken && nextName && nextConf >= 0.75) {
    return pickNext('vision peer override');
  }

  if (nextConf >= prevConf + 0.15) return pickNext('confidence wins');

  return pickPrev('stability');
}

/** Canonical bottom subcategory when Vision names sweatpants/joggers. */
export function semanticBottomSubcategory(
  name?: string | null,
  subcategory?: string | null,
): string | null {
  const blob = `${subcategory || ''} ${name || ''}`.toLowerCase();
  if (/sweatpant/.test(blob)) return 'sweatpants';
  if (/jogger|track\s*pant/.test(blob)) return 'joggers';
  if (/chino/.test(blob)) return 'chinos';
  if (/jean/.test(blob)) return 'jeans';
  if (/\bshorts?\b|\bboxers?\b|\bbriefs?\b/.test(blob)) return 'shorts';
  if (/skirt/.test(blob)) return 'skirt';
  if (/trouser|slacks|\bpants?\b/.test(blob)) return 'trousers';
  return subcategory ? String(subcategory) : null;
}

/**
 * Strong Vision shorts signal — unlocks sweatpants/trousers locks.
 * Geometry-only YOLO "Shorts" boxes must NOT use this (persistence stays).
 */
export function isVisionShortsUnlock(
  next: { name?: string | null; subcategory?: string | null; confidence?: number | null },
): boolean {
  const conf = Number(next.confidence ?? 0);
  if (conf < 0.75) return false;
  const name = String(next.name || '').trim();
  const blob = `${next.subcategory || ''} ${name}`.toLowerCase();
  if (!/\bshorts?\b|\bboxers?\b|\bbriefs?\b/.test(blob)) return false;
  if (/check|plaid|stripe|pattern|cargo|athletic|bermuda|board|boxer|brief|swim|running|gym|chino\s*short|denim\s*short/.test(blob)) {
    return true;
  }
  if (!isSpecificVisionName(name)) return false;
  // Generic "Grey Shorts" / "Dark Shorts" — require very high conf
  if (/^((dark|light|bright)\s+)?(black|white|grey|gray|navy|blue|red|green|brown|beige|cream)\s+shorts?$/i.test(name)) {
    return conf >= 0.92;
  }
  return conf >= 0.85;
}

/** Accessory / tie detections Vision can inject when YOLO has no box. */
export function isVisionAccessoryDet(
  det: Pick<OnDeviceDetection, 'name' | 'subcategory' | 'category'>,
): boolean {
  const blob = blobOf(det);
  return /\btie\b|necktie|bow\s*tie|scarf|belt|watch|hat|cap\b/.test(blob)
    || /accessor/.test(blob);
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
 * Does NOT block a strong Vision shorts unlock (checkered shorts, boxers, etc.).
 */
export function resistsShortsGeometryDemotion(
  det: OnDeviceDetection | null | undefined,
  challenger?: { name?: string | null; subcategory?: string | null; confidence?: number | null },
): boolean {
  if (!det) return false;
  if (challenger && isVisionShortsUnlock(challenger)) return false;
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
