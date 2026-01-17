import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { 
  FadeIn, 
  FadeInUp, 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming,
  Easing
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { onboardingSessionService } from "@/services/OnboardingSessionService";

type ConfirmationScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Confirmation">;
  route: RouteProp<AuthStackParamList, "Confirmation">;
};

const SETUP_MESSAGES = [
  "Setting things up for you now",
  "Getting your stylist ready",
  "Preparing your experience",
  "Almost there",
];

const TURNAROUND_INFO: Record<string, { time: string; description: string }> = {
  outfit: {
    time: "within 24 hours",
    description: "We'll analyse your outfits and extract your style preferences",
  },
  core: {
    time: "within 24-48 hours",
    description: "We'll categorise and tag each item for accurate styling",
  },
};

export default function ConfirmationScreen({ navigation, route }: ConfirmationScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const setupType = route.params?.type || "outfit";
  const [messageIndex, setMessageIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );

    scale.value = withRepeat(
      withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % SETUP_MESSAGES.length);
    }, 2500);

    const completeTimer = setTimeout(() => {
      setIsComplete(true);
      onboardingSessionService.completeStep("confirmation");
    }, 3000);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(completeTimer);
    };
  }, []);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const turnaround = TURNAROUND_INFO[setupType] || TURNAROUND_INFO.outfit;

  const handleContinue = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Welcome" }],
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {!isComplete ? (
          <Animated.View entering={FadeIn} style={styles.loadingSection}>
            <Animated.View style={[styles.spinnerContainer, pulseStyle]}>
              <Animated.View style={spinnerStyle}>
                <View style={[styles.spinnerRing, { borderColor: theme.link }]} />
              </Animated.View>
              <View style={[styles.spinnerCenter, { backgroundColor: theme.link }]}>
                <Feather name="star" size={28} color="#FFFFFF" />
              </View>
            </Animated.View>

            <ThemedText type="h2" style={[styles.loadingText, { color: theme.text }]}>
              {SETUP_MESSAGES[messageIndex]}
            </ThemedText>

            <View style={styles.dotsContainer}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: theme.link, opacity: messageIndex % 3 === i ? 1 : 0.3 }
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} style={styles.completeSection}>
            <Animated.View entering={FadeIn} style={[styles.successCircle, { backgroundColor: theme.link }]}>
              <Feather name="check" size={40} color="#FFFFFF" />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(200)}>
              <ThemedText type="h2" style={[styles.successTitle, { color: theme.text }]}>
                You're all set!
              </ThemedText>
              <ThemedText type="body" style={[styles.successSubtitle, { color: theme.tabIconDefault }]}>
                Your stylist will be ready {turnaround.time}
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400)} style={[styles.infoCard, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={styles.infoRow}>
                <Feather name="clock" size={20} color={theme.link} />
                <View style={styles.infoTextContainer}>
                  <ThemedText type="body" style={[styles.infoTitle, { color: theme.text }]}>
                    What happens next?
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                    {turnaround.description}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.infoRow}>
                <Feather name="bell" size={20} color={theme.link} />
                <View style={styles.infoTextContainer}>
                  <ThemedText type="body" style={[styles.infoTitle, { color: theme.text }]}>
                    We'll notify you
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                    You'll get a notification when your stylist is ready
                  </ThemedText>
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(600)} style={styles.reassurance}>
              <Feather name="shield" size={16} color={theme.tabIconDefault} />
              <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: Spacing.xs }}>
                Your photos are private and secure
              </ThemedText>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {isComplete ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button onPress={handleContinue} style={[styles.continueButton, { backgroundColor: theme.link }]}>
            Explore the app
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  loadingSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  spinnerRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  spinnerCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completeSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
  },
  infoCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  reassurance: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  continueButton: {
    width: "100%",
  },
});
