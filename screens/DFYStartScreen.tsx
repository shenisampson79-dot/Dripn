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
import { dfyService, DFYTier, DFYAccessStatus, DfyActivationBlockCode } from "@/services/DFYService";
import {
  getDfyBenefitForSubscription,
  getDfyBenefitTitle,
  getDfyBenefitSubtitle,
  getDfyPathDescription,
  getDfyPathLabel,
  subscriptionTierDisplayName,
} from "@/utils/dfyEntitlements";
import { navigateAfterDfyActivation } from "@/utils/dfyNavigation";
import { normalizeSubscriptionTier } from "@/utils/subscriptionTier";
import { currencyService } from "@/services/CurrencyService";

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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isProcessing, setIsProcessing] = useState(false);
  const [accessStatus, setAccessStatus] = useState<DFYAccessStatus | null>(null);
  const [activationBlockedReason, setActivationBlockedReason] = useState<string | null>(null);
  const [activationBlockCode, setActivationBlockCode] = useState<DfyActivationBlockCode | null>(null);
  const [dfyPrices, setDfyPrices] = useState({ outfit_setup: '£19.99', wardrobe_setup: '£39.99' });

  const subscriptionTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const benefit = getDfyBenefitForSubscription(subscriptionTier);
  const benefitTitle = getDfyBenefitTitle(benefit);
  const includedBlocked = activationBlockCode === 'included_used' || activationBlockCode === 'active_window';
  const showPaidAddOn = activationBlockCode === 'included_used' && benefit !== 'none';

  useEffect(() => {
    currencyService.initialize().then(() => {
      setDfyPrices(currencyService.getDFYPrices());
    }).catch(() => {});
  }, []);

  const refreshState = useCallback(async () => {
    if (!user?.id) return;
    const access = await dfyService.checkDFYAccess(user.id);
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

  const continueActivePlan = () => {
    if (!accessStatus?.tier) return;
    navigateAfterDfyActivation(navigation, accessStatus.tier);
  };

  const startIncludedSetup = async (tier: DFYTier) => {
    if (!user?.id) return;
    setIsProcessing(true);
    try {
      const result = await dfyService.activateIncludedSetup(user.id, tier, subscriptionTier);
      if (!result.success) {
        Alert.alert("Can't start yet", result.error ?? "Please try again.");
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
    navigation.navigate('DFYComparison', { selectedTier: tier, paidAddOn: true });
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
              <ThemedText type="caption" style={styles.recommendedText}>Recommended</ThemedText>
            </View>
          ) : null}
          <View style={styles.pathCardHeader}>
            <Feather name={isLite ? "zap" : "layers"} size={22} color="#FFFFFF" />
            <ThemedText type="h3" style={styles.pathTitle}>
              {getDfyPathLabel(tier)}
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.pathDescription}>
            {getDfyPathDescription(tier)}
          </ThemedText>
          <View style={styles.pathCtaRow}>
            <ThemedText type="small" style={styles.pathCtaText}>
              Start {getDfyPathLabel(tier)}
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
            {getDfyPathDescription(tier)} · one-time purchase
          </ThemedText>
          <View style={styles.pathCtaRow}>
            <ThemedText type="small" style={styles.pathCtaText}>
              Purchase now
            </ThemedText>
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderPaidAddOnSection = () => (
    <View style={styles.paidAddOnSection}>
      <ThemedText type="h4" style={styles.sectionTitle}>Purchase another setup</ThemedText>
      <ThemedText type="body" style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
        Your one included setup has been used. Additional runs are one-time purchases.
      </ThemedText>
      {renderPaidAddOnCard('lite')}
      {benefit === 'full_wardrobe_setup' || benefit === 'styling_sprint' ? renderPaidAddOnCard('core') : null}
      {benefit === 'styling_sprint' ? (
        <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
          Full Setup is included with Stylist Unlimited, or buy it here anytime.
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
          {benefit === 'none' ? 'Done-For-You Setup' : benefitTitle}
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
          {benefit === 'none' ? 'Unlock your stylist setup' : `Included with ${subscriptionTierDisplayName(subscriptionTier)}`}
        </ThemedText>
        <ThemedText type="body" style={[styles.heroSubtitle, { color: theme.tabIconDefault }]}>
          {benefit === 'none'
            ? 'Personal Stylist includes a Styling Sprint. Stylist Unlimited includes Full Wardrobe Setup with a quick or full path.'
            : getDfyBenefitSubtitle(benefit)}
        </ThemedText>
      </View>

      {accessStatus?.hasAccess ? (
        <View style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <Feather name="clock" size={18} color={LUXURY_COLORS.gold} />
          <View style={styles.statusTextWrap}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              Active styling window
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {accessStatus.daysRemaining} day{accessStatus.daysRemaining === 1 ? '' : 's'} left ·{' '}
              {accessStatus.tier === 'lite' ? 'Quick Start' : 'Full Setup'}
            </ThemedText>
          </View>
          <Button onPress={continueActivePlan} style={styles.continueButton}>
            Continue
          </Button>
        </View>
      ) : null}

      {benefit === 'none' ? (
        <View style={styles.upgradeSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>Choose a plan to unlock</ThemedText>
          <Pressable
            onPress={() => navigation.navigate('Subscription', { highlightPlan: 'personal_stylist' })}
            style={[styles.planTeaser, { borderColor: LUXURY_COLORS.teal }]}
          >
            <ThemedText type="h4">Personal Stylist</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Includes Styling Sprint (Quick Start)
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Subscription', { highlightPlan: 'stylist_unlimited' })}
            style={[styles.planTeaser, { borderColor: LUXURY_COLORS.gold }]}
          >
            <ThemedText type="h4">Stylist Unlimited</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Includes Full Wardrobe Setup · Quick or Full path
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {benefit === 'styling_sprint' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>Your included setup</ThemedText>
          {activationBlockedReason ? (
            <ThemedText type="small" style={[styles.blockedText, { color: theme.tabIconDefault }]}>
              {activationBlockedReason}
            </ThemedText>
          ) : null}
          {!showPaidAddOn ? renderPathCard('lite') : null}
          {showPaidAddOn ? renderPaidAddOnSection() : (
            <>
              <ThemedText type="caption" style={[styles.fineNote, { color: theme.tabIconDefault }]}>
                One included setup with your plan. Want the full wardrobe system? Upgrade to Stylist Unlimited.
              </ThemedText>
              <Pressable onPress={() => navigation.navigate('Subscription', { highlightPlan: 'stylist_unlimited' })}>
                <ThemedText type="small" style={{ color: theme.link, textAlign: 'center' }}>
                  Compare Stylist Unlimited
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {benefit === 'full_wardrobe_setup' && !accessStatus?.hasAccess ? (
        <View style={styles.pathSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>How do you want to start?</ThemedText>
          <ThemedText type="body" style={[styles.sectionSubtitle, { color: theme.tabIconDefault }]}>
            One included setup with your plan — pick the path for your trial run.
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
              Quick Start is great for a fast win. Full Setup digitises your wardrobe for long-term remixing.
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
