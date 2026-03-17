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
import { useSubscription, SUBSCRIPTION_PLANS, YEARLY_PRICING } from "@/contexts/SubscriptionContext";
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

type DisplayTier = 'free' | 'style_chat' | 'personal_stylist' | 'stylist_unlimited';

const PLAN_FEATURES: Record<DisplayTier, PlanFeature[]> = {
  free: [
    { text: "Basic styling tips", included: true },
    { text: "Limited wardrobe items", included: true },
    { text: "Daily outfit decisions", included: true },
    { text: "Voice conversations", included: false },
    { text: "Personal stylist", included: false },
  ],
  style_chat: [
    { text: "Voice conversations (limited)", included: true },
    { text: "Extended wardrobe", included: true },
    { text: "Outfit calendar access", included: true },
    { text: "Smart outfit suggestions", included: true },
    { text: "Unlimited voice", included: false },
    { text: "Personal stylist", included: false },
  ],
  personal_stylist: [
    { text: "Extended voice sessions", included: true, bold: true },
    { text: "Personal AI stylist", included: true, bold: true },
    { text: "Ruby, Max, Ace, or Ivy", included: true },
    { text: "Full wardrobe analysis", included: true },
    { text: "Outfit calendar", included: true },
    { text: "Priority support", included: true },
  ],
  stylist_unlimited: [
    { text: "Unlimited voice conversations", included: true, bold: true },
    { text: "Unlimited everything", included: true, bold: true },
    { text: "Video calls with stylist", included: true },
    { text: "VIP member access", included: true },
    { text: "White-glove support", included: true },
  ],
};

const getPlanMetadata = (isYearly: boolean): Record<DisplayTier, { name: string; period: string; description: string; popular?: boolean }> => ({
  free: { name: "Free", period: "forever", description: "Get started with basics" },
  style_chat: { name: "Style Chat", period: isYearly ? "/year" : "/month", description: "Voice access & extended features" },
  personal_stylist: { name: "Personal Stylist", period: isYearly ? "/year" : "/month", description: "Your personal AI stylist", popular: true },
  stylist_unlimited: { name: "Stylist Unlimited", period: isYearly ? "/year" : "/month", description: "Unlimited everything" },
});

interface LocalizedPrices {
  free: string;
  style_chat: string;
  personal_stylist: string;
  stylist_unlimited: string;
}

const getLocalizedPlans = (prices: LocalizedPrices, isYearly: boolean): Plan[] => {
  const metadata = getPlanMetadata(isYearly);
  return [
    { 
      id: "free" as SubscriptionTier, 
      ...metadata.free, 
      price: prices.free, 
      features: PLAN_FEATURES.free,
      gradientColors: ['#2A2A3E', '#1A1A2E'] as const,
      accentColor: LUXURY_COLORS.champagne,
    },
    { 
      id: "subscription" as SubscriptionTier, 
      ...metadata.style_chat, 
      price: prices.style_chat, 
      features: PLAN_FEATURES.style_chat,
      gradientColors: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald] as const,
      accentColor: LUXURY_COLORS.champagne,
    },
    { 
      id: "premium" as SubscriptionTier, 
      ...metadata.personal_stylist, 
      price: prices.personal_stylist, 
      features: PLAN_FEATURES.personal_stylist,
      gradientColors: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const,
      accentColor: LUXURY_COLORS.gold,
      popular: true,
    },
    { 
      id: "pro" as SubscriptionTier, 
      ...metadata.stylist_unlimited, 
      price: prices.stylist_unlimited, 
      features: PLAN_FEATURES.stylist_unlimited,
      gradientColors: [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const,
      accentColor: LUXURY_COLORS.midnight,
    },
  ];
};

const normalizeTier = (tier?: string): SubscriptionTier => {
  if (!tier) return 'free';
  const map: Record<string, SubscriptionTier> = {
    style_chat: 'subscription', style_chat_monthly: 'subscription', style_chat_yearly: 'subscription',
    style_chat_plan: 'subscription', styleChatMonthly: 'subscription', styleChatYearly: 'subscription',
    personal_stylist: 'premium', personal_stylist_monthly: 'premium', personal_stylist_yearly: 'premium',
    personalStylistMonthly: 'premium', personalStylistYearly: 'premium',
    stylist_unlimited: 'pro', stylist_unlimited_monthly: 'pro', stylist_unlimited_yearly: 'pro',
    stylistUnlimitedMonthly: 'pro', stylistUnlimitedYearly: 'pro',
  };
  return map[tier] || (tier as SubscriptionTier);
};

const toApiPlanId = (planId: SubscriptionTier): string => {
  return planId;
};

