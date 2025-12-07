import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export type AchievementCategory = 
  | 'engagement' 
  | 'styling' 
  | 'community' 
  | 'wardrobe' 
  | 'streak' 
  | 'special';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  iconName: string;
  requiredProgress: number;
  rewardPoints: number;
  rewardType?: 'points' | 'badge' | 'feature_unlock' | 'discount';
  rewardValue?: string;
  isSecret?: boolean;
}

export interface UserAchievement {
  achievementId: string;
  currentProgress: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  claimedReward: boolean;
}

export interface DailyReward {
  day: number;
  points: number;
  bonus?: string;
  isClaimed: boolean;
  isAvailable: boolean;
}

export interface SpinReward {
  id: string;
  name: string;
  type: 'points' | 'discount' | 'feature' | 'nothing';
  value: number | string;
  probability: number;
  color: string;
}

export interface StyleChallenge {
  id: string;
  title: string;
  description: string;
  theme: string;
  startDate: string;
  endDate: string;
  rewardPoints: number;
  participantsCount: number;
  isActive: boolean;
  userParticipated: boolean;
  userSubmissionId?: string;
}

export interface ChallengeSubmission {
  id: string;
  challengeId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  imageUri: string;
  caption: string;
  votes: number;
  rank?: number;
  submittedAt: string;
}

export interface GamificationStats {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  achievementsUnlocked: number;
  totalAchievements: number;
  challengesCompleted: number;
  challengesWon: number;
  level: number;
  levelProgress: number;
  pointsToNextLevel: number;
}

interface GamificationContextType {
  stats: GamificationStats;
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  dailyRewards: DailyReward[];
  currentChallenge: StyleChallenge | null;
  challenges: StyleChallenge[];
  challengeSubmissions: ChallengeSubmission[];
  userVotes: string[];
  spinRewards: SpinReward[];
  lastSpinDate: string | null;
  canSpinToday: boolean;
  isLoading: boolean;
  addPoints: (points: number, reason: string) => Promise<void>;
  claimDailyReward: () => Promise<DailyReward | null>;
  checkAndUpdateStreak: () => Promise<void>;
  spinWheel: () => Promise<SpinReward>;
  updateAchievementProgress: (achievementId: string, progress: number) => Promise<void>;
  claimAchievementReward: (achievementId: string) => Promise<void>;
  joinChallenge: (challengeId: string) => Promise<void>;
  submitChallengeEntry: (challengeId: string, imageUri: string, caption: string) => Promise<ChallengeSubmission>;
  voteOnSubmission: (submissionId: string) => Promise<void>;
  hasVotedOnSubmission: (submissionId: string) => boolean;
  getChallengeSubmissions: (challengeId: string) => ChallengeSubmission[];
  getChallengeLeaderboard: (challengeId: string) => ChallengeSubmission[];
  getUnlockedAchievements: () => Achievement[];
  getLockedAchievements: () => Achievement[];
  getAchievementProgress: (achievementId: string) => UserAchievement | undefined;
  getLevelInfo: () => { level: number; title: string; minPoints: number; maxPoints: number };
}

const GamificationContext = createContext<GamificationContextType | null>(null);

const GAMIFICATION_STORAGE_KEY = '@dripn_gamification';
const STREAK_STORAGE_KEY = '@dripn_streak';
const SPIN_STORAGE_KEY = '@dripn_spin';
const CHALLENGES_STORAGE_KEY = '@dripn_challenges';

