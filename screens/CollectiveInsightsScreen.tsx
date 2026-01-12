import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Switch } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type CollectiveInsightsScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "CollectiveInsights">;
};

interface InsightsData {
  communitySize: number;
  colorAnalysisTrends: {
    mostPopularSeason: string;
    yourSeasonPercentile: string;
  };
  wardrobeTrends: {
    avgItemCount: number;
    mostCommonCategory: string;
    colorDiversity: string;
  };
  trendForecasts: {
    trend: string;
    adoption: string;
    longevity: string;
  }[];
  confidenceBands: {
    description: string;
    reliability: string;
  };
}

interface TrendsData {
  emergingTrends: {
    name: string;
    adoptionTiming: string;
    longevity: string;
  }[];
  decliningTrends: string[];
  stableTrends: string[];
  investmentAdvice: string;
}

interface PeerComparisonData {
  yourStats: {
    wardrobeSize: number;
    percentile: string;
  };
  communityAverage: {
    wardrobeSize: number;
    colorDiversity: number;
    categoryBalance: string;
  };
  recommendations: string[];
  styleExperimentation: {
    yourLevel: string;
    communityAverage: string;
  };
}

type TabType = "insights" | "trends" | "compare";

export default function CollectiveInsightsScreen({ navigation }: CollectiveInsightsScreenProps) {
  const { theme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>("insights");
  const [isLoading, setIsLoading] = useState(true);
  const [optedIn, setOptedIn] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [comparison, setComparison] = useState<PeerComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.get<InsightsData>("/api/collective/insights");
      setInsights(data);
    } catch (err: any) {
      setError(err.message || "Failed to load insights");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTrends = useCallback(async () => {
    if (trends) return;
    setIsLoading(true);
    try {
      const data = await apiService.get<TrendsData>("/api/collective/trends");
      setTrends(data);
    } catch (err: any) {
      setError(err.message || "Failed to load trends");
    } finally {
      setIsLoading(false);
    }
  }, [trends]);

  const loadComparison = useCallback(async () => {
    if (comparison) return;
    setIsLoading(true);
    try {
      const data = await apiService.get<PeerComparisonData>("/api/collective/peer-comparison");
      setComparison(data);
    } catch (err: any) {
      setError(err.message || "Failed to load comparison");
    } finally {
      setIsLoading(false);
    }
  }, [comparison]);

  const handleOptInToggle = async (value: boolean) => {
    setOptedIn(value);
    try {
      await apiService.post("/api/collective/opt-in", { optIn: value });
    } catch (err) {
      console.error("Opt-in toggle error:", err);
    }
  };

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    if (activeTab === "trends" && !trends) {
      loadTrends();
    } else if (activeTab === "compare" && !comparison) {
      loadComparison();
    }
  }, [activeTab, trends, comparison, loadTrends, loadComparison]);

  const getAdoptionColor = (adoption: string) => {
    switch (adoption.toLowerCase()) {
      case "rising": return "#4CAF50";
      case "peak": return "#FF9800";
      case "declining": return "#F44336";
      default: return theme.link;
    }
  };

  const renderTab = (id: TabType, label: string, icon: string) => (
    <Pressable
      onPress={() => setActiveTab(id)}
      style={[
        styles.tab,
        activeTab === id && { backgroundColor: theme.link + "20", borderColor: theme.link },
        { borderColor: theme.border },
      ]}
    >
      <Feather name={icon as any} size={18} color={activeTab === id ? theme.link : theme.tabIconDefault} />
      <ThemedText
        type="caption"
        style={{ marginLeft: Spacing.xs, color: activeTab === id ? theme.link : theme.tabIconDefault }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderInsights = () => {
    if (!insights) return null;

    return (
      <>
        <Card style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: theme.link + "10" }]}>
              <Feather name="users" size={24} color={theme.link} />
              <ThemedText type="h2" style={{ color: theme.link, marginTop: Spacing.xs }}>
                {insights.communitySize.toLocaleString()}
              </ThemedText>
              <ThemedText type="caption">Community</ThemedText>
            </View>
            <View style={[styles.statItem, { backgroundColor: "#4CAF50" + "10" }]}>
              <Feather name="droplet" size={24} color="#4CAF50" />
              <ThemedText type="h3" style={{ color: "#4CAF50", marginTop: Spacing.xs }}>
                {insights.colorAnalysisTrends.mostPopularSeason}
              </ThemedText>
              <ThemedText type="caption">Top Season</ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Your Standing</ThemedText>
          <View style={[styles.percentileBox, { backgroundColor: theme.link + "10" }]}>
            <ThemedText type="h2" style={{ color: theme.link }}>
              {insights.colorAnalysisTrends.yourSeasonPercentile}
            </ThemedText>
            <ThemedText type="caption" style={{ marginTop: Spacing.xs }}>
              of users share your color season
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Community Wardrobe Trends</ThemedText>
          <View style={styles.trendRow}>
            <ThemedText type="body">Average Items</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{insights.wardrobeTrends.avgItemCount}</ThemedText>
          </View>
          <View style={styles.trendRow}>
            <ThemedText type="body">Most Common Category</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{insights.wardrobeTrends.mostCommonCategory}</ThemedText>
          </View>
          <View style={styles.trendRow}>
            <ThemedText type="body">Color Diversity</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{insights.wardrobeTrends.colorDiversity}</ThemedText>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Trend Forecasts</ThemedText>
          {insights.trendForecasts.map((forecast, i) => (
            <View key={i} style={[styles.forecastItem, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={styles.forecastHeader}>
                <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>{forecast.trend}</ThemedText>
                <View style={[styles.adoptionBadge, { backgroundColor: getAdoptionColor(forecast.adoption) }]}>
                  <ThemedText type="small" style={{ color: "#FFF" }}>{forecast.adoption}</ThemedText>
                </View>
              </View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.xs }}>
                Longevity: {forecast.longevity}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.optInRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>Contribute Data</ThemedText>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                Help improve insights (anonymized)
              </ThemedText>
            </View>
            <Switch
              value={optedIn}
              onValueChange={handleOptInToggle}
              trackColor={{ true: theme.link, false: "#E0E0E0" }}
            />
          </View>
        </Card>

        <View style={styles.disclaimer}>
          <Feather name="shield" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.tabIconDefault, flex: 1 }}>
            {insights.confidenceBands.description}. Reliability: {insights.confidenceBands.reliability}
          </ThemedText>
        </View>
      </>
    );
  };

  const renderTrends = () => {
    if (!trends) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>Loading trend forecasts...</ThemedText>
        </View>
      );
    }

    return (
      <>
        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
            <Feather name="trending-up" size={18} /> Emerging Trends
          </ThemedText>
          {trends.emergingTrends.map((trend, i) => (
            <View key={i} style={[styles.trendItem, { backgroundColor: "#4CAF50" + "10" }]}>
              <View style={styles.trendItemHeader}>
                <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>{trend.name}</ThemedText>
                <ThemedText type="caption" style={{ color: "#4CAF50" }}>{trend.adoptionTiming}</ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                {trend.longevity}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
            <Feather name="minus" size={18} /> Stable Trends
          </ThemedText>
          <View style={styles.tagGrid}>
            {trends.stableTrends.map((trend, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: theme.link + "15" }]}>
                <ThemedText type="caption" style={{ color: theme.link }}>{trend}</ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
            <Feather name="trending-down" size={18} /> Declining
          </ThemedText>
          <View style={styles.tagGrid}>
            {trends.decliningTrends.map((trend, i) => (
              <View key={i} style={[styles.tag, { backgroundColor: "#F44336" + "15" }]}>
                <ThemedText type="caption" style={{ color: "#F44336" }}>{trend}</ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <Card style={[styles.adviceCard, { backgroundColor: theme.link + "10" }]}>
          <Feather name="zap" size={24} color={theme.link} style={{ alignSelf: "center", marginBottom: Spacing.sm }} />
          <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.sm }}>Investment Advice</ThemedText>
          <ThemedText type="body" style={{ textAlign: "center" }}>{trends.investmentAdvice}</ThemedText>
        </Card>
      </>
    );
  };

  const renderComparison = () => {
    if (!comparison) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>Loading peer comparison...</ThemedText>
        </View>
      );
    }

    return (
      <>
        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Your Wardrobe</ThemedText>
          <View style={styles.comparisonRow}>
            <View style={[styles.yourStat, { backgroundColor: theme.link + "10" }]}>
              <ThemedText type="h1" style={{ color: theme.link }}>{comparison.yourStats.wardrobeSize}</ThemedText>
              <ThemedText type="caption">Your Items</ThemedText>
            </View>
            <Feather name="arrow-right" size={24} color={theme.tabIconDefault} />
            <View style={[styles.avgStat, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="h2">{comparison.communityAverage.wardrobeSize}</ThemedText>
              <ThemedText type="caption">Community Avg</ThemedText>
            </View>
          </View>
          <View style={[styles.percentileBadge, { backgroundColor: theme.link + "20", alignSelf: "center", marginTop: Spacing.md }]}>
            <ThemedText type="body" style={{ color: theme.link, fontWeight: "600" }}>
              {comparison.yourStats.percentile}
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Style Experimentation</ThemedText>
          <View style={styles.experimentRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>You</ThemedText>
              <ThemedText type="h3" style={{ color: theme.link }}>{comparison.styleExperimentation.yourLevel}</ThemedText>
            </View>
            <View style={styles.divider} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>Community</ThemedText>
              <ThemedText type="h3">{comparison.styleExperimentation.communityAverage}</ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Community Insights</ThemedText>
          <View style={styles.insightRow}>
            <ThemedText type="body">Color Diversity Score</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{comparison.communityAverage.colorDiversity}/10</ThemedText>
          </View>
          <View style={styles.insightRow}>
            <ThemedText type="body">Category Balance</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{comparison.communityAverage.categoryBalance}</ThemedText>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Recommendations</ThemedText>
          {comparison.recommendations.map((rec, i) => (
            <View key={i} style={styles.recItem}>
              <Feather name="check-circle" size={18} color="#4CAF50" />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{rec}</ThemedText>
            </View>
          ))}
        </Card>
      </>
    );
  };

  return (
    <ScreenScrollView style={styles.container}>
      <Card style={styles.introCard}>
        <View style={styles.introHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.link + "20" }]}>
            <Feather name="bar-chart-2" size={28} color={theme.link} />
          </View>
          <View style={styles.introText}>
            <ThemedText type="h3">Fashion Intelligence</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              Community trends and peer insights
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.tabRow}>
        {renderTab("insights", "Insights", "pie-chart")}
        {renderTab("trends", "Trends", "trending-up")}
        {renderTab("compare", "Compare", "users")}
      </View>

      {isLoading && activeTab === "insights" ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>Loading community insights...</ThemedText>
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <ThemedText type="body" style={{ color: theme.error }}>{error}</ThemedText>
        </Card>
      ) : (
        <>
          {activeTab === "insights" && renderInsights()}
          {activeTab === "trends" && renderTrends()}
          {activeTab === "compare" && renderComparison()}
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  introCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  introHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  introText: {
    flex: 1,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  loadingContainer: {
    padding: Spacing.xl * 2,
    alignItems: "center",
  },
  errorCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
  },
  statsCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  sectionCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  percentileBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  trendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  forecastItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  forecastHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  adoptionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  optInRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.lg,
    padding: Spacing.md,
  },
  trendItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  trendItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  adviceCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  yourStat: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  avgStat: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  percentileBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  experimentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#E0E0E0",
    marginHorizontal: Spacing.md,
  },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  recItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
});
