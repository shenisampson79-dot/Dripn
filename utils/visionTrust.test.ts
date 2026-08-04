/**
 * Trust Vision First helpers + fusion specificity.
 * Run: npx tsx utils/visionTrust.test.ts
 */
import assert from 'node:assert/strict';
import {
  diffVisionToBelief,
  garmentSpecificityRank,
  isTrustedVisionBoots,
  isTrustedVisionBottom,
  resolveFusedIdentity,
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

assert.ok(
  garmentSpecificityRank({ name: 'Gray Sweatpants' })
    > garmentSpecificityRank({ name: 'Gray Trousers' }),
);

{
  const fused = resolveFusedIdentity(
    { name: 'Gray Trousers', subcategory: 'trousers', confidence: 0.99 },
    { name: 'Gray Sweatpants', subcategory: 'sweatpants', confidence: 0.95 },
  );
  assert.equal(fused.adopted, 'next');
  assert.match(String(fused.name), /sweatpant/i);
  assert.match(fused.reason, /specificity/i);
}

{
  const fused = resolveFusedIdentity(
    { name: 'Gray and Red Boat Shoes', subcategory: 'boat_shoes', confidence: 0.9 },
    { name: 'White and Red Sneakers', subcategory: 'sneakers', confidence: 0.9 },
  );
  assert.equal(fused.adopted, 'next', 'Vision peer sneakers should override boat lock');
  assert.match(String(fused.name), /sneaker/i);
}

{
  const mem = createLiveBeliefMemory();
  const yolo = updateLiveBelief(
    [{
      name: 'Gray Trousers',
      category: 'bottoms',
      subcategory: 'trousers',
      color: 'gray',
      confidence: 0.99,
      bbox: [0.3, 0.45, 0.35, 0.4],
    }, {
      name: 'Charcoal top',
      category: 'tops',
      subcategory: 'top',
      color: 'gray',
      confidence: 1,
      bbox: [0.25, 0.15, 0.4, 0.3],
    }, {
      name: 'Gray and Red Boat Shoes',
      category: 'shoes',
      subcategory: 'boat_shoes',
      color: 'gray',
      confidence: 0.99,
      bbox: [0.35, 0.88, 0.28, 0.08],
      skinRatio: 0.05,
    }],
    mem,
    { now: 1000 },
  );
  assert.match(String(yolo.slots.bottom?.name), /trouser/i);

  const vision = updateLiveBelief(
    [{
      name: 'Black T-shirt',
      category: 'tops',
      subcategory: 't-shirt',
      color: 'black',
      confidence: 0.95,
      bbox: [0.25, 0.15, 0.4, 0.3],
    }, {
      name: 'Gray Sweatpants',
      category: 'bottoms',
      subcategory: 'sweatpants',
      color: 'gray',
      confidence: 0.95,
      bbox: [0.3, 0.45, 0.35, 0.4],
    }, {
      name: 'White and Red Sneakers',
      category: 'shoes',
      subcategory: 'sneakers',
      color: 'white',
      confidence: 0.9,
      bbox: [0.35, 0.88, 0.28, 0.08],
      skinRatio: 0.05,
    }, {
      name: 'Blue Tie',
      category: 'accessories',
      subcategory: 'tie',
      color: 'blue',
      confidence: 0.85,
      bbox: [0.4, 0.2, 0.1, 0.15],
    }],
    yolo.memory,
    { now: 2500 },
  );
  assert.match(String(vision.slots.bottom?.name), /sweatpant/i, 'specificity: sweatpants beat trousers');
  assert.match(
    String(vision.slots.shoes?.name || vision.slots.shoes?.subcategory),
    /sneaker|trainer/i,
    'Vision sneakers unlock boat lock',
  );
  const tie = vision.detections.find((d) => /tie/i.test(`${d.name} ${d.subcategory}`));
  assert.ok(tie, 'tie injected from Vision');
}

{
  const out = updateLiveBelief(
    [blazer, shirt, chinos, boots],
    createLiveBeliefMemory(),
    { now: 5000 },
  );
  assert.ok(out.slots.bottom, 'chinos bottom present');
  assert.match(String(out.slots.bottom?.subcategory), /trouser|chino/i);
  assert.ok(out.slots.shoes, 'boots accepted');
  assert.match(String(out.slots.shoes?.name || out.slots.shoes?.subcategory), /boot/i);
  assert.ok(out.slots.top, 'shirt base present');
  assert.ok(out.slots.layer, 'blazer layer present');
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

{
  // QA: Vision checkered shorts must unlock locked grey sweatpants (not "trusted shorts rewritten")
  const mem = createLiveBeliefMemory();
  const sweats = updateLiveBelief(
    [{
      name: 'Black Sports T-shirt',
      category: 'tops',
      subcategory: 't-shirt',
      color: 'black',
      confidence: 0.95,
      bbox: [0.25, 0.15, 0.4, 0.3],
    }, {
      name: 'Grey Sweatpants',
      category: 'bottoms',
      subcategory: 'sweatpants',
      color: 'gray',
      confidence: 0.99,
      bbox: [0.28, 0.42, 0.38, 0.42],
    }],
    mem,
    { now: 1000 },
  );
  assert.match(String(sweats.slots.bottom?.name), /sweatpant/i);

  const shorts = updateLiveBelief(
    [{
      name: 'Black and Grey T-Shirt',
      category: 'tops',
      subcategory: 't-shirt',
      color: 'black',
      confidence: 0.95,
      bbox: [0.25, 0.15, 0.4, 0.3],
    }, {
      name: 'Black Checkered Shorts',
      category: 'bottoms',
      subcategory: 'shorts',
      color: 'black',
      confidence: 0.92,
      bbox: [0.3, 0.5, 0.35, 0.22],
    }],
    sweats.memory,
    { now: 3000 },
  );
  assert.match(
    String(shorts.slots.bottom?.name),
    /checkered\s+shorts|shorts/i,
    'Vision checkered shorts must unlock sweatpants lock',
  );
  assert.match(String(shorts.slots.bottom?.subcategory), /short/i);
}

console.log('visionTrust.test.ts: all passed');
