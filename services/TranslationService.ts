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
  myWardrobe: string;
  moreItemsNeeded: string;
  addItemsMessage: string;
  deleteItem: string;
  deleteConfirm: string;
  markedAsWorn: string;
  never: string;
  bulkUpload: string;
  lastWorn: string;
  wornTimes: string;
  itemDetails: string;
  timesWorn: string;
  loadingWardrobe: string;
  myLookbook: string;
  calendar14Day: string;
  calendar30Day: string;
  modularWardrobe: string;
  aiOutfitCreator: string;
  unlockDFY: string;
  categoryAll: string;
  categoryTops: string;
  categoryBottoms: string;
  categoryDresses: string;
  categoryOuterwear: string;
  categoryShoes: string;
  categoryBags: string;
  categoryAccessories: string;
  categoryActivewear: string;
  categoryFormal: string;
}

export interface ProfileTranslations {
  guestUser: string;
  upgradeToPersonal: string;
  manageSubscription: string;
  styleDna: string;
  styleDnaDesc: string;
  colorAnalysis: string;
  colorAnalysisDesc: string;
  bodyProfile: string;
  bodyProfileDesc: string;
  likedOutfits: string;
  noLikedOutfits: string;
  styleOfTheDay: string;
  viewDetails: string;
  profile: string;
  adminDashboard: string;
  yourStyleProfile: string;
  styleProfileSubtitle: string;
  notCompleted: string;
  completeStyleProfile: string;
  savedOutfits: string;
  similarOutfit: string;
  loadingOutfits: string;
  noLikedOutfitsHint: string;
}

export interface HomeTranslations {
  yourStory: string;
  global: string;
  myRegion: string;
  noPostsYet: string;
  beFirstToShare: string;
}

export interface AuthTranslations {
  createAccount: string;
  welcomeBack: string;
  joinCommunity: string;
  signInContinue: string;
  continueWithGoogle: string;
  continueWithFacebook: string;
  continueWithApple: string;
  or: string;
  fullName: string;
  email: string;
  password: string;
  enterName: string;
  emailPlaceholder: string;
  enterPassword: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  signIn: string;
  signUp: string;
  agreeTerms: string;
  termsOfService: string;
  and: string;
  privacyPolicy: string;
  fillRequired: string;
  enterYourName: string;
  authFailed: string;
}

export interface AIStylistTranslations {
  suggestedOutfit: string;
  thanks: string;
  noted: string;
  whatWasntRight: string;
  learnPreferences: string;
  skip: string;
  quickSuggestions: string;
  notMyStyle: string;
  tooWestern: string;
  didntFitBodyType: string;
  culturalMismatch: string;
}

export interface StylistHubTranslations {
  personalStylist: string;
  personalStylistDesc: string;
  voiceChat: string;
  voiceChatDesc: string;
  outfitCalendar: string;
  outfitCalendarDesc: string;
  weatherOutfits: string;
  weatherOutfitsDesc: string;
  blog: string;
  blogDesc: string;
  styleRules: string;
  styleRulesDesc: string;
  holdToRearrange: string;
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
  title: string;
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
  helpSubtitle: string;
  chatWithJulia: string;
  chatWithJuliaSubtitle: string;
  aiFeatureLab: string;
  aiFeatureLabSubtitle: string;
  sendFeedback: string;
  sendFeedbackSubtitle: string;
  termsOfService: string;
  privacyPolicy: string;
  subscription: string;
  logout: string;
  slow: string;
  normal: string;
  fast: string;
  contactUs: string;
  account: string;
  editProfile: string;
  email: string;
  preferences: string;
  styleTheme: string;
  colourScheme: string;
  selectColourScheme: string;
  colorful: string;
  colorfulDesc: string;
  minimalist: string;
  minimalistDesc: string;
  country: string;
  notSet: string;
  bodyMeasurements: string;
  trendingColors: string;
  pantoneNotAvailable: string;
  usingBaseColors: string;
  checkForTrends: string;
  inviteFriends: string;
  shareYourCode: string;
  inviteDescription: string;
  communityVoting: string;
  communityVotingDesc: string;
  priceAlerts: string;
  priceAlertsDesc: string;
  company: string;
  partnerWithUs: string;
  partnerWithUsSubtitle: string;
  accountActions: string;
  signOut: string;
  deleteAccount: string;
  notifications: string;
  privacy: string;
  about: string;
  currentPlan: string;
  managePlan: string;
  selectLanguage: string;
  voiceSettings: string;
}

export interface OnboardingTranslations {
  steps: Record<string, OnboardingStepTranslations>;
  [key: string]: any;
}

