import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, Dimensions, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type GamesHubScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "GamesHub">;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TILE_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

interface GameFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof DiscoverStackParamList;
  gradientColors: readonly [string, string];
  comingSoon?: boolean;
}

const GAME_FEATURES: GameFeature[] = [
  {
    id: "style-showdown",
    title: "Style Showdown",
    description: "Vote on outfit battles",
    icon: "zap",
    screen: "StyleShowdown",
    gradientColors: ["#FF6B6B", "#FF8E53"] as const,
    comingSoon: true,
  },
  {
    id: "price-check",
    title: "Price Check",
    description: "Guess the outfit price",
    icon: "dollar-sign",
    screen: "PriceCheck",
    gradientColors: ["#4ECDC4", "#44A08D"] as const,
    comingSoon: true,
  },
  {
    id: "style-quiz",
    title: "Style DNA Quiz",
    description: "Discover your style tribe",
    icon: "help-circle",
    screen: "StyleQuiz",
    gradientColors: ["#A855F7", "#7C3AED"] as const,
    comingSoon: true,
  },
  {
    id: "mix-match",
    title: "Mix & Match",
    description: "Create winning combos",
    icon: "shuffle",
    screen: "MixMatch",
    gradientColors: ["#F59E0B", "#D97706"] as const,
    comingSoon: true,
  },
  {
    id: "streak",
    title: "Daily Streak",
    description: "Keep your fashion streak",
    icon: "award",
    screen: "DailyStreak",
    gradientColors: ["#EC4899", "#DB2777"] as const,
    comingSoon: true,
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    description: "See top style leaders",
    icon: "bar-chart-2",
    screen: "Leaderboard",
    gradientColors: ["#6366F1", "#4F46E5"] as const,
    comingSoon: true,
  },
];

const GAMES_ORDER_KEY = "@games_order";

export default function GamesHubScreen({ navigation }: GamesHubScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const { user } = useAuth();
  const [gamesOrder, setGamesOrder] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [streakInfo, setStreakInfo] = useState<{ currentStreak: number; longestStreak: number } | null>(null);

  useEffect(() => {
    loadGamesOrder();
  }, []);

  const loadGamesOrder = async () => {
    try {
      const stored = await AsyncStorage.getItem(GAMES_ORDER_KEY);
      if (stored) {
        setGamesOrder(JSON.parse(stored));
      } else {
        setGamesOrder(GAME_FEATURES.map(g => g.id));
      }
    } catch (error) {
      console.error("Failed to load games order:", error);
      setGamesOrder(GAME_FEATURES.map(g => g.id));
    }
  };

  const saveGamesOrder = async (newOrder: string[]) => {
    try {
      await AsyncStorage.setItem(GAMES_ORDER_KEY, JSON.stringify(newOrder));
    } catch (error) {
      console.error("Failed to save games order:", error);
    }
  };

  const moveGame = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= gamesOrder.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newOrder = [...gamesOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setGamesOrder(newOrder);
    saveGamesOrder(newOrder);
  };

  const handleGamePress = (game: GameFeature) => {
    if (game.comingSoon) {
      Alert.alert("Coming Soon", `${game.title} will be available soon!`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(game.screen as any);
  };

  const sortedGames = useCallback(() => {
    if (gamesOrder.length === 0) return GAME_FEATURES;
    return [...GAME_FEATURES].sort((a, b) => {
      const aIndex = gamesOrder.indexOf(a.id);
      const bIndex = gamesOrder.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [gamesOrder]);

  const renderGameTile = (game: GameFeature, index: number) => {
    const actualIndex = gamesOrder.indexOf(game.id);
    
    return (
      <Animated.View
        key={game.id}
        entering={FadeInDown.delay(index * 50).springify()}
      >
        <Pressable
          onPress={() => handleGamePress(game)}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsEditMode(true);
          }}
          style={({ pressed }) => [
            styles.gameTile,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <LinearGradient
            colors={game.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tileGradient}
          >
            <View style={styles.tileContent}>
              <Feather name={game.icon} size={32} color="#FFFFFF" />
              <ThemedText type="body" style={styles.tileTitle}>
                {game.title}
              </ThemedText>
              <ThemedText type="caption" style={styles.tileDescription}>
                {game.description}
              </ThemedText>
            </View>
            
            {game.comingSoon ? (
              <View style={styles.comingSoonBadge}>
                <ThemedText style={styles.comingSoonText}>Soon</ThemedText>
              </View>
            ) : null}
            
            {isEditMode ? (
              <View style={styles.reorderControls}>
                <Pressable
                  onPress={() => moveGame(actualIndex, actualIndex - 1)}
                  style={styles.reorderButton}
                  disabled={actualIndex === 0}
                >
                  <Feather 
                    name="chevron-up" 
                    size={16} 
                    color={actualIndex === 0 ? "rgba(255,255,255,0.3)" : "#FFFFFF"} 
                  />
                </Pressable>
                <Pressable
                  onPress={() => moveGame(actualIndex, actualIndex + 1)}
                  style={styles.reorderButton}
                  disabled={actualIndex === gamesOrder.length - 1}
                >
                  <Feather 
                    name="chevron-down" 
                    size={16} 
                    color={actualIndex === gamesOrder.length - 1 ? "rgba(255,255,255,0.3)" : "#FFFFFF"} 
                  />
                </Pressable>
              </View>
            ) : null}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="h1" style={styles.title}>
              Style Games
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
              Play, compete & level up your style
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
              Use arrows to reorder games
            </ThemedText>
          </View>
        ) : null}
      </View>

      {streakInfo ? (
        <Card style={styles.streakCard}>
          <View style={styles.streakContent}>
            <View style={[styles.streakIconContainer, { backgroundColor: theme.warning + "20" }]}>
              <Feather name="zap" size={24} color={theme.warning} />
            </View>
            <View style={styles.streakInfo}>
              <ThemedText type="h4">{streakInfo.currentStreak} Day Streak</ThemedText>
              <ThemedText style={[styles.streakSubtext, { color: theme.tabIconDefault }]}>
                Best: {streakInfo.longestStreak} days
              </ThemedText>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={styles.gamesGrid}>
        {sortedGames().map((game, index) => renderGameTile(game, index))}
      </View>

      <Card style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <Feather name="award" size={20} color={theme.warning} />
          <ThemedText type="h4" style={styles.tipsTitle}>
            How to Earn Points
          </ThemedText>
        </View>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <View style={[styles.tipBullet, { backgroundColor: "#FF6B6B" }]} />
            <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
              Vote in Style Showdowns to earn voting points
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <View style={[styles.tipBullet, { backgroundColor: "#4ECDC4" }]} />
            <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
              Guess prices accurately in Price Check
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <View style={[styles.tipBullet, { backgroundColor: "#EC4899" }]} />
            <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
              Maintain your daily streak for bonus points
            </ThemedText>
          </View>
        </View>
      </Card>
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
  streakCard: {
    padding: Spacing.lg,
  },
  streakContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  streakIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  streakInfo: {
    flex: 1,
  },
  streakSubtext: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  gamesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  gameTile: {
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
  comingSoonBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  comingSoonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
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
  tipsCard: {
    padding: Spacing.lg,
    marginTop: Spacing.md,
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
