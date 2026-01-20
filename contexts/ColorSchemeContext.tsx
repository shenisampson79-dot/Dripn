import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorSchemeMode = 'colorful' | 'minimalist';

interface ColorSchemeContextType {
  colorScheme: ColorSchemeMode;
  setColorScheme: (scheme: ColorSchemeMode) => Promise<void>;
  isLoading: boolean;
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
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
      setColorSchemeState(scheme);
    } catch (error) {
      console.error('Error saving color scheme:', error);
    }
  };

  return (
    <ColorSchemeContext.Provider value={{ colorScheme, setColorScheme, isLoading }}>
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
