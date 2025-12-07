import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { StyleThemes, StyleTheme } from '@/constants/theme';
import colorTrendService, { TrendColorResponse, MergedThemeColors, TrendingPalette } from '@/services/ColorTrendService';

interface StyleThemeResult {
  theme: MergedThemeColors['light'] | MergedThemeColors['dark'];
  isDark: boolean;
  styleTheme: StyleTheme;
  hasTrendColors: boolean;
  trendInfo: {
    year: number | null;
    region: string | null;
    colors: TrendingPalette | null;
  };
  isLoading: boolean;
  refreshTrends: () => Promise<void>;
}

const countryToRegion: Record<string, string> = {
  'United States': 'North America',
  'Canada': 'North America',
  'Mexico': 'North America',
  'United Kingdom': 'Europe',
  'France': 'Europe',
  'Germany': 'Europe',
  'Italy': 'Europe',
  'Spain': 'Europe',
  'Netherlands': 'Europe',
  'Sweden': 'Europe',
  'Japan': 'Asia',
  'South Korea': 'Asia',
  'China': 'Asia',
  'India': 'Asia',
  'Australia': 'Oceania',
  'New Zealand': 'Oceania',
  'Brazil': 'South America',
  'Argentina': 'South America',
  'Nigeria': 'Africa',
  'South Africa': 'Africa',
  'Kenya': 'Africa',
  'UAE': 'Middle East',
  'Saudi Arabia': 'Middle East',
  'Israel': 'Middle East',
};

function getRegionFromCountry(country: string): string {
  return countryToRegion[country] || 'Global';
}

export function useStyleTheme(): StyleThemeResult {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [trendData, setTrendData] = useState<TrendColorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const styleTheme: StyleTheme = user?.stylePreference || 'luxury';
  const userCountry = user?.country || '';
  const region = userCountry ? getRegionFromCountry(userCountry) : 'Global';

  const fetchTrends = useCallback(async () => {
    const currentRegion = userCountry ? getRegionFromCountry(userCountry) : 'Global';
    setIsLoading(true);
    try {
      const data = await colorTrendService.fetchActiveTrends(currentRegion);
      setTrendData(data);
    } catch (error) {
      console.error('Failed to fetch color trends:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userCountry]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const refreshTrends = useCallback(async () => {
    const currentRegion = userCountry ? getRegionFromCountry(userCountry) : 'Global';
    setIsLoading(true);
    try {
      const data = await colorTrendService.refreshTrends(currentRegion);
      setTrendData(data);
    } catch (error) {
      console.error('Failed to refresh color trends:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userCountry]);

  const mergedColors = colorTrendService.getMergedThemeColors(styleTheme, trendData);
  const trendInfo = colorTrendService.getTrendInfo(styleTheme, trendData);

  const theme = isDark ? mergedColors.dark : mergedColors.light;

  return {
    theme,
    isDark,
    styleTheme,
    hasTrendColors: trendInfo.hasTrendColors,
    trendInfo: {
      year: trendInfo.year,
      region: trendInfo.region,
      colors: trendInfo.colors,
    },
    isLoading,
    refreshTrends,
  };
}

export function useBaseStyleTheme(styleTheme: StyleTheme = 'luxury') {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const themeColors = StyleThemes[styleTheme];
  const theme = isDark ? themeColors.dark : themeColors.light;

  return {
    theme,
    isDark,
    styleTheme,
  };
}
