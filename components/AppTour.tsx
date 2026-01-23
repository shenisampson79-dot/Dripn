import React, { useState, useEffect } from "react";
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
import { useAuth } from "@/contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TourStep {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  highlight?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: "award",
    title: "Welcome to Dripn!",
    description: "Your personal fashion decision engine. Get instant, confident outfit decisions from AI stylists who learn your style and help you look your best.",
    highlight: "Decide what to wear in seconds",
  },
  {
    icon: "star",
    title: "Meet Your Stylists",
    description: "Choose from 4 unique AI stylists: Ruby (bold & glamorous), Max (clean & minimal), Ace (street-smart), and Ivy (eco-conscious). Each brings their own personality to your styling advice.",
    highlight: "Find your perfect style match",
  },
  {
    icon: "grid",
    title: "Build Your Wardrobe",
    description: "Add your clothes to create a digital wardrobe. Your stylist will learn what you own and suggest outfits that actually work with your pieces.",
    highlight: "Tap Wardrobe to get started",
  },
  {
    icon: "plus-circle",
    title: "The + Button",
    description: "See the + button at the bottom? That's your direct line to your stylist. Tap it anytime you need an outfit decision. You can also get a Second Opinion from others when you want extra confidence.",
    highlight: "Tap + for instant styling help",
  },
  {
    icon: "check-circle",
    title: "You're All Set!",
    description: "Explore your Home for today's decision, manage your Wardrobe, and chat with your stylist anytime. Welcome to effortless style decisions!",
    highlight: "Let's get you sorted",
  },
];

interface AppTourProps {
  visible: boolean;
  onComplete: () => void;
}

export function AppTour({ visible, onComplete }: AppTourProps) {
  const { theme } = useTheme();
  const { updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
    }
  }, [visible]);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

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

  const handleComplete = async () => {
    await updateProfile({ hasSeenTour: true });
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
                Skip Tour
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.content}>
            {currentStep === 0 ? (
              <View style={styles.logoContainer}>
                <Image 
                  source={require('@/assets/images/dripn-logo-gold-cream.png')} 
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
              {TOUR_STEPS.map((_, index) => (
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
                  <ThemedText type="body">Back</ThemedText>
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}

              <Button
                onPress={handleNext}
                style={styles.nextButton}
              >
                {isLastStep ? "Get Started" : "Next"}
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
