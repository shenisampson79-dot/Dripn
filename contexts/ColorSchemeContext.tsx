import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorSchemeMode = 'colorful' | 'minimalist';

// Minimalist palette - original app colors (understated luxury tones)
const MinimalistPalette = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  electric: '#7C3AED',
  magenta: '#DB2777',
  sapphire: '#2563EB',
  gradientPrimary: ['#667eea', '#764ba2'] as readonly [string, string],
  gradientSecondary: ['#11998e', '#38ef7d'] as readonly [string, string],
  gradientAccent: ['#f093fb', '#f5576c'] as readonly [string, string],
  gradientWarm: ['#ff6b6b', '#ee5a5a'] as readonly [string, string],
  gradientCool: ['#4facfe', '#00f2fe'] as readonly [string, string],
};

// Colorful palette - vibrant, bold, and eye-catching colors
const ColorfulPalette = {
  gold: '#FFD700',
  deepGold: '#FFA500',
  rose: '#FF69B4',
  berry: '#DC143C',
  violet: '#8A2BE2',
  deepViolet: '#9400D3',
  coral: '#FF6347',
  teal: '#00CED1',
  emerald: '#00FF7F',
  electric: '#7B68EE',
  magenta: '#FF00FF',
  sapphire: '#4169E1',
  gradientPrimary: ['#FF6B6B', '#845EC2'] as readonly [string, string],
  gradientSecondary: ['#00C9A7', '#4FFBDF'] as readonly [string, string],
  gradientAccent: ['#FF9671', '#FFC75F'] as readonly [string, string],
  gradientWarm: ['#F9F871', '#FF6F91'] as readonly [string, string],
  gradientCool: ['#0081CF', '#00F5FF'] as readonly [string, string],
};

export type SchemePalette = typeof ColorfulPalette;

interface ColorSchemeContextType {
  colorScheme: ColorSchemeMode;
  setColorScheme: (scheme: ColorSchemeMode) => Promise<void>;
  isLoading: boolean;
  palette: SchemePalette;
}

const ColorSchemeContext = createContext<ColorSchemeContextType | undefined>(undefined);

const COLOR_SCHEME_KEY = '@dripn_color_scheme';

interface ColorSchemeProviderProps {
  children: ReactNode;
}

export function ColorSchemeProvider({ children }: ColorSchemeProviderProps) {
  const [colorScheme, setColorSchemeState] = useState<ColorSchemeMode>('colorful');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadColorScheme();
  }, []);

  const loadColorScheme = async () => {
    try {
      const stored = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
      if (stored === 'colorful' || stored === 'minimalist') {
        setColorSchemeState(stored);
      }
    } catch (error) {
      console.error('Error loading color scheme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setColorScheme = async (scheme: ColorSchemeMode) => {
    // Update state immediately (offline-first)
    setColorSchemeState(scheme);
    
    // Persist to storage asynchronously
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
    } catch (error) {
      console.error('Error saving color scheme:', error);
    }
  };

  const palette = useMemo(() => {
    return colorScheme === 'minimalist' ? MinimalistPalette : ColorfulPalette;
  }, [colorScheme]);

  return (
    <ColorSchemeContext.Provider value={{ colorScheme, setColorScheme, isLoading, palette }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  if (context === undefined) {
    throw new Error('useColorScheme must be used within a ColorSchemeProvider');
  }
  return context;
}
