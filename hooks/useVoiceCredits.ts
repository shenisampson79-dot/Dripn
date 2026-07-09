import { useState, useEffect, useCallback, useMemo } from 'react';

import { Platform, Alert } from 'react-native';

import * as WebBrowser from 'expo-web-browser';

import { apiService } from '@/services/ApiService';

import { getBillingPlanDisplayName, normalizeSubscriptionTier } from '@/utils/subscriptionTier';

import {

  appleIAPService,

  serializeVoiceCustomerInfoForSync,

  type VoiceCreditPackId,

  type VoiceCreditPriceInfo,

} from '@/services/AppleIAPService';

import { shouldUseAppleIAP } from '@/utils/platformPayments';

import { useAuth } from '@/contexts/AuthContext';

import { formatVoicePricePence, VOICE_PACK_PRICE_PENCE, formatWeekendExpiry, sortVoiceCreditPacks } from '@/utils/voiceCreditPacks';



export type SoftCapWarning = 'usage_high' | 'approaching_limit' | null;



interface VoiceCreditsInternal {

  remaining: number;

  monthlyAllowance: number;

  monthlyHardCap?: number;

  usedThisMonth: number;

  monthlyRemaining: number;

  purchasedCredits: number;

  isUnlimited: boolean;

  weekendUnlimitedActive?: boolean;

  weekendUnlimitedExpiresAt?: string | null;

  softCapWarning?: SoftCapWarning;

}



export interface VoiceCreditPackage {

  id: string;

  credits: number;

  name?: string;

  description: string;

  priceLabel: string;

  priceGBP?: number;

  discountedPrice?: number;

  popular?: boolean;

  weekendUnlimited?: boolean;

}



export type StylistId = 'ruby' | 'max' | 'ace' | 'ivy';



interface StylistNudge {

  stylistId: StylistId;

  stylistName: string;

  message: string;

  style: 'warm' | 'direct' | 'brief' | 'logical';

}



const STYLIST_NUDGES: Record<StylistId, StylistNudge> = {

  ruby: {

    stylistId: 'ruby',

    stylistName: 'Ruby',

    message: "Need more styling advice? Weekend Unlimited gives you 48 hours of voice — or grab a credit pack anytime.",

    style: 'warm',

  },

  max: {

    stylistId: 'max',

    stylistName: 'Max',

    message: "You've used your voice replies. Weekend Unlimited or credit packs add more instantly — text chat stays unlimited.",

    style: 'direct',

  },

  ace: {

    stylistId: 'ace',

    stylistName: 'Ace',

    message: "Cap hit. Weekend Unlimited or a credit pack fixes it. Text still unlimited.",

    style: 'brief',

  },

  ivy: {

    stylistId: 'ivy',

    stylistName: 'Ivy',

    message: "Need more styling advice? Weekend Unlimited unlocks 48 hours of voice — I'm still here for unlimited text.",

    style: 'logical',

  },

};



const USAGE_NUDGES: Record<NonNullable<SoftCapWarning>, string> = {

  usage_high: "Need more styling advice? You're making great use of voice — Weekend Unlimited or credit packs are ready when you need them.",

  approaching_limit: "You've used your included voice replies — grace replies still available, or try Weekend Unlimited for 48 hours of voice.",

};



function formatPence(pricePence?: number): string {

  return formatVoicePricePence(pricePence);

}



function resolvePackagePriceLabel(pkg: {

  id?: string;

  priceLabel?: string;

  priceGBP?: number;

  discountedPrice?: number;

  chargePence?: number;

}): string {

  const chargePence = pkg.chargePence ?? pkg.discountedPrice ?? pkg.priceGBP;

  if (chargePence != null) return formatPence(chargePence);

  if (pkg.id && VOICE_PACK_PRICE_PENCE[pkg.id] != null) {

    return formatPence(VOICE_PACK_PRICE_PENCE[pkg.id]);

  }

  return pkg.priceLabel || '—';

}



function getBrowserReturnUrl(result: WebBrowser.WebBrowserResult): string {

  return 'url' in result ? String((result as { url?: string }).url || '') : '';

}



function isVoiceCancelUrl(url: string): boolean {

  return url.includes('cancel') || url.includes('voice-credits/cancel');

}



function isVoiceSuccessUrl(url: string): boolean {

  return url.includes('success') || url.includes('voice-credits/success');

}



function throwCancelledPurchase(): never {

  const cancelled = new Error('Purchase cancelled');

  (cancelled as Error & { cancelled?: boolean }).cancelled = true;

  throw cancelled;

}



