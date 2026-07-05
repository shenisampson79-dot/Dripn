import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { LoopingBackgroundVideo } from "@/components/LoopingBackgroundVideo";
import { Spacing, BorderRadius, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";
import { videoRandomizer } from "@/services/VideoRandomizerService";

type OnboardingEntryScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "OnboardingEntry">;
};

interface EntryPoint {
  id: string;
  label: string;
  subtitle: string;
  cta: string;
}

interface EntryData {
  title: string;
  subtitle: string;
  entryPoints: EntryPoint[];
  trustBuilding: string;
}

export default function OnboardingEntryScreen({ navigation }: OnboardingEntryScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [entryData, setEntryData] = useState<EntryData | null>(null);
  const [selectedVideo] = useState(() => videoRandomizer.getNextVideo({ tone: "confidence" }));

  const ui = useMemo(
    () => ({
      gradientColors: isDark
        ? (["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.65)", "rgba(0,0,0,0.95)"] as const)
        : (["rgba(250,248,245,0.75)", "rgba(250,248,245,0.88)", "rgba(250,248,245,0.94)", "rgba(250,248,245,0.98)"] as const),
      gradientLocations: isDark ? ([0, 0.4, 0.7, 1] as const) : ([0, 0.25, 0.55, 1] as const),
      rootBg: isDark ? "#000000" : theme.backgroundRoot,
      title: isDark ? "#FFFFFF" : theme.text,
      subtitle: isDark ? "rgba(255,255,255,0.9)" : "#5A4D3A",
      backBg: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.72)",
      backIcon: isDark ? "#FFFFFF" : theme.text,
      signInBorder: isDark ? "rgba(255,255,255,0.4)" : theme.border,
      signInBg: isDark ? "rgba(255,255,255,0.1)" : theme.backgroundDefault,
      signInText: isDark ? "#FFFFFF" : theme.text,
      trustText: isDark ? "rgba(255,255,255,0.6)" : "#6B5E4C",
    }),
    [isDark, theme]
  );

  useEffect(() => {
    loadEntryData();
  }, []);

  const loadEntryData = async () => {
    try {
      const data = await apiService.get<EntryData>("/api/onboarding/entry-paths");
      if (data) {
        setEntryData(data);
      }
    } catch (error: unknown) {
      setEntryData({
        title: "We decide. You look better.",
        subtitle: "Zero effort — your stylist picks the outfit so you outdress the room.",
        entryPoints: [
          { id: "decide_for_me", label: "Decide for me", subtitle: "One answer. Out the door.", cta: "Decide for me" },
          { id: "style_me_properly", label: "Style me properly", subtitle: "Using my wardrobe when ready", cta: "Style me properly" },
        ],
        trustBuilding: "See how it works before signing up",
      });
    }
  };

  const handleEntryChoice = async (entryPointId: string) => {
    try {
      await apiService.post("/api/onboarding/select-path", { path: entryPointId });
    } catch (error) {
      console.log("Failed to track path selection");
    }

    if (entryPointId === "decide_for_me") {
      navigation.navigate("DecideForMe");
    } else {
      navigation.navigate("StyleMeProperly");
    }
  };

  const handleJustBrowsing = async () => {
    try {
      await apiService.post<{ immediateChat?: boolean; browsingMode?: boolean }>("/api/onboarding/entry-choice", { 
        choice: "just_browsing" 
      });
    } catch (error) {
      console.log("Failed to track browsing choice");
    }
    navigation.navigate("GuestBrowse");
  };

  const decideForMe = entryData?.entryPoints?.find(e => e.id === "decide_for_me");
  const styleMeProperly = entryData?.entryPoints?.find(e => e.id === "style_me_properly");

  return (
    <View style={[styles.container, { backgroundColor: ui.rootBg }]}>
      {Platform.OS !== "web" ? (
        <LoopingBackgroundVideo source={selectedVideo} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundDefault }]} />
      )}

      <LinearGradient
        colors={ui.gradientColors}
        style={StyleSheet.absoluteFill}
        locations={ui.gradientLocations}
      />

      <Pressable 
        onPress={() => navigation.goBack()} 
        style={[styles.backButton, { top: insets.top + Spacing.md }]}
      >
        <View style={[styles.backButtonInner, { backgroundColor: ui.backBg }]}>
          <Feather name="arrow-left" size={20} color={ui.backIcon} />
        </View>
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <Animated.View entering={FadeIn.delay(200)} style={styles.header}>
          <ThemedText type="h1" style={[styles.title, { color: ui.title }, !isDark && styles.titleLight]}>
            {entryData?.title || "What should I wear?"}
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: ui.subtitle }, !isDark && styles.subtitleLight]}>
            {entryData?.subtitle || "Your AI stylist will decide for you — no scrolling, no guessing."}
          </ThemedText>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(400).springify()} 
          style={styles.ctaContainer}
        >
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              styles.primaryCta,
              { opacity: pressed ? 0.9 : 1 }
            ]}
            onPress={() => handleEntryChoice("decide_for_me")}
          >
            <LinearGradient
              colors={ScreenGradients.decideForMe.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <View style={styles.ctaContent}>
                <View style={styles.ctaTextContainer}>
                  <ThemedText type="h3" style={[styles.ctaLabel, { color: '#4A3428', fontWeight: '700' }]}>
                    {decideForMe?.label || "Decide for me"}
                  </ThemedText>
                  <ThemedText type="small" style={[styles.ctaSubtitle, { color: '#4A3428', opacity: 0.8, fontWeight: '500' }]}>
                    {decideForMe?.subtitle || "Fast, confident advice"}
                  </ThemedText>
                </View>
                <View style={styles.ctaIconWrapper}>
                  <Feather name="zap" size={24} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              styles.secondaryCta,
              { opacity: pressed ? 0.9 : 1 }
            ]}
            onPress={() => handleEntryChoice("style_me_properly")}
          >
            <LinearGradient
              colors={ScreenGradients.styleMeProperly.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <View style={styles.ctaContent}>
                <View style={styles.ctaTextContainer}>
                  <ThemedText type="h3" style={styles.ctaLabel}>
                    {styleMeProperly?.label || "Style me properly"}
                  </ThemedText>
                  <ThemedText type="small" style={[styles.ctaSubtitle, { opacity: 0.9 }]}>
                    {styleMeProperly?.subtitle || "Using my wardrobe & preferences"}
                  </ThemedText>
                </View>
                <View style={styles.ctaIconWrapper}>
                  <Feather name="grid" size={24} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable 
            onPress={() => navigation.navigate("Auth", { mode: "login" })}
            style={[
              styles.signInButton,
              { borderColor: ui.signInBorder, backgroundColor: ui.signInBg },
            ]}
          >
            <ThemedText type="body" style={[styles.signInButtonText, { color: ui.signInText }]}>
              Already have an account? Sign in
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleJustBrowsing}>
            <ThemedText type="small" style={[styles.trustText, { color: ui.trustText, textDecorationLine: 'underline' }]}>
              {entryData?.trustBuilding || "See how it works before signing up"}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleLight: {
    textShadowColor: "transparent",
  },
  subtitle: {
    fontSize: 17,
    textAlign: "center",
    marginTop: Spacing.md,
    lineHeight: 24,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitleLight: {
    textShadowColor: "transparent",
  },
  ctaContainer: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  ctaButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  primaryCta: {
    shadowColor: "#DB2777",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  secondaryCta: {
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaGradient: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  ctaIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  ctaSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 2,
  },
  signInButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  signInButtonText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  trustText: {
    textAlign: "center",
    marginTop: Spacing.sm,
    fontSize: 13,
  },
});
