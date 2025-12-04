import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, ScrollView, Dimensions, Alert, ImageSourcePropType, Linking } from "react-native";
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
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type RegionalModelType = 'multicultural' | 'asian' | 'african' | 'middle-eastern' | 'south-asian' | 'latin-american';

const REGIONAL_STYLE_IMAGES: Record<RegionalModelType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/models/multicultural.png"),
  'asian': require("../assets/images/models/asian.png"),
  'african': require("../assets/images/models/african.png"),
  'middle-eastern': require("../assets/images/models/middle-eastern.png"),
  'south-asian': require("../assets/images/models/south-asian.png"),
  'latin-american': require("../assets/images/models/latin-american.png"),
};

const REGIONAL_STYLE_TIPS: Record<RegionalModelType, { title: string; description: string }> = {
  'multicultural': {
    title: "Global Fusion Elegance",
    description: "Style of the Day: A sophisticated blend of contemporary fashion celebrating diverse influences. Clean lines meet bold accessories for a universally flattering look.",
  },
  'asian': {
    title: "Modern Minimalist Chic",
    description: "Style of the Day: Elegant simplicity with contemporary Asian-inspired aesthetics. Structured silhouettes balanced with refined details create effortless sophistication.",
  },
  'african': {
    title: "Vibrant Heritage Style",
    description: "Style of the Day: Bold patterns and rich colors celebrating African fashion heritage. Modern cuts paired with traditional-inspired prints for confident elegance.",
  },
  'middle-eastern': {
    title: "Modest Elegance",
    description: "Style of the Day: Graceful contemporary styling with sophisticated modest fashion. Flowing fabrics and refined details create timeless beauty.",
  },
  'south-asian': {
    title: "Contemporary Fusion",
    description: "Style of the Day: Modern tailoring meets cultural richness. Sharp lines and quality fabrics showcase the best of South Asian fashion sensibility.",
  },
  'latin-american': {
    title: "Warm Vibrant Style",
    description: "Style of the Day: Earthy tones and vibrant accents celebrating Latin American fashion. Contemporary styling with warm, welcoming aesthetics.",
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

const CATEGORIES = [
  { id: "trending", name: "Trending", icon: "trending-up" as const },
  { id: "casual", name: "Casual", icon: "sun" as const },
  { id: "formal", name: "Formal", icon: "briefcase" as const },
  { id: "date", name: "Date Night", icon: "heart" as const },
  { id: "work", name: "Workwear", icon: "coffee" as const },
  { id: "weekend", name: "Weekend", icon: "smile" as const },
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
  budgetItems: { name: string; price: number; store: string }[];
  luxuryItems: { name: string; price: number; store: string }[];
}

const CELEBRITY_LOOKS: CelebrityLook[] = [
  {
    id: "look1",
    styleName: "Street Style Chic",
    inspiration: "Off-duty model aesthetic",
    image: require("../assets/images/celebrity-looks/street_style_chic_outfit.png"),
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
    id: "look2",
    styleName: "Evening Elegance",
    inspiration: "Red carpet glamour",
    image: require("../assets/images/celebrity-looks/elegant_evening_slip_dress.png"),
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
    id: "look3",
    styleName: "Athleisure Vibes",
    inspiration: "Sporty wellness aesthetic",
    image: require("../assets/images/celebrity-looks/trendy_athleisure_look.png"),
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
];

interface BargainItem {
  id: string;
  brand: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  store: string;
  storeHandle?: string;
  category: string;
  icon: keyof typeof Feather.glyphMap;
  regions: string[];
  currency: string;
}

const UK_COUNTRIES = ['United Kingdom', 'Ireland'];
const EU_COUNTRIES = [
  'Germany', 'France', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 
  'Switzerland', 'Austria', 'Poland', 'Czech Republic', 'Hungary', 'Romania',
  'Bulgaria', 'Greece', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland',
  'Croatia', 'Serbia', 'Slovenia', 'Slovakia', 'Lithuania', 'Latvia', 'Estonia',
  'Luxembourg', 'Malta', 'Cyprus'
];
const US_COUNTRIES = ['United States'];
const CANADA_COUNTRIES = ['Canada'];
const AUSTRALIA_COUNTRIES = ['Australia', 'New Zealand'];
const ASIA_COUNTRIES = [
  'Japan', 'South Korea', 'China', 'Taiwan', 'Hong Kong', 'Singapore', 
  'Thailand', 'Vietnam', 'Malaysia', 'Indonesia', 'Philippines'
];
const MIDDLE_EAST_COUNTRIES = [
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 
  'Oman', 'Jordan', 'Lebanon', 'Israel', 'Turkey'
];

const ALL_BARGAIN_ITEMS: BargainItem[] = [
  {
    id: "uk1",
    brand: "Nike",
    name: "Air Max 90 Premium",
    originalPrice: 149.99,
    salePrice: 112.49,
    discountPercent: 25,
    store: "END Clothing",
    storeHandle: "@CaptainCreps",
    category: "Trainers",
    icon: "zap",
    regions: [...UK_COUNTRIES, ...EU_COUNTRIES],
    currency: "GBP",
  },
  {
    id: "uk2",
    brand: "Burberry",
    name: "Vintage Check Wool Scarf",
    originalPrice: 450.00,
    salePrice: 382.50,
    discountPercent: 15,
    store: "Flannels",
    category: "Accessories",
    icon: "gift",
    regions: UK_COUNTRIES,
    currency: "GBP",
  },
  {
    id: "uk3",
    brand: "Canada Goose",
    name: "Expedition Parka",
    originalPrice: 1295.00,
    salePrice: 1100.75,
    discountPercent: 15,
    store: "Frasers",
    category: "Outerwear",
    icon: "cloud",
    regions: UK_COUNTRIES,
    currency: "GBP",
  },
  {
    id: "uk4",
    brand: "Nike",
    name: "Dunk Low Retro",
    originalPrice: 109.99,
    salePrice: 87.99,
    discountPercent: 20,
    store: "Size?",
    storeHandle: "@CaptainCreps",
    category: "Trainers",
    icon: "zap",
    regions: [...UK_COUNTRIES, ...EU_COUNTRIES],
    currency: "GBP",
  },
  {
    id: "uk5",
    brand: "Moncler",
    name: "Maya Down Jacket",
    originalPrice: 1590.00,
    salePrice: 1272.00,
    discountPercent: 20,
    store: "Flannels",
    category: "Outerwear",
    icon: "award",
    regions: UK_COUNTRIES,
    currency: "GBP",
  },
  {
    id: "uk6",
    brand: "Gucci",
    name: "GG Marmont Belt",
    originalPrice: 420.00,
    salePrice: 378.00,
    discountPercent: 10,
    store: "Selfridges",
    category: "Accessories",
    icon: "star",
    regions: UK_COUNTRIES,
    currency: "GBP",
  },
  {
    id: "uk7",
    brand: "UGG",
    name: "Classic Mini II Boots",
    originalPrice: 170.00,
    salePrice: 136.00,
    discountPercent: 20,
    store: "Frasers",
    category: "Shoes",
    icon: "shopping-bag",
    regions: UK_COUNTRIES,
    currency: "GBP",
  },
  {
    id: "uk8",
    brand: "Hunter",
    name: "Original Tall Wellington Boots",
    originalPrice: 140.00,
    salePrice: 112.00,
    discountPercent: 20,
    store: "Selfridges",
    category: "Shoes",
    icon: "umbrella",
    regions: [...UK_COUNTRIES, ...EU_COUNTRIES],
    currency: "GBP",
  },
  {
    id: "uk9",
    brand: "Loake",
    name: "Aldwych Oxford Shoes",
    originalPrice: 325.00,
    salePrice: 276.25,
    discountPercent: 15,
    store: "Frasers",
    category: "Shoes",
    icon: "briefcase",
    regions: UK_COUNTRIES,
    currency: "GBP",
  },
  {
    id: "uk10",
    brand: "Nike",
    name: "Air Force 1 '07",
    originalPrice: 119.99,
    salePrice: 95.99,
    discountPercent: 20,
    store: "JD Sports",
    storeHandle: "@CaptainCreps",
    category: "Trainers",
    icon: "zap",
    regions: [...UK_COUNTRIES, ...EU_COUNTRIES, ...AUSTRALIA_COUNTRIES],
    currency: "GBP",
  },
  {
    id: "us1",
    brand: "Nike",
    name: "Air Jordan 1 Retro High",
    originalPrice: 180.00,
    salePrice: 144.00,
    discountPercent: 20,
    store: "Foot Locker",
    category: "Trainers",
    icon: "zap",
    regions: [...US_COUNTRIES, ...CANADA_COUNTRIES],
    currency: "USD",
  },
  {
    id: "us2",
    brand: "Canada Goose",
    name: "Chilliwack Bomber",
    originalPrice: 1150.00,
    salePrice: 977.50,
    discountPercent: 15,
    store: "Nordstrom",
    category: "Outerwear",
    icon: "cloud",
    regions: [...US_COUNTRIES, ...CANADA_COUNTRIES],
    currency: "USD",
  },
  {
    id: "us3",
    brand: "Gucci",
    name: "Horsebit Loafers",
    originalPrice: 890.00,
    salePrice: 801.00,
    discountPercent: 10,
    store: "Saks Fifth Avenue",
    category: "Shoes",
    icon: "star",
    regions: US_COUNTRIES,
    currency: "USD",
  },
  {
    id: "us4",
    brand: "Ralph Lauren",
    name: "Cable-Knit Cashmere Sweater",
    originalPrice: 498.00,
    salePrice: 398.40,
    discountPercent: 20,
    store: "Bloomingdale's",
    category: "Knitwear",
    icon: "heart",
    regions: [...US_COUNTRIES, ...CANADA_COUNTRIES],
    currency: "USD",
  },
  {
    id: "us5",
    brand: "Nike",
    name: "Air Max 97",
    originalPrice: 185.00,
    salePrice: 138.75,
    discountPercent: 25,
    store: "Nike.com",
    category: "Trainers",
    icon: "zap",
    regions: [...US_COUNTRIES, ...CANADA_COUNTRIES],
    currency: "USD",
  },
  {
    id: "us6",
    brand: "UGG",
    name: "Tasman Slippers",
    originalPrice: 130.00,
    salePrice: 104.00,
    discountPercent: 20,
    store: "Nordstrom Rack",
    category: "Shoes",
    icon: "shopping-bag",
    regions: [...US_COUNTRIES, ...CANADA_COUNTRIES],
    currency: "USD",
  },
  {
    id: "us7",
    brand: "Prada",
    name: "Saffiano Leather Belt",
    originalPrice: 550.00,
    salePrice: 495.00,
    discountPercent: 10,
    store: "Neiman Marcus",
    category: "Accessories",
    icon: "circle",
    regions: US_COUNTRIES,
    currency: "USD",
  },
  {
    id: "eu1",
    brand: "Moncler",
    name: "Montcla Jacket",
    originalPrice: 1890.00,
    salePrice: 1512.00,
    discountPercent: 20,
    store: "MyTheresa",
    category: "Outerwear",
    icon: "award",
    regions: EU_COUNTRIES,
    currency: "EUR",
  },
  {
    id: "eu2",
    brand: "Celine",
    name: "Triomphe Canvas Belt",
    originalPrice: 490.00,
    salePrice: 416.50,
    discountPercent: 15,
    store: "24S",
    category: "Accessories",
    icon: "circle",
    regions: EU_COUNTRIES,
    currency: "EUR",
  },
  {
    id: "eu3",
    brand: "Prada",
    name: "Re-Nylon Bucket Hat",
    originalPrice: 450.00,
    salePrice: 405.00,
    discountPercent: 10,
    store: "Farfetch",
    category: "Accessories",
    icon: "sun",
    regions: [...EU_COUNTRIES, ...UK_COUNTRIES, ...US_COUNTRIES, ...ASIA_COUNTRIES],
    currency: "EUR",
  },
  {
    id: "eu4",
    brand: "Burberry",
    name: "Kensington Trench Coat",
    originalPrice: 2190.00,
    salePrice: 1861.50,
    discountPercent: 15,
    store: "Net-a-Porter",
    category: "Outerwear",
    icon: "cloud",
    regions: [...EU_COUNTRIES, ...UK_COUNTRIES, ...US_COUNTRIES],
    currency: "EUR",
  },
  {
    id: "me1",
    brand: "Gucci",
    name: "GG Supreme Sneakers",
    originalPrice: 2890.00,
    salePrice: 2601.00,
    discountPercent: 10,
    store: "Level Shoes",
    category: "Shoes",
    icon: "star",
    regions: MIDDLE_EAST_COUNTRIES,
    currency: "AED",
  },
  {
    id: "me2",
    brand: "Moncler",
    name: "Grenoble Down Jacket",
    originalPrice: 5990.00,
    salePrice: 5091.50,
    discountPercent: 15,
    store: "Ounass",
    category: "Outerwear",
    icon: "award",
    regions: MIDDLE_EAST_COUNTRIES,
    currency: "AED",
  },
  {
    id: "asia1",
    brand: "Nike",
    name: "Air Max Plus",
    originalPrice: 18900,
    salePrice: 15120,
    discountPercent: 20,
    store: "ZOZOTOWN",
    category: "Trainers",
    icon: "zap",
    regions: ['Japan'],
    currency: "JPY",
  },
  {
    id: "asia2",
    brand: "Canada Goose",
    name: "Wyndham Parka",
    originalPrice: 12800,
    salePrice: 10880,
    discountPercent: 15,
    store: "Lane Crawford",
    category: "Outerwear",
    icon: "cloud",
    regions: ['Hong Kong', 'China', 'Singapore'],
    currency: "HKD",
  },
  {
    id: "au1",
    brand: "Nike",
    name: "Air Max 90",
    originalPrice: 200.00,
    salePrice: 160.00,
    discountPercent: 20,
    store: "The Iconic",
    category: "Trainers",
    icon: "zap",
    regions: AUSTRALIA_COUNTRIES,
    currency: "AUD",
  },
  {
    id: "au2",
    brand: "UGG",
    name: "Classic Ultra Mini",
    originalPrice: 219.00,
    salePrice: 175.20,
    discountPercent: 20,
    store: "David Jones",
    category: "Shoes",
    icon: "shopping-bag",
    regions: AUSTRALIA_COUNTRIES,
    currency: "AUD",
  },
];

const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    'GBP': '£',
    'USD': '$',
    'EUR': '€',
    'AED': 'AED ',
    'JPY': '¥',
    'HKD': 'HK$',
    'AUD': 'A$',
    'CAD': 'C$',
  };
  return symbols[currency] || '$';
};

export default function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { posts, votePost, voteComparison, thankPost } = usePosts();
  const [selectedCategory, setSelectedCategory] = useState("trending");
  const [selectedLook, setSelectedLook] = useState<CelebrityLook | null>(null);

  const isPremium = tier === "premium" || tier === "vip";

  const userRegion = useMemo(() => {
    return getRegionFromCountry(user?.country || 'United States');
  }, [user?.country]);

  const regionalStyleContent = useMemo(() => {
    return {
      image: REGIONAL_STYLE_IMAGES[userRegion],
      ...REGIONAL_STYLE_TIPS[userRegion],
    };
  }, [userRegion]);

  const countryBargains = useMemo(() => {
    const userCountry = user?.country || 'United States';
    return ALL_BARGAIN_ITEMS.filter(item => item.regions.includes(userCountry));
  }, [user?.country]);

  const trendingPosts = posts.slice(0, 5);

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
    
    Alert.alert(
      `Get the ${look.styleName} Look`,
      `${priceLabel} alternatives (Total: $${totalPrice.toFixed(2)}):\n\n${items.map(item => `${item.name}\n$${item.price.toFixed(2)} at ${item.store}`).join("\n\n")}`,
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
              `Total: $${altTotal.toFixed(2)}\n\n${altItems.map(item => `${item.name}\n$${item.price.toFixed(2)} at ${item.store}`).join("\n\n")}`,
              [{ text: "Close" }]
            );
          }
        },
      ]
    );
  };

  const handleBargainPress = (item: BargainItem) => {
    const symbol = getCurrencySymbol(item.currency);
    const storeInfo = item.storeHandle ? `${item.store} (via ${item.storeHandle})` : item.store;
    Alert.alert(
      `${item.brand} Sale`,
      `${item.name}\n\nOriginal: ${symbol}${item.originalPrice.toFixed(2)}\nSale: ${symbol}${item.salePrice.toFixed(2)}\nYou save: ${item.discountPercent}%\n\nAvailable at ${storeInfo}`,
      [
        { text: "Close", style: "cancel" },
        { 
          text: "Shop Now",
          onPress: () => {
            Alert.alert(
              "Opening Store",
              `StyleWise may earn a small commission on purchases.\n\nYou'll be redirected to ${item.store} to complete your purchase.`,
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Continue to Store", 
                  onPress: () => {
                    Alert.alert(
                      "Coming Soon",
                      `Direct shopping links to ${item.store} will be available soon! Check back for live deals.`
                    );
                  }
                },
              ]
            );
          }
        },
      ]
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.section}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Style of the Day
        </ThemedText>
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
            <View style={styles.featuredBadge}>
              <Feather name="award" size={16} color="#FFD700" />
              <ThemedText type="small" style={styles.featuredBadgeText}>
                StyleWise AI Pick
              </ThemedText>
            </View>
            <ThemedText type="h3" style={styles.featuredTitle}>
              {regionalStyleContent.title}
            </ThemedText>
            <ThemedText type="body" style={styles.featuredDescription} numberOfLines={3}>
              {regionalStyleContent.description}
            </ThemedText>
          </View>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Celebrity-Inspired Looks
          </ThemedText>
        </View>
        <View style={[styles.affiliateNotice, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="info" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={[styles.affiliateText, { color: theme.tabIconDefault }]}>
            StyleWise may earn a commission if you shop through these links
          </ThemedText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.looksContainer}
        >
          {CELEBRITY_LOOKS.map((look) => (
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Bargain of the Week
          </ThemedText>
        </View>
        <ThemedText type="small" style={[styles.bargainSubtitle, { color: theme.tabIconDefault }]}>
          Top deals from popular brands this week
        </ThemedText>
        <View style={[styles.affiliateNotice, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="info" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={[styles.affiliateText, { color: theme.tabIconDefault }]}>
            StyleWise may earn a commission if you shop through these links
          </ThemedText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bargainsContainer}
        >
          {countryBargains.map((item) => {
            const symbol = getCurrencySymbol(item.currency);
            return (
              <Pressable
                key={item.id}
                onPress={() => handleBargainPress(item)}
                style={({ pressed }) => [
                  styles.bargainCard,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.discountBadge, { backgroundColor: "#FF4757" }]}>
                  <ThemedText type="small" style={styles.discountText}>
                    -{item.discountPercent}%
                  </ThemedText>
                </View>
                <View style={[styles.bargainIconContainer, { backgroundColor: theme.link + "15" }]}>
                  <Feather name={item.icon} size={28} color={theme.link} />
                </View>
                <ThemedText type="small" style={styles.bargainBrand}>
                  {item.brand}
                </ThemedText>
                <ThemedText type="body" style={styles.bargainName} numberOfLines={2}>
                  {item.name}
                </ThemedText>
                <View style={styles.priceContainer}>
                  <ThemedText type="small" style={styles.originalPrice}>
                    {symbol}{item.originalPrice.toFixed(2)}
                  </ThemedText>
                  <ThemedText type="h3" style={[styles.salePrice, { color: "#FF4757" }]}>
                    {symbol}{item.salePrice.toFixed(2)}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={styles.storeText}>
                  at {item.store}{item.storeHandle ? ` ${item.storeHandle}` : ''}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Browse by Category
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={({ pressed }) => [
                styles.categoryCard,
                {
                  backgroundColor:
                    selectedCategory === category.id
                      ? theme.link
                      : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={category.icon}
                size={24}
                color={selectedCategory === category.id ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="small"
                style={{
                  color: selectedCategory === category.id ? "#FFFFFF" : theme.text,
                  fontWeight: "600",
                }}
              >
                {category.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h2" style={styles.sectionTitle}>
            Trending Now
          </ThemedText>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <ThemedText type="link">See All</ThemedText>
          </Pressable>
        </View>
        <View style={styles.postsContainer}>
          {trendingPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPress={() => handlePostPress(post.id)}
              onVote={votePost}
              onComparisonVote={voteComparison}
              onThank={thankPost}
              compact
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
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

      <View style={styles.section}>
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
              Emma Style received 156 helpful votes this week
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
              Wedding guest outfit poll received 92 comments
            </ThemedText>
          </View>
        </View>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: Spacing.sm,
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
  bargainSubtitle: {
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
  },
  bargainsContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  bargainCard: {
    width: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    position: "relative",
  },
  discountBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    zIndex: 1,
  },
  discountText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11,
  },
  bargainIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  bargainBrand: {
    opacity: 0.6,
    fontWeight: "600",
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  bargainName: {
    textAlign: "center",
    marginVertical: Spacing.xs,
    fontWeight: "500",
  },
  priceContainer: {
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  originalPrice: {
    textDecorationLine: "line-through",
    opacity: 0.5,
    fontSize: 12,
  },
  salePrice: {
    fontWeight: "700",
    marginTop: 2,
  },
  storeText: {
    opacity: 0.6,
    fontSize: 11,
    marginTop: Spacing.xs,
  },
});
