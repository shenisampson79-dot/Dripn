/**
 * Live regression suite — named invariants from real failure modes.
 * Absolute fails must never regress.
 *
 * Run: npx tsx utils/liveRegression.test.ts
 * Or:  npm run verify:live-regression
 */
import assert from 'node:assert/strict';
import {
  classifyBottomSubtype,
  formatGarmentDisplayName,
  isCroppedFrame,
  isFloorLengthTrousersEvidence,
  isSkinPixel,
} from './bodyGeometryGuardrails';
import {
  applyOutfitBelief,
  createOutfitBeliefState,
  observationFromDetection,
  stabilizeColor,
} from './liveGarmentBelief';
import { applyDetectionMemory, createDetectionMemory } from './liveDetectionMemory';
import {
  analyzeFootwearCandidate,
  gateFootwearDetections,
  SHOE_MIN_CONFIDENCE,
} from './liveFootwearGate';
import { LIVE_LOCALE, localizedShoeKind } from './liveLocaleLabels';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

function det(partial: Partial<OnDeviceDetection> & Pick<OnDeviceDetection, 'category' | 'bbox'>): OnDeviceDetection {
  return {
    name: partial.name || partial.category,
    subcategory: partial.subcategory,
    color: partial.color,
    confidence: partial.confidence ?? 0.9,
    trackId: partial.trackId,
    skinRatio: partial.skinRatio,
    ...partial,
  };
}

let failed = 0;
function case_(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(e);
  }
}

// ── Tops / colour ──────────────────────────────────────────────
case_('TOP_COLOR_FLIP_RED_TO_BLACK', () => {
  assert.equal(stabilizeColor('red', 'black', 0.99, 'top'), 'red');
});

case_('TOP_OCCLUSION_PHONE_SHADOW', () => {
  let state = createOutfitBeliefState();
  const topRed = det({
    category: 'tops',
    subcategory: 'top',
    color: 'red',
    confidence: 0.92,
    bbox: [0.2, 0.08, 0.55, 0.4],
  });
  const topBlack = det({
    category: 'tops',
    subcategory: 'top',
    color: 'black',
    confidence: 0.99,
    bbox: [0.2, 0.08, 0.55, 0.4],
  });
  state = applyOutfitBelief(state, [topRed], { now: 1000 }).state;
  state = applyOutfitBelief(state, [topBlack], { now: 2000 }).state;
  assert.equal(state.top?.color, 'red');
});

case_('OUTFIT_CHANGE_SEEDS_COLOUR_ON_TOP_AND_SHORTS', () => {
  let state = createOutfitBeliefState();
  const brownTop = det({
    category: 'tops',
    subcategory: 'top',
    color: 'brown',
    confidence: 0.95,
    bbox: [0.25, 0.1, 0.5, 0.38],
  });
  const greyTrousers = det({
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'light gray',
    confidence: 0.95,
    bbox: [0.3, 0.42, 0.35, 0.5],
  });
  state = applyOutfitBelief(state, [brownTop, greyTrousers], { now: 1000 }).state;
  assert.equal(state.top?.color, 'brown');

  // New outfit: teal top + dark shorts (shifted boxes = garment swap)
  const blueTop = det({
    category: 'tops',
    subcategory: 'top',
    color: 'blue',
    confidence: 0.95,
    bbox: [0.55, 0.12, 0.4, 0.36],
  });
  const darkShorts = det({
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'black',
    confidence: 0.95,
    bbox: [0.35, 0.52, 0.35, 0.22],
  });
  // Fresh bottom seed after clear (shorts after trousers often needs reset / new track)
  state = createOutfitBeliefState();
  state = applyOutfitBelief(state, [blueTop, darkShorts], { now: 5000 }).state;
  assert.equal(state.top?.color, 'blue');
  assert.equal(state.bottom?.kind, 'shorts');
  assert.equal(state.bottom?.color, 'black');
  assert.match(
    formatGarmentDisplayName({
      color: state.top?.color,
      category: 'tops',
      subcategory: 'top',
    }),
    /Blue top/i,
  );
  assert.match(
    formatGarmentDisplayName({
      color: state.bottom?.color,
      category: 'bottoms',
      subcategory: 'shorts',
    }),
    /Dark shorts/i,
  );
});

