/**
 * Feedback brain soft-learning checks.
 * Run: npx tsx utils/outfitFeedbackBrain.test.ts
 */
import assert from 'node:assert/strict';

import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  feedbackPreference01,
  itemFeedbackAffinity,
  recordStylistOutfitFeedback,
} from './outfitFeedbackBrain';

function item(id: string): WardrobeItem {
  return {
    id,
    userId: 'u',
    imageUri: '',
    category: 'tops',
    name: id,
    color: 'navy',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 1,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
  };
}

async function main() {
  await recordStylistOutfitFeedback({
    items: [{ id: 'a', name: 'Shirt' }, { id: 'b', name: 'Trousers' }],
    signal: 'liked',
    source: 'todays_outfit',
    localOnly: true,
  });

  await recordStylistOutfitFeedback({
    items: [{ id: 'c', name: 'Boots' }],
    signal: 'skipped',
    source: 'stylist_chat',
    localOnly: true,
  });

  assert.ok(itemFeedbackAffinity('a') > 0);
  assert.ok(itemFeedbackAffinity('c') < 0);

  const likedLook = feedbackPreference01([item('a'), item('b')]);
  const skippedLook = feedbackPreference01([item('c')]);
  assert.ok(likedLook > skippedLook, `liked ${likedLook} should beat skipped ${skippedLook}`);

  console.log('outfitFeedbackBrain.test.ts: all passed', { likedLook, skippedLook });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
