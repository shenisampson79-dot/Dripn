import { useState, useEffect, useCallback, useMemo, createContext, useContext, createElement, type ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiService } from '@/services/ApiService';
import { API_URL } from '@/config/api';
import { getBillingPlanDisplayName, normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import {
  appleIAPService,
  IAP_UNAVAILABLE_MESSAGE,
  serializeVoiceCustomerInfoForSync,
  type VoiceCreditPackId,
  type VoiceCreditPriceInfo,
} from '@/services/AppleIAPService';
import { shouldUseAppleIAP } from '@/utils/platformPayments';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from '@/contexts/TranslationContext';
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
    message: "Need more styling advice? 2-Day Unlimited gives you 48 hours of voice — or grab a credit pack anytime.",
    style: 'warm',
  },
  max: {
    stylistId: 'max',
    stylistName: 'Max',
    message: "You've used your voice replies. 2-Day Unlimited or credit packs add more instantly — text chat stays unlimited.",
    style: 'direct',
  },
  ace: {
    stylistId: 'ace',
    stylistName: 'Ace',
    message: "Cap hit. 2-Day Unlimited or a credit pack fixes it. Text still unlimited.",
    style: 'brief',
  },
  ivy: {
    stylistId: 'ivy',
    stylistName: 'Ivy',
    message: "Need more styling advice? 2-Day Unlimited unlocks 48 hours of voice — I'm still here for unlimited text.",
    style: 'logical',
  },
};
const USAGE_NUDGES: Record<NonNullable<SoftCapWarning>, string> = {
  usage_high: "Need more styling advice? You're making great use of voice — 2-Day Unlimited or credit packs are ready when you need them.",
  approaching_limit: "You've used your included voice replies — grace replies still available, or try 2-Day Unlimited for 48 hours of voice.",
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
function getBrowserReturnUrl(result: WebBrowser.WebBrowserResult | WebBrowser.WebBrowserAuthSessionResult): string {
  return 'url' in result ? String((result as { url?: string }).url || '') : '';
}
function isVoiceCancelUrl(url: string): boolean {
  return url.includes('cancel') || url.includes('voice-credits/cancel');
}
function isVoiceSuccessUrl(url: string): boolean {
  return url.includes('success') || url.includes('voice-credits/success');
}
const VOICE_CHECKOUT_SUCCESS_REDIRECT = `${API_URL}/api/voice-credits/success`;
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
    return "Need more styling advice? 2-Day Unlimited gives 48 hours of voice — or add a credit pack right away.";
  }
  if (credits.softCapWarning && USAGE_NUDGES[credits.softCapWarning]) {
    return USAGE_NUDGES[credits.softCapWarning];
  }
  return null;
}
export type VoiceAccessReason =
  | 'has_credits'
  | 'weekend_unlimited'
  | 'purchased_credits'
  | 'no_credits'
  | 'no_allowance'
  | 'upgrade_required'
  | 'error'
  | 'loading'
  | 'unknown';

export type VoiceBalanceErrorKind = 'auth' | 'network' | 'unknown';

function classifyVoiceBalanceError(error: unknown): VoiceBalanceErrorKind {
  const status =
    error && typeof error === 'object'
      ? (error as { status?: number; statusCode?: number }).status ??
        (error as { statusCode?: number }).statusCode
      : undefined;
  if (status === 401 || status === 403) return 'auth';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/authentication required|please log in|please sign in|sign in required|not authenticated/i.test(message)) {
    return 'auth';
  }
  if (isNetworkErrorMessage(message) || /server took too long|check your connection/i.test(message)) {
    return 'network';
  }
  return 'unknown';
}

/** Human-readable why voice is blocked — never says "used up" unless they truly exhausted allowance. */
export function getVoiceAccessDenialMessage(options: {
  reason?: string | null;
  hasMonthlyAllowance: boolean;
  usedThisMonth: number;
  monthlyAllowance: number;
  balanceError?: boolean;
  balanceErrorKind?: VoiceBalanceErrorKind | null;
}): string {
  if (options.balanceError) {
    if (options.balanceErrorKind === 'auth') {
      return "Couldn't verify your session for spoken replies. Sign in again, then tap Retry.";
    }
    if (options.balanceErrorKind === 'network') {
      return "Couldn't load your spoken-reply balance. Check your connection and try again.";
    }
    return "Couldn't load your spoken-reply balance. Please try again.";
  }
  if (options.reason === 'no_allowance' || options.reason === 'upgrade_required') {
    return "Spoken replies aren't included on your plan yet. Add a voice pack, or switch to Chat for unlimited text.";
  }
  if (options.hasMonthlyAllowance && options.usedThisMonth > 0) {
    return "You've used this month's spoken replies. Add a top-up voice pack or switch to Chat for unlimited text.";
  }
  if (options.hasMonthlyAllowance && options.monthlyAllowance > 0 && options.usedThisMonth === 0) {
    return "No spoken replies available right now. Pull to refresh, or add a voice pack.";
  }
  return "Spoken replies aren't available right now. Add a voice pack or switch to Chat for unlimited text.";
}

