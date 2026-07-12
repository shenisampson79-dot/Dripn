import React, { useState, useEffect, useRef, useCallback } from "react";
import { StyleSheet, View, Text, Pressable, ActivityIndicator, TextInput, Alert, Platform, Image, ScrollView, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import type { ScrollView as RNScrollView } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";
import { stylistUpgradeService } from "@/services/StylistUpgradeService";
import { styleDirectionService, StyleDirection } from "@/services/StyleDirectionService";
import { onboardingProfileService, OnboardingProfile, DRESS_FOR_TO_OCCASION } from "@/services/OnboardingProfileService";
import { onboardingSessionService } from "@/services/OnboardingSessionService";
import { getStyleRuleForOccasion, generateOutfitImage } from "@/services/OutfitImageService";
import { useTranslations } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";

type DecideForMeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "DecideForMe">;
};

const OCCASION_ICONS: Record<string, "briefcase" | "heart" | "coffee" | "calendar" | "eye"> = {
  work: "briefcase",
  date: "heart",
  casual: "coffee",
  event: "calendar",
  browsing: "eye",
};

const OCCASION_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  work: { bg: "#E5DED4", border: "#D8CFC2", icon: "#4A3428" },
  date: { bg: "#F0EBE4", border: "#E5DED4", icon: "#8B6F5C" },
  casual: { bg: "#EBE0D3", border: "#D4A574", icon: "#4A3428" },
  event: { bg: "#F5E6D3", border: "#C9A87C", icon: "#4A3428" },
  browsing: { bg: "#D8CFC2", border: "#8B6F5C", icon: "#4A3428" },
};

const MAX_EXPRESSION_LENGTH = 280;

interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
}

interface Recommendation {
  id?: string;
  outfit: string;
  reasoning: string;
  stylistName: string;
}

interface StyleAdvice {
  styleRule: string;
  explanation: string;
  imageUrl: string | null;
}

const CACHED_OUTFITS_KEY = "dripn_cached_outfits";
const RECOMMENDATION_COUNT_KEY = "dripn_recommendation_count";
const STYLE_DIRECTION_SET_KEY = "dripn_style_direction_set";

const OCCASION_LABEL_KEYS: Record<string, string> = {
  work: "decideForMe.occasion.work",
  date: "decideForMe.occasion.date",
  casual: "decideForMe.occasion.casual",
  event: "decideForMe.occasion.event",
  browsing: "decideForMe.occasion.browsing",
};

interface FallbackOutfit {
  outfit: string;
  reasoning: string;
  occasions?: string[];
  coldWeather?: boolean;
  warmWeather?: boolean;
}

