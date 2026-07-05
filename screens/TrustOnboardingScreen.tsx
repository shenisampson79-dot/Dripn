import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { LoopingBackgroundVideo } from "@/components/LoopingBackgroundVideo";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { onboardingAnalyticsService } from "@/services/OnboardingAnalyticsService";
import { videoRandomizer } from "@/services/VideoRandomizerService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TrustOnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "TrustOnboarding">;
};

interface OnboardingContent {
  headline: string;
  subtext?: string;
  bullets?: { text: string; icon?: keyof typeof Feather.glyphMap }[];
}

const POSITIONING_OPTIONS: OnboardingContent[] = [
  {
    headline: "Stop overthinking what to wear.",
    subtext: "An opinionated AI stylist that tells you what to wear — using your wardrobe when available.",
  },
  {
    headline: "You've stared at your wardrobe for 20 minutes. Again.",
    subtext: "Let's fix that. One clear answer, every time.",
  },
  {
    headline: "Three outfits on the bed. Zero confidence in any of them.",
    subtext: "Sound familiar? I'll tell you which one to wear.",
  },
  {
    headline: "Running late because you changed twice.",
    subtext: "Get dressed with certainty. First time, every time.",
  },
  {
    headline: "The longer you look, the less you know.",
    subtext: "Break the spiral. Get a clear answer in seconds.",
  },
  {
    headline: "Your wardrobe isn't the problem. The decision is.",
    subtext: "I make the call. You make the exit.",
  },
];

const ASPIRATION_OPTIONS: OnboardingContent[] = [
  {
    headline: "Walk in looking like you planned it. Even if you didn't.",
    subtext: "We decide what you wear — so you look better than everyone else with zero effort.",
  },
  {
    headline: "Be the best-dressed person in the room — without trying.",
    subtext: "Your friends will ask where you shop. You don't have to know.",
  },
  {
    headline: "Stop being the one who 'doesn't really do fashion.'",
    subtext: "Nobody taught you? That's fine. We decide for you.",
  },
  {
    headline: "Look like you have a stylist. Because you do.",
    subtext: "One clear outfit. No scrolling. No second-guessing.",
  },
  {
    headline: "Think less. Look better.",
    subtext: "From 'I have nothing to wear' to 'just wear this' in seconds.",
  },
  {
    headline: "Date tonight? Work tomorrow? Already handled.",
    subtext: "Tell us the occasion — we make the call.",
  },
  {
    headline: "You don't need taste. You need a decision.",
    subtext: "Perfect if you've never learned how to dress — we won't judge.",
  },
  {
    headline: "Quiet confidence beats loud insecurity.",
    subtext: "Dress sharper than your friends without making it a personality.",
  },
];

const TRUST_FRAMING_OPTIONS: OnboardingContent[] = [
  {
    headline: "One question. One outfit. Done.",
    bullets: [
      { text: "No second-guessing" },
      { text: "No infinite options" },
      { text: "Just clarity" },
    ],
  },
  {
    headline: "A stylist who actually decides.",
    bullets: [
      { text: "One clear recommendation" },
      { text: "No scrolling, no trends" },
      { text: "Designed to save time, not steal it" },
    ],
  },
  {
    headline: "No feed. No likes. No 'maybe this, maybe that.'",
    bullets: [
      { text: "Just: wear this" },
      { text: "One answer, not twenty options" },
      { text: "Get dressed and go" },
    ],
  },
  {
    headline: "You ask. I answer. That's it.",
    bullets: [
      { text: "No endless scrolling" },
      { text: "No algorithm games" },
      { text: "Just the outfit you need" },
    ],
  },
  {
    headline: "Built to get you out the door, not glued to a screen.",
    bullets: [
      { text: "Fast, decisive recommendations" },
      { text: "No time-wasting features" },
      { text: "Mission: get you dressed" },
    ],
  },
  {
    headline: "Other apps want your attention. I want you dressed and gone.",
    bullets: [
      { text: "Success = you leaving quickly" },
      { text: "No engagement tricks" },
      { text: "Your time matters more than mine" },
    ],
  },
];

