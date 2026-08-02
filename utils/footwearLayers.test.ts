/**
 * Footwear 3-layer model regression.
 * Run: npx tsx utils/footwearLayers.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildFootwearDisplayLabel,
  buildFootwearLayers,
  isCoarsenedFootwearDisplay,
  toCanonicalFootwearFamily,
} from './footwearLayers';
import { gateFootwearDetections } from './liveFootwearGate';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

assert.equal(toCanonicalFootwearFamily('flip_flops'), 'sandals');
assert.equal(toCanonicalFootwearFamily('slides'), 'sandals');
assert.equal(toCanonicalFootwearFamily('sneakers'), 'casual_shoes');

itPreservesFineGrained();

function itPreservesFineGrained() {
  const layers = buildFootwearLayers({
    type: 'flip_flops',
    color: 'grey',
    confidence: 0.92,
  });
  assert.equal(layers.canonical, 'sandals');
  assert.match(layers.displayLabel, /flip-flops/i);
  assert.match(layers.displayLabel, /grey/i);
  assert.doesNotMatch(layers.displayLabel, /sandal/i);
  assert.equal(isCoarsenedFootwearDisplay(layers.displayLabel, 'flip_flops'), false);
  assert.equal(isCoarsenedFootwearDisplay('Black sandals', 'flip_flops'), true);
}

const label = buildFootwearDisplayLabel({ type: 'flip_flops', color: 'gray' });
assert.match(label, /grey flip-flops/i);
assert.doesNotMatch(label, /sandal/i);

const top: OnDeviceDetection = {
  name: 'Blue top',
  category: 'tops',
  subcategory: 't-shirt',
  color: 'blue',
  confidence: 0.9,
  bbox: [0.2, 0.1, 0.5, 0.35],
};
const shorts: OnDeviceDetection = {
  name: 'Dark shorts',
  category: 'bottoms',
  subcategory: 'shorts',
  color: 'black',
  confidence: 0.95,
  bbox: [0.25, 0.45, 0.4, 0.28],
};
const greyFlip: OnDeviceDetection = {
  name: 'Grey Flip Flops',
  category: 'shoes',
  subcategory: 'flip_flops',
  color: 'gray',
  confidence: 0.9,
  bbox: [0.35, 0.88, 0.22, 0.08],
  skinRatio: 0.16,
};
const gated = gateFootwearDetections([top, shorts, greyFlip], {
  bottomBandBrightness: 0.3,
});
assert.ok(gated.accepted);
assert.equal(gated.accepted?.subcategory, 'flip_flops');
assert.match(String(gated.accepted?.name), /grey flip-flops/i);
assert.doesNotMatch(String(gated.accepted?.name), /black sandal/i);
assert.match(String(gated.decisions.at(-1)?.reason || ''), /canonical=sandals/);

console.log('footwearLayers.test.ts: all passed');
