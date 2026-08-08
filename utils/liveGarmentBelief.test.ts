/**
 * Belief engine — belief > frame.
 * Run: npx tsx utils/liveGarmentBelief.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyOutfitBelief,
  beliefKindFromDetection,
  colorDistance,
  colorFromVisionName,
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
assert.equal(normalizeBeliefColor('dark grey'), 'gray');
assert.equal(normalizeBeliefColor('charcoal', 'trousers'), 'gray');
assert.equal(normalizeBeliefColor('charcoal', 'top'), 'gray');
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
// Title Case matches Vision-authored names ("Pink Flower Sandals") so one card
// never mixes "Blue shorts" with "Pink Flower Sandals".
assert.equal(formatGarmentDisplayName({ color: 'gray', category: 'bottoms', subcategory: 'shorts' }), 'Grey Shorts');
assert.equal(formatGarmentDisplayName({ color: 'black', category: 'bottoms', subcategory: 'shorts' }), 'Dark Shorts');
assert.equal(
  formatGarmentDisplayName({ color: 'light_pink', category: 'tops', subcategory: 'dress_shirt' }),
  'Light Pink Top',
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
// Visible strip of tee showing through an open jacket — a real second piece.
const baseTee: OnDeviceDetection = {
  name: 'Blue top',
  category: 'tops',
  subcategory: 'top',
  color: 'blue',
  confidence: 0.95,
  bbox: [0.34, 0.18, 0.2, 0.3],
  trackId: 't2',
};
let layerState = createOutfitBeliefState();
layerState = applyOutfitBelief(layerState, [jacketDet, dressDet, baseTee], { now: 14000 }).state;
assert.equal(layerState.top?.kind, 'top', 'tee stays as base under jacket');
assert.equal(layerState.layer?.kind, 'outerwear', 'jacket occupies layer slot');
assert.equal(layerState.bottom?.kind, 'dress');
assert.equal(layerState.layer?.category, 'outerwear');

// One hoodie read twice ("Charcoal top" + "Black Hoodie") must not become two
// pieces — same box, same colour family, so there is nothing else to see.
{
  const hoodie: OnDeviceDetection = {
    name: 'Black Hoodie',
    category: 'outerwear',
    subcategory: 'hoodie',
    color: 'black',
    confidence: 0.9,
    bbox: [0.22, 0.14, 0.48, 0.36],
    trackId: 'h1',
  };
  const ghostCharcoal: OnDeviceDetection = {
    name: 'Charcoal top',
    category: 'tops',
    subcategory: 'top',
    color: 'charcoal',
    confidence: 0.93,
    bbox: [0.23, 0.15, 0.47, 0.35],
    trackId: 'h2',
  };
  let dupe = createOutfitBeliefState();
  dupe = applyOutfitBelief(dupe, [hoodie, ghostCharcoal, shorts], { now: 15000 }).state;
  assert.ok(dupe.top, 'the hoodie still occupies a slot');
  assert.equal(dupe.layer, null, 'duplicate read does not create a second upper');
  assert.match(dupe.top?.name || '', /hoodie/i, 'the named garment survives, not the generic read');
}

// Massive head-to-waist charcoal ghost (low IoU with nested hoodie) — QA IMG_9692.
{
  const hoodie: OnDeviceDetection = {
    name: 'Black Hoodie',
    category: 'outerwear',
    subcategory: 'hoodie',
    color: 'black',
    confidence: 0.95,
    bbox: [0.28, 0.28, 0.44, 0.22],
    trackId: 'hn1',
  };
  const ghostHuge: OnDeviceDetection = {
    name: 'Charcoal Top',
    category: 'tops',
    subcategory: 'top',
    color: 'charcoal',
    confidence: 0.97,
    bbox: [0.18, 0.08, 0.64, 0.48],
    trackId: 'hn2',
  };
  let nested = createOutfitBeliefState();
  nested = applyOutfitBelief(nested, [hoodie, ghostHuge, shorts], { now: 15500 }).state;
  assert.equal(nested.layer, null, 'huge charcoal ghost must not layer under hoodie');
  assert.match(nested.top?.name || '', /hoodie/i, 'hoodie wins over nested charcoal ghost');
}

// Two Black Hoodie bboxes → one belief slot (top + layer both hoodie).
{
  const h1: OnDeviceDetection = {
    name: 'Black Hoodie',
    category: 'outerwear',
    subcategory: 'hoodie',
    color: 'black',
    confidence: 0.98,
    bbox: [0.24, 0.16, 0.46, 0.34],
    trackId: 'dh1',
  };
  const h2: OnDeviceDetection = {
    name: 'Black Hoodie',
    category: 'tops',
    subcategory: 'hoodie',
    color: 'black',
    confidence: 0.95,
    bbox: [0.26, 0.18, 0.42, 0.30],
    trackId: 'dh2',
  };
  let twin = createOutfitBeliefState();
  twin = applyOutfitBelief(twin, [h1, h2, shorts], { now: 15600 }).state;
  assert.equal(twin.layer, null, 'duplicate hoodie bboxes must not fill layer');
  assert.match(twin.top?.name || '', /hoodie/i);
}

// Camera loss / focus break must drop held ghost layers immediately (no 18s TTL).
{
  const hoodie: OnDeviceDetection = {
    name: 'Black Hoodie',
    category: 'outerwear',
    subcategory: 'hoodie',
    color: 'black',
    confidence: 0.95,
    bbox: [0.25, 0.18, 0.45, 0.32],
    trackId: 'cl1',
  };
  const ghost: OnDeviceDetection = {
    name: 'Charcoal Top',
    category: 'tops',
    subcategory: 'top',
    color: 'charcoal',
    confidence: 0.9,
    bbox: [0.2, 0.1, 0.55, 0.4],
    trackId: 'cl2',
  };
  let lost = createOutfitBeliefState();
  // Force a layered state then subject-loss clear
  lost = applyOutfitBelief(lost, [hoodie, ghost, shorts], { now: 20000 }).state;
  // Manually simulate held layer surviving a bad frame path
  if (!lost.layer && lost.top) {
    lost = {
      ...lost,
      layer: { ...lost.top, name: 'Charcoal Top', subcategory: 'top', kind: 'top' as const },
      top: { ...lost.top, name: 'Black Hoodie', subcategory: 'hoodie' },
    };
  }
  const afterLoss = applyOutfitBelief(lost, [shorts], {
    now: 20100,
    subjectLost: true,
  }).state;
  assert.equal(afterLoss.layer, null, 'subjectLost clears ghost layer immediately');
}

// Beige ghost under black hoodie (different colour family) must not invent layering.
{
  const hoodie: OnDeviceDetection = {
    name: 'Black Hoodie',
    category: 'outerwear',
    subcategory: 'hoodie',
    color: 'black',
    confidence: 0.9,
    bbox: [0.22, 0.14, 0.48, 0.36],
    trackId: 'hb1',
  };
  const ghostBeige: OnDeviceDetection = {
    name: 'Beige top',
    category: 'tops',
    subcategory: 'top',
    color: 'beige',
    confidence: 0.91,
    bbox: [0.24, 0.16, 0.45, 0.34],
    trackId: 'hb2',
  };
  let beigeGhost = createOutfitBeliefState();
  beigeGhost = applyOutfitBelief(beigeGhost, [hoodie, ghostBeige, shorts], { now: 17000 }).state;
  assert.equal(beigeGhost.layer, null, 'beige ghost must not become a base layer');
  assert.match(beigeGhost.top?.name || '', /hoodie/i, 'hoodie remains the only upper');

  // Charcoal top locks first, then hoodie-only frames must clear the phantom base.
  const ghostCharcoalHeld: OnDeviceDetection = {
    name: 'Charcoal top',
    category: 'tops',
    subcategory: 'top',
    color: 'charcoal',
    confidence: 0.93,
    bbox: [0.23, 0.15, 0.47, 0.35],
    trackId: 'hc1',
  };
  let heldPhantom = createOutfitBeliefState();
  heldPhantom = applyOutfitBelief(heldPhantom, [ghostCharcoalHeld, shorts], { now: 18000 }).state;
  heldPhantom = applyOutfitBelief(heldPhantom, [ghostCharcoalHeld, shorts], { now: 18100 }).state;
  heldPhantom = applyOutfitBelief(heldPhantom, [ghostCharcoalHeld, shorts], { now: 18200 }).state;
  heldPhantom = applyOutfitBelief(heldPhantom, [ghostCharcoalHeld, shorts], { now: 18300 }).state;
  assert.ok(Number(heldPhantom.top?.stability) >= 0.55, 'charcoal must be stable to test hold');
  heldPhantom = applyOutfitBelief(heldPhantom, [hoodie, shorts], { now: 18400 }).state;
  assert.equal(heldPhantom.layer, null, 'hoodie-only frame clears phantom charcoal base');
  assert.match(heldPhantom.top?.name || '', /hoodie/i, 'hoodie replaces generic charcoal top');
}

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

  // Blazer-only re-fire must not erase a stable shirt (tie/shirt false conflict).
  underBlazer = applyOutfitBelief(underBlazer, [blazer, dressShirt], { now: 16100 }).state;
  underBlazer = applyOutfitBelief(underBlazer, [blazer, dressShirt], { now: 16200 }).state;
  underBlazer = applyOutfitBelief(underBlazer, [blazer, dressShirt], { now: 16300 }).state;
  assert.ok(
    Number(underBlazer.top?.stability) >= 0.55,
    'shirt must be stable enough to retain',
  );
  underBlazer = applyOutfitBelief(underBlazer, [blazer], { now: 16400 }).state;
  assert.ok(/shirt/i.test(underBlazer.top?.name || underBlazer.top?.subcategory || ''), 'shirt held on blazer-only frame');
  assert.equal(underBlazer.layer?.kind, 'outerwear', 'blazer stays in layer, not promoted over shirt');
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

// Two-tone footwear names must not collapse to whichever colour ranks higher
{
  assert.equal(colorFromVisionName('Brown and White Sneakers'), 'multicolor');
  assert.equal(colorFromVisionName('Black/White Trainers'), 'multicolor');
  assert.equal(colorFromVisionName('Multicolor Boat Shoes'), 'multicolor');
  // Compound single colours stay single
  assert.equal(colorFromVisionName('Light Blue Shirt'), 'light_blue');
  assert.equal(colorFromVisionName('Charcoal Grey Sweatpants'), 'gray');
  assert.equal(colorFromVisionName('White Trainers'), 'white');

  // Belief adopts the richer read instead of reinforcing the older single colour
  const white: OnDeviceDetection = {
    name: 'White Trainers',
    category: 'shoes',
    subcategory: 'sneakers',
    color: 'white',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
    trackId: 'sh1',
  };
  const twoTone: OnDeviceDetection = {
    name: 'Brown and White Sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    color: 'white',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
    trackId: 'sh1',
  };
  let shoes = createOutfitBeliefState();
  shoes = applyOutfitBelief(shoes, [white], { now: 1000 }).state;
  assert.equal(shoes.footwear?.color, 'white');
  shoes = applyOutfitBelief(shoes, [twoTone], { now: 2200 }).state;
  assert.equal(shoes.footwear?.color, 'multicolor', 'two-tone vision name wins');
  assert.match(shoes.footwear?.name || '', /brown and white/i, 'richer identity adopted');
  // ...and a later single-colour frame must not flatten it back
  shoes = applyOutfitBelief(shoes, [white], { now: 3400 }).state;
  assert.equal(shoes.footwear?.color, 'multicolor', 'two-tone resists single-colour flatten');
}

// Locked shorts must yield to a cloud Vision trousers correction even when a
// continuity shorts box is still louder in the same frame.
{
  const lockedShorts: OnDeviceDetection = {
    name: 'White Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'white',
    confidence: 0.92,
    bbox: [0.3, 0.48, 0.35, 0.28],
    trackId: 'b1',
    source: 'cloud_vision_fill',
  };
  const cloudTrousers: OnDeviceDetection = {
    name: 'White Full-Length Trousers',
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'white',
    confidence: 0.88,
    bbox: [0.3, 0.42, 0.35, 0.48],
    trackId: 'b2',
    source: 'cloud_vision',
  };
  const tee: OnDeviceDetection = {
    name: 'White T-Shirt',
    category: 'tops',
    subcategory: 't-shirt',
    color: 'white',
    confidence: 0.9,
    bbox: [0.28, 0.18, 0.4, 0.28],
    trackId: 't1',
  };
  let st = createOutfitBeliefState();
  st = applyOutfitBelief(st, [tee, lockedShorts], { now: 1000 }).state;
  // Stabilize lock
  st = applyOutfitBelief(st, [tee, lockedShorts], { now: 2000 }).state;
  st = applyOutfitBelief(st, [tee, lockedShorts], { now: 3000 }).state;
  assert.equal(st.bottom?.kind, 'shorts');
  st = applyOutfitBelief(st, [tee, lockedShorts, cloudTrousers], { now: 5000 }).state;
  assert.equal(st.bottom?.kind, 'trousers', 'cloud trousers unlock beat continuity shorts');
  assert.match(st.bottom?.name || '', /trouser/i);
}

// Length authority: once shorts lock, YOLO floor-length geometry cannot flip to trousers.
// Only an explicit Vision correction unlocks — and DBG shows CORRECTING.
{
  const tee: OnDeviceDetection = {
    name: 'White T-Shirt',
    category: 'tops',
    subcategory: 't-shirt',
    color: 'white',
    confidence: 0.9,
    bbox: [0.28, 0.18, 0.4, 0.28],
    trackId: 't1',
  };
  const shortsBox: OnDeviceDetection = {
    name: 'Beige Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'beige',
    confidence: 0.9,
    bbox: [0.3, 0.48, 0.35, 0.28],
    trackId: 'b1',
  };
  let st = createOutfitBeliefState();
  for (let t = 1000; t <= 7000; t += 1000) {
    st = applyOutfitBelief(st, [tee, shortsBox], { now: t }).state;
  }
  assert.equal(st.bottom?.kind, 'shorts');
  assert.equal(st.bottom?.lengthAuthority, true, 'earned length authority');

  const yoloTrousers: OnDeviceDetection = {
    name: 'Beige Trousers',
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'beige',
    confidence: 0.88,
    bbox: [0.3, 0.42, 0.35, 0.50],
    trackId: 'b2',
  };
  st = applyOutfitBelief(st, [tee, yoloTrousers], { now: 8000 }).state;
  assert.equal(st.bottom?.kind, 'shorts', 'YOLO trousers rejected under length authority');

  const visionTrousers: OnDeviceDetection = {
    name: 'Beige Full-Length Trousers',
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'beige',
    confidence: 0.9,
    bbox: [0.3, 0.42, 0.35, 0.50],
    trackId: 'b3',
    source: 'cloud_vision',
  };
  st = applyOutfitBelief(st, [tee, visionTrousers], { now: 9000 }).state;
  assert.equal(st.bottom?.kind, 'trousers', 'Vision correction unlocks length');
  assert.equal(st.bottom?.lengthUi, 'correcting');
  assert.equal(st.bottom?.lengthAuthority, false);
}

console.log('liveGarmentBelief.test.ts: all passed');
