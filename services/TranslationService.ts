import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const TRANSLATIONS_CACHE_KEY = '@dripn_translations';
const TRANSLATIONS_LANG_KEY = '@dripn_translations_lang';

export interface OnboardingStepTranslations {
  title: string;
  description: string;
}

export interface StyleArchetypeTranslation {
  name: string;
  tagline: string;
}

export interface CommonTranslations {
  continue: string;
  skip: string;
  save: string;
  cancel: string;
  back: string;
  next: string;
  done: string;
  loading: string;
  error: string;
  retry: string;
}

export interface LocaleInfo {
  direction: 'ltr' | 'rtl';
  locale: string;
  language: string;
}

export interface BodyScanTranslations {
  title: string;
  description: string;
  tips: string[];
  overlayText: string;
  countdown: string;
  privacyNote: string;
}

export interface ColorScanTranslations {
  title: string;
  description: string;
  tips: string[];
  overlayText: string;
  countdown: string;
  privacyNote: string;
}

export interface QuizTranslations {
  title: string;
  description: string;
  questionPrefix: string;
  resultsTitle: string;
  resultsDescription: string;
}

export interface OnboardingTranslations {
  steps: {
    location: OnboardingStepTranslations;
    basics: OnboardingStepTranslations;
    body: OnboardingStepTranslations;
    coloring: OnboardingStepTranslations;
    lifestyle: OnboardingStepTranslations;
    style: OnboardingStepTranslations;
    colors: OnboardingStepTranslations;
    shopping: OnboardingStepTranslations;
    voice: OnboardingStepTranslations;
  };
}

export interface Translations {
  locale: string;
  localeInfo: LocaleInfo;
  common: CommonTranslations;
  bodyScan: BodyScanTranslations;
  colorScan: ColorScanTranslations;
  quiz: QuizTranslations;
  onboarding: OnboardingTranslations;
  styleArchetypes: Record<string, StyleArchetypeTranslation>;
}

const DEFAULT_TRANSLATIONS: Translations = {
  locale: 'en',
  localeInfo: {
    direction: 'ltr',
    locale: 'en',
    language: 'English',
  },
  common: {
    continue: 'Continue',
    skip: 'Skip',
    save: 'Save',
    cancel: 'Cancel',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
  },
  bodyScan: {
    title: 'Body Scan',
    description: 'Stand in front of the camera for a full body analysis',
    tips: ['Stand 6 feet away', 'Wear fitted clothing', 'Good lighting helps'],
    overlayText: 'Position yourself in the frame',
    countdown: 'Taking photo in',
    privacyNote: 'Your photo is processed securely and not stored',
  },
  colorScan: {
    title: 'Color Analysis',
    description: 'Take a selfie for personalized color recommendations',
    tips: ['Natural lighting is best', 'Remove glasses if possible', 'Face the camera directly'],
    overlayText: 'Center your face in the frame',
    countdown: 'Taking photo in',
    privacyNote: 'Your photo is processed securely and not stored',
  },
  quiz: {
    title: 'Style Quiz',
    description: 'Answer a few questions to discover your style personality',
    questionPrefix: 'Question',
    resultsTitle: 'Your Style Profile',
    resultsDescription: 'Based on your answers, here is your fashion personality',
  },
  onboarding: {
    steps: {
      location: { title: 'Select your country', description: 'Where are you located?' },
      basics: { title: 'The Basics', description: 'Tell us about yourself' },
      body: { title: 'Body', description: 'Help us understand your body type' },
      coloring: { title: 'Coloring', description: 'Your skin tone and features' },
      lifestyle: { title: 'Lifestyle', description: 'How do you spend your time?' },
      style: { title: 'Style', description: 'What styles appeal to you?' },
      colors: { title: 'Colors', description: 'Your color preferences' },
      shopping: { title: 'Shopping', description: 'Where do you like to shop?' },
      voice: { title: 'Voice', description: 'Set up your AI stylist voice' },
    },
  },
  styleArchetypes: {
    minimalist: { name: 'Minimalist', tagline: 'Less is more, always.' },
    classic: { name: 'Classic', tagline: 'Timeless elegance never fades.' },
    bohemian: { name: 'Bohemian', tagline: 'Free spirit, artistic soul.' },
    edgy: { name: 'Edgy', tagline: 'Bold choices, strong presence.' },
    romantic: { name: 'Romantic', tagline: 'Soft, feminine, dreamy.' },
    streetwear: { name: 'Streetwear', tagline: 'Urban culture, self-expression.' },
    glamorous: { name: 'Glamorous', tagline: 'Shine bright, stand out.' },
    preppy: { name: 'Preppy', tagline: 'Polished and put-together.' },
    athleisure: { name: 'Athleisure', tagline: 'Comfort meets style.' },
    eclectic: { name: 'Eclectic', tagline: 'Unique blend, all you.' },
  },
};

