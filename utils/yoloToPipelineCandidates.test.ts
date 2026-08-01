/**
 * Wiring checks for YOLO → pipeline adapter.
 * Run: npx tsx utils/yoloToPipelineCandidates.test.ts
 */
import assert from 'node:assert/strict';

import {
  correctOnDeviceDetections,
  resolveBrandInspiration,
  resolveCategoryWithPipelineVote,
} from './yoloToPipelineCandidates';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

// Boots mislabelled as clothing/dress get corrected via geometry + heuristic
const bootsAsDress: OnDeviceDetection = {
  name: 'Clothing',
  category: 'dresses',
  subcategory: 'dress',
  color: 'brown',
  confidence: 0.55,
  bbox: [0.4, 0.82, 0.18, 0.14],
  trackId: 'yolo_1',
};
const shirt: OnDeviceDetection = {
  name: 'Shirt',
  category: 'tops',
  confidence: 0.9,
  bbox: [0.3, 0.1, 0.4, 0.35],
  trackId: 'yolo_2',
};

const { detections, pipeline } = correctOnDeviceDetections([bootsAsDress, shirt], {
  id: 'wire_test',
  context: 'smart_casual',
});
assert.ok(pipeline && !pipeline.discarded);
assert.ok(
  detections.some((d) => d.category === 'shoes'),
  `expected shoes in ${detections.map((d) => d.category).join(',')}`,
);

// Missing shoes are NOT soft-invented (barefoot-safe)
const topOnly: OnDeviceDetection = {
  name: 'Top',
  category: 'tops',
  confidence: 0.9,
  bbox: [0.25, 0.08, 0.45, 0.32],
  trackId: 't1',
};
const trousersOnly: OnDeviceDetection = {
  name: 'Trousers',
  category: 'bottoms',
  confidence: 0.85,
  bbox: [0.3, 0.5, 0.35, 0.42],
  trackId: 'b1',
};
const missingShoes = correctOnDeviceDetections([topOnly, trousersOnly], { id: 'infer_shoes' });
assert.ok(
  !missingShoes.detections.some((d) => d.category === 'shoes'),
  'must not invent phantom footwear',
);

// Cropped shorts selfie — thigh boxes must not become shoes
const redTop: OnDeviceDetection = {
  name: 'Top',
  category: 'tops',
  confidence: 0.9,
  bbox: [0.2, 0.08, 0.55, 0.42],
  trackId: 'rt',
};
const thighAsShoes: OnDeviceDetection = {
  name: 'Shoes',
  category: 'shoes',
  confidence: 0.7,
  bbox: [0.35, 0.58, 0.3, 0.28],
  trackId: 'th',
};
const cropped = correctOnDeviceDetections([redTop, thighAsShoes], { id: 'cropped_shorts' });
assert.ok(
  !cropped.detections.some((d) => d.category === 'shoes'),
  `cropped shorts must not invent/keep shoes: ${cropped.detections.map((d) => d.name).join(',')}`,
);
assert.ok(
  cropped.detections.some((d) => /short|bottom|trouser/i.test(d.name + d.category)),
  'thigh box should lock to bottoms/shorts',
);

// Quick-add vote: YOLO shoes + vision dress → shoes
assert.equal(
  resolveCategoryWithPipelineVote({
    yoloClass: 'shoes',
    analysisCategory: 'dresses',
    bbox: { x: 0.4, y: 0.75, w: 0.2, h: 0.2 },
  }),
  'shoes',
);

// Hanger tee: YOLO bottoms geometry must not beat vision t-shirt
assert.equal(
  resolveCategoryWithPipelineVote({
    yoloClass: 'bottoms',
    analysisCategory: 't-shirt',
    bbox: { x: 0.15, y: 0.2, w: 0.7, h: 0.55 },
  }),
  'tops',
);

// Cream blazer: vision outerwear wins over YOLO tops
assert.equal(
  resolveCategoryWithPipelineVote({
    yoloClass: 'tops',
    analysisCategory: 'blazer',
    bbox: { x: 0.2, y: 0.15, w: 0.6, h: 0.55 },
  }),
  'outerwear',
);

assert.equal(resolveBrandInspiration(['Loro Piana', 'Nike']), 'loro_piana');
assert.equal(resolveBrandInspiration(['Zegna']), 'zegna');
assert.equal(resolveBrandInspiration(null), null);

console.log('yoloToPipelineCandidates.test.ts: all passed');
