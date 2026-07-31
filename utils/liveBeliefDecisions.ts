/** Shared belief decision log types — no imports from belief/UI (avoids cycles). */

export type BeliefDecisionType = 'reinforce' | 'reject' | 'hold' | 'update' | 'ignore';

export type BeliefDecision = {
  time: number;
  type: BeliefDecisionType;
  message: string;
  reason: string;
  slot?: 'top' | 'bottom' | 'footwear' | 'frame';
};

export const MAX_DECISIONS = 20;

export function appendDecision(
  log: BeliefDecision[] | undefined,
  entry: Omit<BeliefDecision, 'time'> & { time?: number },
): void {
  if (!log) return;
  log.push({
    time: entry.time ?? Date.now(),
    type: entry.type,
    message: entry.message,
    reason: entry.reason,
    slot: entry.slot,
  });
  while (log.length > MAX_DECISIONS) log.shift();
}

export function pushDecision(
  log: BeliefDecision[],
  entry: Omit<BeliefDecision, 'time'> & { time?: number },
): BeliefDecision[] {
  const next = [...log];
  appendDecision(next, entry);
  return next;
}
