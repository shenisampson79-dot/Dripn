import { Platform } from 'react-native';

/**
 * Returns true when the app should use Apple IAP instead of Stripe checkout.
 * Production iOS only — dev builds keep Stripe for testing until IAP is wired.
 */
export function shouldUseAppleIAP(): boolean {
  return Platform.OS === 'ios' && !__DEV__;
}
