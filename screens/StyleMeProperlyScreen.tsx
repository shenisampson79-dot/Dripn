import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING_XXL = 32;

type StyleMeProperlyScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "StyleMeProperly">;
};

interface SetupOption {
  id: string;
  title: string;
  description: string;
  timeEstimate?: string;
  price?: string;
  isPaid: boolean;
  icon: keyof typeof Feather.glyphMap;
}

const SETUP_OPTIONS: SetupOption[] = [
  {
    id: "quick_start",
    title: "Quick Start",
    description: "Upload 10-15 key items or recent outfits",
    timeEstimate: "~5 minutes",
    isPaid: false,
    icon: "upload",
  },
  {
    id: "inspirations_only",
    title: "Inspirations Only",
    description: "Style preferences, lifestyle, body comfort",
    isPaid: false,
    icon: "heart",
  },
  {
    id: "done_for_you_outfit",
    title: "Outfit-Based Setup",
    description: "Upload 5-7 outfits you already wear",
    price: "£19.99",
    isPaid: true,
    icon: "camera",
  },
  {
    id: "done_for_you_core",
    title: "Core Wardrobe Setup",
    description: "We digitise up to 30 items for you",
    price: "£39.99",
    isPaid: true,
    icon: "gift",
  },
];

export default function StyleMeProperlyScreen({ navigation }: StyleMeProperlyScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [dfyPricing, setDfyPricing] = useState<{ core: string; outfit: string } | null>(null);

  useEffect(() => {
    loadDfyPricing();
  }, []);

  const loadDfyPricing = async () => {
    try {
      const data = await apiService.get<{ corePrice?: string; outfitPrice?: string }>("/api/onboarding/dfy-options");
      if (data) {
        setDfyPricing({
          core: data.corePrice || "£39.99",
          outfit: data.outfitPrice || "£19.99",
        });
      }
    } catch (error: unknown) {
      console.log("Failed to load DFY pricing");
    }
  };

  const handleOptionSelect = async (optionId: string) => {
    try {
      await apiService.post("/api/onboarding/setup-choice", { choice: optionId });
    } catch (error: unknown) {
      console.log("Failed to track setup choice");
    }

    navigation.navigate("SoftSignupGate", { fromPath: optionId });
  };

  const getOptionPrice = (option: SetupOption) => {
    if (option.id === "done_for_you_core" && dfyPricing) {
      return dfyPricing.core;
    }
    if (option.id === "done_for_you_outfit" && dfyPricing) {
      return dfyPricing.outfit;
    }
    return option.price;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text }}>Style me properly</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.stylistMessage}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.link }]}>
            <Feather name="message-circle" size={20} color="#FFFFFF" />
          </View>
          <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="body" style={[styles.messageText, { color: theme.text }]}>
              I can give precise recommendations — I just need a bit of context first.
            </ThemedText>
          </View>
        </Animated.View>

        <ThemedText type="h3" style={[styles.sectionTitle, { color: theme.text }]}>
          Let's make this precise
        </ThemedText>

        <View style={styles.optionsContainer}>
          {SETUP_OPTIONS.map((option, index) => (
            <Animated.View 
              key={option.id}
              entering={FadeInUp.delay(100 + index * 100)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.optionCard,
                  { 
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: option.isPaid ? theme.link : theme.border,
                    borderWidth: option.isPaid ? 2 : 1,
                    opacity: pressed ? 0.9 : 1,
                  }
                ]}
                onPress={() => handleOptionSelect(option.id)}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: option.isPaid ? theme.link : theme.backgroundSecondary }]}>
                    <Feather 
                      name={option.icon} 
                      size={20} 
                      color={option.isPaid ? "#FFFFFF" : theme.link} 
                    />
                  </View>
                  <View style={styles.optionTitleContainer}>
                    <View style={styles.titleRow}>
                      <ThemedText type="h3" style={[styles.optionTitle, { color: theme.text }]}>
                        {option.title}
                      </ThemedText>
                      {!option.isPaid && (
                        <View style={[styles.freeBadge, { backgroundColor: "#4CAF50" }]}>
                          <ThemedText type="small" style={styles.freeBadgeText}>Free</ThemedText>
                        </View>
                      )}
                    </View>
                    {option.timeEstimate && (
                      <View style={styles.timeRow}>
                        <Feather name="clock" size={12} color={theme.tabIconDefault} />
                        <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: 4 }}>
                          {option.timeEstimate}
                        </ThemedText>
                      </View>
                    )}
                    {option.isPaid && (
                      <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
                        {getOptionPrice(option)}
                      </ThemedText>
                    )}
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
                </View>
                <ThemedText type="body" style={[styles.optionDescription, { color: theme.tabIconDefault }]}>
                  {option.description}
                </ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInUp.delay(500)} style={styles.reassuranceContainer}>
          <Feather name="shield" size={16} color={theme.tabIconDefault} />
          <ThemedText type="small" style={[styles.reassuranceText, { color: theme.tabIconDefault }]}>
            Early adopters feel respected here, not slowed down
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  stylistMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  messageBubble: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  optionTitleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  optionTitle: {
    fontSize: 17,
  },
  freeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  freeBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 11,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 52,
  },
  reassuranceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING_XXL,
    gap: Spacing.sm,
  },
  reassuranceText: {
    textAlign: "center",
    fontStyle: "italic",
  },
});
