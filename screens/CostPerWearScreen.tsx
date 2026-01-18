/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useMemo } from "react";
import { StyleSheet, View, Pressable, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useWardrobe, WardrobeItem, ClothingCategory, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type CostPerWearScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "CostPerWear">;
};

interface CategorySpending {
  category: ClothingCategory;
  label: string;
  totalSpent: number;
  itemCount: number;
  avgCostPerWear: number;
  totalWears: number;
}

interface ItemAnalytics {
  item: WardrobeItem;
  costPerWear: number;
  value: "excellent" | "good" | "fair" | "poor" | "never-worn";
}

export default function CostPerWearScreen({ navigation }: CostPerWearScreenProps) {
  const { theme } = useTheme();
  const { items } = useWardrobe();

  const ownedItems = useMemo(() => {
    return items.filter(item => !item.origin || item.origin === "owned");
  }, [items]);

  const analytics = useMemo(() => {
    const totalValue = ownedItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const totalWears = ownedItems.reduce((sum, item) => sum + item.timesWorn, 0);
    const avgCostPerWear = totalWears > 0 ? totalValue / totalWears : 0;
    const neverWornItems = ownedItems.filter(item => item.timesWorn === 0);
    const neverWornValue = neverWornItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);

    const itemsWithPrice = ownedItems.filter(item => item.purchasePrice && item.purchasePrice > 0);
    
    const itemAnalytics: ItemAnalytics[] = itemsWithPrice.map(item => {
      const cpw = item.timesWorn > 0 ? (item.purchasePrice || 0) / item.timesWorn : Infinity;
      let value: ItemAnalytics["value"] = "never-worn";
      if (item.timesWorn === 0) {
        value = "never-worn";
      } else if (cpw <= 2) {
        value = "excellent";
      } else if (cpw <= 5) {
        value = "good";
      } else if (cpw <= 10) {
        value = "fair";
      } else {
        value = "poor";
      }
      return { item, costPerWear: cpw, value };
    });

    const bestValue = itemAnalytics
      .filter(ia => ia.item.timesWorn > 0)
      .sort((a, b) => a.costPerWear - b.costPerWear)
      .slice(0, 5);

    const worstValue = itemAnalytics
      .filter(ia => ia.item.timesWorn > 0 && ia.costPerWear !== Infinity)
      .sort((a, b) => b.costPerWear - a.costPerWear)
      .slice(0, 5);

    const categorySpending: CategorySpending[] = [];
    const categories = Object.keys(CATEGORY_LABELS) as ClothingCategory[];
    
    for (const category of categories) {
      const categoryItems = ownedItems.filter(item => item.category === category);
      if (categoryItems.length === 0) continue;
      
      const totalSpent = categoryItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
      const catTotalWears = categoryItems.reduce((sum, item) => sum + item.timesWorn, 0);
      const avgCpw = catTotalWears > 0 ? totalSpent / catTotalWears : 0;
      
      categorySpending.push({
        category,
        label: CATEGORY_LABELS[category],
        totalSpent,
        itemCount: categoryItems.length,
        avgCostPerWear: avgCpw,
        totalWears: catTotalWears,
      });
    }

    categorySpending.sort((a, b) => b.totalSpent - a.totalSpent);

    return {
      totalValue,
      totalWears,
      avgCostPerWear,
      neverWornItems,
      neverWornValue,
      bestValue,
      worstValue,
      categorySpending,
      totalItemsWithPrice: itemsWithPrice.length,
    };
  }, [ownedItems]);

  const formatCurrency = (amount: number): string => {
    return `£${amount.toFixed(2)}`;
  };

  const getValueColor = (value: ItemAnalytics["value"]): string => {
    switch (value) {
      case "excellent": return theme.success;
      case "good": return theme.success;
      case "fair": return theme.warning;
      case "poor": return theme.error;
      case "never-worn": return theme.tabIconDefault;
    }
  };

  const getValueLabel = (value: ItemAnalytics["value"]): string => {
    switch (value) {
      case "excellent": return "Excellent Value";
      case "good": return "Good Value";
      case "fair": return "Fair Value";
      case "poor": return "Poor Value";
      case "never-worn": return "Never Worn";
    }
  };

  const getCategoryIcon = (category: ClothingCategory): string => {
    const icons: Record<ClothingCategory, string> = {
      tops: "tag",
      bottoms: "tag",
      dresses: "star",
      outerwear: "cloud",
      shoes: "disc",
      bags: "shopping-bag",
      accessories: "watch",
      activewear: "activity",
      swimwear: "sun",
      sleepwear: "moon",
      formal: "award",
    };
    return icons[category] || "tag";
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Cost-per-Wear Analytics</ThemedText>
      </View>

      {ownedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="pie-chart" size={64} color={theme.tabIconDefault} />
          <ThemedText type="h3" style={styles.emptyTitle}>
            No Wardrobe Items Yet
          </ThemedText>
          <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            Add items to your wardrobe with prices to see cost-per-wear analytics
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Wardrobe")}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Feather name="plus" size={18} color={theme.buttonText} />
            <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
              Add Items
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.overviewGrid}>
            <Card style={[styles.statCard, { flex: 1 }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.link + "20" }]}>
                <Feather name="dollar-sign" size={20} color={theme.link} />
              </View>
              <ThemedText type="h2" style={styles.statValue}>
                {formatCurrency(analytics.totalValue)}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Total Wardrobe Value
              </ThemedText>
            </Card>

            <Card style={[styles.statCard, { flex: 1 }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.success + "20" }]}>
                <Feather name="trending-down" size={20} color={theme.success} />
              </View>
              <ThemedText type="h2" style={styles.statValue}>
                {analytics.avgCostPerWear > 0 ? formatCurrency(analytics.avgCostPerWear) : "-"}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Avg Cost/Wear
              </ThemedText>
            </Card>
          </View>

          <View style={styles.overviewGrid}>
            <Card style={[styles.statCard, { flex: 1 }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.info + "20" }]}>
                <Feather name="refresh-cw" size={20} color={theme.info} />
              </View>
              <ThemedText type="h2" style={styles.statValue}>
                {analytics.totalWears}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Total Wears
              </ThemedText>
            </Card>

            <Card style={[styles.statCard, { flex: 1 }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.link + "20" }]}>
                <Feather name="layers" size={20} color={theme.link} />
              </View>
              <ThemedText type="h2" style={styles.statValue}>
                {analytics.totalItemsWithPrice}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Items Tracked
              </ThemedText>
            </Card>
          </View>

          {analytics.neverWornItems.length > 0 ? (
            <Card style={[styles.alertCard, { borderLeftColor: theme.warning }]}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertIcon, { backgroundColor: theme.warning + "20" }]}>
                  <Feather name="alert-triangle" size={18} color={theme.warning} />
                </View>
                <View style={styles.alertText}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Never Worn Items Alert
                  </ThemedText>
                  <ThemedText type="small" style={{ opacity: 0.7 }}>
                    {analytics.neverWornItems.length} item{analytics.neverWornItems.length !== 1 ? "s" : ""} worth {formatCurrency(analytics.neverWornValue)} never worn
                  </ThemedText>
                </View>
              </View>
              <View style={styles.neverWornPreview}>
                {analytics.neverWornItems.slice(0, 4).map((item, index) => (
                  <View key={item.id} style={styles.neverWornItem}>
                    {item.imageUri ? (
                      <Image source={{ uri: item.imageUri }} style={styles.neverWornImage} />
                    ) : (
                      <View style={[styles.neverWornPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                        <Feather name="image" size={16} color={theme.tabIconDefault} />
                      </View>
                    )}
                    <ThemedText type="caption" numberOfLines={1} style={styles.neverWornName}>
                      {item.name}
                    </ThemedText>
                  </View>
                ))}
                {analytics.neverWornItems.length > 4 ? (
                  <View style={[styles.moreItems, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>
                      +{analytics.neverWornItems.length - 4}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : null}

          {analytics.bestValue.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="award" size={18} color={theme.success} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Best Value Items
                </ThemedText>
              </View>
              {analytics.bestValue.map((ia, index) => (
                <Card key={ia.item.id} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <View style={[styles.rankBadge, { backgroundColor: theme.success + "20" }]}>
                      <ThemedText type="body" style={{ fontWeight: "700", color: theme.success }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    {ia.item.imageUri ? (
                      <Image source={{ uri: ia.item.imageUri }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImagePlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                        <Feather name="image" size={20} color={theme.tabIconDefault} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                        {ia.item.name}
                      </ThemedText>
                      <ThemedText type="small" style={{ opacity: 0.7 }}>
                        {ia.item.timesWorn} wears | {formatCurrency(ia.item.purchasePrice || 0)} price
                      </ThemedText>
                    </View>
                    <View style={styles.itemCpw}>
                      <ThemedText type="h3" style={{ color: getValueColor(ia.value) }}>
                        {formatCurrency(ia.costPerWear)}
                      </ThemedText>
                      <ThemedText type="caption" style={{ opacity: 0.7 }}>
                        per wear
                      </ThemedText>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          {analytics.worstValue.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="trending-up" size={18} color={theme.error} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Needs More Wear
                </ThemedText>
              </View>
              {analytics.worstValue.map((ia, index) => (
                <Card key={ia.item.id} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <View style={[styles.rankBadge, { backgroundColor: theme.error + "20" }]}>
                      <ThemedText type="body" style={{ fontWeight: "700", color: theme.error }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    {ia.item.imageUri ? (
                      <Image source={{ uri: ia.item.imageUri }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImagePlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                        <Feather name="image" size={20} color={theme.tabIconDefault} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                        {ia.item.name}
                      </ThemedText>
                      <ThemedText type="small" style={{ opacity: 0.7 }}>
                        {ia.item.timesWorn} wear{ia.item.timesWorn !== 1 ? "s" : ""} | {formatCurrency(ia.item.purchasePrice || 0)} price
                      </ThemedText>
                    </View>
                    <View style={styles.itemCpw}>
                      <ThemedText type="h3" style={{ color: getValueColor(ia.value) }}>
                        {formatCurrency(ia.costPerWear)}
                      </ThemedText>
                      <ThemedText type="caption" style={{ opacity: 0.7 }}>
                        per wear
                      </ThemedText>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          {analytics.categorySpending.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="pie-chart" size={18} color={theme.link} />
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Category Breakdown
                </ThemedText>
              </View>
              {analytics.categorySpending.map((cat) => {
                const percentage = analytics.totalValue > 0 
                  ? (cat.totalSpent / analytics.totalValue) * 100 
                  : 0;
                return (
                  <Card key={cat.category} style={styles.categoryCard}>
                    <View style={styles.categoryHeader}>
                      <View style={[styles.categoryIcon, { backgroundColor: theme.link + "20" }]}>
                        <Feather name={getCategoryIcon(cat.category) as any} size={16} color={theme.link} />
                      </View>
                      <View style={styles.categoryInfo}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>
                          {cat.label}
                        </ThemedText>
                        <ThemedText type="small" style={{ opacity: 0.7 }}>
                          {cat.itemCount} item{cat.itemCount !== 1 ? "s" : ""} | {cat.totalWears} total wears
                        </ThemedText>
                      </View>
                      <View style={styles.categoryValue}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>
                          {formatCurrency(cat.totalSpent)}
                        </ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.7 }}>
                          {percentage.toFixed(0)}%
                        </ThemedText>
                      </View>
                    </View>
                    <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            backgroundColor: theme.link, 
                            width: `${Math.min(percentage, 100)}%` 
                          }
                        ]} 
                      />
                    </View>
                    {cat.avgCostPerWear > 0 ? (
                      <View style={styles.categoryFooter}>
                        <ThemedText type="caption" style={{ opacity: 0.7 }}>
                          Avg cost per wear: {formatCurrency(cat.avgCostPerWear)}
                        </ThemedText>
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : null}

          <View style={styles.tips}>
            <ThemedText type="h3" style={styles.tipsTitle}>
              Tips to Improve Value
            </ThemedText>
            <Card style={styles.tipCard}>
              <View style={styles.tipRow}>
                <Feather name="check-circle" size={16} color={theme.success} />
                <ThemedText type="small" style={styles.tipText}>
                  Aim for under £5 cost-per-wear on everyday items
                </ThemedText>
              </View>
            </Card>
            <Card style={styles.tipCard}>
              <View style={styles.tipRow}>
                <Feather name="check-circle" size={16} color={theme.success} />
                <ThemedText type="small" style={styles.tipText}>
                  Wear your never-worn items this week to get value
                </ThemedText>
              </View>
            </Card>
            <Card style={styles.tipCard}>
              <View style={styles.tipRow}>
                <Feather name="check-circle" size={16} color={theme.success} />
                <ThemedText type="small" style={styles.tipText}>
                  Consider selling items with high cost-per-wear that you do not love
                </ThemedText>
              </View>
            </Card>
          </View>
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  overviewGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    marginTop: Spacing.xs,
  },
  alertCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  neverWornPreview: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  neverWornItem: {
    alignItems: "center",
    gap: Spacing.xs,
    width: 60,
  },
  neverWornImage: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.xs,
  },
  neverWornPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  neverWornName: {
    textAlign: "center",
    width: "100%",
  },
  moreItems: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
  },
  itemCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
  },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemCpw: {
    alignItems: "flex-end",
  },
  categoryCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryInfo: {
    flex: 1,
    gap: 2,
  },
  categoryValue: {
    alignItems: "flex-end",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  categoryFooter: {
    marginTop: Spacing.sm,
  },
  tips: {
    marginBottom: Spacing.xl,
  },
  tipsTitle: {
    marginBottom: Spacing.md,
  },
  tipCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
  },
});