const LEVEL_THRESHOLDS = [
  { level: 1, minPoints: 0, maxPoints: 99, title: 'Style Novice' },
  { level: 2, minPoints: 100, maxPoints: 299, title: 'Fashion Curious' },
  { level: 3, minPoints: 300, maxPoints: 599, title: 'Style Explorer' },
  { level: 4, minPoints: 600, maxPoints: 999, title: 'Fashion Enthusiast' },
  { level: 5, minPoints: 1000, maxPoints: 1499, title: 'Style Savvy' },
  { level: 6, minPoints: 1500, maxPoints: 2499, title: 'Fashion Forward' },
  { level: 7, minPoints: 2500, maxPoints: 3999, title: 'Trendsetter' },
  { level: 8, minPoints: 4000, maxPoints: 5999, title: 'Style Icon' },
  { level: 9, minPoints: 6000, maxPoints: 9999, title: 'Fashion Guru' },
  { level: 10, minPoints: 10000, maxPoints: Infinity, title: 'Style Legend' },
];

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_post',
    name: 'First Impression',
    description: 'Share your first outfit post',
    category: 'engagement',
    iconName: 'camera',
    requiredProgress: 1,
    rewardPoints: 50,
  },
  {
    id: 'post_10',
    name: 'Content Creator',
    description: 'Share 10 outfit posts',
    category: 'engagement',
    iconName: 'grid',
    requiredProgress: 10,
    rewardPoints: 200,
  },
  {
    id: 'post_50',
    name: 'Style Influencer',
    description: 'Share 50 outfit posts',
    category: 'engagement',
    iconName: 'award',
    requiredProgress: 50,
    rewardPoints: 500,
  },
  {
    id: 'first_advice',
    name: 'Advice Seeker',
    description: 'Get your first AI styling advice',
    category: 'styling',
    iconName: 'message-circle',
    requiredProgress: 1,
    rewardPoints: 25,
  },
  {
    id: 'advice_20',
    name: 'Style Student',
    description: 'Get 20 AI styling advice sessions',
    category: 'styling',
    iconName: 'book-open',
    requiredProgress: 20,
    rewardPoints: 150,
  },
  {
    id: 'wardrobe_10',
    name: 'Wardrobe Starter',
    description: 'Add 10 items to your digital wardrobe',
    category: 'wardrobe',
    iconName: 'shopping-bag',
    requiredProgress: 10,
    rewardPoints: 100,
  },
  {
    id: 'wardrobe_50',
    name: 'Wardrobe Master',
    description: 'Add 50 items to your digital wardrobe',
    category: 'wardrobe',
    iconName: 'package',
    requiredProgress: 50,
    rewardPoints: 300,
  },
  {
    id: 'outfit_5',
    name: 'Outfit Curator',
    description: 'Save 5 outfit combinations',
    category: 'wardrobe',
    iconName: 'layers',
    requiredProgress: 5,
    rewardPoints: 75,
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Maintain a 7-day login streak',
    category: 'streak',
    iconName: 'zap',
    requiredProgress: 7,
    rewardPoints: 100,
  },
  {
    id: 'streak_30',
    name: 'Monthly Maven',
    description: 'Maintain a 30-day login streak',
    category: 'streak',
    iconName: 'star',
    requiredProgress: 30,
    rewardPoints: 500,
  },
  {
    id: 'streak_100',
    name: 'Century Club',
    description: 'Maintain a 100-day login streak',
    category: 'streak',
    iconName: 'award',
    requiredProgress: 100,
    rewardPoints: 2000,
  },
  {
    id: 'helpful_10',
    name: 'Community Helper',
    description: 'Receive 10 helpful votes on your advice',
    category: 'community',
    iconName: 'thumbs-up',
    requiredProgress: 10,
    rewardPoints: 150,
  },
  {
    id: 'helpful_50',
    name: 'Style Mentor',
    description: 'Receive 50 helpful votes on your advice',
    category: 'community',
    iconName: 'heart',
    requiredProgress: 50,
    rewardPoints: 400,
  },
  {
    id: 'challenge_first',
    name: 'Challenge Accepted',
    description: 'Participate in your first style challenge',
    category: 'community',
    iconName: 'flag',
    requiredProgress: 1,
    rewardPoints: 50,
  },
  {
    id: 'challenge_win',
    name: 'Challenge Champion',
    description: 'Win a style challenge',
    category: 'community',
    iconName: 'trophy',
    requiredProgress: 1,
    rewardPoints: 300,
  },
  {
    id: 'swipe_100',
    name: 'Style Explorer',
    description: 'Swipe through 100 outfits in Style Shuffle',
    category: 'engagement',
    iconName: 'repeat',
    requiredProgress: 100,
    rewardPoints: 100,
  },
  {
    id: 'swipe_500',
    name: 'Swipe Master',
    description: 'Swipe through 500 outfits in Style Shuffle',
    category: 'engagement',
    iconName: 'trending-up',
    requiredProgress: 500,
    rewardPoints: 300,
  },
  {
    id: 'visual_search_5',
    name: 'Fashion Detective',
    description: 'Use visual search 5 times',
    category: 'styling',
    iconName: 'search',
    requiredProgress: 5,
    rewardPoints: 75,
  },
  {
    id: 'sustainability_score',
    name: 'Eco Warrior',
    description: 'Achieve a wardrobe sustainability score of 80+',
    category: 'special',
    iconName: 'leaf',
    requiredProgress: 80,
    rewardPoints: 250,
    isSecret: true,
  },
  {
    id: 'profile_complete',
    name: 'All About You',
    description: 'Complete your full style profile',
    category: 'engagement',
    iconName: 'user-check',
    requiredProgress: 1,
    rewardPoints: 100,
  },
];

