import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { UploadGuideComparisonTable } from "@/components/UploadGuideComparisonTable";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import {
  ACCESSORY_UPLOAD_COMPARISONS,
  getClothingUploadComparisons,
  OUTFIT_UPLOAD_COMPARISONS,
} from "@/constants/uploadGuideExamples";
import { useAuth } from "@/contexts/AuthContext";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTranslations } from "@/contexts/TranslationContext";

type UploadInstructionsScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "UploadInstructions">;
  route: RouteProp<AuthStackParamList, "UploadInstructions">;
};

interface UploadInstructions {
  title: string;
  subtitle: string;
  tips: string[];
  accessoryTips: string[];
  limits: {
    maxItems: number;
    formats: string[];
    maxSize: string;
  };
  examples: {
    good: string[];
    avoid: string[];
  };
}

const DEFAULT_INSTRUCTIONS: Record<string, UploadInstructions> = {
  outfit: {
    title: "Upload your favourite outfits",
    subtitle: "Show me 5-7 complete looks you love wearing",
    tips: [
      "Full-length photos work best",
      "Include different occasions",
      "Natural lighting helps",
      "Show front view clearly",
    ],
    accessoryTips: [
      "Bags: Lay flat or stand upright, show front and strap",
      "Belts: Lay straight or coiled, show buckle clearly",
      "Sunglasses: Flat on surface, show both lenses",
      "Watches: Face up on flat surface, show dial",
      "Jewelry: Close-up on plain background",
    ],
    limits: {
      maxItems: 7,
      formats: ["JPG", "PNG", "HEIC"],
      maxSize: "10MB per photo",
    },
    examples: {
      good: ["Full outfit in mirror", "Flat lay on bed", "Wearing the outfit"],
      avoid: ["Cropped photos", "Dark/blurry images", "Just accessories"],
    },
  },
  core: {
    title: "Upload your wardrobe items",
    subtitle: "Show me up to 30 of your favourite pieces",
    tips: [
      "One item per photo",
      "Lay flat or hang clearly",
      "Good lighting essential",
      "Include variety of items",
    ],
    accessoryTips: [
      "Bags: Lay flat or stand upright, show front and strap",
      "Belts: Lay straight or coiled, show buckle clearly",
      "Sunglasses: Flat on surface, show both lenses",
      "Watches: Face up on flat surface, show dial",
      "Jewelry: Close-up on plain background",
      "Scarves: Lay flat to show full pattern",
      "Hats: Show front view on flat surface",
    ],
    limits: {
      maxItems: 30,
      formats: ["JPG", "PNG", "HEIC"],
      maxSize: "10MB per photo",
    },
    examples: {
      good: ["Item laid flat", "On hanger against plain wall", "Clear close-up"],
      avoid: ["Multiple items together", "Wrinkled clothes", "Items in pile"],
    },
  },
};

export default function UploadInstructionsScreen({ navigation, route }: UploadInstructionsScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const clothingComparisons = useMemo(
    () => getClothingUploadComparisons(user?.gender),
    [user?.gender],
  );
  const uploadType = route.params?.type || "outfit";
  const defaultInstructions = DEFAULT_INSTRUCTIONS[uploadType] || DEFAULT_INSTRUCTIONS.outfit;
  const [instructions, setInstructions] = useState<UploadInstructions>(defaultInstructions);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInstructions();
  }, [uploadType]);

  const loadInstructions = async () => {
    try {
      const data = await apiService.get<UploadInstructions>(`/api/onboarding/upload-instructions/${uploadType}`);
      if (data) {
        const mergedData: UploadInstructions = {
          title: data.title || defaultInstructions.title,
          subtitle: data.subtitle || defaultInstructions.subtitle,
          tips: data.tips || defaultInstructions.tips,
          accessoryTips: data.accessoryTips || defaultInstructions.accessoryTips,
          limits: {
            maxItems: data.limits?.maxItems || defaultInstructions.limits.maxItems,
            formats: data.limits?.formats || defaultInstructions.limits.formats,
            maxSize: data.limits?.maxSize || defaultInstructions.limits.maxSize,
          },
          examples: {
            good: data.examples?.good || defaultInstructions.examples.good,
            avoid: data.examples?.avoid || defaultInstructions.examples.avoid,
          },
        };
        setInstructions(mergedData);
      }
    } catch (error) {
      console.log("Using default upload instructions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartUpload = () => {
    navigation.navigate("DFYUpload", { type: uploadType });
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.link} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text }}>Upload Guide</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScreenScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.titleSection}>
          <View style={[styles.iconCircle, { backgroundColor: theme.link }]}>
            <Feather name="camera" size={28} color="#FFFFFF" />
          </View>
          <ThemedText type="h2" style={[styles.title, { color: theme.text }]}>
            {instructions.title}
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            {instructions.subtitle}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
          <ThemedText type="h3" style={[styles.sectionTitle, { color: theme.text }]}>
            Tips for great photos
          </ThemedText>
          <View style={[styles.tipsCard, { backgroundColor: theme.backgroundSecondary }]}>
            {instructions.tips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <Feather name="check-circle" size={18} color={theme.link} />
                <ThemedText type="body" style={[styles.tipText, { color: theme.text }]}>
                  {tip}
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150)} style={styles.section}>
          <ThemedText type="h3" style={[styles.sectionTitle, { color: theme.text }]}>
            Accessories
          </ThemedText>
          <View style={[styles.tipsCard, { backgroundColor: theme.backgroundSecondary }]}>
            {instructions.accessoryTips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <Feather name="info" size={18} color={theme.tabIconDefault} />
                <ThemedText type="body" style={[styles.tipText, { color: theme.text }]}>
                  {tip}
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
          <ThemedText type="h3" style={[styles.sectionTitle, { color: theme.text }]}>
            Limits
          </ThemedText>
          <View style={[styles.limitsCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.limitRow}>
              <Feather name="image" size={18} color={theme.tabIconDefault} />
              <ThemedText type="body" style={{ color: theme.text }}>
                Up to {instructions.limits.maxItems} items
              </ThemedText>
            </View>
            <View style={styles.limitRow}>
              <Feather name="file" size={18} color={theme.tabIconDefault} />
              <ThemedText type="body" style={{ color: theme.text }}>
                {instructions.limits.formats.join(", ")} formats
              </ThemedText>
            </View>
            <View style={styles.limitRow}>
              <Feather name="hard-drive" size={18} color={theme.tabIconDefault} />
              <ThemedText type="body" style={{ color: theme.text }}>
                {instructions.limits.maxSize}
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(250)}>
          {uploadType === 'outfit' ? (
            <UploadGuideComparisonTable title={t('common.outfitPhotos') || "Outfit photos"} rows={OUTFIT_UPLOAD_COMPARISONS} />
          ) : (
            <>
              <UploadGuideComparisonTable title={t('common.clothing') || "Clothing"} rows={clothingComparisons} />
              <UploadGuideComparisonTable title={t('common.accessories') || "Accessories"} rows={ACCESSORY_UPLOAD_COMPARISONS} />
            </>
          )}
        </Animated.View>
      </ScreenScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundDefault }]}>
        <Button onPress={handleStartUpload} style={[styles.uploadButton, { backgroundColor: theme.link }]}>
          I'm ready to upload
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  titleSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  tipsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
  },
  limitsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  uploadButton: {
    width: "100%",
  },
});
