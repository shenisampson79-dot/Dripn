import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, Pressable, ScrollView, Image, ImageSourcePropType, ActivityIndicator, Platform, TextInput, Alert, Keyboard, Modal, Animated, Easing, Dimensions, KeyboardAvoidingView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { AudioModule } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, StyleTheme, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange, Gender, StylistId, VoicePitch, StylistPreferences, DripnGoal, DressCodePreference, SubcultureStyle, DressCodeStrictness, CulturalStylePreferences, FitPreference, BodyArea, BodyMeasurements, HeightUnit, WeightUnit } from "@/contexts/AuthContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { STYLISTS, STYLIST_LANGUAGES, STYLIST_ACCENTS, getAllStylists, getDefaultVoiceForStylist, getAccentsForLanguage } from "@/services/PersonalStylistService";
import { playVoicePreview as playOpenAIVoice, stopAudio } from "@/services/OpenAITTSService";
import { NamePronunciationPrompt } from "@/components/NamePronunciationPrompt";
import { RetailerService, Retailer } from "@/services/RetailerService";
import { OnboardingService, BodyScanResult, ColorScanResult, StyleQuizQuestion, StyleQuizResult, StyleArchetype, CameraGuidance, ScanReview } from "@/services/OnboardingService";
import { useTranslations } from "@/contexts/TranslationContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { setCurrentOnboardingStep } from "@/components/ErrorFallback";

const GENDER_OPTIONS: { id: Gender; name: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "woman", name: "Woman", icon: "user" },
  { id: "man", name: "Man", icon: "user" },
  { id: "non-binary", name: "Non-Binary", icon: "users" },
  { id: "prefer-not-to-say", name: "Prefer not to say", icon: "user-x" },
];

const GENDER_COLORS: Record<Gender, { bg: string; border: string; icon: string }> = {
  "woman": { bg: "#4A1942", border: "#EC4899", icon: "#F472B6" },
  "man": { bg: "#1E3A5F", border: "#3B82F6", icon: "#60A5FA" },
  "non-binary": { bg: "#4C1D95", border: "#A855F7", icon: "#C084FC" },
  "prefer-not-to-say": { bg: "#374151", border: "#9CA3AF", icon: "#D1D5DB" },
};

const SIZE_COLORS: Record<string, { bg: string; border: string }> = {
  "XS-S": { bg: "#1A4D2E", border: "#22C55E" },
  "S-M": { bg: "#0E7490", border: "#06B6D4" },
  "M-L": { bg: "#1E3A5F", border: "#3B82F6" },
  "L-XL": { bg: "#4A1942", border: "#EC4899" },
  "XL-2X": { bg: "#4C1D95", border: "#A855F7" },
  "3X+": { bg: "#78350F", border: "#F59E0B" },
};

const BODY_SHAPE_COLORS: Record<string, { bg: string; border: string }> = {
  "Hourglass": { bg: "#4A1942", border: "#EC4899" },
  "Pear": { bg: "#1A4D2E", border: "#22C55E" },
  "Apple": { bg: "#78350F", border: "#F59E0B" },
  "Rectangle": { bg: "#1E3A5F", border: "#3B82F6" },
  "Athletic": { bg: "#7C2D12", border: "#F97316" },
  "Trapezoid": { bg: "#4C1D95", border: "#A855F7" },
  "Inverted Triangle": { bg: "#0E7490", border: "#06B6D4" },
  "Oval": { bg: "#065F46", border: "#10B981" },
};

const STYLE_COLORS: Record<string, { bg: string; border: string }> = {
  "smart-casual": { bg: "#1E3A5F", border: "#3B82F6" },
  "casual": { bg: "#1A4D2E", border: "#22C55E" },
  "boho": { bg: "#78350F", border: "#F59E0B" },
  "sporty": { bg: "#7C2D12", border: "#F97316" },
  "business": { bg: "#374151", border: "#6B7280" },
  "edgy": { bg: "#1F1F1F", border: "#EF4444" },
  "streetwear": { bg: "#4C1D95", border: "#A855F7" },
  "luxury": { bg: "#4A1942", border: "#EC4899" },
  "minimalist": { bg: "#0F172A", border: "#64748B" },
  "preppy": { bg: "#0E7490", border: "#06B6D4" },
};

const SHOP_CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  "Luxury": { bg: "#4A1942", border: "#EC4899" },
  "Contemporary": { bg: "#4C1D95", border: "#A855F7" },
  "Fast Fashion": { bg: "#7C2D12", border: "#F97316" },
  "Sportswear": { bg: "#1A4D2E", border: "#22C55E" },
  "Department Store": { bg: "#1E3A5F", border: "#3B82F6" },
  "Online Only": { bg: "#0E7490", border: "#06B6D4" },
  "default": { bg: "#374151", border: "#6B7280" },
};

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
  route?: {
    params?: {
      initialStep?: number;
    };
  };
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

const SIZE_OPTIONS: SizeRange[] = ["XS-S", "S-M", "M-L", "L-XL", "XL-2X", "3X+"];

const FIT_PREFERENCE_OPTIONS: { id: FitPreference; name: string }[] = [
  { id: "Fitted", name: "Fitted" },
  { id: "Tailored", name: "Tailored" },
  { id: "Relaxed", name: "Relaxed" },
  { id: "Oversized", name: "Oversized" },
];

const CONFIDENT_AREAS: BodyArea[] = ['Arms', 'Shoulders', 'Chest', 'Waist', 'Hips', 'Legs', 'Back', 'Neck'];

const MINIMIZE_AREAS: BodyArea[] = ['Arms', 'Shoulders', 'Chest', 'Tummy', 'Waist', 'Hips', 'Thighs', 'Legs', 'Back'];

