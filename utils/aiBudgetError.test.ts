/**
 * Run: npx tsx utils/aiBudgetError.test.ts
 */
import assert from 'node:assert/strict';
import { isAiBudgetError } from './aiBudgetError';

assert.equal(
  isAiBudgetError({
    message: "You've reached your plan's usage limit for this month. Upgrade or try again next month.",
    error: 'monthly_budget',
  }),
  true,
);
assert.equal(isAiBudgetError({ errorCode: 'monthly_budget' }), true);
assert.equal(isAiBudgetError({ message: 'Too many attempts. Please try again later.' }), false);
assert.equal(isAiBudgetError({ message: 'Slowing down — rate limited' }), false);
assert.equal(isAiBudgetError(new Error('Frame failed')), false);

console.log('aiBudgetError.test.ts: all passed');
