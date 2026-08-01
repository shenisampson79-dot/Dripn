/**
 * Pipeline unit checks.
 * Run: npx tsx utils/outfitAutoAnalysisPipeline.test.ts
 */
import assert from 'node:assert/strict';

import {
  applyGeometryGuardrails,
  majorityVoteCategories,
  runOutfitAutoPipeline,
  scorePipelineConfidence,
  shouldDiscardImage,
} from './outfitAutoAnalysisPipeline';

// Boots must never become dresses via voting
assert.equal(
  majorityVoteCategories(['dress', 'dress'], 'footwear'),
  'footwear',
  'heuristic footwear must beat dress majority',
);
assert.equal(
  majorityVoteCategories(['dress', 'boots', 'dress']),
  'footwear',
  'any footwear vote must win over dress',
);

// Geometry: bottom-heavy short box → footwear
const geo = applyGeometryGuardrails('dress', { x: 0.4, y: 0.7, w: 0.2, h: 0.25 }, 0.5);
assert.equal(geo.category, 'footwear');
assert.ok(geo.applied);

// Quality filter
assert.equal(shouldDiscardImage({ blurScore: 0.8 }), 'too_blurry');
assert.equal(shouldDiscardImage({ itemCount: 9 }), 'too_many_items');
assert.equal(shouldDiscardImage({ blurScore: 0.2, itemCount: 3 }), null);

// Confidence formula bounds
const mid = scorePipelineConfidence({
  detectionAvg: 0.8,
  classificationAvg: 0.8,
  rulesOk: 0.9,
  attributesOk: 0.8,
  coherence: 0.8,
});
assert.ok(mid > 0.75 && mid < 1);

// Full pipeline: boots mislabelled as dress gets corrected
const bootsFixed = runOutfitAutoPipeline({
  id: 'test_boots',
  brand: 'zegna',
  price_tier: 'luxury',
  context: 'smart_casual',
  detections: [
    {
      categoryVotes: ['dress', 'dress'],
      heuristicCategory: 'footwear',
      color: 'brown',
      subcategory: 'chelsea_boots',
      bbox: { x: 0.4, y: 0.72, w: 0.18, h: 0.22 },
      aspectRatio: 0.5,
      confidence: 0.55,
      roleHint: 'footwear',
    },
    {
      categoryVotes: ['shirt'],
      color: 'white',
      confidence: 0.9,
      roleHint: 'top',
      bbox: { x: 0.3, y: 0.15, w: 0.4, h: 0.35 },
    },
    {
      categoryVotes: ['trousers'],
      color: 'navy',
      confidence: 0.88,
      roleHint: 'bottom',
      bbox: { x: 0.3, y: 0.45, w: 0.35, h: 0.35 },
    },
  ],
});

assert.equal(bootsFixed.outfit.footwear?.category, 'footwear');
assert.notEqual(bootsFixed.outfit.top?.category, 'footwear');
assert.ok(
  bootsFixed.repairs.some((r) => /footwear|heuristic|bbox/.test(r)) || bootsFixed.outfit.footwear,
  'expected footwear repair or structured footwear',
);

// Tie + short sleeve removed
const tieDrop = runOutfitAutoPipeline({
  id: 'test_tie',
  detections: [
    {
      category: 'shirt',
      subcategory: 'short_sleeve',
      color: 'blue',
      confidence: 0.9,
      roleHint: 'top',
    },
    {
      category: 'trousers',
      color: 'grey',
      confidence: 0.9,
      roleHint: 'bottom',
    },
    {
      category: 'necktie',
      color: 'navy',
      confidence: 0.6,
      roleHint: 'accessory',
    },
  ],
});
assert.equal(tieDrop.outfit.accessory, null);
assert.ok(tieDrop.repairs.includes('remove_tie_short_sleeve'));

// Blurry image discarded
const blurry = runOutfitAutoPipeline({
  id: 'blur',
  detections: [{ category: 'shirt', confidence: 0.9 }],
  imageMeta: { blurScore: 0.9 },
});
assert.equal(blurry.discarded, true);
assert.equal(blurry.validated, false);

// Work + rugged boots → violation / confidence downgrade path
const rugged = runOutfitAutoPipeline({
  id: 'work_boots',
  context: 'work_outfit',
  detections: [
    { category: 'shirt', color: 'white', confidence: 0.9, roleHint: 'top' },
    { category: 'trousers', color: 'navy', confidence: 0.9, roleHint: 'bottom' },
    {
      category: 'footwear',
      subcategory: 'rugged_boots',
      color: 'brown',
      confidence: 0.85,
      roleHint: 'footwear',
    },
  ],
});
assert.ok(rugged.violations.includes('work_rugged_footwear'));

// Missing shoes → do NOT invent (barefoot / incomplete outfit)
const noShoes = runOutfitAutoPipeline({
  id: 'no_shoes',
  context: 'casual',
  detections: [
    { category: 't-shirt', color: 'black', confidence: 0.9, roleHint: 'top', bbox: { x: 0.3, y: 0.1, w: 0.4, h: 0.3 } },
    { category: 'trousers', color: 'beige', confidence: 0.88, roleHint: 'bottom', bbox: { x: 0.3, y: 0.48, w: 0.35, h: 0.44 } },
  ],
});
assert.equal(noShoes.outfit.footwear, null, 'must not soft-invent footwear');

// Cropped shorts selfie — do not invent footwear
const croppedShorts = runOutfitAutoPipeline({
  id: 'cropped_shorts',
  context: 'casual',
  detections: [
    { category: 't-shirt', color: 'red', confidence: 0.9, roleHint: 'top', bbox: { x: 0.2, y: 0.08, w: 0.55, h: 0.4 } },
    { category: 'shorts', color: 'black', confidence: 0.85, roleHint: 'bottom', bbox: { x: 0.3, y: 0.5, w: 0.4, h: 0.28 } },
  ],
});
assert.equal(croppedShorts.outfit.footwear, null, 'cropped shorts must not invent shoes');

console.log('outfitAutoAnalysisPipeline.test.ts: all passed');
