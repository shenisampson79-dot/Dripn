import React, { useState, useCallback } from "react";
import { StyleSheet, View, Pressable, Image, RefreshControl, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial, ActivityItem, ActivityType } from "@/contexts/SocialContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

type FriendsActivityScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "FriendsActivity">;
};

type FilterTab = 'all' | 'posts' | 'challenges' | 'achievements';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'posts', label: 'Posts' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'achievements', label: 'Achievements' },
];

function getActivityIcon(type: ActivityType): keyof typeof Feather.glyphMap {
  switch (type) {
    case 'post':
      return 'image';
    case 'challenge':
      return 'flag';
    case 'achievement':
      return 'award';
    case 'follow':
      return 'user-plus';
    default:
      return 'activity';
  }
}

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function FriendsActivityScreen({ navigation }: FriendsActivityScreenProps) {
  const { theme } = useTheme();
  const { activityFeed, isLoading, refreshActivityFeed, following } = useSocial();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredActivities = activityFeed.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'posts') return item.type === 'post';
    if (activeFilter === 'challenges') return item.type === 'challenge';
    if (activeFilter === 'achievements') return item.type === 'achievement';
    return true;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshActivityFeed();
    setRefreshing(false);
  }, [refreshActivityFeed]);

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const renderActivityCard = ({ item }: { item: ActivityItem }) => {
    const iconName = getActivityIcon(item.type);

    return (
      <Pressable
        onPress={() => handleUserPress(item.userId)}
        style={({ pressed }) => [
          styles.activityCard,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}>
            {item.userAvatar ? (
              <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
            ) : (
              <Feather name="user" size={20} color={theme.tabIconDefault} />
            )}
          </View>
          <View style={styles.headerInfo}>
            <ThemedText type="body" style={styles.userName}>
              {item.userName}
            </ThemedText>
            <ThemedText type="small" style={styles.timestamp}>
              {getRelativeTime(item.timestamp)}
            </ThemedText>
          </View>
          <View style={[styles.activityIcon, { backgroundColor: theme.link + '20' }]}>
            <Feather name={iconName} size={16} color={theme.link} />
          </View>
        </View>

        <View style={styles.cardContent}>
          <ThemedText type="h3" style={styles.activityTitle}>
            {item.title}
          </ThemedText>
          <ThemedText type="body" style={styles.activityDescription}>
            {item.description}
          </ThemedText>
        </View>

        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.activityImage} />
        ) : null}
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="users" size={64} color={theme.tabIconDefault} />
      <ThemedText type="h2" style={styles.emptyTitle}>
        {following.length === 0 ? 'No Friends Yet' : 'No Activity'}
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        {following.length === 0
          ? 'Follow other style enthusiasts to see their activity here'
          : 'Your friends have not posted any activity yet'}
      </ThemedText>
      {following.length === 0 ? (
        <Pressable
          style={[styles.discoverButton, { backgroundColor: theme.link }]}
          onPress={() => navigation.navigate('DiscoverPeople')}
        >
          <ThemedText type="body" style={styles.discoverButtonText}>
            Discover People
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ThemedText type="body" style={styles.subtitle}>
        See what your friends are up to
      </ThemedText>
      <View style={styles.filterContainer}>
        {FILTER_TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveFilter(tab.key)}
            style={({ pressed }) => [
              styles.filterTab,
              {
                backgroundColor: activeFilter === tab.key ? theme.link : theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: activeFilter === tab.key ? '#FFFFFF' : theme.text,
                fontWeight: '600',
              }}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={styles.loadingText}>
          Loading activity...
        </ThemedText>
      </View>
    );
  }

  return (
    <ScreenFlatList
      data={filteredActivities}
      keyExtractor={(item) => item.id}
      renderItem={renderActivityCard}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={filteredActivities.length === 0 ? styles.emptyContainer : undefined}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    opacity: 0.7,
  },
  headerContainer: {
    marginBottom: Spacing.lg,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  activityCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  userName: {
    fontWeight: '600',
  },
  timestamp: {
    opacity: 0.6,
    marginTop: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    marginTop: Spacing.xs,
  },
  activityTitle: {
    marginBottom: Spacing.xs,
  },
  activityDescription: {
    opacity: 0.8,
  },
  activityImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptyText: {
    opacity: 0.7,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  discoverButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  discoverButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
