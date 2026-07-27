/**
 * Digitize-session dedup: within-batch collapse + wardrobe attribute filter.
 * Server dHash/embeddings remain authoritative when online; this never silently no-ops.
 */

import {
  attributeSimilarity,
  findLocalWardrobeDuplicates,
  type WardrobeDupeCandidate,
  type WardrobeDupeMatch,
} from '@/utils/wardrobeDuplicateMatch';

export type DigitizeCandidate = WardrobeDupeCandidate & {
  id: string;
};

export type DigitizeDrop = {
  item: DigitizeCandidate;
  reason: 'batch_duplicate' | 'wardrobe_duplicate';
  matchName: string;
  matches: WardrobeDupeMatch[];
};

/**
 * Keep first of each near-duplicate pair inside the current scan batch.
 */
export function collapseWithinBatch(candidates: DigitizeCandidate[]): {
  kept: DigitizeCandidate[];
  dropped: DigitizeDrop[];
} {
  const kept: DigitizeCandidate[] = [];
  const dropped: DigitizeDrop[] = [];

  for (const candidate of candidates) {
    const match = kept.find((k) => attributeSimilarity(candidate, k) >= 0.82);
    if (match) {
      dropped.push({
        item: candidate,
        reason: 'batch_duplicate',
        matchName: match.name || 'item in this scan',
        matches: [
          {
            id: match.id,
            name: match.name || 'Item',
            category: match.category,
            color: match.color,
            brand: match.brand,
            imageUri: match.imageUri,
            confidence: 'high',
            reason: 'batch_attribute_match',
            attrScore: attributeSimilarity(candidate, match),
            matchScope: 'batch',
          },
        ],
      });
      continue;
    }
    kept.push(candidate);
  }

  return { kept, dropped };
}

/**
 * Split candidates into new vs already-in-wardrobe (attribute heuristics).
 */
export function filterAgainstWardrobe(
  candidates: DigitizeCandidate[],
  wardrobe: Array<
    WardrobeDupeCandidate & {
      id: string;
      imageUri?: string | null;
      origin?: string | null;
    }
  >,
): {
  unique: DigitizeCandidate[];
  duplicates: DigitizeDrop[];
} {
  const unique: DigitizeCandidate[] = [];
  const duplicates: DigitizeDrop[] = [];

  for (const candidate of candidates) {
    const matches = findLocalWardrobeDuplicates(candidate, wardrobe);
    if (matches.length > 0) {
      duplicates.push({
        item: candidate,
        reason: 'wardrobe_duplicate',
        matchName: matches[0]?.name || 'wardrobe item',
        matches,
      });
      continue;
    }
    unique.push(candidate);
  }

  return { unique, duplicates };
}

/**
 * Full digitize gate: collapse batch, then filter against wardrobe.
 */
export function partitionDigitizeCandidates(
  candidates: DigitizeCandidate[],
  wardrobe: Array<
    WardrobeDupeCandidate & {
      id: string;
      imageUri?: string | null;
      origin?: string | null;
    }
  >,
): {
  unique: DigitizeCandidate[];
  dropped: DigitizeDrop[];
} {
  const { kept, dropped: batchDropped } = collapseWithinBatch(candidates);
  const { unique, duplicates } = filterAgainstWardrobe(kept, wardrobe);
  return {
    unique,
    dropped: [...batchDropped, ...duplicates],
  };
}
