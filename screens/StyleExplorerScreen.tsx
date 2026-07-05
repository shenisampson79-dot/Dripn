import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView, Image, ImageSourcePropType, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearGradient } from "expo-linear-gradient";
import { Spacing, BorderRadius, StyleTheme, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { useAuth, Gender } from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const STYLE_IMAGES: Record<Exclude<StyleTheme, 'smart-casual' | 'boho' | 'sporty' | 'business'>, ImageSourcePropType> = {
  luxury: require("../assets/images/styles/luxury.png"),
  streetwear: require("../assets/images/styles/streetwear.png"),
  edgy: require("../assets/images/styles/edgy.png"),
};

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

const STREETWEAR_MALE_IMAGES: Record<RegionalType, ImageSourcePropType> = {
  'multicultural': require("../assets/images/styles/streetwear/male/multicultural.png"),
  'nordic': require("../assets/images/styles/streetwear/male/nordic.png"),
  'asian': require("../assets/images/styles/streetwear/male/asian.png"),
  'african': require("../assets/images/styles/streetwear/male/african.png"),
  'middle-eastern': require("../assets/images/styles/streetwear/male/middle-eastern.png"),
  'south-asian': require("../assets/images/styles/streetwear/male/south-asian.png"),
  'latin-american': require("../assets/images/styles/streetwear/male/latin-american.png"),
};

const getGenderSpecificStreetwearImage = (region: RegionalType, gender: Gender): ImageSourcePropType => {
  if (gender === 'man') return STREETWEAR_MALE_IMAGES[region];
  return STYLE_IMAGES.streetwear;
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

interface StyleOption {
  id: StyleTheme;
  name: string;
  description: string;
  detailedDescription: string;
  keyPieces: string[];
  occasions: string[];
}

const STYLE_OPTIONS_FEMALE: StyleOption[] = [
  { 
    id: "luxury", 
    name: "Formal", 
    description: "Elegant, refined, timeless pieces",
    detailedDescription: "Classic sophistication with premium fabrics and impeccable tailoring. Think structured silhouettes, quality materials, and understated luxury.",
    keyPieces: ["Tailored blazers", "Silk blouses", "Cashmere knits", "Designer accessories"],
    occasions: ["Business meetings", "Fine dining", "Special events", "Cocktail parties"]
  },
  { 
    id: "streetwear", 
    name: "Casual", 
    description: "Relaxed, comfortable, everyday style",
    detailedDescription: "Effortless everyday looks that prioritize comfort without sacrificing style. Perfect for weekend errands and casual meetups.",
    keyPieces: ["Premium tees", "Quality denim", "Comfortable sneakers", "Cozy knits"],
    occasions: ["Weekend outings", "Coffee dates", "Shopping trips", "Casual dining"]
  },
  { 
    id: "boho", 
    name: "Creative", 
    description: "Artistic, expressive style",
    detailedDescription: "Free-spirited fashion with flowing fabrics, natural textures, and artistic patterns. Embrace your inner creative spirit.",
    keyPieces: ["Maxi dresses", "Crochet tops", "Layered jewelry", "Fringe bags"],
    occasions: ["Music festivals", "Beach days", "Art galleries", "Garden parties"]
  },
  { 
    id: "sporty", 
    name: "Active", 
    description: "Sporty, athleisure focused",
    detailedDescription: "Performance meets fashion with sleek athleisure pieces. From the gym to brunch, stay comfortable and stylish.",
    keyPieces: ["Leggings", "Sports bras", "Performance hoodies", "Designer trainers"],
    occasions: ["Workouts", "Active weekends", "Travel days", "Athleisure brunches"]
  },
  { 
    id: "smart-casual", 
    name: "Smart Casual", 
    description: "Polished yet relaxed, effortlessly chic",
    detailedDescription: "The perfect balance of dressed-up and laid-back. Tailored trousers paired with a silk camisole, or a midi skirt with a fitted knit. Sophisticated enough for the office, relaxed enough for after-work drinks.",
    keyPieces: ["Wide-leg trousers", "Silk camisoles", "Fitted knits", "Midi skirts", "Loafers", "Structured totes"],
    occasions: ["Office days", "Client meetings", "After-work drinks", "Weekend brunch", "Date nights"]
  },
  { 
    id: "edgy", 
    name: "Trendsetter", 
    description: "Latest fashion, bold choices",
    detailedDescription: "Make a statement with unconventional pieces, bold palettes, and unexpected combinations. For those who dare to be different.",
    keyPieces: ["Leather jackets", "Statement boots", "Graphic tees", "Chunky jewelry"],
    occasions: ["Concerts", "Night out", "Art events", "Creative gatherings"]
  },
];

const STYLE_OPTIONS_MALE: StyleOption[] = [
  { 
    id: "smart-casual", 
    name: "Smart Casual", 
    description: "Polished yet relaxed, refined everyday style",
    detailedDescription: "The modern gentleman's go-to. Well-fitted chinos with crisp button-downs, quality knitwear, and leather loafers. Professional enough for meetings, relaxed enough for dinner.",
    keyPieces: ["Chinos", "Oxford shirts", "Merino knits", "Leather loafers", "Quality belts"],
    occasions: ["Office casual", "Client dinners", "Weekend brunches", "Date nights", "Smart events"]
  },
  { 
    id: "streetwear", 
    name: "Casual", 
    description: "Relaxed, comfortable, everyday style",
    detailedDescription: "Quality basics and relaxed fits for everyday comfort. Premium cotton tees, well-fitted jeans, and clean sneakers.",
    keyPieces: ["Premium tees", "Straight-leg jeans", "Clean sneakers", "Casual jackets"],
    occasions: ["Weekend outings", "Casual meetups", "Travel", "Relaxed dining"]
  },
  { 
    id: "boho", 
    name: "Creative", 
    description: "Artistic, expressive style",
    detailedDescription: "Laid-back style with natural fabrics and earthy tones. Linen shirts, relaxed fits, and artisan accessories.",
    keyPieces: ["Linen shirts", "Relaxed trousers", "Leather sandals", "Woven accessories"],
    occasions: ["Beach holidays", "Art events", "Festivals", "Outdoor dining"]
  },
  { 
    id: "sporty", 
    name: "Active", 
    description: "Sporty, athleisure focused",
    detailedDescription: "Performance-focused athleisure that transitions from the gym to casual settings. Technical fabrics with contemporary design.",
    keyPieces: ["Performance polos", "Athletic shorts", "Training shoes", "Tech hoodies"],
    occasions: ["Workouts", "Active weekends", "Casual sports", "Relaxed Sundays"]
  },
  { 
    id: "business", 
    name: "Professional", 
    description: "Office-ready, polished looks",
    detailedDescription: "Executive presence with impeccable tailoring. Sharp suits, quality dress shirts, and polished leather shoes for the boardroom.",
    keyPieces: ["Tailored suits", "Dress shirts", "Leather oxfords", "Quality ties"],
    occasions: ["Board meetings", "Formal events", "Business travel", "Corporate dinners"]
  },
  { 
    id: "edgy", 
    name: "Trendsetter", 
    description: "Latest fashion, bold choices",
    detailedDescription: "Stand out with dark palettes, leather accents, and unconventional cuts. For those who embrace the rebellious side of fashion.",
    keyPieces: ["Leather jackets", "Black denim", "Combat boots", "Statement pieces"],
    occasions: ["Concerts", "Night out", "Creative events", "Alternative scenes"]
  },
];

type StyleExplorerScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "StyleExplorer">;
};

export default function StyleExplorerScreen({ navigation }: StyleExplorerScreenProps) {
  const { paddingTop, paddingBottom } = useScreenInsets();
  const { theme } = useTheme();
  const { user, updateProfile } = useAuth();
  
  const [selectedStyle, setSelectedStyle] = useState<StyleTheme>(user?.stylePreference || "luxury");
  const [isUpdating, setIsUpdating] = useState(false);
  
  const styleOptions = user?.gender === 'man' ? STYLE_OPTIONS_MALE : STYLE_OPTIONS_FEMALE;
  const currentStyle = styleOptions.find(s => s.id === selectedStyle) || styleOptions[0];
  
  const region = getRegionFromCountry(user?.country || "United States");
  
  const getStyleImage = (styleId: StyleTheme): ImageSourcePropType => {
    const gender = user?.gender || 'woman';
    if (styleId === 'smart-casual') return getSmartCasualImage(region, gender);
    if (styleId === 'boho') return getGenderSpecificBohoImage(region, gender);
    if (styleId === 'sporty') return getGenderSpecificSportyImage(region, gender);
    if (styleId === 'business') return getGenderSpecificBusinessImage(region);
    if (styleId === 'streetwear') return getGenderSpecificStreetwearImage(region, gender);
    return STYLE_IMAGES[styleId as keyof typeof STYLE_IMAGES];
  };
  
  const handleApplyStyle = async () => {
    if (selectedStyle === user?.stylePreference) {
      navigation.goBack();
      return;
    }
    
    setIsUpdating(true);
    try {
      await updateProfile({ stylePreference: selectedStyle });
      Alert.alert(
        "Style Updated",
        `Your style has been changed to ${currentStyle.name}. Your feed and recommendations will now reflect this style.`,
        [{ text: "Great!", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Could not update your style. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop }]}>
      <ThemedText type="body" style={styles.subtitle}>
        Discover and switch to a style that matches your vibe
      </ThemedText>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.styleTabsContainer}
      >
        {styleOptions.map((style) => (
          <Pressable
            key={style.id}
            onPress={() => setSelectedStyle(style.id)}
            style={[
              styles.styleTab,
              {
                backgroundColor: selectedStyle === style.id ? theme.link : theme.backgroundDefault,
                borderColor: selectedStyle === style.id ? theme.link : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: selectedStyle === style.id ? "#FFFFFF" : theme.text,
                fontWeight: selectedStyle === style.id ? "700" : "500",
              }}
            >
              {style.name}
            </ThemedText>
            {user?.stylePreference === style.id ? (
              <View style={[styles.currentBadge, { backgroundColor: selectedStyle === style.id ? "rgba(255,255,255,0.3)" : theme.link }]}>
                <Feather name="check" size={10} color={selectedStyle === style.id ? "#FFFFFF" : "#FFFFFF"} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView 
        style={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Animated.View 
          key={selectedStyle}
          entering={FadeIn.duration(300)}
          style={styles.styleContent}
        >
          <Image
            source={getStyleImage(selectedStyle)}
            style={styles.styleImage}
            resizeMode="cover"
          />
          
          <View style={styles.styleInfo}>
            <ThemedText type="h1">{currentStyle.name}</ThemedText>
            <ThemedText type="body" style={styles.styleDescription}>
              {currentStyle.detailedDescription}
            </ThemedText>
            
            <Card style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Feather name="shopping-bag" size={18} color={theme.link} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Key Pieces</ThemedText>
              </View>
              <View style={styles.tagsContainer}>
                {currentStyle.keyPieces.map((piece, index) => (
                  <View 
                    key={index}
                    style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <ThemedText type="small">{piece}</ThemedText>
                  </View>
                ))}
              </View>
            </Card>
            
            <Card style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Feather name="calendar" size={18} color={theme.link} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Perfect For</ThemedText>
              </View>
              <View style={styles.tagsContainer}>
                {currentStyle.occasions.map((occasion, index) => (
                  <View 
                    key={index}
                    style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <ThemedText type="small">{occasion}</ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </Animated.View>
      </ScrollView>
      
      <View style={[styles.footer, { paddingBottom }]}>
        {selectedStyle === user?.stylePreference ? (
          <View style={[styles.currentStyleBanner, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="check-circle" size={20} color={theme.link} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              This is your current style
            </ThemedText>
          </View>
        ) : (
          <Button
            onPress={handleApplyStyle}
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : `Switch to ${currentStyle.name}`}
          </Button>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  styleTabsContainer: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  styleTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  currentBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  styleContent: {
    gap: Spacing.lg,
  },
  styleImage: {
    width: "100%",
    height: 300,
    borderRadius: BorderRadius.lg,
  },
  styleInfo: {
    gap: Spacing.md,
  },
  styleDescription: {
    opacity: 0.8,
    lineHeight: 24,
  },
  infoCard: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  tag: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  currentStyleBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
