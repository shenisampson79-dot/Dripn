/**
 * Today's Outfit control-flow + HQG contracts.
 * Run: npx tsx scripts/verify-todays-outfit-control-flow.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  TODAYS_OUTFIT_GENERATE_TIMEOUT_MS,
  cancelOpenSession,
  evaluateTodaysOutfitHqg,
  isStaleRequest,
  withTimeout,
} from '../utils/todaysOutfitControlFlow';

async function main() {
  console.log('=== Today\'s Outfit control-flow + HQG ===\n');

  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 30),
    /Timed out|timeout/i,
  );
  assert.equal(await withTimeout(Promise.resolve(7), 1000), 7);

  const cancelled = cancelOpenSession({ requestId: 3, hasReadyOutfit: false });
  assert.equal(cancelled.nextRequestId, 4);
  assert.equal(cancelled.nextCardState, 'idle');
  assert.equal(
    cancelOpenSession({ requestId: 1, hasReadyOutfit: true }).nextCardState,
    'ready',
  );
  assert.equal(isStaleRequest(1, 2), true);
  assert.equal(isStaleRequest(2, 2), false);

  const closedLoading = evaluateTodaysOutfitHqg({
    cardState: 'loading',
    isOpen: false,
    loadingEnteredAt: Date.now(),
  });
  assert.equal(closedLoading.type, 'FORCE_IDLE');

  const timedOut = evaluateTodaysOutfitHqg({
    cardState: 'loading',
    isOpen: true,
    loadingEnteredAt: Date.now() - TODAYS_OUTFIT_GENERATE_TIMEOUT_MS - 1,
  });
  assert.equal(timedOut.type, 'FORCE_ERROR');

  const ok = evaluateTodaysOutfitHqg({
    cardState: 'loading',
    isOpen: true,
    loadingEnteredAt: Date.now(),
  });
  assert.equal(ok.type, 'NONE');

  const cardSrc = readFileSync(
    resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
    'utf8',
  );
  assert.ok(cardSrc.includes('useTodaysOutfitHqgGuard'));
  assert.ok(cardSrc.includes('withTimeout'));
  assert.ok(cardSrc.includes('cancelOpenSession'));
  assert.ok(/visible=\{visible\}/.test(cardSrc), 'sheet visibility must be only `visible`');
  assert.ok(
    /const showReopenChip = Boolean\(user\) && !visible && !gapVisible;/.test(cardSrc),
    'chip must not gate on loading/sheetMode',
  );
  assert.ok(cardSrc.includes("Couldn't pick an outfit. Tap retry."));

  console.log('All control-flow checks passed.\n');
  console.log('  ✓ withTimeout rejects hung promises');
  console.log('  ✓ cancel invalidates request id');
  console.log('  ✓ HQG kills closed+loading and open timeouts');
  console.log('  ✓ chip + modal wired to visible only\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
