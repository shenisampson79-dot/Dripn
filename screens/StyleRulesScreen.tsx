import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { apiService } from "@/services/ApiService";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type StyleRulesScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StyleRules">;
};

interface FashionRule {
  id: number;
  title: string;
  content: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  gender: 'all' | 'women' | 'men';
  tags: string[];
  colorSwatches?: Array<{ name: string; hex: string }>;
}

interface CategoryInfo {
  name: string;
  count: number;
  topics: string[];
}

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  Beginner: { bg: '#E8F5E9', text: '#2E7D32' },
  Intermediate: { bg: '#FFF3E0', text: '#EF6C00' },
  Advanced: { bg: '#FCE4EC', text: '#C2185B' },
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  'Colour & Palette': 'droplet',
  'Silhouette & Proportion': 'maximize-2',
  'Fabric & Texture': 'layers',
  'Occasion & Context': 'calendar',
  'Accessories': 'watch',
  'Seasonal Dressing': 'sun',
  'Care & Maintenance': 'tool',
  'Investment Pieces': 'trending-up',
  'Body Confidence': 'heart',
  'Sustainability': 'globe',
};

const FALLBACK_RULES: FashionRule[] = [
  { id: 1, title: "The Rule of Three", content: "Limit your outfit to three main colours maximum. This creates visual harmony and prevents your look from appearing chaotic or overwhelming.", category: "Colour & Palette", difficulty: "Beginner", gender: "all", tags: ["colour", "basics", "harmony"], colorSwatches: [{ name: "Navy", hex: "#1E3A5F" }, { name: "White", hex: "#FFFFFF" }, { name: "Camel", hex: "#C19A6B" }] },
  { id: 2, title: "Match Your Metals", content: "Keep your jewellery and hardware (belt buckles, bag clasps, shoe details) in the same metal family for a cohesive, polished look.", category: "Accessories", difficulty: "Beginner", gender: "all", tags: ["accessories", "jewellery", "coordination"] },
  { id: 3, title: "The Third Piece Rule", content: "Elevate any outfit by adding a third piece - a blazer, cardigan, scarf, or structured bag. This transforms basic combinations into complete, intentional looks.", category: "Silhouette & Proportion", difficulty: "Beginner", gender: "all", tags: ["layering", "styling", "polish"] },
  { id: 4, title: "Proportion Play", content: "Balance volume in your outfit: if wearing something loose on top, go fitted on bottom (and vice versa). This creates flattering silhouettes on all body types.", category: "Silhouette & Proportion", difficulty: "Intermediate", gender: "all", tags: ["proportion", "balance", "silhouette"] },
  { id: 5, title: "Dress for Your Colour Season", content: "Wearing colours that complement your natural colouring (skin tone, hair, eyes) makes you look healthier and more vibrant. Discover whether you're a Spring, Summer, Autumn, or Winter.", category: "Colour & Palette", difficulty: "Intermediate", gender: "all", tags: ["colour-analysis", "personal-colour", "flattering"], colorSwatches: [{ name: "Warm Gold", hex: "#C9A87C" }, { name: "Cool Silver", hex: "#C0C0C0" }] },
  { id: 6, title: "Invest in Quality Basics", content: "Build your wardrobe foundation with well-made basics: a white shirt, dark trousers, quality denim, and a versatile blazer. Quality over quantity always wins.", category: "Investment Pieces", difficulty: "Beginner", gender: "all", tags: ["basics", "investment", "quality", "capsule"] },
  { id: 7, title: "The One-Statement Rule", content: "Let one piece be the star of your outfit. If wearing a bold pattern or statement accessory, keep everything else understated to avoid visual competition.", category: "Silhouette & Proportion", difficulty: "Beginner", gender: "all", tags: ["statement", "balance", "focus"] },
  { id: 8, title: "Texture Mixing", content: "Combine different textures (silk with denim, cashmere with leather, linen with wool) to add depth and visual interest to monochromatic or simple outfits.", category: "Fabric & Texture", difficulty: "Intermediate", gender: "all", tags: ["texture", "depth", "interest", "tactile"] },
  { id: 9, title: "Dress for the Occasion Plus One", content: "Aim to be slightly better dressed than the occasion requires. Being underdressed feels awkward, while being slightly overdressed signals effort and respect.", category: "Occasion & Context", difficulty: "Beginner", gender: "all", tags: ["dress-code", "occasion", "appropriateness"] },
  { id: 10, title: "The Power of Tailoring", content: "Well-fitted clothes look more expensive than ill-fitting designer pieces. Invest in alterations for key pieces - the difference is transformative.", category: "Investment Pieces", difficulty: "Intermediate", gender: "all", tags: ["tailoring", "fit", "alterations", "quality"] },
  { id: 11, title: "Neutral Foundation, Colour Accent", content: "Build outfits on neutral foundations (black, white, grey, navy, beige) and introduce colour through accessories or one statement piece.", category: "Colour & Palette", difficulty: "Beginner", gender: "all", tags: ["neutrals", "colour-pop", "versatility"] },
  { id: 12, title: "Care for Your Clothes", content: "Read care labels, use proper hangers, and store items correctly. Well-maintained clothes last longer and look better with every wear.", category: "Care & Maintenance", difficulty: "Beginner", gender: "all", tags: ["care", "maintenance", "longevity"] },
  { id: 13, title: "Seasonal Fabric Choices", content: "Match fabric weights to seasons: linen and cotton for summer, wool and cashmere for winter. This keeps you comfortable and appropriately dressed.", category: "Seasonal Dressing", difficulty: "Beginner", gender: "all", tags: ["seasonal", "fabric", "comfort", "practical"] },
  { id: 14, title: "The 80/20 Wardrobe Rule", content: "You wear 20% of your wardrobe 80% of the time. Identify those key pieces and invest in their quality. Audit and edit your wardrobe regularly.", category: "Investment Pieces", difficulty: "Advanced", gender: "all", tags: ["wardrobe-audit", "capsule", "curation"] },
  { id: 15, title: "Confidence is Your Best Accessory", content: "Wear what makes you feel confident and comfortable. The best-dressed people own their personal style rather than following every trend.", category: "Body Confidence", difficulty: "Beginner", gender: "all", tags: ["confidence", "personal-style", "self-expression"] },
  { id: 16, title: "Quality Over Quantity", content: "Invest in fewer, better pieces rather than fast fashion. Quality fabrics, construction, and timeless design outlast trends and cost less per wear.", category: "Sustainability", difficulty: "Intermediate", gender: "all", tags: ["sustainability", "investment", "slow-fashion"] },
];

