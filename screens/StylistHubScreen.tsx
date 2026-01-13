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

const TILES_ORDER_KEY = "@stylist_tiles_order";

export default function StylistHubScreen({ navigation }: StylistHubScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [tilesOrder, setTilesOrder] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadTilesOrder();
  }, []);

  const loadTilesOrder = async () => {
    try {
      const stored = await AsyncStorage.getItem(TILES_ORDER_KEY);
      if (stored) {
        setTilesOrder(JSON.parse(stored));
      } else {
        setTilesOrder(ALL_FEATURES.map(f => f.id));
      }
    } catch (error) {
      console.error("Failed to load tiles order:", error);
      setTilesOrder(ALL_FEATURES.map(f => f.id));
    }
  };

  const saveTilesOrder = async (newOrder: string[]) => {
    try {
      await AsyncStorage.setItem(TILES_ORDER_KEY, JSON.stringify(newOrder));
    } catch (error) {
      console.error("Failed to save tiles order:", error);
    }
  };

  const moveTile = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= tilesOrder.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newOrder = [...tilesOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setTilesOrder(newOrder);
    saveTilesOrder(newOrder);
  };

  const handleFeaturePress = (feature: StylistFeature) => {
    if (isEditMode) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(feature.screen);
  };

  const sortedFeatures = useCallback(() => {
    if (tilesOrder.length === 0) return ALL_FEATURES;
    return [...ALL_FEATURES].sort((a, b) => {
      const aIndex = tilesOrder.indexOf(a.id);
      const bIndex = tilesOrder.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [tilesOrder]);

  const renderFeatureTile = (feature: StylistFeature, index: number) => {
    const actualIndex = tilesOrder.indexOf(feature.id);
    
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
          { opacity: pressed && !isEditMode ? 0.8 : 1 },
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
            <View style={styles.reorderControls}>
              <Pressable
                onPress={() => moveTile(actualIndex, actualIndex - 1)}
                style={styles.reorderButton}
                disabled={actualIndex === 0}
              >
                <Feather 
                  name="chevron-up" 
                  size={14} 
                  color={actualIndex === 0 ? "rgba(255,255,255,0.3)" : "#FFFFFF"} 
                />
              </Pressable>
              <Pressable
                onPress={() => moveTile(actualIndex, actualIndex + 1)}
                style={styles.reorderButton}
                disabled={actualIndex === tilesOrder.length - 1}
              >
                <Feather 
                  name="chevron-down" 
                  size={14} 
                  color={actualIndex === tilesOrder.length - 1 ? "rgba(255,255,255,0.3)" : "#FFFFFF"} 
                />
              </Pressable>
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
              name={isEditMode ? "check" : "move"}
              size={18}
              color={isEditMode ? "#FFFFFF" : theme.text}
            />
          </Pressable>
        </View>
        
        {isEditMode ? (
          <View style={[styles.editHint, { backgroundColor: theme.link + "20" }]}>
            <Feather name="info" size={14} color={theme.link} />
            <ThemedText type="caption" style={{ color: theme.link, marginLeft: Spacing.xs }}>
              Tap arrows to reorder your tools
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.featuresGrid}>
        {sortedFeatures().map((feature, index) => renderFeatureTile(feature, index))}
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
                Long-press any tile to reorder your tools
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
  reorderControls: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    gap: 4,
  },
  reorderButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
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
