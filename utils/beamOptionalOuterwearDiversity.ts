/**
 * Optional-outerwear beam diversity guard (client mirror of server beam construction).
 *
 * When multiple eligible outerwear pieces exist, one item must not monopolize every
 * surviving beam candidate before rerank/evaluation. The highest-ranked piece may
 * still win — we only guarantee at least one valid alternative is represented.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { isOuterwearItem } from '@/utils/completeOutfit';

export type BeamOutfitCandidate = {
  items: WardrobeItem[];
  score?: number;
};

export function outerwearIdFromCandidate(items: WardrobeItem[]): string | null {
  const hit = (items || []).find(isOuterwearItem);
  return hit ? String(hit.id) : null;
}

export function stripOuterwear(items: WardrobeItem[]): WardrobeItem[] {
  return (items || []).filter((item) => !isOuterwearItem(item));
}

export function replaceOuterwearOnCandidate<T extends BeamOutfitCandidate>(
  candidate: T,
  outerwear: WardrobeItem,
): T {
  return {
    ...candidate,
    items: [...stripOuterwear(candidate.items), outerwear],
  };
}

/**
 * After optional outerwear is attached to beam candidates, ensure a single
 * outerwear id does not occupy every candidate when valid alternatives exist.
 */
export function ensureBeamOptionalOuterwearDiversity<T extends BeamOutfitCandidate>(
  beam: T[],
  findValidAlternative: (
    baseWithoutOuterwear: WardrobeItem[],
    excludeOuterwearIds: Set<string>,
  ) => WardrobeItem | undefined,
): T[] {
  if (!Array.isArray(beam) || beam.length < 2) return beam;

  const withOuterwear = beam.filter((candidate) => outerwearIdFromCandidate(candidate.items));
  if (withOuterwear.length < 2) return beam;

  const outerwearIds = withOuterwear.map((candidate) => outerwearIdFromCandidate(candidate.items)!);
  const uniqueOuterwear = new Set(outerwearIds);
  if (uniqueOuterwear.size > 1) return beam;

  const dominantId = outerwearIds[0];
  const exclude = new Set([dominantId]);

  const swapOrder = [...withOuterwear].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  for (const candidate of swapOrder) {
    const base = stripOuterwear(candidate.items);
    const alt = findValidAlternative(base, exclude);
    if (!alt || String(alt.id) === dominantId) continue;

    const idx = beam.indexOf(candidate);
    if (idx < 0) continue;

    const next = [...beam];
    next[idx] = replaceOuterwearOnCandidate(candidate, alt);
    return next;
  }

  return beam;
}

/**
 * Simulate beam monopoly detection for tests / diagnostics.
 */
export function beamOptionalOuterwearIds(beam: BeamOutfitCandidate[]): string[] {
  return beam
    .map((candidate) => outerwearIdFromCandidate(candidate.items))
    .filter((id): id is string => Boolean(id));
}

export function beamHasOptionalOuterwearMonopoly(beam: BeamOutfitCandidate[]): boolean {
  const ids = beamOptionalOuterwearIds(beam);
  if (ids.length < 2) return false;
  return new Set(ids).size === 1;
}
