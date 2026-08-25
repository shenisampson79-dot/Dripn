/**
 * Stylist Chat scroll stickiness helpers — pure, for verify + screen.
 *
 * Stick ownership:
 * - Programmatic stick pulses schedule retries with a generation token.
 * - Intentional user drag bumps the generation and releases ownership so
 *   pending retries become no-ops (no mid-thread yank).
 */

export const PROGRAMMATIC_SCROLL_LOCK_MS = 1800;

export function shouldIgnoreScrollNearBottomUpdate(
  nowMs: number,
  lockUntilMs: number,
): boolean {
  return nowMs < lockUntilMs;
}

export function nextProgrammaticScrollLock(
  nowMs: number,
  lockMs: number = PROGRAMMATIC_SCROLL_LOCK_MS,
): number {
  return nowMs + lockMs;
}

/** FlatList offset jump that always lands past the last bubble. */
export const CHAT_SCROLL_END_OFFSET = 1e9;

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

/** Generation-token controller for cancellable scrollChatToEnd retries. */
export type StickPulseController = {
  generation: number;
};

export function createStickPulseController(
  initial: Partial<StickPulseController> = {},
): StickPulseController {
  return { generation: 0, ...initial };
}

/** Start a stick pulse; returns the generation that retries must match. */
export function beginStickPulse(ctrl: StickPulseController): {
  ctrl: StickPulseController;
  generation: number;
} {
  const generation = ctrl.generation + 1;
  return { ctrl: { generation }, generation };
}

/** User drag / scroll-away — invalidate all pending retries. */
export function cancelStickPulse(ctrl: StickPulseController): StickPulseController {
  return { generation: ctrl.generation + 1 };
}

export function isStickPulseActive(
  ctrl: StickPulseController,
  generation: number,
): boolean {
  return ctrl.generation === generation;
}
