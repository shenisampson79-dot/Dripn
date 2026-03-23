import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWardrobe, WardrobeItem, ClothingCategory, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { dfyService, DFYAccessStatus } from "@/services/DFYService";
import apiService from "@/services/ApiService";
import type { WardrobeStackParamList } from "@/navigation/WardrobeStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

const getMinimalistCategoryColors = (): Record<string, { gradient: readonly [string, string]; icon: string }> => ({
  'all': { gradient: ['#C9A87C', '#A88B5C'] as const, icon: 'grid' },
  'tops': { gradient: ['#C4A484', '#B49474'] as const, icon: 'sun' },
  'bottoms': { gradient: ['#A69279', '#968269'] as const, icon: 'minimize-2' },
  'dresses': { gradient: ['#D4C4B0', '#C4B4A0'] as const, icon: 'heart' },
  'outerwear': { gradient: ['#8B7D6B', '#7B6D5B'] as const, icon: 'cloud' },
  'shoes': { gradient: ['#C9A87C', '#A88B5C'] as const, icon: 'disc' },
  'bags': { gradient: ['#8B7355', '#7B6345'] as const, icon: 'shopping-bag' },
  'accessories': { gradient: ['#B8A898', '#A89888'] as const, icon: 'watch' },
  'activewear_tops': { gradient: ['#9C8B7A', '#8C7B6A'] as const, icon: 'activity' },
  'activewear_bottoms': { gradient: ['#9C8B7A', '#8C7B6A'] as const, icon: 'activity' },
  'formal': { gradient: ['#6B5B4F', '#5B4B3F'] as const, icon: 'star' },
});

const getColorfulCategoryColors = (): Record<string, { gradient: readonly [string, string]; icon: string }> => ({
  'all': { gradient: ['#9B7EBD', '#6B4E8D'] as const, icon: 'grid' },
  'tops': { gradient: ['#E07A5F', '#C46A4F'] as const, icon: 'sun' },
  'bottoms': { gradient: ['#2A9D8F', '#059669'] as const, icon: 'minimize-2' },
  'dresses': { gradient: ['#E8B4B8', '#D4949A'] as const, icon: 'heart' },
  'outerwear': { gradient: ['#64748B', '#475569'] as const, icon: 'cloud' },
  'shoes': { gradient: ['#C9A87C', '#A88B5C'] as const, icon: 'disc' },
  'bags': { gradient: ['#8B2F39', '#6B2430'] as const, icon: 'shopping-bag' },
  'accessories': { gradient: ['#8B5CF6', '#7C3AED'] as const, icon: 'watch' },
  'activewear_tops': { gradient: ['#06B6D4', '#0891B2'] as const, icon: 'activity' },
  'activewear_bottoms': { gradient: ['#0284C7', '#0369A1'] as const, icon: 'activity' },
  'formal': { gradient: ['#1E293B', '#0F172A'] as const, icon: 'star' },
});

type WardrobeScreenProps = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, "Wardrobe">;
};

const CATEGORY_KEYS: Array<{ key: ClothingCategory | 'all'; icon: string; iconSet: 'feather' | 'material'; translationKey: string }> = [
  { key: 'all', icon: 'grid', iconSet: 'feather', translationKey: 'wardrobe.categoryAll' },
  { key: 'tops', icon: 'tshirt-crew', iconSet: 'material', translationKey: 'wardrobe.categoryTops' },
  { key: 'bottoms', icon: 'layers', iconSet: 'feather', translationKey: 'wardrobe.categoryBottoms' },
  { key: 'dresses', icon: 'human-female', iconSet: 'material', translationKey: 'wardrobe.categoryDresses' },
  { key: 'outerwear', icon: 'cloud', iconSet: 'feather', translationKey: 'wardrobe.categoryOuterwear' },
  { key: 'shoes', icon: 'shoe-formal', iconSet: 'material', translationKey: 'wardrobe.categoryShoes' },
  { key: 'bags', icon: 'briefcase', iconSet: 'material', translationKey: 'wardrobe.categoryBags' },
  { key: 'accessories', icon: 'watch', iconSet: 'material', translationKey: 'wardrobe.categoryAccessories' },
  { key: 'activewear_tops', icon: 'run-fast', iconSet: 'material', translationKey: 'wardrobe.categoryActivewearTops' },
  { key: 'activewear_bottoms', icon: 'run', iconSet: 'material', translationKey: 'wardrobe.categoryActivewearBottoms' },
  { key: 'formal', icon: 'bow-tie', iconSet: 'material', translationKey: 'wardrobe.categoryFormal' },
];

