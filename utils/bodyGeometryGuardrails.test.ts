/**
 * Hard body-geometry guardrails.
 * Run: npx tsx utils/bodyGeometryGuardrails.test.ts
 */
import assert from 'node:assert/strict';
import {
  REGION,
  classifyBottomSubtype,
  classifyColorFromRgb,
  feetLikelyCropped,
  formatGarmentDisplayName,
  getStrictBodyRegion,
  hasKneeBreakEvidence,
  isCroppedFrame,
  isFloorLengthTrousersEvidence,
  isHardFootwear,
  isSkinPixel,
  resolveClassByRegionLock,
  resolveDetectionConflicts,
  scoreBottomHypotheses,
  detectTorsoState,
  isBareTorsoTopLike,
} from './bodyGeometryGuardrails';

assert.equal(REGION.TOP_MAX, 0.42);
assert.equal(REGION.FOOTWEAR_MIN, 0.80);
assert.equal(getStrictBodyRegion([0.2, 0.05, 0.4, 0.2]), 'top');
assert.equal(getStrictBodyRegion([0.2, 0.4, 0.4, 0.12]), 'transition');
assert.equal(getStrictBodyRegion([0.2, 0.5, 0.4, 0.2]), 'bottom');
assert.equal(getStrictBodyRegion([0.3, 0.8, 0.2, 0.14]), 'footwear');

assert.equal(isHardFootwear([0.4, 0.82, 0.22, 0.14]), true);
assert.equal(isHardFootwear([0.4, 0.85, 0.12, 0.14]), false, 'taller-than-wide ≠ shoe');
assert.equal(isHardFootwear([0.3, 0.45, 0.35, 0.4]), false, 'trousers ≠ footwear');
assert.equal(isHardFootwear([0.2, 0.12, 0.55, 0.4]), false, 'torso ≠ footwear');
// Cropped-frame thigh / shorts at image bottom — not shoes
assert.equal(isHardFootwear([0.35, 0.62, 0.28, 0.28]), false, 'thigh ≠ footwear');
assert.equal(isHardFootwear([0.3, 0.55, 0.4, 0.32]), false, 'shorts ≠ footwear');

assert.equal(
  resolveClassByRegionLock({
    bbox: [0.2, 0.15, 0.5, 0.35],
    yoloCategory: 'bottoms',
  }).category,
  'tops',
);

assert.equal(
  resolveClassByRegionLock({
    bbox: [0.3, 0.52, 0.35, 0.24],
    yoloCategory: 'shoes',
  }).category,
  'bottoms',
);
assert.equal(
  resolveClassByRegionLock({
    bbox: [0.3, 0.52, 0.35, 0.24],
    yoloCategory: 'shoes',
  }).name,
  'Shorts',
);

// Floor-reaching pant leg → Trousers (low lower-skin)
assert.equal(
  resolveClassByRegionLock({
    bbox: [0.35, 0.48, 0.2, 0.48],
    yoloCategory: 'clothing',
    lowerSkinRatio: 0.1,
  }).name,
  'Trousers',
);

// Floor-reaching with leg bleed → Shorts
assert.equal(
  resolveClassByRegionLock({
    bbox: [0.3, 0.5, 0.4, 0.48],
    yoloCategory: 'clothing',
    lowerSkinRatio: 0.45,
  }).name,
  'Shorts',
);

assert.equal(
  resolveClassByRegionLock({
    bbox: [0.4, 0.82, 0.2, 0.14],
    yoloCategory: 'clothing',
  }).category,
  'shoes',
);

// Footwear-zone shorts when feet cropped → Shorts, not Shoes
assert.equal(
  resolveClassByRegionLock({
    bbox: [0.32, 0.58, 0.3, 0.2],
    yoloCategory: 'shoes',
  }).name,
  'Shorts',
);

assert.equal(feetLikelyCropped([[0.2, 0.1, 0.5, 0.35], [0.3, 0.5, 0.35, 0.28]]), true);
assert.equal(feetLikelyCropped([[0.2, 0.1, 0.5, 0.35], [0.3, 0.55, 0.35, 0.38]]), false);
assert.equal(
  isCroppedFrame([
    { category: 'tops', bbox: [0.2, 0.1, 0.5, 0.35] },
    { category: 'bottoms', bbox: [0.3, 0.5, 0.35, 0.28] },
  ]),
  true,
);
assert.equal(
  isCroppedFrame([
    { category: 'tops', bbox: [0.2, 0.1, 0.5, 0.35] },
    { category: 'bottoms', bbox: [0.3, 0.5, 0.35, 0.42] },
  ]),
  false,
);

