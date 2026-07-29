/**
 * Live digitize detection helpers tests.
 * Run: npx tsx utils/digitizeLiveDetect.test.ts
 */
import assert from 'node:assert/strict';
import {
  coalesceFootwearDetections,
  formatLiveStatusLine,
  isFootwearPair,
  liveFramingHint,
  shouldBlockMultiItem,
  unionBBox,
} from './digitizeLiveDetect.ts';

console.log('=== Digitize live detect ===\n');

{
  const a: [number, number, number, number] = [0.2, 0.4, 0.2, 0.3];
  const b: [number, number, number, number] = [0.45, 0.4, 0.2, 0.3];
  assert.equal(isFootwearPair({ category: 'shoes', bbox: a }, { category: 'shoes', bbox: b }), true);
  const u = unionBBox(a, b);
  assert.ok(u[2] > 0.4);
  console.log('✓ footwear pair + union bbox');
}

{
  const dets = coalesceFootwearDetections([
    { category: 'shoes', confidence: 0.3, bbox: [0.25, 0.4, 0.22, 0.3] },
    { category: 'shoes', confidence: 0.28, bbox: [0.48, 0.4, 0.22, 0.3] },
  ]);
  assert.equal(dets.length, 1);
  assert.equal(dets[0].category, 'shoes');
  assert.ok(dets[0].bbox[2] > 0.4);
  console.log('✓ coalesce left/right boots into one detection');
}

{
  assert.equal(
    shouldBlockMultiItem([
      { category: 'shoes', bbox: [0.25, 0.4, 0.22, 0.3] },
      { category: 'shoes', bbox: [0.48, 0.4, 0.22, 0.3] },
    ]),
    false,
    'boot pair must not multi-block',
  );
  assert.equal(liveFramingHint([0.05, 0.05, 0.85, 0.85]), 'Move back slightly');
  assert.equal(formatLiveStatusLine(2, 1, 'Hold steady'), 'Hold steady · 2 in view · 1 saved');
  console.log('✓ multi-item block rules + framing + status line');
}

console.log('\nAll digitize live detect checks passed.');
