import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleTheme, StyleThemes } from '@/constants/theme';
import { apiService } from './ApiService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://0ff35e7b-c52b-436f-bc3a-caa12ac9e07a-00-ladpqjdev6jc.spock.replit.dev';

const COLOR_TRENDS_CACHE_KEY = '@dripn_color_trends';
const CACHE_EXPIRY_KEY = '@dripn_color_trends_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

export interface TrendingColor {
  hex: string;
  name: string | null;
  mood: string | null;
}

export interface TrendingPalette {
  secondary?: TrendingColor;
  accent?: TrendingColor;
}

export interface TrendColorResponse {
  year: number;
  region: string;
  palettes: Record<string, TrendingPalette>;
}

export interface MergedThemeColors {
  light: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
  };
  dark: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
  };
}

class ColorTrendService {
  private cachedTrends: TrendColorResponse | null = null;
  private cacheExpiry: number = 0;

  async fetchActiveTrends(region: string = 'Global'): Promise<TrendColorResponse | null> {
    try {
      const now = Date.now();
      if (this.cachedTrends && this.cacheExpiry > now) {
        return this.cachedTrends;
      }

      const cachedData = await AsyncStorage.getItem(COLOR_TRENDS_CACHE_KEY);
      const cachedExpiry = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);
      
      if (cachedData && cachedExpiry) {
        const expiry = parseInt(cachedExpiry);
        if (expiry > now) {
          this.cachedTrends = JSON.parse(cachedData);
          this.cacheExpiry = expiry;
          return this.cachedTrends;
        }
      }

      if (!API_URL) {
        return null;
      }

      const response = await fetch(`${API_URL}/api/color-trends/active?region=${encodeURIComponent(region)}`);
      
      if (!response.ok) {
        console.warn('Failed to fetch color trends:', response.status);
        return this.cachedTrends;
      }

      const data: TrendColorResponse = await response.json();
      
      this.cachedTrends = data;
      this.cacheExpiry = now + CACHE_DURATION_MS;
      
      await AsyncStorage.setItem(COLOR_TRENDS_CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_EXPIRY_KEY, this.cacheExpiry.toString());
      
      return data;
    } catch (error) {
      console.error('Error fetching color trends:', error);
      return this.cachedTrends;
    }
  }

  async getPantoneColorOfTheYear(year?: number): Promise<any | null> {
    try {
      const targetYear = year || new Date().getFullYear();
      
      if (!API_URL) {
        return null;
      }

      const response = await fetch(`${API_URL}/api/color-trends/pantone/${targetYear}`);
      
      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching Pantone data:', error);
      return null;
    }
  }

  getMergedThemeColors(
    styleTheme: StyleTheme,
    trendData: TrendColorResponse | null
  ): MergedThemeColors {
    const baseTheme = StyleThemes[styleTheme];
    
    if (!trendData || !trendData.palettes || !trendData.palettes[styleTheme]) {
      return baseTheme;
    }

    const trendPalette = trendData.palettes[styleTheme];
    
    return {
      light: {
        ...baseTheme.light,
        secondary: trendPalette.secondary?.hex || baseTheme.light.secondary,
        accent: trendPalette.accent?.hex || baseTheme.light.accent,
      },
      dark: {
        ...baseTheme.dark,
        secondary: trendPalette.secondary?.hex || baseTheme.dark.secondary,
        accent: trendPalette.accent?.hex || baseTheme.dark.accent,
      },
    };
  }

  isValidHexColor(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  }

  async clearCache(): Promise<void> {
    this.cachedTrends = null;
    this.cacheExpiry = 0;
    await AsyncStorage.removeItem(COLOR_TRENDS_CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_EXPIRY_KEY);
  }

  async refreshTrends(region: string = 'Global'): Promise<TrendColorResponse | null> {
    await this.clearCache();
    
    try {
      if (!API_URL) {
        return this.fetchActiveTrends(region);
      }

      const token = await apiService.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/color-trends/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ region }),
      });

      if (!response.ok) {
        console.warn('Failed to refresh color trends:', response.status);
        return this.fetchActiveTrends(region);
      }

      const data: TrendColorResponse = await response.json();
      
      const now = Date.now();
      this.cachedTrends = data;
      this.cacheExpiry = now + CACHE_DURATION_MS;
      
      await AsyncStorage.setItem(COLOR_TRENDS_CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_EXPIRY_KEY, String(this.cacheExpiry));
      
      return data;
    } catch (error) {
      console.error('Error refreshing trends:', error);
      return this.fetchActiveTrends(region);
    }
  }

  getTrendInfo(styleTheme: StyleTheme, trendData: TrendColorResponse | null): {
    hasTrendColors: boolean;
    colors: TrendingPalette | null;
    year: number | null;
    region: string | null;
  } {
    if (!trendData || !trendData.palettes || !trendData.palettes[styleTheme]) {
      return {
        hasTrendColors: false,
        colors: null,
        year: null,
        region: null,
      };
    }

    return {
      hasTrendColors: true,
      colors: trendData.palettes[styleTheme],
      year: trendData.year,
      region: trendData.region,
    };
  }
}

export const colorTrendService = new ColorTrendService();
export default colorTrendService;