const FALLBACK_OUTFITS: FallbackOutfit[] = [
  // WORK - Cold Weather (15 outfits)
  { outfit: "Wear tailored wool trousers with a crisp white shirt, structured navy blazer, and polished Oxford shoes.", reasoning: "Classic professional attire that commands respect. The wool keeps you warm while looking sharp.", occasions: ["work"], coldWeather: true },
  { outfit: "Charcoal grey suit with a light blue shirt, burgundy tie, and black leather brogues. Add a quality wool overcoat.", reasoning: "Traditional power dressing with a subtle colour pop. Perfect for important meetings.", occasions: ["work"], coldWeather: true },
  { outfit: "Dark tailored trousers with a fitted cashmere turtleneck in navy or black. Add leather Chelsea boots.", reasoning: "Modern professional without the suit. Sophisticated and warm.", occasions: ["work"], coldWeather: true },
  { outfit: "Fitted pencil skirt with a silk blouse and tailored blazer. Knee-high leather boots complete the look.", reasoning: "Polished and feminine. The boots add warmth without sacrificing elegance.", occasions: ["work"], coldWeather: true },
  { outfit: "Navy wool trousers with a cream cable-knit jumper and brown leather loafers. Add a camel overcoat.", reasoning: "Smart casual that feels cosy. Perfect balance of professional and approachable.", occasions: ["work"], coldWeather: true },
  { outfit: "Tailored check trousers with a plain white shirt and fitted V-neck jumper. Brown Oxford shoes finish it off.", reasoning: "Classic British workwear. The pattern adds interest while staying professional.", occasions: ["work"], coldWeather: true },
  { outfit: "Wide-leg wool trousers with a tucked-in silk shirt and longline cardigan. Add pointed-toe ankle boots.", reasoning: "Relaxed elegance for creative workplaces. Comfortable yet polished.", occasions: ["work"], coldWeather: true },
  { outfit: "Charcoal turtleneck dress with black tights and ankle boots. Layer with a tailored coat.", reasoning: "Effortlessly chic. One piece does most of the work.", occasions: ["work"], coldWeather: true },
  { outfit: "Dark denim with a crisp Oxford shirt and structured blazer. Clean leather trainers keep it modern.", reasoning: "Elevated smart casual. Appropriate for most modern offices.", occasions: ["work"], coldWeather: true },
  { outfit: "Flannel trousers with a merino wool crew neck and suede desert boots. Add a quilted jacket.", reasoning: "Textured and warm. Perfect for offices with relaxed dress codes.", occasions: ["work"], coldWeather: true },
  { outfit: "Tailored corduroy trousers with a fitted shirt and knit tie. Brown brogues add character.", reasoning: "Heritage style that feels current. The corduroy adds visual interest.", occasions: ["work"], coldWeather: true },
  { outfit: "Midi pleated skirt with a fitted turtleneck and belted coat. Heeled ankle boots add polish.", reasoning: "Feminine and professional. The pleats move beautifully.", occasions: ["work"], coldWeather: true },
  { outfit: "Wool blend suit in a subtle check pattern with a plain shirt and leather belt. Polished brogues finish it.", reasoning: "Traditional with personality. The check keeps it interesting.", occasions: ["work"], coldWeather: true },
  { outfit: "High-waisted trousers with a tucked-in roll-neck jumper and pointed heels. Add a structured handbag.", reasoning: "Clean lines and simple elegance. Timeless professional style.", occasions: ["work"], coldWeather: true },
  { outfit: "Dark slim trousers with a button-down collar shirt and grey crew neck jumper. Brown leather belt and shoes.", reasoning: "Preppy professional. Classic combinations that always work.", occasions: ["work"], coldWeather: true },

  // WORK - Warm Weather (15 outfits)
  { outfit: "Lightweight cotton chinos with a crisp linen shirt and unstructured blazer. Leather loafers complete the look.", reasoning: "Breathable and professional. Linen keeps you cool in the heat.", occasions: ["work"], warmWeather: true },
  { outfit: "Tailored shorts in navy or grey with a tucked-in polo shirt and leather belt. Clean canvas trainers.", reasoning: "Smart summer casual. Appropriate for relaxed offices on hot days.", occasions: ["work"], warmWeather: true },
  { outfit: "A-line cotton dress in a solid neutral colour with a light cardigan. Nude heels or ballet flats.", reasoning: "Effortless summer workwear. Cool, comfortable, and polished.", occasions: ["work"], warmWeather: true },
  { outfit: "Lightweight wool trousers with a short-sleeve button-down shirt. Brown leather belt and loafers.", reasoning: "Classic summer professional. The short sleeves keep you comfortable.", occasions: ["work"], warmWeather: true },
  { outfit: "Linen-blend trousers with a silk camisole and light blazer. Nude sandals with a small heel.", reasoning: "Elegant and breathable. Perfect for warm-weather meetings.", occasions: ["work"], warmWeather: true },
  { outfit: "Cotton chinos with a fitted polo in a muted tone. White leather trainers keep it modern.", reasoning: "Relaxed professionalism. Great for tech companies and creative agencies.", occasions: ["work"], warmWeather: true },
  { outfit: "Midi wrap dress in a subtle print with nude heels. Simple gold jewellery adds polish.", reasoning: "One-piece elegance. The wrap flatters most figures.", occasions: ["work"], warmWeather: true },
  { outfit: "Light grey trousers with a white Oxford shirt, sleeves rolled. Navy blazer and brown loafers.", reasoning: "Timeless summer style. The rolled sleeves add casual refinement.", occasions: ["work"], warmWeather: true },
  { outfit: "Wide-leg linen trousers with a tucked-in cotton t-shirt and structured tote. Flat sandals.", reasoning: "Modern minimalist workwear. Comfortable without being sloppy.", occasions: ["work"], warmWeather: true },
  { outfit: "Tailored cotton shorts with a short-sleeve linen shirt. Leather sandals or clean trainers.", reasoning: "Smart casual for casual Fridays. Relaxed but still presentable.", occasions: ["work"], warmWeather: true },
  { outfit: "Sheath dress in a breathable fabric with a light cardigan. Pointed-toe flats.", reasoning: "Simple and sophisticated. The cardigan handles air conditioning.", occasions: ["work"], warmWeather: true },
  { outfit: "Seersucker trousers with a plain white shirt and navy knit tie. Brown leather penny loafers.", reasoning: "Classic summer suiting alternative. The texture keeps things interesting.", occasions: ["work"], warmWeather: true },
  { outfit: "Culottes in a neutral tone with a fitted blouse and low heels. Statement earrings.", reasoning: "Modern feminine style. Culottes are both professional and comfortable.", occasions: ["work"], warmWeather: true },
  { outfit: "Light cotton trousers with a chambray shirt. White trainers or brown leather sandals.", reasoning: "Relaxed summer professional. The chambray adds subtle texture.", occasions: ["work"], warmWeather: true },
  { outfit: "Sleeveless shift dress with a structured blazer. Nude heels and a leather tote.", reasoning: "Polished summer look. The sleeveless design keeps you cool.", occasions: ["work"], warmWeather: true },

  // CASUAL - Cold Weather (15 outfits)
  { outfit: "Dark jeans with a chunky cable-knit jumper and leather boots. Add a quality parka or peacoat.", reasoning: "Cosy weekend essential. Warm, comfortable, and effortlessly stylish.", occasions: ["casual"], coldWeather: true },
  { outfit: "Corduroy trousers with a flannel shirt and quilted gilet. Leather boots or clean trainers.", reasoning: "Textured casual layers. Perfect for autumn walks or coffee runs.", occasions: ["casual"], coldWeather: true },
  { outfit: "Black jeans with a grey cashmere jumper and white trainers. Add a wool overcoat.", reasoning: "Elevated basics. Simple colours, quality materials.", occasions: ["casual"], coldWeather: true },
  { outfit: "Cargo trousers with a fitted long-sleeve t-shirt and bomber jacket. Chunky trainers.", reasoning: "Relaxed streetwear vibes. Comfortable and on-trend.", occasions: ["casual"], coldWeather: true },
  { outfit: "Leggings with an oversized knit jumper and ankle boots. Add a teddy coat for warmth.", reasoning: "Cosy chic. Perfect for errands or casual meetups.", occasions: ["casual"], coldWeather: true },
  { outfit: "Straight-leg jeans with a Breton stripe top and navy peacoat. White trainers.", reasoning: "French-inspired casual. Classic combinations that never fail.", occasions: ["casual"], coldWeather: true },
  { outfit: "Wool trousers with a fitted roll-neck and shearling jacket. Chelsea boots.", reasoning: "Elevated weekend wear. Warm and sophisticated.", occasions: ["casual"], coldWeather: true },
  { outfit: "Joggers in a quality fabric with a cashmere hoodie and clean trainers. Add a puffer jacket.", reasoning: "Luxe loungewear. Comfortable enough for home, presentable enough for out.", occasions: ["casual"], coldWeather: true },
  { outfit: "Dark denim with a fisherman knit jumper and duck boots. Beanie optional.", reasoning: "Rugged casual. Perfect for cold, wet days.", occasions: ["casual"], coldWeather: true },
  { outfit: "Wide-leg jeans with a cropped jumper and long wool coat. Chunky boots.", reasoning: "Statement casual. The proportions make it interesting.", occasions: ["casual"], coldWeather: true },
  { outfit: "Chinos with a quarter-zip fleece and waxed jacket. Leather boots.", reasoning: "Countryside classic. Practical and stylish.", occasions: ["casual"], coldWeather: true },
  { outfit: "Knit midi dress with tights and knee-high boots. Add a belted coat.", reasoning: "One-piece comfort. Easy elegance for cold days.", occasions: ["casual"], coldWeather: true },
  { outfit: "Slim jeans with a heavyweight flannel shirt and down jacket. Hiking boots or trainers.", reasoning: "Outdoor-inspired casual. Warm and rugged.", occasions: ["casual"], coldWeather: true },
  { outfit: "Velvet trousers with a fine-knit jumper and leather jacket. Ankle boots.", reasoning: "Evening casual with texture. The velvet adds luxury.", occasions: ["casual"], coldWeather: true },
  { outfit: "Track pants with a fitted turtleneck and long puffer coat. Clean trainers.", reasoning: "Modern athleisure. Sporty meets sophisticated.", occasions: ["casual"], coldWeather: true },

  // CASUAL - Warm Weather (15 outfits)
  { outfit: "Linen shorts with a relaxed cotton t-shirt and leather sandals. Sunglasses.", reasoning: "Summer simplicity. Cool, easy, and effortless.", occasions: ["casual"], warmWeather: true },
  { outfit: "Flowy midi skirt with a tucked-in tank top and flat sandals. Straw bag.", reasoning: "Feminine summer style. Moves beautifully in the breeze.", occasions: ["casual"], warmWeather: true },
  { outfit: "Denim shorts with a linen button-up shirt and white trainers. Roll the sleeves.", reasoning: "Classic summer casual. Timeless for a reason.", occasions: ["casual"], warmWeather: true },
  { outfit: "Cotton sundress with leather sandals and a crossbody bag. Simple jewellery.", reasoning: "One-piece ease. Perfect for farmers markets to beach bars.", occasions: ["casual"], warmWeather: true },
  { outfit: "Chino shorts with a polo shirt and canvas trainers. Quality sunglasses.", reasoning: "Preppy summer. Clean and put-together without trying.", occasions: ["casual"], warmWeather: true },
  { outfit: "Wide-leg linen trousers with a cropped cotton top and espadrilles.", reasoning: "Relaxed Mediterranean vibes. Breezy and elegant.", occasions: ["casual"], warmWeather: true },
  { outfit: "Cotton jersey dress with white trainers and a denim jacket for evening.", reasoning: "Easy day-to-night. Comfortable and versatile.", occasions: ["casual"], warmWeather: true },
  { outfit: "Slim cotton trousers with a fitted t-shirt and leather sandals. Light watch.", reasoning: "Minimal summer style. Quality basics done right.", occasions: ["casual"], warmWeather: true },
  { outfit: "Linen jumpsuit with leather sandals and a woven belt. Hoop earrings.", reasoning: "One-and-done styling. Effortlessly chic.", occasions: ["casual"], warmWeather: true },
  { outfit: "Bermuda shorts with a camp collar shirt and loafers. No socks.", reasoning: "Resort-inspired casual. Relaxed sophistication.", occasions: ["casual"], warmWeather: true },
  { outfit: "Maxi dress with a denim jacket and flat sandals. Layered necklaces.", reasoning: "Boho summer style. Easy and feminine.", occasions: ["casual"], warmWeather: true },
  { outfit: "Cargo shorts with a vintage band t-shirt and canvas trainers. Baseball cap.", reasoning: "Relaxed streetwear. Comfortable and casual.", occasions: ["casual"], warmWeather: true },
  { outfit: "Flowy wide-leg culottes with a fitted tank and strappy sandals.", reasoning: "Breezy elegance. Perfect for hot days.", occasions: ["casual"], warmWeather: true },
  { outfit: "Cotton shorts with a linen vest and leather flip-flops. Simple bracelet.", reasoning: "Beach-ready casual. Minimal and easy.", occasions: ["casual"], warmWeather: true },
  { outfit: "Tiered midi skirt with a simple t-shirt and trainers. Crossbody bag.", reasoning: "Playful meets practical. Fun summer style.", occasions: ["casual"], warmWeather: true },

  // DATE - Cold Weather (15 outfits)
  { outfit: "Dark slim jeans with a cashmere V-neck jumper over a collared shirt. Chelsea boots.", reasoning: "Smart casual romance. Polished without being overdressed.", occasions: ["date"], coldWeather: true },
  { outfit: "Fitted midi dress with heeled ankle boots and a quality wool coat. Statement earrings.", reasoning: "Feminine and elegant. The dress does the talking.", occasions: ["date"], coldWeather: true },
  { outfit: "Tailored trousers with a silk blouse and pointed-toe heels. Add a leather jacket.", reasoning: "Sophisticated edge. Classic with attitude.", occasions: ["date"], coldWeather: true },
  { outfit: "Black jeans with a fitted turtleneck and velvet blazer. Leather boots.", reasoning: "Evening elegance. The velvet adds romance.", occasions: ["date"], coldWeather: true },
  { outfit: "Wool midi skirt with a cashmere jumper tucked in. Knee-high boots and simple jewellery.", reasoning: "Cosy sophistication. Warm and stylish.", occasions: ["date"], coldWeather: true },
  { outfit: "Slim chinos with a merino crew neck and leather jacket. Clean white trainers.", reasoning: "Casual confidence. Relaxed but considered.", occasions: ["date"], coldWeather: true },
  { outfit: "Knit bodycon dress with a long coat and heeled boots. Gold accessories.", reasoning: "Curve-highlighting elegance. Simple and impactful.", occasions: ["date"], coldWeather: true },
  { outfit: "Dark denim with a fitted shirt and tailored overcoat. Leather loafers.", reasoning: "Refined casual. Quality pieces make the difference.", occasions: ["date"], coldWeather: true },
  { outfit: "Leather trousers with a soft cashmere jumper and ankle boots. Minimal jewellery.", reasoning: "Modern edge. The leather adds interest.", occasions: ["date"], coldWeather: true },
  { outfit: "Tailored cord trousers with a silk shirt and block heels. Structured bag.", reasoning: "Textured elegance. Warm tones feel romantic.", occasions: ["date"], coldWeather: true },
  { outfit: "Slim black trousers with a fitted roll-neck and statement coat. Pointed heels.", reasoning: "All-black sophistication. Let the coat be the statement.", occasions: ["date"], coldWeather: true },
  { outfit: "Wool wide-leg trousers with a fitted bodysuit and blazer. Strappy heels.", reasoning: "Power dating look. Confident and polished.", occasions: ["date"], coldWeather: true },
  { outfit: "Dark jeans with a chunky cream jumper and tan leather jacket. Suede boots.", reasoning: "Warm tones, warm vibes. Approachable and stylish.", occasions: ["date"], coldWeather: true },
  { outfit: "Satin midi skirt with a cashmere jumper and heeled mules. Delicate jewellery.", reasoning: "Soft luxury. The satin catches the light beautifully.", occasions: ["date"], coldWeather: true },
  { outfit: "Tailored trousers with a sheer blouse and fitted blazer. Pointed-toe boots.", reasoning: "Subtle allure. Professional meets romantic.", occasions: ["date"], coldWeather: true },

  // DATE - Warm Weather (15 outfits)
  { outfit: "Linen trousers with a fitted silk camisole and strappy sandals. Delicate jewellery.", reasoning: "Summer romance. Breezy elegance.", occasions: ["date"], warmWeather: true },
  { outfit: "Midi wrap dress in a solid colour with heeled sandals. Statement earrings.", reasoning: "Flattering and feminine. The wrap suits everyone.", occasions: ["date"], warmWeather: true },
  { outfit: "Light chinos with a fitted polo and leather loafers. Quality watch.", reasoning: "Relaxed sophistication. Effortlessly put-together.", occasions: ["date"], warmWeather: true },
  { outfit: "Slip dress with a light cardigan and strappy heels. Simple gold chain.", reasoning: "Sensual simplicity. The slip dress is timelessly romantic.", occasions: ["date"], warmWeather: true },
  { outfit: "Cotton shorts with a silk shirt and leather sandals. Roll the sleeves.", reasoning: "Casual elegance. Dressed up but not stuffy.", occasions: ["date"], warmWeather: true },
  { outfit: "Flowy maxi dress with delicate sandals and hoop earrings.", reasoning: "Effortless romance. Movement and grace.", occasions: ["date"], warmWeather: true },
  { outfit: "Linen suit separates with a t-shirt and leather sandals. No socks.", reasoning: "Mediterranean suave. Relaxed formality.", occasions: ["date"], warmWeather: true },
  { outfit: "Midi skirt with a tucked-in blouse and kitten heels. Small clutch.", reasoning: "Ladylike charm. Classic and feminine.", occasions: ["date"], warmWeather: true },
  { outfit: "Tailored shorts with a linen blazer and loafers. Crisp white t-shirt.", reasoning: "Smart summer casual. Put-together without overdoing it.", occasions: ["date"], warmWeather: true },
  { outfit: "Cotton sundress with espadrille wedges and woven bag. Sun-kissed glow.", reasoning: "Daytime date perfection. Fresh and feminine.", occasions: ["date"], warmWeather: true },
  { outfit: "Light cotton trousers with a fitted silk top and strappy sandals. Bold lip.", reasoning: "Simple but impactful. Let your features shine.", occasions: ["date"], warmWeather: true },
  { outfit: "Denim skirt with a fitted blouse and block heels. Statement bag.", reasoning: "Relaxed elegance. Classic pieces styled up.", occasions: ["date"], warmWeather: true },
  { outfit: "Linen shirt dress with a belt and leather slides. Oversized sunglasses.", reasoning: "Effortless chic. One piece, complete look.", occasions: ["date"], warmWeather: true },
  { outfit: "Wide-leg trousers with a cropped top and heeled mules. Minimalist jewellery.", reasoning: "Modern and elegant. Perfect proportions.", occasions: ["date"], warmWeather: true },
  { outfit: "Cotton midi dress with a light denim jacket and wedges. Natural makeup.", reasoning: "Fresh and approachable. Easy summer dating style.", occasions: ["date"], warmWeather: true },

  // EVENT - Cold Weather (10 outfits)
  { outfit: "Tailored velvet blazer with slim black trousers and silk blouse. Pointed-toe heels.", reasoning: "Luxe evening wear. The velvet adds occasion-appropriate glamour.", occasions: ["event"], coldWeather: true },
  { outfit: "Floor-length gown in a rich jewel tone with heeled sandals. Statement jewellery.", reasoning: "Black tie ready. Elegant and dramatic.", occasions: ["event"], coldWeather: true },
  { outfit: "Tailored tuxedo suit with a silk camisole and stiletto heels. Sleek clutch.", reasoning: "Modern elegance. The tuxedo is always a statement.", occasions: ["event"], coldWeather: true },
  { outfit: "Midi cocktail dress with long sleeves and heeled ankle boots. Faux fur stole.", reasoning: "Occasion dressing done right. Festive and sophisticated.", occasions: ["event"], coldWeather: true },
  { outfit: "Sequin top with tailored trousers and strappy heels. Minimal accessories.", reasoning: "Let the sparkle do the talking. Modern party dressing.", occasions: ["event"], coldWeather: true },
  { outfit: "Wool crepe jumpsuit with pointed heels and statement earrings. Sleek clutch.", reasoning: "One-piece elegance. Modern and memorable.", occasions: ["event"], coldWeather: true },
  { outfit: "Satin midi skirt with a fitted cashmere jumper and heeled boots. Crystal accessories.", reasoning: "Unexpected elegance. Cosy meets glamorous.", occasions: ["event"], coldWeather: true },
  { outfit: "Three-piece suit in midnight blue with a crisp white shirt. Polished Oxfords.", reasoning: "Classic formal wear. Timeless and sophisticated.", occasions: ["event"], coldWeather: true },
  { outfit: "Pleated metallic skirt with a fitted black top and strappy heels. Simple clutch.", reasoning: "Party-ready. The metallic catches every light.", occasions: ["event"], coldWeather: true },
  { outfit: "Structured maxi dress with long sleeves and elegant heels. Pearl earrings.", reasoning: "Refined glamour. Coverage can be chic.", occasions: ["event"], coldWeather: true },

  // EVENT - Warm Weather (10 outfits)
  { outfit: "Flowing maxi dress in a bold print with strappy sandals. Statement earrings.", reasoning: "Summer event perfection. The print makes the statement.", occasions: ["event"], warmWeather: true },
  { outfit: "Tailored linen suit with a silk camisole and heeled mules. Minimal jewellery.", reasoning: "Sophisticated summer formal. Light and elegant.", occasions: ["event"], warmWeather: true },
  { outfit: "Midi cocktail dress in a pastel shade with strappy heels. Delicate accessories.", reasoning: "Garden party ready. Fresh and feminine.", occasions: ["event"], warmWeather: true },
  { outfit: "Wide-leg trousers with a draped halter top and stiletto sandals. Crystal clutch.", reasoning: "Modern elegance. Cool and commanding.", occasions: ["event"], warmWeather: true },
  { outfit: "Slip dress in silk with barely-there sandals. Layered gold jewellery.", reasoning: "Understated glamour. The fabric speaks for itself.", occasions: ["event"], warmWeather: true },
  { outfit: "Tailored shorts suit with a fitted blouse and block heels. Statement bag.", reasoning: "Modern formal. Fresh take on event dressing.", occasions: ["event"], warmWeather: true },
  { outfit: "Asymmetric maxi dress with platform sandals. Bold earrings.", reasoning: "Dramatic and memorable. Perfect for outdoor events.", occasions: ["event"], warmWeather: true },
  { outfit: "Linen trousers with a beaded camisole and strappy heels. Clutch bag.", reasoning: "Relaxed glamour. The beading elevates everything.", occasions: ["event"], warmWeather: true },
  { outfit: "Cotton wrap dress in a vibrant colour with espadrille wedges. Woven clutch.", reasoning: "Summery elegance. Colourful and confident.", occasions: ["event"], warmWeather: true },
  { outfit: "Pleated midi skirt with a fitted tank and heeled sandals. Statement necklace.", reasoning: "Easy event styling. The pleats add movement and interest.", occasions: ["event"], warmWeather: true },
];

