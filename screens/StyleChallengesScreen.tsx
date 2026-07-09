import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useGamification, StyleChallenge } from "@/contexts/GamificationContext";
import { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type NavigationProp = NativeStackNavigationProp<DiscoverStackParamList>;

type FilterType = "active" | "past" | "all";

export default function StyleChallengesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { challenges, getChallengeSubmissions, isLoading } = useGamification();
  const [filter, setFilter] = useState<FilterType>("active");

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={{ marginTop: Spacing.md }}>
          Loading challenges...
        </ThemedText>
      </ThemedView>
    );
  }

  const filteredChallenges = useMemo(() => {
    switch (filter) {
      case "active":
        return challenges.filter((c) => c.isActive);
      case "past":
        return challenges.filter((c) => !c.isActive);
      default:
        return challenges;
    }
  }, [challenges, filter]);

  const getTimeRemaining = (endDate: string): string => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m left`;
  };

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      {(["active", "past", "all"] as FilterType[]).map((filterType) => (
        <Pressable
          key={filterType}
          onPress={() => {
            setFilter(filterType);
            Haptics.selectionAsync();
          }}
          style={[
            styles.filterTab,
            {
              backgroundColor:
                filter === filterType ? theme.link : theme.backgroundSecondary,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{
              color: filter === filterType ? "#FFFFFF" : theme.text,
              fontWeight: filter === filterType ? "600" : "400",
            }}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderChallengeCard = ({ item }: { item: StyleChallenge }) => {
    const submissions = getChallengeSubmissions(item.id);
    const topSubmission = submissions.length > 0 ? submissions[0] : null;

    return (
      <Card
        elevation={2}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("ChallengeDetail", { challengeId: item.id });
        }}
        style={styles.challengeCard}
      >
        <View style={styles.cardHeader}>
          <View style={styles.themeTag}>
            <Feather name="tag" size={12} color={theme.link} />
            <ThemedText type="small" style={{ color: theme.link }}>
              {item.theme}
            </ThemedText>
          </View>
          {item.isActive ? (
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

        <ThemedText type="h3" style={styles.challengeTitle}>
          {item.title}
        </ThemedText>
        <ThemedText type="body" style={styles.challengeDescription}>
          {item.description}
        </ThemedText>

        {topSubmission ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: topSubmission.imageUri }}
              style={styles.previewImage}
            />
            <View style={styles.previewOverlay}>
              <ThemedText type="caption" style={styles.previewText}>
                Top Entry
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Feather name="users" size={14} color={theme.tabIconDefault} />
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                {item.participantsCount} participants
              </ThemedText>
            </View>
            <View style={styles.stat}>
              <Feather name="gift" size={14} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.link }}>
                {item.rewardPoints} pts
              </ThemedText>
            </View>
          </View>

          {item.isActive ? (
            <View style={styles.timerRow}>
              <Feather name="clock" size={14} color={theme.tabIconDefault} />
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                {getTimeRemaining(item.endDate)}
              </ThemedText>
            </View>
          ) : null}

          {item.userParticipated ? (
            <View style={[styles.participatedBadge, { backgroundColor: theme.link + "15" }]}>
              <Feather name="check-circle" size={14} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.link }}>
                You participated
              </ThemedText>
            </View>
          ) : item.isActive ? (
            <Pressable
              style={[styles.joinButton, { backgroundColor: theme.link }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("ChallengeSubmission", { challengeId: item.id });
              }}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Join Challenge
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="flag" size={48} color={theme.tabIconDefault} />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Challenges Found
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        {filter === "active"
          ? "Check back soon for new style challenges!"
          : "No past challenges to display."}
      </ThemedText>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.introCard}>
        <View style={[styles.introIcon, { backgroundColor: theme.link + "15" }]}>
          <Feather name="award" size={24} color={theme.link} />
        </View>
        <View style={styles.introText}>
          <ThemedText type="h3">Weekly Style Challenges</ThemedText>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            Compete with the community, show off your style, and win rewards!
          </ThemedText>
        </View>
      </View>
      {renderFilterTabs()}
    </View>
  );

  return (
    <ScreenFlatList
      data={filteredChallenges}
      keyExtractor={(item) => item.id}
      renderItem={renderChallengeCard}
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
  headerContent: {
    gap: Spacing.lg,
  },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  introText: {
    flex: 1,
    gap: Spacing.xs,
  },
  filterContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  challengeCard: {
    gap: Spacing.md,
  },
  cardHeader: {
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
  previewContainer: {
    height: 120,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  previewText: {
    color: "#FFFFFF",
  },
  cardFooter: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  participatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignSelf: "flex-start",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
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
});
