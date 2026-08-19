/**
 * Run: npx tsx utils/liveOutcomeContract.test.ts
 */
import assert from 'node:assert/strict';

import {
  assertOutcomeConsistency,
  enforceLiveOutcomeContract,
  scoreToBand,
  softenOutcomeTone,
} from '@/utils/liveOutcomeContract';

assert.equal(scoreToBand(42), 'weak');
assert.equal(scoreToBand(52), 'mixed');
assert.equal(scoreToBand(70), 'good');
assert.equal(scoreToBand(88), 'strong');
assert.doesNotThrow(() => assertOutcomeConsistency(88, 'strong'));
assert.throws(() => assertOutcomeConsistency(88, 'weak'));

{
  const out = enforceLiveOutcomeContract({
    headline: 'Mixed directions',
    summary: 'The palette stays consistent across Light Pink Dress Shirt and Beige Chino Shorts.',
    bullets: ['Colour clashing – simplify palette', 'A deck shoe keeps the look relaxed but put together'],
    hasConflict: true,
    sameLane: false,
    styleLane: 'smart_casual',
  }, 92);
  assert.doesNotMatch(out?.headline || '', /mixed/i);
  assert.equal(out?.hasConflict, false);
  assert.ok(!(out?.bullets || []).some((b) => /clash/i.test(b)));
  assert.doesNotMatch(out?.summary || '', /Light Pink Dress Shirt/);
}

{
  const out = enforceLiveOutcomeContract({
    headline: 'Mixed directions',
    summary: 'The direction of black hoodie conflicts with white chino shorts.',
    bullets: ['Mixes athleisure with smart casual — different style worlds'],
    hasConflict: true,
    summaryArchetype: 'tension',
    styleLane: 'casual',
  }, 98);
  assert.doesNotMatch(out?.summary || '', /direction of black hoodie with white/i);
  assert.doesNotMatch(out?.summary || '', /conflicts with/i);
  assert.match(out?.summary || '', /work together|consistent direction|settling/i);
}

{
  const out = enforceLiveOutcomeContract({
    headline: 'Mixed directions',
    summary: 'Beige chino shorts read dressier than black flip-flops.',
    bullets: ['Swap the chinos for dark denim shorts'],
    hasConflict: true,
    sameLane: false,
  }, 52);
  assert.match(out?.headline || '', /mixed directions/i);
  assert.equal((out?.bullets || []).length, 0, 'reasonless swap dropped');
}

{
  const out = enforceLiveOutcomeContract({
    headline: 'Needs a tweak',
    summary: 'White t-shirt and white trousers sit together cleanly.',
    bullets: ['Formality span too wide — keep pieces within 2 tiers of each other'],
    hasConflict: false,
    styleLane: 'casual',
  }, 100);
  assert.doesNotMatch(out?.headline || '', /needs a tweak/i);
  assert.equal((out?.bullets || []).length, 0);
}

{
  const out = enforceLiveOutcomeContract({
    headline: 'Mixed weights',
    summary: 'Weights feel mixed — some pieces read much warmer than others.',
    bullets: [],
    hasConflict: true,
    styleLane: 'casual',
  }, 81);
  assert.doesNotMatch(out?.headline || '', /mixed weights/i);
  assert.equal(out?.hasConflict, false);
}

{
  const out = enforceLiveOutcomeContract({
    headline: 'Mixed weights',
    summary: 'Weights feel mixed — some pieces read much warmer than others.',
    bullets: ['Formality span too wide — keep pieces within 2 tiers of each other'],
    hasConflict: true,
    styleLane: 'casual',
  }, 88, { certainty: 'medium' });
  assert.doesNotMatch(out?.headline || '', /mixed weights/i);
  assert.equal(out?.hasConflict, false);
  assert.equal((out?.bullets || []).length, 1, 'hard claims dropped; safe trait backfilled');
  assert.doesNotMatch(out?.bullets?.[0] || '', /formality|mixed|conflict/i);
  assert.match(out?.headline || '', /settling in/i);
  assert.doesNotMatch(out?.headline || '', /looking solid|polished|looks sharp/i);
}

// Balanced praise is illegal on a weak score.
{
  const out = enforceLiveOutcomeContract({
    headline: 'Looking good',
    summary: 'The pieces feel balanced and cohesive.',
    bullets: [],
    hasConflict: false,
    styleLane: 'casual',
  }, 42);
  assert.match(out?.headline || '', /needs a tweak/i);
  assert.doesNotMatch(out?.summary || '', /balanced|cohesive/i);
}

// Layering praise cannot sit on a weak/mixed score (beige top ghost summary).
{
  const out = enforceLiveOutcomeContract({
    headline: 'Needs a tweak',
    summary: 'Worn over beige top, black hoodie adds depth to the outfit.',
    bullets: [],
    hasConflict: false,
    styleLane: 'casual',
    summaryArchetype: 'layerTop',
  }, 47);
  assert.doesNotMatch(out?.summary || '', /worn over|adds depth/i);
  assert.match(out?.summary || '', /partially aligned|different directions/i);
}

assert.match(softenOutcomeTone('Looking good', 'medium'), /Settling in/);
assert.match(softenOutcomeTone('Looking solid', 'medium'), /Settling in/);
assert.equal(softenOutcomeTone('Looking good', 'high'), 'Looking good');

{
  const out = enforceLiveOutcomeContract({
    headline: 'Sport-ready',
    summary: 'The palette stays consistent across grey t-shirt and black athletic shorts.',
    bullets: [],
    hasConflict: false,
    styleLane: 'athleisure',
  }, 78);
  assert.doesNotMatch(out?.headline || '', /sport-ready/i);
  assert.match(out?.headline || '', /nice balance/i);
}

console.log('liveOutcomeContract.test.ts: all passed');
