/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Personalized Wardrobe Filter Screen - Filter clothing by body shape compatibility
 */

import React, { useState, useMemo } from "react";
import { 
  StyleSheet, 
  View, 
  Pressable,
  FlatList,
  Dimensions,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useBodyProfile, BodyShape } from "@/contexts/BodyProfileContext";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PersonalizedWardrobeFilterScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "PersonalizedWardrobeFilter">;
};

type ClothingCategory = "tops" | "bottoms" | "dresses" | "outerwear" | "all";

interface ClothingItem {
  id: string;
  name: string;
  category: "tops" | "bottoms" | "dresses" | "outerwear";
  compatibleShapes: BodyShape[];
  image?: string;
  style: string;
}

const CLOTHING_DATABASE: ClothingItem[] = [
  { id: "1", name: "Wrap Top", category: "tops", compatibleShapes: ["hourglass", "pear", "apple", "plus-size"], style: "Flattering V-neckline that defines the waist" },
  { id: "2", name: "Peplum Blouse", category: "tops", compatibleShapes: ["hourglass", "rectangle", "inverted-triangle", "athletic"], style: "Adds curves and defines the waist" },
  { id: "3", name: "V-Neck Sweater", category: "tops", compatibleShapes: ["hourglass", "pear", "apple", "rectangle", "plus-size"], style: "Elongates the torso and slims the neckline" },
  { id: "4", name: "Off-Shoulder Top", category: "tops", compatibleShapes: ["pear", "rectangle", "petite"], style: "Broadens shoulders and balances proportions" },
  { id: "5", name: "Fitted Blazer", category: "tops", compatibleShapes: ["hourglass", "rectangle", "inverted-triangle", "athletic", "tall"], style: "Creates structure and defines the waist" },
  { id: "6", name: "Crop Top", category: "tops", compatibleShapes: ["hourglass", "pear", "petite", "athletic"], style: "Highlights the waist and elongates legs" },
  { id: "7", name: "Boat Neck Top", category: "tops", compatibleShapes: ["pear", "rectangle", "petite"], style: "Widens the shoulder line" },
  { id: "8", name: "Empire Waist Top", category: "tops", compatibleShapes: ["apple", "rectangle", "plus-size"], style: "Flows over the midsection gracefully" },
  { id: "9", name: "High-Waisted Jeans", category: "bottoms", compatibleShapes: ["hourglass", "pear", "apple", "rectangle", "plus-size"], style: "Elongates legs and defines waist" },
  { id: "10", name: "Wide-Leg Pants", category: "bottoms", compatibleShapes: ["hourglass", "pear", "inverted-triangle", "athletic", "tall"], style: "Balances proportions and creates flow" },
  { id: "11", name: "A-Line Skirt", category: "bottoms", compatibleShapes: ["hourglass", "pear", "apple", "rectangle", "plus-size"], style: "Flatters hips and creates feminine silhouette" },
  { id: "12", name: "Pencil Skirt", category: "bottoms", compatibleShapes: ["hourglass", "rectangle", "inverted-triangle", "athletic"], style: "Highlights curves and elongates legs" },
  { id: "13", name: "Bootcut Jeans", category: "bottoms", compatibleShapes: ["pear", "apple", "athletic", "plus-size"], style: "Balances wider hips and thighs" },
  { id: "14", name: "Pleated Trousers", category: "bottoms", compatibleShapes: ["rectangle", "inverted-triangle", "athletic", "tall"], style: "Adds volume and visual interest" },
  { id: "15", name: "Midi Skirt", category: "bottoms", compatibleShapes: ["hourglass", "pear", "tall", "petite"], style: "Elegant length that flatters most heights" },
  { id: "16", name: "Wrap Dress", category: "dresses", compatibleShapes: ["hourglass", "pear", "apple", "rectangle", "plus-size"], style: "Universally flattering with waist definition" },
  { id: "17", name: "Fit and Flare Dress", category: "dresses", compatibleShapes: ["hourglass", "pear", "apple", "petite"], style: "Cinches waist and flows over hips" },
  { id: "18", name: "Sheath Dress", category: "dresses", compatibleShapes: ["hourglass", "rectangle", "inverted-triangle", "athletic"], style: "Clean lines that follow body curves" },
  { id: "19", name: "Empire Waist Dress", category: "dresses", compatibleShapes: ["apple", "pear", "petite", "plus-size"], style: "Flows from under bust, flatters midsection" },
  { id: "20", name: "Maxi Dress", category: "dresses", compatibleShapes: ["tall", "hourglass", "pear", "athletic"], style: "Elongating and elegant for taller frames" },
  { id: "21", name: "Bodycon Dress", category: "dresses", compatibleShapes: ["hourglass", "athletic", "rectangle"], style: "Shows off curves and muscle definition" },
  { id: "22", name: "Shirt Dress", category: "dresses", compatibleShapes: ["rectangle", "inverted-triangle", "athletic", "tall"], style: "Classic structure with waist definition" },
  { id: "23", name: "Structured Blazer", category: "outerwear", compatibleShapes: ["hourglass", "rectangle", "pear", "petite"], style: "Adds structure and defines shoulders" },
  { id: "24", name: "Belted Trench Coat", category: "outerwear", compatibleShapes: ["hourglass", "rectangle", "tall", "athletic"], style: "Classic silhouette with waist definition" },
  { id: "25", name: "Cropped Jacket", category: "outerwear", compatibleShapes: ["pear", "petite", "hourglass"], style: "Elongates legs and balances proportions" },
  { id: "26", name: "Longline Cardigan", category: "outerwear", compatibleShapes: ["apple", "plus-size", "rectangle"], style: "Creates vertical lines and slims silhouette" },
  { id: "27", name: "Moto Jacket", category: "outerwear", compatibleShapes: ["athletic", "rectangle", "inverted-triangle", "petite"], style: "Adds edge and structure" },
  { id: "28", name: "Oversized Coat", category: "outerwear", compatibleShapes: ["tall", "athletic", "inverted-triangle"], style: "Dramatic silhouette for taller frames" },
];

