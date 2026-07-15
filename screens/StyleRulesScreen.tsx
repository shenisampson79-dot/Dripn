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
import { useTranslations } from "@/contexts/TranslationContext";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import weatherService, { type WeatherCondition } from "@/services/WeatherService";
import { personalizeStyleRules } from "@/utils/personalizedStyleRules";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";
import { FASHION_CATEGORIES, type FashionRule, type CategoryInfo } from "@/data/fashionRules";
import { getFashionRules } from "@/data/getFashionRules";

type StyleRulesScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StyleRules">;
};

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  Beginner: { bg: '#E8F5E9', text: '#2E7D32' },
  Intermediate: { bg: '#FFF3E0', text: '#EF6C00' },
  Advanced: { bg: '#FCE4EC', text: '#C2185B' },
};

const CATEGORY_I18N_KEYS: Record<string, string> = {
  All: 'styleRules.category.all',
  'Colour & Palette': 'styleRules.category.colourPalette',
  'Silhouette & Proportion': 'styleRules.category.silhouetteProportion',
  'Fabric & Texture': 'styleRules.category.fabricTexture',
  'Occasion & Context': 'styleRules.category.occasionContext',
  Accessories: 'styleRules.category.accessories',
  'Seasonal Dressing': 'styleRules.category.seasonalDressing',
  'Care & Maintenance': 'styleRules.category.careMaintenance',
  'Investment Pieces': 'styleRules.category.investmentPieces',
  'Body Confidence': 'styleRules.category.bodyConfidence',
  Sustainability: 'styleRules.category.sustainability',
};

const DIFFICULTY_I18N_KEYS: Record<string, string> = {
  Beginner: 'styleRules.difficulty.beginner',
  Intermediate: 'styleRules.difficulty.intermediate',
  Advanced: 'styleRules.difficulty.advanced',
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

export default function StyleRulesScreen({ navigation }: StyleRulesScreenProps) {
  const { theme, isDark } = useTheme();
  const { translations, t, currentLanguage } = useTranslations();
  const { palette } = useColorScheme();
  const { user } = useAuth();
  const { items: wardrobeItems } = useWardrobe();
  const localizedRules = React.useMemo(
    () => getFashionRules(currentLanguage),
    [currentLanguage],
  );
  const [rules, setRules] = useState<FashionRule[]>(localizedRules);
  const [categories, setCategories] = useState<CategoryInfo[]>(FASHION_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());
  const [highlightRule, setHighlightRule] = useState<FashionRule | null>(null);
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherCondition | null>(null);

  const localizeCategory = useCallback((name: string) => {
    const key = CATEGORY_I18N_KEYS[name];
    return (key ? t(key) : '') || name;
  }, [t]);

  const localizeDifficulty = useCallback((difficulty: string) => {
    const key = DIFFICULTY_I18N_KEYS[difficulty];
    return (key ? t(key) : '') || difficulty;
  }, [t]);

  const applyPersonalization = useCallback((
    allRules: FashionRule[],
    category: string | null,
    currentWeather: WeatherCondition | null,
  ) => {
    const base = category
      ? allRules.filter((rule) => rule.category === category)
      : allRules;

    const personalized = personalizeStyleRules(base, {
      gender: user?.gender,
      wardrobeItems,
      weather: currentWeather,
      bodyShape: user?.bodyShape,
      language: currentLanguage,
    });

    setHighlightRule(category ? null : personalized.highlightRule);
    setContextLabel(personalized.contextLabel);
    setRules(personalized.orderedRules);
  }, [user?.gender, user?.bodyShape, wardrobeItems, currentLanguage]);

  const loadContext = useCallback(async () => {
    const currentWeather = await weatherService.getWeatherForOutfits().catch(() => null);
    setWeather(currentWeather);
    applyPersonalization(localizedRules, selectedCategory, currentWeather);
  }, [applyPersonalization, selectedCategory, localizedRules]);
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setCategories(FASHION_CATEGORIES);
      await loadContext();
      setIsLoading(false);
    };
    loadInitialData();
  }, [loadContext]);

  useEffect(() => {
    applyPersonalization(localizedRules, selectedCategory, weather);
  }, [selectedCategory, weather, applyPersonalization, localizedRules]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCategories(FASHION_CATEGORIES);
    await weatherService.clearWeatherCache().catch(() => {});
    await loadContext();
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
          {localizeCategory(item.name)} ({item.count})
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
                {localizeCategory(item.category)}
              </ThemedText>
            </View>
            <View style={[styles.difficultyBadge, { backgroundColor: difficultyStyle.bg }]}>
              <ThemedText style={[styles.difficultyText, { color: difficultyStyle.text }]}>
                {localizeDifficulty(item.difficulty)}
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

  const allCategory = { name: 'All', count: localizedRules.length };
  const categoryList = [allCategory, ...categories];

  const ListHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={[...palette.gradientPrimary] as [string, string]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Feather name="book" size={32} color="#FFF" />
          </View>
          <ThemedText style={styles.headerTitle}>{translations.stylistHub?.styleRules || 'Style Rules'}</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {(t('styleRules.essentialGuidelines') || '{count}+ essential fashion guidelines')
              .replace('{count}', String(localizedRules.length))}
          </ThemedText>
        </View>
      </LinearGradient>

      {!selectedCategory && highlightRule && contextLabel ? (
        <Card style={styles.contextCard} elevation={2}>
          <View style={styles.contextHeader}>
            <Feather name="sun" size={18} color={palette.gold} />
            <ThemedText style={[styles.contextLabel, { color: palette.gold }]}>
              {contextLabel}
            </ThemedText>
          </View>
          <ThemedText style={styles.contextTitle}>{t('styleRules.topRuleToday') || 'Top rule for you today'}</ThemedText>
          <ThemedText style={styles.contextRuleTitle}>{highlightRule.title}</ThemedText>
          <ThemedText style={styles.contextRulePreview} numberOfLines={3}>
            {highlightRule.content}
          </ThemedText>
        </Card>
      ) : null}

      <View style={styles.categoriesSection}>
        <ThemedText style={styles.sectionTitle}>{t('styleRules.categories') || 'Categories'}</ThemedText>
        <View style={styles.categoriesScroll}>
          {categoryList.map((cat, index) => (
            <View key={cat.name}>
              {renderCategoryChip({ item: cat })}
            </View>
          ))}
        </View>
      </View>

      <ThemedText style={styles.rulesCount}>
        {selectedCategory
          ? (t('styleRules.rulesInCategory') || '{count} rules in {category}')
              .replace('{count}', String(rules.length))
              .replace('{category}', localizeCategory(selectedCategory))
          : (t('styleRules.allRules') || 'All {count} rules')
              .replace('{count}', String(localizedRules.length))}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.gold} />
        <ThemedText style={styles.loadingText}>{t('styleRules.loading') || 'Loading style rules...'}</ThemedText>
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
        opaqueHeader
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
  contextCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  contextTitle: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  contextRuleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  contextRulePreview: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  headerGradient: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  backButton: {
    display: 'none',
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
    marginTop: 0,
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
