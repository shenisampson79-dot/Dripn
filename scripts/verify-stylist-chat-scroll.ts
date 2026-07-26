/**
 * Stylist Chat scroll stick lock — layout churn must not clear stick-to-latest.
 * Run: npx tsx scripts/verify-stylist-chat-scroll.ts
 */
import assert from 'node:assert/strict';
import {
  CHAT_SCROLL_END_OFFSET,
  computeNearBottom,
  nextProgrammaticScrollLock,
  shouldIgnoreScrollNearBottomUpdate,
} from '../utils/stylistChatScroll';

const now = 1_000_000;
const lockUntil = nextProgrammaticScrollLock(now, 1800);
assert.equal(lockUntil, now + 1800);
assert.equal(shouldIgnoreScrollNearBottomUpdate(now + 100, lockUntil), true);
assert.equal(shouldIgnoreScrollNearBottomUpdate(now + 2000, lockUntil), false);

assert.equal(
  computeNearBottom({ contentOffsetY: 900, layoutHeight: 700, contentHeight: 1600 }),
  true,
);
assert.equal(
  computeNearBottom({ contentOffsetY: 100, layoutHeight: 700, contentHeight: 1600 }),
  false,
);

assert.ok(CHAT_SCROLL_END_OFFSET > 1e6, 'end offset must overshoot content');

console.log('verify-stylist-chat-scroll: stick lock + near-bottom passed');
