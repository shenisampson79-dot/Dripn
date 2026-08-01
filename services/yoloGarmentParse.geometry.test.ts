/**
 * YOLO clothing geometry + hard footwear priors.
 * Run: npx tsx services/yoloGarmentParse.geometry.test.ts
 */
import assert from 'node:assert/strict';

import { mapYoloClassToWardrobeCategory, looksLikeFootwearBbox } from './yoloGarmentParse';

// Top region → tops
{
  const r = mapYoloClassToWardrobeCategory(0, [0.12, 0.1, 0.7, 0.4]);
  assert.equal(r.category, 'tops', `top region → tops, got ${r.category}`);
}

// Transition must not become bottoms from width
{
  const r = mapYoloClassToWardrobeCategory(0, [0.15, 0.35, 0.7, 0.25]);
  assert.equal(r.category, 'tops', `transition → tops, got ${r.category}`);
}

// Bottom region → bottoms
{
  const r = mapYoloClassToWardrobeCategory(0, [0.25, 0.5, 0.45, 0.28]);
  assert.equal(r.category, 'bottoms', `bottom region → bottoms, got ${r.category}`);
}

assert.equal(looksLikeFootwearBbox([0.3, 0.42, 0.35, 0.45]), false);
assert.equal(looksLikeFootwearBbox([0.2, 0.12, 0.55, 0.42]), false);
assert.equal(looksLikeFootwearBbox([0.4, 0.82, 0.22, 0.14]), true);
assert.equal(looksLikeFootwearBbox([0.35, 0.62, 0.28, 0.28]), false, 'thigh ≠ shoes');
assert.equal(looksLikeFootwearBbox([0.3, 0.55, 0.4, 0.32]), false, 'shorts ≠ shoes');

// Shorts geometry in bottom band (ends mid-thigh)
{
  const r = mapYoloClassToWardrobeCategory(0, [0.25, 0.52, 0.4, 0.24]);
  assert.equal(r.category, 'bottoms');
  assert.equal(r.name, 'Shorts');
}

// Floor-reaching pant leg → Trousers
{
  const r = mapYoloClassToWardrobeCategory(0, [0.35, 0.48, 0.22, 0.48]);
  assert.equal(r.category, 'bottoms');
  assert.equal(r.name, 'Trousers');
}

console.log('yoloGarmentParse.geometry.test.ts: all passed');
