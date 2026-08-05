import assert from 'node:assert/strict';

import {
  createLiveScoreGate,
  gateLiveScore,
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

// Field case: 76 on half-settled labels then 100. The 76 is never published.
{
  let gate = createLiveScoreGate();
  const first = gateLiveScore(gate, 76, { signature: OUTFIT, now: 1000 });
  gate = first.gate;
  assert.equal(first.score, null, 'first sample is withheld pending corroboration');

  const second = gateLiveScore(gate, 100, { signature: OUTFIT, now: 2100 });
  gate = second.gate;
  assert.equal(second.score, null, '100 disagrees with 76 — still nothing to show');

  const third = gateLiveScore(gate, 100, { signature: OUTFIT, now: 3200 });
  gate = third.gate;
  assert.equal(third.score, 100, 'settled score is the first number the user sees');
}

// A stable outfit publishes on the second agreeing sample, not later.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 82, { signature: OUTFIT, now: 1000 }).gate;
  const out = gateLiveScore(gate, 84, { signature: OUTFIT, now: 2100 });
  assert.equal(out.score, 84, 'near-identical samples agree');
}

// Once shown, ordinary drift updates immediately.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000 }).gate;
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 2000 }).gate;
  const drift = gateLiveScore(gate, 85, { signature: OUTFIT, now: 3000 });
  assert.equal(drift.score, 85);
}

// A later jump holds the previous number rather than flashing a new one.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000 }).gate;
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 2000 }).gate;
  const jump = gateLiveScore(gate, 55, { signature: OUTFIT, now: 3000 });
  assert.equal(jump.score, 80, 'unconfirmed jump keeps the shown score');
  const confirmed = gateLiveScore(jump.gate, 55, { signature: OUTFIT, now: 4000 });
  assert.equal(confirmed.score, 55);
}

// Changing clothes must not be corroborated by the previous outfit's sample.
{
  let gate = createLiveScoreGate();
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000 }).gate;
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 2000 }).gate;
  const changed = liveScoreSignature([
    { category: 'dresses', subcategory: 'maxi_dress', color: 'black' },
  ]);
  const out = gateLiveScore(gate, 40, { signature: changed, now: 2500 });
  assert.equal(out.score, 80, 'new outfit needs its own corroboration');
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
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 1000 }).gate;
  gate = gateLiveScore(gate, 80, { signature: OUTFIT, now: 2000 }).gate;
  const missing = gateLiveScore(gate, null, { signature: OUTFIT, now: 3000 });
  assert.equal(missing.score, 80);
}

console.log('liveScoreStability.test.ts: all passed');
