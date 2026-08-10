/**
 * Run: npx tsx utils/aiBudgetError.test.ts
 */
import assert from 'node:assert/strict';
import {
  aiAllowanceSubscriptionParams,
  getAiAllowancePaywallCopy,
  isAiBudgetError,
  stylistMonthlyAllowanceMessage,
} from './aiBudgetError';

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
assert.match(freeMsg, /bigger monthly AI pot/i);
assert.match(freeMsg, /retry your last question/i);
assert.doesNotMatch(freeMsg, /unlimited/i);
assert.doesNotMatch(freeMsg, /try again in a moment|hit a snag|network/i);

const proCopy = getAiAllowancePaywallCopy('stylist_unlimited');
assert.equal(proCopy.primaryAction, 'topup');
assert.match(proCopy.primaryLabel, /buy more credit/i);
assert.doesNotMatch(proCopy.message, /upgrade to personal/i);
assert.doesNotMatch(proCopy.message, /unlimited/i);

const personalCopy = getAiAllowancePaywallCopy('personal_stylist');
assert.equal(personalCopy.primaryAction, 'upgrade');
assert.match(personalCopy.message, /Stylist Pro/i);

const proParams = aiAllowanceSubscriptionParams('stylist_unlimited', 'get_outfits');
assert.equal(proParams.scrollToAiTopUp, true);
assert.equal(proParams.source, 'get_outfits');
assert.equal(proParams.asPaywall, true);

const freeParams = aiAllowanceSubscriptionParams('free', 'sanity-check');
assert.equal(freeParams.scrollToAiTopUp, false);
assert.equal(freeParams.highlightPlan, 'personal_stylist');

console.log('aiBudgetError.test.ts: all passed');
