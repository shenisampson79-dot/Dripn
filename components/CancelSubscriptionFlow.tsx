import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  Animated,
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
import { useTranslations } from "@/contexts/TranslationContext";
import { normalizeSubscriptionTier, getBillingPlanDisplayName, type BillingPlanId } from "@/utils/subscriptionTier";
import { isDevTestingModeEnabled } from "@/utils/devTesting";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { SubscriptionTier } from "@/contexts/AuthContext";

function formatRetentionLabel(value?: string | null): string {
  if (!value) return "";
  return value.replace(/_/g, " ");
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  personal_stylist: 1,
  stylist_unlimited: 2,
};

export type CancelReason =
  | "too-expensive"
  | "not-using"
  | "not-seeing-value"
  | "just-testing"
  | "other";

type SmartOffer = {
  type: 'discount' | 'pause' | 'downgrade' | 'resume_full';
  offerKey?: 'retention_50' | 'retention_30' | null;
  cta?: string;
  segment?: string;
  usageSegment?: string;
  message?: string;
  title?: string;
  body?: string;
  actionLabel?: string;
  acceptedOffer?: string;
  primaryAction?: string;
  discountPercent?: number;
  pauseMonths?: number;
  highlightPlan?: string;
  variant?: string;
  personaSegment?: string;
  churnScore?: number;
  socialProof?: { savesCount: number; avgSavedGbp: number };
};

type CancelOfferConfig = {
  title: string;
  body: string;
  primaryAction: string;
  actionLabel: string;
  acceptedOffer: string;
  discountPercent?: number;
  offerKey?: string;
  secondaryOfferKey?: string;
  pauseMonths?: number;
  highlightPlan?: string;
  secondaryAction?: string;
  secondaryLabel?: string;
  secondaryAcceptedOffer?: string;
};

