import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import pushNotificationService from '@/services/PushNotificationService';
import weatherService, { type WeatherCondition as OutfitWeatherCondition } from '@/services/WeatherService';

export interface WeatherData {
  temperature: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'stormy' | 'foggy' | 'hot' | 'cold';
  humidity: number;
  description: string;
  icon: string;
  city: string;
  updatedAt: string;
}

export interface WeatherOutfitSuggestion {
  id: string;
  weather: WeatherData;
  suggestion: string;
  outfitTips: string[];
  itemsToWear: string[];
  itemsToAvoid: string[];
  generatedAt: string;
}

export interface PriceAlert {
  id: string;
  itemName: string;
  brand?: string;
  originalPrice: number;
  targetPrice: number;
  currentPrice: number;
  imageUrl?: string;
  productUrl?: string;
  retailer: string;
  isTriggered: boolean;
  createdAt: string;
  lastCheckedAt: string;
}

export interface TrendNotification {
  id: string;
  type: 'new_trend' | 'trending_item' | 'celebrity_style' | 'seasonal';
  title: string;
  description: string;
  imageUrl?: string;
  category?: string;
  relevanceScore: number;
  expiresAt?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  weatherStyling: boolean;
  weatherStylingTime: string;
  priceAlerts: boolean;
  trendNotifications: boolean;
  trendFrequency: 'daily' | 'weekly' | 'realtime';
  styleOfTheDay: boolean;
  communityVoting: boolean;
  eventReminders: boolean;
  weeklyDigest: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface SmartNotificationsContextType {
  currentWeather: WeatherData | null;
  weatherSuggestion: WeatherOutfitSuggestion | null;
  priceAlerts: PriceAlert[];
  trendNotifications: TrendNotification[];
  preferences: NotificationPreferences;
  isLoading: boolean;
  locationPermissionStatus: 'granted' | 'denied' | 'undetermined';
  refreshWeather: () => Promise<void>;
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'isTriggered' | 'createdAt' | 'lastCheckedAt'>) => Promise<PriceAlert>;
  removePriceAlert: (id: string) => Promise<void>;
  updatePriceAlertTarget: (id: string, targetPrice: number) => Promise<void>;
  markTrendAsRead: (id: string) => Promise<void>;
  clearTrendNotifications: () => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  scheduleWeatherNotification: () => Promise<void>;
}

const SmartNotificationsContext = createContext<SmartNotificationsContextType | null>(null);

const PREFERENCES_STORAGE_KEY = '@dripn_notification_prefs';
const WEATHER_STORAGE_KEY = '@dripn_weather_data';
const PRICE_ALERTS_STORAGE_KEY = '@dripn_price_alerts';
const TRENDS_STORAGE_KEY = '@dripn_trend_notifications';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  weatherStyling: true,
  weatherStylingTime: '07:00',
  priceAlerts: true,
  trendNotifications: true,
  trendFrequency: 'daily',
  styleOfTheDay: true,
  communityVoting: true,
  eventReminders: true,
  weeklyDigest: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

const WEATHER_CONDITIONS_MAP: Record<string, WeatherData['condition']> = {
  clear: 'sunny',
  clouds: 'cloudy',
  rain: 'rainy',
  drizzle: 'rainy',
  thunderstorm: 'stormy',
  snow: 'snowy',
  mist: 'foggy',
  fog: 'foggy',
  haze: 'foggy',
  wind: 'windy',
};

function mapOutfitWeatherToNotificationData(
  weather: OutfitWeatherCondition,
): WeatherData {
  const peakTemp = weather.tempMax ?? weather.temperature;
  let condition: WeatherData['condition'] = weather.condition;

  if (condition === 'sunny' || condition === 'cloudy' || condition === 'foggy') {
    if (peakTemp >= 30) condition = 'hot';
    else if (peakTemp <= 5) condition = 'cold';
  }

  if (weather.windSpeed > 25 && condition !== 'stormy' && condition !== 'rainy') {
    condition = 'windy';
  }

  return {
    temperature: peakTemp,
    condition,
    humidity: weather.humidity,
    description: weather.description,
    icon: weather.icon,
    city: weather.location,
    updatedAt: new Date(weather.timestamp).toISOString(),
  };
}

function buildSuggestionFromOutfitRecommendation(
  weather: WeatherData,
  recommendation: ReturnType<typeof weatherService.getOutfitRecommendation>,
): WeatherOutfitSuggestion {
  return {
    id: `weather_${Date.now()}`,
    weather,
    suggestion: recommendation.stylingNote,
    outfitTips: [recommendation.fabricTips, ...recommendation.layers].filter(Boolean),
    itemsToWear: [...recommendation.keyPieces, ...recommendation.accessories],
    itemsToAvoid: [],
    generatedAt: new Date().toISOString(),
  };
}

