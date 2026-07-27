/**
 * Prove notification → modal open intent beats async load races.
 *
 * Run: npx tsx scripts/verify-notification-open-race.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  OPEN_PENDING_TTL_MS,
  TODAYS_OUTFIT_NOTIF_TYPE,
  isOpenPendingExpired,
  parseOpenPending,
  reconcileModalVisibilityAfterLoad,
  resolveOpenPendingConflict,
  serializeOpenPending,
  shouldForceOpenFromIntent,
  type OpenPendingIntent,
} from '../utils/todaysOutfitOpenIntent';
import { isWithinTodaysOutfitPopupWindow } from '../utils/todaysOutfitPrefs';

console.log('=== Notification open-intent race ===\n');

const now = Date.now();
const fresh: OpenPendingIntent = {
  type: TODAYS_OUTFIT_NOTIF_TYPE,
  armedAt: now,
  source: 'tap',
};
const stale: OpenPendingIntent = {
  type: TODAYS_OUTFIT_NOTIF_TYPE,
  armedAt: now - OPEN_PENDING_TTL_MS - 1,
  source: 'cold_start',
};

// --- Intent TTL ---
assert.equal(isOpenPendingExpired(fresh, now), false);
assert.equal(isOpenPendingExpired(stale, now), true);
assert.equal(shouldForceOpenFromIntent(stale, { now }), false, 'stale intent must not force open');

// --- Outside appearance window: intent still wins ---
const beforeAppear = new Date('2026-07-15T06:30:00.000Z'); // 07:30 BST, appearAt=8 → outside
const prefs = { enabled: true, appearAtHour: 8, preferredOccasion: 'auto' as const };
assert.equal(isWithinTodaysOutfitPopupWindow(prefs, beforeAppear), false);
const loadWouldShow = isWithinTodaysOutfitPopupWindow(prefs, beforeAppear); // false
const afterSlowLoad = reconcileModalVisibilityAfterLoad({
  loadWouldShow,
  intent: fresh,
  now,
});
assert.equal(afterSlowLoad.visible, true, 'tap → slow load outside window → modal STILL opens');
assert.equal(afterSlowLoad.consumedIntent, true);

// --- Tap during load (intent armed mid-flight) ---
const midFlight = reconcileModalVisibilityAfterLoad({
  loadWouldShow: false,
  intent: { type: TODAYS_OUTFIT_NOTIF_TYPE, armedAt: now + 50, source: 'tap' },
  now: now + 100,
});
assert.equal(midFlight.visible, true, 'tap during load → stays open');

// --- Cold start with fresh intent ---
const cold = reconcileModalVisibilityAfterLoad({
  loadWouldShow: false,
  intent: { type: TODAYS_OUTFIT_NOTIF_TYPE, armedAt: now, source: 'cold_start' },
  now,
});
assert.equal(cold.visible, true, 'cold start → opens correctly');

// --- Stale cold start must NOT reopen ---
const staleCold = reconcileModalVisibilityAfterLoad({
  loadWouldShow: false,
  intent: stale,
  now,
});
assert.equal(staleCold.visible, false, 'stale intent after leave/return → no reopen');

// --- Duplicate arm dedup (same type, within 2s) ---
const first = { type: TODAYS_OUTFIT_NOTIF_TYPE, armedAt: now, source: 'tap' as const };
const double = {
  type: TODAYS_OUTFIT_NOTIF_TYPE,
  armedAt: now + 500,
  source: 'delivery' as const,
};
const deduped = resolveOpenPendingConflict(first, double, now + 500);
assert.equal(deduped.armedAt, first.armedAt, 'double tap/receive within dedup window keeps first');

// --- Multi-notification: todays_outfit beats style_of_the_day ---
const styleIntent: OpenPendingIntent = {
  type: 'style_of_the_day',
  armedAt: now + 10,
  source: 'tap',
};
const outfitWins = resolveOpenPendingConflict(styleIntent, fresh, now);
assert.equal(outfitWins.type, TODAYS_OUTFIT_NOTIF_TYPE, 'todays_outfit priority wins');

const styleCannotOverride = resolveOpenPendingConflict(fresh, styleIntent, now);
assert.equal(
  styleCannotOverride.type,
  TODAYS_OUTFIT_NOTIF_TYPE,
  'lower-priority notif cannot displace todays_outfit',
);

// --- Already-open: shouldForceOpenFromIntent false (no load churn) ---
assert.equal(
  shouldForceOpenFromIntent(fresh, { now, modalAlreadyVisible: true }),
  false,
  'already open → ignore duplicate force-open',
);

// --- Legacy '1' flag still parses ---
const legacy = parseOpenPending('1');
assert.ok(legacy && legacy.type === TODAYS_OUTFIT_NOTIF_TYPE);
assert.ok(serializeOpenPending(fresh).includes(TODAYS_OUTFIT_NOTIF_TYPE));

// --- Source wiring still present ---
const notifySrc = readFileSync(
  resolve(__dirname, '../services/todaysOutfitLocalNotify.ts'),
  'utf8',
);
assert.ok(notifySrc.includes('resolveOpenPendingConflict'));
assert.ok(notifySrc.includes('isOpenPendingExpired'));
assert.ok(notifySrc.includes('OPEN_PENDING_TTL') || notifySrc.includes('todaysOutfitOpenIntent'));

const cardSrc = readFileSync(
  resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
  'utf8',
);
assert.ok(cardSrc.includes('subscribeTodaysOutfitIntent'));
assert.ok(cardSrc.includes('loadOutfit'));
assert.ok(cardSrc.includes('openTodaysOutfit'));
assert.ok(!cardSrc.includes('forceOpen'));
assert.ok(!cardSrc.includes('peekTodaysOutfitOpenPending'));

const busSrc = readFileSync(
  resolve(__dirname, '../utils/todaysOutfitIntentBus.ts'),
  'utf8',
);
assert.ok(busSrc.includes('emitTodaysOutfitIntent'));
assert.ok(busSrc.includes('INTENT_TTL') || busSrc.includes('60_000'));

console.log('All notification open-race checks passed.\n');
console.log('  ✓ tap → slow load outside window → opens');
console.log('  ✓ tap during load → stays open');
console.log('  ✓ cold start → opens');
console.log('  ✓ stale intent expires');
console.log('  ✓ duplicate arm deduped');
console.log('  ✓ todays_outfit beats other notif types');
console.log('  ✓ card opens via intent bus → loadOutfit\n');
