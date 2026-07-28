/**
 * Quick Add auto-capture gating tests.
 * Run: npx tsx utils/quickAddAutoCapture.test.ts
 */
import assert from 'node:assert/strict';
import {
  QuickAddCaptureController,
  evaluateCapture,
  isInsideGuideFrame,
  selectBestDetection,
  updateTracking,
  createEmptyTrack,
  addPadding,
  iou,
  QUICK_ADD_CAPTURE,
  paddingForCategory,
} from './quickAddAutoCapture.ts';

console.log('=== Quick Add auto-capture ===\n');

{
  const best = selectBestDetection([
    { class: 'a', confidence: 0.7, bbox: { x: 0, y: 0, width: 0.2, height: 0.2 } },
    { class: 'b', confidence: 0.8, bbox: { x: 0, y: 0, width: 0.5, height: 0.5 } },
    { class: 'c', confidence: 0.4, bbox: { x: 0, y: 0, width: 0.9, height: 0.9 } },
  ]);
  assert.equal(best?.class, 'b');
  console.log('✓ selects largest confident detection');
}

{
  const centred = { x: 0.25, y: 0.3, width: 0.4, height: 0.35 };
  assert.equal(isInsideGuideFrame(centred), true);
  assert.equal(isInsideGuideFrame({ x: 0, y: 0, width: 0.1, height: 0.1 }), false);
  const shoes = { x: 0.35, y: 0.35, width: 0.22, height: 0.18 };
  assert.equal(isInsideGuideFrame(shoes), true);
  console.log('✓ guide frame containment (incl. small shoes)');
}

{
  const padded = addPadding({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 }, 0.1);
  assert.equal(padded.x, 0);
  assert.equal(padded.y, 0);
  assert.ok(padded.width > 0.2);
  console.log('✓ pads bbox');
}

{
  assert.ok(paddingForCategory('shoes') < paddingForCategory('tops'));
  console.log('✓ category-aware padding (shoes tighter than tops)');
}

{
  const centred = {
    class: 'shirt',
    confidence: 0.9,
    bbox: { x: 0.25, y: 0.3, width: 0.4, height: 0.35 },
  };
  let track = createEmptyTrack();
  track = updateTracking(track, centred);
  track = updateTracking(track, {
    ...centred,
    bbox: { ...centred.bbox, x: centred.bbox.x + 0.01 },
  });
  assert.equal(track.stableFrames, 2);
  assert.ok(iou(centred.bbox, track.bbox!) > 0.55);
  console.log('✓ stable frame IoU tracking');
}

{
  const shoes = {
    class: 'shoes',
    confidence: 0.7,
    bbox: { x: 0.35, y: 0.35, width: 0.22, height: 0.2 },
  };
  const track = {
    ...createEmptyTrack(),
    bbox: shoes.bbox,
    stableFrames: QUICK_ADD_CAPTURE.stableFrames,
    firstSeenAt: Date.now(),
  };
  const ready = evaluateCapture(shoes, track);
  assert.equal(ready.shouldCapture, true, 'shoes should arm when centered');
  assert.equal(ready.ui, 'ready');

  const tooFar = evaluateCapture(
    { ...shoes, bbox: { x: 0.4, y: 0.4, width: 0.12, height: 0.1 } },
    track,
  );
  assert.equal(tooFar.shouldCapture, false);
  assert.equal(tooFar.hint, 'Move closer');
  console.log('✓ capture gating (shoes + move closer)');
}

{
  const centred = {
    class: 'shirt',
    confidence: 0.9,
    bbox: { x: 0.25, y: 0.3, width: 0.4, height: 0.35 },
  };
  const ctl = new QuickAddCaptureController();
  let armedHits = 0;
  const t0 = 1_000_000;
  for (let i = 0; i < 6; i++) {
    const { armed } = ctl.onFrame([centred], t0 + i * 50);
    if (armed) armedHits += 1;
  }
  assert.ok(armedHits >= 1, 'should arm for countdown');
  // Cooldown after markCaptured
  ctl.markCaptured(t0 + 300);
  assert.equal(ctl.onFrame([centred], t0 + 500).armed, false);
  assert.equal(ctl.onFrame([centred], t0 + 2500).armed, true);
  console.log('✓ armed + cooldown (countdown owns the snap)');
}

{
  const ctl = new QuickAddCaptureController();
  const a = { class: 'shoes', confidence: 0.8, bbox: { x: 0.2, y: 0.3, width: 0.25, height: 0.2 } };
  const b = { class: 'bag', confidence: 0.7, bbox: { x: 0.55, y: 0.3, width: 0.2, height: 0.2 } };
  const { multiCount, eval: evaluation } = ctl.onFrame([a, b], Date.now());
  assert.equal(multiCount, 2);
  assert.match(evaluation.hint, /2 items/i);
  console.log('✓ multi-item hint');
}

console.log('\nAll Quick Add auto-capture checks passed.');
