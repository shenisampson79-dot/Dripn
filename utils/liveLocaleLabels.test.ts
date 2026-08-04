/**
 * UK Live display polish.
 * Run: npx tsx utils/liveLocaleLabels.test.ts
 */
import assert from 'node:assert/strict';
import { LIVE_LOCALE, localizedShoeKind, polishUkLiveLabel } from './liveLocaleLabels';

assert.equal(LIVE_LOCALE, 'UK');
assert.equal(localizedShoeKind('sneakers'), 'trainers');
assert.equal(polishUkLiveLabel('White Pants'), 'White Trousers');
assert.equal(polishUkLiveLabel('Gray Sweatpants'), 'Grey Sweatpants');
assert.equal(polishUkLiveLabel('White and Red Sneakers'), 'White and Red Trainers');
assert.equal(polishUkLiveLabel('Gray Trousers'), 'Grey Trousers');
// Must not corrupt sweatpants
assert.equal(polishUkLiveLabel('Grey Sweatpants'), 'Grey Sweatpants');

console.log('liveLocaleLabels.test.ts: all passed');
