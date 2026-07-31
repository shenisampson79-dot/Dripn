/**
 * Belief debug decisions — why tags.
 * Run: npx tsx utils/liveBeliefDebug.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyOutfitBelief,
  createOutfitBeliefState,
  stabilizeColorDetailed,
} from './liveGarmentBelief';
import { applyDetectionMemory, createDetectionMemory } from './liveDetectionMemory';
import {
  buildDebugSnapshot,
  decisionGlyph,
  detectionsToDebugRows,
  stabilityBar,
} from './liveBeliefDebug';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

const topRed: OnDeviceDetection = {
  name: 'Red top',
  category: 'tops',
  subcategory: 'top',
  color: 'red',
  confidence: 0.92,
  bbox: [0.2, 0.08, 0.55, 0.4],
  trackId: 't1',
};
const topBlack: OnDeviceDetection = {
  name: 'Black top',
  category: 'tops',
  subcategory: 'top',
  color: 'black',
  confidence: 0.99,
  bbox: [0.2, 0.08, 0.55, 0.4],
  trackId: 't1',
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

const lock = stabilizeColorDetailed('red', 'black', 0.99, 'top');
assert.equal(lock.color, 'red');
assert.equal(lock.code, 'chromatic_lock');
assert.match(lock.reason || '', /downgrade|blocked/i);

let state = createOutfitBeliefState();
let r = applyOutfitBelief(state, [topRed, shorts], { now: 1000 });
state = r.state;
assert.ok(r.decisions.some((d) => d.type === 'update' || d.type === 'reinforce' || d.type === 'update'));
assert.ok(r.decisions.length > 0);

r = applyOutfitBelief(state, [topBlack, shorts], { now: 2000, decisions: [...r.decisions] });
assert.ok(
  r.decisions.some((d) => /blocked|reject|red/i.test(`${d.message} ${d.reason}`)),
  'must log chromatic lock',
);
assert.equal(r.state.top?.color, 'red');

r = applyOutfitBelief(r.state, [topRed], { now: 3000 });
assert.ok(
  r.decisions.some((d) => d.type === 'hold' && /memory|persist/i.test(d.reason)),
  'must hold shorts with reason',
);

const mem = createDetectionMemory();
const decisions: typeof r.decisions = [];
const m1 = applyDetectionMemory([topRed, shorts], mem, { now: 4000, decisions });
assert.ok(m1.decisions.length > 0);

const snap = buildDebugSnapshot({
  belief: m1.memory.belief,
  frameDetections: detectionsToDebugRows([topRed, shorts]),
  decisions: m1.decisions,
  cropped: m1.cropped,
  source: 'test',
});
assert.ok(snap.belief.top);
assert.match(snap.belief.top!.label, /red/i);
assert.equal(decisionGlyph('reject'), '!');
assert.equal(stabilityBar(1, 4), '████');
assert.equal(stabilityBar(0, 4), '░░░░');

console.log('liveBeliefDebug.test.ts: all passed');
