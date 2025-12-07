import React, { useState } from "react";
import { StyleSheet, View, Pressable, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ContributorColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial } from "@/contexts/SocialContext";
import { useMessaging } from "@/contexts/MessagingContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

type CommunityScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "Community">;
};

interface Contributor {
  id: string;
  name: string;
  avatar: string | null;
  tier: keyof typeof ContributorColors;
  helpfulVotes: number;
  thanksReceived: number;
  postsCount: number;
}

const TOP_CONTRIBUTORS: Contributor[] = [
  {
    id: "1",
    name: "Emma Style",
    avatar: null,
    tier: "fashionGuru",
    helpfulVotes: 1245,
    thanksReceived: 456,
    postsCount: 89,
  },
  {
    id: "2",
    name: "Jordan Chic",
    avatar: null,
    tier: "styleExpert",
    helpfulVotes: 892,
    thanksReceived: 234,
    postsCount: 67,
  },
  {
    id: "3",
    name: "Sam Trendy",
    avatar: null,
    tier: "fashionAdvisor",
    helpfulVotes: 567,
    thanksReceived: 189,
    postsCount: 45,
  },
  {
    id: "4",
    name: "Alex Fashion",
    avatar: null,
    tier: "styleContributor",
    helpfulVotes: 234,
    thanksReceived: 78,
    postsCount: 23,
  },
  {
    id: "5",
    name: "Casey Vogue",
    avatar: null,
    tier: "styleContributor",
    helpfulVotes: 189,
    thanksReceived: 56,
    postsCount: 19,
  },
];

export default function CommunityScreen({ navigation }: CommunityScreenProps) {
  const { theme } = useTheme();
  const { following, activityFeed } = useSocial();
  const { unreadCount } = useMessaging();
  const [activeTab, setActiveTab] = useState<"top" | "rising" | "new">("top");

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const handleActivityPress = () => {
    navigation.navigate("FriendsActivity");
  };

  const handleMessagesPress = () => {
    navigation.navigate("Messages");
  };

  const renderContributorCard = (contributor: Contributor, index: number) => {
    const tierInfo = ContributorColors[contributor.tier];

    return (
      <Pressable
        key={contributor.id}
        onPress={() => handleUserPress(contributor.id)}
        style={({ pressed }) => [
          styles.contributorCard,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={styles.rankBadge}>
          <ThemedText type="h3" style={styles.rankText}>
            {index + 1}
          </ThemedText>
        </View>

        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}>
          {contributor.avatar ? (
            <Image source={{ uri: contributor.avatar }} style={styles.avatar} />
          ) : (
            <Feather name="user" size={24} color={theme.tabIconDefault} />
          )}
        </View>

        <View style={styles.contributorInfo}>
          <ThemedText type="h3">{contributor.name}</ThemedText>
          <View
            style={[
              styles.tierBadge,
              { backgroundColor: tierInfo.background },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: tierInfo.text, fontWeight: "600" }}
            >
              {tierInfo.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Feather name="thumbs-up" size={14} color={theme.tabIconDefault} />
            <ThemedText type="small">{contributor.helpfulVotes}</ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="heart" size={14} color={theme.tabIconDefault} />
            <ThemedText type="small">{contributor.thanksReceived}</ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <ThemedText type="body" style={styles.headerSubtitle}>
          Connect with fashion enthusiasts and style experts from around the world
        </ThemedText>
      </View>

      <Pressable
        onPress={handleMessagesPress}
        style={({ pressed }) => [
          styles.activityCard,
          { backgroundColor: theme.link + '15', opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.activityIconContainer, { backgroundColor: theme.link }]}>
          <Feather name="message-circle" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.activityContent}>
          <ThemedText type="h3">Messages</ThemedText>
          <ThemedText type="small" style={styles.activitySubtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
              : 'Chat with fashion enthusiasts'}
          </ThemedText>
        </View>
        {unreadCount > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: theme.link }]}>
            <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </ThemedText>
          </View>
        ) : null}
        <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
      </Pressable>

      <Pressable
        onPress={handleActivityPress}
        style={({ pressed }) => [
          styles.activityCard,
          { backgroundColor: theme.link + '15', opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.activityIconContainer, { backgroundColor: theme.link }]}>
          <Feather name="activity" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.activityContent}>
          <ThemedText type="h3">Friends Activity</ThemedText>
          <ThemedText type="small" style={styles.activitySubtitle}>
            {following.length > 0
              ? `${activityFeed.length} new updates from ${following.length} friend${following.length === 1 ? '' : 's'}`
              : 'Follow people to see their activity'}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
      </Pressable>

      <View style={styles.tabsContainer}>
        {(["top", "rising", "new"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor:
                  activeTab === tab ? theme.link : theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText
              type="body"
              style={{
                color: activeTab === tab ? "#FFFFFF" : theme.text,
                fontWeight: "600",
              }}
            >
              {tab === "top" ? "Top" : tab === "rising" ? "Rising" : "New"}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Top Contributors
        </ThemedText>
        <View style={styles.contributorsList}>
          {TOP_CONTRIBUTORS.map((contributor, index) =>
            renderContributorCard(contributor, index)
          )}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Community Stats
        </ThemedText>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="users" size={28} color={theme.link} />
            <ThemedText type="h2" style={styles.statNumber}>
              12.5K
            </ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Active Members
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="image" size={28} color={theme.link} />
            <ThemedText type="h2" style={styles.statNumber}>
              45.2K
            </ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Posts Shared
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="message-circle" size={28} color={theme.link} />
            <ThemedText type="h2" style={styles.statNumber}>
              89.1K
            </ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Advice Given
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="heart" size={28} color={theme.link} />
            <ThemedText type="h2" style={styles.statNumber}>
              234K
            </ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Thanks Shared
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="info" size={24} color={theme.link} />
          <View style={styles.infoContent}>
            <ThemedText type="h3">How to become a top contributor?</ThemedText>
            <ThemedText type="body" style={styles.infoText}>
              Give helpful style advice, receive thanks from the community, and
              stay active to level up your contributor status.
            </ThemedText>
          </View>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.xl,
  },
  headerSubtitle: {
    opacity: 0.7,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activitySubtitle: {
    opacity: 0.7,
  },
  tabsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  contributorsList: {
    gap: Spacing.md,
  },
  contributorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  rankBadge: {
    width: 28,
    alignItems: "center",
  },
  rankText: {
    opacity: 0.5,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contributorInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  tierBadge: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statsContainer: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.sm,
  },
  statNumber: {
    marginTop: Spacing.xs,
  },
  statLabel: {
    opacity: 0.7,
    textAlign: "center",
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoText: {
    opacity: 0.7,
    marginTop: Spacing.xs,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
});
