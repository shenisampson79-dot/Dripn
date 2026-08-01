/**
 * Hybrid detection layer tests.
 * Run: npx tsx utils/hybridDetectionLayer.test.ts
 */
import assert from 'node:assert/strict';
import {
  applyHybridDetection,
  correctClassByRegion,
  getBodyRegion,
  recoverShoes,
} from './hybridDetectionLayer';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

assert.equal(getBodyRegion([0.2, 0.05, 0.4, 0.2]), 'top');
assert.equal(getBodyRegion([0.2, 0.42, 0.4, 0.1]), 'transition');
assert.equal(getBodyRegion([0.2, 0.5, 0.4, 0.2]), 'bottom');
assert.equal(getBodyRegion([0.3, 0.8, 0.2, 0.14]), 'footwear');

// Boots in footwear zone → shoes
const bootsAsDress: OnDeviceDetection = {
  name: 'Dress',
  category: 'dresses',
  subcategory: 'dress',
  confidence: 0.5,
  bbox: [0.4, 0.78, 0.22, 0.18],
};
const fixed = correctClassByRegion(bootsAsDress);
assert.equal(fixed.detection.category, 'shoes');

// Tall torso falsely tagged shoes → tops
const torsoAsShoes: OnDeviceDetection = {
  name: 'Shoes',
  category: 'shoes',
  confidence: 0.6,
  bbox: [0.2, 0.12, 0.55, 0.42],
};
assert.equal(correctClassByRegion(torsoAsShoes).detection.category, 'tops');

// Tall legs falsely tagged shoes → bottoms
const legsAsShoes: OnDeviceDetection = {
  name: 'Shoes',
  category: 'shoes',
  confidence: 0.6,
  bbox: [0.3, 0.5, 0.35, 0.28],
};
assert.equal(correctClassByRegion(legsAsShoes).detection.category, 'bottoms');

// Mid torso tagged bottoms → tops (transition lock)
const poloAsTrousers: OnDeviceDetection = {
  name: 'Trousers',
  category: 'bottoms',
  confidence: 0.7,
  bbox: [0.25, 0.18, 0.5, 0.35],
};
assert.equal(correctClassByRegion(poloAsTrousers).detection.category, 'tops');

const top: OnDeviceDetection = {
  name: 'Top',
  category: 'tops',
  confidence: 0.9,
  bbox: [0.25, 0.08, 0.45, 0.28],
};
const footBlob: OnDeviceDetection = {
  name: 'Unknown',
  category: 'tops',
  confidence: 0.4,
  bbox: [0.4, 0.82, 0.22, 0.14],
};
const recovered = recoverShoes([top, footBlob]);
assert.ok(recovered.detections.some((d) => d.category === 'shoes'));
assert.ok(recovered.repairs.includes('recover_shoes_from_footwear_zone'));

const tallTrousers: OnDeviceDetection = {
  name: 'Trousers',
  category: 'bottoms',
  confidence: 0.85,
  bbox: [0.3, 0.5, 0.35, 0.32],
};
const noRemat = recoverShoes([top, tallTrousers], { inferMissingFootwear: false });
assert.ok(!noRemat.repairs.includes('recover_shoes_from_footwear_zone'));

const trousers: OnDeviceDetection = {
  name: 'Trousers',
  category: 'bottoms',
  confidence: 0.85,
  bbox: [0.3, 0.55, 0.35, 0.38], // reaches near floor — feet in frame
};
const inferred = applyHybridDetection([top, trousers], { inferMissingFootwear: true });
assert.equal(inferred.hasFootwear, true);
assert.ok(inferred.repairs.includes('infer_missing_footwear'));

const noInvent = applyHybridDetection([top, trousers]);
assert.equal(noInvent.hasFootwear, false);

// Cropped mirror selfie (shorts end mid-frame) — do NOT invent shoes
const shortsCropped: OnDeviceDetection = {
  name: 'Shorts',
  category: 'bottoms',
  confidence: 0.8,
  bbox: [0.3, 0.52, 0.4, 0.24], // bottom ~0.76 — ends mid-thigh
};
const noFakeShoes = applyHybridDetection([top, shortsCropped]);
assert.equal(noFakeShoes.hasFootwear, false);
assert.ok(!noFakeShoes.repairs.includes('infer_missing_footwear'));
assert.equal(
  correctClassByRegion(shortsCropped).detection.name,
  'Shorts',
);

// Absolute cropped lock — even shoe-labelled thigh boxes become bottoms
const thighShoes: OnDeviceDetection = {
  name: 'Shoes',
  category: 'shoes',
  confidence: 0.8,
  bbox: [0.35, 0.58, 0.3, 0.28],
};
const croppedLock = applyHybridDetection([top, thighShoes], { croppedFrame: true });
assert.equal(croppedLock.hasFootwear, false);
assert.ok(!croppedLock.detections.some((d) => d.category === 'shoes'));

console.log('hybridDetectionLayer.test.ts: all passed');