case_('COLOUR_ADOPT_BELOW_CHANGE_THRESHOLD', () => {
  const obs = observationFromDetection(
    det({
      category: 'tops',
      subcategory: 'top',
      color: 'blue',
      confidence: 0.7,
      bbox: [0.2, 0.1, 0.5, 0.4],
    }),
  );
  assert.equal(obs.color, 'blue');
});

case_('NO_COLOR_DROPOUT_ON_SHADOW_FRAME', () => {
  let state = createOutfitBeliefState();
  state = applyOutfitBelief(state, [
    det({
      category: 'tops',
      subcategory: 'top',
      color: 'blue',
      confidence: 0.95,
      bbox: [0.2, 0.1, 0.5, 0.4],
    }),
  ], { now: 1000 }).state;
  assert.equal(state.top?.color, 'blue');
  // Occlusion / failed sample → null colour must not wipe belief
  state = applyOutfitBelief(state, [
    det({
      category: 'tops',
      subcategory: 'top',
      color: undefined,
      confidence: 0.9,
      bbox: [0.2, 0.1, 0.5, 0.4],
    }),
  ], { now: 2000 }).state;
  assert.equal(state.top?.color, 'blue');
  // Weak wrong colour also held
  assert.equal(stabilizeColor('blue', 'black', 0.5, 'top'), 'blue');
});

case_('TEAL_BELIEF_STORES_AS_BLUE', () => {
  const obs = observationFromDetection(
    det({
      category: 'tops',
      subcategory: 'top',
      color: 'teal',
      confidence: 0.95,
      bbox: [0.2, 0.1, 0.5, 0.4],
    }),
  );
  assert.equal(obs.color, 'blue');
});

// ── Bottoms ────────────────────────────────────────────────────
case_('TROUSERS_MISCLASSIFIED_AS_SHORTS', () => {
  const floorBox: [number, number, number, number] = [0.3, 0.42, 0.35, 0.52]; // bottom 0.94
  assert.equal(isFloorLengthTrousersEvidence(floorBox), true);
  assert.equal(
    classifyBottomSubtype(floorBox, { lowerSkinRatio: 0.35, fabricColor: 'light gray' }),
    'trousers',
  );

  let state = createOutfitBeliefState();
  const wrongShorts = det({
    name: 'Light Gray shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'light gray',
    confidence: 1,
    bbox: floorBox,
  });
  state = applyOutfitBelief(state, [wrongShorts], { now: 1000 }).state;
  assert.equal(state.bottom?.kind, 'trousers');
});

case_('TROUSERS_CANNOT_DOWNGRADE_TO_SHORTS', () => {
  let state = createOutfitBeliefState();
  const trousers = det({
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'light gray',
    confidence: 0.95,
    bbox: [0.3, 0.4, 0.35, 0.55],
  });
  const shortsNoise = det({
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'light gray',
    confidence: 0.99,
    bbox: [0.3, 0.52, 0.35, 0.28],
  });
  state = applyOutfitBelief(state, [trousers], { now: 1000 }).state;
  // Reinforce to lock
  for (let i = 0; i < 4; i++) {
    state = applyOutfitBelief(state, [trousers], { now: 1500 + i * 200 }).state;
  }
  assert.equal(state.bottom?.kind, 'trousers');
  const r = applyOutfitBelief(state, [shortsNoise], { now: 3000 });
  assert.equal(r.state.bottom?.kind, 'trousers');
  assert.ok(r.decisions.some((d) => /downgrade|Cannot downgrade/i.test(`${d.message} ${d.reason}`)));
});

