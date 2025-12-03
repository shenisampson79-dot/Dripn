import React from "react";
import { StyleSheet, View, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ContributorColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

type UserProfileScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "UserProfile">;
  route: RouteProp<CommunityStackParamList, "UserProfile">;
};

export default function UserProfileScreen({ navigation, route }: UserProfileScreenProps) {
  const { userId } = route.params;
  const { theme } = useTheme();

  const userData = {
    id: userId,
    name: "Emma Style",
    avatar: null,
    tier: "fashionGuru" as keyof typeof ContributorColors,
    helpfulVotes: 1245,
    thanksReceived: 456,
    postsCount: 89,
    bio: "Fashion enthusiast and style consultant. Love helping others find their perfect look!",
  };

  const tierInfo = ContributorColors[userData.tier];

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

        <View style={[styles.tierBadge, { backgroundColor: tierInfo.background }]}>
          <Feather name="award" size={14} color={tierInfo.text} />
          <ThemedText type="small" style={{ color: tierInfo.text, fontWeight: "600" }}>
            {tierInfo.label}
          </ThemedText>
        </View>

        <ThemedText type="body" style={styles.bio}>
          {userData.bio}
        </ThemedText>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h3">{userData.postsCount}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Posts
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{userData.helpfulVotes}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
              Helpful
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText type="h3">{userData.thanksReceived}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>
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
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
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
