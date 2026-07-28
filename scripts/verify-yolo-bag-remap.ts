/**
 * YOLO bag remap + generic-name dupe guard.
 * Run: npx tsx scripts/verify-yolo-bag-remap.ts
 */
import assert from 'node:assert/strict';
import { mapYoloClassToWardrobeCategory } from '../services/yoloGarmentParse.ts';
import { attributeSimilarity } from '../utils/wardrobeDuplicateMatch.ts';

// Flat-laid shirt-shaped blob misclassified as Bags (class 2) → tops
const shirtAsBag = mapYoloClassToWardrobeCategory(2, [0.1, 0.15, 0.7, 0.55]);
assert.equal(shirtAsBag.category, 'tops', `expected tops, got ${shirtAsBag.category}`);

// Compact bag-like blob stays bags
const compactBag = mapYoloClassToWardrobeCategory(2, [0.35, 0.35, 0.28, 0.3]);
assert.equal(compactBag.category, 'bags');

// Two generic "Bag" names must NOT exact-match as wardrobe duplicates
const score = attributeSimilarity(
  { name: 'Bag', category: 'bags', color: 'white' },
  { name: 'Bag', category: 'bags', color: 'cream' },
);
assert.ok(score < 0.82, `generic Bag/Bag should not soft-dupe, got ${score}`);

// Distinct named bags still can match
const named = attributeSimilarity(
  { name: 'Kaecen Tote Bag', category: 'bags', color: 'cream', brand: 'Kaecen' },
  { name: 'Kaecen Tote Bag', category: 'bags', color: 'cream', brand: 'Kaecen' },
);
assert.ok(named >= 0.9, `named bags should still match, got ${named}`);

console.log('verify-yolo-bag-remap: passed', { shirtAsBag, compactBag, score, named });
