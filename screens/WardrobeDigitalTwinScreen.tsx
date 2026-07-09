import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type WardrobeDigitalTwinScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "WardrobeDigitalTwin">;
};

interface DigitalTwinData {
  totalItems: number;
  healthScore: number;
  categoryDistribution: Record<string, number>;
  colorDistribution: Record<string, number>;
  versatilityScore: number;
  wearPredictions: { id: string; name: string; predictedWears: number; lastWorn: string }[];
  gaps: string[];
  investmentPieces: any[];
}

interface TimeMachineData {
  futureVision: string;
  trendingPieces: string[];
  investmentRecommendations: { item: string; priority: string; reason: string }[];
  phasedPlan: { month: number; action: string; budget: string }[];
  styleEvolution: string;
}

interface CapsulePlanData {
  capsuleItems: { type: string; color: string; versatility: number; occasions: string[] }[];
  totalPieces: number;
  outfitCombinations: number;
  weeklyPlan: { day: string; outfit: string; occasion: string }[];
  packingList: string[];
  stylingTips: string[];
}

type TabType = "dashboard" | "capsule" | "future";

export default function WardrobeDigitalTwinScreen({ navigation }: WardrobeDigitalTwinScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwinData | null>(null);
  const [capsulePlan, setCapsulePlan] = useState<CapsulePlanData | null>(null);
  const [timeMachine, setTimeMachine] = useState<TimeMachineData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDigitalTwin = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.get<DigitalTwinData>("/api/wardrobe/digital-twin");
      setDigitalTwin(data);
    } catch (err: any) {
      setError(err.message || "Failed to load wardrobe data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCapsulePlan = useCallback(async () => {
    if (capsulePlan) return;
    setIsLoading(true);
    try {
      const data = await apiService.post<CapsulePlanData>("/api/wardrobe/capsule-plan", {
        occasions: ["work", "casual", "evening"],
        duration: 30,
      });
      setCapsulePlan(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate capsule plan");
    } finally {
      setIsLoading(false);
    }
  }, [capsulePlan]);

  const loadTimeMachine = useCallback(async () => {
    if (timeMachine) return;
    setIsLoading(true);
    try {
      const data = await apiService.post<TimeMachineData>("/api/wardrobe/time-machine", {
        monthsAhead: 6,
      });
      setTimeMachine(data);
    } catch (err: any) {
      setError(err.message || "Failed to project future wardrobe");
    } finally {
      setIsLoading(false);
    }
  }, [timeMachine]);

  useEffect(() => {
    loadDigitalTwin();
  }, [loadDigitalTwin]);

  useEffect(() => {
    if (activeTab === "capsule" && !capsulePlan) {
      loadCapsulePlan();
    } else if (activeTab === "future" && !timeMachine) {
      loadTimeMachine();
    }
  }, [activeTab, capsulePlan, timeMachine, loadCapsulePlan, loadTimeMachine]);

  const getHealthColor = (score: number) => {
    if (score >= 70) return "#4CAF50";
    if (score >= 40) return "#FF9800";
    return "#F44336";
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

  const renderDashboard = () => {
    if (!digitalTwin) return null;

    return (
      <>
        <Card style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>Wardrobe Health</ThemedText>
              <View style={styles.scoreRow}>
                <ThemedText type="h1" style={{ color: getHealthColor(digitalTwin.healthScore) }}>
                  {digitalTwin.healthScore}
                </ThemedText>
                <ThemedText type="h3" style={{ color: theme.tabIconDefault }}>/100</ThemedText>
              </View>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="h2">{digitalTwin.totalItems}</ThemedText>
              <ThemedText type="caption">Items</ThemedText>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${digitalTwin.healthScore}%`, backgroundColor: getHealthColor(digitalTwin.healthScore) },
              ]}
            />
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Category Distribution</ThemedText>
          {Object.entries(digitalTwin.categoryDistribution).map(([category, count]) => (
            <View key={category} style={styles.distributionRow}>
              <ThemedText type="body" style={{ flex: 1, textTransform: "capitalize" }}>{category}</ThemedText>
              <View style={[styles.countBadge, { backgroundColor: theme.link + "20" }]}>
                <ThemedText type="caption" style={{ color: theme.link }}>{count}</ThemedText>
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Versatility Score</ThemedText>
          <View style={styles.versatilityContainer}>
            <View style={[styles.versatilityCircle, { borderColor: theme.link }]}>
              <ThemedText type="h1" style={{ color: theme.link }}>{digitalTwin.versatilityScore}</ThemedText>
              <ThemedText type="caption">%</ThemedText>
            </View>
            <ThemedText type="caption" style={{ textAlign: "center", marginTop: Spacing.sm, color: theme.tabIconDefault }}>
              How well your items mix and match
            </ThemedText>
          </View>
        </Card>

        {digitalTwin.gaps.length > 0 && (
          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Wardrobe Gaps</ThemedText>
            {digitalTwin.gaps.map((gap, i) => (
              <View key={i} style={styles.gapItem}>
                <Feather name="alert-circle" size={18} color="#FF9800" />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{gap}</ThemedText>
              </View>
            ))}
          </Card>
        )}

        {digitalTwin.wearPredictions.length > 0 && (
          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Wear Predictions</ThemedText>
            {digitalTwin.wearPredictions.map((item) => (
              <View key={item.id} style={styles.predictionRow}>
                <ThemedText type="body" style={{ flex: 1 }}>{item.name}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.link }}>
                  ~{item.predictedWears} wears
                </ThemedText>
              </View>
            ))}
          </Card>
        )}
      </>
    );
  };

  const renderCapsule = () => {
    if (!capsulePlan) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>Creating your capsule wardrobe...</ThemedText>
        </View>
      );
    }

    return (
      <>
        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>30-Day Capsule Plan</ThemedText>
          <View style={styles.capsuleStats}>
            <View style={[styles.statBox, { backgroundColor: theme.link + "10" }]}>
              <ThemedText type="h2" style={{ color: theme.link }}>{capsulePlan.totalPieces}</ThemedText>
              <ThemedText type="caption">Pieces</ThemedText>
            </View>
            <View style={[styles.statBox, { backgroundColor: "#4CAF50" + "10" }]}>
              <ThemedText type="h2" style={{ color: "#4CAF50" }}>{capsulePlan.outfitCombinations}</ThemedText>
              <ThemedText type="caption">Outfits</ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Essential Items</ThemedText>
          {capsulePlan.capsuleItems.slice(0, 8).map((item, i) => (
            <View key={i} style={[styles.capsuleItem, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={styles.capsuleItemHeader}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{item.type}</ThemedText>
                <View style={[styles.colorDot, { backgroundColor: item.color.toLowerCase() }]} />
              </View>
              <View style={styles.tagRow}>
                {item.occasions.slice(0, 3).map((occ, j) => (
                  <View key={j} style={[styles.tag, { backgroundColor: theme.backgroundDefault }]}>
                    <ThemedText type="small">{occ}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Weekly Plan Preview</ThemedText>
          {capsulePlan.weeklyPlan.slice(0, 5).map((day, i) => (
            <View key={i} style={styles.dayPlan}>
              <ThemedText type="body" style={{ fontWeight: "600", width: 80 }}>{day.day}</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText type="caption">{day.outfit}</ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault }}>{day.occasion}</ThemedText>
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Styling Tips</ThemedText>
          {capsulePlan.stylingTips.map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <Feather name="star" size={16} color="#FFD700" />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{tip}</ThemedText>
            </View>
          ))}
        </Card>
      </>
    );
  };

  const renderFuture = () => {
    if (!timeMachine) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>Projecting your style evolution...</ThemedText>
        </View>
      );
    }

    return (
      <>
        <Card style={[styles.visionCard, { backgroundColor: theme.link + "10" }]}>
          <Feather name="eye" size={28} color={theme.link} style={{ alignSelf: "center", marginBottom: Spacing.sm }} />
          <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.sm }}>6-Month Vision</ThemedText>
          <ThemedText type="body" style={{ textAlign: "center" }}>{timeMachine.futureVision}</ThemedText>
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Trending Pieces to Add</ThemedText>
          {timeMachine.trendingPieces.map((piece, i) => (
            <View key={i} style={styles.tipItem}>
              <Feather name="trending-up" size={16} color={theme.link} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{piece}</ThemedText>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Investment Recommendations</ThemedText>
          {timeMachine.investmentRecommendations.map((rec, i) => (
            <View key={i} style={[styles.investmentItem, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={styles.investmentHeader}>
                <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>{rec.item}</ThemedText>
                <View style={[
                  styles.priorityBadge,
                  { backgroundColor: rec.priority === "high" ? "#F44336" : rec.priority === "medium" ? "#FF9800" : "#4CAF50" }
                ]}>
                  <ThemedText type="small" style={{ color: "#FFF" }}>{rec.priority}</ThemedText>
                </View>
              </View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.xs }}>
                {rec.reason}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Phased Plan</ThemedText>
          {timeMachine.phasedPlan.map((phase, i) => (
            <View key={i} style={styles.phaseItem}>
              <View style={[styles.phaseNumber, { backgroundColor: theme.link }]}>
                <ThemedText type="caption" style={{ color: "#FFF" }}>M{phase.month}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="body">{phase.action}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>{phase.budget}</ThemedText>
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Style Evolution</ThemedText>
          <ThemedText type="body">{timeMachine.styleEvolution}</ThemedText>
        </Card>
      </>
    );
  };

  return (
    <ScreenScrollView style={styles.container}>
      <View style={styles.tabRow}>
        {renderTab("dashboard", "Dashboard", "grid")}
        {renderTab("capsule", "Capsule", "package")}
        {renderTab("future", "Time Machine", "clock")}
      </View>

      {isLoading && activeTab === "dashboard" ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>Loading your digital twin...</ThemedText>
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <ThemedText type="body" style={{ color: theme.error, textAlign: "center" }}>{error}</ThemedText>
          <Button onPress={loadDigitalTwin} style={{ marginTop: Spacing.md }}>Retry</Button>
        </Card>
      ) : (
        <>
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "capsule" && renderCapsule()}
          {activeTab === "future" && renderFuture()}
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  scoreCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    minWidth: 80,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  sectionCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  versatilityContainer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  versatilityCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  gapItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  capsuleStats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  capsuleItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  capsuleItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  dayPlan: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  visionCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  investmentItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  investmentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  phaseItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  phaseNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
});
