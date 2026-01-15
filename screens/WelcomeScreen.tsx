import React, { useRef, useEffect, useState } from "react";
import { StyleSheet, View, Image, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

const BACKGROUND_VIDEOS = [
  require("../assets/videos/woman_pondering_outfits_on_bed.mp4"),
  require("../assets/videos/woman_comparing_two_dresses_held_firmly.mp4"),
  require("../assets/videos/woman_trying_tops_with_closed_mouth.mp4"),
];

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const videoRef = useRef<Video>(null);
  const [backgroundVideo] = useState(() => BACKGROUND_VIDEOS[Math.floor(Math.random() * BACKGROUND_VIDEOS.length)]);

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

      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}>
        <View style={styles.logoContainer}>
          <ThemedText type="h1" style={styles.brandName}>
            Dripn
          </ThemedText>
          <Image
            source={require("../assets/images/dripn-logo-icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="body" style={styles.taglineBelow}>
            style that flows
          </ThemedText>
          <ThemedText type="small" style={styles.tagline}>
            Your personal AI stylist. Decide what to wear in seconds.
          </ThemedText>
        </View>

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
          style={({ pressed }) => [
            styles.secondaryButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="body" style={styles.secondaryButtonText}>
            Already have an account?{" "}
            <ThemedText type="link" style={styles.linkText}>
              Sign In
            </ThemedText>
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

function FeatureItem({ icon, title, description, theme, isDark }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={[
        styles.featureIcon, 
        { backgroundColor: isDark ? 'rgba(26, 23, 20, 0.9)' : 'rgba(240, 235, 228, 0.9)' }
      ]}>
        <Feather name={icon} size={24} color={theme.link} />
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
    marginTop: Spacing["2xl"],
  },
  brandName: {
    fontSize: 48,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
    letterSpacing: 2,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.sm,
  },
  taglineBelow: {
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: Spacing.lg,
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagline: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    fontSize: 14,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuresContainer: {
    gap: Spacing.lg,
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
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featureDescription: {
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    textAlign: "center",
  },
  linkText: {
    fontWeight: "600",
  },
});