const SPIN_REWARDS: SpinReward[] = [
  { id: 'points_10', name: '10 Points', type: 'points', value: 10, probability: 0.25, color: '#4A90D9' },
  { id: 'points_25', name: '25 Points', type: 'points', value: 25, probability: 0.20, color: '#50C878' },
  { id: 'points_50', name: '50 Points', type: 'points', value: 50, probability: 0.15, color: '#FFD700' },
  { id: 'points_100', name: '100 Points', type: 'points', value: 100, probability: 0.08, color: '#FF6B6B' },
  { id: 'points_250', name: '250 Points', type: 'points', value: 250, probability: 0.02, color: '#9B59B6' },
  { id: 'discount_10', name: '10% Off', type: 'discount', value: '10%', probability: 0.10, color: '#E67E22' },
  { id: 'discount_20', name: '20% Off', type: 'discount', value: '20%', probability: 0.05, color: '#E74C3C' },
  { id: 'extra_advice', name: 'Extra AI Advice', type: 'feature', value: '+1 AI Advice', probability: 0.10, color: '#3498DB' },
  { id: 'nothing', name: 'Try Again', type: 'nothing', value: 0, probability: 0.05, color: '#95A5A6' },
];

const SAMPLE_CHALLENGES: StyleChallenge[] = [
  {
    id: 'challenge_winter_2025',
    title: 'Winter Wonderland',
    description: 'Show us your best cozy winter outfit. Layer up and stay stylish!',
    theme: 'Winter Fashion',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    rewardPoints: 500,
    participantsCount: 1247,
    isActive: true,
    userParticipated: false,
  },
  {
    id: 'challenge_office_chic',
    title: 'Office Chic',
    description: 'Style your perfect work-from-anywhere outfit that means business.',
    theme: 'Work Fashion',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    rewardPoints: 400,
    participantsCount: 892,
    isActive: true,
    userParticipated: false,
  },
  {
    id: 'challenge_monochrome',
    title: 'Monochrome Magic',
    description: 'Create a stunning single-color outfit from head to toe.',
    theme: 'Monochrome',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    rewardPoints: 450,
    participantsCount: 678,
    isActive: true,
    userParticipated: false,
  },
  {
    id: 'challenge_vintage',
    title: 'Vintage Vibes',
    description: 'Channel your inner retro style with vintage-inspired looks.',
    theme: 'Vintage',
    startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    rewardPoints: 400,
    participantsCount: 1532,
    isActive: false,
    userParticipated: false,
  },
  {
    id: 'challenge_athleisure',
    title: 'Athleisure Excellence',
    description: 'Blend comfort and style with your best athleisure look.',
    theme: 'Athletic',
    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    rewardPoints: 350,
    participantsCount: 2145,
    isActive: false,
    userParticipated: false,
  },
];

