/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, RefreshControl, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useEffect } from "react";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePosts, Post } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSocial, SAMPLE_USERS, UserSummary } from "@/contexts/SocialContext";
import { sharePostWithBranding } from "@/services/SharingService";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Home">;
};

interface StoryUser extends UserSummary {
  hasNewPost: boolean;
  lastPostTime?: string | undefined;
}

const STORY_AVATAR_SIZE = 68;
const STORY_BORDER_SIZE = 3;

function StoryAvatar({ 
  user, 
  onPress,
  isCurrentUser = false,
}: { 
  user: StoryUser; 
  onPress: () => void;
  isCurrentUser?: boolean;
}) {
  const { theme } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (user.hasNewPost) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false
      );
    }
    return () => {
      cancelAnimation(rotation);
    };
  }, [user.hasNewPost]);

  const animatedGradientStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const tierColors: Record<string, string[]> = {
    fashionGuru: ['#FFD700', '#FFA500', '#FF8C00'],
    styleExpert: ['#C0C0C0', '#A9A9A9', '#808080'],
    fashionAdvisor: ['#CD7F32', '#B87333', '#8B4513'],
    styleContributor: ['#6366F1', '#8B5CF6', '#A855F7'],
  };

  const gradientColors = user.hasNewPost 
    ? (tierColors[user.tier || 'styleContributor'] || ['#E11D48', '#EC4899', '#F97316'])
    : [theme.tabIconDefault, theme.tabIconDefault, theme.tabIconDefault];

  return (
    <Pressable onPress={onPress} style={styles.storyAvatarContainer}>
      <View style={styles.storyAvatarWrapper}>
        {user.hasNewPost ? (
          <Animated.View style={[styles.storyGradientBorder, animatedGradientStyle]}>
            <LinearGradient
              colors={gradientColors as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.storyGradient}
            />
          </Animated.View>
        ) : (
          <View 
            style={[
              styles.storyInactiveBorder, 
              { borderColor: theme.tabIconDefault }
            ]} 
          />
        )}
        <View 
          style={[
            styles.storyAvatarInner, 
            { backgroundColor: theme.backgroundDefault }
          ]}
        >
          <View 
            style={[
              styles.storyAvatarPlaceholder, 
              { backgroundColor: user.hasNewPost ? theme.link : theme.backgroundSecondary }
            ]}
          >
            <ThemedText 
              type="small" 
              style={{ 
                color: user.hasNewPost ? '#FFFFFF' : theme.text,
                fontWeight: '600',
              }}
            >
              {initials}
            </ThemedText>
          </View>
        </View>
        {user.hasNewPost && (
          <View style={[styles.newPostIndicator, { backgroundColor: theme.link }]}>
            <Feather name="plus" size={10} color="#FFFFFF" />
          </View>
        )}
        {isCurrentUser && (
          <View style={[styles.yourStoryBadge, { backgroundColor: theme.link }]}>
            <Feather name="plus" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>
      <ThemedText 
        type="small" 
        numberOfLines={1} 
        style={[
          styles.storyName,
          { color: user.hasNewPost ? theme.text : theme.tabIconDefault }
        ]}
      >
        {isCurrentUser ? 'Your Story' : user.name.split(' ')[0]}
      </ThemedText>
    </Pressable>
  );
}

function StoryReel({ 
  navigation 
}: { 
  navigation: NativeStackNavigationProp<HomeStackParamList, "Home"> 
}) {
  const { theme } = useTheme();
  const { following } = useSocial();
  const { posts } = usePosts();
  const { user: currentUser } = useAuth();

  const storyUsers = useMemo(() => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const allUserIds = following.length > 0 
      ? following 
      : Object.keys(SAMPLE_USERS).slice(0, 10);

    const usersWithStories: StoryUser[] = allUserIds
      .map(userId => {
        const userInfo = SAMPLE_USERS[userId];
        if (!userInfo) return null;

        const userPosts = posts.filter(
          post => post.userId === userId && 
          new Date(post.createdAt).getTime() > twentyFourHoursAgo
        );

        const hasNewPost = userPosts.length > 0 || Math.random() > 0.5;
        const lastPostTime = hasNewPost 
          ? userPosts.length > 0 
            ? userPosts.sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0]?.createdAt
            : new Date(now - Math.random() * twentyFourHoursAgo).toISOString()
          : undefined;

        return {
          ...userInfo,
          hasNewPost,
          lastPostTime,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null) as StoryUser[];

    usersWithStories.sort((a, b) => {
      if (a.hasNewPost && !b.hasNewPost) return -1;
      if (!a.hasNewPost && b.hasNewPost) return 1;
      if (a.lastPostTime && b.lastPostTime) {
        return new Date(b.lastPostTime).getTime() - new Date(a.lastPostTime).getTime();
      }
      return 0;
    });

    return usersWithStories;
  }, [following, posts]);

  const currentUserStory: StoryUser = useMemo(() => ({
    id: 'current_user',
    name: currentUser?.name || 'You',
    hasNewPost: false,
    tier: 'styleContributor',
  }), [currentUser?.name]);

  const handleStoryPress = (userId: string) => {
    if (userId === 'current_user') {
      navigation.navigate('CreatePost' as any);
    } else {
      const userPosts = posts.filter(post => post.userId === userId);
      if (userPosts.length > 0) {
        navigation.navigate('PostDetail', { postId: userPosts[0].id });
      }
    }
  };

  return (
    <View style={styles.storyReelContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyScrollContent}
      >
        <StoryAvatar 
          user={currentUserStory} 
          onPress={() => handleStoryPress('current_user')}
          isCurrentUser
        />
        {storyUsers.map(user => (
          <StoryAvatar 
            key={user.id} 
            user={user} 
            onPress={() => handleStoryPress(user.id)}
          />
        ))}
      </ScrollView>
      <View style={[styles.storyDivider, { backgroundColor: theme.border }]} />
    </View>
  );
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme } = useTheme();
  const { posts, isLoading, refreshPosts, votePost, voteComparison, thankPost } = usePosts();
  const { user } = useAuth();
  const [feedFilter, setFeedFilter] = useState<"global" | "regional">("global");

  const filteredPosts = useMemo(() => {
    if (!user?.gender) return posts;
    const userGenderFilter = user.gender === 'man' ? 'male' : user.gender === 'woman' ? 'female' : null;
    if (!userGenderFilter) return posts;
    return posts.filter(post => !post.gender || post.gender === userGenderFilter || post.gender === 'unisex');
  }, [posts, user?.gender]);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPosts();
    setRefreshing(false);
  }, [refreshPosts]);

  const handlePostPress = (postId: string) => {
    navigation.navigate("PostDetail", { postId });
  };

  const handleVote = async (postId: string, voteType: "up" | "down") => {
    await votePost(postId, voteType);
  };

  const handleComparisonVote = async (postId: string, imageId: string) => {
    await voteComparison(postId, imageId);
  };

  const handleThank = async (postId: string) => {
    await thankPost(postId);
  };

  const handleShare = async (post: Post) => {
    await sharePostWithBranding(post);
  };

  const renderHeader = () => (
    <View>
      <StoryReel navigation={navigation} />
      <View style={styles.filterContainer}>
        <Pressable
          onPress={() => setFeedFilter("global")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                feedFilter === "global" ? theme.link : theme.backgroundDefault,
            },
          ]}
        >
          <Feather
            name="globe"
            size={16}
            color={feedFilter === "global" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="small"
            style={{ color: feedFilter === "global" ? "#FFFFFF" : theme.text }}
          >
            Global
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFeedFilter("regional")}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                feedFilter === "regional" ? theme.link : theme.backgroundDefault,
            },
          ]}
        >
          <Feather
            name="map-pin"
            size={16}
            color={feedFilter === "regional" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="small"
            style={{ color: feedFilter === "regional" ? "#FFFFFF" : theme.text }}
          >
            My Region
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onPress={() => handlePostPress(item.id)}
      onVote={handleVote}
      onComparisonVote={handleComparisonVote}
      onThank={handleThank}
      onShare={() => handleShare(item)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="camera" size={64} color={theme.tabIconDefault} />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No posts yet
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        Be the first to share your style with the community
      </ThemedText>
    </View>
  );

  return (
    <ScreenFlatList
      data={filteredPosts}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={!isLoading ? renderEmpty : null}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.lg }} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.link}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  storyReelContainer: {
    marginBottom: Spacing.md,
  },
  storyScrollContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  storyAvatarContainer: {
    alignItems: 'center',
    width: STORY_AVATAR_SIZE + Spacing.md,
  },
  storyAvatarWrapper: {
    width: STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2,
    height: STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyGradientBorder: {
    position: 'absolute',
    width: STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2,
    height: STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2,
    borderRadius: (STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2) / 2,
    overflow: 'hidden',
  },
  storyGradient: {
    flex: 1,
    borderRadius: (STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2) / 2,
  },
  storyInactiveBorder: {
    position: 'absolute',
    width: STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2,
    height: STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2,
    borderRadius: (STORY_AVATAR_SIZE + STORY_BORDER_SIZE * 2) / 2,
    borderWidth: 2,
  },
  storyAvatarInner: {
    width: STORY_AVATAR_SIZE,
    height: STORY_AVATAR_SIZE,
    borderRadius: STORY_AVATAR_SIZE / 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarPlaceholder: {
    width: STORY_AVATAR_SIZE - 4,
    height: STORY_AVATAR_SIZE - 4,
    borderRadius: (STORY_AVATAR_SIZE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPostIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  yourStoryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storyName: {
    marginTop: Spacing.xs,
    textAlign: 'center',
    fontSize: 11,
  },
  storyDivider: {
    height: 1,
    marginTop: Spacing.md,
    marginHorizontal: -Spacing.md,
  },
  filterContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
});
