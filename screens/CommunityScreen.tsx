import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ContributorColors, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial } from "@/contexts/SocialContext";
import { useMessaging } from "@/contexts/MessagingContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

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

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string | null;
  country: string;
  tier: keyof typeof ContributorColors;
  score: number;
  postsCount: number;
  followersCount: number;
  likesReceived: number;
  rank: number;
}

const GLOBAL_LEADERBOARD: LeaderboardUser[] = [
  { id: "lb1", name: "Isabella Vogue", avatar: null, country: "United States", tier: "fashionGuru", score: 15420, postsCount: 234, followersCount: 45200, likesReceived: 89500, rank: 1 },
  { id: "lb2", name: "Kenji Tanaka", avatar: null, country: "Japan", tier: "fashionGuru", score: 14890, postsCount: 198, followersCount: 42100, likesReceived: 82300, rank: 2 },
  { id: "lb3", name: "Priya Sharma", avatar: null, country: "India", tier: "styleExpert", score: 13250, postsCount: 176, followersCount: 38900, likesReceived: 71200, rank: 3 },
  { id: "lb4", name: "Marco Rossi", avatar: null, country: "Italy", tier: "styleExpert", score: 12100, postsCount: 154, followersCount: 35600, likesReceived: 65800, rank: 4 },
  { id: "lb5", name: "Amara Okonkwo", avatar: null, country: "Nigeria", tier: "styleExpert", score: 11450, postsCount: 143, followersCount: 32400, likesReceived: 58900, rank: 5 },
  { id: "lb6", name: "Sophie Dubois", avatar: null, country: "France", tier: "fashionAdvisor", score: 10890, postsCount: 132, followersCount: 29800, likesReceived: 54200, rank: 6 },
  { id: "lb7", name: "Chen Wei", avatar: null, country: "China", tier: "fashionAdvisor", score: 10340, postsCount: 128, followersCount: 27600, likesReceived: 49800, rank: 7 },
  { id: "lb8", name: "Emma Thompson", avatar: null, country: "United Kingdom", tier: "fashionAdvisor", score: 9870, postsCount: 119, followersCount: 25400, likesReceived: 46500, rank: 8 },
  { id: "lb9", name: "Carlos Mendez", avatar: null, country: "Mexico", tier: "styleContributor", score: 9340, postsCount: 108, followersCount: 23100, likesReceived: 42800, rank: 9 },
  { id: "lb10", name: "Fatima Al-Hassan", avatar: null, country: "United Arab Emirates", tier: "styleContributor", score: 8920, postsCount: 98, followersCount: 21500, likesReceived: 39200, rank: 10 },
  { id: "lb11", name: "Olivia Brown", avatar: null, country: "Australia", tier: "styleContributor", score: 8450, postsCount: 92, followersCount: 19800, likesReceived: 36100, rank: 11 },
  { id: "lb12", name: "Hans Mueller", avatar: null, country: "Germany", tier: "styleContributor", score: 8120, postsCount: 87, followersCount: 18200, likesReceived: 33400, rank: 12 },
];

