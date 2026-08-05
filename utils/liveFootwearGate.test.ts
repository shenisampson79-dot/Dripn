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
import { isCroppedFrame, formatGarmentDisplayName } from './bodyGeometryGuardrails';
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

// Labeled hard-footwear box may pass without fabric colour (dim black loafers).
const labeledNoFabric = analyzeFootwearCandidate(noSkinNoFabric);
assert.equal(labeledNoFabric.valid, true);

const softUnknown: OnDeviceDetection = {
  name: 'Clothing',
  category: 'unknown',
  color: 'unknown',
  confidence: 0.7,
  // Mid-leg soft box — not hard footwear geometry
  bbox: [0.35, 0.62, 0.28, 0.16],
  skinRatio: undefined,
};
const unknownSkin = analyzeFootwearCandidate(softUnknown);
assert.equal(unknownSkin.valid, false);
assert.ok(
  ['skin_unknown', 'not_labeled_footwear', 'outside_footwear_zone', 'invalid_shape'].includes(
    String(unknownSkin.rejectReason),
  ),
);

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

const greyFlipFlops: OnDeviceDetection = {
  name: 'Grey Flip Flops',
  category: 'shoes',
  subcategory: 'flip_flops',
  color: 'gray',
  confidence: 0.9,
  bbox: [0.35, 0.88, 0.22, 0.08],
  skinRatio: 0.16,
  trackId: 'ff1',
};
const gatedFlip = gateFootwearDetections([top, shorts, greyFlipFlops], {
  bottomBandBrightness: 0.3,
});
assert.ok(gatedFlip.accepted);
assert.equal(gatedFlip.accepted?.subcategory, 'flip_flops');
assert.match(String(gatedFlip.accepted?.name), /grey flip-flops/i);
assert.doesNotMatch(String(gatedFlip.accepted?.name), /black sandal/i);

assert.equal(classifyShoeSubtype({ bbox: realShoe.bbox, skinRatio: 0.08 }), 'sneakers');
assert.equal(classifyShoeSubtype({ bbox: realShoe.bbox, skinRatio: 0.18 }), 'sandals');
assert.equal(
  classifyShoeSubtype({
    bbox: [0.35, 0.88, 0.22, 0.08],
    skinRatio: 0.16,
    name: 'Grey Flip Flops',
    subcategory: 'flip_flops',
  }),
  'flip_flops',
);
assert.equal(
  formatGarmentDisplayName({ color: 'gray', category: 'shoes', subcategory: 'flip_flops' }),
  'Grey Flip-Flops',
);
assert.equal(
  formatGarmentDisplayName({ color: 'grey', category: 'shoes', subcategory: 'flip_flops' }),
  'Grey Flip-Flops',
);
// Mid-calf Dr Martens-like shaft
assert.equal(
  classifyShoeSubtype({ bbox: [0.35, 0.78, 0.28, 0.18], skinRatio: 0.06 }),
  'boots',
);
assert.match(
  formatGarmentDisplayName({ color: 'black', category: 'shoes', subcategory: 'boots' }),
  /boot/i,
);
assert.equal(
  classifyShoeSubtype({ bbox: [0.4, 0.82, 0.24, 0.13], skinRatio: 0.05 }),
  'boots',
  'ankle-crop of boots still boots when shaft starts above ankle',
);
assert.equal(stabilizeShoeSubtype('sneakers', 'sandals', 0.7), 'sneakers');
assert.equal(stabilizeShoeSubtype('sneakers', 'sandals', 0.95), 'sandals');
assert.equal(
  classifyShoeSubtype({
    bbox: [0.35, 0.78, 0.28, 0.18],
    skinRatio: 0.06,
    name: 'Red and White Boat Shoes',
  }),
  'boat_shoes',
  'boat shoes win over tall-box boot heuristic',
);
assert.equal(
  stabilizeShoeSubtype('boat_shoes', 'boots', 0.91),
  'boat_shoes',
  'locked boat shoes resist boots flicker',
);
assert.equal(
  stabilizeShoeSubtype('boat_shoes', 'boots', 0.99),
  'boots',
  'near-certain boots still unlock a boat lock',
);
// Boat ↔ trainers is a plausible swap, but a single frame must not make the
// label alternate on camera; sustained frames unlock it in stabilizeFootwearIdentity.
assert.equal(
  stabilizeShoeSubtype('boat_shoes', 'sneakers', 0.91),
  'boat_shoes',
  'locked boat shoes resist trainers flicker',
);
assert.equal(
  stabilizeShoeSubtype('flip_flops', 'sandals', 0.91),
  'flip_flops',
  'other known confusions hold on a single confident frame too',
);
assert.equal(
  stabilizeShoeSubtype('sneakers', 'sandals', 0.95),
  'sandals',
  'a swap the detectors do not confuse is a real change',
);
assert.equal(
  stabilizeShoeSubtype('sneakers', 'boots', 0.8),
  'boots',
  'vision boots unlock sticky trainers',
);

// Vision "Brown Leather Boots" must not become trainers via geometry rewrite
{
  const leatherBoots: OnDeviceDetection = {
    name: 'Brown Leather Boots',
    category: 'shoes',
    subcategory: 'boots',
    color: 'brown',
    confidence: 0.9,
    bbox: [0.38, 0.88, 0.26, 0.08], // short ankle crop — geometry alone → sneakers
    trackId: 'lb1',
  };
  const gated = gateFootwearDetections([leatherBoots], { now: 3000 });
  assert.ok(gated.accepted, 'boots accepted');
  assert.equal(gated.accepted?.subcategory, 'boots');
  assert.match(String(gated.accepted?.name || ''), /boot/i);
}

// Vision "White Chinos" must not become shorts via hip-crop geometry
{
  const chinos: OnDeviceDetection = {
    name: 'White Chinos',
    category: 'bottoms',
    subcategory: 'chinos',
    color: 'white',
    confidence: 0.9,
    bbox: [0.28, 0.48, 0.4, 0.22], // hip→thigh crop
    trackId: 'wc1',
  };
  const blazer: OnDeviceDetection = {
    name: 'Light Blue Blazer',
    category: 'outerwear',
    subcategory: 'blazer',
    color: 'light_blue',
    confidence: 0.92,
    bbox: [0.2, 0.1, 0.5, 0.4],
    trackId: 'bl2',
  };
  const memChino = applyDetectionMemory([blazer, chinos], createDetectionMemory(), { now: 4000 });
  // Chinos are kept as chinos — specificity beats the coarse trousers label —
  // but a hip-to-thigh crop must never demote them to shorts.
  assert.match(
    String(memChino.memory.bottom?.subcategory),
    /^(chinos|trousers)$/,
    'chinos stay in the trousers family',
  );
  assert.ok(!/short/i.test(memChino.memory.bottom?.name || ''), 'name must not say shorts');
}

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
