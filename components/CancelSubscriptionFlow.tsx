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
import { normalizeSubscriptionTier, getBillingPlanDisplayName } from "@/utils/subscriptionTier";
import { isDevTestingModeEnabled } from "@/utils/devTesting";
import {
  openAppleManageSubscriptions,
  shouldManageSubscriptionViaApple,
} from "@/utils/platformPayments";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import type { SubscriptionTier } from "@/contexts/AuthContext";

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

function formatPeriodEndDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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

  // Aligned with TIER_MATRIX — Personal Stylist has no outfit calendar
  const tierLosses: Record<string, string[]> = {
    free: [],
    personal_stylist: [
      t('subscription.cancel.lossVoiceConversations'),
      t('subscription.cancel.lossUnlimitedDecisions'),
      t('subscription.cancel.lossExtendedWardrobe'),
      t('subscription.cancel.lossWardrobeAware'),
      t('subscription.cancel.lossSmartSuggestions'),
    ],
    stylist_unlimited: [
      t('subscription.cancel.lossOutfitCalendar'),
      t('subscription.cancel.lossUnlimitedEverything'),
      t('subscription.cancel.lossUnlimitedVoice'),
      t('subscription.cancel.lossVipAccess'),
      t('subscription.cancel.lossWhiteGlove'),
    ],
  };

  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelVariant, setCancelVariant] = useState<CancelVariant>('A');
  const [variantOffers, setVariantOffers] = useState<Record<string, CancelOfferConfig> | null>(null);
  const [smartOffer, setSmartOffer] = useState<SmartOffer | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [appleManaged, setAppleManaged] = useState(false);
  const [gateChecked, setGateChecked] = useState(false);
  const offerAnim = useRef(new Animated.Value(0)).current;

  const normalizedTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const canDowngrade = (TIER_RANK[normalizedTier] ?? 0) > TIER_RANK.personal_stylist;

  useEffect(() => {
    let cancelled = false;

    const gateAndLoad = async () => {
      try {
        const status = await apiService.getSubscriptionStatus().catch(() => null);
        if (cancelled) return;

        const periodEnd = status?.currentPeriodEnd ?? status?.cancelAt ?? null;
        setCurrentPeriodEnd(periodEnd);

        const viaApple = shouldManageSubscriptionViaApple({
          billingPlatform: status?.billingPlatform,
          hasStripeBilling: status?.hasStripeBilling,
          stripeSubscriptionId: status?.stripeSubscriptionId,
        });

        if (viaApple) {
          setAppleManaged(true);
          setGateChecked(true);
          Alert.alert(
            t('subscription.cancel.appleCancelTitle') || 'Manage in the App Store',
            t('subscription.cancel.appleCancelMessage') ||
              'This subscription is billed through Apple. Cancel or change it in Settings → Apple ID → Subscriptions, or tap Manage Subscription.',
            [
              {
                text: t('subscription.cancel.appleCancelManage') || 'Manage Subscription',
                onPress: async () => {
                  await openAppleManageSubscriptions().catch(() => {});
                  if (onComplete) onComplete();
                  else navigation.goBack();
                },
              },
              {
                text: t('common.cancel') || 'Cancel',
                style: 'cancel',
                onPress: () => {
                  if (onComplete) onComplete();
                  else navigation.goBack();
                },
              },
            ],
          );
          return;
        }

        setGateChecked(true);
        setOfferLoading(true);
        try {
          const data = await apiService.getCancelOffer(user?.subscriptionTier);
          if (cancelled) return;
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
        } catch {
          try {
            const data = await apiService.getCancelVariant();
            if (cancelled) return;
            if (data.variant) setCancelVariant(data.variant);
            if (data.offers) setVariantOffers(data.offers);
          } catch {
            /* use local fallbacks */
          }
        } finally {
          if (!cancelled) setOfferLoading(false);
        }
      } catch {
        if (!cancelled) {
          setGateChecked(true);
          setOfferLoading(false);
        }
      }
    };

    gateAndLoad();
    return () => {
      cancelled = true;
    };
  }, [offerAnim, user?.subscriptionTier, navigation, onComplete, t]);

  const losses = tierLosses[normalizedTier] ?? tierLosses.personal_stylist;
  const periodEndLabel = formatPeriodEndDate(currentPeriodEnd);

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
      if (msg.includes("not available") || msg.includes("DISCOUNT_NOT_CONFIGURED") || msg.includes("APPLE_BILLING")) {
        Alert.alert(
          t('subscription.cancel.offerUnavailableTitle'),
          msg.includes("APPLE_BILLING") || msg.includes("App Store")
            ? (t('subscription.cancel.appleCancelMessage') || msg)
            : t('subscription.cancel.offerUnavailableMessage'),
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
          highlightPlan: normalizeSubscriptionTier(highlightPlan || "personal_stylist"),
        });
        handleKeepSubscription();
        return;
      }

      if (devTesting) {
        await updateProfile({ subscriptionTier: targetTier });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t('cancelFlow.planUpdated') || "Plan updated",
          (t('cancelFlow.nowOnPlanTesting') || "You're now on {plan} (testing mode — no Stripe charge).")
            .replace('{plan}', getBillingPlanDisplayName(targetTier)),
          [{ text: t('common.ok') || "OK", onPress: handleKeepSubscription }],
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
        t('cancelFlow.planUpdated') || "Plan updated",
        result.message ||
          (t('cancelFlow.nowOnPlan') || "You're now on {plan}.")
            .replace('{plan}', result.tierName || getBillingPlanDisplayName(plan)),
        [{ text: t('common.ok') || "OK", onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      const msg = error?.message || t('cancelFlow.couldNotChangePlan') || "Could not change plan.";
      if (msg.includes("NOT_A_DOWNGRADE") || msg.includes("lower than") || msg.includes("lowest paid")) {
        navigation.navigate("Subscription", {
          highlightPlan: normalizeSubscriptionTier(highlightPlan || "personal_stylist"),
        });
        handleKeepSubscription();
        return;
      }
      Alert.alert(t('common.error'), msg);
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
      const cancelDateLabel = formatPeriodEndDate(result.cancelAt ?? result.currentPeriodEnd ?? currentPeriodEnd);
      const successMessage = cancelDateLabel
        ? (t('subscription.cancel.cancelledUntilDate') || 'Your subscription will remain active until {date}.')
            .replace('{date}', cancelDateLabel)
        : (result.message ||
            t('cancelFlow.remainActiveUntilPeriodEnd') ||
            "Your subscription will remain active until the end of the current billing period.");
      Alert.alert(
        t('cancelFlow.subscriptionCancelled') || "Subscription cancelled",
        successMessage,
        [{ text: t('common.ok') || "OK", onPress: handleKeepSubscription }]
      );
    } catch (error: any) {
      const msg = error?.message || t('cancelFlow.failedToCancel') || "Failed to cancel. Please try again.";
      if (msg.includes('APPLE_BILLING') || msg.includes('App Store')) {
        Alert.alert(
          t('subscription.cancel.appleCancelTitle') || 'Manage in the App Store',
          t('subscription.cancel.appleCancelMessage') || msg,
          [
            {
              text: t('subscription.cancel.appleCancelManage') || 'Manage Subscription',
              onPress: async () => {
                await openAppleManageSubscriptions().catch(() => {});
                handleKeepSubscription();
              },
            },
            { text: t('common.ok') || 'OK', onPress: handleKeepSubscription },
          ],
        );
        return;
      }
      Alert.alert(t('common.error'), msg);
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
        {t('cancelFlow.waitDontLose') || "Wait — don't lose your style progress"}
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        {t('cancelFlow.waitBody') || "You'll lose access to your saved outfits, stylist conversations, and personalized recommendations."}
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
        {t('cancelFlow.keepSubscription') || 'Keep Subscription'}
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
        {t('cancelFlow.mainReason') || "What's the main reason?"}
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        {t('cancelFlow.feedbackHelps') || 'Your feedback helps us improve Dripn.'}
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
        <ThemedText style={{ color: theme.link }}>
          {t('cancelFlow.keepSubscription') || 'Keep Subscription'}
        </ThemedText>
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

  const filterLocalOfferForTier = (offer: CancelOfferConfig): CancelOfferConfig => {
    if (canDowngrade || offer.primaryAction !== 'downgrade') return offer;
    return {
      title: "Pause your plan",
      body: "Pause billing for up to 3 months while keeping your wardrobe and stylist history.",
      primaryAction: "pause",
      pauseMonths: 3,
      actionLabel: "Pause Plan",
      acceptedOffer: "pause_3_months",
    };
  };

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
      other: canDowngrade
        ? {
            title: "View lower plans",
            body: "Personal Stylist starts at a lower price — you might not need to cancel.",
            primaryAction: "downgrade",
            highlightPlan: "personal_stylist",
            actionLabel: "View Personal Stylist",
            acceptedOffer: "view_lower_plans",
          }
        : {
            title: "30% off your next billing cycle",
            body: "Stay on Personal Stylist and save 30% on your next payment.",
            primaryAction: "discount",
            discountPercent: 30,
            offerKey: "retention_30",
            actionLabel: "Accept Discount",
            acceptedOffer: "discount_30",
          },
    };

    const offer = filterLocalOfferForTier(
      smartOffer
        ? smartOfferToConfig(smartOffer)
        : (variantOffers?.[selectedReason] ?? fallbackOffers[selectedReason]),
    );

    const offerScale = offerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
    const offerOpacity = offerAnim;

    return (
      <View style={styles.stepContent}>
        {smartOffer ? (
          <ThemedText type="small" style={[styles.segmentHint, { color: theme.tabIconDefault }]}>
            {t('subscription.cancel.basedOnUsage') || 'Based on how you use Dripn'}
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
          <ThemedText style={{ color: theme.tabIconDefault }}>
            {t('cancelFlow.continueToCancel') || 'Continue to Cancel'}
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.tabIconDefault} />
        </Pressable>
      </View>
    );
  };

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.title}>
        {t('cancelFlow.youllLoseAccess') || "You'll lose access to"}
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        {periodEndLabel
          ? (t('subscription.cancel.afterBillingEndsOn') || 'After your billing period ends on {date}:')
              .replace('{date}', periodEndLabel)
          : (t('subscription.cancel.afterBillingEnds') || 'After your billing period ends:')}
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
            {t('cancelFlow.savedOutfitsAndChats') || 'Saved outfits and stylist conversations'}
          </ThemedText>
        </View>
      </View>

      <Button onPress={handleKeepSubscription} style={styles.primaryButton}>
        {t('cancelFlow.keepSubscription') || 'Keep Subscription'}
      </Button>
      <Button
        onPress={handleConfirmCancel}
        disabled={isProcessing}
        style={[styles.destructiveButton, { opacity: isProcessing ? 0.6 : 1 }]}
      >
        {isProcessing ? (t('cancelFlow.cancelling') || "Cancelling...") : (t('cancelFlow.confirmCancel') || 'Confirm Cancel')}
      </Button>
    </View>
  );

  if (!gateChecked || appleManaged) {
    return (
      <View style={[styles.container, styles.offerLoadingBox]}>
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
      </View>
    );
  }

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