export interface Translations {
  locale: string;
  localeInfo: LocaleInfo;
  common: CommonTranslations;
  nav: NavTranslations;
  stylist: StylistTranslations;
  wardrobe: WardrobeTranslations;
  profile: ProfileTranslations;
  stylistHub: StylistHubTranslations;
  bodyScan: BodyScanTranslations;
  colorScan: ColorScanTranslations;
  quiz: QuizTranslations;
  onboarding: OnboardingTranslations;
  styleArchetypes: Record<string, StyleArchetypeTranslation>;
  styleSelection: StyleSelectionTranslations;
  settings: SettingsTranslations;
  home: HomeTranslations;
  auth: AuthTranslations;
  aiStylist: AIStylistTranslations;
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
    myWardrobe: 'My Wardrobe',
    moreItemsNeeded: 'More Items Needed',
    addItemsMessage: 'Add at least 3 items to your wardrobe for AI to create outfit combinations.',
    deleteItem: 'Delete Item',
    deleteConfirm: 'Are you sure you want to delete this item?',
    markedAsWorn: 'Marked as worn today',
    never: 'Never',
    bulkUpload: 'Bulk Upload',
    lastWorn: 'Last worn',
    wornTimes: 'times',
    itemDetails: 'Item Details',
    timesWorn: 'Times Worn',
    loadingWardrobe: 'Loading your wardrobe...',
    myLookbook: 'My Lookbook',
    calendar14Day: '14-Day Calendar',
    calendar30Day: '30-Day Calendar',
    modularWardrobe: 'Modular Wardrobe',
    aiOutfitCreator: 'AI Outfit Creator',
    unlockDFY: 'Unlock Done-For-You Setup',
    categoryAll: 'All',
    categoryTops: 'Tops',
    categoryBottoms: 'Bottoms',
    categoryDresses: 'Dresses',
    categoryOuterwear: 'Outerwear',
    categoryShoes: 'Shoes',
    categoryBags: 'Bags',
    categoryAccessories: 'Accessories',
    categoryActivewear: 'Active',
    categoryFormal: 'Formal',
  },
  profile: {
    guestUser: 'Guest User',
    upgradeToPersonal: 'Upgrade to Personal Stylist',
    manageSubscription: 'Manage Subscription',
    styleDna: 'Style DNA',
    styleDnaDesc: 'Your unique style profile',
    colorAnalysis: 'Color Analysis',
    colorAnalysisDesc: 'Your best colors',
    bodyProfile: 'Body Profile',
    bodyProfileDesc: 'Your measurements & fit',
    likedOutfits: 'Liked Outfits',
    noLikedOutfits: 'No liked outfits yet',
    styleOfTheDay: 'Style of the Day',
    viewDetails: 'View Details',
    profile: 'Profile',
    adminDashboard: 'Admin Dashboard',
    yourStyleProfile: 'Your Style Profile',
    styleProfileSubtitle: 'These help us give you better outfit suggestions and send relevant looks to your stylist community for second opinions.',
    notCompleted: 'Not completed',
    completeStyleProfile: 'Complete your style profile for personalized outfit suggestions and better second opinions from the community.',
    savedOutfits: 'Saved Outfits',
    similarOutfit: 'Similar Outfit',
    loadingOutfits: 'Loading liked outfits...',
    noLikedOutfitsHint: 'Save outfits from your stylist recommendations',
  },
  stylistHub: {
    personalStylist: 'Personal Stylist',
    personalStylistDesc: 'Chat with your AI stylist',
    voiceChat: 'Voice Chat',
    voiceChatDesc: 'Talk to Ruby or Max',
    outfitCalendar: 'Outfit Calendar',
    outfitCalendarDesc: 'Plan your looks ahead',
    weatherOutfits: 'Weather Outfits',
    weatherOutfitsDesc: 'Dress for the forecast',
    blog: 'Blog',
    blogDesc: 'Fashion tips & guides',
    styleRules: 'Style Rules',
    styleRulesDesc: 'Your personal guidelines',
    holdToRearrange: 'Hold to rearrange',
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
      casual: { name: 'Casual', description: 'Relaxed, everyday comfort' },
      boho: { name: 'Creative', description: 'Artistic, expressive style' },
      sporty: { name: 'Active', description: 'Sporty, athleisure focused' },
      business: { name: 'Professional', description: 'Office-ready, polished looks' },
      edgy: { name: 'Trendsetter', description: 'Latest fashion, bold choices' },
    },
  },
  settings: {
    title: 'Settings',
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
    helpSubtitle: 'Browse questions and chat with Julia',
    chatWithJulia: 'Chat with Julia',
    chatWithJuliaSubtitle: 'Get instant support from our assistant',
    aiFeatureLab: 'AI Feature Lab',
    aiFeatureLabSubtitle: 'View AI-generated feature suggestions',
    sendFeedback: 'Send Feedback',
    sendFeedbackSubtitle: 'Report bugs, request features, or share thoughts',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    subscription: 'Subscription',
    logout: 'Log Out',
    slow: 'Slow',
    normal: 'Normal',
    fast: 'Fast',
    contactUs: 'Contact Us',
    account: 'Account',
    editProfile: 'Edit Profile',
    email: 'Email',
    preferences: 'Preferences',
    styleTheme: 'Style Theme',
    colourScheme: 'Colour Scheme',
    selectColourScheme: 'Colour Scheme',
    colorful: 'Colorful',
    colorfulDesc: 'Vibrant gradients and bold colors',
    minimalist: 'Minimalist',
    minimalistDesc: 'Subtle, understated tones',
    country: 'Country',
    notSet: 'Not set',
    bodyMeasurements: 'Body Measurements',
    trendingColors: 'Trending Colors',
    pantoneNotAvailable: 'Pantone Color of the Year not available',
    usingBaseColors: 'Using base theme colors',
    checkForTrends: 'Check for trends',
    inviteFriends: 'Invite Friends',
    shareYourCode: 'Share Your Code',
    inviteDescription: 'Invite friends and you both get 20 AI requests & 10% discount',
    communityVoting: 'Community Voting',
    communityVotingDesc: 'Notify when other users need your fashion advice',
    priceAlerts: 'Price Alerts',
    priceAlertsDesc: 'Notify when tracked items drop in price',
    company: 'Company',
    partnerWithUs: 'Partner With Us',
    partnerWithUsSubtitle: 'Stylists and brands enquiries',
    accountActions: 'Account Actions',
    signOut: 'Sign Out',
    deleteAccount: 'Delete Account',
    notifications: 'Notifications',
    privacy: 'Privacy',
    about: 'About',
    currentPlan: 'Current Plan',
    managePlan: 'Manage Plan',
    selectLanguage: 'Select Language',
    voiceSettings: 'Voice Settings',
  },
  home: {
    yourStory: 'Your Story',
    global: 'Global',
    myRegion: 'My Region',
    noPostsYet: 'No posts yet',
    beFirstToShare: 'Be the first to share your style with the community',
  },
  auth: {
    createAccount: 'Create Account',
    welcomeBack: 'Welcome Back',
    joinCommunity: 'Join the Dripn community',
    signInContinue: 'Sign in to continue your style journey',
    continueWithGoogle: 'Continue with Google',
    continueWithFacebook: 'Continue with Facebook',
    continueWithApple: 'Continue with Apple',
    or: 'or',
    fullName: 'Full Name',
    email: 'Email',
    password: 'Password',
    enterName: 'Enter your name',
    emailPlaceholder: 'your.email@example.com',
    enterPassword: 'Enter your password',
    alreadyHaveAccount: 'Already have an account? ',
    dontHaveAccount: "Don't have an account? ",
    signIn: 'Sign In',
    signUp: 'Sign Up',
    agreeTerms: 'By continuing, you agree to our',
    termsOfService: 'Terms of Service',
    and: 'and',
    privacyPolicy: 'Privacy Policy',
    fillRequired: 'Please fill in all required fields',
    enterYourName: 'Please enter your name',
    authFailed: 'Authentication failed. Please try again.',
  },
  aiStylist: {
    suggestedOutfit: 'Suggested Outfit',
    thanks: 'Thanks!',
    noted: 'Noted',
    whatWasntRight: "What wasn't quite right?",
    learnPreferences: 'This helps your stylist learn your preferences',
    skip: 'Skip',
    quickSuggestions: 'Quick suggestions',
    notMyStyle: 'Not my style',
    tooWestern: 'Too Western',
    didntFitBodyType: "Didn't fit my body type",
    culturalMismatch: 'Cultural mismatch',
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
      profile: { ...DEFAULT_TRANSLATIONS.profile, ...nested.profile },
      stylistHub: { ...DEFAULT_TRANSLATIONS.stylistHub, ...nested.stylistHub },
      bodyScan: { ...DEFAULT_TRANSLATIONS.bodyScan, ...nested.bodyScan },
      colorScan: { ...DEFAULT_TRANSLATIONS.colorScan, ...nested.colorScan },
      quiz: { ...DEFAULT_TRANSLATIONS.quiz, ...nested.quiz },
      onboarding: {
        ...nested.onboarding,
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
      home: { ...DEFAULT_TRANSLATIONS.home, ...nested.home },
      auth: { ...DEFAULT_TRANSLATIONS.auth, ...nested.auth },
      aiStylist: { ...DEFAULT_TRANSLATIONS.aiStylist, ...nested.aiStylist },
    };
  }

  async setLanguage(langCode: string): Promise<{ success: boolean; backendSaved: boolean }> {
    // Always fetch and apply translations locally first
    await this.fetchTranslations(langCode);
    
    // Try to persist to backend (non-blocking)
    let backendSaved = false;
    try {
      await apiService.setLanguage({ languageCode: langCode });
      backendSaved = true;
    } catch (error) {
      console.log('Failed to persist language to backend (will use local):', error);
    }
    
    return { success: true, backendSaved };
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
