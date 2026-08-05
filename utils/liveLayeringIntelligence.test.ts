/**
 * Thin LIM — temporal vote, footwear veto, shorts context.
 * Run: npx tsx utils/liveLayeringIntelligence.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyFootwearVeto,
  pickMoreSpecificSubtype,
  normalizeWarmLightingColor,
  resolveShortsWithContext,
  stabilizeColorFromHistory,
  stabilizeFootwearIdentity,
  syncCoachingToBelief,
  shouldLockBelief,
  weightedVote,
} from './liveLayeringIntelligence';

assert.equal(
  weightedVote([
    { value: 'boots', confidence: 0.7 },
    { value: 'boat_shoes', confidence: 0.9 },
    { value: 'boat_shoes', confidence: 0.85 },
  ]),
  'boat_shoes',
);

assert.equal(applyFootwearVeto('boat_shoes', 'boots'), 'boat_shoes');
assert.equal(applyFootwearVeto('boat_shoes', 'sneakers'), 'boat_shoes');
assert.equal(applyFootwearVeto('boat_shoes', 'sandals'), 'sandals');

const locked = stabilizeFootwearIdentity({
  history: [
    { label: 'boat_shoes', confidence: 0.9, color: 'red' },
    { label: 'boat_shoes', confidence: 0.88, color: 'red' },
  ],
  proposed: { label: 'boots', confidence: 0.91, color: 'brown' },
  lockedSubtype: 'boat_shoes',
  lockedColor: 'red',
});
assert.equal(locked.subtype, 'boat_shoes');
assert.equal(locked.color, 'red');

assert.equal(
  normalizeWarmLightingColor('red', 'brown', { subtype: 'boat_shoes' }),
  'red',
);

assert.equal(
  resolveShortsWithContext('athletic_shorts', {
    topName: 'Light Blue Button-Up Shirt',
    topSubtype: 'oxford_shirt',
  }),
  'casual_shorts',
);
assert.equal(
  resolveShortsWithContext('shorts', { hasDrawstring: true }),
  'athletic_shorts',
);
assert.equal(resolveShortsWithContext(null, {}), 'casual_shorts');

assert.equal(pickMoreSpecificSubtype('sandals', 'flip_flops'), 'flip_flops');
// boat ↔ sneakers are peers — next wins on tie
assert.equal(pickMoreSpecificSubtype('sneakers', 'boat_shoes'), 'boat_shoes');
assert.equal(pickMoreSpecificSubtype('boat_shoes', 'sneakers'), 'sneakers');
assert.equal(pickMoreSpecificSubtype('trousers', 'sweatpants'), 'sweatpants');
assert.ok(shouldLockBelief({ confidence: 0.9, seenFrames: 4, agreeRatio: 0.8 }));

const colorHold = stabilizeColorFromHistory({
  history: [
    { label: 'shorts', confidence: 0.9, color: 'white' },
    { label: 'shorts', confidence: 0.88, color: 'white' },
    { label: 'shorts', confidence: 0.85, color: 'gray' },
  ],
  proposed: { label: 'shorts', confidence: 0.8, color: 'black' },
  lockedColor: 'white',
});
assert.notEqual(colorHold.color, 'black');

const synced = syncCoachingToBelief(
  {
    headline: 'Smart casual',
    summary: 'Light Blue Shirt and White Shorts sit in the same lane, and Brown Boat Shoes ground the look.',
    bullets: ['Colour read: warm neutrals'],
  },
  [
    { name: 'Light Green top', category: 'tops', subcategory: 'top' },
    { name: 'Grey shorts', category: 'bottoms', subcategory: 'shorts' },
    { name: 'Red And Brown boat shoes', category: 'shoes', subcategory: 'boat_shoes' },
  ],
  { score: 82 },
);
assert.match(synced?.summary || '', /Grey shorts/i);
assert.match(synced?.summary || '', /Light Green top/i);
assert.match(synced?.summary || '', /Red And Brown boat shoes/i);
assert.match(synced?.summary || '', /work well together/i);
assert.doesNotMatch(synced?.summary || '', /White Shorts|Light Blue Shirt|sit in the same lane/i);

// A rebuilt summary must never praise an outfit the score and bullets condemn.
const clashSynced = syncCoachingToBelief(
  {
    headline: 'Needs a tweak',
    summary: 'Orange T-Shirt and Grey Sweatpants pull in different directions.',
    bullets: ['Formal neckwear needs a shirt or smarter top — not sportswear.'],
    sameLane: false,
  },
  [
    { name: 'Orange T-Shirt', category: 'tops', subcategory: 't-shirt' },
    { name: 'Light Blue Blazer', category: 'outerwear', subcategory: 'blazer' },
    { name: 'Grey Sweatpants', category: 'bottoms', subcategory: 'sweatpants' },
    { name: 'Blue Polka Dot Tie', category: 'accessories', subcategory: 'tie' },
  ],
  { score: 43 },
);
assert.doesNotMatch(clashSynced?.summary || '', /work well together|finishes the look|relaxed layer/i);
assert.match(clashSynced?.summary || '', /pull in different directions/i);
assert.match(clashSynced?.summary || '', /Grey Sweatpants/i);

// Score alone is enough — a low score must not be dressed up as harmony.
const lowScore = syncCoachingToBelief(
  {
    headline: 'Mixed directions',
    summary: 'Something neutral.',
    bullets: [],
  },
  [
    { name: 'Orange T-Shirt', category: 'tops', subcategory: 't-shirt' },
    { name: 'Grey Sweatpants', category: 'bottoms', subcategory: 'sweatpants' },
  ],
  { score: 44 },
);
assert.doesNotMatch(lowScore?.summary || '', /work well together/i);

const noShoes = syncCoachingToBelief(
  {
    summary: 'Green top and Blue Shorts sit in the same lane, and Blue shorts ground the look — this pairing is commonly styled together.',
  },
  [
    { name: 'Light Blue top', category: 'tops', subcategory: 'top' },
    { name: 'Grey shorts', category: 'bottoms', subcategory: 'shorts' },
  ],
);
assert.match(noShoes?.summary || '', /Light Blue top/i);
assert.match(noShoes?.summary || '', /Grey shorts/i);
assert.doesNotMatch(noShoes?.summary || '', /ground the look/i);

const dualDress = syncCoachingToBelief(
  {
    summary: 'Pink Dress carries the look, and Brown Dress ground the look.',
  },
  [
    { name: 'Light Pink top', category: 'tops', subcategory: 'dress_shirt' },
    { name: 'White trousers', category: 'bottoms', subcategory: 'trousers' },
    { name: 'Brown boots', category: 'shoes', subcategory: 'boots' },
  ],
);
assert.match(dualDress?.summary || '', /Light Pink top/i);
assert.match(dualDress?.summary || '', /White trousers/i);
assert.match(dualDress?.summary || '', /Brown boots/i);
assert.doesNotMatch(dualDress?.summary || '', /\bDress\b/);
assert.doesNotMatch(dualDress?.summary || '', /, and /);

console.log('liveLayeringIntelligence.test.ts: all passed');
