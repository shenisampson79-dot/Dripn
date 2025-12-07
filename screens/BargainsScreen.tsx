import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useSustainability, getEcoRatingColor } from "@/contexts/SustainabilityContext";
import { 
  BargainsService, 
  BargainDeal, 
  formatTimeRemaining, 
  isUrgent 
} from "@/services/BargainsService";
import type { BargainsStackParamList } from "@/navigation/BargainsStackNavigator";

type BargainsScreenProps = {
  navigation: NativeStackNavigationProp<BargainsStackParamList, 'Bargains'>;
};

export default function BargainsScreen({ navigation }: BargainsScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addToWishlist, wishlistItems, unreadAlertsCount } = useWishlist();
  const { getBrandEcoRating } = useSustainability();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [deals, setDeals] = useState<BargainDeal[]>([]);
  const [, forceUpdate] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isVip = user?.subscriptionTier === "vip";
  const isPremium = user?.subscriptionTier === "premium" || isVip;

  const isItemInWishlist = (dealId: string) => {
    return wishlistItems.some(item => item.dealId === dealId || item.productUrl === dealId);
  };

  const handleAddToWishlist = async (deal: BargainDeal) => {
    if (isItemInWishlist(deal.id)) {
      return;
    }
    await addToWishlist({
      dealId: deal.id,
      name: deal.title,
      brand: deal.brand,
      category: deal.category || 'Clothing',
      currentPrice: deal.salePrice,
      originalPrice: deal.originalPrice,
      productUrl: undefined,
      source: deal.source,
      currencySymbol: deal.currencySymbol,
      currencyCode: deal.currencyCode,
      notifyOnSale: true,
      notifyAtTargetPrice: false,
      gender: (deal.genderCategory as 'male' | 'female' | 'unisex') || 'unisex',
    });
  };

  const categories = BargainsService.getCategories(deals);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        setLoading(true);
        const fetchedDeals = await BargainsService.fetchDeals(user?.country);
        setDeals(fetchedDeals);
      } catch (error) {
        console.log("Error fetching deals:", error);
      } finally {
        setLoading(false);
      }
    };
    loadDeals();
  }, [user?.country]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      forceUpdate((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const filteredBargains = BargainsService.filterDeals(deals, selectedCategory, isVip, user?.gender || undefined);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const refreshedDeals = await BargainsService.refreshDeals(user?.country);
      setDeals(refreshedDeals);
    } catch (error) {
      console.log("Error refreshing deals:", error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.country]);

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.link} />
      }
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.titleRow}>
              <Feather name="tag" size={24} color={theme.link} />
              <ThemedText type="h1" style={styles.title}>
                Bargains of the Day
              </ThemedText>
            </View>
            <View style={styles.headerButtons}>
              <Pressable
                onPress={() => navigation.navigate('Sustainability')}
                style={({ pressed }) => [
                  styles.headerButton,
                  { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="globe" size={20} color={theme.link} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Wishlist')}
                style={({ pressed }) => [
                  styles.headerButton,
                  { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="heart" size={20} color={theme.link} />
                {unreadAlertsCount > 0 ? (
                  <View style={[styles.alertBadge, { backgroundColor: theme.link }]}>
                    <ThemedText type="small" style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                      {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>
          <ThemedText type="body" style={styles.subtitle}>
            Exclusive deals on your favourite brands, updated daily
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.link} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
              Finding the best deals for you...
            </ThemedText>
          </View>
        ) : null}

        {!loading ? (
          <View style={styles.categoriesContainer}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selectedCategory === category.id ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{ color: selectedCategory === category.id ? "#FFFFFF" : theme.text }}
                >
                  {category.name} ({category.count})
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!isPremium ? (
          <Card style={styles.upgradeCard}>
            <View style={styles.upgradeContent}>
              <Feather name="star" size={24} color={theme.link} />
              <View style={styles.upgradeText}>
                <ThemedText type="h3">Unlock All Deals</ThemedText>
                <ThemedText type="small" style={{ opacity: 0.7 }}>
                  Upgrade to Premium or VIP for exclusive luxury bargains up to 90% off
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.dealsContainer}>
          {filteredBargains.map((deal) => (
            <Card key={deal.id} style={styles.dealCard}>
              <View style={styles.dealHeader}>
                <View>
                  <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
                    {deal.brand}
                  </ThemedText>
                  <ThemedText type="h3">{deal.title}</ThemedText>
                </View>
                <View style={[styles.discountBadge, { backgroundColor: theme.link }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    {deal.discount}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.priceRow}>
                <ThemedText
                  type="body"
                  style={{ textDecorationLine: "line-through", opacity: 0.5 }}
                >
                  {deal.currencySymbol}{deal.currencyCode === "JPY" || deal.currencyCode === "KRW" 
                    ? deal.originalPrice.toLocaleString() 
                    : deal.originalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
                <ThemedText type="h2" style={{ color: theme.link, marginLeft: Spacing.sm }}>
                  {deal.currencySymbol}{deal.currencyCode === "JPY" || deal.currencyCode === "KRW" 
                    ? deal.salePrice.toLocaleString() 
                    : deal.salePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
              </View>

              <View style={styles.dealFooter}>
                <View style={styles.sourceRow}>
                  <Feather name="external-link" size={14} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ marginLeft: 4, opacity: 0.7 }}>
                    {deal.source}
                  </ThemedText>
                </View>
                <View style={[
                  styles.expiryRow,
                  isUrgent(deal.expiresAt) && { 
                    backgroundColor: theme.link, 
                    paddingHorizontal: 8, 
                    paddingVertical: 4, 
                    borderRadius: 6 
                  }
                ]}>
                  <Feather 
                    name="clock" 
                    size={14} 
                    color={isUrgent(deal.expiresAt) ? "#FFFFFF" : theme.tabIconDefault} 
                  />
                  <ThemedText 
                    type="small" 
                    style={{ 
                      marginLeft: 4, 
                      opacity: isUrgent(deal.expiresAt) ? 1 : 0.7,
                      color: isUrgent(deal.expiresAt) ? "#FFFFFF" : undefined,
                      fontWeight: isUrgent(deal.expiresAt) ? "600" : "400",
                    }}
                  >
                    {formatTimeRemaining(deal.expiresAt)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.badgesRow}>
                {deal.isVipOnly ? (
                  <View style={[styles.vipBadge, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="award" size={12} color={theme.link} />
                    <ThemedText type="small" style={{ marginLeft: 4, color: theme.link }}>
                      VIP Exclusive
                    </ThemedText>
                  </View>
                ) : null}
                {getBrandEcoRating(deal.brand).ecoRating !== 'unknown' ? (
                  <View style={[styles.ecoBadge, { backgroundColor: getEcoRatingColor(getBrandEcoRating(deal.brand).ecoRating) + '20' }]}>
                    <Feather name="leaf" size={12} color={getEcoRatingColor(getBrandEcoRating(deal.brand).ecoRating)} />
                    <ThemedText type="small" style={{ marginLeft: 4, color: getEcoRatingColor(getBrandEcoRating(deal.brand).ecoRating) }}>
                      Eco: {getBrandEcoRating(deal.brand).ecoRating}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.dealActions}>
                <Pressable
                  onPress={() => handleAddToWishlist(deal)}
                  style={({ pressed }) => [
                    styles.wishlistDealButton,
                    { 
                      backgroundColor: isItemInWishlist(deal.id) ? theme.link : theme.backgroundSecondary,
                      opacity: pressed ? 0.8 : 1 
                    },
                  ]}
                >
                  <Feather 
                    name={isItemInWishlist(deal.id) ? "heart" : "heart"} 
                    size={18} 
                    color={isItemInWishlist(deal.id) ? "#FFFFFF" : theme.link} 
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.shopButton,
                    { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Shop Now
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>

        <Card style={styles.infoCard}>
          <Feather name="info" size={20} color={theme.link} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, flex: 1, opacity: 0.7 }}>
            Deals are sourced from trusted retailers including Gymshark, Selfridges, The Outnet, and brand websites. Prices and availability may vary.
          </ThemedText>
        </Card>
      </ThemedView>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  title: {
    marginLeft: Spacing.xs,
  },
  headerButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  alertBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  subtitle: {
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  upgradeCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  upgradeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  upgradeText: {
    flex: 1,
  },
  dealsContainer: {
    gap: Spacing.md,
  },
  dealCard: {
    padding: Spacing.md,
  },
  dealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  discountBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  dealFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  ecoBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  dealActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  wishlistDealButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  shopButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  infoCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
