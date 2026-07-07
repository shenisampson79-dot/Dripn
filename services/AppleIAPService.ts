/**
 * Apple In-App Purchase service — scaffold only.
 * Full StoreKit / RevenueCat integration planned per docs/IAP_MIGRATION_PLAN.md
 */

import { shouldUseAppleIAP } from '@/utils/platformPayments';

export type IAPProductKind = 'subscription' | 'dfy' | 'voice_credits';

export interface IAPProduct {
  productId: string;
  kind: IAPProductKind;
  displayName: string;
  priceString?: string;
}

export interface AppleIAPService {
  isAvailable(): boolean;
  getProducts(kind: IAPProductKind): Promise<IAPProduct[]>;
  purchase(productId: string): Promise<{ success: boolean; transactionId?: string }>;
  restorePurchases(): Promise<void>;
}

class AppleIAPServiceStub implements AppleIAPService {
  isAvailable(): boolean {
    return shouldUseAppleIAP();
  }

  async getProducts(_kind: IAPProductKind): Promise<IAPProduct[]> {
    // TODO: Integrate RevenueCat Purchases.getOfferings()
    return [];
  }

  async purchase(_productId: string): Promise<{ success: boolean; transactionId?: string }> {
    // TODO: Integrate RevenueCat Purchases.purchasePackage()
    throw new Error('Apple IAP not yet implemented — see docs/IAP_MIGRATION_PLAN.md');
  }

  async restorePurchases(): Promise<void> {
    // TODO: Integrate RevenueCat Purchases.restorePurchases()
    throw new Error('Restore purchases not yet implemented');
  }
}

export const appleIAPService: AppleIAPService = new AppleIAPServiceStub();
