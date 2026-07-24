/**
 * Smoke: season/occasion chip normalization + defaults for single upload autofill.
 */
import assert from 'assert';
import {
  normalizeSeasonChips,
  normalizeOccasionChips,
  resolveSeasonChips,
  resolveOccasionChips,
  inferDefaultOccasions,
} from '../utils/wardrobeSeasonOccasion.ts';

assert.deepStrictEqual(normalizeSeasonChips(['fall', 'Summer']), ['autumn', 'summer']);
assert.deepStrictEqual(normalizeSeasonChips(['all season']), ['all-season']);
assert.deepStrictEqual(normalizeOccasionChips(['gym', 'office', 'evening']), ['workout', 'work', 'date-night']);

assert.deepStrictEqual(resolveSeasonChips([], { type: 't-shirt' }), ['all-season']);
assert.ok(resolveOccasionChips([], { category: 'activewear_tops' }).includes('workout'));
assert.ok(inferDefaultOccasions({ type: 'blazer' }).includes('formal'));
assert.ok(resolveSeasonChips(['winter'], {}).includes('winter'));
assert.ok(resolveOccasionChips(null, { type: 'jersey' }).includes('workout'));

console.log('verify-season-occasion: OK');
