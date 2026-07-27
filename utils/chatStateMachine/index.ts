/**
 * Chat State Machine — deterministic Stylist Chat invariants.
 *
 * Non-negotiable:
 * - Re-enter always lands at latest (LOCKED_TO_BOTTOM)
 * - Programmatic scroll never clears stick
 * - Intent MULTI_LOOK requires ≥2 looks (enforced server-side; client mirrors)
 */

export type ChatPhase =
  | 'INIT'
  | 'LOADING_HISTORY'
  | 'READY'
  | 'GENERATING'
  | 'RENDERING'
  | 'SETTLED'
  | 'ERROR';

export type ScrollState = 'LOCKED_TO_BOTTOM' | 'USER_SCROLLING';

export type IntentMode = 'SINGLE_LOOK' | 'MULTI_LOOK' | 'PAID_MULTI_DELIVERABLE';

export type ChatMachineSnapshot = {
  phase: ChatPhase;
  scroll: ScrollState;
  intentMode: IntentMode;
  programmatic: boolean;
  messageCount: number;
};

export const CHAT_SCROLL_END_OFFSET = 1e9;

/** Keywords that force MULTI_LOOK (override SDOM + casual monetisation). */
export const MULTI_LOOK_KEYWORDS = [
  'ideas',
  'suggestions',
  'brainstorm',
  'options',
  'a few looks',
  'a few outfits',
  'multiple outfits',
  'couple outfits',
  'couple of outfits',
  'some looks',
  'some options',
  'some ideas',
  'give me a few',
  'throw me some',
  'hit me with',
  'inspo',
  'inspiration',
  'looks for',
  'outfit ideas',
  'outfit options',
] as const;

export function createChatMachine(initial?: Partial<ChatMachineSnapshot>): ChatMachineSnapshot {
  return {
    phase: 'INIT',
    scroll: 'LOCKED_TO_BOTTOM',
    intentMode: 'SINGLE_LOOK',
    programmatic: false,
    messageCount: 0,
    ...initial,
  };
}

export function transitionPhase(
  state: ChatMachineSnapshot,
  next: ChatPhase,
): ChatMachineSnapshot {
  const out: ChatMachineSnapshot = { ...state, phase: next };

  // Entry invariants
  if (next === 'READY' || next === 'LOADING_HISTORY' || next === 'RENDERING' || next === 'SETTLED') {
    if (state.scroll !== 'USER_SCROLLING' || next !== 'SETTLED') {
      // System owns scroll until user explicitly scrolls while SETTLED
      if (next !== 'SETTLED' || state.scroll === 'LOCKED_TO_BOTTOM') {
        out.scroll = 'LOCKED_TO_BOTTOM';
      }
    }
  }
  if (next === 'READY' || next === 'GENERATING' || next === 'RENDERING') {
    out.scroll = 'LOCKED_TO_BOTTOM';
  }
  if (next === 'SETTLED' && state.scroll !== 'USER_SCROLLING') {
    out.scroll = 'LOCKED_TO_BOTTOM';
  }
  return out;
}

/** Focus / re-entry: wipe prior scroll memory — always lock to bottom. */
export function onChatFocus(state: ChatMachineSnapshot): ChatMachineSnapshot {
  return {
    ...state,
    scroll: 'LOCKED_TO_BOTTOM',
    programmatic: true,
  };
}

export function beginProgrammaticScroll(state: ChatMachineSnapshot): ChatMachineSnapshot {
  return { ...state, programmatic: true, scroll: 'LOCKED_TO_BOTTOM' };
}

export function endProgrammaticScroll(state: ChatMachineSnapshot): ChatMachineSnapshot {
  return { ...state, programmatic: false };
}

/**
 * User scroll handler contract.
 * Programmatic frames must NEVER update USER_SCROLLING / unlock.
 */
export function onUserScrollEvent(
  state: ChatMachineSnapshot,
  nearBottom: boolean,
): ChatMachineSnapshot {
  if (state.programmatic) {
    return { ...state, scroll: 'LOCKED_TO_BOTTOM' };
  }
  // While generating/rendering, system owns scroll
  if (state.phase === 'GENERATING' || state.phase === 'RENDERING' || state.phase === 'LOADING_HISTORY') {
    return { ...state, scroll: 'LOCKED_TO_BOTTOM' };
  }
  return {
    ...state,
    scroll: nearBottom ? 'LOCKED_TO_BOTTOM' : 'USER_SCROLLING',
  };
}

/** Whether the list must jump to end now. */
export function mustScrollToBottom(state: ChatMachineSnapshot): boolean {
  if (state.scroll === 'LOCKED_TO_BOTTOM') return true;
  if (state.phase === 'GENERATING' || state.phase === 'RENDERING' || state.phase === 'LOADING_HISTORY') {
    return true;
  }
  return false;
}

