import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert, Dimensions } from "react-native";
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
import { useSubscription, SUBSCRIPTION_PLANS } from "@/contexts/SubscriptionContext";
import { currencyService } from "@/services/CurrencyService";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

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
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
  gradientColors: readonly [string, string, ...string[]];
  accentColor: string;
}

type DisplayTier = 'free' | 'personal_stylist';

const PLAN_FEATURES: Record<DisplayTier, PlanFeature[]> = {
  free: [
    { text: "1 post per day", included: true },
    { text: "Basic styling tips", included: true },
    { text: "Community voting (after 5 decisions)", included: true },
    { text: "Unlimited stylist advice", included: false },
    { text: "Voice features", included: false },
    { text: "Ad-free experience", included: false },
  ],
  personal_stylist: [
    { text: "Unlimited outfit posts", included: true },
    { text: "Unlimited AI styling advice", included: true },
    { text: "Personal AI Stylist (Ruby, Max, or Ace)", included: true, bold: true },
    { text: "Community voting (instant access)", included: true, bold: true },
    { text: "Voice conversations with your stylist", included: true },
    { text: "Wardrobe analysis & recommendations", included: true },
    { text: "Priority support", included: true },
    { text: "Ad-free experience", included: true },
  ],
};

const PLAN_METADATA: Record<DisplayTier, { name: string; period: string; description: string; popular?: boolean }> = {
  free: { name: "Free", period: "forever", description: "Get started with basic features" },
  personal_stylist: { name: "Personal Stylist", period: "/month", description: "Your AI fashion advisor" },
};

