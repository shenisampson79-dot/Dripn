/**
 * Thin LIM — temporal vote, footwear veto, shorts context.
 * Run: npx tsx utils/liveLayeringIntelligence.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyFootwearVeto,
  normalizeWarmLightingColor,
  resolveShortsWithContext,
  stabilizeFootwearIdentity,
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

console.log('liveLayeringIntelligence.test.ts: all passed');
