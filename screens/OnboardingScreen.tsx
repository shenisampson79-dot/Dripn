import React, { useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, Pressable, ScrollView, Image, ImageSourcePropType, ActivityIndicator, Platform, TextInput, Alert, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { AudioModule } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange, Gender, StylistId, VoicePitch, StylistPreferences, DripnGoal } from "@/contexts/AuthContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { STYLISTS, STYLIST_LANGUAGES, STYLIST_ACCENTS, getAllStylists, getDefaultVoiceForStylist, getAccentsForLanguage } from "@/services/PersonalStylistService";
import { playVoicePreview as playOpenAIVoice, stopAudio } from "@/services/OpenAITTSService";
import { NamePronunciationPrompt } from "@/components/NamePronunciationPrompt";
import { RetailerService, Retailer } from "@/services/RetailerService";
import { OnboardingService, BodyScanResult, ColorScanResult, StyleQuizQuestion, StyleQuizResult, StyleArchetype } from "@/services/OnboardingService";

const GENDER_OPTIONS: { id: Gender; name: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "woman", name: "Woman", icon: "user" },
  { id: "man", name: "Man", icon: "user" },
  { id: "non-binary", name: "Non-Binary", icon: "users" },
  { id: "prefer-not-to-say", name: "Prefer not to say", icon: "user-x" },
];

const WOMEN_BODY_SHAPES: { id: BodyShape; name: string; description: string }[] = [
  { id: "Hourglass", name: "Hourglass", description: "Balanced shoulders and hips, defined waist" },
  { id: "Pear", name: "Pear", description: "Hips wider than shoulders" },
  { id: "Apple", name: "Apple", description: "Fuller midsection, slimmer legs" },
  { id: "Rectangle", name: "Rectangle", description: "Similar measurements throughout" },
  { id: "Athletic", name: "Athletic", description: "Broader shoulders, defined muscles" },
];

const MEN_BODY_SHAPES: { id: BodyShape; name: string; description: string }[] = [
  { id: "Rectangle", name: "Rectangle", description: "Shoulders, waist, and hips similar width" },
  { id: "Trapezoid", name: "Trapezoid", description: "Broader shoulders, narrower waist" },
  { id: "Inverted Triangle", name: "Inverted Triangle", description: "Wide shoulders, narrow hips" },
  { id: "Oval", name: "Oval", description: "Fuller midsection" },
  { id: "Athletic", name: "Athletic", description: "Muscular build, defined physique" },
];

const STYLE_IMAGES: Record<'luxury', ImageSourcePropType> = {
  luxury: require("../assets/images/styles/luxury.png"),
};

const EDGY_FEMALE_IMAGE: ImageSourcePropType = require("../assets/images/styles/edgy/female/default.png");
const EDGY_MALE_IMAGE: ImageSourcePropType = require("../assets/images/styles/edgy/male/default.png");

const STREETWEAR_FEMALE_IMAGE: ImageSourcePropType = require("../assets/images/styles/streetwear/female/default.png");
const STREETWEAR_MALE_IMAGE: ImageSourcePropType = require("../assets/images/styles/streetwear/male/default.png");

type RegionalType = 'multicultural' | 'nordic' | 'asian' | 'african' | 'middle-eastern' | 'south-asian' | 'latin-american';

const SMART_CASUAL_FEMALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/smart-casual/female/multicultural.png"),
  'nordic': require("../assets/images/styles/smart-casual/female/nordic.png"),
  'asian': require("../assets/images/styles/smart-casual/female/asian.png"),
  'african': require("../assets/images/styles/smart-casual/female/african.png"),
  'middle-eastern': require("../assets/images/styles/smart-casual/female/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/smart-casual/female/south-asian.png"),
  'latin-american': require("../assets/images/styles/smart-casual/female/latin-american.png"),
};

const SMART_CASUAL_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/smart-casual/male/multicultural.png"),
  'nordic': require("../assets/images/styles/smart-casual/male/nordic.png"),
  'asian': require("../assets/images/styles/smart-casual/male/asian.png"),
  'african': require("../assets/images/styles/smart-casual/male/african.png"),
  'middle-eastern': require("../assets/images/styles/smart-casual/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/smart-casual/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/smart-casual/male/latin-american.png"),
};

const BOHO_FEMALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/boho/female/multicultural.png"),
  'nordic': require("../assets/images/styles/boho/female/nordic.png"),
  'asian': require("../assets/images/styles/boho/female/asian.png"),
  'african': require("../assets/images/styles/boho/female/african.png"),
  'middle-eastern': require("../assets/images/styles/boho/female/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/boho/female/south-asian.png"),
  'latin-american': require("../assets/images/styles/boho/female/latin-american.png"),
};

const BOHO_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/boho/male/multicultural.png"),
  'nordic': require("../assets/images/styles/boho/male/nordic.png"),
  'asian': require("../assets/images/styles/boho/male/asian.png"),
  'african': require("../assets/images/styles/boho/male/african.png"),
  'middle-eastern': require("../assets/images/styles/boho/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/boho/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/boho/male/latin-american.png"),
};

const SPORTY_FEMALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/sporty/female/multicultural.png"),
  'nordic': require("../assets/images/styles/sporty/female/nordic.png"),
  'asian': require("../assets/images/styles/sporty/female/asian.png"),
  'african': require("../assets/images/styles/sporty/female/african.png"),
  'middle-eastern': require("../assets/images/styles/sporty/female/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/sporty/female/south-asian.png"),
  'latin-american': require("../assets/images/styles/sporty/female/latin-american.png"),
};

const SPORTY_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/sporty/male/multicultural.png"),
  'nordic': require("../assets/images/styles/sporty/male/nordic.png"),
  'asian': require("../assets/images/styles/sporty/male/asian.png"),
  'african': require("../assets/images/styles/sporty/male/african.png"),
  'middle-eastern': require("../assets/images/styles/sporty/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/sporty/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/sporty/male/latin-american.png"),
};

const BUSINESS_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/business/male/multicultural.png"),
  'nordic': require("../assets/images/styles/business/male/nordic.png"),
  'asian': require("../assets/images/styles/business/male/asian.png"),
  'african': require("../assets/images/styles/business/male/african.png"),
  'middle-eastern': require("../assets/images/styles/business/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/business/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/business/male/latin-american.png"),
};

const getGenderSpecificBohoImage = (region: RegionalType, gender: Gender): ImageSourcePropType => {
  if (gender === 'man') return BOHO_MALE_IMAGES[region];
  return BOHO_FEMALE_IMAGES[region];
};

const getGenderSpecificSportyImage = (region: RegionalType, gender: Gender): ImageSourcePropType => {
  if (gender === 'man') return SPORTY_MALE_IMAGES[region];
  return SPORTY_FEMALE_IMAGES[region];
};

const getGenderSpecificBusinessImage = (region: RegionalType): ImageSourcePropType => {
  return BUSINESS_MALE_IMAGES[region];
};