const SAMPLE_SUBMISSIONS: ChallengeSubmission[] = [
  {
    id: 'sub_1',
    challengeId: 'challenge_winter_2025',
    userId: 'user_1',
    userName: 'StyleQueen',
    imageUri: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=400',
    caption: 'Cozy layers for a winter stroll',
    votes: 234,
    rank: 1,
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sub_2',
    challengeId: 'challenge_winter_2025',
    userId: 'user_2',
    userName: 'FashionForward',
    imageUri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400',
    caption: 'My favorite winter coat look',
    votes: 189,
    rank: 2,
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sub_3',
    challengeId: 'challenge_winter_2025',
    userId: 'user_3',
    userName: 'TrendSetter',
    imageUri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400',
    caption: 'Warm and stylish',
    votes: 156,
    rank: 3,
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sub_4',
    challengeId: 'challenge_office_chic',
    userId: 'user_4',
    userName: 'WorkStyle',
    imageUri: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400',
    caption: 'Power meeting ready',
    votes: 145,
    rank: 1,
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sub_5',
    challengeId: 'challenge_office_chic',
    userId: 'user_5',
    userName: 'BossLady',
    imageUri: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400',
    caption: 'Sophisticated and comfortable',
    votes: 132,
    rank: 2,
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sub_6',
    challengeId: 'challenge_monochrome',
    userId: 'user_6',
    userName: 'MinimalChic',
    imageUri: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400',
    caption: 'All black everything',
    votes: 98,
    rank: 1,
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function createDefaultStats(): GamificationStats {
  return {
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    achievementsUnlocked: 0,
    totalAchievements: ACHIEVEMENTS.length,
    challengesCompleted: 0,
    challengesWon: 0,
    level: 1,
    levelProgress: 0,
    pointsToNextLevel: 100,
  };
}

function createDefaultDailyRewards(): DailyReward[] {
  return [
    { day: 1, points: 10, isClaimed: false, isAvailable: true },
    { day: 2, points: 15, isClaimed: false, isAvailable: false },
    { day: 3, points: 20, isClaimed: false, isAvailable: false },
    { day: 4, points: 25, isClaimed: false, isAvailable: false },
    { day: 5, points: 35, isClaimed: false, isAvailable: false },
    { day: 6, points: 50, isClaimed: false, isAvailable: false },
    { day: 7, points: 100, bonus: 'Bonus Spin', isClaimed: false, isAvailable: false },
  ];
}

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<GamificationStats>(createDefaultStats());
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [dailyRewards, setDailyRewards] = useState<DailyReward[]>(createDefaultDailyRewards());
  const [challenges, setChallenges] = useState<StyleChallenge[]>(SAMPLE_CHALLENGES);
  const [challengeSubmissions, setChallengeSubmissions] = useState<ChallengeSubmission[]>(SAMPLE_SUBMISSIONS);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [lastSpinDate, setLastSpinDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentChallenge = challenges.find(c => c.isActive) || null;

  const canSpinToday = !lastSpinDate || 
    new Date(lastSpinDate).toDateString() !== new Date().toDateString();

  useEffect(() => {
    if (isAuthenticated && user) {
      loadGamificationData();
    } else {
      setStats(createDefaultStats());
      setUserAchievements([]);
      setDailyRewards(createDefaultDailyRewards());
    }
  }, [isAuthenticated, user?.id]);

  const loadGamificationData = async () => {
    setIsLoading(true);
    try {
      const [gamificationData, streakData, spinData, challengesData] = await Promise.all([
        AsyncStorage.getItem(`${GAMIFICATION_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${STREAK_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${SPIN_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${CHALLENGES_STORAGE_KEY}_${user?.id}`),
      ]);

      if (gamificationData) {
        const data = JSON.parse(gamificationData);
        setStats(data.stats || createDefaultStats());
        setUserAchievements(data.achievements || []);
        setDailyRewards(data.dailyRewards || createDefaultDailyRewards());
      }

      if (spinData) {
        const data = JSON.parse(spinData);
        setLastSpinDate(data.lastSpinDate);
      }

      if (challengesData) {
        const data = JSON.parse(challengesData);
        if (data.submissions && data.submissions.length > 0) {
          setChallengeSubmissions([...SAMPLE_SUBMISSIONS, ...data.submissions]);
        }
        if (data.userVotes) {
          setUserVotes(data.userVotes);
        }
        if (data.challenges) {
          const mergedChallenges = SAMPLE_CHALLENGES.map(sc => {
            const saved = data.challenges.find((c: StyleChallenge) => c.id === sc.id);
            return saved ? { ...sc, ...saved } : sc;
          });
          setChallenges(mergedChallenges);
        }
      }

      await checkAndUpdateStreak();
    } catch (err) {
      console.error('Failed to load gamification data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGamificationData = async () => {
    try {
      const data = {
        stats,
        achievements: userAchievements,
        dailyRewards,
      };
      await AsyncStorage.setItem(
        `${GAMIFICATION_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(data)
      );
    } catch (err) {
      console.error('Failed to save gamification data:', err);
    }
  };

  useEffect(() => {
    if (user && !isLoading) {
      saveGamificationData();
    }
  }, [stats, userAchievements, dailyRewards]);

  const getLevelFromPoints = (points: number) => {
    const levelInfo = LEVEL_THRESHOLDS.find(
      l => points >= l.minPoints && points <= l.maxPoints
    ) || LEVEL_THRESHOLDS[0];
    return levelInfo;
  };

  const updateStatsWithPoints = (newPoints: number) => {
    const levelInfo = getLevelFromPoints(newPoints);
    const progress = levelInfo.maxPoints === Infinity
      ? 100
      : ((newPoints - levelInfo.minPoints) / (levelInfo.maxPoints - levelInfo.minPoints)) * 100;
    const pointsToNext = levelInfo.maxPoints === Infinity
      ? 0
      : levelInfo.maxPoints - newPoints + 1;

    setStats(prev => ({
      ...prev,
      totalPoints: newPoints,
      level: levelInfo.level,
      levelProgress: progress,
      pointsToNextLevel: pointsToNext,
    }));
  };

  const addPoints = useCallback(async (points: number, reason: string) => {
    const newTotal = stats.totalPoints + points;
    updateStatsWithPoints(newTotal);
    console.log(`Added ${points} points: ${reason}`);
  }, [stats.totalPoints]);

  const checkAndUpdateStreak = useCallback(async () => {
    try {
      const streakData = await AsyncStorage.getItem(`${STREAK_STORAGE_KEY}_${user?.id}`);
      const today = new Date().toDateString();

      if (streakData) {
        const data = JSON.parse(streakData);
        const lastLogin = new Date(data.lastLoginDate).toDateString();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

        if (lastLogin === today) {
          return;
        } else if (lastLogin === yesterday) {
          const newStreak = data.currentStreak + 1;
          const newLongest = Math.max(newStreak, data.longestStreak);

          setStats(prev => ({
            ...prev,
            currentStreak: newStreak,
            longestStreak: newLongest,
          }));

          const newDailyRewards = dailyRewards.map((reward, index) => ({
            ...reward,
            isAvailable: index === (newStreak - 1) % 7,
            isClaimed: index < (newStreak - 1) % 7,
          }));
          setDailyRewards(newDailyRewards);

          await AsyncStorage.setItem(
            `${STREAK_STORAGE_KEY}_${user?.id}`,
            JSON.stringify({
              currentStreak: newStreak,
              longestStreak: newLongest,
              lastLoginDate: new Date().toISOString(),
            })
          );

          await updateAchievementProgress('streak_7', newStreak);
          await updateAchievementProgress('streak_30', newStreak);
          await updateAchievementProgress('streak_100', newStreak);
        } else {
          setStats(prev => ({
            ...prev,
            currentStreak: 1,
          }));
          setDailyRewards(createDefaultDailyRewards());

          await AsyncStorage.setItem(
            `${STREAK_STORAGE_KEY}_${user?.id}`,
            JSON.stringify({
              currentStreak: 1,
              longestStreak: data.longestStreak,
              lastLoginDate: new Date().toISOString(),
            })
          );
        }
      } else {
        setStats(prev => ({
          ...prev,
          currentStreak: 1,
          longestStreak: 1,
        }));

        await AsyncStorage.setItem(
          `${STREAK_STORAGE_KEY}_${user?.id}`,
          JSON.stringify({
            currentStreak: 1,
            longestStreak: 1,
            lastLoginDate: new Date().toISOString(),
          })
        );
      }
    } catch (err) {
      console.error('Failed to update streak:', err);
    }
  }, [user?.id, dailyRewards]);

  const claimDailyReward = useCallback(async (): Promise<DailyReward | null> => {
    const availableReward = dailyRewards.find(r => r.isAvailable && !r.isClaimed);
    if (!availableReward) return null;

    await addPoints(availableReward.points, `Day ${availableReward.day} login reward`);

    const updatedRewards = dailyRewards.map(r =>
      r.day === availableReward.day ? { ...r, isClaimed: true } : r
    );
    setDailyRewards(updatedRewards);

    return availableReward;
  }, [dailyRewards, addPoints]);

  const spinWheel = useCallback(async (): Promise<SpinReward> => {
    if (!canSpinToday) {
      throw new Error('You have already spun the wheel today');
    }

    const random = Math.random();
    let cumulative = 0;
    let selectedReward = SPIN_REWARDS[0];

    for (const reward of SPIN_REWARDS) {
      cumulative += reward.probability;
      if (random <= cumulative) {
        selectedReward = reward;
        break;
      }
    }

    if (selectedReward.type === 'points' && typeof selectedReward.value === 'number') {
      await addPoints(selectedReward.value, 'Spin wheel reward');
    }

    const now = new Date().toISOString();
    setLastSpinDate(now);
    await AsyncStorage.setItem(
      `${SPIN_STORAGE_KEY}_${user?.id}`,
      JSON.stringify({ lastSpinDate: now })
    );

    return selectedReward;
  }, [canSpinToday, addPoints, user?.id]);

  const updateAchievementProgress = useCallback(async (achievementId: string, progress: number) => {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;

    const existingProgress = userAchievements.find(ua => ua.achievementId === achievementId);
    const currentProgress = existingProgress?.currentProgress || 0;

    if (progress <= currentProgress && existingProgress?.isUnlocked) return;

    const isNowUnlocked = progress >= achievement.requiredProgress;
    const wasUnlocked = existingProgress?.isUnlocked || false;

    const updatedProgress: UserAchievement = {
      achievementId,
      currentProgress: Math.min(progress, achievement.requiredProgress),
      isUnlocked: isNowUnlocked,
      unlockedAt: isNowUnlocked && !wasUnlocked ? new Date().toISOString() : existingProgress?.unlockedAt,
      claimedReward: existingProgress?.claimedReward || false,
    };

    const newAchievements = existingProgress
      ? userAchievements.map(ua =>
          ua.achievementId === achievementId ? updatedProgress : ua
        )
      : [...userAchievements, updatedProgress];

    setUserAchievements(newAchievements);

    if (isNowUnlocked && !wasUnlocked) {
      setStats(prev => ({
        ...prev,
        achievementsUnlocked: prev.achievementsUnlocked + 1,
      }));
    }
  }, [userAchievements]);

  const claimAchievementReward = useCallback(async (achievementId: string) => {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    const userProgress = userAchievements.find(ua => ua.achievementId === achievementId);

    if (!achievement || !userProgress?.isUnlocked || userProgress.claimedReward) {
      throw new Error('Cannot claim reward');
    }

    await addPoints(achievement.rewardPoints, `Achievement: ${achievement.name}`);

    const updatedAchievements = userAchievements.map(ua =>
      ua.achievementId === achievementId ? { ...ua, claimedReward: true } : ua
    );
    setUserAchievements(updatedAchievements);
  }, [userAchievements, addPoints]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    const updatedChallenges = challenges.map(c =>
      c.id === challengeId
        ? { ...c, userParticipated: true, participantsCount: c.participantsCount + 1 }
        : c
    );
    setChallenges(updatedChallenges);

    await updateAchievementProgress('challenge_first', 1);
  }, [challenges, updateAchievementProgress]);

  const saveChallengesData = useCallback(async () => {
    try {
      const userSubmissions = challengeSubmissions.filter(
        s => !SAMPLE_SUBMISSIONS.find(ss => ss.id === s.id)
      );
      const data = {
        submissions: userSubmissions,
        userVotes,
        challenges: challenges.map(c => ({
          id: c.id,
          userParticipated: c.userParticipated,
          userSubmissionId: c.userSubmissionId,
        })),
      };
      await AsyncStorage.setItem(
        `${CHALLENGES_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(data)
      );
    } catch (err) {
      console.error('Failed to save challenges data:', err);
    }
  }, [challengeSubmissions, userVotes, challenges, user?.id]);

  useEffect(() => {
    if (user && !isLoading) {
      saveChallengesData();
    }
  }, [challengeSubmissions, userVotes, challenges]);

  const submitChallengeEntry = useCallback(async (
    challengeId: string,
    imageUri: string,
    caption: string
  ): Promise<ChallengeSubmission> => {
    const submission: ChallengeSubmission = {
      id: `submission_${Date.now()}`,
      challengeId,
      userId: user?.id || '',
      userName: user?.name || 'Anonymous',
      userAvatar: user?.avatar || undefined,
      imageUri,
      caption,
      votes: 0,
      submittedAt: new Date().toISOString(),
    };

    setChallengeSubmissions(prev => [...prev, submission]);

    const updatedChallenges = challenges.map(c =>
      c.id === challengeId 
        ? { ...c, userSubmissionId: submission.id, userParticipated: true, participantsCount: c.participantsCount + 1 } 
        : c
    );
    setChallenges(updatedChallenges);

    await addPoints(25, 'Challenge submission');
    await updateAchievementProgress('challenge_first', 1);

    return submission;
  }, [challenges, user?.id, user?.name, user?.avatar, addPoints, updateAchievementProgress]);

  const voteOnSubmission = useCallback(async (submissionId: string) => {
    if (userVotes.includes(submissionId)) {
      return;
    }

    setChallengeSubmissions(prev => 
      prev.map(s => 
        s.id === submissionId ? { ...s, votes: s.votes + 1 } : s
      )
    );

    setUserVotes(prev => [...prev, submissionId]);
    await addPoints(5, 'Voted on challenge entry');
  }, [userVotes, addPoints]);

  const hasVotedOnSubmission = useCallback((submissionId: string): boolean => {
    return userVotes.includes(submissionId);
  }, [userVotes]);

  const getChallengeSubmissions = useCallback((challengeId: string): ChallengeSubmission[] => {
    return challengeSubmissions
      .filter(s => s.challengeId === challengeId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [challengeSubmissions]);

  const getChallengeLeaderboard = useCallback((challengeId: string): ChallengeSubmission[] => {
    return challengeSubmissions
      .filter(s => s.challengeId === challengeId)
      .sort((a, b) => b.votes - a.votes)
      .map((s, index) => ({ ...s, rank: index + 1 }));
  }, [challengeSubmissions]);

  const getUnlockedAchievements = useCallback((): Achievement[] => {
    const unlockedIds = userAchievements
      .filter(ua => ua.isUnlocked)
      .map(ua => ua.achievementId);
    return ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id));
  }, [userAchievements]);

  const getLockedAchievements = useCallback((): Achievement[] => {
    const unlockedIds = userAchievements
      .filter(ua => ua.isUnlocked)
      .map(ua => ua.achievementId);
    return ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id) && !a.isSecret);
  }, [userAchievements]);

  const getAchievementProgress = useCallback((achievementId: string): UserAchievement | undefined => {
    return userAchievements.find(ua => ua.achievementId === achievementId);
  }, [userAchievements]);

  const getLevelInfo = useCallback(() => {
    return getLevelFromPoints(stats.totalPoints);
  }, [stats.totalPoints]);

  const value: GamificationContextType = {
    stats,
    achievements: ACHIEVEMENTS,
    userAchievements,
    dailyRewards,
    currentChallenge,
    challenges,
    challengeSubmissions,
    userVotes,
    spinRewards: SPIN_REWARDS,
    lastSpinDate,
    canSpinToday,
    isLoading,
    addPoints,
    claimDailyReward,
    checkAndUpdateStreak,
    spinWheel,
    updateAchievementProgress,
    claimAchievementReward,
    joinChallenge,
    submitChallengeEntry,
    voteOnSubmission,
    hasVotedOnSubmission,
    getChallengeSubmissions,
    getChallengeLeaderboard,
    getUnlockedAchievements,
    getLockedAchievements,
    getAchievementProgress,
    getLevelInfo,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification(): GamificationContextType {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}

export { ACHIEVEMENTS, SPIN_REWARDS, LEVEL_THRESHOLDS };
