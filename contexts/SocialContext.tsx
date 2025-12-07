import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export type ActivityType = 'post' | 'challenge' | 'achievement' | 'follow' | 'friend_request';

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

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface SocialContextType {
  following: string[];
  followers: string[];
  friends: string[];
  incomingFriendRequests: FriendRequest[];
  outgoingFriendRequests: FriendRequest[];
  activityFeed: ActivityItem[];
  isLoading: boolean;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  getFollowersCount: () => number;
  getFollowingCount: () => number;
  getFriendsCount: () => number;
  refreshActivityFeed: () => Promise<void>;
  addActivityItem: (item: Omit<ActivityItem, 'id' | 'timestamp'>) => Promise<void>;
  sendFriendRequest: (userId: string, userName: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  cancelFriendRequest: (requestId: string) => Promise<void>;
  isFriend: (userId: string) => boolean;
  hasPendingRequestTo: (userId: string) => boolean;
  hasPendingRequestFrom: (userId: string) => boolean;
  getIncomingRequestsCount: () => number;
  getUserById: (userId: string) => UserSummary | undefined;
}

const SocialContext = createContext<SocialContextType | null>(null);

const SOCIAL_STORAGE_KEY = '@dripn_social';

export const SAMPLE_USERS: Record<string, UserSummary> = {
  '1': { id: '1', name: 'Emma Style', avatar: undefined },
  '2': { id: '2', name: 'Jordan Chic', avatar: undefined },
  '3': { id: '3', name: 'Sam Trendy', avatar: undefined },
  '4': { id: '4', name: 'Alex Fashion', avatar: undefined },
  '5': { id: '5', name: 'Casey Vogue', avatar: undefined },
  '6': { id: '6', name: 'Riley Street', avatar: undefined },
  '7': { id: '7', name: 'Morgan Luxe', avatar: undefined },
  '8': { id: '8', name: 'Taylor Edge', avatar: undefined },
};

const INITIAL_INCOMING_REQUESTS: FriendRequest[] = [
  {
    id: 'fr_1',
    fromUserId: '6',
    fromUserName: 'Riley Street',
    toUserId: 'current_user',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'fr_2',
    fromUserId: '7',
    fromUserName: 'Morgan Luxe',
    toUserId: 'current_user',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'fr_3',
    fromUserId: '8',
    fromUserName: 'Taylor Edge',
    toUserId: 'current_user',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];

function generateSampleActivityFeed(following: string[], friends: string[]): ActivityItem[] {
  const activities: ActivityItem[] = [];
  const now = Date.now();
  const connectedUsers = [...new Set([...following, ...friends])];

  if (connectedUsers.includes('1') || following.includes('1')) {
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

  if (connectedUsers.includes('2') || following.includes('2')) {
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

  if (connectedUsers.includes('3') || following.includes('3')) {
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

  if (connectedUsers.includes('4') || following.includes('4')) {
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

  if (connectedUsers.includes('5') || following.includes('5')) {
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

  if (friends.includes('6')) {
    activities.push({
      id: 'act_7',
      userId: '6',
      userName: 'Riley Street',
      type: 'post',
      title: 'New streetwear haul',
      description: 'Check out these fresh finds from downtown',
      timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      metadata: { postId: 'post_3' },
    });
  }

  if (friends.includes('7')) {
    activities.push({
      id: 'act_8',
      userId: '7',
      userName: 'Morgan Luxe',
      type: 'post',
      title: 'Designer collection preview',
      description: 'Exclusive look at upcoming luxury pieces',
      timestamp: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      metadata: { postId: 'post_4' },
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
  const [friends, setFriends] = useState<string[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<FriendRequest[]>([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<FriendRequest[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadSocialData();
    } else {
      setFollowing([]);
      setFollowers([]);
      setFriends([]);
      setIncomingFriendRequests([]);
      setOutgoingFriendRequests([]);
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
        setFriends(parsed.friends || []);
        setIncomingFriendRequests(parsed.incomingFriendRequests || INITIAL_INCOMING_REQUESTS);
        setOutgoingFriendRequests(parsed.outgoingFriendRequests || []);
        setActivityFeed(generateSampleActivityFeed(parsed.following || [], parsed.friends || []));
      } else {
        setIncomingFriendRequests(INITIAL_INCOMING_REQUESTS);
        setActivityFeed([]);
      }
    } catch (err) {
      console.error('Failed to load social data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSocialData = async (
    newFollowing: string[],
    newFollowers: string[],
    newFriends: string[],
    newIncoming: FriendRequest[],
    newOutgoing: FriendRequest[]
  ) => {
    try {
      const data = {
        following: newFollowing,
        followers: newFollowers,
        friends: newFriends,
        incomingFriendRequests: newIncoming,
        outgoingFriendRequests: newOutgoing,
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
    await saveSocialData(newFollowing, followers, friends, incomingFriendRequests, outgoingFriendRequests);

    const sampleActivities = generateSampleActivityFeed(newFollowing, friends);
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
  }, [following, followers, friends, incomingFriendRequests, outgoingFriendRequests, user]);

  const unfollowUser = useCallback(async (userId: string) => {
    if (!following.includes(userId)) return;

    const newFollowing = following.filter(id => id !== userId);
    setFollowing(newFollowing);
    await saveSocialData(newFollowing, followers, friends, incomingFriendRequests, outgoingFriendRequests);
    setActivityFeed(generateSampleActivityFeed(newFollowing, friends));
  }, [following, followers, friends, incomingFriendRequests, outgoingFriendRequests]);

  const sendFriendRequest = useCallback(async (userId: string, userName: string) => {
    if (friends.includes(userId)) return;
    if (outgoingFriendRequests.some(r => r.toUserId === userId && r.status === 'pending')) return;
    if (userId === user?.id) return;

    const newRequest: FriendRequest = {
      id: `fr_out_${Date.now()}`,
      fromUserId: user?.id || '',
      fromUserName: user?.name || 'You',
      toUserId: userId,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    const newOutgoing = [...outgoingFriendRequests, newRequest];
    setOutgoingFriendRequests(newOutgoing);
    await saveSocialData(following, followers, friends, incomingFriendRequests, newOutgoing);

    const requestActivity: ActivityItem = {
      id: `act_fr_${Date.now()}`,
      userId: user?.id || '',
      userName: user?.name || 'You',
      type: 'friend_request',
      title: `Sent friend request to ${userName}`,
      description: 'Waiting for response',
      timestamp: new Date().toISOString(),
      metadata: { targetUserId: userId },
    };
    setActivityFeed(prev => [requestActivity, ...prev]);
  }, [friends, outgoingFriendRequests, following, followers, incomingFriendRequests, user]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    const request = incomingFriendRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return;

    const newFriends = [...friends, request.fromUserId];
    const updatedIncoming = incomingFriendRequests.filter(r => r.id !== requestId);

    setFriends(newFriends);
    setIncomingFriendRequests(updatedIncoming);
    await saveSocialData(following, followers, newFriends, updatedIncoming, outgoingFriendRequests);

    const acceptActivity: ActivityItem = {
      id: `act_accept_${Date.now()}`,
      userId: user?.id || '',
      userName: user?.name || 'You',
      type: 'friend_request',
      title: `You and ${request.fromUserName} are now friends`,
      description: 'New friendship formed',
      timestamp: new Date().toISOString(),
      metadata: { targetUserId: request.fromUserId },
    };

    setActivityFeed(prev => [acceptActivity, ...generateSampleActivityFeed(following, newFriends)]);
  }, [incomingFriendRequests, friends, following, followers, outgoingFriendRequests, user]);

  const declineFriendRequest = useCallback(async (requestId: string) => {
    const updatedIncoming = incomingFriendRequests.filter(r => r.id !== requestId);

    setIncomingFriendRequests(updatedIncoming);
    await saveSocialData(following, followers, friends, updatedIncoming, outgoingFriendRequests);
  }, [incomingFriendRequests, following, followers, friends, outgoingFriendRequests]);

  const cancelFriendRequest = useCallback(async (requestId: string) => {
    const newOutgoing = outgoingFriendRequests.filter(r => r.id !== requestId);
    setOutgoingFriendRequests(newOutgoing);
    await saveSocialData(following, followers, friends, incomingFriendRequests, newOutgoing);
  }, [outgoingFriendRequests, following, followers, friends, incomingFriendRequests]);

  const isFriend = useCallback((userId: string) => {
    return friends.includes(userId);
  }, [friends]);

  const hasPendingRequestTo = useCallback((userId: string) => {
    return outgoingFriendRequests.some(r => r.toUserId === userId && r.status === 'pending');
  }, [outgoingFriendRequests]);

  const hasPendingRequestFrom = useCallback((userId: string) => {
    return incomingFriendRequests.some(r => r.fromUserId === userId && r.status === 'pending');
  }, [incomingFriendRequests]);

  const isFollowingUser = useCallback((userId: string) => {
    return following.includes(userId);
  }, [following]);

  const getFollowersCount = useCallback(() => {
    return followers.length;
  }, [followers]);

  const getFollowingCount = useCallback(() => {
    return following.length;
  }, [following]);

  const getFriendsCount = useCallback(() => {
    return friends.length;
  }, [friends]);

  const getIncomingRequestsCount = useCallback(() => {
    return incomingFriendRequests.filter(r => r.status === 'pending').length;
  }, [incomingFriendRequests]);

  const getUserById = useCallback((userId: string) => {
    return SAMPLE_USERS[userId];
  }, []);

  const refreshActivityFeed = useCallback(async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setActivityFeed(generateSampleActivityFeed(following, friends));
    setIsLoading(false);
  }, [following, friends]);

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
        friends,
        incomingFriendRequests,
        outgoingFriendRequests,
        activityFeed,
        isLoading,
        followUser,
        unfollowUser,
        isFollowing: isFollowingUser,
        getFollowersCount,
        getFollowingCount,
        getFriendsCount,
        refreshActivityFeed,
        addActivityItem,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        isFriend,
        hasPendingRequestTo,
        hasPendingRequestFrom,
        getIncomingRequestsCount,
        getUserById,
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
