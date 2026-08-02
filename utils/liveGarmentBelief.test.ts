/**
 * Belief engine — belief > frame.
 * Run: npx tsx utils/liveGarmentBelief.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyOutfitBelief,
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

assert.equal(normalizeBeliefColor('grey'), 'black');
assert.equal(normalizeBeliefColor('dark grey'), 'black');
assert.equal(normalizeBeliefColor('grey', 'shoes'), 'gray');
assert.equal(normalizeBeliefColor('gray', 'shoes'), 'gray');
assert.equal(colorDistance('gray', 'black'), 0);
assert.ok(colorDistance('gray', 'black', 'shoes') > 0);
assert.equal(stabilizeColor('red', 'black', 0.99, 'top'), 'red');
assert.equal(stabilizeColor('red', 'gray', 0.9, 'top'), 'red');
assert.equal(stabilizeColor('black', 'gray', 0.5, 'shorts'), 'black');
assert.equal(stabilizeColor('red', 'blue', 0.5, 'top'), 'red'); // below threshold
assert.equal(stabilizeColor('red', 'blue', 0.97, 'top'), 'blue');
assert.equal(formatGarmentDisplayName({ color: 'gray', category: 'bottoms', subcategory: 'shorts' }), 'Dark shorts');
assert.equal(formatGarmentDisplayName({ color: 'black', category: 'bottoms', subcategory: 'shorts' }), 'Dark shorts');

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
  name: 'Black top',
  category: 'tops',
  subcategory: 'top',
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
  name: 'Dark shorts',
  category: 'bottoms',
  subcategory: 'shorts',
  color: 'gray',
  confidence: 0.9,
  bbox: [0.3, 0.52, 0.4, 0.24],
  trackId: 'b1',
};

// Weak black observation strips color proposal
const weakObs = observationFromDetection(topBlackWeak, 1000);
assert.equal(weakObs.color, null);
assert.ok(weakObs.confidence < CHANGE_THRESHOLD || weakObs.color === null);

// Red locks against black phone frame
let state = createOutfitBeliefState();
let r = applyOutfitBelief(state, [topRed, shorts], { now: 2000 });
state = r.state;
assert.equal(state.top?.color, 'red');
assert.equal(beliefToDetection(state.top!).name, 'Red top');
assert.equal(beliefToDetection(state.bottom!).name, 'Dark shorts');

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

// Gray vs black shorts — same belief
r = applyOutfitBelief(state, [topRed, { ...shorts, color: 'black', name: 'Black shorts' }], { now: 7000 });
assert.equal(beliefToDetection(r.state.bottom!).name, 'Dark shorts');

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

console.log('liveGarmentBelief.test.ts: all passed');
