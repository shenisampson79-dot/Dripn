import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography, Colors, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useStyleTheme } from '@/hooks/useStyleTheme';
import { useGamification } from '@/contexts/GamificationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { Achievement, DailyReward, SpinReward } from '@/contexts/GamificationContext';
import { useTranslations } from "@/contexts/TranslationContext";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = SCREEN_WIDTH - Spacing['3xl'] * 2;

export default function GamificationScreen() {
  const { t } = useTranslations();
  const { theme, isDark } = useStyleTheme();
  const { tier } = useSubscription();
  const {
    stats,
    achievements,
    userAchievements,
    dailyRewards,
    spinRewards,
    canSpinToday,
    isLoading,
    claimDailyReward,
    spinWheel,
    claimAchievementReward,
    getUnlockedAchievements,
    getLockedAchievements,
    getAchievementProgress,
    getLevelInfo,
  } = useGamification();

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinReward | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [claimedReward, setClaimedReward] = useState<DailyReward | null>(null);

  const wheelRotation = useSharedValue(0);
  const rewardScale = useSharedValue(0);
  const streakFireScale = useSharedValue(1);

  const levelInfo = getLevelInfo();
  const unlockedAchievements = getUnlockedAchievements();
  const lockedAchievements = getLockedAchievements();

  const animateStreakFire = useCallback(() => {
    streakFireScale.value = withSequence(
      withSpring(1.2, { damping: 4 }),
      withSpring(1, { damping: 8 })
    );
  }, []);

  const handleClaimDaily = useCallback(async () => {
    try {
      const reward = await claimDailyReward();
      if (reward) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setClaimedReward(reward);
        animateStreakFire();
        Alert.alert(
          t('gamification.dailyRewardClaimed'),
          t('gamification.dailyRewardMessage')
            .replace('{points}', String(reward.points))
            .replace('{bonus}', reward.bonus ? `\nBonus: ${reward.bonus}` : '')
        );
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('gamification.couldNotClaimDaily'));
    }
  }, [claimDailyReward, animateStreakFire, t]);

  const handleSpin = useCallback(async () => {
    if (!canSpinToday || isSpinning || !spinRewards || spinRewards.length === 0) return;

    setIsSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await spinWheel();
      
      if (!spinRewards || spinRewards.length === 0) {
        setIsSpinning(false);
        onSpinComplete(result);
        return;
      }
      
      const segmentAngle = 360 / spinRewards.length;
      const resultIndex = spinRewards.findIndex(r => r.id === result.id);
      
      if (resultIndex < 0) {
        setIsSpinning(false);
        onSpinComplete(result);
        return;
      }
      
      const segmentOffset = resultIndex * segmentAngle + segmentAngle / 2;
      const extraRotations = 360 * 5;
      const targetAngle = wheelRotation.value + extraRotations + (360 - (wheelRotation.value % 360) + segmentOffset) % 360;
      
      wheelRotation.value = withTiming(targetAngle, {
        duration: 4000,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      }, (finished) => {
        if (finished) {
          runOnJS(onSpinComplete)(result);
        }
      });
    } catch (error) {
      setIsSpinning(false);
      Alert.alert(t('common.error'), t('gamification.couldNotSpin'));
    }
  }, [canSpinToday, isSpinning, spinWheel, spinRewards, t]);

  const onSpinComplete = useCallback((result: SpinReward) => {
    setIsSpinning(false);
    setSpinResult(result);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    rewardScale.value = withSequence(
      withSpring(1.2, { damping: 4 }),
      withSpring(1, { damping: 8 })
    );

    let message = '';
    if (result.type === 'points') {
      message = t('gamification.spinWonPoints').replace('{value}', String(result.value));
    } else if (result.type === 'discount') {
      message = t('gamification.spinWonDiscount').replace('{value}', String(result.value));
    } else if (result.type === 'feature') {
      message = t('gamification.spinUnlockedFeature').replace('{value}', String(result.value));
    } else {
      message = t('gamification.spinBetterLuck');
    }

    Alert.alert(t('gamification.spinResult'), message);
  }, [t]);

  const handleClaimAchievement = useCallback(async (achievementId: string) => {
    try {
      await claimAchievementReward(achievementId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const achievement = achievements.find(a => a.id === achievementId);
      Alert.alert(
        t('gamification.achievementClaimed'),
        t('gamification.achievementClaimedMessage').replace('{points}', String(achievement?.rewardPoints || 0))
      );
    } catch (error) {
      Alert.alert(t('common.error'), t('gamification.couldNotClaimAchievement'));
    }
  }, [claimAchievementReward, achievements, t]);

  const wheelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wheelRotation.value}deg` }],
  }));

  const streakFireAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: streakFireScale.value }],
  }));

  const rewardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rewardScale.value }],
  }));

  const renderDailyRewardCard = (reward: DailyReward, index: number) => {
    const isToday = reward.isAvailable && !reward.isClaimed;
    const availableIndex = dailyRewards.findIndex(r => r.isAvailable);
    const isPast = availableIndex >= 0 && index < availableIndex;
    const isFuture = !reward.isAvailable && !reward.isClaimed;

    return (
      <Pressable
        key={reward.day}
        onPress={isToday ? handleClaimDaily : undefined}
        style={[
          styles.dailyRewardCard,
          {
            backgroundColor: isToday
              ? theme.primary
              : reward.isClaimed
              ? theme.surface
              : theme.surfaceSecondary,
            borderColor: isToday ? theme.accent : 'transparent',
            borderWidth: isToday ? 2 : 0,
          },
        ]}
      >
        <ThemedText
          style={[
            styles.dayText,
            { color: isToday ? '#FFFFFF' : theme.textSecondary },
          ]}
        >
          Day {reward.day}
        </ThemedText>
        {reward.isClaimed ? (
          <Feather name="check-circle" size={24} color={theme.primary} />
        ) : isFuture ? (
          <Feather name="lock" size={20} color={theme.textTertiary} />
        ) : (
          <View style={styles.rewardPointsContainer}>
            <Feather
              name="star"
              size={16}
              color={isToday ? '#FFFFFF' : theme.accent}
            />
            <ThemedText
              style={[
                styles.rewardPoints,
                { color: isToday ? '#FFFFFF' : theme.text },
              ]}
            >
              {reward.points}
            </ThemedText>
          </View>
        )}
        {reward.bonus ? (
          <ThemedText
            style={[
              styles.bonusText,
              { color: isToday ? '#FFFFFF' : theme.accent },
            ]}
          >
            {reward.bonus}
          </ThemedText>
        ) : null}
      </Pressable>
    );
  };

  const renderAchievementCard = (achievement: Achievement, isUnlocked: boolean) => {
    const progress = getAchievementProgress(achievement.id);
    const canClaim = progress?.isUnlocked && !progress?.claimedReward;
    const progressPercent = progress
      ? Math.min((progress.currentProgress / achievement.requiredProgress) * 100, 100)
      : 0;

    return (
      <Card
        key={achievement.id}
        style={[
          styles.achievementCard,
          !isUnlocked && styles.lockedAchievement,
        ]}
      >
        <View style={styles.achievementHeader}>
          <View
            style={[
              styles.achievementIcon,
              {
                backgroundColor: isUnlocked ? theme.primary : theme.surfaceSecondary,
              },
            ]}
          >
            <Feather
              name={achievement.iconName as any}
              size={24}
              color={isUnlocked ? '#FFFFFF' : theme.textTertiary}
            />
          </View>
          {canClaim ? (
            <Pressable
              onPress={() => handleClaimAchievement(achievement.id)}
              style={[styles.claimButton, { backgroundColor: theme.accent }]}
            >
              <ThemedText style={styles.claimButtonText}>Claim</ThemedText>
            </Pressable>
          ) : null}
        </View>
        <ThemedText style={styles.achievementName}>{achievement.name}</ThemedText>
        <ThemedText
          style={[styles.achievementDescription, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {achievement.description}
        </ThemedText>
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: theme.surfaceSecondary },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isUnlocked ? theme.primary : theme.accent,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
            {progress?.currentProgress || 0}/{achievement.requiredProgress}
          </ThemedText>
        </View>
        <View style={styles.rewardBadge}>
          <Feather name="gift" size={12} color={theme.accent} />
          <ThemedText style={[styles.rewardBadgeText, { color: theme.accent }]}>
            {achievement.rewardPoints} pts
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderSpinWheel = () => {
    if (!spinRewards || spinRewards.length === 0) {
      return (
        <View style={styles.wheelContainer}>
          <View style={[styles.emptyWheelPlaceholder, { backgroundColor: theme.surfaceSecondary }]}>
            <Feather name="gift" size={48} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
              Spin wheel loading...
            </ThemedText>
          </View>
        </View>
      );
    }

    const segmentAngle = 360 / spinRewards.length;

    return (
      <View style={styles.wheelContainer}>
        <View style={styles.wheelPointer}>
          <Feather name="chevron-down" size={32} color={theme.primary} />
        </View>
        <Animated.View style={[styles.wheel, wheelAnimatedStyle]}>
          {spinRewards.map((reward, index) => {
            const rotation = index * segmentAngle;
            return (
              <View
                key={reward.id}
                style={[
                  styles.wheelSegment,
                  {
                    backgroundColor: reward.color,
                    transform: [
                      { rotate: `${rotation}deg` },
                      { translateY: -WHEEL_SIZE / 4 },
                    ],
                  },
                ]}
              >
                <ThemedText style={styles.wheelSegmentText} numberOfLines={1}>
                  {reward.name}
                </ThemedText>
              </View>
            );
          })}
        </Animated.View>
        <Pressable
          onPress={handleSpin}
          disabled={!canSpinToday || isSpinning}
          style={[
            styles.spinButton,
            {
              backgroundColor: canSpinToday && !isSpinning ? theme.primary : theme.surfaceSecondary,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.spinButtonText,
              { color: canSpinToday && !isSpinning ? '#FFFFFF' : theme.textTertiary },
            ]}
          >
            {isSpinning ? 'Spinning...' : canSpinToday ? 'SPIN' : 'Spun Today'}
          </ThemedText>
        </Pressable>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenScrollView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your rewards...
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView>
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View>
            <ThemedText style={styles.levelTitle}>Level {stats.level}</ThemedText>
            <ThemedText style={[styles.levelSubtitle, { color: theme.textSecondary }]}>
              {levelInfo.title}
            </ThemedText>
          </View>
          <View style={styles.pointsContainer}>
            <Feather name="star" size={20} color={theme.accent} />
            <ThemedText style={styles.pointsText}>{stats.totalPoints}</ThemedText>
          </View>
        </View>
        <View style={styles.levelProgressContainer}>
          <View style={[styles.levelProgressBar, { backgroundColor: theme.surfaceSecondary }]}>
            <View
              style={[
                styles.levelProgressFill,
                {
                  backgroundColor: theme.primary,
                  width: `${stats.levelProgress}%`,
                },
              ]}
            />
          </View>
          <ThemedText style={[styles.levelProgressText, { color: theme.textSecondary }]}>
            {stats.pointsToNextLevel > 0
              ? `${stats.pointsToNextLevel} pts to next level`
              : 'Max level reached!'}
          </ThemedText>
        </View>
      </Card>

      <Card style={styles.streakCard}>
        <View style={styles.streakHeader}>
          <Animated.View style={[styles.streakIconContainer, streakFireAnimatedStyle]}>
            <Feather name="zap" size={32} color="#FF6B35" />
          </Animated.View>
          <View style={styles.streakInfo}>
            <ThemedText style={styles.streakCount}>{stats.currentStreak}</ThemedText>
            <ThemedText style={[styles.streakLabel, { color: theme.textSecondary }]}>
              Day Streak
            </ThemedText>
          </View>
          <View style={styles.longestStreakContainer}>
            <ThemedText style={[styles.longestStreakLabel, { color: theme.textTertiary }]}>
              Longest
            </ThemedText>
            <ThemedText style={styles.longestStreakValue}>{stats.longestStreak}</ThemedText>
          </View>
        </View>
        <View style={styles.streakMilestones}>
          {[7, 30, 100].map((milestone) => (
            <View
              key={milestone}
              style={[
                styles.milestoneBadge,
                {
                  backgroundColor:
                    stats.longestStreak >= milestone ? theme.primary : theme.surfaceSecondary,
                },
              ]}
            >
              <Feather
                name="award"
                size={16}
                color={stats.longestStreak >= milestone ? '#FFFFFF' : theme.textTertiary}
              />
              <ThemedText
                style={[
                  styles.milestoneText,
                  {
                    color: stats.longestStreak >= milestone ? '#FFFFFF' : theme.textTertiary,
                  },
                ]}
              >
                {milestone}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Daily Rewards</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          Claim your daily bonus
        </ThemedText>
      </View>
      <View style={styles.dailyRewardsContainer}>
        {dailyRewards && dailyRewards.length > 0 ? (
          dailyRewards.map((reward, index) => renderDailyRewardCard(reward, index))
        ) : (
          <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
            Daily rewards loading...
          </ThemedText>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Spin to Win</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          {tier !== 'free'
            ? 'Paid plan: Unlimited daily spins!'
            : 'One free spin per day'}
        </ThemedText>
      </View>
      {renderSpinWheel()}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <ThemedText style={styles.sectionTitle}>Achievements</ThemedText>
          <ThemedText style={[styles.achievementCount, { color: theme.textSecondary }]}>
            {stats.achievementsUnlocked}/{stats.totalAchievements}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.categoryTitle, { color: theme.textSecondary }]}>
        Unlocked
      </ThemedText>
      <View style={styles.achievementsGrid}>
        {unlockedAchievements.length > 0 ? (
          unlockedAchievements.map((achievement) =>
            renderAchievementCard(achievement, true)
          )
        ) : (
          <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
            Complete activities to unlock achievements!
          </ThemedText>
        )}
      </View>

      <ThemedText style={[styles.categoryTitle, { color: theme.textSecondary }]}>
        In Progress
      </ThemedText>
      <View style={styles.achievementsGrid}>
        {lockedAchievements.slice(0, 6).map((achievement) =>
          renderAchievementCard(achievement, false)
        )}
      </View>

      <View style={styles.statsCard}>
        <Card>
          <ThemedText style={styles.statsTitle}>Your Stats</ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Feather name="flag" size={24} color={theme.primary} />
              <ThemedText style={styles.statValue}>{stats.challengesCompleted}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Challenges
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="award" size={24} color={theme.accent} />
              <ThemedText style={styles.statValue}>{stats.challengesWon}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Wins
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="unlock" size={24} color={theme.primary} />
              <ThemedText style={styles.statValue}>{stats.achievementsUnlocked}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Badges
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  levelCard: {
    marginBottom: Spacing.lg,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  levelTitle: {
    ...Typography.h2,
  },
  levelSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pointsText: {
    ...Typography.h3,
  },
  levelProgressContainer: {
    gap: Spacing.sm,
  },
  levelProgressBar: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  levelProgressText: {
    ...Typography.caption,
    textAlign: 'center',
  },
  streakCard: {
    marginBottom: Spacing.xl,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  streakIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakInfo: {
    flex: 1,
  },
  streakCount: {
    ...Typography.hero,
  },
  streakLabel: {
    ...Typography.small,
  },
  longestStreakContainer: {
    alignItems: 'center',
  },
  longestStreakLabel: {
    ...Typography.caption,
  },
  longestStreakValue: {
    ...Typography.h3,
  },
  streakMilestones: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  milestoneText: {
    ...Typography.small,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...Typography.h3,
  },
  sectionSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  achievementCount: {
    ...Typography.small,
  },
  dailyRewardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dailyRewardCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 6) / 7,
    minWidth: 42,
    aspectRatio: 0.75,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  dayText: {
    ...Typography.caption,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  rewardPointsContainer: {
    alignItems: 'center',
    gap: 2,
  },
  rewardPoints: {
    ...Typography.small,
    fontWeight: '600',
  },
  bonusText: {
    ...Typography.caption,
    fontSize: 8,
    marginTop: 2,
    textAlign: 'center',
  },
  wheelContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  wheelPointer: {
    position: 'absolute',
    top: -Spacing.md,
    zIndex: 10,
  },
  wheel: {
    width: WHEEL_SIZE * 0.8,
    height: WHEEL_SIZE * 0.8,
    borderRadius: WHEEL_SIZE * 0.4,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wheelSegment: {
    position: 'absolute',
    width: WHEEL_SIZE * 0.35,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.xs,
  },
  wheelSegmentText: {
    color: '#FFFFFF',
    ...Typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  spinButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  spinButtonText: {
    ...Typography.h4,
    fontWeight: '700',
  },
  categoryTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  achievementsGrid: {
    gap: Spacing.md,
  },
  achievementCard: {
    marginBottom: Spacing.sm,
  },
  lockedAchievement: {
    opacity: 0.7,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  claimButtonText: {
    color: '#FFFFFF',
    ...Typography.small,
    fontWeight: '600',
  },
  achievementName: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  achievementDescription: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressText: {
    ...Typography.caption,
    minWidth: 50,
    textAlign: 'right',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  rewardBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
    textAlign: 'center',
  },
  emptyWheelPlaceholder: {
    width: WHEEL_SIZE * 0.8,
    height: WHEEL_SIZE * 0.8,
    borderRadius: WHEEL_SIZE * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statsCard: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  statsTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statValue: {
    ...Typography.h2,
  },
  statLabel: {
    ...Typography.caption,
  },
});
