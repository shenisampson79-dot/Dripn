import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  localTierWriteForRestore,
  shouldAutoPromoteLocalTierFromCustomerInfo,
  shouldSyncCustomerInfoOnPassiveRefresh,
} from './appleEntitlementIsolation';
import { reconcileSubscriptionTier } from './subscriptionTier';

const FREE_USER = '74';
const PAID_USER = '41';
const SCREEN_SRC = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../screens/SubscriptionScreen.tsx'),
  'utf8',
);

function sliceFn(src: string, startNeedle: string, endNeedle: string): string {
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `could not slice ${startNeedle}`);
  return src.slice(start, end);
}

type Session = {
  authContextTier: string;
  asyncStorageTier: string;
};

function persist(session: Session, tier: string): void {
  session.authContextTier = tier;
  session.asyncStorageTier = tier;
}

function preferHigher(local: string, next: string): string {
  const rank: Record<string, number> = { free: 0, personal_stylist: 1, stylist_unlimited: 2 };
  return (rank[next] ?? 0) >= (rank[local] ?? 0) ? next : local;
}

function applyLocalIfHigher(session: Session, tier: string): void {
  persist(session, preferHigher(session.authContextTier, tier));
}

/** Mirrors handleRestorePurchases: RC evidence → sync → then local write / reconcile. */
function runRestore(opts: {
  localTier: string;
  rcTier: string;
  serverAccepts: boolean;
  serverTier: string;
}): Session {
  const session: Session = {
    authContextTier: opts.localTier,
    asyncStorageTier: opts.localTier,
  };

  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'restore',
      localTier: opts.localTier,
      rcTier: opts.rcTier,
      dripnUserId: FREE_USER,
      originalAppUserId: FREE_USER,
      currentAppUserId: FREE_USER,
    }),
    false,
    'restore CustomerInfo must not auto-promote',
  );

  const pre = localTierWriteForRestore({ phase: 'pre_sync' });
  assert.equal(pre.applyOptimisticRcTier, false);
  assert.equal(pre.applyAcceptedServerTier, null);
  assert.equal(pre.reconcileFromServer, false);
  assert.equal(session.authContextTier, opts.localTier, 'AuthContext unchanged before /apple/sync');
  assert.equal(session.asyncStorageTier, opts.localTier, 'AsyncStorage unchanged before /apple/sync');

  if (opts.rcTier !== 'free') {
    if (opts.serverAccepts) {
      const accepted = localTierWriteForRestore({
        phase: 'post_sync',
        syncOutcome: 'accepted',
        acceptedServerTier: opts.serverTier,
      });
      if (accepted.applyAcceptedServerTier) {
        applyLocalIfHigher(session, accepted.applyAcceptedServerTier);
      }
      if (accepted.reconcileFromServer) {
        persist(session, reconcileSubscriptionTier({
          local: session.authContextTier,
          remote: opts.serverTier,
        }));
      }
    } else {
      const rejected = localTierWriteForRestore({
        phase: 'post_sync',
        syncOutcome: 'rejected',
      });
      assert.equal(rejected.applyAcceptedServerTier, null);
      assert.equal(rejected.reconcileFromServer, true);
      persist(session, reconcileSubscriptionTier({
        local: session.authContextTier,
        remote: opts.serverTier,
      }));
    }
  }

  return session;
}

function relaunch(session: Session, serverTier: string): Session {
  const hydrated = reconcileSubscriptionTier({
    local: session.asyncStorageTier,
    remote: serverTier,
  });
  return { authContextTier: hydrated, asyncStorageTier: hydrated };
}

{
  const restoreFn = sliceFn(SCREEN_SRC, 'const handleRestorePurchases', 'const handleSelectPlan');
  const syncAt = restoreFn.indexOf('syncAppleSubscription');
  const applyAt = restoreFn.indexOf('applyLocalSubscriptionTier');
  assert.ok(syncAt >= 0, 'restore still syncs Apple subscription');
  assert.ok(applyAt > syncAt, 'restore must not applyLocalSubscriptionTier before /apple/sync');
  assert.equal(restoreFn.includes('Unlock locally first'), false);
  assert.ok(restoreFn.includes("source: 'restore'"));
  assert.ok(restoreFn.includes('refreshSubscriptionFromBackend'));
}

{
  const purchaseFn = sliceFn(SCREEN_SRC, 'const completeApplePurchase', 'const showAiTopUpComingSoon');
  const applyAt = purchaseFn.indexOf('applyLocalSubscriptionTier(unlockedTier)');
  const syncAt = purchaseFn.indexOf('syncAppleSubscription');
  const intentAt = purchaseFn.indexOf('createApplePurchaseIntent');
  assert.ok(intentAt >= 0 && intentAt < applyAt, 'purchase still creates an intent first');
  assert.ok(applyAt >= 0 && applyAt < syncAt, 'purchase-intent flow still unlocks locally after StoreKit charge');
  assert.ok(purchaseFn.includes("source: 'purchase'"));
}

{
  const rejected = runRestore({
    localTier: 'free',
    rcTier: 'personal_stylist',
    serverAccepts: false,
    serverTier: 'free',
  });
  assert.equal(rejected.authContextTier, 'free', 'AuthContext Free after rejected restore');
  assert.equal(rejected.asyncStorageTier, 'free', 'AsyncStorage Free after rejected restore');
  const afterLaunch = relaunch(rejected, 'free');
  assert.equal(afterLaunch.authContextTier, 'free', 'relaunch after rejected restore stays Free');
  assert.equal(afterLaunch.asyncStorageTier, 'free');
}

{
  const accepted = runRestore({
    localTier: 'free',
    rcTier: 'personal_stylist',
    serverAccepts: true,
    serverTier: 'personal_stylist',
  });
  assert.equal(accepted.authContextTier, 'personal_stylist', 'legitimate restore paid only after server acceptance');
  assert.equal(accepted.asyncStorageTier, 'personal_stylist');
}

{
  const alreadyPaid = runRestore({
    localTier: 'personal_stylist',
    rcTier: 'personal_stylist',
    serverAccepts: true,
    serverTier: 'personal_stylist',
  });
  assert.equal(alreadyPaid.authContextTier, 'personal_stylist', 'already-bound paid restore stays paid');
  assert.equal(alreadyPaid.asyncStorageTier, 'personal_stylist');
}

{
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'subscription_open',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE_USER,
      originalAppUserId: PAID_USER,
      currentAppUserId: FREE_USER,
    }),
    false,
  );
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'foreground_refresh',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE_USER,
      originalAppUserId: FREE_USER,
      currentAppUserId: FREE_USER,
    }),
    false,
  );
  assert.equal(
    shouldSyncCustomerInfoOnPassiveRefresh({
      dripnUserId: FREE_USER,
      originalAppUserId: FREE_USER,
      currentAppUserId: FREE_USER,
      localTier: 'free',
    }),
    false,
  );
}

{
  assert.equal(
    shouldAutoPromoteLocalTierFromCustomerInfo({
      source: 'purchase',
      localTier: 'free',
      rcTier: 'personal_stylist',
      dripnUserId: FREE_USER,
      originalAppUserId: FREE_USER,
      currentAppUserId: FREE_USER,
    }),
    true,
    'purchase-intent purchase flow still allowed to auto-promote locally',
  );
}

console.log('appleRestoreLocalEntitlement: all passed');
