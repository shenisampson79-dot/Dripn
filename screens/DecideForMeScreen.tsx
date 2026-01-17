import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, TextInput, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { stylistUpgradeService } from "@/services/StylistUpgradeService";
import { styleDirectionService, StyleDirection } from "@/services/StyleDirectionService";

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

const CACHED_OUTFITS_KEY = "dripn_cached_outfits";
const RECOMMENDATION_COUNT_KEY = "dripn_recommendation_count";
const STYLE_DIRECTION_SET_KEY = "dripn_style_direction_set";

const STYLE_CHIPS = [
  { id: "masculine" as StyleDirection, label: "Masculine" },
  { id: "feminine" as StyleDirection, label: "Feminine" },
  { id: "androgynous" as StyleDirection, label: "Androgynous" },
  { id: "not_sure" as StyleDirection, label: "Not sure yet" },
];

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

const getFilteredOutfits = (occasion: string | null, temperature: number | null): FallbackOutfit[] => {
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
  
  return filtered.length > 0 ? filtered : FALLBACK_OUTFITS;
};

export default function DecideForMeScreen({ navigation }: DecideForMeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  const [step, setStep] = useState<"occasion" | "loading" | "result">("occasion");
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
  } | null>(null);
  const recommendationCountRef = useRef(0);
  const outfitIndexRef = useRef(0);
  const [isLoadingAnotherOption, setIsLoadingAnotherOption] = useState(false);
  const [isLoadingSecondOpinion, setIsLoadingSecondOpinion] = useState(false);

  useEffect(() => {
    fetchWeather();
    loadCachedOutfitsCount();
    loadRecommendationCount();
    checkStyleDirectionStatus();
    loadFirstMessages();
  }, []);

  const loadFirstMessages = async () => {
    const messages = await styleDirectionService.getFirstMessages();
    setFirstMessages(messages);
  };

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

  const checkGate = async () => {
    try {
      const data = await apiService.post<{ showGate?: boolean }>("/api/onboarding/check-gate", {
        recommendationCount: recommendationCountRef.current,
      });
      if (data?.showGate) {
        navigation.navigate("SoftSignupGate", { fromPath: "browsing" });
      }
    } catch (error) {
      console.log("Failed to check gate");
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

  const handleOccasionSelect = async (occasionId: string) => {
    setSelectedOccasion(occasionId);
    setStep("loading");
    
    // Get context-aware fallback
    const filteredOutfits = getFilteredOutfits(occasionId, weather?.temperature ?? null);
    const randomIndex = Math.floor(Math.random() * filteredOutfits.length);
    outfitIndexRef.current = randomIndex;
    const fallbackOutfit = filteredOutfits[randomIndex];

    try {
      const data = await apiService.post<{ id?: string; recommendation?: string; reasoning?: string; stylistName?: string }>("/api/onboarding/quick-recommendation", {
        occasion: occasionId,
        weather: weather,
        region: weather?.location || "UK",
        styleExpression: expressionText.trim() || undefined,
      });

      if (data && data.recommendation) {
        setRecommendation({
          id: data.id,
          outfit: data.recommendation,
          reasoning: data.reasoning || "This look balances comfort with style, perfect for your occasion.",
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
    } catch (error: unknown) {
      setRecommendation({
        outfit: fallbackOutfit.outfit,
        reasoning: fallbackOutfit.reasoning,
        stylistName: "Ruby",
      });
      setStep("result");
      incrementRecommendationCount();
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

  const handleSaveOutfit = async () => {
    await recordInteraction("save_outfit");
    
    await stylistUpgradeService.recordSignal("SAVE", recommendation?.stylistName?.toLowerCase(), {
      message: "User tapped save outfit",
      occasion: selectedOccasion,
    });
    
    setShowSavePrompt(true);
  };

  const handleCreateAccount = () => {
    setShowSavePrompt(false);
    navigation.navigate("SoftSignupGate", { fromPath: "save_outfit" });
  };

  const handleNotNow = async () => {
    setShowSavePrompt(false);
    
    try {
      const cached = await AsyncStorage.getItem(CACHED_OUTFITS_KEY);
      const outfits = cached ? JSON.parse(cached) : [];
      
      if (outfits.length >= 3) {
        Alert.alert(
          "Create an account to save more",
          "You've saved 3 outfits. Create a free account to keep them forever.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Create account", onPress: handleCreateAccount },
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
      
      Alert.alert(
        "Saved temporarily",
        "This will disappear when you leave the app. Create an account to keep it forever.",
        [{ text: "Got it" }]
      );
    } catch (error) {
      console.log("Failed to cache outfit");
    }
  };

  const handleAnotherOption = async () => {
    setIsLoadingAnotherOption(true);
    await recordInteraction("another_option");
    
    // Get filtered outfits based on occasion and weather
    const filteredOutfits = getFilteredOutfits(selectedOccasion, weather?.temperature ?? null);
    
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

  const handleSecondOpinion = async () => {
    setIsLoadingSecondOpinion(true);
    await recordInteraction("second_opinion");
    
    setTimeout(() => {
      setIsLoadingSecondOpinion(false);
      Alert.alert(
        "Get a Second Opinion",
        "Post your outfit to the community and get votes from real people within 45 minutes. Create a free account to use this feature.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Create account", onPress: () => navigation.navigate("SoftSignupGate", { fromPath: "second_opinion" }) },
        ]
      );
    }, 300);
  };

  const [isSubmittingExpression, setIsSubmittingExpression] = useState(false);
  
  const handleExpressionSubmit = async () => {
    if (expressionText.trim() && !isSubmittingExpression) {
      setIsSubmittingExpression(true);
      const userExpression = expressionText.trim();
      
      try {
        await styleDirectionService.recordStyleExpression(userExpression);
        await recordInteraction("style_expression", userExpression);
        
        // Generate a tailored response based on user's expression
        const tailoredRecommendation = generateTailoredRecommendation(userExpression, selectedOccasion || "work");
        
        setRecommendation({
          outfit: tailoredRecommendation.outfit,
          reasoning: tailoredRecommendation.reasoning,
          stylistName: "Ruby",
        });
        
        setExpressionText("");
      } catch (error) {
        console.log("Failed to submit expression");
      } finally {
        setIsSubmittingExpression(false);
      }
    }
  };
  
  const generateTailoredRecommendation = (expression: string, occasion: string): { outfit: string; reasoning: string } => {
    const expressionLower = expression.toLowerCase();
    
    // Finance/formal work context
    if (expressionLower.includes("finance") || expressionLower.includes("bank") || expressionLower.includes("suit") || expressionLower.includes("formal")) {
      return {
        outfit: "A well-fitted navy or charcoal suit with a crisp white shirt, silk tie in a subtle pattern, and polished Oxford shoes. Add a quality leather belt to complete the look.",
        reasoning: "For finance, precision matters. This classic combination commands respect while staying professionally appropriate.",
      };
    }
    
    // Casual preferences
    if (expressionLower.includes("casual") || expressionLower.includes("jeans") || expressionLower.includes("comfortable")) {
      return {
        outfit: "Dark slim-fit jeans with a well-fitted jumper in a neutral tone. Add clean white trainers and a quality watch for polish.",
        reasoning: "Casual doesn't mean sloppy. This look is relaxed but intentional.",
      };
    }
    
    // Creative/relaxed work
    if (expressionLower.includes("creative") || expressionLower.includes("startup") || expressionLower.includes("tech")) {
      return {
        outfit: "Smart chinos with a quality fitted t-shirt and a structured blazer. Clean minimalist trainers tie it together.",
        reasoning: "Modern workplaces value authenticity. This says capable without being corporate.",
      };
    }
    
    // Default tailored response
    return {
      outfit: "Tailored trousers with a quality shirt in a flattering colour for you. Add appropriate footwear for your environment and a confidence-boosting accessory.",
      reasoning: `I've noted your preferences. This adapts to what you've told me: "${expression.slice(0, 50)}${expression.length > 50 ? "..." : ""}"`,
    };
  };

  const handlePersonalise = () => {
    navigation.navigate("StyleMeProperly");
  };

  const handleJustBrowsing = () => {
    navigation.navigate("OnboardingEntry");
  };

  const renderOccasionStep = () => {
    const options = firstMessages?.options || [
      { id: "work", label: "Work" },
      { id: "date", label: "Date" },
      { id: "casual", label: "Casual" },
      { id: "event", label: "Event" },
      { id: "browsing", label: "Just browsing" },
    ];
    const message = firstMessages?.message || "Tell me what you're dressing for — I'll decide the outfit.";

    return (
      <Animated.View entering={FadeIn} style={styles.stepContainer}>
        <View style={styles.stylistMessage}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.link }]}>
            <Feather name="message-circle" size={20} color="#FFFFFF" />
          </View>
          <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="body" style={[styles.messageText, { color: theme.text }]}>
              {message}
            </ThemedText>
          </View>
        </View>

        {weather && !isLoadingWeather ? (
          <Animated.View entering={FadeInDown.delay(200)} style={[styles.weatherBadge, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="cloud" size={16} color={theme.tabIconDefault} />
            <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: Spacing.xs }}>
              {weather.temperature}° in {weather.location}
            </ThemedText>
          </Animated.View>
        ) : null}

        <View style={styles.optionsGrid}>
          {options.map((option, index) => (
            <Animated.View 
              key={option.id} 
              entering={FadeInUp.delay(100 + index * 50)}
              style={styles.optionWrapper}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.optionCard,
                  { 
                    backgroundColor: selectedOccasion === option.id ? theme.link : theme.backgroundSecondary,
                    opacity: pressed ? 0.9 : 1,
                  }
                ]}
                onPress={() => handleOccasionSelect(option.id)}
              >
                <Feather 
                  name={OCCASION_ICONS[option.id] || "circle"} 
                  size={24} 
                  color={selectedOccasion === option.id ? "#FFFFFF" : theme.text} 
                />
                <ThemedText 
                  type="body" 
                  style={[
                    styles.optionLabel,
                    { color: selectedOccasion === option.id ? "#FFFFFF" : theme.text }
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderLoadingStep = () => (
    <Animated.View entering={FadeIn} style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.link} />
      <ThemedText type="body" style={[styles.loadingText, { color: theme.tabIconDefault }]}>
        Ruby is deciding your outfit...
      </ThemedText>
    </Animated.View>
  );

  const renderSavePrompt = () => (
    <Animated.View entering={FadeIn} style={[styles.savePromptOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
      <View style={[styles.savePromptCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h3" style={[styles.savePromptTitle, { color: theme.text }]}>
          Keep this outfit?
        </ThemedText>
        <ThemedText type="body" style={[styles.savePromptSubtitle, { color: theme.tabIconDefault }]}>
          Create a free account to save it forever
        </ThemedText>
        
        <Button onPress={handleCreateAccount} style={[styles.savePromptButton, { backgroundColor: theme.link }]}>
          Create account
        </Button>
        
        <Pressable onPress={handleNotNow} style={styles.savePromptSecondary}>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            Not now
          </ThemedText>
          {cachedOutfitsCount > 0 ? (
            <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: 4 }}>
              ({3 - cachedOutfitsCount} saves left)
            </ThemedText>
          ) : null}
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderResultStep = () => (
    <Animated.View entering={FadeIn} style={styles.resultContainer}>
      <View style={styles.stylistMessage}>
        <View style={[styles.avatarCircle, { backgroundColor: "#E91E63" }]}>
          <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>R</ThemedText>
        </View>
        <View style={[styles.messageBubble, styles.resultBubble]}>
          <ThemedText type="body" style={[styles.messageText, styles.recommendationText]}>
            {recommendation?.outfit}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" style={[styles.disclaimerText, { color: theme.tabIconDefault }]}>
        I'm choosing generally. With your wardrobe, I'd choose specifically.
      </ThemedText>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.actionButtonsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.link, borderWidth: 1 }]}
          onPress={handleSaveOutfit}
        >
          <Feather name="bookmark" size={18} color={theme.link} />
          <ThemedText type="body" style={[styles.actionButtonText, { color: theme.link }]}>
            Save outfit
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
            {isLoadingAnotherOption ? "Loading..." : "Another option"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.actionButton, 
            { 
              backgroundColor: isLoadingSecondOpinion ? theme.link : theme.backgroundSecondary, 
              borderColor: isLoadingSecondOpinion ? theme.link : theme.border, 
              borderWidth: 1,
              opacity: isLoadingSecondOpinion ? 0.8 : 1,
            }
          ]}
          onPress={handleSecondOpinion}
          disabled={isLoadingSecondOpinion}
        >
          <Feather name="users" size={18} color={isLoadingSecondOpinion ? "#FFFFFF" : theme.text} />
          <ThemedText type="body" style={[styles.actionButtonText, { color: isLoadingSecondOpinion ? "#FFFFFF" : theme.text }]}>
            {isLoadingSecondOpinion ? "Loading..." : "Second opinion"}
          </ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)} style={styles.calibrationSection}>
        <ThemedText type="body" style={[styles.calibrationMessage, { color: theme.tabIconDefault }]}>
          {styleDirectionService.getCalibrationMessage()}
        </ThemedText>
        <View style={[styles.expressionInputContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <TextInput
            style={[styles.expressionInput, { color: theme.text, minHeight: 44, maxHeight: 120 }]}
            placeholder={styleDirectionService.getExpressionPlaceholder()}
            placeholderTextColor={theme.tabIconDefault}
            value={expressionText}
            onChangeText={(text) => setExpressionText(text.slice(0, MAX_EXPRESSION_LENGTH))}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleExpressionSubmit}
            multiline={true}
            textAlignVertical="top"
            maxLength={MAX_EXPRESSION_LENGTH}
          />
          {expressionText.trim() ? (
            <Pressable 
              onPress={handleExpressionSubmit} 
              style={styles.expressionSendButton}
              disabled={isSubmittingExpression}
            >
              <Feather name="send" size={18} color={isSubmittingExpression ? theme.tabIconDefault : theme.link} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)} style={styles.ctaSection}>
        <ThemedText type="body" style={[styles.ctaPrompt, { color: theme.tabIconDefault }]}>
          Want this personalised to your wardrobe?
        </ThemedText>

        <Button onPress={handlePersonalise} style={[styles.primaryButton, { backgroundColor: theme.link }]}>
          Yes, personalise it
        </Button>

        <Pressable onPress={handleJustBrowsing} style={styles.secondaryButton}>
          <ThemedText type="body" style={{ color: theme.tabIconDefault }}>
            I'm just browsing
          </ThemedText>
        </Pressable>
      </Animated.View>

      {showSavePrompt ? renderSavePrompt() : null}
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text }}>Decide for me</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScreenScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {step === "occasion" ? renderOccasionStep() : null}
        {step === "loading" ? renderLoadingStep() : null}
        {step === "result" ? renderResultStep() : null}
      </ScreenScrollView>
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
    flex: 1,
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
  },
  messageBubble: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
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
    flex: 1,
  },
  resultBubble: {
    backgroundColor: "rgba(233,30,99,0.1)",
  },
  recommendationText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500",
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
    paddingVertical: Spacing.sm,
  },
  expressionInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  expressionSendButton: {
    padding: Spacing.sm,
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
