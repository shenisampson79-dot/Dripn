/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useMemo, useEffect, useState, useLayoutEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWardrobe, WardrobeItem, ClothingCategory, ClothingColor, ClothingOccasion, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { getSettingsChildScreenOptions } from "@/navigation/screenOptions";
import { useTranslations } from "@/contexts/TranslationContext";

type StyleDNAScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "StyleDNA">;
};

interface StyleScore {
  style: StyleTheme;
  score: number;
  percentage: number;
  traits: string[];
}

interface ColorProfile {
  color: ClothingColor;
  count: number;
  percentage: number;
}

interface OccasionProfile {
  occasion: ClothingOccasion;
  count: number;
  percentage: number;
}

const STYLE_LABELS: Record<StyleTheme, string> = {
  luxury: "Minimalist",
  streetwear: "Casual",
  boho: "Creative",
  sporty: "Active",
  "smart-casual": "Smart Casual",
  business: "Professional",
  edgy: "Trendsetter",
};

const STYLE_DESCRIPTIONS: Record<StyleTheme, string> = {
  luxury: "Refined elegance with premium materials and timeless pieces",
  streetwear: "Urban cool with bold graphics and statement pieces",
  boho: "Free-spirited with natural textures and earthy tones",
  sporty: "Active lifestyle with performance and comfort focus",
  "smart-casual": "Polished yet relaxed for versatile occasions",
  business: "Professional sophistication for the workplace",
  edgy: "Bold and unconventional with dark aesthetics",
};

const STYLE_ICONS: Record<StyleTheme, string> = {
  luxury: "award",
  streetwear: "zap",
  boho: "sun",
  sporty: "activity",
  "smart-casual": "coffee",
  business: "briefcase",
  edgy: "moon",
};

/** Distinct accent colors for Style DNA cards/bars (keeps theme primaries unchanged). */
const STYLE_DNA_COLORS: Record<StyleTheme, { light: string; dark: string }> = {
  luxury: { light: "#C9A87C", dark: "#E0C49A" }, // Minimalist — champagne gold
  "smart-casual": { light: "#5B8FA8", dark: "#7AADC4" }, // Smart Casual — slate teal
  sporty: { light: "#0077B6", dark: "#00A8E8" }, // Active — Capri blue
  streetwear: { light: "#8B2F39", dark: "#C94C5A" }, // Casual — berry maroon
  business: { light: "#1E5B73", dark: "#3D8B9C" }, // Professional — deep teal
  boho: { light: "#C87941", dark: "#E09860" }, // Creative — terracotta
  edgy: { light: "#9B7EBD", dark: "#B08ED0" }, // Trendsetter — Parma violet
};

const COLOR_STYLE_MAP: Record<ClothingColor, StyleTheme[]> = {
  black: ["edgy", "business", "luxury"],
  white: ["smart-casual", "luxury", "sporty"],
  gray: ["business", "smart-casual", "edgy"],
  navy: ["business", "smart-casual", "luxury"],
  brown: ["boho", "luxury", "smart-casual"],
  beige: ["boho", "luxury", "smart-casual"],
  red: ["streetwear", "edgy", "luxury"],
  pink: ["boho", "luxury", "smart-casual"],
  orange: ["boho", "streetwear", "sporty"],
  yellow: ["streetwear", "sporty", "boho"],
  green: ["boho", "sporty", "smart-casual"],
  blue: ["sporty", "smart-casual", "business"],
  purple: ["edgy", "luxury", "boho"],
  multicolor: ["boho", "streetwear", "sporty"],
  denim: ["smart-casual", "streetwear", "sporty"],
  cream: ["luxury", "smart-casual", "boho"],
};

const CATEGORY_STYLE_MAP: Record<ClothingCategory, StyleTheme[]> = {
  tops: ["smart-casual", "streetwear", "boho"],
  bottoms: ["smart-casual", "business", "streetwear"],
  dresses: ["luxury", "boho", "business"],
  outerwear: ["luxury", "edgy", "smart-casual"],
  shoes: ["luxury", "sporty", "streetwear"],
  bags: ["luxury", "business", "boho"],
  accessories: ["luxury", "edgy", "boho"],
  activewear_tops: ["sporty", "streetwear", "smart-casual"],
  activewear_bottoms: ["sporty", "streetwear", "smart-casual"],
  swimwear: ["boho", "sporty", "luxury"],
  sleepwear: ["smart-casual", "boho", "luxury"],
  formal: ["luxury", "business", "smart-casual"],
};

