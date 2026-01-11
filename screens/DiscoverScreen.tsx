/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable, Image, ScrollView, Dimensions, Alert, ImageSourcePropType, Linking, ActivityIndicator, LayoutChangeEvent, Modal } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { shareChallenge } from "@/services/SharingService";
import { getInfluencerStyleGuide, TRENDING_STYLES_2025_2026 } from "@/services/AIAdviceService";
import { MagazineInspirationService, MagazineInspiration } from "@/services/MagazineInspirationService";
import { useOutfitFavorites, StyleOfTheDayOutfit } from "@/contexts/OutfitFavoritesContext";
import { useStyleProfile } from "@/contexts/StyleProfileContext";
import apiService from "@/services/ApiService";
import { currencyService } from "@/services/CurrencyService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type RegionalModelType = 'multicultural' | 'asian' | 'african' | 'middle-eastern' | 'south-asian' | 'latin-american';

type GenderImageSet = {
  male: ImageSourcePropType;
  female: ImageSourcePropType;
};

const REGIONAL_STYLE_IMAGES: Record<RegionalModelType, GenderImageSet> = {
  'multicultural': {
    female: require("../assets/images/models/multicultural.png"),
    male: require("../assets/images/models/multicultural-male.png"),
  },
  'asian': {
    female: require("../assets/images/models/asian.png"),
    male: require("../assets/images/models/asian-male.png"),
  },
  'african': {
    female: require("../assets/images/models/african.png"),
    male: require("../assets/images/models/african-male.png"),
  },
  'middle-eastern': {
    female: require("../assets/images/models/middle-eastern.png"),
    male: require("../assets/images/models/middle-eastern-male.png"),
  },
  'south-asian': {
    female: require("../assets/images/models/south-asian.png"),
    male: require("../assets/images/models/south-asian-male.png"),
  },
  'latin-american': {
    female: require("../assets/images/models/latin-american.png"),
    male: require("../assets/images/models/latin-american-male.png"),
  },
};

type GenderType = 'male' | 'female';

const REGIONAL_STYLE_TIPS: Record<RegionalModelType, Record<GenderType, { title: string; description: string }>> = {
  'multicultural': {
    female: {
      title: "Global Fusion Elegance",
      description: "Style of the Day: A sophisticated blend of contemporary fashion celebrating diverse influences. Flowing silhouettes meet statement jewelry for effortless glamour.",
    },
    male: {
      title: "Modern Global Sophistication",
      description: "Style of the Day: Sharp tailoring meets global influences. A well-fitted blazer, quality leather loafers, and subtle accessories for refined confidence.",
    },
  },
  'asian': {
    female: {
      title: "Modern Minimalist Chic",
      description: "Style of the Day: Elegant simplicity with contemporary aesthetics. Structured silhouettes, clean lines, and delicate pearl accessories for understated beauty.",
    },
    male: {
      title: "Clean-Cut Contemporary",
      description: "Style of the Day: Minimalist elegance with precise tailoring. Slim-fit trousers, quality knitwear, and sleek leather goods for refined simplicity.",
    },
  },
  'african': {
    female: {
      title: "Vibrant Heritage Style",
      description: "Style of the Day: Bold patterns and rich colors celebrating African fashion heritage. Modern cuts paired with statement earrings for confident elegance.",
    },
    male: {
      title: "Bold Heritage Confidence",
      description: "Style of the Day: Rich earth tones and bold prints celebrating African heritage. A well-fitted blazer with patterned pocket square for distinguished style.",
    },
  },
  'middle-eastern': {
    female: {
      title: "Modest Elegance",
      description: "Style of the Day: Graceful contemporary styling with sophisticated modest fashion. Flowing abayas, silk scarves, and gold accessories for timeless beauty.",
    },
    male: {
      title: "Distinguished Refinement",
      description: "Style of the Day: Classic tailoring with modern touches. Crisp white shirts, quality leather belts, and subtle cufflinks for polished sophistication.",
    },
  },
  'south-asian': {
    female: {
      title: "Contemporary Fusion",
      description: "Style of the Day: Modern styling meets cultural richness. Elegant kurtas with statement jhumkas, or contemporary saree draping for graceful confidence.",
    },
    male: {
      title: "Modern Traditional Fusion",
      description: "Style of the Day: Sharp Indo-western styling. A well-tailored bandhgala jacket with contemporary trousers for distinguished elegance.",
    },
  },
  'latin-american': {
    female: {
      title: "Warm Vibrant Style",
      description: "Style of the Day: Earthy tones and vibrant accents. Flowy dresses with bold jewelry celebrating Latin warmth and contemporary elegance.",
    },
    male: {
      title: "Confident Latin Elegance",
      description: "Style of the Day: Warm earth tones with refined tailoring. Linen blazers, quality leather accessories, and relaxed sophistication.",
    },
  },
};

