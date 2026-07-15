import React, { useCallback, useState, useEffect } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { appleIAPService } from "@/services/AppleIAPService";
import { shouldUseAppleIAP } from "@/utils/platformPayments";

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
  const { t } = useTranslations();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isProcessing, setIsProcessing] = useState(false);
  const [accessStatus, setAccessStatus] = useState<DFYAccessStatus | null>(null);
  const [activationBlockedReason, setActivationBlockedReason] = useState<string | null>(null);
  const [activationBlockCode, setActivationBlockCode] = useState<DfyActivationBlockCode | null>(null);
  const [dfyPrices, setDfyPrices] = useState({ outfit_setup: '£19.99', wardrobe_setup: '£39.99' });
  const useAppleIAP = shouldUseAppleIAP();

  const subscriptionTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const benefit = getDfyBenefitForSubscription(subscriptionTier);
  const benefitTitle = getDfyBenefitTitle(benefit);
  const hasActiveWindow = Boolean(accessStatus?.hasAccess && accessStatus.tier);
  const activeTier = accessStatus?.tier;
  const headerTitle = hasActiveWindow && activeTier
    ? getDfyActivePathTitle(activeTier)
    : benefit === 'none'
      ? t('dfy.start.headerDefault')
      : benefitTitle;
  const heroTitle = hasActiveWindow && activeTier
    ? getDfyActivePathTitle(activeTier)
    : benefit === 'none'
      ? t('dfy.start.heroUnlock')
      : t('dfy.start.heroIncluded').replace('{plan}', subscriptionTierDisplayName(subscriptionTier));
  const includedBlocked = activationBlockCode === 'included_used' || activationBlockCode === 'active_window';
  const showPaidAddOn = activationBlockCode === 'included_used' && benefit !== 'none';

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
      navigateAfterDfyActivation(navigation, tier);
    } finally {
      setIsProcessing(false);
    }
  };

  const openPaidCheckout = (tier: DFYTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('DFYComparison', {
      selectedTier: tier,
      paidAddOn: true,
      autoCheckout: true,
    });
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

    return (
      <Pressable
        key={`paid-${tier}`}
        disabled={isProcessing}
        onPress={() => openPaidCheckout(tier)}
        style={({ pressed }) => [styles.pathCard, { opacity: pressed ? 0.9 : 1 }]}
      >
        <LinearGradient colors={selectedGradient} style={styles.pathCardGradient}>
          <View style={styles.pathCardHeader}>
            <Feather name={isLite ? "shopping-bag" : "shopping-bag"} size={22} color="#FFFFFF" />
            <ThemedText type="h3" style={styles.pathTitle}>
              {getDfyPathLabel(tier)}
            </ThemedText>
            <ThemedText type="h3" style={[styles.pathTitle, { marginLeft: 'auto' }]}>
              {price}
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.pathDescription}>
            {getDfyPathDescription(tier)} · {t('dfy.start.oneTime')}
          </ThemedText>
          <View style={styles.pathCtaRow}>
            <ThemedText type="small" style={styles.pathCtaText}>
              {isLite ? t('dfy.start.lookReadyPurchase') : t('dfy.start.dressBetterPurchase')}
            </ThemedText>
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderPaidAddOnSection = () => (
    <View style={styles.paidAddOnSection}>
      <ThemedText type="h4" style={styles.sectionTitle}>{t('dfy.start.purchaseAnother')}</ThemedText>
      <ThemedText type="body" style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
        {t('dfy.start.purchaseAnotherDesc')}
      </ThemedText>
      {renderPaidAddOnCard('lite')}
      {benefit === 'full_wardrobe_setup' || benefit === 'styling_sprint' ? renderPaidAddOnCard('core') : null}
      {benefit === 'styling_sprint' ? (
        <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
          {t('dfy.start.fullSetupIncludedNote')}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <ScreenScrollView style={{ backgroundColor: isDark ? '#0D0B09' : theme.backgroundRoot }}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>
          {headerTitle}
        </ThemedText>
        <View style={styles.backButton} />
      </View>

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
              ? t('dfy.start.noBenefitSubtitle')
              : getDfyBenefitSubtitle(benefit)}
        </ThemedText>
      </View>

      {accessStatus?.hasAccess ? (
        <View style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <Feather name="clock" size={18} color={LUXURY_COLORS.gold} />
          <View style={styles.statusTextWrap}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              {t('dfy.start.activeWindow')}
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

      {benefit === 'none' ? (
        <View style={styles.upgradeSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>{t('dfy.start.choosePlanUnlock')}</ThemedText>
          <Pressable
            onPress={() => navigation.navigate('Subscription', { highlightPlan: 'personal_stylist' })}
            style={[styles.planTeaser, { borderColor: LUXURY_COLORS.teal }]}
          >
            <ThemedText type="h4">{t('dfy.start.personalStylist')}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {t('dfy.start.personalStylistIncludes')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Subscription', { highlightPlan: 'stylist_unlimited' })}
            style={[styles.planTeaser, { borderColor: LUXURY_COLORS.gold }]}
          >
            <ThemedText type="h4">{t('dfy.start.stylistUnlimited')}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {t('dfy.start.stylistUnlimitedIncludes')}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {benefit === 'styling_sprint' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>{t('dfy.start.includedSetup')}</ThemedText>
          {activationBlockedReason ? (
            <ThemedText type="small" style={[styles.blockedText, { color: theme.tabIconDefault }]}>
              {activationBlockedReason}
            </ThemedText>
          ) : null}
          {!showPaidAddOn ? renderPathCard('lite') : null}
          {showPaidAddOn ? renderPaidAddOnSection() : (
            <>
              <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
                {t('dfy.start.oneSetupNote')}
              </ThemedText>
              <Pressable onPress={() => navigation.navigate('Subscription', { highlightPlan: 'stylist_unlimited' })}>
                <ThemedText type="small" style={{ color: theme.link, textAlign: 'center' }}>
                  {t('dfy.start.compareStylistUnlimited')}
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {benefit === 'full_wardrobe_setup' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>{t('dfy.start.chooseIncludedPath')}</ThemedText>
          <ThemedText type="body" style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
            {t('dfy.start.chooseIncludedPathDesc')}
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
              {t('dfy.start.quickVsFullNote')}
            </ThemedText>
          )}
        </View>
      ) : null}

      {isProcessing ? (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={LUXURY_COLORS.gold} />
        </View>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    flex: 1,
  },
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
  upgradeSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  planTeaser: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  pathSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  paidAddOnSection: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
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
  fineNote: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
  processingOverlay: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
