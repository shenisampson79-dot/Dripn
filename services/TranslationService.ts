import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';

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

export interface NavTranslations {
  home: string;
  wardrobe: string;
  chat: string;
  profile: string;
  settings: string;
}

export interface StylistTranslations {
  greeting: string;
  thinking: string;
  askMe: string;
  voiceChat: string;
  personalStylist: string;
}

export interface WardrobeTranslations {
  addItem: string;
  empty: string;
  categories: string;
  favorites: string;
  allItems: string;
  outfitCalendar: string;
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

export interface StyleOptionTranslation {
  name: string;
  description: string;
}

export interface StyleSelectionTranslations {
  title: string;
  subtitle: string;
  styles: Record<string, StyleOptionTranslation>;
}

export interface SettingsTranslations {
  voiceAndLanguage: string;
  language: string;
  voiceSpeed: string;
  autoPlayResponses: string;
  autoPlayDescription: string;
  showTranscriptions: string;
  showTranscriptionsDescription: string;
  support: string;
  helpCenter: string;
  helpAndFaq: string;
  chatWithJulia: string;
  aiFeatureLab: string;
  termsOfService: string;
  privacyPolicy: string;
  subscription: string;
  logout: string;
  slow: string;
  normal: string;
  fast: string;
  contactUs: string;
  account: string;
  notifications: string;
  privacy: string;
  about: string;
  currentPlan: string;
  managePlan: string;
  selectLanguage: string;
  voiceSettings: string;
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
  nav: NavTranslations;
  stylist: StylistTranslations;
  wardrobe: WardrobeTranslations;
  bodyScan: BodyScanTranslations;
  colorScan: ColorScanTranslations;
  quiz: QuizTranslations;
  onboarding: OnboardingTranslations;
  styleArchetypes: Record<string, StyleArchetypeTranslation>;
  styleSelection: StyleSelectionTranslations;
  settings: SettingsTranslations;
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
  nav: {
    home: 'Home',
    wardrobe: 'Wardrobe',
    chat: 'Chat',
    profile: 'Profile',
    settings: 'Settings',
  },
  stylist: {
    greeting: 'Hello! How can I help you today?',
    thinking: 'Thinking...',
    askMe: 'Ask me anything about fashion...',
    voiceChat: 'Voice Chat',
    personalStylist: 'Personal Stylist',
  },
  wardrobe: {
    addItem: 'Add Item',
    empty: 'Your wardrobe is empty',
    categories: 'Categories',
    favorites: 'Favorites',
    allItems: 'All Items',
    outfitCalendar: 'Outfit Calendar',
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
  styleSelection: {
    title: "What's your style?",
    subtitle: "Pick the aesthetic that speaks to you",
    styles: {
      smartCasual: { name: 'Smart Casual', description: 'Polished yet relaxed, tailored pieces for office to after-work drinks' },
      casual: { name: 'Casual', description: 'Relaxed, comfortable, everyday style' },
      boho: { name: 'Boho', description: 'Earthy, relaxed, artistic' },
      sporty: { name: 'Sporty', description: 'Active, dynamic, athletic' },
      business: { name: 'Business', description: 'Professional suits, shirts, and formal wear' },
      edgy: { name: 'Edgy', description: 'Bold, alternative, dramatic' },
    },
  },
  settings: {
    voiceAndLanguage: 'Voice & Language',
    language: 'Language',
    voiceSpeed: 'Voice Speed',
    autoPlayResponses: 'Auto-Play Responses',
    autoPlayDescription: 'Automatically play voice when stylist responds',
    showTranscriptions: 'Show Transcriptions',
    showTranscriptionsDescription: 'Display text version of voice messages',
    support: 'Support',
    helpCenter: 'Help Center',
    helpAndFaq: 'Help & FAQ',
    chatWithJulia: 'Chat with Julia',
    aiFeatureLab: 'AI Feature Lab',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    subscription: 'Subscription',
    logout: 'Log Out',
    slow: 'Slow',
    normal: 'Normal',
    fast: 'Fast',
    contactUs: 'Contact Us',
    account: 'Account',
    notifications: 'Notifications',
    privacy: 'Privacy',
    about: 'About',
    currentPlan: 'Current Plan',
    managePlan: 'Manage Plan',
    selectLanguage: 'Select Language',
    voiceSettings: 'Voice Settings',
  },
};

class TranslationServiceClass {
  private translations: Translations = DEFAULT_TRANSLATIONS;
  private currentLang: string = 'en';
  private availableLanguages: Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }> = [];

