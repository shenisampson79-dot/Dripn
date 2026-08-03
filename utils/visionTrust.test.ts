/**
 * Trust Vision First helpers.
 * Run: npx tsx utils/visionTrust.test.ts
 */
import assert from 'node:assert/strict';
import {
  diffVisionToBelief,
  isTrustedVisionBoots,
  isTrustedVisionBottom,
  trustedGarmentFamily,
} from './visionTrust';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { updateLiveBelief, createLiveBeliefMemory } from './beliefState';

const chinos: OnDeviceDetection = {
  name: 'White Chinos',
  category: 'bottoms',
  subcategory: 'chinos',
  color: 'white',
  confidence: 0.9,
  bbox: [0.28, 0.48, 0.4, 0.22],
};
const boots: OnDeviceDetection = {
  name: 'Brown Leather Boots',
  category: 'shoes',
  subcategory: 'boots',
  color: 'brown',
  confidence: 0.88,
  bbox: [0.38, 0.88, 0.26, 0.08],
};
const shirt: OnDeviceDetection = {
  name: 'Pink Dress Shirt',
  category: 'tops',
  subcategory: 'dress_shirt',
  color: 'pink',
  confidence: 0.85,
  bbox: [0.24, 0.14, 0.44, 0.36],
};
const blazer: OnDeviceDetection = {
  name: 'Light Blue Blazer',
  category: 'outerwear',
  subcategory: 'blazer',
  color: 'light_blue',
  confidence: 0.93,
  bbox: [0.2, 0.1, 0.5, 0.42],
};

assert.equal(trustedGarmentFamily(chinos), 'trousers');
assert.equal(isTrustedVisionBottom(chinos), true);
assert.equal(isTrustedVisionBoots(boots), true);
assert.equal(trustedGarmentFamily(shirt), 'dress_shirt');
assert.equal(trustedGarmentFamily(blazer), 'blazer');

const lowConf = { ...chinos, confidence: 0.4 };
assert.equal(trustedGarmentFamily(lowConf), null, 'low conf is not trusted');

{
  const out = updateLiveBelief(
    [blazer, shirt, chinos, boots],
    createLiveBeliefMemory(),
    { now: 5000 },
  );
  assert.equal(out.memory.bottom?.subcategory, 'trousers', 'chinos stay trousers');
  assert.ok(out.memory.footwear, 'boots accepted');
  assert.match(String(out.memory.footwear?.name || out.memory.footwear?.subcategory), /boot/i);
  assert.ok(out.memory.top, 'shirt base present');
  assert.ok(out.memory.belief.layer, 'blazer layer present');
  assert.equal(out.mutations.length, 0, `trusted labels must not mutate: ${JSON.stringify(out.mutations)}`);
}

{
  const before = [chinos];
  const after: OnDeviceDetection[] = [{
    ...chinos,
    subcategory: 'shorts',
    name: 'White shorts',
  }];
  const diffs = diffVisionToBelief(before, after);
  assert.equal(diffs.length, 1);
  assert.match(diffs[0].reason, /trousers/);
}

console.log('visionTrust.test.ts: all passed');
