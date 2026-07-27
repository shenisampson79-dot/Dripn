/**
 * Stylist Chat scroll stick lock — layout churn must not clear stick-to-latest.
 * Run: npx tsx scripts/verify-stylist-chat-scroll.ts
 */
import assert from 'node:assert/strict';
import {
  createChatMachine,
  CHAT_SCROLL_END_OFFSET,
  computeNearBottom,
  onChatFocus,
  onUserScrollEvent,
  simulateReentryFromMidThread,
  transitionPhase,
  mustScrollToBottom,
} from '../utils/chatStateMachine';

const base = createChatMachine({ phase: 'SETTLED', scroll: 'USER_SCROLLING', programmatic: false });
const reentered = simulateReentryFromMidThread(base);
assert.equal(reentered.scroll, 'LOCKED_TO_BOTTOM');
assert.equal(mustScrollToBottom(reentered), true);

let s = createChatMachine({ phase: 'READY' });
s = onChatFocus(s);
s = transitionPhase(s, 'RENDERING');
s = onUserScrollEvent(s, false); // programmatic/layout churn should NOT unlock
assert.equal(s.scroll, 'LOCKED_TO_BOTTOM');

assert.equal(
  computeNearBottom({ contentOffsetY: 900, layoutHeight: 700, contentHeight: 1600 }),
  true,
);
assert.equal(
  computeNearBottom({ contentOffsetY: 100, layoutHeight: 700, contentHeight: 1600 }),
  false,
);

assert.ok(CHAT_SCROLL_END_OFFSET > 1e6, 'end offset must overshoot content');

console.log('verify-stylist-chat-scroll: CSM re-entry + lock invariants passed');
