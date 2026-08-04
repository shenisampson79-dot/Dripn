/**
 * Live HUD summary packer — clause packing under character budget.
 */
import assert from 'node:assert/strict';
import { cutAtWordBoundary, packSummary, shortenClauseTokens } from './packSummary';

{
  const out = packSummary([
    'White tee and beige trousers work well together',
    'Black trainers ground the look',
  ], 120);
  assert.match(out, /trainers/i);
  assert.ok(out.length <= 120);
}

{
  const out = packSummary([
    'White linen shirt and beige pleated trousers work well together',
    'Blue necktie finishes the look',
    'White and red trainers ground the look',
  ], 85);
  assert.ok(out.length <= 85);
  assert.match(out, /shirt|trousers/i);
}

{
  const shortened = shortenClauseTokens('White linen pleated trousers');
  assert.ok(!/\blinen\b/i.test(shortened));
}

{
  const cut = cutAtWordBoundary('White shirt and beige trousers work well together', 30);
  assert.ok(cut.length <= 30);
  assert.ok(!/\s$/.test(cut));
}

console.log('packSummary.test.ts: ok');