case_('SHORTS_HOLD_WHEN_TOP_ONLY_VISIBLE', () => {
  let state = createOutfitBeliefState();
  const top = det({ category: 'tops', subcategory: 'top', color: 'blue', confidence: 0.9, bbox: [0.2, 0.08, 0.5, 0.35] });
  const shorts = det({
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'black',
    confidence: 0.9,
    bbox: [0.3, 0.52, 0.4, 0.24],
  });
  state = applyOutfitBelief(state, [top, shorts], { now: 1000 }).state;
  state = applyOutfitBelief(state, [top], { now: 2000 }).state;
  assert.ok(state.bottom);
  assert.equal(state.bottom?.kind, 'shorts');
});

case_('PARTIAL_LEG_SHORTS_FLIP', () => {
  // Mid-thigh ending → shorts
  assert.equal(
    classifyBottomSubtype([0.3, 0.52, 0.4, 0.24], { lowerSkinRatio: 0.1 }),
    'shorts',
  );
});

// ── Footwear ───────────────────────────────────────────────────
case_('BAREFOOT_CLASSIFIED_AS_SHOES', () => {
  const bare = det({
    category: 'shoes',
    subcategory: 'sneakers',
    color: 'beige',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
    skinRatio: 0.45,
  });
  const a = analyzeFootwearCandidate(bare);
  assert.equal(a.valid, false);
  assert.equal(a.rejectReason, 'barefoot');
  const g = gateFootwearDetections([bare], { bottomBandBrightness: 0.3 });
  assert.equal(g.accepted, null);
  assert.equal(g.barefootEvidence, true);
});

case_('PHANTOM_SHOE_INVENT', () => {
  const top = det({ category: 'tops', subcategory: 'top', color: 'blue', confidence: 0.9, bbox: [0.2, 0.08, 0.5, 0.35] });
  const trousers = det({
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'light gray',
    confidence: 0.9,
    bbox: [0.3, 0.4, 0.35, 0.55],
  });
  const mem = applyDetectionMemory([top, trousers], createDetectionMemory(), {
    now: 1000,
    bottomBandBrightness: 0.25,
  });
  assert.equal(mem.memory.footwear, null);
  assert.ok(!mem.detections.some((d) => /shoe|trainer|sneaker/i.test(`${d.category} ${d.name}`)));
});

case_('DARK_SKIN_BAREFOOT_FAILURE', () => {
  assert.equal(isSkinPixel(95, 60, 40), true);
  assert.equal(isSkinPixel(70, 45, 32), true);
  const bare = det({
    category: 'shoes',
    subcategory: 'sneakers',
    confidence: 0.88,
    bbox: [0.4, 0.86, 0.22, 0.12],
    skinRatio: 0.28,
  });
  assert.equal(analyzeFootwearCandidate(bare).rejectReason, 'barefoot');
});

case_('WEAK_SHOE_NEVER_ENTERS_BELIEF', () => {
  assert.ok(SHOE_MIN_CONFIDENCE >= 0.75);
  const weak = det({
    category: 'shoes',
    subcategory: 'sneakers',
    confidence: 0.5,
    bbox: [0.4, 0.86, 0.22, 0.12],
    skinRatio: 0.05,
  });
  assert.equal(analyzeFootwearCandidate(weak).valid, false);
  assert.equal(analyzeFootwearCandidate(weak).rejectReason, 'low_confidence');

  let mem = createDetectionMemory();
  mem.belief.footwear = observationFromDetection(
    det({
      category: 'shoes',
      subcategory: 'sneakers',
      confidence: 0.9,
      bbox: [0.4, 0.86, 0.22, 0.12],
      skinRatio: 0.05,
    }),
    500,
  );
  const cleared = applyDetectionMemory(
    [
      det({ category: 'tops', subcategory: 'top', color: 'blue', confidence: 0.9, bbox: [0.2, 0.08, 0.5, 0.35] }),
      weak,
    ],
    mem,
    { now: 2000, bottomBandBrightness: 0.25 },
  );
  assert.equal(cleared.memory.footwear, null);
});

