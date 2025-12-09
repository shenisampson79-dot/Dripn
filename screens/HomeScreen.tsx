/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Image, Pressable, RefreshControl } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePosts, Post } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { sharePostWithBranding } from "@/services/SharingService";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Home">;
};

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
