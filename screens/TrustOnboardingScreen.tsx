import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { LoopingBackgroundVideo } from "@/components/LoopingBackgroundVideo";
import { Spacing, BorderRadius, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { onboardingAnalyticsService } from "@/services/OnboardingAnalyticsService";
import { videoRandomizer, type VideoTone } from "@/services/VideoRandomizerService";
import { useTranslations } from "@/contexts/TranslationContext";

type TrustOnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "TrustOnboarding">;
};

type TrustMsgMeta = {
  key: string;
  tone: VideoTone;
  bulletCount?: number;
  bulletIcons?: (keyof typeof Feather.glyphMap)[];
};

const POSITIONING: TrustMsgMeta[] = [
  { key: "pos0", tone: "pain" },
  { key: "pos1", tone: "pain" },
  { key: "pos2", tone: "pain" },
  { key: "pos3", tone: "pain" },
  { key: "pos4", tone: "pain" },
  { key: "pos5", tone: "pain" },
];

const ASPIRATION: TrustMsgMeta[] = [
  { key: "asp0", tone: "confidence" },
  { key: "asp1", tone: "confidence" },
  { key: "asp2", tone: "confidence" },
  { key: "asp3", tone: "confidence" },
  { key: "asp4", tone: "confidence" },
  { key: "asp5", tone: "confidence" },
  { key: "asp6", tone: "confidence" },
  { key: "asp7", tone: "confidence" },
];

const TRUST_FRAMING: TrustMsgMeta[] = [
  { key: "tf0", tone: "mixed", bulletCount: 3 },
  { key: "tf1", tone: "mixed", bulletCount: 3 },
  { key: "tf2", tone: "mixed", bulletCount: 3 },
  { key: "tf3", tone: "mixed", bulletCount: 3 },
  { key: "tf4", tone: "mixed", bulletCount: 3 },
  { key: "tf5", tone: "mixed", bulletCount: 3 },
];

const CONTROL: TrustMsgMeta[] = [
  { key: "ctrl0", tone: "confidence", bulletCount: 3, bulletIcons: ["refresh-cw", "x-circle", "lock"] },
  { key: "ctrl1", tone: "confidence", bulletCount: 3, bulletIcons: ["message-circle", "user", "check"] },
  { key: "ctrl2", tone: "confidence", bulletCount: 3, bulletIcons: ["lock", "eye-off", "shield"] },
  { key: "ctrl3", tone: "confidence", bulletCount: 3, bulletIcons: ["lock", "eye-off", "heart"] },
  { key: "ctrl4", tone: "confidence", bulletCount: 3, bulletIcons: ["smile", "bell-off", "coffee"] },
  { key: "ctrl5", tone: "confidence", bulletCount: 3, bulletIcons: ["layers", "database", "shield"] },
];

const ALL_TRUST_MESSAGES: TrustMsgMeta[] = [
  ...POSITIONING,
  ...ASPIRATION,
  ...TRUST_FRAMING,
  ...CONTROL,
];

function getRandomContent<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

export default function TrustOnboardingScreen({ navigation }: TrustOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslations();

  const [trustMeta] = useState(() => getRandomContent(ALL_TRUST_MESSAGES));
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo({ tone: trustMeta.tone }));
  const [messageVariationId] = useState(() => `trust_${ALL_TRUST_MESSAGES.indexOf(trustMeta) + 1}`);

  const trustMessage = useMemo(() => {
    const prefix = `trustOnboarding.${trustMeta.key}`;
    const headline = t(`${prefix}.headline`);
    const subtext = t(`${prefix}.subtext`);
    const bullets =
      trustMeta.bulletCount && trustMeta.bulletCount > 0
        ? Array.from({ length: trustMeta.bulletCount }, (_, i) => ({
            text: t(`${prefix}.bullet${i}`),
            icon: trustMeta.bulletIcons?.[i],
          })).filter((b) => !!b.text)
        : undefined;
    return {
      headline: headline || "",
      subtext: subtext || undefined,
      bullets: bullets && bullets.length > 0 ? bullets : undefined,
    };
  }, [t, trustMeta]);

  useEffect(() => {
    onboardingAnalyticsService.trackVariation(messageVariationId, "trust", "view");
  }, [messageVariationId]);

  const handleGetStyled = () => {
    onboardingAnalyticsService.trackVariation(messageVariationId, "trust", "complete", "what-to-wear-today" as any);
    navigation.navigate("OnboardingProfile");
  };

  return (
    <View style={styles.container}>
      <LoopingBackgroundVideo source={backgroundVideo} style={styles.backgroundVideo} />

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.65)", "rgba(0,0,0,0.95)"]}
        style={styles.gradientOverlay}
        locations={[0, 0.35, 0.6, 1]}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#1A1A1A" />
        </Pressable>
        <Animated.View entering={FadeIn.duration(400)} style={styles.stepContainer}>
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
                {t("trustOnboarding.letsGo") || "Let's Go"}
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

function BulletPoint({ text, icon }: BulletPointProps) {
  return (
    <View style={styles.bulletPoint}>
      <LinearGradient colors={ScreenGradients.trustOnboarding.secondary} style={styles.bulletIconWrapper}>
        <Feather name={icon || "check"} size={14} color="#FFFFFF" />
      </LinearGradient>
      <ThemedText type="body" style={styles.bulletText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
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
  ctaContainer: {
    gap: Spacing.md,
    paddingTop: Spacing.xl,
  },
  primaryButton: {
    width: "100%",
  },
});
