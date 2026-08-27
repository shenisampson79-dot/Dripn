import assert from 'node:assert/strict';

import {
  createLiveScoreGate,
  gateLiveJudgment,
  gateLiveScore,
  isHighConfidenceCompleteCloudRead,
  liveBeliefIsSettled,
  liveIdentityIsConsistent,
  liveIdentityKey,
  liveCoreIdentityKey,
  liveJudgmentCertainty,
  liveOutfitReadyToScore,
  liveScoreSignature,
  liveSlotWeightedStability,
  liveTopIsConsistent,
  normalizeLiveShoeIdentity,
  presentLiveScore,
  pushLiveIdentitySample,
  createCertaintySmoothState,
  smoothLiveCertainty,
  isLiveFootwearResolved,
  isSportReadyInflationOnHeldLoafers,
  nextLiveScoreApproximation,
  shouldHoldLivePublishedCopy,
  LIVE_FIRST_SCORE_MAX_HOLD_MS,
  LIVE_FORCE_PUBLISH_MS,
  LIVE_IDENTITY_CHANGE_FRAMES,
  LIVE_MEDIUM_MAX_STREAK,
  LIVE_MEDIUM_MAX_MS,
  LIVE_PARTIAL_SCORE_CAP,
  LIVE_SCORE_MAX_HOLD_MS,
} from '@/utils/liveScoreStability';
import { scoreShoeStyle, shoeStyleScoreDelta } from '@/utils/liveFootwearGate';

const OUTFIT = liveScoreSignature([
  { category: 'tops', subcategory: 't-shirt', color: 'white' },
  { category: 'bottoms', subcategory: 'shorts', color: 'beige' },
  { category: 'shoes', subcategory: 'sneakers', color: 'white' },
]);

const confident = (bottom: string, shoe: string, conf = 0.92, pieceSet = 'none') => ({
  bottomKind: bottom,
  shoeSubtype: shoe,
  pieceSet,
  bottomConfidence: conf,
  shoeConfidence: conf,
});

// Signature ignores ordering so a reshuffled detection list still corroborates.
assert.equal(
  liveScoreSignature([
    { category: 'bottoms', subcategory: 'shorts', color: 'beige' },
    { category: 'shoes', subcategory: 'sneakers', color: 'white' },
    { category: 'tops', subcategory: 't-shirt', color: 'white' },
  ]),
  OUTFIT,
);

