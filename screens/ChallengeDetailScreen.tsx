import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useGamification, ChallengeSubmission } from "@/contexts/GamificationContext";
import { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type NavigationProp = NativeStackNavigationProp<DiscoverStackParamList>;
type RouteType = RouteProp<DiscoverStackParamList, "ChallengeDetail">;

type ViewMode = "entries" | "leaderboard";

export default function ChallengeDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { challengeId } = route.params;
  const { theme } = useTheme();
  const {
    challenges,
    getChallengeSubmissions,
    getChallengeLeaderboard,
    voteOnSubmission,
    hasVotedOnSubmission,
    isLoading,
  } = useGamification();

  const [viewMode, setViewMode] = useState<ViewMode>("entries");
  const [votingId, setVotingId] = useState<string | null>(null);

  const challenge = challenges.find((c) => c.id === challengeId);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={{ marginTop: Spacing.md }}>
          Loading challenge...
        </ThemedText>
      </ThemedView>
    );
  }
  const submissions = useMemo(
    () => getChallengeSubmissions(challengeId),
    [challengeId, getChallengeSubmissions]
  );
  const leaderboard = useMemo(
    () => getChallengeLeaderboard(challengeId),
    [challengeId, getChallengeLeaderboard]
  );

  const getTimeRemaining = (endDate: string): string => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Challenge ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} days, ${hours} hours remaining`;
    if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours} hours, ${minutes} minutes remaining`;
    }
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes} minutes remaining`;
  };

  const handleVote = async (submissionId: string) => {
    if (hasVotedOnSubmission(submissionId)) {
      Alert.alert("Already Voted", "You have already voted for this entry.");
      return;
    }

    setVotingId(submissionId);
    try {
      await voteOnSubmission(submissionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Error", "Failed to submit vote. Please try again.");
    } finally {
      setVotingId(null);
    }
  };

  if (!challenge) {
    return (
      <ThemedView style={styles.notFoundContainer}>
        <Feather name="alert-circle" size={48} color={theme.tabIconDefault} />
        <ThemedText type="h3">Challenge Not Found</ThemedText>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </ThemedView>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <Card elevation={2} style={styles.challengeInfoCard}>
        <View style={styles.challengeHeader}>
          <View style={styles.themeTag}>
            <Feather name="tag" size={14} color={theme.link} />
            <ThemedText type="body" style={{ color: theme.link }}>
              {challenge.theme}
            </ThemedText>
          </View>
          {challenge.isActive ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.link + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.link }]} />
              <ThemedText type="small" style={{ color: theme.link }}>
                Active
              </ThemedText>
            </View>
          ) : (
            <View
              style={[styles.statusBadge, { backgroundColor: theme.tabIconDefault + "20" }]}
            >
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                Ended
              </ThemedText>
            </View>
          )}
        </View>

        <ThemedText type="h2" style={styles.challengeTitle}>
          {challenge.title}
        </ThemedText>
        <ThemedText type="body" style={styles.challengeDescription}>
          {challenge.description}
        </ThemedText>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="users" size={16} color={theme.tabIconDefault} />
            <ThemedText type="body">{challenge.participantsCount}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Participants
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="gift" size={16} color={theme.link} />
            <ThemedText type="body" style={{ color: theme.link }}>
              {challenge.rewardPoints}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Points
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="image" size={16} color={theme.tabIconDefault} />
            <ThemedText type="body">{submissions.length}</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Entries
            </ThemedText>
          </View>
        </View>

        {challenge.isActive ? (
          <View style={[styles.timerCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="clock" size={16} color={theme.tabIconDefault} />
            <ThemedText type="body">{getTimeRemaining(challenge.endDate)}</ThemedText>
          </View>
        ) : null}

        {challenge.isActive && !challenge.userParticipated ? (
          <Button
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate("ChallengeSubmission", { challengeId: challenge.id });
            }}
            style={styles.submitButton}
          >
            Submit Your Entry
          </Button>
        ) : null}

        {challenge.userParticipated ? (
          <View style={[styles.participatedBadge, { backgroundColor: theme.link + "15" }]}>
            <Feather name="check-circle" size={16} color={theme.link} />
            <ThemedText type="body" style={{ color: theme.link }}>
              You've submitted an entry
            </ThemedText>
          </View>
        ) : null}
      </Card>

      <View style={styles.viewModeContainer}>
        <Pressable
          onPress={() => {
            setViewMode("entries");
            Haptics.selectionAsync();
          }}
          style={[
            styles.viewModeTab,
            {
              backgroundColor:
                viewMode === "entries" ? theme.link : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name="grid"
            size={16}
            color={viewMode === "entries" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="body"
            style={{
              color: viewMode === "entries" ? "#FFFFFF" : theme.text,
              fontWeight: viewMode === "entries" ? "600" : "400",
            }}
          >
            All Entries
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            setViewMode("leaderboard");
            Haptics.selectionAsync();
          }}
          style={[
            styles.viewModeTab,
            {
              backgroundColor:
                viewMode === "leaderboard" ? theme.link : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name="award"
            size={16}
            color={viewMode === "leaderboard" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="body"
            style={{
              color: viewMode === "leaderboard" ? "#FFFFFF" : theme.text,
              fontWeight: viewMode === "leaderboard" ? "600" : "400",
            }}
          >
            Leaderboard
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderSubmissionCard = ({ item, index }: { item: ChallengeSubmission; index: number }) => {
    const hasVoted = hasVotedOnSubmission(item.id);
    const isVoting = votingId === item.id;
    const showRank = viewMode === "leaderboard";

    return (
      <Card elevation={1} style={styles.submissionCard}>
        {showRank ? (
          <View style={styles.rankBadge}>
            <ThemedText
              type="h3"
              style={{
                color:
                  index === 0
                    ? "#FFD700"
                    : index === 1
                    ? "#C0C0C0"
                    : index === 2
                    ? "#CD7F32"
                    : theme.text,
              }}
            >
              #{index + 1}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.userInfo}>
          {item.userAvatar ? (
            <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.link }]}>
              <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                {item.userName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={styles.userDetails}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {item.userName}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              {new Date(item.submittedAt).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>

        <Image source={{ uri: item.imageUri }} style={styles.submissionImage} />

        {item.caption ? (
          <ThemedText type="body" style={styles.caption}>
            {item.caption}
          </ThemedText>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => handleVote(item.id)}
            disabled={hasVoted || isVoting || !challenge.isActive}
            style={[
              styles.voteButton,
              {
                backgroundColor: hasVoted ? theme.link : theme.backgroundDefault,
                opacity: !challenge.isActive ? 0.5 : 1,
              },
            ]}
          >
            <Feather
              name={hasVoted ? "heart" : "heart"}
              size={18}
              color={hasVoted ? "#FFFFFF" : theme.link}
            />
            <ThemedText
              type="body"
              style={{
                color: hasVoted ? "#FFFFFF" : theme.link,
                fontWeight: "600",
              }}
            >
              {item.votes}
            </ThemedText>
          </Pressable>

          {!challenge.isActive && index < 3 ? (
            <View
              style={[
                styles.winnerBadge,
                {
                  backgroundColor:
                    index === 0
                      ? "#FFD70020"
                      : index === 1
                      ? "#C0C0C020"
                      : "#CD7F3220",
                },
              ]}
            >
              <Feather
                name="award"
                size={14}
                color={index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : "#CD7F32"}
              />
              <ThemedText
                type="small"
                style={{
                  color: index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : "#CD7F32",
                }}
              >
                {index === 0 ? "Winner" : index === 1 ? "2nd Place" : "3rd Place"}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="image" size={48} color={theme.tabIconDefault} />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Entries Yet
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        Be the first to submit your outfit!
      </ThemedText>
      {challenge.isActive ? (
        <Button
          onPress={() =>
            navigation.navigate("ChallengeSubmission", { challengeId: challenge.id })
          }
          style={styles.emptyButton}
        >
          Submit Entry
        </Button>
      ) : null}
    </View>
  );

  const displayData = viewMode === "leaderboard" ? leaderboard : submissions;

  return (
    <ScreenFlatList
      data={displayData}
      keyExtractor={(item) => item.id}
      renderItem={renderSubmissionCard}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    gap: Spacing.lg,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  headerContent: {
    gap: Spacing.lg,
  },
  challengeInfoCard: {
    gap: Spacing.md,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  themeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  challengeTitle: {
    marginTop: Spacing.xs,
  },
  challengeDescription: {
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: Spacing.md,
  },
  statItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  timerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  participatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  viewModeContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  submissionCard: {
    gap: Spacing.md,
  },
  rankBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userDetails: {
    flex: 1,
    gap: 2,
  },
  submissionImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
  },
  caption: {
    opacity: 0.9,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  winnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
  },
  emptyButton: {
    marginTop: Spacing.md,
  },
});