const getRegionFromCountry = (country: string): RegionalModelType => {
  const europeanCountries = [
    'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Portugal', 'Netherlands',
    'Belgium', 'Switzerland', 'Austria', 'Poland', 'Czech Republic', 'Hungary', 'Romania',
    'Bulgaria', 'Greece', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Iceland',
    'Croatia', 'Serbia', 'Slovenia', 'Slovakia', 'Lithuania', 'Latvia', 'Estonia',
    'Luxembourg', 'Malta', 'Cyprus', 'Albania', 'Montenegro', 'North Macedonia',
    'Bosnia and Herzegovina', 'Moldova', 'Belarus', 'Ukraine', 'Russia'
  ];
  const northAmericanCountries = ['United States', 'Canada'];
  const asianCountries = [
    'Japan', 'South Korea', 'China', 'Taiwan', 'Hong Kong', 'Singapore', 'Thailand',
    'Vietnam', 'Malaysia', 'Indonesia', 'Philippines'
  ];
  const southAsianCountries = ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal'];
  const africanCountries = [
    'Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Ethiopia', 'Egypt', 'Morocco',
    'Tanzania', 'Uganda', 'Senegal', 'Cameroon', 'Ivory Coast'
  ];
  const middleEasternCountries = [
    'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
    'Jordan', 'Lebanon', 'Israel', 'Turkey', 'Iran', 'Iraq'
  ];
  const latinAmericanCountries = [
    'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela',
    'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Costa Rica', 'Panama',
    'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Dominican Republic'
  ];

  if (europeanCountries.includes(country) || northAmericanCountries.includes(country)) {
    return 'multicultural';
  }
  if (asianCountries.includes(country)) return 'asian';
  if (southAsianCountries.includes(country)) return 'south-asian';
  if (africanCountries.includes(country)) return 'african';
  if (middleEasternCountries.includes(country)) return 'middle-eastern';
  if (latinAmericanCountries.includes(country)) return 'latin-american';

  return 'multicultural';
};

type DiscoverScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "Discover">;
};

const { width } = Dimensions.get("window");

const TILE_COLUMNS = 2;
const TILE_GAP = 16;
const TILE_SIZE = (width - Spacing.lg * 2 - TILE_GAP * (TILE_COLUMNS - 1)) / TILE_COLUMNS;

const TILE_TEXT_COLOR = "#FFFFFF";
const TILE_ICON_SIZE = 36;
const TILE_LABEL_SIZE = 15;

interface CategoryTile {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  pastelBg: string;
  description: string;
  screen?: keyof DiscoverStackParamList;
  sectionId?: string;
}

