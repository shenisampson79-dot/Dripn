/**
 * Contract 1 client occasion inheritance + compile mirror.
 * Run: npx tsx scripts/verify-compile-refine-intent.ts
 */
import assert from 'assert';
import { compileRefineIntent } from '../utils/compileRefineIntent';
import { raiseOccasionForRefine } from '../utils/inferOutfitOccasionFromAsk';

const T6 = 'Keep the top, but change the bottoms and trainers. Give me a different version.';
const P1 = 'Keep the shoes, but change the top and bottoms';
const P2 = 'Swap the trainers.';

const t6 = compileRefineIntent(T6, { priorOccasion: 'gym' });
assert.deepEqual(t6.keep, ['top']);
assert.deepEqual([...t6.replace].sort(), ['bottom', 'footwear']);
assert.equal(t6.mode, 'partial_recompose');
assert.equal(t6.occasionSource, 'inherited');
assert.equal(t6.occasion, 'gym');
assert.equal(raiseOccasionForRefine('gym', T6), 'gym');

const p1 = compileRefineIntent(P1, { priorOccasion: 'gym' });
assert.equal(p1.mode, 'partial_recompose');
assert.deepEqual(p1.keep, ['footwear']);

const p2 = compileRefineIntent(P2, { priorOccasion: 'gym' });
assert.equal(p2.mode, 'slot_swap');
assert.deepEqual(p2.replace, ['footwear']);
assert.ok(p2.keep.includes('top') && p2.keep.includes('bottom'));

// Legacy inversion must not win on T6
assert.notEqual(t6.refine, 'keep_footwear_change_top_bottom');

// Occasion continuity — same-kind / another-option must not promote on "drinks"
const sameKind = compileRefineIntent(
  'Give me another option for the same kind of lunch or drinks.',
  { priorOccasion: 'smart_casual' },
);
assert.equal(sameKind.occasion, 'smart_casual');
assert.equal(sameKind.occasionSource, 'inherited');

const another = compileRefineIntent('Give me another option.', { priorOccasion: 'smart_casual' });
assert.equal(another.occasion, 'smart_casual');

const smarter = compileRefineIntent('Make it smarter — give me a different look.', {
  priorOccasion: 'smart_casual',
});
assert.equal(smarter.occasion, 'smart_casual');

const dinner = compileRefineIntent('Change it to dinner.', { priorOccasion: 'smart_casual' });
assert.equal(dinner.occasion, 'evening_out');
assert.equal(dinner.occasionSource, 'explicit_ask');

console.log(JSON.stringify({
  ok: true,
  T6: t6,
  P1: { keep: p1.keep, replace: p1.replace, mode: p1.mode },
  P2: { keep: p2.keep, replace: p2.replace, mode: p2.mode },
  occasionInherited: raiseOccasionForRefine('gym', T6),
  sameKind: sameKind.occasion,
  dinner: dinner.occasion,
}, null, 2));
