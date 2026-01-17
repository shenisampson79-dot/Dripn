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

type StyleMeProperlyScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "StyleMeProperly">;
};

interface DfyTier {
  id: string;
  title: string;
  tagline: string;
  price: string;
  turnaround: string;
  highlights: string[];
}

interface SetupOptionsResponse {
  pageHeader: {
    title: string;
    subtitle: string;
  };
  tiers: DfyTier[];
  footerReassurance: string;
}

const DEFAULT_TIERS: DfyTier[] = [
  {
    id: "outfit",
    title: "Outfit-Based Setup",
    tagline: "Best if you already know what you like",
    price: "£19",
    turnaround: "Ready in 24h",
    highlights: [
      "Upload outfits you wear",
      "I learn your style",
      "Fastest option",
    ],
  },
  {
    id: "core",
    title: "Core Wardrobe Setup",
    tagline: "Best if you want accurate recommendations",
    price: "£39",
    turnaround: "Ready in 24-48h",
    highlights: [
      "Upload up to 30 items",
      "Categorised & tagged",
      "Strong foundation",
    ],
  },
];

export default function StyleMeProperlyScreen({ navigation }: StyleMeProperlyScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [pageHeader, setPageHeader] = useState({ 
    title: "Want me to do this for you?", 
    subtitle: "I'll set things up so your stylist works properly." 
  });
  const [tiers, setTiers] = useState<DfyTier[]>(DEFAULT_TIERS);
  const [footerReassurance, setFooterReassurance] = useState("One-time setup · No subscription required");

  useEffect(() => {
    loadSetupOptions();
  }, []);

  const loadSetupOptions = async () => {
    try {
      const data = await apiService.get<SetupOptionsResponse>("/api/onboarding/setup-options");
      if (data) {
        if (data.pageHeader) {
          setPageHeader(data.pageHeader);
        }
        if (data.tiers && data.tiers.length > 0) {
          setTiers(data.tiers);
        }
        if (data.footerReassurance) {
          setFooterReassurance(data.footerReassurance);
        }
      }
    } catch (error: unknown) {
      console.log("Using default DFY options");
    }
  };

  const handleTierSelect = async (tierId: string) => {
    try {
      await apiService.post("/api/onboarding/setup-choice", { choice: tierId });
    } catch (error: unknown) {
      console.log("Failed to track setup choice");
    }

    navigation.navigate("SoftSignupGate", { fromPath: tierId });
  };

  const handleSkip = () => {
    navigation.navigate("OnboardingEntry");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.headerSection}>
          <ThemedText type="h2" style={[styles.pageTitle, { color: theme.text }]}>
            {pageHeader.title}
          </ThemedText>
          <ThemedText type="body" style={[styles.pageSubtitle, { color: theme.tabIconDefault }]}>
            {pageHeader.subtitle}
          </ThemedText>
        </Animated.View>

        <View style={styles.tiersContainer}>
          {tiers.map((tier, index) => (
            <Animated.View 
              key={tier.id}
              entering={FadeInUp.delay(100 + index * 150)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.tierCard,
                  { 
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: index === 0 ? theme.link : theme.border,
                    borderWidth: index === 0 ? 2 : 1,
                    opacity: pressed ? 0.9 : 1,
                  }
                ]}
                onPress={() => handleTierSelect(tier.id)}
              >
                {index === 0 ? (
                  <View style={[styles.recommendedBadge, { backgroundColor: theme.link }]}>
                    <Feather name="zap" size={12} color="#FFFFFF" />
                    <ThemedText type="small" style={styles.recommendedText}>Fastest</ThemedText>
                  </View>
                ) : null}

                <View style={styles.tierHeader}>
                  <View style={[styles.tierIcon, { backgroundColor: index === 0 ? theme.link : theme.backgroundSecondary, borderColor: theme.border, borderWidth: index === 0 ? 0 : 1 }]}>
                    <Feather 
                      name={index === 0 ? "camera" : "grid"} 
                      size={20} 
                      color={index === 0 ? "#FFFFFF" : theme.link} 
                    />
                  </View>
                  <View style={styles.tierTitleContainer}>
                    <ThemedText type="h3" style={[styles.tierTitle, { color: theme.text }]}>
                      {tier.title}
                    </ThemedText>
                    <View style={styles.priceRow}>
                      <ThemedText type="h3" style={[styles.tierPrice, { color: theme.link }]}>
                        {tier.price}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                        {" · "}{tier.turnaround}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <ThemedText type="body" style={[styles.tierTagline, { color: theme.tabIconDefault }]}>
                  {tier.tagline}
                </ThemedText>

                <View style={styles.highlightsContainer}>
                  {tier.highlights.map((highlight, idx) => (
                    <View key={idx} style={styles.highlightRow}>
                      <Feather name="check" size={16} color={theme.link} />
                      <ThemedText type="body" style={[styles.highlightText, { color: theme.text }]}>
                        {highlight}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInUp.delay(400)} style={styles.footerSection}>
          <View style={styles.reassuranceRow}>
            <Feather name="shield" size={16} color={theme.tabIconDefault} />
            <ThemedText type="small" style={[styles.reassuranceText, { color: theme.tabIconDefault }]}>
              {footerReassurance}
            </ThemedText>
          </View>

          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
              I'll do it myself
            </ThemedText>
          </Pressable>
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
    paddingTop: Spacing.sm,
  },
  headerSection: {
    marginBottom: Spacing.xl,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  pageSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  tiersContainer: {
    gap: Spacing.lg,
  },
  tierCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    position: "relative",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  recommendedText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  tierIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  tierTitleContainer: {
    flex: 1,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: "700",
  },
  tierTagline: {
    fontSize: 14,
    marginBottom: Spacing.md,
    fontStyle: "italic",
  },
  highlightsContainer: {
    gap: Spacing.sm,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  highlightText: {
    fontSize: 15,
  },
  footerSection: {
    marginTop: 32,
    alignItems: "center",
  },
  reassuranceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reassuranceText: {
    fontStyle: "italic",
  },
  skipButton: {
    paddingVertical: Spacing.md,
  },
});