const FAVORITE_COLORS: { hex: string; name: string }[] = [
  { hex: '#000000', name: 'Black' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#1F2937', name: 'Charcoal' },
  { hex: '#6B7280', name: 'Grey' },
  { hex: '#1E3A8A', name: 'Navy' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#0EA5E9', name: 'Sky Blue' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#EAB308', name: 'Yellow' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#EF4444', name: 'Red' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#D946EF', name: 'Fuchsia' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#78350F', name: 'Brown' },
  { hex: '#D4A574', name: 'Tan' },
];

const AVOID_COLORS: string[] = [
  'Neon colors', 'Pastels', 'Bright yellows', 'Bright oranges', 'Hot pink', 'Lime green',
  'Mustard', 'Burgundy', 'Olive', 'Coral', 'Turquoise', 'Gold', 'Silver', 'Metallics',
  'Animal prints', 'Florals', 'Stripes', 'Plaids', 'Polka dots', 'Camouflage',
  'Tie-dye', 'Ombre', "I'm open to all colors!",
];

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

export default function OnboardingScreen({ navigation, route }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { translations, isRTL } = useTranslations();
  const { completeOnboarding, user } = useAuth();
  
  // Get user's first name for personalized greetings
  const userFirstName = user?.name?.split(' ')[0] || undefined;
  
  // Get initial step from navigation params (for error recovery)
  const initialStep = route?.params?.initialStep ?? 0;

  const [step, setStep] = useState(initialStep);
  
  // Track current step for error recovery
  useEffect(() => {
    setCurrentOnboardingStep(step);
    return () => setCurrentOnboardingStep(null);
  }, [step]);
  
  const [country, setCountry] = useState("");
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>(null);
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  const [bodyHeightUnit, setBodyHeightUnit] = useState<HeightUnit>('cm');
  const [bodyWeight, setBodyWeight] = useState<number | null>(null);
  const [bodyWeightUnit, setBodyWeightUnit] = useState<WeightUnit>('kg');
  const [stylePreference, setStylePreference] = useState<StyleTheme>("luxury");
  const [sizeRange, setSizeRange] = useState<SizeRange>(null);
  const [bodyShape, setBodyShape] = useState<BodyShape>(null);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(null);
  const [fitPreference, setFitPreference] = useState<FitPreference>(null);
  const [confidentAreas, setConfidentAreas] = useState<BodyArea[]>([]);
  const [preferToMinimize, setPreferToMinimize] = useState<BodyArea[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [avoidColors, setAvoidColors] = useState<string[]>([]);
  const [selectedStylistId, setSelectedStylistId] = useState<StylistId>(null);
  const [stylistLanguage, setStylistLanguage] = useState<string>("English");
  const [stylistAccent, setStylistAccent] = useState<string>("American");
  const [voicePitch, setVoicePitch] = useState<VoicePitch>("mezzo-soprano");
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const [favoriteShops, setFavoriteShops] = useState<string[]>([]);
  const [usageGoals, setUsageGoals] = useState<DripnGoal[]>([]);
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [dressCodePreference, setDressCodePreference] = useState<DressCodePreference>(null);
  const [subcultureStyle, setSubcultureStyle] = useState<SubcultureStyle>(null);
  const [dressCodeStrictness, setDressCodeStrictness] = useState<DressCodeStrictness>(null);
  const [religiousOrCulturalDressCode, setReligiousOrCulturalDressCode] = useState<string>("");
  const [subcultureDescription, setSubcultureDescription] = useState<string>("");
  const [suggestedRetailers, setSuggestedRetailers] = useState<Retailer[]>([]);
  const [loadingRetailers, setLoadingRetailers] = useState(false);
  const [isBodyScanning, setIsBodyScanning] = useState(false);
  const [bodyScanResult, setBodyScanResult] = useState<BodyScanResult | null>(null);
  const [isColorScanning, setIsColorScanning] = useState(false);
  const [colorScanProgress, setColorScanProgress] = useState<string>("");
  const [colorScanResult, setColorScanResult] = useState<ColorScanResult | null>(null);
  const [showStyleQuiz, setShowStyleQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<StyleQuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<StyleQuizResult | null>(null);
  const [showQuizResultModal, setShowQuizResultModal] = useState(false);
  const [confettiAnims] = useState(() => Array.from({ length: 50 }, () => ({
    x: new Animated.Value(Math.random() * Dimensions.get('window').width),
    y: new Animated.Value(-50),
    rotate: new Animated.Value(0),
    opacity: new Animated.Value(1),
    color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][Math.floor(Math.random() * 7)],
  })));
  const [showPronunciationPrompt, setShowPronunciationPrompt] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraGuidance, setCameraGuidance] = useState<CameraGuidance | null>(null);
  const [cameraScanType, setCameraScanType] = useState<'body' | 'color' | null>(null);
  const [countdownIndex, setCountdownIndex] = useState(-1);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [showTipsScreen, setShowTipsScreen] = useState(true);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [showScanReviewModal, setShowScanReviewModal] = useState(false);
  const [pendingScanResult, setPendingScanResult] = useState<{ type: 'body' | 'color'; result: BodyScanResult | ColorScanResult } | null>(null);
  
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

  const totalSteps = 9;
  
  const suggestedShopNames = suggestedRetailers.map(r => r.name);
  const allAvailableShops = (suggestedRetailers.length > 0 
    ? suggestedShopNames
    : POPULAR_SHOPS
  ).sort((a, b) => a.localeCompare(b));
  
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

  const triggerConfetti = useCallback(() => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    confettiAnims.forEach((anim, i) => {
      anim.x.setValue(Math.random() * screenWidth);
      anim.y.setValue(-50);
      anim.rotate.setValue(0);
      anim.opacity.setValue(1);
      
      Animated.parallel([
        Animated.timing(anim.y, {
          toValue: screenHeight + 50,
          duration: 2500 + Math.random() * 1500,
          easing: Easing.linear,
          useNativeDriver: true,
          delay: i * 30,
        }),
        Animated.timing(anim.rotate, {
          toValue: 360 * (2 + Math.random() * 3),
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
          delay: i * 30,
        }),
        Animated.timing(anim.opacity, {
          toValue: 0,
          duration: 3500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          delay: i * 30 + 1500,
        }),
      ]).start();
    });
  }, [confettiAnims]);

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
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to scan your body type.');
          return;
        }
      }

      const guidance = await OnboardingService.getBodyScanGuidance();
      setCameraGuidance(guidance);
      setCameraScanType('body');
      setShowTipsScreen(true);
      setCountdownIndex(-1);
      setIsCountdownActive(false);
      setShowCameraModal(true);
    } catch (error) {
      console.log('Body scan setup error:', error);
      Alert.alert('Setup Failed', 'Unable to prepare body scan. Please try again.');
    }
  }, [cameraPermission, requestCameraPermission]);

  const handleColorScan = useCallback(async () => {
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to analyze your colors.');
          return;
        }
      }

      const guidance = await OnboardingService.getColorScanGuidance();
      setCameraGuidance(guidance);
      setCameraScanType('color');
      setShowTipsScreen(true);
      setCountdownIndex(-1);
      setIsCountdownActive(false);
      setShowCameraModal(true);
    } catch (error: any) {
      console.error('Color scan setup error:', error?.message || error);
      console.error('Color scan full error:', JSON.stringify(error, null, 2));
      Alert.alert('Setup Failed', `Unable to prepare color analysis. ${error?.message || 'Please try again.'}`);
    }
  }, [cameraPermission, requestCameraPermission]);

  const startCountdown = useCallback(() => {
    if (!cameraGuidance?.timer.enabled) {
      capturePhoto();
      return;
    }
    
    setShowTipsScreen(false);
    setIsCountdownActive(true);
    setCountdownIndex(0);
  }, [cameraGuidance]);

  useEffect(() => {
    if (!isCountdownActive || !cameraGuidance) return;
    
    const countdownTexts = cameraGuidance.timer.countdownText;
    if (countdownIndex >= countdownTexts.length - 1) {
      capturePhoto();
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdownIndex(prev => prev + 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [isCountdownActive, countdownIndex, cameraGuidance]);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      
      if (!photo?.base64 || !photo?.uri) {
        Alert.alert('Capture Failed', 'Unable to capture photo. Please try again.');
        return;
      }
      
      setCapturedPhotoUri(photo.uri);
      setShowCameraModal(false);
      setIsCountdownActive(false);
      
      if (cameraScanType === 'body') {
        setIsBodyScanning(true);
        try {
          const scanResult = await OnboardingService.bodyScan(photo.base64);
          
          if (scanResult.review?.showCapturedImage) {
            setPendingScanResult({ type: 'body', result: scanResult });
            setShowScanReviewModal(true);
          } else {
            setBodyScanResult(scanResult);
            if (scanResult.autoFillFields?.bodyType) {
              setBodyShape(scanResult.autoFillFields.bodyType as BodyShape);
            }
            Alert.alert(
              'Body Scan Complete',
              scanResult.message || `Your body type: ${scanResult.bodyType}\nKibbe type: ${scanResult.kibbeBodyType}`,
              [{ text: 'OK' }]
            );
          }
        } finally {
          setIsBodyScanning(false);
        }
      } else if (cameraScanType === 'color') {
        setIsColorScanning(true);
        setColorScanProgress("Uploading photo...");
        
        const progressStages = [
          { message: "Analyzing skin tone...", delay: 2000 },
          { message: "Detecting undertones...", delay: 5000 },
          { message: "Determining color season...", delay: 10000 },
          { message: "Generating your palette...", delay: 18000 },
          { message: "Finalizing recommendations...", delay: 30000 },
          { message: "Almost there...", delay: 45000 },
        ];
        
        const progressTimers: NodeJS.Timeout[] = [];
        progressStages.forEach((stage) => {
          const timer = setTimeout(() => {
            setColorScanProgress(stage.message);
          }, stage.delay);
          progressTimers.push(timer);
        });
        
        try {
          const scanResult = await OnboardingService.colorScan(photo.base64);
          
          progressTimers.forEach(timer => clearTimeout(timer));
          setColorScanProgress("");
          
          if (scanResult.review?.showCapturedImage) {
            setPendingScanResult({ type: 'color', result: scanResult });
            setShowScanReviewModal(true);
          } else {
            setColorScanResult(scanResult);
            Alert.alert(
              'Color Analysis Complete',
              scanResult.message || `You're a ${scanResult.colorSeasonType} ${scanResult.seasonSubtype}!\n\nPower colors: ${scanResult.colorPalette.powerColors.slice(0, 3).join(', ')}`,
              [{ text: 'OK' }]
            );
          }
        } finally {
          progressTimers.forEach(timer => clearTimeout(timer));
          setColorScanProgress("");
          setIsColorScanning(false);
        }
      }
    } catch (error) {
      console.log('Photo capture error:', error);
      Alert.alert('Capture Failed', 'Unable to analyze photo. Please try again.');
      setIsBodyScanning(false);
      setIsColorScanning(false);
    }
  }, [cameraScanType]);

  const handleConfirmScanResult = useCallback(() => {
    if (!pendingScanResult) return;
    
    if (pendingScanResult.type === 'body') {
      const result = pendingScanResult.result as BodyScanResult;
      setBodyScanResult(result);
      if (result.autoFillFields?.bodyType) {
        setBodyShape(result.autoFillFields.bodyType as BodyShape);
      }
    } else {
      setColorScanResult(pendingScanResult.result as ColorScanResult);
    }
    
    setShowScanReviewModal(false);
    setPendingScanResult(null);
    setCapturedPhotoUri(null);
  }, [pendingScanResult]);
  
  const handleRetakeScan = useCallback(() => {
    setShowScanReviewModal(false);
    setPendingScanResult(null);
    setCapturedPhotoUri(null);
    setShowTipsScreen(true);
    setShowCameraModal(true);
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
        
        setShowQuizResultModal(true);
        if (result.celebration?.showConfetti) {
          setTimeout(() => triggerConfetti(), 300);
        }
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
  }, [quizAnswers, triggerConfetti]);

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
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus !== 'granted') {
      Alert.alert(
        'Find Your Country',
        'We use your location once to detect your country for local fashion trends and stores. Your exact location is never stored.',
        [
          { text: 'Select Manually', style: 'cancel' },
          { 
            text: 'Use Location', 
            onPress: async () => {
              setIsDetectingLocation(true);
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  return;
                }
                await fetchLocationAndSetCountry();
              } finally {
                setIsDetectingLocation(false);
              }
            }
          }
        ]
      );
      return;
    }
    
    setIsDetectingLocation(true);
    try {
      await fetchLocationAndSetCountry();
    } finally {
      setIsDetectingLocation(false);
    }
  }, []);

  const fetchLocationAndSetCountry = useCallback(async () => {
    try {
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
      bodyMeasurements: {
        height: bodyHeight,
        heightUnit: bodyHeightUnit,
        weight: bodyWeight,
        weightUnit: bodyWeightUnit,
      },
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
        culturalStyle: {
          dressCodePreference,
          religiousOrCulturalDressCode: dressCodePreference === "other" ? religiousOrCulturalDressCode || null : null,
          subcultureStyle,
          subcultureDescription: subcultureStyle === "other" ? subcultureDescription || null : null,
          dressCodeStrictness,
        },
        bodyFitPreferences: {
          fitPreference,
          confidentAreas,
          preferToMinimize,
        },
        colorChoices: {
          favoriteColors,
          avoidColors,
        },
      },
    });
    navigation.replace("OnboardingQuiz");
  };

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    if (scrollableHeight > 50) {
      setShowScrollIndicator(true);
      const progress = Math.min(Math.max(contentOffset.y / scrollableHeight, 0), 1);
      setScrollProgress(progress);
    } else {
      setShowScrollIndicator(false);
    }
  }, []);

  const resetScrollProgress = useCallback(() => {
    setScrollProgress(0);
    setShowScrollIndicator(false);
  }, []);

  useEffect(() => {
    resetScrollProgress();
  }, [step, resetScrollProgress]);

  const ScrollProgressIndicator = () => {
    if (!showScrollIndicator) return null;
    return (
      <View style={[styles.scrollProgressContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <View 
          style={[
            styles.scrollProgressBar, 
            { 
              backgroundColor: theme.link,
              height: `${Math.max(scrollProgress * 100, 10)}%`,
            }
          ]} 
        />
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={[styles.countryTitle, isRTL && { textAlign: 'right' }]}>
              {translations.onboarding.steps.location.title}
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
            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map((g) => {
                  const genderColor = GENDER_COLORS[g.id];
                  const isSelected = gender === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setGender(g.id)}
                      style={({ pressed }) => [
                        styles.genderOption,
                        {
                          backgroundColor: genderColor.bg,
                          borderColor: isSelected ? "#FFFFFF" : genderColor.border,
                          borderWidth: isSelected ? 3 : 2,
                          opacity: pressed ? 0.85 : 1,
                          shadowColor: genderColor.border,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.4,
                          shadowRadius: 8,
                          elevation: 6,
                        },
                      ]}
                    >
                      <Feather
                        name={g.icon}
                        size={24}
                        color={genderColor.icon}
                      />
                      <ThemedText
                        type="h3"
                        style={{
                          color: "#FFFFFF",
                        }}
                      >
                        {g.name}
                      </ThemedText>
                      {isSelected ? (
                        <View style={[styles.checkCircleSmall, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                          <Feather name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Your Body Measurements
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Optional but helps us find your perfect fit
            </ThemedText>
            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.measurementFormContainer}>
                <View style={styles.measurementRow}>
                  <ThemedText type="body" style={styles.measurementLabel}>Height</ThemedText>
                  <View style={styles.measurementInputRow}>
                    <TextInput
                      style={[
                        styles.measurementInput,
                        { 
                          backgroundColor: theme.backgroundSecondary,
                          color: theme.text,
                        }
                      ]}
                      value={bodyHeight?.toString() || ''}
                      onChangeText={(text) => setBodyHeight(text ? parseFloat(text) : null)}
                      keyboardType="numeric"
                      placeholder={bodyHeightUnit === 'cm' ? "175" : "5.9"}
                      placeholderTextColor={theme.tabIconDefault}
                    />
                    <View style={styles.unitToggleRow}>
                      <Pressable
                        style={[
                          styles.unitButton,
                          bodyHeightUnit === 'cm' && { backgroundColor: theme.link }
                        ]}
                        onPress={() => setBodyHeightUnit('cm')}
                      >
                        <ThemedText 
                          type="small" 
                          style={[
                            styles.unitButtonText,
                            bodyHeightUnit === 'cm' && { color: '#FFFFFF' }
                          ]}
                        >
                          cm
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.unitButton,
                          bodyHeightUnit === 'ft' && { backgroundColor: theme.link }
                        ]}
                        onPress={() => setBodyHeightUnit('ft')}
                      >
                        <ThemedText 
                          type="small"
                          style={[
                            styles.unitButtonText,
                            bodyHeightUnit === 'ft' && { color: '#FFFFFF' }
                          ]}
                        >
                          ft
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.measurementRow}>
                  <ThemedText type="body" style={styles.measurementLabel}>Weight</ThemedText>
                  <View style={styles.measurementInputRow}>
                    <TextInput
                      style={[
                        styles.measurementInput,
                        { 
                          backgroundColor: theme.backgroundSecondary,
                          color: theme.text,
                        }
                      ]}
                      value={bodyWeight?.toString() || ''}
                      onChangeText={(text) => setBodyWeight(text ? parseFloat(text) : null)}
                      keyboardType="numeric"
                      placeholder={bodyWeightUnit === 'kg' ? "70" : "154"}
                      placeholderTextColor={theme.tabIconDefault}
                    />
                    <View style={styles.unitToggleRow}>
                      <Pressable
                        style={[
                          styles.unitButton,
                          bodyWeightUnit === 'kg' && { backgroundColor: theme.link }
                        ]}
                        onPress={() => setBodyWeightUnit('kg')}
                      >
                        <ThemedText 
                          type="small" 
                          style={[
                            styles.unitButtonText,
                            bodyWeightUnit === 'kg' && { color: '#FFFFFF' }
                          ]}
                        >
                          kg
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.unitButton,
                          bodyWeightUnit === 'lbs' && { backgroundColor: theme.link }
                        ]}
                        onPress={() => setBodyWeightUnit('lbs')}
                      >
                        <ThemedText 
                          type="small"
                          style={[
                            styles.unitButtonText,
                            bodyWeightUnit === 'lbs' && { color: '#FFFFFF' }
                          ]}
                        >
                          lbs
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.measurementNote}>
                  <Feather name="info" size={16} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: Spacing.xs, flex: 1 }}>
                    This helps us recommend clothing that fits you perfectly. You can skip this step if you prefer.
                  </ThemedText>
                </View>

                <Pressable
                  style={[styles.bodyProfileButton, { backgroundColor: theme.link }]}
                  onPress={() => navigation.navigate('StyleQuizOnboarding')}
                >
                  <Feather name="user" size={20} color="#FFFFFF" />
                  <View style={styles.bodyProfileButtonText}>
                    <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      Complete Body Profile Quiz
                    </ThemedText>
                    <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      13 questions about your shape, fit, brands & more
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </ScrollView>
          </View>
        );

      case 3:
        const stylists = getAllStylists();
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Meet Your Personal Stylist
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Choose who will guide your fashion journey
            </ThemedText>
            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
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

      case 4:
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
              <ScrollProgressIndicator />
              <ScrollView 
                style={styles.optionsScroll} 
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
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
            
            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.styleOptions}>
                {styleOptions.map((s) => {
                  const styleColor = STYLE_COLORS[s.id] || { bg: "#374151", border: "#6B7280" };
                  const isSelected = stylePreference === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setStylePreference(s.id)}
                      style={({ pressed }) => [
                        styles.styleOption,
                        {
                          backgroundColor: styleColor.bg,
                          borderColor: isSelected ? "#FFFFFF" : styleColor.border,
                          borderWidth: isSelected ? 3 : 2,
                          opacity: pressed ? 0.85 : 1,
                          shadowColor: styleColor.border,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.4,
                          shadowRadius: 8,
                          elevation: 6,
                        },
                      ]}
                    >
                      <Image
                        source={getStyleImage(s.id)}
                        style={styles.styleImagePreview}
                        resizeMode="cover"
                      />
                      <View style={styles.styleTextContainer}>
                        <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
                          {s.name}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                        >
                          {s.description}
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

      case 5:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Tell us more (optional)
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Help us personalize your recommendations
            </ThemedText>
            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
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
                      {isColorScanning 
                        ? 'Analyzing...' 
                        : colorScanResult 
                          ? 'Color Analysis Complete' 
                          : 'AI Color Analysis'}
                    </ThemedText>
                    <ThemedText type="small" style={{ opacity: 0.7 }}>
                      {isColorScanning && colorScanProgress
                        ? colorScanProgress
                        : colorScanResult 
                          ? `${colorScanResult.colorSeasonType} ${colorScanResult.seasonSubtype}`
                          : 'Selfie to find your best colors'}
                    </ThemedText>
                  </View>
                  {colorScanResult ? (
                    <Feather name="check-circle" size={20} color={theme.link} />
                  ) : isColorScanning ? null : (
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
                  {SIZE_OPTIONS.map((size) => {
                    const sizeColor = SIZE_COLORS[size] || { bg: "#374151", border: "#6B7280" };
                    const isSelected = sizeRange === size;
                    return (
                      <Pressable
                        key={size}
                        onPress={() => setSizeRange(sizeRange === size ? null : size)}
                        style={({ pressed }) => [
                          styles.optionChip,
                          {
                            backgroundColor: sizeColor.bg,
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected ? "#FFFFFF" : sizeColor.border,
                            opacity: pressed ? 0.85 : 1,
                            shadowColor: sizeColor.border,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                            elevation: 4,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{
                            color: "#FFFFFF",
                          }}
                        >
                          {size}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Body Shape
                </ThemedText>
                <View style={styles.bodyShapeOptions}>
                  {getBodyShapeOptions().map((shape) => {
                    const shapeColor = BODY_SHAPE_COLORS[shape.id] || { bg: "#374151", border: "#6B7280" };
                    const isSelected = bodyShape === shape.id;
                    return (
                      <Pressable
                        key={shape.id}
                        onPress={() =>
                          setBodyShape(bodyShape === shape.id ? null : shape.id)
                        }
                        style={({ pressed }) => [
                          styles.bodyShapeOption,
                          {
                            backgroundColor: shapeColor.bg,
                            borderColor: isSelected ? "#FFFFFF" : shapeColor.border,
                            borderWidth: isSelected ? 3 : 2,
                            opacity: pressed ? 0.85 : 1,
                            shadowColor: shapeColor.border,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.4,
                            shadowRadius: 8,
                            elevation: 6,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{
                            color: "#FFFFFF",
                            fontWeight: "600",
                          }}
                        >
                          {shape.name}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          {shape.description}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Fit Preference
                </ThemedText>
                <View style={styles.optionsRow}>
                  {FIT_PREFERENCE_OPTIONS.map((fit) => {
                    const isSelected = fitPreference === fit.id;
                    return (
                      <Pressable
                        key={fit.id}
                        onPress={() => setFitPreference(fitPreference === fit.id ? null : fit.id)}
                        style={({ pressed }) => [
                          styles.optionChip,
                          {
                            backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="body"
                          style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                        >
                          {fit.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Areas You Feel Confident About
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                  Select all that apply - stylists will highlight these
                </ThemedText>
                <View style={styles.multiSelectGrid}>
                  {CONFIDENT_AREAS.map((area) => {
                    const isSelected = confidentAreas.includes(area);
                    return (
                      <Pressable
                        key={area}
                        onPress={() => {
                          if (isSelected) {
                            setConfidentAreas(confidentAreas.filter(a => a !== area));
                          } else {
                            setConfidentAreas([...confidentAreas, area]);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.multiSelectChip,
                          {
                            backgroundColor: isSelected ? '#10B981' : theme.backgroundDefault,
                            borderColor: isSelected ? '#10B981' : theme.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                        >
                          {area}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Areas to Minimize
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                  Stylists will suggest flattering options for these
                </ThemedText>
                <View style={styles.multiSelectGrid}>
                  {MINIMIZE_AREAS.map((area) => {
                    const isSelected = preferToMinimize.includes(area);
                    return (
                      <Pressable
                        key={area}
                        onPress={() => {
                          if (isSelected) {
                            setPreferToMinimize(preferToMinimize.filter(a => a !== area));
                          } else {
                            setPreferToMinimize([...preferToMinimize, area]);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.multiSelectChip,
                          {
                            backgroundColor: isSelected ? '#F97316' : theme.backgroundDefault,
                            borderColor: isSelected ? '#F97316' : theme.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                        >
                          {area}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setPreferToMinimize([])}
                    style={({ pressed }) => [
                      styles.multiSelectChip,
                      {
                        backgroundColor: preferToMinimize.length === 0 ? '#22C55E' : theme.backgroundDefault,
                        borderColor: preferToMinimize.length === 0 ? '#22C55E' : theme.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: preferToMinimize.length === 0 ? "#FFFFFF" : theme.text }}
                    >
                      I'm happy with everything!
                    </ThemedText>
                  </Pressable>
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

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Favorite Colors
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                  Select colors you love to wear
                </ThemedText>
                <View style={styles.colorGrid}>
                  {FAVORITE_COLORS.map((color) => {
                    const isSelected = favoriteColors.includes(color.hex);
                    return (
                      <Pressable
                        key={color.hex}
                        onPress={() => {
                          if (isSelected) {
                            setFavoriteColors(favoriteColors.filter(c => c !== color.hex));
                          } else {
                            setFavoriteColors([...favoriteColors, color.hex]);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.colorSwatch,
                          {
                            backgroundColor: color.hex,
                            borderWidth: isSelected ? 3 : 1,
                            borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Feather name="check" size={16} color={color.hex === '#FFFFFF' ? '#000000' : '#FFFFFF'} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Colors to Avoid
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                  Stylists will skip these in recommendations
                </ThemedText>
                <View style={styles.multiSelectGrid}>
                  {AVOID_COLORS.map((colorName) => {
                    const isSelected = avoidColors.includes(colorName);
                    const isOpenToAll = colorName === "I'm open to all colors!";
                    return (
                      <Pressable
                        key={colorName}
                        onPress={() => {
                          if (isOpenToAll) {
                            setAvoidColors([colorName]);
                          } else if (isSelected) {
                            setAvoidColors(avoidColors.filter(c => c !== colorName));
                          } else {
                            setAvoidColors([...avoidColors.filter(c => c !== "I'm open to all colors!"), colorName]);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.multiSelectChip,
                          {
                            backgroundColor: isSelected ? (isOpenToAll ? '#22C55E' : '#EF4444') : theme.backgroundDefault,
                            borderColor: isSelected ? (isOpenToAll ? '#22C55E' : '#EF4444') : theme.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                        >
                          {colorName}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Where do you shop?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              {suggestedRetailers.length > 0 
                ? `Select up to 10 of your favorites`
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

            {suggestedRetailers.length > 0 && !loadingRetailers ? (
              <View style={[styles.aiSuggestionHint, { backgroundColor: theme.link + '10', borderColor: theme.link + '30' }]}>
                <Feather name="zap" size={14} color={theme.link} />
                <ThemedText type="small" style={{ color: theme.link, marginLeft: Spacing.xs, flex: 1 }}>
                  AI-curated stores that ship to or operate in {country}
                </ThemedText>
              </View>
            ) : null}

            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.shopsGrid}>
                {filteredShops.map((shop) => {
                  const isDisabled = favoriteShops.length >= 10;
                  const category = getRetailerCategory(shop);
                  const shopColor = SHOP_CATEGORY_COLORS[category || "default"] || SHOP_CATEGORY_COLORS["default"];
                  return (
                    <Pressable
                      key={shop}
                      onPress={() => toggleShop(shop)}
                      disabled={isDisabled}
                      style={({ pressed }) => [
                        styles.shopChip,
                        {
                          backgroundColor: shopColor.bg,
                          borderWidth: 1,
                          borderColor: shopColor.border,
                          opacity: isDisabled ? 0.4 : (pressed ? 0.85 : 1),
                          shadowColor: shopColor.border,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                          elevation: 3,
                        },
                      ]}
                    >
                      <ThemedText type="small" style={{ color: "#FFFFFF", opacity: isDisabled ? 0.5 : 1 }}>{shop}</ThemedText>
                      {category ? (
                        <ThemedText type="small" style={{ color: "rgba(255,255,255,0.6)", marginLeft: 4, fontSize: 10 }}>
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

      case 7:
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

            <ScrollProgressIndicator />
            <ScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
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

      case 8: {
        const DRESS_CODE_OPTIONS: { id: DressCodePreference; name: string; description: string; icon: keyof typeof Feather.glyphMap }[] = [
          { id: "hijab-friendly", name: "Hijab-Friendly", description: "Modest fashion with hijab considerations", icon: "heart" },
          { id: "tzniut", name: "Tzniut (Jewish Modesty)", description: "Traditional Jewish modesty standards", icon: "heart" },
          { id: "lds-modest", name: "LDS Modest", description: "Modest clothing following LDS guidelines", icon: "heart" },
          { id: "hindu-traditional", name: "Hindu Traditional", description: "Traditional Indian/Hindu attire options", icon: "heart" },
          { id: "sikh", name: "Sikh", description: "Attire compatible with Sikh practices", icon: "heart" },
          { id: "modest-general", name: "Modest (General)", description: "Generally modest clothing preferences", icon: "heart" },
          { id: "other", name: "Other", description: "Tell us about your religious or cultural dress code", icon: "edit-2" },
        ];

        const SUBCULTURE_OPTIONS: { id: SubcultureStyle; name: string; icon: keyof typeof Feather.glyphMap }[] = [
          { id: "goth", name: "Goth", icon: "moon" },
          { id: "punk", name: "Punk", icon: "zap" },
          { id: "cottagecore", name: "Cottagecore", icon: "sun" },
          { id: "dark-academia", name: "Dark Academia", icon: "book" },
          { id: "light-academia", name: "Light Academia", icon: "book-open" },
          { id: "y2k", name: "Y2K", icon: "star" },
          { id: "vintage", name: "Vintage", icon: "clock" },
          { id: "grunge", name: "Grunge", icon: "music" },
          { id: "streetwear", name: "Streetwear", icon: "trending-up" },
          { id: "old-money", name: "Old Money", icon: "dollar-sign" },
          { id: "clean-girl", name: "Clean Girl", icon: "droplet" },
          { id: "other", name: "Other", icon: "edit-2" },
        ];

        const STRICTNESS_OPTIONS: { id: DressCodeStrictness; name: string; description: string }[] = [
          { id: "flexible", name: "Flexible", description: "General guidance, occasional exceptions okay" },
          { id: "moderate", name: "Moderate", description: "Follow guidelines with some flexibility" },
          { id: "strict", name: "Strict", description: "Always follow dress code requirements" },
        ];

        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              {gender === 'man' ? "Style & Cultural Preferences" : "Style & Cultural Preferences"}
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              {gender === 'man' 
                ? "Help Ruby & Max understand your style boundaries (optional)"
                : "Help Ruby & Max respect your style and cultural preferences (optional)"}
            </ThemedText>

            <ScrollProgressIndicator />
            <KeyboardAwareScrollView 
              style={styles.optionsScroll} 
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              bottomOffset={200}
            >
              <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
                Religious/Modest Dress Code
              </ThemedText>
              <View style={styles.goalsContainer}>
                {DRESS_CODE_OPTIONS.map((option) => {
                  const isSelected = dressCodePreference === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setDressCodePreference(option.id)}
                      style={({ pressed }) => [
                        styles.goalOption,
                        {
                          backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                          borderColor: isSelected ? theme.link : theme.backgroundSecondary,
                          opacity: pressed ? 0.8 : 1,
                          paddingVertical: Spacing.sm,
                        },
                      ]}
                    >
                      <Feather
                        name={option.icon}
                        size={20}
                        color={isSelected ? "#FFFFFF" : theme.text}
                      />
                      <View style={styles.goalTextContainer}>
                        <ThemedText
                          type="body"
                          style={{ color: isSelected ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                        >
                          {option.name}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: isSelected ? "rgba(255,255,255,0.8)" : theme.tabIconDefault }}
                        >
                          {option.description}
                        </ThemedText>
                      </View>
                      {isSelected ? (
                        <View style={[styles.checkCircle, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                          <Feather name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {dressCodePreference === "other" ? (
                <View style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}>
                  <TextInput
                    style={{
                      backgroundColor: theme.backgroundDefault,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: BorderRadius.lg,
                      padding: Spacing.md,
                      color: theme.text,
                      minHeight: 100,
                    }}
                    placeholder="e.g., Amish Plain Dress, Buddhist robes, Rastafarian..."
                    placeholderTextColor={theme.tabIconDefault}
                    value={religiousOrCulturalDressCode}
                    onChangeText={setReligiousOrCulturalDressCode}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText type="small" style={{ marginTop: Spacing.xs, color: theme.tabIconDefault, marginBottom: Spacing.lg }}>
                    Our AI will research this to give you appropriate suggestions
                  </ThemedText>
                </View>
              ) : null}

              {dressCodePreference && dressCodePreference !== "none" ? (
                <>
                  <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                    How strictly should we follow this?
                  </ThemedText>
                  <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg }}>
                    {STRICTNESS_OPTIONS.map((option) => {
                      const isSelected = dressCodeStrictness === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => setDressCodeStrictness(option.id)}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              padding: Spacing.md,
                              borderRadius: BorderRadius.lg,
                              backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                              borderWidth: 1,
                              borderColor: isSelected ? theme.link : theme.backgroundSecondary,
                              alignItems: "center",
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <ThemedText
                            type="body"
                            style={{ color: isSelected ? "#FFFFFF" : theme.text, fontWeight: "600", marginBottom: 4 }}
                          >
                            {option.name}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={{ color: isSelected ? "rgba(255,255,255,0.8)" : theme.tabIconDefault, textAlign: "center" }}
                          >
                            {option.description}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <ThemedText type="h3" style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
                Subculture/Aesthetic Style
              </ThemedText>
              <ThemedText type="small" style={{ marginBottom: Spacing.md, color: theme.tabIconDefault }}>
                Optional: If you identify with a specific fashion subculture
              </ThemedText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md }}>
                {SUBCULTURE_OPTIONS.map((option) => {
                  const isSelected = subcultureStyle === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setSubcultureStyle(option.id)}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: BorderRadius.full,
                          backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                          borderWidth: 1,
                          borderColor: isSelected ? theme.link : theme.backgroundSecondary,
                          gap: Spacing.xs,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name={option.icon}
                        size={16}
                        color={isSelected ? "#FFFFFF" : theme.text}
                      />
                      <ThemedText
                        type="small"
                        style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                      >
                        {option.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {subcultureStyle === "other" ? (
                <View style={{ marginBottom: Spacing["2xl"] }}>
                  <TextInput
                    style={{
                      backgroundColor: theme.backgroundDefault,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: BorderRadius.lg,
                      padding: Spacing.md,
                      color: theme.text,
                      minHeight: 100,
                    }}
                    placeholder="e.g., Afrofuturism, Normcore, Gorpcore..."
                    placeholderTextColor={theme.tabIconDefault}
                    value={subcultureDescription}
                    onChangeText={setSubcultureDescription}
                    multiline
                    textAlignVertical="top"
                  />
                  <ThemedText type="small" style={{ marginTop: Spacing.xs, color: theme.tabIconDefault, marginBottom: Spacing.lg }}>
                    Our AI will research this to understand your aesthetic
                  </ThemedText>
                </View>
              ) : null}
            </KeyboardAwareScrollView>
          </View>
        );
      }

      default:
        return null;
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.headerBackButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
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
            {translations.common.skip}
          </ThemedText>
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {renderStep()}

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <Button onPress={handleNext} style={styles.nextButton}>
            {step === totalSteps - 1 ? translations.common.done : translations.common.continue}
          </Button>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showQuizResultModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowQuizResultModal(false);
          setStep(prev => prev + 1);
        }}
      >
        <View style={styles.quizResultModalOverlay}>
          {confettiAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.confettiPiece,
                {
                  backgroundColor: anim.color,
                  transform: [
                    { translateX: anim.x },
                    { translateY: anim.y },
                    { rotate: anim.rotate.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    })},
                  ],
                  opacity: anim.opacity,
                },
              ]}
            />
          ))}
          
          <View style={[styles.quizResultModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.quizResultScrollContent}
            >
              {quizResult?.celebration ? (
                <View style={styles.celebrationHeader}>
                  <ThemedText style={styles.celebrationEmoji}>
                    {quizResult.celebration.emoji}
                  </ThemedText>
                  <ThemedText type="h1" style={styles.celebrationTitle}>
                    {quizResult.celebration.title}
                  </ThemedText>
                  <ThemedText type="body" style={[styles.celebrationSubtitle, { color: theme.tabIconDefault }]}>
                    {quizResult.celebration.subtitle}
                  </ThemedText>
                  <View style={[styles.matchBadge, { backgroundColor: theme.link + '20' }]}>
                    <ThemedText type="caption" style={{ color: theme.link }}>
                      {quizResult.celebration.matchMessage}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {quizResult?.styleBlend ? (
                <View style={styles.styleBlendSection}>
                  <ThemedText type="h2" style={styles.styleBlendHeadline}>
                    {quizResult.styleBlend.headline}
                  </ThemedText>
                  <ThemedText type="body" style={[styles.styleBlendSubheadline, { color: theme.tabIconDefault }]}>
                    {quizResult.styleBlend.subheadline}
                  </ThemedText>
                  
                  <ThemedText type="body" style={styles.styleBlendDescription}>
                    {quizResult.styleBlend.description}
                  </ThemedText>
                  
                  <View style={[styles.superpowerCard, { backgroundColor: theme.link + '15' }]}>
                    <Feather name="zap" size={18} color={theme.link} />
                    <ThemedText type="body" style={[styles.superpowerText, { color: theme.link }]}>
                      {quizResult.styleBlend.superpower}
                    </ThemedText>
                  </View>

                  <View style={styles.vibesContainer}>
                    {quizResult.styleBlend.vibes.map((vibe, i) => (
                      <View key={i} style={[styles.vibeBadge, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText type="caption">{vibe}</ThemedText>
                      </View>
                    ))}
                  </View>

                  <View style={styles.perfectForSection}>
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                      Perfect For
                    </ThemedText>
                    <ThemedText type="body">
                      {quizResult.styleBlend.perfectFor.join(' • ')}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {quizResult?.quickStats ? (
                <View style={[styles.quickStatsSection, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={styles.quickStatRow}>
                    <Feather name="star" size={16} color={theme.link} />
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: Spacing.sm }}>
                      Key Pieces: {quizResult.quickStats.keyPieces.join(', ')}
                    </ThemedText>
                  </View>
                  <View style={styles.quickStatRow}>
                    <Feather name="droplet" size={16} color={theme.link} />
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: Spacing.sm }}>
                      Colors: {quizResult.quickStats.colors.join(', ')}
                    </ThemedText>
                  </View>
                  <View style={styles.quickStatRow}>
                    <Feather name="users" size={16} color={theme.link} />
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: Spacing.sm }}>
                      Style Icons: {quizResult.quickStats.icons.join(', ')}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {quizResult?.styleBlend?.funFact ? (
                <View style={[styles.funFactCard, { borderColor: theme.link + '40' }]}>
                  <Feather name="info" size={16} color={theme.link} />
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: Spacing.sm, flex: 1 }}>
                    {quizResult.styleBlend.funFact}
                  </ThemedText>
                </View>
              ) : null}

              {quizResult?.quickStats?.stylistTip ? (
                <View style={[styles.stylistTipCard, { backgroundColor: theme.link + '10' }]}>
                  <ThemedText type="caption" style={{ color: theme.link, fontWeight: '600', marginBottom: Spacing.xs }}>
                    Stylist Tip
                  </ThemedText>
                  <ThemedText type="body" style={{ color: theme.text }}>
                    {quizResult.quickStats.stylistTip}
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>

            <Button 
              onPress={() => {
                setShowQuizResultModal(false);
                setStep(prev => prev + 1);
              }}
              style={styles.quizResultContinueBtn}
            >
              {translations.common.continue}
            </Button>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCameraModal}
        animationType="slide"
        onRequestClose={() => {
          setShowCameraModal(false);
          setIsCountdownActive(false);
        }}
      >
        <View style={styles.cameraModalContainer}>
          {showTipsScreen && cameraGuidance ? (
            <View style={[styles.cameraTipsScreen, { backgroundColor: theme.backgroundDefault }]}>
              <View style={[styles.cameraTipsHeader, { paddingTop: insets.top + Spacing.lg }]}>
                <Pressable
                  onPress={() => setShowCameraModal(false)}
                  style={styles.cameraCloseBtn}
                >
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
                <ThemedText type="h2" style={{ flex: 1, textAlign: 'center' }}>
                  {cameraScanType === 'body' ? 'Body Scan' : 'Color Analysis'}
                </ThemedText>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView 
                style={styles.cameraTipsContent}
                contentContainerStyle={{ paddingBottom: Spacing.xl }}
              >
                {cameraGuidance.overlay ? (
                  <View style={[styles.overlayPreview, { backgroundColor: theme.backgroundSecondary }]}>
                    {cameraGuidance.overlay.type === 'body-silhouette' ? (
                      <View style={styles.bodySilhouetteContainer}>
                        <View style={[styles.bodySilhouetteHead, { borderColor: theme.link }]} />
                        <View style={[styles.bodySilhouetteBody, { borderColor: theme.link }]} />
                        <View style={styles.bodySilhouetteLegsRow}>
                          <View style={[styles.bodySilhouetteLeg, { borderColor: theme.link }]} />
                          <View style={[styles.bodySilhouetteLeg, { borderColor: theme.link }]} />
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.faceOvalPreview, { borderColor: theme.link }]} />
                    )}
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.md, textAlign: 'center' }}>
                      {cameraGuidance.overlay.guideText?.middle || cameraGuidance.overlay.targetZoneLabel || 'Position yourself in the frame'}
                    </ThemedText>
                  </View>
                ) : null}

                {cameraGuidance.positioning ? (
                  <View style={styles.positioningInfo}>
                    <Feather name="move" size={20} color={theme.link} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                      {cameraGuidance.positioning.distance}
                    </ThemedText>
                  </View>
                ) : null}

                {cameraGuidance.tipsSimple && cameraGuidance.tipsSimple.length > 0 ? (
                  <>
                    <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Tips</ThemedText>
                    {cameraGuidance.tipsSimple.map((tip, i) => (
                      <View key={i} style={styles.tipItem}>
                        <Feather name="check-circle" size={18} color={theme.link} />
                        <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                          {tip}
                        </ThemedText>
                      </View>
                    ))}
                  </>
                ) : null}
              </ScrollView>

              <View style={[styles.cameraTipsFooter, { paddingBottom: insets.bottom + Spacing.xl }]}>
                <Button onPress={startCountdown}>
                  {cameraGuidance.timer?.enabled 
                    ? `Start ${cameraGuidance.timer.durationSeconds}s Timer` 
                    : 'Take Photo'}
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.cameraViewContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.cameraView}
                facing="front"
              >
                <View style={[styles.cameraOverlay, { paddingTop: insets.top }]}>
                  <Pressable
                    onPress={() => {
                      setShowCameraModal(false);
                      setIsCountdownActive(false);
                    }}
                    style={styles.cameraCloseBtn}
                  >
                    <Feather name="x" size={24} color="#FFFFFF" />
                  </Pressable>
                </View>

                {cameraGuidance?.overlay ? (
                  <View style={styles.cameraGuideOverlay}>
                    {cameraGuidance.overlay.guideText?.top ? (
                      <ThemedText style={styles.guideTextTop}>
                        {cameraGuidance.overlay.guideText.top}
                      </ThemedText>
                    ) : null}
                    
                    <View style={[
                      cameraGuidance.overlay.type === 'body-silhouette' 
                        ? styles.bodySilhouetteOverlay 
                        : styles.faceOvalOverlay
                    ]} />
                    
                    {cameraGuidance.overlay.guideText?.middle ? (
                      <ThemedText style={styles.guideTextMiddle}>
                        {cameraGuidance.overlay.guideText.middle}
                      </ThemedText>
                    ) : null}
                    
                    {cameraGuidance.overlay.guideText?.bottom ? (
                      <ThemedText style={styles.guideTextBottom}>
                        {cameraGuidance.overlay.guideText.bottom}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}

                {isCountdownActive && cameraGuidance?.timer?.countdownText ? (
                  <View style={styles.countdownContainer}>
                    <ThemedText style={styles.countdownText}>
                      {cameraGuidance.timer.countdownText[countdownIndex] || ''}
                    </ThemedText>
                  </View>
                ) : null}
              </CameraView>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={showScanReviewModal}
        animationType="slide"
        onRequestClose={() => setShowScanReviewModal(false)}
      >
        <ThemedView style={styles.scanReviewModal}>
          <View style={[styles.scanReviewHeader, { paddingTop: insets.top + Spacing.lg }]}>
            <Pressable
              onPress={() => {
                setShowScanReviewModal(false);
                setPendingScanResult(null);
                setCapturedPhotoUri(null);
              }}
              style={styles.cameraCloseBtn}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h2" style={{ flex: 1, textAlign: 'center' }}>
              {pendingScanResult?.type === 'body' ? 'Body Scan Results' : 'Color Analysis Results'}
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={styles.scanReviewContent}
          >
            {capturedPhotoUri ? (
              <View style={styles.capturedPhotoContainer}>
                <Image 
                  source={{ uri: capturedPhotoUri }} 
                  style={styles.capturedPhoto}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {pendingScanResult?.type === 'body' ? (
              <View style={styles.scanResultDetails}>
                <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                  {(pendingScanResult.result as BodyScanResult).bodyType}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.md }}>
                  Kibbe: {(pendingScanResult.result as BodyScanResult).kibbeBodyType}
                </ThemedText>
                <ThemedText type="body" style={{ marginBottom: Spacing.lg }}>
                  {(pendingScanResult.result as BodyScanResult).affirmation}
                </ThemedText>
                
                <View style={[styles.scanResultCard, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText type="caption" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
                    Style Recommendations
                  </ThemedText>
                  {(pendingScanResult.result as BodyScanResult).kibbeStyleRecommendations.slice(0, 3).map((rec, i) => (
                    <View key={i} style={styles.tipItem}>
                      <Feather name="check" size={16} color={theme.link} />
                      <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                        {rec}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View style={[styles.colorSeasonTip, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.md }]}>
                  <Feather name="info" size={14} color={theme.link} style={{ marginRight: Spacing.sm }} />
                  <ThemedText type="caption" style={{ flex: 1, color: theme.tabIconDefault }}>
                    Results are based on visible proportions in your photo. For best accuracy, retake with form-fitting clothes and your full body visible from head to feet.
                  </ThemedText>
                </View>
              </View>
            ) : pendingScanResult?.type === 'color' ? (
              <View style={styles.scanResultDetails}>
                <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                  {(pendingScanResult.result as ColorScanResult).colorSeasonType} {(pendingScanResult.result as ColorScanResult).seasonSubtype}
                </ThemedText>
                <ThemedText type="body" style={{ marginBottom: Spacing.md }}>
                  {(pendingScanResult.result as ColorScanResult).message}
                </ThemedText>
                <View style={[styles.colorSeasonTip, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="info" size={14} color={theme.link} style={{ marginRight: Spacing.sm }} />
                  <ThemedText type="caption" style={{ flex: 1, color: theme.tabIconDefault }}>
                    {user?.gender?.toLowerCase() === 'man' || user?.gender?.toLowerCase() === 'male'
                      ? "Seasonal color analysis is widely used in fashion. You can reference these colors when shopping for clothes, watches, or accessories that complement your natural coloring."
                      : "Seasonal color analysis is widely used in fashion and beauty. You can reference these colors when shopping for clothes, makeup, or accessories that complement your natural coloring."}
                  </ThemedText>
                </View>
                
                <View style={[styles.scanResultCard, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.md }]}>
                  <ThemedText type="caption" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
                    Your Power Colors
                  </ThemedText>
                  <View style={styles.colorSwatchRow}>
                    {(pendingScanResult.result as ColorScanResult).colorPalette.powerColors.slice(0, 5).map((color, i) => {
                      const hexMatch = color.match(/#[0-9A-Fa-f]{6}/);
                      const hexColor = hexMatch ? hexMatch[0] : color.toLowerCase().replace(/\s+/g, '');
                      const colorName = color.replace(/#[0-9A-Fa-f]{6}/g, '').trim();
                      return (
                        <View key={i} style={styles.colorSwatchItem}>
                          <View style={[styles.colorSwatch, { backgroundColor: hexColor }]} />
                          <ThemedText type="caption" style={{ fontSize: 10, textAlign: 'center' }}>
                            {colorName}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.scanReviewFooter, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.scanReviewButtons}>
              <Pressable
                onPress={handleRetakeScan}
                style={[styles.scanReviewSecondaryBtn, { borderColor: theme.link }]}
              >
                <Feather name="refresh-cw" size={18} color={theme.link} />
                <ThemedText type="body" style={{ color: theme.link, marginLeft: Spacing.sm }}>
                  {pendingScanResult?.result.review?.retakeButtonText || 'Retake'}
                </ThemedText>
              </Pressable>
              <Button onPress={handleConfirmScanResult} style={{ flex: 1 }}>
                {pendingScanResult?.result.review?.confirmButtonText || 'Confirm'}
              </Button>
            </View>
          </View>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
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
  headerBackButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  scrollProgressContainer: {
    position: 'absolute',
    right: 4,
    top: 60,
    bottom: 20,
    width: 4,
    borderRadius: 2,
    overflow: 'hidden',
    opacity: 0.6,
  },
  scrollProgressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 2,
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
  multiSelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  multiSelectChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
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
  aiSuggestionHint: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
  quizResultModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  quizResultModalContent: {
    width: "100%",
    maxHeight: "85%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    overflow: "hidden",
  },
  quizResultScrollContent: {
    paddingBottom: Spacing.lg,
  },
  confettiPiece: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  celebrationHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  celebrationTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  celebrationSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  matchBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  styleBlendSection: {
    marginBottom: Spacing.lg,
  },
  styleBlendHeadline: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  styleBlendSubheadline: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  styleBlendDescription: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  superpowerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  superpowerText: {
    flex: 1,
    fontWeight: "600",
  },
  vibesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  vibeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  perfectForSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  quickStatsSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  quickStatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  funFactCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  stylistTipCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  quizResultContinueBtn: {
    marginTop: Spacing.md,
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraTipsScreen: {
    flex: 1,
  },
  cameraTipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTipsContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  overlayPreview: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  bodySilhouettePreview: {
    width: 80,
    height: 160,
    borderWidth: 2,
    borderRadius: 40,
    borderStyle: "dashed",
  },
  bodySilhouetteContainer: {
    alignItems: "center",
  },
  bodySilhouetteHead: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderRadius: 15,
    borderStyle: "dashed",
    marginBottom: 4,
  },
  bodySilhouetteBody: {
    width: 50,
    height: 70,
    borderWidth: 2,
    borderRadius: 8,
    borderStyle: "dashed",
    marginBottom: 4,
  },
  bodySilhouetteLegsRow: {
    flexDirection: "row",
    gap: 6,
  },
  bodySilhouetteLeg: {
    width: 18,
    height: 50,
    borderWidth: 2,
    borderRadius: 6,
    borderStyle: "dashed",
  },
  faceOvalPreview: {
    width: 100,
    height: 130,
    borderWidth: 2,
    borderRadius: 65,
    borderStyle: "dashed",
  },
  positioningInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  cameraTipsFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  cameraViewContainer: {
    flex: 1,
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  cameraGuideOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  bodySilhouetteOverlay: {
    width: 150,
    height: 350,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 75,
    borderStyle: "dashed",
  },
  faceOvalOverlay: {
    width: 200,
    height: 260,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 130,
    borderStyle: "dashed",
  },
  guideTextTop: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: Spacing.lg,
  },
  guideTextMiddle: {
    color: "#FFFFFF",
    fontSize: 14,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginTop: Spacing.lg,
  },
  guideTextBottom: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginTop: Spacing.lg,
  },
  countdownContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  countdownText: {
    color: "#FFFFFF",
    fontSize: 72,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  scanReviewModal: {
    flex: 1,
  },
  scanReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  scanReviewContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  capturedPhotoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  capturedPhoto: {
    width: 200,
    height: 280,
    borderRadius: BorderRadius.lg,
  },
  scanResultDetails: {
    flex: 1,
  },
  scanResultCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  colorSeasonTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  colorSwatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  colorSwatchItem: {
    alignItems: "center",
    width: 50,
  },
  scanColorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  scanReviewFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  scanReviewButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  scanReviewSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  measurementFormContainer: {
    paddingVertical: Spacing.lg,
    gap: Spacing.xl,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  measurementLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  measurementInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  measurementInput: {
    width: 180,
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  unitToggleRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  unitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  unitButtonText: {
    fontWeight: "500",
  },
  measurementNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  bodyProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  bodyProfileButtonText: {
    flex: 1,
  },
});
