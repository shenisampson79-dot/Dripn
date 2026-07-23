import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { StyleSheet, View, Pressable, Alert, Dimensions, Platform, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, SubscriptionColors, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SubscriptionTier } from "@/contexts/AuthContext";
import { normalizeSubscriptionTier, tierToBillingPlan, getBillingPlanDisplayName, preferHigherSubscriptionTier } from "@/utils/subscriptionTier";
import {
  getDfyBenefitForSubscription,
  subscriptionTierDisplayName,
} from "@/utils/dfyEntitlements";
import { currencyService } from "@/services/CurrencyService";
import { apiService } from "@/services/ApiService";
import {
  appleIAPService,
  IAP_UNAVAILABLE_MESSAGE,
  resolveTierFromCustomerInfo,
  serializeCustomerInfoForSync,
  serializeDfyCustomerInfoForSync,
  type IAPSubscriptionTier,
} from "@/services/AppleIAPService";
import {
  openAppleManageSubscriptions,
  shouldManageSubscriptionViaApple,
  shouldUseAppleIAP,
} from "@/utils/platformPayments";
import { getErrorMessage, openExternalUrl } from "@/utils/openExternalUrl";
import { shouldApplyTestingUnlock } from "@/utils/devTesting";
import {
  finalizeDfyPurchase,
  isApplePurchaseCancelled,
  runDfyCheckout,
} from "@/utils/dfyCheckout";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";
import type { DFYTier } from "@/services/DFYService";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

const SHOW_DFY_PURCHASE_UI = !FEATURE_FLAGS.hideDfyPurchaseUi;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
};

type SubscriptionScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Subscription">;
};

interface PlanFeature {
  text: string;
  included: boolean;
  bold?: boolean;
}

interface Plan {
  id: SubscriptionTier;
  displayTier: DisplayTier;
  name: string;
  price: string;
  altPrice: string;
  savingsLabel: string;
  period: string;
  description?: string;
  features: PlanFeature[];
  popular?: boolean;
  bestValue?: boolean;
  starter?: boolean;
  tagline?: string;
  footerLine?: string;
  gradientColors: readonly [string, string, ...string[]];
  accentColor: string;
  anchorStyle: 'highlight' | 'normal' | 'subtle';
}

type DisplayTier = 'free' | 'personal_stylist' | 'stylist_unlimited';

const getPlanFeatures = (t: (key: string) => string): Record<DisplayTier, PlanFeature[]> => {
  const tx = (key: string, fallback: string) => {
    const value = (t(key) || '').trim();
    return value || fallback;
  };

  return {
    free: [
      { text: tx('subscription.features.free.dailyDecision', '1 stylist decision per day'), included: true },
      { text: tx('subscription.features.free.compareTwo', 'Compare 2 shopping options'), included: true },
      { text: tx('subscription.features.free.wardrobe15', 'Up to 15 wardrobe items'), included: true },
      { text: tx('subscription.features.free.basicChat', 'Basic AI chat (10/day)'), included: true },
      { text: tx('subscription.features.free.decisionHistory', 'Decision history'), included: false },
      { text: tx('subscription.features.free.wardrobeAdvice', 'Wardrobe-aware advice'), included: false },
      { text: tx('subscription.features.free.outfitCalendar', 'Outfit calendar'), included: false },
    ],
    personal_stylist: [
      { text: tx('subscription.features.personalStylist.instantDecisions', 'Get instant outfit decisions (no overthinking)'), included: true },
      { text: tx('subscription.features.personalStylist.looksGood', 'Know what actually looks good on you'), included: true },
      { text: tx('subscription.features.personalStylist.confidence', 'Build confidence before you leave the house'), included: true },
      { text: tx('subscription.features.personalStylist.voiceAnswers', 'Voice your outfit and get instant answers'), included: true },
      { text: tx('subscription.features.personalStylist.outfitCalendar', 'Outfit calendar'), included: true },
      { text: tx('subscription.features.personalStylist.learnsStyle', 'Stylists learn your style over time'), included: true },
    ],
    stylist_unlimited: [
      { text: tx('subscription.features.stylistUnlimited.everythingPersonal', 'Everything in Personal Stylist'), included: true, bold: true },
      { text: tx('subscription.features.stylistUnlimited.fullWardrobe', 'See your full wardrobe instantly'), included: true },
      { text: tx('subscription.features.stylistUnlimited.systemWorks', 'Build a system that always works'), included: true },
      { text: tx('subscription.features.stylistUnlimited.voiceAnytime', 'Talk to your stylist by voice, anytime'), included: true },
      { text: tx('subscription.features.stylistUnlimited.eventPlanning', 'Event planning & sustainability tools'), included: true },
    ],
  };
};

const getPlanMetadata = (t: (key: string) => string, isYearly: boolean): Record<DisplayTier, { name: string; period: string; description?: string; popular?: boolean; bestValue?: boolean; tagline?: string; footerLine?: string }> => ({
  free: { name: t('subscription.plan.free.name'), period: t('subscription.plan.free.period'), description: t('subscription.plan.free.description') },
  personal_stylist: {
    name: t('subscription.plan.personalStylist.name'),
    period: isYearly ? t('subscription.period.year') : t('subscription.period.month'),
    footerLine: t('subscription.plan.personalStylist.footerLine'),
    popular: true,
  },
  stylist_unlimited: {
    name: t('subscription.plan.stylistUnlimited.name'),
    period: isYearly ? t('subscription.period.year') : t('subscription.period.month'),
    bestValue: true,
    footerLine: t('subscription.plan.stylistUnlimited.footerLine'),
  },
});

const getPlanSavings = (t: (key: string) => string): Record<DisplayTier, { save: string; yearlyEquiv?: string; badge?: string; altSuffix?: string }> => ({
  free: { save: '' },
  personal_stylist: { save: '£23.89', altSuffix: t('subscription.save20Percent'), badge: t('subscription.save20Percent') },
  stylist_unlimited: { save: '£47.89', altSuffix: t('subscription.save20Percent'), badge: t('subscription.save20Percent') },
});

const buildPlanPricing = (
  t: (key: string) => string,
  displayTier: DisplayTier,
  monthlyPrices: LocalizedPrices,
  yearlyPrices: LocalizedPrices,
  isYearly: boolean,
): { price: string; altPrice: string; savingsLabel: string; period: string } => {
  const monthly = monthlyPrices[displayTier];
  const yearly = yearlyPrices[displayTier];
  const savings = getPlanSavings(t)[displayTier];

  if (isYearly) {
    const savePart = savings.altSuffix
      ? `${savings.altSuffix} / ${savings.save} ${t('subscription.off')}`
      : `${t('subscription.save')} ${savings.save}`;
    return {
      price: yearly,
      altPrice: `${monthly}${t('subscription.perMonth')}`,
      savingsLabel: savePart,
      period: t('subscription.period.year'),
    };
  }
  // Monthly: price + period only — no save labels or annual alternate lines
  return {
    price: monthly,
    altPrice: '',
    savingsLabel: '',
    period: t('subscription.period.month'),
  };
};

interface LocalizedPrices {
  free: string;
  personal_stylist: string;
  stylist_unlimited: string;
}