  async fetchCurrentLanguage(): Promise<Translations> {
    try {
      const response = await apiService.getCurrentLanguage();
      
      const merged = this.mergeTranslations(response.translations, response.languageCode);
      merged.localeInfo.direction = response.direction;
      
      this.translations = merged;
      this.currentLang = response.languageCode;
      await this.cacheTranslations(merged, response.languageCode);
      
      return merged;
    } catch (error) {
      console.log('Failed to fetch current language:', error);
      return this.translations;
    }
  }

  async fetchTranslations(langCode: string): Promise<Translations> {
    if (langCode === 'en') {
      this.translations = DEFAULT_TRANSLATIONS;
      this.currentLang = 'en';
      await this.cacheTranslations(DEFAULT_TRANSLATIONS, 'en');
      return DEFAULT_TRANSLATIONS;
    }

    try {
      const response = await apiService.getTranslations(langCode);
      
      const merged = this.mergeTranslations(response.translations, langCode);
      merged.localeInfo.direction = response.direction;
      merged.localeInfo.language = response.nativeName;
      
      this.translations = merged;
      this.currentLang = langCode;
      await this.cacheTranslations(merged, langCode);
      
      return merged;
    } catch (error) {
      console.log('Translation fetch error:', error);
      return DEFAULT_TRANSLATIONS;
    }
  }

  private mergeTranslations(backendTranslations: Record<string, any>, langCode: string): Translations {
    const flatToNested = (flat: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const key in flat) {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = current[parts[i]] || {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = flat[key];
      }
      return result;
    };

    const nested = flatToNested(backendTranslations);

    return {
      locale: langCode,
      localeInfo: {
        direction: 'ltr',
        locale: langCode,
        language: nested.localeInfo?.language || langCode,
      },
      common: { ...DEFAULT_TRANSLATIONS.common, ...nested.common },
      nav: { ...DEFAULT_TRANSLATIONS.nav, ...nested.nav },
      stylist: { ...DEFAULT_TRANSLATIONS.stylist, ...nested.stylist },
      wardrobe: { ...DEFAULT_TRANSLATIONS.wardrobe, ...nested.wardrobe },
      bodyScan: { ...DEFAULT_TRANSLATIONS.bodyScan, ...nested.bodyScan },
      colorScan: { ...DEFAULT_TRANSLATIONS.colorScan, ...nested.colorScan },
      quiz: { ...DEFAULT_TRANSLATIONS.quiz, ...nested.quiz },
      onboarding: {
        steps: { ...DEFAULT_TRANSLATIONS.onboarding.steps, ...nested.onboarding?.steps },
      },
      styleArchetypes: { ...DEFAULT_TRANSLATIONS.styleArchetypes, ...nested.styleArchetypes },
      styleSelection: {
        ...DEFAULT_TRANSLATIONS.styleSelection,
        ...nested.styleSelection,
        styles: {
          ...DEFAULT_TRANSLATIONS.styleSelection.styles,
          ...nested.styleSelection?.styles,
        },
      },
      settings: { ...DEFAULT_TRANSLATIONS.settings, ...nested.settings },
    };
  }

  async setLanguage(langCode: string): Promise<void> {
    try {
      await apiService.setLanguage({ languageCode: langCode });
      await this.fetchTranslations(langCode);
    } catch (error) {
      console.log('Failed to set language:', error);
    }
  }

  async syncLanguageFromAccent(accent: string): Promise<void> {
    try {
      await apiService.setLanguage({ accent });
      await this.fetchCurrentLanguage();
    } catch (error) {
      console.log('Failed to sync language from accent:', error);
    }
  }

  async getAvailableLanguages(): Promise<Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }>> {
    if (this.availableLanguages.length > 0) {
      return this.availableLanguages;
    }

    try {
      const response = await apiService.getLanguages();
      this.availableLanguages = response.languages;
      return this.availableLanguages;
    } catch (error) {
      console.log('Failed to fetch available languages:', error);
      return [];
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

  t(key: string): string {
    const parts = key.split('.');
    let current: any = this.translations;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return key;
      }
    }
    
    return typeof current === 'string' ? current : key;
  }
}

export const TranslationService = new TranslationServiceClass();
