/**
 * Account/entitlement isolation for Apple IAP + RevenueCat.
 * Pure policy helpers — no SDK calls.
 *
 * Causal bug: opening Subscription / foreground refresh treated device
 * CustomerInfo as belonging to the currently authenticated Dripn user.
 *
 * Identity rule: never Purchases.logOut() just to park an anonymous RC user.
 * Dripn is always authenticated before IAP. Identified A → identified B is
 * Purchases.logIn(B) (user switch, no anonymous alias/merge).
 */

export type PassiveEntitlementSource = 'subscription_open' | 'foreground_refresh';
export type ActiveEntitlementSource = 'purchase' | 'restore';
export type EntitlementSyncSource = PassiveEntitlementSource | ActiveEntitlementSource;

export type RevenueCatIdentityAction =
  | 'noop'
  | 'configure'
  | 'login'
  | 'hold';

export function isRevenueCatAnonymousAppUserId(appUserId?: string | null): boolean {
  if (!appUserId) return false;
  return String(appUserId).startsWith('$RCAnonymousID:');
}

/** True when original/current RC app user id names a different Dripn user. */
export function isForeignRevenueCatAppUserId(
  dripnUserId?: string | number | null,
  rcAppUserId?: string | null,
): boolean {
  if (dripnUserId == null || dripnUserId === '') return false;
  if (!rcAppUserId) return false;
  const claimed = String(rcAppUserId).trim();
  if (!claimed) return false;
  if (isRevenueCatAnonymousAppUserId(claimed)) return false;
  return claimed !== String(dripnUserId);
}

/**
 * Next RevenueCat SDK call for a Dripn identity change.
 * `nextUserId === null` is Dripn logout: hold the last identified RC user.
 */
export function nextRevenueCatIdentityAction(
  configuredForUserId: string | null,
  nextUserId: string | null,
  sdkConfigured = false,
): RevenueCatIdentityAction {
  if (!nextUserId) return 'hold';
  if (configuredForUserId != null && configuredForUserId === nextUserId) return 'noop';
  if (configuredForUserId != null && configuredForUserId !== nextUserId) return 'login';
  if (sdkConfigured) return 'login';
  return 'configure';
}

/**
 * Opening Subscription or foregrounding must never copy RC CustomerInfo
 * into the local Dripn tier. Purchase/restore may, if RC is identified as
 * this Dripn user and originalAppUserId is not another Dripn account.
 */
export function shouldAutoPromoteLocalTierFromCustomerInfo(opts: {
  source: EntitlementSyncSource;
  localTier?: string | null;
  rcTier?: string | null;
  dripnUserId?: string | number | null;
  originalAppUserId?: string | null;
  currentAppUserId?: string | null;
}): boolean {
  const rcTier = String(opts.rcTier || 'free').toLowerCase();
  if (!rcTier || rcTier === 'free') return false;

  if (opts.source === 'subscription_open' || opts.source === 'foreground_refresh') {
    return false;
  }

  if (isForeignRevenueCatAppUserId(opts.dripnUserId, opts.currentAppUserId)) return false;
  if (isForeignRevenueCatAppUserId(opts.dripnUserId, opts.originalAppUserId)) return false;
  return true;
}

/** Passive paths may refresh server state; they must not POST a foreign RC subscriber. */
export function shouldSyncCustomerInfoOnPassiveRefresh(opts: {
  dripnUserId?: string | number | null;
  originalAppUserId?: string | null;
  currentAppUserId?: string | null;
  localTier?: string | null;
}): boolean {
  if (opts.dripnUserId == null || opts.dripnUserId === '') return false;
  const local = String(opts.localTier || 'free').toLowerCase();
  if (!local || local === 'free') return false;
  if (isForeignRevenueCatAppUserId(opts.dripnUserId, opts.currentAppUserId)) return false;
  if (isForeignRevenueCatAppUserId(opts.dripnUserId, opts.originalAppUserId)) return false;
  return true;
}
