/**
 * Quick Add auto-capture gating tests.
 * Run: npx tsx utils/quickAddAutoCapture.test.ts
 */
import assert from 'node:assert/strict';
import {
  QuickAddCaptureController,
  boostDetection,
  evaluateCapture,
  guideFromLayout,
  isAlmostInGuide,
  isInsideGuideFrame,
  itemGuideCoverage,
  selectBestDetection,
  updateTracking,
  createEmptyTrack,
  addPadding,
  iou,
  QUICK_ADD_CAPTURE,
  paddingForCategory,
  captureConfidenceFor,
  looksLikeFootwear,
  advanceQuickAddTemporal,
  createQuickAddTemporalState,
} from './quickAddAutoCapture.ts';

console.log('=== Quick Add auto-capture ===\n');

{
  const best = selectBestDetection([
    { class: 'a', confidence: 0.7, bbox: { x: 0, y: 0, width: 0.2, height: 0.2 } },
    { class: 'b', confidence: 0.8, bbox: { x: 0, y: 0, width: 0.5, height: 0.5 } },
    { class: 'c', confidence: 0.1, bbox: { x: 0, y: 0, width: 0.9, height: 0.9 } },
  ]);
  assert.equal(best?.class, 'b');
  console.log('✓ selects largest confident detection');
}

{
  const weak = selectBestDetection([
    { class: 'shoes', confidence: 0.16, bbox: { x: 0.3, y: 0.35, width: 0.3, height: 0.25 } },
  ]);
  assert.equal(weak?.class, 'shoes');
  assert.ok(QUICK_ADD_CAPTURE.weakConfidence <= 0.16);
  assert.ok(captureConfidenceFor('shoes') < captureConfidenceFor('tops'));
  console.log('✓ weak shoe detections are selectable');
}

{
  const bootsBox = { x: 0.35, y: 0.4, width: 0.22, height: 0.32 };
  assert.equal(looksLikeFootwear(bootsBox), true);
  const boosted = boostDetection({
    class: 'clothing',
    confidence: 0.18,
    bbox: bootsBox,
  });
  assert.equal(boosted.class, 'shoes');
  assert.ok(boosted.confidence > 0.18);
  console.log('✓ footwear shape boost');
}

{
  const guide = QUICK_ADD_CAPTURE.guide;
  const centred = { x: 0.25, y: 0.28, width: 0.4, height: 0.32 };
  assert.ok(itemGuideCoverage(centred, guide) >= 0.7);
  assert.equal(isInsideGuideFrame(centred, guide), true);
  assert.equal(isInsideGuideFrame({ x: 0, y: 0, width: 0.1, height: 0.1 }, guide), false);
  const overflowBoots = { x: 0.3, y: 0.32, width: 0.35, height: 0.28 };
  assert.ok(itemGuideCoverage(overflowBoots, guide) >= 0.7 || isAlmostInGuide(overflowBoots, guide));
  console.log('✓ 70% coverage + overflow tolerance');
}

{
  const large = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
  const guide = { x: 0.2, y: 0.25, width: 0.6, height: 0.4 };
  assert.equal(isInsideGuideFrame(large, guide), true);
  console.log('✓ large overflowing garment locks when centred');
}

{
  const g = guideFromLayout({
    screenWidth: 390,
    screenHeight: 844,
    overlayTop: 110,
    overlayBottom: 150,
    frameSize: 280,
  });
  assert.ok(g.width > 280 / 390, 'guide wider than visual square');
  assert.ok(g.height > 280 / 844, 'guide taller than visual square');
  console.log('✓ guideFromLayout pads for preview/photo mismatch');
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
    bbox: { x: 0.25, y: 0.28, width: 0.4, height: 0.32 },
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
    confidence: 0.3,
    bbox: { x: 0.3, y: 0.3, width: 0.28, height: 0.28 },
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
  assert.match(ready.hint, /locked|hold/i);

  const hold = evaluateCapture(
    { ...shoes, confidence: 0.18 },
    { ...track, stableFrames: 1 },
  );
  assert.equal(hold.ui, 'hold', 'weak track must show amber HOLD');
  assert.match(hold.hint, /almost there|hold|centre|closer/i);

  const tooFar = evaluateCapture(
    { ...shoes, bbox: { x: 0.42, y: 0.42, width: 0.08, height: 0.07 } },
    track,
  );
  assert.equal(tooFar.shouldCapture, false);
  assert.equal(tooFar.ui, 'hold');
  assert.match(tooFar.hint, /closer/i);

  const idle = evaluateCapture(null, createEmptyTrack());
  assert.equal(idle.ui, 'idle');
  assert.match(idle.hint, /centre the garment|fill the screen/i);
  console.log('✓ 3-state UI + specific hints (idle / hold / ready)');
}