const NATIONAL_LEADERBOARDS: Record<string, LeaderboardUser[]> = {
  "United States": [
    { id: "us1", name: "Isabella Vogue", avatar: null, country: "United States", tier: "fashionGuru", score: 15420, postsCount: 234, followersCount: 45200, likesReceived: 89500, rank: 1 },
    { id: "us2", name: "Jake Martinez", avatar: null, country: "United States", tier: "styleExpert", score: 8900, postsCount: 112, followersCount: 21300, likesReceived: 38700, rank: 2 },
    { id: "us3", name: "Lily Chen", avatar: null, country: "United States", tier: "fashionAdvisor", score: 7650, postsCount: 95, followersCount: 18400, likesReceived: 32100, rank: 3 },
    { id: "us4", name: "Tyler Brooks", avatar: null, country: "United States", tier: "styleContributor", score: 6890, postsCount: 82, followersCount: 15600, likesReceived: 27800, rank: 4 },
    { id: "us5", name: "Mia Johnson", avatar: null, country: "United States", tier: "styleContributor", score: 6340, postsCount: 74, followersCount: 13200, likesReceived: 24500, rank: 5 },
  ],
  "United Kingdom": [
    { id: "uk1", name: "Emma Thompson", avatar: null, country: "United Kingdom", tier: "fashionAdvisor", score: 9870, postsCount: 119, followersCount: 25400, likesReceived: 46500, rank: 1 },
    { id: "uk2", name: "Oliver Wright", avatar: null, country: "United Kingdom", tier: "styleExpert", score: 7820, postsCount: 94, followersCount: 19800, likesReceived: 35200, rank: 2 },
    { id: "uk3", name: "Charlotte Davies", avatar: null, country: "United Kingdom", tier: "fashionAdvisor", score: 6540, postsCount: 78, followersCount: 16300, likesReceived: 28900, rank: 3 },
    { id: "uk4", name: "Harry Wilson", avatar: null, country: "United Kingdom", tier: "styleContributor", score: 5890, postsCount: 69, followersCount: 14100, likesReceived: 25600, rank: 4 },
    { id: "uk5", name: "Amelia Jones", avatar: null, country: "United Kingdom", tier: "styleContributor", score: 5340, postsCount: 62, followersCount: 12400, likesReceived: 22800, rank: 5 },
  ],
  "Japan": [
    { id: "jp1", name: "Kenji Tanaka", avatar: null, country: "Japan", tier: "fashionGuru", score: 14890, postsCount: 198, followersCount: 42100, likesReceived: 82300, rank: 1 },
    { id: "jp2", name: "Yuki Sato", avatar: null, country: "Japan", tier: "styleExpert", score: 8450, postsCount: 108, followersCount: 22400, likesReceived: 39800, rank: 2 },
    { id: "jp3", name: "Hana Yamamoto", avatar: null, country: "Japan", tier: "fashionAdvisor", score: 7120, postsCount: 89, followersCount: 18600, likesReceived: 32400, rank: 3 },
    { id: "jp4", name: "Riku Nakamura", avatar: null, country: "Japan", tier: "styleContributor", score: 6340, postsCount: 76, followersCount: 15200, likesReceived: 27600, rank: 4 },
    { id: "jp5", name: "Sakura Ito", avatar: null, country: "Japan", tier: "styleContributor", score: 5780, postsCount: 67, followersCount: 13400, likesReceived: 24100, rank: 5 },
  ],
  "India": [
    { id: "in1", name: "Priya Sharma", avatar: null, country: "India", tier: "styleExpert", score: 13250, postsCount: 176, followersCount: 38900, likesReceived: 71200, rank: 1 },
    { id: "in2", name: "Arjun Patel", avatar: null, country: "India", tier: "fashionAdvisor", score: 8920, postsCount: 112, followersCount: 24300, likesReceived: 42800, rank: 2 },
    { id: "in3", name: "Ananya Reddy", avatar: null, country: "India", tier: "fashionAdvisor", score: 7650, postsCount: 94, followersCount: 19800, likesReceived: 35600, rank: 3 },
    { id: "in4", name: "Vikram Singh", avatar: null, country: "India", tier: "styleContributor", score: 6890, postsCount: 83, followersCount: 16400, likesReceived: 29800, rank: 4 },
    { id: "in5", name: "Ishita Gupta", avatar: null, country: "India", tier: "styleContributor", score: 6120, postsCount: 72, followersCount: 14100, likesReceived: 25400, rank: 5 },
  ],
};

const DEFAULT_NATIONAL: LeaderboardUser[] = [
  { id: "def1", name: "Fashion Pioneer", avatar: null, country: "Your Country", tier: "fashionAdvisor", score: 5420, postsCount: 65, followersCount: 12300, likesReceived: 21500, rank: 1 },
  { id: "def2", name: "Style Star", avatar: null, country: "Your Country", tier: "styleContributor", score: 4890, postsCount: 58, followersCount: 10800, likesReceived: 18900, rank: 2 },
  { id: "def3", name: "Trendy Local", avatar: null, country: "Your Country", tier: "styleContributor", score: 4340, postsCount: 51, followersCount: 9400, likesReceived: 16200, rank: 3 },
  { id: "def4", name: "Chic Creator", avatar: null, country: "Your Country", tier: "styleContributor", score: 3890, postsCount: 45, followersCount: 8100, likesReceived: 14100, rank: 4 },
  { id: "def5", name: "Style Beginner", avatar: null, country: "Your Country", tier: "styleContributor", score: 3450, postsCount: 39, followersCount: 7200, likesReceived: 12400, rank: 5 },
];

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

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