const CATEGORY_TILES: CategoryTile[] = [
  { id: "styleOfTheDay", name: "Style of Day", icon: "award", pastelBg: "#E85D75", description: "Your personalized daily outfit recommendation tailored to your style and region.", sectionId: "styleOfTheDay" },
  { id: "trends", name: "Trends", icon: "trending-up", pastelBg: "#6366F1", description: "What's hot right now in fashion with real-time trend analysis and weekly highlights.", sectionId: "trendScanner" },
  { id: "styleIcons", name: "Style Icons", icon: "star", pastelBg: "#F59E0B", description: "Get inspired by celebrities and top fashion influencers with AI-powered lookalike outfits.", sectionId: "celebrity" },
  { id: "challenges", name: "Challenges", icon: "flag", pastelBg: "#EC4899", description: "Join fun style challenges, compete with the community, and showcase your creativity.", screen: "StyleChallenges" },
  { id: "virtualTryOn", name: "Try-On", icon: "camera", pastelBg: "#8B5CF6", description: "Virtually try on clothes and see how they look on you before buying.", screen: "VirtualTryOn" },
  { id: "fashionTherapy", name: "Style Therapy", icon: "heart", pastelBg: "#F472B6", description: "Mood-based styling, body positivity affirmations, and wellness-focused outfit recommendations.", screen: "FashionTherapy" },
  { id: "sustainability", name: "Eco Style", icon: "globe", pastelBg: "#10B981", description: "Discover sustainable fashion brands and eco-friendly styling tips.", screen: "Sustainability" },
  { id: "fashionReads", name: "Fashion Reads", icon: "book-open", pastelBg: "#3B82F6", description: "Expert fashion articles, styling tips, magazine looks, and in-depth guides.", screen: "FashionBlog" },
  { id: "offers", name: "Offers", icon: "tag", pastelBg: "#EF4444", description: "Exclusive daily deals and discounts from trusted fashion retailers.", screen: "Bargains" },
  { id: "community", name: "Community", icon: "users", pastelBg: "#14B8A6", description: "Events, people, and connections - discover fashion happenings and fellow enthusiasts.", screen: "Community" },
];

const SECTION_NAV = [
  { id: "styleOfTheDay", name: "Style of Day", icon: "award" as const },
  { id: "trendScanner", name: "Trends", icon: "trending-up" as const },
  { id: "influencer", name: "Influencers", icon: "users" as const },
  { id: "magazine", name: "Magazines", icon: "book-open" as const },
  { id: "celebrity", name: "Celebrity", icon: "star" as const },
  { id: "challenges", name: "Challenges", icon: "flag" as const },
  { id: "highlights", name: "Highlights", icon: "zap" as const },
  { id: "blog", name: "Blog", icon: "edit-3" as const },
];

interface Challenge {
  id: string;
  name: string;
  description: string;
  hashtag: string;
  participants: number;
  daysLeft: number;
  gradientColors: [string, string];
  icon: keyof typeof Feather.glyphMap;
}

const TRENDING_CHALLENGES: Challenge[] = [
  {
    id: "ch1",
    name: "Capsule Wardrobe Week",
    description: "Style 7 different looks using only 10 items",
    hashtag: "#CapsuleChallenge",
    participants: 2847,
    daysLeft: 5,
    gradientColors: ["#667eea", "#764ba2"],
    icon: "grid",
  },
  {
    id: "ch2",
    name: "Thrift Flip Friday",
    description: "Transform a thrift find into a showstopper",
    hashtag: "#ThriftFlip",
    participants: 1923,
    daysLeft: 2,
    gradientColors: ["#f093fb", "#f5576c"],
    icon: "refresh-cw",
  },
  {
    id: "ch3",
    name: "Monochrome Monday",
    description: "Create a head-to-toe single color look",
    hashtag: "#MonoMood",
    participants: 3156,
    daysLeft: 4,
    gradientColors: ["#4facfe", "#00f2fe"],
    icon: "target",
  },
];

interface CelebrityLook {
  id: string;
  styleName: string;
  inspiration: string;
  image: ImageSourcePropType;
  gender: 'male' | 'female';
  budgetItems: { name: string; price: number; store: string }[];
  luxuryItems: { name: string; price: number; store: string }[];
}

