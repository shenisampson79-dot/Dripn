/**
 * Unified Entry Router — priority, queue, boot gate, passive Today's Outfit.
 *
 * Run: npx tsx scripts/verify-entry-router.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertNotificationBeatsDefaultRedirect,
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

// Source wiring — Today's Outfit is emit + ensure, not stack reset
const notifySrc = readFileSync(
  resolve(__dirname, '../services/todaysOutfitLocalNotify.ts'),
  'utf8',
);
assert.ok(notifySrc.includes('onOpenIntent'));
assert.ok(!notifySrc.includes('navigateToStylistHub'));

const appSrc = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
assert.ok(appSrc.includes('emitTodaysOutfitIntent'));
assert.ok(appSrc.includes('ensureStylistHubVisible'));
assert.ok(appSrc.includes('markAppStable'));
assert.ok(appSrc.includes('flushIntents'));
assert.ok(!appSrc.includes('navigateToStylistHub'));
assert.ok(!appSrc.includes('todaysOutfitNudgedRef'));

const cardSrc = readFileSync(
  resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
  'utf8',
);
assert.ok(cardSrc.includes('subscribeTodaysOutfitIntent'));
assert.ok(cardSrc.includes('loadOutfit'));
assert.ok(
  !cardSrc.includes("rootNav.navigate('StylistTab'"),
  'card must not navigate — route ensure is passive',
);

const routerSrc = readFileSync(
  resolve(__dirname, '../utils/appEntryRouter/index.ts'),
  'utf8',
);
assert.ok(routerSrc.includes('emitTodaysOutfitIntent'));
assert.ok(routerSrc.includes('ensureStylistHubVisible'));
assert.ok(!routerSrc.includes('buildTodaysOutfitResetState'));

const busSrc = readFileSync(
  resolve(__dirname, '../utils/todaysOutfitIntentBus.ts'),
  'utf8',
);
assert.ok(busSrc.includes('emitTodaysOutfitIntent'));
assert.ok(busSrc.includes('subscribeTodaysOutfitIntent'));

console.log('All entry-router checks passed.\n');
console.log('  ✓ priority: today beats stylist/chat');
console.log('  ✓ notification + deep-link normalize');
console.log('  ✓ boot gate blocks early resolve');
console.log('  ✓ OPEN_TODAYS_OUTFIT → emit + ensure (no reset)');
console.log('  ✓ card owns loadOutfit via intent bus\n');