// Field case: 76 on half-settled labels then 100. Unsettled truth never publishes.
{
  let gate = createLiveScoreGate();
  const first = gateLiveScore(gate, 76, { signature: OUTFIT, now: 1000 });
  gate = first.gate;
  assert.equal(first.score, null, 'first unsettled sample is withheld');

  const second = gateLiveScore(gate, 100, { signature: OUTFIT, now: 2100 });
  gate = second.gate;
  assert.equal(second.score, null, 'agreeing samples still withhold without settled belief');

  // Old bug: forceAdopt at 3s published warmup Mixed weights. Must still withhold.
  const third = gateLiveScore(gate, 40, { signature: OUTFIT, now: 1000 + LIVE_SCORE_MAX_HOLD_MS });
  gate = third.gate;
  assert.equal(third.score, null, '3s force-adopt must NOT publish first unsettled score');

  const settled = gateLiveScore(gate, 100, {
    signature: OUTFIT,
    now: 3300,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(settled.score, 100, 'settled belief is the first number the user sees');
  assert.equal(settled.gate.scoredIdentityKey, 'shorts|sneakers');
}

// A settled outfit publishes on the first sample — nothing to wait for.
{
  const gate = createLiveScoreGate();
  const out = gateLiveScore(gate, 84, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(out.score, 84, 'settled belief publishes immediately');
}

// First high-confidence complete Cloud read publishes without BELIEF_PROVEN.
{
  assert.equal(
    isHighConfidenceCompleteCloudRead({
      source: 'cloud_vision',
      items: [
        { category: 'tops', subcategory: 't-shirt', name: 'White T-Shirt', confidence: 0.92 },
        { category: 'bottoms', subcategory: 'athletic_shorts', name: 'Black Athletic Shorts', confidence: 0.9 },
        { category: 'shoes', subcategory: 'boat_shoes', name: 'Red and White Boat Shoes', confidence: 0.88 },
      ],
    }),
    true,
  );
  assert.equal(
    isHighConfidenceCompleteCloudRead({
      source: 'cloud_vision',
      items: [
        { category: 'tops', subcategory: 't-shirt', name: 'Black T-Shirt', confidence: 0.95 },
        { category: 'bottoms', subcategory: 'sweat_shorts', name: 'Black Sweat Shorts', confidence: 0.9 },
      ],
    }),
    true,
    'top+bottom without shoes is a complete first publish',
  );
  assert.equal(
    isHighConfidenceCompleteCloudRead({
      source: 'on_device_yolo',
      items: [
        { category: 'tops', subcategory: 't-shirt', name: 'White T-Shirt', confidence: 0.95 },
        { category: 'bottoms', subcategory: 'shorts', name: 'Black Shorts', confidence: 0.95 },
      ],
    }),
    false,
    'YOLO-only is not a Cloud complete read',
  );
  const gate = createLiveScoreGate();
  const out = gateLiveScore(gate, 88, {
    signature: OUTFIT,
    now: 1000,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
  });
  assert.equal(out.score, 88, 'first Cloud complete read publishes without BELIEF_PROVEN');
}

// Once shown, ordinary drift updates immediately.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  const drift = gateLiveScore(gate, 85, {
    signature: OUTFIT,
    now: 3000,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(drift.score, 85);
}

// A later jump holds the previous number rather than flashing a new one.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  const jump = gateLiveScore(gate, 55, {
    signature: OUTFIT,
    now: 3000,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(jump.score, 80, 'unconfirmed jump keeps the shown score');
  const confirmed = gateLiveScore(jump.gate, 55, {
    signature: OUTFIT,
    now: 4000,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(confirmed.score, 55);
}

// Changing clothes must not be corroborated by the previous outfit's sample.
// Signature change = different garments — must not freeze the old number.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  const changed = liveScoreSignature([
    { category: 'bottoms', subcategory: 'athletic_shorts', color: 'white' },
    { category: 'tops', subcategory: 'hoodie', color: 'black' },
  ]);
  const out = gateLiveScore(gate, 55, {
    signature: changed,
    now: 2500,
    settled: true,
    identityKey: 'athletic_shorts|barefoot',
  });
  assert.equal(out.score, 55, 'signature + core drift adopts the new score');
}

// Unsettled athletic→chino flip: HOLD the published number until corroborated.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 98, {
    signature: liveScoreSignature([
      { category: 'bottoms', subcategory: 'athletic_shorts', color: 'white' },
      { category: 'tops', subcategory: 'hoodie', color: 'black' },
    ]),
    now: 1000,
    settled: true,
    identityKey: 'athletic_shorts|barefoot',
  }).gate;
  const flipped = gateLiveScore(gate, 72, {
    signature: liveScoreSignature([
      { category: 'bottoms', subcategory: 'chino_shorts', color: 'white' },
      { category: 'tops', subcategory: 'hoodie', color: 'black' },
    ]),
    now: 2000,
    settled: false,
    identityKey: 'chino_shorts|barefoot',
  });
  assert.equal(flipped.score, 98, 'unsettled core drift holds last published score');
  assert.equal(flipped.gate.shown, 98);
}

// Identity version change: wrong early score must yield to the corrected lock.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 40, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'trousers|boots',
  }).gate;
  const corrected = gateLiveScore(gate, 88, {
    signature: OUTFIT,
    now: 2500,
    settled: true,
    identityKey: 'shorts|loafers',
  });
  assert.equal(corrected.score, 88, 'new stable identity invalidates frozen score');
  assert.equal(corrected.gate.scoredIdentityKey, 'shorts|loafers');
}

assert.equal(liveBeliefIsSettled([{ stability: 0.9 }, { stability: 0.88 }, null]), true);
assert.equal(liveBeliefIsSettled([{ stability: 0.9 }, { stability: 0.4 }]), false);
assert.equal(liveBeliefIsSettled([]), false, 'an empty belief is not settled');