class TranslationServiceClass {
  private translations: Translations = DEFAULT_TRANSLATIONS;
  private currentLang: string = 'en';

  async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('@dripn_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async fetchTranslations(langCode: string): Promise<Translations> {
    if (langCode === 'en') {
      this.translations = DEFAULT_TRANSLATIONS;
      this.currentLang = 'en';
      await this.cacheTranslations(DEFAULT_TRANSLATIONS, 'en');
      return DEFAULT_TRANSLATIONS;
    }

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_URL}/api/i18n/translations/${langCode}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.log(`Failed to fetch translations for ${langCode}, using defaults`);
        return DEFAULT_TRANSLATIONS;
      }

      const data = await response.json();
      const merged: Translations = {
        ...DEFAULT_TRANSLATIONS,
        ...data,
        locale: langCode,
        localeInfo: data.localeInfo || { ...DEFAULT_TRANSLATIONS.localeInfo, locale: langCode },
        common: { ...DEFAULT_TRANSLATIONS.common, ...data.common },
        bodyScan: { ...DEFAULT_TRANSLATIONS.bodyScan, ...data.bodyScan },
        colorScan: { ...DEFAULT_TRANSLATIONS.colorScan, ...data.colorScan },
        quiz: { ...DEFAULT_TRANSLATIONS.quiz, ...data.quiz },
        onboarding: {
          steps: { ...DEFAULT_TRANSLATIONS.onboarding.steps, ...data.onboarding?.steps },
        },
        styleArchetypes: { ...DEFAULT_TRANSLATIONS.styleArchetypes, ...data.styleArchetypes },
      };

      this.translations = merged;
      this.currentLang = langCode;
      await this.cacheTranslations(merged, langCode);
      return merged;
    } catch (error) {
      console.log('Translation fetch error:', error);
      return DEFAULT_TRANSLATIONS;
    }
  }

  async loadCachedTranslations(): Promise<Translations> {
    try {
      const cachedLang = await AsyncStorage.getItem(TRANSLATIONS_LANG_KEY);
      const cached = await AsyncStorage.getItem(TRANSLATIONS_CACHE_KEY);
      
      if (cached && cachedLang) {
        this.translations = JSON.parse(cached);
        this.currentLang = cachedLang;
        return this.translations;
      }
    } catch (error) {
      console.log('Failed to load cached translations:', error);
    }
    return DEFAULT_TRANSLATIONS;
  }

  private async cacheTranslations(translations: Translations, langCode: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TRANSLATIONS_CACHE_KEY, JSON.stringify(translations));
      await AsyncStorage.setItem(TRANSLATIONS_LANG_KEY, langCode);
    } catch (error) {
      console.log('Failed to cache translations:', error);
    }
  }

  getTranslations(): Translations {
    return this.translations;
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }

  isRTL(): boolean {
    return this.translations.localeInfo.direction === 'rtl';
  }
}

export const TranslationService = new TranslationServiceClass();
