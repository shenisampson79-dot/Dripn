import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { I18nManager } from 'react-native';
import { TranslationService, Translations } from '@/services/TranslationService';
import { useVoiceSettings } from '@/contexts/VoiceSettingsContext';

interface TranslationContextType {
  translations: Translations;
  isLoading: boolean;
  isRTL: boolean;
  currentLanguage: string;
  refreshTranslations: () => Promise<void>;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const { settings } = useVoiceSettings();
  const [translations, setTranslations] = useState<Translations>(TranslationService.getTranslations());
  const [isLoading, setIsLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  useEffect(() => {
    loadInitialTranslations();
  }, []);

  useEffect(() => {
    if (settings.preferredLanguage && settings.preferredLanguage !== currentLanguage) {
      fetchTranslationsForLanguage(settings.preferredLanguage);
    }
  }, [settings.preferredLanguage]);

  const loadInitialTranslations = async () => {
    try {
      const cached = await TranslationService.loadCachedTranslations();
      setTranslations(cached);
      setCurrentLanguage(TranslationService.getCurrentLanguage());
    } catch (error) {
      console.log('Failed to load initial translations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTranslationsForLanguage = async (langCode: string) => {
    try {
      setIsLoading(true);
      const newTranslations = await TranslationService.fetchTranslations(langCode);
      setTranslations(newTranslations);
      setCurrentLanguage(langCode);
      
      const isRTL = newTranslations.localeInfo.direction === 'rtl';
      if (I18nManager.isRTL !== isRTL) {
        I18nManager.allowRTL(isRTL);
        I18nManager.forceRTL(isRTL);
      }
    } catch (error) {
      console.log('Failed to fetch translations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTranslations = useCallback(async () => {
    await fetchTranslationsForLanguage(currentLanguage);
  }, [currentLanguage]);

  const isRTL = translations.localeInfo.direction === 'rtl';

  return (
    <TranslationContext.Provider value={{ 
      translations, 
      isLoading, 
      isRTL, 
      currentLanguage,
      refreshTranslations 
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslations() {
  const context = useContext(TranslationContext);
  if (!context) {
    return {
      translations: TranslationService.getTranslations(),
      isLoading: false,
      isRTL: false,
      currentLanguage: 'en',
      refreshTranslations: async () => {},
    };
  }
  return context;
}