// Already-shown jump can force-adopt after short hold.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  const jump = gateLiveScore(gate, 55, {
    signature: OUTFIT,
    now: 2100,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(jump.score, 80);
  const forced = gateLiveScore(jump.gate, 55, {
    signature: OUTFIT,
    now: 2100 + LIVE_SCORE_MAX_HOLD_MS,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(forced.score, 55);
}

// Jittering labels after a score is shown must still update.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  let shown: number | null = 80;
  for (let i = 0; i < 6; i += 1) {
    const out = gateLiveScore(gate, 90 + i, {
      signature: `churn-${i}`,
      now: 1000 + i * 1100,
      settled: true,
      identityKey: 'shorts|sneakers',
    });
    gate = out.gate;
    shown = out.score;
  }
  assert.notEqual(shown, null, 'jittering labels must still publish a score');
}

// First score safety valve: 2s force-publish with core present (no top required).
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 70, { signature: OUTFIT, now: 1000 }).gate;
  const stillHeld = gateLiveScore(gate, 95, {
    signature: OUTFIT,
    now: 1000 + 1500,
    coreFilled: true,
  });
  assert.equal(stillHeld.score, null, 'under 2s still withholds without settle');
  const forced = gateLiveScore(stillHeld.gate, 95, {
    signature: OUTFIT,
    now: 1000 + LIVE_FORCE_PUBLISH_MS,
    coreFilled: true,
  });
  assert.equal(forced.score, 95, '2s + coreFilled force-publishes first score');
  // Identity lock path still works as a secondary ceiling.
  let gate2 = createLiveScoreGate();
  gate2 = gateLiveScore(gate2, 40, { signature: OUTFIT, now: 1000 }).gate;
  const noCore = gateLiveScore(gate2, 95, {
    signature: OUTFIT,
    now: 1000 + LIVE_FORCE_PUBLISH_MS,
    coreFilled: false,
  });
  assert.equal(noCore.score, null, 'force-publish still requires coreFilled');
}

// Once shown, unsettled identity must not adopt a new score.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 88, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  const held = gateLiveScore(gate, 40, {
    signature: OUTFIT,
    now: 2500,
    settled: false,
  });
  assert.equal(held.score, 88, 'unstable frame must not overwrite a published score');
}

// A missing score never clears a number already on screen.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
  }).gate;
  const missing = gateLiveScore(gate, null, {
    signature: OUTFIT,
    now: 3000,
    settled: true,
    identityKey: 'shorts|sneakers',
  });
  assert.equal(missing.score, 80);
}

// Confidence-weighted 3-frame identity lock.
{
  let buf = pushLiveIdentitySample([], confident('shorts', 'loafers', 0.7));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers', 0.7));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers', 0.7));
  assert.equal(
    liveIdentityIsConsistent(buf),
    false,
    'consistent but low-confidence must not lock',
  );

  buf = [];
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers'));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'boots'));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers'));
  assert.equal(liveIdentityIsConsistent(buf), false, 'shoe flip blocks consistency');
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers'));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers'));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers'));
  assert.equal(liveIdentityIsConsistent(buf), true);
  assert.equal(
    liveOutfitReadyToScore({
      slots: [{ stability: 0.9 }, { stability: 0.9 }],
      identityBuf: buf,
    }),
    true,
  );
}

// Identity inertia: a change vs last lock needs 4 agreeing frames.
{
  let buf: ReturnType<typeof pushLiveIdentitySample> = [];
  for (let i = 0; i < 3; i += 1) {
    buf = pushLiveIdentitySample(buf, confident('trousers', 'loafers'));
  }
  assert.equal(
    liveIdentityIsConsistent(buf, { prevLockedKey: 'shorts|loafers|none' }),
    false,
    '3 frames is not enough after an identity change',
  );
  buf = pushLiveIdentitySample(buf, confident('trousers', 'loafers'));
  assert.equal(buf.slice(-LIVE_IDENTITY_CHANGE_FRAMES).length, 4);
  assert.equal(
    liveIdentityIsConsistent(buf, { prevLockedKey: 'shorts|loafers' }),
    true,
    '4 frames unlocks the new identity',
  );
  assert.equal(liveCoreIdentityKey(buf[buf.length - 1]), 'trousers|loafers');
  assert.equal(liveIdentityKey(buf[buf.length - 1]), 'trousers|loafers|none');
}

