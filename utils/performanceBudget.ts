/**
 * Global performance budget — keep concurrent heavy work bounded
 * so wardrobe size can grow without memory/CPU spikes.
 */

const MAX_CONCURRENT = 2;
let active = 0;
const waiters: Array<() => void> = [];

function pump(): void {
  while (active < MAX_CONCURRENT && waiters.length > 0) {
    const next = waiters.shift();
    if (next) next();
  }
}

/** Run fn under the global concurrency cap (default 2). */
export function runWithPerformanceBudget<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active += 1;
      fn()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    };
    if (active < MAX_CONCURRENT) {
      start();
    } else {
      waiters.push(start);
    }
  });
}

export function getPerformanceBudgetStats(): { active: number; queued: number; max: number } {
  return { active, queued: waiters.length, max: MAX_CONCURRENT };
}
