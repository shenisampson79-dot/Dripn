/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Color Analysis Screen - AI-powered seasonal color analysis from selfie
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  StyleSheet, 
  View, 
  Pressable, 
  ActivityIndicator, 
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useBodyProfile, ColorSeason, SkinToneData } from "@/contexts/BodyProfileContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { getRecommendedShades, FoundationBrand, FoundationMatch } from "@/services/FoundationMatchingService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ColorAnalysisScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "ColorAnalysis">;
};

const SEASON_INFO: Record<ColorSeason, { icon: keyof typeof Feather.glyphMap; colors: string[]; description: string }> = {
  spring: { 
    icon: "sun", 
    colors: ["#FFB347", "#FF6B6B", "#98D8C8", "#F7DC6F"],
    description: "Warm, clear, and bright. Your colors are fresh and lively like a spring garden." 
  },
  summer: { 
    icon: "cloud", 
    colors: ["#AED6F1", "#D7BDE2", "#FAD7A0", "#A9CCE3"],
    description: "Cool, soft, and muted. Your colors are gentle and sophisticated like a summer haze." 
  },
  autumn: { 
    icon: "cloud-drizzle", 
    colors: ["#D35400", "#A04000", "#7B241C", "#6E2C00"],
    description: "Warm, rich, and earthy. Your colors are deep and golden like autumn leaves." 
  },
  winter: { 
    icon: "cloud-snow", 
    colors: ["#2E4053", "#1A5276", "#7B241C", "#FDFEFE"],
    description: "Cool, clear, and bold. Your colors are high-contrast and dramatic like a winter landscape." 
  },
};

