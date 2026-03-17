import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';

const TRANSLATIONS_CACHE_KEY = '@dripn_translations_v4';
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
    stylist: 'Stylist',
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
    screenTitle: 'Stylist',
    styleToolsTitle: 'Style Tools',
    styleToolsSubtitle: 'Your personal fashion assistant',
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
    customizeLayout: 'Long press any tile to customise your layout',
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
};

const LOCAL_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    'common.continue': 'Continuar', 'common.skip': 'Omitir', 'common.save': 'Guardar',
    'common.cancel': 'Cancelar', 'common.back': 'Atrás', 'common.next': 'Siguiente',
    'common.done': 'Hecho', 'common.loading': 'Cargando...', 'common.error': 'Error', 'common.retry': 'Reintentar',
    'nav.home': 'Inicio', 'nav.wardrobe': 'Armario', 'nav.chat': 'Chat', 'nav.profile': 'Perfil', 'nav.settings': 'Ajustes',
    'stylist.greeting': '¡Hola! ¿Cómo puedo ayudarte hoy?', 'stylist.thinking': 'Pensando...',
    'stylist.askMe': 'Pregúntame cualquier cosa sobre moda...', 'stylist.voiceChat': 'Chat de voz', 'stylist.personalStylist': 'Estilista personal',
    'wardrobe.addItem': 'Añadir prenda', 'wardrobe.empty': 'Tu armario está vacío', 'wardrobe.categories': 'Categorías',
    'wardrobe.favorites': 'Favoritos', 'wardrobe.allItems': 'Todas las prendas', 'wardrobe.outfitCalendar': 'Calendario de outfits',
    'wardrobe.myWardrobe': 'Mi armario', 'wardrobe.moreItemsNeeded': 'Se necesitan más prendas',
    'wardrobe.addItemsMessage': 'Añade al menos 3 prendas a tu armario para que la IA cree combinaciones de outfits.',
    'wardrobe.deleteItem': 'Eliminar prenda', 'wardrobe.deleteConfirm': '¿Estás seguro de que quieres eliminar esta prenda?',
    'wardrobe.markedAsWorn': 'Marcado como usado hoy', 'wardrobe.never': 'Nunca', 'wardrobe.bulkUpload': 'Carga masiva',
    'wardrobe.lastWorn': 'Último uso', 'wardrobe.wornTimes': 'veces', 'wardrobe.itemDetails': 'Detalles del artículo',
    'wardrobe.timesWorn': 'Veces usado', 'wardrobe.loadingWardrobe': 'Cargando tu armario...', 'wardrobe.myLookbook': 'Mi lookbook',
    'wardrobe.calendar14Day': 'Calendario 14 días', 'wardrobe.calendar30Day': 'Calendario 30 días',
    'wardrobe.modularWardrobe': 'Armario modular', 'wardrobe.aiOutfitCreator': 'Creador de outfits IA',
    'wardrobe.unlockDFY': 'Desbloquear configuración lista para usar', 'wardrobe.categoryAll': 'Todo',
    'wardrobe.categoryTops': 'Tops', 'wardrobe.categoryBottoms': 'Pantalones', 'wardrobe.categoryDresses': 'Vestidos',
    'wardrobe.categoryOuterwear': 'Ropa de abrigo', 'wardrobe.categoryShoes': 'Zapatos', 'wardrobe.categoryBags': 'Bolsos',
    'wardrobe.categoryAccessories': 'Accesorios', 'wardrobe.categoryActivewear': 'Deporte', 'wardrobe.categoryFormal': 'Formal',
    'profile.guestUser': 'Usuario invitado', 'profile.upgradeToPersonal': 'Mejorar a Estilista Personal',
    'profile.manageSubscription': 'Gestionar suscripción', 'profile.styleDna': 'ADN de estilo',
    'profile.styleDnaDesc': 'Tu perfil de estilo único', 'profile.colorAnalysis': 'Análisis de color',
    'profile.colorAnalysisDesc': 'Tus mejores colores', 'profile.bodyProfile': 'Perfil corporal',
    'profile.bodyProfileDesc': 'Tus medidas y talla', 'profile.likedOutfits': 'Outfits favoritos',
    'profile.noLikedOutfits': 'Aún no tienes outfits favoritos', 'profile.styleOfTheDay': 'Estilo del día',
    'profile.viewDetails': 'Ver detalles', 'profile.profile': 'Perfil', 'profile.adminDashboard': 'Panel de administración',
    'profile.yourStyleProfile': 'Tu perfil de estilo',
    'profile.styleProfileSubtitle': 'Esto nos ayuda a darte mejores sugerencias de outfits y enviar looks relevantes a tu comunidad de estilistas.',
    'profile.notCompleted': 'No completado',
    'profile.completeStyleProfile': 'Completa tu perfil de estilo para sugerencias personalizadas y mejores segundas opiniones de la comunidad.',
    'profile.savedOutfits': 'Outfits guardados', 'profile.similarOutfit': 'Outfit similar',
    'profile.loadingOutfits': 'Cargando outfits...', 'profile.noLikedOutfitsHint': 'Guarda outfits de las recomendaciones de tu estilista',
    'home.yourStory': 'Tu historia', 'home.global': 'Global', 'home.myRegion': 'Mi región',
    'home.noPostsYet': 'Sin publicaciones aún', 'home.beFirstToShare': 'Sé el primero en compartir tu estilo con la comunidad',
    'auth.createAccount': 'Crear cuenta', 'auth.welcomeBack': 'Bienvenido de vuelta', 'auth.joinCommunity': 'Únete a la comunidad Dripn',
    'auth.signInContinue': 'Inicia sesión para continuar tu viaje de estilo', 'auth.continueWithGoogle': 'Continuar con Google',
    'auth.continueWithFacebook': 'Continuar con Facebook', 'auth.continueWithApple': 'Continuar con Apple', 'auth.or': 'o',
    'auth.fullName': 'Nombre completo', 'auth.email': 'Correo electrónico', 'auth.password': 'Contraseña',
    'auth.enterName': 'Introduce tu nombre', 'auth.emailPlaceholder': 'tu.correo@ejemplo.com',
    'auth.enterPassword': 'Introduce tu contraseña', 'auth.alreadyHaveAccount': '¿Ya tienes cuenta? ',
    'auth.dontHaveAccount': '¿No tienes cuenta? ', 'auth.signIn': 'Iniciar sesión', 'auth.signUp': 'Registrarse',
    'auth.agreeTerms': 'Al continuar, aceptas nuestros', 'auth.termsOfService': 'Términos de servicio',
    'auth.and': 'y', 'auth.privacyPolicy': 'Política de privacidad',
    'auth.fillRequired': 'Por favor, completa todos los campos requeridos',
    'auth.enterYourName': 'Por favor, introduce tu nombre', 'auth.authFailed': 'Autenticación fallida. Por favor, inténtalo de nuevo.',
    'aiStylist.suggestedOutfit': 'Outfit sugerido', 'aiStylist.thanks': '¡Gracias!', 'aiStylist.noted': 'Anotado',
    'aiStylist.whatWasntRight': '¿Qué no estuvo bien?', 'aiStylist.learnPreferences': 'Esto ayuda a tu estilista a conocer tus preferencias',
    'aiStylist.skip': 'Omitir', 'aiStylist.quickSuggestions': 'Sugerencias rápidas', 'aiStylist.notMyStyle': 'No es mi estilo',
    'aiStylist.tooWestern': 'Demasiado occidental', 'aiStylist.didntFitBodyType': 'No se adapta a mi tipo de cuerpo',
    'aiStylist.culturalMismatch': 'No encaja culturalmente',
    'aiStylist.askStylistTitle': 'Pregunta al estilista', 'aiStylist.whatDecisionHelp': '¿En qué decisión puedo ayudarte?',
    'aiStylist.fashionRules': 'Reglas de moda', 'aiStylist.todayTip': 'Consejo del día',
    'aiStylist.oneDecisionDay': 'Una decisión al día, cortesía mía.',
    'aiStylist.decisionShopping': 'Elegir qué comprar', 'aiStylist.decisionShoppingDesc': 'Ayúdame a decidir entre opciones',
    'aiStylist.decisionWhatToWear': '¿Qué debería ponerme?', 'aiStylist.decisionWhatToWearDesc': 'Escoge mi outfit para hoy',
    'aiStylist.decisionEventOutfit': 'Outfit para un evento', 'aiStylist.decisionEventOutfitDesc': 'Algo específico que se avecina',
    'aiStylist.decisionSanityCheck': 'Revisión rápida', 'aiStylist.decisionSanityCheckDesc': 'Solo necesito una segunda opinión',
    'wardrobe.wardrobeAwaits': 'Tu armario te espera',
    'wardrobe.wardrobeAwaitsDesc': 'Empieza a construir tu armario digital añadiendo fotos de tus prendas favoritas',
    'wardrobe.quickAddMultiple': 'Añadir varios artículos rápido', 'wardrobe.addSingleItem': 'Añadir un artículo',
    'wardrobe.piece': 'prenda', 'wardrobe.pieces': 'prendas',
    'settings.title': 'Configuración', 'settings.account': 'Cuenta', 'settings.editProfile': 'Editar perfil',
    'settings.email': 'Correo electrónico', 'settings.subscription': 'Suscripción', 'settings.preferences': 'Preferencias',
    'settings.styleTheme': 'Tema de estilo', 'settings.colourScheme': 'Esquema de color',
    'settings.selectColourScheme': 'Esquema de color', 'settings.colorful': 'Colorido',
    'settings.colorfulDesc': 'Degradados vibrantes y colores llamativos', 'settings.minimalist': 'Minimalista',
    'settings.minimalistDesc': 'Tonos sutiles y discretos', 'settings.country': 'País', 'settings.notSet': 'No definido',
    'settings.bodyMeasurements': 'Medidas corporales', 'settings.trendingColors': 'Colores de tendencia',
    'settings.pantoneNotAvailable': 'Color Pantone del año no disponible', 'settings.usingBaseColors': 'Usando colores base del tema',
    'settings.checkForTrends': 'Buscar tendencias', 'settings.inviteFriends': 'Invitar amigos',
    'settings.shareYourCode': 'Comparte tu código',
    'settings.inviteDescription': 'Invita amigos y ambos obtienen 20 solicitudes de IA y 10% de descuento',
    'settings.notifications': 'Notificaciones', 'settings.communityVoting': 'Votación comunitaria',
    'settings.communityVotingDesc': 'Notificar cuando otros usuarios necesiten tu consejo de moda',
    'settings.priceAlerts': 'Alertas de precio', 'settings.priceAlertsDesc': 'Notificar cuando los artículos rastreados bajen de precio',
    'settings.voiceAndLanguage': 'Voz e idioma', 'settings.language': 'Idioma', 'settings.voiceSpeed': 'Velocidad de voz',
    'settings.autoPlayResponses': 'Reproducir respuestas automáticamente',
    'settings.autoPlayDescription': 'Reproducir voz automáticamente cuando el estilista responda',
    'settings.showTranscriptions': 'Mostrar transcripciones',
    'settings.showTranscriptionsDescription': 'Mostrar versión de texto de los mensajes de voz',
    'settings.support': 'Soporte', 'settings.helpCenter': 'Centro de ayuda', 'settings.helpAndFaq': 'Ayuda y preguntas frecuentes',
    'settings.helpSubtitle': 'Busca preguntas y chatea con Julia', 'settings.chatWithJulia': 'Chatear con Julia',
    'settings.chatWithJuliaSubtitle': 'Obtén soporte instantáneo de nuestra asistente',
    'settings.aiFeatureLab': 'Laboratorio de funciones IA', 'settings.aiFeatureLabSubtitle': 'Ver sugerencias de funciones generadas por IA',
    'settings.sendFeedback': 'Enviar comentarios', 'settings.sendFeedbackSubtitle': 'Reportar errores, solicitar funciones o compartir opiniones',
    'settings.termsOfService': 'Términos de servicio', 'settings.privacyPolicy': 'Política de privacidad',
    'settings.company': 'Empresa', 'settings.partnerWithUs': 'Asóciate con nosotros',
    'settings.partnerWithUsSubtitle': 'Consultas para estilistas y marcas', 'settings.accountActions': 'Acciones de cuenta',
    'settings.signOut': 'Cerrar sesión', 'settings.deleteAccount': 'Eliminar cuenta',
    'settings.selectLanguage': 'Seleccionar idioma', 'settings.voiceSettings': 'Ajustes de voz',
    'settings.slow': 'Lenta', 'settings.normal': 'Normal', 'settings.fast': 'Rápida', 'settings.logout': 'Cerrar sesión',
    'settings.contactUs': 'Contáctanos', 'settings.privacy': 'Privacidad', 'settings.about': 'Acerca de',
    'settings.currentPlan': 'Plan actual', 'settings.managePlan': 'Gestionar plan',
    'nav.stylist': 'Estilista',
    'stylistHub.screenTitle': 'Estilista', 'stylistHub.styleToolsTitle': 'Herramientas de estilo',
    'stylistHub.styleToolsSubtitle': 'Tu asistente de moda personal',
    'stylistHub.personalStylist': 'Estilista Personal', 'stylistHub.personalStylistDesc': 'Chatea con tu estilista IA',
    'stylistHub.voiceChat': 'Chat de voz', 'stylistHub.voiceChatDesc': 'Habla con Ruby o Max',
    'stylistHub.outfitCalendar': 'Calendario de outfits', 'stylistHub.outfitCalendarDesc': 'Planifica tus looks con antelación',
    'stylistHub.weatherOutfits': 'Outfits según el clima', 'stylistHub.weatherOutfitsDesc': 'Vístete según la previsión',
    'stylistHub.blog': 'Blog', 'stylistHub.blogDesc': 'Consejos y guías de moda',
    'stylistHub.styleRules': 'Reglas de estilo', 'stylistHub.styleRulesDesc': 'Tus pautas personales',
    'stylistHub.holdToRearrange': 'Mantén pulsado para reorganizar',
    'stylistHub.customizeLayout': 'Mantén pulsado cualquier ficha para personalizar tu diseño',
    'styleSelection.title': '¿Cuál es tu estilo?', 'styleSelection.subtitle': 'Elige la estética que te identifica',
    'styleSelection.styles.streetwear.name': 'Streetwear', 'styleSelection.styles.streetwear.description': 'Urbano, atrevido, tendencia',
    'styleSelection.styles.business.name': 'Negocios', 'styleSelection.styles.business.description': 'Trajes profesionales, camisas y ropa formal',
    'styleSelection.styles.athletic.name': 'Deportivo', 'styleSelection.styles.athletic.description': 'Activo, dinámico, atlético',
    'styleSelection.styles.boho.name': 'Boho', 'styleSelection.styles.boho.description': 'Terrenal, relajado, artístico',
    'styleSelection.styles.minimalist.name': 'Minimalista', 'styleSelection.styles.minimalist.description': 'Piezas simples y atemporales',
    'onboarding.searchCountries': 'Buscar países...', 'onboarding.noCountriesFound': 'No se encontraron países',
    'onboarding.detecting': 'Detectando...', 'onboarding.useMyLocation': 'Usar mi ubicación',
    'onboarding.quickSelect': 'Selección rápida', 'onboarding.allRegions': 'Todas las regiones',
    'onboarding.styleQuiz': 'Hacer el cuestionario de estilo',
    'onboarding.styleQuizDesc': '7 preguntas rápidas para descubrir tu arquetipo de estilo', 'onboarding.orChoose': 'o elige a continuación',
    'onboarding.steps.location.title': '¿Dónde te encuentras?',
    'onboarding.steps.location.description': 'Esto nos ayuda a personalizar tu experiencia con tendencias y tiendas locales.',
    'onboarding.steps.gender.title': '¿Cómo te identificas?',
    'onboarding.steps.gender.description': 'Esto nos ayuda a adaptar las recomendaciones de estilo para ti',
    'onboarding.gender.woman': 'Mujer', 'onboarding.gender.man': 'Hombre',
    'onboarding.gender.nonBinary': 'No binario', 'onboarding.gender.preferNotToSay': 'Prefiero no decirlo',
    'onboarding.steps.measurements.title': 'Tus medidas corporales',
    'onboarding.steps.measurements.description': 'Opcional, pero nos ayuda a encontrar tu talla perfecta',
    'onboarding.measurements.height': 'Altura', 'onboarding.measurements.weight': 'Peso',
    'onboarding.measurements.note': 'Esto nos ayuda a recomendar ropa que te quede perfectamente. Puedes omitir este paso si lo prefieres.',
    'onboarding.steps.stylist.title': 'Conoce a tu estilista personal',
    'onboarding.steps.stylist.description': 'Elige quién guiará tu viaje de moda',
    'onboarding.stylist.playingVoice': 'Reproduciendo vista previa de voz...',
    'onboarding.stylist.language': 'Idioma', 'onboarding.stylist.accent': 'Acento',
    'onboarding.quiz.question': 'Pregunta {current} de {total}', 'onboarding.quiz.previous': 'Anterior',
    'onboarding.quiz.next': 'Siguiente', 'onboarding.quiz.submit': 'Enviar',
    'onboarding.steps.undertone.title': '¿Cuál es el subtono de tu piel?',
    'onboarding.steps.undertone.description': 'Esto nos ayuda a recomendar colores que te complementen',
    'onboarding.undertone.findTip': 'Cómo encontrar tu subtono',
    'onboarding.undertone.veinInstruction': 'Mira las venas de tu muñeca interior bajo luz natural:',
    'onboarding.undertone.coolVeins': 'Venas azules o moradas = Subtono frío',
    'onboarding.undertone.warmVeins': 'Venas verdes = Subtono cálido',
    'onboarding.undertone.neutralVeins': 'Mezcla de ambos = Subtono neutro',
    'onboarding.undertone.explanation': 'Tu subtono afecta qué colores de ropa te hacen brillar o parecer apagado/a.',
    'onboarding.undertone.warm.name': 'Cálido', 'onboarding.undertone.warm.description': 'Subtonos amarillos, melocotón o dorados',
    'onboarding.undertone.cool.name': 'Frío', 'onboarding.undertone.cool.description': 'Subtonos rosados, rojos o azulados',
    'onboarding.undertone.neutral.name': 'Neutro', 'onboarding.undertone.neutral.description': 'Mezcla de cálido y frío',
    'onboarding.steps.fit.title': '¿Qué corte prefieres?', 'onboarding.steps.fit.description': '¿Cómo te gusta que te quede la ropa?',
    'onboarding.fit.fitted.name': 'Ceñido', 'onboarding.fit.fitted.description': 'Pegado al cuerpo, marca tu silueta',
    'onboarding.fit.tailored.name': 'Entallado', 'onboarding.fit.tailored.description': 'Estructurado, aspecto profesional',
    'onboarding.fit.relaxed.name': 'Relajado', 'onboarding.fit.relaxed.description': 'Cómodo, movimiento fácil',
    'onboarding.fit.oversize.name': 'Oversize', 'onboarding.fit.oversize.description': 'Holgado, de moda, con espacio extra',
    'onboarding.steps.sizes.title': '¿Cuáles son tus tallas?',
    'onboarding.steps.sizes.description': 'Introduce tu talla UK, US o EU (p.ej., M, L, UK 12, US 8)',
    'onboarding.sizes.topMale': 'Talla de camisa / camiseta', 'onboarding.sizes.topFemale': 'Talla de la parte de arriba',
    'onboarding.sizes.bottomMale': 'Talla de pantalón / cintura',
    'onboarding.sizes.bottomFemale': 'Talla de la parte de abajo (faldas, pantalones, vaqueros)',
    'onboarding.sizes.note': 'Esto nos ayuda a sugerir artículos en tu talla al comprar. Puedes actualizarlo en Ajustes.',
    'onboarding.steps.age.title': '¿Cuál es tu rango de edad?',
    'onboarding.steps.age.description': 'Nos ayuda a adaptar las recomendaciones de estilo',
    'onboarding.steps.shopping.title': '¿Con qué frecuencia compras?',
    'onboarding.steps.shopping.description': 'Tus hábitos de compra nos ayudan a adaptar las recomendaciones',
    'onboarding.shopping.weekly.name': 'Semanalmente', 'onboarding.shopping.weekly.description': 'Compro ropa cada semana',
    'onboarding.shopping.monthly.name': 'Mensualmente', 'onboarding.shopping.monthly.description': 'Varias veces al mes',
    'onboarding.shopping.seasonal.name': 'Por temporada', 'onboarding.shopping.seasonal.description': 'Cuando cambian las estaciones',
    'onboarding.shopping.rarely.name': 'Raramente', 'onboarding.shopping.rarely.description': 'Solo cuando realmente lo necesito',
    'onboarding.shopping.preferOnline': 'Prefiero las compras online',
    'onboarding.shopping.preferOnlineDesc': 'Prefiero comprar online en lugar de en tienda',
    'onboarding.steps.sustainability.title': '¿Te importa la sostenibilidad?',
    'onboarding.steps.sustainability.description': 'Dinos si la moda ecológica es importante para ti',
    'onboarding.sustainability.yes': 'Sí, es importante para mí',
    'onboarding.sustainability.yesDesc': 'Prefiero opciones de moda sostenible, ecológica y ética',
    'onboarding.sustainability.no': 'No es prioridad ahora mismo',
    'onboarding.sustainability.noDesc': 'Estoy abierto/a a todas las opciones de moda',
    'onboarding.steps.tellMore.title': 'Cuéntanos más (opcional)',
    'onboarding.steps.tellMore.description': 'Ayúdanos a personalizar tus recomendaciones',
    'onboarding.tellMore.bodyShape': 'Tipo de cuerpo',
    'onboarding.tellMore.confidentAreas': 'Zonas con las que te sientes a gusto',
    'onboarding.tellMore.confidentAreasDesc': 'Selecciona todas las que apliquen — los estilistas las destacarán',
    'onboarding.tellMore.minimizeAreas': 'Zonas a disimular',
    'onboarding.tellMore.minimizeAreasDesc': 'Los estilistas sugerirán opciones que te favorezcan',
    'onboarding.tellMore.happyWithEverything': '¡Estoy a gusto con todo!',
    'onboarding.tellMore.budget': 'Presupuesto', 'onboarding.tellMore.favoriteColors': 'Colores favoritos',
    'onboarding.tellMore.favoriteColorsDesc': 'Selecciona los colores que te encanta llevar',
    'onboarding.tellMore.colorsToAvoid': 'Colores a evitar',
    'onboarding.tellMore.colorsToAvoidDesc': 'Los estilistas los omitirán en las recomendaciones',
    'onboarding.tellMore.openToAllColors': '¡Acepto todos los colores!',
    'onboarding.tellMore.bodyScan': 'Escaneo corporal IA', 'onboarding.tellMore.bodyScanComplete': 'Escaneo corporal completo',
    'onboarding.tellMore.bodyScanDesc': 'Hazte una foto para detectar tu tipo de cuerpo',
    'onboarding.tellMore.colorAnalysis': 'Análisis de color IA', 'onboarding.tellMore.colorAnalysisComplete': 'Análisis de color completo',
    'onboarding.tellMore.colorAnalysisDesc': 'Un selfie para encontrar tus mejores colores', 'onboarding.tellMore.analyzing': 'Analizando...',
    'onboarding.steps.retailers.title': '¿Dónde compras?',
    'onboarding.steps.retailers.descriptionPersonalized': 'Selecciona hasta 10 de tus favoritas',
    'onboarding.steps.retailers.descriptionGeneral': 'Selecciona hasta 10 tiendas que te gusten (ayuda a la IA a personalizar recomendaciones)',
    'onboarding.retailers.searchPlaceholder': 'Buscar o añadir una tienda...', 'onboarding.retailers.add': 'Añadir',
    'onboarding.retailers.selected': 'Seleccionadas ({count}/10)', 'onboarding.retailers.maxSelected': 'Máximo 10 tiendas seleccionadas',
    'onboarding.retailers.findingStores': 'Buscando tiendas en {country}...',
    'onboarding.retailers.aiCurated': 'Tiendas seleccionadas por IA que envían o tienen tienda en {country}',
    'onboarding.steps.goals.title': '¿Por qué has venido a Dripn?',
    'onboarding.steps.goals.description': 'Elige hasta 3 objetivos (ayuda a la IA a entender tus necesidades)',
    'onboarding.goals.maxSelected': 'Máximo 3 objetivos seleccionados',
    'onboarding.goals.dressBetter.name': 'Vestir mejor', 'onboarding.goals.dressBetter.description': 'Mejorar mi estilo y apariencia en general',
    'onboarding.goals.getInspired.name': 'Inspirarme', 'onboarding.goals.getInspired.description': 'Encontrar nuevas ideas de outfits e inspiración de estilo',
    'onboarding.goals.buildWardrobe.name': 'Construir mi armario', 'onboarding.goals.buildWardrobe.description': 'Crear un armario versátil y cohesionado',
    'onboarding.goals.specialEvents.name': 'Eventos especiales', 'onboarding.goals.specialEvents.description': 'Lucir increíble en fiestas, citas y ocasiones',
    'onboarding.goals.professionalImage.name': 'Imagen profesional', 'onboarding.goals.professionalImage.description': 'Elevar mi estilo laboral y profesional',
    'onboarding.steps.cultural.title': 'Preferencias de estilo y cultura',
    'onboarding.steps.cultural.descriptionMale': 'Ayuda a Ruby y Max a entender tus límites de estilo (opcional)',
    'onboarding.steps.cultural.descriptionFemale': 'Ayuda a Ruby y Max a respetar tus preferencias de estilo y cultura (opcional)',
    'onboarding.cultural.religiousDressCode': 'Código de vestimenta religioso/modesto',
    'onboarding.cultural.subcultureTitle': 'Estilos de subcultura', 'onboarding.cultural.subcultureDesc': 'Selecciona si te identificas con alguno (opcional)',
    'onboarding.cultural.strictnessTitle': '¿Con qué rigor sigues este código?', 'onboarding.cultural.strictness.question': '¿Con qué rigor sigues este código?',
    'onboarding.cultural.strictness.flexible': 'Flexible', 'onboarding.cultural.strictness.flexibleDesc': 'Orientación general, excepciones ocasionales',
    'onboarding.cultural.strictness.moderate': 'Moderado', 'onboarding.cultural.strictness.moderateDesc': 'Seguir las pautas con algo de flexibilidad',
    'onboarding.cultural.strictness.strict': 'Estricto', 'onboarding.cultural.strictness.strictDesc': 'Seguir siempre el código de vestimenta',
    'onboarding.cultural.aiResearch': 'Nuestra IA investigará esto para darte el mejor consejo de moda respetuoso con tu cultura.',
    'onboarding.cultural.notes': 'Notas adicionales', 'onboarding.cultural.notesPlaceholder': 'Cuéntanos sobre tu código de vestimenta o preferencias culturales...',
    'onboarding.bodyShape.hourglass': 'Reloj de arena', 'onboarding.bodyShape.hourglassDesc': 'Hombros y caderas equilibrados, cintura definida',
    'onboarding.bodyShape.pear': 'Pera', 'onboarding.bodyShape.pearDesc': 'Caderas más anchas que los hombros',
    'onboarding.bodyShape.apple': 'Manzana', 'onboarding.bodyShape.appleDesc': 'Zona media más amplia, piernas más delgadas',
    'onboarding.bodyShape.rectangle': 'Rectángulo', 'onboarding.bodyShape.rectangleDesc': 'Medidas similares en todo el cuerpo',
    'onboarding.bodyShape.athletic': 'Atlético', 'onboarding.bodyShape.athleticDesc': 'Hombros más anchos, músculos definidos',
    'onboarding.bodyShape.trapezoid': 'Trapezoide', 'onboarding.bodyShape.trapezoidDesc': 'Hombros más anchos, cintura más estrecha',
    'onboarding.bodyShape.invertedTriangle': 'Triángulo invertido', 'onboarding.bodyShape.invertedTriangleDesc': 'Hombros anchos, caderas estrechas',
    'onboarding.bodyShape.oval': 'Oval', 'onboarding.bodyShape.ovalDesc': 'Zona media más amplia',
  },
  fr: {
    'common.continue': 'Continuer', 'common.skip': 'Passer', 'common.save': 'Sauvegarder',
    'common.cancel': 'Annuler', 'common.back': 'Retour', 'common.next': 'Suivant',
    'common.done': 'Terminé', 'common.loading': 'Chargement...', 'common.error': 'Erreur', 'common.retry': 'Réessayer',
    'nav.home': 'Accueil', 'nav.wardrobe': 'Garde-robe', 'nav.chat': 'Chat', 'nav.profile': 'Profil', 'nav.settings': 'Paramètres',
    'stylist.greeting': "Bonjour! Comment puis-je vous aider aujourd'hui?", 'stylist.thinking': 'Je réfléchis...',
    'stylist.askMe': "Posez-moi n'importe quelle question sur la mode...",
    'settings.language': 'Langue', 'settings.voiceAndLanguage': 'Voix et langue', 'settings.subscription': 'Abonnement', 'settings.logout': 'Déconnexion',
  },
  de: {
    'common.continue': 'Weiter', 'common.skip': 'Überspringen', 'common.save': 'Speichern',
    'common.cancel': 'Abbrechen', 'common.back': 'Zurück', 'common.next': 'Weiter', 'common.done': 'Fertig',
    'nav.home': 'Startseite', 'nav.wardrobe': 'Kleiderschrank', 'nav.chat': 'Chat', 'nav.profile': 'Profil', 'nav.settings': 'Einstellungen',
    'settings.language': 'Sprache', 'settings.subscription': 'Abonnement', 'settings.logout': 'Abmelden',
  },
};

