/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable, Image, ScrollView, Dimensions, Alert, ImageSourcePropType, Linking, ActivityIndicator, LayoutChangeEvent, Modal } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
  const { theme } = useTheme();
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

  return (
    <ScreenScrollView ref={scrollViewRef}>
      {/* Quick Section Navigation */}
      <View style={styles.sectionNavContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionNavScroll}
        >
          {SECTION_NAV.map((section) => (
            <Pressable
              key={section.id}
              onPress={() => scrollToSection(section.id)}
              style={({ pressed }) => [
                styles.sectionNavItem,
                {
                  backgroundColor:
                    activeSection === section.id
                      ? theme.link
                      : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={section.icon}
                size={18}
                color={activeSection === section.id ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="small"
                style={{
                  color: activeSection === section.id ? "#FFFFFF" : theme.text,
                  fontWeight: "600",
                  marginLeft: Spacing.xs,
                }}
              >
                {section.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => setShowMoreMenu(true)}
          style={({ pressed }) => [
            styles.moreMenuButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="menu" size={20} color={theme.text} />
        </Pressable>
      </View>

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowMoreMenu(false)}
        >
          <Pressable 
            style={[styles.menuContainer, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.menuHeader}>
              <ThemedText type="h4">More</ThemedText>
              <Pressable onPress={() => setShowMoreMenu(false)}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            {moreMenuItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setShowMoreMenu(false);
                  navigation.navigate(item.screen);
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
                ]}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: theme.link + "20" }]}>
                  <Feather name={item.icon} size={20} color={theme.link} />
                </View>
                <ThemedText type="body" style={styles.menuItemLabel}>
                  {item.label}
                </ThemedText>
                <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {isExploringOtherCountry && actualCountry ? (
        <View style={[styles.explorationBanner, { backgroundColor: theme.link + "15" }]}>
          <View style={styles.explorationBannerContent}>
            <Feather name="globe" size={18} color={theme.link} />
            <View style={styles.explorationBannerText}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: "600" }}>
                Exploring: {explorationCountry}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={switchBackToActualLocation}
            style={({ pressed }) => [
              styles.switchBackButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="map-pin" size={14} color="#FFFFFF" />
            <ThemedText type="small" style={styles.switchBackText}>
              Back to {actualCountry}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section} onLayout={(e) => handleSectionLayout('styleOfTheDay', e)}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Style of the Day
          </ThemedText>
          {hasStyleProfile ? (
            <View style={[styles.personalizedBadge, { backgroundColor: theme.link }]}>
              <Feather name="user" size={12} color="#FFFFFF" />
              <ThemedText type="small" style={styles.personalizedBadgeText}>Personalized</ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.featuredCard,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Image
            source={regionalStyleContent.image}
            style={styles.featuredImage}
          />
          <View style={styles.featuredOverlay}>
            <View style={styles.featuredBadgeRow}>
              <View style={styles.featuredBadge}>
                <Feather name="award" size={16} color="#FFD700" />
                <ThemedText type="small" style={styles.featuredBadgeText}>
                  {hasStyleProfile && personalizedStyleOfTheDay?.personalized ? "Curated For You" : "Dripn AI Pick"}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleSaveStyleOfTheDay}
                style={({ pressed }) => [
                  styles.saveStyleButton,
                  { 
                    backgroundColor: isOutfitLiked(styleOfTheDayId) ? theme.link : "rgba(255,255,255,0.2)",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather 
                  name="bookmark" 
                  size={18} 
                  color={isOutfitLiked(styleOfTheDayId) ? "#FFFFFF" : "#FFFFFF"} 
                />
                {isOutfitLiked(styleOfTheDayId) ? (
                  <ThemedText type="small" style={styles.saveStyleText}>Saved</ThemedText>
                ) : null}
              </Pressable>
            </View>
            <ThemedText type="h3" style={styles.featuredTitle}>
              {hasStyleProfile && personalizedStyleOfTheDay?.personalized 
                ? personalizedStyleOfTheDay.styleOfTheDay.title 
                : regionalStyleContent.title}
            </ThemedText>
            <ThemedText type="body" style={styles.featuredDescription} numberOfLines={3}>
              {hasStyleProfile && personalizedStyleOfTheDay?.personalized 
                ? personalizedStyleOfTheDay.styleOfTheDay.description 
                : regionalStyleContent.description}
            </ThemedText>
            {hasStyleProfile && personalizedStyleOfTheDay?.personalized ? (
              <View style={styles.personalizedDetails}>
                <ThemedText type="small" style={[styles.personalizedReason, { color: theme.link }]}>
                  {personalizedStyleOfTheDay.styleOfTheDay.whyThisWorks}
                </ThemedText>
                <View style={styles.keyPiecesContainer}>
                  {personalizedStyleOfTheDay.styleOfTheDay.keyPieces.slice(0, 3).map((piece, index) => (
                    <View key={index} style={[styles.keyPieceTag, { backgroundColor: theme.link + "20" }]}>
                      <ThemedText type="small" style={{ color: theme.link }}>{piece}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>

      {emergingTrends.length > 0 || loadingTrends ? (
        <View style={styles.section} onLayout={(e) => handleSectionLayout('trendScanner', e)}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h2" style={styles.sectionTitle}>
              Trend Scanner
            </ThemedText>
            <Pressable
              onPress={() => {
                Alert.alert(
                  "Trend Scanner",
                  "Our AI analyzes fashion trends from around the world to show you what's emerging right now. These trends are personalized based on your location and style preferences."
                );
              }}
            >
              <Feather name="info" size={18} color={theme.tabIconDefault} />
            </Pressable>
          </View>
          <ThemedText type="small" style={[styles.trendScannerSubtitle, { color: theme.tabIconDefault }]}>
            Emerging trends curated by AI based on your preferences
          </ThemedText>
          {loadingTrends ? (
            <View style={styles.trendLoadingContainer}>
              <ActivityIndicator size="small" color={theme.link} />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm, opacity: 0.7 }}>
                Scanning trends...
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendsContainer}
            >
              {emergingTrends.map((trend, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    Alert.alert(
                      trend.name,
                      `${trend.description}\n\nCategory: ${trend.category}\nEmergence: ${trend.emergenceLevel}\n\nHow to Wear:\n${trend.howToWear}\n\nKey Influencers: ${trend.keyInfluencers.join(", ")}`,
                      [{ text: "Got it" }]
                    );
                  }}
                  style={({ pressed }) => [
                    styles.trendCard,
                    { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <View style={[styles.trendConfidenceBadge, { 
                    backgroundColor: trend.confidenceScore >= 0.8 ? "#27AE60" : trend.confidenceScore >= 0.6 ? "#F39C12" : theme.link 
                  }]}>
                    <ThemedText type="small" style={styles.trendConfidenceText}>
                      {Math.round(trend.confidenceScore * 100)}%
                    </ThemedText>
                  </View>
                  <View style={[styles.trendIconContainer, { backgroundColor: theme.link + "15" }]}>
                    <Feather name="trending-up" size={24} color={theme.link} />
                  </View>
                  <ThemedText type="h3" style={styles.trendName} numberOfLines={2}>
                    {trend.name}
                  </ThemedText>
                  <ThemedText type="small" style={styles.trendCategory}>
                    {trend.category}
                  </ThemedText>
                  <View style={styles.trendMomentum}>
                    <Feather name="activity" size={12} color={theme.link} />
                    <ThemedText type="small" style={[styles.trendMomentumText, { color: theme.link }]}>
                      {trend.emergenceLevel}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      <View style={styles.section} onLayout={(e) => handleSectionLayout('influencer', e)}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Influencer Inspiration
          </ThemedText>
          <Pressable
            onPress={() => {
              Alert.alert(
                "Style Inspiration Sources",
                "Our style tips are curated from top fashion influencers worldwide, tailored to your region for culturally relevant fashion advice."
              );
            }}
          >
            <Feather name="info" size={18} color={theme.tabIconDefault} />
          </Pressable>
        </View>
        <ThemedText type="small" style={[styles.influencerSubtitle, { color: theme.tabIconDefault }]}>
          Tips inspired by top fashion influencers from your region
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.influencerTipsContainer}
        >
          {influencerGuide.styleTips.slice(0, 3).map((tip, index) => (
            <View
              key={index}
              style={[styles.influencerTipCard, { backgroundColor: theme.backgroundDefault }]}
            >
              <View style={[styles.influencerTipIcon, { backgroundColor: theme.link + "15" }]}>
                <Feather 
                  name={index === 0 ? "star" : index === 1 ? "trending-up" : "award"} 
                  size={20} 
                  color={theme.link} 
                />
              </View>
              <ThemedText type="body" style={styles.influencerTipText}>
                {tip}
              </ThemedText>
              <View style={styles.influencerCredits}>
                {influencerGuide.influencers[index] ? (
                  <ThemedText type="small" style={[styles.influencerHandle, { color: theme.link }]}>
                    {influencerGuide.influencers[index].handle}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.trendingPiecesSection}>
          <ThemedText type="h3" style={styles.trendingPiecesTitle}>
            Trending Pieces Right Now
          </ThemedText>
          <View style={styles.trendingPiecesContainer}>
            {influencerGuide.trendingPieces.slice(0, 5).map((piece, index) => (
              <View 
                key={index} 
                style={[styles.trendingPieceTag, { backgroundColor: theme.link + "20" }]}
              >
                <ThemedText type="small" style={[styles.trendingPieceText, { color: theme.link }]}>
                  {piece}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.trendingColorsSection}>
          <ThemedText type="h3" style={styles.trendingPiecesTitle}>
            Hot Colors for 2025/2026
          </ThemedText>
          <View style={styles.trendingPiecesContainer}>
            {TRENDING_STYLES_2025_2026.colors.hot.slice(0, 5).map((color, index) => (
              <View 
                key={index} 
                style={[styles.colorTag, { backgroundColor: theme.backgroundDefault }]}
              >
                <View style={[styles.colorDot, { backgroundColor: getColorFromName(color) }]} />
                <ThemedText type="small" style={styles.colorName}>
                  {color}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section} onLayout={(e) => handleSectionLayout('magazine', e)}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Magazine Style Inspiration
          </ThemedText>
          <Pressable
            onPress={() => {
              Alert.alert(
                "Magazine Inspiration",
                "Style inspiration curated from top music and lifestyle magazines. Get outfit ideas from your favorite artists and celebrities."
              );
            }}
          >
            <Feather name="info" size={18} color={theme.tabIconDefault} />
          </Pressable>
        </View>
        <ThemedText type="small" style={[styles.influencerSubtitle, { color: theme.tabIconDefault }]}>
          Fresh looks from music and lifestyle magazines
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.magazineContainer}
        >
          {magazineInspirations.map((inspiration) => (
            <Pressable
              key={inspiration.id}
              onPress={() => {
                Alert.alert(
                  `${inspiration.featuredName} - ${inspiration.publication}`,
                  `${inspiration.headline}\n\n${inspiration.styleHighlights.join("\n\n")}\n\nKey Pieces:\n${inspiration.keyPieces.join(", ")}\n\nBrands: ${inspiration.brands.join(", ")}`,
                  [{ text: "Got it", style: "default" }]
                );
              }}
              style={({ pressed }) => [
                styles.magazineCard,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.magazineBadge, { backgroundColor: inspiration.publicationType === "music" ? "#9B59B6" : "#3498DB" }]}>
                <Feather name={inspiration.publicationType === "music" ? "music" : "book-open"} size={10} color="#FFFFFF" />
                <ThemedText type="small" style={styles.magazineBadgeText}>
                  {inspiration.publication}
                </ThemedText>
              </View>
              <View style={[styles.magazineIconContainer, { backgroundColor: theme.link + "15" }]}>
                <Feather 
                  name={inspiration.featuredType === "artist" ? "mic" : "star"} 
                  size={28} 
                  color={theme.link} 
                />
              </View>
              <ThemedText type="h3" style={styles.magazineName} numberOfLines={1}>
                {inspiration.featuredName}
              </ThemedText>
              <ThemedText type="small" style={styles.magazineHeadline} numberOfLines={2}>
                {inspiration.headline}
              </ThemedText>
              <View style={styles.magazineMood}>
                <Feather name="heart" size={12} color={theme.link} />
                <ThemedText type="small" style={[styles.magazineMoodText, { color: theme.link }]}>
                  {inspiration.mood}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section} onLayout={(e) => handleSectionLayout('celebrity', e)}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Celebrity-Inspired Looks
          </ThemedText>
        </View>
        <View style={styles.celebrityGenderToggleContainer}>
          <ThemedText type="small" style={[styles.celebrityGenderToggleLabel, { color: theme.tabIconDefault }]}>
            Browse looks for:
          </ThemedText>
          <View style={styles.celebrityGenderToggleRow}>
            <Pressable
              onPress={() => setCelebrityLooksGenderFilter('user')}
              style={[
                styles.celebrityGenderToggleButton,
                {
                  backgroundColor: celebrityLooksGenderFilter === 'user' ? theme.link : theme.backgroundDefault,
                },
              ]}
            >
              <Feather 
                name="user" 
                size={14} 
                color={celebrityLooksGenderFilter === 'user' ? '#FFFFFF' : theme.text} 
              />
              <ThemedText
                type="small"
                style={[
                  styles.celebrityGenderToggleText,
                  { color: celebrityLooksGenderFilter === 'user' ? '#FFFFFF' : theme.text },
                ]}
              >
                For Me
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setCelebrityLooksGenderFilter('female')}
              style={[
                styles.celebrityGenderToggleButton,
                {
                  backgroundColor: celebrityLooksGenderFilter === 'female' ? theme.link : theme.backgroundDefault,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.celebrityGenderToggleText,
                  { color: celebrityLooksGenderFilter === 'female' ? '#FFFFFF' : theme.text },
                ]}
              >
                Her
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setCelebrityLooksGenderFilter('male')}
              style={[
                styles.celebrityGenderToggleButton,
                {
                  backgroundColor: celebrityLooksGenderFilter === 'male' ? theme.link : theme.backgroundDefault,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.celebrityGenderToggleText,
                  { color: celebrityLooksGenderFilter === 'male' ? '#FFFFFF' : theme.text },
                ]}
              >
                Him
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" style={[styles.celebrityGiftHint, { color: theme.tabIconDefault }]}>
            Perfect for gift ideas
          </ThemedText>
        </View>
        <View style={[styles.affiliateNotice, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="info" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={[styles.affiliateText, { color: theme.tabIconDefault }]}>
            Dripn may earn a commission if you shop through these links
          </ThemedText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.looksContainer}
        >
          {genderFilteredCelebrityLooks.map((look) => (
            <Pressable
              key={look.id}
              onPress={() => handleGetTheLook(look)}
              style={({ pressed }) => [
                styles.lookCard,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Image source={look.image} style={styles.lookImage} />
              <View style={styles.lookOverlay}>
                <View style={styles.lookBadge}>
                  <Feather name="star" size={12} color="#FFD700" />
                  <ThemedText type="small" style={styles.lookBadgeText}>
                    Inspired Look
                  </ThemedText>
                </View>
                <ThemedText type="h3" style={styles.lookTitle} numberOfLines={1}>
                  {look.styleName}
                </ThemedText>
                <ThemedText type="small" style={styles.lookInspiration}>
                  {look.inspiration}
                </ThemedText>
                <View style={styles.getTheLookButton}>
                  <Feather name="shopping-bag" size={14} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.getTheLookText}>
                    Get the Look
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section} onLayout={(e) => handleSectionLayout('challenges', e)}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Trending Challenges
          </ThemedText>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <ThemedText type="link">See All</ThemedText>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.challengesContainer}
        >
          {TRENDING_CHALLENGES.map((challenge) => (
            <Pressable
              key={challenge.id}
              onPress={() => handleJoinChallenge(challenge)}
              style={({ pressed }) => [
                styles.challengeCard,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={challenge.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.challengeGradient}
              >
                <View style={styles.challengeHeader}>
                  <View style={styles.challengeIconContainer}>
                    <Feather name={challenge.icon} size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.challengeDaysLeft}>
                    <ThemedText type="small" style={styles.daysLeftText}>
                      {challenge.daysLeft}d left
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="h3" style={styles.challengeName}>
                  {challenge.name}
                </ThemedText>
                <ThemedText type="small" style={styles.challengeDescription} numberOfLines={2}>
                  {challenge.description}
                </ThemedText>
                <View style={styles.challengeFooter}>
                  <Feather name="users" size={14} color="rgba(255,255,255,0.8)" />
                  <ThemedText type="small" style={styles.participantsText}>
                    {challenge.participants.toLocaleString()} joined
                  </ThemedText>
                  <ThemedText type="small" style={styles.hashtagText}>
                    {challenge.hashtag}
                  </ThemedText>
                </View>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section} onLayout={(e) => handleSectionLayout('highlights', e)}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Weekly Highlights
        </ThemedText>
        <View style={[styles.highlightCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.highlightIconContainer}>
            <Feather name="star" size={32} color={theme.link} />
          </View>
          <View style={styles.highlightContent}>
            <ThemedText type="h3">Top Contributor</ThemedText>
            <ThemedText type="body" style={styles.highlightDescription}>
              {userGender === 'male' ? 'Marcus Pro received 156 helpful votes this week' : 'Sophie Trendy received 156 helpful votes this week'}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.highlightCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.highlightIconContainer}>
            <Feather name="message-circle" size={32} color={theme.link} />
          </View>
          <View style={styles.highlightContent}>
            <ThemedText type="h3">Most Discussed</ThemedText>
            <ThemedText type="body" style={styles.highlightDescription}>
              {userGender === 'male' ? 'Smart casual networking poll received 92 comments' : 'Wedding guest outfit poll received 92 comments'}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section} onLayout={(e) => handleSectionLayout('blog', e)}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Discover New Styles
        </ThemedText>
        <Pressable
          onPress={() => navigation.navigate("Gamification")}
          style={({ pressed }) => [
            styles.blogCard,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={["#FFD700", "#FFA500"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blogGradient}
          >
            <View style={styles.blogIconContainer}>
              <Feather name="gift" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.blogContent}>
              <ThemedText type="h3" style={styles.blogTitle}>
                Rewards Hub
              </ThemedText>
              <ThemedText type="body" style={styles.blogDescription}>
                Earn points, unlock achievements, spin the wheel, and claim daily rewards
              </ThemedText>
              <View style={styles.blogCta}>
                <ThemedText type="small" style={styles.blogCtaText}>
                  Claim Rewards
                </ThemedText>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("SmartNotifications")}
          style={({ pressed }) => [
            styles.blogCard,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.md },
          ]}
        >
          <LinearGradient
            colors={["#9B59B6", "#8E44AD"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blogGradient}
          >
            <View style={styles.blogIconContainer}>
              <Feather name="bell" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.blogContent}>
              <ThemedText type="h3" style={styles.blogTitle}>
                Smart Notifications
              </ThemedText>
              <ThemedText type="body" style={styles.blogDescription}>
                Weather-based styling tips, price alerts, and personalized trend notifications
              </ThemedText>
              <View style={styles.blogCta}>
                <ThemedText type="small" style={styles.blogCtaText}>
                  View Alerts
                </ThemedText>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("StyleChallenges")}
          style={({ pressed }) => [
            styles.blogCard,
            { opacity: pressed ? 0.9 : 1, marginTop: Spacing.md },
          ]}
        >
          <LinearGradient
            colors={["#E74C3C", "#C0392B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blogGradient}
          >
            <View style={styles.blogIconContainer}>
              <Feather name="flag" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.blogContent}>
              <ThemedText type="h3" style={styles.blogTitle}>
                Style Challenges
              </ThemedText>
              <ThemedText type="body" style={styles.blogDescription}>
                Compete in weekly themed challenges, showcase your outfits, and win rewards
              </ThemedText>
              <View style={styles.blogCta}>
                <ThemedText type="small" style={styles.blogCtaText}>
                  Join Challenges
                </ThemedText>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Fashion Insights
        </ThemedText>
        <Pressable
          onPress={() => navigation.navigate("FashionBlog")}
          style={({ pressed }) => [
            styles.blogCard,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={[theme.link, theme.link + "CC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.blogGradient}
          >
            <View style={styles.blogIconContainer}>
              <Feather name="book-open" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.blogContent}>
              <ThemedText type="h3" style={styles.blogTitle}>
                Fashion Blog
              </ThemedText>
              <ThemedText type="body" style={styles.blogDescription}>
                Weekly style tips, trend reports, and expert fashion advice curated by our style experts
              </ThemedText>
              <View style={styles.blogCta}>
                <ThemedText type="small" style={styles.blogCtaText}>
                  Read Latest Articles
                </ThemedText>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  sectionNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingRight: Spacing.md,
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
});