export default function ColorAnalysisScreen({ navigation }: ColorAnalysisScreenProps) {
  const { theme, isDark } = useTheme();
  const { bodyProfile, analyzeColorSeason, isAnalyzingColor, hasColorAnalysis, hasSkinToneAnalysis } = useBodyProfile();
  const insets = useSafeAreaInsets();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState<CameraType>("front");
  const [countdown, setCountdown] = useState<number | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [selectedBrand, setSelectedBrand] = useState<FoundationBrand | 'all'>('all');

  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      capturePhoto();
      setCountdown(null);
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown]);

  const startCountdown = () => {
    setCountdown(3);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert("Error", "Camera not ready. Please try again.");
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo?.base64) {
        setShowCamera(false);
        await analyzeFromBase64(photo.base64);
      } else if (photo?.uri) {
        setShowCamera(false);
        await processImage(photo.uri);
      } else {
        Alert.alert("Error", "Failed to capture photo. Please try again.");
      }
    } catch (err) {
      console.error("Failed to capture photo:", err);
      Alert.alert("Error", "Failed to capture photo. Please try again or upload an image instead.");
    }
  };

  const analyzeFromBase64 = async (base64Data: string) => {
    try {
      const result = await analyzeColorSeason(base64Data);

      if (result.success) {
        Alert.alert(
          "Analysis Complete",
          `You are a ${result.colorSeason.season.toUpperCase()} ${result.colorSeason.subtype || ''} with ${result.colorSeason.confidence}% confidence!`,
          [{ text: "View Results", style: "default" }]
        );
      } else {
        Alert.alert(
          "Analysis Issue",
          "We couldn't fully analyze the image. Please try again with a clear, well-lit selfie showing your face, natural hair, and skin.",
          [{ text: "Try Again", style: "default" }]
        );
      }
    } catch (err) {
      console.error("Failed to analyze image:", err);
      Alert.alert("Error", "Failed to analyze image. Please try again.");
    }
  };

  const foundationMatches = hasSkinToneAnalysis && bodyProfile?.skinTone 
    ? getRecommendedShades(
        bodyProfile.skinTone, 
        6, 
        selectedBrand === 'all' ? undefined : selectedBrand
      )
    : [];

  const secondaryTextColor = isDark ? "#B0B0B0" : "#666666";
  const tertiaryTextColor = isDark ? "#808080" : "#999999";


  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error("Failed to pick image:", err);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  const processImage = async (uri: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const result = await analyzeColorSeason(base64);

      if (result.success) {
        Alert.alert(
          "Analysis Complete",
          `You are a ${result.colorSeason.season.toUpperCase()} ${result.colorSeason.subtype || ''} with ${result.colorSeason.confidence}% confidence!`,
          [{ text: "View Results", style: "default" }]
        );
      } else {
        Alert.alert(
          "Analysis Issue",
          "We couldn't fully analyze the image. Please try again with a clear, well-lit selfie showing your face, natural hair, and skin.",
          [{ text: "Try Again", style: "default" }]
        );
      }
    } catch (err) {
      console.error("Failed to process image:", err);
      Alert.alert("Error", "Failed to analyze image. Please try again.");
    }
  };

  const renderColorSwatch = (color: string, index: number) => (
    <View 
      key={index}
      style={[styles.colorSwatch, { backgroundColor: color }]} 
    />
  );

  if (showCamera) {
    if (!permission) {
      return (
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </ThemedView>
      );
    }

    if (!permission.granted) {
      if (permission.status === "denied" && !permission.canAskAgain) {
        return (
          <ScreenScrollView>
            <Card elevation={1} style={styles.permissionCard}>
              <Feather name="camera-off" size={48} color={secondaryTextColor} />
              <ThemedText type="h3" style={styles.permissionTitle}>
                Camera Permission Required
              </ThemedText>
              <ThemedText type="body" style={[styles.permissionText, { color: secondaryTextColor }]}>
                To analyze your colors, we need access to your camera. Please enable it in Settings.
              </ThemedText>
              {Platform.OS !== "web" ? (
                <Pressable
                  onPress={async () => {
                    try {
                      await Linking.openSettings();
                    } catch (error) {
                      console.error("Could not open settings:", error);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.settingsButton,
                    { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Open Settings
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setShowCamera(false)} style={styles.backButton}>
                <ThemedText type="body" style={{ color: secondaryTextColor }}>Go Back</ThemedText>
              </Pressable>
            </Card>
          </ScreenScrollView>
        );
      }

      return (
        <ScreenScrollView>
          <Card elevation={1} style={styles.permissionCard}>
            <Feather name="camera" size={48} color={theme.link} />
            <ThemedText type="h3" style={styles.permissionTitle}>
              Enable Camera
            </ThemedText>
            <ThemedText type="body" style={[styles.permissionText, { color: secondaryTextColor }]}>
              Take a selfie to discover your seasonal color palette
            </ThemedText>
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                styles.settingsButton,
                { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Enable Camera
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowCamera(false)} style={styles.backButton}>
              <ThemedText type="body" style={{ color: secondaryTextColor }}>Go Back</ThemedText>
            </Pressable>
          </Card>
        </ScreenScrollView>
      );
    }

    return (
      <View style={[styles.cameraContainer, { paddingTop: insets.top }]}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.faceGuide}>
              <View style={[styles.faceGuideCircle, { borderColor: theme.link }]} />
              <ThemedText type="caption" style={styles.guideText}>
                Position your face in the circle
              </ThemedText>
            </View>
          </View>
          <View style={[styles.cameraControls, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <Pressable
              onPress={() => setShowCamera(false)}
              style={[styles.cameraButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={startCountdown}
              style={[styles.captureButton, { borderColor: theme.link }]}
              disabled={countdown !== null}
            >
              {countdown !== null ? (
                <ThemedText type="h1" style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' }}>
                  {countdown}
                </ThemedText>
              ) : (
                <View style={[styles.captureButtonInner, { backgroundColor: theme.link }]} />
              )}
            </Pressable>
            <Pressable
              onPress={() => setFacing(facing === "front" ? "back" : "front")}
              style={[styles.cameraButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="refresh-cw" size={24} color={theme.text} />
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  }

  if (isAnalyzingColor) {
    return (
      <ScreenScrollView>
        <Card elevation={1} style={styles.loadingCard}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="h3" style={styles.loadingTitle}>
            Analyzing Your Colors
          </ThemedText>
          <ThemedText type="body" style={[styles.loadingText, { color: secondaryTextColor }]}>
            Our AI is examining your skin undertone, eye color, and hair to determine your perfect color palette...
          </ThemedText>
        </Card>
      </ScreenScrollView>
    );
  }

  const colorSeason = bodyProfile?.colorSeason;
  const seasonInfo = colorSeason ? SEASON_INFO[colorSeason.season] : null;

  return (
    <ScreenScrollView>
      <ThemedText type="h2" style={styles.title}>
        Seasonal Color Analysis
      </ThemedText>
      <ThemedText type="body" style={[styles.subtitle, { color: secondaryTextColor }]}>
        Discover the colors that make you shine based on your natural coloring
      </ThemedText>

      {hasColorAnalysis && colorSeason && seasonInfo ? (
        <>
          <Card elevation={2} style={styles.resultCard}>
            <View style={styles.seasonHeader}>
              <View style={[styles.seasonIcon, { backgroundColor: theme.link + "20" }]}>
                <Feather name={seasonInfo.icon} size={32} color={theme.link} />
              </View>
              <View style={styles.seasonInfo}>
                <ThemedText type="h2" style={styles.seasonName}>
                  {colorSeason.season.charAt(0).toUpperCase() + colorSeason.season.slice(1)}
                </ThemedText>
                {colorSeason.subtype ? (
                  <ThemedText type="body" style={{ color: secondaryTextColor, fontWeight: "600" }}>
                    {colorSeason.subtype.charAt(0).toUpperCase() + colorSeason.subtype.slice(1)} Subtype
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.confidenceBadge}>
                <ThemedText type="caption" style={{ color: secondaryTextColor }}>
                  {colorSeason.confidence}%
                </ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={[styles.seasonDescription, { color: secondaryTextColor }]}>
              {seasonInfo.description}
            </ThemedText>
            <Pressable
              onPress={() => navigation.getParent()?.navigate("Discover", { 
                screen: "FashionBlog",
                params: { highlightArticle: "fallback-color-guide" }
              })}
              style={({ pressed }) => [
                styles.learnMoreButton,
                { backgroundColor: theme.link + "15", opacity: pressed ? 0.7 : 1 }
              ]}
            >
              <Feather name="book-open" size={16} color={theme.link} />
              <ThemedText type="body" style={{ color: theme.link, fontWeight: "600", marginLeft: Spacing.xs }}>
                Learn How to Use Your Season When Shopping
              </ThemedText>
            </Pressable>
          </Card>

          {hasSkinToneAnalysis && bodyProfile?.skinTone ? (
            <Card elevation={2} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="heart" size={20} color={theme.link} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Your Skin Tone
                </ThemedText>
              </View>
              <View style={styles.skinToneContainer}>
                <View 
                  style={[
                    styles.skinToneSwatch, 
                    { backgroundColor: bodyProfile.skinTone.hexApproximation }
                  ]} 
                />
                <View style={styles.skinToneInfo}>
                  <ThemedText type="h3" style={styles.skinToneName}>
                    {bodyProfile.skinTone.name}
                  </ThemedText>
                  <View style={styles.skinToneBadges}>
                    <View style={[styles.undertoneTag, { backgroundColor: theme.link + "20" }]}>
                      <ThemedText type="caption" style={{ color: theme.link }}>
                        {bodyProfile.skinTone.undertone.charAt(0).toUpperCase() + bodyProfile.skinTone.undertone.slice(1)} Undertone
                      </ThemedText>
                    </View>
                    <View style={[styles.depthTag, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText type="caption" style={{ color: secondaryTextColor }}>
                        {bodyProfile.skinTone.depth.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
              <ThemedText type="body" style={[styles.skinToneDescription, { color: secondaryTextColor }]}>
                {bodyProfile.skinTone.description}
              </ThemedText>
              {bodyProfile.skinTone.complementaryColors.length > 0 ? (
                <View style={styles.complementarySection}>
                  <ThemedText type="caption" style={[styles.complementaryLabel, { color: tertiaryTextColor }]}>
                    Colors that complement your skin:
                  </ThemedText>
                  <View style={styles.complementaryColors}>
                    {bodyProfile.skinTone.complementaryColors.map((color, index) => {
                      const hexMatch = color.match(/#(?:[0-9a-fA-F]{3}){1,2}/i);
                      const displayColor = hexMatch ? hexMatch[0] : null;
                      const colorName = color.replace(/#[0-9A-Fa-f]{3,6}/gi, '').trim();
                      return (
                        <View key={index} style={styles.complementaryItem}>
                          {displayColor ? (
                            <View style={[styles.complementaryCircle, { backgroundColor: displayColor }]} />
                          ) : (
                            <View style={[styles.complementaryCircle, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                              <Feather name="droplet" size={16} color={secondaryTextColor} />
                            </View>
                          )}
                          <ThemedText type="caption" numberOfLines={1} style={{ maxWidth: 60, textAlign: 'center' }}>
                            {colorName || color}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Card>
          ) : null}

          {hasSkinToneAnalysis && foundationMatches.length > 0 ? (
            <Card elevation={2} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="shopping-bag" size={20} color={theme.link} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Foundation Matches
                </ThemedText>
              </View>
              <ThemedText type="caption" style={[styles.foundationSubtitle, { color: secondaryTextColor }]}>
                Based on your skin tone analysis
              </ThemedText>
              <View style={styles.brandTabs}>
                {(['all', 'fenty', 'mac'] as const).map((brand) => (
                  <Pressable
                    key={brand}
                    onPress={() => setSelectedBrand(brand)}
                    style={[
                      styles.brandTab,
                      { 
                        backgroundColor: selectedBrand === brand ? theme.link : theme.backgroundSecondary,
                        borderColor: selectedBrand === brand ? theme.link : theme.border,
                      }
                    ]}
                  >
                    <ThemedText 
                      type="caption" 
                      style={{ 
                        color: selectedBrand === brand ? '#FFFFFF' : theme.text,
                        fontWeight: selectedBrand === brand ? '600' : '400',
                      }}
                    >
                      {brand === 'all' ? 'All Brands' : brand === 'fenty' ? 'Fenty Beauty' : 'MAC'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.foundationGrid}>
                {foundationMatches.map((match) => (
                  <Pressable
                    key={match.shade.id}
                    style={styles.foundationItem}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Linking.openURL(match.shade.productUrl).catch(() => {});
                      }
                    }}
                  >
                    <View style={[styles.foundationSwatch, { backgroundColor: match.shade.hexColor }]} />
                    <View style={styles.foundationInfo}>
                      <ThemedText type="caption" style={styles.foundationBrand} numberOfLines={1}>
                        {match.shade.brandName}
                      </ThemedText>
                      <ThemedText type="body" style={styles.foundationName} numberOfLines={1}>
                        {match.shade.shadeName}
                      </ThemedText>
                      <View style={[styles.matchBadge, { backgroundColor: theme.success + '20' }]}>
                        <ThemedText type="caption" style={{ color: theme.success, fontSize: 10 }}>
                          {Math.round(match.matchScore)}% match
                        </ThemedText>
                      </View>
                    </View>
                    {Platform.OS !== 'web' ? (
                      <Feather name="external-link" size={14} color={tertiaryTextColor} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={20} color={theme.success} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Best Colors
              </ThemedText>
            </View>
            <View style={styles.colorGrid}>
              {colorSeason.bestColors.map((color, index) => {
                const hexMatch = color.match(/#(?:[0-9a-fA-F]{3}){1,2}/i);
                const displayColor = hexMatch ? hexMatch[0] : null;
                const colorName = color.replace(/#[0-9A-Fa-f]{3,6}/gi, '').trim();
                return (
                  <View key={index} style={styles.colorItem}>
                    {displayColor ? (
                      <View style={[styles.colorCircle, { backgroundColor: displayColor }]} />
                    ) : (
                      <View style={[styles.colorCircle, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <Feather name="droplet" size={14} color={theme.success} />
                      </View>
                    )}
                    <ThemedText type="caption" numberOfLines={1}>
                      {colorName || color}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="x-circle" size={20} color={theme.error} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Colors to Avoid
              </ThemedText>
            </View>
            <View style={styles.colorGrid}>
              {colorSeason.avoidColors.map((color, index) => {
                const hexMatch = color.match(/#(?:[0-9a-fA-F]{3}){1,2}/i);
                const displayColor = hexMatch ? hexMatch[0] : null;
                const colorName = color.replace(/#[0-9A-Fa-f]{3,6}/gi, '').trim();
                return (
                  <View key={index} style={styles.colorItem}>
                    {displayColor ? (
                      <View style={[styles.colorCircle, { backgroundColor: displayColor }]} />
                    ) : (
                      <View style={[styles.colorCircle, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <Feather name="droplet" size={14} color={theme.error} />
                      </View>
                    )}
                    <ThemedText type="caption" numberOfLines={1}>
                      {colorName || color}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card elevation={1} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="star" size={20} color={theme.link} />
              <ThemedText type="h3" style={styles.sectionTitle}>
                Best Metallic
              </ThemedText>
            </View>
            <View style={styles.metallicBadge}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {colorSeason.metallic.charAt(0).toUpperCase() + colorSeason.metallic.slice(1).replace('-', ' ')}
              </ThemedText>
            </View>
          </Card>

          <Pressable onPress={() => setShowCamera(true)}>
            <LinearGradient
              colors={[theme.link, theme.link]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.reanalyzeButton}
            >
              <Feather name="refresh-cw" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.buttonText}>
                Reanalyze Colors
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </>
      ) : (
        <Card elevation={1} style={styles.startCard}>
          <View style={[styles.iconContainer, { backgroundColor: theme.link + "20" }]}>
            <Feather name="sun" size={48} color={theme.link} />
          </View>
          <ThemedText type="h3" style={styles.startTitle}>
            Discover Your Color Season
          </ThemedText>
          <ThemedText type="body" style={[styles.startText, { color: secondaryTextColor }]}>
            Take a selfie or upload a photo to find out which colors complement your natural skin tone, eye color, and hair.
          </ThemedText>

          <View style={styles.tipsContainer}>
            <ThemedText type="body" style={[styles.tipsTitle, { fontWeight: "600" }]}>
              For best results:
            </ThemedText>
            <View style={styles.tipRow}>
              <Feather name="check" size={16} color={theme.success} />
              <ThemedText type="body" style={[styles.tipText, { color: secondaryTextColor }]}>
                Use natural lighting
              </ThemedText>
            </View>
            <View style={styles.tipRow}>
              <Feather name="check" size={16} color={theme.success} />
              <ThemedText type="body" style={[styles.tipText, { color: secondaryTextColor }]}>
                Show your natural hair color
              </ThemedText>
            </View>
            <View style={styles.tipRow}>
              <Feather name="check" size={16} color={theme.success} />
              <ThemedText type="body" style={[styles.tipText, { color: secondaryTextColor }]}>
                Minimal or no makeup
              </ThemedText>
            </View>
            <View style={styles.tipRow}>
              <Feather name="check" size={16} color={theme.success} />
              <ThemedText type="body" style={[styles.tipText, { color: secondaryTextColor }]}>
                Wear a neutral top if possible
              </ThemedText>
            </View>
          </View>

          <Pressable onPress={() => setShowCamera(true)}>
            <LinearGradient
              colors={[theme.link, theme.link]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButton}
            >
              <Feather name="camera" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.buttonText}>
                Take a Selfie
              </ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handlePickImage}
            style={[styles.secondaryButton, { borderColor: theme.border }]}
          >
            <Feather name="image" size={20} color={theme.text} />
            <ThemedText type="body" style={[styles.secondaryButtonText, { color: theme.text }]}>
              Upload Photo
            </ThemedText>
          </Pressable>
        </Card>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xl,
  },
  permissionCard: {
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  permissionTitle: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  permissionText: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  settingsButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  backButton: {
    paddingVertical: Spacing.sm,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  faceGuide: {
    alignItems: "center",
  },
  faceGuideCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderStyle: "dashed",
  },
  guideText: {
    marginTop: Spacing.md,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  resultCard: {
    marginBottom: Spacing.lg,
  },
  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  seasonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  seasonInfo: {
    flex: 1,
  },
  seasonName: {
    marginBottom: Spacing.xs,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  seasonDescription: {
    lineHeight: 22,
  },
  learnMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
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
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  colorItem: {
    alignItems: "center",
    width: (SCREEN_WIDTH - Spacing.xl * 4) / 3,
    gap: Spacing.xs,
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  metallicBadge: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,215,0,0.2)",
    alignSelf: "flex-start",
  },
  skinToneContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  skinToneSwatch: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  skinToneInfo: {
    flex: 1,
  },
  skinToneName: {
    marginBottom: Spacing.xs,
  },
  skinToneBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  undertoneTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  depthTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  skinToneDescription: {
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  complementarySection: {
    marginTop: Spacing.sm,
  },
  complementaryLabel: {
    marginBottom: Spacing.sm,
  },
  complementaryColors: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  complementaryItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  complementaryCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  reanalyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
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
  tipsContainer: {
    alignSelf: "stretch",
    marginBottom: Spacing.xl,
  },
  tipsTitle: {
    marginBottom: Spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipText: {
    flex: 1,
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
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: Spacing.md,
    width: "100%",
  },
  secondaryButtonText: {
    fontWeight: "600",
  },
  foundationSubtitle: {
    marginBottom: Spacing.md,
  },
  brandTabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  brandTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  foundationGrid: {
    gap: Spacing.md,
  },
  foundationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  foundationSwatch: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  foundationInfo: {
    flex: 1,
  },
  foundationBrand: {
    opacity: 0.7,
    marginBottom: 2,
  },
  foundationName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  matchBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
});
