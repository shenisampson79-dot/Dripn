import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, SubscriptionColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SubscriptionTier } from "@/contexts/AuthContext";
import { useSubscription, SUBSCRIPTION_PLANS } from "@/contexts/SubscriptionContext";
import { currencyService } from "@/services/CurrencyService";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

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
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
}

type DisplayTier = 'free' | 'personal_stylist';

const PLAN_FEATURES: Record<DisplayTier, PlanFeature[]> = {
  free: [
    { text: "3 posts per month", included: true },
    { text: "Community voting", included: true },
    { text: "Basic styling tips", included: true },
    { text: "Unlimited stylist advice", included: false },
    { text: "Voice features", included: false },
    { text: "Ad-free experience", included: false },
  ],
  personal_stylist: [
    { text: "Unlimited outfit posts", included: true },
    { text: "Unlimited AI styling advice", included: true },
    { text: "Personal AI Stylist (Ruby, Max, or Ace)", included: true, bold: true },
    { text: "Voice conversations with your stylist", included: true },
    { text: "Wardrobe analysis & recommendations", included: true },
    { text: "Priority support", included: true },
    { text: "Ad-free experience", included: true },
  ],
};

const PLAN_METADATA: Record<DisplayTier, { name: string; period: string; description: string; popular?: boolean }> = {
  free: { name: "Free", period: "forever", description: "Get started with basic features" },
  personal_stylist: { name: "Personal Stylist", period: "/month", description: "Your AI fashion advisor", popular: true },
};