const OCCASION_STYLE_MAP: Record<ClothingOccasion, StyleTheme[]> = {
  casual: ["smart-casual", "boho", "streetwear"],
  work: ["business", "smart-casual", "luxury"],
  formal: ["luxury", "business", "edgy"],
  "date-night": ["luxury", "edgy", "smart-casual"],
  workout: ["sporty", "streetwear", "smart-casual"],
  vacation: ["boho", "sporty", "smart-casual"],
  party: ["edgy", "streetwear", "luxury"],
  everyday: ["smart-casual", "streetwear", "boho"],
};

const SERVER_AXIS_TO_THEME: Record<string, StyleTheme> = {
  streetwear: "streetwear",
  minimal: "luxury",
  smart: "smart-casual",
  luxury: "luxury",
  sporty: "sporty",
  classic: "business",
  edgy: "edgy",
  bohemian: "boho",
};

const SERVER_AXIS_LABELS: Record<string, string> = {
  streetwear: "Streetwear",
  minimal: "Minimal",
  smart: "Smart Casual",
  luxury: "Luxury",
  sporty: "Sporty",
  classic: "Classic",
  edgy: "Edgy",
  bohemian: "Bohemian",
};

export default function StyleDNAScreen({ navigation }: StyleDNAScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { items } = useWardrobe();
  const { user } = useAuth();
  const [serverDna, setServerDna] = useState<Array<{ style: string; percentage: number }>>([]);
  const [serverHeadline, setServerHeadline] = useState<string | null>(null);
  const [engagementCount, setEngagementCount] = useState(0);

  useLayoutEffect(() => {
    navigation.setOptions(
      getSettingsChildScreenOptions({
        theme,
        isDark,
        transparent: false,
        title:
          t('styleDna.title') ||
          t('navTitles.styleDna') ||
          t('profile.styleDna') ||
          'Style DNA',
      }),
    );
  }, [navigation, theme, isDark, t]);

  useEffect(() => {
    if (!user) return;
    apiService.getStyleVector()
      .then((res) => {
        if (res?.styleDna?.length) {
          setServerDna(res.styleDna);
          setServerHeadline(res.headline || null);
          setEngagementCount(res.engagementCount || 0);
        }
      })
      .catch(() => { /* offline / guest */ });
  }, [user]);

  const ownedItems = useMemo(() => {
    return items.filter(item => !item.origin || item.origin === "owned");
  }, [items]);

  const styleAnalysis = useMemo(() => {
    if (ownedItems.length === 0) {
      return null;
    }

    const styleScores: Record<StyleTheme, number> = {
      luxury: 0,
      streetwear: 0,
      boho: 0,
      sporty: 0,
      "smart-casual": 0,
      business: 0,
      edgy: 0,
    };

    for (const item of ownedItems) {
      const colorStyles = COLOR_STYLE_MAP[item.color] || [];
      colorStyles.forEach((style, index) => {
        styleScores[style] += (3 - index) * 1.5;
      });

      const categoryStyles = CATEGORY_STYLE_MAP[item.category] || [];
      categoryStyles.forEach((style, index) => {
        styleScores[style] += (3 - index) * 2;
      });

      for (const occasion of item.occasions) {
        const occasionStyles = OCCASION_STYLE_MAP[occasion] || [];
        occasionStyles.forEach((style, index) => {
          styleScores[style] += (3 - index) * 1;
        });
      }

      if (item.purchasePrice && item.purchasePrice > 200) {
        styleScores.luxury += 3;
      } else if (item.purchasePrice && item.purchasePrice > 100) {
        styleScores.luxury += 1;
      }

      if (item.brand) {
        const brandLower = item.brand.toLowerCase();
        if (["gucci", "prada", "chanel", "louis vuitton", "hermes", "dior"].some(b => brandLower.includes(b))) {
          styleScores.luxury += 5;
        }
        if (["nike", "adidas", "puma", "under armour", "lululemon"].some(b => brandLower.includes(b))) {
          styleScores.sporty += 4;
        }
        if (["supreme", "off-white", "bape", "palace", "stussy"].some(b => brandLower.includes(b))) {
          styleScores.streetwear += 5;
        }
        if (["free people", "anthropologie", "madewell"].some(b => brandLower.includes(b))) {
          styleScores.boho += 4;
        }
      }
    }

    const totalScore = Object.values(styleScores).reduce((a, b) => a + b, 0);
    
    const styleResults: StyleScore[] = (Object.keys(styleScores) as StyleTheme[]).map(style => {
      const score = styleScores[style];
      const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
      
      const traits: string[] = [];
      if (style === "luxury" && percentage > 15) traits.push("Premium taste");
      if (style === "streetwear" && percentage > 15) traits.push("Urban edge");
      if (style === "boho" && percentage > 15) traits.push("Free spirit");
      if (style === "sporty" && percentage > 15) traits.push("Active lifestyle");
      if (style === "smart-casual" && percentage > 15) traits.push("Versatile dresser");
      if (style === "business" && percentage > 15) traits.push("Professional polish");
      if (style === "edgy" && percentage > 15) traits.push("Bold choices");
      
      return { style, score, percentage, traits };
    });

    styleResults.sort((a, b) => b.percentage - a.percentage);

    const colorCounts: Record<ClothingColor, number> = {} as Record<ClothingColor, number>;
    let totalColorObservations = 0;
    for (const item of ownedItems) {
      colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
      totalColorObservations++;
      if (item.secondaryColor) {
        colorCounts[item.secondaryColor] = (colorCounts[item.secondaryColor] || 0) + 1;
        totalColorObservations++;
      }
    }

    const colorProfile: ColorProfile[] = Object.entries(colorCounts)
      .map(([color, count]) => ({
        color: color as ClothingColor,
        count,
        percentage: totalColorObservations > 0 ? (count / totalColorObservations) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const occasionCounts: Record<ClothingOccasion, number> = {} as Record<ClothingOccasion, number>;
    let totalOccasionObservations = 0;
    for (const item of ownedItems) {
      for (const occasion of item.occasions) {
        occasionCounts[occasion] = (occasionCounts[occasion] || 0) + 1;
        totalOccasionObservations++;
      }
    }

    const occasionProfile: OccasionProfile[] = Object.entries(occasionCounts)
      .map(([occasion, count]) => ({
        occasion: occasion as ClothingOccasion,
        count,
        percentage: totalOccasionObservations > 0 ? (count / totalOccasionObservations) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      styles: styleResults,
      primaryStyle: styleResults[0],
      secondaryStyle: styleResults[1],
      colorProfile,
      occasionProfile,
    };
  }, [ownedItems]);

  const getStyleColor = (style: StyleTheme): string => {
    const colors = STYLE_DNA_COLORS[style];
    return isDark ? colors.dark : colors.light;
  };

  const getColorHex = (color: ClothingColor): string => {
    const colorMap: Record<ClothingColor, string> = {
      black: "#1A1A1A",
      white: "#F5F5F5",
      gray: "#808080",
      navy: "#1E3A5F",
      brown: "#8B4513",
      beige: "#D4C4A8",
      red: "#C94C5A",
      pink: "#E8A0BF",
      orange: "#E09860",
      yellow: "#F5D547",
      green: "#4CAF50",
      blue: "#3D8BFF",
      purple: "#9B7EBD",
      denim: "#4A6FA5",
      cream: "#F5F0E6",
      multicolor: "transparent",
    };
    return colorMap[color];
  };

  const formatOccasion = (occasion: ClothingOccasion): string => {
    const labels: Record<ClothingOccasion, string> = {
      casual: "Casual",
      work: "Work",
      formal: "Formal",
      "date-night": "Date Night",
      workout: "Workout",
      vacation: "Vacation",
      party: "Party",
      everyday: "Everyday",
    };
    return labels[occasion];
  };

  return (
    <ScreenScrollView>
      {!styleAnalysis ? (
        <View style={styles.emptyState}>
          <Feather name="git-branch" size={64} color={theme.tabIconDefault} />
          <ThemedText type="h3" style={styles.emptyTitle}>
            {t('styleDna.emptyTitle')}
          </ThemedText>
          <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            {t('styleDna.emptySubtitle')}
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Wardrobe")}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Feather name="plus" size={18} color={theme.buttonText} />
            <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
              {t('styleDna.buildWardrobe')}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          {serverDna.length > 0 && engagementCount > 0 ? (
            <Card style={styles.serverDnaCard}>
              <ThemedText type="caption" style={{ opacity: 0.7 }}>
                {t('styleDna.learnedFromSwipes')}
              </ThemedText>
              <ThemedText type="h3" style={{ marginTop: Spacing.xs }}>
                {serverHeadline || t('styleDna.evolvingHeadline')}
              </ThemedText>
              <View style={styles.serverDnaBars}>
                {serverDna.slice(0, 4).map((entry) => (
                  <View key={entry.style} style={styles.serverDnaRow}>
                    <ThemedText type="small" style={styles.serverDnaLabel}>
                      {SERVER_AXIS_LABELS[entry.style] || entry.style}
                    </ThemedText>
                    <View style={[styles.serverDnaTrack, { backgroundColor: theme.backgroundDefault }]}>
                      <View
                        style={[
                          styles.serverDnaFill,
                          {
                            width: `${Math.min(100, entry.percentage)}%`,
                            backgroundColor: getStyleColor(SERVER_AXIS_TO_THEME[entry.style] || "smart-casual"),
                          },
                        ]}
                      />
                    </View>
                    <ThemedText type="small" style={{ width: 36, textAlign: "right" }}>
                      {entry.percentage}%
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card style={styles.primaryStyleCard}>
            <View style={styles.primaryStyleHeader}>
              <View style={[styles.primaryStyleIcon, { backgroundColor: getStyleColor(styleAnalysis.primaryStyle.style) + "20" }]}>
                <Feather 
                  name={STYLE_ICONS[styleAnalysis.primaryStyle.style] as any} 
                  size={32} 
                  color={getStyleColor(styleAnalysis.primaryStyle.style)} 
                />
              </View>
              <View style={styles.primaryStyleInfo}>
                <ThemedText type="caption" style={{ opacity: 0.7 }}>
                  {t('styleDna.dominantStyle')}
                </ThemedText>
                <ThemedText type="h1" style={{ color: getStyleColor(styleAnalysis.primaryStyle.style) }}>
                  {STYLE_LABELS[styleAnalysis.primaryStyle.style]}
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.8, marginTop: Spacing.xs }}>
                  {t('styleDna.percentOfWardrobe').replace('{percent}', styleAnalysis.primaryStyle.percentage.toFixed(0))}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={styles.primaryStyleDescription}>
              {STYLE_DESCRIPTIONS[styleAnalysis.primaryStyle.style]}
            </ThemedText>
          </Card>

          {styleAnalysis.secondaryStyle && styleAnalysis.secondaryStyle.percentage > 10 ? (
            <Card style={styles.secondaryStyleCard}>
              <View style={styles.secondaryStyleRow}>
                <View style={[styles.secondaryStyleIcon, { backgroundColor: getStyleColor(styleAnalysis.secondaryStyle.style) + "20" }]}>
                  <Feather 
                    name={STYLE_ICONS[styleAnalysis.secondaryStyle.style] as any} 
                    size={20} 
                    color={getStyleColor(styleAnalysis.secondaryStyle.style)} 
                  />
                </View>
                <View style={styles.secondaryStyleInfo}>
                  <ThemedText type="caption" style={{ opacity: 0.7 }}>
                    {t('styleDna.secondaryStyle')}
                  </ThemedText>
                  <ThemedText type="h3">
                    {STYLE_LABELS[styleAnalysis.secondaryStyle.style]}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {styleAnalysis.secondaryStyle.percentage.toFixed(0)}%
                </ThemedText>
              </View>
            </Card>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={18} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                {t('styleDna.styleBreakdown')}
              </ThemedText>
            </View>
            {styleAnalysis.styles.slice(0, 5).map((styleScore) => (
              <View key={styleScore.style} style={styles.styleRow}>
                <View style={[styles.styleIconSmall, { backgroundColor: getStyleColor(styleScore.style) + "20" }]}>
                  <Feather 
                    name={STYLE_ICONS[styleScore.style] as any} 
                    size={14} 
                    color={getStyleColor(styleScore.style)} 
                  />
                </View>
                <View style={styles.styleBarContainer}>
                  <View style={styles.styleBarHeader}>
                    <ThemedText type="small" style={{ fontWeight: "500" }}>
                      {STYLE_LABELS[styleScore.style]}
                    </ThemedText>
                    <ThemedText type="caption" style={{ opacity: 0.7 }}>
                      {styleScore.percentage.toFixed(0)}%
                    </ThemedText>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          backgroundColor: getStyleColor(styleScore.style), 
                          width: `${Math.min(styleScore.percentage, 100)}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="droplet" size={18} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                {t('styleDna.colorPalette')}
              </ThemedText>
            </View>
            <Card style={styles.colorCard}>
              <View style={styles.colorGrid}>
                {styleAnalysis.colorProfile.slice(0, 8).map((colorData) => (
                  <View key={colorData.color} style={styles.colorItem}>
                    <View 
                      style={[
                        styles.colorSwatch,
                        { 
                          backgroundColor: getColorHex(colorData.color),
                          borderWidth: colorData.color === "white" || colorData.color === "multicolor" ? 1 : 0,
                          borderColor: theme.tabIconDefault,
                        },
                        colorData.color === "multicolor" && styles.multicolorSwatch,
                      ]}
                    >
                      {colorData.color === "multicolor" ? (
                        <Feather name="layers" size={16} color={theme.text} />
                      ) : null}
                    </View>
                    <ThemedText type="caption" style={styles.colorLabel}>
                      {colorData.color.charAt(0).toUpperCase() + colorData.color.slice(1)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ opacity: 0.6 }}>
                      {colorData.count} items
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="calendar" size={18} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Occasion Focus
              </ThemedText>
            </View>
            <View style={styles.occasionGrid}>
              {styleAnalysis.occasionProfile.slice(0, 4).map((occasionData) => (
                <Card key={occasionData.occasion} style={styles.occasionCard}>
                  <ThemedText type="h2" style={{ color: theme.link }}>
                    {occasionData.count}
                  </ThemedText>
                  <ThemedText type="small" style={{ opacity: 0.8, textAlign: "center" }}>
                    {formatOccasion(occasionData.occasion)}
                  </ThemedText>
                </Card>
              ))}
            </View>
          </View>

          <Card style={styles.insightsCard}>
            <View style={styles.insightsHeader}>
              <Feather name="info" size={18} color={theme.info} />
              <ThemedText type="h3">Style Insights</ThemedText>
            </View>
            <View style={styles.insightsList}>
              <View style={styles.insightItem}>
                <Feather name="check" size={14} color={theme.success} />
                <ThemedText type="small" style={styles.insightText}>
                  Your wardrobe is {styleAnalysis.primaryStyle.percentage > 40 ? "highly focused" : "well-balanced"} around {STYLE_LABELS[styleAnalysis.primaryStyle.style].toLowerCase()} aesthetics
                </ThemedText>
              </View>
              {styleAnalysis.colorProfile[0] ? (
                <View style={styles.insightItem}>
                  <Feather name="check" size={14} color={theme.success} />
                  <ThemedText type="small" style={styles.insightText}>
                    {styleAnalysis.colorProfile[0].color.charAt(0).toUpperCase() + styleAnalysis.colorProfile[0].color.slice(1)} is your signature color appearing in {styleAnalysis.colorProfile[0].percentage.toFixed(0)}% of items
                  </ThemedText>
                </View>
              ) : null}
              {styleAnalysis.occasionProfile[0] ? (
                <View style={styles.insightItem}>
                  <Feather name="check" size={14} color={theme.success} />
                  <ThemedText type="small" style={styles.insightText}>
                    You dress most often for {formatOccasion(styleAnalysis.occasionProfile[0].occasion).toLowerCase()} occasions
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </Card>

          <View style={styles.itemCount}>
            <ThemedText type="caption" style={{ opacity: 0.6, textAlign: "center" }}>
              Analysis based on {ownedItems.length} wardrobe item{ownedItems.length !== 1 ? "s" : ""}
            </ThemedText>
          </View>
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  primaryStyleCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  primaryStyleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  primaryStyleIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryStyleInfo: {
    flex: 1,
  },
  primaryStyleDescription: {
    opacity: 0.8,
    lineHeight: 22,
  },
  secondaryStyleCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  secondaryStyleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  secondaryStyleIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryStyleInfo: {
    flex: 1,
  },
  serverDnaCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  serverDnaBars: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  serverDnaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  serverDnaLabel: {
    width: 88,
  },
  serverDnaTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  serverDnaFill: {
    height: "100%",
    borderRadius: 4,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
  },
  styleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  styleIconSmall: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  styleBarContainer: {
    flex: 1,
  },
  styleBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  colorCard: {
    padding: Spacing.lg,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    justifyContent: "center",
  },
  colorItem: {
    alignItems: "center",
    width: 70,
    gap: Spacing.xs,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  multicolorSwatch: {
    backgroundColor: "transparent",
  },
  colorLabel: {
    textAlign: "center",
  },
  occasionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  occasionCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  insightsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  insightsList: {
    gap: Spacing.md,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  insightText: {
    flex: 1,
    lineHeight: 20,
  },
  itemCount: {
    marginBottom: Spacing.xl,
  },
});
