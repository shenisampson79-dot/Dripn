import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Switch,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useStyleTheme } from '@/hooks/useStyleTheme';
import { useSmartNotifications } from '@/contexts/SmartNotificationsContext';
import type { TrendNotification } from '@/contexts/SmartNotificationsContext';

const WEATHER_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  sunny: 'sun',
  hot: 'sun',
  cloudy: 'cloud',
  rainy: 'cloud-rain',
  snowy: 'cloud-snow',
  windy: 'wind',
  stormy: 'cloud-lightning',
  foggy: 'cloud',
  cold: 'thermometer',
};

const TREND_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  new_trend: 'trending-up',
  trending_item: 'tag',
  celebrity_style: 'star',
  seasonal: 'calendar',
};

export default function SmartNotificationsScreen() {
  const { theme } = useStyleTheme();
  const {
    currentWeather,
    weatherSuggestion,
    trendNotifications,
    priceAlerts,
    preferences,
    isLoading,
    locationPermissionStatus,
    refreshWeather,
    markTrendAsRead,
    clearTrendNotifications,
    requestLocationPermission,
  } = useSmartNotifications();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const weatherScale = useSharedValue(1);

  useEffect(() => {
    if (locationPermissionStatus === 'granted' && !currentWeather) {
      handleRefreshWeather();
    }
  }, [locationPermissionStatus]);

  const handleRefreshWeather = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    weatherScale.value = withSpring(0.95, {}, () => {
      weatherScale.value = withSpring(1);
    });
    await refreshWeather();
    setIsRefreshing(false);
  };

  const handleRequestLocation = async () => {
    const granted = await requestLocationPermission();
    if (granted) {
      await handleRefreshWeather();
    } else {
      Alert.alert(
        'Location Required',
        'Weather-based styling needs your location. Please enable location access in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          Platform.OS !== 'web'
            ? {
                text: 'Open Settings',
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (e) {
                    console.log('Cannot open settings');
                  }
                },
              }
            : { text: 'OK' },
        ].filter(Boolean) as any
      );
    }
  };

  const handleTrendPress = async (trend: TrendNotification) => {
    if (!trend.isRead) {
      await markTrendAsRead(trend.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleClearAllTrends = () => {
    Alert.alert(
      'Clear All Notifications',
      'Mark all trend notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          onPress: async () => {
            await clearTrendNotifications();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const weatherAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: weatherScale.value }],
  }));

  const unreadCount = trendNotifications.filter(t => !t.isRead).length;

  if (isLoading) {
    return (
      <ScreenScrollView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading notifications...
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView>
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Weather Styling</ThemedText>
          {preferences.weatherStyling ? (
            <Pressable onPress={handleRefreshWeather} disabled={isRefreshing}>
              <Feather
                name="refresh-cw"
                size={20}
                color={isRefreshing ? theme.textTertiary : theme.primary}
              />
            </Pressable>
          ) : null}
        </View>

        {locationPermissionStatus !== 'granted' ? (
          <Card style={styles.permissionCard}>
            <View style={styles.permissionContent}>
              <View style={[styles.permissionIcon, { backgroundColor: theme.primary + '20' }]}>
                <Feather name="map-pin" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionText}>
                <ThemedText style={styles.permissionTitle}>
                  Enable Weather Styling
                </ThemedText>
                <ThemedText style={[styles.permissionDescription, { color: theme.textSecondary }]}>
                  Get outfit suggestions based on your local weather conditions
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={handleRequestLocation}
              style={[styles.enableButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={styles.enableButtonText}>Enable Location</ThemedText>
            </Pressable>
          </Card>
        ) : currentWeather && weatherSuggestion ? (
          <Animated.View style={weatherAnimatedStyle}>
            <Card style={styles.weatherCard}>
              <View style={styles.weatherHeader}>
                <View style={[styles.weatherIconContainer, { backgroundColor: theme.primary + '20' }]}>
                  <Feather
                    name={WEATHER_ICONS[currentWeather.condition] || 'cloud'}
                    size={32}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.weatherInfo}>
                  <ThemedText style={styles.temperature}>
                    {currentWeather.temperature}°C
                  </ThemedText>
                  <ThemedText style={[styles.weatherDescription, { color: theme.textSecondary }]}>
                    {currentWeather.description}
                  </ThemedText>
                  <ThemedText style={[styles.cityText, { color: theme.textTertiary }]}>
                    {currentWeather.city}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.suggestionContainer, { backgroundColor: theme.surfaceSecondary }]}>
                <ThemedText style={styles.suggestionText}>
                  {weatherSuggestion.suggestion}
                </ThemedText>
              </View>

              <View style={styles.tipsSection}>
                <ThemedText style={[styles.tipsTitle, { color: theme.textSecondary }]}>
                  Today's Tips
                </ThemedText>
                {weatherSuggestion.outfitTips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Feather name="check" size={16} color={theme.primary} />
                    <ThemedText style={styles.tipText}>{tip}</ThemedText>
                  </View>
                ))}
              </View>

              <View style={styles.itemsContainer}>
                <View style={styles.itemsColumn}>
                  <ThemedText style={[styles.itemsTitle, { color: theme.primary }]}>
                    Wear
                  </ThemedText>
                  {weatherSuggestion.itemsToWear.slice(0, 4).map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Feather name="plus-circle" size={14} color={theme.primary} />
                      <ThemedText style={[styles.itemText, { color: theme.textSecondary }]}>
                        {item}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                <View style={styles.itemsColumn}>
                  <ThemedText style={[styles.itemsTitle, { color: '#FF3B30' }]}>
                    Avoid
                  </ThemedText>
                  {weatherSuggestion.itemsToAvoid.slice(0, 4).map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Feather name="minus-circle" size={14} color="#FF3B30" />
                      <ThemedText style={[styles.itemText, { color: theme.textSecondary }]}>
                        {item}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </Animated.View>
        ) : (
          <Card style={styles.noDataCard}>
            <Feather name="cloud-off" size={32} color={theme.textTertiary} />
            <ThemedText style={[styles.noDataText, { color: theme.textSecondary }]}>
              Unable to fetch weather data
            </ThemedText>
            <Pressable
              onPress={handleRefreshWeather}
              style={[styles.retryButton, { borderColor: theme.primary }]}
            >
              <ThemedText style={[styles.retryButtonText, { color: theme.primary }]}>
                Try Again
              </ThemedText>
            </Pressable>
          </Card>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <ThemedText style={styles.sectionTitle}>Trend Alerts</ThemedText>
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.badgeText}>{unreadCount}</ThemedText>
              </View>
            ) : null}
          </View>
          {trendNotifications.length > 0 ? (
            <Pressable onPress={handleClearAllTrends}>
              <ThemedText style={[styles.clearAllText, { color: theme.primary }]}>
                Clear All
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {trendNotifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="bell-off" size={32} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No trend notifications yet
            </ThemedText>
          </Card>
        ) : (
          trendNotifications.map((trend, index) => (
            <Animated.View
              key={trend.id}
              entering={FadeInDown.delay(250 + index * 50).duration(300)}
            >
              <Pressable onPress={() => handleTrendPress(trend)}>
                <Card
                  style={[
                    styles.trendCard,
                    !trend.isRead && { borderLeftWidth: 3, borderLeftColor: theme.primary },
                  ]}
                >
                  <View style={styles.trendHeader}>
                    <View
                      style={[
                        styles.trendIcon,
                        { backgroundColor: trend.isRead ? theme.surfaceSecondary : theme.primary + '20' },
                      ]}
                    >
                      <Feather
                        name={TREND_TYPE_ICONS[trend.type] || 'trending-up'}
                        size={18}
                        color={trend.isRead ? theme.textTertiary : theme.primary}
                      />
                    </View>
                    <View style={styles.trendContent}>
                      <ThemedText
                        style={[styles.trendTitle, !trend.isRead && { fontWeight: '700' }]}
                      >
                        {trend.title}
                      </ThemedText>
                      <ThemedText
                        style={[styles.trendDescription, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {trend.description}
                      </ThemedText>
                      <View style={styles.trendMeta}>
                        {trend.category ? (
                          <View style={[styles.categoryBadge, { backgroundColor: theme.surfaceSecondary }]}>
                            <ThemedText style={[styles.categoryText, { color: theme.textSecondary }]}>
                              {trend.category}
                            </ThemedText>
                          </View>
                        ) : null}
                        <ThemedText style={[styles.timeText, { color: theme.textTertiary }]}>
                          {getRelativeTime(trend.createdAt)}
                        </ThemedText>
                      </View>
                    </View>
                    {!trend.isRead ? (
                      <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          ))
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Price Alerts</ThemedText>
        </View>

        {priceAlerts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="tag" size={32} color={theme.textTertiary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No price alerts set
            </ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: theme.textTertiary }]}>
              Save items to track price drops
            </ThemedText>
          </Card>
        ) : (
          priceAlerts.map((alert) => (
            <Card key={alert.id} style={styles.alertCard}>
              <View style={styles.alertContent}>
                <View style={styles.alertInfo}>
                  <ThemedText style={styles.alertName}>{alert.itemName}</ThemedText>
                  {alert.brand ? (
                    <ThemedText style={[styles.alertBrand, { color: theme.textSecondary }]}>
                      {alert.brand}
                    </ThemedText>
                  ) : null}
                  <View style={styles.priceRow}>
                    <ThemedText style={[styles.currentPrice, { color: theme.primary }]}>
                      £{alert.currentPrice.toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.originalPrice, { color: theme.textTertiary }]}>
                      was £{alert.originalPrice.toFixed(2)}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.targetPrice, { color: theme.textSecondary }]}>
                    Alert when below £{alert.targetPrice.toFixed(2)}
                  </ThemedText>
                </View>
                {alert.isTriggered ? (
                  <View style={[styles.triggeredBadge, { backgroundColor: theme.primary }]}>
                    <Feather name="bell" size={16} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </Animated.View>
    </ScreenScrollView>
  );
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  clearAllText: {
    ...Typography.small,
    fontWeight: '500',
  },
  permissionCard: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  permissionDescription: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  enableButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  enableButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weatherCard: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  weatherIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherInfo: {
    flex: 1,
  },
  temperature: {
    ...Typography.hero,
    fontSize: 36,
  },
  weatherDescription: {
    ...Typography.body,
  },
  cityText: {
    ...Typography.small,
  },
  suggestionContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  suggestionText: {
    ...Typography.body,
    fontWeight: '500',
    textAlign: 'center',
  },
  tipsSection: {
    gap: Spacing.sm,
  },
  tipsTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tipText: {
    ...Typography.body,
    flex: 1,
  },
  itemsContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  itemsColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemsTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  itemText: {
    ...Typography.caption,
    flex: 1,
  },
  noDataCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  noDataText: {
    ...Typography.body,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  retryButtonText: {
    ...Typography.small,
    fontWeight: '500',
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
  },
  emptySubtext: {
    ...Typography.small,
    textAlign: 'center',
  },
  trendCard: {
    marginBottom: Spacing.sm,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  trendIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendContent: {
    flex: 1,
  },
  trendTitle: {
    ...Typography.body,
    fontWeight: '500',
  },
  trendDescription: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  trendMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    ...Typography.caption,
  },
  timeText: {
    ...Typography.caption,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: Spacing.xs,
  },
  alertCard: {
    marginBottom: Spacing.sm,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertInfo: {
    flex: 1,
  },
  alertName: {
    ...Typography.body,
    fontWeight: '600',
  },
  alertBrand: {
    ...Typography.small,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  currentPrice: {
    ...Typography.body,
    fontWeight: '700',
  },
  originalPrice: {
    ...Typography.small,
    textDecorationLine: 'line-through',
  },
  targetPrice: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  triggeredBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
