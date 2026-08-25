/**
 * Stylist Chat scroll stick ownership — bounce/yank resistance.
 * Run: npx tsx scripts/verify-stylist-chat-scroll.ts
 */
import assert from 'node:assert/strict';
import {
  acquireStickOwnership,
  beginProgrammaticScroll,
  createChatMachine,
  CHAT_SCROLL_END_OFFSET,
  computeNearBottom,
  endProgrammaticScroll,
  mustScrollToBottom,
  onChatFocus,
  onUserScrollEvent,
  releaseStickForUserIntent,
  shouldAutoStickOnContentChange,
  simulateReentryFromMidThread,
  transitionPhase,
} from '../utils/chatStateMachine';
import {
  beginStickPulse,
  cancelStickPulse,
  createStickPulseController,
  isStickPulseActive,
} from '../utils/stylistChatScroll';

// --- Legacy: re-entry + programmatic unlock immunity ---
{
  const base = createChatMachine({ phase: 'SETTLED', scroll: 'USER_SCROLLING', programmatic: false });
  const reentered = simulateReentryFromMidThread(base);
  assert.equal(reentered.scroll, 'LOCKED_TO_BOTTOM');
  assert.equal(mustScrollToBottom(reentered), true);

  let s = createChatMachine({ phase: 'READY' });
  s = onChatFocus(s);
  s = transitionPhase(s, 'RENDERING');
  s = onUserScrollEvent(s, false); // programmatic frames still ignore spurious unlock
  assert.equal(s.scroll, 'LOCKED_TO_BOTTOM');
}

assert.equal(
  computeNearBottom({ contentOffsetY: 900, layoutHeight: 700, contentHeight: 1600 }),
  true,
);
assert.equal(
  computeNearBottom({ contentOffsetY: 100, layoutHeight: 700, contentHeight: 1600 }),
  false,
);
assert.ok(CHAT_SCROLL_END_OFFSET > 1e6, 'end offset must overshoot content');

// --- 1. Assistant response while user stays at bottom → remains pinned ---
{
  let s = createChatMachine({ phase: 'SETTLED', scroll: 'LOCKED_TO_BOTTOM' });
  s = transitionPhase(s, 'GENERATING');
  assert.equal(s.scroll, 'LOCKED_TO_BOTTOM');
  s = transitionPhase(s, 'RENDERING');
  assert.equal(mustScrollToBottom(s), true);
  assert.equal(shouldAutoStickOnContentChange(s), true);
  s = transitionPhase(s, 'SETTLED');
  assert.equal(mustScrollToBottom(s), true);
}

// --- 2. User drags upward during retry window → retries stop / no yank-back ---
{
  let pulse = createStickPulseController();
  let s = createChatMachine({ phase: 'RENDERING', scroll: 'LOCKED_TO_BOTTOM' });
  s = beginProgrammaticScroll(s);
  const started = beginStickPulse(pulse);
  pulse = started.ctrl;
  const gen = started.generation;
  assert.equal(isStickPulseActive(pulse, gen), true);

  // Intentional drag
  pulse = cancelStickPulse(pulse);
  s = releaseStickForUserIntent(s);
  assert.equal(s.scroll, 'USER_SCROLLING');
  assert.equal(s.programmatic, false);
  assert.equal(isStickPulseActive(pulse, gen), false, 'pending retries must be invalidated');
  assert.equal(mustScrollToBottom(s), false);
  // Simulated retry after cancel
  assert.equal(isStickPulseActive(pulse, gen), false);
}

// --- 3. Content-size growth after user scroll-away → does not reacquire bottom lock ---
{
  let s = createChatMachine({ phase: 'GENERATING', scroll: 'LOCKED_TO_BOTTOM' });
  s = releaseStickForUserIntent(s);
  assert.equal(s.scroll, 'USER_SCROLLING');
  // Typing / content-size must not steal ownership
  s = transitionPhase(s, 'RENDERING');
  assert.equal(s.scroll, 'USER_SCROLLING', 'phase change must not re-lock after user scroll-away');
  assert.equal(shouldAutoStickOnContentChange(s), false);
  assert.equal(mustScrollToBottom(s), false);
}

// --- 4. User returns near bottom → normal stick behavior can resume ---
{
  let s = createChatMachine({ phase: 'SETTLED', scroll: 'USER_SCROLLING', programmatic: false });
  s = onUserScrollEvent(s, true);
  assert.equal(s.scroll, 'LOCKED_TO_BOTTOM');
  assert.equal(mustScrollToBottom(s), true);
  assert.equal(shouldAutoStickOnContentChange(s), true);
}

// --- 5. Sending a new message → intentional programmatic scroll still works ---
{
  let s = createChatMachine({ phase: 'SETTLED', scroll: 'USER_SCROLLING', programmatic: false });
  s = acquireStickOwnership(s);
  assert.equal(s.scroll, 'LOCKED_TO_BOTTOM');
  assert.equal(s.programmatic, true);
  assert.equal(mustScrollToBottom(s), true);
  let pulse = createStickPulseController();
  const started = beginStickPulse(pulse);
  pulse = started.ctrl;
  assert.equal(isStickPulseActive(pulse, started.generation), true);
  s = endProgrammaticScroll(s);
  assert.equal(mustScrollToBottom(s), true);
}

// Focus still overrides mid-thread (hydration / tab return)
{
  let s = createChatMachine({ phase: 'SETTLED', scroll: 'USER_SCROLLING' });
  s = onChatFocus(s);
  assert.equal(s.scroll, 'LOCKED_TO_BOTTOM');
  assert.equal(mustScrollToBottom(s), true);
}

console.log('verify-stylist-chat-scroll: CSM stick-yield + re-entry invariants passed');
