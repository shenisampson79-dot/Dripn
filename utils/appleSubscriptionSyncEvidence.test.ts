import assert from 'node:assert/strict';
import {
  originalSubscriptionPurchaseEvidence,
  selectAppleSubscriptionSyncEvidence,
} from './appleSubscriptionSyncEvidence';

const DFY_LITE = 'com.dripn.dfy.lite';
const PS_MONTHLY = 'com.dripn.personal_stylist.monthly';
const PRO_ANNUAL = 'com.dripn.stylist_unlimited.annual';
const VOICE = 'com.dripn.voice.boost.30';
const TOPUP = 'com.dripn.ai.topup';
const DFY_TXN = '2000001227427485';
const PS_TXN = '2000001000000001';
const PRO_TXN = '2000001000000002';
const VOICE_TXN = '2000001000000003';
const TOPUP_TXN = 'o1_topup_txn';

function customerInfo(opts: {
  entitlements: Record<string, {
    productIdentifier: string;
    isActive?: boolean;
    originalPurchaseDate?: string;
    isFamilyShare?: boolean;
  }>;
  subscriptions?: Record<string, { storeTransactionId: string; isActive?: boolean }>;
  activeSubscriptions?: string[];
}) {
  return {
    entitlements: { active: opts.entitlements },
    subscriptionsByProductIdentifier: opts.subscriptions || {},
    activeSubscriptions: opts.activeSubscriptions || [],
    nonSubscriptionTransactions: [
      { productIdentifier: DFY_LITE, transactionIdentifier: DFY_TXN },
      { productIdentifier: VOICE, transactionIdentifier: VOICE_TXN },
      { productIdentifier: TOPUP, transactionIdentifier: TOPUP_TXN },
    ],
  };
}

{
  const evidence = selectAppleSubscriptionSyncEvidence(customerInfo({
    entitlements: {
      dfy_lite: { productIdentifier: DFY_LITE, isActive: true },
      personal_stylist: { productIdentifier: PS_MONTHLY, isActive: true },
    },
    subscriptions: {
      [PS_MONTHLY]: { storeTransactionId: PS_TXN, isActive: true },
    },
  }));
  assert.equal(evidence.productId, PS_MONTHLY, 'A: DFY first must not win product');
  assert.equal(evidence.originalTransactionId, PS_TXN, 'A: txn must match Personal Stylist');
  assert.equal(evidence.tier, 'personal_stylist', 'A: tier must be Personal Stylist');
}

{
  const evidence = selectAppleSubscriptionSyncEvidence(customerInfo({
    entitlements: {
      dfy_lite: { productIdentifier: DFY_LITE, isActive: true },
      stylist_unlimited: { productIdentifier: PRO_ANNUAL, isActive: true },
    },
    subscriptions: {
      [PRO_ANNUAL]: { storeTransactionId: PRO_TXN, isActive: true },
    },
  }));
  assert.equal(evidence.productId, PRO_ANNUAL, 'B: DFY first must not win product');
  assert.equal(evidence.originalTransactionId, PRO_TXN, 'B: txn must match Stylist Pro');
  assert.equal(evidence.tier, 'stylist_unlimited', 'B: tier must be Stylist Pro');
}

{
  const evidence = selectAppleSubscriptionSyncEvidence(customerInfo({
    entitlements: {
      dfy_lite: { productIdentifier: DFY_LITE, isActive: true },
    },
  }));
  assert.equal(evidence.productId, null, 'C: DFY only has no subscription product');
  assert.equal(evidence.originalTransactionId, null, 'C: must not use DFY txn');
  assert.equal(evidence.tier, 'free', 'C: no subscription grant evidence');
}

{
  const voiceOnly = selectAppleSubscriptionSyncEvidence({
    entitlements: { active: { voice_boost: { productIdentifier: VOICE, isActive: true } } },
    subscriptionsByProductIdentifier: {},
    activeSubscriptions: [],
  });
  assert.equal(voiceOnly.tier, 'free', 'D: voice only is not subscription evidence');
  assert.equal(voiceOnly.productId, null);
  assert.equal(voiceOnly.originalTransactionId, null);

  const topUpOnly = selectAppleSubscriptionSyncEvidence({
    entitlements: { active: { ai_topup: { productIdentifier: TOPUP, isActive: true } } },
    subscriptionsByProductIdentifier: {},
    activeSubscriptions: [],
  });
  assert.equal(topUpOnly.tier, 'free', 'D: AI top-up only is not subscription evidence');
  assert.equal(topUpOnly.productId, null);
  assert.equal(topUpOnly.originalTransactionId, null);
}

{
  const evidence = selectAppleSubscriptionSyncEvidence(customerInfo({
    entitlements: {
      personal_stylist: { productIdentifier: PS_MONTHLY, isActive: true },
    },
    subscriptions: {
      [PS_MONTHLY]: { storeTransactionId: PS_TXN, isActive: true },
    },
    activeSubscriptions: [PS_MONTHLY],
  }));
  assert.equal(evidence.productId, PS_MONTHLY, 'E: subscription-only product preserved');
  assert.equal(evidence.originalTransactionId, PS_TXN, 'E: subscription-only txn preserved');
  assert.equal(evidence.tier, 'personal_stylist', 'E: subscription-only tier preserved');
}

{
  const info = customerInfo({
    entitlements: {
      personal_stylist: {
        productIdentifier: PS_MONTHLY,
        isActive: true,
        originalPurchaseDate: '2026-09-02T12:00:00.000Z',
        isFamilyShare: false,
      },
    },
    subscriptions: {
      [PS_MONTHLY]: { storeTransactionId: PS_TXN, isActive: true },
    },
  });
  const purchase = originalSubscriptionPurchaseEvidence(info, PS_MONTHLY);
  assert.equal(purchase.originalPurchaseDate, '2026-09-02T12:00:00.000Z');
  assert.equal(purchase.isFamilyShare, false);
}

console.log('appleSubscriptionSyncEvidence: all passed');
