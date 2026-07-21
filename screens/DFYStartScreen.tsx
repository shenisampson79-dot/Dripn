import React, { useCallback, useState, useEffect, useLayoutEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { dfyService, DFYTier, DFYAccessStatus, DfyActivationBlockCode } from "@/services/DFYService";
import {
  getDfyBenefitForSubscription,
  getDfyBenefitTitle,
  getDfyBenefitSubtitle,
  getDfyActivePathTitle,
  getDfyActiveWindowSubtitle,
  formatDfyDaysRemaining,
  getDfyPathDescription,
  getDfyPathLabel,
  subscriptionTierDisplayName,
} from "@/utils/dfyEntitlements";
import { navigateAfterDfyActivation } from "@/utils/dfyNavigation";
import { normalizeSubscriptionTier } from "@/utils/subscriptionTier";
import { currencyService } from "@/services/CurrencyService";
import { apiService } from "@/services/ApiService";
import {
  appleIAPService,
  IAP_UNAVAILABLE_MESSAGE,
  serializeDfyCustomerInfoForSync,
} from "@/services/AppleIAPService";
import { shouldUseAppleIAP } from "@/utils/platformPayments";
import {
  finalizeDfyPurchase,
  isApplePurchaseCancelled,
  runDfyCheckout,
} from "@/utils/dfyCheckout";
import { DFYPackageNameModal } from "@/components/outfit/DFYPackageNameModal";

type DFYStartScreenProps = {
  navigation: NativeStackNavigationProp<Record<string, object | undefined>>;
};

const LUXURY_COLORS = {
  gold: LuxuryColors.gold,
  deepGold: LuxuryColors.deepGold,
  teal: LuxuryColors.teal,
  emerald: LuxuryColors.emerald,
  midnight: '#1A1A2E',
};

export default function DFYStartScreen({ navigation }: DFYStartScreenProps) {
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const { user, refreshSubscriptionFromBackend } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasingTier, setPurchasingTier] = useState<DFYTier | null>(null);
  const [accessStatus, setAccessStatus] = useState<DFYAccessStatus | null>(null);
  const [activationBlockedReason, setActivationBlockedReason] = useState<string | null>(null);
  const [activationBlockCode, setActivationBlockCode] = useState<DfyActivationBlockCode | null>(null);
  const [dfyPrices, setDfyPrices] = useState({ outfit_setup: '£19.99', wardrobe_setup: '£39.99' });
  const [showPackageNamePrompt, setShowPackageNamePrompt] = useState(false);
  const [packageNameDefault, setPackageNameDefault] = useState('');
  const [renamePackageId, setRenamePackageId] = useState<string | null>(null);
  const [pendingAfterName, setPendingAfterName] = useState<(() => void) | null>(null);
  const useAppleIAP = shouldUseAppleIAP();

  const promptPackageNameThen = async (tier: DFYTier, continueFn: () => void) => {
    try {
      // Give the server a moment to archive/create the package after generate
      await new Promise((r) => setTimeout(r, 600));
      const prompt = await dfyService.preparePackageNamePrompt(tier);
      if (prompt) {
        setRenamePackageId(prompt.packageId);
        setPackageNameDefault(prompt.defaultName);
        setPendingAfterName(() => continueFn);
        setShowPackageNamePrompt(true);
        return;
      }
    } catch {
      // Fall through
    }
    continueFn();
  };

  const subscriptionTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const benefit = getDfyBenefitForSubscription(subscriptionTier);
  const benefitTitle = getDfyBenefitTitle(benefit);
  const hasActiveWindow = Boolean(accessStatus?.hasAccess && accessStatus.tier);
  const activeTier = accessStatus?.tier;
  const headerTitle = hasActiveWindow && activeTier
    ? getDfyActivePathTitle(activeTier)
    : benefit === 'none'
      ? (t('dfy.start.headerDefault') || 'Done-For-You Setup')
      : benefitTitle;
  const heroTitle = hasActiveWindow && activeTier
    ? getDfyActivePathTitle(activeTier)
    : benefit === 'none'
      ? (t('dfy.start.heroUnlock') || 'Unlock your stylist setup')
      : (t('dfy.start.heroIncluded') || 'Included with {plan}').replace('{plan}', subscriptionTierDisplayName(subscriptionTier));
  const includedBlocked = activationBlockCode === 'included_used' || activationBlockCode === 'active_window';
  const showPaidAddOn = activationBlockCode === 'included_used' && benefit !== 'none';

  useLayoutEffect(() => {
    navigation.setOptions({ title: headerTitle });
  }, [navigation, headerTitle]);

  useEffect(() => {
    const initCurrency = async () => {
      if (useAppleIAP && user?.id) {
        try {
          await appleIAPService.configure(user.id);
          const iapPrices = await appleIAPService.getDFYPrices();
          if (iapPrices.length > 0) {
            const litePrice = iapPrices.find((entry) => entry.tier === 'lite')?.priceString;
            const corePrice = iapPrices.find((entry) => entry.tier === 'core')?.priceString;
            setDfyPrices({
              outfit_setup: litePrice || '£19.99',
              wardrobe_setup: corePrice || '£39.99',
            });
            return;
          }
        } catch (error) {
          console.warn('[DFYStart] Apple DFY price fetch failed:', error);
        }
      }

      await currencyService.initialize();
      setDfyPrices(currencyService.getDFYPrices());
    };
    initCurrency().catch(() => {});
  }, [useAppleIAP, user?.id]);

  const refreshState = useCallback(async () => {
    if (!user?.id) return;
    const access = await dfyService.checkDFYAccess(user.id, subscriptionTier);
    setAccessStatus(access);
    const eligibility = await dfyService.canUseIncludedActivation(user.id, subscriptionTier);
    setActivationBlockedReason(eligibility.allowed ? null : eligibility.reason ?? null);
    setActivationBlockCode(eligibility.allowed ? null : eligibility.blockCode ?? null);
  }, [user?.id, subscriptionTier]);

  useFocusEffect(
    useCallback(() => {
      refreshState();
    }, [refreshState]),
  );

  const continueActivePlan = async () => {
    if (!accessStatus?.tier || !user?.id) return;
    let initialDay: number | undefined;
    if (accessStatus.tier === 'lite') {
      const delivery = await dfyService.getDFYDelivery(user.id);
      if (delivery && delivery.tier === 'lite' && delivery.currentDay > 0) {
        initialDay = delivery.currentDay;
      }
    }
    navigateAfterDfyActivation(navigation, accessStatus.tier, { initialDay });
  };

  const startIncludedSetup = async (tier: DFYTier) => {
    if (!user?.id) return;
    setIsProcessing(true);
    try {
      const result = await dfyService.activateIncludedSetup(user.id, tier, subscriptionTier);
      if (!result.success) {
        Alert.alert(t('dfy.start.cantStartTitle'), result.error ?? t('dfy.start.tryAgain'));
        await refreshState();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (tier === 'lite') {
        try {
          await dfyService.createMockLiteDelivery(
            user.id,
            user.stylistPreferences?.selectedStylistId || 'ruby',
          );
        } catch {
          // Style plan will create on open
        }
      } else {
        try {
          await finalizeDfyPurchase('core');
        } catch {
          // Continue; upload flow can generate later
        }
      }
      await promptPackageNameThen(tier, () => navigateAfterDfyActivation(navigation, tier));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreDfyPurchases = async () => {
    if (!useAppleIAP) return;
    if (!user?.id) {
      Alert.alert(t('dfy.comparison.signInRequiredTitle'), t('dfy.comparison.signInRequiredRestore'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);
    try {
      const iapReady = await appleIAPService.configure(user.id);
      if (!iapReady) throw new Error(IAP_UNAVAILABLE_MESSAGE);
      const customerInfo = await appleIAPService.restorePurchases();
      const syncPayload = serializeDfyCustomerInfoForSync(customerInfo);
      if (!syncPayload.tier) {
        Alert.alert(t('dfy.comparison.noDfyPurchaseTitle'), t('dfy.comparison.noDfyPurchaseMessage'));
        return;
      }
      await apiService.syncAppleDFYPurchase(syncPayload);
      await refreshSubscriptionFromBackend();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('dfy.comparison.restoredTitle'), t('dfy.comparison.restoredMessage'), [
        { text: t('common.continue'), onPress: () => refreshState() },
      ]);
    } catch (error: unknown) {
      Alert.alert(
        t('dfy.comparison.restoreFailedTitle'),
        error instanceof Error ? error.message : t('dfy.comparison.restoreFailedMessage'),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const openPaidCheckout = async (tier: DFYTier) => {
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
    setPurchasingTier(tier);
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
        await promptPackageNameThen(tier, () => {
          setTimeout(() => {
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
                    onPress: () => navigation.navigate('DFYStylePlan'),
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
          }, 400);
        });
        await refreshState();
        return;
      }

      if (outcome === 'failed') {
        setTimeout(() => {
          Alert.alert(
            t('dfy.comparison.paymentNotCompletedTitle'),
            t('dfy.comparison.paymentNotCompletedMessage'),
            [{ text: t('common.done') }],
          );
        }, 400);
      }
      // cancelled: stay on screen quietly
    } catch (error: unknown) {
      if (isApplePurchaseCancelled(error)) {
        setTimeout(() => {
          Alert.alert(
            t('dfy.comparison.purchaseCancelledTitle'),
            t('dfy.comparison.purchaseCancelledMessage'),
            [{ text: t('common.done') }],
          );
        }, 400);
        return;
      }
      console.error('[DFYStart] checkout error:', error);
      setTimeout(() => {
        Alert.alert(
          t('dfy.comparison.paymentErrorTitle'),
          error instanceof Error ? error.message : t('dfy.comparison.checkoutStartFailed'),
          [{ text: t('common.done') }],
        );
      }, 400);
    } finally {
      setIsProcessing(false);
      setPurchasingTier(null);
    }
  };

  const renderPathCard = (
    tier: DFYTier,
    options?: { recommended?: boolean },
  ) => {
    const isLite = tier === 'lite';
    const selectedGradient = isLite
      ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
      : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold];

    return (
      <Pressable
        key={tier}
        disabled={isProcessing || includedBlocked}
        onPress={() => startIncludedSetup(tier)}
        style={({ pressed }) => [styles.pathCard, { opacity: pressed ? 0.9 : 1 }]}
      >
        <LinearGradient colors={selectedGradient} style={styles.pathCardGradient}>
          {options?.recommended ? (
            <View style={styles.recommendedBadge}>
              <ThemedText type="caption" style={styles.recommendedText}>{t('dfy.start.recommended')}</ThemedText>
            </View>
          ) : null}
          <View style={styles.pathCardHeader}>
            <Feather name={isLite ? "zap" : "layers"} size={22} color="#FFFFFF" />
            <ThemedText type="h3" style={styles.pathTitle}>
              {getDfyPathLabel(tier)}
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.pathDescription}>
            {getDfyPathDescription(tier, benefit)}
          </ThemedText>
          <View style={styles.pathCtaRow}>
            <ThemedText type="small" style={styles.pathCtaText}>
              {t('dfy.start.startPath').replace('{path}', getDfyPathLabel(tier))}
            </ThemedText>
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderPaidAddOnCard = (tier: DFYTier) => {
    const isLite = tier === 'lite';
    const price = isLite ? dfyPrices.outfit_setup : dfyPrices.wardrobe_setup;
    const selectedGradient = isLite
      ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
      : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold];
    const titleColor = isLite ? '#FFFFFF' : LUXURY_COLORS.midnight;
    const mutedColor = isLite ? 'rgba(255,255,255,0.9)' : 'rgba(26,26,46,0.85)';
    const buttonBg = isLite ? 'rgba(255,255,255,0.22)' : 'rgba(26,26,46,0.18)';

    return (
      <View key={`paid-${tier}`} style={styles.pathCard}>
        <LinearGradient colors={selectedGradient} style={styles.pathCardGradient}>
          <View style={styles.pathCardHeader}>
            <Feather name="shopping-bag" size={22} color={titleColor} />
            <ThemedText type="h3" style={[styles.pathTitle, { color: titleColor }]}>
              {isLite
                ? (t('subscription.dfy.occasion.title') || 'Occasion Ready')
                : (t('subscription.dfy.wardrobe.title') || 'Full Wardrobe Setup')}
            </ThemedText>
            <ThemedText type="h3" style={[styles.pathTitle, { marginLeft: 'auto', color: titleColor }]}>
              {price}
            </ThemedText>
          </View>
          <ThemedText type="body" style={[styles.pathDescription, { color: mutedColor }]}>
            {getDfyPathDescription(tier)} · {t('dfy.start.oneTime') || 'one-time'}
          </ThemedText>
          <Pressable
            disabled={isProcessing}
            onPress={() => openPaidCheckout(tier)}
            style={({ pressed }) => [
              styles.purchaseButton,
              { backgroundColor: buttonBg, opacity: pressed || isProcessing ? 0.85 : 1 },
            ]}
          >
            {purchasingTier === tier ? (
              <ActivityIndicator size="small" color={titleColor} />
            ) : (
              <ThemedText type="body" style={[styles.purchaseButtonText, { color: titleColor }]}>
                {t('dfy.start.purchase') || 'Purchase'}
              </ThemedText>
            )}
          </Pressable>
        </LinearGradient>
      </View>
    );
  };

  const renderPaidAddOnSection = (options?: { bothPaths?: boolean }) => {
    const showBoth = options?.bothPaths || benefit === 'full_wardrobe_setup' || benefit === 'styling_sprint';
    const isStandalonePurchase = benefit === 'none' || options?.bothPaths;
    return (
      <View style={styles.paidAddOnSection}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          {isStandalonePurchase
            ? (t('dfy.start.chooseSetup') || 'Choose your setup')
            : (t('dfy.start.purchaseAnother') || 'Purchase another setup')}
        </ThemedText>
        {!isStandalonePurchase ? (
          <ThemedText type="body" style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
            {t('dfy.start.purchaseAnotherDesc') ||
              "You've used your included setup — run another whenever you want to look and feel your best."}
          </ThemedText>
        ) : null}
        {renderPaidAddOnCard('lite')}
        {showBoth ? renderPaidAddOnCard('core') : null}
        {benefit === 'styling_sprint' && !isStandalonePurchase ? (
          <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
            {t('dfy.start.fullSetupIncludedNote') ||
              'Full Setup is included with Stylist Unlimited, or buy it here anytime.'}
          </ThemedText>
        ) : null}
        {isStandalonePurchase ? (
          <Pressable
            onPress={() => navigation.navigate('Subscription', { highlightPlan: 'personal_stylist' })}
            style={styles.membershipLink}
          >
            <ThemedText type="small" style={{ color: theme.link, textAlign: 'center' }}>
              {t('dfy.start.orUnlockWithPlan') || 'Or unlock a setup free with a membership'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <>
    <ScreenScrollView
      opaqueHeader
      style={{ backgroundColor: isDark ? '#0D0B09' : theme.backgroundRoot }}
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={isDark ? [LUXURY_COLORS.deepGold, '#0D0B09'] : [LUXURY_COLORS.gold, '#FAF8F5']}
          style={styles.heroBadge}
        >
          <Feather name="gift" size={28} color={LUXURY_COLORS.midnight} />
        </LinearGradient>
        <ThemedText type="h2" style={styles.heroTitle}>
          {heroTitle}
        </ThemedText>
        <ThemedText type="body" style={[styles.heroSubtitle, { color: theme.tabIconDefault }]}>
          {accessStatus?.hasAccess && accessStatus.tier
            ? getDfyActiveWindowSubtitle(accessStatus.tier)
            : benefit === 'none'
              ? (t('dfy.start.noBenefitSubtitle') ||
                'Buy a one-time stylist setup — Occasion Ready for an upcoming event, or Full Setup to digitise your wardrobe.')
              : getDfyBenefitSubtitle(benefit)}
        </ThemedText>
      </View>

      {accessStatus?.hasAccess ? (
        <View style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <Feather name="clock" size={18} color={LUXURY_COLORS.gold} />
          <View style={styles.statusTextWrap}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              {t('dfy.start.activeWindow') || 'Active styling window'}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {formatDfyDaysRemaining(accessStatus.daysRemaining, accessStatus.windowDays)} ·{' '}
              {getDfyPathLabel(accessStatus.tier)}
            </ThemedText>
          </View>
          <Button onPress={continueActivePlan} style={styles.continueButton}>
            {t('common.continue')}
          </Button>
        </View>
      ) : null}

      {benefit === 'none' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          {renderPaidAddOnSection({ bothPaths: true })}
        </View>
      ) : null}

      {benefit === 'styling_sprint' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t('dfy.start.includedSetup') || 'Your included setup'}
          </ThemedText>
          {activationBlockedReason ? (
            <ThemedText type="small" style={[styles.blockedText, { color: theme.tabIconDefault }]}>
              {activationBlockedReason}
            </ThemedText>
          ) : null}
          {!showPaidAddOn ? renderPathCard('lite') : null}
          {showPaidAddOn ? renderPaidAddOnSection() : (
            <>
              <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
                {t('dfy.start.oneSetupNote') ||
                  'Your plan includes one setup. Ready for the full wardrobe experience? Stylist Unlimited has you.'}
              </ThemedText>
              <Pressable onPress={() => navigation.navigate('Subscription', { highlightPlan: 'stylist_unlimited' })}>
                <ThemedText type="small" style={{ color: theme.link, textAlign: 'center' }}>
                  {t('dfy.start.compareStylistUnlimited') || 'Compare Stylist Unlimited'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {benefit === 'full_wardrobe_setup' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t('dfy.start.chooseIncludedPath') || 'Choose your included path'}
          </ThemedText>
          <ThemedText type="body" style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
            {t('dfy.start.chooseIncludedPathDesc') ||
              'Your plan includes one setup — pick Quick Start or Full Setup to begin.'}
          </ThemedText>
          {activationBlockedReason ? (
            <ThemedText type="small" style={[styles.blockedText, { color: theme.tabIconDefault }]}>
              {activationBlockedReason}
            </ThemedText>
          ) : null}
          {!showPaidAddOn ? (
            <>
              {renderPathCard('lite')}
              {renderPathCard('core', { recommended: true })}
            </>
          ) : null}
          {showPaidAddOn ? renderPaidAddOnSection() : (
            <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
              {t('dfy.start.quickVsFullNote') ||
                'Quick Start is a fast win when you’re short on time. Full Setup is for when you want your whole closet digitised.'}
            </ThemedText>
          )}
        </View>
      ) : null}

      {useAppleIAP ? (
        <Pressable
          onPress={handleRestoreDfyPurchases}
          disabled={isProcessing}
          accessibilityRole="button"
          accessibilityLabel={t('dfy.comparison.restorePurchases')}
          style={({ pressed }) => [
            styles.restorePurchasesButton,
            {
              opacity: pressed ? 0.85 : 1,
              borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
            },
          ]}
        >
          <Feather name="refresh-cw" size={16} color={LUXURY_COLORS.teal} />
          <ThemedText type="small" style={styles.restorePurchasesText}>
            {isProcessing
              ? (t('subscription.restoring') || 'Restoring...')
              : t('dfy.comparison.restorePurchases')}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScreenScrollView>

      <DFYPackageNameModal
        visible={showPackageNamePrompt}
        defaultName={packageNameDefault}
        onClose={() => {
          setShowPackageNamePrompt(false);
          const next = pendingAfterName;
          setPendingAfterName(null);
          next?.();
        }}
        onSave={async (name) => {
          if (!renamePackageId) return;
          try {
            await dfyService.renameDfyPackage(renamePackageId, name);
          } catch {
            Alert.alert(
              t('common.error') || 'Error',
              t('dfy.package.renameFailed') || 'Could not save the plan name. Please try again.',
            );
            throw new Error('rename failed');
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  statusCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  statusTextWrap: {
    gap: 4,
  },
  continueButton: {
    alignSelf: 'stretch',
  },
  pathSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  paidAddOnSection: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  membershipLink: {
    paddingVertical: Spacing.sm,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  blockedText: {
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  pathCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  pathCardGradient: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(26,26,46,0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pathCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pathTitle: {
    color: '#FFFFFF',
  },
  pathDescription: {
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  pathCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  pathCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  purchaseButton: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  purchaseButtonText: {
    fontWeight: '700',
  },
  restorePurchasesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  restorePurchasesText: {
    color: LUXURY_COLORS.teal,
    fontWeight: '600',
  },
  fineNote: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
});
