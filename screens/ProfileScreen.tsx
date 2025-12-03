import React, { useState } from "react";
import { StyleSheet, View, Pressable, Image, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Spacing, BorderRadius, SubscriptionColors, ContributorColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/contexts/PostsContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Profile">;
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { posts, votePost, voteComparison, thankPost } = usePosts();
  const [activeTab, setActiveTab] = useState<"posts" | "advice">("posts");

  const userPosts = posts.filter((p) => p.userId === user?.id);

  const handleSettingsPress = () => {
    navigation.navigate("Settings");
  };

  const handleEditProfilePress = () => {
    navigation.navigate("EditProfile");
  };

  const handleSubscriptionPress = () => {
    navigation.navigate("Subscription");
  };

  const getSubscriptionBadge = () => {
    const tier = user?.subscriptionTier || "free";
    const colors = SubscriptionColors[tier];
    return (
      <View style={[styles.subscriptionBadge, { backgroundColor: colors.backgroundStart || colors.background }]}>
        <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600" }}>
          {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </ThemedText>
      </View>
    );
  };

  const getContributorBadge = () => {
    const tier = user?.contributorTier || "none";
    if (tier === "none") return null;
    const colors = ContributorColors[tier];
    return (
      <View style={[styles.contributorBadge, { backgroundColor: colors.background }]}>
        <Feather name="award" size={12} color={colors.text} />
        <ThemedText type="caption" style={{ color: colors.text, fontWeight: "600" }}>
          {colors.label}
        </ThemedText>
      </View>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <Pressable
          onPress={handleSettingsPress}
          style={({ pressed }) => [
            styles.settingsButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="settings" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.profileSection}>
        <Pressable onPress={handleEditProfilePress}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <Feather name="user" size={48} color={theme.tabIconDefault} />
            )}
            <View style={[styles.editAvatarBadge, { backgroundColor: theme.link }]}>
              <Feather name="edit-2" size={12} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        <ThemedText type="h2" style={styles.userName}>
          {user?.name || "Guest User"}
        </ThemedText>

        <View style={styles.badgesContainer}>
          {getSubscriptionBadge()}
          {getContributorBadge()}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h3">{user?.postsCount || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Posts
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{user?.helpfulVotes || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Helpful
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{user?.thanksReceived || 0}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Thanks
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={handleSubscriptionPress}
          style={({ pressed }) => [
            styles.upgradeButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="zap" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.upgradeButtonText}>
            {user?.subscriptionTier === "free" ? "Upgrade to Premium" : "Manage Subscription"}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.tabsContainer}>
        <Pressable
          onPress={() => setActiveTab("posts")}
          style={[
            styles.tab,
            {
              borderBottomColor: activeTab === "posts" ? theme.link : "transparent",
            },
          ]}
        >
          <Feather
            name="grid"
            size={20}
            color={activeTab === "posts" ? theme.link : theme.tabIconDefault}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "posts" ? theme.link : theme.tabIconDefault,
              fontWeight: activeTab === "posts" ? "600" : "400",
            }}
          >
            My Posts
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("advice")}
          style={[
            styles.tab,
            {
              borderBottomColor: activeTab === "advice" ? theme.link : "transparent",
            },
          ]}
        >
          <Feather
            name="message-circle"
            size={20}
            color={activeTab === "advice" ? theme.link : theme.tabIconDefault}
          />
          <ThemedText
            type="body"
            style={{
              color: activeTab === "advice" ? theme.link : theme.tabIconDefault,
              fontWeight: activeTab === "advice" ? "600" : "400",
            }}
          >
            My Advice
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.contentSection}>
        {activeTab === "posts" ? (
          userPosts.length > 0 ? (
            <View style={styles.postsContainer}>
              {userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => {}}
                  onVote={votePost}
                  onComparisonVote={voteComparison}
                  onThank={thankPost}
                  compact
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="camera" size={48} color={theme.tabIconDefault} />
              <ThemedText type="h3" style={styles.emptyTitle}>
                No posts yet
              </ThemedText>
              <ThemedText type="body" style={styles.emptySubtitle}>
                Share your first outfit to get style advice
              </ThemedText>
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={48} color={theme.tabIconDefault} />
            <ThemedText type="h3" style={styles.emptyTitle}>
              No advice given yet
            </ThemedText>
            <ThemedText type="body" style={styles.emptySubtitle}>
              Help others with their style choices to build your reputation
            </ThemedText>
          </View>
        )}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: Spacing.md,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
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
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    marginBottom: Spacing.sm,
  },
  badgesContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  subscriptionBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  contributorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
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
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
  },
  contentSection: {
    minHeight: 200,
  },
  postsContainer: {
    gap: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
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
