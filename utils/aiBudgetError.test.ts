/**
 * Run: npx tsx utils/aiBudgetError.test.ts
 */
import assert from 'node:assert/strict';
import { isAiBudgetError, stylistMonthlyAllowanceMessage } from './aiBudgetError';

assert.equal(
  isAiBudgetError({
    message: "You've reached your plan's usage limit for this month. Upgrade or try again next month.",
    error: 'monthly_budget',
  }),
  true,
);
assert.equal(isAiBudgetError({ errorCode: 'monthly_budget' }), true);
assert.equal(
  isAiBudgetError({
    status: 429,
    message: "You've reached your plan's usage limit for this month.",
  }),
  true,
);
assert.equal(isAiBudgetError({ message: 'Too many attempts. Please try again later.' }), false);
assert.equal(isAiBudgetError({ message: 'Slowing down — rate limited' }), false);
assert.equal(isAiBudgetError({ status: 429, message: 'Too many attempts. Please try again later.' }), false);
assert.equal(isAiBudgetError(new Error('Frame failed')), false);

const freeMsg = stylistMonthlyAllowanceMessage({
  stylistName: 'Ruby',
  stylistId: 'ruby',
  tier: 'free',
});
assert.match(freeMsg, /free monthly allowance/i);
assert.match(freeMsg, /Upgrade|Personal Stylist/i);
assert.match(freeMsg, /Unlimited outfit advice/i);
assert.match(freeMsg, /retry your last question/i);
assert.doesNotMatch(freeMsg, /try again in a moment|hit a snag|network/i);

console.log('aiBudgetError.test.ts: all passed');
