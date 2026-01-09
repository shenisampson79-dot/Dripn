import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, Dimensions } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type StylistHubScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StylistHub">;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TILE_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

interface StylistFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof UserStylistStackParamList;
  gradientColors: readonly [string, string];
  category: "stylist" | "wardrobe" | "tools";
  premium?: boolean;
}

const ALL_FEATURES: StylistFeature[] = [
  {
    id: "ai-stylist",
    title: "Personal Stylist",
    description: "Chat with your AI stylist",
    icon: "message-circle",
    screen: "AIStylist",
    gradientColors: ["#667eea", "#764ba2"] as const,
    category: "stylist",
  },
  {
    id: "voice-chat",
    title: "Voice Chat",
    description: "Talk to Ruby or Max",
    icon: "headphones",
    screen: "VoiceConversation",
    gradientColors: ["#667eea", "#764ba2"] as const,
    category: "stylist",
  },
  {
    id: "wardrobe",
    title: "My Wardrobe",
    description: "Digitize your closet",
    icon: "grid",
    screen: "Wardrobe",
    gradientColors: ["#11998e", "#38ef7d"] as const,
    category: "wardrobe",
  },
  {
    id: "outfit-calendar",
    title: "Outfit Calendar",
    description: "Plan your looks ahead",
    icon: "calendar",
    screen: "OutfitCalendar",
    gradientColors: ["#4facfe", "#00f2fe"] as const,
    category: "wardrobe",
  },
  {
    id: "style-shuffle",
    title: "Style Shuffle",
    description: "Discover new combinations",
    icon: "shuffle",
    screen: "StyleShuffle",
    gradientColors: ["#f093fb", "#f5576c"] as const,
    category: "stylist",
  },
  {
    id: "visual-search",
    title: "Visual Search",
    description: "Find items from photos",
    icon: "camera",
    screen: "VisualSearch",
    gradientColors: ["#4facfe", "#00f2fe"] as const,
    category: "tools",
    premium: true,
  },
  {
    id: "dream-outfit",
    title: "Dream Outfit",
    description: "AI-generated looks",
    icon: "image",
    screen: "DreamOutfitGenerator",
    gradientColors: ["#f093fb", "#f5576c"] as const,
    category: "stylist",
    premium: true,
  },
  {
    id: "weather-outfit",
    title: "Weather Outfits",
    description: "Dress for the forecast",
    icon: "cloud",
    screen: "WeatherOutfit",
    gradientColors: ["#667eea", "#764ba2"] as const,
    category: "wardrobe",
  },
  {
    id: "cost-per-wear",
    title: "Cost-per-Wear",
    description: "Track wardrobe value",
    icon: "pie-chart",
    screen: "CostPerWear",
    gradientColors: ["#11998e", "#38ef7d"] as const,
    category: "tools",
  },
  {
    id: "style-dna",
    title: "Style DNA",
    description: "Discover your style",
    icon: "git-branch",
    screen: "StyleDNA",
    gradientColors: ["#f093fb", "#f5576c"] as const,
    category: "tools",
  },
  {
    id: "virtual-tryon",
    title: "Virtual Try-On",
    description: "See clothes on you",
    icon: "user",
    screen: "VirtualTryOn",
    gradientColors: ["#4facfe", "#00f2fe"] as const,
    category: "tools",
    premium: true,
  },
  {
    id: "color-analysis",
    title: "Color Analysis",
    description: "Find your best colors",
    icon: "droplet",
    screen: "ColorAnalysis",
    gradientColors: ["#f093fb", "#f5576c"] as const,
    category: "tools",
  },
  {
    id: "body-scanner",
    title: "Body Scanner",
    description: "Perfect fit insights",
    icon: "maximize",
    screen: "BodyScanner",
    gradientColors: ["#667eea", "#764ba2"] as const,
    category: "tools",
    premium: true,
  },
  {
    id: "social-sync",
    title: "Social Sync",
    description: "Style with friends",
    icon: "users",
    screen: "SocialStyleSync",
    gradientColors: ["#11998e", "#38ef7d"] as const,
    category: "stylist",
  },
];

