import React from "react";
import { StyleSheet, View, Image, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ContributorColors, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useSocial } from "@/contexts/SocialContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type UserProfileScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "UserProfile">;
  route: RouteProp<CommunityStackParamList, "UserProfile">;
};

const MOCK_USERS: Record<string, {
  name: string;
  avatar: string | null;
  tier: keyof typeof ContributorColors;
  helpfulVotes: number;
  thanksReceived: number;
  postsCount: number;
  bio: string;
  followersCount: number;
  followingCount: number;
}> = {
  '1': {
    name: 'Emma Style',
    avatar: null,
    tier: 'fashionGuru',
    helpfulVotes: 1245,
    thanksReceived: 456,
    postsCount: 89,
    bio: 'Fashion enthusiast and style consultant. Love helping others find their perfect look!',
    followersCount: 2456,
    followingCount: 342,
  },
  '2': {
    name: 'Jordan Chic',
    avatar: null,
    tier: 'styleExpert',
    helpfulVotes: 892,
    thanksReceived: 234,
    postsCount: 67,
    bio: 'Streetwear lover and vintage collector. Always on the hunt for unique pieces.',
    followersCount: 1823,
    followingCount: 456,
  },
  '3': {
    name: 'Sam Trendy',
    avatar: null,
    tier: 'fashionAdvisor',
    helpfulVotes: 567,
    thanksReceived: 189,
    postsCount: 45,
    bio: 'Minimalist style advocate. Less is more!',
    followersCount: 987,
    followingCount: 234,
  },
  '4': {
    name: 'Alex Fashion',
    avatar: null,
    tier: 'styleContributor',
    helpfulVotes: 234,
    thanksReceived: 78,
    postsCount: 23,
    bio: 'Aspiring fashion designer. Love experimenting with bold colors.',
    followersCount: 456,
    followingCount: 567,
  },
  '5': {
    name: 'Casey Vogue',
    avatar: null,
    tier: 'styleContributor',
    helpfulVotes: 189,
    thanksReceived: 56,
    postsCount: 19,
    bio: 'Work fashion expert. Helping professionals look their best.',
    followersCount: 345,
    followingCount: 123,
  },
};

