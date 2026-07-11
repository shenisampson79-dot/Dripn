import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { ScreenFlatList } from '@/components/ScreenFlatList';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useWishlist, WishlistItem, PriceAlert, SearchProduct, SAMPLE_CATEGORIES } from '@/contexts/WishlistContext';
import type { BargainsStackParamList } from '@/navigation/BargainsStackNavigator';
import { useTranslations } from "@/contexts/TranslationContext";

type WishlistScreenProps = {
  navigation: NativeStackNavigationProp<BargainsStackParamList, 'Bargains'>;
};

type ViewMode = 'items' | 'alerts' | 'search';

function formatPrice(price: number, symbol: string): string {
  return `${symbol}${price.toFixed(2)}`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function MiniPriceChart({ priceHistory, theme, currencySymbol }: { 
  priceHistory: { price: number; date: string }[]; 
  theme: any;
  currencySymbol: string;
}) {
  if (priceHistory.length < 2) return null;

  const prices = priceHistory.map(p => p.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;

  const chartWidth = 80;
  const chartHeight = 30;
  const points = priceHistory.map((entry, index) => {
    const x = (index / (priceHistory.length - 1)) * chartWidth;
    const y = chartHeight - ((entry.price - minPrice) / range) * chartHeight;
    return { x, y };
  });

  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[0];
  const isDown = currentPrice < previousPrice;

  return (
    <View style={styles.chartContainer}>
      <View style={[styles.chart, { borderColor: theme.separator }]}>
        {points.map((point, index) => (
          <View
            key={index}
            style={[
              styles.chartDot,
              {
                left: point.x - 2,
                top: point.y - 2,
                backgroundColor: isDown ? '#22C55E' : theme.destructive,
              },
            ]}
          />
        ))}
        {points.slice(0, -1).map((point, index) => {
          const nextPoint = points[index + 1];
          const dx = nextPoint.x - point.x;
          const dy = nextPoint.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          return (
            <View
              key={`line-${index}`}
              style={[
                styles.chartLine,
                {
                  left: point.x,
                  top: point.y,
                  width: length,
                  backgroundColor: isDown ? '#22C55E' : theme.destructive,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}
      </View>
      <ThemedText type="small" style={{ color: isDown ? '#22C55E' : theme.destructive }}>
        {isDown ? 'Price dropping' : 'Price rising'}
      </ThemedText>
    </View>
  );
}

export default function WishlistScreen({ navigation }: WishlistScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const {
    wishlistItems,
    priceAlerts,
    unreadAlertsCount,
    isLoading,
    isSearching,
    searchResults,
    removeFromWishlist,
    toggleSaleNotification,
    updateTargetPrice,
    markAlertAsRead,
    markAllAlertsAsRead,
    refreshPrices,
    searchProducts,
    clearSearchResults,
    addProductToWishlist,
    addItemByUrl,
    markAsPurchased,
    getOnSaleItems,
    getTotalSavings,
  } = useWishlist();

  const [viewMode, setViewMode] = useState<ViewMode>('items');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const onSaleItems = useMemo(() => getOnSaleItems(), [wishlistItems]);
  const totalSavings = useMemo(() => getTotalSavings(), [wishlistItems]);
  const currencySymbol = wishlistItems[0]?.currencySymbol || '£';

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return wishlistItems;
    return wishlistItems.filter(item => item.category === selectedCategory);
  }, [wishlistItems, selectedCategory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPrices();
    setRefreshing(false);
  }, [refreshPrices]);

  const handleRemoveItem = useCallback((item: WishlistItem) => {
    Alert.alert(
      t('wishlist.removeFromWishlist'),
      t('wishlist.removeConfirm').replace('{name}', item.name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => removeFromWishlist(item.id),
        },
      ]
    );
  }, [removeFromWishlist, t]);

  const handleSetTargetPrice = useCallback((item: WishlistItem) => {
    Alert.prompt(
      'Set Target Price',
      `Set a target price for ${item.name}. We'll notify you when it drops to this price.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Clear', onPress: () => updateTargetPrice(item.id, undefined) },
        {
          text: 'Set',
          onPress: (value: string | undefined) => {
            const price = parseFloat(value || '0');
            if (price > 0 && price < item.currentPrice) {
              updateTargetPrice(item.id, price);
            }
          },
        },
      ],
      'plain-text',
      item.targetPrice?.toString() || '',
      'decimal-pad'
    );
  }, [updateTargetPrice]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await searchProducts(searchQuery);
  }, [searchQuery, searchProducts]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    clearSearchResults();
    setViewMode('items');
  }, [clearSearchResults]);

  const handleAddByUrl = useCallback(async () => {
    if (!trackingUrl.trim()) {
      Alert.alert(t('wishlist.enterUrl'), t('wishlist.enterUrlMessage'));
      return;
    }
    
    setIsAddingUrl(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const result = await addItemByUrl(trackingUrl.trim());
      if (result.success) {
        Alert.alert(
          t('wishlist.addedExclaim'),
          t('wishlist.trackingPriceDrops').replace('{name}', result.itemName || t('wishlist.product')),
        );
        setTrackingUrl('');
      } else {
        Alert.alert(t('common.error'), result.error || t('wishlist.couldNotAddProduct'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('wishlist.failedToTrack'));
    } finally {
      setIsAddingUrl(false);
    }
  }, [trackingUrl, addItemByUrl]);

  const handleAddToWishlist = useCallback(async (product: SearchProduct) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await addProductToWishlist(product);
      Alert.alert(t('wishlist.added'), t('wishlist.addedToWishlist').replace('{name}', product.name));
    } catch (error) {
      Alert.alert(t('common.error'), t('wishlist.failedToAdd'));
    }
  }, [addProductToWishlist]);

  const handleShopNow = useCallback(async (affiliateUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL(affiliateUrl);
    } catch (error) {
      Alert.alert(t('common.error'), t('wishlist.couldNotOpenShop'));
    }
  }, []);

  const handleMarkPurchased = useCallback(async (item: WishlistItem) => {
    Alert.alert(
      t('wishlist.markAsPurchased'),
      t('wishlist.markAsPurchasedConfirm').replace('{name}', item.name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.yesIBoughtIt'),
          onPress: async () => {
            try {
              await markAsPurchased(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert(t('common.error'), t('wishlist.failedToMarkPurchased'));
            }
          },
        },
      ]
    );
  }, [markAsPurchased]);

  const renderSearchResult = useCallback(({ item }: { item: SearchProduct }) => (
    <View style={[styles.searchResultCard, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.searchResultContent}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.searchResultImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.searchResultImagePlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="shopping-bag" size={24} color={theme.tabIconDefault} />
          </View>
        )}
        <View style={styles.searchResultInfo}>
          <ThemedText type="body" numberOfLines={2} style={{ fontWeight: '600' }}>
            {item.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
            {item.retailer}
          </ThemedText>
          <ThemedText type="h3" style={{ color: LuxuryColors.gold, marginTop: Spacing.xs }}>
            {item.currency === 'GBP' ? '£' : '$'}{item.price.toFixed(2)}
          </ThemedText>
          {item.stylistNotes ? (
            <ThemedText type="small" style={{ color: theme.link, marginTop: Spacing.xs }} numberOfLines={2}>
              {item.stylistNotes}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.searchResultActions}>
        <Pressable
          onPress={() => handleAddToWishlist(item)}
          style={({ pressed }) => [
            styles.searchActionButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="heart" size={16} color="#FFFFFF" />
          <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: Spacing.xs }}>
            Save
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => handleShopNow(item.affiliateUrl)}
          style={({ pressed }) => [
            styles.searchActionButton,
            { backgroundColor: LuxuryColors.gold, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="external-link" size={16} color="#1A1A2E" />
          <ThemedText type="small" style={{ color: '#1A1A2E', marginLeft: Spacing.xs }}>
            Shop
          </ThemedText>
        </Pressable>
      </View>
    </View>
  ), [theme, handleAddToWishlist, handleShopNow]);

  const renderWishlistItem = useCallback(({ item }: { item: WishlistItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.itemCard,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <View style={[styles.itemImagePlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="shopping-bag" size={24} color={theme.tabIconDefault} />
          </View>
          <View style={styles.itemDetails}>
            <ThemedText type="h3" numberOfLines={1}>{item.name}</ThemedText>
            <ThemedText type="small" style={styles.brand}>{item.brand}</ThemedText>
            <View style={[styles.categoryBadge, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="small" style={{ color: theme.link }}>{item.category}</ThemedText>
            </View>
          </View>
        </View>
        <Pressable
          onPress={() => handleRemoveItem(item)}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="x" size={20} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      <View style={styles.priceSection}>
        <View style={styles.priceInfo}>
          <View style={styles.priceRow}>
            <ThemedText type="h2" style={{ color: item.isOnSale ? '#22C55E' : theme.text }}>
              {formatPrice(item.currentPrice, item.currencySymbol)}
            </ThemedText>
            {item.isOnSale ? (
              <View style={styles.originalPriceContainer}>
                <ThemedText type="body" style={styles.originalPrice}>
                  {formatPrice(item.originalPrice, item.currencySymbol)}
                </ThemedText>
                <View style={[styles.discountBadge, { backgroundColor: '#22C55E' }]}>
                  <ThemedText type="small" style={styles.discountText}>
                    -{item.priceDropPercent}%
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>
          {item.targetPrice ? (
            <View style={styles.targetRow}>
              <Feather name="target" size={14} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.link }}>
                Target: {formatPrice(item.targetPrice, item.currencySymbol)}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <MiniPriceChart 
          priceHistory={item.priceHistory} 
          theme={theme}
          currencySymbol={item.currencySymbol}
        />
      </View>

      <View style={[styles.itemActions, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => toggleSaleNotification(item.id)}
          style={({ pressed }) => [
            styles.actionButton,
            { 
              backgroundColor: item.notifyOnSale ? theme.link + '20' : theme.backgroundSecondary,
              opacity: pressed ? 0.8 : 1 
            },
          ]}
        >
          <Feather 
            name={item.notifyOnSale ? 'bell' : 'bell-off'} 
            size={16} 
            color={item.notifyOnSale ? theme.link : theme.tabIconDefault} 
          />
          <ThemedText type="small" style={{ color: item.notifyOnSale ? theme.link : theme.text }}>
            Sale Alerts
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleSetTargetPrice(item)}
          style={({ pressed }) => [
            styles.actionButton,
            { 
              backgroundColor: item.targetPrice ? theme.link + '20' : theme.backgroundSecondary,
              opacity: pressed ? 0.8 : 1 
            },
          ]}
        >
          <Feather name="target" size={16} color={item.targetPrice ? theme.link : theme.tabIconDefault} />
          <ThemedText type="small" style={{ color: item.targetPrice ? theme.link : theme.text }}>
            Target Price
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="external-link" size={16} color="#FFFFFF" />
          <ThemedText type="small" style={{ color: '#FFFFFF' }}>Shop</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="small" style={styles.lastChecked}>
        Last checked: {formatTimeAgo(item.lastChecked)}
      </ThemedText>
    </Pressable>
  ), [theme, handleRemoveItem, toggleSaleNotification, handleSetTargetPrice]);

  const renderAlert = useCallback(({ item }: { item: PriceAlert }) => (
    <Pressable
      onPress={() => markAlertAsRead(item.id)}
      style={({ pressed }) => [
        styles.alertCard,
        { 
          backgroundColor: item.isRead ? theme.backgroundDefault : theme.link + '10',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[
        styles.alertIcon,
        { 
          backgroundColor: item.type === 'target_reached' ? '#22C55E' : theme.link,
        },
      ]}>
        <Feather 
          name={item.type === 'target_reached' ? 'check-circle' : 'trending-down'} 
          size={20} 
          color="#FFFFFF" 
        />
      </View>
      <View style={styles.alertContent}>
        <ThemedText type="h3" style={!item.isRead ? { fontWeight: '700' } : undefined}>
          {item.type === 'target_reached' ? 'Target Price Reached!' : 'Price Drop Alert'}
        </ThemedText>
        <ThemedText type="body" numberOfLines={2}>
          {item.brand} {item.itemName}
        </ThemedText>
        <View style={styles.alertPriceRow}>
          <ThemedText type="small" style={styles.previousPrice}>
            {item.currencySymbol}{item.previousPrice.toFixed(2)}
          </ThemedText>
          <Feather name="arrow-right" size={12} color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ color: '#22C55E', fontWeight: '600' }}>
            {item.currencySymbol}{item.newPrice.toFixed(2)}
          </ThemedText>
          <View style={[styles.dropBadge, { backgroundColor: '#22C55E' }]}>
            <ThemedText type="small" style={styles.dropText}>-{item.dropPercent}%</ThemedText>
          </View>
        </View>
        <ThemedText type="small" style={styles.alertTime}>
          {formatTimeAgo(item.timestamp)}
        </ThemedText>
      </View>
      {!item.isRead ? (
        <View style={[styles.unreadDot, { backgroundColor: theme.link }]} />
      ) : null}
    </Pressable>
  ), [theme, markAlertAsRead]);

  const ListHeader = useCallback(() => (
    <View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="heart" size={20} color={theme.link} />
          <ThemedText type="h2">{wishlistItems.length}</ThemedText>
          <ThemedText type="small" style={styles.statLabel}>Items</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="tag" size={20} color="#22C55E" />
          <ThemedText type="h2">{onSaleItems.length}</ThemedText>
          <ThemedText type="small" style={styles.statLabel}>On Sale</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="dollar-sign" size={20} color={theme.link} />
          <ThemedText type="h2">{currencySymbol}{totalSavings.toFixed(0)}</ThemedText>
          <ThemedText type="small" style={styles.statLabel}>Savings</ThemedText>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.tabIconDefault} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t('common.searchFashionProducts') || "Search fashion products..."}
            placeholderTextColor={theme.tabIconDefault}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch}>
              <Feather name="x-circle" size={20} color={theme.tabIconDefault} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => { setViewMode('items'); clearSearchResults(); }}
          style={[
            styles.toggleButton,
            { backgroundColor: viewMode === 'items' ? theme.link : theme.backgroundDefault },
          ]}
        >
          <Feather 
            name="heart" 
            size={16} 
            color={viewMode === 'items' ? '#FFFFFF' : theme.tabIconDefault} 
          />
          <ThemedText 
            type="body" 
            style={{ color: viewMode === 'items' ? '#FFFFFF' : theme.text }}
          >
            Wishlist
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => { setViewMode('search'); }}
          style={[
            styles.toggleButton,
            { backgroundColor: viewMode === 'search' ? LuxuryColors.gold : theme.backgroundDefault },
          ]}
        >
          <Feather 
            name="shopping-bag" 
            size={16} 
            color={viewMode === 'search' ? '#1A1A2E' : theme.tabIconDefault} 
          />
          <ThemedText 
            type="body" 
            style={{ color: viewMode === 'search' ? '#1A1A2E' : theme.text }}
          >
            Shop
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('alerts')}
          style={[
            styles.toggleButton,
            { backgroundColor: viewMode === 'alerts' ? theme.link : theme.backgroundDefault },
          ]}
        >
          <Feather 
            name="bell" 
            size={16} 
            color={viewMode === 'alerts' ? '#FFFFFF' : theme.tabIconDefault} 
          />
          <ThemedText 
            type="body" 
            style={{ color: viewMode === 'alerts' ? '#FFFFFF' : theme.text }}
          >
            Alerts
          </ThemedText>
          {unreadAlertsCount > 0 ? (
            <View style={[styles.alertBadge, { backgroundColor: '#EF4444' }]}>
              <ThemedText type="small" style={styles.alertBadgeText}>
                {unreadAlertsCount}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {viewMode === 'items' ? (
        <>
          <View style={[styles.urlInputSection, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.urlInputHeader}>
              <Feather name="link" size={16} color={LuxuryColors.gold} />
              <ThemedText type="body" style={{ fontWeight: '600', marginLeft: Spacing.xs }}>
                Track Any Product
              </ThemedText>
            </View>
            <View style={styles.urlInputRow}>
              <TextInput
                style={[styles.urlInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder={t('common.pasteProductUrlFromAnyRetailer') || "Paste product URL from any retailer..."}
                placeholderTextColor={theme.tabIconDefault}
                value={trackingUrl}
                onChangeText={setTrackingUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={handleAddByUrl}
                disabled={isAddingUrl}
                style={({ pressed }) => [
                  styles.urlAddButton,
                  { backgroundColor: LuxuryColors.gold, opacity: pressed || isAddingUrl ? 0.7 : 1 },
                ]}
              >
                {isAddingUrl ? (
                  <ActivityIndicator size="small" color="#1A1A2E" />
                ) : (
                  <Feather name="plus" size={20} color="#1A1A2E" />
                )}
              </Pressable>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {SAMPLE_CATEGORIES.map(category => (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[
                styles.categoryChip,
                { 
                  backgroundColor: selectedCategory === category 
                    ? theme.link 
                    : theme.backgroundDefault 
                },
              ]}
            >
              <ThemedText 
                type="body" 
                style={{ 
                  color: selectedCategory === category ? '#FFFFFF' : theme.text 
                }}
              >
                {category}
              </ThemedText>
            </Pressable>
          ))}
          </ScrollView>
        </>
      ) : null}

      {viewMode === 'alerts' && priceAlerts.length > 0 ? (
        <View style={styles.alertsHeader}>
          <ThemedText type="h3">{priceAlerts.length} Alert{priceAlerts.length !== 1 ? 's' : ''}</ThemedText>
          <Pressable onPress={markAllAlertsAsRead}>
            <ThemedText type="small" style={{ color: theme.link }}>Mark all read</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {viewMode === 'search' ? (
        <View style={styles.searchResultsHeader}>
          <ThemedText type="h3">
            {isSearching ? 'Searching...' : (searchResults.length > 0 ? `${searchResults.length} Results` : 'Search for products')}
          </ThemedText>
          {isSearching ? (
            <ActivityIndicator size="small" color={theme.link} />
          ) : null}
        </View>
      ) : null}
    </View>
  ), [theme, wishlistItems.length, onSaleItems.length, totalSavings, currencySymbol, viewMode, selectedCategory, unreadAlertsCount, priceAlerts.length, markAllAlertsAsRead, searchQuery, handleSearch, handleClearSearch, clearSearchResults, searchResults.length, isSearching, trackingUrl, isAddingUrl, handleAddByUrl]);

  const EmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather 
          name={viewMode === 'items' ? 'heart' : viewMode === 'search' ? 'shopping-bag' : 'bell'} 
          size={48} 
          color={theme.tabIconDefault} 
        />
      </View>
      <ThemedText type="h2" style={styles.emptyTitle}>
        {viewMode === 'items' ? 'Your wishlist is empty' : viewMode === 'search' ? 'Search for fashion products' : 'No price alerts yet'}
      </ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        {viewMode === 'items' 
          ? 'Add items from the Bargains section to track prices and get alerts when they drop.'
          : viewMode === 'search'
          ? 'Type a product name or style to find items with affiliate links.'
          : 'When items on your wishlist drop in price, you\'ll see alerts here.'
        }
      </ThemedText>
      {viewMode === 'items' ? (
        <Pressable
          onPress={() => setViewMode('search')}
          style={[styles.browseButton, { backgroundColor: LuxuryColors.gold }]}
        >
          <Feather name="shopping-bag" size={20} color="#1A1A2E" />
          <ThemedText type="body" style={[styles.browseButtonText, { color: '#1A1A2E' }]}>
            Shop Products
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  ), [theme, viewMode, navigation]);

  const getListData = () => {
    if (viewMode === 'items') return filteredItems;
    if (viewMode === 'search') return searchResults;
    return priceAlerts;
  };

  const getRenderItem = () => {
    if (viewMode === 'items') return renderWishlistItem;
    if (viewMode === 'search') return renderSearchResult;
    return renderAlert;
  };

  const listData = getListData();

  return (
    <ScreenFlatList
      data={listData as any}
      keyExtractor={(item: any) => item.id}
      renderItem={getRenderItem() as any}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={EmptyState}
      contentContainerStyle={listData.length === 0 ? styles.emptyContainer : undefined}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.link}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    opacity: 0.7,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  alertBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  categoriesContainer: {
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  itemInfo: {
    flexDirection: 'row',
    flex: 1,
    gap: Spacing.md,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
    gap: 4,
  },
  brand: {
    opacity: 0.7,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: 4,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  priceInfo: {
    gap: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  originalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  discountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  discountText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chartContainer: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  chart: {
    width: 80,
    height: 30,
    position: 'relative',
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
  },
  chartDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chartLine: {
    position: 'absolute',
    height: 1,
    transformOrigin: 'left',
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  lastChecked: {
    opacity: 0.5,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  alertCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  previousPrice: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  dropBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    marginLeft: Spacing.xs,
  },
  dropText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 10,
  },
  alertTime: {
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Spacing.xl,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  searchResultCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchResultContent: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  searchResultImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
  },
  searchResultImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  searchActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  urlInputSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  urlInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    fontSize: 14,
  },
  urlAddButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
