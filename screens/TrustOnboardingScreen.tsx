import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Pressable, Dimensions, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInRight, 
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TrustOnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "TrustOnboarding">;
};

type HelpContext = "what-to-wear-today" | "event-outfit" | "build-confidence" | "shop-smarter";

const HELP_OPTIONS: { id: HelpContext; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "what-to-wear-today", label: "What to wear today", icon: "sun" },
  { id: "event-outfit", label: "What to wear to an event", icon: "calendar" },
  { id: "build-confidence", label: "Building confidence in my style", icon: "heart" },
  { id: "shop-smarter", label: "Buying less / shopping smarter", icon: "shopping-bag" },
];

const SAMPLE_RECOMMENDATIONS: Record<HelpContext, { recommendation: string; explanation: string; backup?: string }> = {
  "what-to-wear-today": {
    recommendation: "A classic white button-down with dark jeans",
    explanation: "This works because it's effortlessly polished, appropriate for almost any daytime setting, and makes you look put-together without trying too hard.",
    backup: "Swap the jeans for chinos if you need something slightly dressier.",
  },
  "event-outfit": {
    recommendation: "A tailored blazer over a simple tee with fitted trousers",
    explanation: "This combination strikes the perfect balance: sophisticated enough for events, comfortable enough to enjoy yourself, and memorable without being overdone.",
  },
  "build-confidence": {
    recommendation: "Start with well-fitted basics in neutral colors",
    explanation: "Confidence comes from knowing what works on YOU. Fitted basics are foolproof because they let your personality shine through without overthinking.",
  },
  "shop-smarter": {
    recommendation: "Focus on versatile pieces that work 3+ ways",
    explanation: "Before buying anything, ask: 'Can I wear this to work, on a weekend, AND to dinner?' If yes, it's a smart investment.",
  },
};

