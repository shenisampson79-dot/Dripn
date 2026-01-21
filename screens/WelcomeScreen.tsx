import React, { useRef, useEffect, useState } from "react";
import { StyleSheet, View, Image, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { videoRandomizer } from "@/services/VideoRandomizerService";

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const videoRef = useRef<Video>(null);
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo());

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      const attemptPlay = async () => {
        try {
          await videoRef.current?.playAsync();
        } catch (e) {
        }
      };
      attemptPlay();
      const timer = setTimeout(attemptPlay, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && !status.isPlaying && Platform.OS === 'web') {
      videoRef.current?.playAsync().catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        key={isDark ? 'dark-bg' : 'light-bg'}
        source={backgroundVideo}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />

      <LinearGradient
        colors={[
          "transparent",
          `${ScreenGradients.welcome.primary[0]}70`,
          `${ScreenGradients.welcome.primary[1]}A0`,
          "rgba(0,0,0,0.9)"
        ]}
        style={styles.overlay}
        locations={[0, 0.3, 0.6, 1]}
      />
      
      <View style={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoRow}>
            <Image
              source={require("../assets/images/dripn-logo-icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.brandTextContainer}>
              <ThemedText type="h1" style={styles.brandName}>
                Dripn
              </ThemedText>
              <ThemedText type="small" style={styles.taglineBelow}>
                style that flows
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="zap"
            title="Instant Decisions"
            description="Know what to wear in seconds, not hours"
            theme={theme}
            isDark={isDark}
          />
          <FeatureItem
            icon="message-circle"
            title="4 AI Stylists"
            description="Choose your vibe: supportive or straight-talking"
            theme={theme}
            isDark={isDark}
          />
          <FeatureItem
            icon="users"
            title="Second Opinions"
            description="Get quick feedback from people with similar style"
            theme={theme}
            isDark={isDark}
          />
          <FeatureItem
            icon="grid"
            title="Your Digital Wardrobe"
            description="Build once, get styled forever"
            theme={theme}
            isDark={isDark}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button
          onPress={() => navigation.navigate("TrustOnboarding")}
          style={styles.primaryButton}
        >
          Get Styled
        </Button>
        
        <Pressable 
          onPress={() => navigation.navigate("Auth", { mode: "login" })}
          style={styles.signInButton}
        >
          <ThemedText type="body" style={styles.signInText}>
            Already have an account? <ThemedText type="body" style={styles.signInLink}>Sign In</ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  theme: any;
  isDark: boolean;
}

const FEATURE_GRADIENTS: Record<string, readonly [string, string]> = {
  zap: [LuxuryColors.coral, LuxuryColors.magenta],
  'message-circle': [LuxuryColors.violet, LuxuryColors.deepViolet],
  users: [LuxuryColors.teal, LuxuryColors.emerald],
  grid: [LuxuryColors.gold, LuxuryColors.deepGold],
};

function FeatureItem({ icon, title, description, theme, isDark }: FeatureItemProps) {
  const gradientColors = FEATURE_GRADIENTS[icon] || [LuxuryColors.violet, LuxuryColors.deepViolet];
  
  return (
    <View style={styles.featureItem}>
      <LinearGradient
        colors={gradientColors}
        style={styles.featureIcon}
      >
        <Feather name={icon} size={22} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.featureText}>
        <ThemedText type="h3" style={styles.featureTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={styles.featureDescription}>
          {description}
        </ThemedText>
      </View>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  logoContainer: {
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  brandTextContainer: {
    alignItems: "flex-start",
  },
  brandName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
  },
  taglineBelow: {
    color: "rgba(255, 255, 255, 0.9)",
    fontStyle: "italic",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuresContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    marginBottom: Spacing.xs,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featureDescription: {
    color: "rgba(255, 255, 255, 0.9)",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  primaryButton: {
    width: "100%",
  },
  signInButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  signInText: {
    color: "rgba(255, 255, 255, 0.8)",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  signInLink: {
    color: "#FFFFFF",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
