import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type StylistHubScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StylistHub">;
};

const GRID_GAP = Spacing.md;

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
    id: "style-dna",
    title: "Style DNA",
    description: "Discover your style",
    icon: "git-branch",
    screen: "StyleDNA",
    gradientColors: ["#f093fb", "#f5576c"] as const,
    category: "tools",
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
  {
    id: "fashion-blog",
    title: "Style Rules",
    description: "Fashion tips & guides",
    icon: "book-open",
    screen: "FashionBlog",
    gradientColors: ["#ff6b6b", "#ee5a5a"] as const,
    category: "tools",
  },
  {
    id: "wishlist",
    title: "Wishlist",
    description: "Saved items & deals",
    icon: "heart",
    screen: "Wishlist",
    gradientColors: ["#D4AF37", "#B8860B"] as const,
    category: "wardrobe",
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

  const AnimatedTile = ({ feature, index }: { feature: StylistFeature; index: number }) => {
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    
    useEffect(() => {
      if (isEditMode) {
        const randomOffset = Math.random() * 100;
        rotation.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 100 + randomOffset }),
            withTiming(2, { duration: 200 }),
            withTiming(-2, { duration: 200 }),
            withTiming(0, { duration: 100 })
          ),
          -1,
          false
        );
        scale.value = withTiming(0.95, { duration: 150 });
      } else {
        cancelAnimation(rotation);
        rotation.value = withTiming(0, { duration: 100 });
        scale.value = withTiming(1, { duration: 150 });
      }
    }, [isEditMode]);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
    }));
    
    return (
      <Animated.View style={[styles.tileWrapper, animatedStyle]}>
        <Pressable
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
            <View style={styles.iconContainer}>
              <Feather name={feature.icon} size={36} color="#FFFFFF" />
            </View>
            <View style={styles.tileContent}>
              <ThemedText type="body" style={styles.tileTitle}>
                {feature.title}
              </ThemedText>
              <ThemedText type="caption" style={styles.tileDescription}>
                {feature.description}
              </ThemedText>
            </View>
            
            {feature.premium && tier === "free" ? (
              <View style={styles.premiumBadge}>
                <Feather name="star" size={12} color={LuxuryColors.gold} />
              </View>
            ) : null}
            
            {isEditMode ? (
              <View style={styles.dragHandle}>
                <Feather name="move" size={16} color="rgba(255,255,255,0.8)" />
              </View>
            ) : null}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  const renderFeatureTile = (feature: StylistFeature, index: number) => {
    return <AnimatedTile key={feature.id} feature={feature} index={index} />;
  };

  const isDark = theme.backgroundDefault === '#0D0B09' || theme.backgroundDefault === '#000000' || theme.backgroundDefault.toLowerCase() === '#1a1a2e';

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          ScreenGradients.stylistHub.primary[0],
          ScreenGradients.stylistHub.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.headerContent}>
          <View style={{ width: 40 }} />
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>Stylist</ThemedText>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsEditMode(!isEditMode);
            }}
            style={[
              styles.editButton,
              { backgroundColor: isEditMode ? theme.link : 'rgba(255,255,255,0.15)' },
            ]}
          >
            <Feather
              name={isEditMode ? "check" : "edit-2"}
              size={18}
              color={isEditMode ? "#FFFFFF" : theme.text}
            />
          </Pressable>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View>
                <ThemedText type="h1" style={[styles.title, { color: LuxuryColors.gold }]}>
                  Style Tools
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                  Your personal fashion assistant
                </ThemedText>
              </View>
            </View>
          
            {isEditMode ? (
              <View style={[styles.editHint, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Feather name="info" size={14} color="#FFFFFF" />
                <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: Spacing.xs }}>
                  Long press any tile to customize your layout
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.featuresGrid}>
            {sortedFeatures().map((feature, index) => renderFeatureTile(feature, index))}
          </View>
        </View>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  headerGradient: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
  },
  contentSection: {
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
    gap: GRID_GAP,
  },
  tileWrapper: {
    width: "48%",
    aspectRatio: 1,
  },
  featureTile: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  tileGradient: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  iconContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: Spacing.lg,
  },
  tileContent: {
    gap: 2,
  },
  tileTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  tileDescription: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
  },
  premiumBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
});
