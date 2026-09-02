import assert from 'node:assert/strict';
import {
  isForeignRevenueCatAppUserId,
  nextRevenueCatIdentityAction,
  shouldAutoPromoteLocalTierFromCustomerInfo,
  shouldSyncCustomerInfoOnPassiveRefresh,
} from './appleEntitlementIsolation';

const FREE = '68';
const PAID = '41';

{
  assert.equal(
    nextRevenueCatIdentityAction(null, FREE),
    'configure',
    'first identify for a Dripn user configures RC',
  );
  assert.equal(nextRevenueCatIdentityAction(FREE, FREE), 'noop');
  assert.equal(
    nextRevenueCatIdentityAction(PAID, FREE),
    'logout_then_login',
    'Paid A → Free B must logOut before logIn (must not alias/transfer)',
  );
  assert.equal(
    nextRevenueCatIdentityAction(FREE, null),
    'reset',
    'Dripn logout must reset RC identity',
  );
  assert.equal(
    nextRevenueCatIdentityAction(null, FREE, true),
    'login',
    'after logOut the SDK stays configured — next user logs in, does not re-configure',
  );
}

{
  assert.equal(isForeignRevenueCatAppUserId(FREE, PAID), true);
  assert.equal(isForeignRevenueCatAppUserId(FREE, FREE), false);
  assert.equal(isForeignRevenueCatAppUserId(FREE, '$RCAnonymousID:abc'), false);
  assert.equal(isForeignRevenueCatAppUserId(FREE, null), false);
}

{
  const leak = shouldAutoPromoteLocalTierFromCustomerInfo({
    source: 'subscription_open',
    localTier: 'free',
    rcTier: 'personal_stylist',
    dripnUserId: FREE,
    originalAppUserId: PAID,
    currentAppUserId: FREE,
  });
  assert.equal(
    leak,
    false,
    'Free → open Subscription with stale/foreign RC Personal Stylist must remain Free',
  );
}

{
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'foreground_refresh',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: PAID,
    }),
    false,
    'foreground refresh must not repeat the leak',
  );
}

{
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'subscription_open',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: FREE,
      currentAppUserId: FREE,
    }),
    false,
    'opening Subscription never promotes from CustomerInfo even if RC id matches',
  );
}

{
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'purchase',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: FREE,
      currentAppUserId: FREE,
    }),
    true,
    'legitimate purchase for the current user still upgrades locally',
  );
}

{
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'restore',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: PAID,
      originalAppUserId: PAID,
      currentAppUserId: PAID,
    }),
    true,
    'legitimate Restore Purchases for the rightful purchaser still upgrades',
  );
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'restore',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: PAID,
      currentAppUserId: FREE,
    }),
    false,
    'Restore on a different Dripn account must not auto-promote from the original purchaser id',
  );
}

{
  assert.equal(
    shouldSyncCustomerInfoOnPassiveRefresh({
      dripnUserId: FREE,
      originalAppUserId: PAID,
      currentAppUserId: FREE,
      localTier: 'free',
    }),
    false,
    'passive sync must not use another Dripn originalAppUserId as proof',
  );
  assert.equal(
    shouldSyncCustomerInfoOnPassiveRefresh({
      dripnUserId: FREE,
      originalAppUserId: FREE,
      currentAppUserId: FREE,
      localTier: 'free',
    }),
    false,
    'Free → open Subscription must not POST CustomerInfo even if RC ids match',
  );
  assert.equal(
    shouldSyncCustomerInfoOnPassiveRefresh({
      dripnUserId: PAID,
      originalAppUserId: PAID,
      currentAppUserId: PAID,
      localTier: 'personal_stylist',
    }),
    true,
    'Paid account may still sync its own RC subscriber on refresh',
  );
}

{
  // Restart / account-switch matrix (local policy; server remains source of truth)
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'foreground_refresh',
      localTier: 'personal_stylist',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: PAID,
    }),
    false,
    'Free B after Paid A logout: RC paid CustomerInfo must not keep B paid',
  );
}

console.log('appleEntitlementIsolation: all passed');
