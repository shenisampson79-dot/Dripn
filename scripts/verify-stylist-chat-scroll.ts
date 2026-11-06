/**
 * Stylist Chat scroll stick ownership — bounce/yank resistance.
 * Run: npx tsx scripts/verify-stylist-chat-scroll.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  clearScheduledTimeouts,
  createStickPulseController,
  FOCUS_REENTRY_SCROLL_DELAYS_MS,
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

// --- 6. Tab-return focus timers must be clearable before stale scroll fires ---
{
  const scheduled = FOCUS_REENTRY_SCROLL_DELAYS_MS.map((ms) =>
    setTimeout(() => {}, ms),
  );
  assert.equal(scheduled.length, 6);
  const cleared = clearScheduledTimeouts(scheduled);
  assert.equal(cleared.length, 0);

  let pulse = createStickPulseController();
  let s = createChatMachine({ phase: 'RENDERING', scroll: 'LOCKED_TO_BOTTOM' });
  const started = beginStickPulse(pulse);
  pulse = started.ctrl;
  const gen = started.generation;
  pulse = cancelStickPulse(pulse);
  s = releaseStickForUserIntent(s);
  assert.equal(s.scroll, 'USER_SCROLLING');
  assert.equal(isStickPulseActive(pulse, gen), false);
  // Simulated delayed focus timer after user drag — must not force scroll
  assert.equal(mustScrollToBottom(s), false);
}

// --- 7. Android measured stick offset (production helper from AIStylistScreen) ---
{
  const chatSrc = readFileSync(resolve(__dirname, '../screens/AIStylistScreen.tsx'), 'utf8');

  function extractNamedFunction(src: string, name: string): string {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} is present in AIStylistScreen`);
    const paramOpen = start + `function ${name}`.length;
    assert.equal(src[paramOpen], '(', `${name} has a parameter list`);
    let parenDepth = 0;
    let i = paramOpen;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') parenDepth += 1;
      else if (ch === ')') {
        parenDepth -= 1;
        if (parenDepth === 0) {
          i += 1;
          break;
        }
      }
    }
    assert.equal(parenDepth, 0, `${name} parameter list is closed`);
    while (i < src.length && src[i] !== '{') i += 1;
    const brace = i;
    assert.equal(src[brace], '{', `${name} has a body`);
    let depth = 0;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    assert.fail(`${name} is closed`);
  }

  function extractUseCallback(src: string, name: string): string {
    const needle = `const ${name} = useCallback(`;
    const start = src.indexOf(needle);
    assert.ok(start >= 0, `${name} is present in AIStylistScreen`);
    const arrow = src.indexOf('=>', start);
    assert.ok(arrow > start, `${name} is an arrow callback`);
    let i = src.indexOf('{', arrow);
    assert.ok(i >= 0, `${name} has a body`);
    let depth = 0;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    assert.fail(`${name} is closed`);
  }

  const helperSrc = extractNamedFunction(chatSrc, 'androidMeasuredStickOffset');
  const bodyOpen = helperSrc.indexOf('{');
  const helperBody = helperSrc.slice(bodyOpen + 1, helperSrc.lastIndexOf('}'));
  const androidMeasuredStickOffset = new Function(
    'contentHeight',
    'viewportHeight',
    helperBody,
  ) as (contentHeight: number, viewportHeight: number) => number | null;

  assert.equal(androidMeasuredStickOffset(1600, 700), 900);
  assert.equal(androidMeasuredStickOffset(500, 700), 0);
  assert.equal(androidMeasuredStickOffset(Number.NaN, 700), null);
  assert.equal(androidMeasuredStickOffset(1600, Number.NaN), null);
  assert.equal(androidMeasuredStickOffset(Number.POSITIVE_INFINITY, 700), null);
  assert.equal(androidMeasuredStickOffset(1600, Number.POSITIVE_INFINITY), null);
  assert.equal(androidMeasuredStickOffset(1600, 0), null);
  assert.equal(androidMeasuredStickOffset(1600, -1), null);
  assert.equal(androidMeasuredStickOffset(-10, 700), null);

  const stickSrc = extractUseCallback(chatSrc, 'scrollListToLatestOffset');
  const androidIf = stickSrc.indexOf("if (Platform.OS === 'android')");
  assert.ok(androidIf >= 0, 'scrollListToLatestOffset has an Android branch');
  let i = stickSrc.indexOf('{', androidIf);
  let depth = 0;
  let androidEnd = -1;
  for (; i < stickSrc.length; i++) {
    if (stickSrc[i] === '{') depth += 1;
    else if (stickSrc[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        androidEnd = i + 1;
        break;
      }
    }
  }
  assert.ok(androidEnd > androidIf, 'Android branch is closed');
  const androidBranch = stickSrc.slice(androidIf, androidEnd);
  const nonAndroidBranch = stickSrc.slice(androidEnd);
  assert.match(androidBranch, /androidMeasuredStickOffset\s*\(/);
  assert.match(androidBranch, /if \(offset == null\) return false/);
  assert.match(androidBranch, /scrollToOffset\(\{ offset, animated \}\)/);
  assert.doesNotMatch(
    androidBranch,
    /CHAT_SCROLL_END_OFFSET/,
    'Android scrollListToLatestOffset must not pass CHAT_SCROLL_END_OFFSET',
  );
  assert.match(
    nonAndroidBranch,
    /scrollToOffset\(\{ offset: CHAT_SCROLL_END_OFFSET, animated \}\)/,
    'non-Android branch retains iOS overshoot offset',
  );
}

console.log('verify-stylist-chat-scroll: CSM stick-yield + re-entry invariants passed');
console.log('verify-stylist-chat-scroll: Android measured-stick offset contract passed');