export function computeNearBottom(params: {
  contentOffsetY: number;
  layoutHeight: number;
  contentHeight: number;
  threshold?: number;
}): boolean {
  const threshold = params.threshold ?? 140;
  return (
    params.contentOffsetY + params.layoutHeight
    >= params.contentHeight - threshold
  );
}

/**
 * Reality invariant: after focus settle, scroll must be locked to bottom.
 */
export function assertScrollContract(state: ChatMachineSnapshot): void {
  if (state.phase === 'SETTLED' || state.phase === 'READY') {
    // After re-entry we always force LOCKED; USER_SCROLLING only after user gesture
    if (state.programmatic && state.scroll !== 'LOCKED_TO_BOTTOM') {
      throw new Error('CHAT_SCROLL_CONTRACT: programmatic frame not locked to bottom');
    }
  }
}

/**
 * Re-entry simulation used by verify — leave mid-thread then focus must lock.
 */
export function simulateReentryFromMidThread(state: ChatMachineSnapshot): ChatMachineSnapshot {
  const mid: ChatMachineSnapshot = {
    ...state,
    phase: 'SETTLED',
    scroll: 'USER_SCROLLING',
    programmatic: false,
  };
  const focused = onChatFocus(mid);
  const settled = transitionPhase(focused, 'SETTLED');
  assertScrollContract(settled);
  if (settled.scroll !== 'LOCKED_TO_BOTTOM') {
    throw new Error('CHAT_SCROLL_CONTRACT: re-entry did not lock to bottom');
  }
  if (!mustScrollToBottom(settled)) {
    throw new Error('CHAT_SCROLL_CONTRACT: re-entry mustScrollToBottom false');
  }
  return settled;
}

export function mentionsTripOrDuration(text: string): boolean {
  return /\b(trip|holiday|vacation|week|days?\s+of|pack(?:ing)?|capsule|14[\s-]?day)\b/i.test(text);
}

/**
 * Intent hierarchy (highest wins):
 * 1. Explicit multi-idea keywords → MULTI_LOOK
 * 2. Paid-scale trip/wardrobe plans → PAID_MULTI_DELIVERABLE
 * 3. Default → SINGLE_LOOK
 */
export function classifyChatIntent(input: string): IntentMode {
  const text = String(input || '').toLowerCase();
  if (!text.trim()) return 'SINGLE_LOOK';

  const paidScale =
    /\b(from my (wardrobe|closet)|what i own|pieces i own)\b/i.test(text)
    || /\b([4-9]|[1-9]\d+)\s+(?:complete\s+)?(?:outfit|looks?|ideas?)\b/i.test(text)
    || (mentionsTripOrDuration(text) && /\boutfits?\b/i.test(text));

  const multiKeyword = MULTI_LOOK_KEYWORDS.some((k) => text.includes(k));

  // Explicit ideas/options in casual chat beat monetisation collapse
  if (multiKeyword && !paidScale) return 'MULTI_LOOK';
  if (paidScale) return 'PAID_MULTI_DELIVERABLE';
  if (multiKeyword) return 'MULTI_LOOK';
  if (mentionsTripOrDuration(text) && /\b(looks?|outfits?|ideas?)\b/i.test(text)) {
    return 'PAID_MULTI_DELIVERABLE';
  }
  return 'SINGLE_LOOK';
}

/** Count Look 1 / Outfit 1 / Option 1 style blocks. */
export function countLooks(text: string): number {
  const t = String(text || '');
  if (!t.trim()) return 0;
  const patterns = [
    /(?:^|\n)\s*(?:look|outfit|option|idea)\s*#?\s*\d+/gi,
    /(?:^|\n)\s*\*\*\s*(?:look|outfit|option|idea)\s*#?\s*\d+/gi,
    /(?:^|\n)\s*\d+[\.)]\s+(?:[A-Z*]|\*\*)/g,
  ];
  let max = 0;
  for (const re of patterns) {
    const n = (t.match(re) || []).length;
    if (n > max) max = n;
  }
  // Dual "Wear this" blocks separated by blank lines count as 2
  const wearBlocks = (t.match(/(?:^|\n)\s*wear this\s*[:—-]/gi) || []).length;
  if (wearBlocks > max) max = wearBlocks;
  return max;
}

export function assertMultiLookOutput(userMessage: string, assistantText: string): void {
  const mode = classifyChatIntent(userMessage);
  if (mode !== 'MULTI_LOOK') return;
  const looks = countLooks(assistantText);
  if (looks < 2) {
    throw new Error(`CHAT_INTENT_CONTRACT: MULTI_LOOK requires ≥2 looks, got ${looks}`);
  }
}

export default {
  createChatMachine,
  transitionPhase,
  onChatFocus,
  beginProgrammaticScroll,
  endProgrammaticScroll,
  onUserScrollEvent,
  mustScrollToBottom,
  computeNearBottom,
  assertScrollContract,
  simulateReentryFromMidThread,
  classifyChatIntent,
  countLooks,
  assertMultiLookOutput,
  CHAT_SCROLL_END_OFFSET,
  MULTI_LOOK_KEYWORDS,
};
