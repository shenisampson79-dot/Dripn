/**
 * Live footwear 3-state launch freeze gate.
 * Run: npx tsx utils/liveFootwearLaunchGate.test.ts
 *
 * 1. Loafers worn, trainers nowhere near feet — hold loafers, clash score, no sock bullet
 * 2. Loafers still worn, trainers in front of feet — still loafers, not sport-ready
 * 3. Trainers actually put on — one atomic swap; copy follows trainers
 */
import assert from 'node:assert/strict';

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { adviseLegwear } from '@/utils/legwearAdvisory';
import { gateFootwearDetections } from '@/utils/liveFootwearGate';
import { headlineFromScore, scoreToBand } from '@/utils/liveOutcomeContract';
import { renderCopyFromPublishedTruth } from '@/utils/livePublishedCopy';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';
import {
  createLiveScoreGate,
  gateLiveScore,
  isSportReadyInflationOnHeldLoafers,
  liveScoreSignature,
  shouldHoldLivePublishedCopy,
} from '@/utils/liveScoreStability';

const top: OnDeviceDetection = {
  name: 'Grey T-Shirt',
  category: 'tops',
  subcategory: 't-shirt',
  color: 'grey',
  confidence: 0.94,
  bbox: [0.22, 0.08, 0.52, 0.38],
};
const athleticShorts: OnDeviceDetection = {
  name: 'Navy Athletic Shorts',
  category: 'bottoms',
  subcategory: 'athletic_shorts',
  color: 'navy',
  confidence: 0.95,
  bbox: [0.28, 0.48, 0.44, 0.18],
};
const wornLoafers: OnDeviceDetection = {
  name: 'Black Loafers',
  category: 'shoes',
  subcategory: 'loafers',
  color: 'black',
  confidence: 0.93,
  bbox: [0.38, 0.82, 0.22, 0.10],
  skinRatio: 0.06,
};
const distantTrainers: OnDeviceDetection = {
  name: 'White Trainers',
  category: 'shoes',
  subcategory: 'sneakers',
  color: 'white',
  confidence: 1,
  bbox: [0.02, 0.88, 0.16, 0.10],
  skinRatio: 0.04,
};
const floorInFront: OnDeviceDetection = {
  name: 'White Trainers',
  category: 'shoes',
  subcategory: 'sneakers',
  color: 'white',
  confidence: 1,
  bbox: [0.36, 0.86, 0.32, 0.13],
  skinRatio: 0.04,
};
const wornTrainers: OnDeviceDetection = {
  name: 'White Trainers',
  category: 'shoes',
  subcategory: 'sneakers',
  color: 'white',
  confidence: 0.96,
  bbox: [0.38, 0.82, 0.22, 0.10],
  skinRatio: 0.05,
};

function truthItem(
  name: string,
  category: string,
  subcategory: string,
  color: string,
): LiveTruthItem {
  return {
    name,
    category,
    subcategory,
    color,
    confidence: 0.93,
    stability: 0.7,
  };
}

function published(
  shoes: { name: string; subcategory: string; color: string },
  score: number,
  extras: Partial<LiveOutfitTruth> = {},
): LiveOutfitTruth {
  const clash = /loafer/i.test(shoes.name) || /loafer/i.test(shoes.subcategory);
  return {
    top: truthItem('Grey T-Shirt', 'tops', 't-shirt', 'grey'),
    layer: null,
    bottom: truthItem('Navy Athletic Shorts', 'bottoms', 'athletic_shorts', 'navy'),
    footwear: truthItem(shoes.name, 'shoes', shoes.subcategory, shoes.color),
    lane: clash ? 'casual' : 'athleisure',
    score,
    hasConflict: clash,
    isStable: true,
    confidenceLevel: 'high',
    signature: clash
      ? 't-shirt|athletic_shorts|loafers'
      : 't-shirt|athletic_shorts|sneakers',
    timestamp: 1,
    seedDetections: [],
    legwear: {
      type: 'socks',
      style: 'athletic',
      colour: 'white',
      confidence: 0.92,
    },
    ...extras,
  };
}

function copyFor(t: LiveOutfitTruth) {
  return renderCopyFromPublishedTruth({
    headline: headlineFromScore(Number(t.score), t.lane),
    summary: 'stale',
    summaryTemplate: '{shoes} sit awkwardly with {bottom}.',
    bullets: ['Dressy shoes need smarter bottoms — or swap to trainers with sport shorts.'],
    hasConflict: t.hasConflict,
  }, t);
}

const loaferSig = liveScoreSignature([
  { category: 'tops', subcategory: 't-shirt', color: 'grey' },
  { category: 'bottoms', subcategory: 'athletic_shorts', color: 'navy' },
  { category: 'shoes', subcategory: 'loafers', color: 'black' },
]);
const trainerSig = liveScoreSignature([
  { category: 'tops', subcategory: 't-shirt', color: 'grey' },
  { category: 'bottoms', subcategory: 'athletic_shorts', color: 'navy' },
  { category: 'shoes', subcategory: 'trainers', color: 'white' },
]);

const LOAFER_KEY = 'athletic_shorts|loafers|t:t-shirt';
const TRAINER_KEY = 'athletic_shorts|sneakers|t:t-shirt';

