/**
 * P1 — explicit single-look chat asks must classify for wardrobe visual path.
 */
import assert from 'node:assert/strict';

import { isOutfitTaskAsk, isSingleLookWardrobeCreateAsk } from '../utils/outfitClarifyContinuity';

const PHRASE_MATRIX = [
  'What should I wear to F1 Arcade on Friday?',
  'What I should I wear to F1 Arcade on Friday?',
  'What can I wear to F1 Arcade on Friday?',
  'What should I wear tonight?',
  'What should I wear tomorrow?',
  'Help me choose an outfit for Friday.',
  'Give me an outfit for dinner tonight.',
] as const;

const results: Record<string, 'PASS' | 'FAIL'> = {};

for (const phrase of PHRASE_MATRIX) {
  const ok = isSingleLookWardrobeCreateAsk(phrase) && isOutfitTaskAsk(phrase);
  results[phrase] = ok ? 'PASS' : 'FAIL';
  assert.ok(ok, `expected visual outfit path: ${phrase}`);
}

// Multi-day must stay off the single-look visual path.
assert.equal(
  isSingleLookWardrobeCreateAsk("I'm away for three days, create an outfit for each day"),
  false,
);

console.log('verify-chat-outfit-visual-phrase-matrix — all passed');
for (const [phrase, status] of Object.entries(results)) {
  console.log(`${status}  ${phrase}`);
}
