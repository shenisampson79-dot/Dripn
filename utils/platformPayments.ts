import { Linking, Platform } from 'react-native';

/**
 * Returns true when the app should use Apple IAP instead of Stripe checkout.
 * Production iOS only — dev builds keep Stripe unless EXPO_PUBLIC_FORCE_APPLE_IAP=true.
 */
export function shouldUseAppleIAP(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (process.env.EXPO_PUBLIC_FORCE_APPLE_IAP === 'true') return true;
  return !__DEV__;
}

/**
 * True when cancel/pause/discount/downgrade must go through App Store / RevenueCat,
 * not the Stripe CancelSubscriptionFlow.
 *
 * Rules:
 * - billingPlatform === 'apple' → always Apple
 * - billingPlatform === 'stripe' or hasStripeBilling → Stripe cancel flow
 * - production iOS / forced IAP with no Stripe subscription → Apple
 */
export function shouldManageSubscriptionViaApple(options?: {
  billingPlatform?: string | null;
  hasStripeBilling?: boolean | null;
  stripeSubscriptionId?: string | null;
}): boolean {
  if (options?.billingPlatform === 'apple') return true;
  if (options?.billingPlatform === 'stripe') return false;
  if (options?.hasStripeBilling === true || options?.stripeSubscriptionId) return false;
  if (!shouldUseAppleIAP()) return false;
  // iOS IAP mode and no Stripe subscription linked
  return options?.hasStripeBilling === false || options?.hasStripeBilling == null;
}

/** Open RevenueCat / App Store subscription management (same path as Manage Subscription). */
export async function openAppleManageSubscriptions(): Promise<void> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    await Purchases.showManageSubscriptions();
  } catch {
    await Linking.openURL('https://apps.apple.com/account/subscriptions');
  }
}