// Partial truth: top drift softens certainty but does not block core lock.
{
  let buf: ReturnType<typeof pushLiveIdentitySample> = [];
  for (let i = 0; i < 3; i += 1) {
    buf = pushLiveIdentitySample(buf, {
      ...confident('shorts', 'loafers'),
      topKind: i === 1 ? 'shirt' : 'tshirt',
      topConfidence: 0.92,
    });
  }
  assert.equal(liveIdentityIsConsistent(buf), true, 'core still locks while top flips');
  assert.equal(liveTopIsConsistent(buf), false, 'top flicker is detected');
  assert.equal(
    liveJudgmentCertainty({ identityBuf: buf, coreReady: true }),
    'medium',
  );
  assert.ok(liveSlotWeightedStability(buf) < 0.85, 'weighted stability soft-fails on top drift');

  buf = [];
  for (let i = 0; i < 3; i += 1) {
    buf = pushLiveIdentitySample(buf, {
      ...confident('shorts', 'loafers'),
      topKind: 'tshirt',
      topConfidence: 0.92,
    });
  }
  assert.equal(liveJudgmentCertainty({ identityBuf: buf, coreReady: true }), 'high');
  assert.ok(liveSlotWeightedStability(buf) >= 0.85);
}

// Phantom piece-set change must version the full identity key, but must NOT
// block core settle — that left the badge on "—" over a locked hoodie+shorts.
{
  let buf: ReturnType<typeof pushLiveIdentitySample> = [];
  for (let i = 0; i < 3; i += 1) {
    buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers', 0.92, 't:hoodie'));
  }
  assert.equal(liveIdentityIsConsistent(buf), true);
  const before = liveIdentityKey(buf[buf.length - 1]);
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers', 0.92, 't:top+l:hoodie'));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers', 0.92, 't:top+l:hoodie'));
  buf = pushLiveIdentitySample(buf, confident('shorts', 'loafers', 0.92, 't:top+l:hoodie'));
  assert.equal(
    liveIdentityIsConsistent(buf, { prevLockedKey: 'shorts|loafers' }),
    true,
    'core still locks when piece-set flickers',
  );
  assert.equal(
    liveOutfitReadyToScore({
      slots: [{ stability: 0.9 }, { stability: 0.9 }],
      identityBuf: buf,
      prevLockedKey: 'shorts|loafers',
    }),
    true,
    'first score must publish despite ghost top piece-set',
  );
  const after = liveIdentityKey(buf[buf.length - 1]);
  assert.notEqual(before, after, 'full key still versions piece-set for rescore');
  assert.equal(liveCoreIdentityKey(buf[buf.length - 1]), 'shorts|loafers');
}

// Medium certainty caps score movement once a number is shown.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, {
    signature: OUTFIT,
    now: 1000,
    settled: true,
    identityKey: 'shorts|sneakers',
    certainty: 'high',
  }).gate;
  const jumped = gateLiveScore(gate, 95, {
    signature: OUTFIT,
    now: 2000,
    settled: true,
    identityKey: 'shorts|sneakers',
    certainty: 'medium',
  });
  assert.equal(jumped.score, 80 + LIVE_PARTIAL_SCORE_CAP, 'partial truth caps ±3');
}

// Soft expression — number stays exact for logic; HUD shows approximation.
{
  assert.deepEqual(presentLiveScore(84, 'high'), {
    display: '84',
    numeric: 84,
    soft: false,
  });
  assert.deepEqual(presentLiveScore(84, 'medium'), {
    display: '84',
    numeric: 84,
    soft: false,
  });
  assert.deepEqual(presentLiveScore(82, 'high', { approximate: true }), {
    display: '~82',
    numeric: 82,
    soft: true,
  });
  assert.equal(presentLiveScore(78, 'high', { approximate: false }).display, '78');
  assert.equal(presentLiveScore(96, 'medium', { approximate: false }).display, '96');
  assert.equal(presentLiveScore(null, 'medium').display, '—');
}

