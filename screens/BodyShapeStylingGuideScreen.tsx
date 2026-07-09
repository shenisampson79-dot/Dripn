/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Body Shape Styling Guide Screen - Personalized styling tips based on body shape
 */

import React from "react";
import { 
  StyleSheet, 
  View, 
  Pressable, 
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useBodyProfile, BodyShape } from "@/contexts/BodyProfileContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type BodyShapeStylingGuideScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "BodyShapeStylingGuide">;
};

const BODY_SHAPE_ICONS: Record<BodyShape, keyof typeof Feather.glyphMap> = {
  hourglass: "target",
  pear: "triangle",
  apple: "circle",
  rectangle: "square",
  "inverted-triangle": "chevrons-up",
  athletic: "activity",
  petite: "minimize-2",
  "plus-size": "maximize-2",
  tall: "arrow-up",
  unknown: "help-circle",
};

const BODY_SHAPE_DESCRIPTIONS: Record<BodyShape, string> = {
  hourglass: "Balanced shoulders and hips with a beautifully defined waist",
  pear: "Elegant curves with hips wider than shoulders",
  apple: "Fuller midsection with gorgeous slimmer legs",
  rectangle: "Wonderfully balanced proportions throughout",
  "inverted-triangle": "Strong shoulders tapering to slimmer hips",
  athletic: "Toned and muscular with strong definition",
  petite: "Perfectly proportioned smaller frame",
  "plus-size": "Beautiful full figure with gorgeous curves",
  tall: "Elongated frame with enviable long lines",
  unknown: "Complete a body scan to discover your shape",
};

