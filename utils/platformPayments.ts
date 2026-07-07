import { Platform } from 'react-native';

/**
 * Returns true when the app should use Apple IAP instead of Stripe checkout.
 * Production iOS only — dev builds keep Stripe unless EXPO_PUBLIC_FORCE_APPLE_IAP=true.
 */
export function shouldUseAppleIAP(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (process.env.EXPO_PUBLIC_FORCE_APPLE_IAP === 'true') return true;
  return !__DEV__;
}
