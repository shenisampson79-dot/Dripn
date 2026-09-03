import assert from 'node:assert/strict';
import {
  isForeignRevenueCatAppUserId,
  isRevenueCatAnonymousAppUserId,
  nextRevenueCatIdentityAction,
  shouldAutoPromoteLocalTierFromCustomerInfo,
  shouldSyncCustomerInfoOnPassiveRefresh,
} from './appleEntitlementIsolation';
import { authoritativeBillingTierFromHydrate } from './subscriptionTier';

const FREE = '68';
const PAID = '41';

type SimulatedRcState = {
  sdkConfigured: boolean;
  configuredForUserId: string | null;
  rcAppUserId: string | null;
  createdAnonymous: boolean;
  aliasedFromAnonymous: boolean;
  ops: string[];
};

function emptyRc(): SimulatedRcState {
  return {
    sdkConfigured: false,
    configuredForUserId: null,
    rcAppUserId: null,
    createdAnonymous: false,
    aliasedFromAnonymous: false,
    ops: [],
  };
}

/** Apply the same identity actions AppleIAPService uses. Never invent Purchases.logOut. */
function identifyAs(state: SimulatedRcState, nextUserId: string): void {
  const action = nextRevenueCatIdentityAction(
    state.configuredForUserId,
    nextUserId,
    state.sdkConfigured,
  );
  assert.notEqual(action, 'hold', 'authenticated identify must not hold');
  if (action === 'noop') {
    state.ops.push('noop');
    return;
  }
  if (action === 'configure') {
    assert.ok(nextUserId, 'must not Purchases.configure without a Dripn user');
    state.ops.push(`configure:${nextUserId}`);
    state.rcAppUserId = nextUserId;
    state.configuredForUserId = nextUserId;
    state.sdkConfigured = true;
    return;
  }
  if (action === 'login') {
    if (isRevenueCatAnonymousAppUserId(state.rcAppUserId)) {
      state.aliasedFromAnonymous = true;
    }
    state.ops.push(`login:${nextUserId}`);
    state.rcAppUserId = nextUserId;
    state.configuredForUserId = nextUserId;
    state.sdkConfigured = true;
  }
}

function dripnLogout(state: SimulatedRcState): void {
  const action = nextRevenueCatIdentityAction(
    state.configuredForUserId,
    null,
    state.sdkConfigured,
  );
  assert.equal(action, 'hold', 'Dripn logout must hold identified RC, not logOut');
  state.ops.push('hold');
  state.configuredForUserId = null;
}

{
  assert.equal(
    nextRevenueCatIdentityAction(null, FREE),
    'configure',
    'fresh authenticated user configures RC directly as that Dripn id',
  );
  assert.equal(nextRevenueCatIdentityAction(FREE, FREE), 'noop');
  assert.equal(
    nextRevenueCatIdentityAction(PAID, FREE),
    'login',
    'identified A → identified B is Purchases.logIn(B), never logOut then logIn',
  );
  assert.equal(
    nextRevenueCatIdentityAction(FREE, null),
    'hold',
    'Dripn logout must not Purchases.logOut (that creates an anonymous RC user)',
  );
  assert.equal(
    nextRevenueCatIdentityAction(null, FREE, true),
    'login',
    'after Dripn logout the SDK stays identified — next user is logIn, not anonymous configure',
  );
}

{
  const paidThenLogoutThenFree = emptyRc();
  identifyAs(paidThenLogoutThenFree, PAID);
  dripnLogout(paidThenLogoutThenFree);
  identifyAs(paidThenLogoutThenFree, FREE);
  assert.equal(paidThenLogoutThenFree.createdAnonymous, false);
  assert.equal(paidThenLogoutThenFree.aliasedFromAnonymous, false);
  assert.equal(paidThenLogoutThenFree.rcAppUserId, FREE);
  assert.ok(!isRevenueCatAnonymousAppUserId(paidThenLogoutThenFree.rcAppUserId));
  assert.deepEqual(paidThenLogoutThenFree.ops, [`configure:${PAID}`, 'hold', `login:${FREE}`]);
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'subscription_open',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: PAID,
      currentAppUserId: FREE,
    }),
    false,
    'Paid A → logout → Free B: B remains Free (no local promote from A CustomerInfo)',
  );
  assert.equal(
    shouldSyncCustomerInfoOnPassiveRefresh({
      dripnUserId: FREE,
      originalAppUserId: PAID,
      currentAppUserId: FREE,
      localTier: 'free',
    }),
    false,
    'Paid A → logout → Free B: Free B must not POST A CustomerInfo',
  );
}

{
  const aba = emptyRc();
  identifyAs(aba, PAID);
  identifyAs(aba, FREE);
  identifyAs(aba, PAID);
  assert.equal(aba.createdAnonymous, false);
  assert.equal(aba.aliasedFromAnonymous, false);
  assert.deepEqual(aba.ops, [`configure:${PAID}`, `login:${FREE}`, `login:${PAID}`]);
  assert.equal(aba.rcAppUserId, PAID);
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'foreground_refresh',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE,
      originalAppUserId: PAID,
      currentAppUserId: FREE,
    }),
    false,
    'A → B → A: B stays Free throughout (no CustomerInfo copy on passive refresh)',
  );
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
    'A → B → A: A may still restore as the identified purchaser',
  );
}

{
  const freshFree = emptyRc();
  identifyAs(freshFree, FREE);
  assert.deepEqual(freshFree.ops, [`configure:${FREE}`]);
  assert.equal(freshFree.rcAppUserId, FREE);
  assert.equal(freshFree.createdAnonymous, false);
  assert.ok(!isRevenueCatAnonymousAppUserId(freshFree.rcAppUserId));
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
    'legitimate first purchase while identified as this Dripn user still upgrades locally',
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
    'same-user Restore Purchases still upgrades',
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

{
  assert.equal(
    authoritativeBillingTierFromHydrate({
      serverBillingTier: 'personal_stylist',
      profileJsonTier: 'free',
      localTier: 'personal_stylist',
    }),
    'personal_stylist',
    'profile JSON Free cannot downgrade authoritative paid tier on login',
  );
  assert.equal(
    authoritativeBillingTierFromHydrate({
      serverBillingTier: 'free',
      profileJsonTier: 'personal_stylist',
      localTier: 'free',
    }),
    'free',
    'profile JSON Paid cannot upgrade authoritative Free user',
  );
}

console.log('appleEntitlementIsolation: all passed');
