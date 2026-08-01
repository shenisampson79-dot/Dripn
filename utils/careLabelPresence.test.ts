/**
 * Care-label presence heuristic tests.
 * Run: npx tsx utils/careLabelPresence.test.ts
 */
import assert from 'node:assert/strict';
import {
  CARE_LABEL_PRESENCE,
  presenceToUi,
  scoreCareLabelRgba,
} from './careLabelPresenceCore.ts';

function makeRgba(
  w: number,
  h: number,
  fill: (x: number, y: number) => [number, number, number],
): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

console.log('=== Care label presence ===\n');

{
  // Dark uniform scene
  const dark = makeRgba(100, 160, () => [20, 20, 20]);
  const s = scoreCareLabelRgba(dark, 100, 160);
  assert.ok(s.score < CARE_LABEL_PRESENCE.holdScore, `dark score ${s.score}`);
  assert.equal(presenceToUi(s.score).ui, 'idle');
  console.log('✓ dark empty scene stays idle');
}

{
  // Bright blank wall — high luma, low contrast
  const blank = makeRgba(100, 160, () => [220, 220, 220]);
  const s = scoreCareLabelRgba(blank, 100, 160);
  assert.ok(s.score < CARE_LABEL_PRESENCE.readyScore, `blank ${s.score}`);
  console.log('✓ blank bright wall does not ready');
}

{
  // Simulated light label with dark text stripes in centre ROI
  const label = makeRgba(100, 160, (x, y) => {
    const inRoi = x >= 28 && x < 72 && y >= 26 && y < 118;
    if (!inRoi) return [40, 35, 30];
    // horizontal text-like bands
    if (y % 6 < 2) return [30, 30, 30];
    return [235, 232, 220];
  });
  const s = scoreCareLabelRgba(label, 100, 160);
  assert.ok(s.score >= CARE_LABEL_PRESENCE.holdScore, `label hold ${s.score}`);
  assert.ok(s.score >= CARE_LABEL_PRESENCE.readyScore, `label ready ${s.score}`);
  assert.equal(presenceToUi(s.score).ui, 'ready');
  console.log('✓ contrasting label ROI reaches ready');
}

console.log('\nAll care-label presence checks passed.');
