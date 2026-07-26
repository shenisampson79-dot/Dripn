/**
 * Stylist Chat scroll stickiness helpers — pure, for verify + screen.
 * Rule: re-entering chat must land on the latest message; layout churn
 * during image/history hydrate must not clear stick-to-latest.
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
