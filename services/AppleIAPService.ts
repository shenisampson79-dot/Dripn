/**
 * Apple In-App Purchase service via RevenueCat (react-native-purchases).
 * Phase 1: subscriptions — Phase 2: DFY one-time purchases.
 * See docs/IAP_MIGRATION_PLAN.md
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
  LOG_LEVEL,
} from 'react-native-purchases';

import type { SubscriptionTier } from '@/contexts/AuthContext';
import type { DFYTier } from '@/services/DFYService';
import { shouldUseAppleIAP } from '@/utils/platformPayments';

export type SubscriptionInterval = 'monthly' | 'yearly';

/** App Store Connect product IDs — must match RevenueCat offerings */
export const APPLE_SUBSCRIPTION_PRODUCT_IDS = {
  personal_stylist: {
    monthly: 'com.dripn.personal_stylist.monthly',
    yearly: 'com.dripn.personal_stylist.annual',
  },
  stylist_unlimited: {
    monthly: 'com.dripn.stylist_unlimited.monthly',
    yearly: 'com.dripn.stylist_unlimited.annual',
  },
} as const;

/** App Store Connect DFY non-consumable product IDs */
export const APPLE_DFY_PRODUCT_IDS = {
  lite: 'com.dripn.dfy.lite',
  core: 'com.dripn.dfy.core',
} as const;

export type IAPSubscriptionTier = keyof typeof APPLE_SUBSCRIPTION_PRODUCT_IDS;
export type IAPDFYTier = keyof typeof APPLE_DFY_PRODUCT_IDS;

export interface SubscriptionPriceInfo {
  tier: IAPSubscriptionTier;
  interval: SubscriptionInterval;
  productId: string;
  priceString: string;
}

export interface DFYPriceInfo {
  tier: IAPDFYTier;
  productId: string;
  priceString: string;
}

export interface AppleIAPService {
  isAvailable(): boolean;
  configure(appUserId: string): Promise<void>;
  getSubscriptionPrices(): Promise<SubscriptionPriceInfo[]>;
  getDFYPrices(): Promise<DFYPriceInfo[]>;
  purchaseSubscription(tier: IAPSubscriptionTier, interval: SubscriptionInterval): Promise<CustomerInfo>;
  purchaseDFY(tier: IAPDFYTier): Promise<CustomerInfo>;
  restorePurchases(): Promise<CustomerInfo>;
  getCustomerInfo(): Promise<CustomerInfo>;
}

function getRevenueCatApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  return key || null;
}

function productIdFor(tier: IAPSubscriptionTier, interval: SubscriptionInterval): string {
  return interval === 'yearly'
    ? APPLE_SUBSCRIPTION_PRODUCT_IDS[tier].yearly
    : APPLE_SUBSCRIPTION_PRODUCT_IDS[tier].monthly;
}

function dfyProductIdFor(tier: IAPDFYTier): string {
  return APPLE_DFY_PRODUCT_IDS[tier];
}

function findPackageByProductId(
  offerings: PurchasesOfferings,
  productId: string,
): PurchasesPackage | null {
  const packages = offerings.current?.availablePackages ?? [];
  return packages.find((pkg) => pkg.product.identifier === productId) ?? null;
}

function isUserCancelledPurchase(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

class RevenueCatAppleIAPService implements AppleIAPService {
  private configuredForUserId: string | null = null;

  isAvailable(): boolean {
    return shouldUseAppleIAP() && Platform.OS === 'ios';
  }

  async configure(appUserId: string): Promise<void> {
    if (!this.isAvailable()) return;

    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      console.warn('[AppleIAP] EXPO_PUBLIC_REVENUECAT_IOS_API_KEY not set — IAP disabled');
      return;
    }

    if (this.configuredForUserId === appUserId) return;

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey, appUserID: appUserId });
    this.configuredForUserId = appUserId;
  }

  async getSubscriptionPrices(): Promise<SubscriptionPriceInfo[]> {
    if (!this.isAvailable()) return [];

    const offerings = await Purchases.getOfferings();
    const results: SubscriptionPriceInfo[] = [];

    for (const tier of Object.keys(APPLE_SUBSCRIPTION_PRODUCT_IDS) as IAPSubscriptionTier[]) {
      for (const interval of ['monthly', 'yearly'] as SubscriptionInterval[]) {
        const productId = productIdFor(tier, interval);
        const pkg = findPackageByProductId(offerings, productId);
        if (pkg?.product.priceString) {
          results.push({
            tier,
            interval,
            productId,
            priceString: pkg.product.priceString,
          });
        }
      }
    }

    return results;
  }

  async getDFYPrices(): Promise<DFYPriceInfo[]> {
    if (!this.isAvailable()) return [];

    const offerings = await Purchases.getOfferings();
    const productIds = Object.values(APPLE_DFY_PRODUCT_IDS);
    const storeProducts = await Purchases.getProducts(productIds);
    const productById = new Map(storeProducts.map((product) => [product.identifier, product]));

    const results: DFYPriceInfo[] = [];

    for (const tier of Object.keys(APPLE_DFY_PRODUCT_IDS) as IAPDFYTier[]) {
      const productId = dfyProductIdFor(tier);
      const pkg = findPackageByProductId(offerings, productId);
      const storeProduct = productById.get(productId);
      const priceString = pkg?.product.priceString || storeProduct?.priceString;
      if (priceString) {
        results.push({ tier, productId, priceString });
      }
    }

    return results;
  }

  private async purchaseProductById(productId: string): Promise<CustomerInfo> {
    const offerings = await Purchases.getOfferings();
    const pkg = findPackageByProductId(offerings, productId);

    try {
      if (pkg) {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return customerInfo;
      }

      const products = await Purchases.getProducts([productId]);
      const product = products[0];
      if (!product) {
        throw new Error(`DFY product not found for ${productId}. Check RevenueCat / App Store Connect.`);
      }

      const { customerInfo } = await Purchases.purchaseStoreProduct(product);
      return customerInfo;
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        const cancelled = new Error('Purchase cancelled');
        (cancelled as Error & { cancelled?: boolean }).cancelled = true;
        throw cancelled;
      }
      throw error;
    }
  }

  async purchaseSubscription(
    tier: IAPSubscriptionTier,
    interval: SubscriptionInterval,
  ): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }

    const productId = productIdFor(tier, interval);
    const offerings = await Purchases.getOfferings();
    const pkg = findPackageByProductId(offerings, productId);

    if (!pkg) {
      throw new Error(`Subscription package not found for ${productId}. Check RevenueCat offerings.`);
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        const cancelled = new Error('Purchase cancelled');
        (cancelled as Error & { cancelled?: boolean }).cancelled = true;
        throw cancelled;
      }
      throw error;
    }
  }

  async purchaseDFY(tier: IAPDFYTier): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }

    const productId = dfyProductIdFor(tier);
    return this.purchaseProductById(productId);
  }

  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }
    return Purchases.restorePurchases();
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }
    return Purchases.getCustomerInfo();
  }
}

