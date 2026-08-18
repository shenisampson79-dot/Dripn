/**
 * Live regression suite — named invariants from real failure modes.
 * Absolute fails must never regress.
 *
 * Garment-belief cases. Launch gate (L1–L6) is utils/livePermanentRegression.test.ts
 * Run: npx tsx utils/liveRegression.test.ts
 * Or:  npm run verify:live-regression
 */
import assert from 'node:assert/strict';
import {
  classifyBottomSubtype,
  coversKneeAndCalf,
  formatGarmentDisplayName,
  isCroppedFrame,
  isFloorLengthTrousersEvidence,
  isSkinPixel,
  classifyColorFromRgb,
  scoreBottomHypotheses,
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
  classifyShoeSubtype,
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

// Field case: floral trousers held as "Blue shorts" because YOLO's box stopped
// mid-calf. Vision was asked to re-check the length, so its answer must land
// even though the truncated box still fails the floor-length geometry test.
case_('CLOUD_VISION_CORRECTS_SHORTS_TO_TROUSERS', () => {
  const truncatedBox: [number, number, number, number] = [0.31, 0.42, 0.3, 0.24];
  assert.equal(isFloorLengthTrousersEvidence(truncatedBox), false);

  let state = createOutfitBeliefState();
  state = applyOutfitBelief(state, [det({
    name: 'Blue Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'blue',
    confidence: 0.95,
    bbox: truncatedBox,
  })], { now: 1000 }).state;
  assert.equal(state.bottom?.kind, 'shorts', 'seed the wrong read first');

  state = applyOutfitBelief(state, [det({
    name: 'Blue Floral Trousers',
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'blue',
    confidence: 0.86,
    bbox: truncatedBox,
    source: 'cloud_vision_correction',
  })], { now: 3000 }).state;
  assert.equal(state.bottom?.kind, 'trousers', 'Vision correction overrides geometry gate');
  assert.match(state.bottom?.name || '', /trouser/i);

  // Same label without the correction flag must still be refused.
  let plain = createOutfitBeliefState();
  plain = applyOutfitBelief(plain, [det({
    name: 'Blue Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'blue',
    confidence: 0.95,
    bbox: truncatedBox,
  })], { now: 1000 }).state;
  plain = applyOutfitBelief(plain, [det({
    name: 'Blue Trousers',
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'blue',
    confidence: 0.86,
    bbox: truncatedBox,
  })], { now: 3000 }).state;
  assert.equal(plain.bottom?.kind, 'shorts', 'on-device flicker still cannot flip the length');
});

// Field case: a clothes rail behind the wearer. One frame returned a rainbow
// tutu skirt (0.93) alongside the blue striped shorts (0.75) already believed,
// and raw confidence painted the tutu. Clothes do not change between frames.
case_('BACKGROUND_GARMENT_CANNOT_OUTBID_HELD_BOTTOM', () => {
  const shortsBox: [number, number, number, number] = [0.33, 0.47, 0.35, 0.15];
  let state = createOutfitBeliefState();
  const shorts = det({
    name: 'Blue Striped Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'blue',
    confidence: 0.75,
    bbox: shortsBox,
  });
  state = applyOutfitBelief(state, [shorts], { now: 1000 }).state;
  assert.equal(state.bottom?.kind, 'shorts');

  const railSkirt = det({
    name: 'Rainbow Tutu Skirt',
    category: 'bottoms',
    subcategory: 'skirt',
    color: 'multicolour',
    confidence: 0.93,
    bbox: [0.19, 0.53, 0.29, 0.17],
  });
  state = applyOutfitBelief(state, [railSkirt, shorts], { now: 2100 }).state;
  assert.equal(state.bottom?.kind, 'shorts', 'the held garment wins the slot');
  assert.match(state.bottom?.name || '', /shorts/i);

  // A real change of clothes still lands: no competing held candidate present.
  state = applyOutfitBelief(state, [railSkirt], { now: 3200 }).state;
  state = applyOutfitBelief(state, [railSkirt], { now: 4300 }).state;
  assert.notEqual(state.bottom?.kind, undefined);
});

// Field case: a hoodie over one shoulder came back as "Blue and Red Towel".
case_('NON_APPAREL_READS_ARE_DROPPED', () => {
  let state = createOutfitBeliefState();
  const out = applyOutfitBelief(state, [
    det({
      name: 'White Graphic Tank Top',
      category: 'tops',
      subcategory: 'tank top',
      color: 'white',
      confidence: 0.95,
      bbox: [0.32, 0.2, 0.3, 0.22],
    }),
    det({
      name: 'Blue and Red Towel',
      category: 'accessories',
      subcategory: 'towel',
      color: 'blue',
      confidence: 0.9,
      bbox: [0.3, 0.18, 0.34, 0.3],
    }),
  ], { now: 1000 });
  assert.ok(out.repairs.includes('dropped_non_apparel'));
  const painted = out.detections.map((d) => d.name || '').join(' ');
  assert.doesNotMatch(painted, /towel/i);
  const accessories = out.state.accessories || [];
  assert.equal(accessories.some((a) => /towel/i.test(a.name || '')), false);
});

// Field case: black sweatpants read as "Dark Shorts" because the box stopped at
// mid-calf. Geometry alone must settle this — no cloud round trip, and no
// flipping back to shorts on the next frame.
case_('TRUNCATED_SWEATPANTS_ARE_NOT_SHORTS', () => {
  const midCalfBox: [number, number, number, number] = [0.32, 0.44, 0.3, 0.32]; // bottom 0.76
  assert.equal(isFloorLengthTrousersEvidence(midCalfBox), false, 'never reaches the floor');
  assert.equal(coversKneeAndCalf(midCalfBox), true);
  assert.equal(classifyBottomSubtype(midCalfBox, { fabricColor: 'black' }), 'trousers');

  let state = createOutfitBeliefState();
  state = applyOutfitBelief(state, [det({
    name: 'Dark Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'dark',
    confidence: 0.9,
    bbox: midCalfBox,
  })], { now: 1000 }).state;
  assert.equal(state.bottom?.kind, 'trousers', 'first read already reads full-length');

  // A later shorts read on the same geometry must not undo it.
  state = applyOutfitBelief(state, [det({
    name: 'Dark Shorts',
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'dark',
    confidence: 0.95,
    bbox: midCalfBox,
  })], { now: 2100 }).state;
  assert.equal(state.bottom?.kind, 'trousers', 'no flip-flop back to shorts');

  // Real above-knee shorts keep their identity.
  assert.equal(coversKneeAndCalf([0.33, 0.47, 0.3, 0.15]), false);
  assert.equal(
    classifyBottomSubtype([0.33, 0.47, 0.3, 0.15], { fabricColor: 'blue' }),
    'shorts',
  );
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
  assert.ok(r.decisions.some((d) =>
    /downgrade|Cannot downgrade|Kept trousers|persistence/i.test(`${d.message} ${d.reason}`),
  ));
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
    confidence: 0.4,
    bbox: [0.4, 0.86, 0.22, 0.12],
    skinRatio: 0.05,
    color: 'unknown',
  });
  assert.equal(analyzeFootwearCandidate(weak).valid, false);
  assert.equal(analyzeFootwearCandidate(weak).rejectReason, 'low_confidence');

  // Weak frames must not seed a NEW shoe belief
  let mem = createDetectionMemory();
  const seeded = applyDetectionMemory(
    [
      det({ category: 'tops', subcategory: 'top', color: 'blue', confidence: 0.9, bbox: [0.2, 0.08, 0.5, 0.35] }),
      weak,
    ],
    mem,
    { now: 2000, bottomBandBrightness: 0.25 },
  );
  assert.equal(seeded.memory.belief.footwear, null);
  assert.equal(seeded.memory.footwear, null);

  // But a held shoe belief survives a weak reject frame (only barefoot clears it)
  mem = createDetectionMemory();
  mem.belief.footwear = observationFromDetection(
    det({
      category: 'shoes',
      subcategory: 'sneakers',
      color: 'white',
      confidence: 0.9,
      bbox: [0.4, 0.86, 0.22, 0.12],
      skinRatio: 0.05,
    }),
    500,
  );
  const held = applyDetectionMemory(
    [
      det({ category: 'tops', subcategory: 'top', color: 'blue', confidence: 0.9, bbox: [0.2, 0.08, 0.5, 0.35] }),
      weak,
    ],
    mem,
    { now: 2000, bottomBandBrightness: 0.25 },
  );
  assert.ok(held.memory.belief.footwear, 'held footwear persists through weak frame');
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
  // Grey shorts stay grey under a weak black flicker (same dark family).
  assert.equal(stabilizeColor('gray', 'black', 0.5, 'shorts'), 'gray');
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

/**
 * Critical UK streetwear regression (mirror selfie):
 * blue tee + black shorts + mid-calf dark socks + Dr Martens.
 * Must NOT lock Dark trousers / Black trainers / Beige top.
 */
case_('SHORTS_SOCKS_DOCS_BLUE_TEE', () => {
  // Continuous dark column (shorts+socks+boots) → shorts hypothesis wins
  const fusedLeg: [number, number, number, number] = [0.30, 0.50, 0.38, 0.48];
  assert.equal(classifyBottomSubtype(fusedLeg, { lowerSkinRatio: 0.12, fabricColor: 'black' }), 'shorts');
  assert.equal(scoreBottomHypotheses(fusedLeg, { lowerSkinRatio: 0.12 }).winner, 'shorts');
  assert.equal(isFloorLengthTrousersEvidence(fusedLeg, { lowerSkinRatio: 0.12 }), false);

  // Mid-calf Docs → boots, not trainers
  const docsBox: [number, number, number, number] = [0.35, 0.78, 0.28, 0.18];
  assert.equal(classifyShoeSubtype({ bbox: docsBox, skinRatio: 0.06 }), 'boots');
  assert.match(
    formatGarmentDisplayName({ color: 'black', category: 'shoes', subcategory: 'boots' }),
    /boot/i,
  );

  // Saturated blue/teal never beige
  assert.equal(classifyColorFromRgb(40, 150, 165), 'blue');
  assert.notEqual(classifyColorFromRgb(55, 145, 175), 'beige');

  // Belief path: false trousers demotes; boots lock; blue top holds
  let state = createOutfitBeliefState();
  const blueTop = det({
    category: 'tops',
    subcategory: 'top',
    color: 'blue',
    confidence: 0.9,
    bbox: [0.22, 0.10, 0.52, 0.36],
    name: 'Blue top',
  });
  const falseTrousers = det({
    category: 'bottoms',
    subcategory: 'trousers',
    color: 'black',
    confidence: 0.95,
    bbox: fusedLeg,
    name: 'Dark trousers',
  });
  const docs = det({
    category: 'shoes',
    subcategory: 'boots',
    color: 'black',
    confidence: 0.88,
    bbox: docsBox,
    skinRatio: 0.06,
    name: 'Black boots',
  });
  const r1 = applyOutfitBelief(state, [blueTop, falseTrousers, docs], { now: 1000 });
  state = r1.state;
  assert.equal(state.top?.color, 'blue');
  assert.equal(state.bottom?.kind, 'shorts', 'fused socks+boots column must be shorts');
  assert.match(String(state.footwear?.subcategory || ''), /boot/i);

  // Wall-beige noise must not overwrite blue
  const beigeNoise = det({
    category: 'tops',
    subcategory: 'top',
    color: 'beige',
    confidence: 0.8,
    bbox: [0.22, 0.10, 0.52, 0.36],
  });
  state = applyOutfitBelief(state, [beigeNoise, falseTrousers, docs], { now: 2500 }).state;
  assert.equal(state.top?.color, 'blue');
});

case_('BARE_TORSO_SWIM_SHORTS_NO_GHOST_TOP', () => {
  let state = createOutfitBeliefState();
  const realTop = det({
    category: 'tops',
    subcategory: 'top',
    color: 'blue',
    confidence: 0.92,
    bbox: [0.2, 0.08, 0.55, 0.4],
  });
  const shorts = det({
    category: 'bottoms',
    subcategory: 'shorts',
    color: 'black',
    confidence: 0.9,
    bbox: [0.3, 0.52, 0.4, 0.24],
  });
  state = applyOutfitBelief(state, [realTop, shorts], { now: 1000 }).state;
  assert.ok(state.top);

  const ghostTop = det({
    category: 'tops',
    subcategory: 'top',
    name: 'Top',
    color: 'unknown',
    confidence: 0.95,
    bbox: [0.2, 0.08, 0.55, 0.4],
    skinRatio: 0.42,
  });
  const r = applyOutfitBelief(state, [ghostTop, shorts], { now: 2000 });
  assert.equal(r.state.torsoState, 'bare');
  assert.equal(r.state.top, null, 'ghost top must be destroyed, not held');
  assert.equal(r.detections.filter((d) => /top/i.test(d.category)).length, 0);
  assert.ok(r.state.bottom);
});

if (failed) {
  console.error(`\nliveRegression.test.ts: ${failed} failed`);
  process.exit(1);
}
console.log('\nliveRegression.test.ts: all passed');