const CATEGORIES: { key: ClothingCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "all", label: "All", icon: "grid" },
  { key: "tops", label: "Tops", icon: "triangle" },
  { key: "bottoms", label: "Bottoms", icon: "minus" },
  { key: "dresses", label: "Dresses", icon: "heart" },
  { key: "outerwear", label: "Outerwear", icon: "cloud" },
];

export default function PersonalizedWardrobeFilterScreen({ navigation }: PersonalizedWardrobeFilterScreenProps) {
  const { theme, isDark } = useTheme();
  const { bodyProfile, hasBodyProfile } = useBodyProfile();
  const { paddingTop, paddingBottom } = useScreenInsets();
  
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory>("all");
  const [showCompatibleOnly, setShowCompatibleOnly] = useState(true);

  const secondaryTextColor = isDark ? "#B0B0B0" : "#666666";
  const tertiaryTextColor = isDark ? "#808080" : "#999999";

  const userBodyShape = bodyProfile?.bodyShape || "unknown";

  const getMatchPercentage = (item: ClothingItem): number => {
    if (!hasBodyProfile || userBodyShape === "unknown") return 50;
    
    if (item.compatibleShapes.includes(userBodyShape)) {
      const baseScore = 85;
      const varietyBonus = Math.min(item.compatibleShapes.length * 2, 10);
      return Math.min(baseScore + varietyBonus + Math.floor(Math.random() * 6), 98);
    }
    return 30 + Math.floor(Math.random() * 25);
  };

  const filteredItems = useMemo(() => {
    let items = CLOTHING_DATABASE;
    
    if (selectedCategory !== "all") {
      items = items.filter(item => item.category === selectedCategory);
    }
    
    if (showCompatibleOnly && hasBodyProfile && userBodyShape !== "unknown") {
      items = items.filter(item => item.compatibleShapes.includes(userBodyShape));
    }
    
    return items.map(item => ({
      ...item,
      matchPercentage: getMatchPercentage(item),
    })).sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, [selectedCategory, showCompatibleOnly, hasBodyProfile, userBodyShape]);

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return theme.success;
    if (percentage >= 60) return theme.warning;
    return theme.error;
  };

  const renderCategoryButton = ({ item }: { item: typeof CATEGORIES[0] }) => {
    const isSelected = selectedCategory === item.key;
    return (
      <Pressable
        onPress={() => setSelectedCategory(item.key)}
        style={[
          styles.categoryButton,
          { 
            backgroundColor: isSelected ? theme.link : theme.backgroundSecondary,
          },
        ]}
      >
        <Feather 
          name={item.icon} 
          size={16} 
          color={isSelected ? "#FFFFFF" : secondaryTextColor} 
        />
        <ThemedText 
          type="body" 
          style={{ color: isSelected ? "#FFFFFF" : secondaryTextColor, fontWeight: "600" }}
        >
          {item.label}
        </ThemedText>
      </Pressable>
    );
  };

  const renderClothingItem = ({ item }: { item: ClothingItem & { matchPercentage: number } }) => {
    const matchColor = getMatchColor(item.matchPercentage);
    
    return (
      <Card elevation={1} style={styles.clothingCard}>
        <View style={styles.clothingHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: theme.backgroundTertiary }]}>
            <ThemedText type="caption" style={{ color: secondaryTextColor }}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </ThemedText>
          </View>
          <View style={[styles.matchBadge, { backgroundColor: matchColor + "20" }]}>
            <ThemedText type="body" style={{ color: matchColor, fontWeight: "600" }}>
              {item.matchPercentage}% Match
            </ThemedText>
          </View>
        </View>
        <ThemedText type="h3" style={styles.clothingName}>
          {item.name}
        </ThemedText>
        <ThemedText type="body" style={[styles.clothingStyle, { color: secondaryTextColor }]}>
          {item.style}
        </ThemedText>
        <View style={styles.compatibleShapes}>
          <ThemedText type="caption" style={{ color: tertiaryTextColor }}>
            Best for: {item.compatibleShapes.slice(0, 3).map(s => 
              s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')
            ).join(", ")}
            {item.compatibleShapes.length > 3 ? ` +${item.compatibleShapes.length - 3} more` : ""}
          </ThemedText>
        </View>
      </Card>
    );
  };

  if (!hasBodyProfile) {
    return (
      <ThemedView style={[styles.container, { paddingTop, paddingBottom }]}>
        <View style={styles.emptyContainer}>
          <Card elevation={1} style={styles.emptyCard}>
            <View style={[styles.iconContainer, { backgroundColor: theme.link + "20" }]}>
              <Feather name="filter" size={48} color={theme.link} />
            </View>
            <ThemedText type="h3" style={styles.emptyTitle}>
              Body Profile Required
            </ThemedText>
            <ThemedText type="body" style={[styles.emptyText, { color: secondaryTextColor }]}>
              Complete a body scan to get personalized clothing recommendations with match percentages tailored to your unique shape.
            </ThemedText>
            <Pressable onPress={() => navigation.navigate("BodyScanner")}>
              <LinearGradient
                colors={[theme.link, theme.link]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButton}
              >
                <Feather name="camera" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={styles.buttonText}>
                  Start Body Scan
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </Card>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop }]}>
      <View style={styles.headerSection}>
        <ThemedText type="h2" style={styles.title}>
          Wardrobe Filter
        </ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: secondaryTextColor }]}>
          Clothing recommendations for your {userBodyShape.replace('-', ' ')} shape
        </ThemedText>

        <FlatList
          horizontal
          data={CATEGORIES}
          renderItem={renderCategoryButton}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />

        <Pressable
          onPress={() => setShowCompatibleOnly(!showCompatibleOnly)}
          style={[styles.filterToggle, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather 
            name={showCompatibleOnly ? "check-square" : "square"} 
            size={20} 
            color={showCompatibleOnly ? theme.link : secondaryTextColor} 
          />
          <ThemedText type="body">
            Show only compatible items
          </ThemedText>
        </Pressable>

        <View style={styles.resultCount}>
          <ThemedText type="body" style={{ color: secondaryTextColor, fontWeight: "600" }}>
            {filteredItems.length} items found
          </ThemedText>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderClothingItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.clothingList, { paddingBottom: paddingBottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Card elevation={1} style={styles.emptyResultCard}>
            <Feather name="search" size={32} color={tertiaryTextColor} />
            <ThemedText type="body" style={[styles.emptyResultText, { color: secondaryTextColor }]}>
              No items found in this category
            </ThemedText>
          </Card>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.lg,
  },
  categoryList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  resultCount: {
    marginBottom: Spacing.md,
  },
  clothingList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  clothingCard: {
    marginBottom: Spacing.sm,
  },
  clothingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  matchBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  clothingName: {
    marginBottom: Spacing.xs,
  },
  clothingStyle: {
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  compatibleShapes: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyCard: {
    alignItems: "center",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.full,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyResultCard: {
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  emptyResultText: {
    textAlign: "center",
  },
});
