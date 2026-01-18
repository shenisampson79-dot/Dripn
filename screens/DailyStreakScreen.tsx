import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring, useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type DailyStreakScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "DailyStreak">;
};

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalDaysActive: number;
  streakFreezes: number;
}

interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  type: 'outfit' | 'vote' | 'share' | 'upload';
  xpReward: number;
  completed: boolean;
  expiresAt: string;
}

export default function DailyStreakScreen({ navigation }: DailyStreakScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const streakScale = useSharedValue(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [streakRes, challengeRes] = await Promise.all([
        apiService.getStreak(),
        apiService.getDailyChallenge(),
      ]);
      
      if (streakRes.success) {
        setStreak(streakRes.streak);
      }
      if (challengeRes.success) {
        setChallenge(challengeRes.challenge);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load streak data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (streak && streak.currentStreak > 0) {
      streakScale.value = withSpring(1.1, { damping: 10 }, () => {
        streakScale.value = withSpring(1);
      });
    }
  }, [streak?.currentStreak]);

  const streakAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: streakScale.value }],
  }));

  const getChallengeIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'outfit': return 'sun';
      case 'vote': return 'thumbs-up';
      case 'share': return 'share-2';
      case 'upload': return 'upload';
      default: return 'star';
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const handleChallengeAction = () => {
    if (!challenge) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    switch (challenge.type) {
      case 'outfit':
        navigation.navigate("StyleShuffle");
        break;
      case 'vote':
        navigation.navigate("StyleShowdown" as any);
        break;
      case 'share':
        Alert.alert("Share", "Share a look to complete this challenge!");
        break;
      case 'upload':
        navigation.navigate("StreetStyleScanner");
        break;
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          Loading streak data...
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
          onPress={fetchData}
          style={[styles.retryButton, { backgroundColor: theme.link }]}
        >
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay();
  const adjustedToday = today === 0 ? 6 : today - 1;

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <Animated.View entering={FadeIn.duration(300)}>
        <ThemedText type="h2" style={styles.title}>Daily Streak</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Stay consistent, level up your style
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <Card style={styles.streakCard}>
          <Animated.View style={[styles.streakCircle, streakAnimatedStyle]}>
            <View style={[styles.streakInner, { backgroundColor: theme.warning + "20" }]}>
              <Feather name="zap" size={32} color={theme.warning} />
              <ThemedText style={[styles.streakNumber, { color: theme.warning }]}>
                {streak?.currentStreak || 0}
              </ThemedText>
              <ThemedText style={[styles.streakLabel, { color: theme.warning }]}>
                day streak
              </ThemedText>
            </View>
          </Animated.View>

          <View style={styles.weekContainer}>
            {weekDays.map((day, idx) => {
              const isActive = idx <= adjustedToday && streak && streak.currentStreak > 0;
              const isToday = idx === adjustedToday;
              
              return (
                <View key={idx} style={styles.dayColumn}>
                  <ThemedText style={[styles.dayLabel, { color: theme.tabIconDefault }]}>
                    {day}
                  </ThemedText>
                  <View 
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: isActive ? theme.warning : theme.backgroundSecondary,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: theme.link,
                      },
                    ]}
                  >
                    {isActive ? (
                      <Feather name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.link }]}>
                {streak?.longestStreak || 0}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                Best Streak
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.link }]}>
                {streak?.totalDaysActive || 0}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                Total Days
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: theme.link }]}>
                {streak?.streakFreezes || 0}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                Freezes Left
              </ThemedText>
            </View>
          </View>
        </Card>
      </Animated.View>

      {challenge ? (
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <View style={styles.challengeTitleRow}>
                <View style={[styles.challengeIconContainer, { backgroundColor: theme.success + "20" }]}>
                  <Feather name={getChallengeIcon(challenge.type)} size={20} color={theme.success} />
                </View>
                <View style={styles.challengeInfo}>
                  <ThemedText type="h4">Today's Challenge</ThemedText>
                  <ThemedText style={[styles.challengeTime, { color: theme.tabIconDefault }]}>
                    {getTimeRemaining(challenge.expiresAt)}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.xpBadge, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="star" size={12} color={theme.warning} />
                <ThemedText style={[styles.xpText, { color: theme.warning }]}>
                  +{challenge.xpReward} XP
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.challengeTitle}>{challenge.title}</ThemedText>
            <ThemedText style={[styles.challengeDescription, { color: theme.tabIconDefault }]}>
              {challenge.description}
            </ThemedText>

            {challenge.completed ? (
              <View style={[styles.completedBadge, { backgroundColor: theme.success + "20" }]}>
                <Feather name="check-circle" size={18} color={theme.success} />
                <ThemedText style={{ color: theme.success, fontWeight: "600" }}>
                  Completed!
                </ThemedText>
              </View>
            ) : (
              <Pressable
                onPress={handleChallengeAction}
                style={[styles.challengeButton, { backgroundColor: theme.link }]}
              >
                <ThemedText style={styles.challengeButtonText}>Start Challenge</ThemedText>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </Card>
        </Animated.View>
      ) : (
        <Card style={styles.noChallengeCard}>
          <Feather name="calendar" size={32} color={theme.tabIconDefault} />
          <ThemedText style={[styles.noChallengeText, { color: theme.tabIconDefault }]}>
            No challenge available today. Check back tomorrow!
          </ThemedText>
        </Card>
      )}

      <Animated.View entering={FadeInDown.delay(300).springify()}>
        <Card style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Feather name="info" size={18} color={theme.link} />
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Streak Tips
            </ThemedText>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Feather name="check" size={14} color={theme.success} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Complete any daily challenge to maintain your streak
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <Feather name="check" size={14} color={theme.success} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Use streak freezes to protect your progress when you miss a day
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <Feather name="check" size={14} color={theme.success} />
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                Longer streaks unlock special rewards and badges
              </ThemedText>
            </View>
          </View>
        </Card>
      </Animated.View>
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
  streakCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  streakCircle: {
    marginBottom: Spacing.xl,
  },
  streakInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  streakLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
  },
  weekContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  dayColumn: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  challengeCard: {
    padding: Spacing.lg,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  challengeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  challengeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  challengeInfo: {
    gap: 2,
  },
  challengeTime: {
    fontSize: Typography.small.fontSize,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  xpText: {
    fontSize: 11,
    fontWeight: "600",
  },
  challengeTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  challengeDescription: {
    fontSize: Typography.small.fontSize,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  challengeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  challengeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  noChallengeCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  noChallengeText: {
    textAlign: "center",
  },
  tipsCard: {
    padding: Spacing.lg,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tipsList: {
    gap: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    lineHeight: 18,
  },
});
