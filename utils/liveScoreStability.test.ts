import assert from 'node:assert/strict';

import {
  createLiveScoreGate,
  gateLiveJudgment,
  gateLiveScore,
  liveBeliefIsSettled,
  liveIdentityIsConsistent,
  liveIdentityKey,
  liveCoreIdentityKey,
  liveJudgmentCertainty,
  liveOutfitReadyToScore,
  liveScoreSignature,
  liveSlotWeightedStability,
  liveTopIsConsistent,
  presentLiveScore,
  pushLiveIdentitySample,
  createCertaintySmoothState,
  smoothLiveCertainty,
  LIVE_FIRST_SCORE_MAX_HOLD_MS,
  LIVE_FORCE_PUBLISH_MS,
  LIVE_IDENTITY_CHANGE_FRAMES,
  LIVE_MEDIUM_MAX_STREAK,
  LIVE_MEDIUM_MAX_MS,
  LIVE_PARTIAL_SCORE_CAP,
  LIVE_SCORE_MAX_HOLD_MS,
} from '@/utils/liveScoreStability';

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

// Unsettled athletic→chino flip: clear the frozen lie (dash) until re-settle.
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
  assert.equal(flipped.score, null, 'core drift while unsettled clears frozen score');
  assert.equal(flipped.gate.shown, null);
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
    display: '~84',
    numeric: 84,
    soft: true,
  });
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
  let buf: ReturnType<typeof pushLiveIdentitySample> = [];
  for (let i = 0; i < 3; i += 1) {
    buf = pushLiveIdentitySample(buf, confident('shorts', 'barefoot'));
  }
  assert.equal(liveIdentityKey(buf[buf.length - 1]), 'shorts|barefoot|none');
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

console.log('liveScoreStability.test.ts: all passed');
