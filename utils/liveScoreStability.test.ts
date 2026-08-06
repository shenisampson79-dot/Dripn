import assert from 'node:assert/strict';

import {
  createLiveScoreGate,
  gateLiveScore,
  liveBeliefIsSettled,
  liveScoreSignature,
  LIVE_SCORE_MAX_HOLD_MS,
} from '@/utils/liveScoreStability';

const OUTFIT = liveScoreSignature([
  { category: 'tops', subcategory: 't-shirt', color: 'white' },
  { category: 'bottoms', subcategory: 'shorts', color: 'beige' },
  { category: 'shoes', subcategory: 'sneakers', color: 'white' },
]);

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

  const third = gateLiveScore(gate, 100, { signature: OUTFIT, now: 3200 });
  gate = third.gate;
  assert.equal(third.score, null, 'still no score until belief settles or max-hold');

  const settled = gateLiveScore(gate, 100, {
    signature: OUTFIT,
    now: 3300,
    settled: true,
  });
  assert.equal(settled.score, 100, 'settled belief is the first number the user sees');
}

// A settled outfit publishes on the first sample — nothing to wait for.
{
  const gate = createLiveScoreGate();
  const out = gateLiveScore(gate, 84, { signature: OUTFIT, now: 1000, settled: true });
  assert.equal(out.score, 84, 'settled belief publishes immediately');
}

// Once shown, ordinary drift updates immediately.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000, settled: true }).gate;
  const drift = gateLiveScore(gate, 85, { signature: OUTFIT, now: 3000 });
  assert.equal(drift.score, 85);
}

// A later jump holds the previous number rather than flashing a new one.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000, settled: true }).gate;
  const jump = gateLiveScore(gate, 55, { signature: OUTFIT, now: 3000 });
  assert.equal(jump.score, 80, 'unconfirmed jump keeps the shown score');
  const confirmed = gateLiveScore(jump.gate, 55, { signature: OUTFIT, now: 4000 });
  assert.equal(confirmed.score, 55);
}

// Changing clothes must not be corroborated by the previous outfit's sample.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000, settled: true }).gate;
  const changed = liveScoreSignature([
    { category: 'dresses', subcategory: 'maxi_dress', color: 'black' },
  ]);
  const out = gateLiveScore(gate, 40, { signature: changed, now: 2500 });
  assert.equal(out.score, 80, 'new outfit needs its own corroboration');
}

// A settled belief has nothing to corroborate — publish on the first sample.
{
  const gate = createLiveScoreGate();
  const out = gateLiveScore(gate, 90, { signature: OUTFIT, now: 1000, settled: true });
  assert.equal(out.score, 90, 'a locked belief must not sit behind a dash');
}

assert.equal(liveBeliefIsSettled([{ stability: 0.9 }, { stability: 0.88 }, null]), true);
assert.equal(liveBeliefIsSettled([{ stability: 0.9 }, { stability: 0.4 }]), false);
assert.equal(liveBeliefIsSettled([]), false, 'an empty belief is not settled');

// A settled belief still holds a later jump until a second sample agrees.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000, settled: true }).gate;
  const jump = gateLiveScore(gate, 55, { signature: OUTFIT, now: 2100, settled: true });
  assert.equal(jump.score, 80);
}

// A signature that churns every frame must not withhold the score forever.
{
  let gate = createLiveScoreGate();
  let shown: number | null = null;
  for (let i = 0; i < 6; i += 1) {
    const out = gateLiveScore(gate, 90 + i, {
      signature: `churn-${i}`,
      now: 1000 + i * 1100,
    });
    gate = out.gate;
    shown = out.score;
  }
  assert.notEqual(shown, null, 'jittering labels must still publish a score');
}

// Never withhold indefinitely — a held number beats a permanent dash.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 70, { signature: OUTFIT, now: 1000 }).gate;
  const forced = gateLiveScore(gate, 95, {
    signature: OUTFIT,
    now: 1000 + LIVE_SCORE_MAX_HOLD_MS,
  });
  assert.equal(forced.score, 95);
}

// A missing score never clears a number already on screen.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000, settled: true }).gate;
  const missing = gateLiveScore(gate, null, { signature: OUTFIT, now: 3000 });
  assert.equal(missing.score, 80);
}

console.log('liveScoreStability.test.ts: all passed');