// Confidence upgrade must not snap medium → high on the first high frame.
{
  let state = createCertaintySmoothState();
  let out = smoothLiveCertainty(state, 'medium');
  state = out.state;
  assert.equal(out.certainty, 'medium');
  out = smoothLiveCertainty(state, 'high');
  state = out.state;
  assert.equal(out.certainty, 'medium', 'first high after medium stays soft');
  out = smoothLiveCertainty(state, 'high');
  assert.equal(out.certainty, 'high', 'second consecutive high upgrades');
  // Downgrade is immediate.
  out = smoothLiveCertainty(out.state, 'medium');
  assert.equal(out.certainty, 'medium');
}

// Medium must converge — perpetual ~ is a silent trust killer.
{
  let state = createCertaintySmoothState();
  let out = smoothLiveCertainty(state, 'medium', 1000);
  for (let i = 1; i < LIVE_MEDIUM_MAX_STREAK - 1; i += 1) {
    out = smoothLiveCertainty(out.state, 'medium', 1000 + i * 100);
    assert.equal(out.certainty, 'medium', `frame ${i + 1} still soft`);
  }
  out = smoothLiveCertainty(out.state, 'medium', 1000 + LIVE_MEDIUM_MAX_STREAK * 100);
  assert.equal(out.certainty, 'high', 'long medium streak commits displayed score');
}

// Wall-clock fallback: slow cloud FPS still commits within LIVE_MEDIUM_MAX_MS.
{
  let state = createCertaintySmoothState();
  let out = smoothLiveCertainty(state, 'medium', 1000);
  out = smoothLiveCertainty(out.state, 'medium', 1000 + LIVE_MEDIUM_MAX_MS);
  assert.equal(out.certainty, 'high', '12s medium wall-clock commits even at 2 frames');
}

// Unscored HUD must not paint judgment copy.
{
  const coaching = {
    headline: 'Mixed direction',
    summary: 'Sportswear under a tie.',
    bullets: ['Swap trainers for loafers'],
  };
  const gated = gateLiveJudgment(coaching, null);
  assert.equal(gated?.headline, '');
  assert.equal(gated?.summary, '');
  assert.deepEqual(gated?.bullets, []);
  const open = gateLiveJudgment(coaching, 82);
  assert.equal(open?.headline, 'Mixed direction');
  assert.equal(open?.summary, 'Sportswear under a tie.');
}

// Barefoot is a lockable shoe identity — bottom + barefoot can settle without footwear belief.
{
  assert.equal(normalizeLiveShoeIdentity(null), 'none');
  assert.equal(normalizeLiveShoeIdentity('searching'), 'none');
  assert.equal(normalizeLiveShoeIdentity('barefoot'), 'none');
  let buf: ReturnType<typeof pushLiveIdentitySample> = [];
  for (let i = 0; i < 3; i += 1) {
    buf = pushLiveIdentitySample(buf, confident('shorts', 'barefoot'));
  }
  assert.equal(liveIdentityKey(buf[buf.length - 1]), 'shorts|none|none');
  assert.equal(liveIdentityIsConsistent(buf), true, 'barefoot identity locks');
  assert.equal(
    liveOutfitReadyToScore({
      slots: [{ stability: 0.9 }],
      identityBuf: buf,
    }),
    true,
    'barefoot outfits score with bottom alone settled',
  );
}

