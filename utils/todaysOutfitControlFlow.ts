/**
 * Today's Outfit control-flow primitives.
 * Loading must ALWAYS resolve; cancel must invalidate in-flight work.
 */

export const TODAYS_OUTFIT_GENERATE_TIMEOUT_MS = 40_000;

export class TodaysOutfitTimeoutError extends Error {
  constructor(message = 'timeout') {
    super(message);
    this.name = 'TodaysOutfitTimeoutError';
  }
}

/** Reject if promise does not settle within ms. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TodaysOutfitTimeoutError(`Timed out after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export type TodaysOutfitCardState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Pure cancel: bump generation so in-flight work is ignored,
 * and return the post-cancel card state.
 */
export function cancelOpenSession(args: {
  requestId: number;
  hasReadyOutfit: boolean;
}): { nextRequestId: number; nextCardState: TodaysOutfitCardState } {
  return {
    nextRequestId: args.requestId + 1,
    nextCardState: args.hasReadyOutfit ? 'ready' : 'idle',
  };
}

export function isStaleRequest(requestId: number, currentId: number): boolean {
  return requestId !== currentId;
}

/** HQG: illegal combinations that must auto-correct. */
export type HqgGuardInput = {
  cardState: TodaysOutfitCardState;
  isOpen: boolean;
  loadingEnteredAt: number | null;
  now?: number;
  timeoutMs?: number;
};

export type HqgGuardAction =
  | { type: 'NONE' }
  | { type: 'FORCE_IDLE'; reason: string }
  | { type: 'FORCE_ERROR'; reason: string; message: string };

export function evaluateTodaysOutfitHqg(input: HqgGuardInput): HqgGuardAction {
  const now = input.now ?? Date.now();
  const timeoutMs = input.timeoutMs ?? TODAYS_OUTFIT_GENERATE_TIMEOUT_MS;

  // Loading while closed → illegal (chip must return)
  if (!input.isOpen && input.cardState === 'loading') {
    return { type: 'FORCE_IDLE', reason: 'loading while closed' };
  }

  // Error while closed → normalize to idle so chip is clean
  if (!input.isOpen && input.cardState === 'error') {
    return { type: 'FORCE_IDLE', reason: 'error while closed' };
  }

  // Hard timeout while open + loading
  if (
    input.isOpen
    && input.cardState === 'loading'
    && input.loadingEnteredAt != null
    && now - input.loadingEnteredAt > timeoutMs
  ) {
    return {
      type: 'FORCE_ERROR',
      reason: 'loading timeout',
      message: "Couldn't pick an outfit. Tap retry.",
    };
  }

  return { type: 'NONE' };
}
