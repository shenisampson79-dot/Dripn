import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import {
  LOCAL_TRANSLATION_BUNDLES,
  LOCAL_LANGUAGE_META,
  UI_FULL_COVERAGE_LANGUAGES,
  resolveLocaleDirection,
  resolveLocaleNativeName,
} from './localeBundles';

const TRANSLATIONS_CACHE_KEY = '@dripn_translations_v12';
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
  stylist?: string;
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
  categoryActivewearTops?: string;
  categoryActivewearBottoms?: string;
  categoryFormal: string;
  wardrobeAwaits?: string;
  wardrobeAwaitsDesc?: string;
  quickAddMultiple?: string;
  addSingleItem?: string;
  piece?: string;
  pieces?: string;
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
  askStylistTitle?: string;
  whatDecisionHelp?: string;
  fashionRules?: string;
  todayTip?: string;
  oneDecisionDay?: string;
  decisionShopping?: string;
  decisionShoppingDesc?: string;
  decisionWhatToWear?: string;
  decisionWhatToWearDesc?: string;
  decisionEventOutfit?: string;
  decisionEventOutfitDesc?: string;
  decisionSanityCheck?: string;
  decisionSanityCheckDesc?: string;
}

export interface StylistHubTranslations {
  screenTitle?: string;
  styleToolsTitle?: string;
  styleToolsSubtitle?: string;
  customizeLayout?: string;
  personalStylist: string;
  personalStylistDesc: string;
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
  aiScannedConfidence: string;
  captureFailed: string;
  error: string;
  failedToAnalyzeImagePleaseTryAgain: string;
  failedToSelectImagePleaseTryAgain: string;
  lowConfidenceAlertMessage: string;
  lowConfidenceAlertTitle: string;
  lowConfidenceBadge: string;
  lowConfidenceMessage: string;
  lowConfidenceTitle: string;
  manuallyEntered: string;
  measurementsEstimates: string;
  measurementsLowConfidenceNote: string;
  mediumConfidenceTip: string;
  rescanBody: string;
  rescanRetake: string;
  retakeGuidanceTitle: string;
  retakePhoto: string;
  saved: string;
  scanComplete: string;
  scanCompleteMessage: string;
  scanIssue: string;
  scanIssueDefault: string;
  styleRecommendations: string;
  tipClothes: string;
  tipFullBody: string;
  tipLighting: string;
  tipPose: string;
  tipStandBack: string;
  yourBodyProfileHasBeenSavedSuccessfully: string;
  yourMeasurements: string;
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
  deleteAccountAppleBillingWarning?: string;
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
    stylist: 'Stylist',
  },
  navTitles: {
    todaysDecision: "Today's Decision",
    fashionBlog: 'Fashion Blog',
    styleShuffle: 'Style Shuffle',
    stylistChat: 'Stylist Chat',
    visualSearch: 'Visual Search',
    smartNotifications: 'Smart Notifications',
    eventsNearYou: 'Events Near You',
    streetStyleScanner: 'Street Style Scanner',
    virtualTryOn: 'Virtual Try-On',
    styleSoulmates: 'Style Soulmates',
    offers: 'Offers',
    sustainability: 'Sustainability',
    fashionTherapy: 'Fashion Therapy',
    presenceAnalysis: 'Presence Analysis',
    wardrobeTwin: 'Wardrobe Twin',
    styleDiplomat: 'Style Diplomat',
    styleStories: 'Style Stories',
    fashionIntelligence: 'Fashion Intelligence',
    myWardrobe: 'My Wardrobe',
    addItem: 'Add Item',
    quickAddItems: 'Quick Add Items',
    outfitCalendar: 'Outfit Calendar',
    outfitBuilder: 'Outfit Builder',
    costPerWear: 'Cost-per-Wear',
    styleDna: 'Style DNA',
    colorAnalysis: 'Color Analysis',
    colourAnalysis: 'Colour Analysis',
    bodyScanner: 'Body Scanner',
    weatherOutfits: 'Weather Outfits',
    myLookbook: 'My Lookbook',
    modularWardrobe: 'Modular Wardrobe',
    dfyCalendar: 'DFY Calendar',
    community: 'Community',
    communityVote: 'Community Vote',
    profile: 'Profile',
    friendsActivity: 'Friends Activity',
    friendRequests: 'Friend Requests',
    discoverPeople: 'Discover People',
    messages: 'Messages',
    chat: 'Chat',
    stylingGuide: 'Styling Guide',
    wardrobeFilter: 'Wardrobe Filter',
    post: 'Post',
    subscription: 'Subscription',
    chooseYourSetup: 'Choose Your Setup',
    stylistSetup: 'Stylist Setup',
    uploadWardrobe: 'Upload Wardrobe',
    yourStylePlan: 'Your Style Plan',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    bargains: 'Bargains',
    events: 'Events',
    stylist: 'Stylist',
    dreamOutfitGenerator: 'Dream Outfit Generator',
    blog: 'Blog',
    styleRules: 'Style Rules',
    colourInsights: 'Colour Insights',
    vipMembers: 'VIP Members',
    accessStatus: 'Access Status',
    doneForYouStyle: 'Done-For-You Style',
    analytics: 'Analytics',
    socialStyleSync: 'Social Style Sync',
  },
  stylist: {
    greeting: 'Hello! How can I help you today?',
    thinking: 'Thinking...',
    askMe: 'Ask me anything about fashion...',
    voiceChat: 'Voice Chat',
    personalStylist: 'Stylist Chat',
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
    wornTimes: 'Worn {n}x',
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
    categoryActivewearTops: 'Active Top',
    categoryActivewearBottoms: 'Active Bottom',
    categoryFormal: 'Formal',
    wardrobeAwaits: 'Your wardrobe awaits',
    wardrobeAwaitsDesc: 'Start building your digital closet by adding photos of your favourite pieces',
    quickAddMultiple: 'Quick Add Multiple Items',
    addSingleItem: 'Add Single Item',
    piece: 'piece',
    pieces: 'pieces',
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
    noLikedOutfits: 'No saved outfits yet',
    styleOfTheDay: 'Style of the Day',
    viewDetails: 'View Details',
    profile: 'Profile',
    adminDashboard: 'Admin Dashboard',
    yourStyleProfile: 'Your Style Profile',
    styleProfileSubtitle: 'These help us give you better outfit suggestions tailored to your style.',
    notCompleted: 'Not completed',
    completeStyleProfile: 'Complete your style profile for personalized outfit suggestions from your stylist.',
    savedOutfits: 'Saved Outfits',
    similarOutfit: 'Similar Outfit',
    loadingOutfits: 'Loading saved outfits...',
    noLikedOutfitsHint: 'Bookmark or love looks in My Lookbook to collect them here',
  },
  stylistHub: {
    screenTitle: 'Stylist',
    styleToolsTitle: 'Style Tools',
    styleToolsSubtitle: 'Your personal fashion assistant',
    personalStylist: 'Stylist Chat',
    personalStylistDesc: 'Chat, photos & wardrobe advice',
    outfitCalendar: 'Outfit Calendar',
    outfitCalendarDesc: 'Plan your looks ahead',
    weatherOutfits: 'Weather Outfits',
    weatherOutfitsDesc: 'Dress for the forecast',
    blog: 'Blog',
    blogDesc: 'Fashion tips & guides',
    styleRules: 'Style Rules',
    styleRulesDesc: 'Your personal guidelines',
    holdToRearrange: 'Hold to rearrange',
    customizeLayout: 'Long press any tile to customise your layout',
  },
  bodyScan: {
    title: 'Body Scan',
    description: 'Stand in front of the camera for a full body analysis',
    tips: [
      'Show your full body from head to toe',
      'Stand farther back until your whole body fits the outline',
      'Use good lighting and a plain background if possible',
      'Stand straight with arms slightly away from your body',
      'Avoid baggy or obscuring clothes for a clearer proportion read',
    ],
    overlayText: 'Position yourself in the frame',
    countdown: 'Taking photo in',
    privacyNote: 'Your photo is processed securely and not stored',
    aiScannedConfidence: 'AI Scanned — {confidence}% Confidence',
    captureFailed: 'Capture Failed',
    error: 'Error',
    failedToAnalyzeImagePleaseTryAgain: 'Failed to analyze image. Please try again.',
    failedToSelectImagePleaseTryAgain: 'Failed to select image. Please try again.',
    lowConfidenceAlertMessage:
      'Scan confidence was only {confidence}%. Retake with a clearer full-body photo for better results.',
    lowConfidenceAlertTitle: 'Low confidence scan',
    lowConfidenceBadge: 'Low confidence — {confidence}%',
    lowConfidenceMessage:
      'We could not read your proportions clearly. These results are rough estimates — retake your photo for a more accurate scan.',
    lowConfidenceTitle: 'Low confidence — retake recommended',
    manuallyEntered: 'Manually Entered',
    measurementsEstimates: 'Estimated Measurements',
    measurementsLowConfidenceNote:
      'Treat these as estimates until you retake with higher confidence.',
    mediumConfidenceTip:
      'Tip: a clearer full-body photo in good light can improve scan confidence.',
    rescanBody: 'Rescan Body',
    rescanRetake: 'Rescan',
    retakeGuidanceTitle: 'For a better scan:',
    retakePhoto: 'Retake Photo',
    saved: 'Saved',
    scanComplete: 'Scan Complete',
    scanCompleteMessage:
      'Body analysis complete with {confidence}% confidence. Your body profile has been saved.',
    scanIssue: 'Scan Issue',
    scanIssueDefault:
      "We couldn't fully analyze the image. Please try again with a clearer full-body photo, standing straight with arms slightly away from your body.",
    styleRecommendations: 'Style Recommendations',
    tipClothes: 'Avoid baggy or obscuring clothes for a clearer proportion read',
    tipFullBody: 'Show your full body from head to toe',
    tipLighting: 'Use good lighting and a plain background if possible',
    tipPose: 'Stand straight with arms slightly away from your body',
    tipStandBack: 'Stand farther back until your whole body fits the outline',
    yourBodyProfileHasBeenSavedSuccessfully: 'Your body profile has been saved successfully.',
    yourMeasurements: 'Your Measurements',
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
    searchCountries: 'Search countries...',
    noCountriesFound: 'No countries found',
    detecting: 'Detecting...',
    useMyLocation: 'Use my location',
    quickSelect: 'Quick select',
    allRegions: 'All regions',
    styleQuiz: 'Take the style quiz',
    styleQuizDesc: '7 quick questions to discover your style archetype',
    orChoose: 'or choose below',
    steps: {
      location: { title: 'Where are you based?', description: 'This helps us personalise your experience with local trends and stores.' },
      gender: { title: 'How do you identify?', description: 'This helps us tailor style recommendations for you' },
      measurements: { title: 'Your body measurements', description: 'Optional, but helps us find your perfect fit' },
      stylist: { title: 'Meet your personal stylist', description: 'Choose who will guide your fashion journey' },
      undertone: { title: "What's your skin undertone?", description: 'This helps us recommend colours that complement you' },
      fit: { title: 'What fit do you prefer?', description: 'How do you like your clothes to fit?' },
      sizes: { title: "What are your sizes?", description: 'Enter your UK, US or EU size (e.g. M, L, UK 12, US 8)' },
      age: { title: 'What is your age range?', description: 'Helps us tailor style recommendations' },
      shopping: { title: 'How often do you shop?', description: 'Your shopping habits help us tailor recommendations' },
      sustainability: { title: 'Do you care about sustainability?', description: 'Tell us if eco-conscious fashion matters to you' },
      tellMore: { title: 'Tell us more (optional)', description: 'Help us personalise your recommendations' },
      retailers: { title: 'Where do you shop?', description: 'Select up to 10 of your favourites' },
      goals: { title: 'Why have you come to Dripn?', description: 'Choose up to 3 goals (helps the AI understand your needs)' },
      cultural: { title: 'Style & cultural preferences', description: 'Help Ruby & Max respect your style and cultural preferences (optional)' },
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
      streetwear: { name: 'Casual', description: 'Relaxed, everyday comfort' },
      luxury: { name: 'Minimalist', description: 'Simple, timeless pieces' },
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
    inviteDescription: 'Invite friends — you get 10% off per friend (up to 50% each month; extras carry over). They get 10% off too',
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
    deleteAccountAppleBillingWarning:
      'If you have an active Apple subscription, cancel it in Settings → Apple ID → Subscriptions before deleting your account.',
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
    askStylistTitle: 'Ask the Stylist',
    whatDecisionHelp: 'What decision can I help you with?',
    fashionRules: 'Fashion Rules',
    todayTip: "Today's Tip",
    oneDecisionDay: 'One decision a day, on me.',
    decisionShopping: 'Choosing what to buy',
    decisionShoppingDesc: 'Help me decide between options',
    decisionWhatToWear: 'What should I wear?',
    decisionWhatToWearDesc: 'Pick my outfit for today',
    decisionEventOutfit: 'Outfit for an event',
    decisionEventOutfitDesc: 'Something specific coming up',
    decisionSanityCheck: 'Quick sanity check',
    decisionSanityCheckDesc: 'Just need a second pair of eyes',
  },
  // Extended sections from en-flat.json
  bargains: {
    copiedToClipboard: 'Copied to Clipboard',
    dealDetailsCopiedYouCanNowPasteThisInAny: 'Deal details copied! You can now paste this in any chat or message to share with other members.\\n\\nDirect messaging feature coming soon!',
    dealSharedSuccessfully: 'Deal shared successfully!',
    error: 'Error',
    failedToCopyToClipboardPleaseTryAgain: 'Failed to copy to clipboard. Please try again.',
    shared: 'Shared',
  },
  coldOpen: {
    egNothingFeelsRightI: "e.g., Nothing feels right, I'm bored of my clothes...",
    egNothingFeelsRightImBoredOfMyClothes: "e.g., Nothing feels right, I'm bored of my clothes...",
    title: 'What are you getting dressed for?',
    subtitle: "Pick the occasion that's on your mind right now",
    whatsTheOccasion: "What's the occasion?",
    pickWhatYoureDressingFor: "Pick what you're dressing for",
    whatsTrippingYouUp: "What's tripping you up? (optional)",
    tellUsWhatsHard: "Tell us what's hard about getting dressed right now",
    work: 'Work',
    workDesc: 'Office, meetings, professional',
    holiday: 'Holiday',
    holidayDesc: 'Vacation, travel, relaxed',
    event: 'Event',
    eventDesc: 'Party, wedding, special occasion',
    casual: 'Casual',
    casualDesc: 'Everyday, weekend, errands',
    justBrowsing: 'Just Browsing',
    justBrowsingDesc: 'Exploring options, no rush',
    struggleToggle: 'Having a specific struggle? Tell me more (optional)',
    struggleLabel: "What's making it hard?",
    skip: 'Skip',
    continue: 'Continue',
  },
  discover: {
    title: 'Discover',
    subtitle: 'Explore fashion inspiration',
    reorderHint: 'Tap arrows to reorder categories',
    open: 'Open',
    goToSection: 'Go to Section',
    styleOfDay: 'Style of Day',
    styleOfDayDesc: 'Your personalized daily outfit recommendation tailored to your style and region.',
    trends: 'Trends',
    trendsDesc: "What's hot right now in fashion with real-time trend analysis and weekly highlights.",
    styleIcons: 'Style Icons',
    styleIconsDesc: 'Get inspired by celebrities and top fashion influencers with AI-powered lookalike outfits.',
    styleTherapy: 'Style Therapy',
    styleTherapyDesc: 'Mood-based styling, body positivity affirmations, and wellness-focused outfit recommendations.',
    ecoStyle: 'Eco Style',
    ecoStyleDesc: 'Discover sustainable fashion brands and eco-friendly styling tips.',
    fashionReads: 'Fashion Reads',
    fashionReadsDesc: 'Expert fashion articles, styling tips, magazine looks, and in-depth guides.',
    offers: 'Offers',
    offersDesc: 'Exclusive daily deals and discounts from trusted fashion retailers.',
    events: 'Events',
    eventsDesc: 'Discover fashion events near you with outfit suggestions.',
    styleDiplomat: 'Style Diplomat',
    styleDiplomatDesc: 'Cultural dress codes and fashion etiquette for 5 countries. Perfect for travelers.',
    influencers: 'Influencers',
    magazines: 'Magazines',
    celebrity: 'Celebrity',
    highlights: 'Highlights',
    blog: 'Blog',
    people: 'People',
    joinChallenge: 'Join Challenge',
    shareChallenge: 'Share Challenge',
    joinNow: 'Join Now',
  },
  fashionBlog: {
    title: 'Fashion Blog',
    subtitle: 'AI-researched weekly style insights and styling tips',
    getWeeklyUpdates: 'Get Weekly Updates',
    newsletterJoin: 'Join the Dripn newsletter for weekly fashion insights delivered to your inbox.',
    subscribe: 'Subscribe',
    subscribedWeekly: 'Subscribed · weekly issues below',
    alreadySubscribed: 'Already Subscribed',
    subscribedExclaim: 'Subscribed!',
    proTip: 'Pro Tip:',
    researchedFrom: 'Researched from:',
    report: 'Report',
    showLess: 'Show less',
    readMore: 'Read more',
    noArticlesYet: 'No Articles Yet',
    checkBackSoon: 'Check back soon for new style insights.',
    loadingArticles: 'Loading articles...',
    reportTypo: 'Typo or Error',
    reportOffensive: 'Offensive Content',
    reportInaccurate: 'Inaccurate Information',
  },
  surpriseMe: {
    stepOf: 'Step {current} of {total}',
    ruby: {
      1: 'Opening your wardrobe, love',
      '1d': 'Pulling up everything you own',
      2: 'Browsing your pieces',
      '2d': 'Shirts, trousers, shoes — the lot',
      3: 'Reading the room',
      '3d': 'Weather, occasion, and your notes',
      4: 'Building your look',
      '4d': 'Layering pieces that work together',
      5: 'Almost ready',
      '5d': 'Scoring the outfit and writing your notes',
    },
    max: {
      1: 'Digging into your wardrobe',
      '1d': 'Finding what actually works',
      2: 'Shortlisting pieces',
      '2d': 'No filler — only strong options',
      3: 'Factoring in your day',
      '3d': 'Context, weather, dress code',
      4: 'Assembling the outfit',
      '4d': 'Top to toe, styled properly',
      5: 'Final rating',
      '5d': 'Honest score coming up',
    },
    ace: {
      1: 'Scanning your closet data',
      '1d': 'Inventory check in progress',
      2: 'Optimising combinations',
      '2d': 'Efficiency over fluff',
      3: 'Checking conditions',
      '3d': 'Weather and constraints locked',
      4: 'Building the system look',
      '4d': 'Modular pieces, max versatility',
      5: 'Crunching the score',
      '5d': 'Data-backed recommendation ready',
    },
    ivy: {
      1: 'Reviewing your wardrobe story',
      '1d': 'Every piece has potential',
      2: 'Finding intentional pairings',
      '2d': "Thoughtful, not trendy for trend's sake",
      3: 'Considering your context',
      '3d': "Where you're going, how you want to feel",
      4: 'Composing the outfit',
      '4d': 'Balanced, wearable, you',
      5: 'Finishing touches',
      '5d': 'Notes and confidence score',
    },
    default: {
      1: '{name} is opening your wardrobe',
      '1d': 'Pulling up your pieces',
      2: 'Browsing options',
      '2d': 'Finding strong combinations',
      3: 'Reading the brief',
      '3d': 'Weather, occasion, preferences',
      4: 'Building your look',
      '4d': 'Putting it all together',
      5: 'Almost ready',
      '5d': 'Finalising your outfit',
    },
  },
  weeklyPlanner: {
    createOutfitsForWeek: 'Create outfits for the week',
    aiWillCreate: 'AI will create {n} looks from your {count} wardrobe items',
    numberOfDays: 'Number of days',
    days: '{n} days',
    focusOccasionOptional: 'Focus occasion (optional)',
    creatingOutfits: 'Creating outfits...',
    creatingOutfitOf: 'Creating outfit {x} of {y}...',
    generateOutfits: 'Generate {n} outfits',
  },
  cancelFlow: {
    waitDontLose: "Wait — don't lose your style progress",
    waitBody: "You'll lose access to your saved outfits, stylist conversations, and personalized recommendations.",
    keepSubscription: 'Keep Subscription',
    continue: 'Continue',
    mainReason: "What's the main reason?",
    feedbackHelps: 'Your feedback helps us improve Dripn.',
    youllLoseAccess: "You'll lose access to",
    savedOutfitsAndChats: 'Saved outfits and stylist conversations',
    cancelling: 'Cancelling...',
    confirmCancel: 'Confirm Cancel',
    planUpdated: 'Plan updated',
    subscriptionCancelled: 'Subscription cancelled',
    couldNotChangePlan: 'Could not change plan.',
    failedToCancel: 'Failed to cancel subscription.',
  },
  secondOpinion: {
    viewSubscriptionOptions: 'View subscription options',
    maybeLater: 'Maybe later',
    startConfidenceCheck: 'Start confidence check',
    noThanksTrust: 'No thanks, I trust you',
    unlockCommunityVoting: 'Unlock community voting',
    wantSecondOpinion: 'Want a quick second opinion?',
  },
  voiceComment: {
    limitReached: 'Voice Comment Limit Reached',
    recordingError: 'Recording Error',
    notAvailable: 'Not Available',
    availableInExpoGo: 'Voice recording is available in Expo Go',
    enableMic: 'Enable microphone access',
    holdToRecord: 'Hold to record voice comment',
  },
  shoppable: {
    sizes: 'Sizes:',
    shopNow: 'Shop Now',
    affiliateDisclosure: 'Dripn may earn a commission when you shop through this link.',
    noCommissionDisclosure: 'Dripn does not earn commission on purchases via Buy links.',
    cannotOpenLink: 'Cannot open link',
    errorOpeningProduct: 'Error opening product',
  },
  colorAnalysis: {
    analysisCompleteMessage: 'Analysis Complete Message',
    analysisCompleteTitle: 'Analysis Complete Title',
    analysisIssueMessage: 'Analysis Issue Message',
    analysisIssueTitle: 'Analysis Issue Title',
    analyzeFailed: 'Analyze Failed',
    cameraNotReady: 'Camera Not Ready',
    captureFailed: 'Capture Failed',
    captureFailedUpload: 'Capture Failed Upload',
    selectImageFailed: 'Select Image Failed',
    title: 'Color Analysis',
    viewResults: 'View Results',
  },
  community: {
    addYourStyleAdvice: 'Add your style advice...',
    anUnexpectedErrorOccurred: 'An unexpected error occurred.',
    couldNotGetStylingAdvicePleaseTryAgain: 'Could not get styling advice. Please try again.',
    createAFreeAccountToHelpOtherMembersWith: 'Create a free account to help other members with their style decisions.',
    descriptionRequired: 'Description Required',
    error: 'Error',
    failedToCreatePostPleaseTryAgain: 'Failed to create post. Please try again.',
    mediaRequired: 'Media Required',
    now: 'now',
    option: 'Option',
    permissionRequired: 'Permission Required',
    pleaseAddADescriptionToYourPost: 'Please add a description to your post.',
    pleaseAddAtLeastOnePhotoOrVideoToYourPos: 'Please add at least one photo or video to your post.',
    pleaseAddAtLeastTwoOptionsForAComparison: 'Please add at least two options for a comparison poll.',
    pleaseAllowAccessToYourCameraToRecordVid: 'Please allow access to your camera to record video.',
    pleaseAllowAccessToYourCameraToTakePhoto: 'Please allow access to your camera to take photos.',
    pleaseAllowAccessToYourPhotoLibraryToAdd: 'Please allow access to your photo library to add images.',
    pollClosed: 'Poll Closed',
    reportContent: 'Report',
    reportFailed: 'Report Failed',
    reportFailedMessage: 'Could not submit your report. Please try again.',
    reportSubmitted: 'Report Submitted',
    reportSubmittedMessage: 'Thank you for helping keep Dripn safe. Our team will review this content.',
    selectReason: 'Select a reason',
    selectReasonMessage: 'Please select a reason for your report.',
    signInRequired: 'Sign in required',
    styleAdvice: 'Style Advice',
    stylistAdviceLimitReached: 'Stylist Advice Limit Reached',
    submitReport: 'Submit Report',
    submitting: 'Submitting...',
    thisPollHasEndedAndVotingIsNoLongerAvail: 'This poll has ended and voting is no longer available.',
    twoOptionsRequired: 'Two Options Required',
    upgradeRequired: 'Upgrade Required',
    videoRecordingIsAvailableOnPersonalStyli: 'Video recording is available on Personal Stylist and above.',
    videoUploadsAreAvailableOnPersonalStylis: 'Video uploads are available on Personal Stylist and above.',
    vote: 'Vote',
    whyReporting: 'Why are you reporting this ${contentType}?',
    you: 'You',
    youMustBeLoggedInToCreateAPost: 'You must be logged in to create a post.',
  },
  dfy: {
    comparison: {
      applePurchaseFailed: 'Apple Purchase Failed',
      checkoutCancelledMessage: 'Checkout Cancelled Message',
      checkoutCancelledTitle: 'Checkout Cancelled Title',
      checkoutStartFailed: 'Checkout Start Failed',
      comparisonNoteFull: 'Comparison Note Full',
      comparisonNoteOccasion: 'Comparison Note Occasion',
      continueSetup: 'Continue Setup',
      continueToCheckout: 'Continue To Checkout',
      emailInvalid: 'Email Invalid',
      emailPlaceholder: 'Email Placeholder',
      emailReceiptNote: 'Email Receipt Note',
      emailRequired: 'Email Required',
      enterEmail: 'Enter Email',
      fullSetupLabel: 'Full Setup Label',
      getPersonalStylist: 'Get Personal Stylist',
      noDfyPurchaseMessage: 'No Dfy Purchase Message',
      noDfyPurchaseTitle: 'No Dfy Purchase Title',
      occasionReadyLabel: 'Travel Capsule',
      paymentErrorTitle: 'Payment Error Title',
      paymentNotCompletedMessage: 'Payment Not Completed Message',
      paymentNotCompletedTitle: 'Payment Not Completed Title',
      paymentSuccessCoreMessage: 'Payment Success Core Message',
      paymentSuccessLiteMessage: 'Payment Success Lite Message',
      paymentSuccessTitle: 'Payment Success Title',
      purchaseCancelledMessage: 'Purchase Cancelled Message',
      purchaseCancelledTitle: 'Purchase Cancelled Title',
      purchaseVerifyFailed: 'Purchase Verify Failed',
      restoreFailedMessage: 'Restore Failed Message',
      restoreFailedTitle: 'Restore Failed Title',
      restorePurchases: 'Restore Purchases',
      restoredMessage: 'Restored Message',
      restoredTitle: 'Restored Title',
      selectOption: 'Select Option',
      selected: 'Selected',
      signInRequiredApple: 'Sign In Required Apple',
      signInRequiredRestore: 'Sign In Required Restore',
      signInRequiredTitle: 'Sign In Required Title',
      startFullSetup: 'Start Full Setup',
      startQuickSetup: 'Start Quick Setup',
      structural: 'Structural',
      subtitleDefault: 'Subtitle Default',
      subtitlePaidAddOn: 'Subtitle Paid Add On',
      tactical: 'Tactical',
      titleDefault: 'Title Default',
      titlePaidAddOn: 'Title Paid Add On',
    },
    egBlueOxfordShirt: 'e.g., Blue Oxford Shirt',
    egCanIWearThisWithFlatsInstead: 'e.g., Can I wear this with flats instead?',
    expiry: {
      accessEndsNote: 'Access Ends Note',
      buildIt: 'Build It',
      buildWardrobeDesc: 'Build Wardrobe Desc',
      buildWardrobeTitle: 'Build Wardrobe Title',
      daysRemaining: 'Days Remaining',
      expiredSubtitleCore: 'Expired Subtitle Core',
      expiredSubtitleLite: 'Expired Subtitle Lite',
      keepStylistActive: 'Keep Stylist Active',
      keepStylistDesc: 'Keep Stylist Desc',
      planCompleteLite: 'Plan Complete Lite',
      subscribe: 'Subscribe',
      warningCapsule: 'Warning Capsule',
      whatStayed: 'What Stayed',
      whatStays: 'What Stays',
      whatStopped: 'What Stopped',
      whatStops: 'What Stops',
      windowEnded: 'Window Ended',
    },
    lookbook: {
      buildFailed: 'Build Failed',
      coreRedirectMessage:
        'Travel Capsule lookbooks are day grids. Your Full Wardrobe Setup lives in the 30-day Calendar.',
      coreRedirectTitle: 'Your Full Setup lives in the Calendar',
      dayLook: 'Day {day} Look',
      dayLookFallback: 'Day {day} Look',
      dayOf: 'Day {day} of {total}',
      daysLeft: '{count} days left',
      fillingDays: 'Filling in your remaining days…',
      love: 'Love',
      noLookbookMessage: 'Complete Decide For You to unlock your lookbook.',
      noLookbookTitle: 'No lookbook yet',
      notMe: 'Not me',
      openCalendarCta: 'Open 30-day Calendar',
      photosLoading: 'Photos loading…',
      piecesComingSoon: 'Pieces coming soon',
      refreshOutfits: 'Refresh outfits',
      someDaysUnfilled: 'Some days still need outfits',
      stylistLedNote: 'Stylist-led note',
      stylistNote: 'Stylist note',
      thePieces: 'The pieces',
      title: 'Lookbook',
      today: 'Today',
      todaysLook: "Today's Look",
      whatDoYouThink: 'What do you think?',
    },
    permissionRequired: 'Permission Required',
    photoLibraryAccessWasDeniedPleaseEnableI: 'Photo library access was denied. Please enable it in Settings.',
    pleaseAllowAccessToYourCamera: 'Please allow access to your camera.',
    pleaseAllowAccessToYourPhotoLibrary: 'Please allow access to your photo library.',
    start: {
      activeWindow: 'Active styling window',
      cantStartTitle: "Can't start yet",
      chooseIncludedPath: 'Choose your included path',
      chooseIncludedPathDesc: 'Your plan includes one setup — pick Travel Capsule or Full Setup to begin.',
      choosePlanUnlock: 'Choose a plan to unlock',
      chooseSetup: 'Choose your setup',
      chooseSetupDesc:
        'One-time stylist setup — Travel Capsule for a quick win, or Full Setup to digitise your wardrobe.',
      compareStylistUnlimited: 'Compare Stylist Pro',
      dressBetterPurchase: 'Dress better — purchase',
      fullSetupIncludedNote: 'Full Setup is included with Stylist Pro, or buy it here anytime.',
      headerDefault: 'Done-For-You Setup',
      heroIncluded: 'Included with {plan}',
      heroUnlock: 'Unlock your stylist setup',
      includedSetup: 'Your included setup',
      lookReadyPurchase: 'Look ready — purchase',
      noBenefitSubtitle:
        'Buy a one-time stylist setup — Travel Capsule for your next trip, or Full Setup to digitise your wardrobe.',
      oneSetupNote: 'Your plan includes one setup. Ready for the full wardrobe experience? Stylist Pro has you.',
      oneTime: 'one-time',
      orUnlockWithPlan: 'Or unlock a setup free with a membership',
      personalStylist: 'Personal Stylist',
      personalStylistIncludes: 'Includes Travel Capsule',
      purchase: 'Purchase',
      purchaseAnother: 'Purchase another setup',
      purchaseAnotherDesc: "You've used your included setup — run another whenever you want to look and feel your best.",
      quickVsFullNote: 'Travel Capsule is a fast win when you’re short on time. Full Setup is for when you want your whole closet digitised.',
      recommended: 'Recommended',
      startPath: 'Start {path}',
      stylistUnlimited: 'Stylist Pro',
      stylistUnlimitedIncludes: 'Includes Full Wardrobe Setup · Quick or Full path',
      tryAgain: 'Please try again.',
    },
    styleMeProperly: {
      doItMyself: 'Do It Myself',
      fastest: 'Fastest',
      footerReassurance: 'Footer Reassurance',
      subtitle: 'Subtitle',
      title: 'Title',
    },
    thereWasAnErrorSavingYourItemsPleaseTryA: 'There was an error saving your items. Please try again.',
    uploadFailed: 'Upload Failed',
  },
  discover: {
    connectAnAccount: 'Connect an Account',
    couldNotUpdateYourStylePleaseTryAgain: 'Could not update your style. Please try again.',
    egThatRedDressIWoreToMyGraduationTheVint: 'e.g., That red dress I wore to my graduation, the vintage jacket from my grandmother...',
    error: 'Error',
    pleaseConnectAtLeastOneSocialAccountToAn: 'Please connect at least one social account to analyze your saved posts.',
    pleaseSignInToVote: 'Please sign in to vote.',
    searchByName: 'Search by name...',
    signInRequired: 'Sign In Required',
  },
  feedback: {
    category: {
      chat: 'Other',
      login: 'other',
      other: 'Wardrobe',
      scanner: 'more-horizontal',
      wardrobe: 'grid',
    },
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Please describe in detail...',
    footer: 'Your feedback helps us build a better Dripn experience. All submissions are reviewed by our team.',
    intro: 'Help us improve Dripn! Your feedback is invaluable for making the app better for everyone.',
    rating: {
      excellent: 'user',
      fair: 'message-square',
      good: 'login',
      great: 'Login / Account',
      poor: 'AI Stylist Chat',
    },
    ratingPrompt: 'How would you rate your experience?',
    requiredCategory: 'Required Category',
    requiredDescription: 'Required Description',
    requiredRating: 'Required Rating',
    requiredTitle: 'Required Title',
    requiredTitleField: 'Required Title Field',
    requiredType: 'Required Type',
    screenTitle: 'wardrobe',
    submissionFailedMessage: 'Submission Failed',
    submissionFailedTitle: 'We couldn',
    submit: 'Submit Feedback',
    thankYouMessage: 'response.message || "Your feedback has been submitted successfully.",',
    thankYouTitle: 'OK',
    titleLabel: 'Title',
    titlePlaceholder: 'Brief summary of your feedback',
    type: {
      bug: {
        description: 'Description',
        label: 'Label',
      },
      feature: {
        description: 'Description',
        label: 'Label',
      },
      general: {
        description: 'Description',
        label: 'Label',
      },
      rating: {
        description: 'Description',
        label: 'Label',
      },
    },
    whatType: 'What type of feedback?',
    whichArea: 'Which area?',
  },
  guest: {
    askAboutAnOutfit: 'Ask about an outfit...',
  },
  help: {
    category: {
      account: 'Account',
      aiFeatures: 'AI Features',
      general: 'General',
      privacy: 'Privacy & Data',
      subscription: 'Subscription & Billing',
      troubleshooting: 'Troubleshooting',
    },
    chatWithJulia: 'Chat with Julia',
    chatWithJuliaSubtitle: 'Your personal support assistant',
    faq: {
      a1: {
        answer: 'You can sign up using your Apple ID, Google account, or email address. Just tap ',
        question: 'How do I create an account?',
      },
      a2: {
        answer: 'On the login screen, tap ',
        question: 'I forgot my password. How do I reset it?',
      },
      a3: {
        answer: "Your email is your account ID and can't be changed in the app. Contact support@dripnapp.com if you need to update it.",
        question: 'How do I change my email address?',
      },
      a4: {
        answer: 'We are sad to see you go! To delete your account, go to Settings, then scroll to Account, then Delete Account. Please note this action is permanent and cannot be undone.',
        question: 'How do I delete my account?',
      },
      a5: {
        answer: 'We recommend using one account to get the most personalized experience. Our AI learns your style preferences over time, so keeping one account helps us serve you better.',
        question: 'Can I have multiple accounts?',
      },
      ai1: {
        answer: 'Our AI stylists (Ruby, Max, Ace, and Ivy) each have unique personalities and styling approaches. They analyze your photos, consider your style preferences, body type, and the occasion to provide personalized outfit advice. The more you use it, the better they understand your taste!',
        question: 'How does the AI stylist work?',
      },
      ai3: {
        answer: 'Open Stylist Chat and tap the headphones icon for Voice mode — your stylist speaks replies aloud (uses voice sessions from your plan). In Chat mode, type or tap the mic to dictate; text replies are unlimited on the Personal Stylist plan.',
        question: 'How do voice conversations work?',
      },
      ai4: {
        answer: 'Color Analysis helps you discover which colors complement your skin tone, hair, and eyes. Our AI determines your color season (Spring, Summer, Autumn, or Winter) and recommends the most flattering shades for you.',
        question: 'What is Color Analysis?',
      },
      g1: {
        answer: 'Dripn is your personal fashion decision engine that helps you confidently decide what to wear. Get instant outfit advice from AI stylists with distinct personalities, manage your digital wardrobe, and discover your unique style.',
        question: 'What is Dripn?',
      },
      g2: {
        answer: 'Dripn is available on iOS and Android devices through the Expo Go app, and also accessible via web browsers. For the best experience, we recommend using the mobile app.',
        question: 'Which devices support Dripn?',
      },
      g3: {
        answer: 'Simply create an account, complete our quick style quiz to help us understand your preferences, and start exploring! You can upload your wardrobe, ask your AI stylist for outfit advice, or get a personalised lookbook right away.',
        question: 'How do I get started?',
      },
      g4: {
        answer: 'Yes! When you first open the app, you will see helpful tips. You can also retake the Style Quiz anytime from Settings to update your preferences.',
        question: 'Is there a tutorial available?',
      },
      g5: {
        answer: 'No. Dripn does not earn commission on purchases you make through Buy links. Prices and availability are set by the retailer.',
        question: 'Does Dripn earn commission from Buy links?',
      },
      p1: {
        answer: 'We collect information you provide (profile, wardrobe photos, preferences) and usage data to improve your experience. We never sell your personal data. See our Privacy Policy for full details.',
        question: 'What data does Dripn collect?',
      },
      p2: {
        answer: 'Yes! All your wardrobe photos and outfit images are private by default. Photos used for AI features are processed securely and never shared.',
        question: 'Are my photos private?',
      },
      p3: {
        answer: 'You can delete individual items from your wardrobe. To delete all your data, you can request a full data deletion through Settings or by contacting our support team.',
        question: 'How do I delete my data?',
      },
      p4: {
        answer: 'Absolutely. All payments are processed through our secure payment partner Stripe. We never see or store your full payment details.',
        question: 'Is my payment information secure?',
      },
      p5: {
        answer: 'Yes! You can request a copy of your data by contacting our support team. We will prepare your data export within 30 days.',
        question: 'Can I download my data?',
      },
      s1: {
        answer: 'We offer three plans: Free (1 stylist decision per day, 2-option shopping compare, up to 15 wardrobe items), Personal Stylist at £9.99 per month (unlimited decisions, 3-way compare, wardrobe-aware advice, outfit calendar, decision history), and Stylist Pro at £19.99 per month (unlimited wardrobe, event planning, and full planning tools).',
        question: 'What subscription plans are available?',
      },
      s2: {
        answer: 'Go to Settings, then Subscription to view all plans and upgrade. Payments are processed securely through Stripe.',
        question: 'How do I upgrade my subscription?',
      },
      s3: {
        answer: 'You can cancel anytime from Settings, then Subscription. You will keep access to your current tier features until the end of your billing period.',
        question: 'How do I cancel my subscription?',
      },
      s4: {
        answer: 'Refunds are handled on a case-by-case basis. For any billing concerns, please contact our support team through the Chat with Julia button below, and we will do our best to help.',
        question: 'Will I get a refund if I cancel?',
      },
      s5: {
        answer: 'First, try logging out and back in to refresh your account. If you still have issues, contact Julia below and we will help resolve the problem.',
        question: 'My subscription features are not working. What should I do?',
      },
      t1: {
        answer: 'Try these steps: Close and reopen the app, check your internet connection, clear the app cache in your phone settings, and make sure you have the latest app version installed.',
        question: 'The app is running slow. What can I do?',
      },
      t2: {
        answer: 'First, check that Dripn has permission to access your photos (Settings on your phone). Then verify you have a stable internet connection. Try uploading a smaller photo first, and close other apps to free up memory.',
        question: 'My photos are not uploading. Help!',
      },
      t3: {
        answer: 'Go to your phone Settings, find Dripn, and ensure notifications are enabled. Also check that Do Not Disturb is off. In the app, verify notification settings under Profile, then Settings.',
        question: 'I am not receiving notifications.',
      },
      t4: {
        answer: 'We are sorry about that! Try force-closing and reopening the app. If crashes persist, try reinstalling the app. Your account data will be preserved. Please report ongoing issues to our support team.',
        question: 'The app crashed! What happened?',
      },
      t5: {
        answer: 'The web version has some limitations compared to mobile. For the best experience with all features, we recommend using the iOS or Android app through Expo Go.',
        question: 'Features look different on web vs mobile.',
      },
      t6: {
        answer: 'Make sure you are signed into your Apple or Google account on your device. Try logging out and back in to those accounts. If using web, some browsers may block sign-in popups, so check your popup settings.',
        question: 'I cannot log in with Apple or Google.',
      },
    },
    faqSectionTitle: 'Frequently Asked Questions',
    heroSubtitle: 'Find answers below or chat with Julia, your friendly support companion who is always happy to help.',
    heroTitleItalic: 'We\'ve got you covered.',
    heroTitleLine1: 'Need help?',
    heroTitleLine2: 'Don\'t worry —',
    screenTitle: 'Help & FAQ',
    stillHaveQuestions: 'Still have questions?',
  },
  privacy: {
    effectiveDate: 'Effective Date: December 7, 2025',
    footerAppName: 'Dripn - Fashion Advice App',
    footerVersion: 'Version 1.0.0',
    intro1: 'Welcome to Dripn. Your privacy is important to us. This Privacy Policy explains how Dripn ("we," "us," or "our") collects, uses, discloses, and protects your personal information when you use our mobile application and related services (collectively, the "Service").',
    intro2: 'By using Dripn, you agree to the collection and use of information in accordance with this policy. If you do not agree with this policy, please do not use our Service.',
    lastUpdated: 'Last Updated: July 16, 2026',
    screenTitle: 'Privacy Policy',
    section01: {
      sub01: {
        bullet1: 'Account information: name, email address, password, gender, and country.',
        bullet2: 'Profile information: profile photo, style preferences, body measurements, and fashion interests.',
        bullet3: 'Content: photos, wardrobe images, comments, and voice recordings you share.',
        bullet4: 'Communications: messages, feedback, and support requests.',
        bullet5: 'Payment information: billing details processed securely through Stripe.',
        intro: 'When you create an account, use our Service, or contact us, you may provide:',
        title: '1.1 Information You Provide',
      },
      sub02: {
        bullet1: 'Device information: device type, operating system, and unique device identifiers.',
        bullet2: 'Usage data: features used, interactions, time spent, and preferences.',
        bullet3: 'Location data: approximate location based on IP address or precise location if you grant permission.',
        bullet4: 'Camera and photo library access: only when you choose to upload content.',
        intro: 'When you use our Service, we automatically collect:',
        title: '1.2 Information Collected Automatically',
      },
      sub03: {
        body: 'We may receive information from third-party services you connect, such as Apple or Google for sign-in, or other services you choose to link.',
        title: '1.3 Information from Third Parties',
      },
      title: '1. Information We Collect',
    },
    section02: {
      bullet1: 'Provide, maintain, and improve the Dripn Service.',
      bullet2: 'Personalize your experience with AI-powered fashion recommendations.',
      bullet3: 'Process subscriptions and payments securely.',
      bullet4: 'Display regionally and gender-appropriate fashion content.',
      bullet5: 'Send notifications about your account and styling updates.',
      bullet6: 'Respond to your inquiries and provide customer support.',
      bullet7: 'Detect, prevent, and address fraud, abuse, and security issues.',
      bullet8: 'Comply with legal obligations and enforce our Terms of Service.',
      intro: 'We use the information we collect to:',
      title: '2. How We Use Your Information',
    },
    section03: {
      body: 'You can disable AI suggestions in your Settings at any time.',
      bullet1: 'Your outfit photos may be analysed to provide styling suggestions.',
      bullet2: 'Your style preferences and history inform personalised recommendations.',
      bullet3: 'We do not use your photos to train AI models without explicit consent.',
      intro: 'Dripn uses artificial intelligence to provide personalized fashion advice. When you request AI recommendations:',
      title: '3. AI and Automated Processing',
    },
    section04: {
      bullet1: 'With service providers: Payment processors (Stripe), email services (SendGrid), analytics, and cloud hosting providers who assist in operating our Service.',
      bullet2: 'With AI services: Your styling data is processed by our AI systems to provide personalised recommendations.',
      bullet3: 'For legal reasons: When required by law, court order, or to protect rights and safety.',
      bullet4: 'Business transfers: In connection with a merger, acquisition, or sale of assets.',
      bullet5: 'With your consent: When you authorise us to share information.',
      intro: 'We do not sell your personal information. We may share information:',
      title: '4. Information Sharing and Disclosure',
    },
    section05: {
      bullet1: 'Most data is deleted within 30 days.',
      bullet2: 'Some data may be retained for legal, security, or fraud prevention purposes.',
      bullet3: 'Anonymised data may be retained for analytics.',
      intro: 'We retain your personal information for as long as your account is active or as needed to provide the Service. After account deletion:',
      title: '5. Data Retention',
    },
    section06: {
      body: 'To exercise these rights, contact us at privacy@dripnapp.com or use the in-app Settings.',
      bullet1: 'Access: Request a copy of your personal data.',
      bullet2: 'Correction: Update or correct inaccurate information.',
      bullet3: 'Deletion: Request deletion of your account and data.',
      bullet4: 'Portability: Receive your data in a portable format.',
      bullet5: 'Opt-out: Disable marketing communications and AI suggestions.',
      bullet6: 'Restriction: Limit how we process your data.',
      intro: 'Depending on your location, you may have the right to:',
      title: '6. Your Rights and Choices',
    },
    section07: {
      body: 'While we strive to protect your data, no method of transmission or storage is completely secure.',
      bullet1: 'Encryption of data in transit and at rest.',
      bullet2: 'Secure authentication and access controls.',
      bullet3: 'Regular security assessments and monitoring.',
      bullet4: 'PCI-compliant payment processing through Stripe.',
      intro: 'We implement industry-standard security measures to protect your information, including:',
      title: '7. Data Security',
    },
    section08: {
      body: 'Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.',
      title: '8. International Data Transfers',
    },
    section09: {
      body: 'Dripn is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately, and we will delete it.',
      title: '9. Children\'s Privacy',
    },
    section10: {
      body: 'Our Service may contain links to third-party websites, affiliate shopping links, or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.',
      title: '10. Third-Party Links and Services',
    },
    section11: {
      body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy in the app and updating the "Last Updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.',
      title: '11. Updates to This Policy',
    },
    section12: {
      emailPrivacy: 'Email: privacy@dripnapp.com',
      emailSupport: 'Support: support@dripnapp.com',
      intro: 'If you have questions about this Privacy Policy or our data practices, please contact us:',
      title: '12. Contact Us',
    },
    section13: {
      sub01: {
        body: 'If you are in the European Economic Area, you have additional rights under GDPR including the right to lodge a complaint with your local data protection authority. Our legal bases for processing include consent, contract performance, and legitimate interests.',
        title: 'For European Users (GDPR)',
      },
      sub02: {
        body: 'California residents have the right to know what personal information is collected, request deletion, and opt-out of the sale of personal information. We do not sell personal information. To exercise your rights, email privacy@dripnapp.com.',
        title: 'For California Users (CCPA/CPRA)',
      },
      sub03: {
        body: 'UK residents have rights under UK GDPR similar to those in the EEA. You may contact the Information Commissioner\'s Office (ICO) with any concerns.',
        title: 'For UK Users',
      },
      title: '13. Region-Specific Provisions',
    },
    title: 'Privacy Policy',
    welcome1: 'Your trust means everything to us. We know that sharing personal information requires confidence in how it will be handled, and we take that responsibility seriously.',
    welcome2: 'This policy explains, in plain language, what information we collect, why we collect it, and how we keep it safe. If you ever have questions, our support team is always here to help.',
  },
  savedOutfits: {
    couldNotSaveMessage: 'Please try again in a moment.',
    couldNotSaveTitle: 'Could not save',
    defaultTitle: 'Saved look',
    descriptionOptional: 'Description (optional)',
    descriptionPlaceholder: 'Why you love it, when to wear it, styling notes…',
    itemCount: '{count} items',
    itemPlaceholder: 'Item',
    loveThisOutfit: 'Love this outfit',
    namePrompt: 'Give this look a name so you can find it quickly in Saved Outfits.',
    nothingToSaveMessage: 'This outfit has no wardrobe items linked yet.',
    nothingToSaveTitle: 'Nothing to save',
    outfitColumn: 'Outfit',
    outfitDetails: 'Outfit details',
    outfitSavedMessage: 'Outfit saved. Find it anytime in Profile → Saved Outfits.',
    outfitSavedTitle: 'Outfit saved',
    previewColumn: 'Preview',
    saveOutfit: 'Save outfit',
    savedToFavoritesMessage: 'Saved to favorites. Find it anytime in Profile → Saved Outfits.',
    savedToFavoritesTitle: 'Saved to favorites',
    scrollHint: 'Scroll to browse all {count} outfits',
    titleLabel: 'Name',
    titlePlaceholder: 'e.g. Work Friday, Date night look…',
  },
  styleDna: {
    buildWardrobe: 'Build Wardrobe',
    colorPalette: 'Color Palette',
    dominantStyle: 'Dominant Style',
    emptySubtitle: 'Empty Subtitle',
    emptyTitle: 'Empty Title',
    evolvingHeadline: 'Evolving Headline',
    learnedFromSwipes: 'Learned From Swipes',
    percentOfWardrobe: 'Percent Of Wardrobe',
    secondaryStyle: 'Secondary Style',
    styleBreakdown: 'Style Breakdown',
    title: 'Style DNA',
  },
  subscription: {
    almostThereMessage: 'Complete checkout to activate your plan.',
    almostThereTitle: 'Almost there!',
    apply50Off: 'Apply 50% off',
    billingHintApple: 'Opens App Store subscription settings.',
    billingHintStripe: 'Opens Stripe to update your card, billing address, and invoices.',
    billingHintTesting: 'Testing mode — no Stripe billing linked. Subscribe below to use the real billing portal.',
    billingMonthly: 'Monthly',
    billingUnavailableMessage: 'Unable to open billing management. Please try again.',
    billingUnavailableTitle: 'Billing unavailable',
    billingYearly: 'Yearly',
    cancel: {
      discountAppliedMessage: '50% off your next month has been applied.',
      discountAppliedTitle: 'Discount applied',
      discountFailed: 'Could not apply discount. Please try again.',
      great: 'Great!',
      lossExtendedWardrobe: 'Extended wardrobe (up to 75 items)',
      lossOutfitCalendar: 'Outfit calendar',
      lossSmartSuggestions: 'Smart outfit suggestions',
      lossUnlimitedDecisions: 'Unlimited style decisions',
      lossWardrobeAware: 'Wardrobe-aware stylist advice',
      lossUnlimitedEverything: 'Unlimited wardrobe & outfit suggestions',
      lossUnlimitedVoice: 'Higher voice & virtual try-on limits',
      lossVideoCalls: 'Priority background removal',
      lossVipAccess: 'Stylist Pro planning tools',
      lossVoiceConversations: 'Voice conversations with your stylist',
      lossWhiteGlove: 'Priority stylist support',
      basedOnUsage: 'Based on how you use Dripn',
      appleCancelTitle: 'Manage in the App Store',
      appleCancelMessage:
        'This subscription is billed through Apple. Cancel or change it in Settings → Apple ID → Subscriptions, or tap Manage Subscription.',
      appleCancelManage: 'Manage Subscription',
      afterBillingEndsOn: 'After your billing period ends on {date}:',
      afterBillingEnds: 'After your billing period ends:',
      cancelledUntilDate:
        'Your subscription will remain active until {date}.',
      offerUnavailableMessage: 'This retention offer is no longer available.',
      offerUnavailableTitle: 'Offer unavailable',
      pauseFailed: 'Could not pause plan.',
      planPausedMessage: 'Your plan is paused. Resume anytime.',
      planPausedTitle: 'Plan paused',
      reasonJustTesting: 'Just testing',
      reasonNotSeeingValue: 'Not seeing the value',
      reasonNotUsing: 'Not using it enough',
      reasonOther: 'Other',
      reasonTooExpensive: 'Too expensive',
    },
    cancelSubscription: 'Cancel subscription',
    cancelledMessage: 'Your subscription will remain active until the end of the current billing period.',
    cancelledTitle: 'Subscription cancelled',
    checkoutStartFailed: 'Unable to start checkout. Please try again.',
    choosePlanTitle: 'Choose a plan',
    choosePlanWinbackMessage: 'Welcome back — pick a plan to continue your style journey.',
    chooseYourPlan: 'Choose your plan',
    currentPlan: 'Current',
    dfy: {
      included: {
        benefitCaption: 'Travel Capsule & Full Wardrobe Setup',
        defaultCaption: 'Personal Stylist · Travel Capsule · Unlimited · Full Setup',
        defaultTitle: 'Included with your plan',
        featureFull1: 'Up to 30 pieces digitised and organised',
        featureFull2: 'Everyday outfit decisions from your wardrobe',
        featureFull3: 'Remix and plan ahead with ease',
        featureFull4: 'Wardrobe saved and ready anytime',
        featureNone1: 'Travel Capsule wardrobe digitisation on Personal Stylist',
        featureNone2: 'Full Setup option on Stylist Pro',
        featureNone3: 'Occasion-ready looks from your outfit photos',
        featureNone4: 'Organised wardrobe you can remix anytime',
        featureSprint1: '14 destination-ready looks for your trip',
        featureSprint2: 'Upload outfit photos — stylist styles you',
        featureSprint3: '14-day travel capsule',
        featureSprint4: 'Save looks to revisit anytime',
        fullDescription: '14 destination-ready looks for your next trip. Upload outfit photos and we pack a Travel Capsule around them.',
        fullSubtitle: 'Full Setup included',
        fullWardrobeTitle: 'Full Wardrobe Setup',
        noneDescription: 'Subscribe to unlock one included stylist setup. Personal Stylist gets Travel Capsule; Unlimited lets you choose Travel Capsule or Full Setup.',
        noneSubtitle: 'Subscribe to unlock',
        occasionReadyTitle: 'Travel Capsule',
        sprintDescription: 'Digitise your wardrobe for long-term remixing. Choose Travel Capsule for a fast win or Full Setup to map up to 30 items.',
        sprintSubtitle: 'Travel Capsule included',
      },
      includedSectionSubtitle: 'Every paid plan includes a done-for-you wardrobe kickstart — no separate purchase.',
      includedSectionTitle: 'Included Stylist Setup',
      includedWithPlan: 'Included with your plan',
      occasion: {
        cta: 'Build my Travel Capsule',
        description: 'A 14-day Travel Capsule for your trip. Tell us where you\'re going and we\'ll pack destination-ready looks from the clothes you already own.',
        excluded1: 'Build your wardrobe system',
        excluded2: 'Edit or customize individual items',
        feature1: '14 destination-ready looks from a small capsule',
        feature2: 'Packed for your trip weather and activities',
        feature3: 'Flight-day looks included',
        feature4: 'Save looks to revisit anytime',
        title: 'Travel Capsule',
      },
      oneTimePurchase: 'One-time purchase',
      paidSectionSubtitle: 'After your included DFY setup benefit is used — one-time purchases.',
      paidSectionTitle: 'Purchase Additional Setup',
      seeWhatsIncluded: 'See what\'s included',
      startMySetup: 'Start my setup',
      structural: 'Structural',
      tactical: 'Tactical',
      wardrobe: {
        cta: 'Build my wardrobe',
        description: 'Solve the system, not the moment. Photograph individual items and I\'ll organise your wardrobe so decisions get easier every time.',
        feature1: 'Look put-together — up to 30 pieces styled for you',
        feature2: '30 days of outfit inspiration',
        feature3: 'Your wardrobe, saved and ready anytime',
        feature4: 'Swap, remix & plan ahead with ease',
        title: 'Full Wardrobe Setup',
      },
      yourBenefit: 'Your benefit',
    },
    discountAppliedMessage: '50% off has been applied to your next billing cycle.',
    discountAppliedTitle: 'Great!',
    features: {
      free: {
        basicChat: 'Basic AI chat (10/day)',
        compareTwo: 'Compare 2 shopping options',
        dailyDecision: '1 stylist decision per day',
        decisionHistory: 'Decision history',
        outfitCalendar: 'Outfit calendar',
        wardrobe15: 'Up to 15 wardrobe items',
        wardrobeAdvice: 'Wardrobe-aware advice',
      },
      personalStylist: {
        confidence: 'Build confidence before you leave the house',
        instantDecisions: 'Get instant outfit decisions (no overthinking)',
        learnsStyle: 'Stylists learn your style over time',
        looksGood: 'Know what actually looks good on you',
        outfitCalendar: 'Outfit calendar',
        voiceAnswers: 'Voice your outfit and get instant answers',
      },
      stylistUnlimited: {
        everythingPersonal: 'Everything in Personal Stylist',
        eventPlanning: 'Event planning & sustainability tools',
        fullWardrobe: 'See your full wardrobe instantly',
        planAhead: 'Plan outfits days or weeks ahead',
        systemWorks: 'Build a system that always works',
        voiceAnytime: 'Talk to your stylist by voice, anytime',
      },
    },
    finePrintAnd: ' and ',
    finePrintApple:
      'Payment will be charged to your Apple ID at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. Manage or cancel anytime in Settings → Apple ID → Subscriptions. See our ',
    finePrintStripe: 'Payments processed securely by Stripe. See our ',
    great: 'Great!',
    heroSubtitle: 'Your AI stylist for everyday confidence — or full life planning',
    heroTitle: 'Look Better, Stress Less',
    inviteFriends: 'Invite Friends',
    inviteFriendsSubtitle: 'Share your code — 10% off per friend, up to 50% each month',
    manageBilling: 'Manage Billing',
    manageSubscription: 'Manage Subscription',
    aiTopUp: {
      title: 'AI Top-Up',
      subtitle: 'Need more Live and chat this month? Buy extra credit without changing your subscription.',
      standardName: 'AI Top-Up',
      standardDetail: '+300 AI credits this month',
      plusName: 'AI Top-Up Plus',
      plusDetail: '+600 AI credits this month',
      comingSoon: 'AI Top-Up packs are being finished in App Store Connect. You can upgrade for a bigger included monthly pot today, or check back shortly to buy credit on your current plan.',
      comingSoonPro: 'AI Top-Up packs are being finished in App Store Connect. Check back shortly to buy extra Live and chat credit.',
    },
    memberVideoCallingIsAvailableOnTheStylis: 'Member video calling is available on the Stylist Pro plan.',
    mostPopular: 'Most Popular',
    noBillingAccountMessage: 'Subscribe first to set up billing.',
    noBillingAccountTitle: 'No billing account',
    noPurchasesMessage: 'We could not find any previous purchases for this account.',
    noPurchasesTitle: 'No purchases found',
    off: 'off',
    offerUnavailableMessage: 'This offer is no longer available.',
    offerUnavailableTitle: 'Offer unavailable',
    oneTimeNoSub: 'One-time purchase — no subscription required',
    orAltPrice: 'or',
    pauseFailedMessage: 'Unable to pause your plan. Please try again.',
    pausePlanInstead: 'Pause my plan instead',
    paymentPageFailed: 'Unable to open payment page. Please try again.',
    perMonth: '/ month',
    perYear: '/year',
    period: {
      month: '/ month',
      year: '/year',
    },
    plan: {
      free: {
        description: 'Try Dripn with daily styling decisions',
        name: 'Free',
        period: 'forever',
      },
      personalStylist: {
        description: 'Stop wasting time deciding what to wear.',
        footerLine: 'Perfect if you want to look better without the effort',
        name: 'Personal Stylist',
        tagline: 'Look good in 30 seconds — every single day.',
      },
      stylistUnlimited: {
        description: 'Never think about outfits again.',
        footerLine: 'For people who are done guessing and want full control',
        name: 'Stylist Pro',
        tagline: 'Your entire wardrobe — organised, planned, handled.',
      },
    },
    planPausedMessage: 'Your subscription is paused. No charges while paused.',
    planPausedTitle: 'Plan paused',
    privacyPolicy: 'Privacy Policy',
    processing: 'Processing...',
    reactivateFailedMessage: 'Unable to reactivate. Please try again.',
    reactivatedMessage: 'Your subscription has been reactivated and will continue as normal.',
    reactivatedTitle: 'Reactivated',
    refresh: 'Refresh',
    restoreFailedMessage: 'We could not restore your purchases. Please try again.',
    restoreFailedTitle: 'Restore failed',
    restorePurchases: 'Restore Purchases',
    restoredMessage: 'Your purchases have been restored successfully.',
    restoredTitle: 'Purchases restored',
    restoring: 'Restoring...',
    save: 'Save',
    save20Percent: 'Save 20%',
    screenTitle: 'Subscription',
    sharingFailed: 'Sharing failed',
    sharingFailedMessage: 'Could not share your referral code. Please try again.',
    showMeOptions: 'Show me options',
    signInToRestore: 'Sign in to restore purchases',
    signInToSubscribe: 'Sign in to subscribe',
    startPlan: 'Start Plan',
    starter: 'Starter',
    stylistUnlimitedFeature: 'Stylist Pro Feature',
    subscribeFirstMessage: 'You need an active subscription to access this feature.',
    subscribeFirstTitle: 'Subscribe first',
    subscriptionActiveMessage: 'Your subscription is active and all features are unlocked.',
    subscriptionActiveTitle: 'Subscription Active',
    success: {
      activating: 'Activating your upgrade…',
      coreWardrobe: {
        check1: 'Bulk upload (20 items)',
        check2: 'Expert-curated core pieces',
        check3: 'Personalised wardrobe blueprint',
        check4: 'Shoppable recommendations',
        headline: 'Full access unlocked — no limits',
        subtext: 'Plan, pack, and prioritise with Stylist Pro',
      },
      goUnlimited: 'Go Unlimited',
      goUnlimitedBody: 'Unlimited wardrobe, event planning, and VIP member access',
      guidedPrompt: 'Your stylist is ready when you are',
      heroTitle: 'You\'re all set!',
      outfitSetup: {
        check1: 'Occasion-ready outfit plans',
        check2: 'Stylist-selected combinations',
        check3: '5–7 ready-to-wear looks',
        check4: '14-day styling sprint',
        headline: 'One-time professional setup',
        subtext: 'Tailored looks built around your lifestyle',
      },
      personalStylist: {
        check1: 'Unlimited stylist decisions',
        check2: 'Outfit calendar',
        check3: 'Wardrobe-aware daily advice',
        check4: 'Voice chat with your stylist',
        headline: 'Your outfit setup is confirmed',
        subtext: 'Personal AI stylist with extended voice',
      },
      primaryPrompt: 'Start styling now',
      screenTitle: 'Welcome to Dripn',
      socialProof: 'Join 1,000+ users improving their style daily',
      startStylingFooter: 'Ruby, Max, Ace, or Ivy — your AI stylist is waiting',
      startStylingNow: 'Start styling now',
      styleChat: {
        check1: 'Instant outfit decisions',
        check2: 'Photo & wardrobe advice',
        check3: 'Learns your preferences',
        check4: 'Available 24/7',
        headline: 'Your stylist is ready',
        subtext: 'Start a conversation — text or voice',
      },
      stylistUnlimited: {
        check1: 'Full wardrobe analysis',
        check2: 'Event planning & sustainability tools',
        check3: 'Unlimited wardrobe & try-on',
        check4: 'Priority support',
        headline: 'You\'re on Stylist Pro',
        subtext: 'Unlimited wardrobe, voice, and planning tools — ready when you are',
      },
      tryThisFirst: 'Try this first',
      upgradeNow: 'Upgrade now',
      urgency: 'Ruby, Max, Ace, or Ivy — your AI stylist is waiting',
      whatsUnlocked: 'What\'s unlocked',
    },
    termsOfService: 'Terms of Service',
    testingModeMessage: 'Billing is in test mode. No real charges will be made.',
    testingModeTitle: 'Testing mode',
    upgradeHintSubscribe: 'Subscribe below to set up billing.',
    upgradeHintTrial: 'Choose a plan below to subscribe.',
    upgradeManage: 'Manage',
    upgradeManageBilling: 'Manage Billing',
    winbackPauseBanner: 'You can pause your plan instead of cancelling — no charges while paused.',
    winbackWelcome50: 'Welcome back! Your exclusive 50% off your next month is ready.',
    yourAiStylist: 'Your AI stylist',
    youreOn: 'You\'re on',
  },
  support: {
    clear: 'Clear',
    clearChatMessage: 'This will remove your conversation with Julia. You can always start a new chat anytime.',
    clearChatTitle: 'Clear chat history?',
    commonIssues: 'Common Issues',
    createTicket: 'Create Support Ticket',
    describeIssue: 'Describe Your Issue',
    issuePlaceholder: 'Tell us what happened and how we can help…',
    juliaName: 'Julia',
    juliaSubtitle: 'Your support assistant',
    juliaTyping: 'Julia is typing...',
    messagePlaceholder: 'Type your message...',
    missingInfoMessage: 'Please choose a category and describe your issue.',
    missingInfoTitle: 'Missing information',
    responseFailed: 'Could not get a response. Please try again.',
    screenTitle: 'Ask Julia',
    selectCategory: 'Select Category',
    sendFailed: 'Could not send your message. Please try again.',
    submitTicket: 'Submit Ticket',
    ticketFailed: 'Could not create your ticket. Please try again or email support@dripnapp.com.',
    quickAction: {
      'app-slow': 'App is running slow',
      'login-issues': 'Cannot log in',
      'subscription-not-working': 'Subscription features not working',
      'photos-not-uploading': 'Photos not uploading',
      'notifications-not-working': 'Not receiving notifications',
    },
    ticketCategory: {
      subscription: 'Subscription & Plans',
      account: 'Account Issues',
      'app-issue': 'App Problems',
      billing: 'Billing & Payments',
      styling: 'Styling Features',
      'feature-request': 'Feature Requests',
      other: 'Other',
    },
  },
  terms: {
    effectiveDate: 'Effective Date: December 7, 2025',
    footerAppName: 'Dripn - Fashion Advice App',
    footerVersion: 'Version 1.0.0',
    intro1: 'Welcome to Dripn. These Terms of Service ("Terms") govern your access to and use of the Dripn mobile application and related services (collectively, the "Service"). By accessing or using Dripn, you agree to be bound by these Terms.',
    intro2: 'Please read these Terms carefully before using our Service. If you do not agree to these Terms, you may not access or use the Service.',
    lastUpdated: 'Last Updated: July 16, 2026',
    screenTitle: 'Terms of Service',
    section01: {
      bullet1: 'Are at least 13 years of age (or the minimum age in your jurisdiction).',
      bullet2: 'Have the legal capacity to enter into these Terms.',
      bullet3: 'Agree to comply with all applicable laws and regulations.',
      bullet4: 'Have read and understood our Privacy Policy.',
      intro: 'By creating an account or using Dripn, you confirm that you:',
      title: '1. Acceptance of Terms',
    },
    section02: {
      bullet1: 'Receive instant AI-powered outfit recommendations.',
      bullet2: 'Chat with personalised AI stylists for fashion advice.',
      bullet3: 'Build and manage a digital wardrobe.',
      bullet4: 'Access personalised styling advice based on your preferences.',
      bullet5: 'Subscribe to premium features for enhanced experiences.',
      bullet6: '',
      intro: 'Dripn is a personal fashion decision engine that enables users to:',
      title: '2. Description of Service',
    },
    section03: {
      sub01: {
        body: 'To use certain features, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate.',
        title: '3.1 Account Creation',
      },
      sub02: {
        body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.',
        title: '3.2 Account Security',
      },
      sub03: {
        body: 'Each user may maintain only one account. Creating multiple accounts may result in termination of all accounts.',
        title: '3.3 One Account Per Person',
      },
      title: '3. User Accounts',
    },
    section04: {
      sub01: {
        bullet1: 'Free: Limited stylist decisions, wardrobe items, and AI chat.',
        bullet2: 'Personal Stylist: Unlimited decisions, wardrobe-aware advice, outfit calendar, and extended AI chat.',
        bullet3: 'Stylist Pro: Everything in Personal Stylist plus unlimited wardrobe and planning tools.',
        intro: 'Dripn offers the following subscription tiers with varying features:',
        title: '4.1 Subscription Tiers',
      },
      sub02: {
        body1: 'Paid subscriptions are billed in advance on a monthly or annual basis. On iOS, subscriptions and in-app purchases are processed through the Apple App Store (in-app purchase support is rolling out). On web and Android, payments are processed securely through Stripe. By subscribing, you authorize us to charge your payment method through the applicable platform.',
        body2: 'One-time purchases (such as Done-For-You styling setups) follow the same platform rules: App Store on iOS when available, otherwise Stripe on web.',
        title: '4.2 Billing',
      },
      sub03: {
        body: 'Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current billing period. You can manage your subscription through your account settings or the app store.',
        title: '4.3 Automatic Renewal',
      },
      sub04: {
        body: 'Refunds are handled according to the policies of the platform through which you subscribed (Apple App Store or Google Play Store). For direct purchases, refund requests may be considered on a case-by-case basis within 14 days of purchase.',
        title: '4.4 Refunds',
      },
      title: '4. Subscription Plans and Payments',
    },
    section05: {
      sub01: {
        body: 'You retain ownership of content you post ("User Content"). By posting content, you grant Dripn a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content in connection with the Service.',
        title: '5.1 Your Content',
      },
      sub02: {
        bullet1: 'Violate any law or infringe on third-party rights.',
        bullet2: 'Contain nudity, sexually explicit material, or adult content.',
        bullet3: 'Promote violence, hatred, discrimination, or harassment.',
        bullet4: 'Include spam, misleading information, or commercial solicitation.',
        bullet5: 'Impersonate others or misrepresent your identity.',
        bullet6: 'Contain malware, viruses, or harmful code.',
        intro: 'You agree that your content will not:',
        title: '5.2 Content Standards',
      },
      sub03: {
        body: 'We reserve the right to remove any content that violates these Terms or is otherwise objectionable, at our sole discretion and without prior notice.',
        title: '5.3 Content Moderation',
      },
      sub04: {
        body: 'Your content may be featured in curated style highlights, trend showcases, or "best of" compilations. We may overlay text, apply filters, or edit content for promotional purposes while maintaining the integrity of the original. You will be credited where reasonably practical. If you wish to opt out of promotional use, you may contact us at privacy@dripnapp.com to request removal from future promotional materials.',
        bullet1: 'Social media promotional posts.',
        bullet2: 'Marketing campaigns and advertisements.',
        bullet3: 'App Store and Google Play Store promotional materials.',
        bullet4: 'Website and blog content showcasing style examples.',
        intro: 'By posting photos on Dripn, you grant Dripn the right to use your content in promotional materials, including but not limited to:',
        title: '5.4 Promotional Use of Content',
      },
      title: '5. User Content',
    },
    section06: {
      bullet1: 'Use the Service for any unlawful purpose.',
      bullet2: 'Harass, bully, or intimidate other users.',
      bullet3: 'Attempt to gain unauthorized access to the Service or other accounts.',
      bullet4: 'Reverse engineer, decompile, or disassemble any part of the Service.',
      bullet5: 'Use automated systems or bots without our written consent.',
      bullet6: 'Collect user information without consent.',
      bullet7: 'Interfere with or disrupt the Service or servers.',
      bullet8: 'Circumvent security measures or usage limits.',
      intro: 'You agree not to:',
      title: '6. Acceptable Use',
    },
    section07: {
      sub01: {
        body: 'The Dripn name, logo, design, features, and all related intellectual property are owned by Dripn. You may not use, copy, or distribute our intellectual property without express written permission.',
        title: '7.1 Our Intellectual Property',
      },
      sub02: {
        body: 'We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for personal, non-commercial purposes in accordance with these Terms.',
        title: '7.2 License to Use',
      },
      sub03: {
        body: 'If you believe content on Dripn infringes your copyright, please contact us at copyright@dripnapp.com with the required information for a DMCA takedown notice.',
        title: '7.3 Copyright Claims',
      },
      title: '7. Intellectual Property',
    },
    section08: {
      bullet1: 'AI advice is for informational and entertainment purposes.',
      bullet2: 'Recommendations are suggestions, not professional styling services.',
      bullet3: 'You are responsible for your own fashion choices and purchases.',
      bullet4: 'AI recommendations may vary and are not guaranteed to be accurate.',
      intro: 'Dripn provides AI-powered fashion recommendations as a guide. You acknowledge that:',
      title: '8. AI Fashion Advice',
    },
    section09: {
      body: 'The Service may contain links to third-party websites, affiliate shopping links, or services. We are not responsible for the content, products, or services offered by third parties. Your interactions with third parties are solely between you and them.',
      title: '9. Third-Party Services',
    },
    section10: {
      body1: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
      body2: 'We do not warrant that the Service will be uninterrupted, error-free, or secure. We do not guarantee the accuracy, completeness, or usefulness of any content or recommendations.',
      title: '10. Disclaimer of Warranties',
    },
    section11: {
      body1: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, DRIPN AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.',
      body2: 'Our total liability for any claims arising from these Terms or your use of the Service shall not exceed the amount you paid to Dripn in the twelve (12) months preceding the claim.',
      title: '11. Limitation of Liability',
    },
    section12: {
      body: 'You agree to indemnify, defend, and hold harmless Dripn and its affiliates from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Service, your content, or your violation of these Terms.',
      title: '12. Indemnification',
    },
    section13: {
      sub01: {
        body: 'You may terminate your account at any time through the Settings menu or by contacting support. Account deletion requests will be processed within 30 days.',
        title: '13.1 Your Right to Terminate',
      },
      sub02: {
        body: 'We may suspend or terminate your account at our discretion, without prior notice, for violations of these Terms, harmful behavior, or for any other reason. Upon termination, your license to use the Service ends immediately.',
        title: '13.2 Our Right to Terminate',
      },
      title: '13. Termination',
    },
    section14: {
      body: 'We may modify these Terms at any time. Material changes will be notified through the app or via email. Your continued use of the Service after changes constitutes acceptance of the revised Terms.',
      title: '14. Changes to Terms',
    },
    section15: {
      body: 'These Terms are governed by the laws of England and Wales. Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration or in the courts of England and Wales, except where prohibited by local law.',
      title: '15. Governing Law and Disputes',
    },
    section16: {
      bullet1: 'Entire Agreement: These Terms, together with our Privacy Policy, constitute the entire agreement between you and Dripn.',
      bullet2: 'Severability: If any provision is found unenforceable, the remaining provisions remain in effect.',
      bullet3: 'Waiver: Our failure to enforce any right does not constitute a waiver of that right.',
      bullet4: 'Assignment: You may not assign these Terms without our consent. We may assign our rights freely.',
      title: '16. General Provisions',
    },
    section17: {
      emailLegal: 'Email: legal@dripnapp.com',
      emailSupport: 'Support: support@dripnapp.com',
      intro: 'If you have questions about these Terms, please contact us:',
      title: '17. Contact Us',
    },
    title: 'Terms of Service',
    welcome1: 'We believe in helping you make confident fashion decisions. These terms are designed to ensure you have a seamless, personalised styling experience.',
    welcome2: 'We have tried to make this document as clear and straightforward as possible. If anything is unclear, please reach out - we are always happy to explain.',
  },
  upgrade: {
    limitHit: {
      cta: 'Cta',
      message: 'Message',
      title: 'Title',
    },
    path: {
      benefitDigitization: 'Benefit Digitization',
      benefitPhotography: 'Benefit Photography',
      benefitRemix: 'Benefit Remix',
      benefitSwap: 'Benefit Swap',
      coreBenefitsTitle: 'Core Benefits Title',
      notNow: 'Not Now',
      requiresCore: 'Requires Core',
      stylistDefault: 'Stylist Default',
      stylistMax: 'Stylist Max',
      stylistRuby: 'Stylist Ruby',
      upgradeButton: 'Upgrade Button',
    },
  },
  visualSearch: {
    cameraAccessRequired: 'Camera Access Required',
    pleaseEnableCameraAccessInYourDeviceSett: 'Please enable camera access in your device settings to use visual search.',
    searchLimitReached: 'Search Limit Reached',
    youHaveUsedAllYourVisualSearchesThisMont: 'You have used all your visual searches this month. Upgrade your plan for more searches.',
  },
  voiceCredits: {
    balanceUpdated: 'Balance updated',
    buyTitle: 'Buy Voice Package',
    creditsAdded: 'Credits added',
    creditsAddedMessage: 'Your spoken replies have been added to your balance.',
    expires: 'Expires',
    loadingBalance: 'Loading balance…',
    mostPopular: 'Most Popular',
    needMore: 'Running low on spoken replies. Top up to keep talking with your stylist.',
    partialTranslationNote: 'Some labels may still appear in English.',
    purchaseFailed: 'Purchase failed',
    purchased: 'purchased',
    spokenReplies: 'spoken replies',
    spokenReply: 'spoken reply',
    thisMonth: 'this month',
    topUpApple: 'Top up with Apple',
    topUpStripe: 'Top up with Stripe',
    topUpVoiceReplies: 'Top up voice replies',
    unlimited48h: 'Unlimited for 48 hours',
    unlimited48hBadge: '48h Unlimited',
    voiceReplies: 'voice replies',
    weekendAddedMessage: '2-day unlimited is now active on your account.',
    weekendVoiceActive: '2-day unlimited active',
    languageUpdatedLocally: 'Language updated on this device. Will sync when online.',
    languageChangeFailed: 'Could not change language. Please try again.',
  },
  welcome: {
    alreadyHaveAccount: 'Already have an account? ',
    devLoginAsTestUser: 'Dev: Login as Test User',
    featureLookGoodDesc: 'No stress. No second-guessing.',
    featureLookGoodTitle: 'Look good every day',
    featureStopGuessingDesc: 'Get the right outfit — instantly.',
    featureStopGuessingTitle: 'Stop guessing what to wear',
    featureTalkStylistDesc: 'Natural voice chat. Like having someone there with you.',
    featureTalkStylistTitle: 'Just talk to your stylist',
    featureWardrobeDesc: 'Everything organised. Everything usable.',
    featureWardrobeTitle: 'Make your wardrobe work',
    getStyled: 'Get Styled',
    signIn: 'Sign In',
    tagline: 'we decide — you look better',
  },
};