export function VoiceCreditsProvider({ children }: { children: ReactNode }) {
  const value = useVoiceCreditsState();
  // createElement (not JSX) so this file can stay .ts for Metro
  return createElement(VoiceCreditsContext.Provider, { value }, children);
}

function useVoiceCreditsState() {
  const { user } = useAuth();
  const { currentLanguage } = useTranslations();
  const [credits, setCredits] = useState<VoiceCreditsInternal | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [tierName, setTierName] = useState<string>('Free');
  const [isLoading, setIsLoading] = useState(true);
  const [balanceError, setBalanceError] = useState(false);
  const [balanceErrorKind, setBalanceErrorKind] = useState<VoiceBalanceErrorKind | null>(null);
  const [accessReason, setAccessReason] = useState<VoiceAccessReason>('loading');
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
      setBalanceError(false);
      setBalanceErrorKind(null);

      // Wait for auth — SecureStore hydrate + session-backup refresh (same as Apple sync)
      let token = await apiService.getToken();
      if (!token) {
        token = await apiService.refreshAuthSession();
      }
      if (!token && user?.id) {
        await new Promise((r) => setTimeout(r, 400));
        token = await apiService.refreshAuthSession();
      }
      if (!token && !user?.id) {
        // Logged out — unknown balance, not a connection failure
        setCredits(null);
        setBalanceError(true);
        setBalanceErrorKind('auth');
        setAccessReason('error');
        return;
      }

      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await apiService.getVoiceCreditsBalance();
          if (response?.success && response.credits) {
            const remaining = Number(response.credits.remaining ?? 0);
            setCredits({
              remaining: Number.isFinite(remaining) ? remaining : 0,
              monthlyAllowance: Number(response.credits.monthlyAllowance ?? 0),
              monthlyHardCap: response.credits.monthlyHardCap,
              usedThisMonth: Number(response.credits.usedThisMonth ?? 0),
              monthlyRemaining: Number(response.credits.monthlyRemaining ?? 0),
              purchasedCredits: Number(response.credits.purchasedCredits ?? 0),
              isUnlimited: !!response.credits.isUnlimited || !!response.credits.weekendUnlimitedActive,
              weekendUnlimitedActive: !!response.credits.weekendUnlimitedActive,
              weekendUnlimitedExpiresAt: response.credits.weekendUnlimitedExpiresAt ?? null,
              softCapWarning: response.credits.softCapWarning ?? null,
            });
            const normalized = normalizeSubscriptionTier(response.tier);
            setTier(normalized);
            setTierName(response.tierName || getTierDisplayName(response.tier));
            const reason = (response.reason || (response.canUse ? 'has_credits' : 'no_credits')) as VoiceAccessReason;
            setAccessReason(reason);
            setBalanceError(false);
            setBalanceErrorKind(null);
            return;
          }
          lastError = new Error('Voice balance response missing credits');
        } catch (error) {
          lastError = error;
          console.log(`[useVoiceCredits] Balance fetch attempt ${attempt + 1} failed:`, error);
          const kind = classifyVoiceBalanceError(error);
          // Auth failure: refresh once mid-loop then retry (getVoiceCreditsBalance also retries once)
          if (kind === 'auth' && attempt < 2) {
            await apiService.refreshAuthSession();
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }
      }

      console.log('[useVoiceCredits] Balance fetch failed after retries:', lastError);
      // Keep last known credits if any; balanceError/balanceReady gate exhausted UI
      setBalanceError(true);
      setBalanceErrorKind(classifyVoiceBalanceError(lastError));
      setAccessReason('error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);
  const fetchPackages = useCallback(async () => {
    try {
      const response = await apiService.getVoiceCreditPackages();
      const mapped = (response.packages || []).map((pkg) => ({
        id: pkg.id,
        credits: pkg.credits,
        name: pkg.name,
        description: pkg.description || pkg.name || (pkg.weekendUnlimited ? '2-Day Unlimited' : `${pkg.credits} voice credits`),
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
  }, [fetchBalance, fetchPackages, user?.id]);
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
    setCredits(prev => prev ? { ...prev, ...normalized } : {
      remaining: Number(normalized.remaining ?? 0),
      monthlyAllowance: Number(normalized.monthlyAllowance ?? 0),
      usedThisMonth: Number(normalized.usedThisMonth ?? 0),
      monthlyRemaining: Number(normalized.monthlyRemaining ?? 0),
      purchasedCredits: Number(normalized.purchasedCredits ?? 0),
      isUnlimited: !!normalized.isUnlimited,
      ...normalized,
    } as VoiceCreditsInternal);
    setBalanceError(false);
    setBalanceErrorKind(null);
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
        const iapReady = await appleIAPService.configure(user.id);
        if (!iapReady) {
          throw new Error(IAP_UNAVAILABLE_MESSAGE);
        }
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
      const response = await apiService.purchaseVoiceCredits(packageId, currentLanguage);
      if (!response.checkoutUrl) {
        throw new Error('Could not start checkout');
      }
      if (Platform.OS === 'web') {
        window.location.href = response.checkoutUrl;
        return response;
      }
      // Auth session closes the browser when Stripe returns to our HTTPS success URL
      const browserResult = await WebBrowser.openAuthSessionAsync(
        response.checkoutUrl,
        VOICE_CHECKOUT_SUCCESS_REDIRECT,
      );
      const returnUrl = getBrowserReturnUrl(browserResult);
      if (isVoiceCancelUrl(returnUrl)) {
        throwCancelledPurchase();
      }
      if ((browserResult.type === 'dismiss' || browserResult.type === 'cancel') && !isVoiceSuccessUrl(returnUrl)) {
        // User closed the sheet — payment may still have completed; refresh balance
        await refreshBalance().catch(() => {});
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
      await refreshBalance().catch(() => {});
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
  }, [refreshBalance, updateBalance, useAppleIAP, user?.id, currentLanguage]);
  const upgradeToPersonalStylist = useCallback(async () => {
    try {
      setIsPurchasing(true);
      const response = await apiService.createCheckoutSession('monthly', currentLanguage);
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
  }, [refreshBalance, currentLanguage]);
  const getNudgeForStylist = useCallback((stylistId: StylistId): StylistNudge => {
    return STYLIST_NUDGES[stylistId] || STYLIST_NUDGES.ruby;
  }, []);
  const normalizedTier = normalizeSubscriptionTier(tier);
  // Only treat remaining as a real number after a successful balance payload.
  // On fetch error with no prior success, remaining defaults to 0 — callers MUST check balanceError
  // (or balanceReady) before showing "0 spoken replies left" / top-up UI.
  const balanceReady = !balanceError && credits != null;
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
  const usageNudge = balanceReady ? getVoiceUsageNudge(credits) : null;
  const hasCredits = balanceReady && (weekendUnlimitedActive || remainingCredits > 0);
  const denialMessage = getVoiceAccessDenialMessage({
    reason: accessReason,
    hasMonthlyAllowance,
    usedThisMonth: credits?.usedThisMonth ?? 0,
    monthlyAllowance: credits?.monthlyAllowance ?? 0,
    balanceError,
    balanceErrorKind,
  });
  const shouldShowBuyPacks = useMemo(() => {
    if (!balanceReady || weekendUnlimitedActive) return false;
    if (!hasMonthlyAllowance && normalizedTier === 'free') return remainingCredits <= 0;
    if (!hasMonthlyAllowance) return false;
    if (remainingCredits <= 0) return true;
    if (credits?.softCapWarning === 'usage_high' || credits?.softCapWarning === 'approaching_limit') return true;
    return false;
  }, [balanceReady, credits?.softCapWarning, hasMonthlyAllowance, normalizedTier, remainingCredits, weekendUnlimitedActive]);
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
    balanceError,
    balanceReady,
    accessReason,
    denialMessage,
    hasCredits,
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

type VoiceCreditsContextValue = ReturnType<typeof useVoiceCreditsState>;

const VoiceCreditsContext = createContext<VoiceCreditsContextValue | null>(null);

export function useVoiceCredits() {
  const ctx = useContext(VoiceCreditsContext);
  if (!ctx) {
    throw new Error('useVoiceCredits must be used within a VoiceCreditsProvider');
  }
  return ctx;
}

export { STYLIST_NUDGES };
