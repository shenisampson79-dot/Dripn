/**
 * Footwear gate — evidence only, no invent.
 * Run: npx tsx utils/liveFootwearGate.test.ts
 */
import assert from 'node:assert/strict';
import {
  analyzeFootwearCandidate,
  assessFootZone,
  classifyShoeSubtype,
  gateFootwearDetections,
  scoreShoeStyle,
  shoeStyleScoreDelta,
  stabilizeShoeSubtype,
} from './liveFootwearGate';
import { applyDetectionMemory, createDetectionMemory } from './liveDetectionMemory';
import { isCroppedFrame } from './bodyGeometryGuardrails';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

const top: OnDeviceDetection = {
  name: 'Red top',
  category: 'tops',
  subcategory: 'top',
  color: 'red',
  confidence: 0.92,
  bbox: [0.2, 0.08, 0.55, 0.4],
};
const shorts: OnDeviceDetection = {
  name: 'Dark shorts',
  category: 'bottoms',
  subcategory: 'shorts',
  color: 'black',
  confidence: 0.9,
  bbox: [0.3, 0.52, 0.4, 0.24],
};
const bareFoot: OnDeviceDetection = {
  name: 'Shoes',
  category: 'shoes',
  subcategory: 'shoes',
  color: 'beige',
  confidence: 0.8,
  bbox: [0.4, 0.86, 0.22, 0.12],
  skinRatio: 0.42,
};
const realShoe: OnDeviceDetection = {
  name: 'Shoes',
  category: 'shoes',
  subcategory: 'shoes',
  color: 'white',
  confidence: 0.88,
  bbox: [0.4, 0.86, 0.22, 0.12],
  skinRatio: 0.08,
};

const noSkinShoe: OnDeviceDetection = {
  ...realShoe,
  skinRatio: undefined,
};

const noSkinNoFabric: OnDeviceDetection = {
  ...realShoe,
  color: 'unknown',
  skinRatio: undefined,
};

// Brightness says feet visible even if garment boxes are short
assert.equal(isCroppedFrame([shorts], { bottomBandBrightness: 0.25 }), false);
assert.equal(isCroppedFrame([shorts], { bottomBandBrightness: 0.05 }), true);

const zoneBright = assessFootZone({ detections: [shorts], bottomBandBrightness: 0.22 });
assert.equal(zoneBright.visible, true);
assert.equal(zoneBright.detectionEnabled, true);

const bare = analyzeFootwearCandidate(bareFoot);
assert.equal(bare.valid, false);
assert.equal(bare.rejectReason, 'barefoot');

// White trainers with no skin sample — fabric colour is enough evidence
const fabricWithoutSkin = analyzeFootwearCandidate(noSkinShoe);
assert.equal(fabricWithoutSkin.valid, true);

const unknownSkin = analyzeFootwearCandidate(noSkinNoFabric);
assert.equal(unknownSkin.valid, false);
assert.equal(unknownSkin.rejectReason, 'skin_unknown');

const trainerLabeled: OnDeviceDetection = {
  name: 'Black trainers',
  category: 'shoes',
  subcategory: 'sneakers',
  color: 'black',
  confidence: 0.7,
  bbox: [0.4, 0.86, 0.22, 0.12],
  skinRatio: undefined,
};
assert.equal(analyzeFootwearCandidate(trainerLabeled).valid, true);

const ok = analyzeFootwearCandidate(realShoe);
assert.equal(ok.valid, true);

const gatedBare = gateFootwearDetections([top, shorts, bareFoot], {
  bottomBandBrightness: 0.3,
});
assert.equal(gatedBare.accepted, null);
assert.equal(gatedBare.barefootEvidence, true);
assert.ok(gatedBare.decisions.some((d) => /barefoot/i.test(d.reason)));

const gatedOk = gateFootwearDetections([top, shorts, realShoe], {
  bottomBandBrightness: 0.3,
});
assert.ok(gatedOk.accepted);
assert.match(String(gatedOk.accepted?.name), /trainer/i, 'UK label: trainers');
assert.match(String(gatedOk.accepted?.subcategory), /sneaker|boot|sandal/);

assert.equal(classifyShoeSubtype({ bbox: realShoe.bbox, skinRatio: 0.08 }), 'sneakers');
assert.equal(classifyShoeSubtype({ bbox: realShoe.bbox, skinRatio: 0.18 }), 'sandals');
assert.equal(stabilizeShoeSubtype('sneakers', 'sandals', 0.7), 'sneakers');
assert.equal(stabilizeShoeSubtype('sneakers', 'sandals', 0.95), 'sandals');

const score = scoreShoeStyle({
  subtype: 'sneakers',
  color: 'white',
  bottomKind: 'shorts',
  occasionType: 'casual_day',
});
assert.ok(score.score >= 0.7, `expected strong sneakers+shorts, got ${score.score}`);
assert.ok(shoeStyleScoreDelta(score) >= 0);

const noScore = scoreShoeStyle({ subtype: null });
assert.equal(noScore.label, 'None');
assert.equal(shoeStyleScoreDelta(noScore), 0);

let mem = createDetectionMemory();
const m1 = applyDetectionMemory([top, shorts, bareFoot], mem, {
  now: 1000,
  bottomBandBrightness: 0.3,
});
assert.equal(m1.memory.footwear, null, 'barefoot must not become shoes');
assert.ok(m1.memory.lastFootwearCandidates.some((c) => c.rejectReason === 'barefoot'));

mem = m1.memory;
// Seed a phantom shoe belief then barefoot must clear it
mem.belief.footwear = {
  kind: 'shoes',
  category: 'shoes',
  subcategory: 'sneakers',
  color: 'white',
  confidence: 0.9,
  stability: 0.9,
  bbox: realShoe.bbox,
  lastChangedAt: 500,
  lastSeenAt: 500,
};
const mClear = applyDetectionMemory([top, shorts, bareFoot], mem, {
  now: 1500,
  bottomBandBrightness: 0.3,
});
assert.equal(mClear.memory.footwear, null, 'barefoot clears held shoe belief');

mem = createDetectionMemory();
const m2 = applyDetectionMemory([top, shorts, realShoe], mem, {
  now: 2000,
  bottomBandBrightness: 0.3,
  occasionType: 'casual_day',
});
assert.ok(m2.memory.footwear, 'real shoe accepted');
assert.ok(m2.memory.lastShoeScore && m2.memory.lastShoeScore.score > 0);

console.log('liveFootwearGate.test.ts: all passed');
