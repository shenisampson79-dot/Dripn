import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, SubscriptionColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SubscriptionTier } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { currencyService } from "@/services/CurrencyService";
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

const PLAN_FEATURES: Record<SubscriptionTier, PlanFeature[]> = {
  free: [
    { text: "3 posts per month", included: true },
    { text: "Community voting", included: true },
    { text: "Basic styling tips", included: true },
    { text: "Standard feed", included: true },
    { text: "Unlimited stylist advice", included: false },
    { text: "Priority support", included: false },
    { text: "No ads", included: false },
  ],
  basic: [
    { text: "20 posts per month", included: true },
    { text: "Community voting", included: true },
    { text: "Full styling advice", included: true },
    { text: "Regional feed filters", included: true },
    { text: "Voice comments", included: true },
    { text: "Ad-free experience", included: true },
    { text: "Priority support", included: false },
  ],
  premium: [
    { text: "100 posts per month", included: true },
    { text: "Priority styling advice", included: true },
    { text: "Exclusive style reports", included: true },
    { text: "All feed filters + VIP events preview", included: true },
    { text: "Unlimited voice comments", included: true },
    { text: "Ad-free experience", included: true },
    { text: "Priority support", included: true },
  ],
  vip: [
    { text: "4 x 60 min video call styling session with a real-life pro stylist", included: true, bold: true },
    { text: "Video calls with VIP members", included: true },
    { text: "Unlimited posts", included: true },
    { text: "Exclusive VIP badge", included: true },
    { text: "Personal stylist (Ruby/Max)", included: true },
    { text: "Early access to features", included: true },
    { text: "Exclusive community events", included: true },
    { text: "Completely ad-free", included: true },
  ],
};

const PLAN_METADATA: Record<SubscriptionTier, { name: string; period: string; description: string; popular?: boolean }> = {
  free: { name: "Free", period: "forever", description: "Get started with basic features" },
  basic: { name: "Basic", period: "/month", description: "Perfect for style enthusiasts" },
  premium: { name: "Premium", period: "/month", description: "For the fashion-forward", popular: true },
  vip: { name: "VIP", period: "/month", description: "The ultimate style experience" },
};

const getLocalizedPlans = (prices: { free: string; basic: string; premium: string; vip: string }): Plan[] => [
  { id: "free", ...PLAN_METADATA.free, price: prices.free, features: PLAN_FEATURES.free },
  { id: "basic", ...PLAN_METADATA.basic, price: prices.basic, features: PLAN_FEATURES.basic },
  { id: "premium", ...PLAN_METADATA.premium, price: prices.premium, features: PLAN_FEATURES.premium },
  { id: "vip", ...PLAN_METADATA.vip, price: prices.vip, features: PLAN_FEATURES.vip },
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
  const [localizedPrices, setLocalizedPrices] = useState<{ free: string; basic: string; premium: string; vip: string }>({
    free: "£0",
    basic: "£4.99",
    premium: "£9.99",
    vip: "£4,999",
  });

  useEffect(() => {
    const initCurrency = async () => {
      await currencyService.initialize();
      setLocalizedPrices(currencyService.getLocalizedPrices());
    };
    initCurrency();
  }, []);

  const PLANS = getLocalizedPlans(localizedPrices);

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    if (planId === user?.subscriptionTier) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await updateProfile({ subscriptionTier: planId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success",
        `You've successfully ${planId === "free" ? "downgraded to" : "upgraded to"} the ${planId} plan!`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to update subscription. Please try again.");
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
    const isCurrent = user?.subscriptionTier === plan.id;
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
              { backgroundColor: colors.backgroundStart || colors.background },
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
});
