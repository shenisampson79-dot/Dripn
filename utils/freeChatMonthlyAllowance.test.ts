import assert from 'node:assert/strict';
import {
  canSendHardCappedChat,
  remainingMonthlyChatActions,
  resolveChatHardCap,
} from './freeChatMonthlyAllowance';

const FREE_CAP = 10;

{
  const r = remainingMonthlyChatActions({ monthlyChatCount: 0, chatHardCap: FREE_CAP });
  assert.equal(r.cap, 10);
  assert.equal(r.remaining, 10);
  assert.equal(r.isHardCapped, true);
}

{
  const r = remainingMonthlyChatActions({ monthlyChatCount: 10, chatHardCap: FREE_CAP });
  assert.equal(r.remaining, 0);
  assert.equal(canSendHardCappedChat({ monthlyBudgetExhausted: false, remaining: r.remaining }), false);
}

{
  const monday = remainingMonthlyChatActions({ monthlyChatCount: 10, chatHardCap: FREE_CAP });
  const tuesday = remainingMonthlyChatActions({ monthlyChatCount: 10, chatHardCap: FREE_CAP });
  assert.equal(monday.remaining, 0);
  assert.equal(tuesday.remaining, 0);
  assert.equal(
    canSendHardCappedChat({ monthlyBudgetExhausted: false, remaining: tuesday.remaining }),
    false,
    'returning the next day does not renew a spent UTC-month cap',
  );
}

{
  const paid = remainingMonthlyChatActions({ monthlyChatCount: 40, chatHardCap: null });
  assert.equal(paid.isHardCapped, false);
  assert.equal(paid.remaining, Number.POSITIVE_INFINITY);
  assert.equal(canSendHardCappedChat({ monthlyBudgetExhausted: false, remaining: paid.remaining }), true);
  assert.equal(canSendHardCappedChat({ monthlyBudgetExhausted: true, remaining: paid.remaining }), false);
}

{
  assert.equal(resolveChatHardCap({ chatHardCap: 10 }, { chatMessages: 99 }), 10);
  assert.equal(resolveChatHardCap({}, { chatMessages: 10 }), 10);
  assert.equal(resolveChatHardCap({ chatHardCap: null }, { chatMessages: null }), null);
}

{
  assert.equal(
    canSendHardCappedChat({ monthlyBudgetExhausted: false, remaining: 0, bonusRequests: 1 }),
    true,
  );
}

console.log('freeChatMonthlyAllowance: all passed');
