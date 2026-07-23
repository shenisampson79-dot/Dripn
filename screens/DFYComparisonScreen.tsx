import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { useTranslations } from "@/contexts/TranslationContext";
import { apiService } from "@/services/ApiService";
import { getDfyBenefitForSubscription } from "@/utils/dfyEntitlements";
import { normalizeSubscriptionTier } from "@/utils/subscriptionTier";
import {
  finalizeDfyPurchase,
  isApplePurchaseCancelled,
  runAppleDfyCheckout,
  runStripeDfyCheckout,
} from "@/utils/dfyCheckout";
import {
  appleIAPService,
  IAP_UNAVAILABLE_MESSAGE,
  serializeDfyCustomerInfoForSync,
} from "@/services/AppleIAPService";
import { shouldUseAppleIAP } from "@/utils/platformPayments";
import { currencyService } from "@/services/CurrencyService";
import { DFYPackageNameModal } from "@/components/outfit/DFYPackageNameModal";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

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

export default function DFYComparisonScreen({ navigation }: DFYComparisonScreenProps) {
  const route = useRoute();
  const routeParams = route.params as {
    selectedTier?: DFYTier;
    autoCheckout?: boolean;
    paidAddOn?: boolean;
  } | undefined;
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
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
  const [showPackageNamePrompt, setShowPackageNamePrompt] = useState(false);
  const [packageNameDefault, setPackageNameDefault] = useState('');
  const [renamePackageId, setRenamePackageId] = useState<string | null>(null);
  const [pendingAfterName, setPendingAfterName] = useState<(() => void) | null>(null);
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

  const isAutoCheckout = Boolean(routeParams?.autoCheckout && routeParams?.selectedTier);
  const autoCheckoutStarted = useRef(false);

  // Soft-gate DFY Core / Full Wardrobe purchase UI — keep ASC/RC products, stop selling here.
  useEffect(() => {
    if (!FEATURE_FLAGS.hideDfyPurchaseUi) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Subscription' as any);
    }
  }, [navigation]);

  const promptPackageNameThen = async (tier: DFYTier, continueFn: () => void) => {
    try {
      await new Promise((r) => setTimeout(r, 600));
      const prompt = await dfyService.preparePackageNamePrompt(tier);
      if (prompt) {
        setRenamePackageId(prompt.packageId);
        setPackageNameDefault(prompt.defaultName);
        setPendingAfterName(() => continueFn);
        setShowPackageNamePrompt(true);
        return;
      }
    } catch {
      // Fall through
    }
    continueFn();
  };

  // Bundled subscribers use DFYStart — unless they're buying an extra paid setup (Plan B).
  useEffect(() => {
    if (isPaidAddOn) return;
    if (includedBenefit !== 'none') {
      navigation.replace('DFYStart');
    }
  }, [includedBenefit, isPaidAddOn, navigation]);

  useEffect(() => {
    if (isAutoCheckout) return;
    const loadPrices = async () => {
      await currencyService.initialize();
      if (useAppleIAP && user?.id) {
        try {
          await appleIAPService.configure(user.id);
          // Reinforce storefront; paywall stays on session catalog (never StoreKit string).
          await appleIAPService.getDFYPrices();
        } catch (error) {
          console.warn('[DFYComparison] Apple DFY price fetch failed:', error);
        }
      }
      const fallback = currencyService.resetPricesToCatalog().dfy;
      setTierPrices({
        lite: fallback.outfit_setup,
        core: fallback.wardrobe_setup,
      });
    };

    loadPrices().catch(() => {});
  }, [isAutoCheckout, useAppleIAP, user?.id]);

  const resetDfyPricesToCatalog = useCallback(() => {
    const dfy = currencyService.resetPricesToCatalog().dfy;
    setTierPrices({ lite: dfy.outfit_setup, core: dfy.wardrobe_setup });
  }, []);

  const leaveAfterAutoCheckout = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Subscription' as any);
    }
  };

  const showDfyPaymentSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (selectedTier === 'lite') {
      Alert.alert(
        t('dfy.comparison.paymentSuccessTitle'),
        t('dfy.comparison.paymentSuccessLiteMessage'),
        [
          {
            text: t('dfy.comparison.getPersonalStylist'),
            onPress: () => {
              if (isAutoCheckout) leaveAfterAutoCheckout();
              navigation.navigate('Subscription' as any, { highlightPlan: 'personal_stylist' });
            },
          },
          {
            text: t('dfy.comparison.continueSetup'),
            onPress: () => {
              if (isAutoCheckout) {
                navigation.replace('DFYStylePlan');
              } else {
                navigation.navigate('DFYTravelPlan');
              }
            },
            style: 'cancel',
          },
        ]
      );
    } else {
      Alert.alert(
        t('dfy.comparison.paymentSuccessTitle'),
        t('dfy.comparison.paymentSuccessCoreMessage'),
        [{
          text: t('common.continue'),
          onPress: () => {
            if (isAutoCheckout) {
              navigation.replace('DFYUpload', { type: 'core' });
            } else {
              navigation.navigate('DFYUpload', { type: 'core' });
            }
          },
        }]
      );
    }
  };

  const completeDfyPurchaseSuccess = async () => {
    await finalizeDfyPurchase(selectedTier);
    refreshSubscriptionFromBackend().catch(() => {});
    await promptPackageNameThen(selectedTier, () => showDfyPaymentSuccess());
  };

  const startAppleCheckout = async () => {
    if (!user?.id) {
      Alert.alert(t('dfy.comparison.signInRequiredTitle'), t('dfy.comparison.signInRequiredApple'));
      if (isAutoCheckout) leaveAfterAutoCheckout();
      return;
    }

    setIsProcessing(true);
    try {
      await runAppleDfyCheckout({ userId: user.id, tier: selectedTier });
      await completeDfyPurchaseSuccess();
    } catch (error: unknown) {
      if (isApplePurchaseCancelled(error)) {
        resetDfyPricesToCatalog();
        Alert.alert(
          t('dfy.comparison.purchaseCancelledTitle'),
          t('dfy.comparison.purchaseCancelledMessage'),
          [{ text: t('common.done') }]
        );
        if (isAutoCheckout) leaveAfterAutoCheckout();
        return;
      }
      resetDfyPricesToCatalog();
      console.error('DFY Apple IAP error:', error);
      Alert.alert(
        t('dfy.comparison.paymentErrorTitle'),
        error instanceof Error ? error.message : t('dfy.comparison.applePurchaseFailed'),
        [{ text: t('common.done') }]
      );
      if (isAutoCheckout) leaveAfterAutoCheckout();
    } finally {
      setIsProcessing(false);
    }
  };

  const startCheckout = async (checkoutEmail: string) => {
    setIsProcessing(true);

    try {
      const outcome = await runStripeDfyCheckout({
        email: checkoutEmail,
        tier: selectedTier,
        language: currentLanguage,
      });

      if (outcome === 'success') {
        await completeDfyPurchaseSuccess();
      } else if (outcome === 'failed') {
        Alert.alert(
          t('dfy.comparison.paymentNotCompletedTitle'),
          t('dfy.comparison.paymentNotCompletedMessage'),
          [{ text: t('common.done') }]
        );
        if (isAutoCheckout) leaveAfterAutoCheckout();
      } else {
        Alert.alert(
          t('dfy.comparison.checkoutCancelledTitle'),
          t('dfy.comparison.checkoutCancelledMessage'),
          [{ text: t('common.done') }]
        );
        if (isAutoCheckout) leaveAfterAutoCheckout();
      }
    } catch (error: any) {
      console.error('DFY checkout error:', error);
      Alert.alert(
        t('dfy.comparison.paymentErrorTitle'),
        error.message || t('dfy.comparison.checkoutStartFailed'),
        [{ text: t('common.done') }]
      );
      if (isAutoCheckout) leaveAfterAutoCheckout();
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-start checkout for paid add-on or legacy free-user flow
  useEffect(() => {
    if (!isAutoCheckout) return;
    if (!isPaidAddOn && includedBenefit !== 'none') return;
    if (autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;

    const timer = setTimeout(() => {
      if (useAppleIAP) {
        if (user?.id) {
          startAppleCheckout();
        } else {
          leaveAfterAutoCheckout();
        }
        return;
      }
      if (user?.email) {
        startCheckout(user.email);
      } else {
        setShowEmailModal(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isAutoCheckout, includedBenefit, isPaidAddOn, useAppleIAP, user?.id, user?.email]);

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
        Alert.alert(t('dfy.comparison.signInRequiredTitle'), t('dfy.comparison.signInRequiredApple'));
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
      setEmailError(t('dfy.comparison.emailRequired'));
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setEmailError(t('dfy.comparison.emailInvalid'));
      return;
    }
    setEmailError('');
    setShowEmailModal(false);
    startCheckout(trimmedEmail);
  };

  const handleRestoreDfyPurchases = async () => {
    if (!user?.id) {
      Alert.alert(t('dfy.comparison.signInRequiredTitle'), t('dfy.comparison.signInRequiredRestore'));
      return;
    }
    setIsProcessing(true);
    try {
      const iapReady = await appleIAPService.configure(user.id);
      if (!iapReady) throw new Error(IAP_UNAVAILABLE_MESSAGE);
      const customerInfo = await appleIAPService.restorePurchases();
      const syncPayload = serializeDfyCustomerInfoForSync(customerInfo);
      if (!syncPayload.tier) {
        Alert.alert(t('dfy.comparison.noDfyPurchaseTitle'), t('dfy.comparison.noDfyPurchaseMessage'));
        return;
      }
      await apiService.syncAppleDFYPurchase(syncPayload);
      await refreshSubscriptionFromBackend();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('dfy.comparison.restoredTitle'),
        t('dfy.comparison.restoredMessage'),
        [{ text: t('common.continue'), onPress: () => showDfyPaymentSuccess() }]
      );
    } catch (error: unknown) {
      Alert.alert(
        t('dfy.comparison.restoreFailedTitle'),
        error instanceof Error ? error.message : t('dfy.comparison.restoreFailedMessage')
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
                    {tier.mentalModel === 'tactical' ? t('dfy.comparison.tactical') : t('dfy.comparison.structural')}
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
                <ThemedText type="small" style={styles.priceSubtext}>{t('dfy.start.oneTime')}</ThemedText>
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
                {isSelected ? t('dfy.comparison.selected') : t('dfy.comparison.selectOption')}
              </ThemedText>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  if (FEATURE_FLAGS.hideDfyPurchaseUi) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: LUXURY_COLORS.obsidian }}>
        <ActivityIndicator size="large" color={LUXURY_COLORS.gold} />
      </View>
    );
  }

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
      {isAutoCheckout ? (
        <View style={[styles.autoCheckoutLoading, { paddingTop: insets.top + Spacing.xl }]}>
          <ActivityIndicator size="large" color={LUXURY_COLORS.gold} />
          <ThemedText type="body" style={styles.autoCheckoutText}>
            {t('dfy.comparison.openingCheckout') || 'Opening checkout…'}
          </ThemedText>
        </View>
      ) : (
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
            {isPaidAddOn ? t('dfy.comparison.titlePaidAddOn') : t('dfy.comparison.titleDefault')}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isPaidAddOn
              ? t('dfy.comparison.subtitlePaidAddOn')
              : t('dfy.comparison.subtitleDefault')}
          </ThemedText>

          <View style={styles.tiersContainer}>
            {tiers.map(renderTierCard)}
          </View>

          <View style={styles.comparisonNote}>
            <Feather name="info" size={16} color="rgba(255,255,255,0.5)" />
            <ThemedText type="small" style={styles.comparisonNoteText}>
              <ThemedText type="small" style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>{t('dfy.comparison.fullSetupLabel')}</ThemedText>
              {" "}{t('dfy.comparison.comparisonNoteFull')}{" "}
              <ThemedText type="small" style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>{t('dfy.comparison.occasionReadyLabel')}</ThemedText>
              {" "}{t('dfy.comparison.comparisonNoteOccasion')}
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
                      ? (selectedTier === 'lite' ? t('dfy.comparison.startQuickSetup') : t('dfy.comparison.startFullSetup'))
                      : (selectedTier === 'lite' ? t('dfy.start.lookReadyPurchase') : t('dfy.start.dressBetterPurchase'))}
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
              accessibilityRole="button"
              accessibilityLabel={t('dfy.comparison.restorePurchases')}
              style={({ pressed }) => [
                styles.restorePurchasesButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.7)" />
              <ThemedText type="small" style={styles.restorePurchasesText}>
                {t('dfy.comparison.restorePurchases')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScreenScrollView>
      )}

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
                {t('dfy.comparison.enterEmail')}
              </ThemedText>
              <Pressable onPress={() => setShowEmailModal(false)}>
                <Feather name="x" size={22} color={isDark ? '#FFFFFF' : '#1A1A2E'} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', marginBottom: Spacing.lg }}>
              {t('dfy.comparison.emailReceiptNote')}
            </ThemedText>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              placeholder={t('dfy.comparison.emailPlaceholder')}
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
                  {t('dfy.comparison.continueToCheckout')}
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>

      <DFYPackageNameModal
        visible={showPackageNamePrompt}
        defaultName={packageNameDefault}
        onClose={() => {
          setShowPackageNamePrompt(false);
          const next = pendingAfterName;
          setPendingAfterName(null);
          next?.();
        }}
        onSave={async (name) => {
          if (!renamePackageId) return;
          try {
            await dfyService.renameDfyPackage(renamePackageId, name);
          } catch {
            Alert.alert(
              t('common.error') || 'Error',
              t('dfy.package.renameFailed') || 'Could not save the plan name. Please try again.',
            );
            throw new Error('rename failed');
          }
        }}
      />
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
  autoCheckoutLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  autoCheckoutText: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
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