const getSmartCasualImage = (region: RegionalType, gender: Gender): ImageSourcePropType => {
  if (gender === 'man') return SMART_CASUAL_MALE_IMAGES[region];
  return SMART_CASUAL_FEMALE_IMAGES[region];
};

const getRegionFromCountry = (country: string): RegionalType => {
  const nordicEasternEuropeanCountries = [
    'Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark',
    'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Czech Republic', 'Slovakia',
    'Hungary', 'Romania', 'Bulgaria', 'Russia', 'Ukraine', 'Belarus', 'Moldova'
  ];
  const multiculturalCountries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand',
    'Germany', 'France', 'Italy', 'Spain', 'Portugal', 'Netherlands',
    'Belgium', 'Switzerland', 'Austria', 'Ireland', 'Greece',
    'Croatia', 'Serbia', 'Slovenia', 'Luxembourg', 'Malta', 'Cyprus', 
    'Albania', 'Montenegro', 'North Macedonia', 'Bosnia and Herzegovina', 
    'Andorra', 'Armenia', 'Azerbaijan', 'Georgia', 'Kazakhstan', 'Kosovo'
  ];
  const asianCountries = [
    'Japan', 'South Korea', 'China', 'Taiwan', 'Hong Kong', 'Singapore', 'Thailand',
    'Vietnam', 'Malaysia', 'Indonesia', 'Philippines', 'Myanmar', 'Cambodia', 'Laos'
  ];
  const southAsianCountries = ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives'];
  const africanCountries = [
    'Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Ethiopia', 'Egypt', 'Morocco',
    'Tanzania', 'Uganda', 'Senegal', 'Cameroon', 'Ivory Coast', 'Algeria', 'Tunisia',
    'Zimbabwe', 'Zambia', 'Rwanda', 'Angola', 'Mozambique', 'Madagascar'
  ];
  const middleEasternCountries = [
    'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
    'Jordan', 'Lebanon', 'Israel', 'Turkey', 'Iran', 'Iraq', 'Yemen', 'Syria'
  ];
  const latinAmericanCountries = [
    'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela',
    'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Costa Rica', 'Panama',
    'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Dominican Republic',
    'Jamaica', 'Cuba', 'Puerto Rico', 'Haiti', 'Trinidad and Tobago', 'Barbados',
    'Bahamas', 'Belize', 'Guyana', 'Suriname'
  ];

  if (nordicEasternEuropeanCountries.includes(country)) return 'nordic';
  if (multiculturalCountries.includes(country)) return 'multicultural';
  if (asianCountries.includes(country)) return 'asian';
  if (southAsianCountries.includes(country)) return 'south-asian';
  if (africanCountries.includes(country)) return 'african';
  if (middleEasternCountries.includes(country)) return 'middle-eastern';
  if (latinAmericanCountries.includes(country)) return 'latin-american';

  return 'multicultural';
};

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Onboarding">;
};

const STYLE_OPTIONS_FEMALE: { id: StyleTheme; name: string; description: string }[] = [
  { id: "luxury", name: "Formal", description: "Elegant, refined, timeless pieces" },
  { id: "streetwear", name: "Casual", description: "Relaxed, comfortable, everyday style" },
  { id: "boho", name: "Boho", description: "Earthy, relaxed, artistic" },
  { id: "sporty", name: "Sporty", description: "Active, dynamic, athletic" },
  { id: "smart-casual", name: "Smart Casual", description: "Polished yet relaxed, tailored pieces for office to after-work drinks" },
  { id: "edgy", name: "Edgy", description: "Bold, alternative, dramatic" },
];

const STYLE_OPTIONS_MALE: { id: StyleTheme; name: string; description: string }[] = [
  { id: "smart-casual", name: "Smart Casual", description: "Polished yet relaxed, chinos with button-downs or knitwear, loafers" },
  { id: "streetwear", name: "Casual", description: "Relaxed, comfortable, everyday style" },
  { id: "boho", name: "Boho", description: "Earthy, relaxed, artistic" },
  { id: "sporty", name: "Sporty", description: "Active, dynamic, athletic" },
  { id: "business", name: "Business", description: "Professional suits, shirts, and formal wear" },
  { id: "edgy", name: "Edgy", description: "Bold, alternative, dramatic" },
];

const SIZE_OPTIONS: SizeRange[] = ["XS-S", "M-L", "XL-2X", "3X+"];

const BUDGET_OPTIONS: { id: BudgetRange; name: string }[] = [
  { id: "Budget", name: "Budget-Friendly" },
  { id: "Mid-Range", name: "Mid-Range" },
  { id: "Premium", name: "Premium" },
  { id: "Luxury", name: "Luxury" },
];

const POPULAR_SHOPS = [
  "Adidas", "Amazon Fashion", "Anthropologie", "ASOS", "Athleta",
  "Banana Republic", "Bloomingdale's", "Burberry",
  "Calvin Klein", "Chanel", "Coach", "COS",
  "Dior",
  "Everlane",
  "Farfetch", "Forever 21", "Free People",
  "Gap", "Gucci",
  "H&M",
  "J.Crew",
  "Kate Spade",
  "Louis Vuitton", "Lululemon",
  "Macy's", "Mango", "Massimo Dutti", "Michael Kors",
  "Neiman Marcus", "Net-a-Porter", "Nike", "Nordstrom",
  "Patagonia", "Prada", "Primark",
  "Ralph Lauren", "REI", "Reformation", "Revolve",
  "Saks Fifth Avenue", "Shein", "Shopbop",
  "Target", "The North Face", "TK Maxx", "Tommy Hilfiger", "Topshop", "Tory Burch",
  "Uniqlo", "Urban Outfitters",
  "Walmart",
  "Zara",
];

const DRIPN_GOALS: { id: DripnGoal; name: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { id: "dress-better", name: "Dress Better", icon: "star", description: "Improve my overall style and appearance" },
  { id: "meet-people", name: "Meet People", icon: "users", description: "Connect with fashion-minded individuals" },
  { id: "find-offers", name: "Find Deals", icon: "tag", description: "Discover great fashion bargains and sales" },
  { id: "get-inspired", name: "Get Inspired", icon: "eye", description: "Find new outfit ideas and style inspiration" },
  { id: "build-wardrobe", name: "Build Wardrobe", icon: "grid", description: "Create a versatile and cohesive wardrobe" },
  { id: "special-events", name: "Special Events", icon: "calendar", description: "Look amazing for parties, dates, and occasions" },
  { id: "professional-image", name: "Professional Image", icon: "briefcase", description: "Elevate my work and career style" },
];

const QUICK_SELECT_COUNTRIES = [
  "United States",
  "United Kingdom", 
  "Canada",
  "Australia",
  "Germany",
  "France",
  "India",
  "Japan",
];

