import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { I18nManager } from 'react-native';
import { TranslationService, Translations } from '@/services/TranslationService';
import { LOCAL_TRANSLATION_BUNDLES } from '@/services/localeBundles';
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
  /** Bumps on every user language change so in-flight backend fetches cannot overwrite the selection. */
  const languageEpochRef = useRef(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !hasFetchedFromBackend.current) {
      fetchLanguageFromBackend();
    }
  }, [isAuthenticated]);

  const fetchLanguageFromBackend = async () => {
    const epochAtStart = languageEpochRef.current;
    try {
      hasFetchedFromBackend.current = true;
      const current = await TranslationService.fetchCurrentLanguage();
      if (epochAtStart !== languageEpochRef.current) {
        return;
      }
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
    const epoch = ++languageEpochRef.current;
    try {
      // 1) Apply local/network translations into the service
      await TranslationService.fetchTranslations(langCode);
      if (epoch !== languageEpochRef.current) {
        return;
      }

      // 2) Update React state immediately so Settings chrome switches language
      const newTranslations = TranslationService.getTranslations();
      setTranslations(newTranslations);
      setCurrentLanguage(langCode);
      applyRTL(newTranslations.localeInfo.direction === 'rtl');

      // 3) Persist app UI language preference to the backend (does not change stylist speak language)
      void TranslationService.persistLanguagePreference(langCode).then((backendSaved) => {
        if (epoch !== languageEpochRef.current) return;
        if (!backendSaved && isAuthenticated) {
          const msg =
            newTranslations.voiceCredits?.languageUpdatedLocally ||
            'Language updated on this device. Sync to account failed — will retry later.';
          showToast(msg, 'info', 3000);
        }
      });
    } catch (error) {
      console.log('Failed to set language:', error);
      const msg =
        TranslationService.getTranslations().voiceCredits?.languageChangeFailed ||
        'Could not change language. Please try again.';
      showToast(msg, 'error', 3000);
      throw error;
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
    const lookup = (dict: any, dottedKey: string): string => {
      if (!dict || typeof dict !== 'object') return '';
      // Prefer exact flat key when merge left collisions (e.g. blog leaf vs blog.*)
      const flat = dict[dottedKey];
      if (typeof flat === 'string' && flat.trim()) return flat;

      const parts = dottedKey.split('.');
      let current: any = dict;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return '';
        }
      }
      return typeof current === 'string' ? current : '';
    };

    let value = lookup(translations, key);
    if (!value && key.startsWith('blog.')) {
      value = lookup(translations, `fashionBlog.${key.slice('blog.'.length)}`);
    } else if (!value && key.startsWith('fashionBlog.')) {
      value = lookup(translations, `blog.${key.slice('fashionBlog.'.length)}`);
    }
    if (value) return value;

    // Fall back to current English bundle (covers incomplete backend/cache merges)
    const english = TranslationService.getTranslations();
    if (english && english !== translations) {
      value = lookup(english, key);
      if (!value && key.startsWith('blog.')) {
        value = lookup(english, `fashionBlog.${key.slice('blog.'.length)}`);
      } else if (!value && key.startsWith('fashionBlog.')) {
        value = lookup(english, `blog.${key.slice('fashionBlog.'.length)}`);
      }
      if (value) return value;
    }

    // Last resort: offline English flat keys (never show blank copy for known strings)
    const flatEn = LOCAL_TRANSLATION_BUNDLES.en?.[key];
    if (typeof flatEn === 'string' && flatEn.trim()) return flatEn;

    return '';
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
      t: (key: string) => {
        const flat = LOCAL_TRANSLATION_BUNDLES.en?.[key];
        return typeof flat === 'string' && flat.trim() ? flat : '';
      },
    };
  }
  return context;
}