const CELEBRITY_LOOKS: CelebrityLook[] = [
  {
    id: "look1-female",
    styleName: "Street Style Chic",
    inspiration: "Off-duty model aesthetic",
    image: require("../assets/images/celebrity-looks/street_style_chic_outfit.png"),
    gender: "female",
    budgetItems: [
      { name: "Oversized Cream Blazer", price: 59.99, store: "Zara" },
      { name: "High-Waisted Blue Jeans", price: 39.99, store: "H&M" },
      { name: "Basic White Tee", price: 12.99, store: "Uniqlo" },
      { name: "Gold Layered Necklace Set", price: 19.99, store: "ASOS" },
    ],
    luxuryItems: [
      { name: "Wool Blend Blazer", price: 395, store: "Theory" },
      { name: "High Rise Slim Jeans", price: 228, store: "Citizens of Humanity" },
      { name: "Pima Cotton Tee", price: 95, store: "Vince" },
      { name: "14K Gold Chain Necklace", price: 450, store: "Mejuri" },
    ],
  },
  {
    id: "look1-male",
    styleName: "Street Style Edge",
    inspiration: "Off-duty model aesthetic",
    image: require("../assets/images/celebrity-looks/street_style_chic_outfit_male.png"),
    gender: "male",
    budgetItems: [
      { name: "Fitted Denim Jacket", price: 69.99, store: "Zara" },
      { name: "Slim-Fit Dark Jeans", price: 49.99, store: "H&M" },
      { name: "White Crew Neck Tee", price: 14.99, store: "Uniqlo" },
      { name: "Clean White Leather Sneakers", price: 79.99, store: "ASOS" },
    ],
    luxuryItems: [
      { name: "Premium Denim Jacket", price: 425, store: "APC" },
      { name: "Japanese Selvedge Denim", price: 298, store: "Rag & Bone" },
      { name: "Egyptian Cotton Tee", price: 125, store: "James Perse" },
      { name: "Leather Low-Top Sneakers", price: 550, store: "Common Projects" },
    ],
  },
  {
    id: "look2-female",
    styleName: "Evening Elegance",
    inspiration: "Red carpet glamour",
    image: require("../assets/images/celebrity-looks/elegant_evening_slip_dress.png"),
    gender: "female",
    budgetItems: [
      { name: "Emerald Satin Slip Dress", price: 49.99, store: "Mango" },
      { name: "Strappy Block Heels", price: 45.99, store: "Steve Madden" },
      { name: "Layered Gold Necklaces", price: 24.99, store: "Nordstrom Rack" },
      { name: "Mini Clutch Bag", price: 29.99, store: "Target" },
    ],
    luxuryItems: [
      { name: "Silk Midi Slip Dress", price: 595, store: "Reformation" },
      { name: "Leather Strappy Sandals", price: 695, store: "Jimmy Choo" },
      { name: "Diamond Tennis Necklace", price: 2500, store: "Tiffany & Co" },
      { name: "Leather Clutch", price: 890, store: "Bottega Veneta" },
    ],
  },
  {
    id: "look2-male",
    styleName: "Evening Formal",
    inspiration: "Red carpet elegance",
    image: require("../assets/images/celebrity-looks/elegant_evening_formal_male.png"),
    gender: "male",
    budgetItems: [
      { name: "Black Dinner Jacket", price: 149.99, store: "Zara" },
      { name: "Crisp White Dress Shirt", price: 39.99, store: "Charles Tyrwhitt" },
      { name: "Black Dress Trousers", price: 59.99, store: "H&M" },
      { name: "Polished Oxford Shoes", price: 89.99, store: "Aldo" },
    ],
    luxuryItems: [
      { name: "Tailored Tuxedo Jacket", price: 895, store: "Hugo Boss" },
      { name: "French Cuff Dress Shirt", price: 225, store: "Turnbull & Asser" },
      { name: "Wool Blend Trousers", price: 350, store: "Canali" },
      { name: "Patent Leather Oxfords", price: 695, store: "Church's" },
    ],
  },
  {
    id: "look3-female",
    styleName: "Athleisure Vibes",
    inspiration: "Sporty wellness aesthetic",
    image: require("../assets/images/celebrity-looks/trendy_athleisure_look.png"),
    gender: "female",
    budgetItems: [
      { name: "Sage Green Workout Set", price: 44.99, store: "Amazon Essentials" },
      { name: "Oversized Hoodie", price: 34.99, store: "Nike" },
      { name: "White Sneakers", price: 69.99, store: "New Balance" },
      { name: "Gym Tote Bag", price: 24.99, store: "Lululemon Outlet" },
    ],
    luxuryItems: [
      { name: "Seamless Training Set", price: 178, store: "Alo Yoga" },
      { name: "Cashmere Hoodie", price: 395, store: "Naadam" },
      { name: "Leather Sneakers", price: 550, store: "Golden Goose" },
      { name: "Yoga Mat Bag", price: 158, store: "Lululemon" },
    ],
  },
  {
    id: "look3-male",
    styleName: "Athleisure Edge",
    inspiration: "Sporty wellness aesthetic",
    image: require("../assets/images/celebrity-looks/trendy_athleisure_look_male.png"),
    gender: "male",
    budgetItems: [
      { name: "Charcoal Performance Joggers", price: 49.99, store: "Nike" },
      { name: "Navy Technical Hoodie", price: 54.99, store: "Under Armour" },
      { name: "White Running Sneakers", price: 79.99, store: "New Balance" },
      { name: "Sports Gym Bag", price: 39.99, store: "Adidas" },
    ],
    luxuryItems: [
      { name: "Premium Tech Joggers", price: 198, store: "Lululemon" },
      { name: "Performance Hoodie", price: 295, store: "Reigning Champ" },
      { name: "Ultraboost Sneakers", price: 190, store: "Adidas" },
      { name: "Leather Gym Duffle", price: 450, store: "Mismo" },
    ],
  },
];