const COUNTRY_REGIONS: Record<string, string[]> = {
  "Americas": [
    "Antigua and Barbuda", "Argentina", "Bahamas", "Barbados", "Belize", "Bolivia", "Brazil",
    "Canada", "Cayman Islands", "Chile", "Colombia", "Costa Rica", "Cuba", "Curacao",
    "Dominica", "Dominican Republic", "Ecuador", "El Salvador", "Grenada", "Guatemala",
    "Guyana", "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Paraguay",
    "Peru", "Puerto Rico", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
    "Suriname", "Trinidad and Tobago", "Turks and Caicos Islands", "United States", "Uruguay",
    "US Virgin Islands", "Venezuela"
  ],
  "Europe": [
    "Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium",
    "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark",
    "Estonia", "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland",
    "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
    "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway",
    "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City"
  ],
  "Asia & Pacific": [
    "Australia", "Bangladesh", "China", "India", "Indonesia", "Japan", "Kazakhstan",
    "Malaysia", "New Zealand", "Pakistan", "Philippines", "Singapore", "South Korea",
    "Taiwan", "Thailand", "Vietnam"
  ],
  "Middle East & Africa": [
    "Botswana", "Egypt", "Ethiopia", "Ghana", "Israel", "Kenya", "Mauritius", "Morocco",
    "Namibia", "Nigeria", "Saudi Arabia", "South Africa", "Turkey", "United Arab Emirates",
    "Zimbabwe"
  ],
};

const ALL_COUNTRIES = [
  "Albania",
  "Andorra",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Bulgaria",
  "Canada",
  "Cayman Islands",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Curacao",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Estonia",
  "Ethiopia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Kazakhstan",
  "Kenya",
  "Kosovo",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Malta",
  "Mauritius",
  "Mexico",
  "Moldova",
  "Monaco",
  "Montenegro",
  "Morocco",
  "Namibia",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Pakistan",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Romania",
  "Russia",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "San Marino",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Thailand",
  "Trinidad and Tobago",
  "Turkey",
  "Turks and Caicos Islands",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "US Virgin Islands",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Zimbabwe",
];

// Module-level flag to persist across component remounts in the same app session
let hasPromptedForPronunciationThisSession = false;