export default function CommunityScreen({ navigation }: CommunityScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { following, activityFeed, getIncomingRequestsCount } = useSocial();
  const { unreadCount } = useMessaging();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"top" | "rising" | "new">("top");
  const [leaderboardScope, setLeaderboardScope] = useState<"global" | "national">("global");

  const userCountry = user?.country || "United States";
  
  const nationalLeaderboard = useMemo(() => {
    return NATIONAL_LEADERBOARDS[userCountry] || DEFAULT_NATIONAL.map(u => ({
      ...u,
      country: userCountry
    }));
  }, [userCountry]);

  const currentLeaderboard = leaderboardScope === "global" ? GLOBAL_LEADERBOARD : nationalLeaderboard;

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const handleActivityPress = () => {
    navigation.navigate("FriendsActivity");
  };

  const handleMessagesPress = () => {
    navigation.navigate("Messages");
  };

  const handleFriendRequestsPress = () => {
    navigation.navigate("FriendRequests");
  };

  const friendRequestsCount = getIncomingRequestsCount();

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return { backgroundColor: "#FFD700" };
    if (rank === 2) return { backgroundColor: "#C0C0C0" };
    if (rank === 3) return { backgroundColor: "#CD7F32" };
    return { backgroundColor: theme.backgroundSecondary };
  };

  const getRankTextColor = (rank: number) => {
    if (rank <= 3) return "#333333";
    return theme.text;
  };

  const renderLeaderboardCard = (leaderboardUser: LeaderboardUser) => {
    const tierInfo = ContributorColors[leaderboardUser.tier];

    return (
      <Pressable
        key={leaderboardUser.id}
        onPress={() => handleUserPress(leaderboardUser.id)}
        style={({ pressed }) => [
          styles.leaderboardCard,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.leaderboardRankBadge, getRankBadgeStyle(leaderboardUser.rank)]}>
          <ThemedText type="h3" style={[styles.leaderboardRankText, { color: getRankTextColor(leaderboardUser.rank) }]}>
            {leaderboardUser.rank}
          </ThemedText>
        </View>

        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}>
          {leaderboardUser.avatar ? (
            <Image source={{ uri: leaderboardUser.avatar }} style={styles.avatar} />
          ) : (
            <Feather name="user" size={24} color={theme.tabIconDefault} />
          )}
        </View>

        <View style={styles.leaderboardInfo}>
          <ThemedText type="h3" numberOfLines={1}>{leaderboardUser.name}</ThemedText>
          <View style={styles.leaderboardMeta}>
            {leaderboardScope === "global" ? (
              <View style={styles.countryBadge}>
                <Feather name="globe" size={12} color={theme.tabIconDefault} />
                <ThemedText type="caption" style={{ opacity: 0.7 }}>{leaderboardUser.country}</ThemedText>
              </View>
            ) : null}
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: tierInfo.background },
              ]}
            >
              <ThemedText
                type="caption"
                style={{ color: tierInfo.text, fontWeight: "600" }}
              >
                {tierInfo.label}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.leaderboardStats}>
          <View style={styles.leaderboardStatRow}>
            <Feather name="award" size={14} color={theme.link} />
            <ThemedText type="body" style={{ fontWeight: "700", color: theme.link }}>
              {formatNumber(leaderboardUser.score)}
            </ThemedText>
          </View>
          <View style={styles.leaderboardStatRow}>
            <Feather name="users" size={12} color={theme.tabIconDefault} />
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              {formatNumber(leaderboardUser.followersCount)}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
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
        onPress={handleFriendRequestsPress}
        style={({ pressed }) => [
          styles.activityCard,
          { backgroundColor: theme.link + '15', opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.activityIconContainer, { backgroundColor: theme.link }]}>
          <Feather name="user-plus" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.activityContent}>
          <ThemedText type="h3">Friend Requests</ThemedText>
          <ThemedText type="small" style={styles.activitySubtitle}>
            {friendRequestsCount > 0
              ? `${friendRequestsCount} pending request${friendRequestsCount === 1 ? '' : 's'}`
              : 'Manage your connections'}
          </ThemedText>
        </View>
        {friendRequestsCount > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: theme.link }]}>
            <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {friendRequestsCount > 99 ? '99+' : friendRequestsCount}
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
        <View style={styles.leaderboardHeader}>
          <ThemedText type="h2">Leaderboards</ThemedText>
          <Feather name="trending-up" size={20} color={theme.link} />
        </View>
        
        <View style={styles.leaderboardScopeContainer}>
          <Pressable
            onPress={() => setLeaderboardScope("global")}
            style={({ pressed }) => [
              styles.scopeTab,
              {
                backgroundColor:
                  leaderboardScope === "global" ? theme.link : theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather 
              name="globe" 
              size={16} 
              color={leaderboardScope === "global" ? "#FFFFFF" : theme.tabIconDefault} 
            />
            <ThemedText
              type="body"
              style={{
                color: leaderboardScope === "global" ? "#FFFFFF" : theme.text,
                fontWeight: "600",
              }}
            >
              Global
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setLeaderboardScope("national")}
            style={({ pressed }) => [
              styles.scopeTab,
              {
                backgroundColor:
                  leaderboardScope === "national" ? theme.link : theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather 
              name="flag" 
              size={16} 
              color={leaderboardScope === "national" ? "#FFFFFF" : theme.tabIconDefault} 
            />
            <ThemedText
              type="body"
              style={{
                color: leaderboardScope === "national" ? "#FFFFFF" : theme.text,
                fontWeight: "600",
              }}
            >
              {userCountry}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.leaderboardList}>
          {currentLeaderboard.slice(0, 5).map((leaderboardUser) =>
            renderLeaderboardCard(leaderboardUser)
          )}
        </View>

        {leaderboardScope === "global" && currentLeaderboard.length > 5 ? (
          <Pressable
            style={({ pressed }) => [
              styles.showMoreButton,
              { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText type="body" style={{ color: theme.link, fontWeight: "600" }}>
              View Full Leaderboard
            </ThemedText>
            <Feather name="chevron-right" size={16} color={theme.link} />
          </Pressable>
        ) : null}
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
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  leaderboardScopeContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  scopeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  leaderboardList: {
    gap: Spacing.md,
  },
  leaderboardCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  leaderboardRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  leaderboardRankText: {
    fontWeight: "700",
  },
  leaderboardInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  leaderboardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  countryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leaderboardStats: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  leaderboardStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});
