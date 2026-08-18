/**
 * Digitize-session dedup: within-batch collapse + wardrobe filter.
 * Image hash / crop-session bind first; server dHash remains authoritative online.
 * This never silently no-ops.
 */

import {
  scoreLocalDuplicateMatch,
  findLocalWardrobeDuplicates,
  type WardrobeDupeCandidate,
  type WardrobeDupeMatch,
} from '@/utils/wardrobeDuplicateMatch';

export type DigitizeCandidate = WardrobeDupeCandidate & {
  id: string;
  sourceCropId?: string | null;
  cropId?: string | null;
  scanSessionId?: string | null;
  captureSessionId?: string | null;
  sourceImageId?: string | null;
  imagePhash?: string | null;
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
    const match = kept.find((k) => scoreLocalDuplicateMatch(candidate, k).isDuplicate);
    if (match) {
      const scored = scoreLocalDuplicateMatch(candidate, match);
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
            confidence: scored.confidence,
            reason: scored.reason,
            attrScore: scored.attrScore,
            hamming: scored.hamming,
            matchScope: 'batch',
            message: scored.message,
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
 * Split candidates into new vs already-in-wardrobe (image/session first).
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
    const matches = findLocalWardrobeDuplicates(candidate, wardrobe).filter((m) => m.isDuplicate);
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
