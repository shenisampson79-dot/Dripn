/**
 * Intent bus contracts for Today's Outfit remote taps.
 * Run: npx tsx scripts/verify-todays-outfit-intent-bus.ts
 */
import assert from 'node:assert/strict';

import {
  __resetTodaysOutfitIntentBusForTests,
  consumeTodaysOutfitIntent,
  emitTodaysOutfitIntent,
  peekTodaysOutfitIntent,
  subscribeTodaysOutfitIntent,
} from '../utils/todaysOutfitIntentBus';

console.log('=== Today\'s Outfit intent bus ===\n');

__resetTodaysOutfitIntentBusForTests();

let hits = 0;
const unsub = subscribeTodaysOutfitIntent(() => {
  hits += 1;
});
emitTodaysOutfitIntent('OPEN_TODAYS_OUTFIT');
assert.equal(hits, 1);
assert.equal(peekTodaysOutfitIntent(), 'OPEN_TODAYS_OUTFIT');

// Sticky: late subscriber still receives last intent
let late = 0;
const unsub2 = subscribeTodaysOutfitIntent(() => {
  late += 1;
});
assert.equal(late, 1, 'late subscriber must receive sticky intent');

consumeTodaysOutfitIntent();
assert.equal(peekTodaysOutfitIntent(), null);

let afterConsume = 0;
subscribeTodaysOutfitIntent(() => {
  afterConsume += 1;
});
assert.equal(afterConsume, 0, 'no sticky after consume');

unsub();
unsub2();
__resetTodaysOutfitIntentBusForTests();

console.log('All intent-bus checks passed.\n');
console.log('  ✓ emit delivers to listeners');
console.log('  ✓ sticky last-intent for cold start');
console.log('  ✓ consume clears sticky\n');