export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { completeOnboarding, user } = useAuth();
  
  // Get user's first name for personalized greetings
  const userFirstName = user?.name?.split(' ')[0] || undefined;

  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("");
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>(null);
  const [stylePreference, setStylePreference] = useState<StyleTheme>("luxury");
  const [sizeRange, setSizeRange] = useState<SizeRange>(null);
  const [bodyShape, setBodyShape] = useState<BodyShape>(null);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(null);
  const [selectedStylistId, setSelectedStylistId] = useState<StylistId>(null);
  const [stylistLanguage, setStylistLanguage] = useState<string>("English");
  const [stylistAccent, setStylistAccent] = useState<string>("American");
  const [voicePitch, setVoicePitch] = useState<VoicePitch>("mezzo-soprano");
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const [favoriteShops, setFavoriteShops] = useState<string[]>([]);
  const [usageGoals, setUsageGoals] = useState<DripnGoal[]>([]);
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [suggestedRetailers, setSuggestedRetailers] = useState<Retailer[]>([]);
  const [loadingRetailers, setLoadingRetailers] = useState(false);
  const [isBodyScanning, setIsBodyScanning] = useState(false);
  const [bodyScanResult, setBodyScanResult] = useState<BodyScanResult | null>(null);
  const [isColorScanning, setIsColorScanning] = useState(false);
  const [colorScanResult, setColorScanResult] = useState<ColorScanResult | null>(null);
  const [showStyleQuiz, setShowStyleQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<StyleQuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<StyleQuizResult | null>(null);
  const [showPronunciationPrompt, setShowPronunciationPrompt] = useState(false);
  // Initialize from user's stored preferences, or use defaults
  const [useNameInGreetings, setUseNameInGreetings] = useState(
    user?.stylistPreferences?.useNameInGreetings ?? true
  );
  const [namePronunciationConfirmed, setNamePronunciationConfirmed] = useState(
    user?.stylistPreferences?.namePronunciationConfirmed ?? false
  );

  // Sync local state when user's stylist preferences change (e.g., after profile loads or updates)
  useEffect(() => {
    if (user?.stylistPreferences) {
      setUseNameInGreetings(user.stylistPreferences.useNameInGreetings ?? true);
      setNamePronunciationConfirmed(user.stylistPreferences.namePronunciationConfirmed ?? false);
    }
  }, [user?.stylistPreferences?.useNameInGreetings, user?.stylistPreferences?.namePronunciationConfirmed]);

  const totalSteps = 7;
  
  const suggestedShopNames = suggestedRetailers.map(r => r.name);
  const allAvailableShops = suggestedRetailers.length > 0 
    ? [...new Set([...suggestedShopNames, ...POPULAR_SHOPS])]
    : POPULAR_SHOPS;
  
  const filteredShops = allAvailableShops.filter(
    shop => shop.toLowerCase().includes(shopSearchQuery.toLowerCase()) && !favoriteShops.includes(shop)
  );
  
  const getRetailerCategory = (shopName: string): string | null => {
    const retailer = suggestedRetailers.find(r => r.name === shopName);
    return retailer ? RetailerService.getCategoryLabel(retailer.category) : null;
  };
  
  const isLocalStore = (shopName: string): boolean => {
    const retailer = suggestedRetailers.find(r => r.name === shopName);
    return retailer?.hasLocalStores ?? false;
  };

  const toggleShop = (shop: string) => {
    if (favoriteShops.includes(shop)) {
      setFavoriteShops(favoriteShops.filter(s => s !== shop));
    } else if (favoriteShops.length < 10) {
      setFavoriteShops([...favoriteShops, shop]);
    }
  };

  const toggleGoal = (goalId: DripnGoal) => {
    if (usageGoals.includes(goalId)) {
      setUsageGoals(usageGoals.filter(g => g !== goalId));
    } else if (usageGoals.length < 3) {
      setUsageGoals([...usageGoals, goalId]);
    }
  };

  useEffect(() => {
    const accents = getAccentsForLanguage(stylistLanguage);
    if (!accents.includes(stylistAccent)) {
      setStylistAccent(accents[0]);
    }
  }, [stylistLanguage]);

  useEffect(() => {
    const fetchRetailers = async () => {
      if (!country) return;
      setLoadingRetailers(true);
      try {
        const retailers = await RetailerService.getRetailerSuggestions(country);
        setSuggestedRetailers(retailers);
      } catch (error) {
        console.log('Error fetching retailer suggestions:', error);
      } finally {
        setLoadingRetailers(false);
      }
    };
    fetchRetailers();
  }, [country]);

  useEffect(() => {
    const setupAudio = async () => {
      if (Platform.OS === 'ios') {
        try {
          await AudioModule.setAudioModeAsync({
            playsInSilentMode: true,
          });
          console.log('Audio mode configured for iOS');
        } catch (error) {
          console.log('Failed to configure audio mode:', error);
        }
      }
    };
    setupAudio();
    
    return () => {
      stopAudio();
    };
  }, []);

  const playVoicePreview = useCallback(async (stylistId: string) => {
    if (isPlayingVoice === stylistId) {
      await stopAudio();
      setIsPlayingVoice(null);
      return;
    }

    await stopAudio();
    setIsPlayingVoice(stylistId);

    try {
      const voiceForStylist = stylistId === 'ruby' ? 'nova' : 'onyx';
      // Pass user's first name for personalized greetings (e.g., "Ciao Sarah!" instead of "Ciao bella!")
      // Only use name if user hasn't said pronunciation is wrong
      const nameToUse = useNameInGreetings ? userFirstName : undefined;
      await playOpenAIVoice(stylistId, stylistLanguage, voicePitch, voiceForStylist, stylistAccent, nameToUse);
      setIsPlayingVoice(null);
      
      // Show pronunciation prompt after first voice preview if user has a name and hasn't confirmed yet
      // Only show once per session to avoid annoying the user (module-level flag persists across remounts)
      if (userFirstName && !namePronunciationConfirmed && useNameInGreetings && !hasPromptedForPronunciationThisSession) {
        setShowPronunciationPrompt(true);
        hasPromptedForPronunciationThisSession = true;
      }
    } catch (error) {
      console.log('Voice preview error:', error);
      setIsPlayingVoice(null);
    }
  }, [stylistLanguage, voicePitch, isPlayingVoice, stylistAccent, userFirstName, useNameInGreetings, namePronunciationConfirmed]);

  const handleStylistSelect = useCallback((stylistId: StylistId) => {
    setSelectedStylistId(stylistId);
    if (stylistId) {
      const defaultVoice = getDefaultVoiceForStylist(stylistId);
      setVoicePitch(defaultVoice as VoicePitch);
      playVoicePreview(stylistId);
    }
  }, [playVoicePreview]);

  const handlePronunciationCorrect = useCallback(() => {
    setNamePronunciationConfirmed(true);
    setUseNameInGreetings(true);
    setShowPronunciationPrompt(false);
  }, []);

  const handlePronunciationIncorrect = useCallback(() => {
    setNamePronunciationConfirmed(true);
    setUseNameInGreetings(false);
    setShowPronunciationPrompt(false);
  }, []);

  const handleBodyScan = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to scan your body type.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0].base64) return;

      setIsBodyScanning(true);
      const scanResult = await OnboardingService.bodyScan(result.assets[0].base64);
      setBodyScanResult(scanResult);
      
      if (scanResult.autoFillFields) {
        const fields = scanResult.autoFillFields;
        if (fields.bodyType) {
          const mappedShape = fields.bodyType as BodyShape;
          setBodyShape(mappedShape);
        }
      }
      
      Alert.alert(
        'Body Scan Complete',
        scanResult.message || `Your body type: ${scanResult.bodyType}\nKibbe type: ${scanResult.kibbeBodyType}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.log('Body scan error:', error);
      Alert.alert('Scan Failed', 'Unable to analyze photo. Please try again or select manually.');
    } finally {
      setIsBodyScanning(false);
    }
  }, []);

  const handleColorScan = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to analyze your colors.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0].base64) return;

      setIsColorScanning(true);
      const scanResult = await OnboardingService.colorScan(result.assets[0].base64);
      setColorScanResult(scanResult);
      
      Alert.alert(
        'Color Analysis Complete',
        scanResult.message || `You're a ${scanResult.colorSeasonType} ${scanResult.seasonSubtype}!\n\nPower colors: ${scanResult.colorPalette.powerColors.slice(0, 3).join(', ')}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.log('Color scan error:', error);
      Alert.alert('Analysis Failed', 'Unable to analyze colors. Please try again.');
    } finally {
      setIsColorScanning(false);
    }
  }, []);

  const handleStartStyleQuiz = useCallback(async () => {
    try {
      setIsLoadingQuiz(true);
      const quizConfig = await OnboardingService.getStyleQuiz(gender || undefined);
      setQuizQuestions(quizConfig.questions);
      setCurrentQuizQuestion(0);
      setQuizAnswers({});
      setShowStyleQuiz(true);
    } catch (error) {
      console.log('Quiz load error:', error);
      Alert.alert('Quiz Unavailable', 'Unable to load the style quiz. Please choose your style manually.');
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [gender]);

  const handleQuizAnswer = useCallback((questionId: number, answer: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    if (currentQuizQuestion < quizQuestions.length - 1) {
      setCurrentQuizQuestion(prev => prev + 1);
    }
  }, [currentQuizQuestion, quizQuestions.length]);

  const handleSubmitQuiz = useCallback(async () => {
    try {
      setIsLoadingQuiz(true);
      const answers = Object.entries(quizAnswers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer,
      }));
      
      const result = await OnboardingService.submitStyleQuiz(answers);
      setQuizResult(result);
      
      setShowStyleQuiz(false);
      
      if (result.primaryArchetype) {
        const archetypeToStyle: Record<string, StyleTheme> = {
          minimalist: 'luxury',
          classic: 'smart-casual',
          bohemian: 'boho',
          edgy: 'edgy',
          romantic: 'luxury',
          streetwear: 'streetwear',
          glamorous: 'luxury',
          preppy: 'smart-casual',
          athleisure: 'sporty',
          eclectic: 'boho',
        };
        const mappedStyle = archetypeToStyle[result.primaryArchetype.id] || 'smart-casual';
        setStylePreference(mappedStyle);
        
        Alert.alert(
          `You're ${result.primaryArchetype.name}!`,
          result.personalizedMessage || result.primaryArchetype.description,
          [{ text: 'Continue', onPress: () => setStep(prev => prev + 1) }]
        );
      } else {
        Alert.alert(
          'Style Quiz Complete',
          result.personalizedMessage || 'Thanks for completing the quiz! Please select your preferred style below.',
          [{ text: 'Continue' }]
        );
      }
    } catch (error) {
      console.log('Quiz submit error:', error);
      Alert.alert('Submission Failed', 'Unable to submit quiz. Please try again.');
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [quizAnswers]);

  const getBodyShapeOptions = () => {
    if (gender === "man") return MEN_BODY_SHAPES;
    if (gender === "woman") return WOMEN_BODY_SHAPES;
    return [...WOMEN_BODY_SHAPES, ...MEN_BODY_SHAPES.filter(s => !WOMEN_BODY_SHAPES.find(w => w.id === s.id))];
  };

  const handleCountrySelect = (c: string) => {
    setCountry(c);
    setCountrySearchQuery("");
    Keyboard.dismiss();
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearchQuery.trim()) return [];
    const query = countrySearchQuery.toLowerCase().trim();
    return ALL_COUNTRIES.filter(c => c.toLowerCase().includes(query)).slice(0, 10);
  }, [countrySearchQuery]);

  const detectLocation = useCallback(async () => {
    setIsDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Access', 'Enable location to auto-detect your country, or select manually below.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (address?.country) {
        const detectedCountry = ALL_COUNTRIES.find(
          c => c.toLowerCase() === address.country?.toLowerCase()
        );
        if (detectedCountry) {
          setCountry(detectedCountry);
        } else {
          Alert.alert('Country Not Found', `We detected "${address.country}" but it's not in our list. Please select manually.`);
        }
      }
    } catch (error) {
      console.log('Location detection error:', error);
    } finally {
      setIsDetectingLocation(false);
    }
  }, []);

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    const stylistPreferences: StylistPreferences = {
      selectedStylistId,
      language: stylistLanguage,
      accent: stylistAccent,
      voicePitch,
      useNameInGreetings,
      namePronunciationConfirmed,
    };
    await completeOnboarding({
      country,
      gender,
      stylePreference,
      sizeRange,
      bodyShape,
      budgetRange,
      stylistPreferences,
      extendedPreferences: {
        lifestyle: null,
        favoriteBrands: [],
        colorPreferences: [],
        shoppingFrequency: null,
        preferOnlineShopping: true,
        sustainabilityImportant: false,
        occasions: [],
        favoriteShops,
        usageGoals,
      },
    });
    navigation.replace("SuggestedFollows");
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.countryTitle}>
              Select your country
            </ThemedText>
            
            <View style={[styles.countrySearchContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="search" size={20} color={theme.tabIconDefault} />
              <TextInput
                style={[styles.countrySearchInput, { color: theme.text }]}
                placeholder="Search countries..."
                placeholderTextColor={theme.tabIconDefault}
                value={countrySearchQuery}
                onChangeText={setCountrySearchQuery}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {countrySearchQuery.length > 0 ? (
                <Pressable onPress={() => setCountrySearchQuery("")}>
                  <Feather name="x" size={20} color={theme.tabIconDefault} />
                </Pressable>
              ) : null}
            </View>

            {country ? (
              <View style={[styles.selectedCountryBanner, { backgroundColor: theme.link + '15' }]}>
                <View style={styles.selectedCountryContent}>
                  <Feather name="map-pin" size={18} color={theme.link} />
                  <ThemedText type="body" style={[styles.selectedCountryText, { color: theme.link }]}>
                    {country}
                  </ThemedText>
                </View>
                <Pressable onPress={() => setCountry("")} hitSlop={8}>
                  <Feather name="x" size={18} color={theme.link} />
                </Pressable>
              </View>
            ) : null}

            <ScrollView 
              style={styles.countryScrollView} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {countrySearchQuery.trim().length > 0 ? (
                <View style={styles.countrySearchResults}>
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => handleCountrySelect(c)}
                        style={({ pressed }) => [
                          styles.countryListItem,
                          { 
                            backgroundColor: country === c ? theme.link : theme.backgroundDefault,
                            opacity: pressed ? 0.8 : 1 
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{ color: country === c ? "#FFFFFF" : theme.text, fontWeight: country === c ? '600' : '400' }}
                        >
                          {c}
                        </ThemedText>
                        {country === c ? (
                          <Feather name="check" size={18} color="#FFFFFF" />
                        ) : null}
                      </Pressable>
                    ))
                  ) : (
                    <ThemedText type="body" style={[styles.noResultsText, { color: theme.tabIconDefault }]}>
                      No countries found
                    </ThemedText>
                  )}
                </View>
              ) : (
                <>
                  <Pressable
                    onPress={detectLocation}
                    disabled={isDetectingLocation}
                    style={({ pressed }) => [
                      styles.detectLocationButton,
                      { 
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.link,
                        opacity: pressed ? 0.8 : 1 
                      },
                    ]}
                  >
                    {isDetectingLocation ? (
                      <ActivityIndicator size="small" color={theme.link} />
                    ) : (
                      <Feather name="navigation" size={20} color={theme.link} />
                    )}
                    <ThemedText type="body" style={{ color: theme.link, fontWeight: '500', marginLeft: Spacing.sm }}>
                      {isDetectingLocation ? 'Detecting...' : 'Use my location'}
                    </ThemedText>
                  </Pressable>

                  <ThemedText type="caption" style={[styles.countrySectionLabel, { color: theme.tabIconDefault }]}>
                    Quick Select
                  </ThemedText>
                  <View style={styles.popularCountriesGrid}>
                    {QUICK_SELECT_COUNTRIES.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => handleCountrySelect(c)}
                        style={({ pressed }) => [
                          styles.popularCountryChip,
                          { 
                            backgroundColor: country === c ? theme.link : theme.backgroundDefault,
                            borderColor: country === c ? theme.link : theme.backgroundSecondary,
                            opacity: pressed ? 0.8 : 1 
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{ 
                            color: country === c ? "#FFFFFF" : theme.text,
                            fontWeight: country === c ? '600' : '400',
                          }}
                        >
                          {c}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>

                  <ThemedText type="caption" style={[styles.countrySectionLabel, { color: theme.tabIconDefault }]}>
                    All Regions
                  </ThemedText>
                  {Object.entries(COUNTRY_REGIONS).map(([region, countries]) => (
                    <View key={region}>
                      <Pressable
                        onPress={() => setExpandedRegion(expandedRegion === region ? null : region)}
                        style={[styles.regionHeader, { backgroundColor: theme.backgroundDefault }]}
                      >
                        <ThemedText type="body" style={{ fontWeight: '600' }}>{region}</ThemedText>
                        <Feather 
                          name={expandedRegion === region ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color={theme.tabIconDefault} 
                        />
                      </Pressable>
                      {expandedRegion === region ? (
                        <View style={styles.regionCountries}>
                          {countries.filter(c => ALL_COUNTRIES.includes(c)).map((c) => (
                            <Pressable
                              key={c}
                              onPress={() => handleCountrySelect(c)}
                              style={({ pressed }) => [
                                styles.countryListItem,
                                { 
                                  backgroundColor: country === c ? theme.link : 'transparent',
                                  opacity: pressed ? 0.8 : 1 
                                },
                              ]}
                            >
                              <ThemedText
                                type="body"
                                style={{ 
                                  color: country === c ? "#FFFFFF" : theme.text,
                                  fontWeight: country === c ? '600' : '400',
                                }}
                              >
                                {c}
                              </ThemedText>
                              {country === c ? (
                                <Feather name="check" size={18} color="#FFFFFF" />
                              ) : null}
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                  <View style={{ height: Spacing.xl }} />
                </>
              )}
            </ScrollView>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              How do you identify?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              This helps us tailor style recommendations for you
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setGender(g.id)}
                    style={({ pressed }) => [
                      styles.genderOption,
                      {
                        backgroundColor:
                          gender === g.id ? theme.link : theme.backgroundDefault,
                        borderColor:
                          gender === g.id ? theme.link : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={g.icon}
                      size={24}
                      color={gender === g.id ? "#FFFFFF" : theme.text}
                    />
                    <ThemedText
                      type="h3"
                      style={{
                        color: gender === g.id ? "#FFFFFF" : theme.text,
                      }}
                    >
                      {g.name}
                    </ThemedText>
                    {gender === g.id ? (
                      <View style={[styles.checkCircleSmall, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 2:
        const stylists = getAllStylists();
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Meet Your Personal Stylist
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Choose who will guide your fashion journey
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.stylistsContainer}>
                {stylists.map((stylist) => {
                  const isSelected = selectedStylistId === stylist.id;
                  const isPlaying = isPlayingVoice === stylist.id;
                  return (
                    <Pressable
                      key={stylist.id}
                      onPress={() => handleStylistSelect(stylist.id as StylistId)}
                      style={({ pressed }) => [
                        styles.stylistCard,
                        {
                          backgroundColor: isSelected ? stylist.color : theme.backgroundDefault,
                          borderColor: isSelected ? stylist.color : theme.backgroundSecondary,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.stylistIconContainer, { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : stylist.color }]}>
                        {isPlaying ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Feather
                            name={stylist.icon}
                            size={32}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <View style={styles.stylistInfo}>
                        <View style={styles.stylistNameRow}>
                          <ThemedText
                            type="h2"
                            style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                          >
                            {stylist.name}
                          </ThemedText>
                          <Pressable
                            onPress={() => playVoicePreview(stylist.id)}
                            style={[styles.voicePreviewButton, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.backgroundSecondary }]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Feather
                              name={isPlaying ? "pause" : "volume-2"}
                              size={16}
                              color={isSelected ? "#FFFFFF" : theme.link}
                            />
                          </Pressable>
                        </View>
                        <ThemedText
                          type="small"
                          style={{ color: isSelected ? "rgba(255,255,255,0.9)" : theme.tabIconDefault }}
                        >
                          {stylist.tagline}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: isSelected ? "rgba(255,255,255,0.8)" : theme.tabIconDefault, marginTop: Spacing.xs }}
                        >
                          {stylist.personality}
                        </ThemedText>
                        {isPlaying ? (
                          <View style={styles.playingIndicator}>
                            <View style={[styles.soundBar, { backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : theme.link }]} />
                            <View style={[styles.soundBar, styles.soundBarTall, { backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : theme.link }]} />
                            <View style={[styles.soundBar, { backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : theme.link }]} />
                            <ThemedText
                              type="small"
                              style={{ color: isSelected ? "rgba(255,255,255,0.9)" : theme.link, marginLeft: Spacing.xs }}
                            >
                              Playing voice preview...
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <View style={[styles.checkCircle, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                          <Feather name="check" size={16} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {showPronunciationPrompt && userFirstName && selectedStylistId ? (
                <NamePronunciationPrompt
                  memberName={userFirstName}
                  stylistName={selectedStylistId === 'ruby' ? 'Ruby' : 'Max'}
                  onConfirmCorrect={handlePronunciationCorrect}
                  onConfirmIncorrect={handlePronunciationIncorrect}
                  onDismiss={() => setShowPronunciationPrompt(false)}
                />
              ) : null}

              <View style={styles.voiceSettingsSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Language
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  <View style={styles.horizontalOptionsRow}>
                    {STYLIST_LANGUAGES.map((lang) => (
                      <Pressable
                        key={lang}
                        onPress={() => setStylistLanguage(lang)}
                        style={({ pressed }) => [
                          styles.optionChip,
                          {
                            backgroundColor: stylistLanguage === lang ? theme.link : theme.backgroundDefault,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{ color: stylistLanguage === lang ? "#FFFFFF" : theme.text }}
                        >
                          {lang}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.voiceSettingsSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Accent
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  <View style={styles.horizontalOptionsRow}>
                    {getAccentsForLanguage(stylistLanguage).map((accent) => (
                      <Pressable
                        key={accent}
                        onPress={() => setStylistAccent(accent)}
                        style={({ pressed }) => [
                          styles.optionChip,
                          {
                            backgroundColor: stylistAccent === accent ? theme.link : theme.backgroundDefault,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{ color: stylistAccent === accent ? "#FFFFFF" : theme.text }}
                        >
                          {accent}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

            </ScrollView>
          </View>
        );

      case 3:
        if (showStyleQuiz && quizQuestions.length > 0) {
          const currentQ = quizQuestions[currentQuizQuestion];
          const allAnswered = quizQuestions.every(q => quizAnswers[q.id]);
          return (
            <View style={styles.stepContent}>
              <View style={styles.quizHeader}>
                <Pressable onPress={() => setShowStyleQuiz(false)} style={styles.quizBackButton}>
                  <Feather name="arrow-left" size={20} color={theme.text} />
                </Pressable>
                <ThemedText type="small" style={{ opacity: 0.7 }}>
                  Question {currentQuizQuestion + 1} of {quizQuestions.length}
                </ThemedText>
              </View>
              <View style={styles.quizProgressBar}>
                <View 
                  style={[
                    styles.quizProgressFill, 
                    { 
                      width: `${((currentQuizQuestion + 1) / quizQuestions.length) * 100}%`,
                      backgroundColor: theme.link,
                    }
                  ]} 
                />
              </View>
              <ThemedText type="h2" style={[styles.stepTitle, { marginTop: Spacing.lg }]}>
                {currentQ.question}
              </ThemedText>
              <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.quizOptions}>
                  {currentQ.options.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => handleQuizAnswer(currentQ.id, option.value)}
                      style={({ pressed }) => [
                        styles.quizOption,
                        {
                          backgroundColor: quizAnswers[currentQ.id] === option.value 
                            ? theme.link 
                            : theme.backgroundDefault,
                          borderColor: quizAnswers[currentQ.id] === option.value 
                            ? theme.link 
                            : theme.backgroundSecondary,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: quizAnswers[currentQ.id] === option.value ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {option.text}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.quizNavigation}>
                  {currentQuizQuestion > 0 ? (
                    <Pressable
                      onPress={() => setCurrentQuizQuestion(prev => prev - 1)}
                      style={[styles.quizNavButton, { backgroundColor: theme.backgroundDefault }]}
                    >
                      <Feather name="chevron-left" size={20} color={theme.text} />
                      <ThemedText type="body">Previous</ThemedText>
                    </Pressable>
                  ) : <View />}
                  {allAnswered ? (
                    <Pressable
                      onPress={handleSubmitQuiz}
                      disabled={isLoadingQuiz}
                      style={[styles.quizNavButton, { backgroundColor: theme.link }]}
                    >
                      {isLoadingQuiz ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <ThemedText type="body" style={{ color: "#FFFFFF" }}>Submit</ThemedText>
                          <Feather name="check" size={20} color="#FFFFFF" />
                        </>
                      )}
                    </Pressable>
                  ) : currentQuizQuestion < quizQuestions.length - 1 && quizAnswers[currentQ.id] ? (
                    <Pressable
                      onPress={() => setCurrentQuizQuestion(prev => prev + 1)}
                      style={[styles.quizNavButton, { backgroundColor: theme.link }]}
                    >
                      <ThemedText type="body" style={{ color: "#FFFFFF" }}>Next</ThemedText>
                      <Feather name="chevron-right" size={20} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          );
        }
        
        const styleOptions = gender === 'man' ? STYLE_OPTIONS_MALE : STYLE_OPTIONS_FEMALE;
        const getStyleImage = (styleId: StyleTheme): ImageSourcePropType => {
          const region = getRegionFromCountry(country);
          if (styleId === 'smart-casual') return getSmartCasualImage(region, gender);
          if (styleId === 'boho') return getGenderSpecificBohoImage(region, gender);
          if (styleId === 'sporty') return getGenderSpecificSportyImage(region, gender);
          if (styleId === 'business') return getGenderSpecificBusinessImage(region);
          if (styleId === 'edgy') return gender === 'man' ? EDGY_MALE_IMAGE : EDGY_FEMALE_IMAGE;
          if (styleId === 'streetwear') return gender === 'man' ? STREETWEAR_MALE_IMAGE : STREETWEAR_FEMALE_IMAGE;
          return STYLE_IMAGES[styleId as keyof typeof STYLE_IMAGES];
        };
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              What's your style?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Pick the aesthetic that speaks to you
            </ThemedText>
            
            <Pressable
              onPress={handleStartStyleQuiz}
              disabled={isLoadingQuiz}
              style={({ pressed }) => [
                styles.aiShortcutButton,
                {
                  backgroundColor: `${theme.link}15`,
                  borderColor: theme.link,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {isLoadingQuiz ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : (
                <Feather name="zap" size={20} color={theme.link} />
              )}
              <View style={styles.aiShortcutText}>
                <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                  Take the Style Quiz
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.7 }}>
                  7 quick questions to discover your style archetype
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.link} />
            </Pressable>
            
            <ThemedText type="small" style={[styles.orDivider, { color: theme.tabIconDefault }]}>
              or choose below
            </ThemedText>
            
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.styleOptions}>
                {styleOptions.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setStylePreference(s.id)}
                    style={({ pressed }) => [
                      styles.styleOption,
                      {
                        borderColor:
                          stylePreference === s.id
                            ? theme.link
                            : theme.backgroundSecondary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Image
                      source={getStyleImage(s.id)}
                      style={styles.styleImagePreview}
                      resizeMode="cover"
                    />
                    <View style={styles.styleTextContainer}>
                      <ThemedText type="h3">
                        {s.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ opacity: 0.7 }}
                      >
                        {s.description}
                      </ThemedText>
                    </View>
                    {stylePreference === s.id ? (
                      <View style={[styles.checkCircle, { backgroundColor: theme.link }]}>
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Tell us more (optional)
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Help us personalize your recommendations
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.aiScanSection}>
                <Pressable
                  onPress={handleBodyScan}
                  disabled={isBodyScanning}
                  style={({ pressed }) => [
                    styles.aiShortcutButton,
                    {
                      backgroundColor: bodyScanResult ? `${theme.link}25` : `${theme.link}15`,
                      borderColor: theme.link,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {isBodyScanning ? (
                    <ActivityIndicator size="small" color={theme.link} />
                  ) : (
                    <Feather name="camera" size={20} color={theme.link} />
                  )}
                  <View style={styles.aiShortcutText}>
                    <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                      {bodyScanResult ? 'Body Scan Complete' : 'AI Body Scan'}
                    </ThemedText>
                    <ThemedText type="small" style={{ opacity: 0.7 }}>
                      {bodyScanResult 
                        ? `${bodyScanResult.bodyType} - ${bodyScanResult.kibbeBodyType}`
                        : 'Take a photo to detect your body type'}
                    </ThemedText>
                  </View>
                  {bodyScanResult ? (
                    <Feather name="check-circle" size={20} color={theme.link} />
                  ) : (
                    <Feather name="chevron-right" size={20} color={theme.link} />
                  )}
                </Pressable>

                <Pressable
                  onPress={handleColorScan}
                  disabled={isColorScanning}
                  style={({ pressed }) => [
                    styles.aiShortcutButton,
                    {
                      backgroundColor: colorScanResult ? `${theme.link}25` : `${theme.link}15`,
                      borderColor: theme.link,
                      opacity: pressed ? 0.8 : 1,
                      marginTop: Spacing.sm,
                    },
                  ]}
                >
                  {isColorScanning ? (
                    <ActivityIndicator size="small" color={theme.link} />
                  ) : (
                    <Feather name="sun" size={20} color={theme.link} />
                  )}
                  <View style={styles.aiShortcutText}>
                    <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                      {colorScanResult ? 'Color Analysis Complete' : 'AI Color Analysis'}
                    </ThemedText>
                    <ThemedText type="small" style={{ opacity: 0.7 }}>
                      {colorScanResult 
                        ? `${colorScanResult.colorSeasonType} ${colorScanResult.seasonSubtype}`
                        : 'Selfie to find your best colors'}
                    </ThemedText>
                  </View>
                  {colorScanResult ? (
                    <Feather name="check-circle" size={20} color={theme.link} />
                  ) : (
                    <Feather name="chevron-right" size={20} color={theme.link} />
                  )}
                </Pressable>
              </View>

              <ThemedText type="small" style={[styles.orDivider, { color: theme.tabIconDefault }]}>
                or select manually
              </ThemedText>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Size Range
                </ThemedText>
                <View style={styles.optionsRow}>
                  {SIZE_OPTIONS.map((size) => (
                    <Pressable
                      key={size}
                      onPress={() => setSizeRange(sizeRange === size ? null : size)}
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          backgroundColor:
                            sizeRange === size ? theme.link : theme.backgroundDefault,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: sizeRange === size ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {size}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Body Shape
                </ThemedText>
                <View style={styles.bodyShapeOptions}>
                  {getBodyShapeOptions().map((shape) => (
                    <Pressable
                      key={shape.id}
                      onPress={() =>
                        setBodyShape(bodyShape === shape.id ? null : shape.id)
                      }
                      style={({ pressed }) => [
                        styles.bodyShapeOption,
                        {
                          backgroundColor:
                            bodyShape === shape.id
                              ? theme.link
                              : theme.backgroundDefault,
                          borderColor:
                            bodyShape === shape.id
                              ? theme.link
                              : theme.backgroundSecondary,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: bodyShape === shape.id ? "#FFFFFF" : theme.text,
                          fontWeight: "600",
                        }}
                      >
                        {shape.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{
                          color: bodyShape === shape.id ? "#FFFFFF" : theme.text,
                          opacity: 0.7,
                        }}
                      >
                        {shape.description}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Budget Range
                </ThemedText>
                <View style={styles.optionsRow}>
                  {BUDGET_OPTIONS.map((budget) => (
                    <Pressable
                      key={budget.id}
                      onPress={() =>
                        setBudgetRange(budgetRange === budget.id ? null : budget.id)
                      }
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          backgroundColor:
                            budgetRange === budget.id
                              ? theme.link
                              : theme.backgroundDefault,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: budgetRange === budget.id ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {budget.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Where do you shop?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              {suggestedRetailers.length > 0 
                ? `AI-suggested stores for ${country} - select up to 10`
                : 'Select up to 10 shops you love (helps AI personalize recommendations)'}
            </ThemedText>

            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  { 
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: theme.backgroundSecondary,
                    flex: 1,
                  }
                ]}
                placeholder="Search or add a shop..."
                placeholderTextColor={theme.tabIconDefault}
                value={shopSearchQuery}
                onChangeText={setShopSearchQuery}
              />
              {shopSearchQuery.trim().length > 0 && 
               !allAvailableShops.some(s => s.toLowerCase() === shopSearchQuery.trim().toLowerCase()) &&
               !favoriteShops.some(s => s.toLowerCase() === shopSearchQuery.trim().toLowerCase()) &&
               favoriteShops.length < 10 ? (
                <Pressable
                  onPress={() => {
                    const newShop = shopSearchQuery.trim();
                    if (newShop && favoriteShops.length < 10) {
                      setFavoriteShops([...favoriteShops, newShop]);
                      setShopSearchQuery("");
                    }
                  }}
                  style={[styles.addButton, { backgroundColor: theme.link }]}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: 4 }}>Add</ThemedText>
                </Pressable>
              ) : null}
            </View>

            {favoriteShops.length > 0 ? (
              <View style={styles.selectedShopsContainer}>
                <ThemedText type="small" style={styles.selectedLabel}>
                  Selected ({favoriteShops.length}/10)
                </ThemedText>
                <View style={styles.shopsGrid}>
                  {favoriteShops.map((shop) => (
                    <Pressable
                      key={shop}
                      onPress={() => toggleShop(shop)}
                      style={[styles.shopChip, { backgroundColor: theme.link }]}
                    >
                      <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                        {shop}
                      </ThemedText>
                      <Feather name="x" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {favoriteShops.length >= 10 ? (
              <ThemedText type="small" style={{ opacity: 0.7, marginBottom: Spacing.md }}>
                Maximum 10 shops selected
              </ThemedText>
            ) : null}

            {loadingRetailers ? (
              <View style={styles.loadingRetailersContainer}>
                <ActivityIndicator size="small" color={theme.link} />
                <ThemedText type="small" style={{ marginLeft: Spacing.sm, opacity: 0.7 }}>
                  Finding stores in {country}...
                </ThemedText>
              </View>
            ) : null}

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.shopsGrid}>
                {filteredShops.map((shop) => {
                  const isDisabled = favoriteShops.length >= 10;
                  const isLocal = isLocalStore(shop);
                  const category = getRetailerCategory(shop);
                  const isSuggested = suggestedShopNames.includes(shop);
                  return (
                    <Pressable
                      key={shop}
                      onPress={() => toggleShop(shop)}
                      disabled={isDisabled}
                      style={({ pressed }) => [
                        styles.shopChip,
                        {
                          backgroundColor: isSuggested ? `${theme.link}15` : theme.backgroundDefault,
                          borderWidth: 1,
                          borderColor: isSuggested ? theme.link : theme.backgroundSecondary,
                          opacity: isDisabled ? 0.4 : (pressed ? 0.8 : 1),
                        },
                      ]}
                    >
                      {isLocal ? (
                        <Feather name="map-pin" size={12} color={theme.link} style={{ marginRight: 4 }} />
                      ) : null}
                      <ThemedText type="small" style={{ opacity: isDisabled ? 0.5 : 1 }}>{shop}</ThemedText>
                      {category ? (
                        <ThemedText type="small" style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>
                          {category}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              What brings you to Dripn?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Choose up to 3 goals (helps AI understand your needs)
            </ThemedText>
            {usageGoals.length >= 3 ? (
              <ThemedText type="small" style={{ opacity: 0.7, marginBottom: Spacing.md }}>
                Maximum 3 goals selected
              </ThemedText>
            ) : null}

            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.goalsContainer}>
                {DRIPN_GOALS.map((goal) => {
                  const isSelected = usageGoals.includes(goal.id);
                  const isDisabled = !isSelected && usageGoals.length >= 3;
                  return (
                    <Pressable
                      key={goal.id}
                      onPress={() => toggleGoal(goal.id)}
                      disabled={isDisabled}
                      style={({ pressed }) => [
                        styles.goalOption,
                        {
                          backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                          borderColor: isSelected ? theme.link : theme.backgroundSecondary,
                          opacity: isDisabled ? 0.4 : (pressed ? 0.8 : 1),
                        },
                      ]}
                    >
                      <Feather
                        name={goal.icon}
                        size={24}
                        color={isSelected ? "#FFFFFF" : (isDisabled ? theme.tabIconDefault : theme.text)}
                      />
                      <View style={styles.goalTextContainer}>
                        <ThemedText
                          type="h3"
                          style={{ color: isSelected ? "#FFFFFF" : (isDisabled ? theme.tabIconDefault : theme.text) }}
                        >
                          {goal.name}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ 
                            color: isSelected ? "rgba(255,255,255,0.8)" : theme.tabIconDefault,
                          }}
                        >
                          {goal.description}
                        </ThemedText>
                      </View>
                      {isSelected ? (
                        <View style={[styles.checkCircle, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                          <Feather name="check" size={16} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i <= step ? theme.link : theme.backgroundSecondary,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.link }}>
            Skip
          </ThemedText>
        </Pressable>
      </View>

      {renderStep()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button onPress={handleNext} style={styles.nextButton}>
          {step === totalSteps - 1 ? "Get Started" : "Continue"}
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  progressContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.xl,
  },
  countryTitle: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  countrySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  countrySearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  selectedCountryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  selectedCountryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectedCountryText: {
    fontWeight: '600',
  },
  countryScrollView: {
    flex: 1,
  },
  countrySearchResults: {
    gap: Spacing.xs,
  },
  countryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  noResultsText: {
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  detectLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  countrySectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  popularCountriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  popularCountryChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  regionCountries: {
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  styleOptions: {
    gap: Spacing.md,
  },
  styleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  styleImagePreview: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
  },
  styleTextContainer: {
    flex: 1,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  genderOptions: {
    gap: Spacing.md,
  },
  genderOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  optionalSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  bodyShapeOptions: {
    gap: Spacing.sm,
  },
  bodyShapeOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  nextButton: {
    width: "100%",
  },
  stylistsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  stylistCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  stylistIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  stylistInfo: {
    flex: 1,
  },
  stylistNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  voicePreviewButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  soundBar: {
    width: 3,
    height: 8,
    borderRadius: 1.5,
    marginRight: 2,
  },
  soundBarTall: {
    height: 12,
  },
  voiceSettingsSection: {
    marginBottom: Spacing.xl,
  },
  horizontalScroll: {
    marginLeft: -Spacing.xl,
    marginRight: -Spacing.xl,
    paddingLeft: Spacing.xl,
  },
  horizontalOptionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.xl * 2,
  },
  pitchOptionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  pitchOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  selectedShopsContainer: {
    marginBottom: Spacing.md,
  },
  selectedLabel: {
    marginBottom: Spacing.sm,
    opacity: 0.7,
  },
  shopsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  loadingRetailersContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  shopChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  goalsContainer: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  goalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  goalTextContainer: {
    flex: 1,
  },
  aiShortcutButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  aiShortcutText: {
    flex: 1,
  },
  aiScanSection: {
    marginBottom: Spacing.md,
  },
  orDivider: {
    textAlign: "center",
    marginVertical: Spacing.md,
  },
  quizHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  quizBackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  quizProgressBar: {
    height: 4,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    borderRadius: 2,
    marginTop: Spacing.md,
    overflow: "hidden",
  },
  quizProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  quizOptions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  quizOption: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  quizNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  quizNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
