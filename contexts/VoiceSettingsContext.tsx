import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type VoiceSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export interface VoiceLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: VoiceLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
];

export const VOICE_OPTIONS: { id: VoiceId; name: string; description: string; gender: 'female' | 'male' | 'neutral' }[] = [
  { id: 'nova', name: 'Nova', description: 'Warm and friendly', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft and elegant', gender: 'female' },
  { id: 'alloy', name: 'Alloy', description: 'Clear and balanced', gender: 'neutral' },
  { id: 'echo', name: 'Echo', description: 'Smooth and resonant', gender: 'male' },
  { id: 'fable', name: 'Fable', description: 'Expressive and dynamic', gender: 'neutral' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative', gender: 'male' },
];

export const SPEED_OPTIONS: { value: VoiceSpeed; label: string }[] = [
  { value: 0.5, label: 'Very Slow' },
  { value: 0.75, label: 'Slow' },
  { value: 1.0, label: 'Normal' },
  { value: 1.25, label: 'Fast' },
  { value: 1.5, label: 'Very Fast' },
  { value: 2.0, label: 'Maximum' },
];

export interface VoiceSettings {
  ttsEnabled: boolean;
  preferredLanguage: string;
  voiceSpeed: VoiceSpeed;
  preferredVoice: VoiceId;
  autoPlayResponses: boolean;
  showTranscriptions: boolean;
}

interface VoiceSettingsContextType {
  settings: VoiceSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<VoiceSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  getVoiceForStylist: (stylistId: 'ruby' | 'max') => VoiceId;
}

const VoiceSettingsContext = createContext<VoiceSettingsContextType | null>(null);

const STORAGE_KEY = '@dripn_voice_settings';

const DEFAULT_SETTINGS: VoiceSettings = {
  ttsEnabled: true,
  preferredLanguage: 'en',
  voiceSpeed: 1.0,
  preferredVoice: 'nova',
  autoPlayResponses: true,
  showTranscriptions: true,
};

export function VoiceSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load voice settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = useCallback(async (updates: Partial<VoiceSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save voice settings:', error);
      throw error;
    }
  }, [settings]);

  const resetSettings = useCallback(async () => {
    try {
      setSettings(DEFAULT_SETTINGS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
      console.error('Failed to reset voice settings:', error);
      throw error;
    }
  }, []);

  const getVoiceForStylist = useCallback((stylistId: 'ruby' | 'max'): VoiceId => {
    // Always honor user's preferred voice setting
    // The preferredVoice in settings takes priority
    return settings.preferredVoice;
  }, [settings.preferredVoice]);

  return (
    <VoiceSettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        resetSettings,
        getVoiceForStylist,
      }}
    >
      {children}
    </VoiceSettingsContext.Provider>
  );
}

export function useVoiceSettings() {
  const context = useContext(VoiceSettingsContext);
  if (!context) {
    throw new Error('useVoiceSettings must be used within a VoiceSettingsProvider');
  }
  return context;
}
