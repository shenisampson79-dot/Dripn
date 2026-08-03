/**
 * Belief engine — belief > frame.
 * Run: npx tsx utils/liveGarmentBelief.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyOutfitBelief,
  beliefKindFromDetection,
  colorDistance,
  createOutfitBeliefState,
  normalizeBeliefColor,
  observationFromDetection,
  stabilizeColor,
  updateBelief,
  beliefToDetection,
  CHANGE_THRESHOLD,
} from './liveGarmentBelief';
import { applyDetectionMemory, createDetectionMemory } from './liveDetectionMemory';
import { formatGarmentDisplayName } from './bodyGeometryGuardrails';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

assert.equal(normalizeBeliefColor('grey'), 'gray');
assert.equal(normalizeBeliefColor('grey', 'trousers'), 'gray');
assert.equal(normalizeBeliefColor('dark grey'), 'black');
assert.equal(normalizeBeliefColor('grey', 'shoes'), 'gray');
assert.equal(normalizeBeliefColor('gray', 'shoes'), 'gray');
assert.ok(colorDistance('gray', 'black') > 0.2, 'grey must not equal black');
assert.ok(colorDistance('gray', 'black', 'shoes') > 0);
assert.equal(stabilizeColor('red', 'black', 0.99, 'top'), 'red');
assert.equal(stabilizeColor('red', 'gray', 0.9, 'top'), 'red');
assert.equal(stabilizeColor('black', 'gray', 0.5, 'shorts'), 'black');
assert.equal(stabilizeColor('black', 'gray', 0.8, 'trousers'), 'gray', 'grey sweatpants recover from false black');
assert.equal(stabilizeColor('red', 'blue', 0.5, 'top'), 'red'); // below threshold
assert.equal(stabilizeColor('red', 'blue', 0.97, 'top'), 'blue');
assert.equal(stabilizeColor('black', 'white', 0.85, 'shorts'), 'white');
// Cool-confusion hysteresis: locked light_blue resists green flicker
assert.equal(stabilizeColor('light_blue', 'green', 0.9, 'top'), 'light_blue');
// Green may still recover to light_blue with enough confidence
assert.equal(stabilizeColor('green', 'light_blue', 0.85, 'top'), 'light_blue');
assert.equal(formatGarmentDisplayName({ color: 'gray', category: 'bottoms', subcategory: 'shorts' }), 'Grey shorts');
assert.equal(formatGarmentDisplayName({ color: 'black', category: 'bottoms', subcategory: 'shorts' }), 'Dark shorts');
assert.equal(
  formatGarmentDisplayName({ color: 'light_pink', category: 'tops', subcategory: 'dress_shirt' }),
  'Light Pink top',
);
assert.equal(
  beliefKindFromDetection({
    name: 'Light Pink Dress Shirt',
    category: 'dresses',
    subcategory: 'dress_shirt',
    confidence: 0.9,
    bbox: [0.2, 0.1, 0.5, 0.4],
  }),
  'top',
);
assert.equal(normalizeBeliefColor('gray', 'shorts'), 'gray');

// Vision name preservation: Gray Sweatpants must not become Dark trousers
{
  const sweat: OnDeviceDetection = {
    name: 'Gray Sweatpants',
    category: 'bottoms',
    subcategory: 'sweatpants',
    color: 'gray',
    confidence: 0.96,
    bbox: [0.28, 0.42, 0.4, 0.45],
  };
  const shirt: OnDeviceDetection = {
    name: 'Black and Grey Athletic Shirt',
    category: 'tops',
    subcategory: 't-shirt',
    color: 'black',
    confidence: 0.95,
    bbox: [0.22, 0.12, 0.5, 0.38],
  };
  const boats: OnDeviceDetection = {
    name: 'Multicolor Boat Shoes',
    category: 'shoes',
    subcategory: 'boat_shoes',
    color: 'multicolor',
    confidence: 0.88,
    bbox: [0.35, 0.86, 0.28, 0.1],
  };
  const mem = applyDetectionMemory([shirt, sweat, boats], createDetectionMemory(), { now: 9000 });
  assert.match(mem.memory.bottom?.name || '', /sweatpant|grey|gray/i, `bottom name: ${mem.memory.bottom?.name}`);
  assert.ok(!/dark\s*trouser|dark\s*short/i.test(mem.memory.bottom?.name || ''), 'must not say Dark trousers/shorts');
  assert.match(mem.memory.top?.name || '', /athletic|shirt|black/i, `top name: ${mem.memory.top?.name}`);
  assert.match(mem.memory.footwear?.name || '', /boat|multicolor/i, `shoes: ${mem.memory.footwear?.name}`);
  const painted = beliefToDetection(mem.memory.belief.bottom!);
  assert.match(painted.name, /sweatpant|grey|gray/i);
}

const topRed: OnDeviceDetection = {
  name: 'Red top',
  category: 'tops',
  subcategory: 'top',
  color: 'red',
  confidence: 0.92,
  bbox: [0.2, 0.08, 0.55, 0.4],
  trackId: 't1',
};
const topBlackWeak: OnDeviceDetection = {
  name: 'Top',
  category: 'tops',
  subcategory: 'top',
  color: 'black',
  confidence: 0.7,
  bbox: [0.2, 0.08, 0.55, 0.4],
  trackId: 't1',
};
const topBlackNamed: OnDeviceDetection = {
  name: 'Black Athletic Shirt',
  category: 'tops',
  subcategory: 't-shirt',
  color: 'black',
  confidence: 0.7,
  bbox: [0.2, 0.08, 0.55, 0.4],
  trackId: 't1',
};
const topBlackStrong: OnDeviceDetection = {
  ...topBlackWeak,
  confidence: 0.99,
};
const shorts: OnDeviceDetection = {
  name: 'Grey shorts',
  category: 'bottoms',
  subcategory: 'shorts',
  color: 'gray',
  confidence: 0.9,
  bbox: [0.3, 0.52, 0.4, 0.24],
  trackId: 'b1',
};

// Weak black observation strips color proposal (generic "Top" — no named black)
const weakObs = observationFromDetection(topBlackWeak, 1000);
assert.equal(weakObs.color, null);
assert.ok(weakObs.confidence < CHANGE_THRESHOLD || weakObs.color === null);
// Vision-named black/grey tops keep colour
const namedObs = observationFromDetection(topBlackNamed, 1000);
assert.equal(namedObs.color, 'black');
assert.match(namedObs.name || '', /Black Athletic/i);

// Red locks against black phone frame
let state = createOutfitBeliefState();
let r = applyOutfitBelief(state, [topRed, shorts], { now: 2000 });
state = r.state;
assert.equal(state.top?.color, 'red');
assert.equal(beliefToDetection(state.top!).name, 'Red top');
assert.equal(beliefToDetection(state.bottom!).name, 'Grey shorts');

r = applyOutfitBelief(state, [topBlackStrong, shorts], { now: 3000 });
state = r.state;
assert.equal(state.top?.color, 'red', 'red must not become black');
assert.equal(beliefToDetection(state.top!).name, 'Red top');

// Shorts held when only top visible
r = applyOutfitBelief(state, [topRed], { now: 4000 });
state = r.state;
assert.ok(state.bottom, 'shorts held while missing');
assert.equal(state.bottom?.kind, 'shorts');

// Hold across many misses
for (let i = 0; i < 8; i++) {
  r = applyOutfitBelief(state, [topRed], { now: 5000 + i * 200 });
  state = r.state;
}
assert.ok(state.bottom, 'shorts still held after gaps');

// Gray shorts resist false black remaps (same family / light recovery)
r = applyOutfitBelief(state, [topRed, { ...shorts, color: 'black', name: 'Black shorts' }], { now: 7000 });
assert.equal(beliefToDetection(r.state.bottom!).name, 'Grey shorts');

// Memory wrapper
let mem = createDetectionMemory();
const f1 = applyDetectionMemory([topRed, shorts], mem, { now: 8000 });
mem = f1.memory;
const f2 = applyDetectionMemory([topBlackStrong], mem, { now: 8500 });
assert.ok(/red/i.test(f2.memory.top?.name || ''));
assert.ok(/short/i.test(f2.memory.bottom?.name || ''), 'bottom persists via memory');

const held = updateBelief(
  observationFromDetection(shorts, 9000),
  null,
  9500,
);
assert.ok(held && held.kind === 'shorts');

// Bare-torso ghost top must hard-clear held top belief (not TTL hold)
const ghostTop: OnDeviceDetection = {
  name: 'Top',
  category: 'tops',
  subcategory: 'top',
  color: 'unknown',
  confidence: 0.95,
  bbox: [0.2, 0.08, 0.55, 0.4],
  trackId: 'ghost',
  skinRatio: 0.4,
};
let bareState = createOutfitBeliefState();
bareState = applyOutfitBelief(bareState, [topRed, shorts], { now: 10000 }).state;
assert.ok(bareState.top, 'seed a real top first');
const bareR = applyOutfitBelief(bareState, [ghostTop, shorts], { now: 11000 });
assert.equal(bareR.state.torsoState, 'bare');
assert.equal(bareR.state.top, null, 'bare torso destroys top belief');
assert.ok(bareR.repairs.some((r) => /bare_torso/i.test(r)));
assert.ok(!bareR.detections.some((d) => /top/i.test(d.category)));

// Dress persistence: overlapping trousers must not reclassify a locked dress
const dressDet: OnDeviceDetection = {
  name: 'Black maxi dress',
  category: 'dresses',
  subcategory: 'maxi_dress',
  color: 'black',
  confidence: 0.92,
  bbox: [0.25, 0.12, 0.45, 0.82],
  trackId: 'd1',
};
const trousersFlip: OnDeviceDetection = {
  name: 'Dark trousers',
  category: 'bottoms',
  subcategory: 'trousers',
  color: 'black',
  confidence: 0.96,
  bbox: [0.26, 0.14, 0.44, 0.80],
  trackId: 'd1',
};
let dressState = createOutfitBeliefState();
dressState = applyOutfitBelief(dressState, [dressDet], { now: 12000 }).state;
assert.equal(dressState.bottom?.kind, 'dress');
dressState = applyOutfitBelief(dressState, [trousersFlip], { now: 13000 }).state;
assert.equal(dressState.bottom?.kind, 'dress', 'dress persists over overlapping trousers');

// False dress lock: top + trousers must kill one-piece dress immediately
const falseDressSeed: OnDeviceDetection = {
  name: 'Pink dress',
  category: 'dresses',
  subcategory: 'dress',
  color: 'pink',
  confidence: 0.95,
  bbox: [0.22, 0.12, 0.5, 0.55],
  trackId: 'p1',
};
const whiteTrousers: OnDeviceDetection = {
  name: 'White trousers',
  category: 'bottoms',
  subcategory: 'trousers',
  color: 'white',
  confidence: 0.9,
  bbox: [0.28, 0.48, 0.4, 0.42],
  trackId: 'p2',
};
const pinkShirtTop: OnDeviceDetection = {
  name: 'Light Pink top',
  category: 'tops',
  subcategory: 'dress_shirt',
  color: 'light_pink',
  confidence: 0.92,
  bbox: [0.22, 0.12, 0.5, 0.4],
  trackId: 'p3',
};
let falseDress = createOutfitBeliefState();
falseDress = applyOutfitBelief(falseDress, [falseDressSeed], { now: 20000 }).state;
assert.equal(falseDress.bottom?.kind, 'dress');
falseDress = applyOutfitBelief(falseDress, [pinkShirtTop, whiteTrousers], { now: 20500 }).state;
assert.equal(falseDress.top?.kind, 'top', 'dress shirt becomes top');
assert.equal(falseDress.bottom?.kind, 'trousers', 'dress unlocked by top+trousers');

// Outerwear preferred over phantom tee in the top slot
const jacketDet: OnDeviceDetection = {
  name: 'Blue jacket',
  category: 'outerwear',
  subcategory: 'jacket',
  color: 'blue',
  confidence: 0.88,
  bbox: [0.22, 0.14, 0.48, 0.36],
  trackId: 'j1',
};
const phantomTee: OnDeviceDetection = {
  name: 'Blue top',
  category: 'tops',
  subcategory: 'top',
  color: 'blue',
  confidence: 0.95,
  bbox: [0.24, 0.16, 0.46, 0.34],
  trackId: 't2',
};
let layerState = createOutfitBeliefState();
layerState = applyOutfitBelief(layerState, [jacketDet, dressDet, phantomTee], { now: 14000 }).state;
assert.equal(layerState.top?.kind, 'top', 'tee stays as base under jacket');
assert.equal(layerState.layer?.kind, 'outerwear', 'jacket occupies layer slot');
assert.equal(layerState.bottom?.kind, 'dress');
assert.equal(layerState.layer?.category, 'outerwear');

// Tee + overshirt (no outerwear category) still layers
const overshirt: OnDeviceDetection = {
  name: 'Blue shirt',
  category: 'tops',
  subcategory: 'shirt',
  color: 'blue',
  confidence: 0.9,
  bbox: [0.22, 0.12, 0.5, 0.4],
  trackId: 's1',
};
const teeBase: OnDeviceDetection = {
  name: 'White top',
  category: 'tops',
  subcategory: 't-shirt',
  color: 'white',
  confidence: 0.88,
  bbox: [0.28, 0.2, 0.4, 0.28],
  trackId: 't3',
};
let shirtLayer = createOutfitBeliefState();
shirtLayer = applyOutfitBelief(shirtLayer, [overshirt, teeBase], { now: 15000 }).state;
assert.equal(shirtLayer.top?.subcategory, 't-shirt', 'preserve tee subcategory');
assert.ok(shirtLayer.layer, 'shirt becomes layer over tee');

// Blazer + dress shirt (no tee): shirt must stay as base — not dropped as competing layer
{
  const blazer: OnDeviceDetection = {
    name: 'Light Blue Blazer',
    category: 'outerwear',
    subcategory: 'blazer',
    color: 'light_blue',
    confidence: 0.95,
    bbox: [0.2, 0.1, 0.5, 0.42],
    trackId: 'bl1',
  };
  const dressShirt: OnDeviceDetection = {
    name: 'White Dress Shirt',
    category: 'tops',
    subcategory: 'dress_shirt',
    color: 'white',
    confidence: 0.88,
    bbox: [0.24, 0.14, 0.44, 0.36],
    trackId: 'ds1',
  };
  let underBlazer = createOutfitBeliefState();
  underBlazer = applyOutfitBelief(underBlazer, [blazer, dressShirt], { now: 16000 }).state;
  assert.equal(underBlazer.top?.kind, 'top', 'dress shirt is base under blazer');
  assert.ok(/shirt/i.test(underBlazer.top?.name || underBlazer.top?.subcategory || ''), 'shirt name/sub kept');
  assert.equal(underBlazer.layer?.kind, 'outerwear', 'blazer is layer');
}

// kindToWardrobe: preserve fine labels; never invent sneakers
{
  const shirtObs = observationFromDetection({
    name: 'Pink Oxford Shirt',
    category: 'tops',
    subcategory: 'oxford_shirt',
    color: 'pink',
    confidence: 0.9,
    bbox: [0.2, 0.1, 0.5, 0.4],
  });
  assert.equal(shirtObs.subcategory, 'oxford_shirt');
  const shoeObs = observationFromDetection({
    name: 'Brown shoes',
    category: 'shoes',
    subcategory: 'shoes',
    color: 'brown',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
  });
  assert.equal(shoeObs.subcategory, 'shoes', 'unknown shoe must not become sneakers');
  const loaferObs = observationFromDetection({
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    color: 'brown',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
  });
  assert.equal(loaferObs.subcategory, 'loafers');
}

console.log('liveGarmentBelief.test.ts: all passed');