assert.equal(classifyColorFromRgb(210, 195, 170), 'cream');
assert.equal(classifyColorFromRgb(180, 160, 130), 'beige');
assert.ok(classifyColorFromRgb(200, 80, 70) === 'red' || classifyColorFromRgb(200, 80, 70) === 'burgundy');
// Teal / cyan tops must not fall through to "other" (no colour on live labels)
assert.equal(classifyColorFromRgb(40, 150, 165), 'blue');
assert.equal(classifyColorFromRgb(50, 170, 160), 'blue');
assert.equal(classifyColorFromRgb(30, 80, 200), 'blue');
// Saturated teal/blue must never collapse to beige
assert.notEqual(classifyColorFromRgb(45, 160, 170), 'beige');
assert.notEqual(classifyColorFromRgb(60, 140, 190), 'beige');
assert.equal(isSkinPixel(180, 120, 90), true);
assert.equal(isSkinPixel(95, 60, 40), true, 'darker skin must count as skin');

// Floor-length trousers with some ankle skin → still trousers (not shorts)
assert.equal(
  classifyBottomSubtype([0.3, 0.42, 0.35, 0.48], { lowerSkinRatio: 0.32 }),
  'trousers',
);
assert.equal(
  classifyBottomSubtype([0.3, 0.42, 0.35, 0.48], { lowerSkinRatio: 0.35, fabricColor: 'light gray' }),
  'trousers',
);
assert.equal(
  classifyBottomSubtype([0.3, 0.52, 0.4, 0.24], { lowerSkinRatio: 0.1 }),
  'shorts',
);

// Shorts + dark socks + boots fused to floor — must stay shorts
assert.equal(
  classifyBottomSubtype([0.30, 0.50, 0.38, 0.48], { lowerSkinRatio: 0.12, fabricColor: 'black' }),
  'shorts',
  'socks+boots fuse must not become trousers',
);
assert.equal(
  isFloorLengthTrousersEvidence([0.30, 0.50, 0.38, 0.48], { lowerSkinRatio: 0.12 }),
  false,
);
assert.ok(hasKneeBreakEvidence([0.30, 0.50, 0.38, 0.48]));
assert.equal(
  scoreBottomHypotheses([0.30, 0.50, 0.38, 0.48], { lowerSkinRatio: 0.12 }).winner,
  'shorts',
);

// True joggers waist → floor
assert.equal(
  classifyBottomSubtype([0.30, 0.38, 0.35, 0.58], { lowerSkinRatio: 0.08, fabricColor: 'gray' }),
  'trousers',
);

// Mid-calf Docs-like footwear region → boots not trousers
assert.equal(
  resolveClassByRegionLock({
    bbox: [0.35, 0.78, 0.28, 0.18],
    yoloCategory: 'clothing',
  }).category,
  'shoes',
);
assert.match(
  resolveClassByRegionLock({
    bbox: [0.35, 0.78, 0.28, 0.18],
    yoloCategory: 'clothing',
  }).name || '',
  /boot|shoe/i,
);

assert.match(
  formatGarmentDisplayName({ color: 'white', category: 'shoes', subcategory: 'sneakers' }),
  /trainer/i,
);
assert.match(
  formatGarmentDisplayName({ color: 'light gray', category: 'bottoms', subcategory: 'trousers' }),
  /trousers/i,
);

// Different roles may overlap at the waist — keep both
const conflicts = resolveDetectionConflicts([
  { bbox: [0.2, 0.1, 0.5, 0.4] as [number, number, number, number], confidence: 0.9, category: 'tops' },
  { bbox: [0.25, 0.42, 0.45, 0.28] as [number, number, number, number], confidence: 0.8, category: 'bottoms' },
]);
assert.equal(conflicts.length, 2);
assert.ok(conflicts.some((c) => c.category === 'tops'));
assert.ok(conflicts.some((c) => c.category === 'bottoms'));

// Same role overlap → keep higher confidence
const sameRole = resolveDetectionConflicts([
  { bbox: [0.2, 0.1, 0.5, 0.35] as [number, number, number, number], confidence: 0.9, category: 'tops' },
  { bbox: [0.22, 0.12, 0.48, 0.33] as [number, number, number, number], confidence: 0.5, category: 'tops' },
]);
assert.equal(sameRole.length, 1);
assert.equal(sameRole[0].category, 'tops');

assert.equal(
  isBareTorsoTopLike({
    category: 'tops',
    subcategory: 'top',
    name: 'Top',
    skinRatio: 0.35,
    fabricColor: 'unknown',
  }),
  true,
);
assert.equal(
  detectTorsoState({
    topDetections: [{ category: 'tops', name: 'Top', skinRatio: 0.4, color: 'unknown' }],
  }),
  'bare',
);
assert.equal(
  detectTorsoState({
    topDetections: [{ category: 'tops', name: 'Blue top', skinRatio: 0.05, color: 'blue' }],
    hasFabricTop: true,
  }),
  'covered',
);

console.log('bodyGeometryGuardrails.test.ts: all passed');
