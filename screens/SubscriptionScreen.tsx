import React, { useState } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, SubscriptionColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SubscriptionTier } from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type SubscriptionScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Subscription">;
};

interface PlanFeature {
  text: string;
  included: boolean;
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

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic features",
    features: [
      { text: "3 posts per month", included: true },
      { text: "Community voting", included: true },
      { text: "Basic AI styling tips", included: true },
      { text: "Standard feed", included: true },
      { text: "Unlimited AI advice", included: false },
      { text: "Priority support", included: false },
      { text: "No ads", included: false },
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: "$9.99",
    period: "/month",
    description: "Perfect for style enthusiasts",
    features: [
      { text: "10 posts per month", included: true },
      { text: "Community voting", included: true },
      { text: "Full AI styling advice", included: true },
      { text: "Regional feed filters", included: true },
      { text: "Voice comments", included: true },
      { text: "Priority support", included: false },
      { text: "No ads", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$24.99",
    period: "/month",
    description: "For the fashion-forward",
    popular: true,
    features: [
      { text: "Unlimited posts", included: true },
      { text: "Community voting", included: true },
      { text: "Priority AI advice", included: true },
      { text: "All feed filters", included: true },
      { text: "Voice comments", included: true },
      { text: "Priority support", included: true },
      { text: "Reduced ads", included: true },
    ],
  },
  {
    id: "vip",
    name: "VIP",
    price: "$49.99",
    period: "/month",
    description: "The ultimate style experience",
    features: [
      { text: "Everything in Premium", included: true },
      { text: "Exclusive VIP badge", included: true },
      { text: "Personal AI stylist", included: true },
      { text: "Early access to features", included: true },
      { text: "Exclusive community events", included: true },
      { text: "Direct stylist consultation", included: true },
      { text: "Completely ad-free", included: true },
    ],
  },
];

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const { theme } = useTheme();
  const { user, updateProfile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>(
    user?.subscriptionTier || "free"
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    if (planId === user?.subscriptionTier) return;

    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await updateProfile({ subscriptionTier: planId });
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

      <View style={styles.trialBanner}>
        <Feather name="gift" size={24} color={theme.link} />
        <View style={styles.trialContent}>
          <ThemedText type="h3">7-Day Free Trial</ThemedText>
          <ThemedText type="small" style={styles.trialSubtitle}>
            Try any premium plan free for 7 days
          </ThemedText>
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
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: "rgba(184, 134, 11, 0.1)",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
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
