import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { I18nManager } from 'react-native';
import { TranslationService, Translations } from '@/services/TranslationService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface TranslationContextType {
  translations: Translations;
  isLoading: boolean;
  isRTL: boolean;
  currentLanguage: string;
  availableLanguages: Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }>;
  refreshTranslations: () => Promise<void>;
  setLanguage: (langCode: string) => Promise<void>;
  syncFromAccent: (accent: string) => Promise<void>;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [translations, setTranslations] = useState<Translations>(TranslationService.getTranslations());
  const [isLoading, setIsLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [availableLanguages, setAvailableLanguages] = useState<Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }>>([]);
  const hasFetchedFromBackend = useRef(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !hasFetchedFromBackend.current) {
      fetchLanguageFromBackend();
    }
  }, [isAuthenticated]);

  const fetchLanguageFromBackend = async () => {
    try {
      hasFetchedFromBackend.current = true;
      const current = await TranslationService.fetchCurrentLanguage();
      setTranslations(current);
      setCurrentLanguage(TranslationService.getCurrentLanguage());
      applyRTL(current.localeInfo.direction === 'rtl');
    } catch (error) {
      console.log('Could not fetch current language from backend:', error);
    }
  };

  const loadInitialData = async () => {
    try {
      const cached = await TranslationService.loadCachedTranslations();
      setTranslations(cached);
      setCurrentLanguage(TranslationService.getCurrentLanguage());
      
      const langs = await TranslationService.getAvailableLanguages();
      setAvailableLanguages(langs);
    } catch (error) {
      console.log('Failed to load initial translations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncLanguageFromAccent = async (accent: string) => {
    try {
      setIsLoading(true);
      await TranslationService.syncLanguageFromAccent(accent);
      const newTranslations = TranslationService.getTranslations();
      setTranslations(newTranslations);
      setCurrentLanguage(TranslationService.getCurrentLanguage());
      applyRTL(newTranslations.localeInfo.direction === 'rtl');
    } catch (error) {
      console.log('Failed to sync language from accent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (langCode: string) => {
    try {
      setIsLoading(true);
      const result = await TranslationService.setLanguage(langCode);
      const newTranslations = TranslationService.getTranslations();
      setTranslations(newTranslations);
      setCurrentLanguage(langCode);
      applyRTL(newTranslations.localeInfo.direction === 'rtl');
      
      if (!result.backendSaved && isAuthenticated) {
        showToast('Language updated locally. Will sync when online.', 'info', 3000);
      }
    } catch (error) {
      console.log('Failed to set language:', error);
      showToast('Failed to change language. Please try again.', 'error', 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const applyRTL = (isRTL: boolean) => {
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }
  };

  const refreshTranslations = useCallback(async () => {
    try {
      setIsLoading(true);
      const newTranslations = await TranslationService.fetchTranslations(currentLanguage);
      setTranslations(newTranslations);
      applyRTL(newTranslations.localeInfo.direction === 'rtl');
    } catch (error) {
      console.log('Failed to refresh translations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage]);

  const t = useCallback((key: string): string => {
    const parts = key.split('.');
    let current: any = translations;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return key;
      }
    }
    
    return typeof current === 'string' ? current : key;
  }, [translations]);

  const isRTL = translations.localeInfo.direction === 'rtl';

  const syncFromAccent = useCallback(async (accent: string) => {
    if (accent && accent !== 'American' && accent !== 'British') {
      await syncLanguageFromAccent(accent);
    }
  }, []);

  return (
    <TranslationContext.Provider value={{ 
      translations, 
      isLoading, 
      isRTL, 
      currentLanguage,
      availableLanguages,
      refreshTranslations,
      setLanguage,
      syncFromAccent,
      t,
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
      availableLanguages: [],
      refreshTranslations: async () => {},
      setLanguage: async () => {},
      syncFromAccent: async () => {},
      t: (key: string) => key,
    };
  }
  return context;
}