// First Cloud top+bottom publishes immediately; later Searching-shoes frames HOLD.
{
  const topBottom = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'black' },
    { category: 'bottoms', subcategory: 'athletic_shorts', color: 'black' },
  ]);
  let gate = createLiveScoreGate();
  const first = gateLiveScore(gate, 82, {
    signature: topBottom,
    now: 1000,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
    identityKey: 'athletic_shorts|none',
    footwearResolved: false,
  });
  assert.equal(first.score, 82, 'first publish on top+bottom without shoes');
  assert.equal(first.gate.approximate, true, 'unresolved footwear is approximate');
  assert.equal(
    presentLiveScore(first.score, 'high', { approximate: first.gate.approximate }).display,
    '~82',
  );
  gate = first.gate;
  const searching = gateLiveScore(gate, 64, {
    signature: liveScoreSignature([
      { category: 'tops', subcategory: 't-shirt', color: 'black' },
      { category: 'bottoms', subcategory: 'sweat_shorts', color: 'black' },
    ]),
    now: 4000,
    settled: false,
    identityLocked: false,
    cloudComplete: false,
    identityKey: 'sweat_shorts|none',
    footwearResolved: false,
  });
  assert.equal(searching.score, 82, 'Searching shoes / athletic↔sweat must not blank 82');
  assert.equal(searching.gate.shown, 82);
  assert.equal(searching.gate.approximate, true, 'Searching keeps ~ until footwear resolves');
  assert.notEqual(
    presentLiveScore(searching.score, 'high', { approximate: searching.gate.approximate }).display,
    '—',
    'Searching frames never return to a dash',
  );
}

// Shoes arriving drop ~ atomically; loafers vs trainers can change the number.
{
  const topBottom = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'white' },
    { category: 'bottoms', subcategory: 'trousers', color: 'navy' },
  ]);
  let gate = createLiveScoreGate();
  const first = gateLiveScore(gate, 82, {
    signature: topBottom,
    now: 1000,
    cloudComplete: true,
    identityKey: 'trousers|none',
    footwearResolved: false,
  });
  assert.equal(
    presentLiveScore(first.score, 'high', { approximate: first.gate.approximate }).display,
    '~82',
  );
  gate = first.gate;

  const pendingShoes = gateLiveScore(gate, 78, {
    signature: liveScoreSignature([
      { category: 'tops', subcategory: 't-shirt', color: 'white' },
      { category: 'bottoms', subcategory: 'trousers', color: 'navy' },
      { category: 'shoes', subcategory: 'loafers', color: 'brown' },
    ]),
    now: 2000,
    settled: false,
    identityLocked: false,
    cloudComplete: false,
    identityKey: 'trousers|loafers',
    footwearResolved: true,
  });
  assert.equal(pendingShoes.score, 82, 'uncorroborated loafers hold ~82');
  assert.equal(pendingShoes.gate.approximate, true, '~ stays until the new score adopts');
  assert.notEqual(
    presentLiveScore(pendingShoes.score, 'high', { approximate: pendingShoes.gate.approximate }).display,
    '—',
  );

  const loafers = gateLiveScore(pendingShoes.gate, 78, {
    signature: liveScoreSignature([
      { category: 'tops', subcategory: 't-shirt', color: 'white' },
      { category: 'bottoms', subcategory: 'trousers', color: 'navy' },
      { category: 'shoes', subcategory: 'loafers', color: 'brown' },
    ]),
    now: 2500,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'trousers|loafers',
    footwearResolved: true,
  });
  assert.equal(loafers.score, 78, 'loafers replace ~82 atomically');
  assert.equal(loafers.gate.approximate, false);
  assert.equal(
    presentLiveScore(loafers.score, 'high', { approximate: loafers.gate.approximate }).display,
    '78',
  );

  const trainers = gateLiveScore(loafers.gate, 64, {
    signature: liveScoreSignature([
      { category: 'tops', subcategory: 't-shirt', color: 'white' },
      { category: 'bottoms', subcategory: 'trousers', color: 'navy' },
      { category: 'shoes', subcategory: 'sneakers', color: 'white' },
    ]),
    now: 4000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'trousers|sneakers',
    footwearResolved: true,
  });
  assert.equal(trainers.score, 64, 'trainers are a different scoring identity');
  assert.equal(trainers.gate.approximate, false, '~ does not return after footwear resolved');
  assert.notEqual(trainers.score, loafers.score);
  const loaferDelta = shoeStyleScoreDelta(scoreShoeStyle({
    subtype: 'loafers',
    bottomKind: 'trousers',
    occasionType: 'work',
  }));
  const trainerDelta = shoeStyleScoreDelta(scoreShoeStyle({
    subtype: 'sneakers',
    bottomKind: 'trousers',
    occasionType: 'work',
  }));
  assert.notEqual(
    loaferDelta,
    trainerDelta,
    'loafers vs trainers change the footwear contribution',
  );
  assert.notEqual(
    presentLiveScore(trainers.score, 'high', { approximate: trainers.gate.approximate }).display,
    '—',
  );

  const searchingAfter = gateLiveScore(trainers.gate, 50, {
    signature: topBottom,
    now: 5000,
    settled: false,
    cloudComplete: false,
    identityKey: 'trousers|none',
    footwearResolved: false,
  });
  assert.equal(searchingAfter.score, 64, 'later Searching frames keep the last exact score');
  assert.equal(searchingAfter.gate.approximate, false);
}