const getLocalizedPlans = (t: (key: string) => string, monthlyPrices: LocalizedPrices, yearlyPrices: LocalizedPrices, isYearly: boolean): Plan[] => {
  const metadata = getPlanMetadata(t, isYearly);
  const planFeatures = getPlanFeatures(t);
  const planOrder: DisplayTier[] = ['personal_stylist', 'stylist_unlimited'];

  const planConfigs: Record<DisplayTier, Omit<Plan, 'price' | 'altPrice' | 'savingsLabel' | 'period'>> = {
    free: {
      id: 'free',
      displayTier: 'free',
      ...metadata.free,
      features: planFeatures.free,
      gradientColors: ['#2A2A3E', '#1A1A2E'] as const,
      accentColor: LUXURY_COLORS.champagne,
      anchorStyle: 'subtle',
    },
    personal_stylist: {
      id: 'personal_stylist',
      displayTier: 'personal_stylist',
      ...metadata.personal_stylist,
      features: planFeatures.personal_stylist,
      gradientColors: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald] as const,
      accentColor: LUXURY_COLORS.champagne,
      anchorStyle: 'normal',
    },
    stylist_unlimited: {
      id: 'stylist_unlimited',
      displayTier: 'stylist_unlimited',
      ...metadata.stylist_unlimited,
      features: planFeatures.stylist_unlimited,
      gradientColors: [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const,
      accentColor: LUXURY_COLORS.midnight,
      bestValue: true,
      anchorStyle: 'highlight',
    },
  };

  return planOrder.map((displayTier) => {
    const config = planConfigs[displayTier];
    const pricing = buildPlanPricing(t, displayTier, monthlyPrices, yearlyPrices, isYearly);
    return { ...config, ...pricing };
  });
};

const normalizeTier = normalizeSubscriptionTier;

const getTierDisplayName = (tier?: SubscriptionTier): string => {
  return getBillingPlanDisplayName(tier);
};

const getCurrentTierAccent = (tier?: SubscriptionTier, isDark = false): string => {
  switch (normalizeSubscriptionTier(tier)) {
    case 'stylist_unlimited': return LUXURY_COLORS.gold;
    case 'personal_stylist': return LUXURY_COLORS.teal;
    default: return isDark ? LUXURY_COLORS.champagne : LUXURY_COLORS.midnight;
  }
};

const getTierIcon = (tier?: SubscriptionTier): "award" | "star" | "message-circle" | "user" => {
  switch (normalizeSubscriptionTier(tier)) {
    case 'stylist_unlimited': return 'award';
    case 'personal_stylist': return 'message-circle';
    default: return 'user';
  }
};

