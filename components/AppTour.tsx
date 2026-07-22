import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Dimensions,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TourStep {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  highlight?: string;
}

const TOUR_STEP_KEYS = [
  { icon: "award" as const, titleKey: "tourWelcomeTitle", descKey: "tourWelcomeDesc", highlightKey: "tourWelcomeHighlight" },
  { icon: "star" as const, titleKey: "tourStylistsTitle", descKey: "tourStylistsDesc", highlightKey: "tourStylistsHighlight" },
  { icon: "plus-circle" as const, titleKey: "tourPlusTitle", descKey: "tourPlusDesc", highlightKey: "tourPlusHighlight" },
  { icon: "grid" as const, titleKey: "tourWardrobeTitle", descKey: "tourWardrobeDesc", highlightKey: "tourWardrobeHighlight" },
  { icon: "check-circle" as const, titleKey: "tourDoneTitle", descKey: "tourDoneDesc", highlightKey: "tourDoneHighlight" },
];

const TOUR_STEP_FALLBACKS = [
  {
    title: "Welcome to Dripn!",
    description: "Your personal fashion decision engine. Get instant, confident outfit decisions from AI stylists who learn your style and help you look your best.",
    highlight: "Decide what to wear in seconds",
  },
  {
    title: "Meet Your Stylists",
    description: "Choose from 4 unique AI stylists: Ruby (bold & glamorous), Max (clean & minimal), Ace (street-smart), and Ivy (eco-conscious). Each brings their own personality to your styling advice.",
    highlight: "Find your perfect style match",
  },
  {
    title: "The + Button",
    description: "Once you finish this tour, you'll see a + button in the center of the bottom navigation bar. That's your direct line to your stylist. Tap it anytime you need an outfit decision.",
    highlight: "Look for + in the bottom bar after this tour",
  },
  {
    title: "Build Your Wardrobe",
    description: "Add your clothes to create a digital wardrobe. Your stylist will learn what you own and suggest outfits that actually work with your pieces. Aim for at least 7 tops, 7 bottoms, and 7 pairs of shoes so we can rotate a full week of different looks.",
    highlight: "Tap Wardrobe to get started",
  },
  {
    title: "You're All Set!",
    description: "Manage your Wardrobe, get outfit decisions, and chat with your stylist anytime. Once your wardrobe can make 7 completely different outfits, Today's outfit can pop up each morning on the Stylist tab — until then it only opens if you tap it.",
    highlight: "Let's get you sorted",
  },
];

interface AppTourProps {
  visible: boolean;
  onComplete: () => void;
}

export function AppTour({ visible, onComplete }: AppTourProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);

  const tourSteps: TourStep[] = useMemo(() => {
    const keys = FEATURE_FLAGS.launchSimplified
      ? TOUR_STEP_KEYS.filter((step) => step.titleKey !== 'tourPlusTitle')
      : TOUR_STEP_KEYS;

    const launchFallbacks = [
      TOUR_STEP_FALLBACKS[0],
      TOUR_STEP_FALLBACKS[1],
      {
        title: "Stylist Hub Decisions",
        description: "On the Stylist tab, tap tiles like Choosing what to buy, Outfit for an event, or Quick sanity check when you need a decision. Today's Outfit at the bottom covers what to wear each day.",
        highlight: "Open the Stylist tab for outfit help",
      },
      TOUR_STEP_FALLBACKS[3],
      TOUR_STEP_FALLBACKS[4],
    ];

    const fallbacks = FEATURE_FLAGS.launchSimplified ? launchFallbacks : TOUR_STEP_FALLBACKS;

    return keys.map((step, i) => ({
      icon: step.icon,
      title: t(`onboarding.${step.titleKey}`) || fallbacks[i].title,
      description: t(`onboarding.${step.descKey}`) || fallbacks[i].description,
      highlight: t(`onboarding.${step.highlightKey}`) || fallbacks[i].highlight,
    }));
  }, [t]);

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
    }
  }, [visible]);

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setCurrentStep(0);
    onComplete();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.85)" }]}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.backgroundDefault,
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                {t('onboarding.skipTour') || 'Skip Tour'}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.content}>
            {currentStep === 0 ? (
              <View style={styles.logoContainer}>
                <Image 
                  source={require('@/assets/images/dripn-logo-icon.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.link + "20" },
                ]}
              >
                <Feather name={step.icon} size={48} color={theme.link} />
              </View>
            )}

            <ThemedText type="h1" style={styles.title}>
              {step.title}
            </ThemedText>

            <ThemedText type="body" style={styles.description}>
              {step.description}
            </ThemedText>

            {step.highlight ? (
              <View
                style={[
                  styles.highlightBox,
                  { backgroundColor: theme.link + "15" },
                ]}
              >
                <Feather name="info" size={16} color={theme.link} />
                <ThemedText
                  type="small"
                  style={[styles.highlightText, { color: theme.link }]}
                >
                  {step.highlight}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <View style={styles.progressDots}>
              {TOUR_STEP_KEYS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index === currentStep ? theme.link : theme.tabIconDefault,
                      width: index === currentStep ? 24 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.buttons}>
              {currentStep > 0 ? (
                <Pressable onPress={handleBack} style={styles.backButton}>
                  <Feather name="chevron-left" size={20} color={theme.text} />
                  <ThemedText type="body">{t('common.back')}</ThemedText>
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}

              <Button
                onPress={handleNext}
                style={styles.nextButton}
              >
                {isLastStep ? (t('onboarding.getStarted') || 'Get Started') : t('common.next')}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: Spacing.xl,
  },
  skipButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: 180,
    height: 180,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  description: {
    textAlign: "center",
    opacity: 0.8,
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  highlightBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  highlightText: {
    fontWeight: "600",
  },
  footer: {
    gap: Spacing.xl,
  },
  progressDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    minWidth: 80,
  },
  nextButton: {
    minWidth: 140,
  },
});
