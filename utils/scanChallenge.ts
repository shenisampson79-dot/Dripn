/**
 * Live “Scan 10 in 30s” challenge — copy + light heuristics.
 */

export const SCAN_CHALLENGE_TARGET = 10;
export const SCAN_CHALLENGE_SECONDS = 30;

const MICRO = ['Nice', 'Keep going', 'Fast', 'Clean', 'Good one'] as const;

export function challengeMicroFeedback(index: number): string {
  return MICRO[Math.abs(index) % MICRO.length] || 'Nice';
}

export function challengeMilestoneCopy(count: number): string | null {
  if (count === 3) return 'You’re flying';
  if (count === 5) return 'Halfway';
  if (count === 8) return 'Almost there';
  return null;
}

/** Rough, optimistic combo estimate for post-challenge conversion. */
export function estimateStylableOutfits(itemCount: number): number {
  const n = Math.max(0, Math.floor(itemCount));
  if (n < 3) return Math.max(1, n);
  if (n < 8) return n + 2;
  return Math.min(48, Math.round(n * 1.15));
}

export function challengeTimerColor(secondsLeft: number): string {
  if (secondsLeft <= 5) return '#FF453A';
  if (secondsLeft <= 10) return '#FF9F0A';
  return '#FFFFFF';
}