// ── State 1: loafers worn, trainers not near feet ─────────────────────────
{
  const gated = gateFootwearDetections([top, athleticShorts, wornLoafers, distantTrainers], {
    now: 1000,
    bottomBandBrightness: 0.3,
    heldFootwearBbox: wornLoafers.bbox as [number, number, number, number],
    heldFootwearName: 'Black Loafers',
  });
  assert.match(String(gated.accepted?.name), /loafer/i, 'state1 published footwear stays loafers');
  assert.doesNotMatch(String(gated.accepted?.name), /trainer/i);

  let gate = createLiveScoreGate();
  const scored = gateLiveScore(gate, 47, {
    signature: loaferSig,
    now: 1000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: LOAFER_KEY,
    footwearResolved: true,
  });
  assert.equal(scored.score, 47);
  assert.ok(scoreToBand(47) === 'weak' || (scored.score != null && scored.score < 65));
  assert.match(headlineFromScore(47, 'casual'), /needs a tweak/i);

  const t = published(
    { name: 'Black Loafers', subcategory: 'loafers', color: 'black' },
    47,
  );
  const copy = copyFor(t);
  assert.match(String(copy?.summary), /loafer/i);
  assert.match(String(copy?.summary), /short/i);
  assert.doesNotMatch(String(copy?.summary), /trainer/i);
  assert.equal(
    adviseLegwear({ truth: t, legwear: t.legwear }),
    null,
    'state1 white sports socks + athletic shorts: no sock bullet',
  );
  const joined = (copy?.bullets || []).join(' ');
  assert.doesNotMatch(joined, /trousers/i);
  assert.doesNotMatch(joined, /socks?/i);
}

// ── State 2: loafers still worn, trainers placed directly in front ────────
{
  const dual = gateFootwearDetections([top, athleticShorts, wornLoafers, floorInFront], {
    now: 2000,
    bottomBandBrightness: 0.3,
    heldFootwearBbox: wornLoafers.bbox as [number, number, number, number],
    heldFootwearName: 'Black Loafers',
  });
  assert.match(String(dual.accepted?.name), /loafer/i, 'state2 dual conflict holds loafers');
  assert.doesNotMatch(String(dual.accepted?.name), /trainer/i);

  const onlyFloor = gateFootwearDetections([top, athleticShorts, floorInFront], {
    now: 2100,
    bottomBandBrightness: 0.3,
    heldFootwearBbox: wornLoafers.bbox as [number, number, number, number],
    heldFootwearName: 'Black Loafers',
  });
  assert.equal(onlyFloor.accepted, null, 'state2 in-front trainers must not steal identity');

  const held = gateLiveScore(createLiveScoreGate(), 47, {
    signature: loaferSig,
    now: 2000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: LOAFER_KEY,
    footwearResolved: true,
  });
  const inflated = gateLiveScore(held.gate, 82, {
    signature: loaferSig,
    now: 3500,
    settled: false,
    identityLocked: true,
    cloudComplete: true,
    identityKey: LOAFER_KEY,
    footwearResolved: true,
  });
  assert.equal(inflated.score, 47, 'state2 score must not jump to sport-ready');
  assert.ok((inflated.score ?? 0) < 80);
  assert.equal(isSportReadyInflationOnHeldLoafers(LOAFER_KEY, 47, 82), true);
  assert.equal(
    shouldHoldLivePublishedCopy({
      adoptedScore: 47,
      scoredIdentityKey: LOAFER_KEY,
      nextIdentityKey: TRAINER_KEY,
    }),
    true,
    'state2 held loafers-47 must not paint trainers copy',
  );

  const t = published(
    { name: 'Black Loafers', subcategory: 'loafers', color: 'black' },
    47,
  );
  const copy = copyFor(t);
  assert.match(String(copy?.summary), /loafer/i);
  assert.match(String(copy?.summary), /short/i);
  assert.doesNotMatch(String(copy?.summary), /trainer/i);
}

// ── State 3: trainers actually put on — one atomic identity swap ──────────
{
  const putOn = gateFootwearDetections([top, athleticShorts, wornTrainers], {
    now: 4000,
    bottomBandBrightness: 0.3,
    heldFootwearBbox: wornLoafers.bbox as [number, number, number, number],
    heldFootwearName: 'Black Loafers',
  });
  assert.match(String(putOn.accepted?.name), /trainer/i, 'state3 published footwear becomes trainers');
  assert.doesNotMatch(String(putOn.accepted?.name), /loafer/i);

  const loafers = gateLiveScore(createLiveScoreGate(), 47, {
    signature: loaferSig,
    now: 4000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: LOAFER_KEY,
    footwearResolved: true,
  });
  const trainers = gateLiveScore(loafers.gate, 88, {
    signature: trainerSig,
    now: 5500,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
    identityKey: TRAINER_KEY,
    footwearResolved: true,
    certainty: 'medium',
  });
  assert.equal(trainers.score, 88, 'state3 score updates with trainers');
  assert.equal(
    shouldHoldLivePublishedCopy({
      adoptedScore: trainers.score,
      scoredIdentityKey: trainers.gate.scoredIdentityKey,
      nextIdentityKey: TRAINER_KEY,
    }),
    false,
    'state3 adopted trainers score publishes trainers copy',
  );

  const t = published(
    { name: 'White Trainers', subcategory: 'trainers', color: 'white' },
    88,
    { hasConflict: false, lane: 'athleisure' },
  );
  const copy = renderCopyFromPublishedTruth({
    headline: headlineFromScore(88, 'athleisure'),
    summary: 'stale loafers',
    summaryTemplate: '{top} and {bottom} keep to a consistent colour direction.',
    bullets: [
      'The sports socks make the loafers feel more casual; finer dress socks would keep the smart direction cleaner.',
    ],
  }, t);
  assert.doesNotMatch(String(copy?.summary), /loafer/i);
  assert.doesNotMatch((copy?.bullets || []).join(' '), /loafer/i);
  assert.equal(adviseLegwear({ truth: t, legwear: t.legwear }), null);
  assert.notEqual(headlineFromScore(88, 'athleisure'), headlineFromScore(47, 'casual'));
}

console.log('liveFootwearLaunchGate.test.ts: 3-state PASS');