const getLocalizedPlans = (prices: { free: string; personal_stylist: string }): Plan[] => [
  { 
    id: "free" as SubscriptionTier, 
    ...PLAN_METADATA.free, 
    price: prices.free, 
    features: PLAN_FEATURES.free,
    gradientColors: ['#2A2A3E', '#1A1A2E'] as const,
    accentColor: LUXURY_COLORS.champagne,
  },
  { 
    id: "premium" as SubscriptionTier, 
    ...PLAN_METADATA.personal_stylist, 
    price: prices.personal_stylist, 
    features: PLAN_FEATURES.personal_stylist,
    gradientColors: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const,
    accentColor: LUXURY_COLORS.gold,
  },
];

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, updateProfile } = useAuth();
  const { 
    usage, 
    limits, 
    getRemainingUploads, 
    getRemainingAIAdvice, 
    getRemainingVoice,
    getRemainingPolls,
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
    outfit_setup: "£19.99",
    wardrobe_setup: "£39.99",
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

  const formatRemaining = (value: number): string => {
    if (value === Infinity) return "Unlimited";
    return value.toString();
  };

  const getUsagePercent = (used: number, limit: number): number => {
    if (limit === Infinity) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const usageColors = [LUXURY_COLORS.violet, LUXURY_COLORS.coral, LUXURY_COLORS.teal, LUXURY_COLORS.gold];

  const renderPlanCard = (plan: Plan, index: number) => {
    const isSelected = selectedPlan === plan.id;
    const isPaidPlan = plan.id === 'premium';
    const userOnPaidTier = user?.subscriptionTier && ['basic', 'premium', 'vip'].includes(user.subscriptionTier);
    const isCurrent = plan.id === 'free' 
      ? user?.subscriptionTier === 'free' 
      : isPaidPlan && userOnPaidTier;

    return (
      <Pressable
        key={plan.id}
        onPress={() => setSelectedPlan(plan.id)}
        style={({ pressed }) => [
          styles.planCard,
          {
            borderColor: isSelected ? plan.accentColor : "transparent",
            borderWidth: isSelected ? 2 : 0,
            opacity: pressed ? 0.95 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={plan.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.planGradient}
        >
          {plan.popular ? (
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.popularBadge}
            >
              <ThemedText type="caption" style={styles.popularText}>
                Most Popular
              </ThemedText>
            </LinearGradient>
          ) : null}

          <View style={styles.planHeader}>
            <View style={[styles.planNameContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <ThemedText type="h3" style={styles.planName}>
                {plan.name}
              </ThemedText>
            </View>
            {isCurrent ? (
              <View style={[styles.currentBadge, { backgroundColor: LUXURY_COLORS.emerald }]}>
                <ThemedText type="caption" style={styles.currentText}>
                  Current
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.priceContainer}>
            <ThemedText type="h1" style={[styles.price, { color: '#FFFFFF' }]}>
              {plan.price}
            </ThemedText>
            <ThemedText type="body" style={[styles.period, { color: 'rgba(255,255,255,0.7)' }]}>
              {plan.period}
            </ThemedText>
          </View>

          <ThemedText type="body" style={[styles.planDescription, { color: 'rgba(255,255,255,0.8)' }]}>
            {plan.description}
          </ThemedText>

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

          {isSelected && !isCurrent ? (
            <View style={[styles.selectedIndicator, { backgroundColor: plan.accentColor }]}>
              <Feather name="check" size={16} color={LUXURY_COLORS.midnight} />
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <ScreenScrollView style={{ backgroundColor: isDark ? '#0D0B09' : '#FAF8F5' }}>
      <LinearGradient
        colors={isDark 
          ? [LUXURY_COLORS.deepViolet, LUXURY_COLORS.berry, '#0D0B09'] 
          : [LUXURY_COLORS.violet, LUXURY_COLORS.rose, '#FAF8F5']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.heroContent}>
          <View style={styles.heroIconContainer}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.heroIconGradient}
            >
              <Feather name="award" size={28} color={LUXURY_COLORS.midnight} />
            </LinearGradient>
          </View>
          <ThemedText type="h1" style={styles.heroTitle}>
            Elevate Your Style
          </ThemedText>
          <ThemedText type="body" style={styles.heroSubtitle}>
            Unlock premium features and personalized AI styling
          </ThemedText>
        </View>
      </LinearGradient>

      <View style={[styles.usageSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
        <View style={styles.usageTitleRow}>
          <ThemedText type="h3" style={styles.usageTitle}>
            Your Usage
          </ThemedText>
          <View style={[styles.usagePeriodBadge, { backgroundColor: LUXURY_COLORS.violet + '20' }]}>
            <ThemedText type="caption" style={{ color: LUXURY_COLORS.violet }}>This Month</ThemedText>
          </View>
        </View>
        <View style={styles.usageGrid}>
          {[
            { icon: "upload", label: "Posts", remaining: getRemainingUploads(), used: usage.uploadsThisMonth, limit: limits.uploadsPerMonth },
            { icon: "star", label: "Style Advice", remaining: getRemainingAIAdvice(), used: usage.aiAdviceThisMonth, limit: limits.aiAdvicePerMonth },
            { icon: "mic", label: "Voice", remaining: limits.voiceCommentsPerMonth === 0 ? -1 : getRemainingVoice(), used: usage.voiceCommentsThisMonth, limit: limits.voiceCommentsPerMonth },
            { icon: "bar-chart-2", label: "Polls", remaining: getRemainingPolls(), used: usage.comparisonPollsThisMonth, limit: limits.comparisonPollsPerMonth },
          ].map((item, idx) => (
            <View key={item.label} style={[styles.usageItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }]}>
              <View style={[styles.usageIconContainer, { backgroundColor: usageColors[idx] + '20' }]}>
                <Feather name={item.icon as any} size={16} color={usageColors[idx]} />
              </View>
              <ThemedText type="small" style={styles.usageLabel}>{item.label}</ThemedText>
              <View style={[styles.usageBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <LinearGradient
                  colors={[usageColors[idx], usageColors[idx] + '80']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.usageProgress, 
                    { width: `${getUsagePercent(item.used, item.limit)}%` }
                  ]} 
                />
              </View>
              <ThemedText type="caption" style={styles.usageRemaining}>
                {item.remaining === -1 ? "Not available" : `${formatRemaining(item.remaining)} left`}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.plansContainer}>
        <ThemedText type="h2" style={styles.sectionTitle}>Choose Your Plan</ThemedText>
        {PLANS.map(renderPlanCard)}
      </View>

      {selectedPlan !== user?.subscriptionTier ? (
        <LinearGradient
          colors={selectedPlan === "free" 
            ? [LUXURY_COLORS.champagne, LUXURY_COLORS.rose] 
            : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.subscribeButtonGradient}
        >
          <Pressable
            onPress={() => handleSelectPlan(selectedPlan)}
            disabled={isProcessing}
            style={styles.subscribeButtonInner}
          >
            <ThemedText type="body" style={styles.subscribeButtonText}>
              {isProcessing
                ? "Processing..."
                : selectedPlan === "free"
                  ? "Downgrade to Free"
                  : `Start ${PLANS.find((p) => p.id === selectedPlan)?.name} Plan`}
            </ThemedText>
          </Pressable>
        </LinearGradient>
      ) : null}

      <View style={[styles.referralSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
        <LinearGradient
          colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.referralIconContainer}
        >
          <Feather name="gift" size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.referralContent}>
          <ThemedText type="h3">Invite Friends</ThemedText>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            Share your code and both get 5 extra posts
          </ThemedText>
        </View>
        <View style={[styles.referralCode, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <ThemedText type="h3" style={{ letterSpacing: 3, color: LUXURY_COLORS.teal }}>{referralCode}</ThemedText>
        </View>
      </View>

      <View style={styles.dfySection}>
        <View style={styles.dfySectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Done-For-You Setup
          </ThemedText>
          <ThemedText type="body" style={styles.dfySectionSubtitle}>
            One solves now. The other solves every time after.
          </ThemedText>
        </View>

        <Pressable style={styles.dfyCardWrapper}>
          <LinearGradient
            colors={[LUXURY_COLORS.coral, '#C46A4F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dfyCard}
          >
            <View style={[styles.dfyMentalModelBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>Tactical</ThemedText>
            </View>
            <View style={styles.dfyCardHeader}>
              <View style={[styles.dfyBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Feather name="package" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.dfyCardTitleContainer}>
                <ThemedText type="h3" style={{ color: '#FFFFFF' }}>Outfit-Based Setup</ThemedText>
                <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>One-time purchase</ThemedText>
              </View>
            </View>
            <View style={styles.dfyPriceRow}>
              <ThemedText type="h1" style={[styles.dfyPrice, { color: '#FFFFFF' }]}>{dfyPrices.outfit_setup}</ThemedText>
            </View>
            <ThemedText type="body" style={[styles.dfyDescription, { color: 'rgba(255,255,255,0.9)' }]}>
              Solve a specific problem, once. Upload photos of your outfits and I'll turn them into ready-to-wear looks for one occasion.
            </ThemedText>
            <View style={styles.dfyFeatures}>
              {[
                "You upload outfit photos",
                "3-5 core outfits with rotations",
                "One occasion (work, holiday, event)",
                "14-day access window",
                "Stylist-led adjustments only",
                "Save outfits as static cards",
              ].map((feature, idx) => (
                <View key={idx} style={styles.dfyFeatureRow}>
                  <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Feather name="check" size={12} color="#FFFFFF" />
                  </View>
                  <ThemedText type="small" style={{ color: '#FFFFFF' }}>{feature}</ThemedText>
                </View>
              ))}
              {[
                "No wardrobe creation",
                "No individual item editing",
              ].map((feature, idx) => (
                <View key={`excluded-${idx}`} style={styles.dfyFeatureRow}>
                  <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <Feather name="x" size={12} color="rgba(255,255,255,0.4)" />
                  </View>
                  <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.5)' }}>{feature}</ThemedText>
                </View>
              ))}
            </View>
            <View style={[styles.dfyButtonGradient, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Pressable 
                style={styles.dfyButtonInner}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              >
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Style me for this</ThemedText>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.dfyCardWrapper}>
          <LinearGradient
            colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.dfyCard, styles.dfyCardFeatured]}
          >
            <View style={[styles.dfyPopularBadge, { backgroundColor: 'rgba(26,26,46,0.3)' }]}>
              <ThemedText type="caption" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700' }}>Structural</ThemedText>
            </View>
            <View style={styles.dfyCardHeader}>
              <View style={[styles.dfyBadge, { backgroundColor: 'rgba(26,26,46,0.2)' }]}>
                <Feather name="grid" size={18} color={LUXURY_COLORS.midnight} />
              </View>
              <View style={styles.dfyCardTitleContainer}>
                <ThemedText type="h3" style={{ color: LUXURY_COLORS.midnight }}>Core Wardrobe Setup</ThemedText>
                <ThemedText type="caption" style={{ color: 'rgba(26,26,46,0.6)' }}>One-time purchase</ThemedText>
              </View>
            </View>
            <View style={styles.dfyPriceRow}>
              <ThemedText type="h1" style={[styles.dfyPrice, { color: LUXURY_COLORS.midnight }]}>{dfyPrices.wardrobe_setup}</ThemedText>
            </View>
            <ThemedText type="body" style={[styles.dfyDescription, { color: 'rgba(26,26,46,0.85)' }]}>
              Solve the system, not the moment. Photograph individual items and I'll organise your wardrobe so decisions get easier every time.
            </ThemedText>
            <View style={styles.dfyFeatures}>
              {[
                "You photograph individual items",
                "Up to 30 wardrobe items",
                "Proper categorisation & tagging",
                "Wardrobe saved forever",
                "30 days of active styling",
                "Dynamic outfit generation",
                "Swap & remix any piece",
                "Less repetition, more variety",
              ].map((feature, idx) => (
                <View key={idx} style={styles.dfyFeatureRow}>
                  <View style={[styles.dfyFeatureIcon, { backgroundColor: 'rgba(26,26,46,0.15)' }]}>
                    <Feather name="check" size={12} color={LUXURY_COLORS.midnight} />
                  </View>
                  <ThemedText type="small" style={{ color: LUXURY_COLORS.midnight }}>{feature}</ThemedText>
                </View>
              ))}
            </View>
            <View style={[styles.dfyButtonGradient, { backgroundColor: 'rgba(26,26,46,0.2)' }]}>
              <Pressable 
                style={styles.dfyButtonInner}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              >
                <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: '600' }}>Build my wardrobe</ThemedText>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.finePrint}>
        <ThemedText type="small" style={styles.finePrintText}>
          Subscriptions auto-renew until canceled. You can{' '}
          <ThemedText
            type="small"
            style={[styles.finePrintText, { color: theme.link, textDecorationLine: 'underline' }]}
            onPress={() => navigation.navigate('CancelSubscription')}
          >
            cancel anytime
          </ThemedText>
          {' '}in your account settings. By subscribing, you agree to our Terms of Service.
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  heroGradient: {
    marginHorizontal: -Spacing.lg,
    marginTop: -Spacing.lg,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroIconContainer: {
    marginBottom: Spacing.md,
  },
  heroIconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  usageSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  usageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  usageTitle: {},
  usagePeriodBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  usageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  usageItem: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  usageIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  usageLabel: {
    fontWeight: '600',
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
  usageRemaining: {
    opacity: 0.6,
  },
  plansContainer: {
    marginBottom: Spacing.lg,
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
    left: Spacing.lg,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButtonGradient: {
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  subscribeButtonInner: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '700',
    fontSize: 16,
  },
  referralSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  referralIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralContent: {
    flex: 1,
  },
  referralCode: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
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
  dfyMentalModelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  finePrintText: {
    opacity: 0.5,
    textAlign: "center",
  },
});