type CancelVariant = 'A' | 'B' | 'C';

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
  const { t } = useTranslations();
  const { user, refreshSubscriptionFromBackend, updateProfile } = useAuth();

  const cancelReasons: { value: CancelReason; label: string }[] = [
    { value: "too-expensive", label: t('subscription.cancel.reasonTooExpensive') },
    { value: "not-using", label: t('subscription.cancel.reasonNotUsing') },
    { value: "not-seeing-value", label: t('subscription.cancel.reasonNotSeeingValue') },
    { value: "just-testing", label: t('subscription.cancel.reasonJustTesting') },
    { value: "other", label: t('subscription.cancel.reasonOther') },
  ];

  const tierLosses: Record<string, string[]> = {
    free: [],
    personal_stylist: [
      t('subscription.cancel.lossVoiceConversations'),
      t('subscription.cancel.lossExtendedWardrobe'),
      t('subscription.cancel.lossOutfitCalendar'),
      t('subscription.cancel.lossSmartSuggestions'),
    ],
    stylist_unlimited: [
      t('subscription.cancel.lossUnlimitedVoice'),
      t('subscription.cancel.lossVideoCalls'),
      t('subscription.cancel.lossVipAccess'),
      t('subscription.cancel.lossWhiteGlove'),
      t('subscription.cancel.lossUnlimitedEverything'),
    ],
  };

  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelVariant, setCancelVariant] = useState<CancelVariant>('A');
  const [variantOffers, setVariantOffers] = useState<Record<string, CancelOfferConfig> | null>(null);
  const [smartOffer, setSmartOffer] = useState<SmartOffer | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const offerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setOfferLoading(true);
    apiService.getCancelOffer()
      .then((data) => {
        if (data.variant) setCancelVariant(data.variant);
        if (data.offers) setVariantOffers(data.offers as Record<string, CancelOfferConfig>);
        if (data.offer) {
          setSmartOffer(data.offer);
          offerAnim.setValue(0);
          Animated.spring(offerAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      })
      .catch(() => {
        apiService.getCancelVariant()
          .then((data) => {
            if (data.variant) setCancelVariant(data.variant);
            if (data.offers) setVariantOffers(data.offers);
          })
          .catch(() => {});
      })
      .finally(() => setOfferLoading(false));
  }, [offerAnim]);

  const normalizedTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const tierName = getBillingPlanDisplayName(user?.subscriptionTier);
  const losses = tierLosses[normalizedTier] ?? tierLosses.personal_stylist;

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

  const handleAcceptDiscount = async (offerKey = 'retention_30', acceptedOffer = 'discount_30') => {
    setIsProcessing(true);
    try {
      const result = await apiService.applySubscriptionDiscount({
        reason: selectedReason ?? undefined,
        variant: cancelVariant,
        acceptedOffer,
        offer: offerKey,
        offerType: smartOffer?.type ?? 'discount',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        t('subscription.cancel.discountAppliedTitle'),
        result.message || t('subscription.cancel.discountAppliedMessage').replace('{percent}', String(result.discountPercent ?? 30)),
        [{ text: t('subscription.cancel.great'), onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      const msg = error?.message || t('subscription.cancel.discountFailed');
      if (msg.includes("not available") || msg.includes("DISCOUNT_NOT_CONFIGURED")) {
        Alert.alert(
          t('subscription.cancel.offerUnavailableTitle'),
          t('subscription.cancel.offerUnavailableMessage'),
          [{ text: t('common.done') }]
        );
      } else {
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePausePlan = async (months = 3, acceptedOffer = 'pause_3_months') => {
    setIsProcessing(true);
    try {
      const result = await apiService.pauseSubscription({
        months,
        reason: selectedReason ?? undefined,
        variant: cancelVariant,
        acceptedOffer,
        offerType: smartOffer?.type ?? 'pause',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        t('subscription.cancel.planPausedTitle'),
        result.message || t('subscription.cancel.planPausedMessage'),
        [{ text: t('common.done'), onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('subscription.cancel.pauseFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveDowngradePlan = (highlightPlan?: string): 'style_chat' | 'personal_stylist' | 'stylist_unlimited' => {
    const plan = highlightPlan || 'style_chat';
    if (plan === 'subscription' || plan === 'style_chat' || plan === 'personal_stylist') return 'style_chat';
    if (plan === 'stylist_unlimited' || plan === 'pro' || plan === 'premium') return 'stylist_unlimited';
    return 'style_chat';
  };

  const handleDowngrade = async (highlightPlan?: string, acceptedOffer = 'downgrade_style_chat') => {
    const plan = resolveDowngradePlan(highlightPlan);
    const targetTier = normalizeSubscriptionTier(plan);
    setIsProcessing(true);
    try {
      const devTesting = __DEV__ && (await isDevTestingModeEnabled());
      const currentRank = TIER_RANK[normalizedTier] ?? 0;
      const targetRank = TIER_RANK[targetTier] ?? 0;

      if (targetRank >= currentRank) {
        navigation.navigate("Subscription", {
          highlightPlan: (highlightPlan || "style_chat") as SubscriptionTier,
        });
        handleKeepSubscription();
        return;
      }

      if (devTesting) {
        await updateProfile({ subscriptionTier: targetTier });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Plan updated",
          `You're now on ${getBillingPlanDisplayName(targetTier)} (testing mode — no Stripe charge).`,
          [{ text: "OK", onPress: handleKeepSubscription }],
        );
        return;
      }

      const result = await apiService.downgradeSubscription({
        plan,
        reason: selectedReason ?? undefined,
        variant: cancelVariant,
        acceptedOffer,
        offerType: smartOffer?.type ?? 'downgrade',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSubscriptionFromBackend().catch(() => {});
      Alert.alert(
        "Plan updated",
        result.message || `You're now on ${result.tierName || getBillingPlanDisplayName(plan)}.`,
        [{ text: "OK", onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      const msg = error?.message || "Could not change plan.";
      if (msg.includes("NOT_A_DOWNGRADE") || msg.includes("lower than")) {
        navigation.navigate("Subscription", {
          highlightPlan: (highlightPlan || "style_chat") as import("@/contexts/AuthContext").SubscriptionTier,
        });
        handleKeepSubscription();
        return;
      }
      Alert.alert("Error", msg);
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
        reason: selectedReason ?? undefined,
        immediately: false,
        variant: cancelVariant,
        acceptedOffer: 'confirmed_cancel',
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
        {cancelReasons.map((reason) => {
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

  const runOfferAction = (offer: CancelOfferConfig, action: 'primary' | 'secondary' = 'primary') => {
    const isSecondary = action === 'secondary';
    const actionType = isSecondary ? offer.secondaryAction : offer.primaryAction;
    const acceptedOffer = isSecondary ? offer.secondaryAcceptedOffer : offer.acceptedOffer;

    switch (actionType) {
      case 'discount':
        handleAcceptDiscount(
          isSecondary
            ? (offer.secondaryOfferKey ?? (offer.discountPercent === 50 ? 'retention_50' : 'retention_30'))
            : (smartOffer?.offerKey ?? offer.offerKey ?? (offer.discountPercent === 50 ? 'retention_50' : 'retention_30')),
          acceptedOffer
        );
        break;
      case 'pause':
        handlePausePlan(
          isSecondary ? (offer.pauseMonths ?? 1) : (offer.pauseMonths ?? 3),
          acceptedOffer
        );
        break;
      case 'ai_stylist':
        goToAIStylist();
        break;
      case 'downgrade':
        handleDowngrade(offer.highlightPlan, acceptedOffer);
        break;
      case 'keep':
      default:
        handleKeepSubscription();
        break;
    }
  };

  const smartOfferToConfig = (offer: SmartOffer): CancelOfferConfig => ({
    title: offer.title || 'Special offer for you',
    body: offer.body || offer.message || '',
    primaryAction: offer.primaryAction || 'keep',
    actionLabel: offer.actionLabel || 'Continue',
    acceptedOffer: offer.acceptedOffer || offer.cta || 'keep',
    discountPercent: offer.discountPercent,
    offerKey: offer.offerKey ?? undefined,
    pauseMonths: offer.pauseMonths,
    highlightPlan: offer.highlightPlan,
  });

  const renderOfferStep = () => {
    if (!selectedReason) return null;

    if (offerLoading) {
      return (
        <View style={[styles.stepContent, styles.offerLoadingBox]}>
          <ActivityIndicator size="large" color={LuxuryColors.gold} />
          <ThemedText type="body" style={{ color: theme.tabIconDefault, marginTop: Spacing.md }}>
            Finding your best offer…
          </ThemedText>
        </View>
      );
    }

    const fallbackOffers: Record<CancelReason, CancelOfferConfig> = {
      "too-expensive": {
        title: "30% off your next billing cycle",
        body: "Stay on your plan and save 30% on your next payment.",
        primaryAction: "discount",
        discountPercent: 30,
        offerKey: "retention_30",
        actionLabel: "Accept Discount",
        acceptedOffer: "discount_30",
      },
      "not-using": {
        title: "Pause your plan",
        body: "Pause billing for up to 3 months while keeping your wardrobe and stylist history.",
        primaryAction: "pause",
        pauseMonths: 3,
        actionLabel: "Pause Plan",
        acceptedOffer: "pause_3_months",
      },
      "not-seeing-value": {
        title: "Try a personalised outfit first",
        body: "Let your AI stylist build one outfit tailored to your wardrobe before you decide.",
        primaryAction: "ai_stylist",
        actionLabel: "Try Personalised Outfit",
        acceptedOffer: "ai_stylist",
      },
      "just-testing": {
        title: "Your access continues",
        body: "You keep full access until the end of your billing period — no rush.",
        primaryAction: "keep",
        actionLabel: "Keep Exploring",
        acceptedOffer: "keep_exploring",
      },
      other: {
        title: "View lower plans",
        body: "Personal Stylist starts at a lower price — you might not need to cancel.",
        primaryAction: "downgrade",
        highlightPlan: "style_chat",
        actionLabel: "View Lower Plans",
        acceptedOffer: "view_lower_plans",
      },
    };

    const offer =
      smartOffer
        ? smartOfferToConfig(smartOffer)
        : (variantOffers?.[selectedReason] ?? fallbackOffers[selectedReason]);

    const offerScale = offerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
    const offerOpacity = offerAnim;

    return (
      <View style={styles.stepContent}>
        {smartOffer?.personaSegment || smartOffer?.segment ? (
          <ThemedText type="small" style={[styles.segmentHint, { color: theme.tabIconDefault }]}>
            Personalised for {formatRetentionLabel(smartOffer.usageSegment) || "your"} usage ·{" "}
            {formatRetentionLabel(smartOffer.personaSegment ?? smartOffer.segment)} retention
          </ThemedText>
        ) : null}
        <Animated.View style={{ transform: [{ scale: offerScale }], opacity: offerOpacity }}>
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
            {smartOffer?.socialProof && smartOffer.socialProof.savesCount >= 3 ? (
              <ThemedText
                type="small"
                style={{ color: "rgba(26,26,46,0.75)", textAlign: "center", marginTop: Spacing.md, fontStyle: "italic" }}
              >
                People like you saved £{smartOffer.socialProof.avgSavedGbp.toFixed(0)} on average
              </ThemedText>
            ) : null}
          </LinearGradient>
        </Animated.View>

        <Button
          onPress={() => {
            if (smartOffer?.type === 'resume_full') {
              handleKeepSubscription();
              return;
            }
            runOfferAction(offer, 'primary');
          }}
          disabled={isProcessing}
          style={[styles.primaryButton, { backgroundColor: LuxuryColors.gold }]}
        >
          {isProcessing ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator size="small" color={LuxuryColors.midnight} />
              <ThemedText style={{ color: LuxuryColors.midnight, marginLeft: 8 }}>Processing…</ThemedText>
            </View>
          ) : offer.actionLabel}
        </Button>

        {offer.secondaryAction && offer.secondaryLabel ? (
          <Button
            onPress={() => runOfferAction(offer, 'secondary')}
            disabled={isProcessing}
            style={styles.primaryButton}
          >
            {offer.secondaryLabel}
          </Button>
        ) : null}

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
  segmentHint: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  offerLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
