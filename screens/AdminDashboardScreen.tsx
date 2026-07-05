import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import apiService from "@/services/ApiService";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type Props = NativeStackScreenProps<ProfileStackParamList, "AdminDashboard">;

interface DashboardData {
  users: {
    total: number;
    today: number;
    thisWeek: number;
  };
  subscriptions: {
    active: number;
    conversionRate: number;
  };
  engagement: {
    totalChats: number;
    chatsToday: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    subscriptionTier?: string;
    verified?: boolean;
  }>;
}

interface PaymentsData {
  summary: {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
  };
  payments: Array<{
    id: string;
    userId: string;
    userEmail: string;
    amount: number;
    currency: string;
    status: string;
    productId: string;
    createdAt: string;
  }>;
}

interface SubscriptionsData {
  mrr: number;
  stats: {
    active: number;
    canceled: number;
    planDistribution: {
      free: number;
      personal_stylist: number;
      stylist_unlimited: number;
    };
  };
}

interface ModelStatusData {
  current: {
    main_stylist: string;
    quick_decisions: string;
    second_opinions: string;
  };
  available: string[];
  newModelsDetected: number;
  lastChecked: string;
}

export default function AdminDashboardScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { palette } = useColorScheme();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [paymentsData, setPaymentsData] = useState<PaymentsData | null>(null);
  const [subscriptionsData, setSubscriptionsData] = useState<SubscriptionsData | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatusData | null>(null);
  const [isCheckingModels, setIsCheckingModels] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const LUXURY_COLORS = {
    gold: palette.gold,
    deepGold: palette.deepGold,
    violet: palette.violet,
    deepViolet: palette.deepViolet,
    coral: palette.coral,
    rose: palette.rose,
    teal: palette.teal,
    emerald: palette.emerald,
    midnight: LuxuryColors.midnight,
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [dashboard, payments, subscriptions, models] = await Promise.all([
        apiService.getAdminDashboard(),
        apiService.getAdminPayments(),
        apiService.getAdminSubscriptions(),
        apiService.getAdminModels().catch(() => null),
      ]);
      setDashboardData(dashboard);
      setPaymentsData(payments);
      setSubscriptionsData(subscriptions);
      setModelStatus(models);
    } catch (err: any) {
      console.error("Failed to fetch admin data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleCheckModels = async () => {
    setIsCheckingModels(true);
    try {
      await apiService.checkAdminModels();
      const updatedModels = await apiService.getAdminModels();
      setModelStatus(updatedModels);
    } catch (err) {
      console.error("Failed to check models:", err);
    } finally {
      setIsCheckingModels(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number, currency = "GBP") => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    icon: string,
    gradientColors: readonly [string, string],
    subtitle?: string
  ) => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF" },
      ]}
    >
      <LinearGradient colors={gradientColors} style={styles.statIcon}>
        <Feather name={icon as any} size={20} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.statContent}>
        <ThemedText type="small" style={styles.statTitle}>
          {title}
        </ThemedText>
        <ThemedText type="h2" style={styles.statValue}>
          {value}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={styles.statSubtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <LinearGradient
        colors={[
          ScreenGradients.profile.primary[0],
          ScreenGradients.profile.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={[StyleSheet.absoluteFill, styles.loadingContainer]}
      >
        <ActivityIndicator size="large" color={LUXURY_COLORS.gold} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: "#FFFFFF" }}>
          Loading dashboard...
        </ThemedText>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={[
          ScreenGradients.profile.primary[0],
          ScreenGradients.profile.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={[StyleSheet.absoluteFill, styles.loadingContainer]}
      >
        <Feather name="alert-circle" size={48} color={LUXURY_COLORS.coral} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: "#FFFFFF", textAlign: "center" }}>
          {error}
        </ThemedText>
        <Pressable
          onPress={handleRefresh}
          style={[styles.retryButton, { backgroundColor: LUXURY_COLORS.gold }]}
        >
          <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: "600" }}>
            Retry
          </ThemedText>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        ScreenGradients.profile.primary[0],
        ScreenGradients.profile.primary[1],
        LuxuryColors.obsidian,
      ]}
      locations={[0, 0.35, 1]}
      style={StyleSheet.absoluteFill}
    >
      <ScreenScrollView
        style={{ backgroundColor: "transparent" }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={LUXURY_COLORS.gold}
          />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
            Admin Dashboard
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Overview
          </ThemedText>
          <View style={styles.statsGrid}>
            {renderStatCard(
              "Total Users",
              dashboardData?.users.total || 0,
              "users",
              [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]
            )}
            {renderStatCard(
              "New Today",
              dashboardData?.users.today || 0,
              "user-plus",
              [LUXURY_COLORS.teal, LUXURY_COLORS.emerald],
              `${dashboardData?.users.thisWeek || 0} this week`
            )}
            {renderStatCard(
              "Conversion Rate",
              `${((dashboardData?.subscriptions.conversionRate || 0) * 100).toFixed(1)}%`,
              "trending-up",
              [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Revenue
          </ThemedText>
          <View style={styles.statsGrid}>
            {renderStatCard(
              "Total Revenue",
              formatCurrency(paymentsData?.summary.totalRevenue || 0),
              "dollar-sign",
              [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
            )}
            {renderStatCard(
              "MRR",
              formatCurrency(subscriptionsData?.mrr || 0),
              "repeat",
              [LUXURY_COLORS.teal, LUXURY_COLORS.emerald]
            )}
          </View>

          {paymentsData?.payments && paymentsData.payments.length > 0 ? (
            <View
              style={[
                styles.recentTransactions,
                { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" },
              ]}
            >
              <ThemedText type="body" style={styles.subsectionTitle}>
                Recent Transactions
              </ThemedText>
              {paymentsData.payments.slice(0, 5).map((payment) => (
                <View key={payment.id} style={styles.transactionRow}>
                  <View style={styles.transactionInfo}>
                    <ThemedText type="body" style={styles.transactionEmail}>
                      {payment.userEmail}
                    </ThemedText>
                    <ThemedText type="small" style={styles.transactionProduct}>
                      {payment.productId.replace(/_/g, " ")}
                    </ThemedText>
                  </View>
                  <View style={styles.transactionAmount}>
                    <ThemedText
                      type="body"
                      style={[
                        styles.transactionValue,
                        { color: payment.status === "succeeded" ? LUXURY_COLORS.emerald : LUXURY_COLORS.coral },
                      ]}
                    >
                      {formatCurrency(payment.amount, payment.currency)}
                    </ThemedText>
                    <ThemedText type="small" style={styles.transactionDate}>
                      {formatDate(payment.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Subscriptions
          </ThemedText>
          <View style={styles.statsGrid}>
            {renderStatCard(
              "Active",
              subscriptionsData?.stats.active || 0,
              "check-circle",
              [LUXURY_COLORS.emerald, LUXURY_COLORS.teal]
            )}
            {renderStatCard(
              "Canceled",
              subscriptionsData?.stats.canceled || 0,
              "x-circle",
              [LUXURY_COLORS.coral, LUXURY_COLORS.rose]
            )}
          </View>

          {subscriptionsData?.stats.planDistribution ? (
            <View
              style={[
                styles.planDistribution,
                { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" },
              ]}
            >
              <ThemedText type="body" style={styles.subsectionTitle}>
                Plan Distribution
              </ThemedText>
              <View style={styles.planRow}>
                <ThemedText type="body">Free</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {subscriptionsData.stats.planDistribution.free}
                </ThemedText>
              </View>
              <View style={styles.planRow}>
                <ThemedText type="body">Personal Stylist</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {subscriptionsData.stats.planDistribution.personal_stylist}
                </ThemedText>
              </View>
              <View style={styles.planRow}>
                <ThemedText type="body">Stylist Unlimited</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {subscriptionsData.stats.planDistribution.stylist_unlimited}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            User Activity
          </ThemedText>
          <View style={styles.statsGrid}>
            {renderStatCard(
              "Total Chats",
              dashboardData?.engagement.totalChats || 0,
              "message-circle",
              [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]
            )}
            {renderStatCard(
              "Chats Today",
              dashboardData?.engagement.chatsToday || 0,
              "zap",
              [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
            )}
          </View>
        </View>

        {modelStatus ? (
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  AI Models
                </ThemedText>
                {modelStatus.newModelsDetected > 0 ? (
                  <View style={[styles.newBadge, { backgroundColor: LUXURY_COLORS.coral }]}>
                    <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                      {modelStatus.newModelsDetected} New
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
            <View
              style={[
                styles.modelCard,
                { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" },
              ]}
            >
              <View style={styles.modelRow}>
                <ThemedText type="body">Main Stylist:</ThemedText>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {modelStatus.current.main_stylist}
                  </ThemedText>
                  <Feather name="check" size={16} color={LUXURY_COLORS.emerald} style={{ marginLeft: 6 }} />
                </View>
              </View>
              <View style={styles.modelRow}>
                <ThemedText type="body">Quick Decisions:</ThemedText>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {modelStatus.current.quick_decisions}
                  </ThemedText>
                  <Feather name="check" size={16} color={LUXURY_COLORS.emerald} style={{ marginLeft: 6 }} />
                </View>
              </View>
              <View style={styles.modelRow}>
                <ThemedText type="body">Second Opinions:</ThemedText>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {modelStatus.current.second_opinions}
                  </ThemedText>
                  <Feather name="check" size={16} color={LUXURY_COLORS.emerald} style={{ marginLeft: 6 }} />
                </View>
              </View>
              <View style={[styles.modelRow, { borderBottomWidth: 0 }]}>
                <ThemedText type="small" style={{ opacity: 0.6 }}>
                  Last checked: {formatRelativeTime(modelStatus.lastChecked)}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleCheckModels}
                disabled={isCheckingModels}
                style={[
                  styles.checkButton,
                  { backgroundColor: LUXURY_COLORS.gold, opacity: isCheckingModels ? 0.6 : 1 },
                ]}
              >
                {isCheckingModels ? (
                  <ActivityIndicator size="small" color={LUXURY_COLORS.midnight} />
                ) : (
                  <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: "600" }}>
                    Check for Updates
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.section, { marginBottom: Spacing["2xl"] }]}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Recent Signups
          </ThemedText>
          <View
            style={[
              styles.recentSignups,
              { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" },
            ]}
          >
            {dashboardData?.recentUsers && dashboardData.recentUsers.length > 0 ? (
              dashboardData.recentUsers.map((user, index) => (
                <View
                  key={user.id}
                  style={[
                    styles.userRow,
                    index < dashboardData.recentUsers.length - 1 && styles.userRowBorder,
                  ]}
                >
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <ThemedText type="body" style={styles.userName}>
                        {user.name || "Unnamed User"}
                      </ThemedText>
                      {user.verified ? (
                        <Feather name="check-circle" size={14} color={LUXURY_COLORS.emerald} />
                      ) : null}
                    </View>
                    <ThemedText type="small" style={styles.userEmail}>
                      {user.email}
                    </ThemedText>
                  </View>
                  <View style={styles.userMeta}>
                    <View
                      style={[
                        styles.tierBadge,
                        {
                          backgroundColor:
                            user.subscriptionTier === "free"
                              ? "rgba(128,128,128,0.2)"
                              : LUXURY_COLORS.gold + "30",
                        },
                      ]}
                    >
                      <ThemedText type="small" style={styles.tierText}>
                        {user.subscriptionTier || "Free"}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.userDate}>
                      {formatDate(user.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText type="body" style={{ textAlign: "center", opacity: 0.6, padding: Spacing.lg }}>
                No recent signups
              </ThemedText>
            )}
          </View>
        </View>
      </ScreenScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.md,
  },
  subsectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    opacity: 0.7,
    marginBottom: 2,
  },
  statValue: {
    fontWeight: "700",
  },
  statSubtitle: {
    opacity: 0.5,
    marginTop: 2,
  },
  recentTransactions: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.1)",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionEmail: {
    fontWeight: "500",
  },
  transactionProduct: {
    opacity: 0.6,
    textTransform: "capitalize",
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  transactionValue: {
    fontWeight: "600",
  },
  transactionDate: {
    opacity: 0.5,
  },
  planDistribution: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.1)",
  },
  recentSignups: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
  },
  userRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.1)",
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  userName: {
    fontWeight: "500",
  },
  userEmail: {
    opacity: 0.6,
  },
  userMeta: {
    alignItems: "flex-end",
  },
  tierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginBottom: 4,
  },
  tierText: {
    textTransform: "capitalize",
    fontSize: 11,
  },
  userDate: {
    opacity: 0.5,
  },
  modelCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  modelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.1)",
  },
  newBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  checkButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