const FEMININE_GARMENT_RE =
  /\b(dress(?:es)?|skirt|heels?|blouse|camisole|leggings|bodysuit|gown|sundress|wrap dress|pencil skirt|midi skirt|maxi(?:\s+dress)?|kitten heels?|ballet flats|handbag|earrings|slip dress|sheath dress|culottes|crop(?:ped)?\s+(?:top|jumper|hoodie)|halter|bodycon)\b/i;

const getFilteredOutfits = (
  occasion: string | null,
  temperature: number | null,
  quizGender?: 'male' | 'female' | null,
): FallbackOutfit[] => {
  let filtered = [...FALLBACK_OUTFITS];
  
  if (occasion) {
    const occasionFiltered = filtered.filter(o => !o.occasions || o.occasions.includes(occasion));
    if (occasionFiltered.length > 0) filtered = occasionFiltered;
  }
  
  if (temperature !== null) {
    if (temperature < 12) {
      const coldFiltered = filtered.filter(o => o.coldWeather !== false && !o.warmWeather);
      if (coldFiltered.length > 0) filtered = coldFiltered;
    } else if (temperature > 20) {
      const warmFiltered = filtered.filter(o => o.warmWeather !== false && !o.coldWeather);
      if (warmFiltered.length > 0) filtered = warmFiltered;
    }
  }

  if (quizGender === 'male') {
    const maleSafe = filtered.filter((o) => !FEMININE_GARMENT_RE.test(o.outfit) && !/feminine|ladylike|curve/i.test(o.reasoning));
    if (maleSafe.length > 0) filtered = maleSafe;
  }
  
  return filtered.length > 0 ? filtered : FALLBACK_OUTFITS;
};

