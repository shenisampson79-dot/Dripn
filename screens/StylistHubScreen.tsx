import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable, Dimensions } from "react-native";
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
  withSpring,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { TodaysOutfitCard } from "@/components/TodaysOutfitCard";
import { navigateToSubscription } from "@/utils/navigateToSubscription";
import {
  FEATURE_FLAGS,
  LAUNCH_HIDDEN_STYLIST_FEATURE_IDS,
} from "@/constants/featureFlags";

import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type StylistHubScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StylistHub">;
};

const GRID_GAP = Spacing.md;

type GradientKey = 'primary' | 'secondary' | 'accent' | 'warm' | 'cool' | 'jewel';

interface StylistFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen?: keyof UserStylistStackParamList;
  gradientKey: GradientKey;
  category: "stylist" | "wardrobe" | "tools";
  premium?: boolean;
}

const getFeatures = (t: (key: string) => string): StylistFeature[] => [
  {
    id: "ai-stylist",
    title: t('stylistHub.personalStylist') || "Stylist Chat",
    description: t('stylistHub.personalStylistDesc') || "Chat, photos & wardrobe advice",
    icon: "message-circle",
    screen: "AIStylist",
    gradientKey: "primary",
    category: "stylist",
  },
  {
    id: "outfit-calendar",
    title: t('stylistHub.outfitCalendar') || "Outfit Calendar",
    description: t('stylistHub.outfitCalendarDesc') || "Plan your looks ahead",
    icon: "calendar",
    screen: "OutfitCalendar",
    gradientKey: "cool",
    category: "wardrobe",
  },
  {
    id: "weather-outfit",
    title: t('stylistHub.weatherOutfits') || "Weather Outfits",
    description: t('stylistHub.weatherOutfitsDesc') || "Dress for the forecast",
    icon: "cloud",
    screen: "WeatherOutfit",
    gradientKey: "secondary",
    category: "wardrobe",
  },
  {
    id: "fashion-blog",
    title: t('stylistHub.blog') || "Blog",
    description: t('stylistHub.blogDesc') || "Fashion tips & guides",
    icon: "book-open",
    screen: "FashionBlog",
    gradientKey: "warm",
    category: "tools",
  },
  {
    id: "style-rules",
    title: t('stylistHub.styleRules') || "Style Rules",
    description: t('stylistHub.styleRulesDesc') || "Your personal guidelines",
    icon: "list",
    screen: "StyleRules",
    gradientKey: "primary",
    category: "tools",
  },
  {
    id: "colour-insights",
    title: t('stylistHub.colourInsights') || "Colour Insights",
    description: t('stylistHub.colourInsightsDesc') || "Discover your palette",
    icon: "droplet",
    screen: "ColourInsights",
    gradientKey: "accent",
    category: "tools",
  },
];

const getLaunchDecisionTiles = (t: (key: string) => string): StylistFeature[] => [
  {
    id: "choosing-what-to-buy",
    title: t('stylistHub.choosingWhatToBuy') || "Choosing what to buy",
    description: t('stylistHub.choosingWhatToBuyDesc') || "Help me decide between options",
    icon: "shopping-bag",
    screen: "ChoosingWhatToBuy",
    gradientKey: "warm",
    category: "stylist",
  },
  {
    id: "outfit-for-event",
    title: t('stylistHub.outfitForEvent') || "Outfit for an event",
    description: t('stylistHub.outfitForEventDesc') || "Something specific coming up",
    icon: "calendar",
    screen: "EventOutfit",
    gradientKey: "jewel",
    category: "stylist",
  },
  {
    id: "quick-sanity-check",
    title: t('stylistHub.quickSanityCheck') || "Quick sanity check",
    description: t('stylistHub.quickSanityCheckDesc') || "Just need a second pair of eyes",
    icon: "check-circle",
    screen: "SanityCheck",
    gradientKey: "accent",
    category: "stylist",
  },
];

const DEFAULT_TILES_ORDER = FEATURE_FLAGS.launchSimplified
  ? ["ai-stylist", "choosing-what-to-buy", "outfit-for-event", "quick-sanity-check", "fashion-blog", "style-rules"]
  : ["ai-stylist", "outfit-calendar", "weather-outfit", "fashion-blog", "style-rules", "colour-insights"];

