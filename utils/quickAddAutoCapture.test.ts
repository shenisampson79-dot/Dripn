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
  console.log('✓ guide frame containment');
}

{
  const padded = addPadding({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 }, 0.1);
  assert.equal(padded.x, 0);
  assert.equal(padded.y, 0);
  assert.ok(padded.width > 0.2);
  console.log('✓ pads bbox');
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
  assert.ok(iou(centred.bbox, track.bbox!) > 0.6);
  console.log('✓ stable frame IoU tracking');
}

{
  const centred = {
    class: 'shirt',
    confidence: 0.9,
    bbox: { x: 0.25, y: 0.3, width: 0.4, height: 0.35 },
  };
  const track = {
    ...createEmptyTrack(),
    bbox: centred.bbox,
    stableFrames: 6,
    firstSeenAt: Date.now(),
  };
  const ready = evaluateCapture(centred, track);
  assert.equal(ready.shouldCapture, true);
  assert.equal(ready.ui, 'ready');

  const shaky = evaluateCapture(centred, { ...track, stableFrames: 2 });
  assert.equal(shaky.shouldCapture, false);
  assert.equal(shaky.hint, 'Hold still…');
  console.log('✓ capture gating');
}

{
  const centred = {
    class: 'shirt',
    confidence: 0.9,
    bbox: { x: 0.25, y: 0.3, width: 0.4, height: 0.35 },
  };
  const ctl = new QuickAddCaptureController();
  let triggers = 0;
  const t0 = 1_000_000;
  for (let i = 0; i < 8; i++) {
    const { trigger } = ctl.onFrame([centred], t0 + i * 50);
    if (trigger) triggers += 1;
  }
  assert.equal(triggers, 1);
  assert.equal(ctl.onFrame([centred], t0 + 500).trigger, false);
  assert.equal(ctl.onFrame([centred], t0 + 2500).trigger, true);
  console.log('✓ cooldown');
}

console.log('\nAll Quick Add auto-capture checks passed.');
