import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type Props = NativeStackScreenProps<ProfileStackParamList, "AnalyticsDashboard">;

const CHART_COLORS = ["#c9a961", "#1a1a2e", "#6b8e7b", "#8b5cf6", "#e07a5f", "#3d5a80"];

function MetricCard({
  label,
  value,
  sub,
  theme,
}: {
  label: string;
  value: string;
  sub?: string;
  theme: { backgroundSecondary: string; text: string; tabIconDefault: string };
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
        {label}
      </ThemedText>
      <ThemedText type="h3" style={{ marginTop: Spacing.xs }}>
        {value}
      </ThemedText>
      {sub ? (
        <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: 2 }}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="h4" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

function ChartBox({
  children,
  height = 220,
  theme,
}: {
  children: React.ReactNode;
  height?: number;
  theme: { backgroundSecondary: string; border: string };
}) {
  if (Platform.OS !== "web") {
    return (
      <View style={[styles.chartFallback, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <ThemedText type="caption">Charts available on web</ThemedText>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.chartBox,
        { height, backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
      ]}
    >
      {children}
    </View>
  );
}

function DataTable({
  headers,
  rows,
  theme,
}: {
  headers: string[];
  rows: string[][];
  theme: { backgroundSecondary: string; border: string };
}) {
  return (
    <View style={[styles.table, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <View style={[styles.tableRow, styles.tableHeader, { borderColor: theme.border }]}>
        {headers.map((h) => (
          <ThemedText key={h} type="small" style={[styles.tableCell, styles.headerCell]}>
            {h}
          </ThemedText>
        ))}
      </View>
      {rows.length === 0 ? (
        <ThemedText type="body" style={styles.emptyTable}>
          No data yet
        </ThemedText>
      ) : (
        rows.map((row, i) => (
          <View key={`row-${i}`} style={[styles.tableRow, { borderColor: theme.border }]}>
            {row.map((cell, j) => (
              <ThemedText key={`${i}-${j}`} type="small" style={styles.tableCell}>
                {cell}
              </ThemedText>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function InsightCard({
  title,
  message,
  action,
  severity,
  theme,
}: {
  title: string;
  message: string;
  action: string;
  severity: string;
  theme: { backgroundSecondary: string; border: string; tabIconDefault: string };
}) {
  const accent =
    severity === "critical" ? "#dc2626"
      : severity === "warning" ? "#d97706"
        : severity === "success" ? "#16a34a"
          : LuxuryColors.gold;
  return (
    <View style={[styles.insightCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderLeftColor: accent }]}>
      <ThemedText type="small" style={{ fontWeight: "700" }}>{title}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: 4 }}>{message}</ThemedText>
      <ThemedText type="caption" style={{ marginTop: 6, fontStyle: "italic" }}>{action}</ThemedText>
    </View>
  );
}

export default function AnalyticsDashboard({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { isAuthenticated, isLoading: authLoading, logout } = useAdminAuth();
  const chartWidth = Math.min(width - Spacing.lg * 2, 900);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsSummary>> | null>(null);
  const [revenue, setRevenue] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsRevenue>> | null>(null);
  const [emailPerf, setEmailPerf] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsEmailPerformance>> | null>(null);
  const [retention, setRetention] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsRetention>> | null>(null);
  const [experiments, setExperiments] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsExperiments>> | null>(null);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsInsightsAdvanced>> | null>(null);
  const [cohorts, setCohorts] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsCohorts>> | null>(null);
  const [funnel, setFunnel] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsFunnel>> | null>(null);
  const [churnRisk, setChurnRisk] = useState<Awaited<ReturnType<typeof apiService.getAnalyticsChurnRisk>> | null>(null);

  const redirectToLogin = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = "/admin/login";
    } else {
      setAuthRequired(true);
    }
  }, []);

  const formatMoney = (n: number) => `£${(n ?? 0).toFixed(2)}`;

  const load = useCallback(async () => {
    try {
      setError(null);
      setAuthRequired(false);
      const [
        summaryRes, revenueRes, emailRes, retentionRes, experimentsRes,
        insightsRes, cohortsRes, funnelRes, churnRes,
      ] = await Promise.all([
        apiService.getAnalyticsSummary(),
        apiService.getAnalyticsRevenue(),
        apiService.getAnalyticsEmailPerformance(),
        apiService.getAnalyticsRetention(),
        apiService.getAnalyticsExperiments(),
        apiService.getAnalyticsInsightsAdvanced(),
        apiService.getAnalyticsCohorts(),
        apiService.getAnalyticsFunnel(),
        apiService.getAnalyticsChurnRisk(),
      ]);
      setSummary(summaryRes);
      setRevenue(revenueRes);
      setEmailPerf(emailRes);
      setRetention(retentionRes);
      setExperiments(experimentsRes);
      setInsights(insightsRes);
      setCohorts(cohortsRes);
      setFunnel(funnelRes);
      setChurnRisk(churnRes);
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      if (err.code === "ADMIN_AUTH_REQUIRED" || err.message?.includes("Authentication required")) {
        await logout().catch(() => {});
        redirectToLogin();
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to load analytics";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout, redirectToLogin]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load, redirectToLogin]);

  const revenueTrend = useMemo(
    () =>
      (revenue?.trend ?? []).map((d) => ({
        day: String(d.day).slice(5),
        revenue: d.revenue,
      })),
    [revenue?.trend],
  );

  const revenueSplit = useMemo(
    () => [
      { name: "Subscription", value: revenue?.subscriptionRevenue ?? 0 },
      { name: "Winback", value: revenue?.winbackRevenue ?? 0 },
    ],
    [revenue],
  );

  const ctaChartData = useMemo(
    () => (emailPerf?.ctaPerformance ?? []).slice(0, 6),
    [emailPerf?.ctaPerformance],
  );

  const retentionChartData = useMemo(
    () =>
      (retention?.retentionByOffer ?? []).map((o) => ({
        name: o.offerType,
        accepted: o.accepted,
        shown: o.shown - o.accepted,
        rate: o.acceptanceRate,
      })),
    [retention?.retentionByOffer],
  );

  const variantChartData = useMemo(
    () => (experiments?.variants ?? []).slice(0, 8),
    [experiments?.variants],
  );

  const funnelChartData = useMemo(
    () => (funnel?.stages ?? []).map((s) => ({ name: s.stage, count: s.count, rate: s.conversionFromVisit })),
    [funnel?.stages],
  );

  const churnChartData = useMemo(
    () => (churnRisk?.bins ?? []).map((b) => ({ name: b.bin, users: b.users, score: b.avgScore })),
    [churnRisk?.bins],
  );

  if (authLoading || (!isAuthenticated && !authRequired)) {
    return <ActivityIndicator style={styles.loader} color={LuxuryColors.gold} />;
  }

  if (authRequired) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center", padding: Spacing.lg }]}>
        <ThemedText type="h3">Admin sign-in required</ThemedText>
        <Pressable onPress={redirectToLogin} style={{ marginTop: Spacing.md }}>
          <ThemedText type="link">Go to login</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient colors={[...ScreenGradients.profile.primary]} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </Pressable>
        <ThemedText type="h2" style={styles.headerTitle}>
          Revenue Intelligence
        </ThemedText>
        <ThemedText type="small" style={styles.headerSub}>
          Retention · win-back · experiments
        </ThemedText>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={LuxuryColors.gold} />
      ) : (
        <ScreenScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? "rgba(220,38,38,0.15)" : "#FEE2E2" }]}>
              <ThemedText type="body">{error}</ThemedText>
              <Pressable onPress={load}>
                <ThemedText type="link">Retry</ThemedText>
              </Pressable>
            </View>
          ) : null}

          <Section title="AI Insights">
            {(insights?.insights ?? []).map((item) => (
              <InsightCard
                key={item.id || item.title}
                title={item.title}
                message={item.message}
                action={item.action}
                severity={item.severity || "info"}
                theme={theme}
              />
            ))}
            {(insights?.advanced ?? []).map((item, i) => (
              <InsightCard
                key={`adv-${i}`}
                title={`[AI] ${item.title}`}
                message={item.message}
                action={item.action}
                severity={item.priority === "high" ? "warning" : "info"}
                theme={theme}
              />
            ))}
            {insights?.note ? (
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>{insights.note}</ThemedText>
            ) : null}
          </Section>

          <Section title="Cohorts">
            <DataTable
              theme={theme}
              headers={["Cohort week", "Size", "Retained 30d", "Rate"]}
              rows={(cohorts?.cohorts ?? []).map((c) => [
                String(c.cohortWeek).slice(0, 10),
                String(c.cohortSize),
                String(c.retained30d),
                `${c.retentionRate}%`,
              ])}
            />
          </Section>

          <Section title="Funnel">
            <ChartBox theme={theme}>
              <ResponsiveContainer width={chartWidth} height={200}>
                <BarChart data={funnelChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e5e5"} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#c9a961" name="Users" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <DataTable
              theme={theme}
              headers={["Stage", "Count", "From visit %", "From prev %"]}
              rows={(funnel?.stages ?? []).map((s) => [
                s.stage,
                String(s.count),
                `${s.conversionFromVisit}%`,
                `${s.conversionFromPrevious}%`,
              ])}
            />
          </Section>

          <Section title="Churn Risk">
            <ChartBox theme={theme}>
              <ResponsiveContainer width={chartWidth} height={200}>
                <BarChart data={churnChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e5e5"} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="users" fill="#1a1a2e" name="Users" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <DataTable
              theme={theme}
              headers={["Risk bin", "Users", "Avg score"]}
              rows={(churnRisk?.bins ?? []).map((b) => [
                b.bin,
                String(b.users),
                String(b.avgScore),
              ])}
            />
          </Section>

          <Section title="Revenue">
            <View style={styles.metricsGrid}>
              <MetricCard label="Total revenue" value={formatMoney(revenue?.totalRevenue ?? 0)} theme={theme} />
              <MetricCard label="LTV" value={formatMoney(revenue?.ltv ?? 0)} sub="per paying user" theme={theme} />
              <MetricCard label="Rev / user" value={formatMoney(revenue?.revenuePerUser ?? 0)} theme={theme} />
              <MetricCard label="Today" value={formatMoney(revenue?.revenueToday ?? 0)} theme={theme} />
              <MetricCard label="7 days" value={formatMoney(revenue?.revenue7d ?? 0)} theme={theme} />
              <MetricCard label="30 days" value={formatMoney(revenue?.revenue30d ?? 0)} theme={theme} />
            </View>

            <ChartBox theme={theme} height={240}>
              <ResponsiveContainer width={chartWidth} height={220}>
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c9a961" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#c9a961" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e5e5"} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#c9a961" fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox theme={theme} height={220}>
              <ResponsiveContainer width={chartWidth} height={200}>
                <PieChart>
                  <Pie data={revenueSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {revenueSplit.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>

            {summary ? (
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.sm }}>
                Tracked total (all sources): {formatMoney(summary.revenue?.total ?? 0)} ·{" "}
                {summary.payments?.payingUsers ?? revenue?.payingUsers ?? 0} paying users
              </ThemedText>
            ) : null}
          </Section>

          <Section title="Email Performance">
            {emailPerf?.topEmail ? (
              <View style={styles.metricsGrid}>
                <MetricCard
                  label="Top email"
                  value={emailPerf.topEmail.emailType}
                  sub={`${emailPerf.topEmail.clicks} clicks · ${formatMoney(emailPerf.topEmail.revenue)}`}
                  theme={theme}
                />
                <MetricCard
                  label="Sent (top)"
                  value={String(emailPerf.topEmail.sent)}
                  theme={theme}
                />
              </View>
            ) : null}

            <ChartBox theme={theme}>
              <ResponsiveContainer width={chartWidth} height={200}>
                <BarChart data={ctaChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e5e5"} />
                  <XAxis dataKey="cta" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="clicks" fill="#1a1a2e" name="Clicks" />
                  <Bar dataKey="revenue" fill="#c9a961" name="Revenue (£)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <DataTable
              theme={theme}
              headers={["Email", "Sent", "Clicks", "Revenue"]}
              rows={(emailPerf?.revenueByEmail ?? []).map((r) => [
                r.email,
                String(r.sent ?? 0),
                String(r.clicks),
                formatMoney(r.revenue),
              ])}
            />
          </Section>

          <Section title="Retention">
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Recovery rate"
                value={`${retention?.recoveryRate ?? 0}%`}
                theme={theme}
              />
              <MetricCard
                label="Revenue saved"
                value={formatMoney(retention?.revenueSaved ?? 0)}
                theme={theme}
              />
              <MetricCard
                label="Cancellations"
                value={String(retention?.cancelFlow?.cancellations ?? 0)}
                sub={`${retention?.cancelFlow?.recovered ?? 0} recovered`}
                theme={theme}
              />
            </View>

            <ChartBox theme={theme}>
              <ResponsiveContainer width={chartWidth} height={200}>
                <BarChart data={retentionChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e5e5"} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accepted" stackId="a" fill="#c9a961" name="Accepted" />
                  <Bar dataKey="shown" stackId="a" fill="#1a1a2e" name="Not accepted" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <DataTable
              theme={theme}
              headers={["Offer", "Shown", "Accepted", "Rate", "Rev saved"]}
              rows={(retention?.retentionByOffer ?? []).map((o) => [
                o.offerType,
                String(o.shown),
                String(o.accepted),
                `${o.acceptanceRate}%`,
                formatMoney(o.revenueSaved),
              ])}
            />
          </Section>

          <Section title="Experiments">
            <ChartBox theme={theme}>
              <ResponsiveContainer width={chartWidth} height={200}>
                <BarChart data={variantChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#333" : "#e5e5e5"} />
                  <XAxis dataKey="variant" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="shown" fill="#1a1a2e" name="Shown" />
                  <Bar dataKey="accepted" fill="#c9a961" name="Accepted" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <DataTable
              theme={theme}
              headers={["Variant", "Shown", "Accepted", "Rate", "Revenue"]}
              rows={(experiments?.variants ?? []).map((v) => [
                v.variant,
                String(v.shown),
                String(v.accepted),
                `${v.acceptanceRate}%`,
                formatMoney(v.revenue),
              ])}
            />
          </Section>

          {Platform.OS === "web" ? (
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.lg }}>
              Web routes: /admin/login · /admin/analytics · API: {process.env.EXPO_PUBLIC_API_URL || "dripn-server.onrender.com"}
            </ThemedText>
          ) : null}
        </ScreenScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: { marginBottom: Spacing.md },
  headerTitle: { color: "#FFF" },
  headerSub: { color: "rgba(255,255,255,0.75)", marginTop: Spacing.xs },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing["3xl"] },
  loader: { marginTop: Spacing["3xl"] },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { marginBottom: Spacing.sm },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    width: "48%",
    minWidth: 140,
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  chartBox: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chartFallback: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  table: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  tableHeader: { backgroundColor: "rgba(201,169,97,0.12)" },
  tableCell: { flex: 1, fontSize: 12 },
  headerCell: { fontWeight: "700" },
  emptyTable: { padding: Spacing.lg, textAlign: "center" },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  insightCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
});