export { UI_FULL_COVERAGE_LANGUAGES };

const LOCAL_TRANSLATIONS = LOCAL_TRANSLATION_BUNDLES;


class TranslationServiceClass {
  private translations: Translations = DEFAULT_TRANSLATIONS;
  private currentLang: string = 'en';
  private availableLanguages: Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }> = [];

  /** Flatten nested API payloads and keep dotted string keys as-is. */
  private normalizeToFlat(input: Record<string, any> | null | undefined): Record<string, string> {
    if (!input || typeof input !== 'object') return {};
    const result: Record<string, string> = {};
    for (const key of Object.keys(input)) {
      const val = input[key];
      if (typeof val === 'string') {
        result[key] = val;
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(result, this.flattenTranslations(val, key));
      }
    }
    return result;
  }

  private applyFlatTranslations(flat: Record<string, string>, langCode: string, direction?: 'ltr' | 'rtl'): Translations {
    const merged = this.mergeTranslations(flat, langCode);
    merged.localeInfo.direction = direction || resolveLocaleDirection(langCode);
    merged.localeInfo.language = resolveLocaleNativeName(langCode);
    this.translations = merged;
    this.currentLang = langCode;
    return merged;
  }

  async fetchCurrentLanguage(): Promise<Translations> {
    try {
      const response = await apiService.getCurrentLanguage();
      const langCode = response.languageCode;
      const localFlat = LOCAL_TRANSLATIONS[langCode] || {};
      // Local offline bundles win over API so nested English payloads cannot wipe UI chrome
      const backendFlat = this.normalizeToFlat(response.translations);
      const combined = { ...backendFlat, ...localFlat };
      const merged = this.applyFlatTranslations(combined, langCode, response.direction);
      await this.cacheTranslations(merged, langCode);
      return merged;
    } catch (error) {
      console.log('Failed to fetch current language:', error);
      return this.translations;
    }
  }

  async fetchTranslations(langCode: string): Promise<Translations> {
    const localFlat = LOCAL_TRANSLATIONS[langCode] || {};
    const hasLocal = Object.keys(localFlat).length > 0;

    // Full-coverage languages: apply local bundle immediately (no network gate)
    if (hasLocal) {
      const merged = this.applyFlatTranslations(localFlat, langCode);
      await this.cacheTranslations(merged, langCode);
      return merged;
    }

    if (langCode === 'en') {
      this.translations = DEFAULT_TRANSLATIONS;
      this.currentLang = 'en';
      await this.cacheTranslations(DEFAULT_TRANSLATIONS, 'en');
      return DEFAULT_TRANSLATIONS;
    }

    try {
      const response = await apiService.getTranslations(langCode);
      const backendFlat = this.normalizeToFlat(response.translations);
      const merged = this.applyFlatTranslations(backendFlat, langCode, response.direction);
      if (response.nativeName) {
        merged.localeInfo.language = response.nativeName;
      }
      await this.cacheTranslations(merged, langCode);
      return merged;
    } catch (error) {
      console.log('Translation fetch error, no local bundle available:', error);
      throw new Error(`No translations available for language: ${langCode}`);
    }
  }

  private mergeTranslations(backendTranslations: Record<string, any>, langCode: string): Translations {
    const isCorruptValue = (value: string) => {
      const v = value.trim();
      if (!v) return true;
      if (['h1', 'h2', 'h3', 'h4', 'react', 'body', 'small', 'caption'].includes(v)) return true;
      if (/^text:\s*['"]/.test(v)) return true;
      return false;
    };

    const flatToNested = (flat: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};
      // Longer keys first so parents that are also leaves keep their string value
      // when a conflicting nested key exists (e.g. settings.deleteAccount vs
      // settings.deleteAccount.appleBillingWarning).
      const keys = Object.keys(flat).sort((a, b) => b.length - a.length || a.localeCompare(b));
      for (const key of keys) {
        if (typeof flat[key] !== 'string') continue;
        if (isCorruptValue(flat[key])) continue;
        const parts = key.split('.');
        let current = result;
        let blocked = false;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (typeof current[part] === 'string') {
            // Parent is already a leaf string — skip this nested conflict key
            blocked = true;
            break;
          }
          if (typeof current[part] !== 'object' || current[part] === null) {
            current[part] = {};
          }
          current = current[part];
        }
        if (blocked) continue;
        const leaf = parts[parts.length - 1];
        // Prefer keeping an existing string leaf over overwriting with a later object path
        if (typeof current[leaf] === 'string') continue;
        // Don't let a short parent string (e.g. subscription.features = "Included Features")
        // wipe a nested tree already built from longer keys (subscription.features.personalStylist.*).
        if (
          typeof current[leaf] === 'object' &&
          current[leaf] !== null &&
          typeof flat[key] === 'string'
        ) {
          continue;
        }
        current[leaf] = flat[key];
      }
      return result;
    };

    const nested = flatToNested(this.normalizeToFlat(backendTranslations));

    const core: Record<string, any> = {
      locale: langCode,
      localeInfo: {
        direction: resolveLocaleDirection(langCode),
        locale: langCode,
        language: nested.localeInfo?.language || resolveLocaleNativeName(langCode),
      },
      common: { ...DEFAULT_TRANSLATIONS.common, ...nested.common },
      nav: { ...DEFAULT_TRANSLATIONS.nav, ...nested.nav },
      stylist: { ...DEFAULT_TRANSLATIONS.stylist, ...nested.stylist },
      wardrobe: { ...DEFAULT_TRANSLATIONS.wardrobe, ...nested.wardrobe },
      profile: { ...DEFAULT_TRANSLATIONS.profile, ...nested.profile },
      stylistHub: {
        ...DEFAULT_TRANSLATIONS.stylistHub,
        ...nested.stylistHub,
        personalStylist:
          nested.stylistHub?.personalStylist === 'Personal Stylist'
            ? DEFAULT_TRANSLATIONS.stylistHub.personalStylist
            : (nested.stylistHub?.personalStylist ?? DEFAULT_TRANSLATIONS.stylistHub.personalStylist),
        personalStylistDesc:
          nested.stylistHub?.personalStylistDesc ?? DEFAULT_TRANSLATIONS.stylistHub.personalStylistDesc,
      },
      bodyScan: { ...DEFAULT_TRANSLATIONS.bodyScan, ...nested.bodyScan },
      colorScan: { ...DEFAULT_TRANSLATIONS.colorScan, ...nested.colorScan },
      quiz: { ...DEFAULT_TRANSLATIONS.quiz, ...nested.quiz },
      onboarding: {
        ...DEFAULT_TRANSLATIONS.onboarding,
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
      settings: {
        ...DEFAULT_TRANSLATIONS.settings,
        ...nested.settings,
        // Guard against flat-key collisions turning deleteAccount into an object
        deleteAccount:
          typeof nested.settings?.deleteAccount === 'string'
            ? nested.settings.deleteAccount
            : DEFAULT_TRANSLATIONS.settings.deleteAccount,
      },
      home: { ...DEFAULT_TRANSLATIONS.home, ...nested.home },
      auth: { ...DEFAULT_TRANSLATIONS.auth, ...nested.auth },
      aiStylist: { ...DEFAULT_TRANSLATIONS.aiStylist, ...nested.aiStylist },
      support: {
        ...DEFAULT_TRANSLATIONS.support,
        ...nested.support,
        quickAction: {
          ...(DEFAULT_TRANSLATIONS.support as any).quickAction,
          ...nested.support?.quickAction,
        },
        ticketCategory: {
          ...(DEFAULT_TRANSLATIONS.support as any).ticketCategory,
          ...nested.support?.ticketCategory,
        },
      },
    };

    for (const key of Object.keys(nested)) {
      if (!(key in core) && nested[key] && typeof nested[key] === 'object') {
        const def = (DEFAULT_TRANSLATIONS as any)[key] || {};
        const fromNested = nested[key];
        if (key === 'dfy') {
          core[key] = {
            ...def,
            ...fromNested,
            lookbook: { ...(def.lookbook || {}), ...(fromNested.lookbook || {}) },
            comparison: { ...(def.comparison || {}), ...(fromNested.comparison || {}) },
            expiry: { ...(def.expiry || {}), ...(fromNested.expiry || {}) },
            start: { ...(def.start || {}), ...(fromNested.start || {}) },
          };
        } else if (key === 'subscription') {
          const nestedFeatures = fromNested.features;
          const defFeatures = def.features || {};
          core[key] = {
            ...def,
            ...fromNested,
            features:
              nestedFeatures && typeof nestedFeatures === 'object'
                ? {
                    ...defFeatures,
                    ...nestedFeatures,
                    free: { ...(defFeatures.free || {}), ...(nestedFeatures.free || {}) },
                    personalStylist: {
                      ...(defFeatures.personalStylist || {}),
                      ...(nestedFeatures.personalStylist || {}),
                    },
                    stylistUnlimited: {
                      ...(defFeatures.stylistUnlimited || {}),
                      ...(nestedFeatures.stylistUnlimited || {}),
                    },
                  }
                : defFeatures,
            plan: {
              ...(def.plan || {}),
              ...(fromNested.plan || {}),
              free: { ...(def.plan?.free || {}), ...(fromNested.plan?.free || {}) },
              personalStylist: {
                ...(def.plan?.personalStylist || {}),
                ...(fromNested.plan?.personalStylist || {}),
              },
              stylistUnlimited: {
                ...(def.plan?.stylistUnlimited || {}),
                ...(fromNested.plan?.stylistUnlimited || {}),
              },
            },
            dfy: {
              ...(def.dfy || {}),
              ...(fromNested.dfy || {}),
              included: {
                ...(def.dfy?.included || {}),
                ...(fromNested.dfy?.included || {}),
              },
              occasion: {
                ...(def.dfy?.occasion || {}),
                ...(fromNested.dfy?.occasion || {}),
              },
              wardrobe: {
                ...(def.dfy?.wardrobe || {}),
                ...(fromNested.dfy?.wardrobe || {}),
              },
            },
            cancel: {
              ...(def.cancel || {}),
              ...(fromNested.cancel || {}),
            },
            period: {
              ...(def.period || {}),
              ...(fromNested.period || {}),
            },
          };
        } else {
          core[key] = { ...def, ...fromNested };
        }
      }
    }

    for (const key of Object.keys(DEFAULT_TRANSLATIONS)) {
      if (!(key in core) && (DEFAULT_TRANSLATIONS as any)[key]) {
        const def = (DEFAULT_TRANSLATIONS as any)[key];
        const fromNested = nested[key] || {};
        if (key === 'dfy' && typeof def === 'object' && typeof fromNested === 'object') {
          core[key] = {
            ...def,
            ...fromNested,
            lookbook: {
              ...(def.lookbook || {}),
              ...(fromNested.lookbook || {}),
            },
            comparison: {
              ...(def.comparison || {}),
              ...(fromNested.comparison || {}),
            },
            expiry: {
              ...(def.expiry || {}),
              ...(fromNested.expiry || {}),
            },
            start: {
              ...(def.start || {}),
              ...(fromNested.start || {}),
            },
          };
        } else {
          core[key] = { ...def, ...fromNested };
        }
      }
    }

    return core as Translations;
  }

  async setLanguage(langCode: string): Promise<{ success: boolean; backendSaved: boolean }> {
    // Apply bundled (or network) translations first — must not depend on POST /api/language
    await this.fetchTranslations(langCode);
    const backendSaved = await this.persistLanguagePreference(langCode);
    return { success: true, backendSaved };
  }

  /** Persist preferred language for stylist chat; failures are non-fatal for UI chrome. */
  async persistLanguagePreference(langCode: string): Promise<boolean> {
    try {
      await apiService.setLanguage({ languageCode: langCode });
      return true;
    } catch (error) {
      console.log('Failed to persist language to backend (will use local):', error);
      return false;
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

    const localList = LOCAL_LANGUAGE_META.map((lang) => ({ ...lang }));
    const byCode = new Map(localList.map((lang) => [lang.code, lang]));

    try {
      const response = await apiService.getLanguages();
      for (const lang of response.languages || []) {
        if (!byCode.has(lang.code)) {
          byCode.set(lang.code, lang);
        }
      }
    } catch (error) {
      console.log('Failed to fetch available languages:', error);
    }

    this.availableLanguages = Array.from(byCode.values());
    return this.availableLanguages;
  }

  async loadCachedTranslations(): Promise<Translations> {
    try {
      const cachedLang = await AsyncStorage.getItem(TRANSLATIONS_LANG_KEY);
      const cached = await AsyncStorage.getItem(TRANSLATIONS_CACHE_KEY);

      if (cached && cachedLang) {
        const parsed = JSON.parse(cached);
        const localFlat = LOCAL_TRANSLATIONS[cachedLang] || {};
        if (Object.keys(localFlat).length > 0) {
          // Prefer bundled locale over possibly-stale/English-contaminated cache
          const merged = this.applyFlatTranslations(
            { ...this.flattenTranslations(parsed), ...localFlat },
            cachedLang,
            parsed?.localeInfo?.direction
          );
          return merged;
        }
        this.translations = parsed;
        this.currentLang = cachedLang;
        return this.translations;
      }

      if (cachedLang && cachedLang !== 'en' && LOCAL_TRANSLATIONS[cachedLang]) {
        return this.applyFlatTranslations(LOCAL_TRANSLATIONS[cachedLang], cachedLang);
      }
    } catch (error) {
      console.log('Failed to load cached translations:', error);
    }
    if (LOCAL_TRANSLATIONS.en && Object.keys(LOCAL_TRANSLATIONS.en).length) {
      return this.applyFlatTranslations(LOCAL_TRANSLATIONS.en, 'en');
    }
    return DEFAULT_TRANSLATIONS;
  }

  private flattenTranslations(obj: Record<string, any>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'string') {
        result[fullKey] = obj[key];
      } else if (obj[key] && typeof obj[key] === 'object') {
        Object.assign(result, this.flattenTranslations(obj[key], fullKey));
      }
    }
    return result;
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