function getOutfitSuggestionsForWeather(weather: WeatherData): WeatherOutfitSuggestion {
  const suggestions: Record<WeatherData['condition'], { suggestion: string; tips: string[]; wear: string[]; avoid: string[] }> = {
    sunny: {
      suggestion: 'Perfect weather for light, breathable fabrics!',
      tips: ['Choose light colors to stay cool', 'Wear sunglasses and a hat', 'Apply sunscreen before heading out'],
      wear: ['Linen shirts', 'Cotton dresses', 'Light trousers', 'Sandals', 'Sunglasses'],
      avoid: ['Dark heavy fabrics', 'Leather jackets', 'Wool items', 'Heavy boots'],
    },
    hot: {
      suggestion: 'Stay cool with minimal, breathable layers.',
      tips: ['Opt for loose-fitting clothes', 'Stay hydrated', 'Seek shade when possible'],
      wear: ['Tank tops', 'Shorts', 'Linen', 'Light sneakers', 'Breathable fabrics'],
      avoid: ['Jeans', 'Synthetic fabrics', 'Layers', 'Dark colors'],
    },
    cloudy: {
      suggestion: 'Versatile weather - layer up for changing conditions.',
      tips: ['Bring a light jacket just in case', 'Medium-weight fabrics work well', 'Comfortable footwear recommended'],
      wear: ['Light sweaters', 'Jeans', 'Casual blazers', 'Sneakers', 'Cardigans'],
      avoid: ['Very heavy coats', 'Heavy boots', 'Rain gear (unless rain expected)'],
    },
    rainy: {
      suggestion: 'Stay dry with waterproof essentials!',
      tips: ['Waterproof outer layer is essential', 'Avoid suede and delicate fabrics', 'Carry an umbrella'],
      wear: ['Rain jackets', 'Waterproof boots', 'Umbrellas', 'Quick-dry fabrics'],
      avoid: ['Suede shoes', 'Silk', 'Light-colored bottoms', 'Open-toe shoes'],
    },
    snowy: {
      suggestion: 'Bundle up with warm, insulating layers!',
      tips: ['Layer up for warmth', 'Waterproof outerwear is key', 'Protect extremities'],
      wear: ['Puffer jackets', 'Thermal layers', 'Insulated boots', 'Scarves', 'Gloves'],
      avoid: ['Thin fabrics', 'Sneakers', 'Light jackets', 'Short socks'],
    },
    windy: {
      suggestion: 'Secure your style with wind-resistant pieces.',
      tips: ['Avoid loose, flowy items', 'Secure hair accessories', 'Windbreakers work great'],
      wear: ['Fitted jackets', 'Windbreakers', 'Secure scarves', 'Sturdy shoes'],
      avoid: ['Flowing dresses', 'Wide-brim hats', 'Loose layers', 'Skirts'],
    },
    stormy: {
      suggestion: 'Safety first - dress for protection!',
      tips: ['Stay indoors if possible', 'If going out, waterproof everything', 'Avoid metal accessories'],
      wear: ['Heavy rain gear', 'Rubber boots', 'Hooded jackets', 'Waterproof bags'],
      avoid: ['Electronic accessories', 'Light clothing', 'Umbrellas in high winds'],
    },
    foggy: {
      suggestion: 'Opt for visible, bright colors in low visibility.',
      tips: ['Wear bright or reflective items', 'Layer for cool, damp conditions', 'Be visible to drivers'],
      wear: ['Bright colors', 'Reflective elements', 'Water-resistant layers', 'Closed shoes'],
      avoid: ['All-dark outfits', 'Delicate fabrics', 'Light summer wear'],
    },
    cold: {
      suggestion: 'Layer smart for warmth without bulk.',
      tips: ['Base layer, mid layer, outer layer', 'Protect hands, head, and feet', 'Wool and fleece are your friends'],
      wear: ['Wool sweaters', 'Fleece layers', 'Insulated jackets', 'Warm boots', 'Beanies'],
      avoid: ['Cotton (it holds moisture)', 'Thin socks', 'Light jackets', 'Exposed skin'],
    },
  };

  const weatherTips = suggestions[weather.condition] || suggestions.cloudy;

  return {
    id: `weather_${Date.now()}`,
    weather,
    suggestion: weatherTips.suggestion,
    outfitTips: weatherTips.tips,
    itemsToWear: weatherTips.wear,
    itemsToAvoid: weatherTips.avoid,
    generatedAt: new Date().toISOString(),
  };
}