export default function BodyShapeStylingGuideScreen({ navigation }: BodyShapeStylingGuideScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { 
    bodyProfile, 
    generateStylingGuide, 
    isGeneratingStylingGuide, 
    hasStylingGuide,
    hasBodyProfile 
  } = useBodyProfile();

  const secondaryTextColor = isDark ? "#B0B0B0" : "#666666";

  const handleGenerateGuide = async () => {
    if (!hasBodyProfile) {
      Alert.alert(t('common.bodyScanRequired') || "Body Scan Required", t('common.pleaseCompleteABodyScanFirstToGetPersona') || "Please complete a body scan first to get personalized styling recommendations.",
        [
          { text: t('common.cancel'), style: "cancel" },
          { text: "Go to Scanner", onPress: () => navigation.navigate("BodyScanner") },
        ]
      );
      return;
    }

    const result = await generateStylingGuide();
    if (result.success) {
      Alert.alert(t('common.success') || "Success", t('common.yourPersonalizedStylingGuideHasBeenGener') || "Your personalized styling guide has been generated!");
    }
  };

  const renderStyleList = (items: string[], icon: keyof typeof Feather.glyphMap, iconColor: string) => (
    <View style={styles.styleList}>
      {items.map((item, index) => (
        <View key={index} style={styles.styleItem}>
          <Feather name={icon} size={16} color={iconColor} />
          <ThemedText type="body" style={styles.styleText}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );

  if (isGeneratingStylingGuide) {
    return (
      <ScreenScrollView>
        <Card elevation={1} style={styles.loadingCard}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="h3" style={styles.loadingTitle}>
            Creating Your Style Guide
          </ThemedText>
          <ThemedText type="body" style={[styles.loadingText, { color: secondaryTextColor }]}>
            Our AI stylist is crafting personalized recommendations based on your unique body shape and proportions...
          </ThemedText>
        </Card>
      </ScreenScrollView>
    );
  }

  const stylingGuide = bodyProfile?.stylingGuide;
  const bodyShape = bodyProfile?.bodyShape || "unknown";
  const shapeIcon = BODY_SHAPE_ICONS[bodyShape];
  const shapeDescription = BODY_SHAPE_DESCRIPTIONS[bodyShape];

  return (
    <ScreenScrollView>
      <ThemedText type="h2" style={styles.title}>
        Body Shape Styling Guide
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: secondaryTextColor }]}>
        Personalized fashion advice tailored to your unique body
      </ThemedText>

      {hasBodyProfile ? (
        <Card elevation={2} style={styles.shapeCard}>
          <View style={styles.shapeHeader}>
            <View style={[styles.shapeIcon, { backgroundColor: theme.link + "20" }]}>
              <Feather name={shapeIcon} size={32} color={theme.link} />
            </View>
            <View style={styles.shapeInfo}>
              <ThemedText type="h3">
                {bodyShape.charAt(0).toUpperCase() + bodyShape.slice(1).replace('-', ' ')} Shape
              </ThemedText>
              <ThemedText type="body" style={{ color: secondaryTextColor }}>
                {bodyProfile?.buildCategory} build, {bodyProfile?.heightCategory} height
              </ThemedText>
            </View>
          </View>
          <ThemedText type="body" style={{ color: secondaryTextColor }}>
            {shapeDescription}
          </ThemedText>
        </Card>
      ) : null}

      {hasStylingGuide && stylingGuide ? (
        <>
          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="layers" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Best Silhouettes
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.bestSilhouettes, "check", theme.success)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="heart" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Ideal Necklines
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.idealNecklines, "check", theme.success)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="git-commit" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Recommended Pants
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.recommendedPants, "check", theme.success)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="wind" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Skirt Styles
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.skirtStyles, "check", theme.success)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="star" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Dress Styles
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.dressStyles, "check", theme.success)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="x-circle" size={20} color={theme.error} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Styles to Approach with Care
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.avoidStyles, "alert-circle", theme.warning)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="zap" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Proportion Tips
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.proportionTips, "info", theme.link)}
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="gift" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Accessory Tips
              </ThemedText>
            </View>
            {renderStyleList(stylingGuide.accessoryTips, "star", theme.link)}
          </Card>

          <Pressable onPress={handleGenerateGuide}>
            <LinearGradient
              colors={[theme.link, theme.link]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.regenerateButton}
            >
              <Feather name="refresh-cw" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.buttonText}>
                Regenerate Guide
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </>
      ) : (
        <Card elevation={1} style={styles.startCard}>
          <View style={[styles.iconContainer, { backgroundColor: theme.link + "20" }]}>
            <Feather name="book-open" size={48} color={theme.link} />
          </View>
          <ThemedText type="h3" style={styles.startTitle}>
            Get Your Personalized Style Guide
          </ThemedText>
          <ThemedText type="body" style={[styles.startText, { color: secondaryTextColor }]}>
            {hasBodyProfile 
              ? "Generate AI-powered styling recommendations tailored specifically to your body shape, proportions, and preferences."
              : "Complete a body scan first to unlock personalized styling recommendations."}
          </ThemedText>

          {hasBodyProfile ? (
            <View style={styles.previewSection}>
              <ThemedText type="body" style={[styles.previewTitle, { fontWeight: "600" }]}>
                You will receive advice on:
              </ThemedText>
              <View style={styles.previewList}>
                <View style={styles.previewItem}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: secondaryTextColor }}>Best silhouettes for your shape</ThemedText>
                </View>
                <View style={styles.previewItem}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: secondaryTextColor }}>Ideal necklines and cuts</ThemedText>
                </View>
                <View style={styles.previewItem}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: secondaryTextColor }}>Pants, skirts, and dress styles</ThemedText>
                </View>
                <View style={styles.previewItem}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: secondaryTextColor }}>Proportion balancing tips</ThemedText>
                </View>
                <View style={styles.previewItem}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: secondaryTextColor }}>Accessory recommendations</ThemedText>
                </View>
              </View>
            </View>
          ) : null}

          <Pressable onPress={hasBodyProfile ? handleGenerateGuide : () => navigation.navigate("BodyScanner")}>
            <LinearGradient
              colors={[theme.link, theme.link]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButton}
            >
              <Feather name={hasBodyProfile ? "zap" : "camera"} size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.buttonText}>
                {hasBodyProfile ? "Generate My Style Guide" : "Start Body Scan"}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </Card>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xl,
  },
  loadingCard: {
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingVertical: Spacing["3xl"],
  },
  loadingTitle: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  loadingText: {
    textAlign: "center",
  },
  shapeCard: {
    marginBottom: Spacing.lg,
  },
  shapeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  shapeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  shapeInfo: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
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
  styleList: {
    gap: Spacing.sm,
  },
  styleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  styleText: {
    flex: 1,
    lineHeight: 22,
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  startCard: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  startTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  startText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  previewSection: {
    alignSelf: "stretch",
    marginBottom: Spacing.xl,
  },
  previewTitle: {
    marginBottom: Spacing.md,
  },
  previewList: {
    gap: Spacing.sm,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.full,
    width: "100%",
  },
});