{
  assert.equal(isLiveFootwearResolved({ searching: true }), false);
  assert.equal(isLiveFootwearResolved({ cropped: true }), true);
  assert.equal(isLiveFootwearResolved({ shoeSubtype: 'loafers' }), true);
  assert.equal(isLiveFootwearResolved({ barefootConfirmed: true }), true);
  assert.equal(isLiveFootwearResolved({ shoeSubtype: 'searching', searching: true }), false);

  const cropped = gateLiveScore(createLiveScoreGate(), 80, {
    signature: liveScoreSignature([
      { category: 'tops', subcategory: 't-shirt', color: 'black' },
      { category: 'bottoms', subcategory: 'shorts', color: 'black' },
    ]),
    now: 1000,
    cloudComplete: true,
    identityKey: 'shorts|none',
    footwearResolved: true,
  });
  assert.equal(cropped.gate.approximate, false, 'explicit cropped/none is a stable answer');
  assert.equal(presentLiveScore(cropped.score, 'high', { approximate: false }).display, '80');
  assert.equal(
    nextLiveScoreApproximation({
      shown: 82,
      previouslyApproximate: true,
      footwearResolved: true,
      identityShifted: true,
      adopting: true,
    }),
    false,
    'adopted shoes drop ~',
  );
  assert.equal(
    nextLiveScoreApproximation({
      shown: 82,
      previouslyApproximate: true,
      footwearResolved: true,
      identityShifted: true,
      adopting: false,
    }),
    true,
    'hold while shoes arrive keeps ~ until adopt',
  );
}

assert.equal(normalizeLiveShoeIdentity('trainers'), 'sneakers');
assert.equal(normalizeLiveShoeIdentity('trainer'), 'sneakers');
assert.equal(normalizeLiveShoeIdentity('sneakers'), 'sneakers');
assert.equal(
  liveCoreIdentityKey({ bottomKind: 'shorts', shoeSubtype: 'trainers' }),
  liveCoreIdentityKey({ bottomKind: 'shorts', shoeSubtype: 'sneakers' }),
  'trainers and sneakers are one scoring identity',
);

