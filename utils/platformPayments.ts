import { Linking, Platform } from 'react-native';

/**
 * Returns true when the app should use Apple IAP instead of Stripe checkout.
 * Production iOS only — dev builds keep Stripe unless EXPO_PUBLIC_FORCE_APPLE_IAP=true.
 * Android is handled by shouldUsePlayBilling(); web stays Stripe.
 */
export function shouldUseAppleIAP(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (process.env.EXPO_PUBLIC_FORCE_APPLE_IAP === 'true') return true;
  return !__DEV__;
}

/**
 * Production Android uses RevenueCat + Google Play Billing instead of Stripe.
 * Dev Android keeps Stripe (same pattern as iOS without FORCE flag).
 */
export function shouldUsePlayBilling(): boolean {
  if (Platform.OS !== 'android') return false;
  return !__DEV__;
}

/** Store IAP (App Store or Play) instead of Stripe checkout. Web is never true. */
export function shouldUseNativeStoreIAP(): boolean {
  return shouldUseAppleIAP() || shouldUsePlayBilling();
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
  if (options?.billingPlatform === 'google' || options?.billingPlatform === 'play') return true;
  if (options?.billingPlatform === 'stripe') return false;
  if (options?.hasStripeBilling === true || options?.stripeSubscriptionId) return false;
  if (!shouldUseNativeStoreIAP()) return false;
  // iOS IAP mode and no Stripe subscription linked
  return options?.hasStripeBilling === false || options?.hasStripeBilling == null;
}

/** Open RevenueCat / App Store subscription management (same path as Manage Subscription). */
export async function openAppleManageSubscriptions(): Promise<void> {
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const configured =
      typeof Purchases.isConfigured === 'function'
        ? await Promise.resolve(Purchases.isConfigured())
        : false;
    if (configured) {
      await Purchases.showManageSubscriptions();
      return;
    }
  } catch {
    /* fall through to App Store URL */
  }
  if (Platform.OS === 'android') {
    await Linking.openURL('https://play.google.com/store/account/subscriptions');
    return;
  }
  await Linking.openURL('https://apps.apple.com/account/subscriptions');
}
