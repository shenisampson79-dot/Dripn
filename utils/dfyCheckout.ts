import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { API_URL } from '@/config/api';
import { apiService } from '@/services/ApiService';
import {
  appleIAPService,
  IAP_UNAVAILABLE_MESSAGE,
  serializeDfyCustomerInfoForSync,
  type IAPDFYTier,
} from '@/services/AppleIAPService';
import type { DFYTier } from '@/services/DFYService';
import { shouldUseAppleIAP } from '@/utils/platformPayments';

export type DfyCheckoutOutcome = 'success' | 'cancelled' | 'failed';

const DFY_CHECKOUT_SUCCESS_REDIRECT = `${API_URL}/api/dfy/success`;
const DFY_CHECKOUT_CANCEL_REDIRECT = `${API_URL}/api/dfy/cancel`;

function getBrowserReturnUrl(
  result: WebBrowser.WebBrowserResult | WebBrowser.WebBrowserAuthSessionResult,
): string {
  return 'url' in result ? String((result as { url?: string }).url || '') : '';
}

function isDfyCancelUrl(url: string): boolean {
  return url.includes('cancel') || url.includes('payment-cancelled');
}

function isDfySuccessUrl(url: string): boolean {
  return url.includes('success') || url.includes('payment-success');
}

export async function resolveDfyCheckoutOutcome(
  result: WebBrowser.WebBrowserResult | WebBrowser.WebBrowserAuthSessionResult,
  sessionId: string,
  checkoutEmail: string,
): Promise<DfyCheckoutOutcome> {
  const returnUrl = getBrowserReturnUrl(result);

  if (isDfyCancelUrl(returnUrl)) {
    return 'cancelled';
  }

  if (
    (result.type === 'dismiss' || result.type === 'cancel') &&
    !isDfySuccessUrl(returnUrl)
  ) {
    return 'cancelled';
  }

  const urlSessionId = returnUrl.match(/session_id=([^&]+)/)?.[1];
  const verifySessionId = urlSessionId || sessionId;

  try {
    const verification = await apiService.verifyDFYPayment(verifySessionId, checkoutEmail);
    if (verification.paid) {
      return 'success';
    }
    if (isDfySuccessUrl(returnUrl)) {
      return 'failed';
    }
  } catch {
    if (isDfySuccessUrl(returnUrl)) {
      return 'failed';
    }
  }

  return 'cancelled';
}

export async function runStripeDfyCheckout(options: {
  email: string;
  tier: DFYTier;
  language?: string;
}): Promise<DfyCheckoutOutcome> {
  const response = await apiService.createDFYCheckoutSession(
    options.email,
    options.tier,
    options.language,
    {
      successUrl: `${DFY_CHECKOUT_SUCCESS_REDIRECT}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: DFY_CHECKOUT_CANCEL_REDIRECT,
    },
  );

  if (!response.checkoutUrl || !response.sessionId) {
    throw new Error('No checkout URL received');
  }

  if (Platform.OS === 'web') {
    window.location.href = response.checkoutUrl;
    return 'cancelled';
  }

  // Auth session closes on white HTTPS return pages — avoids black flash via dripn.style / comparison screen
  const result = await WebBrowser.openAuthSessionAsync(
    response.checkoutUrl,
    DFY_CHECKOUT_SUCCESS_REDIRECT,
  );
  return resolveDfyCheckoutOutcome(result, response.sessionId, options.email);
}

export async function runAppleDfyCheckout(options: {
  userId: string;
  tier: DFYTier;
}): Promise<DfyCheckoutOutcome> {
  const ready = await appleIAPService.configure(options.userId);
  if (!ready) {
    throw new Error(IAP_UNAVAILABLE_MESSAGE);
  }
  const customerInfo = await appleIAPService.purchaseDFY(options.tier as IAPDFYTier);
  const syncPayload = serializeDfyCustomerInfoForSync(customerInfo);
  if (!syncPayload.tier) {
    throw new Error('Purchase could not be verified');
  }
  await apiService.syncAppleDFYPurchase(syncPayload);
  return 'success';
}

export async function runDfyCheckout(options: {
  tier: DFYTier;
  email?: string | null;
  userId?: string | null;
  language?: string;
}): Promise<DfyCheckoutOutcome> {
  if (shouldUseAppleIAP()) {
    if (!options.userId) {
      throw new Error('Sign in required for Apple purchases');
    }
    return runAppleDfyCheckout({ userId: options.userId, tier: options.tier });
  }

  if (!options.email) {
    throw new Error('Email required for checkout');
  }
  return runStripeDfyCheckout({
    email: options.email,
    tier: options.tier,
    language: options.language,
  });
}

export async function finalizeDfyPurchase(tier: DFYTier): Promise<void> {
  try {
    await apiService.generateDFYDelivery({ tier, stylistId: 'ruby' });
  } catch (e) {
    console.log('DFY delivery generation will continue async', e);
  }
}

export function isApplePurchaseCancelled(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'cancelled' in error &&
      (error as { cancelled?: boolean }).cancelled,
  );
}