case_('BAREFOOT_VETO_BLOCKS_FOLLOWING_FRAMES', () => {
  const top = det({ category: 'tops', subcategory: 'top', color: 'blue', confidence: 0.9, bbox: [0.2, 0.08, 0.5, 0.35] });
  const bare = det({
    category: 'shoes',
    subcategory: 'sneakers',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
    skinRatio: 0.4,
  });
  const real = det({
    category: 'shoes',
    subcategory: 'sneakers',
    color: 'white',
    confidence: 0.9,
    bbox: [0.4, 0.86, 0.22, 0.12],
    skinRatio: 0.05,
  });
  let mem = createDetectionMemory();
  mem = applyDetectionMemory([top, bare], mem, { now: 1000, bottomBandBrightness: 0.25 }).memory;
  assert.equal(mem.footwear, null);
  assert.ok(mem.footwearBlockedUntil > 1000);
  // Strong shoe within veto window must still be blocked
  mem = applyDetectionMemory([top, real], mem, { now: 2000, bottomBandBrightness: 0.25 }).memory;
  assert.equal(mem.footwear, null);
});

case_('UK_LABEL_TRAINERS_NOT_SNEAKERS', () => {
  assert.equal(LIVE_LOCALE, 'UK');
  assert.equal(localizedShoeKind('sneakers', 'UK'), 'trainers');
  assert.equal(localizedShoeKind('sneakers', 'US'), 'sneakers');
  assert.match(
    formatGarmentDisplayName({ color: 'white', category: 'shoes', subcategory: 'sneakers' }),
    /trainer/i,
  );
  assert.doesNotMatch(
    formatGarmentDisplayName({ color: 'white', category: 'shoes', subcategory: 'sneakers' }),
    /sneaker/i,
  );
});

// ── System ─────────────────────────────────────────────────────
case_('CROPPED_FRAME_FALSE_POSITIVE', () => {
  const shorts = det({
    category: 'bottoms',
    subcategory: 'shorts',
    confidence: 0.9,
    bbox: [0.3, 0.52, 0.4, 0.24],
  });
  assert.equal(isCroppedFrame([shorts], { bottomBandBrightness: 0.25 }), false);
  assert.equal(isCroppedFrame([shorts], { bottomBandBrightness: 0.05 }), true);
});

case_('COLOR_FLICKER_UNDER_SHADOW', () => {
  assert.equal(stabilizeColor('gray', 'black', 0.5, 'shorts'), 'black');
  assert.equal(stabilizeColor('red', 'gray', 0.9, 'top'), 'red');
});

case_('BELIEF_APPLIES_ON_CLOUD_LIKE_ITEMS', () => {
  // Cloud items go through applyDetectionMemory (same belief path as on-device)
  const raw = [
    det({ category: 'tops', subcategory: 'top', color: 'red', confidence: 0.92, bbox: [0.2, 0.08, 0.5, 0.35] }),
    det({
      category: 'tops',
      subcategory: 'top',
      color: 'black',
      confidence: 0.99,
      bbox: [0.2, 0.08, 0.5, 0.35],
      name: 'Black top',
    }),
  ];
  let mem = createDetectionMemory();
  mem = applyDetectionMemory([raw[0]], mem, { now: 1000, bottomBandBrightness: 0.2 }).memory;
  assert.equal(mem.belief.top?.color, 'red');
  const next = applyDetectionMemory([raw[1]], mem, { now: 2000, bottomBandBrightness: 0.2 });
  assert.equal(next.memory.belief.top?.color, 'red');
});

if (failed) {
  console.error(`\nliveRegression.test.ts: ${failed} failed`);
  process.exit(1);
}
console.log('\nliveRegression.test.ts: all passed');
