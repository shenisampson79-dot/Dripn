/**
 * Belief facade — single mutation entry for live.
 * Run: npx tsx utils/beliefState.test.ts
 */
import assert from 'node:assert/strict';
import {
  createLiveBeliefMemory,
  slotsFromBelief,
  syncCoachingToBelief,
  updateLiveBelief,
} from './beliefState';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

const top: OnDeviceDetection = {
  name: 'pink shirt',
  category: 'tops',
  subcategory: 'shirt',
  color: 'pink',
  confidence: 0.9,
  bbox: [0.2, 0.1, 0.6, 0.45],
  trackId: 't1',
};

const trousers: OnDeviceDetection = {
  name: 'white trousers',
  category: 'bottoms',
  subcategory: 'trousers',
  color: 'white',
  confidence: 0.88,
  bbox: [0.25, 0.45, 0.55, 0.75],
  trackId: 'b1',
};

const boots: OnDeviceDetection = {
  name: 'brown chelsea boots',
  category: 'shoes',
  subcategory: 'chelsea_boots',
  color: 'brown',
  confidence: 0.86,
  bbox: [0.4, 0.86, 0.22, 0.12],
  skinRatio: 0.06,
  trackId: 's1',
};

let mem = createLiveBeliefMemory();
const r1 = updateLiveBelief([top, trousers, boots], mem, {
  now: 2000,
  bottomBandBrightness: 0.2,
});
mem = r1.memory;

assert.ok(r1.slots.top, 'top slot filled');
assert.ok(r1.slots.bottom, 'bottom slot filled');
assert.ok(r1.slots.shoes, 'shoes slot filled');
assert.equal(r1.slots.onePiece, null, 'dress shirt must not become one-piece');

const slots = slotsFromBelief(mem.belief);
assert.ok(slots.top);
assert.ok(slots.bottom);
assert.ok(slots.shoes);

const coach = syncCoachingToBelief(
  {
    summary: 'Brown Dress and Loafers look great.',
    tips: ['Ground the look with shoes.'],
    score: 70,
  },
  [
    { name: 'Pink shirt', category: 'tops', subcategory: 'shirt', color: 'pink' },
    { name: 'White trousers', category: 'bottoms', subcategory: 'trousers', color: 'white' },
    { name: 'Brown boots', category: 'shoes', subcategory: 'boots', color: 'brown' },
  ],
);

assert.ok(coach?.summary);
assert.ok(!/Brown Dress/i.test(String(coach?.summary || '')), 'coaching must not invent Brown Dress');
assert.ok(/boot/i.test(String(coach?.summary || '')), 'coaching must follow belief footwear');

console.log('beliefState.test.ts: ok');
