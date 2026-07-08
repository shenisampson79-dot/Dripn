import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
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
    id: "core",
    title: "Full Wardrobe Setup",
    tagline: "Build a system that generates unlimited outfits (keep forever).",
    price: "£39.99",
    turnaround: "Ready in 24-48h",
    highlights: [
      "Organize up to 30 individual items",
      "Generate unlimited outfit combinations",
      "Your wardrobe saved forever",
    ],
  },
  {
    id: "outfit",
    title: "Occasion Ready",
    tagline: "Ready-to-wear looks for a trip or event (14 days).",
    price: "£19.99",
    turnaround: "Ready in 24h",
    highlights: [
      "Upload 5-7 outfits you wear",
      "Ready to wear immediately",
      "14-day access window",
    ],
  },
];

export default function StyleMeProperlyScreen({ navigation }: StyleMeProperlyScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [pageHeader, setPageHeader] = useState({ 
    title: "Want me to do this for you?", 
    subtitle: "I'll set things up so your stylist works properly." 
  });
  const [tiers, setTiers] = useState<DfyTier[]>(DEFAULT_TIERS);
  const [footerReassurance, setFooterReassurance] = useState("One-time setup · No subscription required");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    loadSetupOptions();
  }, []);

  const loadSetupOptions = async () => {
    try {
      const [pageConfigData, setupOptionsData] = await Promise.all([
        apiService.get<{ title: string; subtitle: string; footer: string }>("/api/onboarding/dfy-page-config"),
        apiService.get<SetupOptionsResponse>("/api/onboarding/setup-options"),
      ]);
      
      if (pageConfigData) {
        setPageHeader({ title: pageConfigData.title, subtitle: pageConfigData.subtitle });
        if (pageConfigData.footer) {
          setFooterReassurance(pageConfigData.footer);
        }
      }
      
      if (setupOptionsData?.tiers && setupOptionsData.tiers.length > 0) {
        setTiers(setupOptionsData.tiers);
      }
    } catch (error: unknown) {
      console.log("Using default DFY options");
    }
  };

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
  };

  const handleContinue = async () => {
    if (!selectedTier) return;
    
    try {
      await apiService.post("/api/onboarding/select-setup", { setup: selectedTier });
    } catch (error: unknown) {
      console.log("Failed to track setup selection");
    }

    navigation.navigate("UploadInstructions", { type: selectedTier as "outfit" | "core" });
  };

  const handleSkip = () => {
    navigation.navigate("Auth", { mode: 'signup' });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          ScreenGradients.styleMeProperly.primary[0],
          ScreenGradients.styleMeProperly.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.headerSection}>
          <ThemedText type="h2" style={[styles.pageTitle, { color: '#FFFFFF' }]}>
            {pageHeader.title}
          </ThemedText>
          <ThemedText type="body" style={[styles.pageSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
            {pageHeader.subtitle}
          </ThemedText>
        </Animated.View>

        <View style={styles.tiersContainer}>
          {tiers.map((tier, index) => {
            const isSelected = selectedTier === tier.id;
            return (
            <Animated.View 
              key={tier.id}
              entering={FadeInUp.delay(100 + index * 150)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.tierCard,
                  { 
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                    borderColor: isSelected ? LuxuryColors.gold : (index === 0 ? LuxuryColors.gold : 'rgba(255,255,255,0.2)'),
                    borderWidth: isSelected ? 3 : (index === 0 ? 2 : 1),
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: isSelected ? LuxuryColors.gold : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isSelected ? 0.6 : 0,
                    shadowRadius: isSelected ? 12 : 0,
                    elevation: isSelected ? 8 : 0,
                  }
                ]}
                onPress={() => handleTierSelect(tier.id)}
              >
                {index === 0 ? (
                  <View style={[styles.recommendedBadge, { backgroundColor: LuxuryColors.gold }]}>
                    <Feather name="zap" size={12} color="#FFFFFF" />
                    <ThemedText type="small" style={styles.recommendedText}>Fastest</ThemedText>
                  </View>
                ) : null}

                <View style={styles.tierHeader}>
                  <View style={[styles.tierIcon, { backgroundColor: index === 0 ? LuxuryColors.gold : 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: index === 0 ? 0 : 1 }]}>
                    <Feather 
                      name={index === 0 ? "camera" : "grid"} 
                      size={20} 
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.tierTitleContainer}>
                    <ThemedText type="h3" style={[styles.tierTitle, { color: '#FFFFFF' }]}>
                      {tier.title}
                    </ThemedText>
                    <View style={styles.priceRow}>
                      <ThemedText type="h3" style={[styles.tierPrice, { color: LuxuryColors.gold }]}>
                        {tier.price}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {" · "}{tier.turnaround}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <ThemedText type="body" style={[styles.tierTagline, { color: 'rgba(255,255,255,0.8)' }]}>
                  {tier.tagline}
                </ThemedText>

                <View style={styles.highlightsContainer}>
                  {tier.highlights.map((highlight, idx) => (
                    <View key={idx} style={styles.highlightRow}>
                      <Feather name="check" size={16} color={LuxuryColors.gold} />
                      <ThemedText type="body" style={[styles.highlightText, { color: '#FFFFFF' }]}>
                        {highlight}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {isSelected ? (
                  <View style={styles.selectedIndicator}>
                    <Feather name="check-circle" size={20} color={LuxuryColors.gold} />
                    <ThemedText type="small" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
                      Selected
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
          })}
        </View>

        {selectedTier ? (
          <Animated.View entering={FadeInUp.delay(100)} style={styles.continueContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.continueButton,
                { 
                  backgroundColor: LuxuryColors.gold,
                  opacity: pressed ? 0.9 : 1,
                }
              ]}
              onPress={handleContinue}
            >
              <ThemedText type="body" style={styles.continueButtonText}>
                Continue
              </ThemedText>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.delay(400)} style={styles.footerSection}>
          <View style={styles.reassuranceRow}>
            <Feather name="shield" size={16} color="rgba(255,255,255,0.6)" />
            <ThemedText type="small" style={[styles.reassuranceText, { color: 'rgba(255,255,255,0.6)' }]}>
              {footerReassurance}
            </ThemedText>
          </View>

          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <ThemedText type="body" style={{ color: 'rgba(255,255,255,0.7)' }}>
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
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
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
    borderRadius: 20,
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
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  continueContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
