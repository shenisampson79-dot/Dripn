import React, { useState } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { LoopingBackgroundVideo } from "@/components/LoopingBackgroundVideo";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";
import { videoRandomizer } from "@/services/VideoRandomizerService";

const SPACING_XXL = 32;

type SoftSignupGateScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SoftSignupGate">;
  route: RouteProp<AuthStackParamList, "SoftSignupGate">;
};

export default function SoftSignupGateScreen({ navigation, route }: SoftSignupGateScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [backgroundVideo] = useState(() => videoRandomizer.getNextVideo({ tone: "confidence" }));
  const fromPath = route.params?.fromPath || "decide_for_me";

  const handleCreateAccount = async () => {
    try {
      await apiService.post("/api/onboarding/gate-response", { 
        response: "create_account",
        fromPath 
      });
    } catch (error: unknown) {
      console.log("Failed to track gate response");
    }

    navigation.navigate("Auth", { mode: "signup" });
  };

  const handleContinueWithoutSaving = async () => {
    try {
      await apiService.post("/api/onboarding/gate-response", { 
        response: "continue_without_saving",
        fromPath 
      });
    } catch (error: unknown) {
      console.log("Failed to track gate response");
    }

    navigation.navigate("GuestBrowse");
  };

  const getContextMessage = () => {
    switch (fromPath) {
      case "second_opinion_urgent":
        return "Sign up to get Fast feedback from our community";
      case "quick_start":
        return "Want me to remember this and keep styling for you?";
      case "inspirations_only":
        return "Want me to remember your preferences?";
      case "done_for_you_outfit":
      case "done_for_you_core":
        return "Create an account to complete your setup.";
      case "browsing":
      case "farewell":
        return "Save your style picks for next time?";
      default:
        return "Want me to remember this for next time?";
    }
  };

  const getBenefits = () => {
    if (fromPath === "second_opinion_urgent") {
      return [
        { icon: "users" as const, text: "Get real feedback from real people" },
        { icon: "clock" as const, text: "Quick responses within 45 minutes" },
        { icon: "thumbs-up" as const, text: "Know if your outfit works" },
      ];
    }
    if (fromPath === "browsing" || fromPath === "farewell") {
      return [
        { icon: "bookmark" as const, text: "Save outfits you like" },
        { icon: "eye" as const, text: "Browse your style history" },
        { icon: "star" as const, text: "Get personalised picks" },
      ];
    }
    return [
      { icon: "save" as const, text: "Save your recommendations" },
      { icon: "refresh-cw" as const, text: "Get better styling over time" },
      { icon: "unlock" as const, text: "Unlock all AI stylist features" },
    ];
  };

  return (
    <View style={styles.container}>
      {Platform.OS !== "web" ? (
        <LoopingBackgroundVideo source={backgroundVideo} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundDefault }]} />
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.9)"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.4, 1]}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.spacer} />

        <Animated.View entering={FadeIn.delay(200)} style={styles.messageContainer}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.link }]}>
            <Feather name="user" size={24} color="#FFFFFF" />
          </View>
          <ThemedText type="h2" style={styles.headline}>
            {getContextMessage()}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)} style={styles.benefitsContainer}>
          {getBenefits().map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <Feather name={benefit.icon} size={18} color="rgba(255,255,255,0.8)" />
              <ThemedText type="body" style={styles.benefitText}>
                {benefit.text}
              </ThemedText>
            </View>
          ))}
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(600)} 
          style={[styles.ctaContainer, { paddingBottom: insets.bottom + Spacing.xl }]}
        >
          <Button 
            onPress={handleCreateAccount} 
            style={[styles.primaryButton, { backgroundColor: theme.link }]}
          >
            {fromPath === "second_opinion_urgent" 
              ? "Get Fast feedback" 
              : fromPath === "browsing" || fromPath === "farewell" 
                ? "Save my picks" 
                : "Sign up to save"}
          </Button>

          <Pressable onPress={handleContinueWithoutSaving} style={styles.secondaryButton}>
            <ThemedText type="body" style={styles.secondaryButtonText}>
              {fromPath === "second_opinion_urgent"
                ? "Maybe later"
                : fromPath === "browsing" || fromPath === "farewell"
                  ? "Browse as guest"
                  : "Continue without saving"}
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
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  messageContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 32,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  benefitsContainer: {
    marginBottom: SPACING_XXL,
    gap: Spacing.md,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  benefitText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
  },
  ctaContainer: {
    gap: Spacing.md,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
  },
});
