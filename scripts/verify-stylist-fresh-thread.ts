/**
 * Deterministic gate for Refresh-thread integrity (no device required).
 * Run: npx tsx scripts/verify-stylist-fresh-thread.ts
 */
import assert from 'assert';
import {
  buildStylistChatClearedTombstone,
  parseStylistChatClearedTombstone,
  shouldSuppressServerChatHydrate,
} from '../utils/stylistFreshThread';

const tomb = buildStylistChatClearedTombstone('Ivy', 1_700_000_000_000);
assert.equal(tomb.stylistId, 'ivy');
assert.equal(shouldSuppressServerChatHydrate(tomb, 'ivy'), true);
assert.equal(shouldSuppressServerChatHydrate(tomb, 'ruby'), false);
assert.equal(shouldSuppressServerChatHydrate(null, 'ivy'), false);

const roundTrip = parseStylistChatClearedTombstone(JSON.stringify(tomb));
assert.deepEqual(roundTrip, tomb);
assert.equal(parseStylistChatClearedTombstone('not-json'), null);
assert.equal(parseStylistChatClearedTombstone('{"stylistId":""}'), null);

console.log(JSON.stringify({
  ok: true,
  acceptance:
    'old messages → Refresh thread → empty → tab away → return → still empty → force-close/reopen → still empty (requires device + successful DELETE)',
  unit: 'tombstone suppresses server hydrate for matching stylist only',
}, null, 2));