const TILES_ORDER_KEY = "@stylist_tiles_order";

const getGradientColors = (key: GradientKey, palette: any): readonly [string, string] => {
  const gradientMap: Record<GradientKey, readonly [string, string]> = {
    primary: palette.gradientPrimary,
    secondary: palette.gradientSecondary,
    accent: palette.gradientAccent,
    warm: palette.gradientWarm,
    cool: palette.gradientCool,
    jewel: palette.gradientJewel ?? palette.gradientAccent,
  };
  return gradientMap[key];
};

export default function StylistHubScreen({ navigation }: StylistHubScreenProps) {
  const { theme } = useTheme();
  const { tier, limits } = useSubscription();
  const { palette, colorScheme } = useColorScheme();
  const { t } = useTranslations();
  const [tilesOrder, setTilesOrder] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const allFeatures = React.useMemo(() => {
    const base = getFeatures(t);
    if (!FEATURE_FLAGS.launchSimplified) return base;

    const hidden = new Set<string>(LAUNCH_HIDDEN_STYLIST_FEATURE_IDS);
    const visible = base.filter((feature) => !hidden.has(feature.id));
    const launchTiles = getLaunchDecisionTiles(t);
    const stylistChat = visible.find((feature) => feature.id === "ai-stylist");
    const rest = visible.filter((feature) => feature.id !== "ai-stylist");
    return stylistChat ? [stylistChat, ...launchTiles, ...rest] : [...launchTiles, ...visible];
  }, [t]);
  
  useEffect(() => {
    const loadTilesOrder = async () => {
      try {
        const stored = await AsyncStorage.getItem(TILES_ORDER_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          const validIds = new Set(allFeatures.map((feature) => feature.id));
          const sanitized = parsed.filter((id) => validIds.has(id));
          const missing = allFeatures
            .map((feature) => feature.id)
            .filter((id) => !sanitized.includes(id));
          setTilesOrder(sanitized.length > 0 ? [...sanitized, ...missing] : DEFAULT_TILES_ORDER);
        } else {
          setTilesOrder(DEFAULT_TILES_ORDER);
        }
      } catch (error) {
        console.error("Failed to load tiles order:", error);
        setTilesOrder(DEFAULT_TILES_ORDER);
      }
    };
    loadTilesOrder();
  }, [allFeatures]);

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
    if (feature.id === "outfit-calendar" && !limits.canAccessOutfitCalendar) {
      navigateToSubscription(navigation);
      return;
    }
    if (feature.screen) {
      navigation.navigate(feature.screen);
    }
  };

  const sortedFeatures = useCallback(() => {
    if (tilesOrder.length === 0) return allFeatures;
    return [...allFeatures].sort((a, b) => {
      const aIndex = tilesOrder.indexOf(a.id);
      const bIndex = tilesOrder.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [tilesOrder, allFeatures]);

  const TILE_HEIGHT = 140;
  
  const AnimatedTile = ({ feature, index }: { feature: StylistFeature; index: number }) => {
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const zIndex = useSharedValue(0);
    const isDragging = useSharedValue(false);
    
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
        translateY.value = withSpring(0);
      }
    }, [isEditMode]);
    
    const handleMoveUp = () => {
      if (index > 0) {
        moveTile(index, index - 1);
      }
    };
    
    const handleMoveDown = () => {
      if (index < sortedFeatures().length - 1) {
        moveTile(index, index + 1);
      }
    };
    
    const longPressGesture = Gesture.LongPress()
      .minDuration(400)
      .onStart(() => {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(setIsEditMode)(true);
      });
    
    const panGesture = Gesture.Pan()
      .enabled(isEditMode)
      .onStart(() => {
        isDragging.value = true;
        zIndex.value = 100;
        scale.value = withSpring(1.05);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      })
      .onUpdate((event) => {
        translateY.value = event.translationY;
        
        const movedPositions = Math.round(event.translationY / TILE_HEIGHT);
        if (movedPositions !== 0) {
          const newIndex = index + movedPositions;
          if (newIndex >= 0 && newIndex < sortedFeatures().length && newIndex !== index) {
            runOnJS(moveTile)(index, newIndex);
            translateY.value = 0;
          }
        }
      })
      .onEnd(() => {
        isDragging.value = false;
        zIndex.value = 0;
        translateY.value = withSpring(0);
        scale.value = withSpring(0.95);
      });
    
    const composedGesture = Gesture.Race(longPressGesture, panGesture);
    
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
        { translateY: translateY.value },
      ],
      zIndex: zIndex.value,
    }));
    
    return (
      <Animated.View style={[styles.tileWrapper, animatedStyle]}>
        <GestureDetector gesture={composedGesture}>
          <Pressable
            onPress={() => handleFeaturePress(feature)}
            style={({ pressed }) => [
              styles.featureTile,
              { opacity: pressed && !isEditMode ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={getGradientColors(feature.gradientKey, palette)}
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
                  {feature.id === 'outfit-calendar' && !limits.canAccessOutfitCalendar
                    ? ` · ${t('subscription.plan.personalStylist.name') || 'Personal Stylist'}`
                    : ''}
                </ThemedText>
                <ThemedText type="caption" style={styles.tileDescription}>
                  {feature.id === 'outfit-calendar' && !limits.canAccessOutfitCalendar
                    ? (t('stylistHub.outfitCalendarLockedDesc') || 'Plan outfits ahead — Personal Stylist')
                    : feature.description}
                </ThemedText>
              </View>
              {feature.id === 'outfit-calendar' && !limits.canAccessOutfitCalendar ? (
                <View style={styles.premiumBadge}>
                  <Feather name="lock" size={14} color="#FFFFFF" />
                </View>
              ) : null}
              
              {isEditMode ? (
                <View style={styles.editControls}>
                  <Pressable 
                    onPress={handleMoveUp}
                    style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                    disabled={index === 0}
                  >
                    <Feather name="chevron-up" size={20} color={index === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.9)"} />
                  </Pressable>
                  <Pressable 
                    onPress={handleMoveDown}
                    style={[styles.moveButton, index === sortedFeatures().length - 1 && styles.moveButtonDisabled]}
                    disabled={index === sortedFeatures().length - 1}
                  >
                    <Feather name="chevron-down" size={20} color={index === sortedFeatures().length - 1 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.9)"} />
                  </Pressable>
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>
        </GestureDetector>
      </Animated.View>
    );
  };

  const renderFeatureTile = (feature: StylistFeature, index: number) => {
    return <AnimatedTile key={feature.id} feature={feature} index={index} />;
  };

  const isDark = theme.backgroundDefault === '#0D0B09' || theme.backgroundDefault === '#000000' || theme.backgroundDefault.toLowerCase() === '#1a1a2e';

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist' 
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.stylistHub.primary[0], ScreenGradients.stylistHub.primary[1], LuxuryColors.obsidian] as const;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={headerGradientColors}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.headerContent}>
          <View style={{ width: 40 }} />
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('stylistHub.screenTitle') || 'Stylist'}</ThemedText>
          {/* Edit button hidden for now - re-enable when more features are added */}
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.contentSection}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View>
                <ThemedText type="h3" style={[styles.title, { color: '#3D3426' }]}>
                  {t('stylistHub.styleToolsTitle') || 'Style Tools'}
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: '#5A4D3A' }]}>
                  {t('stylistHub.styleToolsSubtitle') || 'Your personal fashion assistant'}
                </ThemedText>
              </View>
            </View>
          
            {isEditMode ? (
              <View style={[styles.editHint, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Feather name="info" size={14} color="#FFFFFF" />
                <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: Spacing.xs }}>
                  {t('stylistHub.customizeLayout') || 'Long press any tile to customise your layout'}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.featuresGrid}>
            {sortedFeatures().map((feature, index) => renderFeatureTile(feature, index))}
          </View>
        </View>
      </ScreenScrollView>

      {/* Overlay — does not affect Style Tools layout */}
      <TodaysOutfitCard
        onOpenStylist={(prompt) => navigation.navigate("AIStylist", { initialPrompt: prompt })}
      />
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
  editControls: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    gap: 4,
  },
  moveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  moveButtonDisabled: {
    opacity: 0.5,
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
