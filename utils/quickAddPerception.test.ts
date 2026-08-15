/**
 * Quick Add perception hierarchy tests.
 * Run: npx tsx utils/quickAddPerception.test.ts
 */
import assert from 'node:assert/strict';

import { getOutfitItemLayerSlot } from './outfitItemOrder';
import {
  areFundamentallyIncompatible,
  isHangerShape,
  normalizeQuickAddColor,
  quickAddMacroRole,
  resolveQuickAddCategory,
} from './quickAddPerception';

assert.equal(isHangerShape({ w: 0.7, h: 0.4 }), true);
assert.equal(isHangerShape({ w: 0.3, h: 0.5 }), false);

assert.equal(areFundamentallyIncompatible('outerwear', 'shoes'), true);
assert.equal(areFundamentallyIncompatible('tops', 'shoes'), true);
assert.equal(areFundamentallyIncompatible('bottoms', 'shoes'), true);
assert.equal(areFundamentallyIncompatible('tops', 'bags'), true);
assert.equal(areFundamentallyIncompatible('tops', 'outerwear'), false);
assert.equal(areFundamentallyIncompatible('shoes', 'shoes'), false);

// Vision confident wins (compatible tops↔bottoms still prefers vision)
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

// --- Four-item category regression (saved wardrobe category) ---
// Stray YOLO shoes must not override confident Vision for non-footwear.

const strayShoeYolo = {
  yoloClass: 'shoes' as const,
  visionConfidence: 0.85,
  // Soft footwear heuristic bbox (large garment can still trip y+h>0.72)
  bbox: { x: 0.1, y: 0.45, w: 0.7, h: 0.4 },
};

const fourItemRegression: Array<{
  label: string;
  visionCategory: string;
  expect: string;
}> = [
  { label: 'blazer/jacket', visionCategory: 'blazer', expect: 'outerwear' },
  { label: 'shirt/top', visionCategory: 'shirt', expect: 'tops' },
  { label: 'trousers', visionCategory: 'trousers', expect: 'bottoms' },
];

for (const row of fourItemRegression) {
  const category = resolveQuickAddCategory({
    ...strayShoeYolo,
    visionCategory: row.visionCategory,
  });
  assert.equal(
    category,
    row.expect,
    `${row.label}: expected saved category ${row.expect}, got ${category}`,
  );
  // Outfit Mix / Get Outfits key off category — must not land in shoes slot
  assert.notEqual(
    getOutfitItemLayerSlot({ category, name: `Navy ${row.label}` }),
    'shoes',
    `${row.label}: category=${category} must not map to outfit shoes slot`,
  );
}

// Genuine shoes: Vision footwear still classifies as shoes (with or without YOLO)
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'shoes',
    visionCategory: 'sneakers',
    visionConfidence: 0.9,
    bbox: { x: 0.35, y: 0.7, w: 0.3, h: 0.25 },
  }),
  'shoes',
);
assert.equal(
  resolveQuickAddCategory({
    yoloClass: null,
    visionCategory: 'boots',
    visionConfidence: 0.88,
    bbox: { x: 0.4, y: 0.72, w: 0.25, h: 0.22 },
  }),
  'shoes',
);
assert.equal(
  getOutfitItemLayerSlot({ category: 'shoes', name: 'Black Boots' }),
  'shoes',
);

// Boots ≠ dress exception still holds
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'shoes',
    visionCategory: 'dresses',
    visionConfidence: 0.9,
    bbox: { x: 0.4, y: 0.75, w: 0.2, h: 0.2 },
  }),
  'shoes',
);

// Broader incompatibility: shirt must not become bag from stray YOLO
assert.equal(
  resolveQuickAddCategory({
    yoloClass: 'bag',
    visionCategory: 't-shirt',
    visionConfidence: 0.82,
    bbox: { x: 0.2, y: 0.2, w: 0.5, h: 0.45 },
  }),
  'tops',
);

// Contaminated legacy row: wrong category wins outfit slot over display name
assert.equal(
  getOutfitItemLayerSlot({ category: 'shoes', name: 'Black Blazer' }),
  'shoes',
  'downstream contamination: stored shoes category beats blazer name',
);
assert.equal(
  getOutfitItemLayerSlot({ category: 'outerwear', name: 'Black Blazer' }),
  'outerwear',
);
assert.equal(quickAddMacroRole('outerwear'), 'outerwear');
assert.equal(quickAddMacroRole('shoes'), 'footwear');

assert.equal(normalizeQuickAddColor('ivory'), 'cream');
assert.equal(normalizeQuickAddColor('tan'), 'beige');
assert.equal(normalizeQuickAddColor('cream'), 'cream');
assert.equal(normalizeQuickAddColor('multicoloured'), 'multicolor');
assert.equal(normalizeQuickAddColor('weird-chartreuse-glow'), 'other');
assert.equal(normalizeQuickAddColor(null), 'other');
assert.equal(normalizeQuickAddColor(''), 'other');

console.log('quickAddPerception.test.ts: all passed');
