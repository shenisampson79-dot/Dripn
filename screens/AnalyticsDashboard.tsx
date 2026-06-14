import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type Props = NativeStackScreenProps<ProfileStackParamList, "AnalyticsDashboard">;

type Summary = Awaited<ReturnType<typeof apiService.getAnalyticsSummary>>;
type CtaRow = { cta: string; conversions: number; revenue: number };
type CampaignRow = { campaign: string; variant: string; conversions: number; revenue: number };
type OfferRow = {
  offerType: string;
  segment: string;
  usageSegment: string;
  shown: number;
  accepted: number;
  acceptanceRate: number;
  revenue: number;
};

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

export default function AnalyticsDashboard({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ctaRows, setCtaRows] = useState<CtaRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summaryRes, ctaRes, campaignRes, offerRes] = await Promise.all([
        apiService.getAnalyticsSummary(),
        apiService.getAnalyticsRevenueByCta(),
        apiService.getAnalyticsCampaigns(),
        apiService.getAnalyticsOffers(),
      ]);
      setSummary(summaryRes);
      setCtaRows(ctaRes.rows ?? []);
      setCampaigns(campaignRes.campaigns ?? []);
      setOffers(offerRes.offers ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatMoney = (n: number) => `£${(n ?? 0).toFixed(2)}`;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient colors={[...ScreenGradients.profile.primary]} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </Pressable>
        <ThemedText type="h2" style={styles.headerTitle}>
          Retention Analytics
        </ThemedText>
        <ThemedText type="small" style={styles.headerSub}>
          Smart offers · win-back · revenue by CTA
        </ThemedText>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={LuxuryColors.gold} />
      ) : (
        <ScreenScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
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

          {summary ? (
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Offers shown"
                value={String(summary.offers?.shown ?? 0)}
                sub={`${summary.offers?.acceptanceRate ?? 0}% accepted`}
                theme={theme}
              />
              <MetricCard
                label="Offer revenue"
                value={formatMoney(summary.revenue?.fromOffers ?? 0)}
                theme={theme}
              />
              <MetricCard
                label="Email conversions"
                value={String(summary.emailConversions?.total ?? 0)}
                sub={formatMoney(summary.emailConversions?.amount ?? 0)}
                theme={theme}
              />
              <MetricCard
                label="Total tracked"
                value={formatMoney(summary.revenue?.total ?? 0)}
                sub={`${summary.events?.total ?? 0} events`}
                theme={theme}
              />
            </View>
          ) : null}

          <ThemedText type="h4" style={styles.sectionTitle}>
            Revenue by CTA
          </ThemedText>
          <DataTable
            theme={theme}
            headers={["CTA", "Conversions", "Revenue"]}
            rows={ctaRows.map((r) => [r.cta, String(r.conversions), formatMoney(r.revenue)])}
          />

          <ThemedText type="h4" style={styles.sectionTitle}>
            Campaigns
          </ThemedText>
          <DataTable
            theme={theme}
            headers={["Campaign", "Variant", "Conv.", "Revenue"]}
            rows={campaigns.map((c) => [
              c.campaign,
              c.variant ?? "—",
              String(c.conversions),
              formatMoney(c.revenue),
            ])}
          />

          <ThemedText type="h4" style={styles.sectionTitle}>
            Smart offers
          </ThemedText>
          <DataTable
            theme={theme}
            headers={["Type", "Segment", "Usage", "Shown", "Accepted", "Rate", "Rev"]}
            rows={offers.map((o) => [
              o.offerType ?? "—",
              o.segment ?? "—",
              o.usageSegment ?? "—",
              String(o.shown),
              String(o.accepted),
              `${o.acceptanceRate}%`,
              formatMoney(o.revenue),
            ])}
          />

          {Platform.OS === "web" ? (
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.lg }}>
              Web route: /admin/analytics
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  metricCard: {
    width: "48%",
    minWidth: 140,
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  sectionTitle: { marginBottom: Spacing.sm, marginTop: Spacing.md },
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
});