/** Map RevenueCat active entitlements / product IDs to app subscription tier */
export function resolveTierFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionTier {
  const active = customerInfo.entitlements.active;

  if (active.stylist_unlimited?.isActive) return 'stylist_unlimited';
  if (active.personal_stylist?.isActive) return 'personal_stylist';

  const activeProductIds = Object.values(customerInfo.entitlements.active)
    .map((e) => e.productIdentifier)
    .filter(Boolean);

  for (const productId of activeProductIds) {
    if (productId.includes('stylist_unlimited')) return 'stylist_unlimited';
    if (productId.includes('personal_stylist')) return 'personal_stylist';
  }

  return 'free';
}

/** Map RevenueCat entitlements / purchases to DFY tier when present */
export function resolveDfyTierFromCustomerInfo(customerInfo: CustomerInfo): DFYTier | null {
  const active = customerInfo.entitlements.active;

  if (active.dfy_core?.isActive) return 'core';
  if (active.dfy_lite?.isActive) return 'lite';

  const ownedProductIds = [
    ...Object.values(customerInfo.entitlements.active).map((e) => e.productIdentifier),
    ...customerInfo.nonSubscriptionTransactions.map((txn) => txn.productIdentifier),
  ].filter(Boolean);

  for (const productId of ownedProductIds) {
    if (productId === APPLE_DFY_PRODUCT_IDS.core || productId.includes('dfy.core')) return 'core';
    if (productId === APPLE_DFY_PRODUCT_IDS.lite || productId.includes('dfy.lite')) return 'lite';
  }

  return null;
}

function latestDfyProductId(customerInfo: CustomerInfo): string | null {
  const dfyTier = resolveDfyTierFromCustomerInfo(customerInfo);
  if (!dfyTier) return null;
  return APPLE_DFY_PRODUCT_IDS[dfyTier];
}

/** Serialize CustomerInfo for subscription server sync */
export function serializeCustomerInfoForSync(customerInfo: CustomerInfo) {
  const activeEntitlements = Object.entries(customerInfo.entitlements.active).map(([id, ent]) => ({
    id,
    productIdentifier: ent.productIdentifier,
    isActive: ent.isActive,
    willRenew: ent.willRenew,
    expirationDate: ent.expirationDate,
    originalPurchaseDate: ent.originalPurchaseDate,
    store: ent.store,
  }));

  const latestProductId = activeEntitlements[0]?.productIdentifier ?? null;

  return {
    appUserId: customerInfo.originalAppUserId,
    activeEntitlements,
    latestProductId,
    originalTransactionId: null,
    managementURL: customerInfo.managementURL,
    tier: resolveTierFromCustomerInfo(customerInfo),
  };
}

/** Serialize CustomerInfo for DFY one-time server sync */
export function serializeDfyCustomerInfoForSync(customerInfo: CustomerInfo) {
  const activeEntitlements = Object.entries(customerInfo.entitlements.active).map(([id, ent]) => ({
    id,
    productIdentifier: ent.productIdentifier,
    isActive: ent.isActive,
    willRenew: ent.willRenew,
    expirationDate: ent.expirationDate,
    originalPurchaseDate: ent.originalPurchaseDate,
    store: ent.store,
  }));

  const dfyTier = resolveDfyTierFromCustomerInfo(customerInfo);
  const latestProductId = latestDfyProductId(customerInfo);
  const latestTxn = customerInfo.nonSubscriptionTransactions[0];

  return {
    appUserId: customerInfo.originalAppUserId,
    activeEntitlements,
    latestProductId,
    tier: dfyTier,
    productId: latestProductId,
    originalTransactionId: latestTxn?.transactionIdentifier ?? null,
  };
}

export const appleIAPService: AppleIAPService = new RevenueCatAppleIAPService();