const getTierDisplayName = (tier?: SubscriptionTier): string => {
  switch (tier) {
    case 'pro': return 'Stylist Unlimited';
    case 'premium': return 'Personal Stylist';
    case 'subscription': return 'Style Chat';
    default: return 'Free';
  }
};

const getTierColor = (tier?: SubscriptionTier): string => {
  switch (tier) {
    case 'pro': return LUXURY_COLORS.gold;
    case 'premium': return LUXURY_COLORS.violet;
    case 'subscription': return LUXURY_COLORS.teal;
    default: return LUXURY_COLORS.champagne;
  }
};

const getTierIcon = (tier?: SubscriptionTier): "award" | "star" | "message-circle" | "user" => {
  switch (tier) {
    case 'pro': return 'award';
    case 'premium': return 'star';
    case 'subscription': return 'message-circle';
    default: return 'user';
  }
};

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, updateProfile } = useAuth();
  const { referralCode } = useSubscription();

  const normalizedTier = normalizeTier(user?.subscriptionTier);
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>(
    normalizeTier(user?.subscriptionTier)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [localizedPrices, setLocalizedPrices] = useState<LocalizedPrices>({
    free: "Free",
    style_chat: "£9.99",
    personal_stylist: "£14.99",
    stylist_unlimited: "£19.99",
  });
  const [yearlyPrices, setYearlyPrices] = useState<LocalizedPrices>({
    free: "Free",
    style_chat: "£95.99",
    personal_stylist: "£143.99",
    stylist_unlimited: "£191.99",
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

  const currentPrices = isYearly ? yearlyPrices : localizedPrices;
  const PLANS = getLocalizedPlans(currentPrices, isYearly);

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    if (planId === normalizeTier(user?.subscriptionTier)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    
    try {
      if (planId === "free") {
        if (normalizedTier && normalizedTier !== 'free') {
          await apiService.cancelSubscription();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Subscription Cancelled",
            "Your subscription will remain active until the end of the current billing period.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        } else {
          navigation.goBack();
        }
      } else {
        const billingCycle = isYearly ? 'yearly' : 'monthly';
        
        const isHealthy = await apiService.checkHealth();
        if (!isHealthy) {
          const wake = await apiService.wakeBackend();
          if (!wake.success) {
            throw new Error("Unable to reach the server. Please check your connection and try again.");
          }
        }
        
        const apiPlanId = toApiPlanId(planId);
        console.log('[Subscription] Sending to API:', { planId: apiPlanId, billingCycle });
        const response = await apiService.createSubscriptionCheckout(apiPlanId, billingCycle);

        if (response.checkoutUrl) {
          const result = await WebBrowser.openBrowserAsync(response.checkoutUrl);
          
          if (result.type === "dismiss" || result.type === "cancel") {
            const url = (result as any).url || "";
            
            if (url.includes("payment-success") || url.includes("success")) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Payment Successful!",
                `Your subscription has been activated. Welcome to ${PLANS.find(p => p.id === planId)?.name}!`,
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } else if (url.includes("payment-cancelled") || url.includes("cancel")) {
              Alert.alert(
                "Checkout Cancelled",
                "You can complete your subscription upgrade at any time.",
                [{ text: "OK" }]
              );
            } else {
              Alert.alert(
                "Checkout Complete",
                "If your payment was successful, your subscription will be activated shortly. You can check your subscription status in your profile.",
                [{ text: "OK" }]
              );
            }
          }
        } else {
          throw new Error("No checkout URL received");
        }
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      const errorMessage = error?.message || "Failed to process subscription. Please try again.";
      let displayMessage = errorMessage;
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Authentication required")) {
        displayMessage = "Please log in again to complete your subscription.";
      } else if (errorMessage.includes("Network request failed") || errorMessage.includes("network") || errorMessage.includes("Unable to reach")) {
        displayMessage = "Unable to connect to our servers. Please check your internet connection and try again.";
      } else if (errorMessage.includes("No checkout URL")) {
        displayMessage = "Payment setup is temporarily unavailable. Please try again shortly.";
      }
      
      Alert.alert("Error", displayMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);
    try {
      const response = await apiService.openBillingPortal();
      if (response.url) {
        await WebBrowser.openBrowserAsync(response.url);
      }
    } catch (error: any) {
      console.error("Billing portal error:", error);
      Alert.alert("Error", "Unable to open billing management. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivateSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    try {
      await apiService.reactivateSubscription();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Subscription Reactivated",
        "Your subscription has been reactivated and will continue as normal.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Reactivation error:", error);
      Alert.alert("Error", error.message || "Failed to reactivate subscription.");
    } finally {
      setIsProcessing(false);
    }
  };


  const renderPlanCard = (plan: Plan, index: number) => {
    const isSelected = selectedPlan === plan.id;
    const isCurrent = plan.id === normalizedTier;

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
            <View style={[
              styles.selectedIndicator, 
              { backgroundColor: plan.accentColor },
              plan.popular && styles.selectedIndicatorBelowBadge
            ]}>
              <Feather 
                name="check" 
                size={16} 
                color={plan.id === 'pro' ? '#FFFFFF' : LUXURY_COLORS.midnight} 
              />
            </View>
          ) : null}

          {isSelected && !isCurrent ? (
            <Pressable
              onPress={() => handleSelectPlan(plan.id)}
              disabled={isProcessing}
              style={[styles.inlineSubscribeButton, { backgroundColor: plan.accentColor }]}
            >
              <ThemedText 
                type="body" 
                style={[
                  styles.inlineSubscribeButtonText,
                  { color: plan.id === 'pro' ? '#FFFFFF' : LUXURY_COLORS.midnight }
                ]}
              >
                {isProcessing ? "Processing..." : `Start ${plan.name} Plan`}
              </ThemedText>
            </Pressable>
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

      <View style={[styles.currentTierSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
        <View style={styles.currentTierRow}>
          <View style={[styles.currentTierIcon, { backgroundColor: getTierColor(normalizedTier) + '20' }]}>
            <Feather 
              name={getTierIcon(normalizedTier)} 
              size={20} 
              color={getTierColor(normalizedTier)} 
            />
          </View>
          <View style={styles.currentTierText}>
            <ThemedText type="small" style={{ opacity: 0.6 }}>You're on</ThemedText>
            <ThemedText type="h3">
              {getTierDisplayName(normalizedTier)}
            </ThemedText>
          </View>
          {normalizedTier !== 'free' ? (
            <View style={[styles.tierBadge, { backgroundColor: getTierColor(normalizedTier) + '20' }]}>
              <Feather name="check" size={14} color={getTierColor(normalizedTier)} />
              <ThemedText type="caption" style={{ color: getTierColor(normalizedTier), fontWeight: '600' }}>Active</ThemedText>
            </View>
          ) : null}
        </View>
        {normalizedTier !== 'free' ? (
          <Pressable 
            onPress={handleManageSubscription}
            disabled={isProcessing}
            style={[styles.manageButton, { borderColor: getTierColor(normalizedTier) + '40' }]}
          >
            <Feather name="settings" size={16} color={getTierColor(normalizedTier)} />
            <ThemedText type="body" style={{ color: getTierColor(normalizedTier), fontWeight: '600' }}>
              Manage Billing
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.billingToggleContainer}>
        <Pressable
          onPress={() => setIsYearly(false)}
          style={[
            styles.billingToggleButton,
            !isYearly && styles.billingToggleButtonActive,
            { backgroundColor: !isYearly ? LUXURY_COLORS.gold : 'transparent' }
          ]}
        >
          <ThemedText 
            type="body" 
            style={[
              styles.billingToggleText,
              !isYearly && styles.billingToggleTextActive
            ]}
          >
            Monthly
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setIsYearly(true)}
          style={[
            styles.billingToggleButton,
            isYearly && styles.billingToggleButtonActive,
            { backgroundColor: isYearly ? LUXURY_COLORS.gold : 'transparent' }
          ]}
        >
          <View style={styles.yearlyToggleContent}>
            <ThemedText 
              type="body" 
              style={[
                styles.billingToggleText,
                isYearly && styles.billingToggleTextActive
              ]}
            >
              Yearly
            </ThemedText>
            <View style={[styles.savingsBadge, { backgroundColor: isYearly ? '#fff' : LUXURY_COLORS.emerald }]}>
              <ThemedText type="caption" style={[styles.savingsText, { color: isYearly ? LUXURY_COLORS.emerald : '#fff' }]}>
                Save 20%
              </ThemedText>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.plansContainer}>
        <ThemedText type="h2" style={styles.sectionTitle}>Choose Your Plan</ThemedText>
        {PLANS.map(renderPlanCard)}
      </View>


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
            Share your code and both get a free month
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
            <View style={[styles.dfyPopularBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
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
                "5-7 core outfits with rotations",
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
  billingToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: BorderRadius.xl,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  billingToggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingToggleButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billingToggleText: {
    fontWeight: '600',
  },
  billingToggleTextActive: {
    color: '#1A1A2E',
  },
  yearlyToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  savingsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
  },
  currentTierSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  currentTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  currentTierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTierText: {
    flex: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
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
    right: Spacing.lg,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedIndicatorBelowBadge: {
    top: Spacing.lg + 32,
  },
  inlineSubscribeButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  inlineSubscribeButtonText: {
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
