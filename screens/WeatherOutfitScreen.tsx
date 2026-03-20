/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Weather-based Outfit Recommendations Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWardrobe } from '@/contexts/WardrobeContext';
import weatherService, { WeatherCondition, WeatherOutfitRecommendation } from '@/services/WeatherService';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';

type WeatherOutfitScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'WeatherOutfit'>;
};

const WEATHER_GRADIENTS: Record<string, [string, string]> = {
  sunny: ['#FFD93D', '#FF914D'],
  cloudy: ['#6B7280', '#9CA3AF'],
  rainy: ['#4B5563', '#6B7280'],
  snowy: ['#E5E7EB', '#D1D5DB'],
  windy: ['#60A5FA', '#3B82F6'],
  foggy: ['#9CA3AF', '#D1D5DB'],
  stormy: ['#1F2937', '#374151'],
};

export default function WeatherOutfitScreen({ navigation }: WeatherOutfitScreenProps) {
  const { theme } = useTheme();
  const { translations } = useTranslations();
  const { user } = useAuth();
  const { items } = useWardrobe();
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [recommendation, setRecommendation] = useState<WeatherOutfitRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'loading' | 'granted' | 'denied' | 'canAsk'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkPermissionAndFetch = useCallback(async () => {
    setIsLoading(true);
    
    const permStatus = await weatherService.checkPermissionStatus();
    
    if (permStatus.granted) {
      setPermissionStatus('granted');
      const weatherData = await weatherService.getCurrentWeather();
      if (weatherData) {
        setWeather(weatherData);
        const rec = weatherService.getOutfitRecommendation(weatherData, user?.gender || 'unspecified');
        setRecommendation(rec);
      }
    } else if (permStatus.canAskAgain) {
      setPermissionStatus('canAsk');
    } else {
      setPermissionStatus('denied');
    }
    
    setIsLoading(false);
  }, [user?.gender]);

  useEffect(() => {
    checkPermissionAndFetch();
  }, [checkPermissionAndFetch]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkPermissionAndFetch();
    setIsRefreshing(false);
  };

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const granted = await weatherService.requestPermission();
    if (granted) {
      setPermissionStatus('granted');
      setIsLoading(true);
      const weatherData = await weatherService.getCurrentWeather();
      if (weatherData) {
        setWeather(weatherData);
        const rec = weatherService.getOutfitRecommendation(weatherData, user?.gender || 'unspecified');
        setRecommendation(rec);
      }
      setIsLoading(false);
    } else {
      const permStatus = await weatherService.checkPermissionStatus();
      setPermissionStatus(permStatus.canAskAgain ? 'canAsk' : 'denied');
    }
  };

  const getWardrobeMatches = () => {
    if (!recommendation || items.length === 0) return [];
    
    const season = weather ? weatherService.getSeasonFromTemperature(weather.temperature) : 'all-season';
    const matchingItems = items.filter(item => 
      item.seasons.includes(season) || item.seasons.includes('all-season')
    );
    
    return matchingItems.slice(0, 6);
  };

  const wardrobeMatches = getWardrobeMatches();

  if (isLoading || permissionStatus === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg }}>
          Checking the weather...
        </ThemedText>
      </View>
    );
  }

  if (permissionStatus === 'canAsk' || permissionStatus === 'denied') {
    const openSettings = async () => {
      if (Platform.OS !== 'web') {
        try {
          await Linking.openSettings();
        } catch {
        }
      }
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">{translations.stylistHub?.weatherOutfits || 'Weather Outfits'}</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIcon, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="map-pin" size={48} color={theme.tabIconDefault} />
          </View>
          <ThemedText type="h3" style={styles.permissionTitle}>
            Location Access Needed
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            To provide weather-based outfit recommendations, we need access to your location.
          </ThemedText>
          {permissionStatus === 'canAsk' ? (
            <Pressable
              onPress={requestPermission}
              style={[styles.permissionButton, { backgroundColor: theme.link }]}
            >
              <Feather name="map-pin" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.permissionButtonText}>
                Enable Location
              </ThemedText>
            </Pressable>
          ) : Platform.OS !== 'web' ? (
            <Pressable
              onPress={openSettings}
              style={[styles.permissionButton, { backgroundColor: theme.link }]}
            >
              <Feather name="settings" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.permissionButtonText}>
                Open Settings
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="body" style={{ textAlign: 'center', opacity: 0.7 }}>
              Run in Expo Go to use this feature
            </ThemedText>
          )}
        </View>
      </View>
    );
  }

  const gradientColors = weather 
    ? WEATHER_GRADIENTS[weather.condition] || WEATHER_GRADIENTS.cloudy
    : WEATHER_GRADIENTS.cloudy;

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">{translations.stylistHub?.weatherOutfits || 'Weather Outfits'}</ThemedText>
        <Pressable
          onPress={handleRefresh}
          style={[styles.backButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="refresh-cw" size={20} color={theme.text} />
        </Pressable>
      </View>

      {weather ? (
        <Animated.View entering={FadeIn.duration(400)}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.weatherCard}
          >
            <View style={styles.weatherHeader}>
              <View>
                <ThemedText type="caption" style={styles.weatherLocation}>
                  {weather.location}
                </ThemedText>
                <ThemedText type="h1" style={styles.weatherTemp}>
                  {weather.temperature}°C
                </ThemedText>
                <ThemedText type="body" style={styles.weatherDesc}>
                  {weather.description}
                </ThemedText>
              </View>
              <View style={styles.weatherIconContainer}>
                <Feather name={weather.icon as any} size={64} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.weatherDetails}>
              <View style={styles.weatherDetail}>
                <Feather name="thermometer" size={16} color="rgba(255,255,255,0.8)" />
                <ThemedText type="small" style={styles.weatherDetailText}>
                  Feels like {weather.feelsLike}°C
                </ThemedText>
              </View>
              <View style={styles.weatherDetail}>
                <Feather name="droplet" size={16} color="rgba(255,255,255,0.8)" />
                <ThemedText type="small" style={styles.weatherDetailText}>
                  {weather.humidity}% humidity
                </ThemedText>
              </View>
              <View style={styles.weatherDetail}>
                <Feather name="wind" size={16} color="rgba(255,255,255,0.8)" />
                <ThemedText type="small" style={styles.weatherDetailText}>
                  {weather.windSpeed} km/h wind
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      ) : null}

      {recommendation ? (
        <>
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Today's Outfit Recommendation
            </ThemedText>
            
            <Card style={styles.recommendationCard}>
              <View style={styles.layersSection}>
                <Feather name="layers" size={20} color={theme.link} />
                <View style={styles.layersContent}>
                  <ThemedText type="caption" style={{ opacity: 0.7 }}>Layering</ThemedText>
                  <ThemedText type="body">{recommendation.layers.join(' + ')}</ThemedText>
                </View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Key Pieces
            </ThemedText>
            <View style={styles.piecesGrid}>
              {recommendation.keyPieces.map((piece, index) => (
                <View
                  key={index}
                  style={[styles.pieceChip, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="check" size={14} color={theme.link} />
                  <ThemedText type="small">{piece}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).duration(400)}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Accessories
            </ThemedText>
            <View style={styles.accessoriesRow}>
              {recommendation.accessories.map((accessory, index) => (
                <View
                  key={index}
                  style={[styles.accessoryChip, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <ThemedText type="small">{accessory}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).duration(400)}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Color Palette
            </ThemedText>
            <View style={styles.colorsRow}>
              {recommendation.colors.map((color, index) => (
                <View
                  key={index}
                  style={[styles.colorChip, { backgroundColor: theme.backgroundDefault }]}
                >
                  <View style={[styles.colorDot, { backgroundColor: getColorHex(color) }]} />
                  <ThemedText type="small">{color}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(400)}>
            <Card style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <Feather name="info" size={18} color={theme.link} />
                <ThemedText type="caption" style={{ fontWeight: '600' }}>Fabric Tip</ThemedText>
              </View>
              <ThemedText type="body" style={styles.tipText}>
                {recommendation.fabricTips}
              </ThemedText>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(700).duration(400)}>
            <Card style={[styles.noteCard, { backgroundColor: theme.link + '15' }]}>
              <View style={styles.noteHeader}>
                <Feather name="star" size={18} color={theme.link} />
                <ThemedText type="caption" style={{ fontWeight: '600', color: theme.link }}>
                  Styling Note
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ color: theme.text }}>
                {recommendation.stylingNote}
              </ThemedText>
            </Card>
          </Animated.View>

          {wardrobeMatches.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(800).duration(400)}>
              <View style={styles.wardrobeHeader}>
                <ThemedText type="h3">From Your Wardrobe</ThemedText>
                <Pressable
                  onPress={() => navigation.navigate('Wardrobe')}
                  style={styles.viewAllButton}
                >
                  <ThemedText type="small" style={{ color: theme.link }}>View All</ThemedText>
                  <Feather name="chevron-right" size={16} color={theme.link} />
                </Pressable>
              </View>
              <ThemedText type="caption" style={styles.wardrobeSubtitle}>
                Items that match today's weather
              </ThemedText>
              <View style={styles.wardrobeGrid}>
                {wardrobeMatches.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.wardrobeItem, { backgroundColor: theme.backgroundDefault }]}
                  >
                    <View style={[styles.wardrobeItemImage, { backgroundColor: theme.backgroundSecondary }]}>
                      {item.imageUri ? (
                        <Image
                          source={{ uri: item.imageUri }}
                          style={{ width: 100, height: 100 }}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <Feather name="image" size={24} color={theme.tabIconDefault} />
                      )}
                    </View>
                    <ThemedText type="caption" numberOfLines={1} style={styles.wardrobeItemName}>
                      {item.name}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </ScreenScrollView>
  );
}

function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'White': '#FFFFFF',
    'Cream': '#FFFDD0',
    'Pastels': '#FFB6C1',
    'Light blue': '#ADD8E6',
    'Earth tones': '#8B4513',
    'Sage green': '#9DC183',
    'Dusty rose': '#DCAE96',
    'Camel': '#C19A6B',
    'Burgundy': '#800020',
    'Forest green': '#228B22',
    'Chocolate brown': '#7B3F00',
    'Navy': '#000080',
    'Black': '#000000',
    'Charcoal': '#36454F',
    'Deep burgundy': '#722F37',
    'Deep navy': '#000033',
    'Cream accents': '#FFFDD0',
  };
  return colorMap[colorName] || '#808080';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  permissionTitle: {
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weatherCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  weatherLocation: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.xs,
  },
  weatherTemp: {
    color: '#FFFFFF',
    fontSize: 48,
  },
  weatherDesc: {
    color: 'rgba(255,255,255,0.9)',
  },
  weatherIconContainer: {
    opacity: 0.9,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weatherDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  weatherDetailText: {
    color: 'rgba(255,255,255,0.8)',
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  recommendationCard: {
    padding: Spacing.lg,
  },
  layersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  layersContent: {
    flex: 1,
  },
  piecesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pieceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  accessoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  accessoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  colorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tipCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipText: {
    opacity: 0.8,
  },
  noteCard: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  wardrobeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  wardrobeSubtitle: {
    opacity: 0.6,
    marginBottom: Spacing.md,
  },
  wardrobeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  wardrobeItem: {
    width: 100,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  wardrobeItemImage: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeItemName: {
    padding: Spacing.sm,
    textAlign: 'center',
  },
});
