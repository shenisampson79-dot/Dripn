import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSequence, 
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { dfyService, DFYTier, DFYComparisonTier } from "@/services/DFYService";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";
import { getDfyBenefitForSubscription } from "@/utils/dfyEntitlements";
import { normalizeSubscriptionTier } from "@/utils/subscriptionTier";
import {
  appleIAPService,
  serializeDfyCustomerInfoForSync,
  type IAPDFYTier,
} from "@/services/AppleIAPService";
import { shouldUseAppleIAP } from "@/utils/platformPayments";
import { currencyService } from "@/services/CurrencyService";

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
  obsidian: '#0D0B09',
};

type DFYComparisonScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const DFY_PRODUCT_IDS: Record<DFYTier, string> = {
  lite: 'outfit_setup',
  core: 'core_wardrobe',
};

type DfyCheckoutOutcome = 'success' | 'cancelled' | 'failed';

function getBrowserReturnUrl(result: WebBrowser.WebBrowserResult): string {
  return 'url' in result ? String((result as { url?: string }).url || '') : '';
}

function isDfyCancelUrl(url: string): boolean {
  return url.includes('cancel') || url.includes('payment-cancelled');
}

function isDfySuccessUrl(url: string): boolean {
  return url.includes('success') || url.includes('payment-success');
}

async function resolveDfyCheckoutOutcome(
  result: WebBrowser.WebBrowserResult,
  sessionId: string,
  checkoutEmail: string,
): Promise<DfyCheckoutOutcome> {
  const returnUrl = getBrowserReturnUrl(result);

  if (isDfyCancelUrl(returnUrl)) {
    return 'cancelled';
  }

  const urlSessionId = returnUrl.match(/session_id=([^&]+)/)?.[1];
  const verifySessionId = urlSessionId || sessionId;

  try {
    const verification = await apiService.verifyDFYPayment(verifySessionId, checkoutEmail);
    if (verification.paid) {
      return 'success';
    }
    if (isDfySuccessUrl(returnUrl)) {
      return 'failed';
    }
  } catch {
    if (isDfySuccessUrl(returnUrl)) {
      return 'failed';
    }
  }

  return 'cancelled';
}

