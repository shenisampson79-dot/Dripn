import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import aiFeatureSuggestionsService, {
  FeatureSuggestion,
  FeatureCategory,
} from "@/services/AIFeatureSuggestionsService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type FeatureSuggestionsScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "FeatureSuggestions">;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    new: "New",
    reviewed: "Reviewed",
    approved: "Approved",
    rejected: "Rejected",
    implemented: "Implemented",
  };
  return labels[status] || status;
};

interface SuggestionCardProps {
  suggestion: FeatureSuggestion;
  theme: any;
  onVote: (id: string, upvote: boolean) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

function SuggestionCard({
  suggestion,
  theme,
  onVote,
  expanded,
  onToggleExpand,
}: SuggestionCardProps) {
  const categoryInfo = aiFeatureSuggestionsService.getCategoryInfo().find(
    (c) => c.id === suggestion.category
  );

  const getPriorityColors = () => {
    switch (suggestion.priority) {
      case 'high':
        return { bg: `${theme.error || theme.primary}25`, text: theme.error || theme.primary };
      case 'medium':
        return { bg: `${theme.warning || theme.secondary}25`, text: theme.warning || theme.secondary };
      case 'low':
        return { bg: `${theme.success || theme.accent}25`, text: theme.success || theme.accent };
      default:
        return { bg: `${theme.primary}25`, text: theme.primary };
    }
  };

  const getStatusColors = () => {
    switch (suggestion.status) {
      case 'new':
        return { bg: `${theme.link}25`, text: theme.link };
      case 'reviewed':
        return { bg: `${theme.warning || theme.secondary}25`, text: theme.warning || theme.secondary };
      case 'approved':
        return { bg: `${theme.success || theme.accent}25`, text: theme.success || theme.accent };
      case 'rejected':
        return { bg: `${theme.error || theme.primary}25`, text: theme.error || theme.primary };
      case 'implemented':
        return { bg: `${theme.primary}25`, text: theme.primary };
      default:
        return { bg: `${theme.primary}25`, text: theme.primary };
    }
  };

  const priorityColors = getPriorityColors();
  const statusColors = getStatusColors();

  return (
    <Card elevation={1} onPress={onToggleExpand} style={styles.suggestionCard}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <Feather
            name={categoryInfo?.icon as any || "star"}
            size={14}
            color={theme.primary}
          />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
            {categoryInfo?.label || suggestion.category}
          </ThemedText>
        </View>
        <View style={styles.badges}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: priorityColors.bg },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: priorityColors.text, fontWeight: "600" }}
            >
              {suggestion.priority.toUpperCase()}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors.bg },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: statusColors.text, fontWeight: "600" }}
            >
              {getStatusLabel(suggestion.status)}
            </ThemedText>
          </View>
        </View>
      </View>

      <ThemedText type="subtitle" style={styles.suggestionTitle}>
        {suggestion.title}
      </ThemedText>

      <ThemedText
        type="body"
        style={[styles.suggestionDescription, { color: theme.textSecondary }]}
        numberOfLines={expanded ? undefined : 2}
      >
        {suggestion.description}
      </ThemedText>

      {expanded ? (
        <View style={styles.expandedContent}>
          <View style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Rationale:
            </ThemedText>
            <ThemedText type="body" style={styles.detailText}>
              {suggestion.rationale}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              User Benefit:
            </ThemedText>
            <ThemedText type="body" style={styles.detailText}>
              {suggestion.userBenefit}
            </ThemedText>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Impact
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {suggestion.estimatedImpact.charAt(0).toUpperCase() +
                  suggestion.estimatedImpact.slice(1)}
              </ThemedText>
            </View>
            <View style={styles.metric}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Complexity
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {suggestion.implementationComplexity.charAt(0).toUpperCase() +
                  suggestion.implementationComplexity.slice(1)}
              </ThemedText>
            </View>
            <View style={styles.metric}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Tier
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {suggestion.targetTier.toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.metric}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                AI Confidence
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {Math.round(suggestion.aiConfidence * 100)}%
              </ThemedText>
            </View>
          </View>

          {suggestion.relatedTrends && suggestion.relatedTrends.length > 0 ? (
            <View style={styles.trendsSection}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Related Trends:
              </ThemedText>
              <View style={styles.trendTags}>
                {suggestion.relatedTrends.map((trend, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.trendTag,
                      { backgroundColor: `${theme.primary}20` },
                    ]}
                  >
                    <ThemedText type="small" style={{ color: theme.primary }}>
                      {trend}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.voteSection}>
          <Pressable
            onPress={() => onVote(suggestion.id, true)}
            style={styles.voteButton}
          >
            <Feather name="thumbs-up" size={18} color={theme.primary} />
          </Pressable>
          <ThemedText type="body" style={styles.voteCount}>
            {suggestion.votes}
          </ThemedText>
          <Pressable
            onPress={() => onVote(suggestion.id, false)}
            style={styles.voteButton}
          >
            <Feather name="thumbs-down" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </View>
    </Card>
  );
}

export default function FeatureSuggestionsScreen({
  navigation,
}: FeatureSuggestionsScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [suggestions, setSuggestions] = useState<FeatureSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  const loadSuggestions = useCallback(async (forceRefresh = false) => {
    try {
      await aiFeatureSuggestionsService.initialize();
      const data = await aiFeatureSuggestionsService.generateFeatureSuggestions(forceRefresh);
      setSuggestions(data);
      setLastAnalysis(aiFeatureSuggestionsService.getLastAnalysisDate());
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSuggestions(true);
  }, [loadSuggestions]);

  const handleVote = useCallback(async (id: string, upvote: boolean) => {
    await aiFeatureSuggestionsService.voteSuggestion(id, upvote);
    setSuggestions(aiFeatureSuggestionsService.getSuggestions());
  }, []);

  const categories = aiFeatureSuggestionsService.getCategoryInfo();

  const filteredSuggestions = selectedCategory
    ? suggestions.filter((s) => s.category === selectedCategory)
    : suggestions;

  const summary = aiFeatureSuggestionsService.getAnalysisSummary();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md }}>
          Analyzing trends and feedback...
        </ThemedText>
      </View>
    );
  }

  return (
    <ScreenScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Feather name="cpu" size={24} color={theme.primary} />
          <ThemedText type="title" style={styles.headerTitle}>
            AI Feature Lab
          </ThemedText>
        </View>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Smart suggestions powered by trend analysis and member feedback
        </ThemedText>
        {lastAnalysis ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            Last updated: {new Date(lastAnalysis).toLocaleDateString()}
          </ThemedText>
        ) : null}
      </View>

      <Card elevation={2} style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <ThemedText type="title" style={{ color: theme.primary }}>
              {summary.totalSuggestions}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Total Ideas
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText type="title" style={{ color: theme.error || theme.primary }}>
              {summary.byPriority.high || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              High Priority
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText type="title" style={{ color: theme.link }}>
              {summary.byStatus.new || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              New Ideas
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.filterSection}>
        <ThemedText type="subtitle" style={styles.filterTitle}>
          Filter by Category
        </ThemedText>
        <View style={styles.categoryFilters}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              styles.categoryChip,
              {
                backgroundColor: selectedCategory === null
                  ? theme.primary
                  : `${theme.primary}20`,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: selectedCategory === null ? "#fff" : theme.primary,
                fontWeight: "600",
              }}
            >
              All
            </ThemedText>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === cat.id
                    ? theme.primary
                    : `${theme.primary}20`,
                },
              ]}
            >
              <Feather
                name={cat.icon as any}
                size={12}
                color={selectedCategory === cat.id ? "#fff" : theme.primary}
              />
              <ThemedText
                type="small"
                style={{
                  color: selectedCategory === cat.id ? "#fff" : theme.primary,
                  fontWeight: "600",
                  marginLeft: 4,
                }}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.suggestionsSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Feature Suggestions ({filteredSuggestions.length})
        </ThemedText>
        {filteredSuggestions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No suggestions in this category
            </ThemedText>
          </View>
        ) : (
          filteredSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              theme={theme}
              onVote={handleVote}
              expanded={expandedId === suggestion.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === suggestion.id ? null : suggestion.id)
              }
            />
          ))
        )}
      </View>

      <View style={styles.infoSection}>
        <Feather name="info" size={16} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
          Suggestions are generated by analyzing fashion trends, user feedback patterns, and app usage data. Vote on ideas you like to help prioritize development.
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    marginLeft: Spacing.sm,
  },
  summaryCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  filterSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  filterTitle: {
    marginBottom: Spacing.sm,
  },
  categoryFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  suggestionsSection: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  suggestionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  badges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  suggestionTitle: {
    marginBottom: Spacing.xs,
  },
  suggestionDescription: {
    lineHeight: 20,
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
  },
  detailRow: {
    marginBottom: Spacing.sm,
  },
  detailText: {
    marginTop: 2,
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(150, 150, 150, 0.2)",
  },
  metric: {
    alignItems: "center",
  },
  trendsSection: {
    marginTop: Spacing.md,
  },
  trendTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  trendTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(150, 150, 150, 0.1)",
  },
  voteSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  voteButton: {
    padding: Spacing.xs,
  },
  voteCount: {
    marginHorizontal: Spacing.sm,
    fontWeight: "600",
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
});
