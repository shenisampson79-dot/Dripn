/**
 * Apple In-App Purchase service via RevenueCat (react-native-purchases).
 * Phase 1: subscriptions — Phase 2: DFY — Phase 3: voice credit consumables.
 * See docs/IAP_MIGRATION_PLAN.md
 */

import Constants from 'expo-constants';
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
import { currencyService } from '@/services/CurrencyService';
import { shouldUseAppleIAP } from '@/utils/platformPayments';

export type SubscriptionInterval = 'monthly' | 'yearly';

/** Shown when Purchases.configure never ran (missing key, Expo Go, etc.) */
export const IAP_UNAVAILABLE_MESSAGE =
  'In-app purchases unavailable — rebuild with RevenueCat key';

/**
 * App Store Connect product IDs — must match RevenueCat offerings exactly.
 * Personal Stylist uses the canonical `.yearly` suffix. Stylist Unlimited
 * retains its existing `.annual` suffix.
 */
export const APPLE_SUBSCRIPTION_PRODUCT_IDS = {
  personal_stylist: {
    monthly: 'com.dripn.personal_stylist.monthly',
    yearly: 'com.dripn.personal_stylist.yearly',
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

/** App Store Connect voice credit consumables — must match server VOICE_CREDIT_PACKAGES */
export const APPLE_VOICE_PRODUCT_IDS = {
  boost: 'com.dripn.voice.boost.30',
  pro: 'com.dripn.voice.pro.80',
  weekend: 'com.dripn.voice.weekend_unlimited',
} as const;

/** 2-Day Unlimited consumables (48h voice) */
export const APPLE_WEEKEND_UNLIMITED_PRODUCT_IDS = [
  'com.dripn.voice.weekend_unlimited',
  'com.dripn.voice.unlimited.weekend',
] as const;

/** Credit amount per Apple voice product */
export const APPLE_VOICE_PRODUCT_TO_CREDITS: Record<string, number> = {
  'com.dripn.voice.boost.30': 30,
  'com.dripn.voice.pro.80': 80,
  // Legacy ASC product IDs (old 4-pack — still honoured server-side)
  'com.dripn.voice.credits_10': 10,
  'com.dripn.voice.credits_40': 40,
  'com.dripn.voice.credits_80': 80,
  'com.dripn.voice.credits_150': 150,
  'com.dripn.voice.credits_25': 40,
  'com.dripn.voice.credits_50': 80,
  'com.dripn.voice.credits_100': 150,
};

export type IAPSubscriptionTier = keyof typeof APPLE_SUBSCRIPTION_PRODUCT_IDS;
export type IAPDFYTier = keyof typeof APPLE_DFY_PRODUCT_IDS;
export type VoiceCreditPackId = keyof typeof APPLE_VOICE_PRODUCT_IDS;

export interface SubscriptionPriceInfo {
  tier: IAPSubscriptionTier;
  interval: SubscriptionInterval;
  productId: string;
  priceString: string;
  currencyCode?: string | null;
}

export interface DFYPriceInfo {
  tier: IAPDFYTier;
  productId: string;
  priceString: string;
  currencyCode?: string | null;
}

export interface VoiceCreditPriceInfo {
  packId: VoiceCreditPackId;
  productId: string;
  credits: number;
  priceString: string;
  currencyCode?: string | null;
  weekendUnlimited?: boolean;
}

export interface AppleIAPService {
  isAvailable(): boolean;
  isConfigured(): boolean;
  configure(appUserId: string): Promise<boolean>;
  getSubscriptionPrices(): Promise<SubscriptionPriceInfo[]>;
  getDFYPrices(): Promise<DFYPriceInfo[]>;
  getVoiceCreditPrices(): Promise<VoiceCreditPriceInfo[]>;
  purchaseSubscription(tier: IAPSubscriptionTier, interval: SubscriptionInterval): Promise<CustomerInfo>;
  purchaseDFY(tier: IAPDFYTier): Promise<CustomerInfo>;
  purchaseVoiceCredits(packId: VoiceCreditPackId): Promise<CustomerInfo>;
  restorePurchases(): Promise<CustomerInfo>;
  getCustomerInfo(): Promise<CustomerInfo>;
}

function getRevenueCatApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  return key || null;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function productIdFor(tier: IAPSubscriptionTier, interval: SubscriptionInterval): string {
  return interval === 'yearly'
    ? APPLE_SUBSCRIPTION_PRODUCT_IDS[tier].yearly
    : APPLE_SUBSCRIPTION_PRODUCT_IDS[tier].monthly;
}

function dfyProductIdFor(tier: IAPDFYTier): string {
  return APPLE_DFY_PRODUCT_IDS[tier];
}

function voiceProductIdFor(packId: VoiceCreditPackId): string {
  return APPLE_VOICE_PRODUCT_IDS[packId];
}

export function isWeekendUnlimitedProductId(productId: string): boolean {
  if (APPLE_WEEKEND_UNLIMITED_PRODUCT_IDS.includes(productId as typeof APPLE_WEEKEND_UNLIMITED_PRODUCT_IDS[number])) {
    return true;
  }
  return /weekend_unlimited|unlimited\.weekend/i.test(productId);
}

export function creditsForVoiceProductId(productId: string): number | null {
  if (isWeekendUnlimitedProductId(productId)) return null;
  const direct = APPLE_VOICE_PRODUCT_TO_CREDITS[productId];
  if (direct) return direct;
  const boostMatch = productId.match(/voice\.boost\.(\d+)/i);
  if (boostMatch) {
    const parsed = parseInt(boostMatch[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const proMatch = productId.match(/voice\.pro\.(\d+)/i);
  if (proMatch) {
    const parsed = parseInt(proMatch[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const match = productId.match(/voice\.(?:credits_)?(\d+)/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function isVoiceProductId(productId: string): boolean {
  return isWeekendUnlimitedProductId(productId) || creditsForVoiceProductId(productId) != null;
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
  /** In-flight configure — callers await this to avoid purchase-before-ready races */
  private configurePromise: Promise<boolean> | null = null;
  private lastConfigureFailure: string | null = null;

  isAvailable(): boolean {
    return shouldUseAppleIAP() && Platform.OS === 'ios';
  }

  isConfigured(): boolean {
    return this.configuredForUserId != null;
  }

  /**
   * Configure RevenueCat for `appUserId`. Returns true only when the SDK singleton is ready.
   * Safe to call concurrently — shares one in-flight promise.
   */
  async configure(appUserId: string): Promise<boolean> {
    if (!appUserId) {
      this.lastConfigureFailure = 'Sign in required for Apple purchases';
      return false;
    }

    if (!this.isAvailable()) {
      this.lastConfigureFailure = 'Apple IAP is not available on this platform';
      return false;
    }

    if (isExpoGo()) {
      this.lastConfigureFailure =
        'In-app purchases require a development or production build (not Expo Go)';
      console.warn('[AppleIAP]', this.lastConfigureFailure);
      return false;
    }

    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      this.lastConfigureFailure = IAP_UNAVAILABLE_MESSAGE;
      console.warn('[AppleIAP] EXPO_PUBLIC_REVENUECAT_IOS_API_KEY not set — IAP disabled');
      return false;
    }

    if (this.configuredForUserId === appUserId) {
      this.lastConfigureFailure = null;
      return true;
    }

    if (this.configurePromise) {
      const ok = await this.configurePromise;
      if (this.configuredForUserId === appUserId) return ok;
      // Different user after concurrent configure — fall through to logIn / reconfigure
    }

    this.configurePromise = this.runConfigure(apiKey, appUserId);
    try {
      return await this.configurePromise;
    } finally {
      this.configurePromise = null;
    }
  }

  private async runConfigure(apiKey: string, appUserId: string): Promise<boolean> {
    try {
      // Already configured for another user — switch identity without re-configure
      if (this.configuredForUserId != null && this.configuredForUserId !== appUserId) {
        await Purchases.logIn(appUserId);
        this.configuredForUserId = appUserId;
        this.lastConfigureFailure = null;
        return true;
      }

      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      // configure is sync in react-native-purchases v8+; await keeps API consistent
      await Promise.resolve(Purchases.configure({ apiKey, appUserID: appUserId }));
      this.configuredForUserId = appUserId;
      this.lastConfigureFailure = null;
      return true;
    } catch (error) {
      this.configuredForUserId = null;
      this.lastConfigureFailure =
        error instanceof Error ? error.message : IAP_UNAVAILABLE_MESSAGE;
      console.warn('[AppleIAP] configure failed:', error);
      return false;
    }
  }

  /** Wait for any in-flight configure, then require a ready singleton before Purchases.* calls */
  private async ensureReady(): Promise<void> {
    if (this.configurePromise) {
      await this.configurePromise;
    }
    if (this.isConfigured()) return;
    throw new Error(this.lastConfigureFailure || IAP_UNAVAILABLE_MESSAGE);
  }

  async getSubscriptionPrices(): Promise<SubscriptionPriceInfo[]> {
    if (!this.isAvailable()) return [];
    if (this.configurePromise) await this.configurePromise;
    if (!this.isConfigured()) return [];

    const offerings = await Purchases.getOfferings();
    const results: SubscriptionPriceInfo[] = [];
    const sessionCurrency = currencyService.getSessionCurrency();

    for (const tier of Object.keys(APPLE_SUBSCRIPTION_PRODUCT_IDS) as IAPSubscriptionTier[]) {
      for (const interval of ['monthly', 'yearly'] as SubscriptionInterval[]) {
        const productId = productIdFor(tier, interval);
        const pkg = findPackageByProductId(offerings, productId);
        if (!pkg?.product.priceString) continue;

        const currencyCode = pkg.product.currencyCode ?? null;
        currencyService.notePaymentCurrency(currencyCode);

        // StoreKit is a suggestion — only surface prices that match session display currency.
        const safe = currencyService.safeStorekitPrice(
          { priceString: pkg.product.priceString, currencyCode, price: pkg.product.price },
          sessionCurrency,
        );
        if (!safe) continue;

        results.push({
          tier,
          interval,
          productId,
          priceString: safe.priceString,
          currencyCode: safe.currencyCode,
        });
      }
    }

    return results;
  }

  async getDFYPrices(): Promise<DFYPriceInfo[]> {
    if (!this.isAvailable()) return [];
    if (this.configurePromise) await this.configurePromise;
    if (!this.isConfigured()) return [];

    const offerings = await Purchases.getOfferings();
    const productIds = Object.values(APPLE_DFY_PRODUCT_IDS);
    const storeProducts = await Purchases.getProducts(productIds);
    const productById = new Map(storeProducts.map((product) => [product.identifier, product]));
    const sessionCurrency = currencyService.getSessionCurrency();

    const results: DFYPriceInfo[] = [];

    for (const tier of Object.keys(APPLE_DFY_PRODUCT_IDS) as IAPDFYTier[]) {
      const productId = dfyProductIdFor(tier);
      const pkg = findPackageByProductId(offerings, productId);
      const storeProduct = productById.get(productId);
      const priceString = pkg?.product.priceString || storeProduct?.priceString;
      const currencyCode = pkg?.product.currencyCode ?? storeProduct?.currencyCode ?? null;
      const price = pkg?.product.price ?? storeProduct?.price;
      currencyService.notePaymentCurrency(currencyCode);

      const safe = currencyService.safeStorekitPrice(
        { priceString, currencyCode, price },
        sessionCurrency,
      );
      if (!safe) continue;

      results.push({
        tier,
        productId,
        priceString: safe.priceString,
        currencyCode: safe.currencyCode,
      });
    }

    return results;
  }

  async getVoiceCreditPrices(): Promise<VoiceCreditPriceInfo[]> {
    if (!this.isAvailable()) return [];
    if (this.configurePromise) await this.configurePromise;
    if (!this.isConfigured()) return [];

    const productIds = Object.values(APPLE_VOICE_PRODUCT_IDS);
    const storeProducts = await Purchases.getProducts(productIds);
    const productById = new Map(storeProducts.map((product) => [product.identifier, product]));
    const results: VoiceCreditPriceInfo[] = [];
    const sessionCurrency = currencyService.getSessionCurrency();

    for (const packId of Object.keys(APPLE_VOICE_PRODUCT_IDS) as VoiceCreditPackId[]) {
      const productId = voiceProductIdFor(packId);
      const storeProduct = productById.get(productId);
      // Never invent a GBP catalog string here — CurrencyService owns catalog fallbacks.
      if (!storeProduct?.priceString) continue;

      const currencyCode = storeProduct.currencyCode ?? null;
      currencyService.notePaymentCurrency(currencyCode);

      const safe = currencyService.safeStorekitPrice(
        {
          priceString: storeProduct.priceString,
          currencyCode,
          price: storeProduct.price,
        },
        sessionCurrency,
      );
      if (!safe) continue;

      const weekendUnlimited = packId === 'weekend';
      results.push({
        packId,
        productId,
        credits: weekendUnlimited ? 0 : (APPLE_VOICE_PRODUCT_TO_CREDITS[productId] ?? 0),
        priceString: safe.priceString,
        currencyCode: safe.currencyCode,
        weekendUnlimited,
      });
    }

    return results;
  }

  private async purchaseProductById(productId: string): Promise<CustomerInfo> {
    await this.ensureReady();

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
        throw new Error(`Product not found for ${productId}. Check RevenueCat / App Store Connect.`);
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
    await this.ensureReady();

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
    return this.purchaseProductById(dfyProductIdFor(tier));
  }

  async purchaseVoiceCredits(packId: VoiceCreditPackId): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }
    return this.purchaseProductById(voiceProductIdFor(packId));
  }

  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }
    await this.ensureReady();
    return Purchases.restorePurchases();
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isAvailable()) {
      throw new Error('Apple IAP is not available on this platform');
    }
    await this.ensureReady();
    return Purchases.getCustomerInfo();
  }
}

function tierFromAppleProductId(productId?: string | null): SubscriptionTier | null {
  if (!productId) return null;
  if (productId.includes('stylist_unlimited')) return 'stylist_unlimited';
  if (productId.includes('personal_stylist')) return 'personal_stylist';
  return null;
}

/** Map RevenueCat active entitlements / product IDs to app subscription tier */
export function resolveTierFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionTier {
  const active = customerInfo.entitlements.active;

  if (active.stylist_unlimited?.isActive) return 'stylist_unlimited';
  if (active.personal_stylist?.isActive) return 'personal_stylist';

  const entitlementProductIds = Object.values(customerInfo.entitlements.active)
    .map((e) => e.productIdentifier)
    .filter(Boolean);

  const activeSubscriptions = Array.from(customerInfo.activeSubscriptions ?? []);
  const allProductIds = [...entitlementProductIds, ...activeSubscriptions];

  let best: SubscriptionTier = 'free';
  for (const productId of allProductIds) {
    const mapped = tierFromAppleProductId(productId);
    if (mapped === 'stylist_unlimited') return 'stylist_unlimited';
    if (mapped === 'personal_stylist') best = 'personal_stylist';
  }

  return best;
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

function findOriginalTransactionId(customerInfo: CustomerInfo, productId?: string | null): string | null {
  if (productId && customerInfo.subscriptionsByProductIdentifier?.[productId]) {
    const sub = customerInfo.subscriptionsByProductIdentifier[productId];
    if (sub.storeTransactionId) return sub.storeTransactionId;
  }

  for (const sub of Object.values(customerInfo.subscriptionsByProductIdentifier || {})) {
    if (sub.isActive && sub.storeTransactionId) {
      return sub.storeTransactionId;
    }
  }

  for (const ent of Object.values(customerInfo.entitlements.active)) {
    const pid = ent.productIdentifier;
    const sub = customerInfo.subscriptionsByProductIdentifier?.[pid];
    if (sub?.storeTransactionId) return sub.storeTransactionId;
  }

  const voiceTxns = customerInfo.nonSubscriptionTransactions.filter((txn) =>
    isVoiceProductId(txn.productIdentifier),
  );
  const dfyTxns = customerInfo.nonSubscriptionTransactions.filter((txn) =>
    txn.productIdentifier.includes('dfy'),
  );
  const latestTxn = voiceTxns[0] || dfyTxns[0] || customerInfo.nonSubscriptionTransactions[0];
  return latestTxn?.transactionIdentifier ?? null;
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
    originalTransactionId: findOriginalTransactionId(customerInfo, latestProductId),
    managementURL: customerInfo.managementURL,
    tier: resolveTierFromCustomerInfo(customerInfo),
  };
}

/** App Store account storefront country (ISO 3166-1 alpha-2), when available. */
export async function getAppStoreCountryCode(): Promise<string | null> {
  try {
    if (typeof Purchases.getStorefront !== 'function') return null;
    const storefront = await Purchases.getStorefront();
    const code = (storefront as { countryCode?: string } | null)?.countryCode;
    if (!code || typeof code !== 'string') return null;
    return code.trim().toUpperCase() === 'UK' ? 'GB' : code.trim().toUpperCase();
  } catch {
    return null;
  }
}

/** Subscription sync payload including storefront country for regional entitlement caps. */
export async function serializeCustomerInfoForSyncWithStorefront(customerInfo: CustomerInfo) {
  const base = serializeCustomerInfoForSync(customerInfo);
  const storeCountry = await getAppStoreCountryCode();
  return {
    ...base,
    storeCountry: storeCountry || undefined,
    customerInfo: {
      ...base,
      storeCountry: storeCountry || undefined,
      storefront: storeCountry || undefined,
    },
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
  const latestTxn = customerInfo.nonSubscriptionTransactions.find((txn) =>
    txn.productIdentifier.includes('dfy'),
  ) || customerInfo.nonSubscriptionTransactions[0];

  return {
    appUserId: customerInfo.originalAppUserId,
    activeEntitlements,
    latestProductId,
    tier: dfyTier,
    productId: latestProductId,
    originalTransactionId: latestTxn?.transactionIdentifier
      ?? findOriginalTransactionId(customerInfo, latestProductId),
  };
}

/**
 * Serialize CustomerInfo for voice credit consumable server sync.
 * Consumables are not restored via Apple — credits live on the server account.
 */
export function serializeVoiceCustomerInfoForSync(
  customerInfo: CustomerInfo,
  packId?: VoiceCreditPackId,
) {
  const voiceTxns = customerInfo.nonSubscriptionTransactions.filter((txn) =>
    isVoiceProductId(txn.productIdentifier),
  );
  const latestTxn = voiceTxns[0] || customerInfo.nonSubscriptionTransactions[0];
  const productId = latestTxn?.productIdentifier
    || (packId ? voiceProductIdFor(packId) : null);
  const weekendUnlimited = productId ? isWeekendUnlimitedProductId(productId) : packId === 'weekend';
  const credits = weekendUnlimited ? null : (productId ? creditsForVoiceProductId(productId) : null);

  return {
    appUserId: customerInfo.originalAppUserId,
    productId,
    credits,
    packId: packId ?? null,
    weekendUnlimited,
    originalTransactionId: latestTxn?.transactionIdentifier ?? null,
  };
}

export const appleIAPService: AppleIAPService = new RevenueCatAppleIAPService();
