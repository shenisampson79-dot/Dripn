import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type LeaderboardScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "Leaderboard">;
};

interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string;
  totalPoints: number;
  rank: number;
  tier: string;
  gamesPlayed: number;
}

interface UserStats {
  rank: number;
  totalPoints: number;
  gamesPlayed: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LeaderboardScreen({ navigation }: LeaderboardScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getGlobalLeaderboard();
      if (response.success) {
        setLeaderboard(response.leaderboard);
        if (response.userStats) {
          setUserStats(response.userStats);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#FFD700";
    if (rank === 2) return "#C0C0C0";
    if (rank === 3) return "#CD7F32";
    return theme.tabIconDefault;
  };

  const getRankIcon = (rank: number): keyof typeof Feather.glyphMap | null => {
    if (rank === 1) return "award";
    if (rank === 2) return "star";
    if (rank === 3) return "star";
    return null;
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'vip': return "#A855F7";
      case 'premium': return "#F59E0B";
      case 'basic': return "#3B82F6";
      default: return theme.tabIconDefault;
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          Loading leaderboard...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
        <Pressable 
          onPress={fetchLeaderboard}
          style={[styles.retryButton, { backgroundColor: theme.link }]}
        >
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <Animated.View entering={FadeIn.duration(300)}>
        <ThemedText type="h2" style={styles.title}>Leaderboard</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Top style champions this month
        </ThemedText>
      </Animated.View>

      {userStats ? (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={[styles.userStatsCard, { borderColor: theme.link, borderWidth: 1 }]}>
            <View style={styles.userStatsContent}>
              <View style={styles.userRankContainer}>
                <ThemedText style={[styles.userRankLabel, { color: theme.tabIconDefault }]}>
                  Your Rank
                </ThemedText>
                <ThemedText style={[styles.userRankValue, { color: theme.link }]}>
                  #{userStats.rank}
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.userStatItem}>
                <ThemedText style={[styles.userStatValue, { color: theme.text }]}>
                  {userStats.totalPoints}
                </ThemedText>
                <ThemedText style={[styles.userStatLabel, { color: theme.tabIconDefault }]}>
                  Points
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.userStatItem}>
                <ThemedText style={[styles.userStatValue, { color: theme.text }]}>
                  {userStats.gamesPlayed}
                </ThemedText>
                <ThemedText style={[styles.userStatLabel, { color: theme.tabIconDefault }]}>
                  Games
                </ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {top3.length > 0 ? (
        <Animated.View entering={FadeInUp.delay(200).springify()}>
          <View style={styles.podiumContainer}>
            {top3.length > 1 ? (
              <View style={[styles.podiumItem, styles.secondPlace]}>
                <View style={[styles.podiumAvatar, { backgroundColor: "#C0C0C0" + "30" }]}>
                  {top3[1].avatar ? (
                    <Image source={{ uri: top3[1].avatar }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={24} color="#C0C0C0" />
                  )}
                </View>
                <ThemedText style={styles.podiumRank}>2</ThemedText>
                <ThemedText style={styles.podiumName} numberOfLines={1}>
                  {top3[1].name}
                </ThemedText>
                <ThemedText style={[styles.podiumPoints, { color: theme.tabIconDefault }]}>
                  {top3[1].totalPoints} pts
                </ThemedText>
              </View>
            ) : null}

            {top3.length > 0 ? (
              <View style={[styles.podiumItem, styles.firstPlace]}>
                <Feather name="award" size={24} color="#FFD700" style={styles.crownIcon} />
                <View style={[styles.podiumAvatar, styles.firstAvatar, { backgroundColor: "#FFD700" + "30" }]}>
                  {top3[0].avatar ? (
                    <Image source={{ uri: top3[0].avatar }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={28} color="#FFD700" />
                  )}
                </View>
                <ThemedText style={[styles.podiumRank, { color: "#FFD700" }]}>1</ThemedText>
                <ThemedText style={styles.podiumName} numberOfLines={1}>
                  {top3[0].name}
                </ThemedText>
                <ThemedText style={[styles.podiumPoints, { color: theme.tabIconDefault }]}>
                  {top3[0].totalPoints} pts
                </ThemedText>
              </View>
            ) : null}

            {top3.length > 2 ? (
              <View style={[styles.podiumItem, styles.thirdPlace]}>
                <View style={[styles.podiumAvatar, { backgroundColor: "#CD7F32" + "30" }]}>
                  {top3[2].avatar ? (
                    <Image source={{ uri: top3[2].avatar }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={24} color="#CD7F32" />
                  )}
                </View>
                <ThemedText style={styles.podiumRank}>3</ThemedText>
                <ThemedText style={styles.podiumName} numberOfLines={1}>
                  {top3[2].name}
                </ThemedText>
                <ThemedText style={[styles.podiumPoints, { color: theme.tabIconDefault }]}>
                  {top3[2].totalPoints} pts
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {rest.length > 0 ? (
        <Card style={styles.listCard}>
          {rest.map((entry, index) => (
            <Animated.View 
              key={entry.userId}
              entering={FadeInDown.delay((index + 3) * 50).springify()}
            >
              <View style={[styles.listItem, index < rest.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <ThemedText style={[styles.listRank, { color: theme.tabIconDefault }]}>
                  #{entry.rank}
                </ThemedText>
                <View style={[styles.listAvatar, { backgroundColor: theme.backgroundSecondary }]}>
                  {entry.avatar ? (
                    <Image source={{ uri: entry.avatar }} style={styles.listAvatarImage} />
                  ) : (
                    <Feather name="user" size={16} color={theme.tabIconDefault} />
                  )}
                </View>
                <View style={styles.listInfo}>
                  <ThemedText style={styles.listName}>{entry.name}</ThemedText>
                  <View style={styles.listMeta}>
                    <View style={[styles.tierBadge, { backgroundColor: getTierColor(entry.tier) + "20" }]}>
                      <ThemedText style={[styles.tierText, { color: getTierColor(entry.tier) }]}>
                        {entry.tier}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.gamesText, { color: theme.tabIconDefault }]}>
                      {entry.gamesPlayed} games
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.listPoints, { color: theme.link }]}>
                  {entry.totalPoints}
                </ThemedText>
              </View>
            </Animated.View>
          ))}
        </Card>
      ) : null}

      {leaderboard.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="users" size={48} color={theme.tabIconDefault} />
          <ThemedText type="h4" style={styles.emptyTitle}>No Rankings Yet</ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            Play games to appear on the leaderboard!
          </ThemedText>
        </Card>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  errorText: {
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  userStatsCard: {
    padding: Spacing.lg,
  },
  userStatsContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  userRankContainer: {
    flex: 1.2,
    alignItems: "center",
  },
  userRankLabel: {
    fontSize: Typography.small.fontSize,
    marginBottom: 2,
  },
  userRankValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: Spacing.md,
  },
  userStatItem: {
    flex: 1,
    alignItems: "center",
  },
  userStatValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  userStatLabel: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  podiumItem: {
    alignItems: "center",
    flex: 1,
  },
  firstPlace: {
    marginBottom: Spacing.lg,
  },
  secondPlace: {
    marginBottom: 0,
  },
  thirdPlace: {
    marginBottom: 0,
  },
  crownIcon: {
    marginBottom: Spacing.xs,
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  firstAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  podiumRank: {
    fontSize: 18,
    fontWeight: "700",
  },
  podiumName: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  podiumPoints: {
    fontSize: 11,
    marginTop: 2,
  },
  listCard: {
    padding: 0,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  listRank: {
    width: 32,
    fontWeight: "600",
    textAlign: "center",
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  listAvatarImage: {
    width: "100%",
    height: "100%",
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tierBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  tierText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  gamesText: {
    fontSize: Typography.small.fontSize,
  },
  listPoints: {
    fontWeight: "700",
    fontSize: 16,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
  },
});
