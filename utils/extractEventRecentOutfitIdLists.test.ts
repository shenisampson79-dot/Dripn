/**
 * Event recent-outfit diversity history — deterministic regressions.
 * Run: npx tsx utils/extractEventRecentOutfitIdLists.test.ts
 */
import assert from 'node:assert/strict';

import {
  extractEventRecentOutfitIdLists,
  resolveEventOutfitHistoryPieces,
} from './extractEventRecentOutfitIdLists';

// Wardrobe-owned Event look
{
  const pieces = resolveEventOutfitHistoryPieces({
    outfitPieces: [
      { wardrobeItemId: '142' },
      { wardrobeItemId: '85' },
      { wardrobeItemId: '121' },
    ],
  });
  assert.ok(pieces);
  assert.equal(pieces!.length, 3);
}

// SHOP_REQUIRED wedding — outfitPieces null, retail product ids carry history
{
  const weddingShop = resolveEventOutfitHistoryPieces({
    displayState: 'SHOP_REQUIRED',
    status: 'SHOP_REQUIRED',
    outfitPieces: null,
    retailOutfit: {
      products: [
        { id: 'fw-f-top-blouse' },
        { id: 'fw-f-bottom-midi' },
        { id: 'fw-f-shoes-heel' },
        { id: 'fw-f-outer-blazer' },
      ],
      outfit: {
        top: { id: 'fw-f-top-blouse' },
        bottom: { id: 'fw-f-bottom-midi' },
        shoes: { id: 'fw-f-shoes-heel' },
        outerwear: { id: 'fw-f-outer-blazer' },
      },
    },
  });
  assert.ok(weddingShop);
  assert.deepEqual(
    outfitPiecesToIdListFromRefs(weddingShop!),
    ['fw-f-top-blouse', 'fw-f-bottom-midi', 'fw-f-shoes-heel', 'fw-f-outer-blazer'],
  );
}

// Request A wedding → Request B dinner: cross-event history preserved (not keyed by event type)
{
  const requestA = resolveEventOutfitHistoryPieces({
    displayState: 'SHOP_REQUIRED',
    outfitPieces: null,
    retailOutfit: {
      products: [
        { id: 'fw-f-top-blouse' },
        { id: 'fw-f-bottom-midi' },
        { id: 'fw-f-shoes-heel' },
      ],
    },
  });
  assert.ok(requestA);
  const historyAfterA = extractEventRecentOutfitIdLists([], requestA);
  assert.equal(historyAfterA.length, 1);

  const requestBRecentOutfits = historyAfterA;
  assert.ok(requestBRecentOutfits.length >= 1);
  assert.deepEqual(requestBRecentOutfits[0], [
    'fw-f-top-blouse',
    'fw-f-bottom-midi',
    'fw-f-shoes-heel',
  ]);
}

// Same-event repetition still carries prior history
{
  const prior = extractEventRecentOutfitIdLists([], [
    { wardrobeItemId: '10' },
    { wardrobeItemId: '11' },
    { wardrobeItemId: '12' },
  ]);
  const merged = extractEventRecentOutfitIdLists(prior, [
    { wardrobeItemId: '10' },
    { wardrobeItemId: '11' },
    { wardrobeItemId: '12' },
  ]);
  assert.equal(merged.length, 1, 'duplicate look deduped');
}

// History remains bounded
{
  let history: string[][] = [];
  for (let i = 0; i < 8; i += 1) {
    history = extractEventRecentOutfitIdLists(history, [
      { wardrobeItemId: String(i * 3) },
      { wardrobeItemId: String(i * 3 + 1) },
      { wardrobeItemId: String(i * 3 + 2) },
    ], 5);
  }
  assert.equal(history.length, 5);
}

function outfitPiecesToIdListFromRefs(
  pieces: Array<{ wardrobeItemId?: string | number; id?: string | number }>,
): string[] {
  return pieces
    .map((p) => p?.wardrobeItemId ?? p?.id)
    .filter((id) => id != null && String(id).trim())
    .map(String);
}

console.log('extractEventRecentOutfitIdLists.test.ts — all passed');