export default function WardrobeScreen({ navigation }: WardrobeScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colorScheme, palette } = useColorScheme();
  const { translations, t } = useTranslations();
  const ALL_CATEGORY_OPTIONS = useMemo(
    () => CATEGORY_KEYS.map(({ key, icon, iconSet, translationKey }) => ({ key, icon, iconSet, label: t(translationKey) })),
    [t]
  );
  const { items, isLoading, deleteItem, toggleItemFavorite, markItemWorn, updateItem } = useWardrobe();
  
  const CATEGORY_COLORS = colorScheme === 'minimalist' 
    ? getMinimalistCategoryColors() 
    : getColorfulCategoryColors();

  const LUXURY_COLORS = {
    gold: palette.gold,
    deepGold: palette.deepGold,
    rose: palette.rose,
    berry: palette.berry,
    violet: palette.violet,
    deepViolet: palette.deepViolet,
    champagne: '#F5E6D3',
    midnight: '#1A1A2E',
    coral: palette.coral,
    teal: palette.teal,
    emerald: palette.emerald,
  };
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [dfyAccess, setDfyAccess] = useState<DFYAccessStatus | null>(null);
  const [showAIOutfitModal, setShowAIOutfitModal] = useState(false);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);
  const [generatingOccasion, setGeneratingOccasion] = useState<string | null>(null);
  const [generatedOutfit, setGeneratedOutfit] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const loadDFYAccess = async () => {
        if (user?.id) {
          const access = await dfyService.getDFYAccessStatus(user.id);
          setDfyAccess(access);
        }
      };
      loadDFYAccess();
    }, [user?.id])
  );

  const CATEGORY_OPTIONS = user?.gender === 'man' 
    ? ALL_CATEGORY_OPTIONS.filter(cat => cat.key !== 'dresses')
    : ALL_CATEGORY_OPTIONS;

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  const handleAddItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AddWardrobeItem");
  };

  const handleQuickAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BulkWardrobeUpload");
  };

  const handleAICreateOutfit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (items.length < 3) {
      Alert.alert(
        translations.wardrobe.moreItemsNeeded,
        translations.wardrobe.addItemsMessage,
        [{ text: translations.common.done }]
      );
      return;
    }
    // Always refresh DFY access status right before opening the modal
    if (user?.id) {
      try {
        const access = await dfyService.getDFYAccessStatus(user.id);
        setDfyAccess(access);
      } catch (_) {}
    }
    setShowAIOutfitModal(true);
  };

  const handleItemPress = (item: WardrobeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (item: WardrobeItem) => {
    Alert.alert(
      translations.wardrobe.deleteItem,
      translations.wardrobe.deleteConfirm,
      [
        { text: translations.common.cancel, style: "cancel" },
        {
          text: translations.common.done,
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem(item.id);
              setShowItemModal(false);
              setSelectedItem(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert(translations.common.error, translations.common.error);
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (item: WardrobeItem) => {
    try {
      await toggleItemFavorite(item.id);
      setSelectedItem({ ...item, isFavorite: !item.isFavorite });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleMarkWorn = async (item: WardrobeItem) => {
    try {
      await markItemWorn(item.id);
      setSelectedItem({ ...item, timesWorn: item.timesWorn + 1 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(translations.common.done, translations.wardrobe.markedAsWorn);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const handleAdjustWearCount = async (item: WardrobeItem, delta: number) => {
    const newCount = Math.max(0, item.timesWorn + delta);
    if (newCount === item.timesWorn) return;
    
    try {
      await updateItem(item.id, { timesWorn: newCount });
      setSelectedItem({ ...item, timesWorn: newCount });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert(translations.common.error, translations.common.error);
    }
  };

  const renderCategoryTab = useCallback(({ item }: { item: typeof CATEGORY_OPTIONS[0] }) => {
    const isSelected = selectedCategory === item.key;
    const colors = CATEGORY_COLORS[item.key] || CATEGORY_COLORS['all'];
    
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCategory(item.key);
        }}
        style={styles.categoryTabWrapper}
      >
        {isSelected ? (
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryTab}
          >
            {item.iconSet === 'material' ? (
              <MaterialCommunityIcons name={item.icon as any} size={14} color="#FFFFFF" />
            ) : (
              <Feather name={item.icon as any} size={14} color="#FFFFFF" />
            )}
            <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              {item.label}
            </ThemedText>
          </LinearGradient>
        ) : (
          <View style={[styles.categoryTab, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            {item.iconSet === 'material' ? (
              <MaterialCommunityIcons name={item.icon as any} size={14} color={theme.tabIconDefault} />
            ) : (
              <Feather name={item.icon as any} size={14} color={theme.tabIconDefault} />
            )}
            <ThemedText type="caption">{item.label}</ThemedText>
          </View>
        )}
      </Pressable>
    );
  }, [selectedCategory, theme, isDark]);

  const renderWardrobeItem = useCallback(({ item }: { item: WardrobeItem }) => {
    const hasProcessedImage = item.imageProcessed || item.aiAnalyzed;
    const categoryColors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['all'];
    
    return (
      <Pressable
        onPress={() => handleItemPress(item)}
        style={({ pressed }) => [
          styles.itemCard,
          {
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.itemImageWrapper, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
          <Image
            source={{ uri: item.imageUri }}
            style={styles.itemImage}
            contentFit={hasProcessedImage ? "contain" : "cover"}
            transition={200}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.itemOverlay}
          />
          <View style={styles.itemInfoOverlay}>
            <ThemedText type="caption" numberOfLines={1} style={styles.itemNameOverlay}>
              {item.name}
            </ThemedText>
            <ThemedText type="caption" style={styles.itemWornText}>
              Worn {item.timesWorn}x
            </ThemedText>
          </View>
        </View>
        {item.isFavorite ? (
          <LinearGradient
            colors={[LUXURY_COLORS.rose, LUXURY_COLORS.coral]}
            style={styles.favoriteIndicator}
          >
            <Feather name="heart" size={10} color="#FFFFFF" />
          </LinearGradient>
        ) : null}
        <View style={styles.categoryIndicator}>
          <LinearGradient
            colors={categoryColors.gradient}
            style={styles.categoryDot}
          />
        </View>
      </Pressable>
    );
  }, [theme, isDark]);

  const renderEmptyCategoryState = () => {
    const categoryLabel = CATEGORY_OPTIONS.find(c => c.key === selectedCategory)?.label || selectedCategory;
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={[LUXURY_COLORS.violet + '30', LUXURY_COLORS.rose + '20']}
          style={styles.emptyIconContainer}
        >
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={styles.emptyIconGradient}
          >
            <Feather name="folder" size={32} color="#FFFFFF" />
          </LinearGradient>
        </LinearGradient>
        <ThemedText type="h2" style={styles.emptyTitle}>
          No {categoryLabel} yet
        </ThemedText>
        <ThemedText type="body" style={styles.emptyText}>
          Add some {categoryLabel.toLowerCase()} to your wardrobe to see them here
        </ThemedText>
        <LinearGradient
          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyButtonGradient}
        >
          <Pressable onPress={handleAddItem} style={styles.emptyButtonInner}>
            <Feather name="plus" size={18} color={LUXURY_COLORS.midnight} />
            <ThemedText type="body" style={styles.emptyButtonText}>
              Add {categoryLabel}
            </ThemedText>
          </Pressable>
        </LinearGradient>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={[LUXURY_COLORS.violet + '30', LUXURY_COLORS.rose + '20']}
        style={styles.emptyIconContainer}
      >
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          style={styles.emptyIconGradient}
        >
          <Feather name="inbox" size={32} color="#FFFFFF" />
        </LinearGradient>
      </LinearGradient>
      <ThemedText type="h2" style={styles.emptyTitle}>
        {translations.wardrobe.wardrobeAwaits || 'Your wardrobe awaits'}
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        {translations.wardrobe.wardrobeAwaitsDesc || 'Start building your digital closet by adding photos of your favourite pieces'}
      </ThemedText>
      <LinearGradient
        colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.emptyButtonGradient}
      >
        <Pressable onPress={handleQuickAdd} style={styles.emptyButtonInner}>
          <Feather name="layers" size={18} color={LUXURY_COLORS.midnight} />
          <ThemedText type="body" style={styles.emptyButtonText}>
            {translations.wardrobe.quickAddMultiple || 'Quick Add Multiple Items'}
          </ThemedText>
        </Pressable>
      </LinearGradient>
      <Pressable
        onPress={handleAddItem}
        style={[styles.emptyButtonSecondary, { borderColor: LUXURY_COLORS.gold }]}
      >
        <Feather name="plus" size={18} color={LUXURY_COLORS.gold} />
        <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: LUXURY_COLORS.gold }}>
          {translations.wardrobe.addSingleItem || 'Add Single Item'}
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderListEmptyComponent = () => {
    if (items.length > 0 && selectedCategory !== 'all') {
      return renderEmptyCategoryState();
    }
    return renderEmptyState();
  };

  const renderItemModal = () => {
    if (!selectedItem) return null;
    const categoryColors = CATEGORY_COLORS[selectedItem.category] || CATEGORY_COLORS['all'];
    
    return (
      <Modal
        visible={showItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={isDark 
              ? [categoryColors.gradient[0] + '40', 'transparent'] 
              : [categoryColors.gradient[0] + '20', 'transparent']
            }
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowItemModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">{t('wardrobe.itemDetails')}</ThemedText>
              <Pressable
                onPress={() => handleToggleFavorite(selectedItem)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather
                  name="heart"
                  size={24}
                  color={selectedItem.isFavorite ? LUXURY_COLORS.coral : theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </LinearGradient>

          <FlatList
            data={[selectedItem]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <>
                <View style={[styles.modalImageWrapper, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
                  <Image
                    source={{ uri: selectedItem.imageUri }}
                    style={styles.modalImage}
                    contentFit={selectedItem.imageProcessed || selectedItem.aiAnalyzed ? "contain" : "cover"}
                    transition={300}
                  />
                </View>

                <View style={styles.modalInfo}>
                  <ThemedText type="h2" style={styles.modalItemName}>
                    {selectedItem.name}
                  </ThemedText>

                  <View style={styles.modalTags}>
                    <LinearGradient
                      colors={categoryColors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalTagGradient}
                    >
                      <Feather name="tag" size={12} color="#FFFFFF" />
                      <ThemedText type="caption" style={{ color: '#FFFFFF' }}>{CATEGORY_LABELS[selectedItem.category]}</ThemedText>
                    </LinearGradient>
                    <View style={[styles.modalTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <View style={[styles.colorDot, { backgroundColor: getColorHex(selectedItem.color) }]} />
                      <ThemedText type="caption">{selectedItem.color}</ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                          style={styles.statIconContainer}
                        >
                          <Feather name="repeat" size={14} color="#FFFFFF" />
                        </LinearGradient>
                        <View style={styles.wearCountContainer}>
                          <Pressable
                            onPress={() => handleAdjustWearCount(selectedItem, -1)}
                            disabled={selectedItem.timesWorn === 0}
                            style={[
                              styles.wearCountButton,
                              { 
                                backgroundColor: selectedItem.timesWorn === 0 
                                  ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                                  : LUXURY_COLORS.coral + '20',
                                opacity: selectedItem.timesWorn === 0 ? 0.5 : 1,
                              }
                            ]}
                          >
                            <Feather 
                              name="minus" 
                              size={16} 
                              color={selectedItem.timesWorn === 0 ? (isDark ? '#666' : '#999') : LUXURY_COLORS.coral} 
                            />
                          </Pressable>
                          <ThemedText type="h3" style={{ minWidth: 30, textAlign: 'center' }}>
                            {selectedItem.timesWorn}
                          </ThemedText>
                          <Pressable
                            onPress={() => handleAdjustWearCount(selectedItem, 1)}
                            style={[
                              styles.wearCountButton,
                              { backgroundColor: LUXURY_COLORS.teal + '20' }
                            ]}
                          >
                            <Feather name="plus" size={16} color={LUXURY_COLORS.teal} />
                          </Pressable>
                        </View>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>{t('wardrobe.timesWorn')}</ThemedText>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                      <View style={styles.statItem}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.coral, '#C46A4F']}
                          style={styles.statIconContainer}
                        >
                          <Feather name="calendar" size={14} color="#FFFFFF" />
                        </LinearGradient>
                        <ThemedText type="h3">
                          {selectedItem.lastWorn 
                            ? new Date(selectedItem.lastWorn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : translations.wardrobe.never
                          }
                        </ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>{translations.wardrobe.lastWorn}</ThemedText>
                      </View>
                    </View>
                  </View>

                  {selectedItem.brand ? (
                    <View style={styles.detailRow}>
                      <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.gold + '20' }]}>
                        <Feather name="award" size={16} color={LUXURY_COLORS.gold} />
                      </View>
                      <ThemedText type="body">{selectedItem.brand}</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.coral + '20' }]}>
                      <Feather name="sun" size={16} color={LUXURY_COLORS.coral} />
                    </View>
                    <ThemedText type="body">
                      {selectedItem.seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                    </ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.violet + '20' }]}>
                      <Feather name="calendar" size={16} color={LUXURY_COLORS.violet} />
                    </View>
                    <ThemedText type="body">
                      {selectedItem.occasions.map(o => o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ")).join(", ")}
                    </ThemedText>
                  </View>

                  {selectedItem.notes ? (
                    <View style={[styles.notesSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                      <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 4 }}>Notes</ThemedText>
                      <ThemedText type="body">{selectedItem.notes}</ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.xl }]}>
                  <LinearGradient
                    colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButtonGradient}
                  >
                    <Pressable
                      onPress={() => handleMarkWorn(selectedItem)}
                      style={styles.actionButtonInner}
                    >
                      <Feather name="check-circle" size={18} color="#FFFFFF" />
                      <ThemedText type="body" style={styles.actionButtonText}>
                        Log Wear
                      </ThemedText>
                    </Pressable>
                  </LinearGradient>

                  <Pressable
                    onPress={() => handleDeleteItem(selectedItem)}
                    style={[styles.actionButton, styles.deleteButton]}
                  >
                    <Feather name="trash-2" size={18} color="#FF3B30" />
                    <ThemedText type="body" style={{ color: "#FF3B30", fontWeight: '600' }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          />
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          style={styles.loadingIconContainer}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="body" style={{ marginTop: Spacing.lg }}>
          {t('wardrobe.loadingWardrobe')}
        </ThemedText>
      </View>
    );
  }

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist' 
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.wardrobe.primary[0], ScreenGradients.wardrobe.primary[1], LuxuryColors.obsidian] as const;

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <LinearGradient
        colors={headerGradientColors}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('wardrobe.myWardrobe')}</ThemedText>
            <View style={[styles.itemCountBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {items.length} {items.length === 1 ? (translations.wardrobe.piece || 'piece') : (translations.wardrobe.pieces || 'pieces')}
              </ThemedText>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={CATEGORY_OPTIONS}
          renderItem={renderCategoryTab}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
          contentContainerStyle={styles.categoryTabsContent}
        />

        {dfyAccess?.hasAccess && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dfyCardsScroll}
            contentContainerStyle={styles.dfyCardsContent}
          >
            {dfyAccess.tier === 'lite' ? (
              <>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYLookbook');
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.coral, '#C46A4F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="book-open" size={20} color="#FFFFFF" />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                        {t('wardrobe.myLookbook')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {dfyAccess.daysRemaining}d left
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYCalendar', { tier: 'lite' });
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="calendar" size={20} color="#FFFFFF" />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                        {t('wardrobe.calendar14Day')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        Daily outfits
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYModularWardrobe');
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="grid" size={20} color={LUXURY_COLORS.midnight} />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700' }}>
                        {t('wardrobe.modularWardrobe')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(0,0,0,0.6)' }}>
                        Mix & match
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(0,0,0,0.4)" />
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('DFYCalendar', { tier: 'core' });
                  }}
                  style={({ pressed }) => [styles.dfyCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dfyCardGradient}
                  >
                    <Feather name="calendar" size={20} color="#FFFFFF" />
                    <View style={styles.dfyCardText}>
                      <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                        {t('wardrobe.calendar30Day')}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {dfyAccess.daysRemaining}d left
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderWardrobeItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderListEmptyComponent}
      />

      {renderItemModal()}

      <View style={[styles.fabContainer, { bottom: insets.bottom + 100 }]}>
        <Pressable
          onPress={handleAICreateOutfit}
          style={[styles.fabSecondary, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}
        >
          <Feather name="zap" size={20} color={LUXURY_COLORS.coral} />
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate('OutfitBuilder');
          }}
          style={[styles.fabSecondary, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}
        >
          <Feather name="shuffle" size={20} color={LUXURY_COLORS.teal} />
        </Pressable>
        <Pressable
          onPress={handleQuickAdd}
          style={[styles.fabSecondary, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}
        >
          <Feather name="layers" size={20} color={LUXURY_COLORS.violet} />
        </Pressable>
        <LinearGradient
          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          style={styles.fab}
        >
          <Pressable onPress={handleAddItem} style={styles.fabInner}>
            <Feather name="plus" size={28} color={LUXURY_COLORS.midnight} />
          </Pressable>
        </LinearGradient>
      </View>

      <Modal
        visible={showAIOutfitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIOutfitModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={isDark 
              ? [LUXURY_COLORS.coral + '40', 'transparent'] 
              : [LUXURY_COLORS.coral + '20', 'transparent']
            }
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowAIOutfitModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">{t('wardrobe.aiOutfitCreator')}</ThemedText>
              <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ padding: Spacing.xl }}
          >
            <View style={styles.aiOutfitHeader}>
              <LinearGradient
                colors={[LUXURY_COLORS.coral, '#C46A4F']}
                style={styles.aiOutfitIconContainer}
              >
                <Feather name="zap" size={32} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="h2" style={{ textAlign: 'center', marginTop: Spacing.lg }}>
                Create Outfits from Your Wardrobe
              </ThemedText>
              <ThemedText type="body" style={{ textAlign: 'center', color: theme.tabIconDefault, marginTop: Spacing.sm }}>
                AI will combine your {items.length} items into stylish outfits based on your Style DNA
              </ThemedText>
            </View>

            {dfyAccess?.hasAccess ? (
              <View style={[styles.dfyStatusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <View style={styles.dfyStatusHeader}>
                  <LinearGradient
                    colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
                    style={styles.dfyStatusBadge}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </LinearGradient>
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: '600' }}>
                    {dfyAccess.tier === 'core' ? 'Core Wardrobe' : 'Outfit-Based'} Active
                  </ThemedText>
                </View>
                <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: Spacing.xs }}>
                  {dfyAccess.tier === 'core' 
                    ? 'Dynamic outfit generation with remix capability' 
                    : '3-5 core outfits for your chosen occasion'}
                </ThemedText>
              </View>
            ) : (
              <Pressable 
                onPress={() => {
                  setShowAIOutfitModal(false);
                  navigation.navigate('ProfileTab' as any, { screen: 'Subscription', params: { scrollToDFY: true } });
                }}
                style={[styles.dfyPromptCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              >
                <View style={styles.dfyPromptContent}>
                  <Feather name="gift" size={24} color={LUXURY_COLORS.coral} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>{t('wardrobe.unlockDFY')}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                      Get professionally curated outfits from £19.99
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
                </View>
              </Pressable>
            )}

            <View style={styles.aiOutfitOptions}>
              <ThemedText type="body" style={{ marginBottom: Spacing.md, fontWeight: '600' }}>
                Generate Outfits For:
              </ThemedText>
              
              {[
                { id: 'todays_look', icon: 'sun', label: 'Today\'s Look', desc: 'Based on weather & your calendar' },
                { id: 'work_outfit', icon: 'briefcase', label: 'Work Outfit', desc: 'Professional & polished' },
                { id: 'date_night', icon: 'heart', label: 'Date Night', desc: 'Stylish & confident' },
                { id: 'casual_day', icon: 'coffee', label: 'Casual Day', desc: 'Comfortable & effortless' },
                { id: 'weekend', icon: 'sunset', label: 'Weekend', desc: 'Relaxed & put-together' },
                { id: 'smart_casual', icon: 'layers', label: 'Smart Casual', desc: 'Elevated everyday style' },
                { id: 'gym', icon: 'activity', label: 'Gym', desc: 'Functional & stylish' },
                { id: 'evening_out', icon: 'star', label: 'Evening Out', desc: 'Elevated & memorable' },
                { id: 'travel', icon: 'navigation', label: 'Travel', desc: 'Comfortable yet stylish' },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  disabled={isGeneratingOutfit}
                  onPress={async () => {
                    try {
                      setIsGeneratingOutfit(true);
                      setGeneratingOccasion(option.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      
                      const result = await apiService.generateOutfit({
                        occasionType: option.id as any,
                        stylistId: user?.stylistPreferences?.selectedStylistId || 'ruby',
                        saveToCalendar: true,
                        calendarDate: new Date().toISOString().split('T')[0],
                        localItems: items.map(i => ({
                          id: i.id,
                          name: i.name,
                          category: i.category,
                          color: i.color,
                          imageUri: i.imageUri,
                        })),
                      });
                      
                      if (result.success && result.outfit) {
                        setGeneratedOutfit(result.outfit);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setShowAIOutfitModal(false);
                        navigation.navigate('OutfitCalendar' as any, { 
                          generatedOutfit: result.outfit,
                          occasion: option.id 
                        });
                      }
                    } catch (error: any) {
                      Alert.alert(
                        'Generation Failed',
                        error.message || 'Unable to generate outfit. Please try again.'
                      );
                    } finally {
                      setIsGeneratingOutfit(false);
                      setGeneratingOccasion(null);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.aiOutfitOptionCard,
                    { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      opacity: pressed || (isGeneratingOutfit && generatingOccasion !== option.id) ? 0.5 : 1,
                    }
                  ]}
                >
                  <LinearGradient
                    colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                    style={styles.aiOutfitOptionIcon}
                  >
                    <Feather name={option.icon as any} size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>{option.label}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.tabIconDefault }}>{option.desc}</ThemedText>
                  </View>
                  {generatingOccasion === option.id ? (
                    <ActivityIndicator size="small" color={LUXURY_COLORS.violet} />
                  ) : (
                    <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.styleDNASection}>
              <ThemedText type="small" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
                Outfits are personalized using your Style DNA
              </ThemedText>
              <View style={styles.styleDNATags}>
                {user?.gender && (
                  <View style={[styles.styleDNATag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption">{user.gender}</ThemedText>
                  </View>
                )}
                {user?.stylePreference && (
                  <View style={[styles.styleDNATag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption">{user.stylePreference}</ThemedText>
                  </View>
                )}
                {user?.bodyShape && (
                  <View style={[styles.styleDNATag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption">{user.bodyShape}</ThemedText>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    black: '#000000',
    white: '#FFFFFF',
    gray: '#808080',
    navy: '#001F3F',
    brown: '#8B4513',
    beige: '#F5F5DC',
    red: '#FF0000',
    pink: '#FFC0CB',
    orange: '#FFA500',
    yellow: '#FFFF00',
    green: '#008000',
    blue: '#0000FF',
    purple: '#800080',
    multicolor: '#FF69B4',
  };
  return colorMap[color] || '#808080';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  headerTitleContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  itemCountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTabs: {
    marginBottom: Spacing.sm,
  },
  categoryTabsContent: {
    gap: Spacing.sm,
  },
  categoryTabWrapper: {},
  dfyCardsScroll: {
    marginTop: Spacing.sm,
    marginHorizontal: -Spacing.xl,
  },
  dfyCardsContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  dfyCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  dfyCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  dfyCardText: {
    flex: 1,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  gridContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  itemCard: {
    width: ITEM_SIZE,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  itemImageWrapper: {
    width: "100%",
    height: ITEM_SIZE + 20,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  itemInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  itemNameOverlay: {
    color: '#FFFFFF',
    fontWeight: "600",
    marginBottom: 2,
  },
  itemWornText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  favoriteIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["5xl"],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  emptyButtonGradient: {
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  emptyButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
  },
  emptyButtonText: {
    color: '#1A1A2E',
    fontWeight: "700",
  },
  emptyButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#C9A87C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderGradient: {
    paddingBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: Spacing.xl,
  },
  modalImageWrapper: {
    width: "100%",
    height: SCREEN_WIDTH - Spacing.xl * 2,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalInfo: {
    marginTop: Spacing.xl,
  },
  modalItemName: {
    marginBottom: Spacing.md,
  },
  modalTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalTagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  modalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    height: 60,
    marginHorizontal: Spacing.lg,
  },
  wearCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wearCountButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSection: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing["2xl"],
  },
  actionButtonGradient: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  aiOutfitHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  aiOutfitIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyStatusCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  dfyStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dfyStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dfyPromptCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  dfyPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiOutfitOptions: {
    marginBottom: Spacing.xl,
  },
  aiOutfitOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  aiOutfitOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleDNASection: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  styleDNATags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  styleDNATag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
});