export default function DFYComparisonScreen({ navigation }: DFYComparisonScreenProps) {
  const route = useRoute();
  const routeParams = route.params as {
    selectedTier?: DFYTier;
    autoCheckout?: boolean;
    paidAddOn?: boolean;
  } | undefined;
  const { theme, isDark } = useTheme();
  const { user, refreshSubscriptionFromBackend } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedTier, setSelectedTier] = useState<DFYTier>(routeParams?.selectedTier || 'core');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [tierPrices, setTierPrices] = useState<Record<DFYTier, string>>({
    lite: '£19.99',
    core: '£39.99',
  });
  const tiers = dfyService.getComparisonTiers().map((tier) => ({
    ...tier,
    price: tierPrices[tier.id] || tier.price,
  }));
  const subscriptionTier = normalizeSubscriptionTier(user?.subscriptionTier);
  const includedBenefit = getDfyBenefitForSubscription(subscriptionTier);
  const isPaidAddOn = Boolean(routeParams?.paidAddOn);
  const useAppleIAP = shouldUseAppleIAP();
  
  const liteGlow = useSharedValue(0);
  const coreGlow = useSharedValue(0);
  const liteScale = useSharedValue(1);
  const coreScale = useSharedValue(1);

  // Bundled subscribers use DFYStart — unless they're buying an extra paid setup (Plan B).
  useEffect(() => {
    if (isPaidAddOn) return;
    if (includedBenefit !== 'none') {
      navigation.replace('DFYStart');
    }
  }, [includedBenefit, isPaidAddOn, navigation]);

  useEffect(() => {
    const loadPrices = async () => {
      if (useAppleIAP && user?.id) {
        try {
          await appleIAPService.configure(user.id);
          const iapPrices = await appleIAPService.getDFYPrices();
          if (iapPrices.length > 0) {
            setTierPrices((prev) => {
              const next = { ...prev };
              for (const entry of iapPrices) {
                next[entry.tier] = entry.priceString;
              }
              return next;
            });
            return;
          }
        } catch (error) {
          console.warn('[DFYComparison] Apple DFY price fetch failed:', error);
        }
      }

      try {
        await currencyService.initialize();
        const fallback = currencyService.getDFYPrices();
        setTierPrices({
          lite: fallback.outfit_setup,
          core: fallback.wardrobe_setup,
        });
      } catch {
        // Keep default GBP strings
      }
    };

    loadPrices().catch(() => {});
  }, [useAppleIAP, user?.id]);

  // Auto-start checkout for paid add-on or legacy free-user flow
  useEffect(() => {
    if (!isPaidAddOn && includedBenefit !== 'none') return;
    if (routeParams?.autoCheckout && routeParams?.selectedTier) {
      const timer = setTimeout(() => {
        if (useAppleIAP) {
          if (user?.id) {
            startAppleCheckout();
          }
          return;
        }
        if (user?.email) {
          startCheckout(user.email);
        } else {
          setShowEmailModal(true);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [routeParams?.autoCheckout, includedBenefit, isPaidAddOn, useAppleIAP, user?.id, user?.email]);

  const handleTierSelect = (tierId: DFYTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTier(tierId);
    
    const glowValue = tierId === 'lite' ? liteGlow : coreGlow;
    const scaleValue = tierId === 'lite' ? liteScale : coreScale;
    
    glowValue.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0.6, { duration: 300 })
    );
    scaleValue.value = withSequence(
      withSpring(1.02, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );
  };
  
  const liteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: liteScale.value }],
    shadowOpacity: liteGlow.value * 0.8,
    shadowRadius: 20 * liteGlow.value,
  }));
  
  const coreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value }],
    shadowOpacity: coreGlow.value * 0.8,
    shadowRadius: 20 * coreGlow.value,
  }));

  const validateEmail = (emailVal: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailVal);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isPaidAddOn && includedBenefit !== 'none') {
      navigation.navigate('DFYStart');
      return;
    }
    if (useAppleIAP) {
      if (!user?.id) {
        Alert.alert('Sign in required', 'Please sign in to purchase with the App Store.');
        return;
      }
      startAppleCheckout();
      return;
    }
    if (user?.email) {
      startCheckout(user.email);
    } else {
      setShowEmailModal(true);
    }
  };

  const handleEmailSubmit = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Please enter your email');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email');
      return;
    }
    setEmailError('');
    setShowEmailModal(false);
    startCheckout(trimmedEmail);
  };

  const showDfyPaymentSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (selectedTier === 'lite') {
      Alert.alert(
        'Payment Successful!',
        'Your Outfit-Based setup is confirmed. Want ongoing styling advice from your personal AI stylist?',
        [
          {
            text: 'Get Personal Stylist',
            onPress: () => navigation.navigate('Subscription' as any, { highlightPlan: 'personal_stylist' }),
          },
          {
            text: 'Continue Setup',
            onPress: () => navigation.navigate('DFYStylePlan'),
            style: 'cancel',
          },
        ]
      );
    } else {
      Alert.alert(
        'Payment Successful!',
        `Your Core Wardrobe setup is confirmed. Let's get started!`,
        [{ text: 'Continue', onPress: () => navigation.navigate('DFYUpload', { type: 'core' }) }]
      );
    }
  };

  const completeDfyPurchaseSuccess = async () => {
    try {
      await apiService.generateDFYDelivery({ tier: selectedTier, stylistId: 'ruby' });
    } catch (e) {
      console.log('DFY delivery generation will continue async', e);
    }
    refreshSubscriptionFromBackend().catch(() => {});
    showDfyPaymentSuccess();
  };

  const startAppleCheckout = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to purchase with the App Store.');
      return;
    }

    setIsProcessing(true);
    try {
      await appleIAPService.configure(user.id);
      const customerInfo = await appleIAPService.purchaseDFY(selectedTier as IAPDFYTier);
      const syncPayload = serializeDfyCustomerInfoForSync(customerInfo);
      if (!syncPayload.tier) {
        throw new Error('DFY purchase could not be verified. Please try Restore Purchases or contact support.');
      }
      await apiService.syncAppleDFYPurchase(syncPayload);
      await completeDfyPurchaseSuccess();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'cancelled' in error && (error as { cancelled?: boolean }).cancelled) {
        Alert.alert(
          'Purchase Cancelled',
          'You can complete your purchase at any time.',
          [{ text: 'OK' }]
        );
        return;
      }
      console.error('DFY Apple IAP error:', error);
      Alert.alert(
        'Payment Error',
        error instanceof Error ? error.message : 'Failed to complete App Store purchase. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreDfyPurchases = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to restore purchases.');
      return;
    }
    setIsProcessing(true);
    try {
      await appleIAPService.configure(user.id);
      const customerInfo = await appleIAPService.restorePurchases();
      const syncPayload = serializeDfyCustomerInfoForSync(customerInfo);
      if (!syncPayload.tier) {
        Alert.alert('No DFY purchase found', 'No DFY setup purchase was found for this Apple ID.');
        return;
      }
      await apiService.syncAppleDFYPurchase(syncPayload);
      await refreshSubscriptionFromBackend();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Restored',
        'Your DFY setup purchase has been restored.',
        [{ text: 'Continue', onPress: () => showDfyPaymentSuccess() }]
      );
    } catch (error: unknown) {
      Alert.alert(
        'Restore Failed',
        error instanceof Error ? error.message : 'Could not restore purchases.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const startCheckout = async (checkoutEmail: string) => {
    setIsProcessing(true);
    
    try {
      const response = await apiService.createDFYCheckoutSession(checkoutEmail, selectedTier);
      
      if (!response.checkoutUrl || !response.sessionId) {
        throw new Error('No checkout URL received');
      }

      const result = await WebBrowser.openBrowserAsync(response.checkoutUrl);
      const outcome = await resolveDfyCheckoutOutcome(result, response.sessionId, checkoutEmail);

      if (outcome === 'success') {
        await completeDfyPurchaseSuccess();
      } else if (outcome === 'failed') {
        Alert.alert(
          'Payment Not Completed',
          'Your payment could not be verified. Please try again or contact support if you were charged.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Checkout Cancelled',
          'You can complete your purchase at any time.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('DFY checkout error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to start checkout. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const renderTierCard = (tier: DFYComparisonTier) => {
    const isSelected = selectedTier === tier.id;
    const isLite = tier.id === 'lite';
    const animatedStyle = isLite ? liteAnimatedStyle : coreAnimatedStyle;
    const glowColor = isLite ? LUXURY_COLORS.teal : LUXURY_COLORS.gold;

    return (
      <Animated.View 
        key={tier.id}
        style={[
          styles.tierCard,
          animatedStyle,
          { 
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Pressable
          onPress={() => handleTierSelect(tier.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
        >
          <LinearGradient
            colors={isLite 
              ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
              : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
            }
            style={[
              styles.tierCardGradient,
              isSelected && styles.tierCardSelected,
            ]}
          >
            <View style={styles.tierHeader}>
              <View style={styles.tierNameRow}>
                {isSelected ? (
                  <View style={styles.selectedBadge}>
                    <Feather name="check" size={14} color={isLite ? LUXURY_COLORS.teal : LUXURY_COLORS.gold} />
                  </View>
                ) : null}
                <ThemedText type="h2" style={styles.tierName}>
                  {tier.name}
                </ThemedText>
                <View style={[
                  styles.mentalModelBadge,
                  { backgroundColor: 'rgba(255,255,255,0.2)' }
                ]}>
                  <ThemedText type="small" style={styles.mentalModelText}>
                    {tier.mentalModel === 'tactical' ? 'Tactical' : 'Structural'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.priceContainer}>
                <ThemedText
                  style={styles.tierPrice}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {tier.price}
                </ThemedText>
                <ThemedText type="small" style={styles.priceSubtext}>one-time</ThemedText>
              </View>

              <ThemedText style={styles.tierTagline}>{tier.tagline}</ThemedText>
            </View>

            <ThemedText style={styles.tierDescription}>{tier.description}</ThemedText>

            <View style={styles.featuresContainer}>
              {tier.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Feather
                    name={feature.included ? "check-circle" : "x-circle"}
                    size={16}
                    color={feature.included ? "#FFFFFF" : "rgba(255,255,255,0.4)"}
                  />
                  <ThemedText
                    type="small"
                    style={[
                      styles.featureText,
                      !feature.included && styles.featureTextDisabled,
                    ]}
                  >
                    {feature.text}
                  </ThemedText>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.selectButton,
                isSelected && styles.selectButtonSelected,
                { backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.2)' }
              ]}
            >
              <Feather 
                name={isSelected ? "check-circle" : "circle"} 
                size={18} 
                color={isSelected ? (isLite ? LUXURY_COLORS.teal : LUXURY_COLORS.gold) : '#FFFFFF'} 
              />
              <ThemedText 
                type="body" 
                style={[
                  styles.selectButtonText,
                  { color: isSelected ? (isLite ? LUXURY_COLORS.teal : LUXURY_COLORS.gold) : '#FFFFFF' }
                ]}
              >
                {isSelected ? 'Selected' : 'Select this option'}
              </ThemedText>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          LUXURY_COLORS.midnight,
          '#0F0F1A',
          LUXURY_COLORS.obsidian,
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <ThemedText type="h1" style={styles.title}>
            {isPaidAddOn ? 'Choose your setup' : 'How would you like me to style you?'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isPaidAddOn
              ? 'Pick the path that fits — your styling starts right after checkout.'
              : 'One solves now. The other solves every time after.'}
          </ThemedText>

          <View style={styles.tiersContainer}>
            {tiers.map(renderTierCard)}
          </View>

          <View style={styles.comparisonNote}>
            <Feather name="info" size={16} color="rgba(255,255,255,0.5)" />
            <ThemedText type="small" style={styles.comparisonNoteText}>
              <ThemedText type="small" style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>Full Setup</ThemedText>
              {" "}dresses you every day after.{" "}
              <ThemedText type="small" style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>Styling Sprint</ThemedText>
              {" "}gets you ready for right now.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <LinearGradient
            colors={selectedTier === 'lite'
              ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
              : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
            }
            style={styles.continueButtonGradient}
          >
            <Pressable 
              onPress={handleContinue} 
              style={styles.continueButton}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator 
                  size="small" 
                  color={selectedTier === 'lite' ? '#FFFFFF' : LUXURY_COLORS.midnight} 
                />
              ) : (
                <>
                  <ThemedText type="body" style={styles.continueButtonText}>
                    {isPaidAddOn
                      ? (selectedTier === 'lite' ? 'Start Quick Setup' : 'Start Full Setup')
                      : (selectedTier === 'lite' ? 'Look Ready — Purchase' : 'Dress Better — Purchase')}
                  </ThemedText>
                  <Feather
                    name="arrow-right"
                    size={18}
                    color={selectedTier === 'lite' ? '#FFFFFF' : LUXURY_COLORS.midnight}
                  />
                </>
              )}
            </Pressable>
          </LinearGradient>
          {useAppleIAP ? (
            <Pressable
              onPress={handleRestoreDfyPurchases}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.restorePurchasesButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.7)" />
              <ThemedText type="small" style={styles.restorePurchasesText}>
                Restore Purchases
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScreenScrollView>

      <Modal visible={showEmailModal} transparent animationType="fade">
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowEmailModal(false)}
        >
          <Pressable 
            style={[styles.emailModalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.emailModalHeader}>
              <ThemedText type="h3" style={{ color: isDark ? '#FFFFFF' : '#1A1A2E' }}>
                Enter your email
              </ThemedText>
              <Pressable onPress={() => setShowEmailModal(false)}>
                <Feather name="x" size={22} color={isDark ? '#FFFFFF' : '#1A1A2E'} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', marginBottom: Spacing.lg }}>
              We'll send your purchase receipt and styling access to this email.
            </ThemedText>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              placeholder="your@email.com"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.emailInput,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#FFFFFF' : '#1A1A2E',
                  borderColor: emailError ? '#EF4444' : 'transparent',
                  borderWidth: emailError ? 1 : 0,
                },
              ]}
            />
            {emailError ? (
              <ThemedText type="caption" style={{ color: '#EF4444', marginTop: Spacing.xs }}>
                {emailError}
              </ThemedText>
            ) : null}
            <LinearGradient
              colors={selectedTier === 'lite'
                ? [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
                : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
              }
              style={styles.emailSubmitButton}
            >
              <Pressable onPress={handleEmailSubmit} style={styles.emailSubmitInner}>
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  Continue to Checkout
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  tiersContainer: {
    gap: Spacing.lg,
  },
  tierCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'visible',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  selectButtonSelected: {
    transform: [{ scale: 1 }],
  },
  selectButtonText: {
    fontWeight: '600',
  },
  tierCardGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardSelected: {
    borderColor: '#FFFFFF',
  },
  tierHeader: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierName: {
    color: '#FFFFFF',
  },
  mentalModelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  mentalModelText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tierTagline: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  tierPrice: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    flexShrink: 1,
  },
  priceSubtext: {
    color: 'rgba(255,255,255,0.6)',
  },
  tierDescription: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.md,
  },
  featuresContainer: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    color: '#FFFFFF',
    flex: 1,
  },
  featureTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  comparisonNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.md,
  },
  comparisonNoteText: {
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  continueButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  continueButtonText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restorePurchasesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  restorePurchasesText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emailModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  emailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emailInput: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
  },
  emailSubmitButton: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  emailSubmitInner: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
