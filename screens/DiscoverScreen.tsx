import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, ScrollView, Dimensions, Alert, ImageSourcePropType } from "react-native";
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

export default function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { posts, votePost, voteComparison, thankPost } = usePosts();
  const [selectedCategory, setSelectedCategory] = useState("trending");

  const userRegion = useMemo(() => {
    return getRegionFromCountry(user?.country || 'United States');
  }, [user?.country]);

  const regionalStyleContent = useMemo(() => {
    return {
      image: REGIONAL_STYLE_IMAGES[userRegion],
      ...REGIONAL_STYLE_TIPS[userRegion],
    };
  }, [userRegion]);

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
});
