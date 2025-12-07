import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export type ActivityType = 'post' | 'challenge' | 'achievement' | 'follow';

export interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: ActivityType;
  title: string;
  description: string;
  imageUri?: string;
  timestamp: string;
  metadata?: {
    postId?: string;
    challengeId?: string;
    achievementId?: string;
    targetUserId?: string;
  };
}

export interface UserSummary {
  id: string;
  name: string;
  avatar?: string;
  isFollowing?: boolean;
}

interface SocialContextType {
  following: string[];
  followers: string[];
  activityFeed: ActivityItem[];
  isLoading: boolean;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  getFollowersCount: () => number;
  getFollowingCount: () => number;
  refreshActivityFeed: () => Promise<void>;
  addActivityItem: (item: Omit<ActivityItem, 'id' | 'timestamp'>) => Promise<void>;
}

const SocialContext = createContext<SocialContextType | null>(null);

const SOCIAL_STORAGE_KEY = '@dripn_social';

const SAMPLE_USERS: Record<string, UserSummary> = {
  '1': { id: '1', name: 'Emma Style', avatar: undefined },
  '2': { id: '2', name: 'Jordan Chic', avatar: undefined },
  '3': { id: '3', name: 'Sam Trendy', avatar: undefined },
  '4': { id: '4', name: 'Alex Fashion', avatar: undefined },
  '5': { id: '5', name: 'Casey Vogue', avatar: undefined },
};

function generateSampleActivityFeed(following: string[]): ActivityItem[] {
  const activities: ActivityItem[] = [];
  const now = Date.now();

  if (following.includes('1')) {
    activities.push({
      id: 'act_1',
      userId: '1',
      userName: 'Emma Style',
      type: 'post',
      title: 'Shared a new outfit',
      description: 'Perfect winter layering look for the office',
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      metadata: { postId: 'post_1' },
    });
    activities.push({
      id: 'act_2',
      userId: '1',
      userName: 'Emma Style',
      type: 'achievement',
      title: 'Earned Style Mentor badge',
      description: 'Received 50 helpful votes on advice',
      timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      metadata: { achievementId: 'helpful_50' },
    });
  }

  if (following.includes('2')) {
    activities.push({
      id: 'act_3',
      userId: '2',
      userName: 'Jordan Chic',
      type: 'challenge',
      title: 'Joined Winter Wonderland challenge',
      description: 'Participating in the weekly style challenge',
      timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      metadata: { challengeId: 'challenge_winter_2025' },
    });
  }

  if (following.includes('3')) {
    activities.push({
      id: 'act_4',
      userId: '3',
      userName: 'Sam Trendy',
      type: 'post',
      title: 'Shared a new outfit',
      description: 'Street style inspiration for the weekend',
      timestamp: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      metadata: { postId: 'post_2' },
    });
  }

  if (following.includes('4')) {
    activities.push({
      id: 'act_5',
      userId: '4',
      userName: 'Alex Fashion',
      type: 'achievement',
      title: 'Reached Level 5',
      description: 'Now a Style Savvy member',
      timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    });
  }

  if (following.includes('5')) {
    activities.push({
      id: 'act_6',
      userId: '5',
      userName: 'Casey Vogue',
      type: 'challenge',
      title: 'Won Office Chic challenge',
      description: 'First place in the weekly challenge',
      timestamp: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      metadata: { challengeId: 'challenge_office_chic' },
    });
  }

  return activities.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [following, setFollowing] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadSocialData();
    } else {
      setFollowing([]);
      setFollowers([]);
      setActivityFeed([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const loadSocialData = async () => {
    setIsLoading(true);
    try {
      const data = await AsyncStorage.getItem(`${SOCIAL_STORAGE_KEY}_${user?.id}`);
      if (data) {
        const parsed = JSON.parse(data);
        setFollowing(parsed.following || []);
        setFollowers(parsed.followers || []);
        setActivityFeed(generateSampleActivityFeed(parsed.following || []));
      } else {
        setActivityFeed([]);
      }
    } catch (err) {
      console.error('Failed to load social data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSocialData = async (newFollowing: string[], newFollowers: string[]) => {
    try {
      const data = {
        following: newFollowing,
        followers: newFollowers,
      };
      await AsyncStorage.setItem(
        `${SOCIAL_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(data)
      );
    } catch (err) {
      console.error('Failed to save social data:', err);
    }
  };

  const followUser = useCallback(async (userId: string) => {
    if (following.includes(userId)) return;
    if (userId === user?.id) return;

    const newFollowing = [...following, userId];
    setFollowing(newFollowing);
    await saveSocialData(newFollowing, followers);

    const sampleActivities = generateSampleActivityFeed(newFollowing);
    const userInfo = SAMPLE_USERS[userId];
    if (userInfo) {
      const followActivity: ActivityItem = {
        id: `act_follow_${Date.now()}`,
        userId: user?.id || '',
        userName: user?.name || 'You',
        type: 'follow',
        title: `Started following ${userInfo.name}`,
        description: 'New connection made',
        timestamp: new Date().toISOString(),
        metadata: { targetUserId: userId },
      };
      setActivityFeed([followActivity, ...sampleActivities]);
    } else {
      setActivityFeed(sampleActivities);
    }
  }, [following, followers, user]);

  const unfollowUser = useCallback(async (userId: string) => {
    if (!following.includes(userId)) return;

    const newFollowing = following.filter(id => id !== userId);
    setFollowing(newFollowing);
    await saveSocialData(newFollowing, followers);
    setActivityFeed(generateSampleActivityFeed(newFollowing));
  }, [following, followers]);

  const isFollowingUser = useCallback((userId: string) => {
    return following.includes(userId);
  }, [following]);

  const getFollowersCount = useCallback(() => {
    return followers.length;
  }, [followers]);

  const getFollowingCount = useCallback(() => {
    return following.length;
  }, [following]);

  const refreshActivityFeed = useCallback(async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setActivityFeed(generateSampleActivityFeed(following));
    setIsLoading(false);
  }, [following]);

  const addActivityItem = useCallback(async (item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newItem: ActivityItem = {
      ...item,
      id: `act_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setActivityFeed(prev => [newItem, ...prev]);
  }, []);

  return (
    <SocialContext.Provider
      value={{
        following,
        followers,
        activityFeed,
        isLoading,
        followUser,
        unfollowUser,
        isFollowing: isFollowingUser,
        getFollowersCount,
        getFollowingCount,
        refreshActivityFeed,
        addActivityItem,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return context;
}
