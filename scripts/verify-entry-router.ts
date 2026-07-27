/**
 * Unified Entry Router — priority, queue, boot gate, reset plan.
 *
 * Run: npx tsx scripts/verify-entry-router.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertNotificationBeatsDefaultRedirect,
  buildTodaysOutfitResetState,
  canResolveIntents,
  enqueueIntentPure,
  flushIntentsPure,
  getHighestPriorityIntent,
  parseDeepLinkUrl,
  parseNotificationData,
  priorityOf,
} from '../utils/appEntryRouter/types';

console.log('=== Unified Entry Router ===\n');

assertNotificationBeatsDefaultRedirect();

// Priority
assert.ok(priorityOf({ type: 'OPEN_TODAYS_OUTFIT' }) > priorityOf({ type: 'OPEN_STYLIST' }));
assert.ok(priorityOf({ type: 'OPEN_CHAT' }) > priorityOf({ type: 'OPEN_OUTFIT' }));

let queue = enqueueIntentPure([], { type: 'OPEN_STYLIST' });
queue = enqueueIntentPure(queue, { type: 'OPEN_TODAYS_OUTFIT' });
queue = enqueueIntentPure(queue, { type: 'OPEN_CHAT' });
const winner = getHighestPriorityIntent(queue);
assert.equal(winner.type, 'OPEN_TODAYS_OUTFIT', 'highest priority intent wins');

const flushed = flushIntentsPure(queue);
assert.equal(flushed.intent.type, 'OPEN_TODAYS_OUTFIT');
assert.equal(flushed.remaining.length, 0, 'queue cleared after flush');

// Notification parse
assert.equal(
  parseNotificationData({ type: 'todays_outfit' }).type,
  'OPEN_TODAYS_OUTFIT',
);
assert.equal(parseNotificationData({ type: 'chat_reply', threadId: 't1' }).type, 'OPEN_CHAT');
assert.equal(parseNotificationData({ type: 'unknown' }).type, 'NONE');

// Deep link parse
assert.equal(parseDeepLinkUrl('dripn://today').type, 'OPEN_TODAYS_OUTFIT');
assert.equal(parseDeepLinkUrl('https://app.dripn.com/todays-outfit').type, 'OPEN_TODAYS_OUTFIT');
assert.equal(parseDeepLinkUrl('dripn://chat').type, 'OPEN_CHAT');
assert.equal(parseDeepLinkUrl('dripn://invite/abc').type, 'NONE');

// Boot gate
assert.equal(
  canResolveIntents({ bootState: 'BOOTING', navigationReady: true }),
  false,
  'must not resolve while booting',
);
assert.equal(
  canResolveIntents({ bootState: 'STABLE', navigationReady: false }),
  false,
  'must not resolve before nav ready',
);
assert.equal(
  canResolveIntents({ bootState: 'STABLE', navigationReady: true }),
  true,
);

// Reset plan includes openToday + sibling tabs
const reset = buildTodaysOutfitResetState() as any;
assert.equal(reset.routes[0].name, 'StylistTab');
assert.equal(reset.routes[0].state.routes[0].name, 'StylistHub');
assert.equal(reset.routes[0].state.routes[0].params.openToday, true);
assert.ok(reset.routes.some((r: any) => r.name === 'WardrobeTab'));

// Source wiring — no direct navigate from notification install / App nudge
const notifySrc = readFileSync(
  resolve(__dirname, '../services/todaysOutfitLocalNotify.ts'),
  'utf8',
);
assert.ok(notifySrc.includes('onOpenIntent'));
assert.ok(!notifySrc.includes('navigateToStylistHub'));
assert.ok(!/opts\?\.navigateToStylistHub/.test(notifySrc));

const appSrc = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
assert.ok(appSrc.includes('markAppStable'));
assert.ok(appSrc.includes('flushIntents'));
assert.ok(appSrc.includes('enqueueIntent'));
assert.ok(!appSrc.includes('navigateToStylistHub'));
assert.ok(!appSrc.includes('todaysOutfitNudgedRef'));

const cardSrc = readFileSync(
  resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
  'utf8',
);
assert.ok(cardSrc.includes('openToday'));
assert.ok(
  !cardSrc.includes("rootNav.navigate('StylistTab'"),
  'card must not navigate — IRG owns navigation',
);

const hubSrc = readFileSync(
  resolve(__dirname, '../screens/StylistHubScreen.tsx'),
  'utf8',
);
assert.ok(hubSrc.includes('openToday'));
assert.ok(hubSrc.includes('route.params'));

const routerSrc = readFileSync(
  resolve(__dirname, '../utils/appEntryRouter/index.ts'),
  'utf8',
);
assert.ok(routerSrc.includes('CommonActions.reset'));
assert.ok(routerSrc.includes('buildTodaysOutfitResetState'));

console.log('All entry-router checks passed.\n');
console.log('  ✓ priority: today beats stylist/chat');
console.log('  ✓ notification + deep-link normalize');
console.log('  ✓ boot gate blocks early resolve');
console.log('  ✓ reset plan opens StylistHub with openToday');
console.log('  ✓ handlers enqueue only (no multi-writer navigate)\n');