// QA 18 Aug: loafers → trainers must adopt the new Cloud number immediately,
// even while shoes are STABLE (not 0.85-settled). Never keep 48 next to a
// trainers summary.
{
  const loafersSig = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'black' },
    { category: 'bottoms', subcategory: 'sweat_shorts', color: 'black' },
    { category: 'shoes', subcategory: 'loafers', color: 'black' },
  ]);
  const trainersSig = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'black' },
    { category: 'bottoms', subcategory: 'sweat_shorts', color: 'black' },
    { category: 'shoes', subcategory: 'trainers', color: 'white' },
  ]);
  let gate = createLiveScoreGate();
  const loafers = gateLiveScore(gate, 48, {
    signature: loafersSig,
    now: 1000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'sweat_shorts|loafers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(loafers.score, 48);
  assert.equal(loafers.gate.approximate, false);

  const trainers = gateLiveScore(loafers.gate, 96, {
    signature: trainersSig,
    now: 2500,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
    identityKey: 'sweat_shorts|sneakers|t:t-shirt',
    footwearResolved: true,
    certainty: 'medium',
  });
  assert.equal(trainers.score, 96, 'loafers→trainers Cloud read adopts 96, not held 48');
  assert.equal(trainers.gate.approximate, false, 'resolved trainers drop ~');
  assert.equal(
    presentLiveScore(trainers.score, 'medium', { approximate: trainers.gate.approximate }).display,
    '96',
  );
  assert.equal(
    shouldHoldLivePublishedCopy({
      adoptedScore: trainers.score,
      scoredIdentityKey: trainers.gate.scoredIdentityKey,
      nextIdentityKey: 'sweat_shorts|sneakers|t:t-shirt',
    }),
    false,
    'adopted trainers score publishes trainers copy',
  );
  assert.equal(
    shouldHoldLivePublishedCopy({
      adoptedScore: 48,
      scoredIdentityKey: 'sweat_shorts|loafers|t:t-shirt',
      nextIdentityKey: 'sweat_shorts|sneakers|t:t-shirt',
    }),
    true,
    'held loafers-48 must not paint trainers copy',
  );

  // Same trainers identity, still not slot-settled: later Cloud 96 must not freeze.
  const later = gateLiveScore(createLiveScoreGate(), 48, {
    signature: trainersSig,
    now: 1000,
    cloudComplete: true,
    identityKey: 'sweat_shorts|sneakers|t:t-shirt',
    footwearResolved: true,
  });
  const rescore = gateLiveScore(later.gate, 96, {
    signature: trainersSig,
    now: 4000,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
    identityKey: 'sweat_shorts|sneakers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(rescore.score, 96, 'unsettled same-identity Cloud complete must rescore');
  assert.equal(rescore.gate.approximate, false);
}

{
  let gate = createLiveScoreGate();
  const loafersSig = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'grey' },
    { category: 'bottoms', subcategory: 'athletic_shorts', color: 'navy' },
    { category: 'shoes', subcategory: 'loafers', color: 'black' },
  ]);
  const held = gateLiveScore(gate, 47, {
    signature: loafersSig,
    now: 1000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'athletic_shorts|loafers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(held.score, 47);
  const inflated = gateLiveScore(held.gate, 82, {
    signature: loafersSig,
    now: 2500,
    settled: false,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'athletic_shorts|loafers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(inflated.score, 47, 'floor-trainer Cloud 82 must not replace held loafers clash');
}

// G3-LIVE-HOLD-01: athletic_shorts Mixed → chino_shorts Nice must hold while
// tee + shorts + loafers stay stationary (cloudComplete must not adopt).
{
  const athleticSig = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'grey' },
    { category: 'bottoms', subcategory: 'athletic_shorts', color: 'navy' },
    { category: 'shoes', subcategory: 'loafers', color: 'black' },
  ]);
  const chinoSig = liveScoreSignature([
    { category: 'tops', subcategory: 't-shirt', color: 'grey' },
    { category: 'bottoms', subcategory: 'chino_shorts', color: 'navy' },
    { category: 'shoes', subcategory: 'loafers', color: 'black' },
  ]);
  const mixed = gateLiveScore(createLiveScoreGate(), 47, {
    signature: athleticSig,
    now: 1000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'athletic_shorts|loafers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(mixed.score, 47);
  assert.equal(
    isSportReadyInflationOnHeldLoafers('athletic_shorts|loafers|t:t-shirt', 47, 75),
    true,
  );
  const chinoFlicker = gateLiveScore(mixed.gate, 75, {
    signature: chinoSig,
    now: 2500,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'chino_shorts|loafers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(
    chinoFlicker.score,
    47,
    'G3-LIVE-HOLD-01: athletic↔chino must not upgrade Mixed→Nice',
  );
  assert.equal(chinoFlicker.gate.shown, 47);

  // Real footwear change may leave the clash.
  const trainers = gateLiveScore(mixed.gate, 82, {
    signature: liveScoreSignature([
      { category: 'tops', subcategory: 't-shirt', color: 'grey' },
      { category: 'bottoms', subcategory: 'athletic_shorts', color: 'navy' },
      { category: 'shoes', subcategory: 'sneakers', color: 'white' },
    ]),
    now: 4000,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'athletic_shorts|sneakers|t:t-shirt',
    footwearResolved: true,
  });
  assert.equal(trainers.score, 82, 'loafers→trainers may adopt sport score');
}

console.log('liveScoreStability.test.ts: all passed');
