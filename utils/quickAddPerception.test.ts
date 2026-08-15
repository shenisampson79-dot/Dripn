/**
 * Quick Add perception hierarchy tests.
 * Run: npx tsx utils/quickAddPerception.test.ts
 */
import assert from 'node:assert/strict';

import {
  isHangerShape,
  normalizeQuickAddColor,
  resolveQuickAddCategory,
} from './quickAddPerception';

assert.equal(isHangerShape({ w: 0.7, h: 0.4 }), true);
assert.equal(isHangerShape({ w: 0.3, h: 0.5 }), false);

// Vision confident wins
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'bottoms',
    visionCategory: 't-shirt',
    visionConfidence: 0.85,
    bbox: { x: 0.1, y: 0.2, w: 0.7, h: 0.45 },
  }),
  'tops',
);

// Hanger mid + YOLO bottoms → tops without vision
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'bottoms',
    visionCategory: null,
    bbox: { x: 0.1, y: 0.25, w: 0.75, h: 0.4 },
  }),
  'tops',
);

// Shoe box + vision dress → shoes
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'shoes',
    visionCategory: 'dresses',
    visionConfidence: 0.9,
    bbox: { x: 0.4, y: 0.75, w: 0.2, h: 0.2 },
  }),
  'shoes',
);

// Blazer from vision
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'tops',
    visionCategory: 'blazer',
    visionConfidence: 0.8,
    bbox: { x: 0.2, y: 0.15, w: 0.55, h: 0.5 },
  }),
  'outerwear',
);

// YOLO/heuristic shoes must NOT override a vision blazer/jacket (jackets filed under Shoes)
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'shoes',
    visionCategory: 'blazer',
    visionConfidence: 0.8,
    bbox: { x: 0.2, y: 0.15, w: 0.55, h: 0.5 },
  }),
  'outerwear',
);
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'shoes',
    visionCategory: 'jacket',
    visionConfidence: 0.75,
    bbox: { x: 0.1, y: 0.45, w: 0.7, h: 0.4 },
  }),
  'outerwear',
);

assert.equal(normalizeQuickAddColor('ivory'), 'cream');
assert.equal(normalizeQuickAddColor('tan'), 'beige');
assert.equal(normalizeQuickAddColor('cream'), 'cream');
assert.equal(normalizeQuickAddColor('multicoloured'), 'multicolor');
assert.equal(normalizeQuickAddColor('weird-chartreuse-glow'), 'other');
assert.equal(normalizeQuickAddColor(null), 'other');
assert.equal(normalizeQuickAddColor(''), 'other');

console.log('quickAddPerception.test.ts: all passed');