export default function DecideForMeScreen({ navigation }: DecideForMeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const { user } = useAuth();
  
  const [step, setStep] = useState<"occasion" | "loading" | "result">("loading");
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [expressionText, setExpressionText] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [cachedOutfitsCount, setCachedOutfitsCount] = useState(0);
  const [showStyleChips, setShowStyleChips] = useState(false);
  const [selectedStyleDirection, setSelectedStyleDirection] = useState<StyleDirection | null>(null);
  const [styleDirectionSet, setStyleDirectionSet] = useState(false);
  const [firstMessages, setFirstMessages] = useState<{
    message: string;
    options: { id: string; label: string }[];
    skipOccasion?: boolean;
  } | null>(null);
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const autoStartedRef = useRef(false);
  const recommendationCountRef = useRef(0);
  const outfitIndexRef = useRef(0);
  const scrollRef = useRef<RNScrollView>(null);
  const expressionInputRef = useRef<TextInput>(null);
  const resultExpressionInputRef = useRef<TextInput>(null);
  const [isLoadingAnotherOption, setIsLoadingAnotherOption] = useState(false);
  const [styleAdvice, setStyleAdvice] = useState<StyleAdvice | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleExpressionInputFocus = useCallback(() => {
    // KeyboardAwareScrollView handles scroll-to-input automatically via scrollOnFocus
    // No manual scroll needed — calling scrollToEnd here would scroll past the input
  }, []);

  useEffect(() => {
    fetchWeather();
    loadCachedOutfitsCount();
    loadRecommendationCount();
    checkStyleDirectionStatus();
    onboardingProfileService.getProfile().then(async (profile) => {
      const synced = await onboardingProfileService.syncQuizGenderFromUserGender(user?.gender);
      const resolved = { ...profile, ...synced };
      setOnboardingProfile(resolved);
      if (resolved.dressFor) {
        setSelectedOccasion(DRESS_FOR_TO_OCCASION[resolved.dressFor] || null);
      } else {
        setStep("occasion");
      }
      if (resolved.quizGender) {
        const direction: StyleDirection =
          resolved.quizGender === 'female' ? 'feminine' : 'masculine';
        const isSet = await AsyncStorage.getItem(STYLE_DIRECTION_SET_KEY);
        if (isSet !== 'true') {
          await styleDirectionService.setStyleDirection(direction, 'onboarding');
          await AsyncStorage.setItem(STYLE_DIRECTION_SET_KEY, 'true');
          setStyleDirectionSet(true);
        }
      }
    });
  }, [user?.gender]);

  useEffect(() => {
    onboardingProfileService.getProfile().then(async (profile) => {
      const messages = await styleDirectionService.getFirstMessages(profile, currentLanguage);
      setFirstMessages(messages);
    });
  }, [currentLanguage]);

  const checkStyleDirectionStatus = async () => {
    try {
      const isSet = await AsyncStorage.getItem(STYLE_DIRECTION_SET_KEY);
      if (isSet === "true") {
        setStyleDirectionSet(true);
      }
    } catch (error) {
      console.log("Failed to check style direction status");
    }
  };

  const handleStyleChipSelect = async (direction: StyleDirection) => {
    setSelectedStyleDirection(direction);
    const success = await styleDirectionService.setStyleDirection(direction, "chips");
    if (success) {
      setStyleDirectionSet(true);
      await AsyncStorage.setItem(STYLE_DIRECTION_SET_KEY, "true");
      setTimeout(() => setShowStyleChips(false), 500);
    }
  };

  const dismissStyleChips = () => {
    setShowStyleChips(false);
  };

  const loadCachedOutfitsCount = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHED_OUTFITS_KEY);
      if (cached) {
        const outfits = JSON.parse(cached);
        setCachedOutfitsCount(outfits.length);
      }
    } catch (error) {
      console.log("Failed to load cached outfits count");
    }
  };

  const loadRecommendationCount = async () => {
    try {
      const count = await AsyncStorage.getItem(RECOMMENDATION_COUNT_KEY);
      recommendationCountRef.current = count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.log("Failed to load recommendation count");
    }
  };

  const incrementRecommendationCount = async () => {
    try {
      recommendationCountRef.current += 1;
      await AsyncStorage.setItem(RECOMMENDATION_COUNT_KEY, recommendationCountRef.current.toString());
      
      if (recommendationCountRef.current === 1 && !styleDirectionSet) {
        setTimeout(() => setShowStyleChips(true), 1500);
      }
      
      if (recommendationCountRef.current >= 3) {
        checkGate();
      }
    } catch (error) {
      console.log("Failed to increment recommendation count");
    }
  };

  interface FarewellResponse {
    stylist?: string;
    message?: string;
    cta?: string;
    signupPrompt?: string;
    browsingEnded?: boolean;
    nextSteps?: Array<{ id: string; label: string; primary: boolean }>;
  }

  const showFarewellDialog = (farewell: FarewellResponse | null) => {
    const message = farewell?.message || t('decideForMe.browsingDoneTitle');
    const signupPrompt = t('decideForMe.browsingDoneMessage');
    
    const buttons: any[] = [];
    
    if (farewell?.nextSteps) {
      farewell.nextSteps.forEach(step => {
        if (step.id === "signup") {
          buttons.push({
            text: step.label,
            onPress: () => navigation.navigate("SoftSignupGate", { fromPath: "farewell" }),
            style: step.primary ? "default" : "cancel",
          });
        } else if (step.id === "restart") {
          buttons.push({
            text: t('decideForMe.startAgain') || "Start again",
            onPress: () => {
              setStep("occasion");
              setRecommendation(null);
            },
          });
        }
      });
    } else {
      buttons.push(
        { text: t('common.saveMyPicks'), onPress: () => navigation.navigate("SoftSignupGate", { fromPath: "farewell" }) },
        { text: t('common.signUp'), onPress: () => navigation.navigate("Auth", { mode: 'signup' }) }
      );
    }
    
    Alert.alert(
      message,
      signupPrompt,
      buttons
    );
  };

  const checkGate = async () => {
    try {
      const farewell = await apiService.get<FarewellResponse>("/api/onboarding/farewell?stylist=ruby");
      if (farewell?.browsingEnded) {
        showFarewellDialog(farewell);
      }
    } catch (error) {
      // Fallback to local farewell message
      showFarewellDialog(null);
    }
  };

  const fetchWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        
        // Use Open-Meteo API (free, no API key required)
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const weatherData = await weatherResponse.json();
        
        if (weatherData.current_weather) {
          const temp = Math.round(weatherData.current_weather.temperature);
          const weatherCode = weatherData.current_weather.weathercode;
          
          // Map weather code to condition
          let condition = "mild";
          if (weatherCode <= 3) condition = "clear";
          else if (weatherCode <= 48) condition = "cloudy";
          else if (weatherCode <= 67) condition = "rainy";
          else if (weatherCode <= 77) condition = "snowy";
          else condition = "stormy";
          
          // Get location name using reverse geocoding
          let locationName = "Your area";
          try {
            const geoResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1`
            );
            const geoData = await geoResponse.json();
            if (geoData.results && geoData.results.length > 0) {
              locationName = geoData.results[0].name || geoData.results[0].admin1 || "Your area";
            }
          } catch {
            // Keep default location name
          }
          
          setWeather({
            temperature: temp,
            condition,
            location: locationName,
          });
        }
      }
    } catch (error: unknown) {
      // Fallback - don't show weather if we can't get it
      setWeather(null);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const generateRecommendation = useCallback(async (
    occasionId: string,
    profileOverride?: OnboardingProfile | null,
  ) => {
    const profile = profileOverride ?? onboardingProfile ?? await onboardingProfileService.getProfile();
    setSelectedOccasion(occasionId);
    setStep("loading");
    setStyleAdvice(null);

    const { styleRule, explanation } = getStyleRuleForOccasion(occasionId, t);
    setStyleAdvice({ styleRule, explanation, imageUrl: null });

    const filteredOutfits = getFilteredOutfits(
      occasionId,
      weather?.temperature ?? null,
      profile.quizGender,
    );
    const randomIndex = Math.floor(Math.random() * filteredOutfits.length);
    outfitIndexRef.current = randomIndex;
    const fallbackOutfit = filteredOutfits[randomIndex];

    let outfitDescription = fallbackOutfit.outfit;

    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      const data = await apiService.post<{
        id?: string;
        recommendation?: string;
        reasoning?: string;
        stylistName?: string;
      }>("/api/onboarding/quick-recommendation", {
        occasion: occasionId,
        weather,
        region: weather?.location || "UK",
        expression: expressionText.trim() || undefined,
        deviceId,
        onboardingProfile: profile,
        quizGender: profile.quizGender,
        language: currentLanguage,
      });

      if (data?.recommendation) {
        outfitDescription = data.recommendation;
        setRecommendation({
          id: data.id,
          outfit: data.recommendation,
          reasoning: data.reasoning || t('decideForMe.reasoningFallback') || "This look balances comfort with style, perfect for your occasion.",
          stylistName: data.stylistName || "Ruby",
        });
      } else {
        setRecommendation({
          outfit: fallbackOutfit.outfit,
          reasoning: fallbackOutfit.reasoning,
          stylistName: "Ruby",
        });
      }
      setStep("result");
      incrementRecommendationCount();
      generateOutfitImageAsync(outfitDescription, occasionId);
    } catch {
      setRecommendation({
        outfit: fallbackOutfit.outfit,
        reasoning: fallbackOutfit.reasoning,
        stylistName: "Ruby",
      });
      setStep("result");
      incrementRecommendationCount();
      generateOutfitImageAsync(outfitDescription, occasionId);
    }
  }, [onboardingProfile, weather, expressionText, currentLanguage, t]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!onboardingProfile?.dressFor || isLoadingWeather) return;

    const occasionId = DRESS_FOR_TO_OCCASION[onboardingProfile.dressFor];
    if (!occasionId) return;

    autoStartedRef.current = true;
    void generateRecommendation(occasionId, onboardingProfile);
  }, [onboardingProfile, isLoadingWeather, generateRecommendation]);

  const handleOccasionSelect = (occasionId: string) => {
    autoStartedRef.current = true;
    void generateRecommendation(occasionId);
  };

  const generateOutfitImageAsync = async (outfitDescription: string, occasionId: string) => {
    setIsGeneratingImage(true);
    try {
      const result = await generateOutfitImage(outfitDescription, occasionId, t);
      setStyleAdvice(prev => ({
        styleRule: prev?.styleRule || result.styleRule,
        explanation: prev?.explanation || result.explanation,
        imageUrl: result.imageUrl,
      }));
    } catch (error) {
      console.log("Failed to generate outfit image");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const recordInteraction = async (action: string, details?: string) => {
    try {
      await apiService.post("/api/onboarding/record-interaction", {
        action,
        recommendationId: recommendation?.id,
        details,
      });
    } catch (error) {
      console.log("Failed to record interaction");
    }
  };

  // Store the latest save outfit hint for use in handleCreateAccount
  const saveOutfitHintRef = useRef<OnCreateAccountHint | undefined>(undefined);

  const handleSaveOutfit = async () => {
    await recordInteraction("save_outfit");
    
    await stylistUpgradeService.recordSignal("SAVE", recommendation?.stylistName?.toLowerCase(), {
      message: "User tapped save outfit",
      occasion: selectedOccasion,
    });
    
    // Try to get onCreateAccount hint from backend
    try {
      const response = await apiService.post<{ onCreateAccount?: OnCreateAccountHint }>("/api/outfits/save", {
        outfit: recommendation?.outfit,
        occasion: selectedOccasion,
      });
      saveOutfitHintRef.current = response?.onCreateAccount;
    } catch (error) {
      saveOutfitHintRef.current = undefined;
    }
    
    setShowSavePrompt(true);
  };

  const handleCreateAccount = () => {
    setShowSavePrompt(false);
    navigateToSignup(saveOutfitHintRef.current, "save_outfit");
  };

  const handleNotNow = async () => {
    setShowSavePrompt(false);
    
    try {
      const cached = await AsyncStorage.getItem(CACHED_OUTFITS_KEY);
      const outfits = cached ? JSON.parse(cached) : [];
      
      if (outfits.length >= 3) {
        Alert.alert(
          t('common.createAnAccountToSaveMore') || "Create an account to save more",
          t('common.youveSaved3OutfitsCreateAFreeAccount') || "You've saved 3 outfits. Create a free account to keep them forever.",
          [
            { text: t('upgrade.path.notNow') || "Not now", style: "cancel" },
            { text: t('common.signUpToSave') || "Sign up to save", onPress: handleCreateAccount },
          ]
        );
        return;
      }
      
      outfits.push({
        ...recommendation,
        savedAt: new Date().toISOString(),
        occasion: selectedOccasion,
      });
      
      await AsyncStorage.setItem(CACHED_OUTFITS_KEY, JSON.stringify(outfits));
      setCachedOutfitsCount(outfits.length);
      // Silently save - user already said "Not now" so don't bother them with another popup
    } catch (error) {
      console.log("Failed to cache outfit");
    }
  };

  const handleAnotherOption = async () => {
    setIsLoadingAnotherOption(true);
    await recordInteraction("another_option");
    
    // Get filtered outfits based on occasion, weather, and gender
    const profile = onboardingProfile ?? (await onboardingProfileService.getProfile());
    const filteredOutfits = getFilteredOutfits(
      selectedOccasion,
      weather?.temperature ?? null,
      profile.quizGender,
    );
    
    // Cycle to next outfit within filtered set
    outfitIndexRef.current = (outfitIndexRef.current + 1) % filteredOutfits.length;
    const nextOutfit = filteredOutfits[outfitIndexRef.current];
    
    // Brief delay for visual feedback
    setTimeout(() => {
      setRecommendation({
        outfit: nextOutfit.outfit,
        reasoning: nextOutfit.reasoning,
        stylistName: "Ruby",
      });
      setIsLoadingAnotherOption(false);
      incrementRecommendationCount();
    }, 400);
  };

  // Common response type for account creation hints
  interface OnCreateAccountHint {
    navigateTo?: string;
    skipInterstitial?: boolean;
  }

  // Helper to navigate based on onCreateAccount hint
  const navigateToSignup = (hint?: OnCreateAccountHint, fromPath?: string) => {
    if (hint?.navigateTo === "Signup" && hint?.skipInterstitial) {
      // Navigate directly to Signup, skipping interstitial
      navigation.navigate("Signup" as any);
    } else {
      // Show the soft signup gate with interstitial
      navigation.navigate("SoftSignupGate", { fromPath: fromPath || "unknown" });
    }
  };

  const [isSubmittingExpression, setIsSubmittingExpression] = useState(false);
  const [isRefiningOutfit, setIsRefiningOutfit] = useState(false);

  const generateTailoredRecommendation = useCallback((
    userExpression: string,
    occasion: string,
    previousOutfit?: string,
  ): { outfit: string; reasoning: string } => {
    const expressionLower = userExpression.toLowerCase();
    const isNegative = /don'?t like|not a fan|avoid|no |hate|dislike|not into|without/i.test(expressionLower);

    if (isNegative && /jean|denim/i.test(expressionLower)) {
      return {
        outfit: "Relaxed tailored chinos in olive or stone, a fitted tee or lightweight knit, clean low-profile sneakers, and a casual overshirt or bomber. Skip denim entirely.",
        reasoning: "You said jeans aren't for you — chinos and an overshirt keep the same going-out energy without straight-leg denim.",
      };
    }

    if (isNegative && /sneaker|trainer/i.test(expressionLower)) {
      return {
        outfit: "Smart chinos, a crisp shirt or knit polo, and polished loafers or desert boots. A lightweight jacket if it's cooler.",
        reasoning: "Swapped trainers for a sharper shoe while keeping the look comfortable for your occasion.",
      };
    }

    if (expressionLower.includes("finance") || expressionLower.includes("bank") || expressionLower.includes("suit") || expressionLower.includes("formal")) {
      return {
        outfit: "A well-fitted navy or charcoal suit with a crisp white shirt, silk tie in a subtle pattern, and polished Oxford shoes. Add a quality leather belt to complete the look.",
        reasoning: "For finance, precision matters. This classic combination commands respect while staying professionally appropriate.",
      };
    }

    if (!isNegative && (expressionLower.includes("casual") || expressionLower.includes("comfortable"))) {
      return {
        outfit: "Dark slim-fit jeans with a well-fitted jumper in a neutral tone. Add clean white trainers and a quality watch for polish.",
        reasoning: "Casual doesn't mean sloppy. This look is relaxed but intentional.",
      };
    }

    if (expressionLower.includes("creative") || expressionLower.includes("startup") || expressionLower.includes("tech")) {
      return {
        outfit: "Smart chinos with a quality fitted t-shirt and a structured blazer. Clean minimalist trainers tie it together.",
        reasoning: "Modern workplaces value authenticity. This says capable without being corporate.",
      };
    }

    return {
      outfit: previousOutfit
        ? "Relaxed tailored trousers with a quality shirt in a flattering colour, clean shoes that suit the occasion, and one layer for polish."
        : "Tailored trousers with a quality shirt in a flattering colour for you. Add appropriate footwear for your environment and a confidence-boosting accessory.",
      reasoning: `Got it — I've adjusted based on: "${userExpression.slice(0, 80)}${userExpression.length > 80 ? "..." : ""}"`,
    };
  }, []);

  const handleExpressionSubmit = useCallback(async () => {
    const userExpression = expressionText.trim();
    if (!userExpression || isSubmittingExpression || isRefiningOutfit) return;

    setIsSubmittingExpression(true);
    setIsRefiningOutfit(true);
    const previousOutfit = recommendation?.outfit || "";

    void styleDirectionService.recordStyleExpression(userExpression);
    void recordInteraction("style_expression", userExpression);

    try {
      let gotApiResponse = false;
      try {
        const deviceId = await onboardingSessionService.getDeviceId();
        const profile = await onboardingProfileService.getProfile();
        const data = await apiService.post<{
          id?: string;
          recommendation?: string;
          reasoning?: string;
          stylistName?: string;
        }>("/api/onboarding/quick-recommendation", {
          occasion: selectedOccasion || "work",
          weather,
          region: weather?.location || "UK",
          styleExpression: userExpression,
          expression: userExpression,
          previousRecommendation: previousOutfit,
          deviceId,
          onboardingProfile: profile,
          language: currentLanguage,
        });

        if (data?.recommendation) {
          setRecommendation({
            id: data.id,
            outfit: data.recommendation,
            reasoning: data.reasoning || t('decideForMe.updatedReasoning') || "Updated based on what you told me.",
            stylistName: data.stylistName || "Ruby",
          });
          gotApiResponse = true;
          void generateOutfitImageAsync(data.recommendation, selectedOccasion || "work");
        }
      } catch {
        console.log("Refinement API failed, using local fallback");
      }

      if (!gotApiResponse) {
        const tailored = generateTailoredRecommendation(
          userExpression,
          selectedOccasion || "work",
          previousOutfit,
        );
        setRecommendation({
          outfit: tailored.outfit,
          reasoning: tailored.reasoning,
          stylistName: "Ruby",
        });
        void generateOutfitImageAsync(tailored.outfit, selectedOccasion || "work");
      }

      setExpressionText("");
      Keyboard.dismiss();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch {
      Alert.alert(
        t('common.couldNotUpdateOutfit') || "Could not update outfit",
        t('common.pleaseTryAgainRubyDidntGetYourMessage') || "Please try again — Ruby didn't get your message.",
      );
    } finally {
      setIsSubmittingExpression(false);
      setIsRefiningOutfit(false);
    }
  }, [
    expressionText,
    isSubmittingExpression,
    isRefiningOutfit,
    recommendation?.outfit,
    selectedOccasion,
    weather,
    generateTailoredRecommendation,
    currentLanguage,
    t,
  ]);

  const handlePersonalise = () => {
    navigation.navigate("StyleMeProperly");
  };

  const handleJustBrowsing = async () => {
    Alert.alert(
      t('decideForMe.browsingDoneTitle'),
      t('decideForMe.browsingDoneMessage'),
      [
        {
          text: t('common.saveMyPicks'),
          onPress: () => navigation.navigate("SoftSignupGate", { fromPath: "browsing" })
        },
        {
          text: t('common.signUp'),
          onPress: () => navigation.navigate("Auth", { mode: 'signup' }),
        },
      ]
    );
  };

  const renderOccasionStep = () => {
    const defaultOptions = [
      { id: "work", label: t(OCCASION_LABEL_KEYS.work) || "Work" },
      { id: "date", label: t(OCCASION_LABEL_KEYS.date) || "Date" },
      { id: "casual", label: t(OCCASION_LABEL_KEYS.casual) || "Casual" },
      { id: "event", label: t(OCCASION_LABEL_KEYS.event) || "Event" },
      { id: "browsing", label: t(OCCASION_LABEL_KEYS.browsing) || "Just browsing" },
    ];
    const options = (firstMessages?.options?.length ? firstMessages.options : defaultOptions).map((option) => ({
      ...option,
      label: t(OCCASION_LABEL_KEYS[option.id]) || option.label,
    }));
    const message =
      t("decideForMe.tellMeOccasion") ||
      firstMessages?.message ||
      "Tell me what you're dressing for — I'll decide the outfit.";

    return (
      <Animated.View entering={FadeIn} style={styles.stepContainer} pointerEvents="box-none">
        <View style={styles.stylistMessage}>
          <LinearGradient
            colors={[ScreenGradients.ruby.primary[0], ScreenGradients.ruby.primary[1]]}
            style={styles.avatarCircle}
          >
            <Feather name="message-circle" size={20} color="#FFFFFF" />
          </LinearGradient>
          <LinearGradient
            colors={[`${ScreenGradients.ruby.primary[0]}E0`, `${ScreenGradients.ruby.primary[1]}C0`]}
            style={[styles.messageBubble, { borderWidth: 1, borderColor: `${ScreenGradients.ruby.primary[0]}80` }]}
          >
            <ThemedText type="body" style={[styles.messageText, { color: '#FFFFFF', fontWeight: '500' }]}>
              {message}
            </ThemedText>
          </LinearGradient>
        </View>

        {weather && !isLoadingWeather ? (
          <Animated.View entering={FadeInDown.delay(200)} style={[styles.weatherBadge, { backgroundColor: 'rgba(74, 52, 40, 0.1)' }]}>
            <Feather name="cloud" size={16} color="#4A3428" />
            <ThemedText type="small" style={{ color: '#4A3428', marginLeft: Spacing.xs, fontWeight: '500' }}>
              {(t('decideForMe.weatherIn') || '{temp}° in {location}')
                .replace('{temp}', String(weather.temperature))
                .replace('{location}', weather.location)}
            </ThemedText>
          </Animated.View>
        ) : null}

        <Pressable
          style={styles.promptInputContainer}
          onPress={() => expressionInputRef.current?.focus()}
          accessible={false}
        >
          <Feather name="edit-3" size={16} color="rgba(74, 52, 40, 0.5)" style={{ marginTop: 4 }} />
          <TextInput
            ref={expressionInputRef}
            style={styles.promptInput}
            placeholder={t('common.addContextEgOutdoorEventSmartCasual') || "Add context... (e.g. outdoor event, smart casual)"}
            placeholderTextColor="rgba(74, 52, 40, 0.4)"
            value={expressionText}
            onChangeText={setExpressionText}
            multiline
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={Keyboard.dismiss}
          />
        </Pressable>

        <View style={styles.optionsGrid}>
          {options.map((option, index) => {
            const occasionColor = OCCASION_COLORS[option.id] || { bg: "#E5DED4", border: "#D8CFC2", icon: "#4A3428" };
            const isSelected = selectedOccasion === option.id;
            
            return (
              <Animated.View 
                key={option.id} 
                entering={FadeInUp.delay(100 + index * 50)}
                style={styles.optionWrapper}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.optionCard,
                    { 
                      backgroundColor: occasionColor.bg,
                      borderWidth: isSelected ? 3 : 1.5,
                      borderColor: isSelected ? '#4A3428' : occasionColor.border,
                      opacity: pressed ? 0.85 : 1,
                      shadowColor: '#4A3428',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }
                  ]}
                  onPress={() => handleOccasionSelect(option.id)}
                >
                  <View style={[styles.occasionIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.5)' }]}>
                    <Feather 
                      name={OCCASION_ICONS[option.id] || "circle"} 
                      size={26} 
                      color={occasionColor.icon}
                    />
                  </View>
                  <ThemedText 
                    type="body" 
                    style={[
                      styles.optionLabel,
                      { color: '#4A3428', fontWeight: '600' }
                    ]}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    );
  };

  const renderLoadingStep = () => {
    const occasionLabel = onboardingProfile?.dressFor
      ? t(`onboardingProfile.dressFor.${onboardingProfile.dressFor}`) ||
        onboardingProfileService.getDressForLabel(onboardingProfile.dressFor)
      : "";
    const loadingMessage =
      firstMessages?.skipOccasion && onboardingProfile?.dressFor
        ? (t("decideForMe.rubyDecidingFor") || "Ruby is deciding your outfit for {occasion}...").replace(
            "{occasion}",
            occasionLabel
          )
        : t("decideForMe.rubyDeciding") || "Ruby is deciding your outfit...";

    return (
      <Animated.View entering={FadeIn} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A3428" />
        <ThemedText type="body" style={[styles.loadingText, { color: '#4A3428', fontWeight: '600' }]}>
          {loadingMessage}
        </ThemedText>
      </Animated.View>
    );
  };

  const renderSavePrompt = () => (
    <Animated.View entering={FadeIn} style={[styles.savePromptOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
      <View style={[styles.savePromptCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h3" style={[styles.savePromptTitle, { color: theme.text }]}>
          {t('decideForMe.keepOutfit') || 'Keep this outfit?'}
        </ThemedText>
        <ThemedText type="body" style={[styles.savePromptSubtitle, { color: theme.tabIconDefault }]}>
          {t('decideForMe.createAccountToSave') || 'Create a free account to save it forever'}
        </ThemedText>
        
        <Button onPress={handleCreateAccount} style={[styles.savePromptButton, { backgroundColor: theme.link }]}>
          {t('decideForMe.signUpToSave') || t('common.signUpToSave') || 'Sign up to save'}
        </Button>
        
        <Pressable onPress={handleNotNow} style={styles.savePromptSecondary}>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            {t('decideForMe.notNow') || t('common.notNow') || 'Not now'}
          </ThemedText>
          {cachedOutfitsCount > 0 ? (
            <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: 4 }}>
              {(t('decideForMe.savesLeft') || '({n} saves left)').replace('{n}', String(3 - cachedOutfitsCount))}
            </ThemedText>
          ) : null}
        </Pressable>
      </View>
    </Animated.View>
  );

  // Helper to parse markdown bold text
  const renderMarkdownText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={{ fontWeight: '700' }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return (
        <Text key={index}>
          {part}
        </Text>
      );
    });
  };

  const renderResultStep = () => (
    <Animated.View entering={FadeIn} style={styles.resultContainer} pointerEvents="box-none">
      <Animated.View entering={FadeInDown.delay(100)} style={styles.outfitRecommendationCard}>
        <LinearGradient
          colors={[ScreenGradients.ruby.primary[0], ScreenGradients.ruby.primary[1]]}
          style={styles.recommendationCardGradient}
        >
          <View style={styles.recommendationCardHeader}>
            <View style={styles.rubyAvatarSmall}>
              <Feather name="heart" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.recommendationHeaderText}>
              <ThemedText type="h4" style={{ color: LuxuryColors.obsidian, fontWeight: '700' }}>
                {t("decideForMe.rubysPick") || "Ruby's Pick"}
              </ThemedText>
              <ThemedText type="small" style={{ color: 'rgba(74, 52, 40, 0.6)' }}>
                {t("decideForMe.yourRecommendation") || "Your outfit recommendation"}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.recommendationCardBody}>
            {isRefiningOutfit ? (
              <View style={styles.refiningRow}>
                <ActivityIndicator size="small" color={LuxuryColors.obsidian} />
                <ThemedText type="body" style={[styles.recommendationCardText, { color: LuxuryColors.obsidian, marginLeft: Spacing.sm }]}>
                  {t("decideForMe.rubyAdjusting") || "Ruby is adjusting your look..."}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="body" style={[styles.recommendationCardText, { color: LuxuryColors.obsidian }]}>
                {recommendation?.outfit && renderMarkdownText(recommendation.outfit)}
              </ThemedText>
            )}
          </View>
          
          {recommendation?.reasoning ? (
            <View style={[styles.recommendationReasoningSection, { backgroundColor: 'rgba(74, 52, 40, 0.1)' }]}>
              <Feather name="info" size={14} color="rgba(74, 52, 40, 0.7)" />
              <ThemedText type="small" style={[styles.recommendationReasoningText, { color: 'rgba(74, 52, 40, 0.85)' }]}>
                {renderMarkdownText(recommendation.reasoning)}
              </ThemedText>
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>

      <ThemedText type="small" style={[styles.disclaimerText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280' }]}>
        {t("decideForMe.disclaimer") || "I'm choosing generally. With your wardrobe, I'd choose specifically."}
      </ThemedText>

      {styleAdvice?.imageUrl || isGeneratingImage ? (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.outfitImageContainer}>
          {isGeneratingImage && !styleAdvice?.imageUrl ? (
            <View style={[styles.imageLoadingContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <ActivityIndicator size="small" color={isDark ? LuxuryColors.gold : LuxuryColors.deepGold} />
              <ThemedText type="small" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280', marginTop: Spacing.sm }}>
                {t("decideForMe.visualizing") || "Visualizing your outfit..."}
              </ThemedText>
            </View>
          ) : styleAdvice?.imageUrl ? (
            <Image 
              source={{ uri: styleAdvice.imageUrl }} 
              style={styles.outfitImage}
              resizeMode="cover"
            />
          ) : null}
        </Animated.View>
      ) : null}

      {styleAdvice ? (
        <Animated.View entering={FadeInDown.delay(300)} style={styles.styleAdviceContainer}>
          <View
            style={[
              styles.styleRuleCard,
              { 
                backgroundColor: isDark ? `${LuxuryColors.gold}20` : `${LuxuryColors.gold}15`,
                borderColor: isDark ? `${LuxuryColors.gold}40` : `${LuxuryColors.deepGold}50`,
              }
            ]}
          >
            <View style={styles.styleRuleHeader}>
              <Feather name="star" size={14} color={isDark ? LuxuryColors.gold : LuxuryColors.deepGold} />
              <ThemedText type="small" style={{ color: isDark ? LuxuryColors.gold : LuxuryColors.deepGold, fontWeight: '600', marginLeft: Spacing.xs }}>
                {t("decideForMe.styleRule") || "Style Rule"}
              </ThemedText>
            </View>
            <ThemedText type="body" style={[styles.styleRuleText, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>
              {styleAdvice.styleRule}
            </ThemedText>
            <ThemedText type="small" style={[styles.styleExplanationText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#4B5563' }]}>
              {styleAdvice.explanation}
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(200)} style={styles.actionButtonsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.link, borderWidth: 1 }]}
          onPress={handleSaveOutfit}
        >
          <Feather name="bookmark" size={18} color={theme.link} />
          <ThemedText type="body" style={[styles.actionButtonText, { color: theme.link }]}>
            {t("decideForMe.saveOutfit") || "Save outfit"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.actionButton, 
            { 
              backgroundColor: isLoadingAnotherOption ? theme.link : theme.backgroundSecondary, 
              borderColor: isLoadingAnotherOption ? theme.link : theme.border, 
              borderWidth: 1,
              opacity: isLoadingAnotherOption ? 0.8 : 1,
            }
          ]}
          onPress={handleAnotherOption}
          disabled={isLoadingAnotherOption}
        >
          <Feather 
            name="refresh-cw" 
            size={18} 
            color={isLoadingAnotherOption ? "#FFFFFF" : theme.text} 
            style={isLoadingAnotherOption ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
          <ThemedText type="body" style={[styles.actionButtonText, { color: isLoadingAnotherOption ? "#FFFFFF" : theme.text }]}>
            {isLoadingAnotherOption
              ? t("decideForMe.loading") || t("common.loading") || "Loading..."
              : t("decideForMe.anotherOption") || "Another option"}
          </ThemedText>
        </Pressable>
      </Animated.View>

      <View style={styles.calibrationSection} pointerEvents="box-none">
        <ThemedText type="body" style={[styles.calibrationMessage, { color: theme.tabIconDefault }]}>
          {isRefiningOutfit
            ? t("decideForMe.updatingOutfit") || "Updating your outfit..."
            : t("decideForMe.calibrationMessage") || styleDirectionService.getCalibrationMessage()}
        </ThemedText>
        <View
          style={[styles.expressionInputContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
          pointerEvents="auto"
        >
          <TextInput
            ref={resultExpressionInputRef}
            style={[styles.expressionInput, { color: theme.text }]}
            placeholder={t("decideForMe.expressionPlaceholder") || styleDirectionService.getExpressionPlaceholder()}
            placeholderTextColor={theme.tabIconDefault}
            value={expressionText}
            onChangeText={(text) => setExpressionText(text.slice(0, MAX_EXPRESSION_LENGTH))}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => { void handleExpressionSubmit(); }}
            multiline={false}
            maxLength={MAX_EXPRESSION_LENGTH}
            editable={!isRefiningOutfit}
          />
          <Pressable
            onPress={() => { void handleExpressionSubmit(); }}
            style={({ pressed }) => [
              styles.expressionSendButton,
              pressed && { opacity: 0.6 },
              (!expressionText.trim() || isRefiningOutfit) && { opacity: 0.35 },
            ]}
            disabled={!expressionText.trim() || isSubmittingExpression || isRefiningOutfit}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t("decideForMe.sendFeedback") || "Send feedback to Ruby"}
          >
            {isRefiningOutfit ? (
              <ActivityIndicator size="small" color={theme.link} />
            ) : (
              <Feather name="send" size={18} color={theme.link} />
            )}
          </Pressable>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(400)} style={styles.ctaSection}>
        <ThemedText type="body" style={[styles.ctaPrompt, { color: theme.tabIconDefault }]}>
          {t("decideForMe.wantPersonalised") || "Want this personalised to your wardrobe?"}
        </ThemedText>

        <Button onPress={handlePersonalise} style={[styles.primaryButton, { backgroundColor: theme.link }]}>
          {t("decideForMe.yesPersonalise") || "Yes, personalise it"}
        </Button>

        <Pressable onPress={handleJustBrowsing} style={styles.secondaryButton}>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            {t("decideForMe.justBrowsing") || "I'm just browsing"}
          </ThemedText>
        </Pressable>
      </Animated.View>

      {showSavePrompt ? renderSavePrompt() : null}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          ScreenGradients.decideForMe.primary[0],
          ScreenGradients.decideForMe.primary[1],
          '#FAF8F5',
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: 'rgba(74, 52, 40, 0.1)' }]}>
          <Feather name="arrow-left" size={24} color={ScreenGradients.decideForMe.accent} />
        </Pressable>
        <ThemedText type="h3" style={{ color: ScreenGradients.decideForMe.accent }}>
          {t("decideForMe.title") || "Decide for me"}
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      {Platform.OS === 'web' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {step === "occasion" ? renderOccasionStep() : null}
          {step === "loading" ? renderLoadingStep() : null}
          {step === "result" ? renderResultStep() : null}
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          ref={scrollRef as any}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl * 6 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          bottomOffset={160}
        >
          {step === "occasion" ? renderOccasionStep() : null}
          {step === "loading" ? renderLoadingStep() : null}
          {step === "result" ? renderResultStep() : null}
        </KeyboardAwareScrollView>
      )}
    </View>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  stepContainer: {
    paddingBottom: Spacing.xl,
  },
  stylistMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    backgroundColor: 'rgba(74, 52, 40, 0.1)',
  },
  messageBubble: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4A3428',
  },
  weatherBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  promptInputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: 'rgba(74, 52, 40, 0.07)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(74, 52, 40, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  promptInput: {
    flex: 1,
    fontSize: 15,
    color: '#4A3428',
    paddingVertical: Spacing.xs,
    minHeight: 40,
    maxHeight: 100,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  optionWrapper: {
    width: "47%",
  },
  optionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  occasionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: Spacing.lg,
  },
  resultContainer: {
    paddingBottom: Spacing.xl,
  },
  resultBubble: {
    backgroundColor: "rgba(233,30,99,0.1)",
  },
  recommendationText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500",
  },
  outfitRecommendationCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    elevation: 8,
  },
  recommendationCardGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: '#FAF8F5',
  },
  recommendationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  rubyAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  recommendationHeaderText: {
    flex: 1,
  },
  recommendationCardBody: {
    marginBottom: Spacing.md,
  },
  recommendationCardText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500",
  },
  recommendationReasoningSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  recommendationReasoningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  outfitImageContainer: {
    marginVertical: Spacing.md,
    alignItems: "center",
  },
  imageLoadingContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    width: "100%",
  },
  outfitImage: {
    width: "100%",
    height: 280,
    borderRadius: BorderRadius.lg,
  },
  styleAdviceContainer: {
    marginBottom: Spacing.md,
  },
  styleRuleCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(201, 168, 124, 0.3)",
  },
  styleRuleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  styleRuleText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  styleExplanationText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
  },
  disclaimerText: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    fontStyle: "italic",
    textAlign: "center",
  },
  actionButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  calibrationSection: {
    marginBottom: Spacing.lg,
  },
  calibrationMessage: {
    fontSize: 15,
    fontStyle: "italic",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  expressionInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  expressionInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
    height: 44,
  },
  expressionSendButton: {
    padding: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refiningRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaSection: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  ctaPrompt: {
    marginBottom: Spacing.lg,
    textAlign: "center",
    fontStyle: "italic",
  },
  primaryButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
  },
  savePromptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  savePromptCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  savePromptTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  savePromptSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  savePromptButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  savePromptSecondary: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  styleChipsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  styleChipsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  styleChipsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  dismissButton: {
    padding: Spacing.xs,
  },
  styleChipsSubtitle: {
    marginBottom: Spacing.lg,
  },
  styleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  styleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