export default function UserProfileScreen({ navigation, route }: UserProfileScreenProps) {
  const { userId } = route.params;
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const { 
    isFollowing, 
    followUser, 
    unfollowUser, 
    getFollowersCount, 
    getFollowingCount,
    isFriend,
    sendFriendRequest,
    hasPendingRequestTo,
    hasPendingRequestFrom,
    getFriendsCount,
  } = useSocial();

  const isOwnProfile = user?.id === userId;
  const isFollowingUser = isFollowing(userId);
  const isFriendWithUser = isFriend(userId);
  const hasSentRequest = hasPendingRequestTo(userId);
  const hasReceivedRequest = hasPendingRequestFrom(userId);

  const mockUser = MOCK_USERS[userId];
  const userData = mockUser || {
    name: 'Fashion User',
    avatar: null,
    tier: 'none' as keyof typeof ContributorColors,
    helpfulVotes: 0,
    thanksReceived: 0,
    postsCount: 0,
    bio: 'New to Dripn',
    followersCount: 0,
    followingCount: 0,
  };

  const displayFollowersCount = isOwnProfile ? getFollowersCount() : userData.followersCount;
  const displayFollowingCount = isOwnProfile ? getFollowingCount() : userData.followingCount;

  const tierInfo = ContributorColors[userData.tier];

  const handleFollowPress = async () => {
    if (isFollowingUser) {
      await unfollowUser(userId);
    } else {
      await followUser(userId);
    }
  };

  const handleFriendPress = async () => {
    if (!isFriendWithUser && !hasSentRequest) {
      await sendFriendRequest(userId, userData.name);
    }
  };

  const getFriendButtonState = () => {
    if (isFriendWithUser) {
      return { icon: 'users' as const, label: 'Friends', disabled: true };
    }
    if (hasSentRequest) {
      return { icon: 'clock' as const, label: 'Pending', disabled: true };
    }
    if (hasReceivedRequest) {
      return { icon: 'user-check' as const, label: 'Accept Request', disabled: false };
    }
    return { icon: 'user-plus' as const, label: 'Add Friend', disabled: false };
  };

  const friendButtonState = getFriendButtonState();

  return (
    <ScreenScrollView>
      <View style={styles.profileSection}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
          {userData.avatar ? (
            <Image source={{ uri: userData.avatar }} style={styles.avatar} />
          ) : (
            <Feather name="user" size={48} color={theme.tabIconDefault} />
          )}
        </View>

        <ThemedText type="h2" style={styles.userName}>
          {userData.name}
        </ThemedText>

        {tierInfo ? (
          <View style={[styles.tierBadge, { backgroundColor: tierInfo.background }]}>
            <Feather name="award" size={14} color={tierInfo.text} />
            <ThemedText type="small" style={{ color: tierInfo.text, fontWeight: "600" }}>
              {tierInfo.label}
            </ThemedText>
          </View>
        ) : null}

        <ThemedText type="body" style={styles.bio}>
          {userData.bio}
        </ThemedText>

        {!isOwnProfile ? (
          <View style={styles.actionButtonsRow}>
            <Pressable
              onPress={handleFollowPress}
              style={({ pressed }) => [
                styles.followButton,
                {
                  backgroundColor: isFollowingUser ? theme.backgroundDefault : theme.link,
                  borderWidth: isFollowingUser ? 1 : 0,
                  borderColor: theme.link,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={isFollowingUser ? "user-check" : "user-plus"}
                size={16}
                color={isFollowingUser ? theme.link : "#FFFFFF"}
              />
              <ThemedText
                type="body"
                style={{
                  color: isFollowingUser ? theme.link : "#FFFFFF",
                  fontWeight: "600",
                }}
              >
                {isFollowingUser ? "Following" : "Follow"}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleFriendPress}
              disabled={friendButtonState.disabled}
              style={({ pressed }) => [
                styles.friendButton,
                {
                  backgroundColor: isFriendWithUser 
                    ? theme.backgroundSecondary 
                    : hasSentRequest 
                      ? theme.backgroundDefault 
                      : theme.link,
                  borderWidth: hasSentRequest || isFriendWithUser ? 1 : 0,
                  borderColor: theme.link,
                  opacity: pressed && !friendButtonState.disabled ? 0.8 : friendButtonState.disabled ? 0.6 : 1,
                },
              ]}
            >
              <Feather
                name={friendButtonState.icon}
                size={16}
                color={isFriendWithUser || hasSentRequest ? theme.link : "#FFFFFF"}
              />
              <ThemedText
                type="body"
                style={{
                  color: isFriendWithUser || hasSentRequest ? theme.link : "#FFFFFF",
                  fontWeight: "600",
                }}
              >
                {friendButtonState.label}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h3">{userData.postsCount}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Posts
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{displayFollowersCount}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Followers
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{displayFollowingCount}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Following
            </ThemedText>
          </View>
        </View>

        <View style={[styles.engagementRow, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.engagementItem}>
            <Feather name="thumbs-up" size={16} color={theme.link} />
            <ThemedText type="body" style={styles.engagementValue}>
              {userData.helpfulVotes}
            </ThemedText>
            <ThemedText type="small" style={styles.engagementLabel}>
              Helpful
            </ThemedText>
          </View>
          <View style={styles.engagementDivider} />
          <View style={styles.engagementItem}>
            <Feather name="heart" size={16} color={theme.link} />
            <ThemedText type="body" style={styles.engagementValue}>
              {userData.thanksReceived}
            </ThemedText>
            <ThemedText type="small" style={styles.engagementLabel}>
              Thanks
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Recent Posts
        </ThemedText>
        <View style={styles.emptyState}>
          <Feather name="image" size={48} color={theme.tabIconDefault} />
          <ThemedText type="body" style={styles.emptyText}>
            Posts will appear here
          </ThemedText>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  userName: {
    marginBottom: Spacing.sm,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
  },
  bio: {
    textAlign: "center",
    opacity: 0.8,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  followButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  friendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  statLabel: {
    opacity: 0.7,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  engagementItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  engagementValue: {
    fontWeight: "600",
  },
  engagementLabel: {
    opacity: 0.7,
  },
  engagementDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    opacity: 0.7,
  },
});
