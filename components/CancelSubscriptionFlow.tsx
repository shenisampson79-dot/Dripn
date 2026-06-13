import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeSubscriptionTier, getBillingPlanDisplayName } from "@/utils/subscriptionTier";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

export type CancelReason =
  | "too-expensive"
  | "not-using"
  | "not-seeing-value"
  | "just-testing"
  | "other";

const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: "too-expensive", label: "Too expensive" },
  { value: "not-using", label: "Not using enough" },
  { value: "not-seeing-value", label: "Not seeing value" },
  { value: "just-testing", label: "Just testing" },
  { value: "other", label: "Other" },
];

const TIER_LOSSES: Record<string, string[]> = {
  free: [],
  subscription: [
    "Voice conversations",
    "Extended wardrobe",
    "Outfit calendar access",
    "Smart outfit suggestions",
  ],
  premium: [
    "Personal AI stylist",
    "Extended voice sessions",
    "Full wardrobe analysis",
    "Outfit calendar",
    "Priority support",
  ],
  pro: [
    "Unlimited voice conversations",
    "Video calls with stylist",
    "VIP member access",
    "White-glove support",
    "Unlimited everything",
  ],
};

type CancelSubscriptionFlowProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "CancelSubscription">;
  onComplete?: () => void;
};

export function CancelSubscriptionFlow({ navigation, onComplete }: CancelSubscriptionFlowProps) {
  const { theme, isDark } = useTheme();
  const { user, refreshSubscriptionFromBackend } = useAuth();

  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const normalizedTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const tierName = getBillingPlanDisplayName(user?.subscriptionTier);
  const losses = TIER_LOSSES[normalizedTier] ?? TIER_LOSSES.subscription;

  const handleKeepSubscription = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onComplete) onComplete();
    else navigation.goBack();
  };

  const goToAIStylist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.dispatch(
      CommonActions.navigate({
        name: "StylistTab",
        params: {
          screen: "AIStylist",
          params: { initialPrompt: "Help me create a personalised outfit for today" },
        },
      })
    );
    handleKeepSubscription();
  };

  const goToLowerPlans = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Subscription", { highlightPlan: "subscription" });
    handleKeepSubscription();
  };

  const handleAcceptDiscount = async () => {
    setIsProcessing(true);
    try {
      const result = await apiService.applySubscriptionDiscount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        "Discount applied!",
        result.message || "30% off has been applied to your next billing cycle.",
        [{ text: "Great!", onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      const msg = error?.message || "Could not apply discount.";
      if (msg.includes("not available") || msg.includes("DISCOUNT_NOT_CONFIGURED")) {
        Alert.alert(
          "Offer unavailable",
          "The discount offer isn't available right now. You can still manage billing or contact support.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePausePlan = async () => {
    setIsProcessing(true);
    try {
      const result = await apiService.pauseSubscription();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        "Plan paused",
        result.message || "Your subscription is paused. You won't be charged until you resume.",
        [{ text: "OK", onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not pause subscription.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsProcessing(true);
    try {
      if (selectedReason) {
        await apiService.submitCancellationFeedback({
          reason: selectedReason,
        }).catch(() => {});
      }
      const result = await apiService.cancelSubscription({
        reason: selectedReason,
        immediately: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        "Subscription cancelled",
        result.message ||
          "Your subscription will remain active until the end of the current billing period.",
        [{ text: "OK", onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to cancel subscription.");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[
            styles.progressDot,
            { backgroundColor: s <= step ? LuxuryColors.gold : theme.border },
          ]}
        />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <LinearGradient
        colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
        style={styles.heroIcon}
      >
        <Feather name="alert-circle" size={32} color="#FFFFFF" />
      </LinearGradient>

      <ThemedText type="h2" style={styles.title}>
        Wait — don't lose your style progress
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        You've built wardrobe insights, outfit history, and stylist conversations on{" "}
        {tierName}. Cancelling removes premium access when your billing period ends.
      </ThemedText>

      <View style={styles.lossPreview}>
        {losses.slice(0, 3).map((item) => (
          <View key={item} style={styles.lossPreviewRow}>
            <Feather name="star" size={14} color={LuxuryColors.gold} />
            <ThemedText type="small">{item}</ThemedText>
          </View>
        ))}
      </View>

      <Button onPress={handleKeepSubscription} style={styles.primaryButton}>
        Keep Subscription
      </Button>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setStep(2);
        }}
        style={styles.linkButton}
      >
        <ThemedText style={{ color: theme.tabIconDefault }}>Continue</ThemedText>
        <Feather name="chevron-right" size={16} color={theme.tabIconDefault} />
      </Pressable>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.title}>
        What's the main reason?
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        Your feedback helps us improve Dripn for everyone.
      </ThemedText>

      <View style={styles.reasonsContainer}>
        {CANCEL_REASONS.map((reason) => {
          const isSelected = selectedReason === reason.value;
          return (
            <Pressable
              key={reason.value}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedReason(reason.value);
              }}
              style={[
                styles.reasonOption,
                {
                  backgroundColor: isSelected ? LuxuryColors.gold : theme.backgroundSecondary,
                  borderColor: isSelected ? LuxuryColors.gold : theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  {
                    borderColor: isSelected ? LuxuryColors.midnight : theme.border,
                    backgroundColor: isSelected ? LuxuryColors.midnight : "transparent",
                  },
                ]}
              >
                {isSelected ? (
                  <View style={[styles.radioInner, { backgroundColor: LuxuryColors.gold }]} />
                ) : null}
              </View>
              <ThemedText
                type="body"
                style={{
                  color: isSelected ? LuxuryColors.midnight : theme.text,
                  fontWeight: isSelected ? "600" : "400",
                  flex: 1,
                }}
              >
                {reason.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <Button
        onPress={() => setStep(3)}
        disabled={!selectedReason}
        style={styles.primaryButton}
      >
        Continue
      </Button>
      <Pressable onPress={handleKeepSubscription} style={styles.linkButton}>
        <ThemedText style={{ color: theme.link }}>Keep Subscription</ThemedText>
      </Pressable>
    </View>
  );

  const renderOfferStep = () => {
    if (!selectedReason) return null;

    const offers: Record<
      CancelReason,
      { title: string; body: string; actionLabel: string; onAction: () => void }
    > = {
      "too-expensive": {
        title: "30% off your next billing cycle",
        body: "Stay on your plan and save 30% on your next payment. No commitment beyond your current billing period.",
        actionLabel: "Accept Discount",
        onAction: handleAcceptDiscount,
      },
      "not-using": {
        title: "Pause your plan",
        body: "Pause billing for up to 3 months while keeping your wardrobe and stylist history. Resume anytime.",
        actionLabel: "Pause Plan",
        onAction: handlePausePlan,
      },
      "not-seeing-value": {
        title: "Try a personalised outfit first",
        body: "Let your AI stylist build one outfit tailored to your wardrobe before you decide. It takes less than a minute.",
        actionLabel: "Try Personalised Outfit",
        onAction: goToAIStylist,
      },
      "just-testing": {
        title: "Your access continues",
        body: "You keep full access until the end of your billing period — no rush. Explore outfit calendar, voice chat, and stylist features while you decide.",
        actionLabel: "Keep Exploring",
        onAction: handleKeepSubscription,
      },
      other: {
        title: "View lower plans",
        body: "Style Chat starts at a lower price with voice access and extended wardrobe — you might not need to cancel.",
        actionLabel: "View Lower Plans",
        onAction: goToLowerPlans,
      },
    };

    const offer = offers[selectedReason];

    return (
      <View style={styles.stepContent}>
        <LinearGradient
          colors={[LuxuryColors.gold, LuxuryColors.deepGold]}
          style={styles.offerCard}
        >
          <Feather name="gift" size={24} color={LuxuryColors.midnight} />
          <ThemedText type="h3" style={{ color: LuxuryColors.midnight, marginTop: Spacing.sm }}>
            {offer.title}
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: "rgba(26,26,46,0.85)", textAlign: "center", marginTop: Spacing.sm }}
          >
            {offer.body}
          </ThemedText>
        </LinearGradient>

        <Button
          onPress={offer.onAction}
          disabled={isProcessing}
          style={[styles.primaryButton, { backgroundColor: LuxuryColors.gold }]}
        >
          {isProcessing ? "Processing..." : offer.actionLabel}
        </Button>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep(4);
          }}
          style={styles.linkButton}
        >
          <ThemedText style={{ color: theme.tabIconDefault }}>Continue to cancel</ThemedText>
          <Feather name="chevron-right" size={16} color={theme.tabIconDefault} />
        </Pressable>
      </View>
    );
  };

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.title}>
        You'll lose access to
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        After your billing period ends on {tierName}:
      </ThemedText>

      <View
        style={[
          styles.lossList,
          { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
        ]}
      >
        {losses.map((item) => (
          <View key={item} style={styles.lossRow}>
            <View style={styles.lossIcon}>
              <Feather name="x" size={14} color="#DC2626" />
            </View>
            <ThemedText type="body" style={{ flex: 1 }}>{item}</ThemedText>
          </View>
        ))}
        <View style={styles.lossRow}>
          <View style={styles.lossIcon}>
            <Feather name="x" size={14} color="#DC2626" />
          </View>
          <ThemedText type="body" style={{ flex: 1 }}>
            Saved outfits and stylist conversations (read-only after cancel)
          </ThemedText>
        </View>
      </View>

      <Button onPress={handleKeepSubscription} style={styles.primaryButton}>
        Keep Subscription
      </Button>
      <Button
        onPress={handleConfirmCancel}
        disabled={isProcessing}
        style={[styles.destructiveButton, { opacity: isProcessing ? 0.6 : 1 }]}
      >
        {isProcessing ? "Cancelling..." : "Confirm Cancel"}
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderProgress()}
      {step === 1 ? renderStep1() : null}
      {step === 2 ? renderStep2() : null}
      {step === 3 ? renderOfferStep() : null}
      {step === 4 ? renderStep4() : null}
      {isProcessing && step !== 4 ? (
        <ActivityIndicator style={styles.loader} color={LuxuryColors.gold} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  lossPreview: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  lossPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  primaryButton: {
    width: "100%",
    marginBottom: Spacing.sm,
  },
  destructiveButton: {
    width: "100%",
    backgroundColor: "#DC2626",
    marginTop: Spacing.sm,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  reasonsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  offerCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  lossList: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  lossRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  lossIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(220,38,38,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    marginTop: Spacing.md,
  },
});