const MOCK_TREND_NOTIFICATIONS: TrendNotification[] = [
  {
    id: 'trend_1',
    type: 'new_trend',
    title: 'Quiet Luxury is Taking Over',
    description: 'Understated elegance with premium materials and minimal branding is the look of the season.',
    category: 'Style Movement',
    relevanceScore: 0.95,
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'trend_2',
    type: 'trending_item',
    title: 'Barrel Leg Jeans are Everywhere',
    description: 'The relaxed, curved silhouette is replacing skinny jeans as the go-to denim shape.',
    category: 'Bottoms',
    relevanceScore: 0.88,
    isRead: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend_3',
    type: 'celebrity_style',
    title: 'Celebrities Love Maxi Skirts',
    description: 'From red carpets to street style, flowing maxi skirts are making a major comeback.',
    category: 'Celebrity',
    relevanceScore: 0.82,
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend_4',
    type: 'seasonal',
    title: 'Winter Layer Essentials',
    description: 'The key pieces you need for stylish cold-weather layering this season.',
    category: 'Seasonal',
    relevanceScore: 0.78,
    isRead: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function SmartNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [weatherSuggestion, setWeatherSuggestion] = useState<WeatherOutfitSuggestion | null>(null);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [trendNotifications, setTrendNotifications] = useState<TrendNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    if (isAuthenticated && user) {
      loadData();
      checkLocationPermission();
    } else {
      setCurrentWeather(null);
      setWeatherSuggestion(null);
      setPriceAlerts([]);
      setTrendNotifications([]);
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [isAuthenticated, user?.id]);

  const checkLocationPermission = async () => {
    if (Platform.OS === 'web') {
      setLocationPermissionStatus('denied');
      return;
    }
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prefsData, weatherData, alertsData, trendsData] = await Promise.all([
        AsyncStorage.getItem(`${PREFERENCES_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${WEATHER_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${PRICE_ALERTS_STORAGE_KEY}_${user?.id}`),
        AsyncStorage.getItem(`${TRENDS_STORAGE_KEY}_${user?.id}`),
      ]);

      if (prefsData) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(prefsData) });
      }

      if (weatherData) {
        const parsed = JSON.parse(weatherData);
        setCurrentWeather(parsed.weather);
        setWeatherSuggestion(parsed.suggestion);
      }

      if (alertsData) {
        setPriceAlerts(JSON.parse(alertsData));
      }

      if (trendsData) {
        setTrendNotifications(JSON.parse(trendsData));
      } else {
        setTrendNotifications(MOCK_TREND_NOTIFICATIONS);
      }
    } catch (err) {
      console.error('Failed to load smart notifications data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async (prefs: NotificationPreferences) => {
    try {
      await AsyncStorage.setItem(`${PREFERENCES_STORAGE_KEY}_${user?.id}`, JSON.stringify(prefs));
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  const savePriceAlerts = async (alerts: PriceAlert[]) => {
    try {
      await AsyncStorage.setItem(`${PRICE_ALERTS_STORAGE_KEY}_${user?.id}`, JSON.stringify(alerts));
    } catch (err) {
      console.error('Failed to save price alerts:', err);
    }
  };

  const saveTrendNotifications = async (trends: TrendNotification[]) => {
    try {
      await AsyncStorage.setItem(`${TRENDS_STORAGE_KEY}_${user?.id}`, JSON.stringify(trends));
    } catch (err) {
      console.error('Failed to save trend notifications:', err);
    }
  };

  const saveWeatherData = async (weather: WeatherData, suggestion: WeatherOutfitSuggestion) => {
    try {
      await AsyncStorage.setItem(`${WEATHER_STORAGE_KEY}_${user?.id}`, JSON.stringify({ weather, suggestion }));
    } catch (err) {
      console.error('Failed to save weather data:', err);
    }
  };

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setLocationPermissionStatus(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const refreshWeather = useCallback(async (): Promise<void> => {
    const buildFromLiveWeather = async (): Promise<boolean> => {
      const liveWeather = await weatherService.getWeatherForOutfits().catch(() => null);
      if (!liveWeather) return false;

      const weatherData = mapOutfitWeatherToNotificationData(liveWeather);
      const recommendation = weatherService.getOutfitRecommendation(
        liveWeather,
        user?.gender ?? 'unspecified',
      );
      const suggestion = buildSuggestionFromOutfitRecommendation(weatherData, recommendation);

      setCurrentWeather(weatherData);
      setWeatherSuggestion(suggestion);
      await saveWeatherData(weatherData, suggestion);
      return true;
    };

    if (Platform.OS === 'web') {
      const usedLive = await buildFromLiveWeather();
      if (usedLive) return;

      const fallbackWeather: WeatherData = {
        temperature: 12,
        condition: 'cloudy',
        humidity: 65,
        description: 'Partly cloudy',
        icon: 'cloud',
        city: 'Your City',
        updatedAt: new Date().toISOString(),
      };
      setCurrentWeather(fallbackWeather);
      const suggestion = getOutfitSuggestionsForWeather(fallbackWeather);
      setWeatherSuggestion(suggestion);
      await saveWeatherData(fallbackWeather, suggestion);
      return;
    }

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');

      if (status !== 'granted') {
        const fallbackWeather: WeatherData = {
          temperature: 15,
          condition: 'cloudy',
          humidity: 60,
          description: 'Enable location for live weather styling',
          icon: 'cloud',
          city: 'Unknown',
          updatedAt: new Date().toISOString(),
        };
        setCurrentWeather(fallbackWeather);
        const suggestion = getOutfitSuggestionsForWeather(fallbackWeather);
        setWeatherSuggestion(suggestion);
        return;
      }

      const usedLive = await buildFromLiveWeather();
      if (!usedLive) {
        const fallbackWeather: WeatherData = {
          temperature: 15,
          condition: 'cloudy',
          humidity: 60,
          description: 'Weather unavailable',
          icon: 'cloud',
          city: 'Your Location',
          updatedAt: new Date().toISOString(),
        };
        setCurrentWeather(fallbackWeather);
        const suggestion = getOutfitSuggestionsForWeather(fallbackWeather);
        setWeatherSuggestion(suggestion);
        await saveWeatherData(fallbackWeather, suggestion);
      }
    } catch (err) {
      console.error('Failed to get weather:', err);
    }
  }, [user?.id, user?.gender]);

  const addPriceAlert = useCallback(async (
    alertData: Omit<PriceAlert, 'id' | 'isTriggered' | 'createdAt' | 'lastCheckedAt'>
  ): Promise<PriceAlert> => {
    const newAlert: PriceAlert = {
      ...alertData,
      id: `alert_${Date.now()}`,
      isTriggered: false,
      createdAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    };

    const updatedAlerts = [...priceAlerts, newAlert];
    setPriceAlerts(updatedAlerts);
    await savePriceAlerts(updatedAlerts);

    return newAlert;
  }, [priceAlerts, user?.id]);

  const removePriceAlert = useCallback(async (id: string): Promise<void> => {
    const updatedAlerts = priceAlerts.filter(a => a.id !== id);
    setPriceAlerts(updatedAlerts);
    await savePriceAlerts(updatedAlerts);
  }, [priceAlerts, user?.id]);

  const updatePriceAlertTarget = useCallback(async (id: string, targetPrice: number): Promise<void> => {
    const updatedAlerts = priceAlerts.map(a =>
      a.id === id ? { ...a, targetPrice, isTriggered: a.currentPrice <= targetPrice } : a
    );
    setPriceAlerts(updatedAlerts);
    await savePriceAlerts(updatedAlerts);
  }, [priceAlerts, user?.id]);

  const markTrendAsRead = useCallback(async (id: string): Promise<void> => {
    const updatedTrends = trendNotifications.map(t =>
      t.id === id ? { ...t, isRead: true } : t
    );
    setTrendNotifications(updatedTrends);
    await saveTrendNotifications(updatedTrends);
  }, [trendNotifications, user?.id]);

  const clearTrendNotifications = useCallback(async (): Promise<void> => {
    const clearedTrends = trendNotifications.map(t => ({ ...t, isRead: true }));
    setTrendNotifications(clearedTrends);
    await saveTrendNotifications(clearedTrends);
  }, [trendNotifications, user?.id]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>): Promise<void> => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    await savePreferences(newPrefs);
  }, [preferences, user?.id]);

  const scheduleWeatherNotification = useCallback(async (): Promise<void> => {
    if (!preferences.weatherStyling || !weatherSuggestion) return;

    const [hours, minutes] = preferences.weatherStylingTime.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const secondsUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);

    await pushNotificationService.scheduleLocalNotification(
      'Weather Styling Tip',
      weatherSuggestion.suggestion,
      {
        type: 'style_of_the_day',
        outfitSuggestion: weatherSuggestion.suggestion,
      },
      secondsUntil
    );
  }, [preferences, weatherSuggestion]);

  const value: SmartNotificationsContextType = {
    currentWeather,
    weatherSuggestion,
    priceAlerts,
    trendNotifications,
    preferences,
    isLoading,
    locationPermissionStatus,
    refreshWeather,
    addPriceAlert,
    removePriceAlert,
    updatePriceAlertTarget,
    markTrendAsRead,
    clearTrendNotifications,
    updatePreferences,
    requestLocationPermission,
    scheduleWeatherNotification,
  };

  return (
    <SmartNotificationsContext.Provider value={value}>
      {children}
    </SmartNotificationsContext.Provider>
  );
}

export function useSmartNotifications() {
  const context = useContext(SmartNotificationsContext);
  if (!context) {
    throw new Error('useSmartNotifications must be used within a SmartNotificationsProvider');
  }
  return context;
}

export { WEATHER_CONDITIONS_MAP, getOutfitSuggestionsForWeather };