// All bargain-related data removed - handled by dedicated Offers tab
const getColorFromName = (colorName: string): string => {
  const colorMap: Record<string, string> = {
    'Deep chocolate brown': '#3D2314',
    'Burgundy': '#722F37',
    'Icy blue/powder blue': '#B0E0E6',
    'Butter yellow': '#FFFACD',
    'Mint green': '#98FB98',
    'Marigold gold': '#EAA221',
    'Cardinal red': '#C41E3A',
    'Leopard print (the new neutral)': '#C19A6B',
    'Cream': '#FFFDD0',
    'Olive green': '#808000',
    'Midnight plum': '#553355',
  };
  return colorMap[colorName] || '#888888';
};

interface EmergingTrend {
  name: string;
  category: string;
  description: string;
  emergenceLevel: string;
  mainstreamPrediction: string;
  keyInfluencers: string[];
  howToWear: string;
  buyNowSuggestion: string;
  confidenceScore: number;
}

export default function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, isExploringOtherCountry, explorationCountry, actualCountry, switchBackToActualLocation } = useAuth();
  const { tier } = useSubscription();
  const { posts, votePost, voteComparison, thankPost } = usePosts();
  const { isOutfitLiked, toggleOutfitLike } = useOutfitFavorites();
  const { hasStyleProfile, personalizedStyleOfTheDay, fetchPersonalizedStyleOfTheDay } = useStyleProfile();
  const [activeSection, setActiveSection] = useState("styleOfTheDay");
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});
  const [selectedLook, setSelectedLook] = useState<CelebrityLook | null>(null);
  const [dislikedPosts, setDislikedPosts] = useState<Set<string>>(new Set());
  const [emergingTrends, setEmergingTrends] = useState<EmergingTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [currencyInitialized, setCurrencyInitialized] = useState(false);
  const [celebrityLooksGenderFilter, setCelebrityLooksGenderFilter] = useState<'user' | 'female' | 'male'>('user');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedTile, setSelectedTile] = useState<CategoryTile | null>(null);

  const moreMenuItems = [
    { id: 'people', label: 'People', icon: 'users' as const, screen: 'Community' as const },
    { id: 'events', label: 'Events', icon: 'calendar' as const, screen: 'Events' as const },
    { id: 'offers', label: 'Offers', icon: 'tag' as const, screen: 'Bargains' as const },
  ];

  useEffect(() => {
    currencyService.initialize().then(() => setCurrencyInitialized(true));
  }, []);

  const isPremium = tier === "premium" || tier === "vip";

  const userRegion = useMemo(() => {
    return getRegionFromCountry(user?.country || 'United States');
  }, [user?.country]);

  const userGender: GenderType = useMemo(() => {
    const gender = user?.gender?.toLowerCase();
    if (gender === 'man' || gender === 'male') return 'male';
    return 'female';
  }, [user?.gender]);

  const regionalStyleContent = useMemo(() => {
    return {
      image: REGIONAL_STYLE_IMAGES[userRegion][userGender],
      ...REGIONAL_STYLE_TIPS[userRegion][userGender],
    };
  }, [userRegion, userGender]);

  const styleOfTheDayId = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return `style-of-the-day-${userRegion}-${userGender}-${today}`;
  }, [userRegion, userGender]);

  const handleSaveStyleOfTheDay = async () => {
    const styleOutfit: StyleOfTheDayOutfit = {
      id: styleOfTheDayId,
      outfitType: 'style_of_the_day',
      title: regionalStyleContent.title,
      description: regionalStyleContent.description,
      imageUri: '', 
      region: userRegion,
      savedAt: new Date().toISOString(),
    };
    await toggleOutfitLike(styleOutfit);
  };

  const handleSavePost = async (post: any) => {
    await toggleOutfitLike(post);
  };

  const handleDislikePost = useCallback(async (postId: string) => {
    setDislikedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
    
    if (apiService.isConfigured()) {
      try {
        await apiService.dislikePost(postId);
      } catch (error) {
        console.error('Failed to sync dislike:', error);
      }
    }
  }, []);

  useEffect(() => {
    const loadEmergingTrends = async () => {
      if (!apiService.isConfigured()) return;
      
      setLoadingTrends(true);
      try {
        const result = await apiService.getEmergingTrends({
          region: user?.country,
          gender: user?.gender || undefined,
        });
        if (result.trends?.emergingTrends) {
          setEmergingTrends(result.trends.emergingTrends);
        }
      } catch (error) {
        console.error('Failed to load emerging trends:', error);
      } finally {
        setLoadingTrends(false);
      }
    };

    loadEmergingTrends();
  }, [user?.country, user?.gender]);

  useEffect(() => {
    if (hasStyleProfile) {
      fetchPersonalizedStyleOfTheDay();
    }
  }, [hasStyleProfile, fetchPersonalizedStyleOfTheDay]);

  const influencerGuide = useMemo(() => {
    return getInfluencerStyleGuide(user?.country || 'United States', user?.gender || undefined);
  }, [user?.country, user?.gender]);

  const magazineInspirations = useMemo(() => {
    return MagazineInspirationService.getFilteredInspirations(
      userGender,
      tier || "free"
    ).slice(0, 6);
  }, [userGender, tier]);

  const trendingPosts = useMemo(() => {
    const userGenderFilter = user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : null;
    if (!userGenderFilter) return posts.slice(0, 5);
    return posts.filter(post => !post.gender || post.gender === userGenderFilter || post.gender === 'unisex').slice(0, 5);
  }, [posts, user?.gender]);

  const genderFilteredCelebrityLooks = useMemo(() => {
    const targetGender = celebrityLooksGenderFilter === 'user' ? userGender : celebrityLooksGenderFilter;
    return CELEBRITY_LOOKS.filter(look => look.gender === targetGender);
  }, [userGender, celebrityLooksGenderFilter]);

  const handlePostPress = (postId: string) => {
    navigation.navigate("PostDetail", { postId });
  };

  const handleJoinChallenge = (challenge: Challenge) => {
    Alert.alert(
      "Join Challenge",
      `Ready to join "${challenge.name}"?\n\nPost your outfit with ${challenge.hashtag} to participate!`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Share Challenge",
          onPress: () => shareChallenge(challenge.name, challenge.description),
        },
        { text: "Join Now", onPress: () => {} },
      ]
    );
  };

  const handleGetTheLook = (look: CelebrityLook) => {
    const items = isPremium ? look.luxuryItems : look.budgetItems;
    const priceLabel = isPremium ? "Luxury" : "Budget-Friendly";
    const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
    const formatPrice = (price: number) => currencyService.formatPrice(currencyService.convertFromGBP(price));
    
    Alert.alert(
      `Get the ${look.styleName} Look`,
      `${priceLabel} alternatives (Total: ${formatPrice(totalPrice)}):\n\n${items.map(item => `${item.name}\n${formatPrice(item.price)} at ${item.store}`).join("\n\n")}`,
      [
        { text: "Close", style: "cancel" },
        { 
          text: isPremium ? "View Budget Options" : "View Luxury Options", 
          onPress: () => {
            const altItems = isPremium ? look.budgetItems : look.luxuryItems;
            const altLabel = isPremium ? "Budget-Friendly" : "Luxury";
            const altTotal = altItems.reduce((sum, item) => sum + item.price, 0);
            Alert.alert(
              `${altLabel} Alternatives`,
              `Total: ${formatPrice(altTotal)}\n\n${altItems.map(item => `${item.name}\n${formatPrice(item.price)} at ${item.store}`).join("\n\n")}`,
              [{ text: "Close" }]
            );
          }
        },
      ]
    );
  };

  const handleSectionLayout = (sectionId: string, event: LayoutChangeEvent) => {
    sectionPositions.current[sectionId] = event.nativeEvent.layout.y;
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const position = sectionPositions.current[sectionId];
    if (position !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: position - 10, animated: true });
    }
  };

  const handleCategoryTilePress = (tile: CategoryTile) => {
    setSelectedTile(tile);
  };

  const handleTileNavigate = () => {
    if (selectedTile) {
      if (selectedTile.screen) {
        navigation.navigate(selectedTile.screen as any);
      } else if (selectedTile.sectionId) {
        scrollToSection(selectedTile.sectionId);
      }
      setSelectedTile(null);
    }
  };

  return (
    <>
    <ScreenScrollView ref={scrollViewRef}>
      {/* Browse Header */}
      <View style={styles.browseHeader}>
        <ThemedText type="h1" style={styles.browseTitle}>Browse</ThemedText>
        <ThemedText type="body" style={[styles.browseSubtitle, { color: theme.tabIconDefault }]}>
          Explore fashion inspiration and discover your style
        </ThemedText>
      </View>

      {/* 3-Column Category Grid */}
      <View style={styles.categoryGrid}>
        {CATEGORY_TILES.map((tile) => (
          <Pressable
            key={tile.id}
            onPress={() => handleCategoryTilePress(tile)}
            style={({ pressed }) => [
              styles.categoryTile,
              { 
                backgroundColor: tile.pastelBg,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View style={styles.categoryIconContainer}>
              <Feather name={tile.icon} size={TILE_ICON_SIZE} color={TILE_TEXT_COLOR} />
            </View>
            <ThemedText style={[styles.categoryLabel, { color: TILE_TEXT_COLOR, fontSize: TILE_LABEL_SIZE }]}>
              {tile.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>

    </ScreenScrollView>

      <Modal
        visible={selectedTile !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTile(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setSelectedTile(null)}
          />
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={styles.sheetContainer}
          >
            {selectedTile ? (
              <>
                <View style={styles.sheetHandle} />
                <View style={[styles.sheetIconBadge, { backgroundColor: selectedTile.pastelBg }]}>
                  <Feather name={selectedTile.icon} size={40} color="#FFFFFF" />
                </View>
                <ThemedText type="h2" style={styles.sheetTitle}>
                  {selectedTile.name}
                </ThemedText>
                <ThemedText type="body" style={[styles.sheetDescription, { color: theme.tabIconDefault }]}>
                  {selectedTile.description}
                </ThemedText>
                <Pressable
                  onPress={handleTileNavigate}
                  style={({ pressed }) => [
                    styles.sheetButton,
                    { backgroundColor: selectedTile.pastelBg, opacity: pressed ? 0.9 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${selectedTile.name}`}
                >
                  <ThemedText type="body" style={styles.sheetButtonText}>
                    {selectedTile.screen ? "Open" : "Go to Section"}
                  </ThemedText>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </Pressable>
              </>
            ) : null}
          </BlurView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  browseHeader: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
  },
  browseTitle: {
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  browseSubtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: TILE_GAP,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  categoryTile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 0.85,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  categoryLabel: {
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  sectionNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingRight: Spacing.md,
    zIndex: 5,
  },
  sectionNavScroll: {
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  sectionNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  explorationBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  explorationBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  explorationBannerText: {
    flex: 1,
  },
  switchBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  switchBackText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  featuredCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  featuredOverlay: {
    padding: Spacing.lg,
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  featuredBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  saveStyleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  saveStyleText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  featuredBadgeText: {
    color: "#FFD700",
    fontWeight: "600",
  },
  featuredTitle: {
    marginBottom: Spacing.xs,
  },
  featuredDescription: {
    opacity: 0.9,
  },
  categoriesContainer: {
    gap: Spacing.sm,
  },
  categoryCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    minWidth: 100,
    gap: Spacing.sm,
  },
  postsContainer: {
    gap: Spacing.lg,
  },
  highlightCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.lg,
  },
  highlightIconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightContent: {
    flex: 1,
  },
  highlightDescription: {
    opacity: 0.7,
    marginTop: Spacing.xs,
  },
  challengesContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  challengeCard: {
    width: width * 0.7,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  challengeGradient: {
    padding: Spacing.lg,
    minHeight: 180,
    justifyContent: "space-between",
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  challengeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  challengeDaysLeft: {
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  daysLeftText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  challengeName: {
    color: "#FFFFFF",
    marginTop: Spacing.md,
  },
  challengeDescription: {
    color: "rgba(255,255,255,0.9)",
    marginTop: Spacing.xs,
  },
  challengeFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  participantsText: {
    color: "rgba(255,255,255,0.8)",
  },
  hashtagText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: "auto",
  },
  affiliateNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  affiliateText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  looksContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  lookCard: {
    width: width * 0.65,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  lookImage: {
    width: "100%",
    height: 220,
    resizeMode: "cover",
  },
  lookOverlay: {
    padding: Spacing.md,
  },
  lookBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  lookBadgeText: {
    color: "#FFD700",
    fontWeight: "600",
    fontSize: 11,
  },
  lookTitle: {
    marginBottom: 2,
  },
  lookInspiration: {
    opacity: 0.7,
    marginBottom: Spacing.sm,
  },
  getTheLookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: "#667eea",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  getTheLookText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  influencerSubtitle: {
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
  },
  influencerTipsContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  influencerTipCard: {
    width: width * 0.75,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  influencerTipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  influencerTipText: {
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  influencerCredits: {
    marginTop: Spacing.xs,
  },
  influencerHandle: {
    fontWeight: "600",
    fontSize: 12,
  },
  trendingPiecesSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  trendingPiecesTitle: {
    marginBottom: Spacing.sm,
  },
  trendingPiecesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  trendingPieceTag: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  trendingPieceText: {
    fontWeight: "500",
    fontSize: 13,
  },
  trendingColorsSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  colorTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorName: {
    fontSize: 12,
    fontWeight: "500",
  },
  magazineContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  magazineCard: {
    width: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    position: "relative",
  },
  magazineBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
    zIndex: 1,
  },
  magazineBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 9,
  },
  magazineIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  magazineName: {
    textAlign: "center",
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
  magazineHeadline: {
    textAlign: "center",
    marginTop: Spacing.xs,
    opacity: 0.7,
    lineHeight: 16,
  },
  magazineMood: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 4,
  },
  magazineMoodText: {
    fontSize: 11,
    fontWeight: "500",
  },
  blogCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  blogGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  blogIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  blogContent: {
    flex: 1,
  },
  blogTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  blogDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  blogCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  blogCtaText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  personalizedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  personalizedBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 11,
  },
  personalizedDetails: {
    marginTop: Spacing.sm,
  },
  personalizedReason: {
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
  keyPiecesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  keyPieceTag: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  trendScannerSubtitle: {
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
  },
  trendLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  trendsContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  trendCard: {
    width: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    position: "relative",
  },
  trendConfidenceBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    zIndex: 1,
  },
  trendConfidenceText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
  },
  trendIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  trendName: {
    textAlign: "center",
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
  trendCategory: {
    opacity: 0.6,
    fontSize: 11,
    marginTop: 2,
  },
  trendMomentum: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 4,
  },
  trendMomentumText: {
    fontSize: 11,
    fontWeight: "500",
  },
  celebrityGenderToggleContainer: {
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  celebrityGenderToggleLabel: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  celebrityGenderToggleRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  celebrityGenderToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  celebrityGenderToggleText: {
    fontWeight: "600",
    fontSize: 13,
  },
  celebrityGiftHint: {
    marginTop: Spacing.sm,
    fontStyle: "italic",
    fontSize: 12,
  },
  moreMenuButton: {
    width: 44,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
    zIndex: 10,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    paddingTop: 100,
  },
  menuContainer: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemLabel: {
    flex: 1,
    fontWeight: "500",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing["2xl"],
    alignItems: "center",
    overflow: "hidden",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: Spacing.lg,
  },
  sheetIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  sheetDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  sheetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    minWidth: 160,
  },
  sheetButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
