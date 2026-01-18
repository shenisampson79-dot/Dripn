import React, { useState } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";

type WardrobeSetupOption = "diy" | "later" | "dfy";

interface WardrobeSetupScreenProps {
  navigation: any;
  onComplete: () => void;
}

const SETUP_OPTIONS: { id: WardrobeSetupOption; title: string; description: string; icon: keyof typeof Feather.glyphMap }[] = [
  {
    id: "diy",
    title: "Add wardrobe now (DIY)",
    description: "Take photos of your clothes and organize them yourself",
    icon: "camera",
  },
  {
    id: "later",
    title: "I'll do it later",
    description: "Skip for now — you can always add items later",
    icon: "clock",
  },
  {
    id: "dfy",
    title: "Have someone do it for me (DFY)",
    description: "Send us photos and we'll organize everything for you",
    icon: "gift",
  },
];

export default function WardrobeSetupScreen({ navigation, onComplete }: WardrobeSetupScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<WardrobeSetupOption | null>(null);

  const userFirstName = user?.name?.split(" ")[0] || "there";

  const handleContinue = () => {
    if (selectedOption === "diy") {
      navigation.navigate("WardrobeTab");
    } else if (selectedOption === "dfy") {
      navigation.navigate("WardrobeTab");
    } else {
      onComplete();
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <ThemedText type="h1" style={styles.headline}>
          Want better advice over time?
        </ThemedText>
        <ThemedText type="body" style={styles.subtext}>
          Adding your wardrobe helps me give you personalized recommendations using what you already own.
        </ThemedText>
      </Animated.View>

      <View style={styles.optionsContainer}>
        {SETUP_OPTIONS.map((option, index) => (
          <Animated.View 
            key={option.id}
            entering={FadeInDown.delay(100 * index).duration(300)}
          >
            <Pressable
              onPress={() => setSelectedOption(option.id)}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: selectedOption === option.id 
                    ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)')
                    : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'),
                  borderColor: selectedOption === option.id 
                    ? theme.link 
                    : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <View style={[styles.iconContainer, { 
                backgroundColor: selectedOption === option.id ? theme.link : theme.backgroundSecondary 
              }]}>
                <Feather 
                  name={option.icon} 
                  size={24} 
                  color={selectedOption === option.id ? "#FFFFFF" : theme.text} 
                />
              </View>
              <View style={styles.optionContent}>
                <ThemedText type="h3" style={styles.optionTitle}>
                  {option.title}
                </ThemedText>
                <ThemedText type="small" style={styles.optionDescription}>
                  {option.description}
                </ThemedText>
              </View>
              {selectedOption === option.id ? (
                <View style={[styles.checkCircle, { backgroundColor: theme.link }]}>
                  <Feather name="check" size={16} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <ThemedText type="small" style={styles.trustNote}>
          This respects your autonomy — which builds trust.
        </ThemedText>
        <Button 
          onPress={handleContinue}
          disabled={!selectedOption}
          style={[styles.continueButton, { opacity: selectedOption ? 1 : 0.5 }]}
        >
          Continue
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing["2xl"],
  },
  headline: {
    fontSize: 28,
    lineHeight: 36,
    marginBottom: Spacing.md,
  },
  subtext: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  optionsContainer: {
    flex: 1,
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    opacity: 0.7,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    gap: Spacing.md,
  },
  trustNote: {
    textAlign: "center",
    opacity: 0.6,
    fontStyle: "italic",
  },
  continueButton: {
    width: "100%",
  },
});
