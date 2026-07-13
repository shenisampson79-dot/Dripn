/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import AdminStylistScreen from "@/screens/AdminStylistScreen";

type AdminTab = "overview" | "analytics" | "stylists";

type Props = {
  onExit: () => void;
  onLogout: () => void;
};

const TABS: { id: AdminTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "analytics", label: "Analytics", icon: "bar-chart-2" },
  { id: "stylists", label: "Stylists", icon: "users" },
];

export default function AdminPortalHub({ onExit, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [tab, setTab] = useState<AdminTab>("overview");

  const navStub = useMemo(
    () =>
      ({
        goBack: onExit,
        navigate: () => {},
        canGoBack: () => false,
      }) as any,
    [onExit],
  );

  const routeStub = useMemo(() => ({ key: "admin", name: "AdminPortal", params: { embedded: true } }) as any, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={onExit} hitSlop={12} style={styles.iconBtn}>
          <Feather name="x" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText type="h4">Admin Portal</ThemedText>
          <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
            App metrics, revenue & staff tools
          </ThemedText>
        </View>
        <Pressable onPress={onLogout} hitSlop={12} style={styles.iconBtn}>
          <Feather name="log-out" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={[styles.tabs, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F5F1EC" }]}>
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[
                styles.tab,
                active && {
                  backgroundColor: isDark ? LuxuryColors.midnight : "#FFFFFF",
                  borderColor: LuxuryColors.gold,
                },
              ]}
            >
              <Feather
                name={item.icon}
                size={14}
                color={active ? LuxuryColors.gold : theme.tabIconDefault}
              />
              <ThemedText
                type="caption"
                style={{
                  fontWeight: active ? "700" : "500",
                  color: active ? theme.text : theme.tabIconDefault,
                }}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {tab === "overview" ? (
          <AdminDashboardScreen
            navigation={navStub}
            route={routeStub}
            embedded
          />
        ) : null}
        {tab === "analytics" ? (
          <AnalyticsDashboard
            navigation={navStub}
            route={routeStub}
            embedded
          />
        ) : null}
        {tab === "stylists" ? (
          <AdminStylistScreen
            navigation={navStub}
            onExit={onExit}
            onLogout={onLogout}
            embedded
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  headerText: { flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  body: { flex: 1 },
});
