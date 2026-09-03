/**
 * Select coherent Apple *subscription* evidence from RevenueCat CustomerInfo.
 * DFY / voice / AI top-up must never be used as subscription product, txn, or tier.
 */

export type AppleSubscriptionSyncTier = 'free' | 'personal_stylist' | 'stylist_unlimited';

type EntitlementLike = {
  productIdentifier?: string | null;
  isActive?: boolean;
  originalTransactionId?: string | null;
  storeTransactionId?: string | null;
  transactionId?: string | null;
  originalPurchaseDate?: string | null;
  isFamilyShare?: boolean;
};

type SubscriptionLike = {
  storeTransactionId?: string | null;
  originalTransactionId?: string | null;
  isActive?: boolean;
};

export type SubscriptionSyncCustomerInfo = {
  entitlements?: {
    active?: Record<string, EntitlementLike | undefined>;
  };
  activeSubscriptions?: Iterable<string> | null;
  subscriptionsByProductIdentifier?: Record<string, SubscriptionLike | undefined> | null;
};

export function subscriptionTierFromAppleProductId(
  productId?: string | null,
): Exclude<AppleSubscriptionSyncTier, 'free'> | null {
  if (!productId) return null;
  if (productId.includes('stylist_unlimited')) return 'stylist_unlimited';
  if (productId.includes('personal_stylist')) return 'personal_stylist';
  return null;
}

export function isRecognisedAppleSubscriptionProductId(productId?: string | null): boolean {
  return subscriptionTierFromAppleProductId(productId) != null;
}

export function isNonSubscriptionAppleProductId(productId?: string | null): boolean {
  if (!productId) return false;
  if (productId.includes('dfy')) return true;
  if (productId.includes('ai.topup')) return true;
  if (/voice\./i.test(productId) || /weekend_unlimited|unlimited\.weekend/i.test(productId)) {
    return true;
  }
  return false;
}

function transactionIdForProduct(
  customerInfo: SubscriptionSyncCustomerInfo,
  productId: string,
  entitlement?: EntitlementLike,
): string | null {
  const sub = customerInfo.subscriptionsByProductIdentifier?.[productId];
  const fromSub = sub?.storeTransactionId || sub?.originalTransactionId || null;
  if (fromSub) return String(fromSub);
  const fromEnt = entitlement?.originalTransactionId
    || entitlement?.storeTransactionId
    || entitlement?.transactionId
    || null;
  return fromEnt ? String(fromEnt) : null;
}

function considerProduct(
  productId: string | null | undefined,
  customerInfo: SubscriptionSyncCustomerInfo,
  entitlement: EntitlementLike | undefined,
  best: { productId: string; originalTransactionId: string | null; tier: Exclude<AppleSubscriptionSyncTier, 'free'> } | null,
): typeof best {
  if (!productId || isNonSubscriptionAppleProductId(productId)) return best;
  const tier = subscriptionTierFromAppleProductId(productId);
  if (!tier) return best;
  if (best?.tier === 'stylist_unlimited') return best;
  if (tier === 'personal_stylist' && best?.tier === 'personal_stylist') return best;
  return {
    productId,
    originalTransactionId: transactionIdForProduct(customerInfo, productId, entitlement),
    tier,
  };
}

/**
 * Pick one recognised subscription SKU and bind product, txn, and tier to it.
 * Returns free / nulls when CustomerInfo has only DFY, voice, or AI top-up.
 */
export function selectAppleSubscriptionSyncEvidence(
  customerInfo: SubscriptionSyncCustomerInfo,
): {
  productId: string | null;
  originalTransactionId: string | null;
  tier: AppleSubscriptionSyncTier;
} {
  let best: {
    productId: string;
    originalTransactionId: string | null;
    tier: Exclude<AppleSubscriptionSyncTier, 'free'>;
  } | null = null;

  const active = customerInfo.entitlements?.active || {};
  for (const ent of Object.values(active)) {
    if (!ent || ent.isActive === false) continue;
    best = considerProduct(ent.productIdentifier, customerInfo, ent, best);
  }

  if (!best) {
    for (const productId of customerInfo.activeSubscriptions || []) {
      best = considerProduct(productId, customerInfo, undefined, best);
    }
  }

  if (!best) {
    for (const [productId, sub] of Object.entries(customerInfo.subscriptionsByProductIdentifier || {})) {
      if (sub?.isActive === false) continue;
      best = considerProduct(productId, customerInfo, undefined, best);
    }
  }

  if (!best) {
    return { productId: null, originalTransactionId: null, tier: 'free' };
  }

  return {
    productId: best.productId,
    originalTransactionId: best.originalTransactionId,
    tier: best.tier,
  };
}

export function originalSubscriptionPurchaseEvidence(
  customerInfo: SubscriptionSyncCustomerInfo,
  productId?: string | null,
): { originalPurchaseDate: string | null; isFamilyShare: boolean } {
  if (!productId) return { originalPurchaseDate: null, isFamilyShare: false };
  const active = customerInfo.entitlements?.active || {};
  for (const ent of Object.values(active)) {
    if (!ent || String(ent.productIdentifier || '') !== String(productId)) continue;
    return {
      originalPurchaseDate: ent.originalPurchaseDate ? String(ent.originalPurchaseDate) : null,
      isFamilyShare: Boolean(ent.isFamilyShare),
    };
  }
  return { originalPurchaseDate: null, isFamilyShare: false };
}