export function isPurchaseCancelledError(error: unknown): boolean {

  return !!(error && typeof error === 'object' && 'cancelled' in error && (error as { cancelled?: boolean }).cancelled);

}



function isTechnicalErrorMessage(message: string): boolean {

  return /undefined|property|cannot read|TypeError|ReferenceError|SyntaxError|stack trace|\.js:\d|\.ts:\d|HTTP\s*\d{3}|status\s*(code)?\s*:?\s*\d{3}/i.test(message);

}



function isNetworkErrorMessage(message: string): boolean {

  return /network|internet|offline|connection|timeout|failed to fetch|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(message);

}



export function getPurchaseErrorMessage(error: unknown): string {

  if (isPurchaseCancelledError(error)) return '';

  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (message === 'Sign in required') return '';

  if (isNetworkErrorMessage(message)) {

    return 'Connection problem. Check your internet and try again.';

  }

  if (isTechnicalErrorMessage(message)) {

    return "We couldn't complete your purchase. Please try again.";

  }

  if (message.includes('Voice purchase could not be verified')) {

    return message;

  }

  return "We couldn't complete your purchase. Please try again.";

}



export function formatVoiceUsageLabel(credits: Pick<VoiceCreditsInternal, 'usedThisMonth' | 'monthlyAllowance'> | null): string {

  if (!credits || credits.monthlyAllowance <= 0) return '';

  const used = credits.usedThisMonth ?? 0;

  const allowance = credits.monthlyAllowance;

  const noun = allowance === 1 ? 'voice reply' : 'voice replies';

  return `${used}/${allowance} ${noun}`;

}



export function getVoiceUsageNudge(

  credits: Pick<VoiceCreditsInternal, 'softCapWarning' | 'remaining' | 'monthlyAllowance'> | null,

): string | null {

  if (!credits) return null;

  if (credits.remaining <= 0 && credits.monthlyAllowance > 0) {

    return "Need more styling advice? Weekend Unlimited gives 48 hours of voice — or add a credit pack right away.";

  }

  if (credits.softCapWarning && USAGE_NUDGES[credits.softCapWarning]) {

    return USAGE_NUDGES[credits.softCapWarning];

  }

  return null;

}



