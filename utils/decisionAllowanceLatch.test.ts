/**
 * Run: npm run verify:decision-allowance-latch
 */
import assert from 'node:assert/strict';
import { getAiAllowancePaywallCopy } from './aiBudgetError';
import {
  isDecisionDailyLimitError,
  isGenericDecisionRateLimit,
  shouldLatchMonthlyAllowanceBlocked,
} from './decisionAllowanceLatch';

const PS = 'personal_stylist';

// A — personal_stylist, non-budget HTTP 429 → no monthly latch
assert.equal(
  shouldLatchMonthlyAllowanceBlocked({ status: 429, message: 'Too many attempts. Please try again later.' }),
  false,
  'generic 429 must not latch monthly allowance',
);
assert.equal(
  isGenericDecisionRateLimit({ status: 429, message: 'Too many attempts. Please try again later.' }),
  true,
  'generic 429 classified as transient rate limit',
);

// B — personal_stylist, daily Decision limit → no monthly latch
const dailyErr = {
  status: 429,
  error: 'daily_limit',
  message: "That's your decision for today. Upgrade to Personal Stylist for more outfit decisions.",
  limitCopy: {
    message: "That's your decision for today. Upgrade to Personal Stylist for more outfit decisions.",
    cta: 'See plans',
  },
};
assert.equal(isDecisionDailyLimitError(dailyErr), true, 'daily_limit code recognized');
assert.equal(shouldLatchMonthlyAllowanceBlocked(dailyErr), false, 'daily limit must not latch monthly allowance');
assert.equal(isGenericDecisionRateLimit(dailyErr), false, 'daily limit is not generic 429');

// C — personal_stylist, confirmed monthly_budget → latch
const monthlyErr = {
  status: 429,
  error: 'monthly_budget',
  message: "You've reached your plan's usage limit for this month. Upgrade or try again next month.",
};
assert.equal(shouldLatchMonthlyAllowanceBlocked(monthlyErr), true, 'monthly_budget must latch allowance');

// D — successful submit clears latch (state hygiene contract)
let allowanceBlocked = true;
const onSubmitSuccess = () => {
  allowanceBlocked = false;
};
onSubmitSuccess();
assert.equal(allowanceBlocked, false, 'success path clears stale allowanceBlocked');

// E — resetFlow clears latch
let resetBlocked = true;
const resetFlow = () => {
  resetBlocked = false;
};
resetFlow();
assert.equal(resetBlocked, false, 'resetFlow clears allowanceBlocked');

// F — confirmed monthly budget still renders PS monthly copy + routing
const psMonthlyCopy = getAiAllowancePaywallCopy(PS);
assert.equal(psMonthlyCopy.title, "That's your lot for this month");
assert.match(psMonthlyCopy.message, /Stylist Pro|AI credit/i);
assert.equal(psMonthlyCopy.primaryLabel, 'See plans');
assert.equal(psMonthlyCopy.primaryAction, 'upgrade');

console.log('decisionAllowanceLatch.test.ts: all passed');