export default function TrustOnboardingScreen({ navigation }: TrustOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedContext, setSelectedContext] = useState<HelpContext | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const videoRef = useRef<Video>(null);
  
  const progressAnim = useSharedValue(0);
  
  useEffect(() => {
    progressAnim.value = withSpring(step / 4, { damping: 20, stiffness: 100 });
  }, [step]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progressAnim.value, [0, 1], [0, 100])}%`,
  }));

  const handleContextSelect = async (context: HelpContext) => {
    setSelectedContext(context);
    setIsGenerating(true);
    await AsyncStorage.setItem("dripn_initial_context", context);
    setTimeout(() => {
      setIsGenerating(false);
      setStep(4);
    }, 1500);
  };

  const handleGetStarted = () => {
    navigation.navigate("Auth", { mode: "signup" });
  };

  const handleLogin = () => {
    navigation.navigate("Auth", { mode: "login" });
  };

  const backgroundVideo = isDark 
    ? require("../assets/videos/champagne_gold_silk_flow.mp4")
    : require("../assets/videos/seamless_looping_pale_silk.mp4");

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Animated.View 
            entering={FadeIn.duration(400)} 
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContainer}
          >
            <View style={styles.stepContent}>
              <ThemedText type="h1" style={styles.headline}>
                Stop overthinking what to wear.
              </ThemedText>
              <ThemedText type="body" style={styles.subtext}>
                An opinionated AI stylist that tells you what to wear — using your wardrobe when available.
              </ThemedText>
            </View>
            <View style={styles.ctaContainer}>
              <Button onPress={() => setStep(1)} style={styles.primaryButton}>
                Get Styled
              </Button>
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View 
            entering={SlideInRight.duration(300)} 
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContainer}
          >
            <View style={styles.stepContent}>
              <ThemedText type="h1" style={styles.headline}>
                This isn't a feed. It's a decision engine.
              </ThemedText>
              <View style={styles.bulletContainer}>
                <BulletPoint text="One clear recommendation" theme={theme} />
                <BulletPoint text="No scrolling, no trends" theme={theme} />
                <BulletPoint text="Designed to save time, not steal it" theme={theme} />
              </View>
            </View>
            <View style={styles.ctaContainer}>
              <Button onPress={() => setStep(2)} style={styles.primaryButton}>
                Continue
              </Button>
            </View>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View 
            entering={SlideInRight.duration(300)} 
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContainer}
          >
            <View style={styles.stepContent}>
              <ThemedText type="h1" style={styles.headline}>
                You're always in control.
              </ThemedText>
              <View style={styles.bulletContainer}>
                <BulletPoint text="You can ask for a second opinion" theme={theme} icon="users" />
                <BulletPoint text="You can ignore any advice" theme={theme} icon="x-circle" />
                <BulletPoint text="Nothing is posted publicly" theme={theme} icon="lock" />
              </View>
            </View>
            <View style={styles.ctaContainer}>
              <Button onPress={() => setStep(3)} style={styles.primaryButton}>
                Continue
              </Button>
            </View>
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View 
            entering={SlideInRight.duration(300)} 
            exiting={SlideOutLeft.duration(300)}
            style={styles.stepContainer}
          >
            <View style={styles.stepContent}>
              <ThemedText type="h1" style={styles.headline}>
                What do you want help with right now?
              </ThemedText>
              <View style={styles.optionsContainer}>
                {HELP_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleContextSelect(option.id)}
                    style={({ pressed }) => [
                      styles.optionButton,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <Feather name={option.icon} size={20} color={theme.link} style={styles.optionIcon} />
                    <ThemedText type="body" style={styles.optionText}>
                      {option.label}
                    </ThemedText>
                    <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        );

      case 4:
        if (isGenerating) {
          return (
            <Animated.View 
              entering={FadeIn.duration(300)}
              style={styles.stepContainer}
            >
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.link} />
                <ThemedText type="body" style={styles.loadingText}>
                  Getting your first styling tip...
                </ThemedText>
              </View>
            </Animated.View>
          );
        }

        const recommendation = selectedContext ? SAMPLE_RECOMMENDATIONS[selectedContext] : null;

        return (
          <Animated.View 
            entering={FadeIn.duration(400)} 
            exiting={FadeOut.duration(300)}
            style={styles.stepContainer}
          >
            <View style={styles.stepContent}>
              <View style={styles.recommendationHeader}>
                <View style={[styles.recommendedBadge, { backgroundColor: theme.link }]}>
                  <ThemedText type="small" style={styles.recommendedBadgeText}>
                    Your Stylist's Pick
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.recommendationCard, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
              }]}>
                <ThemedText type="h2" style={styles.recommendationTitle}>
                  {recommendation?.recommendation}
                </ThemedText>
                <ThemedText type="body" style={styles.recommendationExplanation}>
                  {recommendation?.explanation}
                </ThemedText>
                {recommendation?.backup ? (
                  <View style={[styles.backupContainer, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  }]}>
                    <ThemedText type="small" style={styles.backupLabel}>Backup option:</ThemedText>
                    <ThemedText type="small" style={styles.backupText}>{recommendation.backup}</ThemedText>
                  </View>
                ) : null}
              </View>

              <ThemedText type="small" style={styles.noWardrobeNote}>
                This works even with zero wardrobe data.
              </ThemedText>
            </View>

            <View style={styles.ctaContainer}>
              <Button onPress={handleGetStarted} style={styles.primaryButton}>
                I'll wear this
              </Button>
              <Pressable onPress={handleLogin} style={styles.loginLink}>
                <ThemedText type="small" style={styles.loginText}>
                  Already have an account? <ThemedText type="link">Sign in</ThemedText>
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={backgroundVideo}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      <View style={[styles.overlay, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
        {step > 0 && step < 4 ? (
          <View style={styles.header}>
            <Pressable onPress={() => setStep(step - 1)} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
                <Animated.View style={[styles.progressBarFill, { backgroundColor: theme.link }, progressStyle]} />
              </View>
            </View>
            <View style={styles.placeholder} />
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        {renderStep()}
      </View>
    </View>
  );
}

interface BulletPointProps {
  text: string;
  theme: any;
  icon?: keyof typeof Feather.glyphMap;
}

function BulletPoint({ text, theme, icon }: BulletPointProps) {
  return (
    <View style={styles.bulletPoint}>
      <Feather name={icon || "check"} size={18} color={theme.link} style={styles.bulletIcon} />
      <ThemedText type="body" style={styles.bulletText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  headerSpacer: {
    height: 48,
  },
  backButton: {
    padding: Spacing.sm,
  },
  progressBarContainer: {
    flex: 1,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  placeholder: {
    width: 40,
  },
  stepContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  stepContent: {
    flex: 1,
    justifyContent: "center",
  },
  headline: {
    fontSize: 32,
    lineHeight: 40,
    marginBottom: Spacing.xl,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtext: {
    fontSize: 18,
    lineHeight: 26,
    opacity: 0.9,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bulletContainer: {
    gap: Spacing.lg,
  },
  bulletPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  bulletIcon: {
    width: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 17,
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  optionsContainer: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  optionIcon: {
    marginRight: Spacing.md,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
  },
  loadingText: {
    opacity: 0.8,
  },
  recommendationHeader: {
    marginBottom: Spacing.lg,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  recommendedBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  recommendationCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  recommendationTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: Spacing.md,
  },
  recommendationExplanation: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },
  backupContainer: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  backupLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    opacity: 0.7,
  },
  backupText: {
    opacity: 0.85,
  },
  noWardrobeNote: {
    textAlign: "center",
    marginTop: Spacing.lg,
    opacity: 0.7,
    fontStyle: "italic",
  },
  ctaContainer: {
    gap: Spacing.md,
    paddingTop: Spacing.xl,
  },
  primaryButton: {
    width: "100%",
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  loginText: {
    textAlign: "center",
  },
});