export function useVoiceCredits() {

  const { user } = useAuth();

  const [credits, setCredits] = useState<VoiceCreditsInternal | null>(null);

  const [tier, setTier] = useState<string>('free');

  const [tierName, setTierName] = useState<string>('Free');

  const [isLoading, setIsLoading] = useState(true);

  const [isPurchasing, setIsPurchasing] = useState(false);

  const [packages, setPackages] = useState<VoiceCreditPackage[]>([]);

  const [applePrices, setApplePrices] = useState<VoiceCreditPriceInfo[]>([]);

  const useAppleIAP = shouldUseAppleIAP();



  const getTierDisplayName = (rawTier: string): string => {

    return getBillingPlanDisplayName(rawTier);

  };



  const fetchBalance = useCallback(async () => {

    try {

      setIsLoading(true);

      const response = await apiService.getVoiceCreditsBalance();

      if (response.success) {

        setCredits({

          ...response.credits,

          isUnlimited: !!response.credits.isUnlimited || !!response.credits.weekendUnlimitedActive,

        });

        const normalized = normalizeSubscriptionTier(response.tier);

        setTier(normalized);

        setTierName(response.tierName || getTierDisplayName(response.tier));

      }

    } catch (error) {

      console.log('[useVoiceCredits] Balance fetch error:', error);

      setCredits({

        remaining: 0,

        monthlyAllowance: 0,

        usedThisMonth: 0,

        monthlyRemaining: 0,

        purchasedCredits: 0,

        isUnlimited: false,

      });

    } finally {

      setIsLoading(false);

    }

  }, []);



  const fetchPackages = useCallback(async () => {

    try {

      const response = await apiService.getVoiceCreditPackages();

      const mapped = (response.packages || []).map((pkg) => ({

        id: pkg.id,

        credits: pkg.credits,

        name: pkg.name,

        description: pkg.description || pkg.name || (pkg.weekendUnlimited ? 'Weekend Unlimited' : `${pkg.credits} voice credits`),

        priceLabel: resolvePackagePriceLabel(pkg),

        priceGBP: pkg.priceGBP,

        discountedPrice: pkg.discountedPrice ?? pkg.priceGBP,

        popular: pkg.popular ?? pkg.id === 'pro',

        weekendUnlimited: !!pkg.weekendUnlimited,

      }));

      setPackages(sortVoiceCreditPacks(mapped));

    } catch (error) {

      console.log('[useVoiceCredits] Packages fetch error:', error);

    }

  }, []);



  const fetchApplePrices = useCallback(async () => {

    if (!useAppleIAP || !appleIAPService.isAvailable()) {

      setApplePrices([]);

      return;

    }

    try {

      if (user?.id) {

        await appleIAPService.configure(user.id);

      }

      const prices = await appleIAPService.getVoiceCreditPrices();

      setApplePrices(prices);

    } catch (error) {

      console.log('[useVoiceCredits] Apple price fetch error:', error);

    }

  }, [useAppleIAP, user?.id]);



  useEffect(() => {

    fetchBalance();

    fetchPackages();

  }, [fetchBalance, fetchPackages]);



  useEffect(() => {

    fetchApplePrices();

  }, [fetchApplePrices]);



  const getPackagePriceLabel = useCallback((packageId: string, fallback: string): string => {

    const applePrice = applePrices.find((p) => p.packId === packageId);

    return applePrice?.priceString || fallback;

  }, [applePrices]);



  const updateBalance = useCallback((voiceCredits: {

    remaining?: string | number;

    monthlyAllowance?: number;

    monthlyHardCap?: number;

    usedThisMonth?: number;

    monthlyRemaining?: number;

    purchasedCredits?: number;

    isUnlimited?: boolean;

    weekendUnlimitedActive?: boolean;

    weekendUnlimitedExpiresAt?: string | null;

    softCapWarning?: SoftCapWarning;

  }) => {

    const { remaining, isUnlimited, ...rest } = voiceCredits;

    const normalized: Partial<VoiceCreditsInternal> = {

      ...rest,

      isUnlimited: !!isUnlimited || !!rest.weekendUnlimitedActive,

      ...(remaining !== undefined

        ? { remaining: typeof remaining === 'string' ? Number(remaining) : remaining }

        : {}),

    };

    setCredits(prev => prev ? { ...prev, ...normalized } : null);

  }, []);



  const refreshBalance = useCallback(() => {

    return fetchBalance();

  }, [fetchBalance]);



  const purchaseVoiceCredits = useCallback(async (packageId: string) => {

    if (useAppleIAP) {

      if (!user?.id) {

        Alert.alert('Sign in required', 'Please sign in to purchase voice credits with the App Store.');

        throw new Error('Sign in required');

      }



      setIsPurchasing(true);

      try {

        await appleIAPService.configure(user.id);

        const customerInfo = await appleIAPService.purchaseVoiceCredits(packageId as VoiceCreditPackId);

        const syncPayload = serializeVoiceCustomerInfoForSync(customerInfo, packageId as VoiceCreditPackId);



        if (!syncPayload.originalTransactionId) {

          throw new Error('Voice purchase could not be verified. Please contact support if credits are missing.');

        }



        const result = await apiService.syncAppleVoicePurchase(syncPayload);

        if (result.newBalance) {

          updateBalance({

            remaining: result.newBalance.remaining,

            purchasedCredits: result.newBalance.purchasedCredits,

            weekendUnlimitedActive: result.newBalance.weekendUnlimitedActive,

            weekendUnlimitedExpiresAt: result.newBalance.weekendUnlimitedExpiresAt,

            isUnlimited: result.weekendUnlimited || result.newBalance.weekendUnlimitedActive,

          });

        }

        await refreshBalance();

        return result;

      } catch (error: unknown) {

        if (isPurchaseCancelledError(error)) {

          throw error;

        }

        console.error('[useVoiceCredits] Apple IAP error:', error);

        throw error;

      } finally {

        setIsPurchasing(false);

      }

    }



    setIsPurchasing(true);

    try {

      const response = await apiService.purchaseVoiceCredits(packageId);

      if (!response.checkoutUrl) {

        throw new Error('Could not start checkout');

      }



      if (Platform.OS === 'web') {

        window.location.href = response.checkoutUrl;

        return response;

      }



      const browserResult = await WebBrowser.openBrowserAsync(response.checkoutUrl);

      const returnUrl = getBrowserReturnUrl(browserResult);



      if (isVoiceCancelUrl(returnUrl)) {

        throwCancelledPurchase();

      }



      if ((browserResult.type === 'dismiss' || browserResult.type === 'cancel') && !isVoiceSuccessUrl(returnUrl)) {

        throwCancelledPurchase();

      }



      const sessionId = returnUrl.match(/session_id=([^&]+)/)?.[1];



      if (sessionId) {

        try {

          const confirm = await apiService.confirmVoiceCreditsPurchase(sessionId);

          if (confirm.newBalance) {

            updateBalance({

              remaining: confirm.newBalance.remaining,

              purchasedCredits: confirm.newBalance.purchasedCredits,

              weekendUnlimitedActive: confirm.newBalance.weekendUnlimitedActive,

              weekendUnlimitedExpiresAt: confirm.newBalance.weekendUnlimitedExpiresAt,

              isUnlimited: confirm.weekendUnlimited || confirm.newBalance.weekendUnlimitedActive,

            });

          }



          await refreshBalance();

          return { ...response, ...confirm };

        } catch (error) {

          if (error instanceof Error && error.message === 'Payment not completed') {

            throwCancelledPurchase();

          }

          throw error;

        }

      }



      throwCancelledPurchase();

    } catch (error) {

      if (isPurchaseCancelledError(error)) {

        await refreshBalance().catch(() => {});

        throw error;

      }

      console.error('[useVoiceCredits] Purchase error:', error);

      throw error;

    } finally {

      setIsPurchasing(false);

    }

  }, [refreshBalance, updateBalance, useAppleIAP, user?.id]);



  const upgradeToPersonalStylist = useCallback(async () => {

    try {

      setIsPurchasing(true);

      const response = await apiService.createCheckoutSession('monthly');

      if (response.checkoutUrl) {

        if (Platform.OS === 'web') {

          window.location.href = response.checkoutUrl;

        } else {

          await WebBrowser.openBrowserAsync(response.checkoutUrl);

          refreshBalance();

        }

      }

    } catch (error) {

      console.error('[useVoiceCredits] Upgrade error:', error);

      throw error;

    } finally {

      setIsPurchasing(false);

    }

  }, [refreshBalance]);



  const getNudgeForStylist = useCallback((stylistId: StylistId): StylistNudge => {

    return STYLIST_NUDGES[stylistId] || STYLIST_NUDGES.ruby;

  }, []);



  const normalizedTier = normalizeSubscriptionTier(tier);

  const remainingCredits = credits?.remaining ?? 0;

  const weekendUnlimitedActive = !!credits?.weekendUnlimitedActive;

  const weekendUnlimitedExpiresAt = credits?.weekendUnlimitedExpiresAt ?? null;

  const weekendExpiryLabel = weekendUnlimitedActive
    ? formatWeekendExpiry(weekendUnlimitedExpiresAt)
    : '';

  const hasMonthlyAllowance = (credits?.monthlyAllowance ?? 0) > 0;

  const isStylistUnlimited = normalizedTier === 'stylist_unlimited';

  const hasHighAllowance = isStylistUnlimited;

  const usageLabel = formatVoiceUsageLabel(credits);

  const usageNudge = getVoiceUsageNudge(credits);

  const shouldShowBuyPacks = useMemo(() => {

    if (weekendUnlimitedActive) return false;

    if (!hasMonthlyAllowance && normalizedTier === 'free') return remainingCredits <= 0;

    if (!hasMonthlyAllowance) return false;

    if (remainingCredits <= 0) return true;

    if (credits?.softCapWarning === 'usage_high' || credits?.softCapWarning === 'approaching_limit') return true;

    return false;

  }, [credits?.softCapWarning, hasMonthlyAllowance, normalizedTier, remainingCredits, weekendUnlimitedActive]);

  const displayPackages = useMemo(
    () => sortVoiceCreditPacks(packages),
    [packages],
  );



  return {

    tier: normalizedTier,

    tierName,

    credits,

    remainingCredits,

    packages: displayPackages,

    applePrices,

    useAppleIAP,

    isLoading,

    hasCredits: weekendUnlimitedActive || remainingCredits > 0,

    isUnlimited: weekendUnlimitedActive,

    weekendUnlimitedActive,

    weekendUnlimitedExpiresAt,

    weekendExpiryLabel,

    hasHighAllowance,

    isStylistUnlimited,

    isPersonalStylist: normalizedTier === 'personal_stylist',

    isStyleChat: normalizedTier === 'personal_stylist',

    isFreeUser: normalizedTier === 'free',

    hasMonthlyAllowance,

    usageLabel,

    usageNudge,

    shouldShowBuyPacks,

    isPurchasing,

    getPackagePriceLabel,

    purchaseVoiceCredits,

    updateBalance,

    refreshBalance,

    upgradeToPersonalStylist,

    getNudgeForStylist,

  };

}



export { STYLIST_NUDGES };