{
  const centred = {
    class: 'shirt',
    confidence: 0.9,
    bbox: { x: 0.25, y: 0.28, width: 0.4, height: 0.32 },
  };
  const ctl = new QuickAddCaptureController();
  let armedHits = 0;
  const t0 = Date.now();
  // Temporal machine: amber min dwell + 2 ready samples (~850ms spacing).
  for (let i = 0; i < 6; i++) {
    const { armed } = ctl.onFrame([centred], t0 + i * 900);
    if (armed) armedHits += 1;
  }
  assert.ok(armedHits >= 1, 'should arm for countdown after amber dwell');
  const armedAt = t0 + 5 * 900;
  ctl.markCaptured(armedAt + 300);
  assert.equal(ctl.onFrame([centred], armedAt + 500).armed, false);
  // After cooldown, need amber dwell again
  let rearmed = false;
  for (let i = 0; i < 6; i++) {
    if (ctl.onFrame([centred], armedAt + 2500 + i * 900).armed) rearmed = true;
  }
  assert.equal(rearmed, true);
  console.log('✓ armed + cooldown (temporal amber dwell + countdown)');
}

{
  const ctl = new QuickAddCaptureController();
  // Weak clothing blob that looks like boots — must enter HOLD, not stay idle.
  const { eval: evaluation } = ctl.onFrame(
    [{ class: 'clothing', confidence: 0.17, bbox: { x: 0.34, y: 0.42, width: 0.24, height: 0.34 } }],
    Date.now(),
  );
  assert.equal(evaluation.ui, 'hold');
  assert.match(evaluation.hint, /almost there|hold|centre|closer/i);
  console.log('✓ weak boots enter amber HOLD (not white)');
}

{
  const ctl = new QuickAddCaptureController();
  const a = { class: 'shoes', confidence: 0.8, bbox: { x: 0.15, y: 0.28, width: 0.25, height: 0.28 } };
  const b = { class: 'bag', confidence: 0.7, bbox: { x: 0.55, y: 0.28, width: 0.25, height: 0.28 } };
  const { multiCount, eval: evaluation } = ctl.onFrame([a, b], Date.now());
  assert.equal(multiCount, 2);
  assert.match(evaluation.hint, /2 items/i);
  console.log('✓ multi-item hint');
}

{
  const ctl = new QuickAddCaptureController();
  const coat = {
    class: 'outerwear',
    confidence: 0.34,
    bbox: { x: 0.12, y: 0.18, width: 0.72, height: 0.62 },
  };
  const t0 = Date.now();
  assert.equal(ctl.onFrame([coat], t0).eval.ui, 'hold');
  // Miss within grace — must stay amber, not flash white
  const miss = ctl.onFrame([], t0 + 800);
  assert.equal(miss.eval.ui, 'hold', 'miss grace keeps amber');
  assert.equal(miss.armed, false);
  assert.equal(miss.cancelCountdown, false);
  // Drain confidence buffer + idle cancel (miss grace → temporal hold → white)
  let lostUi = 'hold' as string;
  for (let i = 1; i <= 6; i++) {
    const t = t0 + QUICK_ADD_CAPTURE.missGraceMs + i * (QUICK_ADD_CAPTURE.idleCancelMs + 50);
    lostUi = ctl.onFrame([], t).eval.ui;
  }
  assert.ok(lostUi === 'idle' || lostUi === 'struggling', `expected idle after drain, got ${lostUi}`);
  console.log('✓ miss grace sticky amber (beige coat flicker)');
}

{
  let s = createQuickAddTemporalState();
  const t0 = Date.now();
  // Enter amber
  let step = advanceQuickAddTemporal(s, { band: 'hold', confidence: 0.4, rawReady: false }, t0);
  assert.equal(step.ui, 'hold');
  s = step.state;
  // Ready too early — still amber (min dwell)
  step = advanceQuickAddTemporal(s, { band: 'ready', confidence: 0.5, rawReady: true }, t0 + 200);
  assert.equal(step.ui, 'hold');
  assert.equal(step.startCountdown, false);
  s = step.state;
  // After dwell + enough ready samples → green
  step = advanceQuickAddTemporal(s, { band: 'ready', confidence: 0.5, rawReady: true }, t0 + 900);
  s = step.state;
  if (!step.startCountdown) {
    step = advanceQuickAddTemporal(s, { band: 'ready', confidence: 0.5, rawReady: true }, t0 + 1000);
  }
  assert.equal(step.startCountdown, true);
  assert.equal(step.ui, 'ready');
  s = step.state;
  // Brief idle during green — do NOT cancel
  step = advanceQuickAddTemporal(s, { band: 'idle', confidence: 0, rawReady: false }, t0 + 1200);
  assert.equal(step.cancelCountdown, false);
  assert.equal(step.ui, 'ready');
  s = step.state;
  // Sustained idle → cancel
  step = advanceQuickAddTemporal(
    s,
    { band: 'idle', confidence: 0, rawReady: false },
    t0 + 1200 + QUICK_ADD_CAPTURE.idleCancelMs + 10,
  );
  assert.equal(step.cancelCountdown, true);
  console.log('✓ temporal: amber dwell, green lock, sustained-idle cancel');
}

console.log('\nAll Quick Add auto-capture checks passed.');