const FALLBACK_CATEGORIES: CategoryInfo[] = [
  { name: "Colour & Palette", count: 3, topics: ["colour theory", "colour seasons", "coordination"] },
  { name: "Silhouette & Proportion", count: 3, topics: ["balance", "volume", "layering"] },
  { name: "Accessories", count: 1, topics: ["jewellery", "bags", "coordination"] },
  { name: "Fabric & Texture", count: 1, topics: ["texture mixing", "fabric care"] },
  { name: "Occasion & Context", count: 1, topics: ["dress codes", "appropriateness"] },
  { name: "Investment Pieces", count: 3, topics: ["quality", "tailoring", "basics"] },
  { name: "Care & Maintenance", count: 1, topics: ["garment care", "storage"] },
  { name: "Seasonal Dressing", count: 1, topics: ["seasonal fabrics", "weather"] },
  { name: "Body Confidence", count: 1, topics: ["self-expression", "personal style"] },
  { name: "Sustainability", count: 1, topics: ["slow fashion", "conscious shopping"] },
];

export default function StyleRulesScreen({ navigation }: StyleRulesScreenProps) {
  const { theme, isDark } = useTheme();
  const { palette } = useColorScheme();
  const [rules, setRules] = useState<FashionRule[]>(FALLBACK_RULES);
  const [categories, setCategories] = useState<CategoryInfo[]>(FALLBACK_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());

  const getFilteredRules = useCallback((category: string | null, allRules: FashionRule[]) => {
    if (!category) return allRules;
    return allRules.filter(rule => rule.category === category);
  }, []);

  const fetchRulesFromApi = useCallback(async () => {
    try {
      const response = await apiService.getFashionRules();
      if (response?.rules && response.rules.length > 0) {
        return response.rules;
      }
    } catch (error) {
      console.log('[StyleRules] API not available, using fallback');
    }
    return FALLBACK_RULES;
  }, []);

  const fetchCategoriesFromApi = useCallback(async () => {
    try {
      const response = await apiService.getFashionRuleCategories();
      if (response?.categories && response.categories.length > 0) {
        setCategories(response.categories);
        return;
      }
    } catch (error) {
      console.log('[StyleRules] Categories API not available, using fallback');
    }
    setCategories(FALLBACK_CATEGORIES);
  }, []);

  const [allRules, setAllRules] = useState<FashionRule[]>(FALLBACK_RULES);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      const [fetchedRules] = await Promise.all([
        fetchRulesFromApi(),
        fetchCategoriesFromApi()
      ]);
      setAllRules(fetchedRules);
      setRules(fetchedRules);
      setIsLoading(false);
    };
    loadInitialData();
  }, [fetchRulesFromApi, fetchCategoriesFromApi]);

  useEffect(() => {
    const filtered = getFilteredRules(selectedCategory, allRules);
    setRules(filtered);
  }, [selectedCategory, allRules, getFilteredRules]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const [fetchedRules] = await Promise.all([
      fetchRulesFromApi(),
      fetchCategoriesFromApi()
    ]);
    setAllRules(fetchedRules);
    setRules(getFilteredRules(selectedCategory, fetchedRules));
    setIsRefreshing(false);
  };

  const toggleRuleExpansion = (ruleId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleCategorySelect = (category: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
  };

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    return CATEGORY_ICONS[category] || 'bookmark';
  };

  const renderCategoryChip = ({ item }: { item: CategoryInfo | { name: string; count: number } }) => {
    const isSelected = selectedCategory === item.name || (selectedCategory === null && item.name === 'All');
    const isAllChip = item.name === 'All';
    
    return (
      <Pressable
        style={[
          styles.categoryChip,
          {
            backgroundColor: isSelected 
              ? palette.gold
              : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderColor: isSelected ? palette.gold : 'transparent',
          },
        ]}
        onPress={() => handleCategorySelect(isAllChip ? null : item.name)}
      >
        <ThemedText
          style={[
            styles.categoryChipText,
            { color: isSelected ? '#000' : theme.text },
          ]}
        >
          {item.name} ({item.count})
        </ThemedText>
      </Pressable>
    );
  };

  const renderRuleCard = ({ item }: { item: FashionRule }) => {
    const isExpanded = expandedRules.has(item.id);
    const difficultyStyle = DIFFICULTY_COLORS[item.difficulty] || DIFFICULTY_COLORS.Beginner;

    return (
      <Pressable onPress={() => toggleRuleExpansion(item.id)}>
        <Card style={styles.ruleCard} elevation={1}>
          <View style={styles.ruleHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: palette.violet + '20' }]}>
              <Feather name={getCategoryIcon(item.category)} size={12} color={palette.violet} />
              <ThemedText style={[styles.categoryBadgeText, { color: palette.violet }]}>
                {item.category}
              </ThemedText>
            </View>
            <View style={[styles.difficultyBadge, { backgroundColor: difficultyStyle.bg }]}>
              <ThemedText style={[styles.difficultyText, { color: difficultyStyle.text }]}>
                {item.difficulty}
              </ThemedText>
            </View>
          </View>
          
          <ThemedText style={styles.ruleTitle}>{item.title}</ThemedText>
          
          <ThemedText 
            style={[styles.ruleContent, { color: theme.text + 'CC' }]}
            numberOfLines={isExpanded ? undefined : 3}
          >
            {item.content}
          </ThemedText>

          {isExpanded && item.colorSwatches && item.colorSwatches.length > 0 && (
            <View style={styles.swatchesContainer}>
              <ThemedText style={styles.swatchesLabel}>Color Examples:</ThemedText>
              <View style={styles.swatchesRow}>
                {item.colorSwatches.map((swatch, index) => (
                  <View key={index} style={styles.swatchItem}>
                    <View style={[styles.swatchColor, { backgroundColor: swatch.hex }]} />
                    <ThemedText style={styles.swatchName}>{swatch.name}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, isExpanded ? undefined : 3).map((tag, index) => (
                <View 
                  key={index} 
                  style={[styles.tag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                >
                  <ThemedText style={styles.tagText}>#{tag}</ThemedText>
                </View>
              ))}
              {!isExpanded && item.tags.length > 3 && (
                <ThemedText style={[styles.moreTagsText, { color: palette.gold }]}>
                  +{item.tags.length - 3} more
                </ThemedText>
              )}
            </View>
          )}

          <View style={styles.expandIndicator}>
            <Feather 
              name={isExpanded ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={theme.text + '60'} 
            />
          </View>
        </Card>
      </Pressable>
    );
  };

  const allCategory = { name: 'All', count: rules.length };
  const categoryList = [allCategory, ...categories];

  const ListHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={[...palette.gradientPrimary] as [string, string]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Feather name="book" size={32} color="#FFF" />
          </View>
          <ThemedText style={styles.headerTitle}>Style Rules</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {rules.length}+ essential fashion guidelines
          </ThemedText>
        </View>
      </LinearGradient>

      <View style={styles.categoriesSection}>
        <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
        <View style={styles.categoriesScroll}>
          {categoryList.map((cat, index) => (
            <View key={cat.name}>
              {renderCategoryChip({ item: cat })}
            </View>
          ))}
        </View>
      </View>

      <ThemedText style={styles.rulesCount}>
        {selectedCategory ? `${rules.length} rules in ${selectedCategory}` : `All ${rules.length} rules`}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.gold} />
        <ThemedText style={styles.loadingText}>Loading style rules...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenFlatList
        data={rules}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRuleCard}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.gold}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="book-open" size={48} color={theme.text + '40'} />
            <ThemedText style={styles.emptyText}>No style rules found</ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: theme.text + '80' }]}>
              Try selecting a different category
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    opacity: 0.7,
  },
  headerContainer: {
    marginBottom: Spacing.lg,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  categoriesSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  categoriesScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rulesCount: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    fontSize: 14,
    opacity: 0.7,
  },
  listContent: {
    paddingBottom: Spacing["3xl"],
  },
  ruleCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ruleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    lineHeight: 24,
  },
  ruleContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  swatchesContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  swatchesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
  swatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  swatchItem: {
    alignItems: 'center',
  },
  swatchColor: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  swatchName: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: 11,
    opacity: 0.8,
  },
  moreTagsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
});