class TranslationServiceClass {
  private translations: Translations = DEFAULT_TRANSLATIONS;
  private currentLang: string = 'en';
  private availableLanguages: Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }> = [];

  async fetchCurrentLanguage(): Promise<Translations> {
    try {
      const response = await apiService.getCurrentLanguage();
      const langCode = response.languageCode;
      const localFlat = LOCAL_TRANSLATIONS[langCode] || {};
      const combined = { ...localFlat, ...response.translations };
      const merged = this.mergeTranslations(combined, langCode);
      merged.localeInfo.direction = response.direction;
      
      this.translations = merged;
      this.currentLang = langCode;
      await this.cacheTranslations(merged, langCode);
      
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

    const localFlat = LOCAL_TRANSLATIONS[langCode] || {};

    try {
      const response = await apiService.getTranslations(langCode);
      const combined = { ...localFlat, ...response.translations };
      const merged = this.mergeTranslations(combined, langCode);
      merged.localeInfo.direction = response.direction;
      merged.localeInfo.language = response.nativeName;
      
      this.translations = merged;
      this.currentLang = langCode;
      await this.cacheTranslations(merged, langCode);
      
      return merged;
    } catch (error) {
      console.log('Translation fetch error, using local bundle:', error);
      const merged = this.mergeTranslations(localFlat, langCode);
      this.translations = merged;
      this.currentLang = langCode;
      return merged;
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
        const parsed = JSON.parse(cached);
        if (cachedLang !== 'en') {
          const localFlat = LOCAL_TRANSLATIONS[cachedLang] || {};
          const merged = this.mergeTranslations({ ...localFlat, ...this.flattenTranslations(parsed) }, cachedLang);
          this.translations = merged;
        } else {
          this.translations = parsed;
        }
        this.currentLang = cachedLang;
        return this.translations;
      }
      
      if (cachedLang && cachedLang !== 'en' && LOCAL_TRANSLATIONS[cachedLang]) {
        const merged = this.mergeTranslations(LOCAL_TRANSLATIONS[cachedLang], cachedLang);
        this.translations = merged;
        this.currentLang = cachedLang;
        return merged;
      }
    } catch (error) {
      console.log('Failed to load cached translations:', error);
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
