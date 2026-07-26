import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorSchemeMode = 'colorful' | 'minimalist';

// Minimalist palette - browns/beige/cream only (no other colors)
const MinimalistPalette = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#D4C4B0',
  berry: '#8B7355',
  violet: '#B8A898',
  deepViolet: '#9C8B7A',
  coral: '#C4A484',
  teal: '#A69279',
  emerald: '#8B7D6B',
  electric: '#6B5B4F',
  magenta: '#9C8674',
  sapphire: '#7A6A5A',
  gradientPrimary: ['#C9A87C', '#A88B5C'] as readonly [string, string],
  gradientSecondary: ['#D4C4B0', '#B8A890'] as readonly [string, string],
  gradientAccent: ['#A89888', '#8B7D6B'] as readonly [string, string],
  gradientWarm: ['#C4A484', '#A69279'] as readonly [string, string],
  gradientCool: ['#968269', '#7A6A5A'] as readonly [string, string],
  gradientJewel: ['#B8A898', '#9C8B7A'] as readonly [string, string],
  gradientSunset: ['#D4C4B0', '#C9A87C'] as readonly [string, string],
  gradientOcean: ['#8B7D6B', '#6B5B4F'] as readonly [string, string],
};

// Colorful palette - vibrant, bold gradient colors (each hub tile gets a unique pair)
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
  gradientPrimary: ['#667eea', '#764ba2'] as readonly [string, string],
  gradientSecondary: ['#11998e', '#38ef7d'] as readonly [string, string],
  gradientAccent: ['#f093fb', '#f5576c'] as readonly [string, string],
  gradientWarm: ['#ff6b6b', '#ee5a24'] as readonly [string, string],
  gradientCool: ['#4facfe', '#00f2fe'] as readonly [string, string],
  gradientJewel: ['#c471f5', '#fa71cd'] as readonly [string, string],
  gradientSunset: ['#f6d365', '#fda085'] as readonly [string, string],
  gradientOcean: ['#2193b0', '#6dd5ed'] as readonly [string, string],
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
