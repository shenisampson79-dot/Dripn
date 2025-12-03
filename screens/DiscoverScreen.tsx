import React, { useState } from "react";
import { StyleSheet, View, Pressable, Image, ScrollView, Dimensions } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { PostCard } from "@/components/PostCard";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePosts } from "@/contexts/PostsContext";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

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

export default function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { theme } = useTheme();
  const { posts, votePost, voteComparison, thankPost } = usePosts();
  const [selectedCategory, setSelectedCategory] = useState("trending");

  const styleOfTheDay = posts.find((p) => p.userId === "ai-stylist");
  const trendingPosts = posts.slice(0, 5);

  const handlePostPress = (postId: string) => {
    navigation.navigate("PostDetail", { postId });
  };

  return (
    <ScreenScrollView>
      <View style={styles.section}>
        <ThemedText type="h2" style={styles.sectionTitle}>
          Style of the Day
        </ThemedText>
        {styleOfTheDay ? (
          <Pressable
            onPress={() => handlePostPress(styleOfTheDay.id)}
            style={({ pressed }) => [
              styles.featuredCard,
              { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Image
              source={{ uri: styleOfTheDay.images[0]?.uri }}
              style={styles.featuredImage}
            />
            <View style={styles.featuredOverlay}>
              <View style={styles.featuredBadge}>
                <Feather name="award" size={16} color="#FFD700" />
                <ThemedText type="small" style={styles.featuredBadgeText}>
                  StyleWise AI Pick
                </ThemedText>
              </View>
              <ThemedText type="body" style={styles.featuredDescription} numberOfLines={2}>
                {styleOfTheDay.description}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}
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
    height: 240,
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
});