export default function SubscriptionScreen({ navigation, route }: SubscriptionScreenProps & { route: any }) {
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const { user, refreshSubscriptionFromBackend, applyLocalSubscriptionTier } = useAuth();
  const scrollViewRef = useRef<any>(null);
  const plansSectionY = useRef(0);
  const checkoutInProgressRef = useRef(false);

  const normalizedTier = normalizeTier(user?.subscriptionTier);
  const dfyBenefit = getDfyBenefitForSubscription(normalizedTier);
  const currentTierAccent = getCurrentTierAccent(normalizedTier, isDark);
  const currentTierMutedLabel = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(26,26,46,0.6)';
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>(
    route?.params?.highlightPlan ?? (normalizedTier === 'free' ? 'personal_stylist' : normalizedTier)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isYearly, setIsYearly] = useState(true);
  const [localizedPrices, setLocalizedPrices] = useState<LocalizedPrices>({
    free: "Free",
    personal_stylist: "£9.99",
    stylist_unlimited: "£19.99",
  });
  const [yearlyPrices, setYearlyPrices] = useState<LocalizedPrices>({
    free: "Free",
    personal_stylist: "£95.99",
    stylist_unlimited: "£191.99",
  });
  const [dfyPrices, setDfyPrices] = useState<{ outfit_setup: string; wardrobe_setup: string }>({
    outfit_setup: "£19.99",
    wardrobe_setup: "£39.99",
  });
  const [winbackOffer50, setWinbackOffer50] = useState(false);
  const [winbackPausePrompt, setWinbackPausePrompt] = useState(false);
  const [devTestingMode, setDevTestingMode] = useState(false);
  const useAppleIAP = shouldUseAppleIAP();

  useEffect(() => {
    shouldApplyTestingUnlock(user).then(setDevTestingMode).catch(() => {});
  }, [user?.email, user?.isAdmin, user?.role]);

  useEffect(() => {
    if (!useAppleIAP || !user?.id) return;

    const initAppleIAP = async () => {
      try {
        await appleIAPService.configure(user.id);
        const prices = await appleIAPService.getSubscriptionPrices();
        if (prices.length === 0) return;

        const monthlyUpdates: Partial<LocalizedPrices> = {};
        const yearlyUpdates: Partial<LocalizedPrices> = {};
        for (const entry of prices) {
          if (entry.interval === 'monthly') {
            monthlyUpdates[entry.tier] = entry.priceString;
          } else {
            yearlyUpdates[entry.tier] = entry.priceString;
          }
        }
        if (Object.keys(monthlyUpdates).length > 0) {
          setLocalizedPrices((prev) => ({ ...prev, ...monthlyUpdates }));
        }
        if (Object.keys(yearlyUpdates).length > 0) {
          setYearlyPrices((prev) => ({ ...prev, ...yearlyUpdates }));
        }
      } catch (error) {
        console.warn('[Subscription] Apple IAP price load failed:', error);
      }
    };

    initAppleIAP();
  }, [useAppleIAP, user?.id]);

  // Recover sandbox / failed-sync purchases: if RevenueCat has a paid entitlement, push it
  // to the server even when local UI already shows a paid badge (local unlock can succeed
  // while /api/subscription/apple/sync fails — leaving voice credits stuck on free).
  useEffect(() => {
    if (!useAppleIAP || !user?.id) return;

    let cancelled = false;
    const recoverFromRevenueCat = async () => {
      try {
        const ready = await appleIAPService.configure(user.id);
        if (!ready || cancelled) return;
        const customerInfo = await appleIAPService.getCustomerInfo();
        const tier = resolveTierFromCustomerInfo(customerInfo);
        if (cancelled || tier === 'free') return;

        const localTier = normalizeTier(user.subscriptionTier);
        if (localTier === 'free' || preferHigherSubscriptionTier(localTier, tier) === tier) {
          await applyLocalSubscriptionTier(tier);
        }

        const syncPayload = serializeCustomerInfoForSync(customerInfo);
        if (!syncPayload.tier || syncPayload.tier === 'free') {
          syncPayload.tier = tier;
        }
        await apiService.syncAppleSubscription(syncPayload);
        await refreshSubscriptionFromBackend().catch(() => {});
        await apiService.flushPendingAppleSubscriptionSync().catch(() => {});
      } catch (error) {
        console.warn('[Subscription] RC entitlement recovery skipped:', error);
      }
    };

    recoverFromRevenueCat();
    return () => {
      cancelled = true;
    };
  }, [useAppleIAP, user?.id, user?.subscriptionTier, applyLocalSubscriptionTier, refreshSubscriptionFromBackend]);
  const [winbackBanner, setWinbackBanner] = useState<string | null>(null);
  const [upgradeHint, setUpgradeHint] = useState<string | null>(null);
  const [highlightPlans, setHighlightPlans] = useState(false);

  useEffect(() => {
    const params = route?.params ?? {};
    if (params.offer50) setWinbackOffer50(true);
    if (params.pause) setWinbackPausePrompt(true);
    if (params.winbackBanner) setWinbackBanner(params.winbackBanner);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const offer = search.get("offer");
      const pause = search.get("pause");
      const source = search.get("source");
      const campaign = search.get("campaign") ?? search.get("campaign_id");
      const cta = search.get("cta") ?? search.get("cta_id");
      const variant = search.get("variant");
      const userIdParam = search.get("user_id");

      if (offer === "50" || cta === "resume_50") {
        setWinbackOffer50(true);
        setWinbackBanner(t('subscription.winbackWelcome50'));
      }
      if (pause === "true" || cta === "pause") {
        setWinbackPausePrompt(true);
        setWinbackBanner((prev) => prev ?? t('subscription.winbackPauseBanner'));
      }
      if (cta === "downgrade") {
        setSelectedPlan("personal_stylist");
      }

      if (source === "winback_email") {
        apiService.logAnalyticsEvent({
          event: "winback_landing",
          source,
          campaign: campaign ?? undefined,
          cta: cta ?? undefined,
          variant: variant ?? undefined,
          metadata: userIdParam ? { user_id: userIdParam, campaign_id: campaign, cta_id: cta } : undefined,
        }).catch(() => {});
      }

      if (search.toString()) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [route?.params, t]);

  useEffect(() => {
    const initCurrency = async () => {
      await currencyService.initialize();
      setLocalizedPrices(currencyService.getLocalizedPrices());
      setYearlyPrices(currencyService.getYearlyPrices());
      setDfyPrices(currencyService.getDFYPrices());
    };
    initCurrency();
  }, []);

  const openPaidDfyCheckout = async (tier: DFYTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (useAppleIAP && !user?.id) {
      Alert.alert(t('dfy.comparison.signInRequiredTitle'), t('dfy.comparison.signInRequiredApple'));
      return;
    }
    if (!useAppleIAP && !user?.email) {
      Alert.alert(t('dfy.comparison.signInRequiredTitle'), t('dfy.comparison.emailRequired'));
      return;
    }

    setIsProcessing(true);
    try {
      const outcome = await runDfyCheckout({
        tier,
        email: user?.email,
        userId: user?.id,
        language: currentLanguage,
      });

      if (outcome === 'success') {
        await finalizeDfyPurchase(tier);
        refreshSubscriptionFromBackend().catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (tier === 'lite') {
          Alert.alert(
            t('dfy.comparison.paymentSuccessTitle'),
            t('dfy.comparison.paymentSuccessLiteMessage'),
            [
              {
                text: t('dfy.comparison.getPersonalStylist'),
                onPress: () => navigation.navigate('Subscription', { highlightPlan: 'personal_stylist' }),
              },
              {
                text: t('dfy.comparison.continueSetup'),
                onPress: () => navigation.navigate('DFYTravelPlan'),
                style: 'cancel',
              },
            ],
          );
        } else {
          Alert.alert(
            t('dfy.comparison.paymentSuccessTitle'),
            t('dfy.comparison.paymentSuccessCoreMessage'),
            [{ text: t('common.continue'), onPress: () => navigation.navigate('DFYUpload', { type: 'core' }) }],
          );
        }
        return;
      }

      if (outcome === 'failed') {
        Alert.alert(
          t('dfy.comparison.paymentNotCompletedTitle'),
          t('dfy.comparison.paymentNotCompletedMessage'),
          [{ text: t('common.done') }],
        );
        return;
      }

      Alert.alert(
        t('dfy.comparison.checkoutCancelledTitle'),
        t('dfy.comparison.checkoutCancelledMessage'),
        [{ text: t('common.done') }],
      );
    } catch (error: unknown) {
      if (isApplePurchaseCancelled(error)) {
        Alert.alert(
          t('dfy.comparison.purchaseCancelledTitle'),
          t('dfy.comparison.purchaseCancelledMessage'),
          [{ text: t('common.done') }],
        );
        return;
      }
      console.error('DFY checkout error:', error);
      Alert.alert(
        t('dfy.comparison.paymentErrorTitle'),
        error instanceof Error ? error.message : t('dfy.comparison.checkoutStartFailed'),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartIncludedDfy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('DFYStart');
  };

  // Scroll to DFY section if navigated from upgrade flow (no-op while purchase UI is hidden)
  useEffect(() => {
    if (!SHOW_DFY_PURCHASE_UI) return;
    if (route?.params?.scrollToDFY && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [route?.params?.scrollToDFY]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('subscription.screenTitle') });
  }, [navigation, t]);

  const PLANS = getLocalizedPlans(t, localizedPrices, yearlyPrices, isYearly);

  const completeApplePurchase = async (tier: IAPSubscriptionTier, interval: 'monthly' | 'yearly', planName: string) => {
    const customerInfo = await appleIAPService.purchaseSubscription(tier, interval);
    // Apple / StoreKit already charged — unlock immediately even if backend sync fails.
    const fromRc = resolveTierFromCustomerInfo(customerInfo);
    const unlockedTier = fromRc !== 'free' ? fromRc : normalizeSubscriptionTier(tier);
    await applyLocalSubscriptionTier(unlockedTier);

    const syncPayload = serializeCustomerInfoForSync(customerInfo);
    // Ensure sync payload carries the purchased tier when RC entitlement mapping is delayed
    if (!syncPayload.tier || syncPayload.tier === 'free') {
      syncPayload.tier = unlockedTier;
    }

    try {
      await apiService.syncAppleSubscription(syncPayload);
      await refreshSubscriptionFromBackend().catch(() => {});
    } catch (syncError) {
      console.warn(
        '[Subscription] Backend sync failed after successful Apple purchase — local unlock kept; retry queued',
        syncError,
      );
      // Background retry (auth may recover shortly after the long StoreKit sheet)
      setTimeout(() => {
        apiService.flushPendingAppleSubscriptionSync().catch(() => {});
      }, 2500);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      t('subscription.subscriptionActiveTitle'),
      t('subscription.subscriptionActiveMessage').replace('{planName}', planName),
      [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
    );
  };

  const handleRestorePurchases = async () => {
    if (!useAppleIAP) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);
    try {
      if (!user?.id) throw new Error(t('subscription.signInToRestore'));
      const iapReady = await appleIAPService.configure(user.id);
      if (!iapReady) throw new Error(IAP_UNAVAILABLE_MESSAGE);
      const customerInfo = await appleIAPService.restorePurchases();
      const subscriptionPayload = serializeCustomerInfoForSync(customerInfo);
      const dfyPayload = serializeDfyCustomerInfoForSync(customerInfo);

      let restoredSomething = false;
      let serverSynced = false;
      const restoredTier = resolveTierFromCustomerInfo(customerInfo);

      // Unlock locally first so sandbox restores recover even if backend returns 401
      if (restoredTier !== 'free') {
        await applyLocalSubscriptionTier(restoredTier);
        restoredSomething = true;
      }

      if (subscriptionPayload.tier !== 'free') {
        try {
          await apiService.syncAppleSubscription(subscriptionPayload);
          serverSynced = true;
          restoredSomething = true;
        } catch (syncError) {
          console.warn('[Subscription] Restore sync failed; local unlock kept', syncError);
          const detail = syncError instanceof Error ? syncError.message : String(syncError);
          Alert.alert(
            t('subscription.restoreFailedTitle') || 'Could not sync subscription',
            (t('subscription.restoreSyncFailedMessage')
              || 'Apple restored your purchase on this phone, but we could not update your account on the server. Voice and outfit features may stay limited until this succeeds. Try again in a moment.')
              + (detail ? `\n\n${detail}` : ''),
          );
          return;
        }
      }

      if (dfyPayload.tier) {
        try {
          await apiService.syncAppleDFYPurchase(dfyPayload);
          restoredSomething = true;
        } catch (syncError) {
          console.warn('[Subscription] DFY restore sync failed', syncError);
          restoredSomething = true;
        }
      }

      if (!restoredSomething) {
        Alert.alert(t('subscription.noPurchasesTitle'), t('subscription.noPurchasesMessage'));
        return;
      }

      await refreshSubscriptionFromBackend().catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('subscription.restoredTitle'),
        serverSynced
          ? t('subscription.restoredMessage')
          : (t('subscription.restoredLocalOnlyMessage')
            || 'Your plan badge was restored. Open this screen again if voice limits still look wrong.'),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('subscription.restoreFailedMessage');
      Alert.alert(t('subscription.restoreFailedTitle'), message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    if (checkoutInProgressRef.current || isProcessing) return;
    if (planId === normalizeTier(user?.subscriptionTier)) return;

    checkoutInProgressRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    
    try {
      if (planId === "free") {
        if (normalizedTier && normalizedTier !== 'free') {
          const status = await apiService.getSubscriptionStatus().catch(() => null);
          const viaApple = shouldManageSubscriptionViaApple({
            billingPlatform: status?.billingPlatform,
            hasStripeBilling: status?.hasStripeBilling,
            stripeSubscriptionId: status?.stripeSubscriptionId,
          });

          if (viaApple || (useAppleIAP && !status?.hasStripeBilling && !status?.stripeSubscriptionId)) {
            Alert.alert(
              t('subscription.cancel.appleCancelTitle') || 'Manage in the App Store',
              t('subscription.cancel.appleCancelMessage') ||
                'This subscription is billed through Apple. Cancel or change it in Settings → Apple ID → Subscriptions.',
              [
                {
                  text: t('subscription.cancel.appleCancelManage') || 'Manage Subscription',
                  onPress: () => openAppleManageSubscriptions().catch(() => {}),
                },
                { text: t('common.ok'), style: 'cancel' },
              ],
            );
            return;
          }

          // Stripe: route through retention cancel flow instead of silent cancel
          navigation.navigate('CancelSubscription');
          return;
        } else {
          navigation.goBack();
        }
      } else {
        const billingCycle = isYearly ? 'yearly' : 'monthly';
        const planName = PLANS.find(p => p.id === planId)?.name ?? planId;

        if (useAppleIAP && (planId === 'personal_stylist' || planId === 'stylist_unlimited')) {
          if (!user?.id) {
            throw new Error(t('subscription.signInToSubscribe'));
          }
          const iapReady = await appleIAPService.configure(user.id);
          if (!iapReady) {
            throw new Error(IAP_UNAVAILABLE_MESSAGE);
          }
          try {
            await completeApplePurchase(planId as IAPSubscriptionTier, billingCycle, planName);
          } catch (error: unknown) {
            if (error && typeof error === 'object' && 'cancelled' in error && (error as { cancelled?: boolean }).cancelled) {
              return;
            }
            throw error;
          }
          return;
        }

        const billingPlan = tierToBillingPlan(planId);

        const checkout = await apiService.createSubscriptionCheckout(billingPlan, billingCycle, currentLanguage);
        if (!checkout.checkoutUrl) {
          throw new Error(t('subscription.checkoutStartFailed'));
        }

        const result = await WebBrowser.openBrowserAsync(checkout.checkoutUrl);

        if (result.type === "dismiss" || result.type === "cancel") {
          // Silently try to refresh subscription as webhook may have already fired
          refreshSubscriptionFromBackend().catch(() => {});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            t('subscription.almostThereTitle'),
            t('subscription.almostThereMessage').replace('{planName}', planName),
            [
              {
                text: t('subscription.refresh'),
                onPress: async () => {
                  await refreshSubscriptionFromBackend().catch(() => {});
                  navigation.goBack();
                },
              },
              { text: t('common.done'), onPress: () => navigation.goBack() },
            ]
          );
        }
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      const errorMessage = error?.message || t('subscription.paymentPageFailed');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      checkoutInProgressRef.current = false;
      setIsProcessing(false);
    }
  };

  const scrollToPlans = (message?: string) => {
    if (message) {
      setUpgradeHint(message);
    }
    setHighlightPlans(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, plansSectionY.current - 24),
        animated: true,
      });
    }, 100);
    setTimeout(() => setHighlightPlans(false), 3000);
  };

  const handleManageSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Apple's manage sheet owns the UI and only resolves when dismissed — don't lock
    // our buttons / swap labels to "Processing" for the whole visit (felt like shaking + lag).
    if (useAppleIAP && normalizedTier !== 'free') {
      try {
        await openAppleManageSubscriptions();
      } catch (error: unknown) {
        console.error('Apple manage subscriptions error:', error);
        Alert.alert(
          t('subscription.billingUnavailableTitle'),
          getErrorMessage(error, t('subscription.billingUnavailableMessage')),
        );
      }
      return;
    }

    setIsProcessing(true);
    try {
      const devTesting = await shouldApplyTestingUnlock(user);
      if (devTesting) {
        Alert.alert(t('subscription.testingModeTitle'), t('subscription.testingModeMessage'));
        return;
      }

      await apiService.verifySubscription().catch(() => {});

      const status = await apiService.getSubscriptionStatus().catch(() => null);
      const returnUrl =
        Platform.OS === 'web'
          ? 'https://dripnapp.com/subscription'
          : 'dripn://subscription';

      let response = await apiService.openBillingPortal(returnUrl);

      if (response.mode !== 'portal' && !response.url) {
        await apiService.verifySubscription().catch(() => {});
        response = await apiService.openBillingPortal(returnUrl);
      }

      if (response.mode === 'portal' && response.url) {
        await openExternalUrl(response.url);
        refreshSubscriptionFromBackend().catch(() => {});
        return;
      }

      if (response.url) {
        await openExternalUrl(response.url);
        refreshSubscriptionFromBackend().catch(() => {});
        return;
      }

      const isPaidTier = normalizedTier !== 'free';
      if (isPaidTier && !status?.isTrial) {
        Alert.alert(t('subscription.noBillingAccountTitle'), t('subscription.noBillingAccountMessage'));
        return;
      }

      scrollToPlans(
        status?.isTrial
          ? t('subscription.upgradeHintTrial')
          : t('subscription.upgradeHintSubscribe'),
      );
    } catch (error: unknown) {
      console.error("Billing portal error:", error);
      Alert.alert(
        t('subscription.billingUnavailableTitle'),
        getErrorMessage(error, t('subscription.billingUnavailableMessage')),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyWinbackDiscount = async () => {
    if (normalizedTier === 'free') {
      Alert.alert(t('subscription.choosePlanTitle'), t('subscription.choosePlanWinbackMessage'));
      return;
    }
    setIsProcessing(true);
    try {
      const result = await apiService.applySubscriptionDiscount({
        offer: 'retention_50',
        acceptedOffer: 'discount_50',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        t('subscription.discountAppliedTitle'),
        result.message || t('subscription.discountAppliedMessage'),
        [{ text: t('subscription.great') }]
      );
      setWinbackOffer50(false);
    } catch (error: any) {
      Alert.alert(t('subscription.offerUnavailableTitle'), error?.message || t('subscription.offerUnavailableMessage'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWinbackPause = async () => {
    if (normalizedTier === 'free') {
      Alert.alert(t('subscription.subscribeFirstTitle'), t('subscription.subscribeFirstMessage'));
      return;
    }
    setIsProcessing(true);
    try {
      const result = await apiService.pauseSubscription({
        months: 1,
        acceptedOffer: 'pause_1_month_free',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(t('subscription.planPausedTitle'), result.message || t('subscription.planPausedMessage'), [{ text: t('common.ok') }]);
      setWinbackPausePrompt(false);
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('subscription.pauseFailedMessage'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivateSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    try {
      await apiService.reactivateSubscription();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('subscription.reactivatedTitle'),
        t('subscription.reactivatedMessage'),
        [{ text: t('common.ok') }]
      );
    } catch (error: any) {
      console.error("Reactivation error:", error);
      Alert.alert(t('common.error'), error.message || t('subscription.reactivateFailedMessage'));
    } finally {
      setIsProcessing(false);
    }
  };


  const getDfyBenefitDisplayTitle = () => {
    if (dfyBenefit === 'none') return t('subscription.dfy.included.defaultTitle');
    if (dfyBenefit === 'styling_sprint') return t('subscription.dfy.included.occasionReadyTitle');
    return t('subscription.dfy.included.fullWardrobeTitle');
  };

  const getDfyBenefitDisplaySubtitle = () => {
    if (dfyBenefit === 'none') return t('subscription.dfy.included.noneSubtitle');
    if (dfyBenefit === 'styling_sprint') return t('subscription.dfy.included.sprintSubtitle');
    return t('subscription.dfy.included.fullSubtitle');
  };

  const getDfyIncludedFeatureKeys = (): string[] => {
    if (dfyBenefit === 'none') {
      return [
        'subscription.dfy.included.featureNone1',
        'subscription.dfy.included.featureNone2',
        'subscription.dfy.included.featureNone3',
        'subscription.dfy.included.featureNone4',
      ];
    }
    if (dfyBenefit === 'styling_sprint') {
      return [
        'subscription.dfy.included.featureSprint1',
        'subscription.dfy.included.featureSprint2',
        'subscription.dfy.included.featureSprint3',
        'subscription.dfy.included.featureSprint4',
      ];
    }
    return [
      'subscription.dfy.included.featureFull1',
      'subscription.dfy.included.featureFull2',
      'subscription.dfy.included.featureFull3',
      'subscription.dfy.included.featureFull4',
    ];
  };

  // Keep in sync with DFYService COMPARISON_TIERS feature lists
  const getWardrobeSetupFeatureKeys = () => [
    'subscription.dfy.wardrobe.feature1',
    'subscription.dfy.wardrobe.feature2',
    'subscription.dfy.wardrobe.feature3',
    'subscription.dfy.wardrobe.feature4',
  ];

  const getOccasionReadyFeatureKeys = () => [
    'subscription.dfy.occasion.feature1',
    'subscription.dfy.occasion.feature2',
    'subscription.dfy.occasion.feature3',
    'subscription.dfy.occasion.feature4',
  ];

  const getOccasionReadyExcludedKeys = () => [
    'subscription.dfy.occasion.excluded1',
    'subscription.dfy.occasion.excluded2',
  ];


  const renderPlanCard = (plan: Plan) => {
    const isSelected = selectedPlan === plan.id;
    const isCurrent = plan.id === normalizedTier;
    const savingsInfo = getPlanSavings(t)[plan.displayTier];
    const anchorStyles = {
      highlight: { priceSize: 36, cardOpacity: 1, priceOpacity: 1 },
      normal: { priceSize: 30, cardOpacity: 1, priceOpacity: 1 },
      subtle: { priceSize: 26, cardOpacity: 0.85, priceOpacity: 0.65 },
    }[plan.anchorStyle];

    return (
      <Pressable
        key={plan.id}
        onPress={() => setSelectedPlan(plan.id)}
        style={({ pressed }) => [
          styles.planCard,
          {
            borderColor: isSelected ? plan.accentColor : "transparent",
            borderWidth: isSelected ? 2 : 0,
            opacity: pressed ? anchorStyles.cardOpacity * 0.95 : anchorStyles.cardOpacity,
            transform: [{ scale: pressed ? 0.98 : plan.anchorStyle === 'highlight' ? 1.01 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={plan.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.planGradient,
            plan.popular && isCurrent && styles.planGradientWithCurrentRibbon,
          ]}
        >
          {plan.popular ? (
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.popularBadge}
            >
              <ThemedText type="caption" style={styles.popularText}>
                {t('subscription.mostPopular')}
              </ThemedText>
            </LinearGradient>
          ) : null}

          {plan.starter ? (
            <View style={styles.starterBadge}>
              <ThemedText type="caption" style={styles.starterText}>
                {t('subscription.starter')}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.planHeader}>
            <View style={[styles.planNameContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <ThemedText type="h3" style={styles.planName}>
                {plan.name}
              </ThemedText>
            </View>
            {isCurrent && !plan.popular ? (
              <View style={[styles.currentBadge, { backgroundColor: LUXURY_COLORS.emerald }]}>
                <ThemedText type="caption" style={styles.currentText}>
                  {t('subscription.currentPlan')}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {isCurrent && plan.popular ? (
            <View style={[styles.currentBadge, styles.currentBadgeBelowPopular, { backgroundColor: LUXURY_COLORS.emerald }]}>
              <ThemedText type="caption" style={styles.currentText}>
                {t('subscription.currentPlan')}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.priceContainer}>
            <ThemedText
              type="h1"
              style={[
                styles.price,
                {
                  color: '#FFFFFF',
                  fontSize: anchorStyles.priceSize,
                  opacity: anchorStyles.priceOpacity,
                },
              ]}
            >
              {plan.price}
            </ThemedText>
            <ThemedText type="body" style={[styles.period, { color: 'rgba(255,255,255,0.7)' }]}>
              {plan.period?.startsWith('/') ? ` ${plan.period.trimStart()}` : plan.period}
            </ThemedText>
          </View>

          {isYearly && plan.savingsLabel ? (
            <View style={styles.savingsRow}>
              <ThemedText type="small" style={styles.savingsLabel}>
                ({plan.savingsLabel})
              </ThemedText>
              {plan.bestValue && savingsInfo.badge ? (
                <View style={styles.bestValueBadge}>
                  <ThemedText type="caption" style={styles.bestValueText}>
                    {savingsInfo.badge}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {plan.description ? (
            <ThemedText type="body" style={[styles.planDescription, { color: 'rgba(255,255,255,0.8)' }]}>
              {plan.description}
            </ThemedText>
          ) : null}

          {plan.tagline ? (
            <ThemedText type="small" style={styles.planTagline}>
              {plan.tagline}
            </ThemedText>
          ) : null}

          <View style={styles.featuresContainer}>
            {plan.features.map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <View style={[
                  styles.featureIcon,
                  { backgroundColor: feature.included ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }
                ]}>
                  <Feather
                    name={feature.included ? "check" : "x"}
                    size={12}
                    color={feature.included ? plan.accentColor : 'rgba(255,255,255,0.3)'}
                  />
                </View>
                <ThemedText
                  type="small"
                  style={[
                    styles.featureText,
                    { color: feature.included ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
                    feature.bold && styles.featureBold,
                  ]}
                >
                  {feature.text}
                </ThemedText>
              </View>
            ))}
          </View>

          {plan.footerLine ? (
            <ThemedText type="caption" style={styles.planFooterLine}>
              {plan.footerLine}
            </ThemedText>
          ) : null}

          {isSelected && !isCurrent ? (
            <View style={[
              styles.selectedIndicator, 
              { backgroundColor: plan.accentColor },
              plan.popular && styles.selectedIndicatorBelowBadge
            ]}>
              <Feather 
                name="check" 
                size={16} 
                color={plan.id === 'stylist_unlimited' ? '#FFFFFF' : LUXURY_COLORS.midnight} 
              />
            </View>
          ) : null}

          {isSelected && !isCurrent ? (
            <Pressable
              onPress={() => handleSelectPlan(plan.id)}
              disabled={isProcessing}
              style={[styles.inlineSubscribeButton, { backgroundColor: plan.accentColor }]}
            >
              <ThemedText 
                type="body" 
                style={[
                  styles.inlineSubscribeButtonText,
                  { color: plan.id === 'stylist_unlimited' ? '#FFFFFF' : LUXURY_COLORS.midnight }
                ]}
              >
                {isProcessing ? t('subscription.processing') : t('subscription.startPlan').replace('{planName}', plan.name)}
              </ThemedText>
            </Pressable>
          ) : null}

          {isSelected && isCurrent ? (
            <Pressable
              onPress={handleManageSubscription}
              disabled={isProcessing}
              style={[styles.inlineSubscribeButton, { backgroundColor: plan.accentColor }]}
            >
              <ThemedText
                type="body"
                style={[
                  styles.inlineSubscribeButtonText,
                  { color: plan.id === 'stylist_unlimited' ? '#FFFFFF' : LUXURY_COLORS.midnight },
                ]}
              >
                {isProcessing
                  ? t('subscription.processing')
                  : (t('subscription.manageSubscription') || 'Manage Subscription')}
              </ThemedText>
            </Pressable>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <ScreenScrollView ref={scrollViewRef} style={{ backgroundColor: isDark ? '#0D0B09' : '#FAF8F5' }}>
      {(winbackBanner || winbackOffer50 || winbackPausePrompt) ? (
        <View style={[styles.winbackBanner, { backgroundColor: isDark ? 'rgba(201,168,124,0.15)' : 'rgba(201,168,124,0.25)' }]}>
          {winbackBanner ? (
            <ThemedText type="body" style={styles.winbackBannerText}>{winbackBanner}</ThemedText>
          ) : null}
          {winbackOffer50 ? (
            <Pressable
              onPress={handleApplyWinbackDiscount}
              disabled={isProcessing}
              style={[styles.winbackCta, { backgroundColor: LUXURY_COLORS.gold }]}
            >
              <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700' }}>
                {isProcessing ? t('subscription.processing') : t('subscription.apply50Off')}
              </ThemedText>
            </Pressable>
          ) : null}
          {winbackPausePrompt ? (
            <Pressable
              onPress={handleWinbackPause}
              disabled={isProcessing}
              style={[styles.winbackCtaOutline, { borderColor: LUXURY_COLORS.gold }]}
            >
              <ThemedText type="body" style={{ color: LUXURY_COLORS.gold, fontWeight: '600' }}>
                {t('subscription.pausePlanInstead')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.currentTierSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
        <View style={styles.currentTierRow}>
          <View style={[styles.currentTierIcon, { backgroundColor: currentTierAccent + '20' }]}>
            <Feather 
              name={getTierIcon(normalizedTier)} 
              size={20} 
              color={currentTierAccent} 
            />
          </View>
          <View style={styles.currentTierText}>
            <ThemedText type="small" style={{ color: currentTierMutedLabel }}>{t('subscription.youreOn')}</ThemedText>
            <ThemedText type="h3">
              {getTierDisplayName(normalizedTier)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.manageActions}>
          <Pressable 
            onPress={handleManageSubscription}
            disabled={isProcessing}
            style={[
              styles.manageButton,
              {
                borderColor: currentTierAccent + (isDark ? '40' : '25'),
                backgroundColor: normalizedTier === 'free' && !isDark ? 'rgba(26,26,46,0.04)' : 'transparent',
              },
            ]}
          >
            <Feather name="settings" size={16} color={currentTierAccent} />
            <ThemedText type="body" style={{ color: currentTierAccent, fontWeight: '600' }}>
              {normalizedTier === 'free'
                ? (useAppleIAP ? t('subscription.upgradeManage') : t('subscription.upgradeManageBilling'))
                : (useAppleIAP ? t('subscription.manageSubscription') : t('subscription.manageBilling'))}
            </ThemedText>
            {isProcessing ? (
              <ActivityIndicator size="small" color={currentTierAccent} style={{ marginLeft: Spacing.sm }} />
            ) : null}
          </Pressable>
          {useAppleIAP ? (
            <Pressable
              onPress={handleRestorePurchases}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel={t('subscription.restorePurchases')}
              style={[
                styles.manageButton,
                {
                  borderColor: LUXURY_COLORS.teal + (isDark ? '55' : '35'),
                  backgroundColor: isDark ? 'rgba(61, 153, 148, 0.12)' : 'rgba(61, 153, 148, 0.08)',
                },
              ]}
            >
              <Feather name="refresh-cw" size={16} color={LUXURY_COLORS.teal} />
              <ThemedText type="body" style={{ color: LUXURY_COLORS.teal, fontWeight: '600' }}>
                {isProcessing ? t('subscription.restoring') : t('subscription.restorePurchases')}
              </ThemedText>
            </Pressable>
          ) : null}
          {normalizedTier !== 'free' ? (
            <ThemedText type="caption" style={[styles.billingHint, { color: theme.tabIconDefault }]}>
              {useAppleIAP
                ? t('subscription.billingHintApple')
                : devTestingMode
                  ? t('subscription.billingHintTesting')
                  : t('subscription.billingHintStripe')}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {upgradeHint ? (
        <View style={[styles.upgradeHintBanner, { backgroundColor: isDark ? 'rgba(201,168,124,0.15)' : 'rgba(201,168,124,0.25)' }]}>
          <Feather name="arrow-down" size={16} color={LUXURY_COLORS.gold} />
          <ThemedText type="body" style={styles.upgradeHintText}>{upgradeHint}</ThemedText>
        </View>
      ) : null}

      <View style={styles.billingToggleContainer}>
        <Pressable
          onPress={() => setIsYearly(false)}
          style={[
            styles.billingToggleButton,
            !isYearly && styles.billingToggleButtonActive,
            { backgroundColor: !isYearly ? LUXURY_COLORS.gold : 'transparent' }
          ]}
        >
          <ThemedText 
            type="body" 
            style={[
              styles.billingToggleText,
              !isYearly && styles.billingToggleTextActive
            ]}
          >
            {t('subscription.billingMonthly')}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setIsYearly(true)}
          style={[
            styles.billingToggleButton,
            isYearly && styles.billingToggleButtonActive,
            { backgroundColor: isYearly ? LUXURY_COLORS.gold : 'transparent' }
          ]}
        >
          <View style={styles.yearlyToggleContent}>
            <ThemedText 
              type="body" 
              style={[
                styles.billingToggleText,
                isYearly && styles.billingToggleTextActive
              ]}
            >
              {t('subscription.billingYearly')}
            </ThemedText>
            <View style={[styles.savingsBadge, { backgroundColor: isYearly ? '#fff' : LUXURY_COLORS.emerald }]}>
              <ThemedText type="caption" style={[styles.savingsText, { color: isYearly ? LUXURY_COLORS.emerald : '#fff' }]}>
                {t('subscription.save20Percent')}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      </View>

      <View
        style={[
          styles.plansContainer,
          highlightPlans && {
            borderWidth: 2,
            borderColor: LUXURY_COLORS.gold,
            borderRadius: BorderRadius.lg,
          },
        ]}
        onLayout={(event) => {
          plansSectionY.current = event.nativeEvent.layout.y;
        }}
      >
        <ThemedText type="h2" style={styles.sectionTitle}>{t('subscription.chooseYourPlan')}</ThemedText>
        {PLANS.map(renderPlanCard)}
      </View>

      <View style={styles.finePrint}>
        <ThemedText type="small" style={styles.finePrintText}>
          {useAppleIAP ? t('subscription.finePrintApple') : t('subscription.finePrintStripe')}
          <ThemedText
            type="small"
            style={[styles.finePrintText, { color: theme.link, textDecorationLine: 'underline' }]}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            {t('subscription.termsOfService')}
          </ThemedText>
          {' '}{t('subscription.finePrintAnd')}{' '}
          <ThemedText
            type="small"
            style={[styles.finePrintText, { color: theme.link, textDecorationLine: 'underline' }]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            {t('subscription.privacyPolicy')}
          </ThemedText>
          .
        </ThemedText>
      </View>

      {SHOW_DFY_PURCHASE_UI ? (
        <>
          <View style={styles.dfySection}>
            <View style={styles.dfySectionHeader}>
              <ThemedText type="h2" style={styles.sectionTitle}>
                {t('subscription.dfy.includedSectionTitle')}
              </ThemedText>
              <ThemedText type="body" style={styles.dfySectionSubtitle}>
                {dfyBenefit === 'none' ? t('subscription.dfy.includedSectionSubtitle') : getDfyBenefitDisplaySubtitle()}
              </ThemedText>
            </View>

            <Pressable
              style={styles.dfyCardWrapper}
              onPress={handleStartIncludedDfy}
            >
              <LinearGradient
                colors={
                  dfyBenefit === 'full_wardrobe_setup'
                    ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
                    : dfyBenefit === 'styling_sprint'
                      ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
                      : [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.dfyCard, dfyBenefit === 'full_wardrobe_setup' && styles.dfyCardFeatured]}
              >
                {dfyBenefit !== 'none' ? (
                  <View style={[styles.dfyPopularBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                      {t('subscription.dfy.yourBenefit')}
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.dfyCardHeader}>
                  <View style={[styles.dfyBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="gift" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.dfyCardTitleContainer}>
                    <ThemedText type="h3" style={{ color: '#FFFFFF' }}>
                      {getDfyBenefitDisplayTitle()}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {dfyBenefit === 'none'
                        ? t('subscription.dfy.included.defaultCaption')
                        : t('subscription.dfy.included.benefitCaption').replace('{tier}', subscriptionTierDisplayName(normalizedTier))}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="body" style={[styles.dfyDescription, { color: 'rgba(255,255,255,0.9)' }]}>
                  {dfyBenefit === 'none'
                    ? t('subscription.dfy.included.noneDescription')
                    : dfyBenefit === 'styling_sprint'
                      ? t('subscription.dfy.included.sprintDescription')
                      : t('subscription.dfy.included.fullDescription')}
                </ThemedText>
                <View style={styles.dfyFeatures}>
                  {getDfyIncludedFeatureKeys().map((featureKey, idx) => (
                    <View key={idx} style={styles.dfyFeatureRow}>
                      <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                      <ThemedText type="small" style={{ color: '#FFFFFF' }}>{t(featureKey)}</ThemedText>
                    </View>
                  ))}
                </View>
                <View style={[styles.dfyButtonGradient, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Pressable style={styles.dfyButtonInner} onPress={handleStartIncludedDfy}>
                    <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      {dfyBenefit === 'none' ? t('subscription.dfy.seeWhatsIncluded') : t('subscription.dfy.startMySetup')}
                    </ThemedText>
                  </Pressable>
                </View>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.dfySection}>
            <View style={styles.dfySectionHeader}>
              <ThemedText type="h2" style={styles.sectionTitle}>
                {t('subscription.dfy.paidSectionTitle')}
              </ThemedText>
              <ThemedText type="body" style={styles.dfySectionSubtitle}>
                {t('subscription.dfy.paidSectionSubtitle')}
              </ThemedText>
            </View>

            <Pressable style={styles.dfyCardWrapper}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.dfyCard, styles.dfyCardFeatured]}
              >
                <View style={[styles.dfyPopularBadge, { backgroundColor: 'rgba(26,26,46,0.3)' }]}>
                  <ThemedText type="caption" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700' }}>
                    {t('subscription.dfy.structural')}
                  </ThemedText>
                </View>
                <View style={styles.dfyCardHeader}>
                  <View style={[styles.dfyBadge, { backgroundColor: 'rgba(26,26,46,0.2)' }]}>
                    <Feather name="grid" size={18} color={LUXURY_COLORS.midnight} />
                  </View>
                  <View style={styles.dfyCardTitleContainer}>
                    <ThemedText type="h3" style={{ color: LUXURY_COLORS.midnight }}>{t('subscription.dfy.wardrobe.title')}</ThemedText>
                    <ThemedText type="caption" style={{ color: 'rgba(26,26,46,0.6)' }}>{t('subscription.dfy.oneTimePurchase')}</ThemedText>
                  </View>
                </View>
                <View style={styles.dfyPriceRow}>
                  <ThemedText type="h1" style={[styles.dfyPrice, { color: LUXURY_COLORS.midnight }]}>
                    {dfyPrices.wardrobe_setup}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={[styles.dfyDescription, { color: 'rgba(26,26,46,0.85)' }]}>
                  {t('subscription.dfy.wardrobe.description')}
                </ThemedText>
                <View style={styles.dfyFeatures}>
                  {getWardrobeSetupFeatureKeys().map((featureKey, idx) => (
                    <View key={idx} style={styles.dfyFeatureRow}>
                      <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(26,26,46,0.15)' }]}>
                        <Feather name="check" size={12} color={LUXURY_COLORS.midnight} />
                      </View>
                      <ThemedText type="small" style={{ color: LUXURY_COLORS.midnight }}>{t(featureKey)}</ThemedText>
                    </View>
                  ))}
                </View>
                <View style={[styles.dfyButtonGradient, { backgroundColor: 'rgba(26,26,46,0.2)' }]}>
                  <Pressable
                    style={styles.dfyButtonInner}
                    onPress={() => openPaidDfyCheckout('core')}
                  >
                    <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: '600' }}>
                      {t('subscription.dfy.wardrobe.cta')}
                    </ThemedText>
                  </Pressable>
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.dfyCardWrapper}>
              <LinearGradient
                colors={[LUXURY_COLORS.coral, '#C46A4F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dfyCard}
              >
                <View style={[styles.dfyPopularBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('subscription.dfy.tactical')}</ThemedText>
                </View>
                <View style={styles.dfyCardHeader}>
                  <View style={[styles.dfyBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="package" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.dfyCardTitleContainer}>
                    <ThemedText type="h3" style={{ color: '#FFFFFF' }}>{t('subscription.dfy.occasion.title')}</ThemedText>
                    <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>{t('subscription.dfy.oneTimePurchase')}</ThemedText>
                  </View>
                </View>
                <View style={styles.dfyPriceRow}>
                  <ThemedText type="h1" style={[styles.dfyPrice, { color: '#FFFFFF' }]}>
                    {dfyPrices.outfit_setup}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={[styles.dfyDescription, { color: 'rgba(255,255,255,0.9)' }]}>
                  {t('subscription.dfy.occasion.description')}
                </ThemedText>
                <View style={styles.dfyFeatures}>
                  {getOccasionReadyFeatureKeys().map((featureKey, idx) => (
                    <View key={idx} style={styles.dfyFeatureRow}>
                      <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                      <ThemedText type="small" style={{ color: '#FFFFFF' }}>{t(featureKey)}</ThemedText>
                    </View>
                  ))}
                  {getOccasionReadyExcludedKeys().map((featureKey, idx) => (
                    <View key={`excluded-${idx}`} style={styles.dfyFeatureRow}>
                      <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                        <Feather name="x" size={12} color="rgba(255,255,255,0.4)" />
                      </View>
                      <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.5)' }}>{t(featureKey)}</ThemedText>
                    </View>
                  ))}
                </View>
                <View style={[styles.dfyButtonGradient, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Pressable
                    style={styles.dfyButtonInner}
                    onPress={() => openPaidDfyCheckout('lite')}
                  >
                    <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      {t('subscription.dfy.occasion.cta')}
                    </ThemedText>
                  </Pressable>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        </>
      ) : null}

      {normalizedTier !== 'free' ? (
        <Pressable
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const status = await apiService.getSubscriptionStatus().catch(() => null);
            const viaApple = shouldManageSubscriptionViaApple({
              billingPlatform: status?.billingPlatform,
              hasStripeBilling: status?.hasStripeBilling,
              stripeSubscriptionId: status?.stripeSubscriptionId,
            }) || (useAppleIAP && !status?.hasStripeBilling && !status?.stripeSubscriptionId);

            if (viaApple) {
              Alert.alert(
                t('subscription.cancel.appleCancelTitle') || 'Manage in the App Store',
                t('subscription.cancel.appleCancelMessage') ||
                  'This subscription is billed through Apple. Cancel or change it in Settings → Apple ID → Subscriptions.',
                [
                  {
                    text: t('subscription.cancel.appleCancelManage') || 'Manage Subscription',
                    onPress: () => openAppleManageSubscriptions().catch(() => {}),
                  },
                  { text: t('common.ok'), style: 'cancel' },
                ],
              );
              return;
            }
            navigation.navigate('CancelSubscription');
          }}
          style={styles.cancelFooterLink}
        >
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
            {t('subscription.cancelSubscription')}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  winbackBanner: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  winbackBannerText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  winbackCta: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  winbackCtaOutline: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  billingToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: BorderRadius.xl,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  billingToggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingToggleButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billingToggleText: {
    fontWeight: '600',
  },
  billingToggleTextActive: {
    color: '#1A1A2E',
  },
  yearlyToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  savingsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
  },
  currentTierSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  currentTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  currentTierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTierText: {
    flex: 1,
  },
  manageActions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  cancelFooterLink: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  billingHint: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  upgradeHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  upgradeHintText: {
    flex: 1,
    color: LUXURY_COLORS.deepGold,
    fontWeight: '600',
  },
  plansContainer: {
    marginBottom: Spacing.lg,
  },
  restorePurchasesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  starterBadge: {
    position: "absolute",
    top: 0,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  starterText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  savingsLabel: {
    color: LUXURY_COLORS.champagne,
    fontWeight: '600',
  },
  bestValueBadge: {
    backgroundColor: LUXURY_COLORS.emerald,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  altPriceText: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.sm,
  },
  yearlyEquivText: {
    color: LUXURY_COLORS.champagne,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  planTagline: {
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  planFooterLine: {
    color: 'rgba(255,255,255,0.65)',
    fontStyle: 'italic',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  planCard: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  planGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  planGradientWithCurrentRibbon: {
    paddingTop: Spacing.lg + 30,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  planNameContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  planName: {
    color: '#FFFFFF',
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    zIndex: 10,
  },
  popularText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: "700",
  },
  currentBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  currentBadgeBelowPopular: {
    position: 'absolute',
    top: 38,
    right: Spacing.lg,
    zIndex: 11,
  },
  currentText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.sm,
  },
  price: {
    marginRight: 4,
  },
  period: {},
  planDescription: {
    marginBottom: Spacing.lg,
  },
  featuresContainer: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  featureIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureBold: {
    fontWeight: "600",
  },
  selectedIndicator: {
    position: "absolute",
    top: Spacing.lg,
    right: Spacing.lg,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedIndicatorBelowBadge: {
    top: Spacing.lg + 32,
  },
  inlineSubscribeButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  inlineSubscribeButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  dfySection: {
    marginBottom: Spacing.xl,
  },
  dfySectionHeader: {
    marginBottom: Spacing.lg,
  },
  dfySectionSubtitle: {
    opacity: 0.7,
  },
  dfyCardWrapper: {
    marginBottom: Spacing.md,
  },
  dfyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  dfyCardFeatured: {
    borderWidth: 2,
    borderColor: LUXURY_COLORS.gold,
  },
  dfyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dfyBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyCardTitleContainer: {
    flex: 1,
  },
  dfyPriceRow: {
    marginBottom: Spacing.sm,
  },
  dfyPrice: {
    fontSize: 32,
    fontWeight: '700',
  },
  dfyDescription: {
    opacity: 0.8,
    marginBottom: Spacing.md,
  },
  dfyFeatures: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dfyFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dfyFeatureIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  dfyButtonInner: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  dfyPopularBadge: {
    position: 'absolute',
    top: -1,
    right: Spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    zIndex: 10,
  },
  finePrint: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  finePrintText: {
    opacity: 0.75,
    textAlign: "center",
    lineHeight: 18,
  },
});