const FAVORITES_KEY = "@stylist_favorites";

export default function StylistHubScreen({ navigation }: StylistHubScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
    }
  };

  const toggleFavorite = async (featureId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFavorites = favorites.includes(featureId)
      ? favorites.filter(id => id !== featureId)
      : [...favorites, featureId];
    
    setFavorites(newFavorites);
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (error) {
      console.error("Failed to save favorites:", error);
    }
  };

  const handleFeaturePress = (feature: StylistFeature) => {
    if (isEditMode) {
      toggleFavorite(feature.id);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(feature.screen);
  };

  const sortedFeatures = useCallback(() => {
    return [...ALL_FEATURES].sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [favorites]);

  const renderFeatureTile = (feature: StylistFeature) => {
    const isFavorite = favorites.includes(feature.id);
    
    return (
      <Pressable
        key={feature.id}
        onPress={() => handleFeaturePress(feature)}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIsEditMode(true);
        }}
        style={({ pressed }) => [
          styles.featureTile,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <LinearGradient
          colors={feature.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tileGradient}
        >
          <View style={styles.tileContent}>
            <Feather name={feature.icon} size={32} color="#FFFFFF" />
            <ThemedText type="body" style={styles.tileTitle}>
              {feature.title}
            </ThemedText>
            <ThemedText type="caption" style={styles.tileDescription}>
              {feature.description}
            </ThemedText>
          </View>
          
          {feature.premium && tier === "free" ? (
            <View style={styles.premiumBadge}>
              <Feather name="star" size={10} color="#FFFFFF" />
            </View>
          ) : null}
          
          {isEditMode ? (
            <Pressable
              onPress={() => toggleFavorite(feature.id)}
              style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            >
              <Feather
                name={isFavorite ? "star" : "star"}
                size={16}
                color={isFavorite ? "#FFD700" : "rgba(255,255,255,0.6)"}
              />
            </Pressable>
          ) : isFavorite ? (
            <View style={styles.favoriteBadge}>
              <Feather name="star" size={12} color="#FFD700" />
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="h1" style={styles.title}>
              Style Tools
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
              Your personal fashion assistant
            </ThemedText>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsEditMode(!isEditMode);
            }}
            style={[
              styles.editButton,
              { backgroundColor: isEditMode ? theme.link : theme.backgroundDefault },
            ]}
          >
            <Feather
              name={isEditMode ? "check" : "edit-2"}
              size={18}
              color={isEditMode ? "#FFFFFF" : theme.text}
            />
          </Pressable>
        </View>
        
        {isEditMode ? (
          <View style={[styles.editHint, { backgroundColor: theme.link + "20" }]}>
            <Feather name="info" size={14} color={theme.link} />
            <ThemedText type="caption" style={{ color: theme.link, marginLeft: Spacing.xs }}>
              Tap features to add to favorites - they'll appear at the top
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.featuresGrid}>
        {sortedFeatures().map(renderFeatureTile)}
      </View>

      <View style={styles.tipsSection}>
        <Card style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Feather name="info" size={20} color={theme.link} />
            <ThemedText type="h4" style={styles.tipsTitle}>
              Quick Tips
            </ThemedText>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: theme.link }]} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Long-press any tile to customize your favorites
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: theme.success }]} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Start with My Wardrobe to get personalized advice
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: theme.warning }]} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Use Voice Chat for hands-free styling help
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.small.fontSize,
    lineHeight: 20,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  editHint: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  featureTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  tileGradient: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "flex-end",
  },
  tileContent: {
    gap: Spacing.xs,
  },
  tileTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  tileDescription: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  premiumBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  favoriteButton: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButtonActive: {
    backgroundColor: "rgba(255,215,0,0.3)",
  },
  favoriteBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
  },
  tipsSection: {
    marginTop: Spacing.md,
  },
  tipsCard: {
    padding: Spacing.lg,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tipsTitle: {
    fontWeight: "600",
  },
  tipsList: {
    gap: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    lineHeight: 18,
  },
});