const CONTROL_REASSURANCE_OPTIONS: OnboardingContent[] = [
  {
    headline: "You're always in control.",
    bullets: [
      { text: "You can ask for a second opinion", icon: "users" },
      { text: "You can ignore any advice", icon: "x-circle" },
      { text: "Nothing is posted publicly", icon: "lock" },
    ],
  },
  {
    headline: "Ignore me. Disagree with me. You're still the boss.",
    bullets: [
      { text: "My job is to recommend, not command", icon: "message-circle" },
      { text: "Your style, your rules", icon: "user" },
      { text: "I'm just here to help decide", icon: "check" },
    ],
  },
  {
    headline: "Your mirror moments stay between us.",
    bullets: [
      { text: "Photos never shared without permission", icon: "lock" },
      { text: "No public profiles or feeds", icon: "eye-off" },
      { text: "This is your private space", icon: "shield" },
    ],
  },
  {
    headline: "No one sees your outfit pics. Not even me judging your 2019 purchases.",
    bullets: [
      { text: "Your wardrobe stays private", icon: "lock" },
      { text: "No social pressure here", icon: "users" },
      { text: "Just honest, helpful advice", icon: "heart" },
    ],
  },
  {
    headline: "Take my advice or don't. I'm not keeping score.",
    bullets: [
      { text: "No guilt trips", icon: "smile" },
      { text: "No passive-aggressive reminders", icon: "bell-off" },
      { text: "Just here when you need me", icon: "coffee" },
    ],
  },
  {
    headline: "Private by default. Shared only if you say so.",
    bullets: [
      { text: "You control what's visible", icon: "eye" },
      { text: "Your data, your choice", icon: "database" },
      { text: "Trust built on transparency", icon: "shield" },
    ],
  },
];

function getRandomContent<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

const ALL_TRUST_MESSAGES: OnboardingContent[] = [
  ...POSITIONING_OPTIONS,
  ...ASPIRATION_OPTIONS,
  ...TRUST_FRAMING_OPTIONS,
  ...CONTROL_REASSURANCE_OPTIONS,
];

export default function TrustOnboardingScreen({ navigation }: TrustOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  
  const [trustMessage] = useState(() => getRandomContent(ALL_TRUST_MESSAGES));
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo());
  
  const [messageVariationId] = useState(() => `trust_${ALL_TRUST_MESSAGES.indexOf(trustMessage) + 1}`);
  
  useEffect(() => {
    onboardingAnalyticsService.trackVariation(messageVariationId, 'trust', 'view');
  }, []);

  const handleGetStyled = () => {
    onboardingAnalyticsService.trackVariation(messageVariationId, 'trust', 'complete', 'what-to-wear-today' as any);
    navigation.navigate("OnboardingProfile");
  };

  return (
    <View style={styles.container}>
      <LoopingBackgroundVideo
        source={backgroundVideo}
        style={styles.backgroundVideo}
      />

      <LinearGradient
        colors={[
          "transparent",
          "rgba(0,0,0,0.35)",
          "rgba(0,0,0,0.65)",
          "rgba(0,0,0,0.95)"
        ]}
        style={styles.gradientOverlay}
        locations={[0, 0.35, 0.6, 1]}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <View style={styles.backButtonInner}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
        <View style={styles.headerSpacer} />
        <Animated.View 
          entering={FadeIn.duration(400)} 
          style={styles.stepContainer}
        >
          <View style={styles.stepContent}>
            <View style={styles.contentCard}>
              <ThemedText type="h1" style={styles.headline}>
                {trustMessage.headline}
              </ThemedText>
              {trustMessage.subtext ? (
                <ThemedText type="body" style={styles.subtext}>
                  {trustMessage.subtext}
                </ThemedText>
              ) : null}
              {trustMessage.bullets ? (
                <View style={styles.bulletContainer}>
                  {trustMessage.bullets.map((bullet, index) => (
                    <BulletPoint key={index} text={bullet.text} theme={theme} icon={bullet.icon} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.ctaContainer}>
            <LinearGradient
              colors={ScreenGradients.trustOnboarding.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Button onPress={handleGetStyled} style={styles.primaryButton}>
                Let's Go
              </Button>
            </LinearGradient>
          </View>
        </Animated.View>
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
      <LinearGradient
        colors={ScreenGradients.trustOnboarding.secondary}
        style={styles.bulletIconWrapper}
      >
        <Feather name={icon || "check"} size={14} color="#FFFFFF" />
      </LinearGradient>
      <ThemedText type="body" style={styles.bulletText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: Spacing.lg,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
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
  contentCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  headline: {
    fontSize: 30,
    lineHeight: 38,
    marginBottom: Spacing.lg,
    color: "#FFFFFF",
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  subtext: {
    fontSize: 18,
    lineHeight: 26,
    color: "#FFFFFF",
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  bulletContainer: {
    gap: Spacing.md,
  },
  bulletPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  bulletIcon: {
    width: 24,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bulletIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaGradient: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  bulletText: {
    flex: 1,
    fontSize: 17,
    color: "#FFFFFF",
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  optionIcon: {
    marginRight: Spacing.md,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
  },
  loadingText: {
    color: "#FFFFFF",
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
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
    borderRadius: BorderRadius.xl,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  recommendationTitle: {
    fontSize: 24,
    lineHeight: 30,
    marginBottom: Spacing.md,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  recommendationExplanation: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255, 255, 255, 0.95)",
  },
  backupContainer: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  backupLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    color: "rgba(255, 255, 255, 0.8)",
  },
  backupText: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  noWardrobeNote: {
    textAlign: "center",
    marginTop: Spacing.lg,
    fontStyle: "italic",
    color: "#FFFFFF",
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
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
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