const getLocalizedPlans = (prices: { free: string; personal_stylist: string }): Plan[] => [
  { id: "free" as SubscriptionTier, ...PLAN_METADATA.free, price: prices.free, features: PLAN_FEATURES.free },
  { id: "premium" as SubscriptionTier, ...PLAN_METADATA.personal_stylist, price: prices.personal_stylist, features: PLAN_FEATURES.personal_stylist },
];

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const { theme } = useTheme();
  const { user, updateProfile } = useAuth();
  const { 
    usage, 
    limits, 
    getRemainingUploads, 
    getRemainingAIAdvice, 
    getRemainingVoice,
    getRemainingPolls,
    isTrialActive,
    trialDaysRemaining,
    startTrial,
    referralCode,
  } = useSubscription();
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>(
    user?.subscriptionTier || "free"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [localizedPrices, setLocalizedPrices] = useState<{ free: string; personal_stylist: string }>({
    free: "Free",
    personal_stylist: "$9.99",
  });
  const [dfyPrices, setDfyPrices] = useState<{ outfit_setup: string; wardrobe_setup: string }>({
    outfit_setup: "$19",
    wardrobe_setup: "$39.99",
  });

  useEffect(() => {
    const initCurrency = async () => {
      await currencyService.initialize();
      setLocalizedPrices(currencyService.getLocalizedPrices());
      setDfyPrices(currencyService.getDFYPrices());
    };
    initCurrency();
  }, []);

  const PLANS = getLocalizedPlans(localizedPrices);

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    if (planId === user?.subscriptionTier) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    
    try {
      if (planId === "free") {
        await updateProfile({ subscriptionTier: planId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Success",
          "You've successfully downgraded to the Free plan!",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        const subscriptionPlan = SUBSCRIPTION_PLANS.find(p => p.tier === planId);
        if (!subscriptionPlan?.priceId) {
          throw new Error("Price ID not found for this plan");
        }

        const response = await apiService.createCheckoutSession(
          subscriptionPlan.priceId,
          planId
        );

        if (response.url) {
          const result = await WebBrowser.openBrowserAsync(response.url);
          
          if (result.type === "cancel") {
            Alert.alert(
              "Checkout Cancelled",
              "You can complete your subscription upgrade at any time.",
              [{ text: "OK" }]
            );
          }
        } else {
          throw new Error("No checkout URL received");
        }
      }
    } catch (error) {
      console.error("Subscription error:", error);
      Alert.alert(
        "Error",
        "Failed to process subscription. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTrial = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await startTrial();
    Alert.alert(
      "Trial Started",
      "You now have 7 days of Premium access! Explore all the features.",
      [{ text: "Let's Go" }]
    );
  };

  const formatRemaining = (value: number): string => {
    if (value === Infinity) return "Unlimited";
    return value.toString();
  };

  const getUsagePercent = (used: number, limit: number): number => {
    if (limit === Infinity) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const renderPlanCard = (plan: Plan) => {
    const isSelected = selectedPlan === plan.id;
    const isPaidPlan = plan.id === 'premium';
    const userOnPaidTier = user?.subscriptionTier && ['basic', 'premium', 'vip'].includes(user.subscriptionTier);
    const isCurrent = plan.id === 'free' 
      ? user?.subscriptionTier === 'free' 
      : isPaidPlan && userOnPaidTier;
    const colors = SubscriptionColors[plan.id];

    return (
      <Pressable
        key={plan.id}
        onPress={() => setSelectedPlan(plan.id)}
        style={({ pressed }) => [
          styles.planCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: isSelected ? theme.link : "transparent",
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {plan.popular ? (
          <View style={[styles.popularBadge, { backgroundColor: theme.link }]}>
            <ThemedText type="caption" style={styles.popularText}>
              Most Popular
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.planHeader}>
          <View
            style={[
              styles.planBadge,
              { backgroundColor: 'backgroundStart' in colors ? colors.backgroundStart : colors.background },
            ]}
          >
            <ThemedText type="small" style={{ color: colors.text, fontWeight: "600" }}>
              {plan.name}
            </ThemedText>
          </View>
          {isCurrent ? (
            <View style={[styles.currentBadge, { backgroundColor: theme.success || "#34C759" }]}>
              <ThemedText type="caption" style={styles.currentText}>
                Current
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.priceContainer}>
          <ThemedText type="h1" style={styles.price}>
            {plan.price}
          </ThemedText>
          <ThemedText type="body" style={styles.period}>
            {plan.period}
          </ThemedText>
        </View>

        <ThemedText type="body" style={styles.planDescription}>
          {plan.description}
        </ThemedText>

        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Feather
                name={feature.included ? "check" : "x"}
                size={16}
                color={feature.included ? theme.success || "#34C759" : theme.tabIconDefault}
              />
              <ThemedText
                type="small"
                style={[
                  styles.featureText,
                  !feature.included && styles.featureDisabled,
                  feature.bold && styles.featureBold,
                ]}
              >
                {feature.text}
              </ThemedText>
            </View>
          ))}
        </View>

        {isSelected && !isCurrent ? (
          <View style={[styles.selectedIndicator, { backgroundColor: theme.link }]}>
            <Feather name="check" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.headerTitle}>
          Choose Your Plan
        </ThemedText>
        <ThemedText type="body" style={styles.headerSubtitle}>
          Unlock more features and get personalized style advice
        </ThemedText>
      </View>

      <View style={[styles.usageSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h3" style={styles.usageTitle}>
          Your Usage This Month
        </ThemedText>
        <View style={styles.usageGrid}>
          <View style={styles.usageItem}>
            <View style={styles.usageHeader}>
              <Feather name="upload" size={16} color={theme.link} />
              <ThemedText type="small">Posts</ThemedText>
            </View>
            <View style={[styles.usageBar, { backgroundColor: theme.backgroundSecondary }]}>
              <View 
                style={[
                  styles.usageProgress, 
                  { 
                    backgroundColor: theme.link,
                    width: `${getUsagePercent(usage.uploadsThisMonth, limits.uploadsPerMonth)}%` 
                  }
                ]} 
              />
            </View>
            <ThemedText type="caption">
              {formatRemaining(getRemainingUploads())} remaining
            </ThemedText>
          </View>
          <View style={styles.usageItem}>
            <View style={styles.usageHeader}>
              <Feather name="star" size={16} color={theme.link} />
              <ThemedText type="small">Style Advice</ThemedText>
            </View>
            <View style={[styles.usageBar, { backgroundColor: theme.backgroundSecondary }]}>
              <View 
                style={[
                  styles.usageProgress, 
                  { 
                    backgroundColor: theme.link,
                    width: `${getUsagePercent(usage.aiAdviceThisMonth, limits.aiAdvicePerMonth)}%` 
                  }
                ]} 
              />
            </View>
            <ThemedText type="caption">
              {formatRemaining(getRemainingAIAdvice())} remaining
            </ThemedText>
          </View>
          <View style={styles.usageItem}>
            <View style={styles.usageHeader}>
              <Feather name="mic" size={16} color={theme.link} />
              <ThemedText type="small">Voice</ThemedText>
            </View>
            <View style={[styles.usageBar, { backgroundColor: theme.backgroundSecondary }]}>
              <View 
                style={[
                  styles.usageProgress, 
                  { 
                    backgroundColor: theme.link,
                    width: `${getUsagePercent(usage.voiceCommentsThisMonth, limits.voiceCommentsPerMonth)}%` 
                  }
                ]} 
              />
            </View>
            <ThemedText type="caption">
              {limits.voiceCommentsPerMonth === 0 ? "Not available" : `${formatRemaining(getRemainingVoice())} remaining`}
            </ThemedText>
          </View>
          <View style={styles.usageItem}>
            <View style={styles.usageHeader}>
              <Feather name="bar-chart-2" size={16} color={theme.link} />
              <ThemedText type="small">Polls</ThemedText>
            </View>
            <View style={[styles.usageBar, { backgroundColor: theme.backgroundSecondary }]}>
              <View 
                style={[
                  styles.usageProgress, 
                  { 
                    backgroundColor: theme.link,
                    width: `${getUsagePercent(usage.comparisonPollsThisMonth, limits.comparisonPollsPerMonth)}%` 
                  }
                ]} 
              />
            </View>
            <ThemedText type="caption">
              {formatRemaining(getRemainingPolls())} remaining
            </ThemedText>
          </View>
        </View>
      </View>

      {!isTrialActive && user?.subscriptionTier === 'free' ? (
        <Pressable 
          onPress={handleStartTrial}
          style={[styles.trialBanner, { backgroundColor: "rgba(184, 134, 11, 0.1)" }]}
        >
          <Feather name="gift" size={24} color={theme.link} />
          <View style={styles.trialContent}>
            <ThemedText type="h3">7-Day Free Trial</ThemedText>
            <ThemedText type="small" style={styles.trialSubtitle}>
              Tap to try Premium features free for 7 days
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
        </Pressable>
      ) : isTrialActive ? (
        <View style={[styles.trialBanner, { backgroundColor: "rgba(52, 199, 89, 0.1)" }]}>
          <Feather name="clock" size={24} color={theme.success || "#34C759"} />
          <View style={styles.trialContent}>
            <ThemedText type="h3">Trial Active</ThemedText>
            <ThemedText type="small" style={styles.trialSubtitle}>
              {trialDaysRemaining} days remaining
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={[styles.referralSection, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.referralHeader}>
          <Feather name="users" size={20} color={theme.link} />
          <ThemedText type="h3">Invite Friends</ThemedText>
        </View>
        <ThemedText type="small" style={styles.referralSubtitle}>
          Share your code and both get 5 extra posts when they sign up
        </ThemedText>
        <View style={[styles.referralCode, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="h3" style={{ letterSpacing: 2 }}>{referralCode}</ThemedText>
        </View>
      </View>

      <View style={styles.plansContainer}>
        {PLANS.map(renderPlanCard)}
      </View>

      {selectedPlan !== user?.subscriptionTier ? (
        <Button
          onPress={() => handleSelectPlan(selectedPlan)}
          disabled={isProcessing}
          style={styles.subscribeButton}
        >
          {isProcessing
            ? "Processing..."
            : selectedPlan === "free"
              ? "Downgrade to Free"
              : `Start ${PLANS.find((p) => p.id === selectedPlan)?.name} Plan`}
        </Button>
      ) : null}

      <View style={styles.dfySection}>
        <ThemedText type="h2" style={styles.dfySectionTitle}>
          Done-For-You Setup
        </ThemedText>
        <ThemedText type="body" style={styles.dfySectionSubtitle}>
          Let us set up your digital wardrobe for you
        </ThemedText>

        <View style={[styles.dfyCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.dfyCardHeader}>
            <View style={[styles.dfyBadge, { backgroundColor: theme.link + '20' }]}>
              <Feather name="package" size={16} color={theme.link} />
            </View>
            <View style={styles.dfyCardTitleContainer}>
              <ThemedText type="h3">Outfit-Based Setup</ThemedText>
              <ThemedText type="caption" style={{ opacity: 0.7 }}>One-time purchase</ThemedText>
            </View>
            <ThemedText type="h2" style={{ color: theme.link }}>{dfyPrices.outfit_setup}</ThemedText>
          </View>
          <ThemedText type="body" style={styles.dfyDescription}>
            We'll photograph and catalog 5-7 of your favorite outfits, ready to mix and match.
          </ThemedText>
          <View style={styles.dfyFeatures}>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">5-7 complete outfits catalogued</ThemedText>
            </View>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">Category & formality tagging</ThemedText>
            </View>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">Color & seasonality analysis</ThemedText>
            </View>
          </View>
          <Pressable 
            style={[styles.dfyButton, { backgroundColor: theme.link }]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          >
            <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Get Started</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.dfyCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.link, borderWidth: 2 }]}>
          <View style={[styles.dfyPopularBadge, { backgroundColor: theme.link }]}>
            <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>Best Value</ThemedText>
          </View>
          <View style={styles.dfyCardHeader}>
            <View style={[styles.dfyBadge, { backgroundColor: theme.link + '20' }]}>
              <Feather name="grid" size={16} color={theme.link} />
            </View>
            <View style={styles.dfyCardTitleContainer}>
              <ThemedText type="h3">Core Wardrobe Setup</ThemedText>
              <ThemedText type="caption" style={{ opacity: 0.7 }}>One-time purchase</ThemedText>
            </View>
            <ThemedText type="h2" style={{ color: theme.link }}>{dfyPrices.wardrobe_setup}</ThemedText>
          </View>
          <ThemedText type="body" style={styles.dfyDescription}>
            Complete digital wardrobe setup with up to 30 items, fully organized and ready for AI styling.
          </ThemedText>
          <View style={styles.dfyFeatures}>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">Up to 30 wardrobe items</ThemedText>
            </View>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">Full categorization & tagging</ThemedText>
            </View>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">Primary color extraction</ThemedText>
            </View>
            <View style={styles.dfyFeatureRow}>
              <Feather name="check" size={14} color={theme.success || "#34C759"} />
              <ThemedText type="small">Seasonality recommendations</ThemedText>
            </View>
          </View>
          <Pressable 
            style={[styles.dfyButton, { backgroundColor: theme.link }]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          >
            <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Get Started</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.finePrint}>
        <ThemedText type="small" style={styles.finePrintText}>
          Subscriptions auto-renew until canceled. You can cancel anytime in your account
          settings. By subscribing, you agree to our Terms of Service.
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    opacity: 0.7,
  },
  usageSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  usageTitle: {
    marginBottom: Spacing.md,
  },
  usageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  usageItem: {
    flex: 1,
    minWidth: "45%",
    gap: 4,
  },
  usageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  usageBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  usageProgress: {
    height: "100%",
    borderRadius: 3,
  },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  referralSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  referralHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  referralSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.md,
  },
  referralCode: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  trialContent: {
    flex: 1,
  },
  trialSubtitle: {
    opacity: 0.7,
    marginTop: 2,
  },
  plansContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  planCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: Spacing.lg,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  popularText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  planBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  currentBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
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
  period: {
    opacity: 0.6,
  },
  planDescription: {
    opacity: 0.7,
    marginBottom: Spacing.md,
  },
  featuresContainer: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  featureText: {},
  featureDisabled: {
    opacity: 0.5,
    textDecorationLine: "line-through",
  },
  featureBold: {
    fontWeight: "700",
  },
  selectedIndicator: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButton: {
    marginBottom: Spacing.lg,
  },
  finePrint: {
    paddingVertical: Spacing.lg,
  },
  finePrintText: {
    textAlign: "center",
    opacity: 0.5,
  },
  dfySection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  dfySectionTitle: {
    marginBottom: Spacing.xs,
  },
  dfySectionSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  dfyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    position: 'relative',
  },
  dfyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  dfyBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyCardTitleContainer: {
    flex: 1,
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
  dfyButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  dfyPopularBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.lg,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
});
